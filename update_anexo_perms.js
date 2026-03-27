const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const role = await prisma.role.findUnique({ where: { name: 'Administrador' } });
    if (role) {
        let perms = [];
        try {
            perms = JSON.parse(role.permissions);
        } catch (e) {
            console.error('Error parsing permissions:', e);
            perms = [];
        }
        
        if (!perms.includes('manage_anexos')) perms.push('manage_anexos');
        if (!perms.includes('view_anexos')) perms.push('view_anexos');
        
        await prisma.role.update({
            where: { id: role.id },
            data: { permissions: JSON.stringify(perms) }
        });
        console.log('Permissions updated for Administrador');
    } else {
        console.log('Role Administrador not found');
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
