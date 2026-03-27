'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { FIELD_MAPPING, PROBLEM_VALUES } from './mapping'
import { addDays } from 'date-fns'

export async function getMitigacionData(semestre: 1 | 2 = 1) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_mitigacion')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        const configSemestre = await prisma.matrizConfigSemestre.findUnique({ where: { anio: 2026 } })
        if (!configSemestre) return { error: 'Debe configurar la fecha de fin del 1er semestre en Colegios Activos.' }

        const cutoffDate = new Date(configSemestre.fechaFin1)
        
        // Filtrar por semestre
        const dateFilter = semestre === 1 
            ? { lte: cutoffDate }
            : { gt: cutoffDate }

        // Obtener matrices del año 2026
        const matrices = await prisma.matrizRiesgo2026.findMany({
            where: {
                createdAt: {
                    ...dateFilter,
                    gte: new Date('2026-01-01'),
                    lt: new Date('2027-01-01')
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        // Configuración de riesgos para calcular plazos
        const riskConfigs = await prisma.matrizConfigPregunta.findMany()

        // Mitigaciones ya guardadas
        const mitigaciones = await prisma.matrizMitigacion.findMany()

        return { success: true, matrices, riskConfigs, mitigaciones, cutoffDate }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cargar datos de mitigación.' }
    }
}

export async function saveMitigacionAction(data: {
    matrizId: string,
    preguntaId: string,
    fechaSolucion?: string,
    adjuntos?: string[]
}) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_mitigacion')) {
        return { error: 'No tienes permisos.' }
    }

    try {
        await prisma.matrizMitigacion.upsert({
            where: {
                matrizId_preguntaId: {
                    matrizId: data.matrizId,
                    preguntaId: data.preguntaId
                }
            },
            update: {
                fechaSolucion: data.fechaSolucion ? new Date(data.fechaSolucion) : null,
                adjuntos: data.adjuntos ? JSON.stringify(data.adjuntos) : null,
                usuario: session.user.username!
            },
            create: {
                matrizId: data.matrizId,
                preguntaId: data.preguntaId,
                fechaSolucion: data.fechaSolucion ? new Date(data.fechaSolucion) : null,
                adjuntos: data.adjuntos ? JSON.stringify(data.adjuntos) : null,
                usuario: session.user.username!
            }
        })

        revalidatePath('/dashboard/matriz-riesgo/matriz-2026/mitigacion')
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: 'Error al guardar mitigación.' }
    }
}
