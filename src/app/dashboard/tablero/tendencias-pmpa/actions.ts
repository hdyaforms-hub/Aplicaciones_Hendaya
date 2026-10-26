'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { logAuditAction } from '@/lib/audit'

export type TendenciasFilterParams = {
    ano?: number
    mes?: number
    sucursal?: string
    programa?: string
    servicio?: string
    rbd?: number
}

const MESES_NOMBRES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const MESES_ABR = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
]

export const SERVICIOS_COLORES: Record<string, string> = {
    'DESAYUNO': '#F59E0B',   // Ámbar cálido / Sol
    'ALMUERZO': '#10B981',   // Esmeralda / Nutrición
    'ONCE': '#0EA5E9',       // Sky / Cyan Hendaya
    'COLACIÓN': '#8B5CF6',   // Violeta
    'COLACION': '#8B5CF6',   // Violeta
    'CENA': '#6366F1',       // Índigo
    'OTROS': '#94A3B8'       // Slate neutro
}

export type TimelinePoint = {
    periodoKey: string       // "2026-04"
    label: string            // "Abr 2026"
    mesNombre: string        // "Abril"
    anio: number
    mes: number
    total: number
    desayuno: number
    almuerzo: number
    once: number
    colacion: number
    cena: number
    otros: number
    deltaPrevio: number      // Diferencia respecto al mes anterior cronológico
    deltaPct: number         // Variación %
}

export type ServicioAnalysis = {
    servicio: string
    color: string
    total: number
    porcentaje: number
    mesPico: {
        mesNombre: string
        anio: number
        cantidad: number
    }
    porMes: {
        label: string
        mesNombre: string
        cantidad: number
    }[]
}

export type ProgramaAnalysis = {
    programa: string
    total: number
    porcentaje: number
    registros: number
}

export type RbdRankingItem = {
    rbd: number
    nombre: string
    sucursal: string
    totalRaciones: number
    desayuno: number
    almuerzo: number
    once: number
    colacion: number
    cena: number
}

export type SucursalMatrizItem = {
    sucursal: string
    meses: Record<string, number>
    total: number
}

export type TendenciasDashboardData = {
    kpis: {
        totalRaciones: number
        totalRegistros: number
        colegiosConCarga: number
        mesPico: {
            mesNombre: string
            anio: number
            cantidad: number
        } | null
        servicioPredominante: {
            servicio: string
            cantidad: number
            porcentaje: number
            mesRecord: string
            mesRecordCant: number
        } | null
        variacionIntermensual: {
            absoluta: number
            porcentaje: number
            direccion: 'up' | 'down' | 'flat'
            periodoComparado: string
        } | null
        promedioMensualRaciones: number
    }
    timeline: TimelinePoint[]
    serviciosAnalisis: ServicioAnalysis[]
    programasAnalisis: ProgramaAnalysis[]
    rankingRbds: RbdRankingItem[]
    matrizSucursales: SucursalMatrizItem[]
    filtrosDisponibles: {
        anos: number[]
        meses: { numero: number; nombre: string }[]
        sucursales: string[]
        programas: string[]
        servicios: string[]
        colegios: { rbd: number; label: string }[]
    }
    permisos: {
        isRestrictedByRbd: boolean
        assignedRbdsCount: number | null
    }
}

/**
 * Obtiene métricas analíticas avanzadas para el tablero de Tendencias y Oscilación PMPA
 */
export async function fetchTendenciasPmpaData(filters?: TendenciasFilterParams): Promise<TendenciasDashboardData> {
    const session = await getSession()
    if (!session || !session.user) {
        throw new Error('No autorizado. Sesión no válida.')
    }

    const isAdmin = session.user.role?.name?.toLowerCase().includes('admin') ||
                    session.user.role?.name?.toLowerCase().includes('gerencia')
    const permissions = session.user.role?.permissions || []

    if (!isAdmin && !permissions.includes('view_tablero_tendencias_pmpa')) {
        throw new Error('No posees permisos para acceder al Tablero de Tendencias y Oscilación PMPA.')
    }

    // Evaluación estricta de RBDs por perfil de usuario
    const userEffectiveRbds = await getUserEffectiveRbds()
    const isRestrictedByRbd = userEffectiveRbds !== null
    const assignedRbds = isRestrictedByRbd ? userEffectiveRbds : null

    // Registro de auditoría
    try {
        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'VISUALIZAR_TABLERO_TENDENCIAS_PMPA',
            modulo: 'Tableros y Avances',
            detalle: `Consulta tablero Tendencias y Oscilación PMPA (Filtros: Año=${filters?.ano || 'Todos'}, Mes=${filters?.mes || 'Todos'}, Sucursal=${filters?.sucursal || 'Todas'}, Programa=${filters?.programa || 'Todos'}, RBD=${filters?.rbd || 'Todos'})`
        })
    } catch (e) {
        console.error('Error registrando auditoría en tendencias PMPA:', e)
    }

    // Si el usuario tiene restricción de perfil y 0 RBDs asignados, retornar estado vacío seguro
    if (isRestrictedByRbd && assignedRbds && assignedRbds.length === 0) {
        return {
            kpis: {
                totalRaciones: 0,
                totalRegistros: 0,
                colegiosConCarga: 0,
                mesPico: null,
                servicioPredominante: null,
                variacionIntermensual: null,
                promedioMensualRaciones: 0
            },
            timeline: [],
            serviciosAnalisis: [],
            programasAnalisis: [],
            rankingRbds: [],
            matrizSucursales: [],
            filtrosDisponibles: {
                anos: [],
                meses: [],
                sucursales: [],
                programas: [],
                servicios: [],
                colegios: []
            },
            permisos: {
                isRestrictedByRbd: true,
                assignedRbdsCount: 0
            }
        }
    }

    // Mapa de UT a Sucursal
    const uts = await prisma.uT.findMany({
        include: { sucursal: true }
    })
    const utToSucursal = new Map<number, string>()
    const sucursalToUts = new Map<string, number[]>()

    uts.forEach(u => {
        if (u.sucursal?.nombre) {
            const suc = u.sucursal.nombre.trim()
            utToSucursal.set(u.codUT, suc)
            if (!sucursalToUts.has(suc)) sucursalToUts.set(suc, [])
            sucursalToUts.get(suc)!.push(u.codUT)
        }
    })

    // Resolver UTs si hay filtro de sucursal
    let allowedUtsBySucursal: number[] | null = null
    if (filters?.sucursal) {
        allowedUtsBySucursal = sucursalToUts.get(filters.sucursal) || []
    }

    // Cláusula base WHERE para Raciones
    const baseWhere: any = {}

    // Restricción por perfil de usuario
    if (isRestrictedByRbd && assignedRbds && assignedRbds.length > 0) {
        if (filters?.rbd) {
            // El usuario seleccionó un RBD, validar que esté en sus asignados
            baseWhere.rbd = assignedRbds.includes(Number(filters.rbd)) ? Number(filters.rbd) : { in: assignedRbds }
        } else {
            baseWhere.rbd = { in: assignedRbds }
        }
    } else if (filters?.rbd) {
        baseWhere.rbd = Number(filters.rbd)
    }

    if (filters?.ano) {
        baseWhere.anio = Number(filters.ano)
    }

    if (filters?.mes) {
        baseWhere.mes = Number(filters.mes)
    }

    if (filters?.programa) {
        baseWhere.programa = String(filters.programa).trim()
    }

    if (filters?.servicio) {
        baseWhere.servicio = String(filters.servicio).trim()
    }

    if (allowedUtsBySucursal !== null) {
        baseWhere.ut = { in: allowedUtsBySucursal }
    }

    // 1. Obtener opciones disponibles para filtros
    const rbdOptionsConstraint = isRestrictedByRbd && assignedRbds ? { rbd: { in: assignedRbds } } : {}
    
    // Períodos disponibles
    const periodosRaw = await prisma.raciones.groupBy({
        by: ['anio', 'mes'],
        where: rbdOptionsConstraint,
        orderBy: [{ anio: 'desc' }, { mes: 'desc' }]
    })
    const availableAnos = Array.from(new Set(periodosRaw.map(p => p.anio))).sort((a, b) => b - a)
    const availableMesesNums = Array.from(new Set(periodosRaw.map(p => p.mes))).sort((a, b) => a - b)
    const availableMeses = availableMesesNums.map(m => ({
        numero: m,
        nombre: MESES_NOMBRES[m - 1] || `Mes ${m}`
    }))

    // Programas disponibles
    const programasRaw = await prisma.raciones.groupBy({
        by: ['programa'],
        where: rbdOptionsConstraint,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
    })
    const availableProgramas = programasRaw.map(p => p.programa).filter(Boolean)

    // Servicios disponibles
    const serviciosRaw = await prisma.raciones.groupBy({
        by: ['servicio'],
        where: rbdOptionsConstraint,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
    })
    const availableServicios = serviciosRaw.map(s => s.servicio).filter(Boolean)

    // Sucursales disponibles
    const availableSucursales = Array.from(sucursalToUts.keys()).sort()

    // Colegios disponibles para el selector
    const rbdsConMovimiento = await prisma.raciones.groupBy({
        by: ['rbd'],
        where: rbdOptionsConstraint,
        take: 300
    })
    const distinctRbdNums = rbdsConMovimiento.map(r => r.rbd)

    const colegiosDb = await prisma.colegios.findMany({
        where: { colRBD: { in: distinctRbdNums } },
        select: { colRBD: true, nombreEstablecimiento: true }
    })
    const colegioNombreMap = new Map<number, string>()
    colegiosDb.forEach(c => {
        colegioNombreMap.set(c.colRBD, c.nombreEstablecimiento)
    })

    // También rescatar locaciones de raciones si falta el nombre en Colegios
    if (colegioNombreMap.size < distinctRbdNums.length) {
        const racionesLocaciones = await prisma.raciones.findMany({
            where: { rbd: { in: distinctRbdNums } },
            select: { rbd: true, locacion: true },
            distinct: ['rbd']
        })
        racionesLocaciones.forEach(r => {
            if (!colegioNombreMap.has(r.rbd) && r.locacion) {
                // Limpiar posibles prefijos como "1 ESCUELA ..."
                const cleaned = r.locacion.replace(/^\d+\s+/, '').trim()
                colegioNombreMap.set(r.rbd, cleaned || `Colegio RBD ${r.rbd}`)
            }
        })
    }

    const availableColegios = distinctRbdNums.map(num => ({
        rbd: num,
        label: `${num} - ${colegioNombreMap.get(num) || 'Establecimiento ' + num}`
    })).sort((a, b) => a.rbd - b.rbd)

    // 2. Consulta de datos principales agrupados por período y servicio
    const datosPeriodoServicio = await prisma.raciones.groupBy({
        by: ['anio', 'mes', 'servicio'],
        where: baseWhere,
        _sum: { cantidad: true },
        _count: { id: true },
        orderBy: [{ anio: 'asc' }, { mes: 'asc' }]
    })

    // 3. Consulta de datos agrupados por programa
    const datosProgramas = await prisma.raciones.groupBy({
        by: ['programa'],
        where: baseWhere,
        _sum: { cantidad: true },
        _count: { id: true },
        orderBy: { _sum: { cantidad: 'desc' } }
    })

    // 4. Consulta de datos agrupados por RBD (ranking)
    const datosRbd = await prisma.raciones.groupBy({
        by: ['rbd', 'ut'],
        where: baseWhere,
        _sum: { cantidad: true },
        orderBy: { _sum: { cantidad: 'desc' } },
        take: 50
    })

    // Conteo global de registros y raciones
    let grandTotalRaciones = 0
    let grandTotalRegistros = 0
    const distinctPeriodosSet = new Set<string>()
    const periodosTotalsMap = new Map<string, {
        anio: number
        mes: number
        total: number
        desayuno: number
        almuerzo: number
        once: number
        colacion: number
        cena: number
        otros: number
    }>()

    for (const row of datosPeriodoServicio) {
        const cant = row._sum.cantidad || 0
        const count = row._count.id || 0
        grandTotalRaciones += cant
        grandTotalRegistros += count

        const key = `${row.anio}-${String(row.mes).padStart(2, '0')}`
        distinctPeriodosSet.add(key)

        if (!periodosTotalsMap.has(key)) {
            periodosTotalsMap.set(key, {
                anio: row.anio,
                mes: row.mes,
                total: 0,
                desayuno: 0,
                almuerzo: 0,
                once: 0,
                colacion: 0,
                cena: 0,
                otros: 0
            })
        }

        const pData = periodosTotalsMap.get(key)!
        pData.total += cant

        const sNorm = (row.servicio || '').toUpperCase().trim()
        if (sNorm.includes('DESAYUNO')) {
            pData.desayuno += cant
        } else if (sNorm.includes('ALMUERZO')) {
            pData.almuerzo += cant
        } else if (sNorm.includes('ONCE')) {
            pData.once += cant
        } else if (sNorm.includes('COLACI')) {
            pData.colacion += cant
        } else if (sNorm.includes('CENA')) {
            pData.cena += cant
        } else {
            pData.otros += cant
        }
    }

    // Construir Timeline ordenado cronológicamente
    const sortedPeriodKeys = Array.from(distinctPeriodosSet).sort()
    const timeline: TimelinePoint[] = []

    let prevTotal = 0
    for (let i = 0; i < sortedPeriodKeys.length; i++) {
        const key = sortedPeriodKeys[i]
        const p = periodosTotalsMap.get(key)!
        const delta = i === 0 ? 0 : p.total - prevTotal
        const deltaPct = i === 0 || prevTotal === 0 ? 0 : Math.round((delta / prevTotal) * 1000) / 10

        timeline.push({
            periodoKey: key,
            label: `${MESES_ABR[p.mes - 1] || 'M' + p.mes} ${p.anio}`,
            mesNombre: MESES_NOMBRES[p.mes - 1] || `Mes ${p.mes}`,
            anio: p.anio,
            mes: p.mes,
            total: p.total,
            desayuno: p.desayuno,
            almuerzo: p.almuerzo,
            once: p.once,
            colacion: p.colacion,
            cena: p.cena,
            otros: p.otros,
            deltaPrevio: delta,
            deltaPct
        })

        prevTotal = p.total
    }

    // Encontrar Mes Pico Global
    let mesPico: { mesNombre: string; anio: number; cantidad: number } | null = null
    if (timeline.length > 0) {
        const sortedByTotal = [...timeline].sort((a, b) => b.total - a.total)
        const peak = sortedByTotal[0]
        mesPico = {
            mesNombre: peak.mesNombre,
            anio: peak.anio,
            cantidad: peak.total
        }
    }

    // Variación intermensual (último período respecto al anterior)
    let variacionIntermensual: {
        absoluta: number
        porcentaje: number
        direccion: 'up' | 'down' | 'flat'
        periodoComparado: string
    } | null = null

    if (timeline.length >= 2) {
        const last = timeline[timeline.length - 1]
        const prev = timeline[timeline.length - 2]
        const delta = last.total - prev.total
        const pct = prev.total > 0 ? Math.round((delta / prev.total) * 1000) / 10 : 0
        variacionIntermensual = {
            absoluta: delta,
            porcentaje: pct,
            direccion: delta > 0 ? 'up' : (delta < 0 ? 'down' : 'flat'),
            periodoComparado: `${last.label} vs ${prev.label}`
        }
    }

    // 5. Análisis detallado de servicios (¿Qué meses se dieron más desayunos, almuerzo, once?)
    const serviciosMap = new Map<string, {
        total: number
        meses: Map<string, { mesNombre: string; anio: number; label: string; cantidad: number }>
    }>()

    for (const row of datosPeriodoServicio) {
        const s = (row.servicio || 'OTROS').toUpperCase().trim()
        const cant = row._sum.cantidad || 0
        const key = `${row.anio}-${String(row.mes).padStart(2, '0')}`

        if (!serviciosMap.has(s)) {
            serviciosMap.set(s, { total: 0, meses: new Map() })
        }
        const sEntry = serviciosMap.get(s)!
        sEntry.total += cant

        if (!sEntry.meses.has(key)) {
            sEntry.meses.set(key, {
                mesNombre: MESES_NOMBRES[row.mes - 1] || `M${row.mes}`,
                anio: row.anio,
                label: `${MESES_ABR[row.mes - 1] || 'M' + row.mes} ${row.anio}`,
                cantidad: 0
            })
        }
        sEntry.meses.get(key)!.cantidad += cant
    }

    const serviciosAnalisis: ServicioAnalysis[] = []
    let servicioPredominante: TendenciasDashboardData['kpis']['servicioPredominante'] = null

    for (const [servicio, data] of serviciosMap.entries()) {
        const mesesArray = Array.from(data.meses.values()).sort((a, b) => b.cantidad - a.cantidad)
        const peakMes = mesesArray[0] || { mesNombre: 'S/D', anio: 2026, cantidad: 0 }
        const pct = grandTotalRaciones > 0 ? Math.round((data.total / grandTotalRaciones) * 1000) / 10 : 0

        serviciosAnalisis.push({
            servicio,
            color: SERVICIOS_COLORES[servicio] || SERVICIOS_COLORES['OTROS'],
            total: data.total,
            porcentaje: pct,
            mesPico: {
                mesNombre: peakMes.mesNombre,
                anio: peakMes.anio,
                cantidad: peakMes.cantidad
            },
            porMes: Array.from(data.meses.values()).map(m => ({
                label: m.label,
                mesNombre: m.mesNombre,
                cantidad: m.cantidad
            }))
        })
    }

    // Ordenar servicios por volumen descendente
    serviciosAnalisis.sort((a, b) => b.total - a.total)

    if (serviciosAnalisis.length > 0) {
        const topServ = serviciosAnalisis[0]
        servicioPredominante = {
            servicio: topServ.servicio,
            cantidad: topServ.total,
            porcentaje: topServ.porcentaje,
            mesRecord: `${topServ.mesPico.mesNombre} ${topServ.mesPico.anio}`,
            mesRecordCant: topServ.mesPico.cantidad
        }
    }

    // 6. Análisis de programas
    const programasAnalisis: ProgramaAnalysis[] = datosProgramas.map(p => {
        const cant = p._sum.cantidad || 0
        return {
            programa: p.programa || 'S/D',
            total: cant,
            porcentaje: grandTotalRaciones > 0 ? Math.round((cant / grandTotalRaciones) * 1000) / 10 : 0,
            registros: p._count.id
        }
    })

    // 7. Ranking de colegios / RBDs
    // Para enriquecer el desglose por servicio de cada RBD destacado:
    const topRbdNums = Array.from(new Set(datosRbd.map(r => r.rbd))).slice(0, 25)

    const rbdDetallesRaw = await prisma.raciones.groupBy({
        by: ['rbd', 'servicio'],
        where: {
            ...baseWhere,
            rbd: { in: topRbdNums }
        },
        _sum: { cantidad: true }
    })

    const rbdServicioBreakdown = new Map<number, {
        total: number
        desayuno: number
        almuerzo: number
        once: number
        colacion: number
        cena: number
    }>()

    for (const r of rbdDetallesRaw) {
        if (!rbdServicioBreakdown.has(r.rbd)) {
            rbdServicioBreakdown.set(r.rbd, { total: 0, desayuno: 0, almuerzo: 0, once: 0, colacion: 0, cena: 0 })
        }
        const b = rbdServicioBreakdown.get(r.rbd)!
        const cant = r._sum.cantidad || 0
        b.total += cant

        const s = (r.servicio || '').toUpperCase()
        if (s.includes('DESAYUNO')) b.desayuno += cant
        else if (s.includes('ALMUERZO')) b.almuerzo += cant
        else if (s.includes('ONCE')) b.once += cant
        else if (s.includes('COLACI')) b.colacion += cant
        else if (s.includes('CENA')) b.cena += cant
    }

    // Mapear ranking final
    const rbdSucursalMap = new Map<number, string>()
    datosRbd.forEach(d => {
        if (d.ut && utToSucursal.has(d.ut)) {
            rbdSucursalMap.set(d.rbd, utToSucursal.get(d.ut)!)
        }
    })

    const rankingRbds: RbdRankingItem[] = topRbdNums.map(num => {
        const b = rbdServicioBreakdown.get(num) || { total: 0, desayuno: 0, almuerzo: 0, once: 0, colacion: 0, cena: 0 }
        return {
            rbd: num,
            nombre: colegioNombreMap.get(num) || `Establecimiento ${num}`,
            sucursal: rbdSucursalMap.get(num) || 'S/D',
            totalRaciones: b.total,
            desayuno: b.desayuno,
            almuerzo: b.almuerzo,
            once: b.once,
            colacion: b.colacion,
            cena: b.cena
        }
    }).sort((a, b) => b.totalRaciones - a.totalRaciones)

    // 8. Matriz Sucursales vs Mes
    const datosPorSucursalMes = await prisma.raciones.groupBy({
        by: ['ut', 'anio', 'mes'],
        where: baseWhere,
        _sum: { cantidad: true }
    })

    const sucursalMesMap = new Map<string, { total: number; meses: Record<string, number> }>()

    for (const row of datosPorSucursalMes) {
        const suc = (row.ut && utToSucursal.get(row.ut)) || 'S/D'
        const cant = row._sum.cantidad || 0
        const mKey = `${MESES_ABR[row.mes - 1] || 'M' + row.mes} ${row.anio}`

        if (!sucursalMesMap.has(suc)) {
            sucursalMesMap.set(suc, { total: 0, meses: {} })
        }
        const entry = sucursalMesMap.get(suc)!
        entry.total += cant
        entry.meses[mKey] = (entry.meses[mKey] || 0) + cant
    }

    const matrizSucursales: SucursalMatrizItem[] = Array.from(sucursalMesMap.entries()).map(([suc, data]) => ({
        sucursal: suc,
        meses: data.meses,
        total: data.total
    })).sort((a, b) => b.total - a.total)

    // Distinct colegios con carga
    const colegiosConCargaCount = distinctRbdNums.length
    const promedioMensual = timeline.length > 0 ? Math.round(grandTotalRaciones / timeline.length) : 0

    return {
        kpis: {
            totalRaciones: grandTotalRaciones,
            totalRegistros: grandTotalRegistros,
            colegiosConCarga: colegiosConCargaCount,
            mesPico,
            servicioPredominante,
            variacionIntermensual,
            promedioMensualRaciones: promedioMensual
        },
        timeline,
        serviciosAnalisis,
        programasAnalisis,
        rankingRbds,
        matrizSucursales,
        filtrosDisponibles: {
            anos: availableAnos,
            meses: availableMeses,
            sucursales: availableSucursales,
            programas: availableProgramas,
            servicios: availableServicios,
            colegios: availableColegios
        },
        permisos: {
            isRestrictedByRbd,
            assignedRbdsCount: assignedRbds ? assignedRbds.length : null
        }
    }
}
