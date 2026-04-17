import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding database...')

    // 1. Create Admin Role
    const adminRole = await prisma.role.upsert({
        where: { name: 'Administrador' },
        update: {},
        create: {
            name: 'Administrador',
            description: 'Acceso total al sistema',
            permissions: JSON.stringify(['manage_users', 'manage_roles', 'view_reports']),
        },
    })

    console.log(`Role created: ${adminRole.name}`)

    // 2. Create Admin User
    const passwordHash = await bcrypt.hash('admin123', 10)

    const adminUser = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            name: 'Super Admin',
            passwordHash,
            roleId: adminRole.id,
        },
    })

    console.log(`Admin user created: ${adminUser.username} / admin123`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
