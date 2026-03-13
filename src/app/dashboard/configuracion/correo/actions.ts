'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'

import nodemailer from 'nodemailer'

const ENCRYPTION_KEY = crypto.createHash('sha256').update(String(process.env.SESSION_SECRET || 'super-secret-key-change-me')).digest('base64').substring(0, 32)
const IV_LENGTH = 16

export async function testSmtpConnection(email: string, password?: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_correo')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        let smtpPassword = password
        if (!smtpPassword || smtpPassword.trim() === '') {
            const config = await prisma.emailConfig.findUnique({ where: { id: 'global' } })
            if (!config) return { error: 'No hay credenciales guardadas para probar.' }
            smtpPassword = await decrypt(config.password)
        }

        const transporter = nodemailer.createTransport({
            host: "smtp.office365.com",
            port: 587,
            secure: false, // TLS
            auth: {
                user: email,
                pass: smtpPassword
            }
            // Removed SSLv3 to support modern TLS defaults
        })

        await transporter.verify()
        return { success: true }
    } catch (error: any) {
        console.error('SMTP Test Error:', error)
        let msg = error.message || 'Error desconocido al conectar.'
        if (msg.includes('535 5.7.3')) msg = 'Autenticación fallida (535 5.7.3). Verifica el usuario, la contraseña o si SMTP AUTH está habilitado en Microsoft 365.'
        return { error: msg }
    }
}

export async function encrypt(text: string) {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv)
    let encrypted = cipher.update(text)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    return iv.toString('hex') + ':' + encrypted.toString('hex')
}

// In case it's needed elsewhere or for testing
export async function decrypt(text: string) {
    const textParts = text.split(':')
    const iv = Buffer.from(textParts.shift()!, 'hex')
    const encryptedText = Buffer.from(textParts.join(':'), 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
}

export async function saveEmailConfig(email: string, password: string | null) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_correo')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        const updateData: any = {
            email: email,
            updatedBy: session.user.username,
        }

        if (password && password.trim() !== '') {
            updateData.password = await encrypt(password)
        }

        const config = await prisma.emailConfig.findUnique({ where: { id: 'global' } })

        if (!config) {
            if (!password || password.trim() === '') {
                return { error: 'Por favor, ingrese la contraseña para poder configurar el correo por primera vez.' }
            }
            await prisma.emailConfig.create({
                data: {
                    id: 'global',
                    email: email,
                    password: await encrypt(password),
                    updatedBy: session.user.username,
                }
            })
        } else {
            await prisma.emailConfig.update({
                where: { id: 'global' },
                data: updateData
            })
        }

        revalidatePath('/dashboard/configuracion/correo')
        return { success: true }
    } catch (e) {
        console.error('Error in save email config', e)
        return { error: 'No se pudo guardar la configuración de correo.' }
    }
}
