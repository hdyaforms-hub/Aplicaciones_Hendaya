import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Connecting to database...");
    const result = await prisma.$queryRaw`SELECT 1 as result`;
    console.log("Connection successful:", result);
}

main()
  .catch(e => {
    console.error("Connection failed:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("Disconnected.");
  });
