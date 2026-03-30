'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { isBefore, isAfter, startOfYear, endOfYear } from 'date-fns'
import { FIELD_MAPPING, PROBLEM_VALUES } from '../mitigacion/mapping'

export async function getEstadoAvanceData() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_estado_avance')) {
        return { error: 'Sin permisos.' }
    }

    try {
        const configSemestre = await prisma.matrizConfigSemestre.findUnique({ where: { anio: 2026 } })
        if (!configSemestre) return { error: 'Debe configurar la fecha de corte en Colegios Activos.' }
        
        const cutoff = new Date(configSemestre.fechaFin1)
        
        // 1. Obtener todos los colegios adjudicados (activos)
        const adjudicados = await prisma.colegiosMatriz.findMany({ where: { isActive: true } })
        
        // 2. Obtener todas las matrices del 2026
        const matrices = await prisma.matrizRiesgo2026.findMany({
            where: {
                createdAt: {
                    gte: startOfYear(new Date('2026-01-01')),
                    lte: endOfYear(new Date('2026-12-31'))
                }
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
                    const d = new Date(m.createdAt)
                    return sem === 1 ? (isBefore(d, cutoff) || d.getTime() === cutoff.getTime()) : isAfter(d, cutoff)
                })

                // Para Mitigación (Segundo Semestre abarca todo el año - YTD)
                const matricesUT_Mitigacion = matrices.filter(m => {
                    if (m.ut !== ut) return false
                    const d = new Date(m.createdAt)
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

                    Object.entries(FIELD_MAPPING).forEach(([preguntaId, fieldName]) => {
                        const val = (m as any)[fieldName]
                        if (PROBLEM_VALUES.includes(val)) {
                            hasProblems = true
                            totalItemsLevantados++
                            const mit = mitigaciones.find(mit => mit.matrizId === m.id.toString() && mit.preguntaId === preguntaId)
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
