import { prisma } from '../src/lib/prisma'

async function checkAlerts() {
    const alerts = await prisma.retornoProductosAlerta.findMany({
        where: { estado: 'CERRADA' }
    })
    console.log('ALERTAS CERRADAS:', JSON.stringify(alerts, null, 2))
}

checkAlerts().catch(console.error)
