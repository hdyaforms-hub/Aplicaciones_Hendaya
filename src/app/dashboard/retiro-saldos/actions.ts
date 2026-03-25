
'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

/**
 * Gets the next sequential folio in format 0000000001
 */
export async function getNextRetiroFolio() {
    try {
        const lastRecord = await prisma.retiroSaldoHeader.findFirst({
            orderBy: { folio: 'desc' },
            select: { folio: true }
        })

        if (!lastRecord) return '0000000001'

        const lastNumber = parseInt(lastRecord.folio, 10)
        const nextNumber = lastNumber + 1
        return nextNumber.toString().padStart(10, '0')
    } catch (e) {
        console.error("Error in getNextRetiroFolio:", e)
        return '0000000001'
    }
}

/**
 * Searches for products based on type (Retiro vs Rebaja)
 */
export async function searchProductosRetiro(query: string, tipoOperacion: string) {
    const tipoNum = tipoOperacion === 'Rebaja de Stock' ? 2 : 1
    
    return await prisma.productos.findMany({
        where: {
            tipoProducto: tipoNum,
            OR: [
                { nombre: { contains: query } },
                { codigo: { contains: query } }
            ]
        },
        take: 10
    })
}

import nodemailer from 'nodemailer'
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

/**
 * Saves the header and its multiple details in a single transaction
 */
export async function saveRetiroSaldo(data: {
    tipoOperacion: string
    rbd: number
    nombreEstablecimiento: string
    ut: number
    sucursal: string
    nombreAutoriza: string
    rutAutoriza: string
    firmaBase64: string
    productos: {
        codigo: string
        nombre: string
        cantidad: number
    }[]
}) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_retiro_saldos')) {
        return { error: 'No tienes permisos para esta operación' }
    }

    if (data.productos.length === 0) {
        return { error: 'Debe agregar al menos un producto' }
    }

    console.log('DEBUG: saveRetiroSaldo input data:', JSON.stringify(data, (k, v) => k === 'firmaBase64' ? v.substring(0, 50) + '...' : v))

    try {
        const nextFolio = await getNextRetiroFolio()
        const supervisor = session.user.name || session.user.username || 'Sistema'

        console.log('DEBUG: Saving with folio:', nextFolio)

        // Obtener la licitación actual de la UT
        const utInfo = await prisma.uT.findUnique({ where: { codUT: Number(data.ut) } })

        const result = await prisma.$transaction(async (tx) => {
            // Create header and details
            const header = await tx.retiroSaldoHeader.create({
                data: {
                    folio: nextFolio,
                    tipoOperacion: data.tipoOperacion,
                    rbd: Number(data.rbd),
                    nombreEstablecimiento: data.nombreEstablecimiento,
                    ut: Number(data.ut),
                    licId: utInfo?.licId,
                    sucursal: data.sucursal,
                    supervisor: supervisor,
                    nombreAutoriza: data.nombreAutoriza,
                    rutAutoriza: data.rutAutoriza,
                    firmaBase64: data.firmaBase64,
                    detalles: {
                        create: data.productos.map(p => ({
                            codigoProducto: p.codigo,
                            nombreProducto: p.nombre,
                            cantidad: Number(p.cantidad)
                        }))
                    }
                },
                include: { detalles: true }
            })
            return header
        })

        console.log('DEBUG: Transaction successful, folio:', result.folio)

        // -- NOTIFICACIONES --
        let emailWarning: string | undefined;
        try {
            const notif = await processRetiroNotificaciones(result, session?.user?.name || session?.user?.username || 'Usuario')
            if (notif?.warning) emailWarning = notif.warning;
        } catch (notifErr) {
            console.error("Error al procesar notificaciones de retiro:", notifErr)
        }
        // -- FIN NOTIFICACIONES --
        
        revalidatePath('/dashboard/retiro-saldos')
        return { success: true, folio: result.folio, emailWarning }
    } catch (error: any) {
        console.error('Error saving retiro saldo (full details):', error)
        return { error: `Error al procesar la solicitud: ${error?.message || 'Error desconocido'}` }
    }
}

async function processRetiroNotificaciones(retiro: any, nombreUsuario: string) {
    try {
        // Consultar configuración para la pantalla 'retiro-saldos'
        const configs = await prisma.notificacionPantalla.findMany({
            where: { 
                codigoPantalla: 'retiro-saldos',
                activa: true 
            },
            include: {
                listaCorreo: {
                    include: { sucursal: true }
                }
            }
        })

        if (configs.length === 0) return { warning: 'No hay notificaciones activas configuradas en el sistema para esta acción.' }

        const destinos = configs
            .map(c => c.listaCorreo)
            .filter(lista => !lista.sucursalId || lista.sucursal?.nombre === retiro.sucursal)

        if (destinos.length === 0) return { warning: `No hay listas de correo asignadas para la sucursal "${retiro.sucursal || 'Global'}".` }

        const plantilla = await prisma.plantillaCorreo.findUnique({
            where: { codigoPantalla: 'retiro-saldos' }
        })

        let correosTo: string[] = []
        let correosCc: string[] = []

        destinos.forEach(lista => {
            try {
                const para = JSON.parse(lista.para || '[]')
                const cc = JSON.parse(lista.cc || '[]')
                if (Array.isArray(para)) correosTo.push(...para)
                if (Array.isArray(cc)) correosCc.push(...cc)
            } catch (e) {
                console.error("Error parseando correos de lista:", lista.nombre)
            }
        })

        correosTo = Array.from(new Set(correosTo))
        correosCc = Array.from(new Set(correosCc))

        let subject = plantilla?.asunto || `Retiro de Saldo Folio <Folio> - RBD <RBD>`
        let body = plantilla?.cuerpo || `Se informa de un nuevo registro:
Folio: <Folio>
Tipo: <Tipo>
RBD: <RBD> - <Establecimiento>
UT: <UT>
Sucursal: <Sucursal>
Supervisor: <Supervisor>
Autorizado por: <NombreAutoriza> (RUT: <RUTAutoriza>)

Productos:
<DetalleProductos>

Atte.
Sistema de Inventario.`

        const detalleStr = retiro.detalles.map((d: any) => `- [${d.codigoProducto}] ${d.nombreProducto}: ${d.cantidad}`).join('\n')

        const replaceTags = (text: string) => {
            return text
                .replace(/<Folio.*?>/gi, retiro.folio)
                .replace(/<Tipo.*?>/gi, retiro.tipoOperacion)
                .replace(/<RBD.*?>/gi, String(retiro.rbd))
                .replace(/<Establecimiento.*?>/gi, retiro.nombreEstablecimiento)
                .replace(/<UT.*?>/gi, String(retiro.ut))
                .replace(/<Sucursal.*?>/gi, retiro.sucursal)
                .replace(/<Supervisor.*?>/gi, retiro.supervisor)
                .replace(/<NombreAutoriza.*?>/gi, retiro.nombreAutoriza || 'N/A')
                .replace(/<Usuario.*?>/gi, nombreUsuario)
                .replace(/<RUTAutoriza.*?>/gi, retiro.rutAutoriza || 'N/A')
                .replace(/<DetalleProductos.*?>/gi, detalleStr)
        }

        subject = replaceTags(subject)
        body = replaceTags(body)

        if (correosTo.length > 0) {
            const emailConfig = await prisma.emailConfig.findFirst({ where: { id: "global" } })
            if (!emailConfig) return

            const transport = nodemailer.createTransport({
                host: "smtp.office365.com",
                port: 587,
                secure: false,
                auth: {
                    user: emailConfig.email,
                    pass: decrypt(emailConfig.password)
                }
            })

            await transport.sendMail({
                from: emailConfig.email,
                to: correosTo,
                cc: correosCc,
                subject: subject,
                text: body
            })
        } else {
            return { warning: `Las listas de correo encontradas para la sucursal "${retiro.sucursal || 'Global'}" no tienen direcciones válidas configuradas.` }
        }
    } catch (e) {
        console.error("Error al procesar el envío de notificaciones retiro:", e)
    }
}
