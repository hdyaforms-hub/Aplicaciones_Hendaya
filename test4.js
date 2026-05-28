require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const totalCols = await prisma.colegios.count();
    const colsSinDir = await prisma.colegios.count({ 
        where: { 
            OR: [ 
                { direccionEstablecimiento: null }, 
                { direccionEstablecimiento: '' }, 
                { comuna: null }, 
                { comuna: '' } 
            ] 
        } 
    });
    console.log('Total colegios:', totalCols);
    console.log('Colegios sin direccion o comuna:', colsSinDir);
}
main().finally(() => prisma.$disconnect());
