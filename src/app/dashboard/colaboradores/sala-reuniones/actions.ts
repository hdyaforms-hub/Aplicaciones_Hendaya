'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { headers } from 'next/headers'
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { revalidatePath } from 'next/cache'

export interface ReservaSalaItem {
    id: string
    solicitante: string
    email: string
    userId: string | null
    fecha: string // YYYY-MM-DD
    horaInicio: string // HH:MM
    horaFin: string // HH:MM
    motivo: string
    estado: string // CONFIRMADA | CANCELADA
    tokenCancelacion: string
    sucursalId?: string | null
    sucursalNombre?: string | null
    createdAt: Date
    updatedAt: Date
}

export interface SucursalSalaItem {
    id: string
    nombre: string
    region?: string | null
    comuna?: string | null
    isCompartida?: boolean
    salaPrincipalNombre?: string
    compartidaCon?: string[]
}

export interface NoticiaItem {
    id: string
    titulo: string
    fuente: string
    link: string
    orden: number
}

export interface SalaDataResponse {
    diasSemana: string[]
    reservasSemana: ReservaSalaItem[]
    todasReservas: ReservaSalaItem[]
    resumen: {
        estado: 'libre' | 'ocupada'
        actual: {
            solicitante: string
            horaFin: string
            motivo: string
        } | null
        reservasHoy: number
        proximas: ReservaSalaItem[]
        ocupacionSemana: number
    }
    noticias: NoticiaItem[]
    currentUser: {
        id: string
        name: string
        email: string
        role: string
    } | null
    sucursalesDisponibles: SucursalSalaItem[]
    sucursalActiva: SucursalSalaItem | null
}

const NOTICIAS_DEFAULT: Omit<NoticiaItem, 'id'>[] = [
    {
        titulo: '¿Adiós Junaeb?: El desconocido oficio del Ministerio de Hacienda que recomienda descontinuar el Programa de Alimentación Escolar',
        fuente: 'ContrapoderChile.cl',
        link: 'https://contrapoderchile.cl',
        orden: 1
    },
    {
        titulo: 'El hambre también entra a la sala de clases',
        fuente: 'radio.uchile.cl',
        link: 'https://radio.uchile.cl',
        orden: 2
    },
    {
        titulo: 'Colegios alertan que Junaeb redujo sus raciones de alimentos y organismo lo atribuye a mecanismo habitual de ajuste',
        fuente: 'La Tercera',
        link: 'https://www.latercera.com',
        orden: 3
    },
    {
        titulo: 'Junaeb confirma nuevas asignaciones de Beca de Alimentación para 2027 y desmiente versión de redes sociales',
        fuente: 'Diario Concepción',
        link: 'https://www.diarioconcepcion.cl',
        orden: 4
    },
    {
        titulo: '55 trabajadoras del Programa de Alimentación Escolar certifican sus competencias laborales en Santiago',
        fuente: 'mintrab.gob.cl',
        link: 'https://www.mintrab.gob.cl',
        orden: 5
    },
    {
        titulo: 'Allanan oficinas del Congreso y Junaeb por presuntas irregularidades en licitación del Programa de Alimentación Escolar',
        fuente: 'Chilevisión',
        link: 'https://www.chilevision.cl',
        orden: 6
    }
]

// Desencriptar credencial SMTP de Office 365
const ENCRYPTION_KEY = crypto
    .createHash('sha256')
    .update(String(process.env.SESSION_SECRET || 'super-secret-key-change-me'))
    .digest('base64')
    .substring(0, 32)

function decrypt(text: string): string {
    try {
        const textParts = text.split(':')
        const iv = Buffer.from(textParts.shift()!, 'hex')
        const encryptedText = Buffer.from(textParts.join(':'), 'hex')
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv)
        let decrypted = decipher.update(encryptedText)
        decrypted = Buffer.concat([decrypted, decipher.final()])
        return decrypted.toString()
    } catch {
        return text
    }
}

// Obtener fecha y hora actual en zona horaria local de Chile (America/Santiago)
function getNowSantiago() {
    const formatter = new Intl.DateTimeFormat('es-CL', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    })
    const parts = formatter.formatToParts(new Date())
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'
    const y = getPart('year')
    const m = getPart('month')
    const d = getPart('day')
    const hh = getPart('hour')
    const mm = getPart('minute')
    return {
        fechaActual: `${y}-${m}-${d}`,
        horaActual: `${hh}:${mm}`
    }
}

// Obtener la URL base de la aplicación de forma dinámica (soporta dev en puerto 3001, origin del cliente y dominio productivo https)
async function getBaseAppUrl(clientOrigin?: string): Promise<string> {
    if (clientOrigin && clientOrigin.startsWith('http')) {
        return clientOrigin.replace(/\/$/, '')
    }

    try {
        const headerList = await headers()

        // 1. Origin header (enviado por el navegador en todo Server Action / POST)
        const origin = headerList.get('origin')
        if (origin && origin !== 'null' && origin.startsWith('http')) {
            return origin.replace(/\/$/, '')
        }

        // 2. Referer header (URL completa desde donde llamó el navegador)
        const referer = headerList.get('referer')
        if (referer) {
            try {
                const url = new URL(referer)
                if (url.origin && url.origin.startsWith('http')) {
                    return url.origin.replace(/\/$/, '')
                }
            } catch {}
        }

        // 3. host / x-forwarded-host
        const host = headerList.get('x-forwarded-host') || headerList.get('host')
        const proto = headerList.get('x-forwarded-proto') || (host && !host.includes('localhost') ? 'https' : 'http')
        if (host) {
            return `${proto}://${host}`
        }
    } catch {
        // Fallback fuera de ciclo de petición HTTP directo
    }

    if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '')
    if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, '')

    return 'http://localhost:3001'
}

// Envío nativo de correo con el formato exacto solicitado
async function sendReservaConfirmationEmail({
    to,
    solicitante,
    fecha,
    horaInicio,
    horaFin,
    motivo,
    token,
    sucursalNombre,
    clientOrigin
}: {
    to: string
    solicitante: string
    fecha: string
    horaInicio: string
    horaFin: string
    motivo: string
    token: string
    sucursalNombre?: string | null
    clientOrigin?: string
}): Promise<{ success: boolean; warning?: string }> {
    try {
        const emailConfig = await rawPrisma.emailConfig.findUnique({ where: { id: 'global' } })
        if (!emailConfig) {
            console.warn('[SalaReuniones] Configuración global de correo no encontrada.')
            return { success: false, warning: 'No hay configuración global de correo en el sistema.' }
        }

        const transporter = nodemailer.createTransport({
            host: 'smtp.office365.com',
            port: 587,
            secure: false,
            auth: {
                user: emailConfig.email,
                pass: decrypt(emailConfig.password)
            },
            tls: {
                rejectUnauthorized: false
            }
        })

        const appUrl = await getBaseAppUrl(clientOrigin)
        const linkModificar = `${appUrl}/dashboard/colaboradores/sala-reuniones?action=modificar&token=${token}`
        const linkCancelar = `${appUrl}/dashboard/colaboradores/sala-reuniones?action=cancelar&token=${token}`

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827; line-height: 1.5; padding: 24px; background-color: #ffffff;">
                <p style="font-size: 16px; margin-bottom: 16px;">Hola <b>${solicitante}</b>,</p>
                <p style="font-size: 15px; margin-bottom: 16px;">Tu reserva de la Sala de Reuniones fue confirmada:</p>
                <ul style="font-size: 15px; line-height: 1.8; margin-bottom: 24px;">
                    ${sucursalNombre ? `<li><b>Sucursal:</b> ${sucursalNombre}</li>` : ''}
                    <li><b>Fecha:</b> ${fecha}</li>
                    <li><b>Horario:</b> ${horaInicio} a ${horaFin}</li>
                    <li><b>Motivo:</b> ${motivo}</li>
                </ul>
                <p style="font-size: 14px; margin-bottom: 12px; color: #4b5563;">Si necesitas modificar o cancelar esta reserva usa estos enlaces:</p>
                <p style="margin: 8px 0;">
                    <a href="${linkModificar}" style="color: #0891b2; text-decoration: underline; font-size: 14px; font-weight: bold;">Modificar reserva</a>
                </p>
                <p style="margin: 8px 0;">
                    <a href="${linkCancelar}" style="color: #e11d48; text-decoration: underline; font-size: 14px; font-weight: bold;">Cancelar reserva</a>
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0 16px 0;" />
                <p style="font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">HENDAYA · Gestión de Espacios Colaborativos</p>
            </div>
        `

        await transporter.sendMail({
            from: `"Sala de Reuniones Hendaya" <${emailConfig.email}>`,
            to,
            subject: `Confirmación de Reserva: Sala de Reuniones ${sucursalNombre ? `(${sucursalNombre}) ` : ''}(${fecha} ${horaInicio} - ${horaFin})`,
            html
        })

        return { success: true }
    } catch (e: any) {
        console.error('[SalaReuniones] Error enviando correo de confirmación:', e)
        let errorMsg = e?.message || 'Error desconocido'
        if (errorMsg.includes('535') || errorMsg.includes('Authentication unsuccessful')) {
            errorMsg = 'Error 535 en Office 365: Credenciales no válidas o expiradas para la cuenta remitente configurada.'
        }
        return { success: false, warning: errorMsg }
    }
}

// Envío de correo al cancelar una reserva
async function sendReservaCancellationEmail({
    to,
    solicitante,
    fecha,
    horaInicio,
    horaFin,
    motivo,
    sucursalNombre
}: {
    to: string
    solicitante: string
    fecha: string
    horaInicio: string
    horaFin: string
    motivo: string
    sucursalNombre?: string | null
}) {
    try {
        const emailConfig = await rawPrisma.emailConfig.findUnique({ where: { id: 'global' } })
        if (!emailConfig) return

        const transporter = nodemailer.createTransport({
            host: 'smtp.office365.com',
            port: 587,
            secure: false,
            auth: {
                user: emailConfig.email,
                pass: decrypt(emailConfig.password)
            },
            tls: { rejectUnauthorized: false }
        })

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827; line-height: 1.5; padding: 24px; background-color: #ffffff;">
                <p style="font-size: 16px; margin-bottom: 16px;">Hola <b>${solicitante}</b>,</p>
                <p style="font-size: 15px; margin-bottom: 16px; color: #dc2626;">Tu reserva de la Sala de Reuniones ha sido <b>CANCELADA</b>:</p>
                <ul style="font-size: 15px; line-height: 1.8; margin-bottom: 24px;">
                    ${sucursalNombre ? `<li><b>Sucursal:</b> ${sucursalNombre}</li>` : ''}
                    <li><b>Fecha:</b> ${fecha}</li>
                    <li><b>Horario:</b> ${horaInicio} a ${horaFin}</li>
                    <li><b>Motivo:</b> ${motivo}</li>
                </ul>
                <p style="font-size: 13px; color: #6b7280;">La sala queda liberada para que otros colaboradores puedan utilizarla.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0 16px 0;" />
                <p style="font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">HENDAYA · Gestión de Espacios Colaborativos</p>
            </div>
        `

        await transporter.sendMail({
            from: `"Sala de Reuniones Hendaya" <${emailConfig.email}>`,
            to,
            subject: `Cancelación de Reserva: Sala de Reuniones ${sucursalNombre ? `(${sucursalNombre}) ` : ''}(${fecha} ${horaInicio} - ${horaFin})`,
            html
        })
    } catch (e) {
        console.error('[SalaReuniones] Error enviando correo de cancelación:', e)
    }
}

// Registrar en AuditLog
async function logAudit(action: string, detalle: string) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'Sistema'
        const userId = session?.user?.id || null

        await rawPrisma.auditLog.create({
            data: {
                username,
                userId,
                action,
                modulo: 'Colaboradores -> Sala de Reuniones',
                detalle
            }
        })
    } catch (e) {
        console.error('[SalaReuniones] Error guardando auditoría:', e)
    }
}

let tablesInitPromise: Promise<void> | null = null

// Asegura que las tablas e índices existan en la base de datos (resiliente para entornos de producción)
export async function ensureTablesExist() {
    if (!tablesInitPromise) {
        tablesInitPromise = (async () => {
            try {
                await rawPrisma.$executeRawUnsafe(`
                    CREATE TABLE IF NOT EXISTS "reservas_sala" (
                        id TEXT PRIMARY KEY,
                        solicitante TEXT NOT NULL,
                        email TEXT NOT NULL,
                        "userId" TEXT,
                        fecha TEXT NOT NULL,
                        "horaInicio" TEXT NOT NULL,
                        "horaFin" TEXT NOT NULL,
                        motivo TEXT NOT NULL,
                        estado TEXT NOT NULL DEFAULT 'CONFIRMADA',
                        "tokenCancelacion" TEXT NOT NULL UNIQUE,
                        "sucursalId" TEXT,
                        "sucursalNombre" TEXT,
                        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                `)
                await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "tieneSalaReuniones" BOOLEAN NOT NULL DEFAULT false;`)
                await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "salaCompartidaId" TEXT;`)
                await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "sucursal_sala_compartida_idx" ON "Sucursal"("salaCompartidaId");`)
                await rawPrisma.$executeRawUnsafe(`ALTER TABLE "reservas_sala" ADD COLUMN IF NOT EXISTS "sucursalId" TEXT;`)
                await rawPrisma.$executeRawUnsafe(`ALTER TABLE "reservas_sala" ADD COLUMN IF NOT EXISTS "sucursalNombre" TEXT;`)
                await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "reservas_sala_fecha_idx" ON "reservas_sala"(fecha);`)
                await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "reservas_sala_estado_idx" ON "reservas_sala"(estado);`)
                await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "reservas_sala_token_idx" ON "reservas_sala"("tokenCancelacion");`)
                await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "reservas_sala_sucursal_idx" ON "reservas_sala"("sucursalId");`)
                await rawPrisma.$executeRawUnsafe(`
                    CREATE TABLE IF NOT EXISTS "noticias_alimentacion" (
                        id TEXT PRIMARY KEY,
                        titulo TEXT NOT NULL,
                        fuente TEXT NOT NULL,
                        link TEXT NOT NULL,
                        orden INTEGER NOT NULL DEFAULT 0,
                        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                `)
                // Auto-healing para asociar reservas históricas sin sucursal a la primera sucursal activa
                await rawPrisma.$executeRawUnsafe(`
                    UPDATE "reservas_sala"
                    SET "sucursalId" = (SELECT id FROM "Sucursal" WHERE "tieneSalaReuniones" = true ORDER BY nombre ASC LIMIT 1),
                        "sucursalNombre" = (SELECT nombre FROM "Sucursal" WHERE "tieneSalaReuniones" = true ORDER BY nombre ASC LIMIT 1)
                    WHERE "sucursalId" IS NULL AND EXISTS (SELECT 1 FROM "Sucursal" WHERE "tieneSalaReuniones" = true);
                `)
            } catch (err) {
                console.error('[SalaReuniones] Error verificando/creando tablas:', err)
                tablesInitPromise = null
                throw err
            }
        })()
    }
    return tablesInitPromise
}

export interface SucursalClusterInfo {
    clusterIds: string[]
    clusterNombres: string[]
    isCompartida: boolean
    salaPrincipalNombre: string
    sucursalesCompartidasNombres: string[]
}

// Obtener el cluster de sucursales que comparten la misma sala física
export async function getSucursalClusterInfo(sucursalId: string): Promise<SucursalClusterInfo> {
    try {
        const rows = await rawPrisma.$queryRaw<any[]>`
            SELECT id, nombre, "salaCompartidaId" FROM "Sucursal"
        `
        const target = rows.find(r => r.id === sucursalId)
        if (!target) {
            return {
                clusterIds: [sucursalId],
                clusterNombres: [],
                isCompartida: false,
                salaPrincipalNombre: '',
                sucursalesCompartidasNombres: []
            }
        }

        // Nodo raíz de la sala física compartida
        const rootId = target.salaCompartidaId || target.id
        const rootSucursal = rows.find(r => r.id === rootId) || target

        // Cluster formado por la sucursal anfitriona y todas las que apunten a ella
        const cluster = rows.filter(r => r.id === rootId || r.salaCompartidaId === rootId)
        const clusterIds = cluster.map(r => r.id)
        const clusterNombres = cluster.map(r => r.nombre)
        const sucursalesCompartidasNombres = cluster.filter(r => r.id !== target.id).map(r => r.nombre)

        return {
            clusterIds,
            clusterNombres,
            isCompartida: clusterIds.length > 1,
            salaPrincipalNombre: rootSucursal.nombre,
            sucursalesCompartidasNombres
        }
    } catch (err) {
        console.error('[SalaReuniones] Error obteniendo cluster de sucursal:', err)
        return {
            clusterIds: [sucursalId],
            clusterNombres: [],
            isCompartida: false,
            salaPrincipalNombre: '',
            sucursalesCompartidasNombres: []
        }
    }
}

// Obtener reservas de la base de datos (filtradas por el cluster de la sucursal seleccionada si aplica)
async function fetchReservasDB(sucursalId?: string): Promise<ReservaSalaItem[]> {
    try {
        await ensureTablesExist()
        let query = `
            SELECT id, solicitante, email, "userId", fecha, "horaInicio", "horaFin", motivo, estado, "tokenCancelacion", "sucursalId", "sucursalNombre", "createdAt", "updatedAt"
            FROM "reservas_sala"
        `
        const params: any[] = []
        if (sucursalId) {
            const cluster = await getSucursalClusterInfo(sucursalId)
            query += ` WHERE "sucursalId" = ANY($1)`
            params.push(cluster.clusterIds)
        }
        query += ` ORDER BY fecha ASC, "horaInicio" ASC`
        const res = await rawPrisma.$queryRawUnsafe<any[]>(query, ...params)
        return res.map(r => ({
            id: r.id,
            solicitante: r.solicitante,
            email: r.email,
            userId: r.userId,
            fecha: r.fecha,
            horaInicio: r.horaInicio,
            horaFin: r.horaFin,
            motivo: r.motivo,
            estado: r.estado,
            tokenCancelacion: r.tokenCancelacion,
            sucursalId: r.sucursalId || null,
            sucursalNombre: r.sucursalNombre || null,
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt)
        }))
    } catch (e) {
        console.error('[SalaReuniones] Error consultando reservas_sala:', e)
        return []
    }
}

// Obtener noticias
export async function getNoticias(): Promise<NoticiaItem[]> {
    try {
        await ensureTablesExist()
        const res = await rawPrisma.$queryRaw<any[]>`
            SELECT id, titulo, fuente, link, orden
            FROM "noticias_alimentacion"
            ORDER BY orden ASC, "createdAt" DESC
        `
        if (res.length === 0) {
            // Inicializar las noticias si no existen
            for (const n of NOTICIAS_DEFAULT) {
                const id = crypto.randomUUID()
                await rawPrisma.$executeRawUnsafe(
                    `INSERT INTO "noticias_alimentacion" (id, titulo, fuente, link, orden, "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())`,
                    id,
                    n.titulo,
                    n.fuente,
                    n.link,
                    n.orden
                )
            }
            return NOTICIAS_DEFAULT.map((n, idx) => ({ ...n, id: `init-${idx}` }))
        }

        return res.map(n => ({
            id: n.id,
            titulo: n.titulo,
            fuente: n.fuente,
            link: n.link,
            orden: n.orden
        }))
    } catch (e) {
        console.error('[SalaReuniones] Error cargando noticias:', e)
        return NOTICIAS_DEFAULT.map((n, idx) => ({ ...n, id: `fallback-${idx}` }))
    }
}

// Obtener datos completos de la semana, sucursales permitidas y cálculo de KPIs
export async function getSalaData(inicioSemanaISO: string, sucursalIdParam?: string): Promise<SalaDataResponse> {
    await ensureTablesExist()
    const session = await getSession()

    // 1. Obtener usuario de la base de datos con sus roles y sucursales asociadas a su perfil
    let dbUser: any = null
    if (session?.user?.id) {
        dbUser = await rawPrisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                role: { select: { name: true } },
                sucursales: {
                    select: {
                        id: true,
                        nombre: true,
                        region: true,
                        comuna: true,
                        tieneSalaReuniones: true
                    }
                }
            }
        })
    } else if (session?.user?.username) {
        dbUser = await rawPrisma.user.findFirst({
            where: { username: session.user.username },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                role: { select: { name: true } },
                sucursales: {
                    select: {
                        id: true,
                        nombre: true,
                        region: true,
                        comuna: true,
                        tieneSalaReuniones: true
                    }
                }
            }
        })
    }

    // Si el usuario es admin y en la BD no tiene correo o tiene el placeholder antiguo, sincronizar con el oficial
    if (dbUser && dbUser.username === 'admin' && (!dbUser.email || dbUser.email === 'admin@hendaya.cl')) {
        try {
            await rawPrisma.user.update({
                where: { id: dbUser.id },
                data: { email: 'doctohdya@hendayasac.cl' }
            })
            dbUser.email = 'doctohdya@hendayasac.cl'
        } catch (err) {
            console.error('[SalaReuniones] Error actualizando correo de admin:', err)
        }
    }

    // 2. Obtener todas las sucursales del sistema para mapear disponibilidad y salas compartidas
    const todasSucursales = await rawPrisma.$queryRaw<any[]>`
        SELECT id, nombre, region, comuna, COALESCE("tieneSalaReuniones", false) as "tieneSalaReuniones", "salaCompartidaId"
        FROM "Sucursal"
        ORDER BY nombre ASC
    `

    // Filtrar aquellas que cuentan con sala propia ("Sí") o que comparten sala con otra sucursal
    const sucursalesConSala = todasSucursales.filter(s => Boolean(s.tieneSalaReuniones) || Boolean(s.salaCompartidaId))

    // Helper para enriquecer cada sucursal con datos del cluster de salas compartidas
    const enriquecerSucursal = (s: any): SucursalSalaItem => {
        const rootId = s.salaCompartidaId || s.id
        const cluster = todasSucursales.filter(other => other.id === rootId || other.salaCompartidaId === rootId)
        const compartidaCon = cluster.filter(other => other.id !== s.id).map(other => other.nombre)
        const rootBranch = todasSucursales.find(other => other.id === rootId)

        return {
            id: s.id,
            nombre: s.nombre,
            region: s.region,
            comuna: s.comuna,
            isCompartida: compartidaCon.length > 0,
            salaPrincipalNombre: rootBranch?.nombre || s.nombre,
            compartidaCon
        }
    }

    // 3. Regla de negocio:
    // "si el usuario que se conecto la lista solo debe mostrar la sucursal que tiene asociado a su perfil"
    const userRoleName = (dbUser?.role?.name || session?.user?.role?.name || '').toLowerCase()
    const isAdmin = userRoleName.includes('admin') || userRoleName.includes('administrador')
    const userSucursales: any[] = dbUser?.sucursales || []
    const userSucursalIds = userSucursales.map((s: any) => s.id)

    let sucursalesDisponibles: SucursalSalaItem[] = []

    if (userSucursalIds.length > 0) {
        // El usuario tiene sucursales asignadas en su perfil:
        // Solo debe mostrar las sucursales asignadas a su perfil que cuenten con sala de reuniones habilitada o compartida
        sucursalesDisponibles = sucursalesConSala
            .filter(s => userSucursalIds.includes(s.id))
            .map(enriquecerSucursal)
    } else if (isAdmin) {
        // Administrador sin asignación restringida de perfil: visualiza todas las sucursales con sala habilitada
        sucursalesDisponibles = sucursalesConSala.map(enriquecerSucursal)
    } else {
        // Usuario sin sucursales asociadas en su perfil
        sucursalesDisponibles = []
    }

    // 4. Determinar la sucursal activa seleccionada
    let sucursalActiva: SucursalSalaItem | null = null
    if (sucursalIdParam && sucursalesDisponibles.some(s => s.id === sucursalIdParam)) {
        sucursalActiva = sucursalesDisponibles.find(s => s.id === sucursalIdParam) || null
    } else if (sucursalesDisponibles.length > 0) {
        sucursalActiva = sucursalesDisponibles[0]
    }

    // 5. Cargar reservas correspondientes a la sucursal activa
    const rawReservas = sucursalActiva ? await fetchReservasDB(sucursalActiva.id) : []
    const confirmadas = rawReservas.filter(r => r.estado === 'CONFIRMADA')

    // 7 Días de la semana recibida
    const partes = inicioSemanaISO.split('-').map(Number)
    const fechaLunes = new Date(Date.UTC(partes[0], partes[1] - 1, partes[2]))
    const diasSemana: string[] = []
    for (let i = 0; i < 7; i++) {
        const d = new Date(fechaLunes)
        d.setUTCDate(d.getUTCDate() + i)
        const y = d.getUTCFullYear()
        const m = String(d.getUTCMonth() + 1).padStart(2, '0')
        const day = String(d.getUTCDate()).padStart(2, '0')
        diasSemana.push(`${y}-${m}-${day}`)
    }

    // Reservas de la semana
    const reservasSemana = confirmadas.filter(r => diasSemana.includes(r.fecha))

    // Fecha y hora actual en zona horaria de Chile (America/Santiago)
    const { fechaActual: hoyISO, horaActual } = getNowSantiago()

    // KPI 1: Estado ahora en la sucursal activa
    const reservaActual = confirmadas.find(r => r.fecha === hoyISO && r.horaInicio <= horaActual && horaActual < r.horaFin)
    const estadoAhora: 'libre' | 'ocupada' = reservaActual ? 'ocupada' : 'libre'

    // KPI 2: Reservas hoy en la sucursal activa
    const reservasHoy = confirmadas.filter(r => r.fecha === hoyISO).length

    // KPI 3 & Columna Próximas: Próximas reservas a partir de ahora
    const proximas = confirmadas
        .filter(r => {
            if (r.fecha > hoyISO) return true
            if (r.fecha === hoyISO && r.horaFin > horaActual) return true
            return false
        })
        .sort((a, b) => {
            if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha)
            return a.horaInicio.localeCompare(b.horaInicio)
        })

    // KPI 4: Ocupación semanal
    // Horas disponibles por semana laboral: 5 días x 9 horas = 45 horas = 2700 minutos
    let minutosOcupadosSemana = 0
    reservasSemana.forEach(r => {
        const [h1, m1] = r.horaInicio.split(':').map(Number)
        const [h2, m2] = r.horaFin.split(':').map(Number)
        const dur = (h2 * 60 + m2) - (h1 * 60 + m1)
        if (dur > 0) minutosOcupadosSemana += dur
    })
    const baseMinutosSemana = 45 * 60
    const ocupacionPorcentaje = Math.min(100, Math.max(0, Math.round((minutosOcupadosSemana / baseMinutosSemana) * 100)))

    const noticias = await getNoticias()

    return {
        diasSemana,
        reservasSemana,
        todasReservas: confirmadas,
        resumen: {
            estado: estadoAhora,
            actual: reservaActual ? {
                solicitante: reservaActual.solicitante,
                horaFin: reservaActual.horaFin,
                motivo: reservaActual.motivo
            } : null,
            reservasHoy,
            proximas: proximas.slice(0, 8),
            ocupacionSemana: ocupacionPorcentaje
        },
        noticias,
        currentUser: dbUser ? {
            id: dbUser.id,
            name: dbUser.name || dbUser.username,
            email: dbUser.email || '',
            role: dbUser.role?.name || ''
        } : (session?.user ? {
            id: session.user.id,
            name: session.user.name || session.user.username,
            email: session.user.email || '',
            role: session.user.role?.name || ''
        } : null),
        sucursalesDisponibles,
        sucursalActiva
    }
}

// Crear nueva reserva en la sucursal indicada
export async function createReserva(formData: {
    solicitante: string
    email: string
    fecha: string
    hora_inicio: string
    hora_fin: string
    motivo: string
    sucursalId: string
    clientOrigin?: string
}) {
    try {
        await ensureTablesExist()
        const session = await getSession()
        if (!session?.user) {
            return { status: 'error', mensaje: 'Debes iniciar sesión para realizar una reserva.' }
        }

        let { solicitante, email, fecha, hora_inicio, hora_fin, motivo, sucursalId, clientOrigin } = formData

        if (session?.user?.username === 'admin' && (!email || email === 'admin@hendaya.cl')) {
            email = 'doctohdya@hendayasac.cl'
        }

        if (!solicitante || !email || !fecha || !hora_inicio || !hora_fin || !motivo || !sucursalId) {
            return { status: 'error', mensaje: 'Todos los campos son obligatorios, incluyendo la selección de la sucursal.' }
        }

        // Obtener datos de la sucursal y validar que tenga sala de reuniones activa o compartida
        const sucursales = await rawPrisma.$queryRaw<any[]>`
            SELECT id, nombre, "tieneSalaReuniones", "salaCompartidaId"
            FROM "Sucursal"
            WHERE id = ${sucursalId}
            LIMIT 1
        `
        const sucursal = sucursales[0]
        if (!sucursal) {
            return { status: 'error', mensaje: 'La sucursal seleccionada no existe en el sistema.' }
        }
        if (!sucursal.tieneSalaReuniones && !sucursal.salaCompartidaId) {
            return { status: 'error', mensaje: `La sucursal "${sucursal.nombre}" no cuenta con sala de reuniones habilitada.` }
        }

        const sucursalNombre = sucursal.nombre

        // Validación estricta: No permitir reservar en horas o fechas pasadas
        const { fechaActual, horaActual } = getNowSantiago()
        if (fecha < fechaActual) {
            return {
                status: 'error',
                mensaje: 'No se puede realizar una reserva en una fecha pasada. Siempre se debe reservar para la fecha actual o futura.'
            }
        }

        if (fecha === fechaActual && hora_inicio < horaActual) {
            return {
                status: 'error',
                mensaje: `No se puede reservar en una hora anterior a la hora actual (${horaActual}). Debes reservar a partir de la hora actual hacia el futuro.`
            }
        }

        if (hora_fin <= hora_inicio) {
            return { status: 'error', mensaje: 'La hora de término debe ser posterior a la hora de inicio.' }
        }

        // Validar no solapamiento con reservas confirmadas de la misma sucursal (o cluster de sala compartida)
        const existentes = await fetchReservasDB(sucursalId)
        const conflicto = existentes.find(r => 
            r.estado === 'CONFIRMADA' &&
            r.fecha === fecha &&
            (
                // Se solapan si: max(start1, start2) < min(end1, end2)
                (hora_inicio < r.horaFin && hora_fin > r.horaInicio)
            )
        )

        if (conflicto) {
            const origenTexto = conflicto.sucursalNombre && conflicto.sucursalNombre !== sucursalNombre
                ? ` (reservada en ${conflicto.sucursalNombre})`
                : ''
            return {
                status: 'error',
                mensaje: `Horario no disponible en ${sucursalNombre}: ya está reservado de ${conflicto.horaInicio} a ${conflicto.horaFin} por ${conflicto.solicitante}${origenTexto}.`
            }
        }

        const id = crypto.randomUUID()
        const token = crypto.randomUUID()
        const userId = session.user.id || null

        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "reservas_sala" (id, solicitante, email, "userId", fecha, "horaInicio", "horaFin", motivo, estado, "tokenCancelacion", "sucursalId", "sucursalNombre", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        `, id, solicitante, email, userId, fecha, hora_inicio, hora_fin, motivo, 'CONFIRMADA', token, sucursalId, sucursalNombre)

        // Registrar en Auditoría
        await logAudit(
            'CREAR_RESERVA_SALA',
            `Reserva confirmada en ${sucursalNombre} para ${solicitante} (${email}) el ${fecha} de ${hora_inicio} a ${hora_fin}. Motivo: ${motivo}`
        )

        // Enviar Correo de Confirmación de forma nativa
        const mailRes = await sendReservaConfirmationEmail({
            to: email,
            solicitante,
            fecha,
            horaInicio: hora_inicio,
            horaFin: hora_fin,
            motivo,
            token,
            sucursalNombre,
            clientOrigin
        })

        revalidatePath('/dashboard/colaboradores/sala-reuniones')

        if (!mailRes.success && mailRes.warning) {
            return {
                status: 'ok',
                mensaje: `¡Reserva creada exitosamente en ${sucursalNombre}! (Aviso de correo: ${mailRes.warning})`
            }
        }

        return {
            status: 'ok',
            mensaje: `¡Reserva realizada con éxito en ${sucursalNombre}! Se ha enviado la confirmación a tu correo.`
        }
    } catch (e: any) {
        console.error('[SalaReuniones] Error en createReserva:', e)
        return { 
            status: 'error', 
            mensaje: `Error al procesar la reserva: ${e?.message || 'Error en base de datos. Intenta nuevamente.'}` 
        }
    }
}

// Cancelar reserva (con idempotencia y protección anti-clics duplicados)
export async function cancelReserva(reservaId: string, token?: string) {
    try {
        await ensureTablesExist()
        const session = await getSession()
        const isAdmin = session?.user?.role?.name === 'admin' || session?.user?.role?.name === 'Administrador'
        const rawReservas = await fetchReservasDB()
        const reserva = rawReservas.find(r => r.id === reservaId || (token && r.tokenCancelacion === token))

        if (!reserva) {
            return { status: 'error', mensaje: 'La reserva no fue encontrada.' }
        }

        // Si ya está cancelada, responder éxito sin reenviar correos
        if (reserva.estado === 'CANCELADA') {
            return { status: 'ok', mensaje: 'Esta reserva ya se encontraba cancelada.' }
        }

        // Permiso: Admin, dueño de la reserva o poseedor del token de correo
        const isOwner = session?.user && (reserva.userId === session.user.id || reserva.email === session.user.email)
        const hasToken = token && reserva.tokenCancelacion === token

        if (!isAdmin && !isOwner && !hasToken) {
            return { status: 'error', mensaje: 'No tienes autorización para cancelar esta reserva.' }
        }

        await rawPrisma.$executeRawUnsafe(`
            UPDATE "reservas_sala"
            SET estado = 'CANCELADA', "updatedAt" = NOW()
            WHERE id = $1
        `, reserva.id)

        await logAudit(
            'CANCELAR_RESERVA_SALA',
            `Reserva cancelada de ${reserva.solicitante} en ${reserva.sucursalNombre || 'Sala'} para el ${reserva.fecha} (${reserva.horaInicio} - ${reserva.horaFin})`
        )

        sendReservaCancellationEmail({
            to: reserva.email,
            solicitante: reserva.solicitante,
            fecha: reserva.fecha,
            horaInicio: reserva.horaInicio,
            horaFin: reserva.horaFin,
            motivo: reserva.motivo,
            sucursalNombre: reserva.sucursalNombre
        }).catch(err => console.error('Error enviando mail cancelación:', err))

        revalidatePath('/dashboard/colaboradores/sala-reuniones')

        return { status: 'ok', mensaje: 'La reserva ha sido cancelada exitosamente.' }
    } catch (e: any) {
        console.error('[SalaReuniones] Error en cancelReserva:', e)
        return { status: 'error', mensaje: `Error al cancelar la reserva: ${e?.message || 'Error en el servidor.'}` }
    }
}

// Modificar reserva (con idempotencia y protección anti-clics duplicados)
export async function updateReserva(
    reservaId: string,
    data: {
        fecha: string
        hora_inicio: string
        hora_fin: string
        motivo: string
    },
    token?: string,
    clientOrigin?: string
) {
    try {
        await ensureTablesExist()
        const session = await getSession()
        const isAdmin = session?.user?.role?.name === 'admin' || session?.user?.role?.name === 'Administrador'
        const rawReservas = await fetchReservasDB()
        const reserva = rawReservas.find(r => r.id === reservaId || (token && r.tokenCancelacion === token))

        if (!reserva) {
            return { status: 'error', mensaje: 'La reserva no fue encontrada.' }
        }

        if (reserva.estado === 'CANCELADA') {
            return { status: 'error', mensaje: 'No se puede modificar una reserva que ya ha sido cancelada.' }
        }

        const isOwner = session?.user && (reserva.userId === session.user.id || reserva.email === session.user.email)
        const hasToken = token && reserva.tokenCancelacion === token

        if (!isAdmin && !isOwner && !hasToken) {
            return { status: 'error', mensaje: 'No tienes autorización para modificar esta reserva.' }
        }

        if (data.hora_fin <= data.hora_inicio) {
            return { status: 'error', mensaje: 'La hora de término debe ser posterior a la hora de inicio.' }
        }

        // Si los datos son exactamente iguales, no realizar otro update ni enviar correo repetido
        const sinCambios = reserva.fecha === data.fecha &&
            reserva.horaInicio === data.hora_inicio &&
            reserva.horaFin === data.hora_fin &&
            reserva.motivo === data.motivo

        if (sinCambios) {
            return { status: 'ok', mensaje: 'No se detectaron cambios en los datos de la reserva.' }
        }

        // Validación estricta: No permitir modificar hacia el pasado
        const { fechaActual, horaActual } = getNowSantiago()
        if (data.fecha < fechaActual) {
            return {
                status: 'error',
                mensaje: 'No se puede modificar la reserva a una fecha pasada. Debe ser fecha actual o futura.'
            }
        }

        if (data.fecha === fechaActual && data.hora_inicio < horaActual) {
            return {
                status: 'error',
                mensaje: `No se puede modificar a una hora anterior a la hora actual (${horaActual}). Debe ser a futuro.`
            }
        }

        // Validar que no colisione con otra reserva de LA MISMA SUCURSAL (o cluster compartido)
        const existentesSucursal = await fetchReservasDB(reserva.sucursalId || undefined)
        const conflicto = existentesSucursal.find(r => 
            r.id !== reserva.id &&
            r.estado === 'CONFIRMADA' &&
            r.fecha === data.fecha &&
            (data.hora_inicio < r.horaFin && data.hora_fin > r.horaInicio)
        )

        if (conflicto) {
            const origenTexto = conflicto.sucursalNombre && conflicto.sucursalNombre !== (reserva.sucursalNombre || '')
                ? ` (registrada en ${conflicto.sucursalNombre})`
                : ''
            return {
                status: 'error',
                mensaje: `El horario solicitado choca con otra reserva en ${reserva.sucursalNombre || 'la sucursal'}${origenTexto} (${conflicto.horaInicio} - ${conflicto.horaFin} por ${conflicto.solicitante}).`
            }
        }

        await rawPrisma.$executeRawUnsafe(`
            UPDATE "reservas_sala"
            SET fecha = $1, "horaInicio" = $2, "horaFin" = $3, motivo = $4, "updatedAt" = NOW()
            WHERE id = $5
        `, data.fecha, data.hora_inicio, data.hora_fin, data.motivo, reserva.id)

        await logAudit(
            'MODIFICAR_RESERVA_SALA',
            `Reserva modificada de ${reserva.solicitante} en ${reserva.sucursalNombre || 'Sala'} al ${data.fecha} (${data.hora_inicio} - ${data.hora_fin}). Motivo: ${data.motivo}`
        )

        // Enviar correo de actualización
        const mailRes = await sendReservaConfirmationEmail({
            to: reserva.email,
            solicitante: reserva.solicitante,
            fecha: data.fecha,
            horaInicio: data.hora_inicio,
            horaFin: data.hora_fin,
            motivo: data.motivo,
            token: reserva.tokenCancelacion,
            sucursalNombre: reserva.sucursalNombre,
            clientOrigin
        })

        revalidatePath('/dashboard/colaboradores/sala-reuniones')

        if (!mailRes.success && mailRes.warning) {
            return {
                status: 'ok',
                mensaje: `Reserva actualizada con éxito en el sistema. (Aviso de correo: ${mailRes.warning})`
            }
        }

        return { status: 'ok', mensaje: 'Reserva actualizada exitosamente. Se envió un correo con los nuevos datos.' }
    } catch (e: any) {
        console.error('[SalaReuniones] Error en updateReserva:', e)
        return { status: 'error', mensaje: `Error al modificar la reserva: ${e?.message || 'Error en el servidor.'}` }
    }
}

// Obtener una reserva por su token de correo (para enlaces de modificación o cancelación)
export async function getReservaByToken(token: string): Promise<ReservaSalaItem | null> {
    try {
        const rawReservas = await fetchReservasDB()
        return rawReservas.find(r => r.tokenCancelacion === token) || null
    } catch (e) {
        console.error('[SalaReuniones] Error en getReservaByToken:', e)
        return null
    }
}

