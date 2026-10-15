import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { prisma, rawPrisma } from './prisma'
import { ensureNotificationConditionalColumns } from './notifications-db-init'
import { resolveListaDestinatarios, resolveSucursalFromRbd } from './distribution-lists'

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
        console.error("Error decrypting SMTP password:", e)
        return text 
    }
}

export async function sendFormNotification(form: any, data: any, username: string) {
    try {
        const codigoPantalla = `formulario-${form.id}`
        const configs = await prisma.notificacionPantalla.findMany({
            where: { codigoPantalla, activa: true },
            include: { listaCorreo: true }
        })

        if (configs.length === 0) return { warning: 'No hay listas configuradas.' }

        const emailConfig = await prisma.emailConfig.findUnique({ where: { id: 'global' } })
        if (!emailConfig) return { warning: 'Configuración global no encontrada.' }

        const transporter = nodemailer.createTransport({
            host: "smtp.office365.com",
            port: 587,
            secure: false,
            auth: {
                user: emailConfig.email,
                pass: decrypt(emailConfig.password),
            },
            tls: { 
                rejectUnauthorized: false
            }
        })

        const fields = JSON.parse(form.fields)
        let tableRows = ''
        fields.forEach((f: any) => {
            const val = data[f.id]
            const displayVal = Array.isArray(val) ? val.join(', ') : (val || 'N/A')
            tableRows += `<tr><td style="padding:8px; border:1px solid #eee;"><b>${f.label}</b></td><td style="padding:8px; border:1px solid #eee;">${displayVal}</td></tr>`
        })

        for (const config of configs) {
            const para = JSON.parse(config.listaCorreo.para)
            const cc = config.listaCorreo.cc ? JSON.parse(config.listaCorreo.cc) : []

            await transporter.sendMail({
                from: `"Hendaya Forms" <${emailConfig.email}>`,
                to: para.join(','),
                cc: cc.join(','),
                subject: `Nuevo Envío: ${form.title}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px; padding: 20px;">
                        <h2 style="color: #0891b2;">Nuevo formulario completado</h2>
                        <p>Respuesta recibida para: <b>${form.title}</b></p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                        <table style="width: 100%; border-collapse: collapse;">${tableRows}</table>
                        <p style="margin-top: 20px; font-size: 12px; color: #666;">Enviado por: ${username} • ${new Date().toLocaleString()}</p>
                    </div>
                `
            })
        }
        return { success: true }
    } catch (e) {
        console.error("Error sending form notification:", e)
        return { warning: 'Error al enviar correo.' }
    }
}

export async function sendAttachmentEmail({ 
    to, 
    subject, 
    body, 
    attachmentBase64, 
    filename,
    codigoPantalla
}: { 
    to: string, 
    subject: string, 
    body: string, 
    attachmentBase64: string, 
    filename: string,
    codigoPantalla?: string
}) {
    try {
        const emailConfig = await prisma.emailConfig.findUnique({ where: { id: 'global' } })
        if (!emailConfig) return { error: 'Configuración global no encontrada.' }

        const transporter = nodemailer.createTransport({
            host: "smtp.office365.com",
            port: 587,
            secure: false,
            auth: {
                user: emailConfig.email,
                pass: decrypt(emailConfig.password),
            },
            tls: { 
                rejectUnauthorized: false
            }
        })

        // Obtener CC si hay una configuración de notificación para esta pantalla
        let cc: string[] = []
        if (codigoPantalla) {
            const configs = await prisma.notificacionPantalla.findMany({
                where: { codigoPantalla, activa: true },
                include: { listaCorreo: true }
            })
            configs.forEach(c => {
                if (c.listaCorreo.cc) {
                    const ccList = JSON.parse(c.listaCorreo.cc)
                    cc = [...new Set([...cc, ...ccList])]
                }
                // Si el usuario quiere que las listas de la configuración también reciban el "PARA" como CC
                if (c.listaCorreo.para) {
                    const paraList = JSON.parse(c.listaCorreo.para)
                    cc = [...new Set([...cc, ...paraList])]
                }
            })
        }

        const base64Data = attachmentBase64.split(',')[1] || attachmentBase64

        await transporter.sendMail({
            from: `"Hendaya Forms" <${emailConfig.email}>`,
            to,
            cc: cc.length > 0 ? cc.join(',') : undefined,
            subject,
            text: body,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: auto;">
                    <h2 style="color: #0891b2;">Envío de Formulario</h2>
                    <p style="white-space: pre-wrap;">${body}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 11px; color: #999;">Sistema de Gestión de Formularios - Hendaya</p>
                </div>
            `,
            attachments: [
                {
                    filename,
                    content: base64Data,
                    encoding: 'base64'
                }
            ]
        })

        return { success: true }
    } catch (e) {
        console.error("Error sending attachment email:", e)
        return { error: 'Error al enviar correo con adjunto.' }
    }
}

export async function sendGenericaNotification({
    codigoPantalla,
    subject: defaultSubject,
    bodyHtml: defaultBodyHtml,
    tags = {}
}: {
    codigoPantalla: string,
    subject: string,
    bodyHtml: string,
    tags?: Record<string, string>
}) {
    try {
        // Resolver la sucursal objetivo del evento a partir de las etiquetas (tags)
        let targetSucursalName = tags['Sucursal'] || tags['sucursal'] || tags['SUCURSAL'] || tags['SucursalOrigen'] || tags['SucursalDestino'] || ''
        const targetRbd = tags['RBD'] || tags['rbd'] || tags['Rbd'] || tags['RbdOrigen'] || tags['RbdDestino'] || null

        let targetSucursal: { id?: string, nombre: string } | null = null
        if (targetSucursalName) {
            targetSucursal = { nombre: targetSucursalName }
        } else if (targetRbd) {
            targetSucursal = await resolveSucursalFromRbd(targetRbd)
            if (targetSucursal?.nombre) {
                targetSucursalName = targetSucursal.nombre
            }
        }

        const rawConfigs: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT np.id, np."codigoPantalla", np."listaCorreoId", np.activa,
                   np."condicionTag", np."condicionOperador", np."condicionValor",
                   lc.id as "lc_id", lc.nombre as "lc_nombre", lc.para as "lc_para", lc.cc as "lc_cc",
                   lc."sucursalId" as "lc_sucursalId", lc."porSucursal" as "lc_porSucursal",
                   s.nombre as "lc_sucursalNombre"
            FROM "NotificacionPantalla" np
            JOIN "ListaCorreo" lc ON lc.id = np."listaCorreoId"
            LEFT JOIN "Sucursal" s ON s.id = lc."sucursalId"
            WHERE np."codigoPantalla" = $1 AND np.activa = true;
        `, codigoPantalla)

        if (rawConfigs.length === 0) return { warning: 'No hay listas configuradas para esta pantalla.' }

        const cleanStr = (s: string) => 
            s.normalize('NFD')
             .replace(/[\u0300-\u036f]/g, '')
             .replace(/[_\s]+/g, ' ')
             .trim()
             .toUpperCase()

        // Evaluar reglas condicionales universales sobre las etiquetas recibidas
        const configs = rawConfigs.filter(c => {
            const op = (c.condicionOperador || 'ALWAYS').toUpperCase()
            const tagKey = c.condicionTag ? c.condicionTag.replace(/[<>]/g, '').trim().toLowerCase() : ''
            const expectedVal = c.condicionValor ? cleanStr(c.condicionValor) : ''

            // Si la regla está configurada como ALWAYS o no define tag/valor, se envía incondicionalmente
            if (op === 'ALWAYS' || !tagKey || !expectedVal) {
                return true
            }

            // Buscar la etiqueta en los tags de forma insensible a mayúsculas, minúsculas y acentos
            const matchedTag = Object.keys(tags).find(k => k.toLowerCase() === tagKey)
            let actualVal = matchedTag ? cleanStr(String(tags[matchedTag])) : ''

            // Fallback inteligente: si la condición busca <Sucursal> y el tag original no la traía pero se resolvió del RBD
            if (!actualVal && (tagKey === 'sucursal' || tagKey === 'sucursalorigen') && targetSucursalName) {
                actualVal = cleanStr(targetSucursalName)
            }

            if (op === 'EQUALS') {
                return actualVal === expectedVal
            } else if (op === 'CONTAINS') {
                return actualVal.includes(expectedVal)
            } else if (op === 'NOT_EQUALS') {
                return actualVal !== expectedVal
            }
            return true
        })

        if (configs.length === 0) {
            console.log(`[sendGenericaNotification] Pantalla ${codigoPantalla}: ninguna lista cumplió las reglas condicionales`, tags)
            return { warning: 'Ninguna lista activa cumplió las reglas condicionales para este evento.' }
        }

        // Buscar si existe una plantilla personalizada
        const plantilla = await prisma.plantillaCorreo.findUnique({
            where: { codigoPantalla }
        })

        let finalSubject = defaultSubject
        let finalBody = defaultBodyHtml

        if (plantilla) {
            finalSubject = plantilla.asunto
            finalBody = plantilla.cuerpo

            // Reemplazar tags en la plantilla personalizada
            Object.entries(tags).forEach(([key, value]) => {
                const regex = new RegExp(`<${key}>`, 'gi')
                finalSubject = finalSubject.replace(regex, value)
                const valueWithBr = value.replace(/\n/g, '<br/>')
                finalBody = finalBody.replace(regex, valueWithBr)
            })

            // Inyectar sucursal resuelta si la plantilla la usa y no venía en los tags iniciales
            if (targetSucursalName && !tags['Sucursal']) {
                finalSubject = finalSubject.replace(/<Sucursal>/gi, targetSucursalName)
                finalBody = finalBody.replace(/<Sucursal>/gi, targetSucursalName)
            }
            
            // Convertir saltos de línea del cuerpo de la plantilla a <br/>
            finalBody = finalBody.replace(/\n/g, '<br/>')

            if (!finalBody.includes('<div') && !finalBody.includes('<p')) {
                finalBody = `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: auto;">
                        <h2 style="color: #0891b2;">Notificación de Sistema</h2>
                        <div style="font-size: 14px; line-height: 1.6; color: #334155;">${finalBody}</div>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                        <p style="font-size: 11px; color: #94a3b8;">Mensaje automático enviado por Aplicaciones Hendaya</p>
                    </div>
                `
            }
        }

        const emailConfig = await prisma.emailConfig.findUnique({ where: { id: 'global' } })
        if (!emailConfig) return { warning: 'Configuración global no encontrada.' }

        const transporter = nodemailer.createTransport({
            host: "smtp.office365.com",
            port: 587,
            secure: false,
            auth: {
                user: emailConfig.email,
                pass: decrypt(emailConfig.password),
            },
            tls: { 
                rejectUnauthorized: false
            }
        })

        let sentAny = false
        for (const config of configs) {
            const resolved = resolveListaDestinatarios({
                id: config.lc_id,
                nombre: config.lc_nombre,
                para: config.lc_para,
                cc: config.lc_cc,
                sucursalId: config.lc_sucursalId,
                sucursal: config.lc_sucursalNombre ? { id: config.lc_sucursalId, nombre: config.lc_sucursalNombre } : null,
                porSucursal: config.lc_porSucursal
            }, targetSucursal)

            if (resolved.to.length === 0) {
                console.log(`[sendGenericaNotification] Lista "${config.lc_nombre}" no arrojó destinatarios para la sucursal "${targetSucursalName || 'Global'}".`)
                continue
            }

            await transporter.sendMail({
                from: `"Hendaya Alertas" <${emailConfig.email}>`,
                to: resolved.to.join(','),
                cc: resolved.cc.length > 0 ? resolved.cc.join(',') : undefined,
                subject: finalSubject,
                html: finalBody
            })
            sentAny = true
        }
        return { success: true }
    } catch (e) {
        console.error("Error sending generic notification:", e)
        return { warning: 'Error al enviar correo.' }
    }
}
