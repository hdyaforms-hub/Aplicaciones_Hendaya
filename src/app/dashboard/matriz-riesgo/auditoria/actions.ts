'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

import { endOfMonth } from 'date-fns'

export async function getAuditoriaData(year: number = new Date().getFullYear()) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_auditoria')) {
        return { error: 'No tienes permisos para acceder a esta área.' }
    }

    try {
        const configSemestre = await prisma.matrizConfigSemestre.findUnique({ where: { anio: year } })
        if (!configSemestre) return { error: `Debe configurar la fecha de corte para el año ${year} en Colegios Activos.` }

        const startDate = new Date(year, 2, 1); // 1 de Marzo
        const endDate = endOfMonth(new Date(year + 1, 1)); // Fin de Febrero sgte año

        const respuestas = await prisma.matrizT_RespuestasCabecera.findMany({
            where: {
                fechaIngreso: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { createdAt: 'desc' },
            include: {
                detalles: true
            }
        })
        
        const cabecerasConfig = await prisma.matrizT_Cabecera.findMany({
            where: { estado: true },
            include: {
                detalles: {
                    orderBy: { orden: 'asc' }
                }
            }
        })

        const colegios = await prisma.colegiosMatriz.findMany()
        const mitigaciones = await prisma.matrizMitigacion.findMany()

        return { success: true, respuestas, cabecerasConfig, colegios, mitigaciones }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cargar datos de auditoría.' }
    }
}
