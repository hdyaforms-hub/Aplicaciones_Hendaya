'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { endOfMonth } from 'date-fns'

async function getUserFilters() {
    const session = await getSession();
    if (!session?.user) return { isAdmin: false, userSucursales: [], allowedUTs: [], userRbds: [] };

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin';
    const userSucursales = session.user.sucursales || [];
    let userRbds: number[] = session.user.rbds || [];

    if (session.user.id) {
        const dbUser = await rawPrisma.user.findUnique({
            where: { id: session.user.id },
            select: { rbds: true }
        })
        if (dbUser) {
            userRbds = dbUser.rbds
        }
    }

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

export async function getCerrarMatrizData(year: number = new Date().getFullYear()) {
    const session = await getSession()
    if (!session?.user) {
        return { error: 'No autorizado.' }
    }

    const { isAdmin, userRbds } = await getUserFilters()

    // Check visual delegations for this user
    const delegations = await prisma.delegacionVisualizacion.findMany({
        where: { userId: session.user.id },
        include: { sucursal: true }
    })
    const delegatedSucursales = delegations.map(d => d.sucursal.nombre)
    const isDelegated = delegatedSucursales.length > 0

    try {
        const configSemestre = await prisma.matrizConfigSemestre.findUnique({ where: { anio: year } })
        if (!configSemestre) return { error: `Debe configurar la fecha de corte para el año ${year} en Colegios Activos.` }

        const cutoffDate = new Date(configSemestre.fechaFin1)
        
        const startDate = new Date(year, 2, 1); // 1 de Marzo
        const endDate = endOfMonth(new Date(year + 1, 1)); // Fin de Febrero sgte año

        // 1. Get all active schools for matrix
        const activeColegios = await prisma.colegiosMatriz.findMany({
            where: { isActive: true }
        })
        const activeColegiosMap = new Map(activeColegios.map(c => [c.colRBD, c]))

        // 2. Fetch answers
        const where: any = {
            fechaIngreso: {
                gte: startDate,
                lte: endDate
            }
        }

        // Apply filters: admins see all. Delegated see their delegated sucursal schools + supervisor assigned. Supervisor sees their assigned.
        if (!isAdmin) {
            const orConditions = []
            if (userRbds.length > 0) orConditions.push({ rbd: { in: userRbds } })
            if (isDelegated) {
                // Get RBDs of schools in delegated sucursales
                const delegatedRBDs = activeColegios
                    .filter(c => delegatedSucursales.includes(c.sucursal))
                    .map(c => c.colRBD)
                if (delegatedRBDs.length > 0) {
                    orConditions.push({ rbd: { in: delegatedRBDs } })
                }
            }

            if (orConditions.length > 0) {
                where.OR = orConditions
            } else {
                where.id = 'NO_DATA'
            }
        }

        const matricesDb = await prisma.matrizT_RespuestasCabecera.findMany({
            where,
            include: {
                cabecera: {
                    include: {
                        detalles: true
                    }
                },
                detalles: true
            },
            orderBy: { fechaIngreso: 'desc' }
        })

        const matrices = matricesDb.map(m => ({
            ...m,
            nombreColegio: activeColegiosMap.get(m.rbd)?.nombreEstablecimiento || `RBD ${m.rbd}`,
            sucursal: activeColegiosMap.get(m.rbd)?.sucursal || 'Desconocida'
        }))

        // 3. Mitigaciones ya guardadas
        const mitigaciones = await prisma.matrizMitigacion.findMany()

        // 4. Progress calculation for supervisors (if admin or delegated)
        let supervisorProgressList: any[] = []
        if (isAdmin || isDelegated) {
            // Find all supervisor users
            const supervisors = await prisma.user.findMany({
                where: {
                    role: { name: { in: ['Supervisor', 'supervisor'] } },
                    isDeleted: false,
                    isActive: true
                },
                include: { sucursales: true }
            })

            // Calculate progress for each supervisor
            supervisorProgressList = supervisors.map(sup => {
                // Filter assigned RBDs that are active
                const supActiveRbdIds = sup.rbds.filter(rbd => activeColegiosMap.has(rbd))
                
                // Evaluations for these RBDs in this semester
                const supEvaluations = matricesDb.filter(m => supActiveRbdIds.includes(m.rbd))

                // Finished evaluations are those in status 'por supervisar' or 'cerrado'
                const completedRbds = supEvaluations.filter(e => e.estado === 'por supervisar' || e.estado === 'cerrado').map(e => e.rbd)
                const completed = completedRbds.length
                const total = supActiveRbdIds.length

                // Build detail list of each RBD with status
                const rbdList = supActiveRbdIds.map(rbd => {
                    const colegio = activeColegiosMap.get(rbd)
                    const isComplete = completedRbds.includes(rbd)
                    return {
                        rbd,
                        nombre: colegio?.nombreEstablecimiento || `RBD ${rbd}`,
                        estado: isComplete ? 'completo' : 'pendiente'
                    }
                }).sort((a, b) => a.nombre.localeCompare(b.nombre))

                return {
                    id: sup.id,
                    username: sup.username,
                    name: sup.name || sup.username,
                    sucursales: sup.sucursales.map(s => s.nombre),
                    totalRbd: total,
                    completedRbd: completed,
                    pendingRbd: Math.max(0, total - completed),
                    pct: total > 0 ? Math.round((completed / total) * 100) : 100,
                    rbdList
                }
            })

            // Filter progress list if delegated
            if (isDelegated && !isAdmin) {
                supervisorProgressList = supervisorProgressList.filter(sp => 
                    sp.sucursales.some((s: string) => delegatedSucursales.includes(s))
                )
            }
        }

        // 5. Progress for currently logged-in supervisor
        let myProgress = null
        if (!isAdmin) {
            const activeMyRbds = (userRbds as number[]).filter((rbd: number) => activeColegiosMap.has(rbd))
            const myEvaluations = matricesDb.filter(m => activeMyRbds.includes(m.rbd))
            const completed = myEvaluations.filter(e => e.estado === 'por supervisar' || e.estado === 'cerrado').length
            const total = activeMyRbds.length
            myProgress = {
                total,
                completed,
                pending: Math.max(0, total - completed),
                pct: total > 0 ? Math.round((completed / total) * 100) : 100
            }
        }

        // Fetch sucursales for delegations or dashboards
        const sucursales = await prisma.sucursal.findMany({ orderBy: { nombre: 'asc' } })

        return {
            success: true,
            matrices,
            mitigaciones,
            cutoffDate,
            supervisorProgressList,
            myProgress,
            sucursales,
            delegatedSucursales,
            isAdmin
        }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cargar datos.' }
    }
}

export async function saveMitigacionAction(data: {
    matrizId: string,
    preguntaId: string,
    fechaSolucion?: string,
    adjuntos?: string[]
}) {
    const session = await getSession()
    if (!session?.user) {
        return { error: 'No autorizado' }
    }

    // Verify matrix is not closed
    const matrix = await prisma.matrizT_RespuestasCabecera.findUnique({
        where: { id: data.matrizId }
    })
    
    if (!matrix) return { error: 'Evaluación no encontrada' }
    
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    if (matrix.estado === 'cerrado' && !isAdmin) {
        return { error: 'La matriz se encuentra cerrada por auditoría y no puede ser modificada.' }
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

        revalidatePath('/dashboard/matriz-riesgo/cerrar-matriz')
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: 'Error al guardar mitigación.' }
    }
}

export async function finalizeCerrarMatrizAction(data: {
    matrizId: string,
    latCierre?: number,
    lngCierre?: number
}) {
    const session = await getSession()
    if (!session?.user) {
        return { error: 'No autorizado' }
    }

    const { matrizId, latCierre, lngCierre } = data

    try {
        // Verify evaluation exists
        const evaluation = await prisma.matrizT_RespuestasCabecera.findUnique({
            where: { id: matrizId }
        })

        if (!evaluation) {
            return { error: 'Evaluación no encontrada.' }
        }

        const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
        if (evaluation.estado === 'cerrado' && !isAdmin) {
            return { error: 'La matriz ya se encuentra cerrada por auditoría.' }
        }

        // Update state to "por supervisar" and register geolocation
        await prisma.matrizT_RespuestasCabecera.update({
            where: { id: matrizId },
            data: {
                estado: 'por supervisar',
                latCierre: latCierre != null ? Number(latCierre) : null,
                lngCierre: lngCierre != null ? Number(lngCierre) : null
            }
        })

        revalidatePath('/dashboard/matriz-riesgo/cerrar-matriz')
        revalidatePath('/dashboard/matriz-riesgo/mitigacion')
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cerrar la matriz.' }
    }
}
