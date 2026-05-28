const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function main() { 
    const c = await prisma.colegios.findMany({ take: 5, orderBy: { createdAt: 'desc' } }); 
    console.log(c.map(x => ({ rbd: x.colRBD, sucursal: x.sucursal }))); 
} 
main().finally(() => prisma.$disconnect());
