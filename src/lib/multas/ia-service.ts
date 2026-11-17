import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { ensureIaConfigTables } from './ia-config-db-init'

function getEncryptionKey(): string {
    const key = process.env.ENCRYPTION_SECRET_KEY
    if (!key) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('ENCRYPTION_SECRET_KEY no está configurada en las variables de entorno de producción.')
        }
        return 'hendaya-ia-secret-key-32-chars!'
    }
    return key
}

const IV_LENGTH = 16

/**
 * Cifrar cadena de texto en AES-256-CBC
 */
export function encryptApiKey(text: string): string {
    if (!text) return ''
    const key = crypto.createHash('sha256').update(getEncryptionKey()).digest()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return `${iv.toString('hex')}:${encrypted}`
}

/**
 * Descifrar cadena de texto en AES-256-CBC
 */
export function decryptApiKey(encryptedText: string): string {
    try {
        if (!encryptedText || !encryptedText.includes(':')) return ''
        const [ivHex, encrypted] = encryptedText.split(':')
        const key = crypto.createHash('sha256').update(getEncryptionKey()).digest()
        const iv = Buffer.from(ivHex, 'hex')
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
        let decrypted = decipher.update(encrypted, 'hex', 'utf8')
        decrypted += decipher.final('utf8')
        return decrypted
    } catch (e) {
        return ''
    }
}

export interface AnalisisIaResultado {
    resumenEjecutivo: string
    viciosProcedimiento: string[]
    descargoPropuesto: string
    fundamentoNormativo: string
    probabilidadExito: 'ALTA' | 'MEDIA' | 'BAJA'
    aspectosAnalizados: string[]
    tokensConsumidos: number
    costoUsd: number
    tiempoMs: number
    usandoFallbackLocal: boolean
    error?: string
}

export interface ExtraccionPesajeResultado {
    nivelSugerido: 'T' | 'B' | 'M' | null
    nivelConfianza: number | null
    bandejasEvaluadas: number | null
    bandejasRechazadas: number | null
    observacionesDetectadas: string | null
    tokensConsumidos: number
    costoUsd: number
    tiempoMs?: number
    usandoFallbackLocal: boolean
    error?: string
}

/**
 * Obtener configuración activa de IA
 */
export async function getIaConfigActiva() {
    await ensureIaConfigTables()
    const config = await prisma.multas_Config_IA.findFirst({
        where: { activo: true },
        orderBy: { updatedAt: 'desc' }
    })
    if (!config) return null

    // Sincronizar el gasto acumulado del mes en curso (YYYY-MM)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const consumoMes = await prisma.multas_Log_Consumo_IA.aggregate({
        _sum: { costoEstimadoUsd: true },
        where: {
            createdAt: {
                gte: startOfMonth,
                lte: endOfMonth
            },
            exitoso: true
        }
    }).catch(() => ({ _sum: { costoEstimadoUsd: 0 } }))

    const gastoRealMes = consumoMes._sum.costoEstimadoUsd || 0.0

    // Si el valor acumulado difiere (ej: nuevo mes donde debe reiniciar en 0), actualizar
    if (Math.abs(config.gastoAcumuladoMesUsd - gastoRealMes) > 0.0001) {
        await prisma.multas_Config_IA.update({
            where: { id: config.id },
            data: { gastoAcumuladoMesUsd: gastoRealMes }
        }).catch(() => {})
        config.gastoAcumuladoMesUsd = gastoRealMes
    }

    return config
}

/**
 * Analizar un folio con IA cruzando acta, 19 reglas y biblioteca de argumentos
 */
export async function analizarFolioConIa(params: {
    folio: string
    userName: string
}): Promise<AnalisisIaResultado> {
    const startTime = Date.now()
    await ensureIaConfigTables()

    const config = await getIaConfigActiva()
    const apiKey = config?.apiKeyEnc ? decryptApiKey(config.apiKeyEnc) : ''
    const modeloActivo = config?.modelo || 'gemini-2.0-flash'

    // 1. Obtener datos del acta y sus aspectos calculados
    const acta = await prisma.multas_Elementos_Esenciales_Cab.findUnique({
        where: { folioOriginal: params.folio },
        include: { detalles: true }
    })

    const aspectosSancionados = acta?.detalles.filter(d => d.montoMulta > 0) || []
    const letrasAspectos = aspectosSancionados.map(a => a.letraAspecto)

    // 2. Obtener precedentes y plantillas de la biblioteca de argumentos para esos aspectos
    const plantillas = await prisma.multas_Argumento_Biblioteca.findMany({
        where: {
            activo: true,
            aspecto: { in: letrasAspectos.length > 0 ? letrasAspectos : ['G', 'J', 'K', 'B'] }
        },
        take: 4
    })

    // Comprobar límite de gasto mensual si hay API Key
    const dentroDeLimite = config
        ? (config.gastoAcumuladoMesUsd < config.limiteGastoMensualUsd)
        : false

    // Si hay API Key válida y estamos dentro del presupuesto, invocar Gemini API
    if (apiKey && dentroDeLimite && config?.proveedor === 'GOOGLE_GEMINI') {
        try {
            const prompt = `Eres un abogado especialista en Derecho Administrativo y experto en Contratación Pública y supervisión PAE de la Junta Nacional de Auxilio Escolar y Becas (JUNAEB) de Chile, asesorando a la empresa concesionaria Hendaya.

Analiza el siguiente caso de fiscalización:
- Folio del Acta: ${params.folio}
- Establecimiento / RBD: ${acta?.rbd || 'No especificado'}
- Licitación / Contrato: ${acta?.licitacion || 'Estándar Hendaya'}
- Aspectos Sancionados con Multa:
${aspectosSancionados.map(d => `  * Aspecto ${d.letraAspecto}: ${d.descripcion || 'Sin descripción'} (Monto multa: $${Math.round(d.montoMulta).toLocaleString('es-CL')} CLP)`).join('\n')}

Precedentes Jurídicos y Plantillas Institucionales Oficiales Hendaya disponibles:
${plantillas.map(p => `  * [Aspecto ${p.aspecto}] ${p.titulo}: "${p.argumentoTexto.slice(0, 150)}..." (Base: ${p.fundamentoLegal || 'IT JUNAEB'})`).join('\n')}

Instrucción de Trabajo de Elementos Esenciales y Criterios Clave:
1. En Aspecto G (Gramaje): El supervisor debe cumplir la muestra mínima según tabla AQL (NCh 44). Si pesó menos bandejas o pesó sin balanza calibrada en J, el cálculo es jurídicamente nulo.
2. En Aspecto K (Temperaturas): Mediciones sin termómetro certificado en J o con márgenes ínfimos son impugnables.
3. Principio de proporcionalidad, presunción de legalidad y debida motivación del acto administrativo.

Genera una respuesta en formato JSON con la siguiente estructura:
{
  "resumenEjecutivo": "Breve diagnóstico del acta (2-3 líneas).",
  "viciosProcedimiento": ["vicio 1 identificado", "vicio 2"],
  "descargoPropuesto": "Texto completo y formal de la carta de descargo para la Dirección Regional de JUNAEB, con estilo jurídico sobrio, mencionando las normas y el petitorio de dejar sin efecto la multa.",
  "fundamentoNormativo": "Artículos, Anexos y circulares aplicables.",
  "probabilidadExito": "ALTA" | "MEDIA" | "BAJA"
}`

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modeloActivo}:generateContent`

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                signal: AbortSignal.timeout(15000),
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: config.temperatura || 0.2,
                        responseMimeType: 'application/json'
                    }
                })
            })

            const duration = Date.now() - startTime

            if (response.ok) {
                const resJson = await response.json()
                const candidateText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text || ''
                const usage = resJson?.usageMetadata || {}
                const tokensPrompt = usage.promptTokenCount || 400
                const tokensRespuesta = usage.candidatesTokenCount || 600
                const costoEstimado = (tokensPrompt * 0.000000075) + (tokensRespuesta * 0.0000003)

                let parsed: any = {}
                try {
                    parsed = JSON.parse(candidateText)
                } catch {
                    parsed = {
                        resumenEjecutivo: candidateText.slice(0, 200),
                        viciosProcedimiento: ['Revisión requerida: el modelo devolvió texto en formato libre que debe ser evaluado por el equipo jurídico'],
                        descargoPropuesto: candidateText,
                        fundamentoNormativo: 'Bases Administrativas JUNAEB y Ley N° 19.880',
                        probabilidadExito: 'MEDIA'
                    }
                }

                await prisma.multas_Log_Consumo_IA.create({
                    data: {
                        folio: params.folio,
                        usuario: params.userName,
                        tipoOperacion: 'ANALISIS_DESCARGO',
                        modeloUsado: modeloActivo,
                        tokensPrompt,
                        tokensRespuesta,
                        costoEstimadoUsd: costoEstimado,
                        tiempoRespuestaMs: duration,
                        exitoso: true
                    }
                })

                await prisma.multas_Config_IA.update({
                    where: { id: config.id },
                    data: {
                        gastoAcumuladoMesUsd: { increment: costoEstimado }
                    }
                })

                const prob = ['ALTA', 'MEDIA', 'BAJA'].includes(parsed.probabilidadExito)
                    ? parsed.probabilidadExito
                    : (letrasAspectos.includes('G') && letrasAspectos.includes('J') ? 'ALTA' : 'MEDIA')

                return {
                    resumenEjecutivo: parsed.resumenEjecutivo || 'Análisis completado por IA.',
                    viciosProcedimiento: Array.isArray(parsed.viciosProcedimiento) ? parsed.viciosProcedimiento : ['Insuficiencia probatoria en acta'],
                    descargoPropuesto: parsed.descargoPropuesto || candidateText,
                    fundamentoNormativo: parsed.fundamentoNormativo || 'Instrucción de Trabajo de Elementos Esenciales y Ley N° 19.880',
                    probabilidadExito: prob,
                    aspectosAnalizados: letrasAspectos,
                    tokensConsumidos: tokensPrompt + tokensRespuesta,
                    costoUsd: costoEstimado,
                    tiempoMs: duration,
                    usandoFallbackLocal: false
                }
            } else {
                console.error(`Error en respuesta Gemini API (${response.status})`)
                await prisma.multas_Log_Consumo_IA.create({
                    data: {
                        folio: params.folio,
                        usuario: params.userName,
                        tipoOperacion: 'ANALISIS_DESCARGO',
                        modeloUsado: modeloActivo,
                        tokensPrompt: 0,
                        tokensRespuesta: 0,
                        costoEstimadoUsd: 0,
                        tiempoRespuestaMs: duration,
                        exitoso: false
                    }
                })
            }
        } catch (error) {
            console.error('Error al consultar Gemini API, activando fallback local:', error)
            await prisma.multas_Log_Consumo_IA.create({
                data: {
                    folio: params.folio,
                    usuario: params.userName,
                    tipoOperacion: 'ANALISIS_DESCARGO',
                    modeloUsado: modeloActivo,
                    tokensPrompt: 0,
                    tokensRespuesta: 0,
                    costoEstimadoUsd: 0,
                    tiempoRespuestaMs: Date.now() - startTime,
                    exitoso: false
                }
            }).catch(() => {})
        }
    }

    // ==========================================
    // PLANTILLA BASE ESTRUCTURADA (FALLBACK LOCAL)
    // No afirma hechos no constatados; provee la estructura legal para revisión.
    // ==========================================
    const duration = Date.now() - startTime

    const vicios: string[] = [
        'Revisión requerida: Verificar en terreno la rigurosidad del procedimiento inspectivo y la congruencia fáctica de las observaciones.',
        'Revisión requerida: Contrastar los antecedentes probatorios con los criterios normativos de JUNAEB para los aspectos observados.'
    ]
    const fundamentacion = 'Instrucción de Trabajo de Elementos Esenciales JUNAEB; Bases Administrativas y Técnicas del Contrato; Ley N° 19.880 sobre Bases de los Procedimientos Administrativos.'

    const totalMontoClp = aspectosSancionados.reduce((acc, d) => acc + (d.montoMulta || 0), 0)

    const textoDescargo = `[PLANTILLA BASE - REVISAR ANTES DE USAR]
SEÑORA DIRECTORA REGIONAL DE JUNAEB
PRESENTE

De nuestra consideración:

Por medio de la presente, y encontrándonos dentro del plazo reglamentario contemplado en las Bases de Licitación, venimos en formular formal DESCARGO respecto de las observaciones contenidas en el Acta de Supervisión Folio N° ${params.folio}, correspondiente al establecimiento educacional RBD ${acta?.rbd || 'respectivo'}.

I. ANTECEDENTES Y ASPECTOS OBSERVADOS:
En el acta de fiscalización referida, el funcionario supervisor consignó observaciones en los Aspectos ${letrasAspectos.length > 0 ? letrasAspectos.join(', ') : 'consignados en acta'}, determinando multas estimadas por un total de $${Math.round(totalMontoClp).toLocaleString('es-CL')} CLP.

II. FUNDAMENTOS DE HECHO Y DE DERECHO (A COMPLETAR POR EL EQUIPO JURÍDICO):
1. [INCORPORAR ANTECEDENTES DE HECHO]: El equipo de litigios debe detallar las circunstancias de hecho verificadas en el establecimiento durante la fiscalización.
2. [INCORPORAR ANTECEDENTES TÉCNICOS / PROBATORIOS]: Adjuntar minutas, guías de despacho, registros de pesaje o bitácoras que acrediten el cumplimiento de la concesionaria.
3. [NORMATIVA APLICABLE]: Contrastar las imputaciones con la Instrucción de Trabajo de Elementos Esenciales, las Bases de Licitación y los principios de debida motivación y proporcionalidad consagrados en la Ley N° 19.880.

III. PETITORIO:
En virtud de los antecedentes expuestos y los medios probatorios que se acompañan, solicitamos a Ud. tener por formulado este descargo, acogerlo a tramitación y resolver dejando sin efecto o rebajando las multas propuestas conforme a derecho.

Atentamente,
ÁREA DE GESTIÓN Y LITIGIOS PAE · HENDAYA`

    return {
        resumenEjecutivo: `Plantilla base generada localmente para el Acta Folio #${params.folio} (revisar antes de usar). Se requiere que el equipo legal verifique los hechos y adjunte los medios probatorios correspondientes a los aspectos observados (${letrasAspectos.join(', ')}).`,
        viciosProcedimiento: vicios,
        descargoPropuesto: textoDescargo,
        fundamentoNormativo: fundamentacion,
        probabilidadExito: 'MEDIA',
        aspectosAnalizados: letrasAspectos,
        tokensConsumidos: 0,
        costoUsd: 0,
        tiempoMs: duration,
        usandoFallbackLocal: true
    }
}

/**
 * Extraer datos de la planilla de pesaje mediante Visión Computacional
 * No inventa datos fijos; devuelve error o null si la extracción no fue posible.
 */
export async function extraerPesajeConVision(params: {
    imageBase64: string
    mimeType: string
    userName: string
}): Promise<ExtraccionPesajeResultado> {
    const startTime = Date.now()
    await ensureIaConfigTables()
    const config = await getIaConfigActiva()
    const apiKey = config?.apiKeyEnc ? decryptApiKey(config.apiKeyEnc) : ''
    const modeloActivo = config?.modelo || 'gemini-2.0-flash'

    const dentroDeLimite = config
        ? (config.gastoAcumuladoMesUsd < config.limiteGastoMensualUsd)
        : false

    if (apiKey && dentroDeLimite && config?.proveedor === 'GOOGLE_GEMINI') {
        try {
            const prompt = `Analiza la imagen de la planilla o formulario de pesaje de control de gramaje de JUNAEB (Aspecto G).
Extrae los siguientes datos con máxima precisión y responde estrictamente en JSON (usa null en los campos que no se puedan leer con certeza):
{
  "nivelSugerido": "T" (Transición) | "B" (Básica) | "M" (Media) | null,
  "nivelConfianza": número entero de 0 a 100 o null,
  "bandejasEvaluadas": número entero de bandejas pesadas o null,
  "bandejasRechazadas": número entero de bandejas que no cumplieron el peso mínimo o null,
  "observacionesDetectadas": "resumen textual de las observaciones escritas por el supervisor" | null
}`

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modeloActivo}:generateContent`

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                signal: AbortSignal.timeout(15000),
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: params.mimeType,
                                    data: params.imageBase64
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: 'application/json'
                    }
                })
            })

            const duration = Date.now() - startTime

            if (response.ok) {
                const resJson = await response.json()
                const candidateText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text || ''
                const usage = resJson?.usageMetadata || {}
                const tokensPrompt = usage.promptTokenCount || 600
                const tokensRespuesta = usage.candidatesTokenCount || 100
                const costoEstimado = (tokensPrompt * 0.000000075) + (tokensRespuesta * 0.0000003)

                let parsed: any = {}
                try {
                    parsed = JSON.parse(candidateText)
                } catch {
                    parsed = {}
                }

                await prisma.multas_Log_Consumo_IA.create({
                    data: {
                        usuario: params.userName,
                        tipoOperacion: 'EXTRACCION_PESAJE_VISION',
                        modeloUsado: modeloActivo,
                        tokensPrompt,
                        tokensRespuesta,
                        costoEstimadoUsd: costoEstimado,
                        tiempoRespuestaMs: duration,
                        exitoso: true
                    }
                })

                await prisma.multas_Config_IA.update({
                    where: { id: config.id },
                    data: { gastoAcumuladoMesUsd: { increment: costoEstimado } }
                })

                return {
                    nivelSugerido: ['T', 'B', 'M'].includes(parsed.nivelSugerido) ? parsed.nivelSugerido : null,
                    nivelConfianza: typeof parsed.nivelConfianza === 'number' ? parsed.nivelConfianza : null,
                    bandejasEvaluadas: typeof parsed.bandejasEvaluadas === 'number' ? parsed.bandejasEvaluadas : null,
                    bandejasRechazadas: typeof parsed.bandejasRechazadas === 'number' ? parsed.bandejasRechazadas : null,
                    observacionesDetectadas: parsed.observacionesDetectadas ? String(parsed.observacionesDetectadas).trim() : null,
                    tokensConsumidos: tokensPrompt + tokensRespuesta,
                    costoUsd: costoEstimado,
                    tiempoMs: duration,
                    usandoFallbackLocal: false
                }
            } else {
                await prisma.multas_Log_Consumo_IA.create({
                    data: {
                        usuario: params.userName,
                        tipoOperacion: 'EXTRACCION_PESAJE_VISION',
                        modeloUsado: modeloActivo,
                        tokensPrompt: 0,
                        tokensRespuesta: 0,
                        costoEstimadoUsd: 0,
                        tiempoRespuestaMs: duration,
                        exitoso: false
                    }
                })
            }
        } catch (error) {
            console.error('Error al extraer pesaje con visión IA:', error)
            await prisma.multas_Log_Consumo_IA.create({
                data: {
                    usuario: params.userName,
                    tipoOperacion: 'EXTRACCION_PESAJE_VISION',
                    modeloUsado: modeloActivo,
                    tokensPrompt: 0,
                    tokensRespuesta: 0,
                    costoEstimadoUsd: 0,
                    tiempoRespuestaMs: Date.now() - startTime,
                    exitoso: false
                }
            }).catch(() => {})
        }
    }

    // Si la llamada falla o no hay API Key configurada, devolver nulls y error explícito (sin inventar datos)
    return {
        nivelSugerido: null,
        nivelConfianza: null,
        bandejasEvaluadas: null,
        bandejasRechazadas: null,
        observacionesDetectadas: null,
        tokensConsumidos: 0,
        costoUsd: 0,
        tiempoMs: Date.now() - startTime,
        usandoFallbackLocal: false,
        error: 'No se pudo extraer información del pesaje: servicio de IA no disponible o sin credenciales válidas.'
    }
}
