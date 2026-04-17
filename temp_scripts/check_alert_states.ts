import { PrismaClient } from '../src/generated/client';

const prisma = new PrismaClient();

async function main() {
    const alertas = await prisma.retornoProductosAlerta.findMany({
        include: {
            sucursalesEstado: {
                include: { sucursal: true }
            }
        }
    });
    
    alertas.forEach(a => {
        console.log(`Alerta: ${a.titulo} (ID: ${a.id}) - Estado: ${a.estado}`);
        console.log(`Sucursales vinculadas (${a.sucursalesEstado.length}):`);
        a.sucursalesEstado.forEach(se => {
            console.log(`  - ${se.sucursal.nombre}: ${se.estado}`);
        });
        console.log('---');
    });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
