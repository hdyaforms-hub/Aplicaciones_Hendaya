/**
 * Motor puro de generación de alertas técnicas y recomendaciones de descargo
 * basadas en la Instrucción de Trabajo (IT-DAE-SUP026) y parámetros configurables.
 * Sin llamadas a Prisma ni dependencias de base de datos.
 */

export interface ParametrosITLicitacion {
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
        max: number
        muestra: number
        ac: number
        re: number
        rangoTexto?: string
    }>
    causasNoImputablesCustom?: string[]
}

export interface AlertaITAspectoResult {
    letra: string
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
    const obsLower = obs.toLowerCase()

    // 1. Datos base de la IT
    const tienePeriodoCorreccion = itDetalle?.tienePeriodoCorreccion ?? ['B', 'E', 'J', 'L'].includes(upperLetra)
    const pautaSolucion = itDetalle?.pautaSolucionAnexo3 || (
        upperLetra === 'B' ? 'Anexo N°3: Enviar acta firmada por dirección del colegio o fotografía con fecha y georreferenciación que demuestre la presencia física o digital del manual en la cocina.' :
        upperLetra === 'E' ? 'Anexo N°3: Presentar solicitud de homologación/incorporación a TPMPAP aprobada por JUNAEB, o comprobante de retiro y sustitución por una marca autorizada.' :
        upperLetra === 'J' ? 'Anexo N°3: Factura o guía de despacho de reposición de equipo operativo y fotografía del termómetro o balanza en funcionamiento con baterías en cocina.' :
        upperLetra === 'L' ? 'Anexo N°3: Guía de entrega firmada por la manipuladora y fotografía con el uniforme reglamentario completo en el establecimiento.' :
        null
    )

    const consideraciones = itDetalle?.consideracionesEspecificas || null
    const formaEvaluar = itDetalle?.formaEvaluar || null

    // 2. Parámetros resueltos (IT -> Configuración Licitación -> Default)
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

    const tablaAQL = anexoPesaje?.tablaAQL || parametrosConfig?.tablaAQL || TABLA_AQL_PAE_DEFAULT
    const ratioH = parametrosConfig?.ratioManipuladorasH || 70
    const tempRefriMin = parametrosConfig?.temperaturasK?.refriMin ?? 0
    const tempRefriMax = parametrosConfig?.temperaturasK?.refriMax ?? 5
    const tempCongelacionMax = parametrosConfig?.temperaturasK?.congelacionMax ?? -18

    let alertaTecnica: any = null

    // --- ASPECTO G: Pesaje de bandejas (AQL 6,5 y tolerancia 5% según IT-DAE-SUP026 Anexo 3) ---
    if (upperLetra === 'G') {
        const racionesEvaluadas = racionesNivel > 0 ? racionesNivel : (nivelInfo?.racionesTotal || 0)
        let filaAQL = tablaAQL.find((f: any) => racionesEvaluadas >= f.min && racionesEvaluadas <= f.max)
        if (!filaAQL) {
            filaAQL = tablaAQL[tablaAQL.length - 1] || { muestra: 13, ac: 2, re: 3, rangoTexto: 'Más de 500 raciones' }
        }

        const muestraMinima = filaAQL.muestra
        const rangoTexto = filaAQL.rangoTexto || `${filaAQL.min} a ${filaAQL.max === Infinity ? 'más' : filaAQL.max} raciones`
        const ac = filaAQL.ac
        const re = filaAQL.re

        // Detectar si la observación menciona bandejas pesadas
        const matchBandejas = obs.match(/(?:pesar|pesaje|pesaron|muestra|control|bandeja(?:s)?)[^\d]*(\d+)\s*bandeja/i) ||
                             obs.match(/(\d+)\s*(?:de\s*\d+\s*)?bandeja(?:s)?/i)
        const bandejasPesadas = matchBandejas ? parseInt(matchBandejas[1], 10) : null

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

    // --- ASPECTO H: Personal manipulador (1 manipuladora por cada 70 raciones del establecimiento) ---
    if (upperLetra === 'H') {
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
    if (upperLetra === 'F') {
        alertaTecnica = {
            tipo: 'CALIDAD_FRUTAS_VERDURAS',
            criterio: 'Anexo N°2 JUNAEB: Defectos leves hasta 10%, moderados hasta 5%. Defectos graves (pudrición, plagas) 0% de tolerancia.',
            rotulacion: 'Alimentos no perecibles deben cumplir rotulación RSA y tarimas a 15 cm del suelo.'
        }
    }

    // --- ASPECTO K: Temperaturas permitidas ---
    if (upperLetra === 'K') {
        alertaTecnica = {
            tipo: 'TEMPERATURA',
            rangos: `Refrigeración: ${tempRefriMin}°C a ${tempRefriMax}°C. Congelación: <= ${tempCongelacionMax}°C.`,
            criterio: 'Verificar: La medición debe efectuarse inmediatamente al abrir el equipo para evitar alteración térmica ambiental.'
        }
    }

    // --- ASPECTO M: Alerta orientativa de exigibilidad (IT-DAE-SUP026 pp. 12 y 15) ---
    if (upperLetra === 'M') {
        const fechaSup = fechaSupervision ? new Date(fechaSupervision) : null
        const esAntesJunio2025 = fechaSup && !isNaN(fechaSup.getTime()) ? (
            fechaSup.getFullYear() < 2025 || (fechaSup.getFullYear() === 2025 && fechaSup.getMonth() < 5)
        ) : false

        const fechaFmt = fechaSup && !isNaN(fechaSup.getTime()) ? fechaSup.toLocaleDateString('es-CL') : 'sin fecha'

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
    // Sin falsos positivos: 'toma' solo de establecimiento (no temperatura/pesaje); 'paro' por palabra completa
    let posibleCausaNoImputable: string | null = null

    const tieneCorteSuministro = /\b(?:corte|falta|sin)\s+(?:de\s+)?(?:agua|luz|energ[ií]a|gas|suministro)\b/i.test(obs) ||
        /\bsin\s+agua\s+potable\b/i.test(obs)

    // Solo toma del establecimiento/colegio/liceo/escuela (nunca 'toma de temperatura' o 'toma de muestra')
    const tieneTomaEstablecimiento = /\btoma\s+(?:del\s+|de\s+la\s+)?(?:establecimiento|colegio|liceo|escuela|local|dependencia)\b/i.test(obs)

    // Paro gremial / manipuladoras / docente: palabra completa (no match con subcadenas como 'comparó' o 'reparó')
    const tieneParo = /\bparos?\b/i.test(obs)

    const tieneSuspension = /\bsuspensi[oó]n\s+(?:de\s+clases|actividades|servicio)\b/i.test(obs)
    const tieneFuerzaMayor = /\bfuerza\s+mayor\b/i.test(obs) || /\bcat[aá]strofe\b/i.test(obs)

    // Temporal climático: evitar adverbio 'temporalmente' o frases operativas
    const esTemporalClimatico = (
        /\blluvia(?:s)?\s+torrencial(?:es)?\b/i.test(obs) ||
        /\btemporal\s+(?:de\s+)?(?:viento|lluvia|nieve|clima)\b/i.test(obs) ||
        /\bmal\s+tiempo\b/i.test(obs) ||
        (/\btemporal(?:es)?\b/i.test(obs) &&
         !/temporalmente/i.test(obs) &&
         !/(?:soluci[oó]n|medida|falla|car[aá]cter|forma|reparaci[oó]n|instalaci[oó]n)\s+temporal/i.test(obs) &&
         /(?:viento|lluvia|inundaci|alerta|inclemencia|techo|volad|inundada|anegad)/i.test(obs))
    )

    // Chequeo de causales adicionales desde causasImputabilidadJson de la IT (si existen)
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
                const rx = new RegExp(`\\b${c.terminoClave}\\b`, 'i')
                if (rx.test(obs)) {
                    causaCustomDetectada = c.descripcion || c.terminoClave
                    break
                }
            }
        }
    } catch {
        // Ignorar error de parsing
    }

    if (tieneCorteSuministro || tieneTomaEstablecimiento || tieneParo || tieneSuspension || tieneFuerzaMayor || esTemporalClimatico || causaCustomDetectada) {
        let motivo = 'eventos externos de fuerza mayor o corte de suministros básicos'
        if (tieneCorteSuministro) motivo = 'corte o interrupción de suministros básicos (agua/electricidad/gas)'
        else if (tieneParo) motivo = 'paro de manipuladoras, docente o gremial'
        else if (tieneTomaEstablecimiento) motivo = 'toma del establecimiento educacional'
        else if (tieneSuspension) motivo = 'suspensión formal de clases o actividades'
        else if (esTemporalClimatico) motivo = 'temporal climático severo o lluvia torrencial'
        else if (causaCustomDetectada) motivo = causaCustomDetectada

        posibleCausaNoImputable = `Posible defensa (Causa No Imputable): La observación del acta consigna ${motivo}. Conforme a la Tabla N°1 de la IT-DAE-SUP026, esto constituye causal no imputable al prestador y sustenta la solicitud de anulación o descargo de la multa.`
    }

    return {
        letra: upperLetra,
        tienePeriodoCorreccion,
        periodoCorreccionTexto: tienePeriodoCorreccion ? 'SI (5 días hábiles)' : 'NO (No subsanable)',
        plazoDias: tienePeriodoCorreccion ? 5 : 0,
        pautaSolucion,
        consideraciones,
        formaEvaluar,
        alertaTecnica,
        posibleCausaNoImputable,
        itDocumento: itCab ? `${itCab.codigoDocumento || 'IT - EE'} (Rev. ${itCab.numeroRevision || '03'})` : 'IT JUNAEB Oficial'
    }
}
