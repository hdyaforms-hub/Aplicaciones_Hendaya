import { NextResponse } from 'next/server'

export async function POST() {
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
