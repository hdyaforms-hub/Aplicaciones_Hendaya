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
            tls: { ciphers: 'SSLv3' }
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
