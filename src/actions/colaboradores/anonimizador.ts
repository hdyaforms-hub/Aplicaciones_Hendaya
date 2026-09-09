'use server'

import ExcelJS from 'exceljs'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import {
    detectarFilaEncabezado,
    leerEncabezados,
    muestraColumna,
    sugerirTipo,
    resolverColumnas,
    validarColumna,
    GestorMapa,
    anonimizarLibro,
    generarLibroMapa,
    leerLibroMapa,
    aTexto,
    TIPOS,
    TareaAnonimizacion,
    Resolucion
} from '@/lib/anonimizador/engine'

const MAX_FILAS_MUESTRA = 250

/**
 * Analiza la estructura inicial de un archivo Excel cargado.
 */
export async function analizarEstructuraExcel(formData: FormData) {
    try {
        const session = await getSession()
        if (!session) {
            return { success: false, error: 'No autorizado. Inicie sesión.' }
        }

        const file = formData.get('file') as File | null
        if (!file) {
            return { success: false, error: 'No se recibió ningún archivo.' }
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(buffer as any)

        const hojas: string[] = []
        const estructura: Record<string, {
            filaEncabezado: number
            columnas: Array<{ col: number; letra: string; nombre: string; ejemplo: string }>
            totalFilas: number
            nFilasDatos: number
        }> = {}

        wb.eachSheet(ws => {
            hojas.push(ws.name)
            const filaEnc = detectarFilaEncabezado(ws)
            const encabezados = leerEncabezados(ws, filaEnc)
            const columnas = encabezados.map(e => {
                const colLetter = ws.getColumn(e.col).letter || `C${e.col}`
                const muestra = muestraColumna(ws, e.col, filaEnc + 1, 15)
                return {
                    col: e.col,
                    letra: colLetter,
                    nombre: e.nombre,
                    ejemplo: muestra[0] || ''
                }
            })

            const totalFilas = ws.rowCount || filaEnc
            estructura[ws.name] = {
                filaEncabezado: filaEnc,
                columnas,
                totalFilas,
                nFilasDatos: Math.max(0, totalFilas - filaEnc)
            }
        })

        if (hojas.length === 0) {
            return { success: false, error: 'La planilla no contiene hojas válidas.' }
        }

        const hojaBase = hojas[0]
        const filaEncBase = estructura[hojaBase].filaEncabezado

        // Generar vista previa de 6 filas de la hoja base
        const wsBase = wb.getWorksheet(hojaBase)!
        const encsBase = leerEncabezados(wsBase, filaEncBase).slice(0, 15)
        const previewRows: string[][] = []

        for (let r = filaEncBase + 1; r <= Math.min(filaEncBase + 6, wsBase.rowCount || filaEncBase); r++) {
            const rowData: string[] = []
            for (const col of encsBase) {
                rowData.push(aTexto(wsBase.getRow(r).getCell(col.col).value))
            }
            previewRows.push(rowData)
        }

        // Sugerencias iniciales de columnas a anonimizar
        const decisionesIniciales: Record<number, { anonimizar: boolean; tipo: string }> = {}
        for (const c of estructura[hojaBase].columnas) {
            const tipoSugerido = sugerirTipo(c.nombre)
            const esPersonal = tipoSugerido !== null && tipoSugerido !== 'empresa'
            decisionesIniciales[c.col] = {
                anonimizar: Boolean(esPersonal),
                tipo: tipoSugerido || 'texto'
            }
        }

        return {
            success: true,
            nombreArchivo: file.name,
            hojas,
            estructura,
            preview: {
                headers: encsBase.map(e => `${wsBase.getColumn(e.col).letter || 'C'} - ${e.nombre}`),
                rows: previewRows
            },
            decisionesIniciales
        }
    } catch (error: any) {
        console.error('Error al analizar estructura Excel:', error)
        return { success: false, error: error.message || 'Error al procesar la planilla.' }
    }
}

/**
 * Obtiene la previsualización de una hoja específica si el usuario cambia de hoja o de fila de encabezado.
 */
export async function refrescarVistaPrevia(formData: FormData) {
    try {
        const session = await getSession()
        if (!session) return { success: false, error: 'No autorizado.' }

        const file = formData.get('file') as File | null
        const hoja = formData.get('hoja') as string
        const filaEnc = parseInt(formData.get('filaEnc') as string || '1', 10)

        if (!file || !hoja) return { success: false, error: 'Datos insuficientes.' }

        const buffer = Buffer.from(await file.arrayBuffer())
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(buffer as any)

        const ws = wb.getWorksheet(hoja)
        if (!ws) return { success: false, error: 'Hoja no encontrada.' }

        const encabezados = leerEncabezados(ws, filaEnc)
        const columnas = encabezados.map(e => {
            const colLetter = ws.getColumn(e.col).letter || `C${e.col}`
            const muestra = muestraColumna(ws, e.col, filaEnc + 1, 15)
            return {
                col: e.col,
                letra: colLetter,
                nombre: e.nombre,
                ejemplo: muestra[0] || ''
            }
        })

        const encsSubset = encabezados.slice(0, 15)
        const previewRows: string[][] = []

        for (let r = filaEnc + 1; r <= Math.min(filaEnc + 6, ws.rowCount || filaEnc); r++) {
            const rowData: string[] = []
            for (const col of encsSubset) {
                rowData.push(aTexto(ws.getRow(r).getCell(col.col).value))
            }
            previewRows.push(rowData)
        }

        return {
            success: true,
            columnas,
            preview: {
                headers: encsSubset.map(e => `${ws.getColumn(e.col).letter || 'C'} - ${e.nombre}`),
                rows: previewRows
            }
        }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Empareja las columnas seleccionadas entre múltiples hojas por nombre de encabezado.
 */
export async function resolverColumnasMultioja(formData: FormData) {
    try {
        const session = await getSession()
        if (!session) return { success: false, error: 'No autorizado.' }

        const file = formData.get('file') as File | null
        const hojaBase = formData.get('hojaBase') as string
        const seleccionRaw = formData.get('seleccion') as string // JSON Record<number, string>
        const filasEncRaw = formData.get('filasEnc') as string // JSON Record<string, number>

        if (!file || !hojaBase || !seleccionRaw) {
            return { success: false, error: 'Faltan parámetros de resolución.' }
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(buffer as any)

        const seleccion: Record<number, string> = JSON.parse(seleccionRaw)
        const filasEnc: Record<string, number> = JSON.parse(filasEncRaw || '{}')

        const resoluciones = resolverColumnas(wb, hojaBase, seleccion, filasEnc)
        return { success: true, resoluciones }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Realiza el diagnóstico y contraste del contenido de las columnas contra el tipo asignado.
 */
export async function validarColumnasSeleccionadas(formData: FormData) {
    try {
        const session = await getSession()
        if (!session) return { success: false, error: 'No autorizado.' }

        const file = formData.get('file') as File | null
        const hojaBase = formData.get('hojaBase') as string
        const filaEncBase = parseInt(formData.get('filaEncBase') as string || '1', 10)
        const seleccionRaw = formData.get('seleccion') as string // JSON Record<number, string>
        const resolucionesRaw = formData.get('resoluciones') as string // JSON Record<string, Resolucion[]>

        if (!file || !hojaBase || !seleccionRaw) {
            return { success: false, error: 'Faltan parámetros de validación.' }
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(buffer as any)

        const seleccion: Record<number, string> = JSON.parse(seleccionRaw)
        const resoluciones: Record<string, Resolucion[]> = resolucionesRaw ? JSON.parse(resolucionesRaw) : {}

        const wsBase = wb.getWorksheet(hojaBase)!
        const diagnosticos: Array<{
            hoja: string
            colLetra: string
            nombre: string
            tipo: string
            severidad: 'ok' | 'nota' | 'alerta'
            mensaje: string | null
            revisados: number
        }> = []

        // Validar columnas en la hoja base
        for (const [colStr, tipo] of Object.entries(seleccion)) {
            const col = parseInt(colStr, 10)
            const colLetra = wsBase.getColumn(col).letter || `C${col}`
            const nombre = aTexto(wsBase.getRow(filaEncBase).getCell(col).value)
            const muestra = muestraColumna(wsBase, col, filaEncBase + 1, MAX_FILAS_MUESTRA)
            const diag = validarColumna(muestra, tipo)

            diagnosticos.push({
                hoja: hojaBase,
                colLetra,
                nombre,
                tipo: TIPOS[tipo] || tipo,
                severidad: diag.severidad,
                mensaje: diag.mensaje,
                revisados: diag.revisados
            })
        }

        // Validar columnas emparejadas en las demás hojas
        for (const [hoja, resList] of Object.entries(resoluciones)) {
            const wsH = wb.getWorksheet(hoja)
            if (!wsH) continue

            for (const res of resList) {
                if (res.colDestino === null) continue
                const colLetra = wsH.getColumn(res.colDestino).letter || `C${res.colDestino}`
                const muestra = muestraColumna(wsH, res.colDestino, 2, MAX_FILAS_MUESTRA)
                const diag = validarColumna(muestra, res.tipo)

                diagnosticos.push({
                    hoja,
                    colLetra,
                    nombre: res.encabezado,
                    tipo: TIPOS[res.tipo] || res.tipo,
                    severidad: diag.severidad,
                    mensaje: diag.mensaje,
                    revisados: diag.revisados
                })
            }
        }

        const hayAlertas = diagnosticos.some(d => d.severidad === 'alerta')

        return { success: true, diagnosticos, hayAlertas }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Carga un mapa de equivalencias previo desde un archivo Excel.
 */
export async function cargarMapaPrevioAction(formData: FormData) {
    try {
        const session = await getSession()
        if (!session) return { success: false, error: 'No autorizado.' }

        const file = formData.get('file') as File | null
        if (!file) return { success: false, error: 'No se recibió el mapa previo.' }

        const buffer = Buffer.from(await file.arrayBuffer())
        const entradas = await leerLibroMapa(buffer)

        return {
            success: true,
            totalCargadas: entradas.length,
            entradas
        }
    } catch (error: any) {
        return { success: false, error: error.message || 'Error al procesar el mapa previo.' }
    }
}

/**
 * Ejecuta la anonimización integral de la planilla Excel, genera los libros de salida
 * y registra la auditoría del proceso.
 */
export async function ejecutarAnonimizacionAction(formData: FormData) {
    try {
        const session = await getSession()
        if (!session) {
            return { success: false, error: 'No autorizado.' }
        }

        const file = formData.get('file') as File | null
        const hojaBase = formData.get('hojaBase') as string
        const filaEncBase = parseInt(formData.get('filaEncBase') as string || '1', 10)
        const seleccionRaw = formData.get('seleccion') as string // Record<number, string>
        const resolucionesRaw = formData.get('resoluciones') as string // Record<string, Resolucion[]>
        const formatoRut = (formData.get('formatoRut') as string || 'imitar') as 'imitar' | 'uniforme'
        const mapaPrevioRaw = formData.get('mapaPrevio') as string // JSON Array de entradas previas opcional

        if (!file || !hojaBase || !seleccionRaw) {
            return { success: false, error: 'Parámetros incompletos para anonimizar.' }
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(buffer as any)

        const seleccion: Record<number, string> = JSON.parse(seleccionRaw)
        const resoluciones: Record<string, Resolucion[]> = resolucionesRaw ? JSON.parse(resolucionesRaw) : {}

        const gestor = new GestorMapa()

        // Cargar mapa previo si fue provisto
        if (mapaPrevioRaw) {
            try {
                const entradasPrevias = JSON.parse(mapaPrevioRaw)
                if (Array.isArray(entradasPrevias)) {
                    gestor.cargar(entradasPrevias)
                }
            } catch (e) {
                console.warn('Advertencia al cargar mapa previo JSON:', e)
            }
        }

        // Armar lista de tareas
        const tareas: TareaAnonimizacion[] = []

        // Tareas hoja base
        for (const [colStr, tipo] of Object.entries(seleccion)) {
            tareas.push({
                hoja: hojaBase,
                columna: parseInt(colStr, 10),
                tipo,
                filaInicio: filaEncBase + 1
            })
        }

        // Tareas hojas emparejadas
        for (const [hoja, resList] of Object.entries(resoluciones)) {
            for (const res of resList) {
                if (res.colDestino === null) continue
                tareas.push({
                    hoja,
                    columna: res.colDestino,
                    tipo: res.tipo,
                    filaInicio: 2 // fila de inicio por defecto
                })
            }
        }

        // Anonimizar libro in situ preservando estilos, formatos y anchos
        const resumen = anonimizarLibro(wb, tareas, gestor, formatoRut)

        // Generar archivo Excel resultante
        const salidaBuffer = Buffer.from(await wb.xlsx.writeBuffer())
        const baseNombre = file.name.replace(/\.[^/.]+$/, '')
        const fechaSello = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
        const nombreSalida = `${baseNombre} ANONIMIZADO.xlsx`

        // Generar libro de mapa de equivalencias
        const mapaBuffer = await generarLibroMapa(gestor)
        const nombreMapa = `${baseNombre} MAPA ${fechaSello}.xlsx`

        // Registrar en tabla de Auditoría
        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'ANONIMIZAR_PLANILLA',
            modulo: 'Colaboradores -> Anonimizador',
            detalle: `Anonimizó planilla "${file.name}": ${resumen.celdas} celdas reemplazadas en ${resumen.detalle.length} columnas. (${gestor.total} valores totales en mapa, ${gestor.nuevos} nuevos).`
        })

        return {
            success: true,
            resumen,
            archivoAnonimizadoBase64: salidaBuffer.toString('base64'),
            mapaBase64: mapaBuffer.toString('base64'),
            nombreSalida,
            nombreMapa,
            metricasMapa: {
                total: gestor.total,
                nuevos: gestor.nuevos,
                porTipo: gestor.resumenPorTipo()
            }
        }
    } catch (error: any) {
        console.error('Error al ejecutar anonimización:', error)
        return { success: false, error: error.message || 'Fallo interno al anonimizar la planilla.' }
    }
}
