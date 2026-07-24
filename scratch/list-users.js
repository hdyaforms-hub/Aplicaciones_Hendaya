const { PrismaClient } = require('../src/generated/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      isActive: true,
      mustChangePassword: true,
      role: { select: { name: true } }
    }
  });
  console.log("USERS IN DB:", JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
