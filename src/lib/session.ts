import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const secretKey = process.env.SESSION_SECRET || 'super-secret-key-change-me'
const key = new TextEncoder().encode(secretKey)

const isSecure = process.env.COOKIE_SECURE === 'true'

export async function encrypt(payload: any) {
    console.log(`Encrypting payload...`)
    const res = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1 day from now')
        .sign(key)
    console.log(`Payload encrypted.`)
    return res
}

export async function decrypt(input: string): Promise<any> {
    console.log(`Decrypting token...`)
    try {
        const { payload } = await jwtVerify(input, key, {
            algorithms: ['HS256'],
        })
        console.log(`Token decrypted.`)
        return payload
    } catch (error) {
        console.log(`Token decryption failed.`)
        return null
    }
}

export async function login(user: any) {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const session = await encrypt({ user, expires })

    const cookieStore = await cookies()
    cookieStore.set('session', session, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60,
    })
    return session
}

export async function logout() {
    const cookieStore = await cookies()
    cookieStore.set('session', '', {
        expires: new Date(0),
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
    })
}

export async function getSession() {
    const cookieStore = await cookies()
    const session = cookieStore.get('session')?.value
    if (!session) return null
    const parsed = await decrypt(session)
    if (!parsed || !parsed.user) return null

    if (parsed.user.role) {
        const isAdmin = parsed.user.role.name === 'Administrador' || parsed.user.role.name === 'admin'
        let perms: string[] = []
        if (Array.isArray(parsed.user.role.permissions)) {
            perms = parsed.user.role.permissions
        } else if (typeof parsed.user.role.permissions === 'string') {
            try {
                perms = JSON.parse(parsed.user.role.permissions)
            } catch {
                perms = parsed.user.role.permissions.split(',').map((p: string) => p.trim()).filter(Boolean)
            }
        }

        if (isAdmin) {
            const adminBasePerms = [
                'manage_users',
                'manage_roles',
                'manage_correo',
                'manage_listas',
                'manage_notificaciones',
                'manage_global_config',
                'manage_menu_reorder',
                'view_dashboard_home',
                'view_tablero',
                'view_tablero_pan',
                'view_tablero_gas',
                'view_tablero_retiro',
                'view_tablero_elementos',
                'view_tablero_multas_ee',
                'view_tablero_organigrama',
                'view_tablero_distancias',
                'view_tablero_actas',
                'view_tablero_verificador_temperaturas',
                'view_tablero_widgets',
                'view_tablero_auditoria',
                'view_areas',
                'view_operaciones',
                'view_calidad',
                'view_manipuladoras',
                'view_multas_areas',
                'logistica:tablero:ver',
                'logistica:tablero:gestionar',
                'logistica:rutas:ver',
                'logistica:rutas:crear',
                'logistica:rutas:editar',
                'logistica:rutas:cancelar',
                'logistica:rutas:forzar_estado',
                'logistica:chofer:notificar',
                'logistica:porton:marcar',
                'logistica:despacho:completar',
                'logistica:metricas:ver',
                'logistica:rutas:exportar',
                'logistica:config:ver',
                'logistica:config:bodegas',
                'logistica:config:choferes',
                'logistica:config:camiones',
                'logistica:config:transportistas',
                'logistica:config:clientes',
                'logistica:integraciones:ver',
                'view_anonimizador',
                'manage_anonimizador'
            ]
            const permsSet = new Set([...perms, ...adminBasePerms])
            perms = Array.from(permsSet)
        }

        parsed.user.role.permissions = perms
    }

    return parsed
}

export async function updateSession(request: NextRequest) {
    const sessionCookie = request.cookies.get('session')?.value
    if (!sessionCookie) return null

    const parsed = await decrypt(sessionCookie)
    if (!parsed) return null

    // We can still rotate JWT token expiration if needed, but not on the browser cookie
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    parsed.expires = expires

    const res = NextResponse.next()
    res.cookies.set({
        name: 'session',
        value: await encrypt(parsed),
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
    })
    return res
}
