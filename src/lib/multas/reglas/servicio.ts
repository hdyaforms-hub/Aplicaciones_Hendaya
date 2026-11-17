/**
 * Servicio de Evaluación, Persistencia y Auditoría de Hallazgos NC (C5)
 */

import { prisma } from '@/lib/prisma'
import { getRacionesFolio } from '@/lib/multas/raciones'
import { extractFNormativo } from '@/lib/multas/extractor'
import {
    ModulosActivosLicitacion,
    SUBMODULOS_C2_DEFAULT,
    SUBMODULOS_C3_DEFAULT,
    SUBMODULOS_C4_DEFAULT,
    SUBMODULOS_C5_DEFAULT
} from '@/lib/multas/config'
import {
    evaluarReglasNC,
    EntradaActaMotor,
    EntradaAspectoMotor,
    HORARIOS_DEFAULT
} from './motor'
import {
    HallazgoNC,
    EstadoHallazgo,
    ParametrosMotorNC
} from './definiciones'

/**
 * Consulta en la base de datos el estado de activación de los módulos (C1 a C5)
 * y sus configuraciones específicas para una licitación dada.
 */
export async function getModulosActivosLicitacion(licId: number): Promise<ModulosActivosLicitacion> {
    const fallback: ModulosActivosLicitacion = {
        c1: true,
        c2: false,
        c3: false,
        c4: false,
        c5: false,
        c2Submodulos: { ...SUBMODULOS_C2_DEFAULT },
        c3Submodulos: { ...SUBMODULOS_C3_DEFAULT },
        c4Submodulos: { ...SUBMODULOS_C4_DEFAULT },
        c5Submodulos: { ...SUBMODULOS_C5_DEFAULT },
        c5Config: {
            margenTemperaturaMax: 1.0,
            umbralDotacionInasistenciaPct: 50,
            toleranciaHorarioAnticipadoMin: 60,
            toleranciaHorarioPesajeMin: 10,
            reglasHabilitadas: {}
        }
    }

    if (!licId) return fallback

    try {
        const record = await prisma.multas_Parametros_Licitacion.findUnique({
            where: { licId }
        })

        if (!record?.modulosActivosJson) return fallback

        const parsed = JSON.parse(record.modulosActivosJson)
        if (!Array.isArray(parsed)) return fallback

        const findModulo = (code: string) => parsed.find((m: any) => m.codigo === code)

        const mC1 = findModulo('C1')
        const mC2 = findModulo('C2')
        const mC3 = findModulo('C3')
        const mC4 = findModulo('C4')
        const mC5 = findModulo('C5')

        let tablaAql: any[] | undefined
        if (record.tablaAqlJson) {
            try {
                const parsedAql = JSON.parse(record.tablaAqlJson)
                if (Array.isArray(parsedAql) && parsedAql.length > 0) {
                    tablaAql = parsedAql.map((r: any) => ({
                        ...r,
                        max: (r.max === null || r.max === undefined) ? Infinity : r.max
                    }))
                }
            } catch {}
        }

        return {
            c1: mC1 ? mC1.activo : true,
            c2: mC2 ? mC2.activo : false,
            c3: mC3 ? mC3.activo : false,
            c4: mC4 ? mC4.activo : false,
            c5: mC5 ? mC5.activo : false,
            c2Submodulos: { ...SUBMODULOS_C2_DEFAULT, ...(mC2?.submodulos || {}) },
            c3Submodulos: { ...SUBMODULOS_C3_DEFAULT, ...(mC3?.submodulos || {}) },
            c4Submodulos: { ...SUBMODULOS_C4_DEFAULT, ...(mC4?.submodulos || {}) },
            c5Submodulos: { ...SUBMODULOS_C5_DEFAULT, ...(mC5?.submodulos || {}) },
            c5Config: {
                margenTemperaturaMax: mC5?.parametros?.margenTemperaturaMax ?? 1.0,
                umbralDotacionInasistenciaPct: mC5?.parametros?.umbralDotacionInasistenciaPct ?? 50,
                toleranciaHorarioAnticipadoMin: mC5?.parametros?.toleranciaHorarioAnticipadoMin ?? 60,
                toleranciaHorarioPesajeMin: mC5?.parametros?.toleranciaHorarioPesajeMin ?? 10,
                reglasHabilitadas: mC5?.parametros?.reglasHabilitadas ?? {},
                tablaAql
            }
        }
    } catch (e) {
        console.warn('[C5] Error al leer modulos activos para licitacion', licId, e)
        return fallback
    }
}

/**
 * Obtiene los horarios configurados para la licitación (C2.1) con fallback a los predeterminados.
 */
async function getHorariosLicitacion(licId?: number | null): Promise<Record<string, [string, string]>> {
    const horarios = { ...HORARIOS_DEFAULT }
    if (!licId) return horarios

    try {
        const rows = await prisma.multas_Horario_Servicio.findMany({
            where: { licId, activo: true }
        })

        for (const row of rows) {
            const servKey = (row.servicioCodigo || '').trim().toLowerCase()
            if (servKey && row.horaInicio && row.horaFin) {
                horarios[servKey] = [row.horaInicio, row.horaFin]
            }
        }
    } catch (e) {
        console.warn('[C5] Error al cargar horarios de licitación:', e)
    }

    return horarios
}

/**
 * Evalúa las reglas NC para un folio, sincroniza de forma idempotente con Multas_Hallazgo_NC
 * y respeta estrictamente los estados ACEPTADO y DESCARTADO previos con sus notas y autores.
 */
export async function evaluarYGuardarHallazgosFolio(
    folio: string,
    licIdOpt?: number | null,
    autor?: string
): Promise<HallazgoNC[]> {
    const cab = await prisma.elementosEsenciales_Cab.findFirst({
        where: { folio }
    })

    if (!cab) return []

    const licId = licIdOpt || cab.licId || null

    // Verificar si el módulo C5 está activo para la licitación
    const modulos = await getModulosActivosLicitacion(licId || 0)
    if (!modulos.c5) {
        // Si C5 está inactivo, retornamos los hallazgos ya guardados sin recalcular
        return obtenerHallazgosFolio(folio)
    }

    // Obtener detalles del acta (aspectos)
    const detalles = await prisma.elementosEsenciales_Det.findMany({
        where: { cabId: cab.id }
    })

    const aspectos: EntradaAspectoMotor[] = detalles.map(d => {
        const letraMatch = d.aspecto?.match(/^([A-Z])\./)?.[1] || d.aspecto?.slice(0, 1) || '?'
        const estado = (d.nc && d.nc.trim().length > 0) ? 'NC' : (d.na && d.na.trim().length > 0) ? 'NA' : 'CO'
        return {
            codigo: letraMatch.toUpperCase(),
            estado,
            observacion: d.observacionesOMedioDeVerificacion || ''
        }
    })

    // Consultar C2.1: Horarios configurados
    const horarios = await getHorariosLicitacion(licId)

    // Consultar C2.3: Dotación oficial del mes para el RBD
    let dotacionOficial: number | null = null
    if (cab.rbd && cab.fechaSupervision) {
        try {
            const fechaObj = new Date(cab.fechaSupervision)
            const anho = fechaObj.getFullYear()
            const mes = fechaObj.getMonth() + 1
            const regManip = await prisma.multas_Manipuladora_Mes.findFirst({
                where: { rbd: cab.rbd, anio: anho, mes }
            })
            if (regManip) {
                dotacionOficial = regManip.total
            }
        } catch (e) {
            console.warn('[C5] Error al consultar dotación manipuladoras:', e)
        }
    }

    // Consultar C3.1: Datos complementarios del folio
    let nivelSupervisado: string | null = null
    let bandejasEvaluadas: number | null = null
    let bandejasRechazadas: number | null = null
    try {
        const fd = await prisma.multas_Folio_Dato.findUnique({
            where: { folio }
        })
        if (fd) {
            nivelSupervisado = fd.nivelSupervisado || null
            bandejasEvaluadas = fd.bandejasEvaluadas ?? null
            bandejasRechazadas = fd.bandejasRechazadas ?? null
        }
    } catch (e) {
        console.warn('[C5] Error al consultar datos de folio:', e)
    }

    // Consultar raciones (C2 / C3): racionesTotales y racionesNivelSupervisado
    let racionesTotales: number | null = null
    let racionesNivelSupervisado: number | null = null
    if (cab.rbd && cab.fechaSupervision) {
        try {
            const fechaObj = new Date(cab.fechaSupervision)
            const anho = fechaObj.getFullYear()
            const mes = fechaObj.getMonth() + 1
            const rData = await getRacionesFolio({
                rbd: cab.rbd,
                anho,
                mes,
                licId: licId || 0,
                servicioCodigo: cab.servicioManual || cab.servicio,
                excluirEstratos: !!modulos.c2,
                nivelSupervisado
            })
            if (rData) {
                racionesTotales = rData.racionesTotal > 0 ? rData.racionesTotal : null
                racionesNivelSupervisado = rData.racionesNivelSupervisado ?? null
            }
        } catch (e) {
            console.warn('[C5] Error al calcular raciones para motor NC:', e)
        }
    }

    // Detección de alerta subcontada en F (C4)
    let alertaFSubcontada = false
    const detF = detalles.find(d => {
        const letraMatch = d.aspecto?.match(/^([A-Z])\./)?.[1] || d.aspecto?.slice(0, 1) || ''
        return letraMatch.toUpperCase() === 'F'
    })
    if (detF && detF.nc && detF.nc.trim().length > 0) {
        try {
            const resF = extractFNormativo(detF.observacionesOMedioDeVerificacion)
            if (resF.alertas && resF.alertas.some(a => a.toLowerCase().includes('subcontada'))) {
                alertaFSubcontada = true
            }
        } catch (e) {
            console.warn('[C5] Error al evaluar subconteo en F:', e)
        }
    }

    // Cargar parámetros de configuración C5
    const paramsMotor: ParametrosMotorNC = {
        margenTemperaturaMax: modulos.c5Config?.margenTemperaturaMax ?? 1.0,
        umbralDotacionInasistenciaPct: modulos.c5Config?.umbralDotacionInasistenciaPct ?? 50,
        toleranciaHorarioAnticipadoMin: modulos.c5Config?.toleranciaHorarioAnticipadoMin ?? 60,
        toleranciaHorarioPesajeMin: modulos.c5Config?.toleranciaHorarioPesajeMin ?? 10,
        reglasHabilitadas: modulos.c5Config?.reglasHabilitadas ?? {},
        tablaAql: modulos.c5Config?.tablaAql
    }

    const entradaActa: EntradaActaMotor = {
        folio: cab.folio || folio,
        licitacionId: licId,
        rbd: cab.rbd,
        servicio: cab.servicioManual || cab.servicio,
        fechaSupervision: cab.fechaSupervision,
        horaInicio: cab.horaInicio || cab.hora,
        horaTermino: null,
        observacionesGenerales: cab.obsALosIncumplimiento,
        racionesTotales,
        racionesNivelSupervisado,
        nivelSupervisado,
        bandejasEvaluadas,
        bandejasRechazadas,
        dotacionOficial,
        alertaFSubcontada
    }

    // Ejecutar motor determinístico
    const hallazgosGenerados = evaluarReglasNC(entradaActa, aspectos, horarios, paramsMotor)

    // Sincronizar con la base de datos preservando estados ACEPTADO y DESCARTADO
    const hallazgosExistentes = await prisma.multas_Hallazgo_NC.findMany({
        where: { folio }
    })

    const existenteMap = new Map<string, any>()
    hallazgosExistentes.forEach((h: any) => {
        const key = `${h.aspecto}_${h.reglaId}`
        existenteMap.set(key, h)
    })

    for (const h of hallazgosGenerados) {
        const key = `${h.aspecto}_${h.reglaId}`
        const previo = existenteMap.get(key)

        if (previo) {
            // Si ya existe y fue descartado o aceptado, preservamos el estado, nota y autor intactos
            const estadoFinal = previo.estado
            await prisma.multas_Hallazgo_NC.update({
                where: { id: previo.id },
                data: {
                    licitacionId: licId,
                    severidad: h.severidad,
                    tipo: h.tipo,
                    titulo: h.titulo,
                    detalle: h.detalle,
                    sugerencia: h.sugerencia,
                    evidencia: h.evidencia,
                    // Preservar estado anterior
                    estado: estadoFinal,
                    nota: previo.nota,
                    descartadoPor: previo.descartadoPor,
                    descartadoEn: previo.descartadoEn,
                    aceptadoPor: previo.aceptadoPor,
                    aceptadoEn: previo.aceptadoEn
                }
            })
        } else {
            // Si es nuevo, lo creamos en estado PENDIENTE
            await prisma.multas_Hallazgo_NC.create({
                data: {
                    folio,
                    licitacionId: licId,
                    aspecto: h.aspecto,
                    reglaId: h.reglaId,
                    severidad: h.severidad,
                    tipo: h.tipo,
                    titulo: h.titulo,
                    detalle: h.detalle,
                    sugerencia: h.sugerencia,
                    evidencia: h.evidencia,
                    estado: 'PENDIENTE',
                    autor: autor || 'Sistema'
                }
            })
        }
    }

    return obtenerHallazgosFolio(folio)
}

/**
 * Retorna todos los hallazgos registrados para un folio ordenados por severidad.
 */
export async function obtenerHallazgosFolio(folio: string): Promise<HallazgoNC[]> {
    const rows = await prisma.multas_Hallazgo_NC.findMany({
        where: { folio },
        orderBy: [
            { severidad: 'asc' },
            { id: 'asc' }
        ]
    })

    const ordenSev: Record<string, number> = { alta: 0, media: 1, info: 2 }
    rows.sort((a: any, b: any) => (ordenSev[a.severidad] ?? 3) - (ordenSev[b.severidad] ?? 3))

    return rows.map((r: any) => ({
        id: r.id,
        folio: r.folio,
        licitacionId: r.licitacionId,
        aspecto: r.aspecto,
        reglaId: r.reglaId,
        severidad: r.severidad as any,
        tipo: r.tipo as any,
        titulo: r.titulo,
        detalle: r.detalle,
        sugerencia: r.sugerencia,
        evidencia: r.evidencia,
        estado: r.estado as any,
        nota: r.nota,
        autor: r.autor,
        descartadoPor: r.descartadoPor,
        descartadoEn: r.descartadoEn,
        aceptadoPor: r.aceptadoPor,
        aceptadoEn: r.aceptadoEn,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
    }))
}

/**
 * Actualiza el estado de un hallazgo (ACEPTADO, DESCARTADO o PENDIENTE) con trazabilidad y nota obligatoria.
 */
export async function actualizarEstadoHallazgo(params: {
    id: number
    estado: EstadoHallazgo
    nota?: string
    usuario: string
}): Promise<{ ok: boolean; mensaje?: string }> {
    const actual = await prisma.multas_Hallazgo_NC.findUnique({
        where: { id: params.id }
    })

    if (!actual) return { ok: false, mensaje: 'Hallazgo no encontrado' }

    if (params.estado === 'DESCARTADO' && (!params.nota || params.nota.trim().length < 4)) {
        return { ok: false, mensaje: 'Para descartar un hallazgo debe ingresar un motivo o justificación' }
    }

    const dataUpdate: any = {
        estado: params.estado,
        nota: params.nota || actual.nota,
        updatedAt: new Date()
    }

    if (params.estado === 'DESCARTADO') {
        dataUpdate.descartadoPor = params.usuario
        dataUpdate.descartadoEn = new Date()
    } else if (params.estado === 'ACEPTADO') {
        dataUpdate.aceptadoPor = params.usuario
        dataUpdate.aceptadoEn = new Date()
    } else if (params.estado === 'PENDIENTE') {
        dataUpdate.descartadoPor = null
        dataUpdate.descartadoEn = null
        dataUpdate.aceptadoPor = null
        dataUpdate.aceptadoEn = null
    }

    await prisma.multas_Hallazgo_NC.update({
        where: { id: params.id },
        data: dataUpdate
    })

    return { ok: true }
}

/**
 * Consulta de hallazgos con filtros avanzados para la pantalla de Análisis de NC.
 */
export async function obtenerHallazgosLicitacion(filtros: {
    licId?: number | null
    mes?: number | null
    anho?: number | null
    reglaId?: string | null
    estado?: string | null
    severidad?: string | null
    tipo?: string | null
    aspecto?: string | null
    search?: string | null
    limit?: number
    offset?: number
}): Promise<{ items: HallazgoNC[]; total: number }> {
    const where: any = {}

    if (filtros.licId) where.licitacionId = filtros.licId
    if (filtros.reglaId && filtros.reglaId !== 'ALL') where.reglaId = filtros.reglaId
    if (filtros.estado && filtros.estado !== 'ALL') where.estado = filtros.estado
    if (filtros.severidad && filtros.severidad !== 'ALL') where.severidad = filtros.severidad
    if (filtros.tipo && filtros.tipo !== 'ALL') where.tipo = filtros.tipo
    if (filtros.aspecto && filtros.aspecto !== 'ALL') where.aspecto = filtros.aspecto

    if (filtros.search && filtros.search.trim()) {
        const q = filtros.search.trim()
        where.OR = [
            { folio: { contains: q, mode: 'insensitive' } },
            { titulo: { contains: q, mode: 'insensitive' } },
            { detalle: { contains: q, mode: 'insensitive' } },
            { nota: { contains: q, mode: 'insensitive' } }
        ]
    }

    const limit = Math.min(filtros.limit || 50, 200)
    const offset = filtros.offset || 0

    const [total, rows] = await Promise.all([
        prisma.multas_Hallazgo_NC.count({ where }),
        prisma.multas_Hallazgo_NC.findMany({
            where,
            orderBy: [{ updatedAt: 'desc' }],
            take: limit,
            skip: offset
        })
    ])

    return {
        total,
        items: rows.map((r: any) => ({
            id: r.id,
            folio: r.folio,
            licitacionId: r.licitacionId,
            aspecto: r.aspecto,
            reglaId: r.reglaId,
            severidad: r.severidad,
            tipo: r.tipo,
            titulo: r.titulo,
            detalle: r.detalle,
            sugerencia: r.sugerencia,
            evidencia: r.evidencia,
            estado: r.estado,
            nota: r.nota,
            autor: r.autor,
            descartadoPor: r.descartadoPor,
            descartadoEn: r.descartadoEn,
            aceptadoPor: r.aceptadoPor,
            aceptadoEn: r.aceptadoEn,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
        }))
    }
}

/**
 * Resumen de métricas de hallazgos por estado, severidad y tipo.
 */
export async function obtenerResumenMetricasNC(licId?: number | null): Promise<{
    total: number
    pendientes: number
    aceptados: number
    descartados: number
    porSeveridad: Record<string, number>
    porTipo: Record<string, number>
}> {
    const where: any = licId ? { licitacionId: licId } : {}
    const items = await prisma.multas_Hallazgo_NC.findMany({
        where,
        select: { estado: true, severidad: true, tipo: true }
    })

    const metricas = {
        total: items.length,
        pendientes: 0,
        aceptados: 0,
        descartados: 0,
        porSeveridad: { alta: 0, media: 0, info: 0 } as Record<string, number>,
        porTipo: { mal_imputado: 0, descargo: 0, verificar: 0 } as Record<string, number>
    }

    for (const it of items) {
        if (it.estado === 'PENDIENTE') metricas.pendientes++
        else if (it.estado === 'ACEPTADO') metricas.aceptados++
        else if (it.estado === 'DESCARTADO') metricas.descartados++

        if (metricas.porSeveridad[it.severidad] !== undefined) {
            metricas.porSeveridad[it.severidad]++
        }
        if (metricas.porTipo[it.tipo] !== undefined) {
            metricas.porTipo[it.tipo]++
        }
    }

    return metricas
}
