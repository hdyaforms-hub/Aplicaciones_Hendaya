require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const count = await prisma.distanciaCache.count();
    console.log('Distancias cacheadas:', count);
}
main().finally(() => prisma.$disconnect());
