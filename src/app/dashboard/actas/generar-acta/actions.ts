'use server'

import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { logAuditAction } from '@/lib/audit'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

const ENCRYPTION_KEY = crypto.createHash('sha256').update(String(process.env.SESSION_SECRET || 'super-secret-key-change-me')).digest('base64').substring(0, 32)

function decrypt(text: string) {
    try {
        const textParts = text.split(':')
        if (textParts.length < 2) return text
        const iv = Buffer.from(textParts.shift()!, 'hex')
        const encryptedText = Buffer.from(textParts.join(':'), 'hex')
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv)
        let decrypted = decipher.update(encryptedText)
        decrypted = Buffer.concat([decrypted, decipher.final()])
        return decrypted.toString()
    } catch (e) {
        console.error("Error decrypting SMTP password:", e)
        return text
    }
}

function isRoleAllowedForPlantilla(plantillaRolesPerfiles: string | null | undefined, userRoleName: string, userRoleId: string): boolean {
    if (!plantillaRolesPerfiles) return true
    try {
        const allowed: string[] = JSON.parse(plantillaRolesPerfiles)
        if (!Array.isArray(allowed) || allowed.length === 0) return true
        return allowed.includes(userRoleName) || allowed.includes(userRoleId)
    } catch {
        return true
    }
}

export async function getActasPlantillasActivas() {
    try {
        const session = await getSession()
        const userRoleName = session?.user?.role?.name || ''
        const userRoleId = session?.user?.role?.id || ''

        const plantillas = await (prisma as any).actaSupervisionPlantilla.findMany({
            where: { estado: true },
            orderBy: { createdAt: 'desc' }
        })

        const filtered = plantillas.filter((p: any) => isRoleAllowedForPlantilla(p.rolesPerfiles, userRoleName, userRoleId))

        return { success: true, data: filtered }
    } catch (error: any) {
        return { success: false, error: 'Error al cargar plantillas' }
    }
}

export async function getActaFullData(id: string) {
    try {
        const session = await getSession()
        if (!session) return { success: false, error: 'No autenticado' }

        const userRoleName = session?.user?.role?.name || ''
        const userRoleId = session?.user?.role?.id || ''

        const acta = await (prisma as any).actaSupervisionRespuesta.findUnique({
            where: { id },
            include: { plantilla: true }
        })

        if (!acta) return { success: false, error: 'Acta no encontrada' }

        if (!acta.correlativo && acta.plantillaId) {
            const countEarlier = await (prisma as any).actaSupervisionRespuesta.count({
                where: {
                    plantillaId: acta.plantillaId,
                    createdAt: { lte: acta.createdAt }
                }
            })
            const corrVal = countEarlier > 0 ? countEarlier : 1
            acta.correlativo = corrVal
            await (prisma as any).actaSupervisionRespuesta.update({
                where: { id: acta.id },
                data: { correlativo: corrVal }
            }).catch(() => {})
        }

        if (acta.plantilla && !isRoleAllowedForPlantilla(acta.plantilla.rolesPerfiles, userRoleName, userRoleId)) {
            return { success: false, error: 'No tienes permisos para visualizar este tipo de acta según tu perfil' }
        }

        return { success: true, data: acta }
    } catch (error: any) {
        return { success: false, error: error.message || 'Error al obtener datos del acta' }
    }
}

export async function getColegiosForPlantilla(plantillaId: string) {
    try {
        const session = await getSession()
        if (!session || !session.user) return { success: false, error: 'No autenticado' }

        const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
        const userRoleName = session.user.role?.name || ''
        const userRoleId = session.user.role?.id || ''
        const userRbds: number[] = session.user.rbds || []

        const plantilla = await (prisma as any).actaSupervisionPlantilla.findUnique({
            where: { id: plantillaId }
        })

        if (!plantilla) return { success: false, error: 'Plantilla no encontrada' }

        if (!isRoleAllowedForPlantilla(plantilla.rolesPerfiles, userRoleName, userRoleId)) {
            return { success: false, error: 'No tienes acceso a este tipo de acta según tu perfil' }
        }

        // Parse instituciones of plantilla (supports JSON string or "JUNJI • INTEGRA")
        let instList: string[] = []
        try {
            if (plantilla.instituciones?.startsWith('[')) {
                instList = JSON.parse(plantilla.instituciones).map((i: string) => i.trim().toLowerCase())
            } else {
                instList = (plantilla.instituciones || '')
                    .split('•')
                    .map((i: string) => i.trim().toLowerCase())
                    .filter(Boolean)
            }
        } catch (e) {
            instList = []
        }

        const whereCondition: any = {}

        // Filter by user RBDs if not admin
        if (!isAdmin) {
            if (userRbds.length === 0) {
                return { success: true, data: [] }
            }
            whereCondition.colRBD = { in: userRbds }
        }

        const allColegios = await (prisma as any).colegios.findMany({
            where: whereCondition,
            orderBy: { colRBD: 'asc' }
        })

        // Filter colegios matching plantilla institutions
        const filteredColegios = allColegios.filter((c: any) => {
            if (instList.length === 0) return true
            const colInst = (c.institucion || '').toLowerCase()
            return instList.some((inst: string) => colInst.includes(inst) || inst.includes(colInst))
        })

        return { success: true, data: filteredColegios }
    } catch (error: any) {
        console.error('Error al obtener colegios para plantilla:', error)
        return { success: false, error: 'Error al obtener colegios' }
    }
}

export async function createActaResponse(plantillaId: string, colRBD: number) {
    try {
        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('view_generar_actas')) {
            return { success: false, error: 'Sin permisos' }
        }

        const username = session?.user?.username || 'desconocido'
        const userId = session?.user?.id || null
        const supervisorNombre = session?.user?.name || username

        const userRoleName = session?.user?.role?.name || ''
        const userRoleId = session?.user?.role?.id || ''

        const plantilla = await (prisma as any).actaSupervisionPlantilla.findUnique({
            where: { id: plantillaId }
        })

        if (!plantilla) return { success: false, error: 'Plantilla no encontrada' }

        if (!isRoleAllowedForPlantilla(plantilla.rolesPerfiles, userRoleName, userRoleId)) {
            return { success: false, error: 'No tienes permisos para generar actas de este tipo según tu perfil' }
        }

        // Obtenemos los datos del colegio para autocompletar la cabecera
        const colegio = await (prisma as any).colegios.findFirst({
            where: { colRBD: Number(colRBD) }
        })

        // Calcular el número correlativo de acta secuencial para la plantilla
        const lastActa = await (prisma as any).actaSupervisionRespuesta.findFirst({
            where: { plantillaId: plantilla.id, correlativo: { not: null } },
            orderBy: { correlativo: 'desc' }
        })
        const nextCorrelativo = (lastActa?.correlativo || 0) + 1

        const nueva = await (prisma as any).actaSupervisionRespuesta.create({
            data: {
                plantillaId: plantilla.id,
                licitacionId: plantilla.licitacionId,
                anio: plantilla.anio,
                rbd: Number(colRBD),
                nombreEstablecimiento: colegio?.nombreEstablecimiento || null,
                direccion: colegio?.direccionEstablecimiento || null,
                ciudad: colegio?.comuna || null,
                institucion: colegio?.institucion || null,
                sucursal: colegio?.sucursal || null,
                supervisorNombre: supervisorNombre,
                respuestasData: '{}',
                estado: 'Borrador',
                usuario: username,
                correlativo: nextCorrelativo
            }
        })

        await logAuditAction({
            username,
            userId,
            action: 'INICIAR_ACTA',
            modulo: 'ACTAS -> GENERAR ACTA',
            detalle: `Se inició una nueva acta (ID: ${nueva.id}, RBD: ${colRBD}) basada en la plantilla "${plantilla.nombre}"`
        })

        revalidatePath('/dashboard/actas/generar-acta')
        return { success: true, id: nueva.id }
    } catch (error: any) {
        console.error('Error al crear acta:', error)
        return { success: false, error: error.message || 'Error al crear acta' }
    }
}

export async function saveActaResponse(
    id: string, 
    data: { 
        rbd: number, 
        nombreEstablecimiento?: string,
        direccion?: string,
        ciudad?: string,
        institucion?: string,
        sucursal?: string,
        supervisorNombre?: string,
        supervisorRut?: string,
        respuestasData: string, 
        estado: 'Borrador' | 'Finalizado' 
    }
) {
    try {
        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('view_generar_actas')) {
            return { success: false, error: 'Sin permisos' }
        }

        const username = session?.user?.username || 'desconocido'
        const userId = session?.user?.id || null

        const acta = await (prisma as any).actaSupervisionRespuesta.findUnique({ where: { id } })
        if (!acta) return { success: false, error: 'Acta no encontrada' }

        if (acta.estado === 'Finalizado') {
            return { success: false, error: 'El acta ya está finalizada y no puede editarse.' }
        }

        const updated = await (prisma as any).actaSupervisionRespuesta.update({
            where: { id },
            data: {
                rbd: data.rbd,
                nombreEstablecimiento: data.nombreEstablecimiento,
                direccion: data.direccion,
                ciudad: data.ciudad,
                institucion: data.institucion,
                sucursal: data.sucursal,
                supervisorNombre: data.supervisorNombre,
                supervisorRut: data.supervisorRut,
                respuestasData: data.respuestasData,
                estado: data.estado
            }
        })

        await logAuditAction({
            username,
            userId,
            action: data.estado === 'Finalizado' ? 'FINALIZAR_ACTA' : 'GUARDAR_BORRADOR_ACTA',
            modulo: 'ACTAS -> GENERAR ACTA',
            detalle: `Se ${data.estado === 'Finalizado' ? 'finalizó' : 'guardó borrador de'} acta (ID: ${id})`
        })

        revalidatePath(`/dashboard/actas/generar-acta/${id}`)
        revalidatePath('/dashboard/actas/generar-acta')
        return { success: true }
    } catch (error: any) {
        console.error('Error al guardar acta:', error)
        return { success: false, error: error.message || 'Error al guardar acta' }
    }
}

export async function deleteActaResponse(id: string) {
    try {
        const session = await getSession()
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin) {
            return { success: false, error: 'Solo el administrador puede eliminar actas' }
        }

        const username = session?.user?.username || 'desconocido'
        const userId = session?.user?.id || null

        const acta = await (prisma as any).actaSupervisionRespuesta.findUnique({ 
            where: { id },
            include: { plantilla: true } 
        })
        if (!acta) return { success: false, error: 'Acta no encontrada' }

        await (prisma as any).actaSupervisionRespuesta.delete({ where: { id } })

        await logAuditAction({
            username,
            userId,
            action: 'ELIMINAR_ACTA',
            modulo: 'ACTAS -> GENERAR ACTA',
            detalle: `Se eliminó el acta (ID: ${id}) de la plantilla "${acta.plantilla?.nombre || 'Desconocida'}"`
        })

        revalidatePath('/dashboard/actas/generar-acta')
        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar acta:', error)
        return { success: false, error: error.message || 'Error al eliminar acta' }
    }
}

export async function sendActaPdfEmail(data: {
    to: string
    cc?: string
    colegioNombre: string
    mesAno: string
    fechaRealizada: string
    pdfBase64: string
}) {
    try {
        const session = await getSession()
        if (!session || !session.user) return { success: false, error: 'No autenticado' }

        if (!data.to || !data.to.trim()) {
            return { success: false, error: 'Debes ingresar un correo de destino válido' }
        }

        const formatEmails = (rawEmails?: string) => {
            if (!rawEmails) return undefined
            const cleanList = rawEmails
                .split(/[;,]/)
                .map(e => e.trim())
                .filter(e => e.length > 0)
            return cleanList.length > 0 ? cleanList.join(', ') : undefined
        }

        const formattedTo = formatEmails(data.to)
        const formattedCc = formatEmails(data.cc)

        if (!formattedTo) {
            return { success: false, error: 'Debes ingresar al menos un correo de destino válido' }
        }

        const emailConfig = await prisma.emailConfig.findFirst({
            where: { id: 'global' }
        })

        if (!emailConfig || !emailConfig.email) {
            return { success: false, error: 'No hay configuración de correo SMTP registrada en el sistema.' }
        }

        const pass = decrypt(emailConfig.password)

        const transport = nodemailer.createTransport({
            host: emailConfig.provider === 'office365' || !emailConfig.provider ? 'smtp.office365.com' : 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: emailConfig.email,
                pass: pass
            },
            tls: {
                rejectUnauthorized: false
            }
        })

        const subject = `Envio de Acta, colegio ${data.colegioNombre} del mes ${data.mesAno}`
        const textBody = `Se adjunta acta realizada ${data.fechaRealizada} al colegio ${data.colegioNombre}\n\nAtte.\nSistema de gestion Hendaya`

        const cleanBase64 = data.pdfBase64.includes(',') ? data.pdfBase64.split(',')[1] : data.pdfBase64

        await transport.sendMail({
            from: emailConfig.email,
            to: formattedTo,
            cc: formattedCc,
            subject: subject,
            text: textBody,
            attachments: [
                {
                    filename: `Acta_Supervision_${data.colegioNombre.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
                    content: cleanBase64,
                    encoding: 'base64'
                }
            ]
        })

        await logAuditAction({
            username: session.user.username || 'desconocido',
            userId: session.user.id || null,
            action: 'ENVIAR_CORREO_ACTA',
            modulo: 'ACTAS -> GENERAR ACTA',
            detalle: `Se envió el PDF del acta a ${formattedTo}${formattedCc ? ` (CC: ${formattedCc})` : ''} (Colegio: ${data.colegioNombre})`
        })

        return { success: true }
    } catch (error: any) {
        console.error('Error al enviar correo de acta:', error)
        let msg = error.message || 'Error al enviar correo'
        if (msg.includes('535 5.7.139') || msg.includes('535 5.7.3')) {
            msg = 'Autenticación SMTP fallida (535 5.7.139). Por favor verifica el usuario y la contraseña guardados en "Configuración -> Correo", o confirma que SMTP AUTH esté activado en Microsoft 365.'
        }
        return { success: false, error: msg }
    }
}
