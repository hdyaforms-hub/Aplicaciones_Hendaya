'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { logAuditAction } from '@/lib/audit'

export type RiesgoMinutaFilterParams = {
    fecha?: string        // YYYY-MM-DD
    licitacion?: string
    sucursal?: string
    rbd?: number
    nivelRiesgo?: string  // 'TODOS' | 'ALTO' | 'MEDIO' | 'LEVE' | 'SIN_ASIGNAR'
}

export type PlatoCritico = {
    numeroPreparacion: number
    nombre: string
    gravedad: 'ALTO' | 'MEDIO' | 'LEVE' | 'SIN_ASIGNAR'
    subServicio: string
    servicio: string
}

export type PreparacionDetalle = {
    numeroPreparacion: number
    nombre: string
    subServicio: string
    gravedad: 'ALTO' | 'MEDIO' | 'LEVE' | 'SIN_ASIGNAR'
}

export type ServicioMinutaDetalle = {
    servicio: string
    numeroServicio?: string
    programa: string
    numeroPrograma: string
    area?: string
    cantidad: number
    numeroMinuta?: string
    nivelRiesgoServicio: 'ALTO' | 'MEDIO' | 'LEVE' | 'SIN_ASIGNAR'
    preparaciones: PreparacionDetalle[]
}

export type ColegioRiesgoItem = {
    rbd: number
    nombre: string
    comuna?: string
    sucursal: string
    institucion: string
    totalRaciones: number
    score: number
    nivelRiesgo: 'ALTO' | 'MEDIO' | 'LEVE' | 'SIN_ASIGNAR'
    countAlto: number
    countMedio: number
    countLeve: number
    countSinAsignar: number
    platosCriticos: PlatoCritico[]
    servicios: ServicioMinutaDetalle[]
}

export type RiesgoMinutaDashboardData = {
    fechaConsultada: string
    hasDataForDate: boolean
    kpis: {
        totalColegiosEvaluados: number
        totalMinutasEvaluadas: number
        colegiosRiesgoAlto: number
        colegiosRiesgoMedio: number
        colegiosRiesgoLeve: number
        colegiosSinAsignar: number
        racionesEnRiesgoAlto: number
        platosCriticosDetectados: number
    }
    top10Peligrosos: ColegioRiesgoItem[]
    colegiosDetalle: ColegioRiesgoItem[]
    filtrosDisponibles: {
        fechasConDatos: string[]
        fechasConRiesgo?: string[]
        licitaciones: string[]
        sucursales: string[]
        colegios: { rbd: number; nombre: string; comuna?: string; sucursal?: string }[]
    }
    permisos: {
        isRestrictedByRbd: boolean
        assignedRbdsCount: number | null
    }
}

function normalizeDishName(name: string): string {
    return (name || '').trim().replace(/\s+/g, ' ').toUpperCase()
}

const GRAVEDAD_RANK: Record<'ALTO' | 'MEDIO' | 'LEVE' | 'SIN_ASIGNAR', number> = {
    ALTO: 3,
    MEDIO: 2,
    LEVE: 1,
    SIN_ASIGNAR: 0
}

const SUB_SERVICIO_ORDER: Record<string, number> = {
    '1': 1,   // PORC.LIQUIDA
    '2': 2,   // PORC.SOLIDA
    '3': 3,   // ENTRADA
    '4': 4,   // GUISO
    '10': 5,  // ACOMPAÑAMIENTO
    '5': 6,   // POSTRE
    '11': 7   // AGUA
}

/**
 * Obtiene métricas analíticas y ranking del módulo Riesgo en Minuta
 * Cruza Raciones + Minutas + Preparaciones (filtrado por Área geográfica) + Prev_GravedadPreparacion + Colegios
 */
export async function fetchRiesgoMinutaData(filters?: RiesgoMinutaFilterParams): Promise<RiesgoMinutaDashboardData> {
    const session = await getSession()
    if (!session || !session.user) {
        throw new Error('No autorizado. Sesión no válida.')
    }

    const isAdmin = session.user.role?.name?.toLowerCase().includes('admin') ||
                    session.user.role?.name?.toLowerCase().includes('gerencia')
    const permissions = session.user.role?.permissions || []

    if (!isAdmin && !permissions.includes('view_prev_riesgo_minuta')) {
        throw new Error('No posees permisos para acceder al módulo Riesgo en Minuta.')
    }

    // Evaluación estricta de RBDs por perfil de usuario
    const userEffectiveRbds = await getUserEffectiveRbds()
    const isRestrictedByRbd = userEffectiveRbds !== null
    const assignedRbds = isRestrictedByRbd ? userEffectiveRbds : null

    // Registrar en auditoría
    try {
        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'VISUALIZAR_RIESGO_MINUTA',
            modulo: 'Áreas -> Prev. de riesgos',
            detalle: `Consulta Riesgo en Minuta (Fecha=${filters?.fecha || 'Hoy'}, Licitacion=${filters?.licitacion || 'Todas'}, Sucursal=${filters?.sucursal || 'Todas'}, RBD=${filters?.rbd || 'Todos'})`
        })
    } catch (e) {
        console.error('Error registrando auditoría en Riesgo en Minuta:', e)
    }

    // 1. Determinar fecha de consulta (por defecto hoy en formato YYYY-MM-DD)
    const today = new Date()
    const defaultDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const fechaStr = (filters?.fecha && filters.fecha.trim() !== '') ? filters.fecha.trim() : defaultDateStr

    const [anioParsed, mesParsed, diaParsed] = fechaStr.split('-').map(n => parseInt(n, 10))
    const anio = isNaN(anioParsed) ? today.getFullYear() : anioParsed
    const mes = isNaN(mesParsed) ? today.getMonth() + 1 : mesParsed
    const dia = isNaN(diaParsed) ? today.getDate() : diaParsed

    // 2. Si el usuario está restringido y tiene 0 RBDs asignados, retornar estado vacío seguro
    if (isRestrictedByRbd && assignedRbds && assignedRbds.length === 0) {
        return {
            fechaConsultada: fechaStr,
            hasDataForDate: false,
            kpis: {
                totalColegiosEvaluados: 0,
                totalMinutasEvaluadas: 0,
                colegiosRiesgoAlto: 0,
                colegiosRiesgoMedio: 0,
                colegiosRiesgoLeve: 0,
                colegiosSinAsignar: 0,
                racionesEnRiesgoAlto: 0,
                platosCriticosDetectados: 0
            },
            top10Peligrosos: [],
            colegiosDetalle: [],
            filtrosDisponibles: {
                fechasConDatos: [],
                fechasConRiesgo: [],
                licitaciones: [],
                sucursales: [],
                colegios: []
            },
            permisos: {
                isRestrictedByRbd: true,
                assignedRbdsCount: 0
            }
        }
    }

    // 3. Cargar en paralelo:
    //    a) Matriz de gravedad preventiva (Prev_GravedadPreparacion)
    //    b) Minutas correspondientes al día seleccionado
    //    c) Raciones del mes correspondiente (respetando RBDs asignados al perfil)
    //    d) Catálogo de colegios para enriquecer institución, comuna y sucursal
    //    e) Fechas con minutas cargadas y fechas con alertas de riesgo activas
    const racionesBaseWhere: any = {
        anio,
        mes,
        rbd: { gt: 0 }
    }

    if (isRestrictedByRbd && assignedRbds) {
        racionesBaseWhere.rbd = { in: assignedRbds }
    }
    if (filters?.licitacion && filters.licitacion !== 'ALL') {
        racionesBaseWhere.licitacion = filters.licitacion.trim()
    }

    const minutasWhere: any = {
        anio,
        mes,
        dia
    }
    if (filters?.licitacion && filters.licitacion !== 'ALL') {
        minutasWhere.licitacion = filters.licitacion.trim()
    }

    const [gravedadRows, minutasDia, racionesMes, colegiosDb, fechasDisponiblesRaw, fechasConRiesgoRaw] = await Promise.all([
        rawPrisma.prevGravedadPreparacion.findMany({
            select: {
                licitacion: true,
                numeroPreparacion: true,
                nombrePreparacion: true,
                codigoSubServicio: true,
                nombreSubServicio: true,
                gravedad: true
            }
        }),
        rawPrisma.minutas.findMany({
            where: minutasWhere,
            select: {
                licitacion: true,
                numeroMinuta: true,
                numeroPrograma: true,
                programa: true,
                codigoServicio: true,
                nombreServicio: true,
                codigoEnlace: true,
                nombreEnlace: true,
                numeroCocina: true,
                numeroPreparacion: true,
                sucid: true
            }
        }),
        rawPrisma.raciones.findMany({
            where: racionesBaseWhere,
            select: {
                rbd: true,
                licitacion: true,
                numeroPrograma: true,
                programa: true,
                numeroServicio: true,
                servicio: true,
                numeroEnlace: true,
                numeroCocina: true,
                numeroArea: true,
                cantidad: true,
                locacion: true
            }
        }),
        rawPrisma.colegios.findMany({
            select: {
                colRBD: true,
                nombreEstablecimiento: true,
                institucion: true,
                sucursal: true,
                comuna: true
            }
        }),
        // Fechas sugeridas con datos en Minutas (priorizando mes consultado y recientes)
        rawPrisma.$queryRawUnsafe<{ anio: number; mes: number; dia: number }[]>(`
            SELECT "anio", "mes", "dia"
            FROM "hend_app"."Minutas"
            GROUP BY "anio", "mes", "dia"
            ORDER BY 
                CASE WHEN "anio" = ${Number(anio)} AND "mes" = ${Number(mes)} THEN 0 ELSE 1 END ASC,
                "anio" DESC, "mes" DESC, "dia" DESC
            LIMIT 20;
        `).catch(() => []),
        // Fechas donde existen preparaciones con gravedad asignada (ALTO, MEDIO, LEVE)
        rawPrisma.$queryRawUnsafe<{ anio: number; mes: number; dia: number }[]>(`
            SELECT DISTINCT m."anio", m."mes", m."dia"
            FROM "hend_app"."Minutas" m
            INNER JOIN "hend_app"."Prev_GravedadPreparacion" g1
                ON m."licitacion" = g1."licitacion" AND m."numeroPreparacion" = g1."numeroPreparacion"
            INNER JOIN (
                SELECT DISTINCT "licitacion", TRIM("nombrePreparacion") AS norm_nombre
                FROM "hend_app"."Prev_GravedadPreparacion"
                WHERE "gravedad" IN ('ALTO', 'MEDIO', 'LEVE')
            ) g2
                ON g1."licitacion" = g2."licitacion" AND TRIM(g1."nombrePreparacion") = g2.norm_nombre
            ORDER BY m."anio" DESC, m."mes" DESC, m."dia" DESC
            LIMIT 15;
        `).catch(() => [])
    ])

    // 3b. Consultar Preparaciones para los numeroPreparacion presentes en las minutas del día
    //     Esto permite filtrar con exactitud por el numeroArea (Urbano Rural vs Rural, etc.) de cada colegio en Raciones
    const uniquePrepIdsDia = Array.from(
        new Set(
            minutasDia
                .map(m => Number(m.numeroPreparacion))
                .filter(n => !isNaN(n) && n > 0)
        )
    )

    const preparacionesDiaRows = uniquePrepIdsDia.length > 0
        ? await rawPrisma.preparaciones.findMany({
            where: {
                numeroPreparacion: { in: uniquePrepIdsDia }
            },
            select: {
                licitacion: true,
                numeroPreparacion: true,
                nombrePreparacion: true,
                numeroArea: true,
                area: true,
                codigoSubServicio: true,
                nombreSubServicio: true
            },
            distinct: ['licitacion', 'numeroPreparacion', 'numeroArea']
        })
        : []

    // Catálogo de Preparaciones por (licitacion___numeroPreparacion) -> áreas válidas y metadatos del plato
    const prepCatalogMap = new Map<string, {
        areas: Set<string>
        areaLabels: Map<string, string>
        nombrePreparacion: string
        codigoSubServicio: string
        nombreSubServicio: string
    }>()

    for (const pr of preparacionesDiaRows) {
        const key = `${pr.licitacion.trim()}___${Number(pr.numeroPreparacion)}`
        const areaCode = (pr.numeroArea || '').trim()
        const areaLabel = (pr.area || '').trim()
        if (!prepCatalogMap.has(key)) {
            prepCatalogMap.set(key, {
                areas: new Set(),
                areaLabels: new Map(),
                nombrePreparacion: (pr.nombrePreparacion || '').trim(),
                codigoSubServicio: (pr.codigoSubServicio || '').trim(),
                nombreSubServicio: (pr.nombreSubServicio || '').trim() || 'S/D'
            })
        }
        const entry = prepCatalogMap.get(key)!
        if (areaCode) {
            entry.areas.add(areaCode)
            if (areaLabel) entry.areaLabels.set(areaCode, areaLabel)
        }
    }

    // Mapas de gravedad:
    // 1) Por (licitacion___numeroPreparacion) exacto
    // 2) Fallback por (licitacion___nombrePreparacion normalizado) para propagar la clasificación del plato entre áreas/programas equivalentes
    const gravedadByNumMap = new Map<string, {
        gravedad: 'ALTO' | 'MEDIO' | 'LEVE' | 'SIN_ASIGNAR'
        nombrePreparacion: string
        codigoSubServicio?: string | null
        nombreSubServicio?: string | null
    }>()

    const gravedadByNameMap = new Map<string, {
        gravedad: 'ALTO' | 'MEDIO' | 'LEVE' | 'SIN_ASIGNAR'
        nombrePreparacion: string
        codigoSubServicio?: string | null
        nombreSubServicio?: string | null
    }>()

    for (const g of gravedadRows) {
        const lic = g.licitacion.trim()
        const prepNum = Number(g.numeroPreparacion)
        const numKey = `${lic}___${prepNum}`
        const grav: 'ALTO' | 'MEDIO' | 'LEVE' | 'SIN_ASIGNAR' =
            (g.gravedad === 'ALTO' || g.gravedad === 'MEDIO' || g.gravedad === 'LEVE')
                ? g.gravedad
                : 'SIN_ASIGNAR'

        const cleanNombre = (g.nombrePreparacion || '').trim()
        const cleanSubServ = g.nombreSubServicio ? g.nombreSubServicio.trim() : null
        const cleanCodSubServ = g.codigoSubServicio ? g.codigoSubServicio.trim() : null

        gravedadByNumMap.set(numKey, {
            gravedad: grav,
            nombrePreparacion: cleanNombre,
            codigoSubServicio: cleanCodSubServ,
            nombreSubServicio: cleanSubServ
        })

        if (grav !== 'SIN_ASIGNAR' && cleanNombre) {
            const nameKey = `${lic}___${normalizeDishName(cleanNombre)}`
            const existing = gravedadByNameMap.get(nameKey)
            if (!existing || GRAVEDAD_RANK[grav] > GRAVEDAD_RANK[existing.gravedad]) {
                gravedadByNameMap.set(nameKey, {
                    gravedad: grav,
                    nombrePreparacion: cleanNombre,
                    codigoSubServicio: cleanCodSubServ,
                    nombreSubServicio: cleanSubServ
                })
            }
        }
    }

    // Mapa de colegios
    const colegiosMap = new Map<number, { nombre: string; institucion: string; sucursal: string; comuna?: string }>()
    for (const c of colegiosDb) {
        colegiosMap.set(c.colRBD, {
            nombre: (c.nombreEstablecimiento || '').trim(),
            institucion: (c.institucion || 'JUNAEB').trim(),
            sucursal: (c.sucursal || '').trim(),
            comuna: c.comuna ? c.comuna.trim() : undefined
        })
    }

    // Agrupar minutas por clave de cruce: licitacion___programa___servicio___enlace___cocina
    // y deduplicar por numeroPreparacion para eliminar filas repetidas en la carga de Minutas
    const minutasMap = new Map<string, Map<number, typeof minutasDia[0]>>()
    for (const m of minutasDia) {
        const key = `${m.licitacion.trim()}___${m.numeroPrograma.trim()}___${m.codigoServicio.trim()}___${Number(m.codigoEnlace)}___${Number(m.numeroCocina)}`
        if (!minutasMap.has(key)) {
            minutasMap.set(key, new Map())
        }
        const prepNum = Number(m.numeroPreparacion)
        if (!minutasMap.get(key)!.has(prepNum)) {
            minutasMap.get(key)!.set(prepNum, m)
        }
    }

    // Agrupar Raciones por (rbd, licitacion, numeroPrograma, numeroServicio, numeroEnlace, numeroCocina, numeroArea)
    // sumando la cantidad de raciones (ej. ALUMNO + PROFESOR) y descartando registros con cantidad total <= 0
    const racionesAgrupadasMap = new Map<string, {
        rbd: number
        licitacion: string
        numeroPrograma: string
        programa: string
        numeroServicio: string
        servicio: string
        numeroEnlace: number
        numeroCocina: number
        numeroArea: string
        cantidad: number
        locacion: string
    }>()

    for (const r of racionesMes) {
        const rKey = `${r.rbd}___${r.licitacion.trim()}___${r.numeroPrograma.trim()}___${r.numeroServicio.trim()}___${Number(r.numeroEnlace)}___${Number(r.numeroCocina)}___${(r.numeroArea || '').trim()}`
        if (!racionesAgrupadasMap.has(rKey)) {
            racionesAgrupadasMap.set(rKey, {
                rbd: r.rbd,
                licitacion: r.licitacion.trim(),
                numeroPrograma: r.numeroPrograma.trim(),
                programa: (r.programa || '').trim(),
                numeroServicio: r.numeroServicio.trim(),
                servicio: (r.servicio || '').trim(),
                numeroEnlace: Number(r.numeroEnlace),
                numeroCocina: Number(r.numeroCocina),
                numeroArea: (r.numeroArea || '').trim(),
                cantidad: 0,
                locacion: (r.locacion || '').trim()
            })
        }
        racionesAgrupadasMap.get(rKey)!.cantidad += Number(r.cantidad || 0)
    }

    // 4. Procesar el cruce por colegio (primero sobre el universo disponible para alimentar los filtros y luego aplicando filtros de sucursal/RBD)
    const sucursalesDisponiblesSet = new Set<string>()
    const colegiosDisponiblesMap = new Map<number, { rbd: number; nombre: string; comuna?: string; sucursal?: string }>()
    const colegiosRiesgoMap = new Map<number, ColegioRiesgoItem>()
    const platosCriticosGlobalMap = new Set<string>()
    let totalServiciosMinutasEvaluadas = 0

    for (const r of racionesAgrupadasMap.values()) {
        // Ignorar servicios sin raciones asignadas (cantidad = 0)
        if (r.cantidad <= 0) continue

        const mKey = `${r.licitacion}___${r.numeroPrograma}___${r.numeroServicio}___${r.numeroEnlace}___${r.numeroCocina}`
        const prepsEnMinutaMap = minutasMap.get(mKey)
        if (!prepsEnMinutaMap || prepsEnMinutaMap.size === 0) continue

        // Filtrar las preparaciones de la minuta que corresponden exactamente al numeroArea del colegio (ej. '1' Urbano Rural vs '2' Rural)
        const minutasDeArea: { m: typeof minutasDia[0]; prepCat?: ReturnType<typeof prepCatalogMap.get> }[] = []
        for (const [prepNum, m] of prepsEnMinutaMap.entries()) {
            const pKey = `${r.licitacion}___${prepNum}`
            const prepCat = prepCatalogMap.get(pKey)
            if (prepCat) {
                if (!r.numeroArea || prepCat.areas.size === 0 || prepCat.areas.has(r.numeroArea)) {
                    minutasDeArea.push({ m, prepCat })
                }
            }
        }

        // Fallback de seguridad únicamente si ninguna preparación de la minuta estuvo en el catálogo de Preparaciones
        if (minutasDeArea.length === 0) {
            const hasAnyInCatalog = Array.from(prepsEnMinutaMap.keys()).some(prepNum =>
                prepCatalogMap.has(`${r.licitacion}___${prepNum}`)
            )
            if (!hasAnyInCatalog) {
                for (const [, m] of prepsEnMinutaMap.entries()) {
                    minutasDeArea.push({ m, prepCat: undefined })
                }
            }
        }

        if (minutasDeArea.length === 0) continue

        const firstMinuta = minutasDeArea[0].m
        const colInfo = colegiosMap.get(r.rbd)
        const nombreCol = colInfo?.nombre || r.locacion || `Colegio RBD ${r.rbd}`
        const institucionCol = colInfo?.institucion || 'JUNAEB'
        // Usar Colegios.sucursal o el código de sucursal de la minuta (sucid: CD METRO, CD COPIAPO, etc.)
        const sucursalCol = (colInfo?.sucursal && colInfo.sucursal !== '' && colInfo.sucursal !== 'N/A')
            ? colInfo.sucursal
            : (firstMinuta?.sucid?.trim() || firstMinuta?.nombreEnlace?.trim() || 'CENTRO')

        sucursalesDisponiblesSet.add(sucursalCol)

        // Filtro por sucursal
        if (filters?.sucursal && filters.sucursal !== 'ALL') {
            const sucFilter = filters.sucursal.toLowerCase().trim()
            if (!sucursalCol.toLowerCase().includes(sucFilter)) {
                continue
            }
        }

        // Registrar colegio en las opciones del autocompletado (respetando filtro de sucursal si está activo)
        if (!colegiosDisponiblesMap.has(r.rbd)) {
            colegiosDisponiblesMap.set(r.rbd, {
                rbd: r.rbd,
                nombre: nombreCol,
                comuna: colInfo?.comuna,
                sucursal: sucursalCol
            })
        }

        // Filtro por RBD específico
        if (filters?.rbd && r.rbd !== filters.rbd) {
            continue
        }

        totalServiciosMinutasEvaluadas++

        if (!colegiosRiesgoMap.has(r.rbd)) {
            colegiosRiesgoMap.set(r.rbd, {
                rbd: r.rbd,
                nombre: nombreCol,
                comuna: colInfo?.comuna,
                sucursal: sucursalCol,
                institucion: institucionCol,
                totalRaciones: 0,
                score: 0,
                nivelRiesgo: 'SIN_ASIGNAR',
                countAlto: 0,
                countMedio: 0,
                countLeve: 0,
                countSinAsignar: 0,
                platosCriticos: [],
                servicios: []
            })
        }

        const colegioItem = colegiosRiesgoMap.get(r.rbd)!
        colegioItem.totalRaciones += r.cantidad

        // Preparaciones de este servicio
        const preparacionesDelServicio: (PreparacionDetalle & { _codSub: string })[] = []
        let riesgoMaxServicio: 'ALTO' | 'MEDIO' | 'LEVE' | 'SIN_ASIGNAR' = 'SIN_ASIGNAR'

        for (const { m, prepCat } of minutasDeArea) {
            const prepNum = Number(m.numeroPreparacion)
            const pKey = `${m.licitacion.trim()}___${prepNum}`
            const gExact = gravedadByNumMap.get(pKey)

            const nomPrep = prepCat?.nombrePreparacion || gExact?.nombrePreparacion || `Preparación N° ${prepNum}`
            const normNameKey = `${m.licitacion.trim()}___${normalizeDishName(nomPrep)}`
            const gByName = gravedadByNameMap.get(normNameKey)

            const grav: 'ALTO' | 'MEDIO' | 'LEVE' | 'SIN_ASIGNAR' =
                (gExact && gExact.gravedad !== 'SIN_ASIGNAR')
                    ? gExact.gravedad
                    : (gByName ? gByName.gravedad : 'SIN_ASIGNAR')

            const subServ = prepCat?.nombreSubServicio || gExact?.nombreSubServicio || gByName?.nombreSubServicio || 'S/D'
            const codSubServ = prepCat?.codigoSubServicio || gExact?.codigoSubServicio || gByName?.codigoSubServicio || '99'

            preparacionesDelServicio.push({
                numeroPreparacion: prepNum,
                nombre: nomPrep,
                subServicio: subServ,
                gravedad: grav,
                _codSub: codSubServ
            })

            if (grav === 'ALTO') {
                riesgoMaxServicio = 'ALTO'
                colegioItem.countAlto++
                platosCriticosGlobalMap.add(normNameKey)
                if (!colegioItem.platosCriticos.some(p => p.numeroPreparacion === prepNum && p.servicio === r.servicio)) {
                    colegioItem.platosCriticos.push({
                        numeroPreparacion: prepNum,
                        nombre: nomPrep,
                        gravedad: 'ALTO',
                        subServicio: subServ,
                        servicio: r.servicio
                    })
                }
            } else if (grav === 'MEDIO') {
                if (riesgoMaxServicio !== 'ALTO') riesgoMaxServicio = 'MEDIO'
                colegioItem.countMedio++
                platosCriticosGlobalMap.add(normNameKey)
                if (!colegioItem.platosCriticos.some(p => p.numeroPreparacion === prepNum && p.servicio === r.servicio)) {
                    colegioItem.platosCriticos.push({
                        numeroPreparacion: prepNum,
                        nombre: nomPrep,
                        gravedad: 'MEDIO',
                        subServicio: subServ,
                        servicio: r.servicio
                    })
                }
            } else if (grav === 'LEVE') {
                if (riesgoMaxServicio !== 'ALTO' && riesgoMaxServicio !== 'MEDIO') riesgoMaxServicio = 'LEVE'
                colegioItem.countLeve++
            } else {
                colegioItem.countSinAsignar++
            }
        }

        // Ordenar las preparaciones dentro del servicio según secuencia lógica (Líquida -> Sólida -> Entrada -> Guiso -> Acompañamiento -> Postre -> Agua)
        preparacionesDelServicio.sort((a, b) => {
            const ordA = SUB_SERVICIO_ORDER[a._codSub] ?? 50
            const ordB = SUB_SERVICIO_ORDER[b._codSub] ?? 50
            return ordA - ordB || a.numeroPreparacion - b.numeroPreparacion
        })

        const areaLabel = minutasDeArea[0]?.prepCat?.areaLabels.get(r.numeroArea) || (r.numeroArea === '1' ? 'Urbano Rural' : r.numeroArea === '2' ? 'Rural' : undefined)

        colegioItem.servicios.push({
            servicio: r.servicio,
            numeroServicio: r.numeroServicio,
            programa: r.programa,
            numeroPrograma: r.numeroPrograma,
            area: areaLabel,
            cantidad: r.cantidad,
            numeroMinuta: firstMinuta?.numeroMinuta,
            nivelRiesgoServicio: riesgoMaxServicio,
            preparaciones: preparacionesDelServicio.map(({ _codSub, ...rest }) => rest)
        })
    }

    // 5. Determinar Score y Nivel de Riesgo final por Colegio
    let racionesEnRiesgoAltoTotal = 0
    let colegiosAltoCount = 0
    let colegiosMedioCount = 0
    let colegiosLeveCount = 0
    let colegiosSinAsignarCount = 0

    const colegiosProcesados = Array.from(colegiosRiesgoMap.values()).map(c => {
        // Ordenar los servicios del colegio por código de servicio (1=Desayuno, 2=Almuerzo, 3=Once, 4=Cena, 5=Colación) y programa
        c.servicios.sort((a, b) =>
            (parseInt(a.numeroServicio || '99', 10) - parseInt(b.numeroServicio || '99', 10)) ||
            a.programa.localeCompare(b.programa)
        )

        // Score ponderado
        c.score = (c.countAlto * 10) + (c.countMedio * 4) + (c.countLeve * 1)

        // Sumar únicamente las raciones de los servicios que efectivamente contienen platos de ALTO riesgo
        for (const srv of c.servicios) {
            if (srv.nivelRiesgoServicio === 'ALTO') {
                racionesEnRiesgoAltoTotal += srv.cantidad
            }
        }

        if (c.countAlto > 0) {
            c.nivelRiesgo = 'ALTO'
            colegiosAltoCount++
        } else if (c.countMedio > 0) {
            c.nivelRiesgo = 'MEDIO'
            colegiosMedioCount++
        } else if (c.countLeve > 0) {
            c.nivelRiesgo = 'LEVE'
            colegiosLeveCount++
        } else {
            c.nivelRiesgo = 'SIN_ASIGNAR'
            colegiosSinAsignarCount++
        }

        return c
    })

    // Ordenar ranking por peligrosidad
    colegiosProcesados.sort((a, b) =>
        b.score - a.score ||
        b.countAlto - a.countAlto ||
        b.countMedio - a.countMedio ||
        b.totalRaciones - a.totalRaciones
    )

    // Top 10 colegios con minutas más peligrosas (solo aquellos que tienen score de riesgo > 0)
    const top10Peligrosos = colegiosProcesados.filter(c => c.score > 0).slice(0, 10)

    // Filtrar lista completa según filtro de riesgo
    let colegiosDetalle = colegiosProcesados
    if (filters?.nivelRiesgo && filters.nivelRiesgo !== 'TODOS') {
        colegiosDetalle = colegiosProcesados.filter(c => c.nivelRiesgo === filters.nivelRiesgo)
    }

    // Opciones para filtros
    const sucursalesUnicas = Array.from(sucursalesDisponiblesSet).filter(Boolean).sort()
    const licitacionesUnicas = Array.from(new Set(racionesMes.map(r => r.licitacion.trim()).filter(Boolean))).sort()
    const colegiosFiltroOptions = Array.from(colegiosDisponiblesMap.values()).sort((a, b) => a.rbd - b.rbd)

    // Formatear fechas con alertas de riesgo y fechas generales disponibles
    const fechasConRiesgo = fechasConRiesgoRaw.map(f =>
        `${f.anio}-${String(f.mes).padStart(2, '0')}-${String(f.dia).padStart(2, '0')}`
    )
    const fechasGenerales = fechasDisponiblesRaw.map(f =>
        `${f.anio}-${String(f.mes).padStart(2, '0')}-${String(f.dia).padStart(2, '0')}`
    )
    // Priorizar en fechasConDatos las fechas que tienen alertas de riesgo para facilitar la supervisión
    const fechasConDatos = Array.from(new Set([...fechasConRiesgo, ...fechasGenerales]))

    return {
        fechaConsultada: fechaStr,
        hasDataForDate: colegiosProcesados.length > 0,
        kpis: {
            totalColegiosEvaluados: colegiosProcesados.length,
            totalMinutasEvaluadas: totalServiciosMinutasEvaluadas,
            colegiosRiesgoAlto: colegiosAltoCount,
            colegiosRiesgoMedio: colegiosMedioCount,
            colegiosRiesgoLeve: colegiosLeveCount,
            colegiosSinAsignar: colegiosSinAsignarCount,
            racionesEnRiesgoAlto: racionesEnRiesgoAltoTotal,
            platosCriticosDetectados: platosCriticosGlobalMap.size
        },
        top10Peligrosos,
        colegiosDetalle,
        filtrosDisponibles: {
            fechasConDatos,
            fechasConRiesgo,
            licitaciones: licitacionesUnicas,
            sucursales: sucursalesUnicas,
            colegios: colegiosFiltroOptions
        },
        permisos: {
            isRestrictedByRbd,
            assignedRbdsCount: assignedRbds ? assignedRbds.length : null
        }
    }
}
