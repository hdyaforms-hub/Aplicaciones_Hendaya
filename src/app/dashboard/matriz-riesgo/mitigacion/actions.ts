'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { endOfMonth } from 'date-fns'

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

export async function getMitigacionData(year: number = new Date().getFullYear()) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_mitigacion')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        const configSemestre = await prisma.matrizConfigSemestre.findUnique({ where: { anio: year } })
        if (!configSemestre) return { error: `Debe configurar la fecha de corte para el año ${year} en Colegios Activos.` }

        const cutoffDate = new Date(configSemestre.fechaFin1)
        
        const startDate = new Date(year, 2, 1); // 1 de Marzo
        const endDate = endOfMonth(new Date(year + 1, 1)); // Fin de Febrero sgte año

        const { isAdmin, allowedUTs, userRbds } = await getUserFilters()
        
        const where: any = {
            fechaIngreso: {
                gte: startDate,
                lte: endDate
            },
            estado: { in: ['por supervisar', 'cerrado'] }
        }
        
        if (!isAdmin) {
            const orConditions = []
            if (allowedUTs.length > 0) orConditions.push({ ut: { in: allowedUTs } })
            if (userRbds.length > 0) orConditions.push({ rbd: { in: userRbds } })

            if (orConditions.length > 0) {
                where.AND = [
                    { OR: orConditions }
                ]
            } else {
                where.id = 'NO_DATA'
            }
        }

        // Obtener respuestas (evaluaciones realizadas)
        const matricesDb = await prisma.matrizT_RespuestasCabecera.findMany({
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

        // Obtener nombres de colegios
        const rbds = Array.from(new Set(matricesDb.map(m => m.rbd)))
        const colegios = await prisma.colegiosMatriz.findMany({
            where: { colRBD: { in: rbds } },
            select: { colRBD: true, nombreEstablecimiento: true }
        })
        const colegiosMap = new Map(colegios.map(c => [c.colRBD, c.nombreEstablecimiento]))

        const matrices = matricesDb.map(m => ({
            ...m,
            nombreColegio: colegiosMap.get(m.rbd) || `RBD ${m.rbd}`
        }))

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

    // Verify matrix is not closed
    const matrix = await prisma.matrizT_RespuestasCabecera.findUnique({
        where: { id: data.matrizId }
    })
    
    if (!matrix) return { error: 'Evaluación no encontrada' }
    
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    if (matrix.estado === 'cerrado' && !isAdmin) {
        return { error: 'La matriz se encuentra cerrada y no puede ser modificada.' }
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

export async function approveAndCloseMatrixAction(matrizId: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_mitigacion')) {
        return { error: 'No tienes permisos.' }
    }

    try {
        await prisma.matrizT_RespuestasCabecera.update({
            where: { id: matrizId },
            data: { estado: 'cerrado' }
        })

        revalidatePath('/dashboard/matriz-riesgo/mitigacion')
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cerrar la matriz.' }
    }
}

export async function deleteMatrixAction(matrizId: string) {
    const session = await getSession()
    if (!session?.user) return { error: 'No autorizado' }
    
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    if (!isAdmin) {
        return { error: 'Solo los administradores pueden eliminar evaluaciones.' }
    }

    try {
        await prisma.matrizT_RespuestasCabecera.delete({
            where: { id: matrizId }
        })

        revalidatePath('/dashboard/matriz-riesgo/mitigacion')
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: 'Error al eliminar la evaluación.' }
    }
}
