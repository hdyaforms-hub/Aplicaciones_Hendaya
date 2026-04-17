import { prisma } from '../../lib/prisma'

async function main() {
    const alertsToReopen = await prisma.retornoProductosAlerta.findMany({
        where: { estado: 'CERRADA' },
        include: { sucursalesEstado: true }
    })

    for (const alert of alertsToReopen) {
        const hasPending = alert.sucursalesEstado.some(s => s.estado !== 'FINALIZADO')
        if (hasPending) {
            await prisma.retornoProductosAlerta.update({
                where: { id: alert.id },
                data: {
                    estado: 'ABIERTA',
                    fechaCierre: null,
                    usuarioCierre: null,
                    conclusionFinal: null
                }
            })
            console.log(`Reopened alert: ${alert.titulo}`)
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
