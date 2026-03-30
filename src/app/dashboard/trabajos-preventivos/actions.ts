'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import nodemailer from 'nodemailer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

const ENCRYPTION_KEY = crypto.createHash('sha256').update(String(process.env.SESSION_SECRET || 'super-secret-key-change-me')).digest('base64').substring(0, 32)

function decrypt(text: string) {
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

export async function searchColegiosTrabajos(query: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_trabajos_preventivos')) {
        return { error: 'No tienes permisos' }
    }

    if (!query || query.trim().length < 2) return { colegios: [] }

    const isNumeric = !isNaN(Number(query))

    try {
        const colegios = await prisma.colegios.findMany({
            where: {
                OR: [
                    ...(isNumeric ? [{ colRBD: Number(query) }] : []),
                    { nombreEstablecimiento: { contains: query } }
                ]
            },
            take: 10
        })
        return { colegios }
    } catch (e) {
        return { error: 'Error en la búsqueda' }
    }
}

export async function saveTrabajoAction(formData: FormData) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_trabajos_preventivos')) {
        return { error: 'No tienes permisos' }
    }

    try {
        const rbd = parseInt(formData.get('rbd') as string)
        const folioOT = formData.get('folioOT') as string
        const tipoTrabajo = formData.get('tipoTrabajo') as string
        const fechaTrabajo = new Date(formData.get('fechaTrabajo') as string)
        const montoMateriales = formData.get('montoMateriales') ? parseInt(formData.get('montoMateriales') as string) : null
        const montoManoObra = formData.get('montoManoObra') ? parseInt(formData.get('montoManoObra') as string) : null
        const observacion = formData.get('observacion') as string

        // Validations
        if (!rbd || !folioOT || !tipoTrabajo || isNaN(fechaTrabajo.getTime())) {
            return { error: 'Faltan campos obligatorios' }
        }

        // Colegio Info
        const colegio = await prisma.colegios.findFirst({ where: { colRBD: rbd } })
        if (!colegio) return { error: 'Colegio no encontrado' }

        // Get UT for licId
        const utInfo = await prisma.uT.findUnique({ where: { codUT: colegio.colut } })

        // Files Handling
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'trabajos-preventivos')
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

        // 1. Documento Asociado (Required, 1)
        const docFile = formData.get('documentoAsociado') as File
        if (!docFile || docFile.size === 0) return { error: 'El documento asociado es obligatorio' }
        
        const docBuffer = Buffer.from(await docFile.arrayBuffer())
        const docFilename = `${Date.now()}-DOC-${docFile.name.replace(/\s+/g, '_')}`
        fs.writeFileSync(path.join(uploadDir, docFilename), docBuffer)
        const docPath = `/uploads/trabajos-preventivos/${docFilename}`

        // 2. Boletas/Facturas (Optional, Max 5)
        const boletasFiles = formData.getAll('boletasFacturas') as File[]
        const boletasPaths: string[] = []
        
        for (const file of boletasFiles.slice(0, 5)) {
            if (file.size > 0) {
                const buffer = Buffer.from(await file.arrayBuffer())
                const filename = `${Date.now()}-BOL-${file.name.replace(/\s+/g, '_')}`
                fs.writeFileSync(path.join(uploadDir, filename), buffer)
                boletasPaths.push(`/uploads/trabajos-preventivos/${filename}`)
            }
        }

        // Create Record
        const nuevoTrabajo = await prisma.trabajoPreventivo.create({
            data: {
                ut: colegio.colut,
                sucursal: colegio.sucursal,
                licitacion: utInfo?.licId ? String(utInfo.licId) : 'S/I',
                rbd: colegio.colRBD,
                nombreEstablecimiento: colegio.nombreEstablecimiento,
                folioOT,
                tipoTrabajo,
                fechaTrabajo,
                documentoAsociado: docPath,
                boletasFacturas: boletasPaths.length > 0 ? JSON.stringify(boletasPaths) : null,
                montoMateriales,
                montoManoObra,
                observacion: observacion?.substring(0, 500),
                usuario: session.user.name || session.user.username || 'Sistema'
            }
        })

        // Notifications
        let emailWarning: string | undefined;
        try {
            const notif = await processNotificacionesTrabajo(nuevoTrabajo, colegio.sucursal)
            if (notif?.warning) emailWarning = notif.warning
        } catch (e) {
            console.error("Error sending notification:", e)
        }

        revalidatePath('/dashboard/trabajos-preventivos')
        return { success: true, id: nuevoTrabajo.id, emailWarning }

    } catch (e) {
        console.error("Error saving trabajo preventivo:", e)
        return { error: 'Ocurrió un error al guardar el registro' }
    }
}

async function processNotificacionesTrabajo(trabajo: any, sucursalNombre: string) {
    const codigoPantalla = 'trabajo-preventivo'
    try {
        const configs = await prisma.notificacionPantalla.findMany({
            where: { codigoPantalla, activa: true },
            include: { listaCorreo: { include: { sucursal: true } } }
        })

        if (configs.length === 0) return { warning: 'No hay notificaciones activas para este módulo.' }

        const destinos = configs.map(c => c.listaCorreo).filter(lista => {
            if (!lista.sucursalId) return true
            if (sucursalNombre && lista.sucursal?.nombre) {
                return lista.sucursal.nombre.toLowerCase().includes(sucursalNombre.toLowerCase()) || 
                       sucursalNombre.toLowerCase().includes(lista.sucursal.nombre.toLowerCase())
            }
            return false
        })

        if (destinos.length === 0) return { warning: `No hay listas de correo para la sucursal "${sucursalNombre}".` }

        let plantilla = await prisma.plantillaCorreo.findUnique({ where: { codigoPantalla } })
        
        // Ensure default template if not exists
        if (!plantilla) {
            plantilla = await prisma.plantillaCorreo.create({
                data: {
                    codigoPantalla,
                    asunto: "Nuevo Registro de Trabajo: <TipoTrabajo> - RBD <RBD>",
                    cuerpo: `Se ha registrado un nuevo trabajo preventivo/correctivo:
Usuario: <Usuario>
RBD: <RBD>
Colegio: <NombreColegio>
Folio OT: <FolioOT>
Tipo Trabajo: <TipoTrabajo>
Fecha Realizado: <Fecha>
Montos: Mat: <MontoMat> / M.O: <MontoMO>
Observación: <Observacion>

Atte.
Sistema Hendaya.`
                }
            }) as any
        }

        let subject = plantilla?.asunto || ''
        let body = plantilla?.cuerpo || ''

        const replaceTags = (text: string) => {
            return text
                .replace(/<RBD.*?>/gi, String(trabajo.rbd))
                .replace(/<UT.*?>/gi, String(trabajo.ut))
                .replace(/<NombreColegio.*?>/gi, trabajo.nombreEstablecimiento)
                .replace(/<Usuario.*?>/gi, trabajo.usuario)
                .replace(/<FolioOT.*?>/gi, trabajo.folioOT)
                .replace(/<TipoTrabajo.*?>/gi, trabajo.tipoTrabajo)
                .replace(/<Fecha.*?>/gi, trabajo.fechaTrabajo.toLocaleDateString('es-CL'))
                .replace(/<MontoMat.*?>/gi, trabajo.montoMateriales ? `$${trabajo.montoMateriales.toLocaleString()}` : '$0')
                .replace(/<MontoMO.*?>/gi, trabajo.montoManoObra ? `$${trabajo.montoManoObra.toLocaleString()}` : '$0')
                .replace(/<Observacion.*?>/gi, trabajo.observacion || 'Sin observaciones')
        }

        subject = replaceTags(subject)
        body = replaceTags(body)

        let to: string[] = []
        let cc: string[] = []

        destinos.forEach(lista => {
            try {
                const p = JSON.parse(lista.para || '[]')
                const c = JSON.parse(lista.cc || '[]')
                if (Array.isArray(p)) to.push(...p)
                if (Array.isArray(c)) cc.push(...c)
            } catch (e) {}
        })

        to = Array.from(new Set(to)).filter(e => e.includes('@'))
        cc = Array.from(new Set(cc)).filter(e => e.includes('@'))

        if (to.length > 0) {
            const emailConfig = await prisma.emailConfig.findFirst({ where: { id: "global" } })
            if (!emailConfig) return

            const transport = nodemailer.createTransport({
                host: "smtp.office365.com",
                port: 587,
                secure: false,
                auth: { user: emailConfig.email, pass: decrypt(emailConfig.password) }
            })

            await transport.sendMail({
                from: emailConfig.email,
                to,
                cc,
                subject,
                text: body
            })
        }
    } catch (e) {
        console.error("Notif Error:", e)
    }
}
