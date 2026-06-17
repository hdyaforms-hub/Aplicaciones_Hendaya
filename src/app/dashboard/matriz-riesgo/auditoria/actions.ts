'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function getAuditoriaData() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_auditoria')) {
        return { error: 'No tienes permisos para acceder a esta área.' }
    }

    try {
        const respuestas = await prisma.matrizT_RespuestasCabecera.findMany({
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
