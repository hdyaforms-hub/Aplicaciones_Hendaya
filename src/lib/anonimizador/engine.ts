import ExcelJS from 'exceljs'

// ---------------------------------------------------------------------------
// Tipos de dato
// ---------------------------------------------------------------------------

export const TIPOS: Record<string, string> = {
    rut: 'RUT',
    nombre: 'Nombre de persona',
    empresa: 'Nombre de empresa',
    direccion: 'Dirección',
    email: 'Correo electrónico',
    telefono: 'Teléfono',
    texto: 'Texto genérico',
}

export const PLANTILLAS: Record<string, string> = {
    nombre: 'empleado {n}',
    empresa: 'empresa {n}',
    direccion: 'dirección {n}',
    email: 'correo{n}@ejemplo.cl',
    telefono: 'teléfono {n}',
    texto: 'dato {n}',
}

export const BASE_RUT = 30_000_000

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

export function sinAcentos(texto: string): string {
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

export function aTexto(valor: any): string {
    if (valor === null || valor === undefined) return ''
    if (typeof valor === 'object') {
        // En exceljs puede ser un RichText, Formula, o Date
        if (valor.richText && Array.isArray(valor.richText)) {
            return valor.richText.map((r: any) => r.text || '').join('').trim()
        }
        if (valor.result !== undefined) {
            return aTexto(valor.result)
        }
        if (valor.text !== undefined) {
            return String(valor.text).trim()
        }
        if (valor instanceof Date) {
            return valor.toISOString().split('T')[0]
        }
    }
    if (typeof valor === 'number' && Number.isInteger(valor)) {
        return valor.toString()
    }
    return String(valor).trim()
}

export function esNumerico(valor: any): boolean {
    if (valor === null || valor === undefined) return false
    if (typeof valor === 'boolean') return false
    if (typeof valor === 'number') return true
    
    let texto = aTexto(valor).replace(/\s+/g, '')
    if (!texto) return false
    
    // Formato chileno: 1.234.567,89 -> 1234567.89
    texto = texto.replace(/\./g, '').replace(',', '.')
    return !isNaN(Number(texto))
}

// ---------------------------------------------------------------------------
// RUT Chileno y Módulo 11
// ---------------------------------------------------------------------------

const RE_RUT = /^(\d{1,3}(?:\.\d{3})+|\d+)-?([\dkK])$/

export function digitoVerificador(cuerpo: number): string {
    let suma = 0
    let factor = 2
    const strCuerpo = Math.abs(cuerpo).toString()
    for (let i = strCuerpo.length - 1; i >= 0; i--) {
        suma += parseInt(strCuerpo[i], 10) * factor
        factor = factor === 7 ? 2 : factor + 1
    }
    const resto = 11 - (suma % 11)
    if (resto === 11) return '0'
    if (resto === 10) return 'K'
    return resto.toString()
}

export function parsearRut(valor: any): [number, string] | null {
    const texto = aTexto(valor).replace(/\s+/g, '')
    const m = texto.match(RE_RUT)
    if (!m) return null
    const cuerpo = parseInt(m[1].replace(/\./g, ''), 10)
    if (isNaN(cuerpo) || cuerpo === 0) return null
    return [cuerpo, m[2].toUpperCase()]
}

export function rutValido(valor: any): boolean {
    const partes = parsearRut(valor)
    if (!partes) return false
    const [cuerpo, dv] = partes
    return digitoVerificador(cuerpo) === dv
}

export function formatearRut(canonico: string, como: any): string {
    const [cuerpoTxt, dv] = canonico.split('-')
    const cuerpo = parseInt(cuerpoTxt, 10)
    const original = aTexto(como)
    const tienePuntos = parsearRut(original) !== null && original.includes('.')
    const tieneGuion = original.includes('-') || parsearRut(original) === null

    const cuerpoFmt = tienePuntos 
        ? cuerpo.toLocaleString('es-CL') 
        : cuerpo.toString()

    return tieneGuion ? `${cuerpoFmt}-${dv}` : `${cuerpoFmt}${dv}`
}

export function formatearRutUniforme(canonico: string): string {
    const [cuerpoTxt, dv] = canonico.split('-')
    const cuerpo = parseInt(cuerpoTxt, 10)
    return `${cuerpo.toLocaleString('es-CL')}-${dv}`
}

// ---------------------------------------------------------------------------
// Normalización de Llaves
// ---------------------------------------------------------------------------

export function normalizar(valor: any, tipo: string): string {
    const texto = aTexto(valor)
    if (!texto) return ''
    if (tipo === 'rut') {
        const partes = parsearRut(texto)
        if (partes) {
            return `${partes[0]}-${partes[1]}`
        }
    }
    return sinAcentos(texto).replace(/\s+/g, ' ').toUpperCase()
}

// ---------------------------------------------------------------------------
// Gestor de Mapa de Equivalencias
// ---------------------------------------------------------------------------

export class GestorMapa {
    private valores: Map<string, string> = new Map() // key: "tipo:clave" -> valor
    private usados: Map<string, Set<string>> = new Map() // tipo -> Set<valor>
    private siguiente: Map<string, number> = new Map() // tipo -> contador n
    private precargados: Set<string> = new Set() // "tipo:clave"

    public cargar(entradas: Array<{ tipo: string; original: string; falso: string }>): number {
        let cargadas = 0
        for (const e of entradas) {
            const tipo = String(e.tipo || '').trim().toLowerCase()
            if (!TIPOS[tipo]) continue
            const clave = String(e.original || '').trim()
            const valor = String(e.falso || '').trim()
            if (!clave || !valor) continue

            const compositeKey = `${tipo}:${clave}`
            this.valores.set(compositeKey, valor)

            if (!this.usados.has(tipo)) this.usados.set(tipo, new Set())
            this.usados.get(tipo)!.add(valor)
            this.precargados.add(compositeKey)

            this.sembrarContador(tipo, valor)
            cargadas++
        }
        return cargadas
    }

    private sembrarContador(tipo: string, falso: string): void {
        let n = 0
        if (tipo === 'rut') {
            const partes = parsearRut(falso)
            n = partes ? partes[0] - BASE_RUT : 0
        } else {
            const numeros = falso.match(/\d+/g)
            n = numeros && numeros.length > 0 ? parseInt(numeros[numeros.length - 1], 10) : 0
        }
        if (n > 0) {
            const actual = this.siguiente.get(tipo) || 1
            this.siguiente.set(tipo, Math.max(actual, n + 1))
        }
    }

    public obtener(tipo: string, clave: string): string {
        const compositeKey = `${tipo}:${clave}`
        const existente = this.valores.get(compositeKey)
        if (existente !== undefined) {
            return existente
        }

        if (!this.usados.has(tipo)) this.usados.set(tipo, new Set())
        const usadosSet = this.usados.get(tipo)!
        let n = this.siguiente.get(tipo) || 1

        let candidato = ''
        while (true) {
            candidato = this.generar(tipo, n)
            if (!usadosSet.has(candidato)) {
                break
            }
            n++
        }

        this.valores.set(compositeKey, candidato)
        usadosSet.add(candidato)
        this.siguiente.set(tipo, n + 1)
        return candidato
    }

    private generar(tipo: string, n: number): string {
        if (tipo === 'rut') {
            const cuerpo = BASE_RUT + n
            return `${cuerpo}-${digitoVerificador(cuerpo)}`
        }
        const plantilla = PLANTILLAS[tipo] || PLANTILLAS.texto
        return plantilla.replace('{n}', n.toString())
    }

    public entradas(): Array<{ tipo: string; original: string; falso: string }> {
        const result: Array<{ tipo: string; original: string; falso: string }> = []
        for (const [k, falso] of this.valores.entries()) {
            const sepIdx = k.indexOf(':')
            const tipo = k.substring(0, sepIdx)
            const original = k.substring(sepIdx + 1)
            result.push({ tipo, original, falso })
        }
        return result.sort((a, b) => a.tipo.localeCompare(b.tipo) || a.original.localeCompare(b.original))
    }

    public get total(): number {
        return this.valores.size
    }

    public get nuevos(): number {
        return this.valores.size - this.precargados.size
    }

    public resumenPorTipo(): Record<string, number> {
        const conteo: Record<string, number> = {}
        for (const k of this.valores.keys()) {
            const tipo = k.split(':')[0]
            conteo[tipo] = (conteo[tipo] || 0) + 1
        }
        return conteo
    }
}

// ---------------------------------------------------------------------------
// Detección de Estructura y Cabeceras
// ---------------------------------------------------------------------------

export function detectarFilaEncabezado(ws: ExcelJS.Worksheet, limite: number = 25, maxCol: number = 300): number {
    const topeFila = Math.min(limite, ws.rowCount || 1)
    const topeCol = Math.min(ws.columnCount || 1, maxCol)

    const candidatas: Map<number, number> = new Map() // fila -> cantidad no vacías

    for (let fila = 1; fila <= topeFila; fila++) {
        const row = ws.getRow(fila)
        let noVacias = 0
        let textos = 0

        for (let c = 1; c <= topeCol; c++) {
            const cell = row.getCell(c)
            const txt = aTexto(cell.value)
            if (txt !== '') {
                noVacias++
                if (!esNumerico(cell.value)) {
                    textos++
                }
            }
        }

        if (noVacias >= 3 && textos / noVacias >= 0.85) {
            candidatas.set(fila, noVacias)
        }
    }

    if (candidatas.size === 0) {
        return 1
    }

    // Identificar bloques de filas contiguas y elegir la última del bloque más denso
    const filasOrdenadas = Array.from(candidatas.keys()).sort((a, b) => a - b)
    const bloques: number[][] = []

    for (const f of filasOrdenadas) {
        if (bloques.length > 0 && f === bloques[bloques.length - 1][bloques[bloques.length - 1].length - 1] + 1) {
            bloques[bloques.length - 1].push(f)
        } else {
            bloques.push([f])
        }
    }

    // Seleccionar bloque con mayor densidad y dentro de él la última fila
    let mejorBloque = bloques[0]
    let maxDensidad = 0
    for (const b of bloques) {
        const densidad = Math.max(...b.map(f => candidatas.get(f) || 0))
        if (densidad > maxDensidad) {
            maxDensidad = densidad
            mejorBloque = b
        }
    }

    return mejorBloque[mejorBloque.length - 1]
}

export function leerEncabezados(ws: ExcelJS.Worksheet, fila: number, maxCol: number = 300): Array<{ col: number; nombre: string }> {
    const row = ws.getRow(fila)
    const encabezados: Array<{ col: number; nombre: string }> = []
    const topeCol = Math.min(ws.columnCount || 1, maxCol)

    for (let c = 1; c <= topeCol; c++) {
        const txt = aTexto(row.getCell(c).value)
        if (txt) {
            encabezados.push({ col: c, nombre: txt })
        }
    }
    return encabezados
}

export function muestraColumna(ws: ExcelJS.Worksheet, col: number, filaInicio: number, maximo: number = 200): string[] {
    const valores: string[] = []
    const totalFilas = ws.rowCount || filaInicio
    const tope = Math.min(filaInicio + maximo, totalFilas + 1)

    for (let f = filaInicio; f < tope; f++) {
        const val = aTexto(ws.getRow(f).getCell(col).value)
        if (val !== '') {
            valores.push(val)
        }
    }
    return valores
}

// ---------------------------------------------------------------------------
// Sugerencia Inteligente de Tipo
// ---------------------------------------------------------------------------

const CONCEPTOS_MONTO = [
    'bono', 'aporte', 'descuento', 'sueldo', 'gratificacion', 'anticipo',
    'prestamo', 'asignacion', 'haber', 'total', 'imponible', 'liquido',
    'movilizacion', 'colacion', 'afp', 'isapre', 'impuesto', 'horas',
    'dias', 'monto', 'valor', 'cuota', 'saldo', 'precio', 'costo'
]

function menciona(texto: string, palabra: string): boolean {
    const regex = new RegExp(`(?<![a-z])${palabra}(?![a-z])`, 'i')
    return regex.test(texto)
}

export function sugerirTipo(encabezado: string): string | null {
    const h = sinAcentos(encabezado.toLowerCase())

    if (menciona(h, 'rut') || h.includes('r.u.t')) {
        return 'rut'
    }
    if (CONCEPTOS_MONTO.some(p => menciona(h, p))) {
        return null
    }
    if (menciona(h, 'empresa') && (menciona(h, 'nombre') || menciona(h, 'razon'))) {
        return 'empresa'
    }
    if (h.includes('razon social')) {
        return 'empresa'
    }
    if (['nombre', 'apellido', 'apellidos', 'trabajador', 'empleado', 'funcionario', 'beneficiario', 'titular'].some(p => menciona(h, p))) {
        return 'nombre'
    }
    if (['direccion', 'domicilio', 'calle', 'pasaje', 'avenida'].some(p => menciona(h, p))) {
        return 'direccion'
    }
    if (['mail', 'email', 'correo'].some(p => menciona(h, p))) {
        return 'email'
    }
    if (['telefono', 'fono', 'celular', 'movil', 'anexo'].some(p => menciona(h, p))) {
        return 'telefono'
    }
    return null
}

// ---------------------------------------------------------------------------
// Emparejamiento de Columnas Multioja
// ---------------------------------------------------------------------------

export interface Resolucion {
    hoja: string
    encabezado: string
    tipo: string
    colOrigen: number
    colDestino: number | null
    estado: 'igual' | 'corrida' | 'repetida' | 'ambigua' | 'ausente'
    candidatas: number[]
}

export function resolverColumnas(
    workbook: ExcelJS.Workbook,
    hojaBase: string,
    seleccion: Record<number, string>, // colOrigen -> tipo
    filasEncabezado: Record<string, number>
): Record<string, Resolucion[]> {
    const wsBase = workbook.getWorksheet(hojaBase)
    if (!wsBase) return {}

    const filaBase = filasEncabezado[hojaBase] || 1
    const nombresBase: Record<number, string> = {}
    for (const colStr of Object.keys(seleccion)) {
        const col = parseInt(colStr, 10)
        nombresBase[col] = aTexto(wsBase.getRow(filaBase).getCell(col).value)
    }

    const resultado: Record<string, Resolucion[]> = {}

    workbook.eachSheet(ws => {
        if (ws.name === hojaBase) return

        const filaH = filasEncabezado[ws.name] || 1
        const indice: Record<string, number[]> = {}
        const encs = leerEncabezados(ws, filaH)

        for (const item of encs) {
            const key = normalizar(item.nombre, 'texto')
            if (!indice[key]) indice[key] = []
            indice[key].push(item.col)
        }

        const resoluciones: Resolucion[] = []
        for (const [colStr, tipo] of Object.entries(seleccion)) {
            const colOrigen = parseInt(colStr, 10)
            const nombre = nombresBase[colOrigen] || ''
            const key = normalizar(nombre, 'texto')
            const coincidencias = indice[key] || []

            let estado: Resolucion['estado'] = 'ausente'
            let colDestino: number | null = null

            if (coincidencias.includes(colOrigen) && coincidencias.length === 1) {
                estado = 'igual'
                colDestino = colOrigen
            } else if (coincidencias.includes(colOrigen)) {
                estado = 'repetida'
                colDestino = colOrigen
            } else if (coincidencias.length === 1) {
                estado = 'corrida'
                colDestino = coincidencias[0]
            } else if (coincidencias.length > 1) {
                estado = 'ambigua'
                colDestino = coincidencias[0]
            } else {
                estado = 'ausente'
                colDestino = null
            }

            resoluciones.push({
                hoja: ws.name,
                encabezado: nombre,
                tipo,
                colOrigen,
                colDestino,
                estado,
                candidatas: coincidencias
            })
        }
        resultado[ws.name] = resoluciones
    })

    return resultado
}

// ---------------------------------------------------------------------------
// Diagnóstico y Validación de Contenido
// ---------------------------------------------------------------------------

export interface Diagnostico {
    severidad: 'ok' | 'nota' | 'alerta'
    mensaje: string | null
    revisados: number
}

export function validarColumna(valores: any[], tipo: string): Diagnostico {
    const utiles = valores.filter(v => aTexto(v) !== '')
    const n = utiles.length
    if (n === 0) {
        return { severidad: 'alerta', mensaje: 'La columna no contiene datos en las filas examinadas.', revisados: 0 }
    }

    if (tipo === 'rut') {
        const conForma = utiles.filter(v => parsearRut(v) !== null).length
        const conDv = utiles.filter(v => rutValido(v)).length

        if (conForma / n < 0.8) {
            return {
                severidad: 'alerta',
                mensaje: `Solo el ${Math.round((conForma / n) * 100)}% de los ${n} valores tiene formato de RUT. Comprueba si la columna es correcta.`,
                revisados: n
            }
        }
        if (conDv / n < 0.5) {
            return {
                severidad: 'alerta',
                mensaje: `${n - conDv} de ${n} valores no pasan el dígito verificador. Es probable que sea una columna de montos o códigos numéricos.`,
                revisados: n
            }
        }
        if (conDv < n) {
            return {
                severidad: 'nota',
                mensaje: `${n - conDv} de ${n} RUTs tienen dígito verificador discordante. Se anonimizarán igual con datos consistentes.`,
                revisados: n
            }
        }
        return { severidad: 'ok', mensaje: null, revisados: n }
    }

    if (tipo === 'email') {
        const conArroba = utiles.filter(v => aTexto(v).includes('@')).length
        if (conArroba / n < 0.8) {
            return {
                severidad: 'alerta',
                mensaje: `Solo el ${Math.round((conArroba / n) * 100)}% de los ${n} valores contiene '@'.`,
                revisados: n
            }
        }
        return { severidad: 'ok', mensaje: null, revisados: n }
    }

    if (['nombre', 'empresa', 'direccion'].includes(tipo)) {
        const noNumericos = utiles.filter(v => !esNumerico(v)).length
        if (noNumericos / n < 0.8) {
            return {
                severidad: 'alerta',
                mensaje: `El ${Math.round((1 - noNumericos / n) * 100)}% de los valores son números y se esperaba texto para "${TIPOS[tipo]}".`,
                revisados: n
            }
        }
        return { severidad: 'ok', mensaje: null, revisados: n }
    }

    return { severidad: 'ok', mensaje: null, revisados: n }
}

// ---------------------------------------------------------------------------
// Tarea de Reemplazo y Anonimización
// ---------------------------------------------------------------------------

export interface TareaAnonimizacion {
    hoja: string
    columna: number
    tipo: string
    filaInicio: number
}

export interface ResultadoAnonimizacion {
    celdas: number
    detalle: Array<{
        hoja: string
        columna: string
        tipo: string
        celdas: number
        distintos: number
    }>
}

export function anonimizarLibro(
    workbook: ExcelJS.Workbook,
    tareas: TareaAnonimizacion[],
    gestor: GestorMapa,
    formatoRut: 'imitar' | 'uniforme' = 'imitar'
): ResultadoAnonimizacion {
    let totalCeldas = 0
    const detalle: ResultadoAnonimizacion['detalle'] = []

    for (const tarea of tareas) {
        const ws = workbook.getWorksheet(tarea.hoja)
        if (!ws) continue

        let celdas = 0
        const distintos = new Set<string>()
        const maxRow = ws.rowCount || tarea.filaInicio

        for (let f = tarea.filaInicio; f <= maxRow; f++) {
            const cell = ws.getRow(f).getCell(tarea.columna)
            const original = cell.value
            if (aTexto(original) === '') continue

            const clave = normalizar(original, tarea.tipo)
            if (!clave) continue

            let falso = gestor.obtener(tarea.tipo, clave)
            if (tarea.tipo === 'rut') {
                falso = formatoRut === 'uniforme'
                    ? formatearRutUniforme(falso)
                    : formatearRut(falso, original)
            }

            // Preservar estilo exacto de la celda y asignar nuevo valor
            cell.value = falso
            celdas++
            distintos.add(clave)
        }

        totalCeldas += celdas
        const colLetter = ws.getColumn(tarea.columna).letter || `C${tarea.columna}`
        detalle.push({
            hoja: tarea.hoja,
            columna: colLetter,
            tipo: TIPOS[tarea.tipo] || tarea.tipo,
            celdas,
            distintos: distintos.size,
        })
    }

    return { celdas: totalCeldas, detalle }
}

// ---------------------------------------------------------------------------
// Generación y Lectura de Libro de Mapa
// ---------------------------------------------------------------------------

export async function generarLibroMapa(gestor: GestorMapa): Promise<Buffer> {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('mapa')

    ws.columns = [
        { header: 'tipo', key: 'tipo', width: 15 },
        { header: 'original', key: 'original', width: 45 },
        { header: 'falso', key: 'falso', width: 35 },
    ]

    // Formato cabecera
    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0284C7' } // Sky-600
    }

    for (const entrada of gestor.entradas()) {
        ws.addRow({
            tipo: entrada.tipo,
            original: entrada.original,
            falso: entrada.falso
        })
    }

    ws.views = [{ state: 'frozen', ySplit: 1 }]
    const buffer = await wb.xlsx.writeBuffer()
    return Buffer.from(buffer)
}

export async function leerLibroMapa(buffer: Buffer): Promise<Array<{ tipo: string; original: string; falso: string }>> {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as any)
    const ws = wb.getWorksheet('mapa') || wb.worksheets[0]
    if (!ws) throw new Error('El archivo de mapa está vacío o no contiene hojas.')

    const entradas: Array<{ tipo: string; original: string; falso: string }> = []
    let filaHeader = 1

    // Comprobar encabezados
    const header = ws.getRow(1)
    const h1 = aTexto(header.getCell(1).value).toLowerCase()
    const h2 = aTexto(header.getCell(2).value).toLowerCase()
    const h3 = aTexto(header.getCell(3).value).toLowerCase()

    if (h1 !== 'tipo' || h2 !== 'original' || h3 !== 'falso') {
        throw new Error('El archivo no tiene las columnas esperadas: "tipo", "original", "falso".')
    }

    ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const tipo = aTexto(row.getCell(1).value)
        const original = aTexto(row.getCell(2).value)
        const falso = aTexto(row.getCell(3).value)
        if (tipo && original && falso) {
            entradas.push({ tipo, original, falso })
        }
    })

    return entradas
}
