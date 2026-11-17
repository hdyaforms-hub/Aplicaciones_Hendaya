'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { checkMultasPermission, getUserEffectiveRbds } from '@/lib/multas/permisos'
import { logAuditAction } from '@/lib/audit'
import * as XLSX from 'xlsx'

export interface MetricasConsolidadasDTO {
    // 1. Resumen Financiero y de Litigios
    montoTotalCalculadoUtm: number
    montoTotalCalculadoPesos: number
    montoTotalNotificadoRexUtm: number
    montoTotalNotificadoUtm: number // Mantenido para retrocompatibilidad
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
        totalPesos: number
        cantidadFolios: number
    }[]

    // 4. Semáforo de Cumplimiento por Sucursal
    avancePorSucursal: {
        sucursal: string
        totalPlanes: number
        planesCerrados: number
        porcentajeCumplimiento: number
        montoCalculadoUtm: number
        montoNotificadoUtm: number
        montoCalculadoPesos: number
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
    montoCalculadoPesos: number
    montoCalculadoUtm?: number
    montoNotificadoUtm: number
    montoImpugnadoUtm: number
    montoRebajadoUtm: number
    estadoDescargo: string
    resolucionJunaeb: string
    dictamenResuelve: string
    estadoPlanAccion: string
    medidaCorrectiva: string
}

// Función auxiliar privada para resolver el valor UTM histórico por mes/año de supervisión
async function getUtmLookup() {
    const utms = await prisma.uTM.findMany({
        orderBy: [{ anho: 'desc' }, { mes: 'desc' }]
    }).catch(() => [])

    const utmMap = new Map<string, number>()
    for (const u of utms) {
        utmMap.set(`${u.anho}-${u.mes}`, u.monto)
    }

    const latestMonto = utms[0]?.monto || 65000

    return (fecha: Date | string | null | undefined): number => {
        if (!fecha) return latestMonto
        const d = new Date(fecha)
        if (isNaN(d.getTime())) return latestMonto
        const anho = d.getFullYear()
        const mes = d.getMonth() + 1
        return utmMap.get(`${anho}-${mes}`) || latestMonto
    }
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
        const { authorized, user } = await checkMultasPermission('view_tablero_multas_consolidado')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para visualizar el tablero consolidado de multas' }
        }

        // Obtener asignación de RBDs si está restringido
        const allowedRbds = await getUserEffectiveRbds()

        // 1. Obtener colegios para mapear RBD -> Sucursal
        const colegios = await prisma.colegios.findMany({
            select: { colRBD: true, sucursal: true }
        }).catch(() => [])

        const rbdSucursalMap = new Map<number, string>()
        for (const col of colegios) {
            if (col.sucursal) {
                rbdSucursalMap.set(col.colRBD, col.sucursal)
            }
        }

        // 2. Actas y cálculos de multas
        const cabs = await prisma.multas_Elementos_Esenciales_Cab.findMany({
            include: {
                detalles: true
            }
        })

        // Filtro integral por año, licitación, sucursal y RBD permitido
        const cabsFiltradas = cabs.filter(c => {
            if (allowedRbds !== null && !allowedRbds.includes(c.rbd)) {
                return false
            }
            if (filtros?.anio && c.fechaSupervision) {
                if (new Date(c.fechaSupervision).getFullYear() !== Number(filtros.anio)) return false
            }
            if (filtros?.licitacion && filtros.licitacion !== 'TODAS') {
                if (c.licitacion !== filtros.licitacion) return false
            }
            if (filtros?.sucursal && filtros.sucursal !== 'TODAS') {
                const suc = rbdSucursalMap.get(c.rbd) || 'Central / Matriz'
                if (suc !== filtros.sucursal) return false
            }
            return true
        })

        const getUtm = await getUtmLookup()

        let montoTotalCalculadoPesos = 0
        let montoTotalCalculadoUtm = 0
        const foliosValidos = new Set<string>()
        const foliosFiltradosList = cabsFiltradas.map(c => c.folioOriginal)
        const aspectoTotals: Record<string, { totalPesos: number; totalUtm: number; folios: Set<string> }> = {}
        const sucursalesMontoMap: Record<string, { pesos: number; utm: number }> = {}

        for (const cab of cabsFiltradas) {
            foliosValidos.add(cab.folioOriginal)
            const suc = rbdSucursalMap.get(cab.rbd) || 'Central / Matriz'
            const utmVal = getUtm(cab.fechaSupervision)

            if (!sucursalesMontoMap[suc]) {
                sucursalesMontoMap[suc] = { pesos: 0, utm: 0 }
            }

            for (const d of cab.detalles) {
                if (d.montoMulta > 0) {
                    const utmDetalle = utmVal > 0 ? (d.montoMulta / utmVal) : 0
                    montoTotalCalculadoPesos += d.montoMulta
                    montoTotalCalculadoUtm += utmDetalle

                    sucursalesMontoMap[suc].pesos += d.montoMulta
                    sucursalesMontoMap[suc].utm += utmDetalle

                    const asp = d.letraAspecto.toUpperCase()
                    if (!aspectoTotals[asp]) {
                        aspectoTotals[asp] = { totalPesos: 0, totalUtm: 0, folios: new Set() }
                    }
                    aspectoTotals[asp].totalPesos += d.montoMulta
                    aspectoTotals[asp].totalUtm += utmDetalle
                    aspectoTotals[asp].folios.add(cab.folioOriginal)
                }
            }
        }

        const distribucionAspectos = Object.entries(aspectoTotals)
            .map(([aspecto, val]) => ({
                aspecto,
                totalUtm: Number(val.totalUtm.toFixed(2)),
                totalPesos: Math.round(val.totalPesos),
                cantidadFolios: val.folios.size
            }))
            .sort((a, b) => b.totalPesos - a.totalPesos)

        // 3. Descargos y Resuelves (C7)
        const descargos = await prisma.multas_Descargo_Formal.findMany({
            where: {
                ...(foliosFiltradosList.length > 0 ? {
                    folios: {
                        some: {
                            folio: { in: foliosFiltradosList }
                        }
                    }
                } : {})
            },
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

        // 4. Planes de Acción Operativos (C9)
        const planes = await prisma.multas_Plan_Accion.findMany({
            where: {
                ...(filtros?.sucursal && filtros.sucursal !== 'TODAS' ? { sucursal: filtros.sucursal } : {}),
                ...(allowedRbds !== null ? { rbd: { in: allowedRbds } } : {})
            }
        }).catch(() => [])

        const totalPlanes = planes.length
        const planesCerrados = planes.filter(p => p.estado === 'CERRADO' || p.estado === 'VALIDADO').length
        const planesAccionCerradosPct = totalPlanes > 0
            ? Math.round((planesCerrados / totalPlanes) * 100)
            : 0

        // Agrupación de planes por sucursal
        const sucursalesMap: Record<string, { total: number; cerrados: number }> = {}
        for (const p of planes) {
            const suc = p.sucursal || 'Central / Matriz'
            if (!sucursalesMap[suc]) {
                sucursalesMap[suc] = { total: 0, cerrados: 0 }
            }
            sucursalesMap[suc].total++
            if (p.estado === 'CERRADO' || p.estado === 'VALIDADO') {
                sucursalesMap[suc].cerrados++
            }
        }

        // Unir con sucursales que tengan montos calculados
        for (const suc of Object.keys(sucursalesMontoMap)) {
            if (!sucursalesMap[suc]) {
                sucursalesMap[suc] = { total: 0, cerrados: 0 }
            }
        }

        const avancePorSucursal = Object.entries(sucursalesMap).map(([sucursal, data]) => {
            const montoData = sucursalesMontoMap[sucursal] || { pesos: 0, utm: 0 }
            return {
                sucursal,
                totalPlanes: data.total,
                planesCerrados: data.cerrados,
                porcentajeCumplimiento: data.total > 0 ? Math.round((data.cerrados / data.total) * 100) : 0,
                montoCalculadoUtm: Number(montoData.utm.toFixed(2)),
                montoNotificadoUtm: Number(montoData.utm.toFixed(2)),
                montoCalculadoPesos: Math.round(montoData.pesos)
            }
        }).sort((a, b) => b.montoCalculadoPesos - a.montoCalculadoPesos)

        // 5. Conciliación REX (C6) y Notificación oficial JUNAEB
        const [notifItems, rexList] = await Promise.all([
            prisma.multas_Notificacion_Item.findMany().catch(() => []),
            prisma.multas_Notificacion_REX.findMany({
                select: { montoTotalNotificado: true, montoTotalNotificadoPesos: true }
            }).catch(() => [])
        ])

        const totalItemsRex = notifItems.length
        const coincideRex = notifItems.filter(i => i.estadoConciliacion === 'COINCIDE').length
        const diferenciasRex = notifItems.filter(i => i.estadoConciliacion === 'DIFERENCIA_MONTO').length
        const soloJunaebRex = notifItems.filter(i => i.estadoConciliacion === 'SOLO_JUNAEB').length
        const montoTotalNotificadoRexUtm = rexList.reduce((acc, curr) => acc + (curr.montoTotalNotificado || 0), 0)

        // 6. Métricas de IA (C10)
        const logsIa = await prisma.multas_Log_Consumo_IA.findMany().catch(() => [])
        const costoTotalIaUsd = logsIa.reduce((acc, curr) => acc + (curr.costoEstimadoUsd || 0), 0)

        return {
            success: true,
            data: {
                montoTotalCalculadoUtm: Number(montoTotalCalculadoUtm.toFixed(2)),
                montoTotalCalculadoPesos: Math.round(montoTotalCalculadoPesos),
                montoTotalNotificadoRexUtm: Number(montoTotalNotificadoRexUtm.toFixed(2)),
                montoTotalNotificadoUtm: montoTotalNotificadoRexUtm > 0
                    ? Number(montoTotalNotificadoRexUtm.toFixed(2))
                    : Number(montoTotalCalculadoUtm.toFixed(2)),
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
                    ahorroEstimadoUtm: Number(montoTotalRebajado.toFixed(2)) // Ahorro real de rebajas logradas
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
        const { authorized, user } = await checkMultasPermission('export_multas_consolidado')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para exportar el reporte consolidado de multas' }
        }

        const allowedRbds = await getUserEffectiveRbds()

        // 1. Obtener todas las actas calculadas con detalles
        const actas = await prisma.multas_Elementos_Esenciales_Cab.findMany({
            where: {
                ...(allowedRbds !== null ? { rbd: { in: allowedRbds } } : {})
            },
            include: {
                detalles: true
            },
            orderBy: { fechaSupervision: 'desc' }
        })

        // 2. Obtener mapas auxiliares de Descargos por folio y aspecto
        const foliosDescargo = await prisma.multas_Descargo_Folio.findMany({
            include: {
                descargo: {
                    include: {
                        resuelves: true,
                        notificacion: true
                    }
                }
            }
        }).catch(() => [])

        // Mapear por clave única: `${folio}_${aspecto}` para no duplicar montos
        const descargoPorFolioAspecto = new Map<string, any>()
        for (const fd of foliosDescargo) {
            const key = `${fd.folio}_${fd.aspecto.toUpperCase()}`
            descargoPorFolioAspecto.set(key, fd)
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

        const getUtm = await getUtmLookup()
        const filas: FilaReporteMaestroDTO[] = []

        for (const acta of actas) {
            const colInfo = acta.rbd ? colegioMap.get(acta.rbd) : null
            const sucursalNombre = colInfo?.sucursal || 'Central'
            const planActa = planPorFolio.get(acta.folioOriginal)
            const utmVal = getUtm(acta.fechaSupervision)

            for (const d of acta.detalles) {
                if (d.montoMulta <= 0) continue

                const aspClean = d.letraAspecto.toUpperCase()
                const key = `${acta.folioOriginal}_${aspClean}`
                const descargoFolio = descargoPorFolioAspecto.get(key)
                const itemPlan = planActa?.items?.find((it: any) => it.aspecto.toUpperCase() === aspClean)
                const utmDetalle = utmVal > 0 ? Number((d.montoMulta / utmVal).toFixed(2)) : 0

                filas.push({
                    folio: acta.folioOriginal,
                    fechaSupervision: acta.fechaSupervision ? acta.fechaSupervision.toISOString().split('T')[0] : '',
                    rbd: acta.rbd,
                    sucursal: sucursalNombre,
                    licitacion: acta.licitacion || 'General',
                    aspecto: `Aspecto ${d.letraAspecto}`,
                    descripcionAspecto: d.descripcion || 'Incumplimiento normativo',
                    montoCalculadoPesos: Math.round(d.montoMulta),
                    montoCalculadoUtm: utmDetalle,
                    montoNotificadoUtm: utmDetalle,
                    montoImpugnadoUtm: descargoFolio ? Number(descargoFolio.montoImpugnadoUtm.toFixed(2)) : 0,
                    montoRebajadoUtm: descargoFolio ? Number(descargoFolio.montoRebajadoUtm.toFixed(2)) : 0,
                    estadoDescargo: descargoFolio?.descargo?.estado || 'NO_IMPUGNADO',
                    resolucionJunaeb: descargoFolio?.descargo?.notificacion?.numeroResolucion || 'Pendiente',
                    dictamenResuelve: descargoFolio?.descargo?.resuelves?.[0]?.dictamen || 'EN_TRAMITE',
                    estadoPlanAccion: planActa?.estado || 'SIN_PLAN',
                    medidaCorrectiva: itemPlan?.accionTomada || 'Sin acción registrada'
                })
            }
        }

        await logAuditAction({
            username: (user.username || user.email) as string,
            userId: user.id || null,
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
