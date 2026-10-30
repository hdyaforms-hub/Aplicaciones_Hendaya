'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { logAuditAction } from '@/lib/audit'
import { ensurePrevIndicadoresTables } from '@/lib/prev-indicadores-db-init'

// Mapeo entre Zonas del Excel e IDs/nombres de Sucursales del sistema
const ZONA_SUCURSAL_MAP: Record<string, string> = {
    'Metropolitana': 'CD METRO',
    'Copiapó': 'CD COPIAPO',
    'Copiapo': 'CD COPIAPO',
    'Vallenar': 'CD VALLENAR',
    'Coyhaique': 'CD COYHAIQUE'
}

const SUCURSAL_ZONA_MAP: Record<string, string> = {
    'CD METRO': 'Metropolitana',
    'CD COPIAPO': 'Copiapó',
    'CD VALLENAR': 'Vallenar',
    'CD COYHAIQUE': 'Coyhaique'
}

export interface IndicadoresNacionalItem {
    id: string
    label: string
    unit: string
    meta: number
    current: number | null
    decimals?: number
    values: (number | null)[]
    overMonths: number
    totalMonths: number
    desc: string
    src: string
}

export interface ZonaReporteItem {
    name: string
    sucursalSistema?: string
    accMensual: Record<string | number, (number | null)[]>
    diasMensual: Record<string | number, (number | null)[]>
    accVsMeta: {
        meta: number
        categories: string[]
        values: (number | null)[]
    }
    accAnualVsMeta: {
        categories: string[]
        actual: (number | null)[]
        meta: (number | null)[]
    }
}

export interface TopItem {
    name: string
    zona: string
    acc: number
    dias: number
    supervisorId?: string | null
    correo?: string | null
    totalRbds?: number
}

export interface DS67Data {
    cotizacionActual: string
    cotizacionCap: string
    tsit: string
    tsitCap: string
    holgura: string
    holguraCap: string
    costo: string
    costoCap: string
    variacion: string
    variacionCap: string
    tramos: { r: string; p: string; d: string; current?: boolean }[]
}

export interface IndicadoresPrevRiesgosDashboardData {
    hasData: boolean
    periodo: string
    anio: number
    mes: number
    fuente: string
    cargado: string
    nacional: IndicadoresNacionalItem[]
    zonas: ZonaReporteItem[]
    totales: {
        accidentes: Record<string | number, (number | null)[]>
        dias: Record<string | number, (number | null)[]>
    }
    ranking: { name: string; value: number }[]
    top10: {
        periodo: string
        totalAcc: number
        totalDias: number
        comunas: TopItem[]
        jefaturas: TopItem[]
        empates: { comunas: string[]; jefaturas: string[] }
        fuente: string
    }
    ds67: DS67Data
    permisos: {
        isRestrictedByRbd: boolean
        assignedRbdsCount: number | null
        sucursalesAutorizadas: string[]
    }
    periodosDisponibles: { id: string; periodo: string; fileName: string; fecha: string }[]
}

/**
 * Obtiene la información estructurada del tablero "Indicador Prev. riesgos",
 * respetando el perfil, sucursales y RBDs autorizados del usuario conectado.
 */
export async function getIndicadorPrevRiesgosData(periodoCargaId?: string): Promise<IndicadoresPrevRiesgosDashboardData> {
    await ensurePrevIndicadoresTables()

    const session = await getSession()
    if (!session || !session.user) {
        throw new Error('No autorizado. Sesión no válida.')
    }

    const isAdmin = session.user.role?.name?.toLowerCase().includes('admin') ||
                    session.user.role?.name?.toLowerCase().includes('gerencia')
    const permissions = session.user.role?.permissions || []

    if (!isAdmin && !permissions.includes('view_tablero_indicador_prev_riesgos')) {
        throw new Error('No posees permisos para acceder al Tablero Indicador Prev. Riesgos.')
    }

    // Evaluación de RBDs y sucursales según perfil
    const userEffectiveRbds = await getUserEffectiveRbds()
    const isRestrictedByRbd = userEffectiveRbds !== null
    const assignedRbds = isRestrictedByRbd ? userEffectiveRbds : null

    let sucursalesAutorizadas: string[] = ['Metropolitana', 'Copiapó', 'Copiapo', 'Vallenar', 'Coyhaique']

    if (isRestrictedByRbd && assignedRbds) {
        if (assignedRbds.length === 0) {
            sucursalesAutorizadas = []
        } else {
            // Consultar a qué sucursales corresponden los RBDs autorizados del usuario
            const colegiosDb = await rawPrisma.colegios.findMany({
                where: { colRBD: { in: assignedRbds } },
                select: { sucursal: true },
                distinct: ['sucursal']
            }).catch(() => [])

            const sucsDb = colegiosDb.map(c => c.sucursal.trim().toUpperCase())
            sucursalesAutorizadas = Object.keys(ZONA_SUCURSAL_MAP).filter(zona => {
                const codSuc = ZONA_SUCURSAL_MAP[zona].toUpperCase()
                return sucsDb.some(s => s.includes(codSuc) || codSuc.includes(s))
            })
        }
    }

    // Registrar en auditoría
    try {
        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'VISUALIZAR_INDICADOR_PREV_RIESGOS',
            modulo: 'Tableros y Avances -> Indicador Prev. riesgos',
            detalle: `Consulta del tablero de indicadores de prevención de riesgos (Perfil=${isRestrictedByRbd ? 'Restringido' : 'Global'}, Sucursales=${sucursalesAutorizadas.join(', ') || 'Ninguna'})`
        })
    } catch (e) {
        console.error('Error registrando auditoría en getIndicadorPrevRiesgosData:', e)
    }

    // 1. Obtener la lista de cargas disponibles
    const historialRows = await rawPrisma.$queryRawUnsafe<{ id: string; anio: number; mes: number; periodo: string; fileName: string; dataJson: string; createdAt: Date }[]>(`
        SELECT "id", "anio", "mes", "periodo", "fileName", "dataJson", "createdAt"
        FROM "Prev_IndicadoresCargas"
        ORDER BY "createdAt" DESC
        LIMIT 20;
    `).catch(() => [])

    let activeRow: (typeof historialRows)[0] | null = null

    if (periodoCargaId) {
        activeRow = historialRows.find(r => r.id === periodoCargaId) || null
    }

    if (!activeRow && historialRows.length > 0) {
        activeRow = historialRows[0]
    }

    let parsedPayload: any = null

    if (activeRow && activeRow.dataJson) {
        try {
            parsedPayload = JSON.parse(activeRow.dataJson)
        } catch (e) {
            console.error('Error parseando dataJson de carga en BD:', e)
        }
    }

    // Si no hay datos en BD (por ejemplo porque se eliminó la carga), retornar estado vacío sin datos
    if (!parsedPayload) {
        return {
            hasData: false,
            periodo: 'Sin datos cargados',
            anio: new Date().getFullYear(),
            mes: 1,
            fuente: 'Sin datos en BD',
            cargado: '—',
            nacional: [],
            zonas: [],
            totales: { accidentes: {}, dias: {} },
            ranking: [],
            top10: {
                periodo: '',
                totalAcc: 0,
                totalDias: 0,
                comunas: [],
                jefaturas: [],
                empates: { comunas: [], jefaturas: [] },
                fuente: ''
            },
            ds67: {
                cotizacionActual: '—',
                cotizacionCap: '—',
                tsit: '—',
                tsitCap: '—',
                holgura: '—',
                holguraCap: '—',
                costo: '—',
                costoCap: '—',
                variacion: '—',
                variacionCap: '—',
                tramos: []
            },
            permisos: {
                isRestrictedByRbd,
                assignedRbdsCount: assignedRbds ? assignedRbds.length : null,
                sucursalesAutorizadas
            },
            periodosDisponibles: []
        };
    }

    // Cruce de supervisores con la BD para las jefaturas
    const supervisoresDb = await rawPrisma.supervisor.findMany({
        select: {
            id: true,
            nombre: true,
            apellido: true,
            correo: true,
            rbdsAuditar: { select: { rbd: true } }
        }
    }).catch(() => [])

    let rawTop10Jefaturas: TopItem[] = parsedPayload?.top10?.jefaturas || []
    rawTop10Jefaturas = rawTop10Jefaturas.map(j => {
        const normJef = j.name.toLowerCase().trim()
        const match = supervisoresDb.find(s => {
            const full1 = `${s.nombre} ${s.apellido}`.toLowerCase().trim()
            const full2 = `${s.apellido} ${s.nombre}`.toLowerCase().trim()
            return full1 === normJef || full2 === normJef || (normJef.includes(s.nombre.toLowerCase()) && normJef.includes(s.apellido.toLowerCase()))
        })
        return {
            ...j,
            supervisorId: match?.id || null,
            correo: match?.correo || null,
            totalRbds: match?.rbdsAuditar?.length || 0
        }
    })

    // Aplicar filtro de sucursales / zonas permitidas para el usuario conectado
    let zonasFiltradas: ZonaReporteItem[] = (parsedPayload?.zonas || []).map((z: any) => ({
        ...z,
        sucursalSistema: ZONA_SUCURSAL_MAP[z.name] || z.name
    }))

    let rankingFiltrado = parsedPayload?.ranking || []
    let comunasFiltradas: TopItem[] = parsedPayload?.top10?.comunas || []
    let jefaturasFiltradas: TopItem[] = rawTop10Jefaturas

    if (isRestrictedByRbd) {
        const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        zonasFiltradas = zonasFiltradas.filter(z => sucursalesAutorizadas.some(sa => norm(sa) === norm(z.name)))
        rankingFiltrado = rankingFiltrado.filter((r: any) => sucursalesAutorizadas.some(sa => norm(sa) === norm(r.name)))
        comunasFiltradas = comunasFiltradas.filter(c => sucursalesAutorizadas.some(sa => norm(sa) === norm(c.zona)))
        jefaturasFiltradas = jefaturasFiltradas.filter(j => sucursalesAutorizadas.some(sa => norm(sa) === norm(j.zona)))
    }

    const periodosDisponibles = historialRows.map(r => ({
        id: r.id,
        periodo: r.periodo,
        fileName: r.fileName,
        fecha: new Date(r.createdAt).toISOString()
    }))

    return {
        hasData: !!parsedPayload,
        periodo: parsedPayload?.periodo || 'Sin datos cargados',
        anio: parsedPayload?.anio || new Date().getFullYear(),
        mes: parsedPayload?.mes || 1,
        fuente: parsedPayload?.fuente || 'Sin fuente',
        cargado: parsedPayload?.cargado || '—',
        nacional: parsedPayload?.nacional || [],
        zonas: zonasFiltradas,
        totales: parsedPayload?.totales || { accidentes: {}, dias: {} },
        ranking: rankingFiltrado,
        top10: {
            periodo: parsedPayload?.top10?.periodo || parsedPayload?.periodo || '',
            totalAcc: parsedPayload?.top10?.totalAcc || 0,
            totalDias: parsedPayload?.top10?.totalDias || 0,
            comunas: comunasFiltradas,
            jefaturas: jefaturasFiltradas,
            empates: parsedPayload?.top10?.empates || { comunas: [], jefaturas: [] },
            fuente: parsedPayload?.top10?.fuente || ''
        },
        ds67: parsedPayload?.ds67 || {
            cotizacionActual: '—',
            cotizacionCap: '—',
            tsit: '—',
            tsitCap: '—',
            holgura: '—',
            holguraCap: '—',
            costo: '—',
            costoCap: '—',
            variacion: '—',
            variacionCap: '—',
            tramos: []
        },
        permisos: {
            isRestrictedByRbd,
            assignedRbdsCount: assignedRbds ? assignedRbds.length : null,
            sucursalesAutorizadas
        },
        periodosDisponibles
    }
}

