import { PrismaClient } from '@prisma/client'
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

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

async function main() {
  console.log('--- Testing SMTP Connection ---')
  const emailConfig = await prisma.emailConfig.findFirst({ where: { id: "global" } })
  if (!emailConfig) {
    console.log('Email Config (global): NOT FOUND')
    return;
  }
  
  const decryptedPassword = decrypt(emailConfig.password)
  console.log('User:', emailConfig.email);
  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: emailConfig.email,
      pass: decryptedPassword
    }
  })

  try {
    console.log('Verifying connection...');
    await transporter.verify()
    console.log('SMTP Connection: SUCCESS')
    
    console.log('Sending test email...');
    const result = await transporter.sendMail({
        from: emailConfig.email,
        to: emailConfig.email,
        subject: "Test Email from Diagnostic Script",
        text: "This is a test email to verify SMTP functionality."
    });
    console.log('Test email messageId:', result.messageId);

  } catch (err: any) {
    console.error('SMTP Connection or Send: FAILED', err.message)
    console.log('Details:', err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
