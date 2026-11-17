/**
 * Motor de Reglas NC Avanzadas (C5)
 * Port determinístico y auditable de las reglas normativas de la IT JUNAEB (IT-DAE-SUP026)
 * Homologado desde sigs_actas/app/analisis_nc.py
 */

import {
    HallazgoNC,
    ParametrosMotorNC,
    CATALOGO_REGLAS
} from './definiciones'

// Horarios estándar de servicio JUNAEB (fallback)
export const HORARIOS_DEFAULT: Record<string, [string, string]> = {
    desayuno: ['06:30', '10:30'],
    almuerzo: ['11:30', '15:30'],
    once: ['15:00', '18:00'],
}

// Tabla AQL 6.5 (Anexo 3 IT-DAE-SUP026): Raciones -> Muestra mínima de bandejas requeridas
const MUESTRA_AQL_G: [number, number, number][] = [
    [2, 15, 2],
    [16, 50, 3],
    [51, 150, 5],
    [151, 500, 8],
    [501, 3200, 13],
]

// Tabla AQL 6.5: n_muestra -> (Ac: Aceptación, Re: Rechazo)
const AQL_RESULTADO_TABLA: Record<number, [number, number]> = {
    2: [0, 1],
    3: [1, 2], // n=3 acepta hasta 1 defecto, rechaza con 2
    5: [1, 2],
    8: [1, 2],
    13: [2, 3],
}

// Expresiones regulares comunes
const LECHE_RE = /\b(LECHE|FORMULA\s+LACTEA|FORMULADO\s+LACTEO|FL\b)/i
const PATRON_DESABASTO = /DESABASTECIMIENTO|FALTA\s+DE\s+ABASTECIMIENTO|DISTRIBUCI[OÓ]N|GUIA\s+DE\s+DESPACHO|NO\s+LLEG[OÓ]|NO\s+SE\s+RECIBIO|SIN\s+STOCK|FALTA\s+DE\s+PRODUCTO|SIN\s+ABASTECIMIENTO/i

/**
 * Normaliza una cadena eliminando acentos, caracteres especiales y colapsando espacios.
 */
export function normTexto(str: any): string {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * Convierte 'HH:MM' a minutos transcurridos en el día.
 */
export function hhmmToMin(hhmm: any): number | null {
    const m = String(hhmm || '').match(/(\d{1,2}):(\d{2})/)
    if (!m) return null
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

/**
 * Convierte minutos del día a 'HH:MM'.
 */
export function minToHhmm(mins: number | null): string {
    if (mins === null || isNaN(mins)) return '??:??'
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Retorna el primer entero después de un patrón de label en el texto.
 */
function numDespuesDe(obs: string, regex: RegExp, maxChars = 160): number | null {
    const text = normTexto(obs)
    const m = text.match(regex)
    if (!m || m.index === undefined) return null
    const seg = text.slice(m.index + m[0].length, m.index + m[0].length + maxChars)
    const n = seg.match(/(?<![\d,.])(\d{1,3})(?![\d,.])/)
    return n ? parseInt(n[1], 10) : null
}

/**
 * Asigna valores numéricos a etiquetas tolerando layouts agrupados e intercalados.
 */
function asignarValoresLabels(obs: string, labelsRx: RegExp[]): Record<number, number> {
    const text = normTexto(obs)
    interface Evento {
        pos: number
        tipo: 'label' | 'valor'
        val: number
    }
    const eventos: Evento[] = []

    labelsRx.forEach((rx, idx) => {
        const m = text.match(rx)
        if (m && m.index !== undefined) {
            eventos.push({ pos: m.index, tipo: 'label', val: idx })
        }
    })

    const numRegex = /(?<![\d,.])(\d{1,3})(?![\d,.])/g
    let match: RegExpExecArray | null
    while ((match = numRegex.exec(text)) !== null) {
        eventos.push({ pos: match.index, tipo: 'valor', val: parseInt(match[1], 10) })
    }

    eventos.sort((a, b) => a.pos - b.pos)
    const pendientes: number[] = []
    const resultado: Record<number, number> = {}

    for (const ev of eventos) {
        if (ev.tipo === 'label') {
            pendientes.push(ev.val)
        } else if (pendientes.length > 0) {
            const labelIdx = pendientes.shift()!
            resultado[labelIdx] = ev.val
        }
    }

    return resultado
}

/**
 * Calcula las bandejas requeridas según la tabla AQL 6.5 (configurable desde el Hub).
 */
export function getBandejasRequeridasAQL(
    raciones: number | null | undefined,
    tablaAqlCustom?: Array<{ min: number; max: number | null; muestra: number; ac?: number; re?: number }>
): number | null {
    if (raciones === null || raciones === undefined || isNaN(raciones) || raciones <= 0) return null

    if (tablaAqlCustom && tablaAqlCustom.length > 0) {
        const found = tablaAqlCustom.find(f => {
            const min = f.min
            const max = (f.max === null || f.max === undefined) ? Infinity : f.max
            return raciones >= min && raciones <= max
        })
        if (found) return found.muestra
        if (raciones < tablaAqlCustom[0].min) return tablaAqlCustom[0].muestra
        return tablaAqlCustom[tablaAqlCustom.length - 1].muestra
    }

    for (const [lo, hi, n] of MUESTRA_AQL_G) {
        if (raciones >= lo && raciones <= hi) return n
    }
    return 13 // >3200 raciones -> 13
}

export interface EntradaActaMotor {
    folio: string
    licitacionId?: number | null
    rbd?: number | null
    servicio?: string | null
    fechaSupervision?: string | Date | null
    horaInicio?: string | null
    horaTermino?: string | null
    observacionesGenerales?: string | null
    racionesTotales?: number | null
    racionesNivelSupervisado?: number | null
    nivelSupervisado?: string | null
    bandejasEvaluadas?: number | null
    bandejasRechazadas?: number | null
    dotacionOficial?: number | null
    minutasPlanificadas?: string[]
    alertaFSubcontada?: boolean
    multaPendientePorAspecto?: Record<string, boolean>
}

export interface EntradaAspectoMotor {
    codigo: string // 'A'..'M'
    estado: string // 'NC' | 'CO' | 'NA'
    observacion?: string | null
}

/**
 * Función principal que evalúa las 19 reglas normativas contra los datos del acta.
 */
export function evaluarReglasNC(
    acta: EntradaActaMotor,
    aspectos: EntradaAspectoMotor[],
    horariosConfig: Record<string, [string, string]> = HORARIOS_DEFAULT,
    parametros: ParametrosMotorNC = {}
): HallazgoNC[] {
    const hallazgos: HallazgoNC[] = []
    const folio = acta.folio
    const licId = acta.licitacionId || null

    const reglasActivas = parametros.reglasHabilitadas || {}
    const isReglaHabilitada = (reglaId: string): boolean => {
        if (reglasActivas[reglaId] !== undefined) return reglasActivas[reglaId]
        return true // Habilitada por defecto si no está explícitamente en false
    }

    const aspectoByCodigo = new Map<string, EntradaAspectoMotor>()
    aspectos.forEach(a => aspectoByCodigo.set(a.codigo.toUpperCase(), a))

    // Helper constructor de hallazgo
    const agregarHallazgo = (
        reglaId: string,
        aspecto: string,
        severidad: HallazgoNC['severidad'],
        tipo: HallazgoNC['tipo'],
        titulo: string,
        detalle: string,
        sugerencia: string,
        evidencia: string
    ) => {
        if (!isReglaHabilitada(reglaId)) return

        hallazgos.push({
            folio,
            licitacionId: licId,
            aspecto: aspecto.toUpperCase(),
            reglaId,
            severidad,
            tipo,
            titulo,
            detalle,
            sugerencia,
            evidencia,
            estado: 'PENDIENTE'
        })
    }

    // 1. REGLA: SERVICIO-VACIO
    const servStr = (acta.servicio || '').trim()
    if (!servStr) {
        agregarHallazgo(
            'SERVICIO-VACIO',
            'GENERAL',
            'alta',
            'verificar',
            'Servicio supervisado no identificado en el acta',
            'El campo "Servicio" del encabezado está vacío o no fue reconocido. Sin este dato no es posible validar las reglas de horario (G-HORARIO) ni el cálculo de raciones del servicio controlado.',
            'Verificar el PDF original y corregir el campo Servicio. Si el supervisor no consignó el servicio, constituye un vicio procedimental que afecta la validez de los NC imputados en G y H.',
            'Campo "Servicio" vacío en el encabezado del acta.'
        )
    }

    // 2 y 3. REGLAS: HORARIO-1 y HORARIO-2 (Supervisión fuera de horario de servicio)
    if (servStr) {
        const servNorm = normTexto(servStr).toLowerCase()
        let rangoServicio: [string, string, string] | null = null
        for (const [key, [h1, h2]] of Object.entries(horariosConfig)) {
            if (servNorm.includes(key.toLowerCase()) || key.toLowerCase().includes(servNorm)) {
                rangoServicio = [key, h1, h2]
                break
            }
        }

        if (rangoServicio) {
            const [key, h1, h2] = rangoServicio
            const iniServ = hhmmToMin(h1)
            const finServ = hhmmToMin(h2)
            const iniSup = hhmmToMin(acta.horaInicio)

            if (iniSup !== null && iniServ !== null && finServ !== null) {
                const ncServicio = ['A', 'G', 'K'].filter(cod => aspectoByCodigo.get(cod)?.estado === 'NC')
                const codAfectado = ncServicio.join(',') || 'GENERAL'

                if (iniSup > finServ) {
                    agregarHallazgo(
                        'HORARIO-1',
                        codAfectado,
                        ncServicio.length > 0 ? 'alta' : 'media',
                        'descargo',
                        `Supervisión iniciada después del término del servicio (${key})`,
                        `La supervisión inició a las ${acta.horaInicio} y el horario configurado para ${key} es ${h1}-${h2}. El servicio ya había finalizado, por lo que lo observado en preparaciones no refleja la entrega regular.`,
                        'Impugnar los NC vinculados a la entrega del servicio (minuta A, gramaje G, temperaturas en K): el control se realizó fuera del horario oficial de entrega.',
                        `Hora inicio supervisión: ${acta.horaInicio} | Servicio: ${acta.servicio} | Horario configurado: ${h1}-${h2}`
                    )
                } else {
                    const tolAnticipado = parametros.toleranciaHorarioAnticipadoMin ?? 60
                    if (iniSup < iniServ - tolAnticipado) {
                        agregarHallazgo(
                            'HORARIO-2',
                            codAfectado,
                            'media',
                            'descargo',
                            `Supervisión muy anterior al inicio del servicio (${key})`,
                            `La supervisión inició a las ${acta.horaInicio}, más de ${tolAnticipado} minutos antes del horario configurado (${h1}-${h2}). Las preparaciones podían encontrarse legítimamente en proceso de cocción o alistamiento.`,
                            'Argumentar que faltantes de preparaciones, temperaturas o gramajes observados con excesiva anticipación al servicio no constituyen incumplimiento normativo.',
                            `Hora inicio supervisión: ${acta.horaInicio} | Horario configurado: ${h1}-${h2} | Anticipación: ${iniServ - iniSup} min`
                        )
                    }
                }
            }
        }
    }

    // 4. REGLA: G-HORARIO-1 (Supervisor no estuvo presente en todo el pesaje)
    const aspG = aspectoByCodigo.get('G')
    if (aspG?.estado === 'NC' && servStr) {
        const servNorm = normTexto(servStr).toLowerCase()
        let hServ: [number, number] | null = null
        for (const [key, [h1, h2]] of Object.entries(horariosConfig)) {
            if (servNorm.includes(key.toLowerCase()) || key.toLowerCase().includes(servNorm)) {
                const m1 = hhmmToMin(h1)
                const m2 = hhmmToMin(h2)
                if (m1 !== null && m2 !== null) hServ = [m1, m2]
                break
            }
        }

        const horaIni = hhmmToMin(acta.horaInicio)
        const horaFin = hhmmToMin(acta.horaTermino)

        if (hServ && horaIni !== null && horaFin !== null) {
            const [iniServ, finServ] = hServ
            const tolPesaje = parametros.toleranciaHorarioPesajeMin ?? 10
            const problemas: string[] = []

            if (horaIni > iniServ + tolPesaje) {
                problemas.push(`llegó a las ${acta.horaInicio} (inicio: ${minToHhmm(iniServ)}): no pudo tomar la primera bandeja del inicio`)
            }
            if (horaFin < finServ - tolPesaje) {
                problemas.push(`se retiró a las ${acta.horaTermino} (término: ${minToHhmm(finServ)}): no pudo tomar la última bandeja del cierre`)
            }

            if (problemas.length > 0) {
                const detalleProb = problemas.join(' y ')
                agregarHallazgo(
                    'G-HORARIO-1',
                    'G',
                    'alta',
                    'mal_imputado',
                    'G NC: supervisor ausente durante el servicio completo (pesaje inválido)',
                    `El Anexo 3 del IT-DAE-SUP026 exige seleccionar bandejas al inicio, medio y final del servicio. El supervisor ${detalleProb}. Sin presencia continua, el muestreo no cumple el procedimiento normativo y carece de validez metodológica.`,
                    'Impugnar el NC de G: procedimiento de pesaje incompleto (Anexo 3 del IT-DAE-SUP026) invalida el resultado.',
                    `Hora supervisor: ${acta.horaInicio}–${acta.horaTermino} | Horario servicio: ${minToHhmm(iniServ)}–${minToHhmm(finServ)}`
                )
            }
        }
    }

    // 5. REGLA: G-MUESTRA-1 (Muestra AQL insuficiente)
    if (aspG?.estado === 'NC') {
        const raciones = acta.racionesNivelSupervisado || acta.racionesTotales || 0
        if (raciones > 0) {
            const requeridas = getBandejasRequeridasAQL(raciones, parametros.tablaAql)
            if (requeridas !== null) {
                const bandejasEval = acta.bandejasEvaluadas

                if (bandejasEval === null || bandejasEval === undefined) {
                    agregarHallazgo(
                        'G-MUESTRA-1',
                        'G',
                        'info',
                        'verificar',
                        'G NC: registrar total de bandejas evaluadas para validar muestra AQL 6.5',
                        `Para ${Math.round(raciones)} raciones se requieren al menos ${requeridas} bandejas evaluadas (tabla AQL 6.5, Anexo 3 IT-DAE-SUP026). Registre el número en datos complementarios para auditar el muestreo.`,
                        'Revisar la planilla de pesaje adjunta e ingresar el total de bandejas evaluadas.',
                        `Raciones: ${Math.round(raciones)} | Mínimo AQL 6.5: ${requeridas} bandejas`
                    )
                } else if (bandejasEval < requeridas) {
                    agregarHallazgo(
                        'G-MUESTRA-1',
                        'G',
                        'alta',
                        'mal_imputado',
                        `G NC: muestra INSUFICIENTE — ${bandejasEval} bandejas evaluadas (mínimo requerido: ${requeridas})`,
                        `Para ${Math.round(raciones)} raciones, la tabla AQL 6.5 exige evaluar al menos ${requeridas} bandejas. El supervisor evaluó solo ${bandejasEval}, invalidando el sustento estadístico del NC.`,
                        `Impugnar el NC de G: se evaluaron ${bandejasEval} bandejas cuando la norma exige ${requeridas} para ${Math.round(raciones)} raciones.`,
                        `Bandejas evaluadas: ${bandejasEval} | Mínimo requerido: ${requeridas} | Raciones: ${Math.round(raciones)}`
                    )
                } else {
                    agregarHallazgo(
                        'G-MUESTRA-1',
                        'G',
                        'info',
                        'verificar',
                        `G NC: muestra AQL 6.5 suficiente (${bandejasEval} ≥ ${requeridas} bandejas)`,
                        `El supervisor evaluó ${bandejasEval} bandejas, cumpliendo el mínimo de ${requeridas} exigido por la tabla AQL 6.5. El procedimiento de muestreo es válido en cantidad.`,
                        'La cantidad de bandejas evaluadas cumple la norma; no procede descargo por tamaño de muestra.',
                        `Bandejas evaluadas: ${bandejasEval} | Mínimo: ${requeridas} | ✓ Cumple`
                    )
                }
            }
        }
    }

    // 6. REGLA: G-NIVEL-1 (Nivel no identificado con establecimiento multiescala)
    if (aspG?.estado === 'NC' && !acta.nivelSupervisado) {
        // Si no está especificado nivel en acta, advertir para revisión humana
        agregarHallazgo(
            'G-NIVEL-1',
            'G',
            'media',
            'verificar',
            'G NC: nivel educacional supervisado no consignado',
            'El cálculo de multa en gramaje (G) debe realizarse con las raciones del nivel controlado (T/B/M). El acta no especifica el nivel supervisado.',
            'Seleccionar el nivel supervisado (T/B/M) en los datos complementarios del folio para aplicar la ración exacta.',
            'Nivel supervisado no especificado en el acta.'
        )
    }

    // 7. REGLA: G-AQL-RES-1 / G-AQL-RES-2 (Resultado del lote por criterio Ac/Re)
    if (aspG?.estado === 'NC' && acta.bandejasEvaluadas !== null && acta.bandejasEvaluadas !== undefined) {
        const nEval = acta.bandejasEvaluadas
        let acRe: [number, number] | undefined

        // Prioridad: tabla AQL configurada en el Hub
        if (parametros.tablaAql && parametros.tablaAql.length > 0) {
            const fila = parametros.tablaAql.find(f => f.muestra === nEval) ||
                         parametros.tablaAql.slice().sort((a, b) => b.muestra - a.muestra).find(f => f.muestra <= nEval) ||
                         parametros.tablaAql[0]
            if (fila && fila.ac !== undefined && fila.re !== undefined) {
                acRe = [fila.ac, fila.re]
            }
        }

        if (!acRe) {
            acRe = AQL_RESULTADO_TABLA[nEval]
            if (!acRe) {
                // Buscar la muestra más cercana inferior
                const keys = Object.keys(AQL_RESULTADO_TABLA).map(Number).sort((a, b) => b - a)
                for (const k of keys) {
                    if (k <= nEval) {
                        acRe = AQL_RESULTADO_TABLA[k]
                        break
                    }
                }
            }
        }

        if (acRe) {
            const [ac, re_] = acRe
            const nRechazadas = acta.bandejasRechazadas

            if (nRechazadas === null || nRechazadas === undefined) {
                agregarHallazgo(
                    'G-AQL-RES-1',
                    'G',
                    'info',
                    'verificar',
                    'G NC: ingresar bandejas rechazadas para determinar resultado AQL 6.5',
                    `Con ${nEval} bandejas evaluadas, la tabla AQL 6.5 permite hasta ${ac} bandeja(s) rechazada(s) para ACEPTAR el lote (rechazo si ≥ ${re_}).`,
                    'Registrar bandejas rechazadas en datos de folio para verificar si el lote fue realmente rechazado.',
                    `n=${nEval} | Ac=${ac} | Re=${re_}`
                )
            } else if (nRechazadas <= ac) {
                agregarHallazgo(
                    'G-AQL-RES-1',
                    'G',
                    'alta',
                    'mal_imputado',
                    `G NC: lote ACEPTADO por AQL 6.5 — ${nRechazadas} rechazada(s) ≤ Ac=${ac}`,
                    `Con ${nEval} bandejas evaluadas y ${nRechazadas} rechazada(s), la tabla AQL 6.5 (Anexo 3 IT-DAE-SUP026) estipula que el lote debe ACEPTARSE. El NC de G no tiene sustento normativo.`,
                    `Impugnar el NC de G: resultado AQL 6.5 es ACEPTACIÓN con ${nRechazadas} defectos sobre ${nEval} evaluadas (Ac=${ac}, Re=${re_}). Solicitar rectificación a CO.`,
                    `n=${nEval} | Rechazadas=${nRechazadas} | Ac=${ac} | Re=${re_} -> LOTE ACEPTADO`
                )
            } else {
                agregarHallazgo(
                    'G-AQL-RES-2',
                    'G',
                    'info',
                    'verificar',
                    `G NC: lote RECHAZADO por AQL 6.5 — ${nRechazadas} rechazada(s) ≥ Re=${re_}`,
                    `Con ${nEval} bandejas evaluadas y ${nRechazadas} rechazada(s), la tabla AQL 6.5 confirma que el lote supera el criterio de rechazo (≥ ${re_}). El NC de G cuenta con base estadística.`,
                    'El NC de G es consistente con el AQL 6.5. Verificar si proceden otros argumentos (horario, balanza, calibración).',
                    `n=${nEval} | Rechazadas=${nRechazadas} | Ac=${ac} | Re=${re_} -> LOTE RECHAZADO`
                )
            }
        }
    }

    // 8. REGLA: G-LECHE-CC-1 (Leche en desayuno medida en CC)
    if (aspG?.estado === 'NC' && servStr && normTexto(servStr).toLowerCase().includes('desayuno')) {
        const obsG = aspG.observacion || ''
        if (LECHE_RE.test(obsG)) {
            agregarHallazgo(
                'G-LECHE-CC-1',
                'G',
                'media',
                'verificar',
                'G NC desayuno: leche medida en CC — revisar factor de densidad',
                'El producto evaluado es leche o fórmula láctea. Al ser líquida, se dosifica en CC y su conversión a gramos exige aplicar densidad: 1 mL × 1,029 g/mL = gramos (IT-DAE-SUP026).',
                'Solicitar la planilla de pesajes y corroborar si se aplicó el factor 1,029. Un error en la conversión invalida el déficit imputado.',
                'Servicio: desayuno | Producto: lácteo | Factor conversión normativo: 1 mL = 1,029 g'
            )
        }
    }

    // 9. REGLA: G-J-1 (Gramaje sin balanza)
    const aspJ = aspectoByCodigo.get('J')
    if (aspG?.estado === 'NC' && aspJ) {
        const valsJ = asignarValoresLabels(aspJ.observacion || '', [/TERM[OÓ]METROS?\s+FALTANTES?/i, /BALANZAS?\s+FALTANTES?/i])
        const balanzasFaltantes = valsJ[1]
        const tieneMencionBalanza = /BALANZA/i.test(aspJ.observacion || '') && aspJ.estado === 'NC'

        if ((balanzasFaltantes && balanzasFaltantes > 0) || tieneMencionBalanza) {
            agregarHallazgo(
                'G-J-1',
                'G',
                'alta',
                'mal_imputado',
                'Gramaje imputado sin balanza disponible en el establecimiento',
                `El aspecto G está NC por gramaje, pero el acta consigna ${balanzasFaltantes || 1} balanza(s) faltante(s) en el aspecto J. Sin instrumento de pesaje operativo en el servicio, la medición carece de instrumento trazable.`,
                'Solicitar dejar sin efecto el NC de G: el acta acredita la falta de balanza en J, por lo que la medición carece de instrumento contrastable salvo acreditación de balanza propia calibrada del supervisor.',
                `J: balanzas faltantes = ${balanzasFaltantes || 1} | G: estado NC`
            )
        }
    }

    // 10. REGLA: K-J-1 (Temperatura sin termómetro)
    const aspK = aspectoByCodigo.get('K')
    if (aspK?.estado === 'NC' && aspJ) {
        const valsJ = asignarValoresLabels(aspJ.observacion || '', [/TERM[OÓ]METROS?\s+FALTANTES?/i, /BALANZAS?\s+FALTANTES?/i])
        const termometrosFaltantes = valsJ[0]
        const tieneMencionTermo = /TERM[OÓ]METRO/i.test(aspJ.observacion || '') && aspJ.estado === 'NC'

        if ((termometrosFaltantes && termometrosFaltantes > 0) || tieneMencionTermo) {
            agregarHallazgo(
                'K-J-1',
                'K',
                'alta',
                'mal_imputado',
                'Temperatura imputada sin termómetro disponible en el establecimiento',
                `El aspecto K está NC por temperatura, pero el acta registra ${termometrosFaltantes || 1} termómetro(s) faltante(s) en J. La medición no cuenta con instrumento del servicio contrastable.`,
                'Solicitar revisión o anulación de K: comprobada la falta de termómetro en J, la medición debe constar con instrumento del supervisor, calibración al día y registro formal.',
                `J: termómetros faltantes = ${termometrosFaltantes || 1} | K: estado NC`
            )
        }
    }

    // 11. REGLA: K-MARGEN-1 (Temperatura marginal dentro de tolerancia)
    if (aspK?.estado === 'NC' && aspK.observacion) {
        const obs = normTexto(aspK.observacion)
        const margenParam = parametros.margenTemperaturaMax ?? 1.0
        const regexTemp = /([A-Z0-9 ]{2,40}?)\s*\(\s*(-?\d+(?:[.,]\d+)?)\s*°?\s*C?\s*\)/g
        let matchT: RegExpExecArray | null

        while ((matchT = regexTemp.exec(obs)) !== null) {
            const nombreProd = matchT[1].trim()
            const tempVal = parseFloat(matchT[2].replace(',', '.'))
            let desv = 0
            let regimen = ''

            if (tempVal >= 0) {
                desv = tempVal - 5.0 // Límite refrigeración: 5.0 °C
                regimen = 'refrigeración (0 a 5°C)'
            } else {
                desv = tempVal - (-18.0) // Límite congelación: -18.0 °C
                regimen = 'congelación (< -18°C)'
            }

            if (desv > 0 && desv <= margenParam) {
                agregarHallazgo(
                    'K-MARGEN-1',
                    'K',
                    'media',
                    'descargo',
                    `Desviación marginal de temperatura: ${nombreProd} (${tempVal}°C)`,
                    `${nombreProd} registra ${tempVal}°C frente al límite de ${regimen}, con una desviación de solo ${desv.toFixed(1)}°C, dentro del error máximo admisible (EMA) típico de termómetros de uso alimentario (±1°C).`,
                    `Plantear descargo por tolerancia instrumental: la desviación de ${desv.toFixed(1)}°C es inferior al margen de error calibrado del instrumento; no puede asegurarse certeza metrológica de incumplimiento.`,
                    `K: ${nombreProd} (${tempVal}°C) | Desviación: ${desv.toFixed(1)}°C | Margen: ±${margenParam}°C`
                )
            }
        }
    }

    // 12. REGLA: A-IGUAL-1 (Preparaciones iguales en Minuta A)
    const aspA = aspectoByCodigo.get('A')
    if (aspA?.estado === 'NC' && aspA.observacion) {
        const obs = normTexto(aspA.observacion)
        const m = obs.match(/PREPARACION\s+ENTREGADA\s*:?(.*)$/i)
        if (m) {
            const valores = m[1].trim()
            const palabras = valores.split(/\s+/)
            if (palabras.length >= 4) {
                const mitad = Math.floor(palabras.length / 2)
                const p1 = palabras.slice(0, mitad).join(' ')
                const p2 = palabras.slice(mitad, mitad * 2).join(' ')
                if (p1 && p1 === p2) {
                    agregarHallazgo(
                        'A-IGUAL-1',
                        'A',
                        'alta',
                        'mal_imputado',
                        'Minuta NC con preparación programada idéntica a la entregada',
                        'El acta registra exactamente el mismo texto en los campos de preparación programada y entregada, lo que contradice el estado NC del aspecto A.',
                        'Solicitar dejar sin efecto el NC de A: el propio medio de verificación del acta acredita que la preparación entregada coincide con la programada.',
                        `Preparaciones registradas: "${p1}"`
                    )
                }
            }
        }
    }

    // 13 y 14. REGLAS: NC-VACIO-1 y NC-PEND-1
    for (const asp of aspectos) {
        if (asp.estado !== 'NC') continue
        const obs = normTexto(asp.observacion || '')
        const valores = obs.replace(/(MENCIONE|INDICAR|INGRESAR|NOMBRE|CANTIDAD)[A-Z ()/,.°-]*?:/gi, '|')
        const tokens = valores.split('|').map(t => t.trim()).filter(Boolean)
        const vacias = new Set(['CONFORME', 'NO', 'APLICA', 'N/A', 'NA', '0', '-'])
        const sustantivos = tokens.filter(t => t.split(/\s+/).some(w => !vacias.has(w)))

        if (tokens.length > 0 && sustantivos.length === 0) {
            const evid = tokens.slice(0, 5).join(' | ') || 'sin contenido'
            agregarHallazgo(
                'NC-VACIO-1',
                asp.codigo,
                'alta',
                'mal_imputado',
                `Aspecto ${asp.codigo} NC sin evidencia en sus campos estructurados`,
                `El aspecto ${asp.codigo} está marcado NC, pero todos los campos del medio de verificación registran CONFORME, NO APLICA o 0. El acta carece del hecho constitutivo de infracción.`,
                'Solicitar anulación del NC: el medio de verificación del propio formulario no consigna incumplimiento.',
                `${asp.codigo}: campos = ${evid}`
            )
        } else if (acta.multaPendientePorAspecto?.[asp.codigo]) {
            agregarHallazgo(
                'NC-PEND-1',
                asp.codigo,
                'media',
                'verificar',
                `Aspecto ${asp.codigo} NC con cantidad normativa indeterminada`,
                'El motor de multas no pudo extraer una cantidad fidedigna desde la observación; requiere revisión para ingresar corrección manual (C3.2).',
                'Revisar el acta física y registrar ajuste manual con motivo justificado.',
                `${asp.codigo}: cálculo pendiente de confirmación`
            )
        }
    }

    // 15 y 16. REGLAS: H-RATIO-1 y H-MANIP-1 (Manipuladoras y Dotación)
    const aspH = aspectoByCodigo.get('H')
    if (aspH) {
        const obsGen = normTexto(acta.observacionesGenerales || '')
        const mRatio = obsGen.match(/(\d{1,2})\s+MANIP\w*\s+PARA\s+(\d{1,4})\s+RACIONES/)
        if (mRatio) {
            const manip = parseInt(mRatio[1], 10)
            const raciones = parseInt(mRatio[2], 10)
            const requeridas = Math.ceil(raciones / 70)
            const faltantesCampo = numDespuesDe(aspH.observacion || '', /MANIPULADORAS?\s+FALTANTES?/i)

            if (requeridas > manip && aspH.estado === 'CO') {
                agregarHallazgo(
                    'H-RATIO-1',
                    'H',
                    'media',
                    'verificar',
                    'Observaciones generales contradicen la conformidad en personal (H)',
                    `Las observaciones generales señalan ${manip} manipuladora(s) para ${raciones} raciones (requeridas: ${requeridas} con ratio 1:70), pero H está CONFORME. El acta contiene contradicción interna.`,
                    'Usar esta inconsistencia para cuestionar la rigurosidad y coherencia del levantamiento en el acta.',
                    `Obs. generales: "${mRatio[0]}" | H: estado CO | Requeridas: ${requeridas}`
                )
            } else if (requeridas > manip && aspH.estado === 'NC' && (faltantesCampo || 0) === 0) {
                agregarHallazgo(
                    'H-RATIO-1',
                    'H',
                    'media',
                    'verificar',
                    'H NC pero el campo de manipuladoras faltantes consigna 0',
                    `Obs. generales: ${manip} manipuladora(s) para ${raciones} raciones, pero el campo estructurado de faltantes indica 0. La cantidad para el cálculo no es trazable.`,
                    'Exigir apego normativo: la sanción de H debe liquidarse sobre el campo normativo del formato, no sobre notas libres.',
                    `Obs. generales: "${mRatio[0]}" | campo faltantes = 0`
                )
            }
        }

        // H-MANIP-1: Cruzar con Dotación Oficial (C2.3)
        if (aspH.estado === 'NC' && acta.dotacionOficial && acta.dotacionOficial > 0) {
            const faltantes = numDespuesDe(aspH.observacion || '', /MANIPULADORAS?\s+FALTANTES?/i)
            if (faltantes !== null && faltantes > 0) {
                const umbralPct = parametros.umbralDotacionInasistenciaPct ?? 50
                const pct = Math.round((faltantes / acta.dotacionOficial) * 100)
                if (pct >= umbralPct) {
                    agregarHallazgo(
                        'H-MANIP-1',
                        'H',
                        'alta',
                        'verificar',
                        `Manipuladoras faltantes supera el ${umbralPct}% de la dotación (${faltantes}/${acta.dotacionOficial})`,
                        `El acta registra ${faltantes} manipuladora(s) faltante(s) de un total de ${acta.dotacionOficial} asignadas al establecimiento (${pct}% de inasistencia). Una ausencia masiva suele asociarse a licencias imprevistas o fuerza mayor.`,
                        'Solicitar libro de asistencia y certificados médicos. Acreditar licencias y reemplazos activados para desvirtuar dolo o abandono.',
                        `Faltantes: ${faltantes} | Dotación oficial: ${acta.dotacionOficial} | Porcentaje: ${pct}%`
                    )
                }
            }
        }
    }

    // 17. REGLA: J-GK-NA-1 (Falta de instrumento impone NA en G o K)
    if (aspJ?.estado === 'NC') {
        const obsJ = normTexto(aspJ.observacion || '')
        const faltaTermo = /TERM[OÓ]METRO|T\.?\s*M\.?\b/i.test(obsJ)
        const faltaBalanza = /BALANZA|B\.?\s*T\.?\b/i.test(obsJ)

        for (const [cod, reqInst, nombreInst] of [
            ['G', 'balanza', 'balanza'],
            ['K', 'termometro', 'termómetro']
        ] as const) {
            const asp = aspectoByCodigo.get(cod)
            if (asp?.estado === 'NC') {
                const aplicaFalta = reqInst === 'balanza' ? faltaBalanza : faltaTermo
                if (aplicaFalta || (!faltaBalanza && !faltaTermo)) {
                    agregarHallazgo(
                        'J-GK-NA-1',
                        cod,
                        'alta',
                        'mal_imputado',
                        `${cod} NC debería ser No Aplica (NA) por falta de ${nombreInst} (J NC)`,
                        `El aspecto J está NC por ausencia de ${nombreInst}. La IT-DAE-SUP026 (pág. 14) establece taxativamente que en tal caso el aspecto ${cod} debe quedar como "No Aplica" (NA), no como NC. El supervisor omitió la instrucción expresa.`,
                        `Solicitar reclasificar ${cod} de NC a NA: la pauta oficial JUNAEB ordena que, verificada la falta de ${nombreInst} en J, el aspecto ${cod} debe imputarse como No Aplica.`,
                        `J: NC por falta de ${nombreInst} | ${cod}: NC (debió consignarse NA per pág. 14)`
                    )
                }
            }
        }
    }

    // 18. REGLA: DESABASTO-1 (Desabastecimiento no imputable per Tabla 1 IT)
    for (const cod of ['A', 'C']) {
        const asp = aspectoByCodigo.get(cod)
        if (asp?.estado === 'NC') {
            const obsAsp = normTexto(asp.observacion || '')
            const obsGen = normTexto(acta.observacionesGenerales || '')
            let fuente: string | null = null

            if (PATRON_DESABASTO.test(obsAsp)) fuente = `observación del aspecto ${cod}`
            else if (PATRON_DESABASTO.test(obsGen)) fuente = 'observaciones generales'

            if (fuente) {
                agregarHallazgo(
                    'DESABASTO-1',
                    cod,
                    'media',
                    'descargo',
                    `${cod} NC con indicios de desabastecimiento (evaluar imputabilidad)`,
                    `El aspecto ${cod} está NC y la ${fuente} sugiere desabastecimiento. La IT-DAE-SUP026 (Tabla N° 1) distingue causas no imputables (corte vial, robo, catástrofe, desabasto general).`,
                    'Reunir guías de despacho, órdenes de compra y cartas de proveedores para acreditar causal no imputable y solicitar exclusión de multa.',
                    `${cod}: NC | ${fuente}: mención de falta de producto/desabastecimiento`
                )
            }
        }
    }

    // 19. REGLA: F-CALIBRE-C8 (Calibre en F corresponde a C8)
    const aspF = aspectoByCodigo.get('F')
    if (aspF?.estado === 'NC' && aspF.observacion) {
        const obsF = normTexto(aspF.observacion)
        const matchCal = obsF.match(/\b(CALIBRE|TAMANO|TAMAÑO|PEQUENO|PEQUEÑO|GRANDE)\b/i)
        if (matchCal) {
            agregarHallazgo(
                'F-CALIBRE-C8',
                'F',
                'alta',
                'mal_imputado',
                'F NC por calibre: corresponde tramitarse en C8 y no como F',
                `El aspecto F está NC y la observación menciona "${matchCal[0]}". La IT-DAE-SUP026 (pág. 13) fija expresamente que los incumplimientos de calibre en frutas y hortalizas NO deben imputarse en F, sino derivarse como C8.`,
                'Solicitar anulación de la multa en F por mala imputación de ítem sancionatorio según pág. 13 del instructivo oficial.',
                `F: NC | observación contiene "${matchCal[0]}" | IT-DAE-SUP026 pág. 13`
            )
        }
    }

    // 20. REGLA: M-PLAZO-1 (Aspecto M antes de junio 2025)
    const aspM = aspectoByCodigo.get('M')
    if (aspM?.estado === 'NC' && acta.fechaSupervision) {
        let fechaObj: Date | null = null
        if (acta.fechaSupervision instanceof Date) {
            fechaObj = acta.fechaSupervision
        } else {
            const s = String(acta.fechaSupervision)
            const m1 = s.match(/(\d{4})[/-](\d{1,2})/)
            if (m1) {
                fechaObj = new Date(parseInt(m1[1], 10), parseInt(m1[2], 10) - 1, 1)
            }
        }

        if (fechaObj && !isNaN(fechaObj.getTime())) {
            const fechaCorte = new Date(2025, 5, 1) // 1 de junio 2025
            if (fechaObj < fechaCorte) {
                agregarHallazgo(
                    'M-PLAZO-1',
                    'M',
                    'alta',
                    'mal_imputado',
                    'Aspecto M NC evaluado previo a junio 2025: procedía NA',
                    `La supervisión se realizó con fecha anterior a junio de 2025. La IT-DAE-SUP026 (págs. 12 y 15) establece que el aspecto M (Plan de Residuos) solo es exigible a partir de junio 2025; con anterioridad debe consignarse como No Aplica (NA).`,
                    'Solicitar anulación inmediata del NC en M: la exigencia carece de vigencia normativa en la fecha del acta.',
                    `Fecha supervisión: ${acta.fechaSupervision} | M: NC | Vigencia M: a partir de 06/2025`
                )
            }
        }
    }

    // 21. REGLA: B-CELULAR-1 (Manual en celular de manipuladora)
    const aspB = aspectoByCodigo.get('B')
    if (aspB?.observacion) {
        const obsB = normTexto(aspB.observacion)
        const matchCel = obsB.match(/CELULAR\s+(DE\s+LA\s+)?MANIPULADORA|CELULAR\s+PERSONAL/i)
        if (matchCel && aspB.estado === 'CO') {
            agregarHallazgo(
                'B-CELULAR-1',
                'B',
                'media',
                'verificar',
                'B CONFORME pero manual en celular personal de manipuladora',
                'El aspecto B está CO pero la observación indica uso de celular personal de la manipuladora. La IT-DAE-SUP026 (pág. 13) advierte que si el manual no está en soporte físico o dispositivo corporativo, califica como inexistencia.',
                'Verificar si el dispositivo es oficial o personal para anticipar eventuales cuestionamientos de auditoría JUNAEB.',
                `B: CO | mención: "${matchCel[0]}" | IT-DAE-SUP026 pág. 13`
            )
        }
    }

    // 22. REGLA: C-CONF-1 (Aspecto C con materia prima conforme)
    const aspC = aspectoByCodigo.get('C')
    if (aspC?.estado === 'NC' && aspC.observacion) {
        const obsC = normTexto(aspC.observacion)
        const mConf = obsC.match(/MATERIA\s+PRIMA\s+NO\s+ENCONTRADA[A-Z ]*?:?\s*(CONFORME|NO APLICA)/i)
        if (mConf) {
            agregarHallazgo(
                'C-CONF-1',
                'C',
                'alta',
                'mal_imputado',
                'C NC pero el acta consigna CONFORME en materia prima faltante',
                'El aspecto C está en NC, pero el campo estructurado que debe identificar la materia prima no encontrada consigna CONFORME o NO APLICA: no existe faltante acreditado.',
                'Solicitar dejar sin efecto el NC de C por contradicción directa del medio de verificación del formulario.',
                `C: "${mConf[0]}"`
            )
        }
    }

    // 23. REGLA: F-SUBCONTADA (Alerta de subconteo proveniente de C4)
    if (acta.alertaFSubcontada && aspF?.estado === 'NC') {
        agregarHallazgo(
            'F-SUBCONTADA',
            'F',
            'alta',
            'verificar',
            'Aspecto F con recuento robusto superior a cantidad imputada',
            'El análisis multiaspecto C4 identificó que el recuento de especies dañadas en el acta supera la cantidad registrada para la multa.',
            'Auditar el detalle de especies en el modal de diagnóstico C4 y cotejar contra la planilla de terreno.',
            'Discrepancia detectada entre conteo de especies y cantidad imputada en F.'
        )
    }

    // Ordenar hallazgos por severidad: alta (0), media (1), info (2)
    const ordenSeveridad: Record<string, number> = { alta: 0, media: 1, info: 2 }
    hallazgos.sort((a, b) => (ordenSeveridad[a.severidad] ?? 3) - (ordenSeveridad[b.severidad] ?? 3))

    return hallazgos
}
