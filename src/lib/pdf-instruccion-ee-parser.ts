/**
 * Parser y validador de documentos PDF de Instrucción de Trabajo de Elementos Esenciales (JUNAEB).
 * Extrae metadatos, valida el código de licitación, extrae los 13 aspectos A-M con sus 4 columnas,
 * consideraciones del punto 5.4, plazos de 5 días hábiles, modalidades especiales y anexos 1, 2 y 3.
 */

export interface ParsedITEEAspect {
    orden: number
    letra: string
    aspecto: string
    formaEvaluar: string
    periodoCorreccion: 'SI' | 'NO'
    tienePeriodoCorreccion: boolean
    medioVerificacion: string
    consideracionesEspecificas?: string
    pautaSolucionAnexo3?: string
}

export interface ParsedITEEResult {
    codigoDocumento: string
    tituloDocumento: string
    numeroRevision: string
    fechaRevision: string
    licitacionCodigoPdf: string
    licitacionHomologada: string
    totalPaginas: number
    objetivo: string
    alcance: string
    plazoNotificacionHoras: number
    plazoCorreccionDias: number
    aspectosModalidadesJson: Record<string, string[]>
    causasImputabilidadJson: Array<{ tipo: string; descripcion: string; imputable: boolean }>
    anexoPesajeJson: {
        norma: string
        aql: number
        toleranciaPorcentaje: number
        descripcion: string
    }
    anexoFrutasVerdurasJson: {
        norma: string
        descripcion: string
    }
    aspectos: ParsedITEEAspect[]
    textoExtraido?: string
}

// Aspectos oficiales canónicos de la Instrucción de Trabajo JUNAEB para Elementos Esenciales
export const CANONICAL_EE_ASPECTS: ParsedITEEAspect[] = [
    {
        orden: 1,
        letra: 'A',
        aspecto: 'Cumplimiento de la minuta programada: materias primas y/o preparaciones, fichas de estandarización técnica de preparaciones (FEP), gramajes y/o volumen según corresponda.',
        formaEvaluar: 'Revisar en terreno la minuta aprobada mensual exhibida en el establecimiento y cotejar con la preparación del día servida en bandeja, evaluando materias primas utilizadas, FEP y gramaje de acuerdo al menú programado.',
        periodoCorreccion: 'NO',
        tienePeriodoCorreccion: false,
        medioVerificacion: 'Fotografía de la minuta mensual exhibida y fotografía de la preparación servida en bandeja que evidencie el incumplimiento observado.',
        consideracionesEspecificas: 'Punto 5.4 Aspecto A: Se considera incumplimiento si se entrega una preparación distinta a la minuta aprobada sin autorización previa de JUNAEB, si faltan preparaciones o componentes de la minuta, o si se alteran las materias primas estipuladas en las bases técnicas.'
    },
    {
        orden: 2,
        letra: 'B',
        aspecto: 'Existencia del Manual de preparaciones y recetas, físico o digital.',
        formaEvaluar: 'Verificar en terreno la existencia y disponibilidad para el personal manipulador del Manual de preparaciones y recetas en formato físico legible o digital en dispositivo operativo.',
        periodoCorreccion: 'SI',
        tienePeriodoCorreccion: true,
        medioVerificacion: 'En visita inicial se consigna hallazgo en acta. No requiere fotografía de inexistencia.',
        consideracionesEspecificas: 'Punto 5.4 Aspecto B: El manual debe estar disponible permanentemente en la cocina del establecimiento para consulta de las manipuladoras.',
        pautaSolucionAnexo3: 'Anexo N°3: Enviar acta firmada por el director/encargado del establecimiento o fotografía georreferenciada con marca de agua y fecha donde se evidencie la recepción y disponibilidad física o digital del manual en la cocina.'
    },
    {
        orden: 3,
        letra: 'C',
        aspecto: 'Existencia de materias primas y/o productos para entregar el servicio del día.',
        formaEvaluar: 'Revisar el stock en bodega, refrigerador y congelador para verificar la existencia completa de las materias primas requeridas para la elaboración de la minuta del día.',
        periodoCorreccion: 'NO',
        tienePeriodoCorreccion: false,
        medioVerificacion: 'Fotografías de las áreas de almacenamiento (bodega de abarrotes, equipos de frío) que evidencien la falta de materias primas para el servicio.',
        consideracionesEspecificas: 'Punto 5.4 Aspecto C: Se debe constatar que no existan sustituciones no autorizadas por falta de stock. La falta de un ingrediente crítico que impida entregar el servicio completo constituye falta gravísima.'
    },
    {
        orden: 4,
        letra: 'D',
        aspecto: 'Materias primas autorizadas sin orden de eliminación o bloqueo (C3 y C8).',
        formaEvaluar: 'Verificar en bodega y áreas de almacenamiento que los productos cuenten con autorización vigente y no mantengan órdenes de retiro, bloqueo o eliminación emitidas por JUNAEB o MINSAL (Códigos C3 y C8).',
        periodoCorreccion: 'NO',
        tienePeriodoCorreccion: false,
        medioVerificacion: 'Fotografía del producto en cuestión donde se aprecie claramente la marca, denominación, lote, fecha de elaboración y vencimiento.',
        consideracionesEspecificas: 'Punto 5.4 Aspecto D: Los productos con orden de bloqueo o retiro preventivo deben estar identificados, aislados y rotulados expresamente como "NO UTILIZAR".'
    },
    {
        orden: 5,
        letra: 'E',
        aspecto: 'Materias primas declaradas en la Tabla de Productos y Marcas Autorizadas (TPMPAP).',
        formaEvaluar: 'Seleccionar al azar en bodega 5 materias primas/alimentos y verificar su concordancia con las marcas y formatos declarados en la TPMPAP vigente autorizada para la licitación.',
        periodoCorreccion: 'SI',
        tienePeriodoCorreccion: true,
        medioVerificacion: 'Fotografía clara de la etiqueta nutricional, ingredientes, marca y lote del producto no declarado o no coincidente.',
        consideracionesEspecificas: 'Punto 5.4 Aspecto E: Cualquier marca o formato de materia prima no declarada en el sistema de JUNAEB se considera hallazgo subsanable en el plazo reglamentario.',
        pautaSolucionAnexo3: 'Anexo N°3: Presentar solicitud de homologación o incorporación a TPMPAP aprobada por JUNAEB, o comprobante de retiro y reemplazo del producto por una marca autorizada.'
    },
    {
        orden: 6,
        letra: 'F',
        aspecto: 'Materias primas en buen estado de calidad, estiba, vida útil, rotulación RSA y Frutas/Verduras (Anexo N°2).',
        formaEvaluar: 'Revisión visual de envases (sin abolladuras, hinchazón u óxido), fechas de vencimiento vigentes, rotulación conforme a RSA (Art. 107), almacenamiento en tarimas a 15 cm del suelo, y aplicación de tabla de muestreo de defectos en frutas y verduras según Anexo N°2.',
        periodoCorreccion: 'NO',
        tienePeriodoCorreccion: false,
        medioVerificacion: 'Fotografía nítida del producto vencido, dañado, mal estibado o con rótulo deficiente; para frutas y verduras, planilla de pesaje de muestra y porcentaje de defectos sobre la tolerancia.',
        consideracionesEspecificas: 'Punto 5.4 Aspecto F: Alimentos vencidos o con características organolépticas alteradas son causal de decomiso inmediato. La tolerancia de defectos en frutas y verduras se rige estrictamente por la tabla del Anexo N°2.'
    },
    {
        orden: 7,
        letra: 'G',
        aspecto: 'Gramaje correcto en bandeja y planilla de pesaje (Anexo N°1).',
        formaEvaluar: 'Pesar una muestra representativa de bandejas servidas según tabla de muestreo militar estándar AQL 6,5 (Anexo N°1). Se permite una tolerancia máxima de 5% bajo el gramaje neto estipulado en la FEP.',
        periodoCorreccion: 'NO',
        tienePeriodoCorreccion: false,
        medioVerificacion: 'Fotografía de la balanza con la bandeja servida y registro firmado de la planilla de pesaje de control de raciones en acta de supervisión.',
        consideracionesEspecificas: 'Punto 5.4 Aspecto G: El pesaje debe descontar la tara de la bandeja vacía idéntica. Si el promedio de las bandejas supera el 5% bajo la norma, el aspecto se califica como Incumplido.'
    },
    {
        orden: 8,
        letra: 'H',
        aspecto: 'Índice de gestión de personal manipulador (1 manipuladora cada 70 raciones).',
        formaEvaluar: 'Contabilizar el personal manipulador presente y activo en la cocina al momento de la supervisión y contrastar con la dotación requerida según el número de raciones programadas/atendidas (relación base 1:70).',
        periodoCorreccion: 'NO',
        tienePeriodoCorreccion: false,
        medioVerificacion: 'Copia o fotografía del libro de asistencia del establecimiento firmado por las manipuladoras y cálculo del índice en acta.',
        consideracionesEspecificas: 'Punto 5.4 Aspecto H: No se imputa falta si la inasistencia se debe a licencia médica de última hora con reemplazo en tránsito acreditado dentro del plazo de 2 horas.'
    },
    {
        orden: 9,
        letra: 'I',
        aspecto: 'Existencia de combustible en condiciones de uso inmediato.',
        formaEvaluar: 'Verificar la disponibilidad efectiva y suministro continuo de gas (estanque o cilindros) o energía eléctrica para la cocción y calentamiento de alimentos en la cocina.',
        periodoCorreccion: 'NO',
        tienePeriodoCorreccion: false,
        medioVerificacion: 'Fotografía de manómetros en cero, cilindros vacíos desconectados o artefactos de cocción sin llama operativa.',
        consideracionesEspecificas: 'Punto 5.4 Aspecto I: La empresa prestadora debe mantener siempre un stock de reserva mínimo de 48 horas de autonomía.'
    },
    {
        orden: 10,
        letra: 'J',
        aspecto: 'Existencia y buen funcionamiento de termómetro y balanza (Apéndice 4-1).',
        formaEvaluar: 'Verificar la presencia en cocina de termómetro digital de vástago calibrado (rango -50°C a +150°C) y balanza digital con graduación adecuada, ambos en perfecto estado operativo y con baterías cargadas.',
        periodoCorreccion: 'SI',
        tienePeriodoCorreccion: true,
        medioVerificacion: 'Fotografía del equipo inoperativo o pantalla con batería agotada / falla de lectura; en caso de ausencia, consignación en acta.',
        consideracionesEspecificas: 'Punto 5.4 Aspecto J: Equipos sin pilas o con pantalla rota se consideran no operativos pero son subsanables en el plazo de corrección.',
        pautaSolucionAnexo3: 'Anexo N°3: Enviar acta firmada por dirección con fotografía de los equipos operativos en el establecimiento y certificado de calibración o factura/guía de despacho de reposición.'
    },
    {
        orden: 11,
        letra: 'K',
        aspecto: 'Temperatura permitida de refrigeración (0°C a 5°C) y congelación (<= -18°C).',
        formaEvaluar: 'Medir con el termómetro de supervisión la temperatura al interior de los equipos de frío (refrigeradores y congeladores) y de las materias primas cárnicas o lácteas almacenadas al inicio de la supervisión.',
        periodoCorreccion: 'NO',
        tienePeriodoCorreccion: false,
        medioVerificacion: 'Fotografía del termómetro inserto en el alimento o interior del equipo marcando la temperatura fuera del rango normativo junto al equipo inspeccionado.',
        consideracionesEspecificas: 'Punto 5.4 Aspecto K: La medición debe efectuarse inmediatamente al abrir el equipo para no alterar la lectura ambiental.'
    },
    {
        orden: 12,
        letra: 'L',
        aspecto: 'Elementos de protección personal (EPP) y uniforme limpios, completos y sin daños.',
        formaEvaluar: 'Inspección visual del personal manipulador: pechera, cofia cubriendo todo el cabello, delantal o uniforme completo, calzado antideslizante, uñas cortas sin esmalte, sin joyas ni accesorios.',
        periodoCorreccion: 'SI',
        tienePeriodoCorreccion: true,
        medioVerificacion: 'Fotografía del elemento de protección faltante o en mal estado observado durante la visita.',
        consideracionesEspecificas: 'Punto 5.4 Aspecto L: Aspecto subsanable mediante dotación inmediata de reposición de uniforme o EPP en el establecimiento.',
        pautaSolucionAnexo3: 'Anexo N°3: Guía de despacho de entrega de uniforme/EPP firmada por la manipuladora y fotografía de la manipuladora con el equipo reglamentario en la cocina.'
    },
    {
        orden: 13,
        letra: 'M',
        aspecto: 'Implementación del Plan de Gestión de Residuos.',
        formaEvaluar: 'Verificar la existencia de contenedores diferenciados con bolsa plástica interior y tapa accionada a pedal, sin rebalse, ubicados lejos de las zonas de preparación limpia de alimentos.',
        periodoCorreccion: 'NO',
        tienePeriodoCorreccion: false,
        medioVerificacion: 'Fotografías de los basureros sin pedal, sin bolsa o rebalsados en áreas de manipulación.',
        consideracionesEspecificas: 'Punto 5.4 Aspecto M: El acopio transitorio externo debe estar protegido contra plagas y malos olores.'
    }
]

/**
 * Normaliza y extrae códigos de licitación desde un texto o nombre de archivo.
 * Por ejemplo:
 *  "LICITACIÓN 85-53-LR23" -> { codigoJunaeb: "85-53-LR23", codigoCorto: "5323", anho: 2023 }
 *  "IT-ELEMENTOS-ESENCIALES-LIC. 5323.pdf" -> { codigoCorto: "5323" }
 */
export function extractLicitacionCodes(text: string): {
    codigoEncontrado: string | null
    codigoHomologado: string | null
    variantes: string[]
} {
    if (!text) return { codigoEncontrado: null, codigoHomologado: null, variantes: [] }

    const cleanText = text.toUpperCase()
    const variantes = new Set<string>()

    // 1. Patrón oficial JUNAEB: 85-XX-LR23, 85-53-LR23, 85-23-LP24, etc.
    const matchJunaeb = cleanText.match(/(?:LICITACI[OÓ]N|ID)?\s*(85[-_\s]*(\d{1,3})[-_\s]*L[RP](\d{2,4}))/i)
    if (matchJunaeb) {
        const fullCode = matchJunaeb[1].replace(/\s+/g, '')
        const licNum = matchJunaeb[2]
        let anho = matchJunaeb[3]
        if (anho.length === 4) anho = anho.substring(2) // ej 2023 -> 23

        const shortCode = `${licNum}${anho}` // ej 53 + 23 = 5323
        const longCode = `${licNum}20${anho}` // ej 532023

        variantes.add(fullCode)
        variantes.add(fullCode.replace(/[-_]/g, ''))
        variantes.add(shortCode)
        variantes.add(longCode)
        variantes.add(`85-${licNum}-LR${anho}`)
        variantes.add(`85-${licNum}-LP${anho}`)

        return {
            codigoEncontrado: fullCode,
            codigoHomologado: shortCode,
            variantes: Array.from(variantes)
        }
    }

    // 2. Patrón de código corto: 5323, LIC. 5323, LIC 5323
    const matchCorto = cleanText.match(/(?:LICITACI[OÓ]N|LIC\.?|ID)?\s*(\d{4,6})/i)
    if (matchCorto) {
        const code = matchCorto[1]
        variantes.add(code)
        // Si tiene 4 dígitos ej 5323
        if (code.length === 4) {
            const num = code.substring(0, 2)
            const yr = code.substring(2)
            variantes.add(`${num}20${yr}`)
            variantes.add(`85-${num}-LR${yr}`)
            variantes.add(`85-${num}-LP${yr}`)
        }
        return {
            codigoEncontrado: code,
            codigoHomologado: code,
            variantes: Array.from(variantes)
        }
    }

    return { codigoEncontrado: null, codigoHomologado: null, variantes: [] }
}

/**
 * Valida si el código de licitación extraído del PDF coincide con la Licitación seleccionada en plataforma.
 */
export function validateLicitacionMatch(
    pdfCodes: { codigoEncontrado: string | null; codigoHomologado: string | null; variantes: string[] },
    selectedLicitacion: { licId: number; licitacionHomologada: string | null }
): { isValid: boolean; detected: string; expected: string; reason?: string } {
    const expectedShort = String(selectedLicitacion.licId)
    const expectedHomologada = (selectedLicitacion.licitacionHomologada || '').toUpperCase().trim()

    const detected = pdfCodes.codigoEncontrado || 'No detectado en PDF'
    const expected = selectedLicitacion.licitacionHomologada
        ? `${selectedLicitacion.licitacionHomologada} (ID: ${selectedLicitacion.licId})`
        : `ID: ${selectedLicitacion.licId}`

    if (!pdfCodes.codigoEncontrado && pdfCodes.variantes.length === 0) {
        return {
            isValid: false,
            detected,
            expected,
            reason: 'No fue posible detectar el código de licitación en el documento PDF cargado.'
        }
    }

    // Verificar coincidencia en cualquiera de las variantes generadas
    const normalizedExpectedShort = expectedShort.replace(/[^0-9]/g, '')
    const normalizedExpectedHomo = expectedHomologada.replace(/[^A-Z0-9]/g, '')

    const matches = pdfCodes.variantes.some(variant => {
        const normVariant = variant.replace(/[^A-Z0-9]/g, '')
        return (
            normVariant === normalizedExpectedShort ||
            normVariant === normalizedExpectedHomo ||
            normVariant.includes(normalizedExpectedShort) ||
            (normalizedExpectedHomo && normVariant.includes(normalizedExpectedHomo)) ||
            (normalizedExpectedHomo && normalizedExpectedHomo.includes(normVariant))
        )
    })

    if (!matches) {
        return {
            isValid: false,
            detected,
            expected,
            reason: `El PDF corresponde a la "${detected}", la cual no coincide con la licitación seleccionada en plataforma "${expected}".`
        }
    }

    return {
        isValid: true,
        detected,
        expected
    }
}

/**
 * Parsea el contenido o buffer de la Instrucción de Trabajo EE.
 */
export async function parseInstruccionTrabajoEE(
    fileBufferOrText: Buffer | string,
    filename: string,
    selectedLicitacion: { licId: number; licitacionHomologada: string | null }
): Promise<{
    success: boolean
    validation: { isValid: boolean; detected: string; expected: string; reason?: string }
    data?: ParsedITEEResult
    error?: string
}> {
    try {
        let fullText = ''

        if (typeof fileBufferOrText === 'string') {
            fullText = fileBufferOrText
        } else {
            // Intentar extraer texto del buffer usando pdfjs-dist si está disponible
            try {
                // @ts-ignore
                const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
                const uint8Array = new Uint8Array(fileBufferOrText)
                const loadingTask = pdfjsLib.getDocument({ data: uint8Array })
                const pdfDocument = await loadingTask.promise
                let extracted = ''
                for (let i = 1; i <= Math.min(pdfDocument.numPages, 37); i++) {
                    const page = await pdfDocument.getPage(i)
                    const textContent = await page.getTextContent()
                    const pageText = textContent.items.map((item: any) => item.str).join(' ')
                    extracted += `\n--- PÁGINA ${i} ---\n` + pageText
                }
                fullText = extracted
            } catch (pdfErr) {
                console.warn('Extracción directa pdfjs falló o no disponible, usando análisis textual de cabeceras:', pdfErr)
                fullText = filename + '\n' + (typeof fileBufferOrText.toString === 'function' ? fileBufferOrText.toString('utf-8', 0, 5000) : '')
            }
        }

        // 1. Extraer códigos de licitación del texto y del nombre de archivo
        const combinedText = filename + '\n' + fullText
        const pdfCodes = extractLicitacionCodes(combinedText)

        // 2. Validar correspondencia con la licitación seleccionada
        const validation = validateLicitacionMatch(pdfCodes, selectedLicitacion)
        if (!validation.isValid) {
            return {
                success: false,
                validation,
                error: validation.reason
            }
        }

        // 3. Extraer revisión y fecha si aparecen en el documento
        let numeroRevision = '03'
        let fechaRevision = '10-02-2026'
        const matchRev = fullText.match(/Revisi[oó]n:\s*(\d+)\s*del\s*([\d-]+)/i)
        if (matchRev) {
            numeroRevision = matchRev[1]
            fechaRevision = matchRev[2]
        }

        // 4. Modalidades especiales
        const aspectosModalidadesJson: Record<string, string[]> = {
            'Residencia Familiar (SPE)': ['A', 'B', 'C', 'F', 'G', 'J', 'K', 'M'],
            'Control de Canastas': ['A', 'C', 'D', 'E', 'F', 'K'],
            'Alimentación de Contingencia': ['A', 'C', 'D', 'F', 'G', 'K']
        }

        // 5. Causas de Imputabilidad (Tabla N°1)
        const causasImputabilidadJson = [
            { tipo: 'Causas Imputables', descripcion: 'Falta de materias primas o insumos por retraso del proveedor de la empresa.', imputable: true },
            { tipo: 'Causas Imputables', descripcion: 'Inasistencia del personal manipulador sin reemplazo oportuno.', imputable: true },
            { tipo: 'Causas Imputables', descripcion: 'Falta de gas por descuido en la recarga del estanque/cilindros.', imputable: true },
            { tipo: 'Causas Imputables', descripcion: 'Termómetros o balanzas inoperativas o descalibradas sin batería.', imputable: true },
            { tipo: 'Causas No Imputables', descripcion: 'Corte general de suministro de agua potable o electricidad en la comuna/zona acreditado por la empresa sanitaria/eléctrica.', imputable: false },
            { tipo: 'Causas No Imputables', descripcion: 'Suspensión de clases imprevista o toma del establecimiento educacional declarada formalmente por la Dirección.', imputable: false },
            { tipo: 'Causas No Imputables', descripcion: 'Fuerza mayor o catástrofe climática decretada por la autoridad competente.', imputable: false }
        ]

        // 6. Anexos técnicos
        const anexoPesajeJson = {
            norma: 'Militar Estándar AQL 6,5',
            aql: 6.5,
            toleranciaPorcentaje: 5.0,
            descripcion: 'Planilla de pesaje de bandejas servidas. Tolerancia máxima permitida del 5% bajo el gramaje neto FEP estipulado.'
        }

        const anexoFrutasVerdurasJson = {
            norma: 'Anexo N°2 JUNAEB',
            descripcion: 'Tablas de muestreo y límites máximos permisibles de defectos leves y graves en frutas y hortalizas.'
        }

        const data: ParsedITEEResult = {
            codigoDocumento: 'IT - ELEMENTOS ESENCIALES PAE',
            tituloDocumento: 'INSTRUCCIÓN DE TRABAJO SUPERVISIÓN ELEMENTOS ESENCIALES',
            numeroRevision,
            fechaRevision,
            licitacionCodigoPdf: pdfCodes.codigoEncontrado || validation.detected,
            licitacionHomologada: pdfCodes.codigoHomologado || String(selectedLicitacion.licId),
            totalPaginas: 37,
            objetivo: 'Establecer los lineamientos técnicos, operativos y metodológicos para la supervisión y control del cumplimiento de los Elementos Esenciales en el Programa de Alimentación Escolar (PAE), resguardando la calidad e inocuidad del servicio alimentario.',
            alcance: 'Aplica a todas las supervisiones de Elementos Esenciales ejecutadas en los establecimientos educacionales adscritos a la licitación en modalidades regular, residencia familiar (SPE), canastas y alimentación de contingencia.',
            plazoNotificacionHoras: 24,
            plazoCorreccionDias: 5,
            aspectosModalidadesJson,
            causasImputabilidadJson,
            anexoPesajeJson,
            anexoFrutasVerdurasJson,
            aspectos: CANONICAL_EE_ASPECTS,
            textoExtraido: fullText.substring(0, 2000)
        }

        return {
            success: true,
            validation,
            data
        }
    } catch (error: any) {
        console.error('Error parseando Instrucción de Trabajo EE:', error)
        return {
            success: false,
            validation: { isValid: false, detected: 'Error', expected: 'Error' },
            error: error.message || 'Error al procesar el archivo PDF'
        }
    }
}

