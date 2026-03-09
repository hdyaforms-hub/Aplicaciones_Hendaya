import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession, decrypt } from '@/lib/session'

export async function middleware(request: NextRequest) {
    // Update token expiration on every request
    const response = await updateSession(request)

    const sessionCookie = request.cookies.get('session')?.value
    const pathname = request.nextUrl.pathname

    // Protected routes condition
    const isProtectedRoute = pathname.startsWith('/dashboard')
    const isAuthRoute = pathname === '/login'

    if (isProtectedRoute) {
        if (!sessionCookie) {
            return NextResponse.redirect(new URL('/login', request.url))
        }

        const session = await decrypt(sessionCookie)
        if (!session) {
            return NextResponse.redirect(new URL('/login', request.url))
        }
    }

    if (isAuthRoute) {
        if (sessionCookie) {
            const session = await decrypt(sessionCookie)
            if (session) {
                return NextResponse.redirect(new URL('/dashboard', request.url))
            }
        }
    }

    return response || NextResponse.next()
}

// Configuración para que el middleware solo se ejecute en rutas relevantes
export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
