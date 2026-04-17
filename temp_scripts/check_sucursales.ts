import { PrismaClient } from '../src/generated/client';

const prisma = new PrismaClient();

async function main() {
    const sucursales = await prisma.sucursal.findMany();
    console.log(`Sucursales encontradas: ${sucursales.length}`);
    sucursales.forEach(s => console.log(`- ${s.id}: ${s.nombre}`));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
