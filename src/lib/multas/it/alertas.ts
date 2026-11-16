/**
 * Motor puro de generación de alertas técnicas y recomendaciones de descargo
 * basadas en la Instrucción de Trabajo (IT-DAE-SUP026) y parámetros configurables.
 * Sin llamadas a Prisma ni dependencias de base de datos.
 */

import { fechaToChileCalendarStr } from '../restricciones'
import { SubModuloReglasC5, SUBMODULOS_C5_DEFAULT } from '../config'

/**
 * Escapa caracteres especiales de expresiones regulares para evitar errores sintácticos.
 */
function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface ParametrosITLicitacion {
    moduloC5Activo?: boolean
    submodulosActivos?: SubModuloReglasC5
    plazoCorreccionDias?: number
    ratioManipuladorasH?: number // Default: 70
    temperaturasK?: {
        refriMin?: number // Default: 0
        refriMax?: number // Default: 5
        congelacionMax?: number // Default: -18
    }
    toleranciasF?: {
        defectosLevesMaxPorcentaje?: number // Default: 10
        defectosModeradosMaxPorcentaje?: number // Default: 5
        defectosGravesMaxPorcentaje?: number // Default: 0
    }
    tablaAQL?: Array<{
        min: number
        max: number | null
        muestra: number
        ac: number
        re: number
        rangoTexto?: string
    }>
    causasNoImputablesCustom?: Array<string | { terminoClave?: string; descripcion?: string }>
}

export interface AlertaITAspectoResult {
    letra: string
    subsanabilidadHabilitada: boolean
    tienePeriodoCorreccion: boolean
    periodoCorreccionTexto: string
    plazoDias: number
    pautaSolucion: string | null
    consideraciones: string | null
    formaEvaluar: string | null
    alertaTecnica: any | null
    posibleCausaNoImputable: string | null
    itDocumento: string
}

// Tabla estándar PAE JUNAEB (Anexo N°3 IT-DAE-SUP026)
export const TABLA_AQL_PAE_DEFAULT = [
    { min: 2, max: 15, muestra: 2, ac: 0, re: 1, rangoTexto: '2 a 15 raciones' },
    { min: 16, max: 50, muestra: 3, ac: 1, re: 2, rangoTexto: '16 a 50 raciones' },
    { min: 51, max: 150, muestra: 5, ac: 1, re: 2, rangoTexto: '51 a 150 raciones' },
    { min: 151, max: 500, muestra: 8, ac: 1, re: 2, rangoTexto: '151 a 500 raciones' },
    { min: 501, max: Infinity, muestra: 13, ac: 2, re: 3, rangoTexto: '501 o más raciones (Tope máximo)' }
]

/**
 * Función pura que analiza un aspecto supervisado contra la IT y los parámetros de la licitación.
 */
export function generarAlertasITAspecto(
    letra: string | null,
    racionesNivel: number,
    observaciones: string | null,
    itDetalle: any | null,
    itCab: any | null,
    fechaSupervision?: Date | string | null,
    nivelInfo?: {
        nivelDetectado?: string | null
        racionesTotal?: number
        racionesNivel?: number
        esTotalPorDefecto?: boolean
    } | null,
    parametrosConfig?: ParametrosITLicitacion | null
): AlertaITAspectoResult | null {
    if (!letra) return null

    const upperLetra = letra.toUpperCase().trim()
    const obs = observaciones || ''

    // 0. Control de Activación Modular (C5 y sus 6 sub-reglas)
    const c5Activo = parametrosConfig?.moduloC5Activo ?? true
    const submodulos = {
        ...SUBMODULOS_C5_DEFAULT,
        ...(parametrosConfig?.submodulosActivos || {})
    }

    // 1. Plazos y Subsanabilidad (Prioridad: Parámetro Hub -> IT -> Default 5 días)
    const plazoDiasConfig = parametrosConfig?.plazoCorreccionDias ?? (itDetalle?.plazoCorreccionDias ?? (itCab?.plazoCorreccionDias ?? 5))
    const subsanabilidadHabilitada = c5Activo && submodulos.subsanabilidad
    const tienePeriodoCorreccionRaw = itDetalle?.tienePeriodoCorreccion ?? ['B', 'E', 'J', 'L'].includes(upperLetra)
    const tienePeriodoCorreccion = subsanabilidadHabilitada ? tienePeriodoCorreccionRaw : false
    const periodoCorreccionTexto = !subsanabilidadHabilitada
        ? 'NO (Módulo subsanabilidad desactivado)'
        : (tienePeriodoCorreccion ? `SI (${plazoDiasConfig} días hábiles)` : 'NO (No subsanable)')

    const pautaSolucion = subsanabilidadHabilitada ? (itDetalle?.pautaSolucionAnexo3 || (
        upperLetra === 'B' ? 'Anexo N°3: Enviar acta firmada por dirección del colegio o fotografía con fecha y georreferenciación que demuestre la presencia física o digital del manual en la cocina.' :
        upperLetra === 'E' ? 'Anexo N°3: Presentar solicitud de homologación/incorporación a TPMPAP aprobada por JUNAEB, o comprobante de retiro y sustitución por una marca autorizada.' :
        upperLetra === 'J' ? 'Anexo N°3: Factura o guía de despacho de reposición de equipo operativo y fotografía del termómetro o balanza en funcionamiento con baterías en cocina.' :
        upperLetra === 'L' ? 'Anexo N°3: Guía de entrega firmada por la manipuladora y fotografía con el uniforme reglamentario completo en el establecimiento.' :
        null
    )) : null

    const consideraciones = itDetalle?.consideracionesEspecificas || null
    const formaEvaluar = itDetalle?.formaEvaluar || null

    // 2. Parámetros resueltos con Prioridad: Parámetro Hub -> IT -> Default
    let anexoPesaje: any = null
    try {
        if (typeof itCab?.anexoPesajeJson === 'string') {
            anexoPesaje = JSON.parse(itCab.anexoPesajeJson)
        } else if (typeof itCab?.anexoPesajeJson === 'object') {
            anexoPesaje = itCab.anexoPesajeJson
        }
    } catch {
        anexoPesaje = null
    }

    // Prioridad invertida: lo editado en el Hub manda sobre la plantilla de la IT
    const rawTablaAQL = parametrosConfig?.tablaAQL || anexoPesaje?.tablaAQL || TABLA_AQL_PAE_DEFAULT
    const tablaAQL = rawTablaAQL.map((f: any) => ({
        ...f,
        max: (f.max === null || f.max === undefined) ? Infinity : f.max
    }))

    const ratioH = parametrosConfig?.ratioManipuladorasH || 70
    const tempRefriMin = parametrosConfig?.temperaturasK?.refriMin ?? 0
    const tempRefriMax = parametrosConfig?.temperaturasK?.refriMax ?? 5
    const tempCongelacionMax = parametrosConfig?.temperaturasK?.congelacionMax ?? -18

    let alertaTecnica: any = null

    // --- ASPECTO G: Pesaje de bandejas (AQL 6,5 y tolerancia 5% según IT-DAE-SUP026 Anexo 3) ---
    if (upperLetra === 'G' && c5Activo && submodulos.aqlPesaje) {
        const racionesEvaluadas = racionesNivel > 0 ? racionesNivel : (nivelInfo?.racionesTotal || 0)

        // Detectar si la observación menciona bandejas pesadas
        const matchBandejas = obs.match(/(?:pesar|pesaje|pesaron|muestra|control|bandeja(?:s)?)[^\d]*(\d+)\s*bandeja/i) ||
                             obs.match(/(\d+)\s*(?:de\s*\d+\s*)?bandeja(?:s)?/i)
        const bandejasPesadas = matchBandejas ? parseInt(matchBandejas[1], 10) : null

        if (racionesEvaluadas <= 0) {
            alertaTecnica = {
                tipo: 'AQL_PESAJE',
                raciones: 0,
                nivelSupervisado: nivelInfo?.nivelDetectado || null,
                esTotalPorDefecto: !!nivelInfo?.esTotalPorDefecto,
                racionesTotalEstablecimiento: 0,
                rangoTexto: 'Sin raciones PMPA registradas',
                muestraMinima: 0,
                criterioAceptacionRechazo: 'N/A',
                tolerancia: '5% bajo el gramaje neto estipulado en la FEP',
                bandejasPesadas,
                advertenciaMuestra: '⚠️ Sin raciones PMPA registradas; no es posible determinar la muestra mínima requerida según norma AQL.',
                esDefensaGanable: false
            }
        } else {
            let filaAQL = tablaAQL.find((f: any) => racionesEvaluadas >= f.min && racionesEvaluadas <= f.max)
            if (!filaAQL) {
                if (racionesEvaluadas < tablaAQL[0].min) {
                    filaAQL = tablaAQL[0] // Raciones bajo el mínimo de la tabla (ej. 1 ración) -> usa el primer tramo
                } else {
                    filaAQL = tablaAQL[tablaAQL.length - 1] || { muestra: 13, ac: 2, re: 3, rangoTexto: 'Más de 500 raciones' }
                }
            }

            const muestraMinima = filaAQL.muestra
            const topeMax = filaAQL.max === Infinity ? 'más' : filaAQL.max
            const rangoTexto = filaAQL.rangoTexto || `${filaAQL.min} a ${topeMax} raciones`
            const ac = filaAQL.ac
            const re = filaAQL.re

            let advertenciaMuestra: string | null = null
            let esDefensaGanable = false

            let infoNivelTxt = `${racionesEvaluadas} raciones`
            if (nivelInfo?.esTotalPorDefecto) {
                infoNivelTxt = `total establecimiento: ${racionesEvaluadas} raciones (⚠️ Calculado con el total de raciones; verificar nivel supervisado)`
            } else if (nivelInfo?.nivelDetectado) {
                infoNivelTxt = `nivel supervisado '${nivelInfo.nivelDetectado}' (${racionesEvaluadas} raciones; total colegio: ${nivelInfo.racionesTotal || racionesEvaluadas})`
            }

            if (bandejasPesadas !== null && bandejasPesadas < muestraMinima) {
                advertenciaMuestra = `⚠️ Posible defensa (Muestra Insuficiente): El supervisor pesó ${bandejasPesadas} bandeja(s). Para ${infoNivelTxt} (${rangoTexto}), el Anexo N°3 de la IT-DAE-SUP026 exige evaluar al menos ${muestraMinima} bandejas. Si la muestra no cumple la norma AQL 6,5, el procedimiento de pesaje es impugnable.`
                esDefensaGanable = true
            } else if (bandejasPesadas === null) {
                advertenciaMuestra = `Verificar en el acta o planilla de pesaje si el supervisor pesó al menos ${muestraMinima} bandejas (norma AQL 6,5 según Anexo 3 de la IT para ${infoNivelTxt}). Si evaluó menos de ${muestraMinima}, procede presentar descargo.`
            }

            alertaTecnica = {
                tipo: 'AQL_PESAJE',
                raciones: racionesEvaluadas,
                nivelSupervisado: nivelInfo?.nivelDetectado || null,
                esTotalPorDefecto: !!nivelInfo?.esTotalPorDefecto,
                racionesTotalEstablecimiento: nivelInfo?.racionesTotal || racionesEvaluadas,
                rangoTexto,
                muestraMinima,
                criterioAceptacionRechazo: `Ac = ${ac}, Re = ${re}`,
                tolerancia: '5% bajo el gramaje neto estipulado en la FEP',
                bandejasPesadas,
                advertenciaMuestra,
                esDefensaGanable
            }
        }
    }

    // --- ASPECTO H: Personal manipulador (1 manipuladora por cada ratioH raciones del establecimiento) ---
    if (upperLetra === 'H' && c5Activo && submodulos.personalManipulador) {
        const racionesEstablecimiento = nivelInfo?.racionesTotal || racionesNivel
        const manipuladorasRequeridas = racionesEstablecimiento > 0 ? Math.ceil(racionesEstablecimiento / ratioH) : null
        alertaTecnica = {
            tipo: 'PERSONAL_MANIPULADOR',
            ratio: `1 manipuladora por cada ${ratioH} raciones servidas en el establecimiento`,
            racionesEstablecimiento,
            manipuladorasRequeridas,
            tolerancia: 'Posible defensa: No corresponde imputar falta si la inasistencia se debe a licencia médica imprevista con reemplazo acreditado en tránsito dentro de 2 horas.'
        }
    }

    // --- ASPECTO F: Calidad, Estiba, Frutas y Verduras ---
    if (upperLetra === 'F' && c5Activo && submodulos.calidadFrutasVerduras) {
        const tolLeve = parametrosConfig?.toleranciasF?.defectosLevesMaxPorcentaje ?? 10
        const tolMod = parametrosConfig?.toleranciasF?.defectosModeradosMaxPorcentaje ?? 5
        const tolGrave = parametrosConfig?.toleranciasF?.defectosGravesMaxPorcentaje ?? 0
        alertaTecnica = {
            tipo: 'CALIDAD_FRUTAS_VERDURAS',
            tolerancias: { leves: tolLeve, moderados: tolMod, graves: tolGrave },
            criterio: `Anexo N°2 JUNAEB: Defectos leves hasta ${tolLeve}%, moderados hasta ${tolMod}%. Defectos graves (pudrición, plagas) ${tolGrave}% de tolerancia.`,
            rotulacion: 'Alimentos no perecibles deben cumplir rotulación RSA y tarimas a 15 cm del suelo.'
        }
    }

    // --- ASPECTO K: Temperaturas permitidas ---
    if (upperLetra === 'K' && c5Activo && submodulos.temperaturas) {
        alertaTecnica = {
            tipo: 'TEMPERATURA',
            rangos: `Refrigeración: ${tempRefriMin}°C a ${tempRefriMax}°C. Congelación: <= ${tempCongelacionMax}°C.`,
            criterio: 'Verificar: La medición debe efectuarse inmediatamente al abrir el equipo para evitar alteración térmica ambiental.'
        }
    }

    // --- ASPECTO M: Alerta orientativa de exigibilidad (IT-DAE-SUP026 pp. 12 y 15) ---
    if (upperLetra === 'M' && c5Activo) {
        const fechaChileStr = fechaToChileCalendarStr(fechaSupervision)
        const esAntesJunio2025 = fechaChileStr ? fechaChileStr < '2025-06-01' : false
        const fechaFmt = fechaChileStr || 'sin fecha'

        if (esAntesJunio2025) {
            alertaTecnica = {
                tipo: 'ASPECTO_M_NO_EXIGIBLE',
                severidad: 'alta',
                esDefensaGanable: true,
                advertencia: `ℹ️ Observación normativa orientativa: Conforme a la IT-DAE-SUP026 (páginas 12 y 15), el Aspecto M (Plan de Gestión de Residuos) solo es exigible a partir de JUNIO DE 2025 (procediendo calificar como 'No Aplica' en supervisiones previas). La fecha del acta es ${fechaFmt}. Si la licitación tiene cargada la restricción de M, la multa se aplicará como $0.`
            }
        }
    }

    // 3. Detección de Causas No Imputables (Tabla N°1 de la IT-DAE-SUP026)
    let posibleCausaNoImputable: string | null = null

    if (c5Activo && submodulos.causasNoImputables) {
        const tieneCorteSuministro = /\b(?:corte|falta|sin)\s+(?:de\s+)?(?:agua|luz|energ[ií]a|gas|suministro)\b/i.test(obs) ||
            /\bsin\s+agua\s+potable\b/i.test(obs)

        // Solo toma del establecimiento/colegio/liceo/escuela (nunca 'toma de temperatura' o 'toma de muestra')
        const tieneTomaEstablecimiento = /\btoma\s+(?:del\s+|de\s+la\s+)?(?:establecimiento|colegio|liceo|escuela|local|dependencia)\b/i.test(obs)

        // Paro gremial / manipuladoras / docente: palabra completa (no match con subcadenas como 'comparó' o 'reparó')
        const tieneParo = /\bparos?\b/i.test(obs)

        const tieneSuspension = /\bsuspensi[oó]n\s+(?:de\s+clases|actividades|servicio)\b/i.test(obs)
        const tieneFuerzaMayor = /\bfuerza\s+mayor\b/i.test(obs) || /\bcat[aá]strofe\b/i.test(obs)

        // Temporal climático: evitar adverbio 'temporalmente' o frases operativas como 'solución temporal'
        const esTemporalClimatico = (
            /\blluvia(?:s)?\s+torrencial(?:es)?\b/i.test(obs) ||
            /\btemporal\s+(?:de\s+)?(?:viento|lluvia|nieve|clima)\b/i.test(obs) ||
            /\bmal\s+tiempo\b/i.test(obs) ||
            (/\btemporal(?:es)?\b/i.test(obs) &&
             !/temporalmente/i.test(obs) &&
             !/(?:soluci[oó]n|medida|falla|car[aá]cter|forma|reparaci[oó]n|instalaci[oó]n)\s+temporal/i.test(obs) &&
             /(?:viento|lluvia|inundaci|alerta|inclemencia|techo|volad|inundada|anegad)/i.test(obs))
        )

        // Chequeo de causales adicionales desde causasImputabilidadJson de la IT o configuradas en la licitación
        let causaCustomDetectada: string | null = null
        try {
            let causasIT: any[] = []
            if (typeof itCab?.causasImputabilidadJson === 'string') {
                causasIT = JSON.parse(itCab.causasImputabilidadJson)
            } else if (Array.isArray(itCab?.causasImputabilidadJson)) {
                causasIT = itCab.causasImputabilidadJson
            }
            for (const c of causasIT) {
                if (c && c.imputable === false && c.terminoClave) {
                    const rx = new RegExp(`\\b${escapeRegExp(c.terminoClave.trim())}\\b`, 'i')
                    if (rx.test(obs)) {
                        causaCustomDetectada = c.descripcion || c.terminoClave
                        break
                    }
                }
            }
        } catch {
            // Ignorar error de parsing
        }

        if (!causaCustomDetectada && parametrosConfig?.causasNoImputablesCustom && Array.isArray(parametrosConfig.causasNoImputablesCustom)) {
            for (const item of parametrosConfig.causasNoImputablesCustom) {
                const termino = typeof item === 'string' ? item : item?.terminoClave
                if (termino && termino.trim()) {
                    const rx = new RegExp(`\\b${escapeRegExp(termino.trim())}\\b`, 'i')
                    if (rx.test(obs)) {
                        causaCustomDetectada = typeof item === 'object' && item.descripcion ? item.descripcion : termino
                        break
                    }
                }
            }
        }

        if (tieneCorteSuministro || tieneTomaEstablecimiento || tieneParo || tieneSuspension || tieneFuerzaMayor || esTemporalClimatico || causaCustomDetectada) {
            let motivo = 'eventos externos de fuerza mayor o corte de suministros básicos'
            if (tieneCorteSuministro) motivo = 'corte o interrupción de suministros básicos (agua/electricidad/gas)'
            else if (tieneParo) motivo = 'paro de manipuladoras, docente o gremial'
            else if (tieneTomaEstablecimiento) motivo = 'toma del establecimiento educacional'
            else if (tieneSuspension) motivo = 'suspensión formal de clases o actividades'
            else if (esTemporalClimatico) motivo = 'temporal climático severo o lluvia torrencial'
            else if (causaCustomDetectada) motivo = causaCustomDetectada

            posibleCausaNoImputable = `Posible defensa (Causa No Imputable): La observación del acta consigna ${motivo}. Conforme a la Tabla N°1 de la IT-DAE-SUP026, esto podría constituir causal no imputable al prestador y sustenta la solicitud de anulación o descargo de la multa.`
        }
    }

    return {
        letra: upperLetra,
        subsanabilidadHabilitada,
        tienePeriodoCorreccion,
        periodoCorreccionTexto,
        plazoDias: tienePeriodoCorreccion ? plazoDiasConfig : 0,
        pautaSolucion,
        consideraciones,
        formaEvaluar,
        alertaTecnica,
        posibleCausaNoImputable,
        itDocumento: itCab ? `${itCab.codigoDocumento || 'IT - EE'} (Rev. ${itCab.numeroRevision || '03'})` : 'IT JUNAEB Oficial'
    }
}
