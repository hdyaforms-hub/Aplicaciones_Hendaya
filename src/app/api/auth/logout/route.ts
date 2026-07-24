import { NextResponse } from 'next/server'
import { logout } from '@/lib/session'

export async function POST() {
    await logout()
    const response = NextResponse.json({ message: 'Logout exitoso' }, { status: 200 })
    response.cookies.set('session', '', {
        expires: new Date(0),
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === 'true',
        sameSite: 'lax',
        path: '/',
    })
    return response
}
