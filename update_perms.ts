import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const adminRole = await prisma.role.findFirst({ where: { name: 'Administrador' } })
    if (adminRole) {
        let perms = JSON.parse(adminRole.permissions) as string[]
        const newPerms = ['view_formularios', 'create_formularios', 'fill_formularios']
        newPerms.forEach(p => {
            if (!perms.includes(p)) perms.push(p)
        })
        await prisma.role.update({
            where: { id: adminRole.id },
            data: { permissions: JSON.stringify(perms) }
        })
        console.log('Permisos de administrador actualizados con éxito.')
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
