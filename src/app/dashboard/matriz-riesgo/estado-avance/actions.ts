'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { isBefore, isAfter, startOfYear, endOfYear } from 'date-fns'

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

const PROBLEM_VALUES = [
    'NO',
    'NO_EXISTE',
    'MALO_NO_CUMPLE',
    'NO_HAY_REQUIERE'
]

export async function getEstadoAvanceData() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_estado_avance')) {
        return { error: 'Sin permisos.' }
    }

    try {
        const configSemestre = await prisma.matrizConfigSemestre.findUnique({ where: { anio: 2026 } })
        if (!configSemestre) return { error: 'Debe configurar la fecha de corte en Colegios Activos.' }
        
        const cutoff = new Date(configSemestre.fechaFin1)
        
        const { isAdmin, userSucursales, allowedUTs, userRbds } = await getUserFilters()

        // 1. Obtener todos los colegios adjudicados (activos)
        const adjudicadosWhere: any = { isActive: true }
        if (!isAdmin) {
            const orConditions = []
            if (userSucursales.length > 0) orConditions.push({ sucursal: { in: userSucursales } })
            if (userRbds.length > 0) orConditions.push({ colRBD: { in: userRbds } })
            
            if (orConditions.length > 0) {
                adjudicadosWhere.OR = orConditions
            } else {
                adjudicadosWhere.id = 'NO_DATA'
            }
        }
        const adjudicados = await prisma.colegiosMatriz.findMany({ where: adjudicadosWhere })
        
        // 2. Obtener todas las matrices (evaluaciones) del nuevo sistema
        const matricesWhere: any = {
            fechaIngreso: {
                gte: startOfYear(new Date('2026-01-01')),
                lte: endOfYear(new Date('2026-12-31'))
            }
        }
        if (!isAdmin) {
            const orConditions = []
            if (allowedUTs.length > 0) orConditions.push({ ut: { in: allowedUTs } })
            if (userRbds.length > 0) orConditions.push({ rbd: { in: userRbds } })

            if (orConditions.length > 0) {
                matricesWhere.OR = orConditions
            } else {
                matricesWhere.id = 'NO_DATA'
            }
        }

        const matrices = await prisma.matrizT_RespuestasCabecera.findMany({
            where: matricesWhere,
            include: {
                detalles: true
            }
        })

        // 3. Obtener todas las mitigaciones
        const mitigaciones = await prisma.matrizMitigacion.findMany()

        // 4. Agrupar por UT
        const uts = Array.from(new Set(adjudicados.map(c => c.colut))).sort((a,b) => a - b)
        
        const report = [1, 2].flatMap(sem => {
            return uts.map(ut => {
                const adjUT = adjudicados.filter(c => c.colut === ut)
                const matricesUT = matrices.filter(m => {
                    if (m.ut !== ut) return false
                    const d = new Date(m.fechaIngreso)
                    return sem === 1 ? (isBefore(d, cutoff) || d.getTime() === cutoff.getTime()) : isAfter(d, cutoff)
                })

                // Para Mitigación (Segundo Semestre abarca todo el año - YTD)
                const matricesUT_Mitigacion = matrices.filter(m => {
                    if (m.ut !== ut) return false
                    const d = new Date(m.fechaIngreso)
                    return sem === 1 ? (isBefore(d, cutoff) || d.getTime() === cutoff.getTime()) : true
                })

                // Auditoría metrics
                const auditadasUnique = Array.from(new Set(matricesUT.map(m => m.rbd)))
                const cantAuditadas = auditadasUnique.length
                const rbdAuditados = matricesUT.map(m => m.rbd)
                const repetidos = rbdAuditados.length - auditadasUnique.length
                const adjCount = adjUT.length
                const sinAuditar = Math.max(0, adjCount - cantAuditadas)
                const cumplimientoAudit = adjCount > 0 ? (cantAuditadas / adjCount) * 100 : 0

                // Mitigación metrics
                let totalItemsLevantados = 0
                let totalItemsSolucionados = 0
                let actasConRegistros = 0 // Matrices con al menos una mitigación guardada
                let actasSinProblemas = 0 // Matrices donde ninguna pregunta fue "Problema"
                let actasPorSolucionar = 0 // Matrices con hallazgos aún no resueltos

                matricesUT_Mitigacion.forEach(m => {
                    let hasProblems = false
                    let unsolvedInThisActa = false
                    let hasAtLeastOneMitigation = false

                    m.detalles.forEach(respuesta => {
                        if (respuesta.valor && PROBLEM_VALUES.includes(respuesta.valor)) {
                            hasProblems = true
                            totalItemsLevantados++
                            
                            const mit = mitigaciones.find(mit => mit.matrizId === m.id && mit.preguntaId === respuesta.preguntaId)
                            if (mit?.fechaSolucion) {
                                totalItemsSolucionados++
                            } else {
                                unsolvedInThisActa = true
                            }
                            if (mit) hasAtLeastOneMitigation = true
                        }
                    })

                    if (!hasProblems) actasSinProblemas++
                    else {
                        if (unsolvedInThisActa) actasPorSolucionar++
                        if (hasAtLeastOneMitigation) actasConRegistros++
                    }
                })

                const cumplimientoActa = matricesUT_Mitigacion.length > 0 ? (matricesUT_Mitigacion.length - actasPorSolucionar) / matricesUT_Mitigacion.length * 100 : 0
                const cumplimientoItems = totalItemsLevantados > 0 ? (totalItemsSolucionados / totalItemsLevantados) * 100 : 100

                return {
                    ut,
                    semestre: sem,
                    cantAuditadas,
                    adjCount,
                    sinAuditar,
                    repetidos,
                    cumplimientoAudit,
                    actasConRegistros,
                    actasSinProblemas,
                    actasPorSolucionar,
                    cumplimientoActa: isNaN(cumplimientoActa) ? 0 : cumplimientoActa,
                    totalItemsLevantados,
                    totalItemsSolucionados,
                    cumplimientoItems
                }
            })
        })

        return { success: true, report }
    } catch (e) {
        console.error(e)
        return { error: 'Error al generar reporte.' }
    }
}
