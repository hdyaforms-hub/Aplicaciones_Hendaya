import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt, updateSession } from '@/lib/session'

// Rutas que no requieren autenticación
const publicRoutes = ['/login', '/api/auth/login']

export async function proxy(req: NextRequest) {
    const path = req.nextUrl.pathname

    // 1. Si es una ruta de archivos estáticos o API interna de Next.js, no hacemos nada
    if (
        path.startsWith('/_next') ||
        path.startsWith('/api/auth') ||
        path.includes('.') ||
        path === '/favicon.ico'
    ) {
        return NextResponse.next()
    }

    // 2. Actualizar la expiración de la sesión en cada request (rotación de cookie)
    const sessionUpdateResponse = await updateSession(req)

    // 3. Obtener la sesión de las cookies
    const session = req.cookies.get('session')?.value

    // 4. Descifrar la sesión
    const decodedSession = session ? await decrypt(session) : null

    // 5. Redirigir a login si no hay sesión y no es una ruta pública
    const isPublicRoute = publicRoutes.includes(path)
    
    if (!decodedSession && !isPublicRoute && path.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/login', req.nextUrl))
    }

    // 6. Redirigir a dashboard si ya hay sesión e intenta ir a login
    if (decodedSession && path === '/login') {
        return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
    }

    return sessionUpdateResponse || NextResponse.next()
}

// Configurar en qué rutas se ejecutará el proxy
export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
