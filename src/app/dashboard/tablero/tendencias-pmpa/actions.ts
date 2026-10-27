'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { logAuditAction } from '@/lib/audit'

export type TendenciasFilterParams = {
    ano?: number
    mesDesde?: number
    mesHasta?: number
    institucion?: string
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

const SERVICIOS_COLORES: Record<string, string> = {
    'DESAYUNO': '#D97706',        // Ámbar cálido / Sol
    'ALMUERZO': '#059669',        // Esmeralda / Nutrición
    'TERCER SERVICIO': '#0EA5E9', // Cyan Hendaya
    'ONCE': '#0284C7',            // Sky
    'COLACIÓN': '#7C3AED',        // Violeta
    'COLACION': '#7C3AED',        // Violeta
    'CENA': '#4F46E5',            // Índigo
    'OTROS': '#64748B'            // Slate neutro
}

export function normalizeService(s: string): string {
    const norm = (s || '').trim().toUpperCase()
    if (norm === 'D' || norm === 'DP' || norm === 'DPE' || (norm.startsWith('D') && norm.length <= 3 && !norm.includes('CO') && !norm.includes('C'))) return 'DESAYUNO'
    if (norm === 'A' || norm === 'AP' || (norm.startsWith('A') && norm.length <= 3 && !norm.includes('CO') && !norm.includes('C'))) return 'ALMUERZO'
    if (norm === 'O' || norm === 'OP' || norm === 'OPE') return 'ONCE'
    if (norm === 'CO' || norm === 'CP' || norm.includes('COLACI')) return 'COLACIÓN'
    if (norm === 'C' || norm === 'CEC' || norm.includes('CENA')) return 'CENA'
    if (norm === 'T' || norm === 'TP' || norm.includes('TERCER')) return 'TERCER SERVICIO'
    if (norm.includes('DESAYUNO')) return 'DESAYUNO'
    if (norm.includes('ALMUERZO')) return 'ALMUERZO'
    if (norm.includes('ONCE')) return 'ONCE'
    return 'OTROS'
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
    tercerServicio: number
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
    institucion?: string
    totalRaciones: number
    desayuno: number
    almuerzo: number
    once: number
    colacion: number
    cena: number
    tercerServicio: number
}

export type SucursalMatrizItem = {
    sucursal: string
    meses: Record<string, number>
    total: number
}

export type ColegioOption = {
    rbd: number
    label: string
    nombre: string
    comuna?: string
    sucursal?: string
}

export type ComparativaOscilacionData = {
    interanual: Record<string, any>[]
    anosDisponibles: number[]
    porServicio: Record<string, any>[]
    serviciosDisponibles: string[]
    porPrograma: Record<string, any>[]
    topProgramas: string[]
    porRbd: Record<string, any>[]
    rbdsComparados: {
        key: string
        rbd: number
        nombre: string
        label: string
    }[]
    metricasOscilacion: {
        amplitudTotal: number
        amplitudPct: number
        periodoPico: {
            label: string
            cantidad: number
        } | null
        periodoValle: {
            label: string
            cantidad: number
        } | null
        promedioPeriodo: number
        desviacionEstimada: number
        volatilidadNivel: 'Baja' | 'Moderada' | 'Alta'
    }
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
    comparativaOscilacion: ComparativaOscilacionData
    filtrosDisponibles: {
        anos: number[]
        meses: { numero: number; nombre: string }[]
        instituciones: string[]
        sucursales: string[]
        programas: string[]
        servicios: string[]
        colegios: ColegioOption[]
    }
    permisos: {
        isRestrictedByRbd: boolean
        assignedRbdsCount: number | null
    }
}

/**
 * Obtiene métricas analíticas avanzadas para el tablero de Tendencias y Oscilación PMPA
 * Conectado directamente al modelo real PMPA (129k+ registros con todo el año, 2024, 2025, 2026 e instituciones)
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
            detalle: `Consulta tablero Tendencias y Oscilación PMPA (Filtros: Año=${filters?.ano || 'Todos'}, MesDesde=${filters?.mesDesde || 'Inicio'}, MesHasta=${filters?.mesHasta || 'Fin'}, Institucion=${filters?.institucion || 'Todas'}, Sucursal=${filters?.sucursal || 'Todas'}, Programa=${filters?.programa || 'Todos'}, RBD=${filters?.rbd || 'Todos'})`
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
            comparativaOscilacion: {
                interanual: [],
                anosDisponibles: [],
                porServicio: [],
                serviciosDisponibles: [],
                porPrograma: [],
                topProgramas: [],
                porRbd: [],
                rbdsComparados: [],
                metricasOscilacion: {
                    amplitudTotal: 0,
                    amplitudPct: 0,
                    periodoPico: null,
                    periodoValle: null,
                    promedioPeriodo: 0,
                    desviacionEstimada: 0,
                    volatilidadNivel: 'Baja'
                }
            },
            filtrosDisponibles: {
                anos: [],
                meses: [],
                instituciones: [],
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

    // Mapa de UT (codUT) a Sucursal
    const uts = await rawPrisma.uT.findMany({
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

    // Cláusula base WHERE para PMPA
    const baseWhere: any = {}

    // Restricción por perfil de usuario
    if (isRestrictedByRbd && assignedRbds && assignedRbds.length > 0) {
        if (filters?.rbd) {
            baseWhere.rbd = assignedRbds.includes(Number(filters.rbd)) ? Number(filters.rbd) : { in: assignedRbds }
        } else {
            baseWhere.rbd = { in: assignedRbds }
        }
    } else if (filters?.rbd) {
        baseWhere.rbd = Number(filters.rbd)
    }

    if (filters?.ano) {
        baseWhere.ano = Number(filters.ano)
    }

    // Rango de Meses (Mes Desde / Mes Hasta)
    if (filters?.mesDesde && filters?.mesHasta) {
        const minM = Math.min(Number(filters.mesDesde), Number(filters.mesHasta))
        const maxM = Math.max(Number(filters.mesDesde), Number(filters.mesHasta))
        baseWhere.mes = { gte: minM, lte: maxM }
    } else if (filters?.mesDesde) {
        baseWhere.mes = { gte: Number(filters.mesDesde) }
    } else if (filters?.mesHasta) {
        baseWhere.mes = { lte: Number(filters.mesHasta) }
    }

    if (filters?.institucion) {
        baseWhere.institucion = String(filters.institucion).trim()
    }

    if (filters?.programa) {
        baseWhere.programa = String(filters.programa).trim()
    }

    if (filters?.servicio) {
        const servUpper = String(filters.servicio).trim().toUpperCase()
        if (servUpper === 'DESAYUNO') {
            baseWhere.servicio = { in: ['D', 'DP', 'DPE', 'DESAYUNO'] }
        } else if (servUpper === 'ALMUERZO') {
            baseWhere.servicio = { in: ['A', 'AP', 'ALMUERZO'] }
        } else if (servUpper === 'ONCE') {
            baseWhere.servicio = { in: ['O', 'OP', 'OPE', 'ONCE'] }
        } else if (servUpper === 'COLACIÓN' || servUpper === 'COLACION') {
            baseWhere.servicio = { in: ['CO', 'CP', 'COLACION', 'COLACIÓN'] }
        } else if (servUpper === 'CENA') {
            baseWhere.servicio = { in: ['C', 'CEC', 'CENA'] }
        } else if (servUpper === 'TERCER SERVICIO') {
            baseWhere.servicio = { in: ['T', 'TP', 'TERCER SERVICIO'] }
        } else {
            baseWhere.servicio = String(filters.servicio).trim()
        }
    }

    if (allowedUtsBySucursal !== null) {
        baseWhere.ute = { in: allowedUtsBySucursal }
    }

    // 1. Obtener opciones disponibles para filtros desde PMPA
    const rbdOptionsConstraint = isRestrictedByRbd && assignedRbds ? { rbd: { in: assignedRbds } } : {}

    // Años disponibles en PMPA
    const periodosRaw = await rawPrisma.pMPA.groupBy({
        by: ['ano'],
        where: rbdOptionsConstraint,
        orderBy: { ano: 'desc' }
    })
    const availableAnos = Array.from(new Set(periodosRaw.map(p => p.ano))).sort((a, b) => b - a)

    // Meses (1 a 12 completos para selección de rango)
    const availableMeses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => ({
        numero: m,
        nombre: MESES_NOMBRES[m - 1]
    }))

    // Instituciones disponibles en PMPA
    const instRaw = await rawPrisma.pMPA.groupBy({
        by: ['institucion'],
        where: rbdOptionsConstraint,
        _count: { id: true }
    })
    const availableInstituciones = instRaw.map(i => i.institucion).filter(Boolean) as string[]

    // Programas disponibles
    const programasRaw = await rawPrisma.pMPA.groupBy({
        by: ['programa'],
        where: rbdOptionsConstraint,
        _count: { id: true }
    })
    programasRaw.sort((a, b) => (b._count.id || 0) - (a._count.id || 0))
    const availableProgramas = programasRaw.map(p => p.programa).filter(Boolean)

    // Servicios normalizados disponibles
    const availableServicios = ['DESAYUNO', 'ALMUERZO', 'TERCER SERVICIO', 'ONCE', 'COLACIÓN', 'CENA', 'OTROS']

    // Sucursales disponibles
    const availableSucursales = Array.from(sucursalToUts.keys()).sort()

    // Colegios disponibles para el selector inteligente
    const rbdsConMovimiento = await rawPrisma.pMPA.groupBy({
        by: ['rbd'],
        where: rbdOptionsConstraint
    })
    const distinctRbdNums = rbdsConMovimiento.map(r => r.rbd)

    const colegiosDb = await rawPrisma.colegios.findMany({
        where: { colRBD: { in: distinctRbdNums } },
        select: { colRBD: true, nombreEstablecimiento: true, comuna: true, sucursal: true, institucion: true }
    })
    const colegioNombreMap = new Map<number, string>()
    const colegioComunaMap = new Map<number, string>()
    const colegioSucursalMap = new Map<number, string>()
    const colegioInstitucionMap = new Map<number, string>()

    colegiosDb.forEach(c => {
        colegioNombreMap.set(c.colRBD, c.nombreEstablecimiento)
        if (c.comuna) colegioComunaMap.set(c.colRBD, c.comuna)
        if (c.sucursal) colegioSucursalMap.set(c.colRBD, c.sucursal)
        if (c.institucion) colegioInstitucionMap.set(c.colRBD, c.institucion)
    })

    const availableColegios: ColegioOption[] = distinctRbdNums.map(num => {
        const nom = colegioNombreMap.get(num) || 'Establecimiento ' + num
        return {
            rbd: num,
            label: `${num} - ${nom}`,
            nombre: nom,
            comuna: colegioComunaMap.get(num) || undefined,
            sucursal: colegioSucursalMap.get(num) || undefined
        }
    }).sort((a, b) => a.rbd - b.rbd)

    // 2. Consulta de datos principales agrupados por período y servicio en PMPA
    const datosPeriodoServicio = await rawPrisma.pMPA.groupBy({
        by: ['ano', 'mes', 'servicio'],
        where: baseWhere,
        _sum: { raceqJunaeb: true },
        _count: { id: true },
        orderBy: [{ ano: 'asc' }, { mes: 'asc' }]
    })

    // 3. Consulta de datos agrupados por programa en PMPA
    const datosProgramas = await rawPrisma.pMPA.groupBy({
        by: ['programa'],
        where: baseWhere,
        _sum: { raceqJunaeb: true },
        _count: { id: true }
    })
    datosProgramas.sort((a, b) => (b._sum.raceqJunaeb || 0) - (a._sum.raceqJunaeb || 0))

    // 4. Consulta de datos agrupados por RBD (ranking) en PMPA
    const datosRbd = await rawPrisma.pMPA.groupBy({
        by: ['rbd', 'ute'],
        where: baseWhere,
        _sum: { raceqJunaeb: true }
    })
    datosRbd.sort((a, b) => (b._sum.raceqJunaeb || 0) - (a._sum.raceqJunaeb || 0))

    // Conteo global de registros y raciones
    let grandTotalRaciones = 0
    let grandTotalRegistros = 0
    const distinctPeriodosSet = new Set<string>()
    const periodosTotalsMap = new Map<string, {
        ano: number
        mes: number
        total: number
        desayuno: number
        almuerzo: number
        once: number
        colacion: number
        cena: number
        tercerServicio: number
        otros: number
    }>()

    for (const row of datosPeriodoServicio) {
        const cant = row._sum.raceqJunaeb || 0
        const count = row._count.id || 0
        grandTotalRaciones += cant
        grandTotalRegistros += count

        const key = `${row.ano}-${String(row.mes).padStart(2, '0')}`
        distinctPeriodosSet.add(key)

        if (!periodosTotalsMap.has(key)) {
            periodosTotalsMap.set(key, {
                ano: row.ano,
                mes: row.mes,
                total: 0,
                desayuno: 0,
                almuerzo: 0,
                once: 0,
                colacion: 0,
                cena: 0,
                tercerServicio: 0,
                otros: 0
            })
        }

        const pData = periodosTotalsMap.get(key)!
        pData.total += cant

        const sNorm = normalizeService(row.servicio)
        if (sNorm === 'DESAYUNO') {
            pData.desayuno += cant
        } else if (sNorm === 'ALMUERZO') {
            pData.almuerzo += cant
        } else if (sNorm === 'ONCE') {
            pData.once += cant
        } else if (sNorm === 'COLACIÓN') {
            pData.colacion += cant
        } else if (sNorm === 'CENA') {
            pData.cena += cant
        } else if (sNorm === 'TERCER SERVICIO') {
            pData.tercerServicio += cant
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
            label: `${MESES_ABR[p.mes - 1] || 'M' + p.mes} ${p.ano}`,
            mesNombre: MESES_NOMBRES[p.mes - 1] || `Mes ${p.mes}`,
            anio: p.ano,
            mes: p.mes,
            total: p.total,
            desayuno: p.desayuno,
            almuerzo: p.almuerzo,
            once: p.once,
            colacion: p.colacion,
            cena: p.cena,
            tercerServicio: p.tercerServicio,
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

    // 5. Análisis detallado de servicios en PMPA
    const serviciosMap = new Map<string, {
        total: number
        meses: Map<string, { mesNombre: string; anio: number; label: string; cantidad: number }>
    }>()

    for (const row of datosPeriodoServicio) {
        const s = normalizeService(row.servicio)
        const cant = row._sum.raceqJunaeb || 0
        const key = `${row.ano}-${String(row.mes).padStart(2, '0')}`

        if (!serviciosMap.has(s)) {
            serviciosMap.set(s, { total: 0, meses: new Map() })
        }
        const sEntry = serviciosMap.get(s)!
        sEntry.total += cant

        if (!sEntry.meses.has(key)) {
            sEntry.meses.set(key, {
                mesNombre: MESES_NOMBRES[row.mes - 1] || `M${row.mes}`,
                anio: row.ano,
                label: `${MESES_ABR[row.mes - 1] || 'M' + row.mes} ${row.ano}`,
                cantidad: 0
            })
        }
        sEntry.meses.get(key)!.cantidad += cant
    }

    const serviciosAnalisis: ServicioAnalysis[] = []
    let servicioPredominante: TendenciasDashboardData['kpis']['servicioPredominante'] = null

    for (const [servicio, sData] of serviciosMap.entries()) {
        const mesesArray = Array.from(sData.meses.values()).sort((a, b) => b.cantidad - a.cantidad)
        const peakMes = mesesArray[0] || { mesNombre: 'S/D', anio: 2026, cantidad: 0 }
        const pct = grandTotalRaciones > 0 ? Math.round((sData.total / grandTotalRaciones) * 1000) / 10 : 0

        serviciosAnalisis.push({
            servicio,
            color: SERVICIOS_COLORES[servicio] || SERVICIOS_COLORES['OTROS'],
            total: sData.total,
            porcentaje: pct,
            mesPico: {
                mesNombre: peakMes.mesNombre,
                anio: peakMes.anio,
                cantidad: peakMes.cantidad
            },
            porMes: Array.from(sData.meses.values()).map(m => ({
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
        const cant = p._sum.raceqJunaeb || 0
        return {
            programa: p.programa || 'S/D',
            total: cant,
            porcentaje: grandTotalRaciones > 0 ? Math.round((cant / grandTotalRaciones) * 1000) / 10 : 0,
            registros: p._count.id
        }
    })

    // 7. Ranking de colegios / RBDs en PMPA
    const topRbdNums = Array.from(new Set(datosRbd.map(r => r.rbd))).slice(0, 30)

    const rbdDetallesRaw = await rawPrisma.pMPA.groupBy({
        by: ['rbd', 'servicio'],
        where: {
            ...baseWhere,
            rbd: { in: topRbdNums }
        },
        _sum: { raceqJunaeb: true }
    })

    const rbdServicioBreakdown = new Map<number, {
        total: number
        desayuno: number
        almuerzo: number
        once: number
        colacion: number
        cena: number
        tercerServicio: number
    }>()

    for (const r of rbdDetallesRaw) {
        if (!rbdServicioBreakdown.has(r.rbd)) {
            rbdServicioBreakdown.set(r.rbd, { total: 0, desayuno: 0, almuerzo: 0, once: 0, colacion: 0, cena: 0, tercerServicio: 0 })
        }
        const b = rbdServicioBreakdown.get(r.rbd)!
        const cant = r._sum.raceqJunaeb || 0
        b.total += cant

        const s = normalizeService(r.servicio)
        if (s === 'DESAYUNO') b.desayuno += cant
        else if (s === 'ALMUERZO') b.almuerzo += cant
        else if (s === 'ONCE') b.once += cant
        else if (s === 'COLACIÓN') b.colacion += cant
        else if (s === 'CENA') b.cena += cant
        else if (s === 'TERCER SERVICIO') b.tercerServicio += cant
    }

    // Mapear ranking final
    const rbdSucursalMap = new Map<number, string>()
    datosRbd.forEach(d => {
        if (d.ute && utToSucursal.has(d.ute)) {
            rbdSucursalMap.set(d.rbd, utToSucursal.get(d.ute)!)
        }
    })

    const rankingRbds: RbdRankingItem[] = topRbdNums.map(num => {
        const b = rbdServicioBreakdown.get(num) || { total: 0, desayuno: 0, almuerzo: 0, once: 0, colacion: 0, cena: 0, tercerServicio: 0 }
        return {
            rbd: num,
            nombre: colegioNombreMap.get(num) || `Establecimiento ${num}`,
            sucursal: rbdSucursalMap.get(num) || 'S/D',
            institucion: colegioInstitucionMap.get(num) || 'JUNAEB',
            totalRaciones: b.total,
            desayuno: b.desayuno,
            almuerzo: b.almuerzo,
            once: b.once,
            colacion: b.colacion,
            cena: b.cena,
            tercerServicio: b.tercerServicio
        }
    }).sort((a, b) => b.totalRaciones - a.totalRaciones)

    // 8. Matriz Sucursales vs Mes
    const datosPorSucursalMes = await rawPrisma.pMPA.groupBy({
        by: ['ute', 'ano', 'mes'],
        where: baseWhere,
        _sum: { raceqJunaeb: true }
    })

    const sucursalMesMap = new Map<string, { total: number; meses: Record<string, number> }>()

    for (const row of datosPorSucursalMes) {
        const suc = (row.ute && utToSucursal.get(row.ute)) || 'S/D'
        const cant = row._sum.raceqJunaeb || 0
        const mKey = `${MESES_ABR[row.mes - 1] || 'M' + row.mes} ${row.ano}`

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

    // 9. Construcción de Dataset para Gráfico Comparativo de Oscilación
    // Filtro base sin año para comparar interanual
    const whereWithoutAno: any = {}
    if (isRestrictedByRbd && assignedRbds && assignedRbds.length > 0) {
        if (filters?.rbd) {
            whereWithoutAno.rbd = assignedRbds.includes(Number(filters.rbd)) ? Number(filters.rbd) : { in: assignedRbds }
        } else {
            whereWithoutAno.rbd = { in: assignedRbds }
        }
    } else if (filters?.rbd) {
        whereWithoutAno.rbd = Number(filters.rbd)
    }

    // Respetar rango de meses en interanual si fue seleccionado
    if (filters?.mesDesde && filters?.mesHasta) {
        const minM = Math.min(Number(filters.mesDesde), Number(filters.mesHasta))
        const maxM = Math.max(Number(filters.mesDesde), Number(filters.mesHasta))
        whereWithoutAno.mes = { gte: minM, lte: maxM }
    } else if (filters?.mesDesde) {
        whereWithoutAno.mes = { gte: Number(filters.mesDesde) }
    } else if (filters?.mesHasta) {
        whereWithoutAno.mes = { lte: Number(filters.mesHasta) }
    }

    if (filters?.institucion) {
        whereWithoutAno.institucion = String(filters.institucion).trim()
    }
    if (filters?.programa) {
        whereWithoutAno.programa = String(filters.programa).trim()
    }
    if (filters?.servicio) {
        whereWithoutAno.servicio = baseWhere.servicio
    }
    if (allowedUtsBySucursal !== null) {
        whereWithoutAno.ute = { in: allowedUtsBySucursal }
    }

    // 9.1 Comparativa Interanual (Años vs Meses 1 a 12)
    const interanualRaw = await rawPrisma.pMPA.groupBy({
        by: ['ano', 'mes'],
        where: whereWithoutAno,
        _sum: { raceqJunaeb: true },
        orderBy: [{ ano: 'asc' }, { mes: 'asc' }]
    })

    const distinctAnos = Array.from(new Set(interanualRaw.map(r => r.ano))).sort((a, b) => a - b)
    const anosDisponibles = distinctAnos.length > 0 ? distinctAnos : (availableAnos.length > 0 ? availableAnos : [2026])

    // Determinar qué meses incluir en interanual (si hay filtro de rango, filtrar)
    const minMesRange = filters?.mesDesde ? Number(filters.mesDesde) : 1
    const maxMesRange = filters?.mesHasta ? Number(filters.mesHasta) : 12
    const monthsToIterate = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(m => m >= minMesRange && m <= maxMesRange)

    const interanual = monthsToIterate.map(m => {
        const row: Record<string, any> = {
            mes: m,
            mesNombre: MESES_NOMBRES[m - 1] || `Mes ${m}`,
            mesAbr: MESES_ABR[m - 1] || `M${m}`
        }
        anosDisponibles.forEach(yr => {
            const found = interanualRaw.find(r => r.ano === yr && r.mes === m)
            row[`ano_${yr}`] = found?._sum.raceqJunaeb || 0
        })
        return row
    })

    // 9.2 Comparativa por Servicio Alimentario
    const porServicio = timeline.map(t => ({
        periodoKey: t.periodoKey,
        label: t.label,
        mesNombre: t.mesNombre,
        anio: t.anio,
        mes: t.mes,
        total: t.total,
        desayuno: t.desayuno,
        almuerzo: t.almuerzo,
        once: t.once,
        colacion: t.colacion,
        cena: t.cena,
        tercerServicio: t.tercerServicio,
        otros: t.otros
    }))
    const serviciosDisponibles = ['DESAYUNO', 'ALMUERZO', 'TERCER SERVICIO', 'ONCE', 'COLACIÓN', 'CENA']

    // 9.3 Comparativa por Programa Alimentario
    const datosPeriodoPrograma = await rawPrisma.pMPA.groupBy({
        by: ['ano', 'mes', 'programa'],
        where: baseWhere,
        _sum: { raceqJunaeb: true },
        orderBy: [{ ano: 'asc' }, { mes: 'asc' }]
    })

    const topProgramas = programasAnalisis.slice(0, 6).map(p => p.programa)
    const periodoProgramaMap = new Map<string, Record<string, number>>()
    for (const row of datosPeriodoPrograma) {
        const key = `${row.ano}-${String(row.mes).padStart(2, '0')}`
        if (!periodoProgramaMap.has(key)) {
            periodoProgramaMap.set(key, {})
        }
        const prog = row.programa || 'OTROS'
        const cant = row._sum.raceqJunaeb || 0
        const pObj = periodoProgramaMap.get(key)!
        if (topProgramas.includes(prog)) {
            pObj[prog] = (pObj[prog] || 0) + cant
        } else {
            pObj['OTROS'] = (pObj['OTROS'] || 0) + cant
        }
    }

    const porPrograma = timeline.map(t => {
        const progsForPeriod = periodoProgramaMap.get(t.periodoKey) || {}
        const row: Record<string, any> = {
            periodoKey: t.periodoKey,
            label: t.label,
            mesNombre: t.mesNombre,
            anio: t.anio,
            mes: t.mes,
            total: t.total
        }
        topProgramas.forEach(p => {
            row[p] = progsForPeriod[p] || 0
        })
        if (programasAnalisis.length > topProgramas.length) {
            row['OTROS'] = progsForPeriod['OTROS'] || 0
        }
        return row
    })
    const topProgramasList = [...topProgramas]
    if (programasAnalisis.length > topProgramas.length) {
        topProgramasList.push('OTROS')
    }

    // 9.4 Comparativa por Colegio (RBD)
    let rbdsComparados: { key: string; rbd: number; nombre: string; label: string }[] = []
    let porRbd: Record<string, any>[] = []

    if (filters?.rbd) {
        const selectedRbdNum = Number(filters.rbd)
        const schoolName = colegioNombreMap.get(selectedRbdNum) || `RBD ${selectedRbdNum}`
        rbdsComparados = [
            {
                key: `rbd_${selectedRbdNum}`,
                rbd: selectedRbdNum,
                nombre: schoolName,
                label: `${selectedRbdNum} - ${schoolName.length > 25 ? schoolName.slice(0, 25) + '...' : schoolName}`
            },
            {
                key: 'promedio_colegios',
                rbd: 0,
                nombre: 'Promedio General',
                label: 'Promedio de Colegios'
            }
        ]

        const rbdRaw = await rawPrisma.pMPA.groupBy({
            by: ['ano', 'mes'],
            where: { ...baseWhere, rbd: selectedRbdNum },
            _sum: { raceqJunaeb: true }
        })
        const schoolPeriodMap = new Map<string, number>()
        rbdRaw.forEach(r => {
            const key = `${r.ano}-${String(r.mes).padStart(2, '0')}`
            schoolPeriodMap.set(key, r._sum.raceqJunaeb || 0)
        })

        const avgWhere = { ...baseWhere }
        delete avgWhere.rbd
        const allSchoolsRaw = await rawPrisma.pMPA.groupBy({
            by: ['ano', 'mes'],
            where: avgWhere,
            _sum: { raceqJunaeb: true }
        })
        const avgPeriodMap = new Map<string, number>()
        allSchoolsRaw.forEach(r => {
            const key = `${r.ano}-${String(r.mes).padStart(2, '0')}`
            const distinctCount = colegiosConCargaCount || 1
            avgPeriodMap.set(key, Math.round((r._sum.raceqJunaeb || 0) / distinctCount))
        })

        porRbd = timeline.map(t => ({
            periodoKey: t.periodoKey,
            label: t.label,
            mesNombre: t.mesNombre,
            anio: t.anio,
            mes: t.mes,
            total: t.total,
            [`rbd_${selectedRbdNum}`]: schoolPeriodMap.get(t.periodoKey) || 0,
            promedio_colegios: avgPeriodMap.get(t.periodoKey) || 0
        }))
    } else {
        const top5Rbds = rankingRbds.slice(0, 5)
        const top5RbdNums = top5Rbds.map(r => r.rbd)
        rbdsComparados = top5Rbds.map(r => ({
            key: `rbd_${r.rbd}`,
            rbd: r.rbd,
            nombre: r.nombre,
            label: `${r.rbd} - ${r.nombre.length > 20 ? r.nombre.slice(0, 20) + '...' : r.nombre}`
        }))

        const rbdMonthlyRaw = await rawPrisma.pMPA.groupBy({
            by: ['ano', 'mes', 'rbd'],
            where: { ...baseWhere, rbd: { in: top5RbdNums } },
            _sum: { raceqJunaeb: true }
        })

        const rbdPeriodMap = new Map<string, Record<string, number>>()
        rbdMonthlyRaw.forEach(r => {
            const key = `${r.ano}-${String(r.mes).padStart(2, '0')}`
            if (!rbdPeriodMap.has(key)) rbdPeriodMap.set(key, {})
            rbdPeriodMap.get(key)![`rbd_${r.rbd}`] = r._sum.raceqJunaeb || 0
        })

        porRbd = timeline.map(t => {
            const row: Record<string, any> = {
                periodoKey: t.periodoKey,
                label: t.label,
                mesNombre: t.mesNombre,
                anio: t.anio,
                mes: t.mes,
                total: t.total
            }
            rbdsComparados.forEach(c => {
                row[c.key] = rbdPeriodMap.get(t.periodoKey)?.[c.key] || 0
            })
            return row
        })
    }

    // 9.5 Métricas de Oscilación
    let minTimeline = timeline.length > 0 ? timeline[0].total : 0
    let maxTimeline = timeline.length > 0 ? timeline[0].total : 0
    let periodoPico: { label: string; cantidad: number } | null = null
    let periodoValle: { label: string; cantidad: number } | null = null

    if (timeline.length > 0) {
        const sorted = [...timeline].sort((a, b) => b.total - a.total)
        maxTimeline = sorted[0].total
        periodoPico = { label: sorted[0].label, cantidad: maxTimeline }

        const sortedAsc = [...timeline].filter(t => t.total > 0).sort((a, b) => a.total - b.total)
        if (sortedAsc.length > 0) {
            minTimeline = sortedAsc[0].total
            periodoValle = { label: sortedAsc[0].label, cantidad: minTimeline }
        } else {
            minTimeline = sorted[sorted.length - 1].total
            periodoValle = { label: sorted[sorted.length - 1].label, cantidad: minTimeline }
        }
    }

    const amplitud = maxTimeline - minTimeline
    const amplitudPct = maxTimeline > 0 ? Math.round((amplitud / maxTimeline) * 1000) / 10 : 0
    const volatilidadNivel: 'Baja' | 'Moderada' | 'Alta' = 
        amplitudPct < 15 ? 'Baja' : (amplitudPct <= 35 ? 'Moderada' : 'Alta')

    const metricasOscilacion = {
        amplitudTotal: amplitud,
        amplitudPct,
        periodoPico,
        periodoValle,
        promedioPeriodo: promedioMensual,
        desviacionEstimada: Math.round(amplitud / 2),
        volatilidadNivel
    }

    const comparativaOscilacion: ComparativaOscilacionData = {
        interanual,
        anosDisponibles,
        porServicio,
        serviciosDisponibles,
        porPrograma,
        topProgramas: topProgramasList,
        porRbd,
        rbdsComparados,
        metricasOscilacion
    }

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
        comparativaOscilacion,
        filtrosDisponibles: {
            anos: availableAnos,
            meses: availableMeses,
            instituciones: availableInstituciones,
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
