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

        console.log(`Intentando login para usuario: ${cleanUsername}`)

        await ensureSucursalSalaColumns()

        let user: any = null
        try {
            user = await rawPrisma.user.findFirst({
                where: {
                    username: {
                        equals: cleanUsername,
                        mode: 'insensitive'
                    }
                },
                include: { role: true, sucursales: true },
            })
        } catch (dbErr: any) {
            // Auto-recuperación si la base de datos de producción aún no tiene las columnas físicas
            if (dbErr?.message?.includes('tieneSalaReuniones') || dbErr?.message?.includes('salaCompartidaId')) {
                await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "tieneSalaReuniones" BOOLEAN NOT NULL DEFAULT false;`)
                await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "salaCompartidaId" TEXT;`)
                await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "sucursal_sala_compartida_idx" ON "Sucursal"("salaCompartidaId");`)
                user = await rawPrisma.user.findFirst({
                    where: {
                        username: {
                            equals: cleanUsername,
                            mode: 'insensitive'
                        }
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
                { message: 'Credenciales inválidas' },
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
                { message: 'Credenciales inválidas' },
                { status: 401 }
            )
        }

        let permissions: string[] = []
        try {
            permissions = JSON.parse(user.role.permissions)
        } catch (e) {
            const raw = (user.role.permissions || '').replace(/[\[\]"]/g, '')
            permissions = raw.split(',').map((p: string) => p.trim()).filter(Boolean)
        }

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
                { message: 'Debe cambiar su contraseña por seguridad', mustChangePassword: true, tempUser: user.username },
                { status: 202 }
            )
        }

        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
        const sessionToken = await encrypt({ user: sessionData, expires })

        console.log(`Login exitoso para: ${cleanUsername}`)

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
        console.error('CRITICAL: Login error:', error)
        return NextResponse.json(
            { message: 'Ocurrió un error en el servidor: ' + error.message },
            { status: 500 }
        )
    }
}
