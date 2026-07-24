import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { encrypt } from '@/lib/session'

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

        if (!user.isActive) {
            console.log(`Usuario inactivo: ${username}`)
            return NextResponse.json(
                { message: 'El usuario no está vigente. Debe comunicarse con el administrador.' },
                { status: 403 }
            )
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash)

        if (!passwordMatch) {
            console.log(`Password incorrecto para usuario: ${username}`)
            return NextResponse.json(
                { message: 'Credenciales inválidas' },
                { status: 401 }
            )
        }

        let permissions: string[] = []
        try {
            permissions = JSON.parse(user.role.permissions)
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

        // Crear el token JWT directamente sin depender de next/headers
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
        const sessionToken = await encrypt({ user: sessionData, expires })

        console.log(`Login exitoso para: ${username}`)

        const response = NextResponse.json(
            { message: 'Login exitoso', user: sessionData },
            { status: 200 }
        )

        // Adjuntar la cookie directamente a la respuesta HTTP
        const isSecure = process.env.COOKIE_SECURE === 'true'
        response.cookies.set('session', sessionToken, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            path: '/',
            maxAge: 24 * 60 * 60,
        })

        return response

    } catch (error: any) {
        console.error('CRITICAL: Login error:', error.message)
        return NextResponse.json(
            { message: 'Ocurrió un error en el servidor: ' + error.message },
            { status: 500 }
        )
    }
}
