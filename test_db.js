const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Config 2026:', await prisma.matrizConfigSemestre.findUnique({where: {anio: 2026}}));
    console.log('Config 2027:', await prisma.matrizConfigSemestre.findUnique({where: {anio: 2027}}));
    
    const matrices2027 = await prisma.matrizT_RespuestasCabecera.findMany({
        where: {
            fechaIngreso: {
                gte: new Date('2027-03-01'),
                lte: new Date('2028-02-29')
            }
        }
    });
    console.log('Matrices in 2027 range:', matrices2027.length, matrices2027.map(m => m.fechaIngreso));
    
    const allMatrices = await prisma.matrizT_RespuestasCabecera.findMany({
        select: { fechaIngreso: true }
    });
    console.log('All matrices count:', allMatrices.length);
    console.log('Sample dates:', allMatrices.slice(0, 5).map(m => m.fechaIngreso));
}

main().then(() => prisma.$disconnect()).catch(console.error);
