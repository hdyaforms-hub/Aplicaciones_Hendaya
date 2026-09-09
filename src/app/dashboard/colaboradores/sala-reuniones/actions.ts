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
    createdAt: Date
    updatedAt: Date
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

// Obtener la URL base de la aplicación de forma dinámica (soporta dev en puerto 3001 y dominio productivo https)
async function getBaseAppUrl(): Promise<string> {
    try {
        const headerList = await headers()
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
    token
}: {
    to: string
    solicitante: string
    fecha: string
    horaInicio: string
    horaFin: string
    motivo: string
    token: string
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

        const appUrl = await getBaseAppUrl()
        const linkModificar = `${appUrl}/dashboard/colaboradores/sala-reuniones?action=modificar&token=${token}`
        const linkCancelar = `${appUrl}/dashboard/colaboradores/sala-reuniones?action=cancelar&token=${token}`

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827; line-height: 1.5; padding: 24px; background-color: #ffffff;">
                <p style="font-size: 16px; margin-bottom: 16px;">Hola <b>${solicitante}</b>,</p>
                <p style="font-size: 15px; margin-bottom: 16px;">Tu reserva de la Sala de Reuniones fue confirmada:</p>
                <ul style="font-size: 15px; line-height: 1.8; margin-bottom: 24px;">
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
            subject: `Confirmación de Reserva: Sala de Reuniones (${fecha} ${horaInicio} - ${horaFin})`,
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
    motivo
}: {
    to: string
    solicitante: string
    fecha: string
    horaInicio: string
    horaFin: string
    motivo: string
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
            subject: `Cancelación de Reserva: Sala de Reuniones (${fecha} ${horaInicio} - ${horaFin})`,
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
                        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                `)
                await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "reservas_sala_fecha_idx" ON "reservas_sala"(fecha);`)
                await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "reservas_sala_estado_idx" ON "reservas_sala"(estado);`)
                await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "reservas_sala_token_idx" ON "reservas_sala"("tokenCancelacion");`)
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
            } catch (err) {
                console.error('[SalaReuniones] Error verificando/creando tablas:', err)
                tablesInitPromise = null
                throw err
            }
        })()
    }
    return tablesInitPromise
}

// Obtener todas las reservas de la base de datos
async function fetchReservasDB(): Promise<ReservaSalaItem[]> {
    try {
        await ensureTablesExist()
        const res = await rawPrisma.$queryRaw<any[]>`
            SELECT id, solicitante, email, "userId", fecha, "horaInicio", "horaFin", motivo, estado, "tokenCancelacion", "createdAt", "updatedAt"
            FROM "reservas_sala"
            ORDER BY fecha ASC, "horaInicio" ASC
        `
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

// Obtener datos completos de la semana y cálculo de KPIs
export async function getSalaData(inicioSemanaISO: string): Promise<SalaDataResponse> {
    const session = await getSession()
    const rawReservas = await fetchReservasDB()
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

    // Fecha y hora actual
    const ahora = new Date()
    const hoyISO = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`
    const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`

    // KPI 1: Estado ahora
    const reservaActual = confirmadas.find(r => r.fecha === hoyISO && r.horaInicio <= horaActual && horaActual < r.horaFin)
    const estadoAhora: 'libre' | 'ocupada' = reservaActual ? 'ocupada' : 'libre'

    // KPI 2: Reservas hoy
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

    // Obtener información fresca del usuario conectado directo de la base de datos
    let dbUser: { id: string, name: string | null, username: string, email: string | null, role: { name: string } | null } | null = null
    if (session?.user?.id) {
        dbUser = await rawPrisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, name: true, username: true, email: true, role: { select: { name: true } } }
        })
    } else if (session?.user?.username) {
        dbUser = await rawPrisma.user.findFirst({
            where: { username: session.user.username },
            select: { id: true, name: true, username: true, email: true, role: { select: { name: true } } }
        })
    }

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
        } : null)
    }
}

// Crear nueva reserva
export async function createReserva(formData: {
    solicitante: string
    email: string
    fecha: string
    hora_inicio: string
    hora_fin: string
    motivo: string
}) {
    try {
        await ensureTablesExist()
        const session = await getSession()
        if (!session?.user) {
            return { status: 'error', mensaje: 'Debes iniciar sesión para realizar una reserva.' }
        }

        const { solicitante, email, fecha, hora_inicio, hora_fin, motivo } = formData

        if (!solicitante || !email || !fecha || !hora_inicio || !hora_fin || !motivo) {
            return { status: 'error', mensaje: 'Todos los campos son obligatorios.' }
        }

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

        // Validar no solapamiento con reservas confirmadas
        const existentes = await fetchReservasDB()
        const conflicto = existentes.find(r => 
            r.estado === 'CONFIRMADA' &&
            r.fecha === fecha &&
            (
                // Se solapan si: max(start1, start2) < min(end1, end2)
                (hora_inicio < r.horaFin && hora_fin > r.horaInicio)
            )
        )

        if (conflicto) {
            return {
                status: 'error',
                mensaje: `Horario no disponible: ya está reservado de ${conflicto.horaInicio} a ${conflicto.horaFin} por ${conflicto.solicitante}.`
            }
        }

        const id = crypto.randomUUID()
        const token = crypto.randomUUID()
        const userId = session.user.id || null

        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "reservas_sala" (id, solicitante, email, "userId", fecha, "horaInicio", "horaFin", motivo, estado, "tokenCancelacion", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        `, id, solicitante, email, userId, fecha, hora_inicio, hora_fin, motivo, 'CONFIRMADA', token)

        // Registrar en Auditoría
        await logAudit(
            'CREAR_RESERVA_SALA',
            `Reserva confirmada para ${solicitante} (${email}) el ${fecha} de ${hora_inicio} a ${hora_fin}. Motivo: ${motivo}`
        )

        // Enviar Correo de Confirmación de forma nativa
        const mailRes = await sendReservaConfirmationEmail({
            to: email,
            solicitante,
            fecha,
            horaInicio: hora_inicio,
            horaFin: hora_fin,
            motivo,
            token
        })

        revalidatePath('/dashboard/colaboradores/sala-reuniones')

        if (!mailRes.success && mailRes.warning) {
            return {
                status: 'ok',
                mensaje: `¡Reserva creada exitosamente en el sistema! (Aviso de correo: ${mailRes.warning})`
            }
        }

        return {
            status: 'ok',
            mensaje: '¡Reserva realizada con éxito! Se ha enviado la confirmación a tu correo.'
        }
    } catch (e: any) {
        console.error('[SalaReuniones] Error en createReserva:', e)
        return { 
            status: 'error', 
            mensaje: `Error al procesar la reserva: ${e?.message || 'Error en base de datos. Intenta nuevamente.'}` 
        }
    }
}

// Cancelar reserva
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
            `Reserva cancelada de ${reserva.solicitante} para el ${reserva.fecha} (${reserva.horaInicio} - ${reserva.horaFin})`
        )

        sendReservaCancellationEmail({
            to: reserva.email,
            solicitante: reserva.solicitante,
            fecha: reserva.fecha,
            horaInicio: reserva.horaInicio,
            horaFin: reserva.horaFin,
            motivo: reserva.motivo
        }).catch(err => console.error('Error enviando mail cancelación:', err))

        revalidatePath('/dashboard/colaboradores/sala-reuniones')

        return { status: 'ok', mensaje: 'La reserva ha sido cancelada exitosamente.' }
    } catch (e: any) {
        console.error('[SalaReuniones] Error en cancelReserva:', e)
        return { status: 'error', mensaje: `Error al cancelar la reserva: ${e?.message || 'Error en el servidor.'}` }
    }
}

// Modificar reserva
export async function updateReserva(
    reservaId: string,
    data: {
        fecha: string
        hora_inicio: string
        hora_fin: string
        motivo: string
    },
    token?: string
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

        const isOwner = session?.user && (reserva.userId === session.user.id || reserva.email === session.user.email)
        const hasToken = token && reserva.tokenCancelacion === token

        if (!isAdmin && !isOwner && !hasToken) {
            return { status: 'error', mensaje: 'No tienes autorización para modificar esta reserva.' }
        }

        if (data.hora_fin <= data.hora_inicio) {
            return { status: 'error', mensaje: 'La hora de término debe ser posterior a la hora de inicio.' }
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

        // Validar que no colisione con otra reserva
        const conflicto = rawReservas.find(r => 
            r.id !== reserva.id &&
            r.estado === 'CONFIRMADA' &&
            r.fecha === data.fecha &&
            (data.hora_inicio < r.horaFin && data.hora_fin > r.horaInicio)
        )

        if (conflicto) {
            return {
                status: 'error',
                mensaje: `El horario solicitado choca con otra reserva (${conflicto.horaInicio} - ${conflicto.horaFin} por ${conflicto.solicitante}).`
            }
        }

        await rawPrisma.$executeRawUnsafe(`
            UPDATE "reservas_sala"
            SET fecha = $1, "horaInicio" = $2, "horaFin" = $3, motivo = $4, "updatedAt" = NOW()
            WHERE id = $5
        `, data.fecha, data.hora_inicio, data.hora_fin, data.motivo, reserva.id)

        await logAudit(
            'MODIFICAR_RESERVA_SALA',
            `Reserva modificada de ${reserva.solicitante} al ${data.fecha} (${data.hora_inicio} - ${data.hora_fin}). Motivo: ${data.motivo}`
        )

        // Enviar correo de actualización
        const mailRes = await sendReservaConfirmationEmail({
            to: reserva.email,
            solicitante: reserva.solicitante,
            fecha: data.fecha,
            horaInicio: data.hora_inicio,
            horaFin: data.hora_fin,
            motivo: data.motivo,
            token: reserva.tokenCancelacion
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
