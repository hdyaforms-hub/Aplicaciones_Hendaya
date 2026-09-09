const { PrismaClient } = require('../src/generated/client')
const prisma = new PrismaClient()

const LOGISTICA_PERMISOS = [
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
    'logistica:integraciones:ver'
]

async function run() {
    console.log('--- Sincronizando permisos de Logística en Rol ADMIN ---')
    const adminRole = await prisma.role.findFirst({
        where: { name: { in: ['ADMIN', 'Admin', 'Administrador'] } }
    })

    if (!adminRole) {
        console.warn('Rol ADMIN no encontrado.')
        return
    }

    let currentPerms = []
    try {
        currentPerms = JSON.parse(adminRole.permissions)
    } catch (e) {
        // Si no era JSON puro, limpiar comas y corchetes
        const raw = adminRole.permissions.replace(/[\[\]"]/g, '')
        currentPerms = raw.split(',').map(p => p.trim()).filter(Boolean)
    }

    const permsSet = new Set(currentPerms)
    let addedCount = 0

    for (const p of LOGISTICA_PERMISOS) {
        if (!permsSet.has(p)) {
            permsSet.add(p)
            addedCount++
        }
    }

    const updatedPermsString = JSON.stringify(Array.from(permsSet))

    await prisma.role.update({
        where: { id: adminRole.id },
        data: { permissions: updatedPermsString }
    })

    console.log(`Rol ${adminRole.name} actualizado como JSON válido: ${addedCount} permisos agregados (Total: ${permsSet.size}).`)
}

run()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect()
    })
