import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sendAttachmentEmail } from '@/lib/notifications'

export async function POST(request: Request) {
    const session = await getSession()
    if (!session || !session.user) {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { to, subject, body: emailBody, pdfBase64, filename } = body

        if (!to || !subject || !emailBody || !pdfBase64 || !filename) {
            return NextResponse.json({ success: false, error: 'Faltan datos requeridos.' }, { status: 400 })
        }

        const res = await sendAttachmentEmail({
            to,
            subject,
            body: emailBody,
            attachmentBase64: pdfBase64,
            filename
        })

        if (res.success) {
            return NextResponse.json({ success: true })
        } else {
            return NextResponse.json({ success: false, error: res.error || 'Error al enviar el correo con adjunto.' }, { status: 500 })
        }
    } catch (error) {
        console.error('Error enviando carta sostenedor:', error)
        return NextResponse.json({ success: false, error: 'Error interno del servidor.' }, { status: 500 })
    }
}
