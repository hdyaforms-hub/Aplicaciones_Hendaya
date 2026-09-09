const { SignJWT } = require('jose')
const { PrismaClient } = require('../src/generated/client')
const prisma = new PrismaClient()

const secretKey = process.env.SESSION_SECRET || 'super-secret-key-change-me'
const key = new TextEncoder().encode(secretKey)

async function testAll() {
    console.log('=== Probando carga de páginas de Logística con sesión Admin ===')

    const adminUser = await prisma.user.findFirst({
        where: { username: 'admin' },
        include: { role: true, sucursales: true }
    })

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const sessionToken = await new SignJWT({ user: adminUser, expires })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1 day from now')
        .sign(key)

    const cookieHeader = `session=${sessionToken}`

    const urls = [
        '/dashboard',
        '/dashboard/logistica/tablero',
        '/dashboard/logistica/rutas',
        '/dashboard/logistica/metricas',
        '/dashboard/logistica/configuracion',
        '/dashboard/logistica/integraciones'
    ]

    for (const u of urls) {
        try {
            const res = await fetch(`http://localhost:3001${u}`, {
                headers: { Cookie: cookieHeader }
            })
            console.log(`[HTTP GET] ${u} -> Status: ${res.status}`)
            if (res.status !== 200) {
                const text = await res.text()
                console.error(`Error en ${u}:`, text.slice(0, 300))
            }
        } catch (e) {
            console.error(`Fallo de red en ${u}:`, e.message)
        }
    }

    console.log('=== Fin de verificación ===')
}

testAll()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
