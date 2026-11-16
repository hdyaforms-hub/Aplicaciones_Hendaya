/**
 * src/lib/multas/extractor.ts
 *
 * Módulo de extracción robusta de cantidades multiaspecto (Etapa 4 - C4).
 * Homologado con 100% de fidelidad funcional respecto de sigs_actas (parser_acta.py y main.py).
 *
 * Aspectos soportados:
 * - F: Materias primas y productos. Separa FV (frutas y verduras) de No-FV, detecta subconteo.
 * - J: Instrumentos de medición (termómetro y balanza). Conteo de tipos faltantes (máx 2).
 * - K: Temperaturas de materias primas y preparaciones. Conteo de servicios o productos fuera de rango.
 * - D y E: Materias primas no autorizadas o fuera de TPMPAP.
 * - L: Elementos EPP. Conteo de los 7 elementos normativos y multiplicador por manipuladoras afectadas.
 * - H: Manipuladoras faltantes.
 */

export const FOOD_CANON: Record<string, string[]> = {
    // Frutas
    'MANZANA': ['MANZANA', 'MANZANAS'],
    'DURAZNO': ['DURAZNO', 'DURAZNOS'],
    'PERA': ['PERA', 'PERAS'],
    'NARANJA': ['NARANJA', 'NARANJAS'],
    'PLATANO': ['PLATANO', 'PLÁTANO', 'PLATANOS', 'PLÁTANOS'],
    'MANDARINA': ['MANDARINA', 'MANDARINAS'],
    'KIWI': ['KIWI', 'KIWIS'],
    'UVA': ['UVA', 'UVAS'],
    'FRUTILLA': ['FRUTILLA', 'FRUTILLAS'],
    'MELON': ['MELON', 'MELÓN'],
    'SANDIA': ['SANDIA', 'SANDÍA'],
    'CIRUELA': ['CIRUELA', 'CIRUELAS'],
    'TUTTI FRUTTI': ['TUTTI FRUTTI', 'TUTIFRUTI', 'TUTI FRUTI'],
    'FRUTA TROZADA': ['FRUTA TROZADA', 'FRUTAS TROZADAS'],

    // Verduras / ensaladas
    'CHOCLO': ['CHOCLO'],
    'POROTOS VERDES': ['POROTOS VERDES', 'POROTO VERDE'],
    'TOMATE': ['TOMATE', 'TOMATES'],
    'PEPINO': ['PEPINO', 'PEPINOS'],
    'LECHUGA': ['LECHUGA'],
    'REPOLLO': ['REPOLLO'],
    'ZANAHORIA': ['ZANAHORIA', 'ZANAHORIAS'],
    'BETARRAGA': ['BETARRAGA', 'BETARRAGAS'],
    'APIO': ['APIO'],
    'ACELGA': ['ACELGA'],
    'ESPINACA': ['ESPINACA'],
    'CEBOLLA': ['CEBOLLA', 'CEBOLLAS'],
    'ENSALADA': ['ENSALADA', 'ENSALADAS'],

    // Proteínas y preparaciones
    'TRUTRO DE POLLO': ['TRUTRO DE POLLO', 'TUTO DE POLLO', 'POLLO TRUTRO'],
    'POLLO': ['POLLO'],
    'NUGGETS': ['NUGGET', 'NUGGETS', 'NUGGETS DE POLLO'],
    'APANADO DE PESCADO': ['APANADO DE PESCADO', 'APANADOS DE PESCADO'],
    'PESCADO': ['PESCADO'],
    'HUEVO': ['HUEVO', 'HUEVOS', 'HUEVO REVUELTO', 'HUEVOS REVUELTOS'],
    'CARNE': ['CARNE'],
    'CHURRASCO': ['CHURRASCO', 'CHURRASCOS'],
    'JAMON': ['JAMON', 'JAMÓN'],
    'QUESO': ['QUESO'],
    'ATUN': ['ATUN', 'ATÚN'],

    // Cereales / acompañamientos
    'PAN': ['PAN', 'PAN BLANCO', 'PAN INTEGRAL', 'PAN HALLULLA', 'HALLULLA', 'MARRAQUETA'],
    'ARROZ': ['ARROZ', 'ARROZ ARABE', 'ARROZ ÁRABE'],
    'FIDEOS': ['FIDEO', 'FIDEOS', 'FIDEOS TRICOLOR', 'ESPIRALES', 'ESPIRALES TRICOLOR'],
    'LENTEJAS': ['LENTEJA', 'LENTEJAS'],
    'POROTOS': ['POROTO', 'POROTOS'],
    'GARBANZOS': ['GARBANZO', 'GARBANZOS'],
    'PURE': ['PURE', 'PURÉ', 'PURE DE PAPAS', 'PURÉ DE PAPAS'],
    'PAPAS': ['PAPA', 'PAPAS'],
    'BARRA DE CEREAL': ['BARRA DE CEREAL', 'BARRA CEREAL'],

    // Lácteos / postres / bebidas
    'YOGURT': ['YOGURT', 'YOGHURT', 'YOGUR', 'YOGURT DE LITRO'],
    'LECHE': ['LECHE', 'LECHE LIQUIDA', 'LECHE LÍQUIDA'],
    'FLAN': ['FLAN'],
    'JALEA': ['JALEA'],
    'COMPOTA': ['COMPOTA', 'COMPOTA DE FRUTAS'],
    'AGUA': ['AGUA'],
    'JUGO': ['JUGO', 'JUGOS']
}

export function normalizeTextSimple(s: string | null | undefined): string {
    if (!s) return ''
    return s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/Ü/g, 'U')
}

export function cleanItemName(s: string | null | undefined): string {
    let str = (s || '').trim()
    str = str.replace(/^[-*•\d.)\s]+/, '')
    str = str.replace(/\s+/g, ' ').replace(/^[:;\s-]+|[:;\s-]+$/g, '').toUpperCase()
    return str
}

export function canonicalFoodItem(s: string | null | undefined): string | null {
    let text = normalizeTextSimple(cleanItemName(s))
    if (!text) return null

    // Recortar descripciones de defecto
    text = text.split(/\s+CON\s+|\s+SIN\s+|\s+ALMACENAD[OA]\s+|\s+EN\s+MAL\s+ESTADO|\s+DA[NÑ]O|\s+PUDRICI[OÓ]N|\s+HONGOS/)[0].trim()

    // Ordenar de más largo a más corto para evitar falsos positivos
    const pairs: Array<{ canon: string; variant: string }> = []
    for (const [canon, variants] of Object.entries(FOOD_CANON)) {
        for (const v of variants) {
            pairs.push({ canon, variant: normalizeTextSimple(v) })
        }
    }
    pairs.sort((a, b) => b.variant.length - a.variant.length)

    for (const { canon, variant } of pairs) {
        const rx = new RegExp(`(^|[^A-Z])${variant}([^A-Z]|$)`, 'i')
        if (rx.test(text)) {
            return canon
        }
    }
    return null
}

export function isNoiseItem(s: string | null | undefined): boolean {
    const clean = cleanItemName(s)
    if (!clean) return true

    const noiseExact = new Set([
        'NA', 'N/A', 'NO APLICA', 'NO APLICA.', 'NO', 'CONFORME', '0', '1', '2', '3', '4', '5',
        'KG', 'G', 'GR', 'GRS', 'LTS', 'LT', 'UN', 'UNIDAD', 'UNIDADES',
        'CON', 'SIN', 'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'E'
    ])
    if (noiseExact.has(clean)) return true
    if (/^\d+([.,]\d+)?\s*(KG|G|GR|GRS|L|LT|LTS|°C|C)?$/i.test(clean)) return true
    if (/(CANTIDAD|MUESTREAD|DEFECTUOS|G\/KG|KG|GRAM|GU[IÍ]A|FECHA|RUT|FOLIO|INDICAR|MENCIONE|NOMBRE)/i.test(clean)) return true
    if (clean.length < 3) return true

    return false
}

export function splitItems(text: string | null | undefined): string[] {
    const raw = (text || '').toUpperCase().replace(/\n/g, ' | ')
    const parts = raw.split(/\s*(?:,|\/|\+|\||\s+Y\s+|\s+E\s+)\s*/)
    const out: string[] = []

    for (const p of parts) {
        const cleaned = cleanItemName(p)
        const canon = canonicalFoodItem(cleaned)
        if (canon) {
            out.push(canon)
        } else if (!isNoiseItem(cleaned)) {
            out.push(cleaned)
        }
    }

    return Array.from(new Set(out))
}

export function countProductsFromLines(lines: string[]): string[] {
    const candidates: string[] = []
    for (const line of lines) {
        const s = cleanItemName(line)
        if (isNoiseItem(s)) continue

        const canon = canonicalFoodItem(s)
        if (canon) {
            candidates.push(canon)
            continue
        }

        for (const item of splitItems(s)) {
            const cItem = canonicalFoodItem(item)
            if (cItem) {
                candidates.push(cItem)
            } else if (!isNoiseItem(item)) {
                candidates.push(item)
            }
        }
    }
    return Array.from(new Set(candidates))
}

export function extractLinesAfterLabel(
    obs: string,
    labelPatterns: RegExp[],
    stopPatterns?: RegExp[],
    maxLines: number = 12
): string[] {
    const lines = (obs || '').split(/\r?\n/).map(l => l.trim())
    let startIdx: number | null = null

    for (let i = 0; i < lines.length; i++) {
        for (const pat of labelPatterns) {
            if (pat.test(lines[i])) {
                startIdx = i + 1
                break
            }
        }
        if (startIdx !== null) break
    }

    if (startIdx === null) return []

    const out: string[] = []
    const stops = stopPatterns || []

    for (let i = startIdx; i < Math.min(startIdx + maxLines, lines.length); i++) {
        const line = lines[i]
        if (stops.some(p => p.test(line))) {
            break
        }
        out.push(line)
    }
    return out
}

function extractFirstIntCount(segment: string): number | null {
    // Primer número entero standalone (no pegado a KG, G, °C, decimales)
    const matches = Array.from(segment.matchAll(/(?<![\dA-Z/])(\d{1,3})(?:[.,]\d+)?/gi))
    for (const m of matches) {
        if (m[0] !== m[1]) continue // Tenía parte decimal
        const tail = segment.substring((m.index || 0) + m[0].length, (m.index || 0) + m[0].length + 6).trim()
        if (/^(?:KG|GRS?|G|ML|LT?|CC)\b|°|%/i.test(tail)) continue // Pegado a unidad
        const parsed = parseInt(m[1], 10)
        if (!isNaN(parsed)) return parsed
    }
    return null
}

const F_RX_FV = /CANTIDAD\s+DE\s+MATERIAS\s+PRIMAS\s*\(?\s*FRUTAS\s+Y\s+VERDURAS\s*\)?\s*AFECTADAS\s*:?/i
const F_RX_NOFV = /CANTIDAD\s+DE\s+MATERIAS\s+PRIMAS\s+AFECTADAS\s+QUE\s+NO\s+SON\s+FRUTAS\s+Y\s+VERDURAS\s*:?/i
const F_RX_MUESTREADO = /CANTIDAD\s+DE\s+PRODUCTO\s+MUESTREADO/i
const F_RX_DEFECTUOSO = /CANTIDAD\s+DE\s+PRODUCTO\s+DEFECTUOSO/i
const F_RX_MENC_NOFV = /MENCION(?:E|AR)\s+LAS\s+MATERIAS\s+PRIMAS\s+AFECTADAS\s+QUE\s+NO\s+SON(?:\s+FRUTAS\s+Y\s+VERDURAS\s*,?\s*(?:Y\s+SU\s+DEFECTO)?\s*:?)?/i
const F_RX_MENC_FV = /MENCION(?:E|AR)\s+LAS\s+FRUTAS\s+Y\s+VERDURAS\s+AFECTADAS\s*,?\s*(?:Y\s+SU\s+DEFECTO)?\s*:?/i

/**
 * Aspecto F: Extracción robusta de materias primas (FV + No-FV)
 */
export function extractFNormativo(obsText: string | null | undefined): {
    total: number | null
    qFv: number | null
    qNoFv: number | null
    fuente: string
    alertas: string[]
} {
    const alertas: string[] = []
    if (!obsText) {
        return { total: null, qFv: null, qNoFv: null, fuente: 'sin observaciones', alertas }
    }

    const text = normalizeTextSimple(obsText).replace(/\r?\n/g, ' ')
    const mFv = text.match(F_RX_FV)
    const mNoFv = text.match(F_RX_NOFV)

    let qFv: number | null = null
    if (mFv && mFv.index !== undefined) {
        let end = text.length
        const afterFv = text.substring(mFv.index + mFv[0].length)
        const stops = [F_RX_MUESTREADO, F_RX_DEFECTUOSO, F_RX_MENC_NOFV, F_RX_NOFV]
        for (const rx of stops) {
            const ms = afterFv.match(rx)
            if (ms && ms.index !== undefined) {
                end = Math.min(end, mFv.index + mFv[0].length + ms.index)
            }
        }
        qFv = extractFirstIntCount(text.substring(mFv.index + mFv[0].length, end))
    }

    let qNoFv: number | null = null
    if (mNoFv && mNoFv.index !== undefined) {
        qNoFv = extractFirstIntCount(text.substring(mNoFv.index + mNoFv[0].length))
    }

    // Variantes de formulario sin label "Cantidad de..."
    if (qNoFv === null && !mNoFv) {
        const mVar = text.match(F_RX_MENC_NOFV)
        if (mVar && mVar.index !== undefined) {
            const seg = text.substring(mVar.index + mVar[0].length, mVar.index + mVar[0].length + 150)
            const mDigit = seg.match(/(?<!\d)(\d{1,3})(?!\d)/)
            if (mDigit) {
                qNoFv = parseInt(mDigit[1], 10)
                alertas.push(`NoFV=${qNoFv} obtenido de variante 'Mencionar materias primas que no son FV'.`)
            }
        }
    }

    // Red de seguridad / detección de SUBCONTADA
    const tieneListaNoFv = F_RX_MENC_NOFV.test(text)
    if ((qNoFv === null || qNoFv === 0) && tieneListaNoFv) {
        alertas.push('El acta menciona materias primas afectadas que no son frutas y verduras, pero la cantidad no-FV fue 0 o no detectada. La multa podría estar SUBCONTADA.')
    }

    const tieneListaFv = F_RX_MENC_FV.test(text)
    if ((qFv === null || qFv === 0) && tieneListaFv) {
        alertas.push('El acta menciona frutas y verduras afectadas, pero la cantidad FV fue 0 o no detectada. La multa podría estar SUBCONTADA.')
    }

    if (qFv !== null || qNoFv !== null) {
        const total = (qFv || 0) + (qNoFv || 0)
        if (total > 0) {
            return {
                total,
                qFv,
                qNoFv,
                fuente: `labels normativos F (FV=${qFv ?? 's/d'}, NoFV=${qNoFv ?? 's/d'})`,
                alertas
            }
        }
    }

    // Fallback: conteo por productos canónicos
    const linesFv = extractLinesAfterLabel(obsText, [/nombre\s+la\s+fruta\s+o\s+verdura/i, /nombre\s+de\s+la\s+fruta/i], [/cantidad/i, /mencione/i])
    const linesNoFv = extractLinesAfterLabel(obsText, [/materias\s+primas\s+afectadas\s+que\s+no\s+son\s+frutas/i, /mencione\s+las\s+materias/i], [/cantidad/i])
    const countItems = countProductsFromLines([...linesFv, ...linesNoFv])

    if (countItems.length > 0) {
        alertas.push('Cantidad obtenida por conteo de nombres de productos (respaldo canónico).')
        return {
            total: countItems.length,
            qFv,
            qNoFv,
            fuente: `conteo canónico de productos (${countItems.join(', ')})`,
            alertas
        }
    }

    return { total: null, qFv: null, qNoFv: null, fuente: 'no determinada', alertas }
}

/**
 * Aspecto J: Conteo normativo de TIPOS de instrumento faltantes (0, 1 o 2)
 */
export function extractJTipos(obsText: string | null | undefined): {
    tipos: number
    termometros: number | null
    balanzas: number | null
    fuente: string
    alertas: string[]
} {
    const alertas: string[] = []
    if (!obsText) {
        return { tipos: 1, termometros: null, balanzas: null, fuente: 'por defecto (1)', alertas }
    }

    const lines = obsText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

    function valTrasLabel(labelPat: RegExp): number | null {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (labelPat.test(line)) {
                if (line.includes(':')) {
                    const tras = line.split(':', 2)[1].trim()
                    const m = tras.match(/(\d+)/)
                    if (m) return parseInt(m[1], 10)
                }
                for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                    const m2 = lines[j].match(/^(\d+)$/)
                    if (m2) return parseInt(m2[1], 10)
                }
            }
        }
        return null
    }

    const tVal = valTrasLabel(/term[oó]metros?\s+faltantes?/i)
    const bVal = valTrasLabel(/balanzas?\s+faltantes?/i)

    if (tVal === null && bVal === null) {
        // Fallback genérico: "instrumentos faltantes: N"
        const mGen = obsText.match(/instrumentos?\s+faltantes?\D{0,10}?(\d+)/i)
        if (mGen) {
            const tiposGen = Math.min(parseInt(mGen[1], 10), 2)
            return {
                tipos: Math.max(tiposGen, 1),
                termometros: null,
                balanzas: null,
                fuente: 'texto genérico instrumentos faltantes (máx 2 tipos)',
                alertas
            }
        }
        return { tipos: 1, termometros: null, balanzas: null, fuente: 'fallback normativo (1 tipo)', alertas }
    }

    const tipos = (tVal && tVal > 0 ? 1 : 0) + (bVal && bVal > 0 ? 1 : 0)
    const finalTipos = Math.max(tipos, 1) // Si es NC, al menos 1 tipo faltó

    return {
        tipos: finalTipos,
        termometros: tVal,
        balanzas: bVal,
        fuente: `tipos normativos de instrumentos (Termómetro=${tVal ?? 0}, Balanza=${bVal ?? 0})`,
        alertas
    }
}

/**
 * Aspecto K: Conteo de servicios afectados o productos fuera de rango térmico
 */
export function extractKNormativo(obsText: string | null | undefined): {
    cantidad: number | null
    fuente: string
    alertas: string[]
} {
    const alertas: string[] = []
    if (!obsText) {
        return { cantidad: null, fuente: 'sin observaciones', alertas }
    }

    // Buscar "CANTIDAD DE SERVICIOS AFECTADOS: X"
    const mServ = obsText.match(/CANTIDAD\s+DE\s+SERVICIOS\s+AFECTADOS\s*[:.\s]*(\d+)/i)
    if (mServ) {
        const val = parseInt(mServ[1], 10)
        if (val > 0) {
            return {
                cantidad: val,
                fuente: 'campo normativo cantidad de servicios afectados',
                alertas
            }
        }
    }

    // Fallback: contar productos fuera de rango
    const lines = extractLinesAfterLabel(
        obsText,
        [/mencione\s+la\s+materia\s+prima\/producto\/preparaci[oó]n/i, /materia\s+prima\/producto\/preparaci[oó]n\s+que\s+est[eé]\s+fuera/i, /mencione\s+la\s+materia/i],
        [/cantidad/i, /observaci[oó]n/i]
    )
    const items = countProductsFromLines(lines)
    if (items.length > 0) {
        return {
            cantidad: items.length,
            fuente: `conteo de preparaciones fuera de temperatura (${items.join(', ')})`,
            alertas
        }
    }

    return { cantidad: null, fuente: 'no determinada', alertas }
}

/**
 * Aspecto L: 7 Elementos EPP normativos y manipuladoras afectadas
 */
export function extractLNormativo(obsText: string | null | undefined): {
    elementos: number
    manipuladoras: number | null
    total: number | null
    fuente: string
    alertas: string[]
} {
    const alertas: string[] = []
    if (!obsText) {
        return { elementos: 1, manipuladoras: null, total: 1, fuente: 'por defecto (1)', alertas }
    }

    const lines = obsText.split(/\r?\n/).map(l => l.trim())
    const labels = [
        /Delantal/i,
        /Pechera\s+blanca\s+de\s+PVC/i,
        /Gorro\/Cofia/i,
        /Pechera\s+de\s+g[eé]nero/i,
        /Guantes?\s+de\s+l[aá]tex/i,
        /Calzado\s+de\s+seguridad/i,
        /Guantes?\s+faltantes/i
    ]

    let elementosPositivos = 0
    let manipuladoras: number | null = null

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        let val: number | null = null

        const mSame = line.match(/:\s*(\d+([.,]\d+)?)\s*$/)
        if (mSame) {
            val = parseFloat(mSame[1].replace(',', '.'))
        } else if (i + 1 < lines.length) {
            const nxt = lines[i + 1].trim()
            if (/^\d+([.,]\d+)?$/.test(nxt)) {
                val = parseFloat(nxt.replace(',', '.'))
            }
        }

        if (val === null) continue

        if (/manipuladoras?\s+afectadas/i.test(line)) {
            manipuladoras = val
            continue
        }

        if (labels.some(pat => pat.test(line))) {
            if (val > 0) {
                elementosPositivos++
            }
        }
    }

    const totalElementos = Math.max(elementosPositivos, 1)
    let totalMult: number = totalElementos
    if (manipuladoras && manipuladoras > 0) {
        totalMult = totalElementos * manipuladoras
    }

    return {
        elementos: totalElementos,
        manipuladoras,
        total: totalMult,
        fuente: `elementos EPP normativos (${totalElementos} elementos${manipuladoras ? ` × ${manipuladoras} manipuladoras` : ''})`,
        alertas
    }
}

/**
 * Aspectos D y E: Materias primas y TPMPAP
 */
export function extractDELNormativo(
    codigo: 'D' | 'E',
    obsText: string | null | undefined
): {
    cantidad: number | null
    fuente: string
    alertas: string[]
} {
    const alertas: string[] = []
    if (!obsText) {
        return { cantidad: null, fuente: 'sin observaciones', alertas }
    }

    if (codigo === 'E') {
        const matchTpmpap = obsText.match(/Cantidad\s+de\s+la\s+materia\s+prima,\s+producto,\s+alimentos\s+y\/o\s+preparaciones\s+que\s+no\s+se\s+encuentra\s+en\s+su\s+TPMPAP[:.]?\s*(\d+)/i)
        if (matchTpmpap) {
            const val = parseInt(matchTpmpap[1], 10)
            if (val > 0) {
                return {
                    cantidad: val,
                    fuente: 'campo normativo TPMPAP',
                    alertas
                }
            }
        }
    }

    // Conteo de líneas o productos mencionados
    const lines = extractLinesAfterLabel(
        obsText,
        [
            /mencione\s+la\s+materia\s+prima/i,
            /mencione\s+las\s+materias\s+primas/i,
            /mencione\s+el\s+producto/i,
            /mencione\s+los\s+productos/i,
            /mencione\s+la\s+preparaci[oó]n/i,
            /mencione\s+las\s+preparaciones/i
        ],
        [/cantidad/i, /observaci[oó]n/i, /indicar/i]
    )

    const items = countProductsFromLines(lines)
    if (items.length > 0) {
        return {
            cantidad: items.length,
            fuente: `conteo canónico de materias primas (${items.join(', ')})`,
            alertas
        }
    }

    return { cantidad: null, fuente: 'no determinada', alertas }
}

/**
 * Función principal unificada de extracción robusta C4
 */
export function extraerVariablesRobustas(
    obsText: string | null | undefined,
    letraAspecto: string,
    formula?: string
): {
    variables: Record<string, string>
    fuentes: Record<string, string>
    alertas: string[]
} {
    const variables: Record<string, string> = {}
    const fuentes: Record<string, string> = {}
    const alertas: string[] = []

    if (!obsText) return { variables, fuentes, alertas }

    const code = letraAspecto.trim().toUpperCase()

    switch (code) {
        case 'F': {
            const resF = extractFNormativo(obsText)
            alertas.push(...resF.alertas)
            if (resF.total !== null && resF.total > 0) {
                variables['MATERIAPRIMA'] = String(resF.total)
                fuentes['MATERIAPRIMA'] = resF.fuente
            }
            break
        }

        case 'J': {
            const resJ = extractJTipos(obsText)
            alertas.push(...resJ.alertas)
            variables['INSTRUMENTO'] = String(resJ.tipos)
            fuentes['INSTRUMENTO'] = resJ.fuente
            break
        }

        case 'K': {
            const resK = extractKNormativo(obsText)
            alertas.push(...resK.alertas)
            if (resK.cantidad !== null && resK.cantidad > 0) {
                variables['CANTSERVICIO'] = String(resK.cantidad)
                fuentes['CANTSERVICIO'] = resK.fuente
            }
            break
        }

        case 'L': {
            const resL = extractLNormativo(obsText)
            alertas.push(...resL.alertas)
            variables['ELEMENTOS'] = String(resL.elementos)
            fuentes['ELEMENTOS'] = resL.fuente
            if (resL.manipuladoras !== null && resL.manipuladoras > 0) {
                variables['MANIPULADORAAFECTADA'] = String(resL.manipuladoras)
                fuentes['MANIPULADORAAFECTADA'] = `manipuladoras afectadas del acta (${resL.manipuladoras})`
            }
            break
        }

        case 'D':
        case 'E': {
            const resDE = extractDELNormativo(code, obsText)
            alertas.push(...resDE.alertas)
            if (resDE.cantidad !== null && resDE.cantidad > 0) {
                if (code === 'E') {
                    variables['MATERIAPRIMATPMPAP'] = String(resDE.cantidad)
                    fuentes['MATERIAPRIMATPMPAP'] = resDE.fuente
                } else {
                    variables['MATERIAPRIMA'] = String(resDE.cantidad)
                    fuentes['MATERIAPRIMA'] = resDE.fuente
                }
            }
            break
        }

        case 'H': {
            const mH = obsText.match(/manipuladoras?\s+faltantes?.{0,80}?(\d+)/i) ||
                       obsText.match(/cantidad\s+de\s+manipuladoras?\s+faltantes?.{0,80}?(\d+)/i)
            if (mH) {
                const val = parseInt(mH[1], 10)
                if (val > 0) {
                    variables['MANIPULADORA'] = String(val)
                    fuentes['MANIPULADORA'] = `campo manipuladoras faltantes (${val})`
                }
            }
            break
        }
    }

    return { variables, fuentes, alertas }
}
