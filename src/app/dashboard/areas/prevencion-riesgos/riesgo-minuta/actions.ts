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
    programa: string
    numeroPrograma: string
    cantidad: number
    numeroMinuta?: string
    nivelRiesgoServicio: 'ALTO' | 'MEDIO' | 'LEVE' | 'SIN_ASIGNAR'
    preparaciones: PreparacionDetalle[]
}

export type ColegioRiesgoItem = {
    rbd: number
    nombre: string
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
        licitaciones: string[]
        sucursales: string[]
        colegios: { rbd: number; nombre: string; comuna?: string; sucursal?: string }[]
    }
    permisos: {
        isRestrictedByRbd: boolean
        assignedRbdsCount: number | null
    }
}

/**
 * Obtiene métricas analíticas y ranking del módulo Riesgo en Minuta
 * Cruza Raciones + Minutas + Preparaciones + Prev_GravedadPreparacion + Colegios
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
    //    a) Matriz de gravedad preventiva
    //    b) Minutas correspondientes al día seleccionado
    //    c) Raciones del mes correspondiente
    //    d) Catálogo de colegios para enriquecer institución y sucursal
    const racionesWhere: any = {
        anio,
        mes,
        rbd: { gt: 0 }
    }

    if (isRestrictedByRbd && assignedRbds) {
        racionesWhere.rbd = { in: assignedRbds }
    }
    if (filters?.rbd) {
        racionesWhere.rbd = filters.rbd
    }
    if (filters?.licitacion && filters.licitacion !== 'ALL') {
        racionesWhere.licitacion = filters.licitacion.trim()
    }

    const minutasWhere: any = {
        anio,
        mes,
        dia
    }
    if (filters?.licitacion && filters.licitacion !== 'ALL') {
        minutasWhere.licitacion = filters.licitacion.trim()
    }

    const [gravedadRows, minutasDia, racionesMes, colegiosDb, fechasDisponiblesRaw] = await Promise.all([
        rawPrisma.prevGravedadPreparacion.findMany({
            select: {
                licitacion: true,
                numeroPreparacion: true,
                nombrePreparacion: true,
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
                codigoServicio: true,
                codigoEnlace: true,
                numeroCocina: true,
                numeroPreparacion: true,
                sucid: true,
                nombreServicio: true,
                nombreEnlace: true
            }
        }),
        rawPrisma.raciones.findMany({
            where: racionesWhere,
            select: {
                rbd: true,
                licitacion: true,
                numeroPrograma: true,
                programa: true,
                numeroServicio: true,
                servicio: true,
                numeroEnlace: true,
                numeroCocina: true,
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
        // Fechas sugeridas con datos en Minutas
        rawPrisma.$queryRawUnsafe<{ anio: number; mes: number; dia: number }[]>(`
            SELECT anio, mes, dia
            FROM "hend_app"."Minutas"
            GROUP BY anio, mes, dia
            ORDER BY anio DESC, mes DESC, dia DESC
            LIMIT 15;
        `).catch(() => [])
    ])

    // Mapa de gravedad
    const gravedadMap = new Map<string, { gravedad: 'ALTO' | 'MEDIO' | 'LEVE' | 'SIN_ASIGNAR'; nombrePreparacion: string; nombreSubServicio?: string | null }>()
    for (const g of gravedadRows) {
        const key = `${g.licitacion}___${g.numeroPreparacion}`
        const grav = (g.gravedad === 'ALTO' || g.gravedad === 'MEDIO' || g.gravedad === 'LEVE')
            ? g.gravedad
            : 'SIN_ASIGNAR'

        gravedadMap.set(key, {
            gravedad: grav,
            nombrePreparacion: g.nombrePreparacion,
            nombreSubServicio: g.nombreSubServicio
        })
    }

    // Mapa de colegios
    const colegiosMap = new Map<number, { nombre: string; institucion: string; sucursal: string; comuna?: string }>()
    for (const c of colegiosDb) {
        colegiosMap.set(c.colRBD, {
            nombre: c.nombreEstablecimiento,
            institucion: c.institucion || 'JUNAEB',
            sucursal: c.sucursal || 'N/A',
            comuna: c.comuna
        })
    }

    // Agrupar minutas por clave de cruce: licitacion___programa___servicio___enlace___cocina
    const minutasMap = new Map<string, typeof minutasDia>()
    let totalMinutasCount = 0
    for (const m of minutasDia) {
        totalMinutasCount++
        const key = `${m.licitacion}___${m.numeroPrograma.trim()}___${m.codigoServicio.trim()}___${m.codigoEnlace}___${m.numeroCocina}`
        if (!minutasMap.has(key)) {
            minutasMap.set(key, [])
        }
        minutasMap.get(key)!.push(m)
    }

    // 4. Procesar el cruce por colegio
    const colegiosRiesgoMap = new Map<number, ColegioRiesgoItem>()
    const platosCriticosGlobalMap = new Set<string>()

    for (const r of racionesMes) {
        const mKey = `${r.licitacion}___${r.numeroPrograma.trim()}___${r.numeroServicio.trim()}___${r.numeroEnlace}___${r.numeroCocina}`
        const minutas = minutasMap.get(mKey) || []
        if (minutas.length === 0) continue

        const colInfo = colegiosMap.get(r.rbd)
        const nombreCol = colInfo?.nombre || r.locacion || `Colegio RBD ${r.rbd}`
        const institucionCol = colInfo?.institucion || 'JUNAEB'
        const sucursalCol = colInfo?.sucursal && colInfo.sucursal.trim() !== ''
            ? colInfo.sucursal.trim()
            : (minutas[0]?.nombreEnlace?.trim() || 'CENTRO')

        // Filtro por sucursal
        if (filters?.sucursal && filters.sucursal !== 'ALL') {
            const sucFilter = filters.sucursal.toLowerCase().trim()
            if (!sucursalCol.toLowerCase().includes(sucFilter)) {
                continue
            }
        }

        if (!colegiosRiesgoMap.has(r.rbd)) {
            colegiosRiesgoMap.set(r.rbd, {
                rbd: r.rbd,
                nombre: nombreCol,
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
        const preparacionesDelServicio: PreparacionDetalle[] = []
        let riesgoMaxServicio: 'ALTO' | 'MEDIO' | 'LEVE' | 'SIN_ASIGNAR' = 'SIN_ASIGNAR'

        for (const m of minutas) {
            const pKey = `${m.licitacion}___${Number(m.numeroPreparacion)}`
            const g = gravedadMap.get(pKey)
            const grav = g?.gravedad || 'SIN_ASIGNAR'
            const nomPrep = g?.nombrePreparacion || `Preparación N° ${m.numeroPreparacion}`
            const subServ = g?.nombreSubServicio || 'S/D'

            preparacionesDelServicio.push({
                numeroPreparacion: Number(m.numeroPreparacion),
                nombre: nomPrep,
                subServicio: subServ,
                gravedad: grav
            })

            if (grav === 'ALTO') {
                riesgoMaxServicio = 'ALTO'
                colegioItem.countAlto++
                platosCriticosGlobalMap.add(pKey)
                if (!colegioItem.platosCriticos.some(p => p.numeroPreparacion === Number(m.numeroPreparacion))) {
                    colegioItem.platosCriticos.push({
                        numeroPreparacion: Number(m.numeroPreparacion),
                        nombre: nomPrep,
                        gravedad: 'ALTO',
                        subServicio: subServ,
                        servicio: r.servicio
                    })
                }
            } else if (grav === 'MEDIO') {
                if (riesgoMaxServicio !== 'ALTO') riesgoMaxServicio = 'MEDIO'
                colegioItem.countMedio++
                platosCriticosGlobalMap.add(pKey)
                if (!colegioItem.platosCriticos.some(p => p.numeroPreparacion === Number(m.numeroPreparacion))) {
                    colegioItem.platosCriticos.push({
                        numeroPreparacion: Number(m.numeroPreparacion),
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

        colegioItem.servicios.push({
            servicio: r.servicio,
            programa: r.programa,
            numeroPrograma: r.numeroPrograma.trim(),
            cantidad: r.cantidad,
            numeroMinuta: minutas[0]?.numeroMinuta,
            nivelRiesgoServicio: riesgoMaxServicio,
            preparaciones: preparacionesDelServicio
        })
    }

    // 5. Determinar Score y Nivel de Riesgo final por Colegio
    let racionesEnRiesgoAltoTotal = 0
    let colegiosAltoCount = 0
    let colegiosMedioCount = 0
    let colegiosLeveCount = 0
    let colegiosSinAsignarCount = 0

    const colegiosProcesados = Array.from(colegiosRiesgoMap.values()).map(c => {
        // Score ponderado
        c.score = (c.countAlto * 10) + (c.countMedio * 4) + (c.countLeve * 1)

        if (c.countAlto > 0) {
            c.nivelRiesgo = 'ALTO'
            colegiosAltoCount++
            racionesEnRiesgoAltoTotal += c.totalRaciones
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

    // Top 10 colegios con minutas más peligrosas
    const top10Peligrosos = colegiosProcesados.slice(0, 10)

    // Filtrar lista completa según filtro de riesgo
    let colegiosDetalle = colegiosProcesados
    if (filters?.nivelRiesgo && filters.nivelRiesgo !== 'TODOS') {
        colegiosDetalle = colegiosProcesados.filter(c => c.nivelRiesgo === filters.nivelRiesgo)
    }

    // Opciones para filtros
    const sucursalesUnicas = Array.from(new Set(colegiosProcesados.map(c => c.sucursal).filter(Boolean))).sort()
    const licitacionesUnicas = Array.from(new Set(racionesMes.map(r => r.licitacion).filter(Boolean))).sort()

    // Opciones de colegios para el autocompletado
    const colegiosFiltroOptions = Array.from(
        new Map(colegiosProcesados.map(c => [c.rbd, { rbd: c.rbd, nombre: c.nombre, sucursal: c.sucursal }])).values()
    ).sort((a, b) => a.rbd - b.rbd)

    // Formatear fechas sugeridas disponibles en la base de datos
    const fechasConDatos = fechasDisponiblesRaw.map(f =>
        `${f.anio}-${String(f.mes).padStart(2, '0')}-${String(f.dia).padStart(2, '0')}`
    )

    return {
        fechaConsultada: fechaStr,
        hasDataForDate: colegiosProcesados.length > 0,
        kpis: {
            totalColegiosEvaluados: colegiosProcesados.length,
            totalMinutasEvaluadas: totalMinutasCount,
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
