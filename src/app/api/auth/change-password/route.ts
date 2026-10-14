import { NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { encrypt } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { username, currentPassword, newPassword, userId } = body

        if ((!username && !userId) || !currentPassword || !newPassword) {
            return NextResponse.json(
                { message: 'Faltan credenciales requeridas' },
                { status: 400 }
            )
        }

        const cleanUsername = (username || '').trim()

        let user: any = null

        // 1. Si viene userId directo
        if (userId) {
            user = await rawPrisma.user.findUnique({
                where: { id: userId },
                include: { role: true, sucursales: true },
            })
        }

        const prefix = cleanUsername.includes('@') ? cleanUsername.split('@')[0] : ''

        // 2. Si no, buscar por username, email o prefijo del correo
        if (!user && cleanUsername) {
            const whereConditions: any[] = [
                { username: { equals: cleanUsername, mode: 'insensitive' } },
                { email: { equals: cleanUsername, mode: 'insensitive' } }
            ]
            if (prefix) {
                whereConditions.push({ username: { equals: prefix, mode: 'insensitive' } })
            }

            user = await rawPrisma.user.findFirst({
                where: { OR: whereConditions },
                include: { role: true, sucursales: true },
            })
        }

        // 3. Normalizar tildes y 'ñ' / 'n' (tolerar caracteres especiales y formato correo)
        if (!user && cleanUsername) {
            const norm = (s: string | null | undefined) => (s || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/ñ/g, 'n')
                .trim()

            const cleanNorm = norm(cleanUsername)
            const prefixNorm = prefix ? norm(prefix) : ''

            const allUsers = await rawPrisma.user.findMany({
                where: { isDeleted: false },
                include: { role: true, sucursales: true }
            })

            user = allUsers.find(u => {
                const uUserNorm = norm(u.username)
                const uEmailNorm = norm(u.email)
                const uEmailPrefixNorm = u.email && u.email.includes('@') ? norm(u.email.split('@')[0]) : ''

                return uUserNorm === cleanNorm ||
                       uEmailNorm === cleanNorm ||
                       (prefixNorm && uUserNorm === prefixNorm) ||
                       (prefixNorm && uEmailPrefixNorm === prefixNorm)
            }) || null
        }

        if (!user || !user.isActive) {
            return NextResponse.json(
                { message: 'Credenciales inválidas o usuario inactivo' },
                { status: 401 }
            )
        }

        const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash)

        if (!passwordMatch) {
            return NextResponse.json(
                { message: 'La contraseña actual no es correcta' },
                { status: 401 }
            )
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10)

        // Update user
        await rawPrisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: newPasswordHash,
                mustChangePassword: false,
            }
        })

        await logAuditAction({
            username: user.username,
            userId: user.id,
            action: 'CAMBIO_CONTRASENA',
            modulo: 'Autenticación',
            detalle: `Contraseña inicial actualizada exitosamente para ${user.username}`
        })

        // Estructura de sesión liviana para respetar el límite de 4KB de cookies
        const sessionData = {
            id: user.id,
            username: user.username,
            name: user.name,
            role: {
                id: user.role?.id,
                name: user.role?.name,
            },
            sucursales: user.sucursales?.map((s: any) => s.nombre) || [],
        }

        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
        const sessionToken = await encrypt({ user: sessionData, expires })

        const protoHeader = request.headers.get('x-forwarded-proto') || ''
        const reqIsHttps = protoHeader.toLowerCase() === 'https' || request.url.startsWith('https://')
        const cookieSecureEnv = process.env.COOKIE_SECURE
        const isSecure = cookieSecureEnv !== undefined 
            ? cookieSecureEnv === 'true' 
            : reqIsHttps

        const response = NextResponse.json(
            { message: 'Contraseña actualizada y sesión iniciada', user: sessionData },
            { status: 200 }
        )
        response.cookies.set('session', sessionToken, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            path: '/',
            maxAge: 24 * 60 * 60,
        })
        return response

    } catch (error: any) {
        console.error('Change password error:', error)
        return NextResponse.json(
            { message: 'Ocurrió un error en el servidor: ' + error.message },
            { status: 500 }
        )
    }
}

