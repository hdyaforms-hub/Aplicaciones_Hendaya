let PrismaClient
try {
    PrismaClient = require('../src/generated/client').PrismaClient
} catch {
    PrismaClient = require('@prisma/client').PrismaClient
}
const prisma = new PrismaClient()

const TARGET_PERMS = [
    'view_calidad_transporte_higiene',
    'manage_calidad_transporte_higiene',
    'sign_calidad_transporte_higiene',
    'sign_bodega_transporte_higiene',
    'view_calidad_higiene_personal',
    'manage_calidad_higiene_personal',
    'sign_calidad_higiene_personal',
    'sign_bodega_higiene_personal'
]

async function main() {
    console.log('--- Limpiando permisos de Calidad en Roles ---')
    console.log('Permisos a desmarcar por defecto:', TARGET_PERMS)

    const roles = await prisma.role.findMany()
    let updatedCount = 0

    for (const role of roles) {
        if (!role.permissions) continue

        let currentPerms = []
        try {
            currentPerms = JSON.parse(role.permissions)
        } catch {
            currentPerms = role.permissions.split(',').map(p => p.trim()).filter(Boolean)
        }

        if (!Array.isArray(currentPerms)) continue

        const filtered = currentPerms.filter(p => !TARGET_PERMS.includes(p))

        if (filtered.length !== currentPerms.length) {
            await prisma.role.update({
                where: { id: role.id },
                data: {
                    permissions: JSON.stringify(filtered)
                }
            })
            console.log(`✓ Rol "${role.name}" (ID: ${role.id}): se removieron ${currentPerms.length - filtered.length} permisos. Ahora debe marcarse en Roles y Perfiles.`)
            updatedCount++
        }
    }

    console.log(`\nProceso completado. Se actualizaron ${updatedCount} rol(es).`)
    console.log('Ahora los módulos solo aparecerán para aquellos roles que tengan marcadas las casillas explícitamente en el panel de Roles y Perfiles.')
}

main()
    .catch(e => {
        console.error('Error al resetear permisos:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
