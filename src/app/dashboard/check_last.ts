import { prisma } from '../../lib/prisma'

async function main() {
    const closed = await prisma.retornoProductosAlerta.findMany({
        where: { estado: 'CERRADA' },
        include: { sucursalesEstado: true }
    })
    console.log(JSON.stringify(closed, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
