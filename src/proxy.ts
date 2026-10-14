import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/session'

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

    // 2. Obtener la sesión de las cookies
    const session = req.cookies.get('session')?.value

    // 3. Descifrar la sesión
    const decodedSession = session ? await decrypt(session) : null

    console.log(`[PROXY] Path: ${path} | Cookie present: ${!!session} | Decoded: ${!!decodedSession}`)

    // 4. Redirigir a login si no hay sesión y no es una ruta pública
    const isPublicRoute = publicRoutes.includes(path)
    
    if (!decodedSession && !isPublicRoute && path.startsWith('/dashboard')) {
        console.log(`[PROXY] -> Redirecting to /login (unauthenticated access to ${path})`)
        const response = NextResponse.redirect(new URL('/login', req.nextUrl))
        // Limpiar automáticamente la cookie residual expirada o corrupta para no acumular basura
        if (session) {
            response.cookies.delete('session')
        }
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
        return response
    }

    // 5. Manejo en la pantalla de login:
    if (path === '/login') {
        const hasLogoutReason = req.nextUrl.searchParams.has('reason') || req.nextUrl.searchParams.has('logout')
        
        // Si viene por timeout o logout, o la cookie es inválida, limpiarla de inmediato
        if (hasLogoutReason || (!decodedSession && session)) {
            const response = NextResponse.next()
            response.cookies.delete('session')
            response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
            return response
        }

        // Si ya hay una sesión válida y no es logout forzado, ir a dashboard
        if (decodedSession && !hasLogoutReason) {
            console.log(`[PROXY] -> Redirecting to /dashboard (authenticated access to /login)`)
            const response = NextResponse.redirect(new URL('/dashboard', req.nextUrl))
            response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
            return response
        }
    }

    const response = NextResponse.next()
    if (path.startsWith('/dashboard') || path === '/login') {
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
    }
    return response
}

// Configurar en qué rutas se ejecutará el proxy
export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
