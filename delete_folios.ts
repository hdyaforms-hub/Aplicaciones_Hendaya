import { prisma } from './src/lib/prisma';
import fs from 'fs';

async function run() {
    const files = fs.readdirSync('D:/Programas/AplicacionWebDoctos/ELEMENTOS ESENCIALES/EMILIO 2');
    const folios = files.map(f => f.replace('.pdf', ''));
    
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
