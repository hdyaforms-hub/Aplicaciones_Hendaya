const { PrismaClient } = require('../src/generated/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- Iniciando actualización de permisos para Prevención de Riesgos ---')
    
    // Buscar todos los roles de Administrador
    const adminRoles = await prisma.role.findMany({
        where: {
            OR: [
                { name: 'Administrador' },
                { name: 'admin' },
                { name: { contains: 'Admin', mode: 'insensitive' } }
            ]
        }
    })

    const newPermissions = [
        'view_prev_gravedad_preparacion',
        'manage_prev_gravedad_preparacion'
    ]

    for (const role of adminRoles) {
        let currentPerms = []
        try {
            currentPerms = JSON.parse(role.permissions || '[]')
        } catch (e) {
            currentPerms = []
        }

        const permsSet = new Set(currentPerms)
        let modified = false

        for (const p of newPermissions) {
            if (!permsSet.has(p)) {
                permsSet.add(p)
                modified = true
            }
        }

        if (modified) {
            const updatedPerms = Array.from(permsSet)
            await prisma.role.update({
                where: { id: role.id },
                data: { permissions: JSON.stringify(updatedPerms) }
            })
            console.log(`✓ Rol "${role.name}" actualizado con nuevos permisos de Prev. de riesgos.`)
        } else {
            console.log(`• Rol "${role.name}" ya contaba con los permisos.`)
        }
    }

    console.log('--- Proceso finalizado exitosamente ---')
}

main()
    .catch((err) => {
        console.error('Error aplicando permisos:', err)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
