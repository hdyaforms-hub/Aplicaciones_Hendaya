import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
    const solicitudes = await prisma.solicitudGas.findMany({
        orderBy: { fechaSolicitud: 'desc' },
        take: 5
    });
    console.log("Últimas solicitudes de gas:");
    for (const s of solicitudes) {
        const colegio = await prisma.colegios.findFirst({ where: { colRBD: s.rbd }})
        console.log(`Fecha: ${s.fechaSolicitud}, RBD ${s.rbd} -> Sucursal: ${colegio?.sucursal}`);
    }
}
main().finally(() => prisma.$disconnect())
