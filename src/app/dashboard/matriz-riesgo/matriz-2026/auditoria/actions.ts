'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function getAuditoriaData() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_auditoria')) {
        return { error: 'No tienes permisos para acceder a esta área.' }
    }

    try {
        const matrices = await prisma.matrizRiesgo2026.findMany({
            orderBy: { createdAt: 'desc' },
            where: {
                createdAt: {
                    gte: new Date('2026-01-01'),
                    lt: new Date('2027-01-01')
                }
            }
        })
        
        const colegios = await prisma.colegiosMatriz.findMany()
        const mitigaciones = await prisma.matrizMitigacion.findMany()
        const riskConfigs = await prisma.matrizConfigPregunta.findMany()

        return { success: true, matrices, colegios, mitigaciones, riskConfigs }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cargar datos de auditoría.' }
    }
}
