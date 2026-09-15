'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { encryptPatente, decryptPatente } from '@/lib/patente-crypto'
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
    // Ajustar a zona horaria local de Chile / sistema
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
export async function getSucursalesForUser() {
    const session = await getSession()
    if (!session?.user) {
        return { error: 'No autorizado', sucursales: [], isRestricted: false, defaultSucursalId: '' }
    }

    const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true, sucursales: true }
    })

    if (!dbUser) {
        return { error: 'Usuario no encontrado', sucursales: [], isRestricted: false, defaultSucursalId: '' }
    }

    const isAdmin = dbUser.role.name === 'Administrador' || dbUser.role.name === 'admin'
    const hasAssignedSucursales = dbUser.sucursales && dbUser.sucursales.length > 0

    if (hasAssignedSucursales && !isAdmin) {
        const sorted = [...dbUser.sucursales].sort((a, b) => a.nombre.localeCompare(b.nombre))
        return {
            sucursales: sorted.map(s => ({ id: s.id, nombre: s.nombre })),
            isRestricted: true,
            defaultSucursalId: sorted[0]?.id || '',
            userRole: dbUser.role.name,
            userPermissions: session.user.role?.permissions || []
        }
    }

    const allSucursales = await prisma.sucursal.findMany({
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' }
    })

    return {
        sucursales: allSucursales,
        isRestricted: false,
        defaultSucursalId: allSucursales[0]?.id || '',
        userRole: dbUser.role.name,
        userPermissions: session.user.role?.permissions || []
    }
}

/**
 * Obtener la planilla y registros del día para la sucursal seleccionada
 */
async function ensureTransporteTables() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Cal_PlanillaTransporte" (
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
                CONSTRAINT "Cal_PlanillaTransporte_sucursalId_fechaTexto_key" UNIQUE ("sucursalId", "fechaTexto")
            );
        `)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_PlanillaTransporte_sucursalId_idx" ON "Cal_PlanillaTransporte"("sucursalId");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_PlanillaTransporte_fechaTexto_idx" ON "Cal_PlanillaTransporte"("fechaTexto");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_PlanillaTransporte_estado_idx" ON "Cal_PlanillaTransporte"("estado");`)

        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Cal_RegistroTransporte" (
                "id" TEXT PRIMARY KEY,
                "planillaId" TEXT NOT NULL,
                "patenteEncriptada" TEXT NOT NULL,
                "limpiezaInterior" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
                "limpiezaExterior" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
                "puertaCamara" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
                "piezasSinOxidacion" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
                "equipoCongelacion" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
                "equipoRefrigeracion" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
                "observacion" TEXT,
                "accionCorrectiva" TEXT,
                "creadoPor" VARCHAR(150) NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_RegistroTransporte_planillaId_idx" ON "Cal_RegistroTransporte"("planillaId");`)
    } catch (err) {
        console.error('Error auto-creating Cal_PlanillaTransporte tables:', err)
    }
}

export async function getPlanillaDia(sucursalId: string, fechaTexto: string, isRetry: boolean = false): Promise<any> {
    const session = await getSession()
    if (!session?.user) return { error: 'No autorizado' }

    try {
        const planilla = await prisma.cal_PlanillaTransporte.findUnique({
            where: {
                sucursalId_fechaTexto: {
                    sucursalId,
                    fechaTexto
                }
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
                diasAtraso,
                todayTexto: getTodayDateString()
            }
        }

        // Descifrar patentes para mostrarlas en la UI
        const registrosDecrypted = planilla.registros.map(r => ({
            ...r,
            patente: decryptPatente(r.patenteEncriptada)
        }))

        return {
            planilla: {
                id: planilla.id,
                sucursalId: planilla.sucursalId,
                sucursalNombre: planilla.sucursal.nombre,
                fecha: planilla.fecha,
                fechaTexto: planilla.fechaTexto,
                estado: planilla.estado,
                firmaCalidadUser: planilla.firmaCalidadUser,
                firmaCalidadFecha: planilla.firmaCalidadFecha,
                firmaCalidadDiasAtraso: planilla.firmaCalidadDiasAtraso,
                firmaBodegaUser: planilla.firmaBodegaUser,
                firmaBodegaFecha: planilla.firmaBodegaFecha,
                firmaCalidadImg: planilla.firmaCalidadImg,
                firmaBodegaImg: planilla.firmaBodegaImg,
                observacionesGenerales: planilla.observacionesGenerales
            },
            registros: registrosDecrypted,
            diasAtraso: planilla.estado === 'ABIERTO' ? diasAtraso : planilla.firmaCalidadDiasAtraso,
            todayTexto: getTodayDateString()
        }
    } catch (e: any) {
        console.error('Error fetching planilla:', e)
        const isTableMissing = e?.code === 'P2021' || (e?.message && (e.message.includes('does not exist') || e.message.includes('42P01') || e.message.includes('relation')))
        if (isTableMissing && !isRetry) {
            console.log('Detectada ausencia de tablas Cal_PlanillaTransporte en PostgreSQL. Inicializando automáticamente...')
            await ensureTransporteTables()
            return getPlanillaDia(sucursalId, fechaTexto, true)
        }
        return { error: 'Error al obtener registros de la planilla.' }
    }
}

/**
 * Guardar o actualizar registro de un vehículo inspeccionado
 * La fecha es rescatada automáticamente por el sistema (el usuario no puede cambiarla)
 */
export async function saveRegistroTransporte(data: {
    id?: string
    sucursalId: string
    fechaTexto?: string // Opcional o referencial, el servidor fija la fecha oficial del sistema
    patente: string
    limpiezaInterior: string
    limpiezaExterior: string
    puertaCamara: string
    piezasSinOxidacion: string
    equipoCongelacion: string
    equipoRefrigeracion: string
    observacion?: string
    accionCorrectiva?: string
}) {
    const session = await getSession()
    if (!session?.user) return { error: 'No autorizado' }

    const perms = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'

    if (!isAdmin && !perms.includes('manage_calidad_transporte_higiene')) {
        return { error: 'No tienes permiso para gestionar registros de transporte e higiene.' }
    }

    if (!data.patente || !data.patente.trim()) {
        return { error: 'Debe ingresar la patente del vehículo.' }
    }

    // Regla estricta: El usuario no puede cambiar la fecha de inspección.
    // La fecha siempre corresponde a la fecha del día rescatada por sistema (o la fecha de la planilla en caso de edición de un vehículo existente).
    const fechaOficialTexto = data.id && data.fechaTexto ? data.fechaTexto : getTodayDateString()

    try {
        // 1. Obtener o crear la planilla diaria para esa sucursal y fecha
        let planilla = await prisma.cal_PlanillaTransporte.findUnique({
            where: {
                sucursalId_fechaTexto: {
                    sucursalId: data.sucursalId,
                    fechaTexto: fechaOficialTexto
                }
            }
        })

        if (planilla && planilla.estado !== 'ABIERTO') {
            return { error: 'La planilla de esta fecha ya ha sido firmada y cerrada. No se pueden agregar ni editar registros.' }
        }

        if (!planilla) {
            // Fecha formal al mediodía local para evitar desfases de UTC
            const fechaFormal = new Date(`${fechaOficialTexto}T12:00:00`)
            planilla = await prisma.cal_PlanillaTransporte.create({
                data: {
                    sucursalId: data.sucursalId,
                    fecha: fechaFormal,
                    fechaTexto: fechaOficialTexto,
                    estado: 'ABIERTO'
                }
            })
        }

        const patenteEnc = encryptPatente(data.patente)
        const username = session.user.name || session.user.username || 'Usuario'

        if (data.id) {
            // Actualizar
            await prisma.cal_RegistroTransporte.update({
                where: { id: data.id },
                data: {
                    patenteEncriptada: patenteEnc,
                    limpiezaInterior: data.limpiezaInterior || 'Cumple',
                    limpiezaExterior: data.limpiezaExterior || 'Cumple',
                    puertaCamara: data.puertaCamara || 'Cumple',
                    piezasSinOxidacion: data.piezasSinOxidacion || 'Cumple',
                    equipoCongelacion: data.equipoCongelacion || 'Cumple',
                    equipoRefrigeracion: data.equipoRefrigeracion || 'Cumple',
                    observacion: data.observacion?.trim() || null,
                    accionCorrectiva: data.accionCorrectiva?.trim() || null,
                }
            })

            await logAuditAction({
                username,
                action: 'MODIFICAR_REGISTRO_TRANSPORTE',
                modulo: 'Áreas -> Calidad',
                detalle: `Actualizó inspección del vehículo ${data.patente.toUpperCase()} en planilla ${data.fechaTexto}`
            })
        } else {
            // Crear
            await prisma.cal_RegistroTransporte.create({
                data: {
                    planillaId: planilla.id,
                    patenteEncriptada: patenteEnc,
                    limpiezaInterior: data.limpiezaInterior || 'Cumple',
                    limpiezaExterior: data.limpiezaExterior || 'Cumple',
                    puertaCamara: data.puertaCamara || 'Cumple',
                    piezasSinOxidacion: data.piezasSinOxidacion || 'Cumple',
                    equipoCongelacion: data.equipoCongelacion || 'Cumple',
                    equipoRefrigeracion: data.equipoRefrigeracion || 'Cumple',
                    observacion: data.observacion?.trim() || null,
                    accionCorrectiva: data.accionCorrectiva?.trim() || null,
                    creadoPor: username
                }
            })

            await logAuditAction({
                username,
                action: 'CREAR_REGISTRO_TRANSPORTE',
                modulo: 'Áreas -> Calidad',
                detalle: `Registró inspección de vehículo ${data.patente.toUpperCase()} en planilla ${data.fechaTexto}`
            })
        }

        revalidatePath('/dashboard/areas/calidad/transporte-higiene')
        return { success: true }
    } catch (e: any) {
        console.error('Error saving registro:', e)
        return { error: 'Ocurrió un error al guardar el registro del vehículo.' }
    }
}

/**
 * Eliminar un registro de vehículo.
 * - Usuarios normales: solo si la planilla sigue ABIERTA.
 * - Administradores: pueden eliminar registros en cualquier momento (incluso si la planilla fue firmada o para purgar pruebas).
 */
export async function deleteRegistroTransporte(id: string) {
    const session = await getSession()
    if (!session?.user) return { error: 'No autorizado' }

    const perms = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'

    if (!isAdmin && !perms.includes('manage_calidad_transporte_higiene')) {
        return { error: 'No tienes permiso para eliminar registros.' }
    }

    try {
        const registro = await prisma.cal_RegistroTransporte.findUnique({
            where: { id },
            include: { planilla: { include: { sucursal: true } } }
        })

        if (!registro) return { error: 'Registro no encontrado' }
        if (!isAdmin && registro.planilla.estado !== 'ABIERTO') {
            return { error: 'No se puede eliminar registros de una planilla ya firmada y cerrada.' }
        }

        const rawPatente = decryptPatente(registro.patenteEncriptada)
        await prisma.cal_RegistroTransporte.delete({ where: { id } })

        const username = session.user.name || session.user.username || 'Usuario'
        await logAuditAction({
            username,
            userId: session.user.id,
            action: 'ELIMINAR_REGISTRO_TRANSPORTE',
            modulo: 'Áreas -> Calidad',
            detalle: `Eliminó registro del vehículo ${rawPatente} de la planilla ${registro.planilla.fechaTexto} en sucursal ${registro.planilla.sucursal.nombre}${isAdmin && registro.planilla.estado !== 'ABIERTO' ? ' (Acción de Administrador sobre planilla cerrada)' : ''}`
        })

        revalidatePath('/dashboard/areas/calidad/transporte-higiene')
        return { success: true }
    } catch (e) {
        console.error('Error deleting registro:', e)
        return { error: 'Ocurrió un error al eliminar el registro.' }
    }
}

/**
 * Eliminar planilla completa y todos sus registros (Solo perfil Administrador).
 * Permite purgar registros basura de pruebas o corregir errores en el sistema.
 */
export async function eliminarPlanillaTransporte(sucursalId: string, fechaTexto: string) {
    const session = await getSession()
    if (!session?.user) return { error: 'No autorizado' }

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    if (!isAdmin) {
        return { error: 'Esta acción está restringida exclusivamente a usuarios con perfil de Administrador.' }
    }

    try {
        const planilla = await prisma.cal_PlanillaTransporte.findUnique({
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

        const totalVehiculos = planilla._count.registros
        const sucursalNombre = planilla.sucursal.nombre

        // Eliminar planilla (y por cascada todos sus registros de transporte)
        await prisma.cal_PlanillaTransporte.delete({
            where: { id: planilla.id }
        })

        const username = session.user.name || session.user.username || 'Administrador'
        await logAuditAction({
            username,
            userId: session.user.id,
            action: 'ELIMINAR_PLANILLA_TRANSPORTE',
            modulo: 'Áreas -> Calidad',
            detalle: `Eliminó planilla completa y ${totalVehiculos} vehículo(s) registrados de la fecha ${fechaTexto} en sucursal ${sucursalNombre} (Purga de datos)`
        })

        revalidatePath('/dashboard/areas/calidad/transporte-higiene')
        return { success: true, count: totalVehiculos }
    } catch (e: any) {
        console.error('Error eliminando planilla completa:', e)
        return { error: e.message || 'Ocurrió un error al eliminar la planilla.' }
    }
}

/**
 * Notificación por correo al Jefe de Bodega según Listas de Distribución
 */
export async function sendNotificationToBodega(planillaId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const planilla = await prisma.cal_PlanillaTransporte.findUnique({
            where: { id: planillaId },
            include: {
                sucursal: true,
                registros: true
            }
        })

        if (!planilla) {
            return { success: false, error: 'Planilla no encontrada.' }
        }

        const codigoPantalla = 'calidad-transporte-higiene'

        // Buscar configuraciones activas para esta pantalla
        const configs = await prisma.notificacionPantalla.findMany({
            where: { codigoPantalla, activa: true },
            include: { listaCorreo: true }
        })

        if (configs.length === 0) {
            console.log(`[TransporteHigiene] No hay listas de correo activas configuradas para "${codigoPantalla}".`)
            return { success: false, error: `No hay listas de correo activas configuradas para "${codigoPantalla}".` }
        }

        // Filtrar listas vinculadas a la sucursal de la planilla, o listas generales sin sucursal
        const configsSucursal = configs.filter(c => c.listaCorreo.sucursalId === planilla.sucursalId)
        const targetConfigs = configsSucursal.length > 0 ? configsSucursal : configs.filter(c => !c.listaCorreo.sucursalId)

        if (targetConfigs.length === 0) {
            console.log(`[TransporteHigiene] No hay listas de correo específicas para la sucursal ${planilla.sucursal.nombre} ni listas generales.`)
            return { success: false, error: `No hay listas de correo específicas para la sucursal ${planilla.sucursal.nombre} ni listas generales.` }
        }

        // Configuración SMTP global
        const emailConfig = await prisma.emailConfig.findUnique({ where: { id: 'global' } })
        if (!emailConfig) {
            console.log('[TransporteHigiene] Configuración SMTP global no configurada.')
            return { success: false, error: 'Configuración SMTP global no configurada en el sistema.' }
        }

        // Obtener plantilla personalizada si existe
        const plantillaCorreo = await prisma.plantillaCorreo.findUnique({
            where: { codigoPantalla }
        })

        // Preparar tags
        const totalVehiculos = planilla.registros.length
        const desviaciones = planilla.registros
            .filter(r => 
                r.limpiezaInterior === 'No Cumple' ||
                r.limpiezaExterior === 'No Cumple' ||
                r.puertaCamara === 'No Cumple' ||
                r.piezasSinOxidacion === 'No Cumple' ||
                r.equipoCongelacion === 'No Cumple' ||
                r.equipoRefrigeracion === 'No Cumple'
            )
            .map(r => {
                const pat = decryptPatente(r.patenteEncriptada)
                const fallas: string[] = []
                if (r.limpiezaInterior === 'No Cumple') fallas.push('Limpieza Interior')
                if (r.limpiezaExterior === 'No Cumple') fallas.push('Limpieza Exterior')
                if (r.puertaCamara === 'No Cumple') fallas.push('Puerta Cámara')
                if (r.piezasSinOxidacion === 'No Cumple') fallas.push('Piezas sin oxidación')
                if (r.equipoCongelacion === 'No Cumple') fallas.push('Equipo Congelación')
                if (r.equipoRefrigeracion === 'No Cumple') fallas.push('Equipo Refrigeración')
                return `- <b>${pat}</b>: ${fallas.join(', ')}${r.observacion ? ` (Obs: ${r.observacion})` : ''}`
            })

        const desviacionesTexto = desviaciones.length > 0 
            ? desviaciones.join('<br/>') 
            : '<i>Todos los vehículos evaluados cumplen los estándares de higiene.</i>'

        const tags: Record<string, string> = {
            Fecha: planilla.fechaTexto.split('-').reverse().join('/'),
            Sucursal: planilla.sucursal.nombre,
            UsuarioCalidad: planilla.firmaCalidadUser || 'Encargado de Calidad',
            TotalVehiculos: String(totalVehiculos),
            Desviaciones: desviacionesTexto,
            DiasAtraso: String(planilla.firmaCalidadDiasAtraso || 0)
        }

        let subject = `Cierre Registro Transporte e Higiene - ${planilla.sucursal.nombre} (${tags.Fecha})`
        let bodyHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 650px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background: #ffffff;">
                <h2 style="color: #0891b2; margin-top: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">HENDAYA</h2>
                <h3 style="color: #0f172a; margin-top: 8px;">Registro de Higiene y Estado Transporte Cerrado</h3>
                <p>Estimado Jefe de Bodega,</p>
                <p>El Encargado de Calidad <b>${tags.UsuarioCalidad}</b> ha firmado y cerrado la planilla diaria de inspección de vehículos.</p>
                
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <tr><td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #e2e8f0; width: 40%;">Sucursal:</td><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${tags.Sucursal}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">Fecha Inspección:</td><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${tags.Fecha}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">Total Vehículos:</td><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${tags.TotalVehiculos}</td></tr>
                    ${planilla.firmaCalidadDiasAtraso > 0 ? `<tr><td style="padding: 10px; font-weight: bold; color: #b91c1c; border-bottom: 1px solid #e2e8f0;">Días de Atraso en Firma:</td><td style="padding: 10px; color: #b91c1c; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${planilla.firmaCalidadDiasAtraso} días</td></tr>` : ''}
                </table>

                <h4 style="color: #334155; margin-bottom: 6px;">Detalle / No Conformidades:</h4>
                <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; font-size: 13px;">
                    ${desviacionesTexto}
                </div>

                <p style="margin-top: 20px;">Por favor ingrese al sistema Hendaya en el módulo <b>Áreas \\ Calidad \\ Registro transportista interno higiene y estado Transporte</b> para revisar la información y proceder con su <b>firma de validación</b>.</p>
                
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
                console.log(`[TransporteHigiene] Correo enviado exitosamente a la lista: ${config.listaCorreo.nombre}`)
            }
        }

        if (sentListNames.length > 0) {
            await logAuditAction({
                username: 'SISTEMA',
                action: 'ENVIO_CORREO_TRANSPORTE',
                modulo: 'Áreas -> Calidad',
                detalle: `Notificación enviada a lista(s) [${sentListNames.join(', ')}] (${allRecipients.join(', ')}) para planilla ${planilla.fechaTexto} - ${planilla.sucursal.nombre}`
            })
            return { success: true, message: `Correo enviado a: ${allRecipients.join(', ')}` }
        }

        return { success: false, error: 'Ninguna lista de correo contenía direcciones de destinatarios (campo "para" vacío).' }
    } catch (error: any) {
        console.error('[TransporteHigiene] Error al enviar notificación de correo:', error)
        await logAuditAction({
            username: 'SISTEMA',
            action: 'ERROR_CORREO_TRANSPORTE',
            modulo: 'Áreas -> Calidad',
            detalle: `Error enviando correo de transporte: ${error?.message || error}`
        }).catch(() => {})
        return { success: false, error: error?.message || 'Error al enviar notificación de correo.' }
    }
}

/**
 * Firma del Encargado de Calidad:
 * Cierra la edición de la planilla, registra la firma dibujada con mouse/lápiz,
 * calcula días de retraso si aplica y notifica al Jefe de Bodega.
 */
export async function firmarCalidadPlanilla(sucursalId: string, fechaTexto: string, firmaImg: string) {
    const session = await getSession()
    if (!session?.user) return { error: 'No autorizado' }

    const perms = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'

    if (!isAdmin && !perms.includes('sign_calidad_transporte_higiene')) {
        return { error: 'No tienes privilegios para firmar como Encargado de Calidad.' }
    }

    if (!firmaImg || !firmaImg.startsWith('data:image/')) {
        return { error: 'Debe dibujar y estampar su firma con el mouse o lápiz antes de confirmar.' }
    }

    try {
        const planilla = await prisma.cal_PlanillaTransporte.findUnique({
            where: {
                sucursalId_fechaTexto: { sucursalId, fechaTexto }
            },
            include: { registros: true, sucursal: true }
        })

        if (!planilla) {
            return { error: 'No existe una planilla para esta sucursal y fecha.' }
        }

        if (planilla.registros.length === 0) {
            return { error: 'No se puede firmar una planilla sin vehículos registrados.' }
        }

        if (planilla.estado !== 'ABIERTO') {
            return { error: 'Esta planilla ya ha sido firmada por Calidad previamente.' }
        }

        const diasAtraso = calculateDiasAtraso(fechaTexto)
        const username = session.user.name || session.user.username || 'Encargado de Calidad'

        const updated = await prisma.cal_PlanillaTransporte.update({
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
            action: 'FIRMA_CALIDAD_TRANSPORTE',
            modulo: 'Áreas -> Calidad',
            detalle: `Firmó con firma dibujada y cerró planilla de transporte ${fechaTexto} en sucursal ${planilla.sucursal.nombre}. Días de atraso: ${diasAtraso}`
        })

        // Disparar envío de correo al Jefe de Bodega de manera asíncrona no bloqueante
        sendNotificationToBodega(updated.id).catch(err => console.error('Error enviando correo a bodega:', err))

        revalidatePath('/dashboard/areas/calidad/transporte-higiene')
        return { success: true, diasAtraso }
    } catch (e: any) {
        console.error('Error firmando calidad:', e)
        return { error: 'Ocurrió un error al registrar la firma de Calidad.' }
    }
}

/**
 * Reenvío manual de notificación al Jefe de Bodega (ej. tras corregir listas de distribución o si requiere reenvío)
 */
export async function reenviarNotificacionBodega(sucursalId: string, fechaTexto: string) {
    const session = await getSession()
    if (!session?.user) return { error: 'No autorizado' }

    const perms = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'

    if (!isAdmin && !perms.includes('sign_calidad_transporte_higiene')) {
        return { error: 'No tienes privilegios para reenviar notificaciones de Calidad.' }
    }

    try {
        const planilla = await prisma.cal_PlanillaTransporte.findUnique({
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
        const res = await sendNotificationToBodega(planilla.id)

        if (!res.success) {
            return { error: res.error || 'No fue posible reenviar el correo.' }
        }

        await logAuditAction({
            username,
            userId: session.user.id,
            action: 'REENVIO_CORREO_TRANSPORTE',
            modulo: 'Áreas -> Calidad',
            detalle: `Reenvió correo de aviso a bodega para planilla ${fechaTexto} en sucursal ${planilla.sucursal.nombre}. ${res.message || ''}`
        })

        return { success: true, message: res.message || 'Correo reenviado exitosamente.' }
    } catch (e: any) {
        console.error('Error reenviando correo bodega:', e)
        return { error: e.message || 'Ocurrió un error al reenviar el correo.' }
    }
}

/**
 * Firma y Validación del Jefe de Bodega:
 * Solo es permitida si el Encargado de Calidad ya firmó previamente.
 * Requiere firma dibujada con mouse o lápiz.
 */
export async function firmarBodegaPlanilla(sucursalId: string, fechaTexto: string, firmaImg: string) {
    const session = await getSession()
    if (!session?.user) return { error: 'No autorizado' }

    const perms = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'

    if (!isAdmin && !perms.includes('sign_bodega_transporte_higiene')) {
        return { error: 'No tienes privilegios para firmar como Jefe de Bodega.' }
    }

    if (!firmaImg || !firmaImg.startsWith('data:image/')) {
        return { error: 'Debe dibujar y estampar su firma con el mouse o lápiz antes de confirmar.' }
    }

    try {
        const planilla = await prisma.cal_PlanillaTransporte.findUnique({
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

        await prisma.cal_PlanillaTransporte.update({
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
            action: 'FIRMA_BODEGA_TRANSPORTE',
            modulo: 'Áreas -> Calidad',
            detalle: `Validó con firma dibujada planilla de transporte ${fechaTexto} en sucursal ${planilla.sucursal.nombre}`
        })

        revalidatePath('/dashboard/areas/calidad/transporte-higiene')
        return { success: true }
    } catch (e: any) {
        console.error('Error firmando bodega:', e)
        return { error: 'Ocurrió un error al registrar la firma del Jefe de Bodega.' }
    }
}

/**
 * Obtener historial reciente de planillas de la sucursal para navegación rápida
 */
export async function getPlanillasHistorial(sucursalId: string) {
    const session = await getSession()
    if (!session?.user) return []

    try {
        const planillas = await prisma.cal_PlanillaTransporte.findMany({
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
            totalVehiculos: p._count.registros,
            firmaCalidadUser: p.firmaCalidadUser,
            firmaCalidadDiasAtraso: p.firmaCalidadDiasAtraso,
            diasAtrasoCalculado: p.estado === 'ABIERTO' ? calculateDiasAtraso(p.fechaTexto) : (p.firmaCalidadDiasAtraso || 0),
            firmaBodegaUser: p.firmaBodegaUser
        }))
    } catch (e) {
        console.error('Error fetching historial:', e)
        return []
    }
}
