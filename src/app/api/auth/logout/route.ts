import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'

export async function POST() {
    try {
        const session = await getSession()
        if (session?.user?.username) {
            await logAuditAction({
                username: session.user.username,
                userId: session.user.id,
                action: 'CIERRE_SESION',
                modulo: 'Autenticación',
                detalle: `Cierre de sesión del usuario (${session.user.name || session.user.username})`,
            })
        }
    } catch (e) {
        console.error('Error al registrar cierre de sesión en auditoría:', e)
    }

    const isSecure = process.env.COOKIE_SECURE === 'true'
    const response = NextResponse.json({ message: 'Logout exitoso' }, { status: 200 })
    response.cookies.set('session', '', {
        expires: new Date(0),
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
    })
    return response
}
