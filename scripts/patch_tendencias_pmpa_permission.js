const { PrismaClient } = require('../src/generated/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- Aplicando parche de permisos para Módulo Tendencias y Oscilación PMPA ---')
    const roles = await prisma.role.findMany()

    for (const role of roles) {
        const roleName = role.name.toLowerCase()
        if (roleName === 'administrador' || roleName === 'admin' || roleName.includes('gerencia')) {
            let perms = []
            try {
                perms = JSON.parse(role.permissions || '[]')
            } catch (e) {
                perms = []
            }

            if (!perms.includes('view_tablero_tendencias_pmpa')) {
                perms.push('view_tablero_tendencias_pmpa')
                await prisma.role.update({
                    where: { id: role.id },
                    data: { permissions: JSON.stringify(perms) }
                })
                console.log(`Permiso 'view_tablero_tendencias_pmpa' agregado al rol: ${role.name}`)
            } else {
                console.log(`El rol '${role.name}' ya tiene el permiso 'view_tablero_tendencias_pmpa'`)
            }
        }
    }
    console.log('--- Parche aplicado exitosamente ---')
}

main()
    .catch((e) => {
        console.error('Error aplicando parche:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
