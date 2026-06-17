'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

async function getUserFilters() {
    const session = await getSession();
    if (!session?.user) return { isAdmin: false, userSucursales: [], allowedUTs: [], userRbds: [] };

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin';
    const userSucursales = session.user.sucursales || [];
    const userRbds = session.user.rbds || [];
    let allowedUTs: number[] = [];

    if (!isAdmin && userSucursales.length > 0) {
        const sucursalesDb = await prisma.sucursal.findMany({
            where: { nombre: { in: userSucursales } },
            include: { uts: true }
        });
        allowedUTs = sucursalesDb.flatMap(s => s.uts.map((ut: any) => ut.codUT));
    }

    return { isAdmin, userSucursales, allowedUTs, userRbds };
}

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

        const { isAdmin, allowedUTs, userRbds } = await getUserFilters()
        
        const where: any = {
            fechaIngreso: {
                ...dateFilter,
                gte: new Date('2026-01-01'),
                lt: new Date('2027-01-01')
            }
        }
        
        if (!isAdmin) {
            const orConditions = []
            if (allowedUTs.length > 0) orConditions.push({ ut: { in: allowedUTs } })
            if (userRbds.length > 0) orConditions.push({ rbd: { in: userRbds } })

            if (orConditions.length > 0) {
                where.OR = orConditions
            } else {
                where.id = 'NO_DATA'
            }
        }

        // Obtener respuestas (evaluaciones realizadas)
        const matrices = await prisma.matrizT_RespuestasCabecera.findMany({
            where,
            include: {
                cabecera: {
                    include: {
                        detalles: true // Preguntas de la plantilla
                    }
                },
                detalles: true // Respuestas del usuario
            },
            orderBy: { fechaIngreso: 'desc' }
        })

        // Mitigaciones ya guardadas
        const mitigaciones = await prisma.matrizMitigacion.findMany()

        return { success: true, matrices, mitigaciones, cutoffDate }
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

        revalidatePath('/dashboard/matriz-riesgo/mitigacion')
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: 'Error al guardar mitigación.' }
    }
}
