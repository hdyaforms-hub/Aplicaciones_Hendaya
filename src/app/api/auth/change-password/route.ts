import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { login } from '@/lib/session'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { username, currentPassword, newPassword } = body

        if (!username || !currentPassword || !newPassword) {
            return NextResponse.json(
                { message: 'Faltan credenciales' },
                { status: 400 }
            )
        }

        const user = await prisma.user.findUnique({
            where: { username },
            include: { role: true, sucursales: true },
        })

        if (!user || !user.isActive) {
            return NextResponse.json(
                { message: 'Credenciales inválidas o usuario inactivo' },
                { status: 401 }
            )
        }

        const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash)

        if (!passwordMatch) {
            return NextResponse.json(
                { message: 'Credenciales inválidas' },
                { status: 401 }
            )
        }

        if (!user.mustChangePassword) {
            return NextResponse.json(
                { message: 'No es necesario cambiar la contraseña' },
                { status: 400 }
            )
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10)

        // Update user
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: newPasswordHash,
                mustChangePassword: false,
            }
        })

        // Login the user
        let permissions = []
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
        }

        await login(sessionData)

        return NextResponse.json(
            { message: 'Contraseña actualizada y sesión iniciada' },
            { status: 200 }
        )

    } catch (error: any) {
        console.error('Change password error:', error)
        return NextResponse.json(
            { message: 'Ocurrió un error en el servidor: ' + error.message },
            { status: 500 }
        )
    }
}
