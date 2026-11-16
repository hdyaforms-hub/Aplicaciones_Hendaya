/**
 * src/lib/multas/variables.ts
 *
 * Módulo centralizado para la extracción y resolución de variables utilizadas en el
 * cálculo de multas de Elementos Esenciales (Fórmulas PAE).
 *
 * JERARQUÍA DE PRIORIDAD (Etapa 3 - C3):
 * 1. OVERRIDE MANUAL (C3.2): Si existe un registro en Multas_Cantidad_Override para el
 *    folio, letra y variable (y C3 está activo), este valor prevalece de forma absoluta.
 * 2. VALOR GUARDADO: Si el usuario guardó previamente un cálculo para el folio y no hay
 *    override, se respeta el valor almacenado en variablesUsadas.
 * 3. EXTRACCIÓN AUTOMÁTICA: Si no hay dato guardado ni override, se extrae el valor
 *    automáticamente a partir del texto de observaciones del acta.
 */

export const RESERVED_FORMULA_KEYWORDS = [
    'MATERIAPRIMA',
    'MATERIAPRIMATPMPAP',
    'INSTRUMENTO',
    'MANIPULADORA',
    'MANIPULADORAAFECTADA',
    'NIVELCONTROLADO',
    'CANTSERVICIO',
    'ELEMENTOS'
] as const

export type VariableKeyword = typeof RESERVED_FORMULA_KEYWORDS[number]

export interface OverrideInfo {
    id: string
    valor: number
    valorOriginal?: number | null
    motivo: string
    createdBy: string
    createdAt: Date | string
}

export interface VariableResuelta {
    variable: string
    valor: string
    origen: 'OVERRIDE' | 'GUARDADO' | 'AUTO'
    overrideInfo?: OverrideInfo
}

/**
 * Extrae automáticamente variables numéricas a partir de las observaciones de un aspecto
 */
export function extraerVariablesDeObservacion(
    obsText: string | null | undefined,
    formula?: string
): Record<string, string> {
    const extraidas: Record<string, string> = {}
    if (!obsText) return extraidas

    const upperFormula = formula ? formula.toUpperCase() : ''
    const checkAll = !formula

    // 1. MANIPULADORA
    if (checkAll || upperFormula.includes('MANIPULADORA')) {
        const regex = /(?:manipuladora(?:s)?\s*faltante(?:s)?|cantidad[\s\S]*?faltante(?:s)?)[^\d]*(\d+)/i
        const matchRegex = obsText.match(regex)
        if (matchRegex) {
            extraidas['MANIPULADORA'] = matchRegex[1]
        } else {
            const matchLast = obsText.match(/(\d+)(?!.*\d)/)
            if (matchLast) {
                extraidas['MANIPULADORA'] = matchLast[1]
            }
        }
    }

    // 2. MANIPULADORAAFECTADA
    if (checkAll || upperFormula.includes('MANIPULADORAAFECTADA')) {
        const regex = /(?:manipuladora(?:s)?\s*afectada(?:s)?|cantidad[\s\S]*?afectada(?:s)?)[^\d]*(\d+)/i
        const matchRegex = obsText.match(regex)
        if (matchRegex) {
            let extractedVal = parseInt(matchRegex[1], 10)
            if (extractedVal === 0) extractedVal = 1
            extraidas['MANIPULADORAAFECTADA'] = extractedVal.toString()
        } else {
            extraidas['MANIPULADORAAFECTADA'] = '1'
        }
    }

    // 3. ELEMENTOS
    if (checkAll || upperFormula.includes('ELEMENTOS')) {
        const textWithoutManipuladoras = obsText.replace(/cantidad[\s\S]*?manipuladoras[\s\S]*?afectadas[^\d]*\d+/gi, '')
        const matches = textWithoutManipuladoras.match(/:\s*\d+/g)
        if (matches) {
            const validMatches = matches.filter(m => {
                const numMatch = m.match(/\d+/)
                return numMatch ? parseInt(numMatch[0], 10) > 0 : false
            })
            extraidas['ELEMENTOS'] = validMatches.length.toString()
        }
    }

    // 4. MATERIAPRIMA
    if (checkAll || upperFormula.includes('MATERIAPRIMA')) {
        let sumMateriaPrima = 0
        let foundMateriaPrima = false

        const matchFrutas = Array.from(obsText.matchAll(/Cantidad\s+de\s+materias\s+primas\s+\(frutas\s+y\s+verduras\)\s+afectadas:(?:[ \t]*|[\r\n]+\s*)(\d+)[ \t]*$/gim))
        for (const m of matchFrutas) {
            sumMateriaPrima += parseInt(m[1], 10)
            foundMateriaPrima = true
        }

        const matchNoFrutas = Array.from(obsText.matchAll(/Mencionar\s+las\s+materias\s+primas\s+afectadas\s+que\s+no\s+son\s+frutas\s+y\s+verduras,\s+y\s+su\s+defecto:(?:[ \t]*|[\r\n]+\s*)(\d+)[ \t]*$/gim))
        for (const m of matchNoFrutas) {
            sumMateriaPrima += parseInt(m[1], 10)
            foundMateriaPrima = true
        }

        if (foundMateriaPrima) {
            extraidas['MATERIAPRIMA'] = sumMateriaPrima.toString()
        }
    }

    // 5. MATERIAPRIMATPMPAP
    if (checkAll || upperFormula.includes('MATERIAPRIMATPMPAP')) {
        const matchTpmpap = Array.from(obsText.matchAll(/Cantidad\s+de\s+la\s+materia\s+prima,\s+producto,\s+alimentos\s+y\/o\s+preparaciones\s+que\s+no\s+se\s+encuentra\s+en\s+su\s+TPMPAP[:.]?(?:[ \t]*|[\r\n]+\s*)(\d+)[ \t]*$/gim))
        let sumTpmpap = 0
        let foundTpmpap = false
        for (const m of matchTpmpap) {
            sumTpmpap += parseInt(m[1], 10)
            foundTpmpap = true
        }
        if (foundTpmpap) {
            extraidas['MATERIAPRIMATPMPAP'] = sumTpmpap.toString()
        }
    }

    // 6. INSTRUMENTO
    if (checkAll || upperFormula.includes('INSTRUMENTO')) {
        let totalInstrumentos = 0
        let foundAny = false

        const termometroMatch = obsText.match(/(?:term[oó]metro(?:s)?)[^\d]*(\d+)/i)
        if (termometroMatch) {
            totalInstrumentos += parseInt(termometroMatch[1], 10)
            foundAny = true
        }

        const balanzaMatch = obsText.match(/(?:balanza(?:s)?)[^\d]*(\d+)/i)
        if (balanzaMatch) {
            totalInstrumentos += parseInt(balanzaMatch[1], 10)
            foundAny = true
        }

        if (foundAny) {
            extraidas['INSTRUMENTO'] = totalInstrumentos.toString()
        }
    }

    // 7. CANTSERVICIO
    if (checkAll || upperFormula.includes('CANTSERVICIO')) {
        const matchServicio = obsText.match(/(?:cantidad de )?servicio(?:s)? afectad(?:o|a)(?:s)?[^\d]*(\d+)/i)
        if (matchServicio) {
            extraidas['CANTSERVICIO'] = matchServicio[1]
        }
    }

    return extraidas
}

/**
 * Resuelve el valor final de cada variable para una fórmula o aspecto,
 * aplicando estrictamente la jerarquía de prioridad: Override > Guardado > Automático.
 */
export function resolverVariablesConPrioridad(params: {
    letraAspecto: string
    formula?: string
    obsText?: string | null
    variablesGuardadas?: Record<string, any>
    overridesPorAspecto?: Record<string, OverrideInfo> // variable -> OverrideInfo
    c3Activo?: boolean
}): {
    variablesFinales: Record<string, string>
    detalleVariables: Record<string, VariableResuelta>
} {
    const {
        formula,
        obsText,
        variablesGuardadas = {},
        overridesPorAspecto = {},
        c3Activo = false
    } = params

    const variablesFinales: Record<string, string> = {}
    const detalleVariables: Record<string, VariableResuelta> = {}

    // 1. Extraer automáticas
    const extraidasAuto = extraerVariablesDeObservacion(obsText, formula)

    // 2. Identificar qué variables aplican para esta fórmula
    const upperFormula = formula ? formula.toUpperCase() : ''
    const variablesRelevantes = formula
        ? RESERVED_FORMULA_KEYWORDS.filter(k => upperFormula.includes(k))
        : RESERVED_FORMULA_KEYWORDS

    for (const variable of variablesRelevantes) {
        const override = c3Activo ? overridesPorAspecto[variable] : undefined
        const guardado = variablesGuardadas[variable]
        const auto = extraidasAuto[variable]

        if (override !== undefined && override !== null) {
            // Prioridad 1: Override manual
            const valStr = String(override.valor)
            variablesFinales[variable] = valStr
            detalleVariables[variable] = {
                variable,
                valor: valStr,
                origen: 'OVERRIDE',
                overrideInfo: override
            }
        } else if (guardado !== undefined && guardado !== null && String(guardado).trim() !== '') {
            // Prioridad 2: Guardado previo
            const valStr = String(guardado).trim()
            variablesFinales[variable] = valStr
            detalleVariables[variable] = {
                variable,
                valor: valStr,
                origen: 'GUARDADO'
            }
        } else if (auto !== undefined && auto !== null && String(auto).trim() !== '') {
            // Prioridad 3: Extracción automática
            const valStr = String(auto).trim()
            variablesFinales[variable] = valStr
            detalleVariables[variable] = {
                variable,
                valor: valStr,
                origen: 'AUTO'
            }
        }
    }

    return { variablesFinales, detalleVariables }
}
