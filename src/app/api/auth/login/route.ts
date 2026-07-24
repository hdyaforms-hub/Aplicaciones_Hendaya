import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { login } from '@/lib/session'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { username, password } = body

        if (!username || !password) {
            return NextResponse.json(
                { message: 'Faltan credenciales' },
                { status: 400 }
            )
        }

        console.log(`CWD: ${process.cwd()}`)
        console.log(`Intentando login para usuario: ${username}`)

        const user = await prisma.user.findUnique({
            where: { username },
            include: { role: true, sucursales: true },
        })

        if (!user) {
            console.log(`Usuario no encontrado: ${username}`)
            return NextResponse.json(
                { message: 'Credenciales inválidas' },
                { status: 401 }
            )
        }

        console.log(`Usuario encontrado. Verificando estado activo...`)
        if (!user.isActive) {
            console.log(`Usuario inactivo: ${username}`)
            return NextResponse.json(
                { message: 'El usuario no está vigente. Debe comunicarse con el administrador.' },
                { status: 403 }
            )
        }

        console.log(`Verificando password...`)
        const passwordMatch = await bcrypt.compare(password, user.passwordHash)

        if (!passwordMatch) {
            console.log(`Password incorrecto para usuario: ${username}`)
            return NextResponse.json(
                { message: 'Credenciales inválidas' },
                { status: 401 }
            )
        }

        console.log(`Password correcto. Armando session data...`)
        let permissions = []
        try {
            permissions = JSON.parse(user.role.permissions)
            console.log(`Permissions parsed: ${permissions.length} items`)
        } catch (e) {
            console.error(`Error parsing permissions:`, e)
        }

        const sessionData = {
            id: user.id,
            username: user.username,
            name: user.name,
            role: {
                name: user.role.name,
                permissions: permissions,
            },
            sucursales: user.sucursales?.map((s: any) => s.nombre) || [],
            rbds: user.rbds || [],
        }

        if (user.mustChangePassword) {
            console.log(`Usuario debe cambiar contraseña: ${username}`)
            return NextResponse.json(
                { message: 'Debe cambiar su contraseña por seguridad', mustChangePassword: true, tempUser: user.username },
                { status: 202 }
            )
        }

        console.log(`Creando sesión...`)
        let sessionToken = ''
        try {
            const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
            sessionToken = await encrypt({ user: sessionData, expires })
            await login(sessionData)
            console.log(`Sesión creada exitosamente`)
        } catch (e) {
            console.error(`Error en await login(sessionData):`, e)
            throw e
        }

        console.log(`Login exitoso para: ${username}`)
        const response = NextResponse.json(
            { message: 'Login exitoso', user: sessionData },
            { status: 200 }
        )
        response.cookies.set('session', sessionToken, {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === 'true',
            sameSite: 'lax',
            path: '/',
            maxAge: 24 * 60 * 60,
        })
        return response
    } catch (error: any) {
        console.error('CRITICAL: Login error stack trace:', error.stack || error)
        return NextResponse.json(
            { message: 'Ocurrió un error en el servidor: ' + error.message },
            { status: 500 }
        )
    }
}
