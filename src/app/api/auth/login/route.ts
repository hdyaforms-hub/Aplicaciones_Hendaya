import { NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { encrypt } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'

let sucursalColumnsEnsured = false

async function ensureSucursalSalaColumns() {
    if (sucursalColumnsEnsured) return
    try {
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "tieneSalaReuniones" BOOLEAN NOT NULL DEFAULT false;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "salaCompartidaId" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "sucursal_sala_compartida_idx" ON "Sucursal"("salaCompartidaId");`)
        sucursalColumnsEnsured = true
    } catch (e) {
        console.error('Error auto-healing Sucursal sala columns:', e)
    }
}

// Force recompilation timestamp: 2026-10-08 13:52:00
export async function POST(request: Request) {
    console.log('*** POST /api/auth/login CALLED ***')
    try {
        const body = await request.json()
        const { username, password } = body

        if (!username || !password) {
            return NextResponse.json(
                { message: 'Faltan credenciales' },
                { status: 400 }
            )
        }

        const cleanUsername = username.trim()
        const prefix = cleanUsername.includes('@') ? cleanUsername.split('@')[0] : ''

        console.log(`Intentando login para usuario: ${cleanUsername}`)

        let user: any = null
        try {
            // 1. Búsqueda directa por username, email o prefijo del correo
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

            // 2. Si no se encontró, búsqueda normalizada (tolerando 'ñ'/'n', tildes y prefijos de correo)
            if (!user) {
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
        } catch (dbErr: any) {
            // Auto-recuperación si la base de datos aún no tiene las columnas físicas
            if (dbErr?.message?.includes('tieneSalaReuniones') || dbErr?.message?.includes('salaCompartidaId')) {
                await ensureSucursalSalaColumns()
                user = await rawPrisma.user.findFirst({
                    where: {
                        OR: [
                            { username: { equals: cleanUsername, mode: 'insensitive' } },
                            { email: { equals: cleanUsername, mode: 'insensitive' } }
                        ]
                    },
                    include: { role: true, sucursales: true },
                })
            } else {
                throw dbErr
            }
        }

        if (!user) {
            console.log(`Usuario no encontrado: ${cleanUsername}`)
            return NextResponse.json(
                { message: 'Credenciales inválidas. Verifica tu usuario o correo electrónico.' },
                { status: 401 }
            )
        }

        if (!user.isActive) {
            console.log(`Usuario inactivo: ${cleanUsername}`)
            return NextResponse.json(
                { message: 'El usuario no está vigente. Debe comunicarse con el administrador.' },
                { status: 403 }
            )
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash)

        if (!passwordMatch) {
            console.log(`Password incorrecto para usuario: ${cleanUsername}`)
            return NextResponse.json(
                { message: 'Credenciales inválidas. Contraseña incorrecta.' },
                { status: 401 }
            )
        }

        let permissions: string[] = []
        if (user.role?.permissions) {
            try {
                permissions = JSON.parse(user.role.permissions)
            } catch (e) {
                const raw = (user.role.permissions || '').replace(/[\[\]"]/g, '')
                permissions = raw.split(',').map((p: string) => p.trim()).filter(Boolean)
            }
        }

        // Estructura de sesión liviana para respetar el límite estricto de 4KB de cookies en navegadores
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

        if (user.mustChangePassword) {
            console.log(`Usuario debe cambiar contraseña: ${cleanUsername}`)
            return NextResponse.json(
                {
                    message: 'Debe cambiar su contraseña por seguridad',
                    mustChangePassword: true,
                    tempUser: user.username,
                    userId: user.id,
                    userName: user.name || user.username
                },
                { status: 202 }
            )
        }

        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
        const sessionToken = await encrypt({ user: sessionData, expires })

        console.log(`Login exitoso para: ${cleanUsername} (${user.username})`)

        await logAuditAction({
            username: user.username,
            userId: user.id,
            action: 'INICIO_SESION',
            modulo: 'Autenticación',
            detalle: `Inicio de sesión exitoso (${user.name || user.username})`
        })

        const response = NextResponse.json(
            { message: 'Login exitoso', user: sessionData },
            { status: 200 }
        )

        // Detección automática y confiable de protocolo HTTPS para no rechazar cookies en conexiones HTTP
        const protoHeader = request.headers.get('x-forwarded-proto') || ''
        const reqIsHttps = protoHeader.toLowerCase() === 'https' || request.url.startsWith('https://')
        const cookieSecureEnv = process.env.COOKIE_SECURE
        const isSecure = cookieSecureEnv !== undefined 
            ? cookieSecureEnv === 'true' 
            : reqIsHttps

        response.cookies.set('session', sessionToken, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            path: '/',
            maxAge: 24 * 60 * 60,
        })

        return response

    } catch (error: any) {
        console.error('CRITICAL: Login error:', error)
        return NextResponse.json(
            { message: 'Ocurrió un error en el servidor: ' + error.message },
            { status: 500 }
        )
    }
}
