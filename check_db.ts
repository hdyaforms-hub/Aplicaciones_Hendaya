import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
    console.log("Notificaciones Gas:");
    const gas = await prisma.notificacionPantalla.findMany({
        where: { codigoPantalla: { startsWith: 'solicitud-gas' } },
        include: { listaCorreo: true }
    });
    console.dir(gas, { depth: null });
}
main().finally(() => prisma.$disconnect())
