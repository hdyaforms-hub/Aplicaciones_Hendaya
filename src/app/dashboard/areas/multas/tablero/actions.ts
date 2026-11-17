'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import * as XLSX from 'xlsx'

export interface MetricasConsolidadasDTO {
    // 1. Resumen Financiero y de Litigios
    montoTotalNotificadoUtm: number
    montoTotalImpugnadoUtm: number
    montoTotalRebajadoUtm: number
    montoTotalRatificadoUtm: number
    tasaExitoLegalPct: number

    // 2. Conteo de Actas y Estados
    totalActasCalculadas: number
    totalDescargosPresentados: number
    totalResuelvesEmitidos: number
    totalPlanesAccion: number
    planesAccionCerradosPct: number

    // 3. Distribución por Aspecto (A - P)
    distribucionAspectos: {
        aspecto: string
        totalUtm: number
        cantidadFolios: number
    }[]

    // 4. Semáforo de Cumplimiento por Sucursal
    avancePorSucursal: {
        sucursal: string
        totalPlanes: number
        planesCerrados: number
        porcentajeCumplimiento: number
        montoNotificadoUtm: number
    }[]

    // 5. Conciliación con JUNAEB (REX)
    conciliacionJunaeb: {
        totalItemsRex: number
        coincide: number
        diferencias: number
        soloJunaeb: number
    }

    // 6. Asistencia de Inteligencia Artificial (C10)
    iaMetricas: {
        totalConsultas: number
        costoTotalUsd: number
        ahorroEstimadoUtm: number
    }
}

export interface FilaReporteMaestroDTO {
    folio: string
    fechaSupervision: string
    rbd: number | null
    sucursal: string
    licitacion: string
    aspecto: string
    descripcionAspecto: string
    montoNotificadoUtm: number
    montoImpugnadoUtm: number
    montoRebajadoUtm: number
    estadoDescargo: string
    resolucionJunaeb: string
    dictamenResuelve: string
    estadoPlanAccion: string
    medidaCorrectiva: string
}

/**
 * Obtener métricas e indicadores del Tablero Consolidado Ejecutivo
 */
export async function getMetricasTableroConsolidadoAction(filtros?: {
    anio?: number
    sucursal?: string
    licitacion?: string
}): Promise<{
    success: boolean
    data?: MetricasConsolidadasDTO
    error?: string
}> {
    try {
        const session = await getSession()
        if (!session?.user) {
            return { success: false, error: 'Sesión no iniciada' }
        }

        // 1. Actas y cálculos de multas
        const cabs = await prisma.multas_Elementos_Esenciales_Cab.findMany({
            include: {
                detalles: true
            }
        })

        // Filtro en memoria por año si se especifica
        const cabsFiltradas = cabs.filter(c => {
            if (filtros?.anio && c.fechaSupervision) {
                if (new Date(c.fechaSupervision).getFullYear() !== Number(filtros.anio)) return false
            }
            if (filtros?.licitacion && filtros.licitacion !== 'TODAS') {
                if (c.licitacion !== filtros.licitacion) return false
            }
            return true
        })

        let montoTotalNotificado = 0
        const foliosValidos = new Set<string>()
        const aspectoTotals: Record<string, { totalUtm: number; folios: Set<string> }> = {}

        for (const cab of cabsFiltradas) {
            foliosValidos.add(cab.folioOriginal)
            for (const d of cab.detalles) {
                if (d.montoMulta > 0) {
                    montoTotalNotificado += d.montoMulta
                    const asp = d.letraAspecto.toUpperCase()
                    if (!aspectoTotals[asp]) {
                        aspectoTotals[asp] = { totalUtm: 0, folios: new Set() }
                    }
                    aspectoTotals[asp].totalUtm += d.montoMulta
                    aspectoTotals[asp].folios.add(cab.folioOriginal)
                }
            }
        }

        const distribucionAspectos = Object.entries(aspectoTotals)
            .map(([aspecto, val]) => ({
                aspecto,
                totalUtm: Number(val.totalUtm.toFixed(2)),
                cantidadFolios: val.folios.size
            }))
            .sort((a, b) => b.totalUtm - a.totalUtm)

        // 2. Descargos y Resuelves (C7)
        const descargos = await prisma.multas_Descargo_Formal.findMany({
            include: {
                resuelves: true,
                folios: true
            }
        }).catch(() => [])

        let montoTotalImpugnado = 0
        let montoTotalRebajado = 0
        let totalResuelves = 0

        for (const desc of descargos) {
            montoTotalImpugnado += desc.montoImpugnadoUtm || 0
            for (const r of desc.resuelves) {
                totalResuelves++
                montoTotalRebajado += r.montoRebajadoUtm || 0
            }
        }

        const montoTotalRatificado = Math.max(0, montoTotalImpugnado - montoTotalRebajado)
        const tasaExitoLegalPct = montoTotalImpugnado > 0
            ? Math.round((montoTotalRebajado / montoTotalImpugnado) * 100)
            : 0

        // 3. Planes de Acción Operativos (C9)
        const planes = await prisma.multas_Plan_Accion.findMany().catch(() => [])
        const totalPlanes = planes.length
        const planesCerrados = planes.filter(p => p.estado === 'CERRADO' || p.estado === 'VALIDADO').length
        const planesAccionCerradosPct = totalPlanes > 0
            ? Math.round((planesCerrados / totalPlanes) * 100)
            : 0

        // Agrupación de planes por sucursal
        const sucursalesMap: Record<string, { total: number; cerrados: number; monto: number }> = {}
        for (const p of planes) {
            const suc = p.sucursal || 'Central / Matriz'
            if (!sucursalesMap[suc]) {
                sucursalesMap[suc] = { total: 0, cerrados: 0, monto: 0 }
            }
            sucursalesMap[suc].total++
            if (p.estado === 'CERRADO' || p.estado === 'VALIDADO') {
                sucursalesMap[suc].cerrados++
            }
        }

        const avancePorSucursal = Object.entries(sucursalesMap).map(([sucursal, data]) => ({
            sucursal,
            totalPlanes: data.total,
            planesCerrados: data.cerrados,
            porcentajeCumplimiento: data.total > 0 ? Math.round((data.cerrados / data.total) * 100) : 0,
            montoNotificadoUtm: 0
        })).sort((a, b) => b.totalPlanes - a.totalPlanes)

        // 4. Conciliación REX (C6)
        const notifItems = await prisma.multas_Notificacion_Item.findMany().catch(() => [])
        const totalItemsRex = notifItems.length
        const coincideRex = notifItems.filter(i => i.estadoConciliacion === 'COINCIDE').length
        const diferenciasRex = notifItems.filter(i => i.estadoConciliacion === 'DIFERENCIA_MONTO').length
        const soloJunaebRex = notifItems.filter(i => i.estadoConciliacion === 'SOLO_JUNAEB').length

        // 5. Métricas de IA (C10)
        const logsIa = await prisma.multas_Log_Consumo_IA.findMany().catch(() => [])
        const costoTotalIaUsd = logsIa.reduce((acc, curr) => acc + (curr.costoEstimadoUsd || 0), 0)

        return {
            success: true,
            data: {
                montoTotalNotificadoUtm: Number(montoTotalNotificado.toFixed(2)),
                montoTotalImpugnadoUtm: Number(montoTotalImpugnado.toFixed(2)),
                montoTotalRebajadoUtm: Number(montoTotalRebajado.toFixed(2)),
                montoTotalRatificadoUtm: Number(montoTotalRatificado.toFixed(2)),
                tasaExitoLegalPct,
                totalActasCalculadas: foliosValidos.size,
                totalDescargosPresentados: descargos.length,
                totalResuelvesEmitidos: totalResuelves,
                totalPlanesAccion: totalPlanes,
                planesAccionCerradosPct,
                distribucionAspectos,
                avancePorSucursal,
                conciliacionJunaeb: {
                    totalItemsRex,
                    coincide: coincideRex,
                    diferencias: diferenciasRex,
                    soloJunaeb: soloJunaebRex
                },
                iaMetricas: {
                    totalConsultas: logsIa.length,
                    costoTotalUsd: Number(costoTotalIaUsd.toFixed(4)),
                    ahorroEstimadoUtm: Number((montoTotalRebajado * 0.4).toFixed(1))
                }
            }
        }
    } catch (error: any) {
        console.error('Error al obtener metricas del tablero consolidado:', error)
        return { success: false, error: error.message || 'Error al compilar métricas' }
    }
}

/**
 * Compilar datos para la descarga del Reporte Maestro a Excel
 */
export async function getReporteMaestroExcelDataAction(): Promise<{
    success: boolean
    data?: FilaReporteMaestroDTO[]
    error?: string
}> {
    try {
        const session = await getSession()
        if (!session?.user) {
            return { success: false, error: 'Sesión no iniciada' }
        }

        // 1. Obtener todas las actas calculadas con detalles
        const actas = await prisma.multas_Elementos_Esenciales_Cab.findMany({
            include: {
                detalles: true
            },
            orderBy: { fechaSupervision: 'desc' }
        })

        // 2. Obtener mapas auxiliares de Descargos, Planes y Colegios
        const foliosDescargo = await prisma.multas_Descargo_Folio.findMany({
            include: {
                descargo: {
                    include: {
                        resuelves: true
                    }
                }
            }
        }).catch(() => [])

        const descargoPorFolio = new Map<string, any>()
        for (const fd of foliosDescargo) {
            descargoPorFolio.set(fd.folio, fd)
        }

        const planes = await prisma.multas_Plan_Accion.findMany({
            include: { items: true }
        }).catch(() => [])

        const planPorFolio = new Map<string, any>()
        for (const p of planes) {
            planPorFolio.set(p.folio, p)
        }

        const colegios = await prisma.colegios.findMany({
            select: { colRBD: true, sucursal: true, nombreEstablecimiento: true }
        }).catch(() => [])

        const colegioMap = new Map<number, { sucursal: string; nombre: string }>()
        for (const col of colegios) {
            colegioMap.set(col.colRBD, { sucursal: col.sucursal || 'Central', nombre: col.nombreEstablecimiento })
        }

        const filas: FilaReporteMaestroDTO[] = []

        for (const acta of actas) {
            const colInfo = acta.rbd ? colegioMap.get(acta.rbd) : null
            const sucursalNombre = colInfo?.sucursal || 'Central'
            const descargoFolio = descargoPorFolio.get(acta.folioOriginal)
            const planActa = planPorFolio.get(acta.folioOriginal)

            for (const d of acta.detalles) {
                if (d.montoMulta <= 0) continue

                const itemPlan = planActa?.items?.find((it: any) => it.aspecto === d.letraAspecto)

                filas.push({
                    folio: acta.folioOriginal,
                    fechaSupervision: acta.fechaSupervision ? acta.fechaSupervision.toISOString().split('T')[0] : '',
                    rbd: acta.rbd,
                    sucursal: sucursalNombre,
                    licitacion: acta.licitacion || 'General',
                    aspecto: `Aspecto ${d.letraAspecto}`,
                    descripcionAspecto: d.descripcion || 'Incumplimiento normativo',
                    montoNotificadoUtm: Number(d.montoMulta.toFixed(2)),
                    montoImpugnadoUtm: descargoFolio ? Number(descargoFolio.montoImpugnadoUtm.toFixed(2)) : 0,
                    montoRebajadoUtm: descargoFolio ? Number(descargoFolio.montoRebajadoUtm.toFixed(2)) : 0,
                    estadoDescargo: descargoFolio?.descargo?.estado || 'NO_IMPUGNADO',
                    resolucionJunaeb: descargoFolio?.descargo?.numeroResolucion || 'Pendiente',
                    dictamenResuelve: descargoFolio?.descargo?.resuelves?.[0]?.dictamen || 'EN_TRAMITE',
                    estadoPlanAccion: planActa?.estado || 'SIN_PLAN',
                    medidaCorrectiva: itemPlan?.accionTomada || 'Sin acción registrada'
                })
            }
        }

        await logAuditAction({
            username: (session.user.username || session.user.email) as string,
            userId: session.user.id || null,
            action: 'EXPORTAR_REPORTE_MAESTRO_MULTAS',
            modulo: 'Multas · Tablero Consolidado',
            detalle: `Se generó el Reporte Maestro Consolidado de Multas (${filas.length} registros analizados).`
        })

        return { success: true, data: filas }
    } catch (error: any) {
        console.error('Error al compilar reporte maestro:', error)
        return { success: false, error: error.message || 'Error al compilar reporte maestro' }
    }
}
