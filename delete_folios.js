const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function run() {
    const files = fs.readdirSync('D:/Programas/AplicacionWebDoctos/ELEMENTOS ESENCIALES/EMILIO 2');
    const folios = files.map(f => f.replace('.pdf', ''));
    
    // Also include '20260058504' and other edge cases if the filename has spaces
    const cleanFolios = folios.map(f => f.trim());

    const res = await prisma.elementosEsenciales_Cab.deleteMany({
        where: {
            folio: {
                in: cleanFolios
            }
        }
    });
    
    console.log('Borrados:', res.count);
}

run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
