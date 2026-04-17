import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Fetching users...");
    const users = await prisma.user.findMany({
        include: { role: true, sucursales: true }
    });
    
    console.log("Users found:", users.length);
    users.forEach(user => {
        console.log(`User: ${user.username}, Role: ${user.role?.name}`);
        console.log(`Permissions: ${user.role?.permissions}`);
        try {
            if (user.role?.permissions) {
                JSON.parse(user.role.permissions);
                console.log("Permissions JSON is valid.");
            } else {
                console.log("Permissions are null/empty.");
            }
        } catch (e: any) {
            console.error("Permissions JSON is INVALID:", e.message);
        }
    });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
