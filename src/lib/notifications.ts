import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { prisma } from './prisma'

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
        const configs = await prisma.notificacionPantalla.findMany({
            where: { codigoPantalla, activa: true },
            include: { listaCorreo: true }
        })

        if (configs.length === 0) return { warning: 'No hay listas configuradas para esta pantalla.' }

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
                // Para el cuerpo, si el valor tiene saltos de línea, los convertimos a BR
                const valueWithBr = value.replace(/\n/g, '<br/>')
                finalBody = finalBody.replace(regex, valueWithBr)
            })
            
            // Convertir saltos de línea del cuerpo de la plantilla a <br/>
            finalBody = finalBody.replace(/\n/g, '<br/>')

            // Si es plantilla personalizada, convertimos el cuerpo a un mini-HTML si no tiene etiquetas envolventes
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

        for (const config of configs) {
            const para = JSON.parse(config.listaCorreo.para)
            const cc = config.listaCorreo.cc ? JSON.parse(config.listaCorreo.cc) : []

            await transporter.sendMail({
                from: `"Hendaya Alertas" <${emailConfig.email}>`,
                to: para.join(','),
                cc: cc.join(','),
                subject: finalSubject,
                html: finalBody
            })
        }
        return { success: true }
    } catch (e) {
        console.error("Error sending generic notification:", e)
        return { warning: 'Error al enviar correo.' }
    }
}
