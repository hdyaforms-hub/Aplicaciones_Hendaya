import { PrismaClient } from '../src/generated/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log("Reseting admin password to Julio.2021...");
    const passwordHash = await bcrypt.hash('Julio.2021', 10);
    
    // Check if admin exists
    const admin = await prisma.user.findUnique({
        where: { username: 'admin' }
    });
    
    if (admin) {
        await prisma.user.update({
            where: { username: 'admin' },
            data: { passwordHash, isActive: true }
        });
        console.log("Admin password updated successfully.");
    } else {
        console.log("Admin user not found. Creating it...");
        // Get Administrador role id
        const role = await prisma.role.findUnique({ where: { name: 'Administrador' } });
        if (!role) {
            console.error("Administrador role not found! Run seed first.");
            return;
        }
        await prisma.user.create({
            data: {
                username: 'admin',
                passwordHash,
                name: 'Super Admin',
                roleId: role.id,
                isActive: true
            }
        });
        console.log("Admin user created successfully.");
    }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
