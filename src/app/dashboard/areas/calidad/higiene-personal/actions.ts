'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { encryptNombre, decryptNombre } from '@/lib/personal-crypto'
import { logAuditAction } from '@/lib/audit'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

// Helper para descifrar clave de correo SMTP
const ENCRYPTION_KEY = crypto.createHash('sha256').update(String(process.env.SESSION_SECRET || 'super-secret-key-change-me')).digest('base64').substring(0, 32)
function decryptSmtpPassword(text: string) {
    try {
        const textParts = text.split(':')
        const iv = Buffer.from(textParts.shift()!, 'hex')
        const encryptedText = Buffer.from(textParts.join(':'), 'hex')
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv)
        let decrypted = decipher.update(encryptedText)
        decrypted = Buffer.concat([decrypted, decipher.final()])
        return decrypted.toString()
    } catch (e) {
        return text
    }
}

// Obtener fecha actual en formato local YYYY-MM-DD
function getTodayDateString(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

// Calcular días de retraso entre fecha de planilla y hoy
function calculateDiasAtraso(fechaPlanillaTexto: string): number {
    try {
        const todayStr = getTodayDateString()
        if (fechaPlanillaTexto >= todayStr) return 0

        const [y1, m1, d1] = fechaPlanillaTexto.split('-').map(Number)
        const [y2, m2, d2] = todayStr.split('-').map(Number)

        const date1 = new Date(y1, m1 - 1, d1)
        const date2 = new Date(y2, m2 - 1, d2)

        const diffTime = date2.getTime() - date1.getTime()
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        return Math.max(0, diffDays)
    } catch (e) {
        return 0
    }
}

/**
 * Obtener sucursales accesibles por el usuario logueado.
 * Si el usuario tiene sucursales asignadas en su perfil, sólo se muestran esas.
 */
export async function getSucursalesHigienePersonal() {
    const session = await getSession()
    if (!session?.user) return { sucursales: [], isRestricted: false, defaultSucursalId: '' }

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    const todas = await prisma.sucursal.findMany({
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true }
    })

    if (isAdmin) {
        return {
            sucursales: todas,
            isRestricted: false,
            defaultSucursalId: todas[0]?.id || ''
        }
    }

    // Si tiene sucursales asignadas en la relación SucursalToUser
    const userWithSucursales = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { sucursales: { select: { id: true, nombre: true } } }
    })

    const asignadas = userWithSucursales?.sucursales || []
    if (asignadas.length > 0) {
        const permitidas = todas.filter(s => asignadas.some(a => a.id === s.id))
        return {
            sucursales: permitidas,
            isRestricted: true,
            defaultSucursalId: permitidas[0]?.id || ''
        }
    }

    // Si tiene sucursales en formato de nombres en la sesión
    const sessionSucursales = session.user.sucursales || []
    if (sessionSucursales.length > 0) {
        const permitidas = todas.filter(s => sessionSucursales.includes(s.nombre))
        return {
            sucursales: permitidas.length > 0 ? permitidas : todas,
            isRestricted: permitidas.length > 0,
            defaultSucursalId: permitidas[0]?.id || todas[0]?.id || ''
        }
    }

    return {
        sucursales: todas,
        isRestricted: false,
        defaultSucursalId: todas[0]?.id || ''
    }
}

/**
 * Obtener la planilla y registros para una sucursal y fecha dada.
 */
async function ensureHigienePersonalTables() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Cal_PlanillaHigienePersonal" (
                "id" TEXT PRIMARY KEY,
                "sucursalId" TEXT NOT NULL,
                "fecha" TIMESTAMP(3) NOT NULL,
                "fechaTexto" VARCHAR(10) NOT NULL,
                "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
                "firmaCalidadUser" VARCHAR(150),
                "firmaCalidadUserId" TEXT,
                "firmaCalidadFecha" TIMESTAMP(3),
                "firmaCalidadDiasAtraso" INTEGER NOT NULL DEFAULT 0,
                "firmaCalidadImg" TEXT,
                "firmaBodegaUser" VARCHAR(150),
                "firmaBodegaUserId" TEXT,
                "firmaBodegaFecha" TIMESTAMP(3),
                "firmaBodegaImg" TEXT,
                "observacionesGenerales" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "Cal_PlanillaHigienePersonal_sucursalId_fechaTexto_key" UNIQUE ("sucursalId", "fechaTexto")
            );
        `)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_PlanillaHigienePersonal_sucursalId_idx" ON "Cal_PlanillaHigienePersonal"("sucursalId");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_PlanillaHigienePersonal_fechaTexto_idx" ON "Cal_PlanillaHigienePersonal"("fechaTexto");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_PlanillaHigienePersonal_estado_idx" ON "Cal_PlanillaHigienePersonal"("estado");`)

        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Cal_RegistroHigienePersonal" (
                "id" TEXT PRIMARY KEY,
                "planillaId" TEXT NOT NULL,
                "nombreEncriptado" TEXT NOT NULL,
                "uniformeLimpio" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
                "zapatosSeguridad" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
                "peloCorto" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
                "usoJockey" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
                "sinJoyas" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
                "unasCortas" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
                "rasurado" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
                "estadoSalud" VARCHAR(50) NOT NULL DEFAULT 'No Aplica',
                "habitosCorrectos" VARCHAR(50) NOT NULL DEFAULT 'No Aplica',
                "heridas" VARCHAR(30) NOT NULL DEFAULT 'Ausencia',
                "observacion" TEXT,
                "accionCorrectiva" TEXT,
                "creadoPor" VARCHAR(150) NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_RegistroHigienePersonal_planillaId_idx" ON "Cal_RegistroHigienePersonal"("planillaId");`)
    } catch (err) {
        console.error('Error auto-creating Cal_PlanillaHigienePersonal tables:', err)
    }
}

export async function getPlanillaDiaHigienePersonal(sucursalId: string, fechaTexto: string, isRetry: boolean = false): Promise<any> {
    const session = await getSession()
    if (!session?.user) return { error: 'No autorizado' }

    try {
        const planilla = await prisma.cal_PlanillaHigienePersonal.findUnique({
            where: {
                sucursalId_fechaTexto: { sucursalId, fechaTexto }
            },
            include: {
                sucursal: true,
                registros: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        })

        const diasAtraso = calculateDiasAtraso(fechaTexto)

        if (!planilla) {
            return {
                planilla: null,
                registros: [],
                diasAtraso
            }
        }

        // Descifrar nombres para visualización segura
        const registrosDescifrados = planilla.registros.map(r => ({
            id: r.id,
            nombre: decryptNombre(r.nombreEncriptado),
            uniformeLimpio: r.uniformeLimpio,
            zapatosSeguridad: r.zapatosSeguridad,
            peloCorto: r.peloCorto,
            usoJockey: r.usoJockey,
            sinJoyas: r.sinJoyas,
            unasCortas: r.unasCortas,
            rasurado: r.rasurado,
            estadoSalud: r.estadoSalud,
            habitosCorrectos: r.habitosCorrectos,
            heridas: r.heridas,
            observacion: r.observacion || '',
            accionCorrectiva: r.accionCorrectiva || '',
            creadoPor: r.creadoPor,
            createdAt: r.createdAt
        }))

        return {
            planilla: {
                id: planilla.id,
                sucursalId: planilla.sucursalId,
                fechaTexto: planilla.fechaTexto,
                estado: planilla.estado,
                firmaCalidadUser: planilla.firmaCalidadUser,
                firmaCalidadFecha: planilla.firmaCalidadFecha,
                firmaCalidadDiasAtraso: planilla.firmaCalidadDiasAtraso,
                firmaCalidadImg: planilla.firmaCalidadImg,
                firmaBodegaUser: planilla.firmaBodegaUser,
                firmaBodegaFecha: planilla.firmaBodegaFecha,
                firmaBodegaImg: planilla.firmaBodegaImg,
                observacionesGenerales: planilla.observacionesGenerales
            },
            registros: registrosDescifrados,
            diasAtraso: planilla.estado === 'ABIERTO' ? diasAtraso : planilla.firmaCalidadDiasAtraso
        }
    } catch (e: any) {
        console.error('Error fetching planilla higiene personal:', e)
        const isTableMissing = e?.code === 'P2021' || (e?.message && (e.message.includes('does not exist') || e.message.includes('42P01') || e.message.includes('relation')))
        if (isTableMissing && !isRetry) {
            console.log('Detectada ausencia de tablas Cal_PlanillaHigienePersonal en PostgreSQL. Inicializando automáticamente...')
            await ensureHigienePersonalTables()
            return getPlanillaDiaHigienePersonal(sucursalId, fechaTexto, true)
        }
        return { error: 'Ocurrió un error al consultar los registros de higiene personal.' }
    }
}

/**
 * Crear o Actualizar un Registro de Higiene Personal
 */
export async function saveRegistroHigienePersonal(data: {
    id?: string
    sucursalId: string
    fechaTexto: string
    nombre: string
    uniformeLimpio: string
    zapatosSeguridad: string
    peloCorto: string
    usoJockey: string
    sinJoyas: string
    unasCortas: string
    rasurado: string
    estadoSalud: string
    habitosCorrectos: string
    heridas: string
    observacion?: string
    accionCorrectiva?: string
}) {
    const session = await getSession()
    if (!session?.user) return { error: 'No autorizado' }

    const perms = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'

    if (!isAdmin && !perms.includes('manage_calidad_higiene_personal')) {
        return { error: 'No tienes privilegios para registrar o editar evaluaciones de higiene personal.' }
    }

    if (!data.nombre || data.nombre.trim().length < 2) {
        return { error: 'Debe ingresar el nombre del transportista a evaluar.' }
    }

    const cleanNombre = data.nombre.trim()
    const nombreCifrado = encryptNombre(cleanNombre)
    const username = session.user.name || session.user.username || 'Usuario'

    try {
        // Buscar o crear la planilla correspondiente a sucursal y fecha
        let planilla = await prisma.cal_PlanillaHigienePersonal.findUnique({
            where: {
                sucursalId_fechaTexto: {
                    sucursalId: data.sucursalId,
                    fechaTexto: data.fechaTexto
                }
            }
        })

        if (!planilla) {
            const [y, m, d] = data.fechaTexto.split('-').map(Number)
            const fechaDate = new Date(y, m - 1, d, 12, 0, 0)

            planilla = await prisma.cal_PlanillaHigienePersonal.create({
                data: {
                    sucursalId: data.sucursalId,
                    fecha: fechaDate,
                    fechaTexto: data.fechaTexto,
                    estado: 'ABIERTO'
                }
            })
        } else if (planilla.estado !== 'ABIERTO' && !isAdmin) {
            return { error: 'La planilla diaria ya fue firmada y cerrada por Calidad. No se admiten nuevos registros.' }
        }

        if (data.id) {
            // Actualización
            await prisma.cal_RegistroHigienePersonal.update({
                where: { id: data.id },
                data: {
                    nombreEncriptado: nombreCifrado,
                    uniformeLimpio: data.uniformeLimpio || 'Cumple',
                    zapatosSeguridad: data.zapatosSeguridad || 'Cumple',
                    peloCorto: data.peloCorto || 'Cumple',
                    usoJockey: data.usoJockey || 'Cumple',
                    sinJoyas: data.sinJoyas || 'Cumple',
                    unasCortas: data.unasCortas || 'Cumple',
                    rasurado: data.rasurado || 'Cumple',
                    estadoSalud: data.estadoSalud || 'No Aplica',
                    habitosCorrectos: data.habitosCorrectos || 'No Aplica',
                    heridas: data.heridas || 'Ausencia',
                    observacion: data.observacion?.trim() || null,
                    accionCorrectiva: data.accionCorrectiva?.trim() || null
                }
            })

            await logAuditAction({
                username,
                userId: session.user.id,
                action: 'EDITAR_REGISTRO_HIGIENE_PERSONAL',
                modulo: 'Áreas -> Calidad',
                detalle: `Actualizó evaluación de higiene personal del trabajador ${cleanNombre} en planilla ${data.fechaTexto}`
            })
        } else {
            // Nuevo registro
            await prisma.cal_RegistroHigienePersonal.create({
                data: {
                    planillaId: planilla.id,
                    nombreEncriptado: nombreCifrado,
                    uniformeLimpio: data.uniformeLimpio || 'Cumple',
                    zapatosSeguridad: data.zapatosSeguridad || 'Cumple',
                    peloCorto: data.peloCorto || 'Cumple',
                    usoJockey: data.usoJockey || 'Cumple',
                    sinJoyas: data.sinJoyas || 'Cumple',
                    unasCortas: data.unasCortas || 'Cumple',
                    rasurado: data.rasurado || 'Cumple',
                    estadoSalud: data.estadoSalud || 'No Aplica',
                    habitosCorrectos: data.habitosCorrectos || 'No Aplica',
                    heridas: data.heridas || 'Ausencia',
                    observacion: data.observacion?.trim() || null,
                    accionCorrectiva: data.accionCorrectiva?.trim() || null,
                    creadoPor: username
                }
            })

            await logAuditAction({
                username,
                userId: session.user.id,
                action: 'CREAR_REGISTRO_HIGIENE_PERSONAL',
                modulo: 'Áreas -> Calidad',
                detalle: `Registró evaluación de higiene personal del trabajador ${cleanNombre} en planilla ${data.fechaTexto}`
            })
        }

        revalidatePath('/dashboard/areas/calidad/higiene-personal')
        return { success: true }
    } catch (e: any) {
        console.error('Error saving registro higiene personal:', e)
        return { error: 'Ocurrió un error al guardar la evaluación de higiene personal.' }
    }
}

/**
 * Eliminar un registro de evaluación de trabajador.
 * - Usuarios normales: solo si la planilla sigue ABIERTA.
 * - Administradores: pueden eliminar registros en cualquier momento.
 */
export async function deleteRegistroHigienePersonal(id: string) {
    const session = await getSession()
    if (!session?.user) return { error: 'No autorizado' }

    const perms = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'

    if (!isAdmin && !perms.includes('manage_calidad_higiene_personal')) {
        return { error: 'No tienes permiso para eliminar registros.' }
    }

    try {
        const registro = await prisma.cal_RegistroHigienePersonal.findUnique({
            where: { id },
            include: { planilla: { include: { sucursal: true } } }
        })

        if (!registro) return { error: 'Registro no encontrado.' }
        if (!isAdmin && registro.planilla.estado !== 'ABIERTO') {
            return { error: 'No se puede eliminar registros de una planilla ya firmada y cerrada.' }
        }

        const rawNombre = decryptNombre(registro.nombreEncriptado)
        await prisma.cal_RegistroHigienePersonal.delete({ where: { id } })

        const username = session.user.name || session.user.username || 'Usuario'
        await logAuditAction({
            username,
            userId: session.user.id,
            action: 'ELIMINAR_REGISTRO_HIGIENE_PERSONAL',
            modulo: 'Áreas -> Calidad',
            detalle: `Eliminó evaluación del trabajador ${rawNombre} de la planilla ${registro.planilla.fechaTexto} en sucursal ${registro.planilla.sucursal.nombre}${isAdmin && registro.planilla.estado !== 'ABIERTO' ? ' (por Administrador)' : ''}`
        })

        revalidatePath('/dashboard/areas/calidad/higiene-personal')
        return { success: true }
    } catch (e) {
        console.error('Error deleting registro higiene personal:', e)
        return { error: 'Ocurrió un error al eliminar el registro.' }
    }
}

/**
 * Eliminar planilla completa y todos sus registros (Solo perfil Administrador).
 * Permite purgar registros basura de pruebas o corregir errores en el sistema.
 */
export async function eliminarPlanillaHigienePersonal(sucursalId: string, fechaTexto: string) {
    const session = await getSession()
    if (!session?.user) return { error: 'No autorizado' }

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    if (!isAdmin) {
        return { error: 'Esta acción está restringida exclusivamente a usuarios con perfil de Administrador.' }
    }

    try {
        const planilla = await prisma.cal_PlanillaHigienePersonal.findUnique({
            where: {
                sucursalId_fechaTexto: { sucursalId, fechaTexto }
            },
            include: {
                sucursal: true,
                _count: { select: { registros: true } }
            }
        })

        if (!planilla) {
            return { error: 'No existe una planilla registrada para esta sucursal y fecha.' }
        }

        const totalPersonas = planilla._count.registros
        const sucursalNombre = planilla.sucursal.nombre

        // Eliminar planilla (y por cascada todos sus registros de higiene personal)
        await prisma.cal_PlanillaHigienePersonal.delete({
            where: { id: planilla.id }
        })

        const username = session.user.name || session.user.username || 'Administrador'
        await logAuditAction({
            username,
            userId: session.user.id,
            action: 'ELIMINAR_PLANILLA_HIGIENE_PERSONAL',
            modulo: 'Áreas -> Calidad',
            detalle: `Eliminó planilla completa y ${totalPersonas} evaluación(es) de higiene personal de la fecha ${fechaTexto} en sucursal ${sucursalNombre} (Purga de datos)`
        })

        revalidatePath('/dashboard/areas/calidad/higiene-personal')
        return { success: true, count: totalPersonas }
    } catch (e: any) {
        console.error('Error eliminando planilla completa higiene personal:', e)
        return { error: e.message || 'Ocurrió un error al eliminar la planilla.' }
    }
}

/**
 * Notificación por correo al Jefe de Bodega según Listas de Distribución configuradas
 */
export async function sendNotificationToBodegaHigiene(planillaId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const planilla = await prisma.cal_PlanillaHigienePersonal.findUnique({
            where: { id: planillaId },
            include: {
                sucursal: true,
                registros: true
            }
        })

        if (!planilla) return { success: false, error: 'Planilla no encontrada.' }

        const codigoPantalla = 'calidad-higiene-personal'

        // Buscar configuraciones activas para esta pantalla
        const configs = await prisma.notificacionPantalla.findMany({
            where: { codigoPantalla, activa: true },
            include: { listaCorreo: true }
        })

        if (configs.length === 0) {
            console.log(`[HigienePersonal] No hay listas de correo activas configuradas para "${codigoPantalla}".`)
            return { success: false, error: `No hay listas de correo activas configuradas para "${codigoPantalla}".` }
        }

        // Filtrar listas vinculadas a la sucursal de la planilla, o listas generales sin sucursal
        const configsSucursal = configs.filter(c => c.listaCorreo.sucursalId === planilla.sucursalId)
        const targetConfigs = configsSucursal.length > 0 ? configsSucursal : configs.filter(c => !c.listaCorreo.sucursalId)

        if (targetConfigs.length === 0) {
            console.log(`[HigienePersonal] No hay listas de correo específicas para la sucursal ${planilla.sucursal.nombre} ni listas generales.`)
            return { success: false, error: `No hay listas de correo específicas para la sucursal ${planilla.sucursal.nombre} ni listas generales.` }
        }

        // Configuración SMTP global
        const emailConfig = await prisma.emailConfig.findUnique({ where: { id: 'global' } })
        if (!emailConfig) {
            console.log('[HigienePersonal] Configuración SMTP global no configurada.')
            return { success: false, error: 'Configuración SMTP global no configurada en el sistema.' }
        }

        // Obtener plantilla personalizada si existe
        const plantillaCorreo = await prisma.plantillaCorreo.findUnique({
            where: { codigoPantalla }
        })

        // Preparar resumen de desviaciones
        const totalPersonas = planilla.registros.length
        const desviaciones = planilla.registros
            .filter(r => 
                r.uniformeLimpio === 'No Cumple' ||
                r.zapatosSeguridad === 'No Cumple' ||
                r.peloCorto === 'No Cumple' ||
                r.usoJockey === 'No Cumple' ||
                r.sinJoyas === 'No Cumple' ||
                r.unasCortas === 'No Cumple' ||
                r.rasurado === 'No Cumple' ||
                (r.estadoSalud && r.estadoSalud !== 'No Aplica') ||
                (r.habitosCorrectos && r.habitosCorrectos !== 'No Aplica') ||
                r.heridas === 'Presencia'
            )
            .map(r => {
                const nom = decryptNombre(r.nombreEncriptado)
                const fallas: string[] = []
                if (r.uniformeLimpio === 'No Cumple') fallas.push('Uniforme sucio/desordenado')
                if (r.zapatosSeguridad === 'No Cumple') fallas.push('Sin zapatos seguridad')
                if (r.peloCorto === 'No Cumple') fallas.push('Pelo no corto')
                if (r.usoJockey === 'No Cumple') fallas.push('Uso incorrecto jockey')
                if (r.sinJoyas === 'No Cumple') fallas.push('Porta joyas')
                if (r.unasCortas === 'No Cumple') fallas.push('Uñas no cortas')
                if (r.rasurado === 'No Cumple') fallas.push('No rasurado')
                if (r.estadoSalud && r.estadoSalud !== 'No Aplica') fallas.push(`Salud: ${r.estadoSalud}`)
                if (r.habitosCorrectos && r.habitosCorrectos !== 'No Aplica') fallas.push(`Hábito incorrecto: ${r.habitosCorrectos}`)
                if (r.heridas === 'Presencia') fallas.push('Heridas presentes')
                return `- <b>${nom}</b>: ${fallas.join(', ')}${r.observacion ? ` (Obs: ${r.observacion})` : ''}`
            })

        const desviacionesTexto = desviaciones.length > 0 
            ? desviaciones.join('<br/>') 
            : '<i>Todo el personal inspeccionado cumple con los estándares higiénico-sanitarios.</i>'

        const tags: Record<string, string> = {
            Fecha: planilla.fechaTexto.split('-').reverse().join('/'),
            Sucursal: planilla.sucursal.nombre,
            UsuarioCalidad: planilla.firmaCalidadUser || 'Encargado de Calidad',
            TotalPersonas: String(totalPersonas),
            Desviaciones: desviacionesTexto,
            DiasAtraso: String(planilla.firmaCalidadDiasAtraso || 0)
        }

        let subject = `Cierre Registro Higiene Personal Transportistas - ${planilla.sucursal.nombre} (${tags.Fecha})`
        let bodyHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 650px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background: #ffffff;">
                <h2 style="color: #0891b2; margin-top: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">HENDAYA</h2>
                <h3 style="color: #0f172a; margin-top: 8px;">Registro de Higiene Personal de Transportistas Cerrado</h3>
                <p>Estimado Jefe de Bodega,</p>
                <p>El Encargado de Calidad <b>${tags.UsuarioCalidad}</b> ha firmado y cerrado la planilla diaria de control de higiene personal de transportistas.</p>
                
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <tr><td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #e2e8f0; width: 40%;">Sucursal:</td><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${tags.Sucursal}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">Fecha Inspección:</td><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${tags.Fecha}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">Total Trabajadores:</td><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${tags.TotalPersonas}</td></tr>
                    ${planilla.firmaCalidadDiasAtraso > 0 ? `<tr><td style="padding: 10px; font-weight: bold; color: #b91c1c; border-bottom: 1px solid #e2e8f0;">Días de Atraso en Firma:</td><td style="padding: 10px; color: #b91c1c; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${planilla.firmaCalidadDiasAtraso} días</td></tr>` : ''}
                </table>

                <h4 style="color: #334155; margin-bottom: 6px;">Detalle / No Conformidades:</h4>
                <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; font-size: 13px;">
                    ${desviacionesTexto}
                </div>

                <p style="margin-top: 20px;">Por favor ingrese al sistema Hendaya en el módulo <b>Áreas \\ Calidad \\ Registro de Transportista interno Higiene Personal</b> para revisar la información y proceder con su <b>firma de validación</b>.</p>
                
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="font-size: 11px; color: #94a3b8; text-align: center;">Notificación automática del Sistema de Gestión de Calidad - Hendaya</p>
            </div>
        `

        if (plantillaCorreo) {
            subject = plantillaCorreo.asunto
            let customBody = plantillaCorreo.cuerpo
            Object.entries(tags).forEach(([key, value]) => {
                const regex = new RegExp(`<${key}>`, 'gi')
                subject = subject.replace(regex, value)
                customBody = customBody.replace(regex, value)
            })
            customBody = customBody.replace(/\n/g, '<br/>')

            if (!customBody.includes('<div') && !customBody.includes('<table')) {
                bodyHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background: #ffffff;">
                        <h2 style="color: #0891b2; margin-top: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">HENDAYA</h2>
                        <div style="font-size: 14px; line-height: 1.6; color: #334155; margin: 16px 0;">
                            ${customBody}
                        </div>
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                        <p style="font-size: 11px; color: #94a3b8; text-align: center;">Notificación automática del Sistema de Gestión de Calidad - Hendaya</p>
                    </div>
                `
            } else {
                bodyHtml = customBody
            }
        }

        const transporter = nodemailer.createTransport({
            host: "smtp.office365.com",
            port: 587,
            secure: false,
            auth: {
                user: emailConfig.email,
                pass: decryptSmtpPassword(emailConfig.password)
            },
            tls: { rejectUnauthorized: false }
        })

        const sentListNames: string[] = []
        const allRecipients: string[] = []

        for (const config of targetConfigs) {
            const para = JSON.parse(config.listaCorreo.para || '[]')
            const cc = config.listaCorreo.cc ? JSON.parse(config.listaCorreo.cc) : []

            if (para.length > 0) {
                await transporter.sendMail({
                    from: `"Calidad Hendaya" <${emailConfig.email}>`,
                    to: para.join(','),
                    cc: cc.length > 0 ? cc.join(',') : undefined,
                    subject,
                    html: bodyHtml
                })
                sentListNames.push(config.listaCorreo.nombre)
                allRecipients.push(...para)
                console.log(`[HigienePersonal] Correo enviado exitosamente a la lista: ${config.listaCorreo.nombre}`)
            }
        }

        if (sentListNames.length > 0) {
            await logAuditAction({
                username: 'SISTEMA',
                action: 'ENVIO_CORREO_HIGIENE_PERSONAL',
                modulo: 'Áreas -> Calidad',
                detalle: `Notificación enviada a lista(s) [${sentListNames.join(', ')}] (${allRecipients.join(', ')}) para planilla ${planilla.fechaTexto} - ${planilla.sucursal.nombre}`
            })
            return { success: true, message: `Correo enviado a: ${allRecipients.join(', ')}` }
        }

        return { success: false, error: 'Ninguna lista de correo contenía direcciones de destinatarios.' }
    } catch (error: any) {
        console.error('[HigienePersonal] Error al enviar notificación de correo:', error)
        await logAuditAction({
            username: 'SISTEMA',
            action: 'ERROR_CORREO_HIGIENE_PERSONAL',
            modulo: 'Áreas -> Calidad',
            detalle: `Error enviando correo de higiene personal: ${error?.message || error}`
        }).catch(() => {})
        return { success: false, error: error?.message || 'Error al enviar notificación de correo.' }
    }
}

/**
 * Reenvío manual de notificación al Jefe de Bodega
 */
export async function reenviarNotificacionBodegaHigiene(sucursalId: string, fechaTexto: string) {
    const session = await getSession()
    if (!session?.user) return { error: 'No autorizado' }

    const perms = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'

    if (!isAdmin && !perms.includes('sign_calidad_higiene_personal')) {
        return { error: 'No tienes privilegios para reenviar notificaciones de Calidad.' }
    }

    try {
        const planilla = await prisma.cal_PlanillaHigienePersonal.findUnique({
            where: {
                sucursalId_fechaTexto: { sucursalId, fechaTexto }
            },
            include: { sucursal: true }
        })

        if (!planilla) {
            return { error: 'No existe una planilla para esta sucursal y fecha.' }
        }

        if (planilla.estado === 'ABIERTO') {
            return { error: 'La planilla aún no ha sido firmada por el Encargado de Calidad.' }
        }

        const username = session.user.name || session.user.username || 'Usuario'
        const res = await sendNotificationToBodegaHigiene(planilla.id)

        if (!res.success) {
            return { error: res.error || 'No fue posible reenviar el correo.' }
        }

        await logAuditAction({
            username,
            userId: session.user.id,
            action: 'REENVIO_CORREO_HIGIENE_PERSONAL',
            modulo: 'Áreas -> Calidad',
            detalle: `Reenvió correo de aviso a bodega para planilla de higiene personal ${fechaTexto} en sucursal ${planilla.sucursal.nombre}. ${res.message || ''}`
        })

        return { success: true, message: res.message || 'Correo reenviado exitosamente.' }
    } catch (e: any) {
        console.error('Error reenviando correo bodega:', e)
        return { error: e.message || 'Ocurrió un error al reenviar el correo.' }
    }
}

/**
 * Firma del Encargado de Calidad:
 * Cierra la edición de la planilla, registra la firma dibujada con mouse/lápiz,
 * calcula días de retraso si aplica y notifica al Jefe de Bodega.
 */
export async function firmarCalidadHigienePersonal(sucursalId: string, fechaTexto: string, firmaImg: string) {
    const session = await getSession()
    if (!session?.user) return { error: 'No autorizado' }

    const perms = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'

    if (!isAdmin && !perms.includes('sign_calidad_higiene_personal')) {
        return { error: 'No tienes privilegios para firmar como Encargado de Calidad.' }
    }

    if (!firmaImg || !firmaImg.startsWith('data:image/')) {
        return { error: 'Debe dibujar y estampar su firma con el mouse o lápiz antes de confirmar.' }
    }

    try {
        const planilla = await prisma.cal_PlanillaHigienePersonal.findUnique({
            where: {
                sucursalId_fechaTexto: { sucursalId, fechaTexto }
            },
            include: { registros: true, sucursal: true }
        })

        if (!planilla) {
            return { error: 'No existe una planilla para esta sucursal y fecha.' }
        }

        if (planilla.registros.length === 0) {
            return { error: 'No se puede firmar una planilla sin trabajadores evaluados.' }
        }

        if (planilla.estado !== 'ABIERTO') {
            return { error: 'Esta planilla ya ha sido firmada por Calidad previamente.' }
        }

        const diasAtraso = calculateDiasAtraso(fechaTexto)
        const username = session.user.name || session.user.username || 'Encargado de Calidad'

        const updated = await prisma.cal_PlanillaHigienePersonal.update({
            where: { id: planilla.id },
            data: {
                estado: 'FIRMADO_CALIDAD',
                firmaCalidadUser: username,
                firmaCalidadUserId: session.user.id,
                firmaCalidadFecha: new Date(),
                firmaCalidadDiasAtraso: diasAtraso,
                firmaCalidadImg: firmaImg
            }
        })

        await logAuditAction({
            username,
            userId: session.user.id,
            action: 'FIRMA_CALIDAD_HIGIENE_PERSONAL',
            modulo: 'Áreas -> Calidad',
            detalle: `Firmó con firma dibujada y cerró planilla de higiene personal ${fechaTexto} en sucursal ${planilla.sucursal.nombre}. Días de atraso: ${diasAtraso}`
        })

        // Disparar envío de correo al Jefe de Bodega de manera asíncrona no bloqueante
        sendNotificationToBodegaHigiene(updated.id).catch(err => console.error('Error enviando correo a bodega:', err))

        revalidatePath('/dashboard/areas/calidad/higiene-personal')
        return { success: true, diasAtraso }
    } catch (e: any) {
        console.error('Error firmando calidad higiene personal:', e)
        return { error: 'Ocurrió un error al registrar la firma de Calidad.' }
    }
}

/**
 * Firma y Validación del Jefe de Bodega:
 * Solo es permitida si el Encargado de Calidad ya firmó previamente.
 * Requiere firma dibujada con mouse o lápiz.
 */
export async function firmarBodegaHigienePersonal(sucursalId: string, fechaTexto: string, firmaImg: string) {
    const session = await getSession()
    if (!session?.user) return { error: 'No autorizado' }

    const perms = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'

    if (!isAdmin && !perms.includes('sign_bodega_higiene_personal')) {
        return { error: 'No tienes privilegios para firmar como Jefe de Bodega.' }
    }

    if (!firmaImg || !firmaImg.startsWith('data:image/')) {
        return { error: 'Debe dibujar y estampar su firma con el mouse o lápiz antes de confirmar.' }
    }

    try {
        const planilla = await prisma.cal_PlanillaHigienePersonal.findUnique({
            where: {
                sucursalId_fechaTexto: { sucursalId, fechaTexto }
            },
            include: { sucursal: true }
        })

        if (!planilla) {
            return { error: 'No existe una planilla para esta sucursal y fecha.' }
        }

        if (planilla.estado === 'ABIERTO') {
            return { error: 'El Jefe de Bodega no puede firmar hasta que el Encargado de Calidad haya firmado y cerrado el registro.' }
        }

        if (planilla.estado === 'CERRADO') {
            return { error: 'Esta planilla ya ha sido validada y firmada por el Jefe de Bodega.' }
        }

        const username = session.user.name || session.user.username || 'Jefe de Bodega'

        await prisma.cal_PlanillaHigienePersonal.update({
            where: { id: planilla.id },
            data: {
                estado: 'CERRADO',
                firmaBodegaUser: username,
                firmaBodegaUserId: session.user.id,
                firmaBodegaFecha: new Date(),
                firmaBodegaImg: firmaImg
            }
        })

        await logAuditAction({
            username,
            userId: session.user.id,
            action: 'FIRMA_BODEGA_HIGIENE_PERSONAL',
            modulo: 'Áreas -> Calidad',
            detalle: `Validó con firma dibujada planilla de higiene personal ${fechaTexto} en sucursal ${planilla.sucursal.nombre}`
        })

        revalidatePath('/dashboard/areas/calidad/higiene-personal')
        return { success: true }
    } catch (e: any) {
        console.error('Error firmando bodega higiene personal:', e)
        return { error: 'Ocurrió un error al registrar la firma del Jefe de Bodega.' }
    }
}

/**
 * Obtener historial reciente de planillas de la sucursal para navegación rápida
 */
export async function getPlanillasHistorialHigienePersonal(sucursalId: string) {
    const session = await getSession()
    if (!session?.user) return []

    try {
        const planillas = await prisma.cal_PlanillaHigienePersonal.findMany({
            where: { sucursalId },
            include: {
                sucursal: {
                    select: { nombre: true }
                },
                _count: {
                    select: { registros: true }
                }
            },
            orderBy: { fechaTexto: 'desc' },
            take: 60
        })

        return planillas.map(p => ({
            id: p.id,
            sucursalId: p.sucursalId,
            sucursalNombre: p.sucursal.nombre,
            fechaTexto: p.fechaTexto,
            estado: p.estado,
            totalTrabajadores: p._count.registros,
            firmaCalidadUser: p.firmaCalidadUser,
            firmaCalidadDiasAtraso: p.firmaCalidadDiasAtraso,
            diasAtrasoCalculado: p.estado === 'ABIERTO' ? calculateDiasAtraso(p.fechaTexto) : (p.firmaCalidadDiasAtraso || 0),
            firmaBodegaUser: p.firmaBodegaUser
        }))
    } catch (e) {
        console.error('Error fetching historial higiene personal:', e)
        return []
    }
}
