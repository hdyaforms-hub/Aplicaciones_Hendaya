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
        const sessionData = {
            id: user.id,
            username: user.username,
            name: user.name,
            role: {
                name: user.role.name,
                permissions: JSON.parse(user.role.permissions),
            },
            sucursales: user.sucursales.map((s: any) => s.nombre),
        }

        console.log(`Creando sesión...`)
        await login(sessionData)

        console.log(`Login exitoso para: ${username}`)
        return NextResponse.json(
            { message: 'Login exitoso', user: sessionData },
            { status: 200 }
        )
    } catch (error: any) {
        console.error('CRITICAL: Login error stack trace:', error.stack || error)
        return NextResponse.json(
            { message: 'Ocurrió un error en el servidor' },
            { status: 500 }
        )
    }
}
