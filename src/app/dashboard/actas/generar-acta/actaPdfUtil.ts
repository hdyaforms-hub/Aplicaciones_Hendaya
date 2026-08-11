import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function computeTotalizerValue(
    campo: any,
    campos: any[],
    respuestasData: Record<string, any>
): { rawValue: number; formatted: string } {
    const targetIds = campo.targetFields && campo.targetFields.length > 0
        ? campo.targetFields
        : null

    let values: number[] = []
    let totalObtained = 0
    let totalMaxPossible = 0

    const processNumValue = (v: any, options?: any[]) => {
        let numVal = NaN
        let maxVal = 0

        if (options && options.length > 0) {
            let selectedOpt: any = null
            if (typeof v === 'object' && v !== null) {
                selectedOpt = options.find((o: any) =>
                    String(o.value) === String(v.value) || String(o.label) === String(v.label) || String(o.label) === String(v.value)
                ) || v
            } else if (v !== undefined && v !== null && String(v).trim() !== '') {
                const strV = String(v).trim()
                selectedOpt = options.find((o: any) =>
                    String(o.value).toLowerCase() === strV.toLowerCase() || String(o.label).toLowerCase() === strV.toLowerCase()
                )
                if (!selectedOpt) numVal = parseFloat(strV)
            }

            if (selectedOpt) {
                numVal = parseFloat(selectedOpt.value !== undefined ? selectedOpt.value : selectedOpt.label)
            }

            maxVal = options.reduce((max: number, opt: any) => {
                const nv = parseFloat(opt.value)
                return !isNaN(nv) ? Math.max(max, nv) : max
            }, 0)
        } else {
            numVal = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''))
            maxVal = numVal
        }

        if (!isNaN(numVal)) {
            values.push(numVal)
            totalObtained += numVal
            totalMaxPossible += maxVal
        }
    }

    // 1. Procesar campos independientes
    campos.forEach((c: any) => {
        if ((c.type === 'numeric_special' || c.type === 'number') && (!targetIds || targetIds.includes(c.id))) {
            const v = respuestasData[c.id]
            const opts = c.type === 'numeric_special'
                ? (c.numericOptions && c.numericOptions.length > 0 ? c.numericOptions : parseNumericSpecialColOptions([]))
                : undefined
            processNumValue(v, opts)
        } else if (c.type === 'audit_item' && (!targetIds || targetIds.includes(c.id))) {
            // 2. Procesar columnas de Requisito de Acta
            const rowCols = c.auditColumns && c.auditColumns.length > 0
                ? c.auditColumns
                : [
                    { key: 'col_req', label: 'REQUISITO', type: 'text' },
                    { key: 'col_est', label: 'ESTADO', type: 'select' },
                    { key: 'col_obs', label: 'OBSERVACIÓN', type: 'text' },
                    { key: 'col_acc', label: 'ACCIÓN CORRECTIVA', type: 'text' }
                ]

            const itemVal = respuestasData[c.id] || {}

            rowCols.forEach((col: any, ci: number) => {
                const colLabel = (col.label || '').toLowerCase()
                const isSummaryCol = col.type === 'totalizer' || col.type === 'number' ||
                    colLabel.includes('promedio') || colLabel.includes('estándar') ||
                    colLabel.includes('estandar') || colLabel.includes('cumplimiento')

                if (col.type === 'number_special' && col.includeInTotalizer !== false && !isSummaryCol) {
                    let v = itemVal[col.key]
                    if (v === undefined && ci === 1) {
                        v = typeof itemVal === 'object' ? itemVal.estado : itemVal
                    }
                    const opts = parseNumericSpecialColOptions(col.options)
                    processNumValue(v, opts)
                }
            })
        }
    })

    if (values.length === 0) {
        return { rawValue: 0, formatted: campo.operation === 'percentage' ? '0.00%' : '0.00' }
    }

    const op = campo.operation || 'percentage'
    let result = 0

    if (op === 'percentage') {
        result = totalMaxPossible > 0 ? (totalObtained / totalMaxPossible) * 100 : 0
        return { rawValue: result, formatted: `${result.toFixed(2)}%` }
    } else if (op === 'sum') {
        result = values.reduce((acc, v) => acc + v, 0)
    } else if (op === 'average') {
        result = values.length > 0 ? values.reduce((acc, v) => acc + v, 0) / values.length : 0
    } else if (op === 'subtract') {
        result = values.length > 0 ? values.reduce((acc, v, i) => i === 0 ? v : acc - v, 0) : 0
    } else if (op === 'multiply') {
        result = values.length > 0 ? values.reduce((acc, v) => acc * v, 1) : 0
    } else if (op === 'divide') {
        result = values.length > 0 ? values.reduce((acc, v, i) => i === 0 ? v : (v !== 0 ? acc / v : 0), 0) : 0
    }

    return { rawValue: result, formatted: result.toFixed(2) }
}

function parseNumericSpecialColOptions(options?: string[]) {
    const raw = options && options.length > 0
        ? options
        : ['Cumple = 2', 'Cumple Parcial = 1', 'No cumple = 0', 'No evaluado = NE', 'No aplica = NA']
    return raw.map((optStr: string) => {
        const parts = optStr.split('=')
        if (parts.length > 1) {
            return { label: parts[0].trim(), value: parts[1].trim() }
        }
        return { label: optStr.trim(), value: optStr.trim() }
    }).filter((o: any) => o.label)
}

function computeAuditRowTotalizer(rowCols: any[], getColValueFn: (colKey: string, colIndex: number) => any, operation?: string, totalizerCol?: any) {
    const op = operation || totalizerCol?.operation || 'sum'

    const numKey = totalizerCol?.numeratorColKey
    const denKey = totalizerCol?.denominatorColKey

    const extractColNum = (c: any, raw: any): number => {
        if (!c || c.key === totalizerCol?.key) return 0

        if (c.type === 'totalizer') {
            const subTot = computeAuditRowTotalizer(rowCols, getColValueFn, c.operation || 'sum', c)
            return parseFloat(String(subTot ?? '').replace(/[^0-9.-]/g, '')) || 0
        }

        if (c.type === 'number_special') {
            const numOpts = parseNumericSpecialColOptions(c.options)
            let selectedOpt: any = null
            if (typeof raw === 'object' && raw !== null) {
                selectedOpt = numOpts.find((o: any) =>
                    String(o.value) === String(raw.value) || String(o.label) === String(raw.label) || String(o.label) === String(raw.value)
                ) || raw
            } else if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
                const strV = String(raw).trim()
                selectedOpt = numOpts.find((o: any) =>
                    String(o.value).toLowerCase() === strV.toLowerCase() || String(o.label).toLowerCase() === strV.toLowerCase()
                )
            }
            if (selectedOpt) {
                return parseFloat(selectedOpt.value !== undefined ? selectedOpt.value : selectedOpt.label) || 0
            }
        }
        return parseFloat(String(raw ?? '').replace(/[^0-9.-]/g, '')) || 0
    }

    // Buscar columna Numerador (por clave o etiqueta "PROMEDIO"/"OBTENIDO")
    let numCol = rowCols.find((col: any) => col.key === numKey)
    if (!numCol) {
        numCol = rowCols.find((col: any) => {
            const lbl = (col.label || '').toLowerCase()
            return (lbl.includes('promedio') || lbl.includes('obtenido') || lbl.includes('puntaje')) && col.key !== totalizerCol?.key
        })
    }

    // Buscar columna Denominador (por clave o etiqueta "ESTÁNDAR"/"MANUAL"/"MÁXIMO")
    let denCol = rowCols.find((col: any) => col.key === denKey)
    if (!denCol) {
        denCol = rowCols.find((col: any) => {
            const lbl = (col.label || '').toLowerCase()
            return (lbl.includes('estándar') || lbl.includes('estandar') || lbl.includes('manual') || lbl.includes('máximo') || lbl.includes('maximo') || lbl.includes('esperado')) && col.key !== numCol?.key && col.key !== totalizerCol?.key
        })
    }

    // Solo usar la lógica de numCol/denCol si:
    // 1. Se configuraron claves explícitas (numeratorColKey/denominatorColKey), O
    // 2. La operación es 'percentage' Y se encontraron AMBAS columnas por etiqueta
    const useNumDenPath = (numKey || denKey) || (op === 'percentage' && numCol && denCol)

    if (useNumDenPath && (numCol || denCol)) {
        const numVal = extractColNum(numCol, numCol ? getColValueFn(numCol.key, 0) : 0)
        const denVal = extractColNum(denCol, denCol ? getColValueFn(denCol.key, 0) : 0)

        if (op === 'percentage') {
            if (denVal <= 0 && numVal <= 0) return '0.00%'
            let pct = denVal > 0 ? (numVal / denVal) * 100 : 0
            if (totalizerCol?.capAt100 === true && pct > 100) {
                pct = 100
            }
            return `${pct.toFixed(2)}%`
        } else if (op === 'divide') {
            const res = denVal !== 0 ? numVal / denVal : 0
            return res.toFixed(2)
        } else if (op === 'subtract') {
            const res = numVal - denVal
            return res.toFixed(2)
        } else if (op === 'multiply') {
            const res = numVal * denVal
            return res.toFixed(2)
        } else if (op === 'average') {
            const res = (numVal + denVal) / 2
            return res.toFixed(2)
        } else {
            const res = numVal + denVal
            return res % 1 === 0 ? String(res) : res.toFixed(2)
        }
    }

    // En el fallback genérico, excluir columnas de resumen (ESTÁNDAR, PROMEDIO, CUMPLIMIENTO) y totalizers
    const validCols = rowCols.filter((c: any) => {
        if (c.key === totalizerCol?.key) return false
        if (c.type === 'totalizer') return false
        if (c.includeInTotalizer === false) return false
        const lbl = (c.label || '').toLowerCase()
        if (lbl.includes('estándar') || lbl.includes('estandar') || lbl.includes('cumplimiento')) return false
        return c.type === 'number' || c.type === 'number_special'
    })
    if (validCols.length === 0) return op === 'percentage' ? '0.00%' : '0.00'

    let values: number[] = []
    let totalObtained = 0
    let totalMaxPossible = 0

    validCols.forEach((c: any) => {
        const v = getColValueFn(c.key, 0)
        let numVal = NaN
        let maxVal = 0

        if (c.type === 'number_special') {
            const numOpts = parseNumericSpecialColOptions(c.options)
            let selectedOpt: any = null

            if (typeof v === 'object' && v !== null) {
                selectedOpt = numOpts.find((o: any) =>
                    String(o.value) === String(v.value) || String(o.label) === String(v.label) || String(o.label) === String(v.value)
                ) || v
            } else if (v !== undefined && v !== null && String(v).trim() !== '') {
                const strV = String(v).trim()
                selectedOpt = numOpts.find((o: any) =>
                    String(o.value).toLowerCase() === strV.toLowerCase() || String(o.label).toLowerCase() === strV.toLowerCase()
                )
                if (!selectedOpt) {
                    numVal = parseFloat(strV)
                }
            }

            if (selectedOpt) {
                numVal = parseFloat(selectedOpt.value !== undefined ? selectedOpt.value : selectedOpt.label)
            }

            maxVal = numOpts.reduce((max: number, opt: any) => {
                const nv = parseFloat(opt.value)
                return !isNaN(nv) ? Math.max(max, nv) : max
            }, 0)
        } else {
            numVal = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''))
            maxVal = numVal
        }

        if (!isNaN(numVal)) {
            values.push(numVal)
            totalObtained += numVal
            totalMaxPossible += maxVal
        }
    })

    if (op === 'average') {
        const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
        return avg.toFixed(2)
    } else if (op === 'percentage') {
        let pct = totalMaxPossible > 0 ? (totalObtained / totalMaxPossible) * 100 : 0
        if (totalizerCol?.capAt100 === true && pct > 100) {
            pct = 100
        }
        return `${pct.toFixed(2)}%`
    } else if (op === 'subtract') {
        const sub = values.length > 0 ? values.reduce((a, b, i) => i === 0 ? b : a - b, 0) : 0
        return sub.toFixed(2)
    } else if (op === 'multiply') {
        const mult = values.length > 0 ? values.reduce((a, b) => a * b, 1) : 0
        return mult.toFixed(2)
    } else if (op === 'divide') {
        const div = values.length > 0 ? values.reduce((a, b, i) => i === 0 ? b : (b !== 0 ? a / b : 0), 0) : 0
        return div.toFixed(2)
    } else {
        const sum = values.reduce((a, b) => a + b, 0)
        return sum % 1 === 0 ? String(sum) : sum.toFixed(2)
    }
}

export function generateActaPDF(
    initialActa: any,
    plantilla: any,
    respuestasData: Record<string, any>
): jsPDF {
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    })

    const pageWidth = doc.internal.pageSize.getWidth() // 210mm
    let y = 12

    // -------------------------------------------------------------
    // 1. ENCABEZADO CORPORATIVO EJECUTIVO (IMAGEN 1 & IMAGEN 2)
    // - Logo HENDAYA se renderiza según la configuración del formulario (plantilla.logoUrl !== 'false')
    // - Título centrado horizontalmente con la frase/instrucción exacta de la Creación del Acta
    // - Recuadro de Código, Versión y Fecha apegado completamente a la derecha
    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // 1. ENCABEZADO CORPORATIVO EJECUTIVO (RESPONSIVO Y SIN COLISIONES)
    // -------------------------------------------------------------
    const navyColor: [number, number, number] = [24, 43, 73] // Azul Marino Ejecutivo Formal
    const rightBoxBg: [number, number, number] = [34, 56, 90]

    const showLogo = plantilla?.logoUrl !== 'false'

    // Metadata del Recuadro Derecho
    const lines: string[] = []

    if (plantilla?.mostrarCodigoVersionFecha !== false) {
        lines.push(`Código: ${plantilla?.codigo || 'N/A'}`)
        lines.push(`Versión: ${plantilla?.version || '1.0'}`)
        lines.push(`Fecha: ${plantilla?.fecha || 'N/A'}`)
    }

    if (plantilla?.mostrarCodigoAdicional && plantilla?.codigoAdicional) {
        lines.push(plantilla.codigoAdicional)
    }

    if (plantilla?.correlativoAutomatico) {
        const rawCorr = initialActa?.correlativo
        const corrNum = typeof rawCorr === 'number' ? rawCorr : (parseInt(String(rawCorr || '1'), 10) || 1)
        const paddedNum = String(corrNum).padStart(10, '0')
        lines.push(`N° ${paddedNum}`)
    }

    const rightBoxWidth = lines.length > 0 ? 55 : 0
    const rightBoxX = (pageWidth - 12) - rightBoxWidth

    // Cálculo del área disponible para el título y descripción (entre Logo y Recuadro Derecho)
    const titleAreaLeft = showLogo ? 44 : 14
    const titleAreaRight = lines.length > 0 ? (rightBoxX - 4) : (pageWidth - 14)
    const titleCenterX = (titleAreaLeft + titleAreaRight) / 2
    const maxTitleWidth = Math.max(30, (titleAreaRight - titleAreaLeft) - 2)

    // Título y Descripción divididos con splitTextToSize para ajustarse exacto
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    const tituloTexto = (plantilla?.nombre || 'ACTA DE SUPERVISIÓN').toUpperCase()
    const titleLines: string[] = doc.splitTextToSize(tituloTexto, maxTitleWidth)

    const descripcionTexto = plantilla?.instrucciones || 'Procedimiento: revisión de cada ítem mencionado en listado. Frecuencia: Mensual.'
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    const descLines: string[] = doc.splitTextToSize(descripcionTexto, maxTitleWidth)

    // Altura dinámica del encabezado
    const titleBlockHeight = (titleLines.length * 4.2) + (descLines.length * 3.2)
    const headerHeight = Math.max(30, titleBlockHeight + 10)

    // Fondo principal del encabezado (de x=10 a x=200)
    doc.setFillColor(...navyColor)
    doc.rect(10, y, pageWidth - 20, headerHeight, 'F')

    // 1. Logo HENDAYA (Centrado verticalmente a la izquierda)
    if (showLogo) {
        doc.setTextColor(34, 211, 238) // Cyan 400 corporativo brillante
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.text('HENDAYA', 14, y + (headerHeight / 2) + 1.5)
    }

    // 2. Recuadro Derecho de Metadata (Centrado verticalmente a la derecha)
    if (lines.length > 0) {
        const lineSpacing = 4.2
        const computedHeight = (lines.length * lineSpacing) + 3
        const rightBoxHeight = Math.min(headerHeight - 4, Math.max(24, computedHeight))
        const rightBoxY = y + ((headerHeight - rightBoxHeight) / 2)

        doc.setFillColor(...rightBoxBg)
        doc.roundedRect(rightBoxX, rightBoxY, rightBoxWidth, rightBoxHeight, 1.5, 1.5, 'F')

        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(255, 255, 255)

        lines.forEach((line, index) => {
            doc.text(line, rightBoxX + 4, rightBoxY + 4.5 + (index * lineSpacing))
        })
    }

    // 3. Título y Descripción centrados en su espacio asignado
    let startYText = y + 7.5
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)

    titleLines.forEach(tLine => {
        doc.text(tLine, titleCenterX, startYText, { align: 'center' })
        startYText += 4.2
    })

    if (descLines.length > 0) {
        startYText += 1
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(203, 213, 225) // slate-300

        descLines.forEach(dLine => {
            doc.text(dLine, titleCenterX, startYText, { align: 'center' })
            startYText += 3.2
        })
    }

    y += headerHeight + 6

    // -------------------------------------------------------------
    // 2. INFORMACIÓN INSTITUCIONAL (IMAGEN 2)
    // -------------------------------------------------------------
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...navyColor)
    doc.text('INFORMACIÓN INSTITUCIONAL', 12, y)
    y += 3

    const fechaLlenado = initialActa.createdAt
        ? new Date(initialActa.createdAt).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    const instData = [
        [
            { content: 'RBD:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            String(initialActa.rbd || ''),
            { content: 'ESTABLECIMIENTO:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            String(initialActa.nombreEstablecimiento || '')
        ],
        [
            { content: 'DIRECCIÓN:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            String(initialActa.direccion || ''),
            { content: 'CIUDAD:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            String(initialActa.ciudad || '')
        ],
        [
            { content: 'INSTITUCIÓN:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            String(initialActa.institucion || ''),
            { content: 'SUCURSAL:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            String(initialActa.sucursal || '')
        ],
        [
            { content: 'SUPERVISOR (NOMBRE):', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            String(initialActa.supervisorNombre || ''),
            { content: 'SUPERVISOR (RUT):', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            String(initialActa.supervisorRut || '')
        ],
        [
            { content: 'FECHA CREACIÓN/LLENADO:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            fechaLlenado,
            { content: 'ESTADO ACTA:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            String(initialActa.estado || 'Borrador')
        ]
    ]

    autoTable(doc, {
        startY: y,
        head: [],
        body: instData as any,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59] },
        columnStyles: {
            0: { cellWidth: 42 },
            1: { cellWidth: 53 },
            2: { cellWidth: 42 },
            3: { cellWidth: 53 }
        },
        margin: { left: 10, right: 10 }
    })

    y = (doc as any).lastAutoTable.finalY + 8

    // Parse campos
    let campos: any[] = []
    try {
        campos = typeof plantilla?.campos === 'string' ? JSON.parse(plantilla.campos) : (plantilla?.campos || [])
    } catch {
        campos = []
    }

    // -------------------------------------------------------------
    // 3. TABLA DE REQUISITOS EJECUTIVA Y FORMAL
    // - Encabezado Azul Marino Ejecutivo
    // - Columna GRUPO en Azul Grisáceo elegante con texto Blanco
    // - Sin espacios en blanco y con continuidad en cada página
    // -------------------------------------------------------------
    const segments: any[] = []
    let currentSeg: any = { type: 'normal', fields: [] }

    campos.forEach((f: any) => {
        if (f.type === 'audit_item' || f.type === 'group') {
            if (currentSeg.type !== 'audit-table') {
                if (currentSeg.fields.length > 0) segments.push(currentSeg)
                currentSeg = { type: 'audit-table', fields: [f] }
            } else {
                currentSeg.fields.push(f)
            }
        } else if (f.type === 'dynamic_table') {
            // Cada dynamic_table es su propio segmento
            if (currentSeg.fields.length > 0) segments.push(currentSeg)
            segments.push({ type: 'dynamic-table', field: f })
            currentSeg = { type: 'normal', fields: [] }
        } else {
            if (currentSeg.type === 'audit-table') {
                segments.push(currentSeg)
                currentSeg = { type: 'normal', fields: [f] }
            } else {
                currentSeg.fields.push(f)
            }
        }
    })
    if (currentSeg.fields.length > 0) segments.push(currentSeg)

    let currentGroupLabel = 'SUPERVISIÓN'

    segments.forEach((seg, index) => {
        if (y > 270) {
            doc.addPage()
            y = 15
        }

        if (seg.type === 'normal') {
            const normalFields = seg.fields.filter((f: any) => f.type !== 'signature' && f.type !== 'signature_with_data')
            let pendingRow: any[] = []
            let pendingWidth = 0

            const flushRow = () => {
                if (pendingRow.length === 0) return
                if (y > 260) { doc.addPage(); y = 15; }

                const rowHead = [pendingRow.map((f) => f.label || '')]
                const rowBody = [pendingRow.map(f => {
                    if (f.type === 'totalizer') {
                        const calc = computeTotalizerValue(f, campos, respuestasData)
                        return calc.formatted
                    }
                    const val = respuestasData[f.id]
                    if (f.type === 'numeric_special' && typeof val === 'object' && val !== null) {
                        return `${val.label || ''} (${val.value ?? ''})`
                    }
                    if (Array.isArray(val)) return val.join(', ')
                    if (typeof val === 'object' && val !== null) return (val.label || JSON.stringify(val))
                    return String(val ?? '')
                })]

                const colStyles: any = {}
                const printableWidth = pageWidth - 20 // 190mm
                pendingRow.forEach((rf, i) => {
                    const frac = rf.layoutWidth === '50%' ? 0.5 : rf.layoutWidth === '33%' ? 0.33333 : rf.layoutWidth === '25%' ? 0.25 : (1 / pendingRow.length)
                    colStyles[i] = { cellWidth: printableWidth * (frac / (pendingWidth || 1)) }
                })

                autoTable(doc, {
                    startY: y,
                    head: rowHead,
                    body: rowBody,
                    theme: 'grid',
                    showHead: 'firstPage',
                    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold', fontSize: 8 },
                    styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
                    columnStyles: colStyles,
                    margin: { left: 10, right: 10 }
                })
                y = (doc as any).lastAutoTable.finalY + 4
                pendingRow = []
                pendingWidth = 0
            }

            normalFields.forEach((f: any) => {
                if (f.type === 'section') {
                    flushRow()
                    y += 4
                    if (y > 270) { doc.addPage(); y = 15; }
                    doc.setFont('helvetica', 'bold')
                    doc.setFontSize(10)
                    doc.setTextColor(...navyColor)
                    doc.text((f.label || '').toUpperCase(), 12, y)
                    y += 1
                    doc.setDrawColor(...navyColor)
                    doc.setLineWidth(0.3)
                    doc.line(12, y, pageWidth - 12, y)
                    y += 6
                } else if (f.type === 'separator') {
                    flushRow()
                    y += 2
                    if (y > 270) { doc.addPage(); y = 15; }
                    doc.setDrawColor(226, 232, 240)
                    doc.setLineWidth(0.5)
                    doc.line(12, y, pageWidth - 12, y)
                    y += 6
                } else if (f.type !== 'group' && f.type !== 'audit_item') {
                    const frac = f.layoutWidth === '50%' ? 0.5 : f.layoutWidth === '33%' ? 0.33333 : f.layoutWidth === '25%' ? 0.25 : 1.0
                    if (pendingWidth + frac > 1.01) {
                        flushRow()
                    }
                    pendingRow.push(f)
                    pendingWidth += frac
                }
            })
            flushRow()
        } else if (seg.type === 'audit-table') {
            const hasGroups = seg.fields.some((f: any) => f.type === 'group')
            const firstAudit = seg.fields.find((f: any) => f.type === 'audit_item')
            if (!firstAudit) return

            const auditCols = firstAudit.auditColumns && firstAudit.auditColumns.length > 0
                ? firstAudit.auditColumns
                : [
                    { key: 'col_req', label: 'REQUISITO', type: 'text' },
                    { key: 'col_est', label: 'ESTADO', type: 'select' },
                    { key: 'col_obs', label: 'OBSERVACIÓN', type: 'text' },
                    { key: 'col_acc', label: 'ACCIÓN CORRECTIVA', type: 'text' }
                ]

            if (hasGroups) {
                interface GroupBlock {
                    label: string
                    items: any[]
                }
                const groupBlocks: GroupBlock[] = []
                let currentBlock: GroupBlock | null = null

                seg.fields.forEach((campo: any) => {
                    if (campo.type === 'group') {
                        currentBlock = { label: (campo.label || 'GRUPO').toUpperCase(), items: [] }
                        groupBlocks.push(currentBlock)
                    } else if (campo.type === 'audit_item') {
                        if (!currentBlock) {
                            currentBlock = { label: 'GRUPO', items: [] }
                            groupBlocks.push(currentBlock)
                        }
                        currentBlock.items.push(campo)
                    }
                })

                groupBlocks.forEach((block) => {
                    if (block.items.length === 0) return

                    if (y > 245) {
                        doc.addPage()
                        y = 15
                    }

                    const groupAuditCols = block.items[0]?.auditColumns && block.items[0].auditColumns.length > 0
                        ? block.items[0].auditColumns
                        : auditCols

                    const tableHead = [
                        [
                            {
                                content: block.label,
                                colSpan: groupAuditCols.length,
                                styles: {
                                    fillColor: [15, 23, 42],     // Azul Marino Oscuro (#0f172a)
                                    textColor: [56, 189, 248],   // Cyan brillante (#38bdf8)
                                    fontStyle: 'bold',
                                    fontSize: 9,
                                    cellPadding: 3.5,
                                    halign: 'left'
                                }
                            }
                        ],
                        groupAuditCols.map((c: any) => (c.label || '').toUpperCase())
                    ]

                    const tableBody: any[] = []

                    block.items.forEach((item: any) => {
                        const rowCols = item.auditColumns && item.auditColumns.length > 0 ? item.auditColumns : groupAuditCols
                        const val = respuestasData[item.id] || {}

                        const getColValue = (colKey: string, colIndex: number) => {
                            if (val && val[colKey] !== undefined) return val[colKey]
                            if (colIndex === 1) return typeof val === 'object' ? val.estado || 'Cumple' : (val || 'Cumple')
                            if (colIndex === 2) return typeof val === 'object' ? val.observacion || '' : ''
                            if (colIndex === 3) return typeof val === 'object' ? val.accionCorrectiva || '' : ''
                            return ''
                        }

                        const rowData: any[] = []

                        rowCols.forEach((col: any, ci: number) => {
                            if (ci === 0) {
                                const colVal = getColValue(col.key, ci)
                                const displayVal = colVal ? (typeof colVal === 'object' ? colVal.label || colVal.value : String(colVal)) : (item.label || '')
                                rowData.push(displayVal)
                            } else if (col.type === 'totalizer') {
                                const tot = computeAuditRowTotalizer(rowCols, (colKey) => getColValue(colKey, 0), col.operation, col)
                                rowData.push(tot)
                            } else if (col.type === 'number_special') {
                                const cv = getColValue(col.key, ci)
                                if (typeof cv === 'object' && cv !== null) {
                                    rowData.push(`${cv.label || ''} (${cv.value ?? ''})`)
                                } else {
                                    rowData.push(String(cv ?? ''))
                                }
                            } else {
                                rowData.push(getColValue(col.key, ci))
                            }
                        })

                        tableBody.push(rowData)
                    })

                    const colStyles: any = {}
                    const printableWidth = 190
                    const numCols = groupAuditCols.length

                    const isEvalCol = (c: any) =>
                        c.type === 'select' ||
                        c.type === 'number_special' ||
                        c.type === 'number' ||
                        c.type === 'totalizer' ||
                        /^\d+$/.test(c.label || '') ||
                        (c.label || '').toUpperCase().includes('EVALUA') ||
                        (c.label || '').toUpperCase().includes('ESTADO') ||
                        (c.label || '').toUpperCase().includes('CUMPLE')

                    const isTextObsCol = (c: any) =>
                        (c.label || '').toUpperCase().includes('OBSERV') ||
                        (c.label || '').toUpperCase().includes('ACCI') ||
                        (c.label || '').toUpperCase().includes('COMENTA')

                    let numEval = 0
                    let numObs = 0
                    let numOther = 0

                    for (let i = 1; i < groupAuditCols.length; i++) {
                        const c = groupAuditCols[i]
                        if (isTextObsCol(c)) numObs++
                        else if (isEvalCol(c)) numEval++
                        else numOther++
                    }

                    const col0Width = numCols > 10 ? 45 : (numCols > 6 ? 55 : (numCols > 3 ? 65 : 70))
                    colStyles[0] = { cellWidth: col0Width, halign: 'left' }

                    const remainingWidth = printableWidth - col0Width
                    const evalColWidth = numCols > 10 ? 10 : (numCols > 6 ? 16 : 35)
                    const totalEvalWidth = numEval * evalColWidth

                    const totalObsWidth = remainingWidth - totalEvalWidth - (numOther * 30)
                    const obsColWidth = numObs > 0 ? Math.max(30, totalObsWidth / numObs) : 30
                    const otherColWidth = numOther > 0 ? Math.max(25, (remainingWidth - totalEvalWidth - (numObs * obsColWidth)) / numOther) : 25

                    for (let i = 1; i < groupAuditCols.length; i++) {
                        const c = groupAuditCols[i]
                        if (isTextObsCol(c)) {
                            colStyles[i] = { cellWidth: obsColWidth, halign: 'left' }
                        } else if (isEvalCol(c)) {
                            colStyles[i] = { cellWidth: evalColWidth, fontStyle: 'bold', halign: 'center' }
                        } else {
                            colStyles[i] = { cellWidth: otherColWidth, halign: 'left' }
                        }
                    }

                    const dynamicFontSize = numCols > 10 ? 6 : (numCols > 6 ? 7 : 7.5)
                    const dynamicCellPadding = numCols > 10 ? 1.2 : (numCols > 6 ? 1.8 : 2.5)
                    const headFontSize = numCols > 10 ? 6.5 : (numCols > 6 ? 7.5 : 8)

                    autoTable(doc, {
                        startY: y,
                        head: tableHead,
                        body: tableBody,
                        theme: 'grid',
                        showHead: 'firstPage',
                        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: headFontSize, halign: 'left', valign: 'middle' },
                        styles: { fontSize: dynamicFontSize, cellPadding: dynamicCellPadding, textColor: [30, 41, 59], lineWidth: 0.1, lineColor: [203, 213, 225], valign: 'middle' },
                        alternateRowStyles: { fillColor: [248, 250, 252] },
                        columnStyles: colStyles,
                        margin: { left: 10, right: 10 }
                    })

                    y = (doc as any).lastAutoTable.finalY + 6
                })
            } else {
                const tableHead = [[...auditCols.map((c: any) => (c.label || '').toUpperCase())]]
                const tableBody: any[] = []

                seg.fields.forEach((campo: any) => {
                    if (campo.type === 'audit_item') {
                        const rowCols = campo.auditColumns && campo.auditColumns.length > 0 ? campo.auditColumns : auditCols
                        const val = respuestasData[campo.id] || {}

                        const getColValue = (colKey: string, colIndex: number) => {
                            if (val && val[colKey] !== undefined) return val[colKey]
                            if (colIndex === 1) return typeof val === 'object' ? val.estado || 'Cumple' : (val || 'Cumple')
                            if (colIndex === 2) return typeof val === 'object' ? val.observacion || '' : ''
                            if (colIndex === 3) return typeof val === 'object' ? val.accionCorrectiva || '' : ''
                            return ''
                        }

                        const rowData: any[] = []
                        rowCols.forEach((col: any, ci: number) => {
                            if (ci === 0) {
                                const colVal = getColValue(col.key, ci)
                                const displayVal = colVal ? (typeof colVal === 'object' ? colVal.label || colVal.value : String(colVal)) : (campo.label || '')
                                rowData.push(displayVal)
                            } else if (col.type === 'totalizer') {
                                const tot = computeAuditRowTotalizer(rowCols, (colKey) => getColValue(colKey, 0), col.operation, col)
                                rowData.push(tot)
                            } else if (col.type === 'number_special') {
                                const cv = getColValue(col.key, ci)
                                if (typeof cv === 'object' && cv !== null) {
                                    rowData.push(`${cv.label || ''} (${cv.value ?? ''})`)
                                } else {
                                    rowData.push(String(cv ?? ''))
                                }
                            } else {
                                rowData.push(getColValue(col.key, ci))
                            }
                        })
                        tableBody.push(rowData)
                    }
                })

                const colStyles: any = {}
                const printableWidth = 190
                const numCols = auditCols.length

                const isEvalCol = (c: any) =>
                    c.type === 'select' ||
                    c.type === 'number_special' ||
                    c.type === 'number' ||
                    c.type === 'totalizer' ||
                    /^\d+$/.test(c.label || '') ||
                    (c.label || '').toUpperCase().includes('EVALUA') ||
                    (c.label || '').toUpperCase().includes('ESTADO') ||
                    (c.label || '').toUpperCase().includes('CUMPLE')

                const isTextObsCol = (c: any) =>
                    (c.label || '').toUpperCase().includes('OBSERV') ||
                    (c.label || '').toUpperCase().includes('ACCI') ||
                    (c.label || '').toUpperCase().includes('COMENTA')

                let numEval = 0
                let numObs = 0
                let numOther = 0

                for (let i = 1; i < auditCols.length; i++) {
                    const c = auditCols[i]
                    if (isTextObsCol(c)) numObs++
                    else if (isEvalCol(c)) numEval++
                    else numOther++
                }

                const col0Width = numCols > 10 ? 45 : (numCols > 6 ? 55 : (numCols > 3 ? 65 : 70))
                colStyles[0] = { cellWidth: col0Width, halign: 'left' }

                const remainingWidth = printableWidth - col0Width
                const evalColWidth = numCols > 10 ? 10 : (numCols > 6 ? 16 : 35)
                const totalEvalWidth = numEval * evalColWidth

                const totalObsWidth = remainingWidth - totalEvalWidth - (numOther * 30)
                const obsColWidth = numObs > 0 ? Math.max(30, totalObsWidth / numObs) : 30
                const otherColWidth = numOther > 0 ? Math.max(25, (remainingWidth - totalEvalWidth - (numObs * obsColWidth)) / numOther) : 25

                for (let i = 1; i < auditCols.length; i++) {
                    const c = auditCols[i]
                    if (isTextObsCol(c)) {
                        colStyles[i] = { cellWidth: obsColWidth, halign: 'left' }
                    } else if (isEvalCol(c)) {
                        colStyles[i] = { cellWidth: evalColWidth, fontStyle: 'bold', halign: 'center' }
                    } else {
                        colStyles[i] = { cellWidth: otherColWidth, halign: 'left' }
                    }
                }

                const dynamicFontSize = numCols > 10 ? 6 : (numCols > 6 ? 7 : 7.5)
                const dynamicCellPadding = numCols > 10 ? 1.2 : (numCols > 6 ? 1.8 : 2.5)
                const headFontSize = numCols > 10 ? 6.5 : (numCols > 6 ? 7.5 : 8)

                autoTable(doc, {
                    startY: y,
                    head: tableHead,
                    body: tableBody,
                    theme: 'grid',
                    showHead: 'firstPage',
                    headStyles: { fillColor: navyColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: headFontSize, halign: 'left', valign: 'middle' },
                    styles: { fontSize: dynamicFontSize, cellPadding: dynamicCellPadding, textColor: [30, 41, 59], lineWidth: 0.1, lineColor: [203, 213, 225], valign: 'middle' },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    columnStyles: colStyles,
                    margin: { left: 10, right: 10 }
                })

                y = (doc as any).lastAutoTable.finalY + 8
            }
        } else if (seg.type === 'dynamic-table') {
            const dtField = seg.field
            const dtCols: any[] = dtField.tableColumns || []
            const dtRows: Record<string, any>[] = Array.isArray(respuestasData[dtField.id]) ? respuestasData[dtField.id] : []

            if (dtCols.length === 0) return // sin columnas, omitir

            // Título del bloque
            if (y > 260) { doc.addPage(); y = 15 }
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(9)
            doc.setTextColor(...navyColor)
            doc.text((dtField.label || 'Tabla').toUpperCase(), 12, y)
            y += 4

            const hasSignaturesInDt = dtCols.some((c: any) => c.type === 'signature')

            const dtHead = [dtCols.map((c: any) => c.label)]
            const dtBody = dtRows.map((row: Record<string, any>) =>
                dtCols.map((col: any) => {
                    const v = row[col.key]
                    if (col.type === 'signature') {
                        if (typeof v === 'string' && v.startsWith('data:image')) {
                            return { content: '', image: v }
                        }
                        return v ? '[Firma]' : ''
                    }
                    if (col.type === 'totalizer') {
                        const tot = dtCols.reduce((sum: number, tc: any) => {
                            if (tc.type === 'number' || tc.type === 'number_special') {
                                const n = parseFloat(String(row[tc.key] ?? '').replace(/[^0-9.]/g, ''))
                                if (!isNaN(n)) return sum + n
                            }
                            return sum
                        }, 0)
                        return String(tot)
                    }
                    if (Array.isArray(v)) return v.join(', ')
                    return String(v ?? '')
                })
            )

            autoTable(doc, {
                startY: y,
                head: dtHead,
                body: dtBody.length > 0 ? dtBody : [dtCols.map(() => '')],
                theme: 'grid',
                showHead: 'firstPage',
                headStyles: { fillColor: navyColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                styles: { fontSize: 7.5, cellPadding: hasSignaturesInDt ? 3 : 2.5, textColor: [30, 41, 59], minCellHeight: hasSignaturesInDt ? 14 : 0 },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: 10, right: 10 },
                didDrawCell: (data) => {
                    if (data.section === 'body') {
                        const raw = data.cell.raw
                        if (raw && typeof raw === 'object' && (raw as any).image) {
                            try {
                                doc.addImage((raw as any).image, 'PNG', data.cell.x + 2, data.cell.y + 1, Math.min(data.cell.width - 4, 28), Math.min(data.cell.height - 2, 12))
                            } catch (e) {}
                        }
                    }
                }
            })
            y = (doc as any).lastAutoTable.finalY + 8
        }
    })

    // -------------------------------------------------------------
    // 4. FIRMAS Y DATOS (IMAGEN 3 & IMAGEN 4)
    // -------------------------------------------------------------
    const sigFields = campos.filter(c => c.type === 'signature' || c.type === 'signature_with_data')
    if (sigFields.length > 0) {
        const sigRows: any[][] = []
        let currentSigRow: any[] = []

        sigFields.forEach(sf => {
            if (sf.layoutWidth === '50%') {
                currentSigRow.push(sf)
                if (currentSigRow.length === 2) {
                    sigRows.push(currentSigRow)
                    currentSigRow = []
                }
            } else {
                if (currentSigRow.length > 0) {
                    sigRows.push(currentSigRow)
                    currentSigRow = []
                }
                sigRows.push([sf])
            }
        })
        if (currentSigRow.length > 0) sigRows.push(currentSigRow)

        sigRows.forEach(row => {
            if (y > 220) {
                doc.addPage()
                y = 15
            }

            let maxRowY = y

            row.forEach((sigField, i) => {
                const val = respuestasData[sigField.id]
                const dataObj = typeof val === 'object' && val !== null
                    ? val
                    : { firma: typeof val === 'string' ? val : '', dato1: '', dato2: '' }

                const count = row.length
                const colWidth = count === 2 ? 88 : 75
                const sigBoxHeight = 28
                const colLeft = count === 2 
                    ? (i === 0 ? 12 : 110) 
                    : (pageWidth - colWidth) / 2
                const centerX = colLeft + (colWidth / 2)

                let localY = y

                // Título de la Firma
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(9.5)
                doc.setTextColor(24, 43, 73)
                doc.text(sigField.label || 'Firma Digital', centerX, localY, { align: 'center' })
                localY += 4

                // Imagen de Firma
                if (dataObj.firma && dataObj.firma.startsWith('data:image')) {
                    try {
                        doc.addImage(dataObj.firma, 'PNG', colLeft + (colWidth - 65) / 2, localY, 65, sigBoxHeight)
                        localY += sigBoxHeight + 4
                    } catch (e) {
                        doc.setDrawColor(203, 213, 225)
                        doc.rect(colLeft + (colWidth - 65) / 2, localY, 65, sigBoxHeight)
                        localY += sigBoxHeight + 4
                    }
                } else {
                    doc.setDrawColor(203, 213, 225)
                    doc.rect(colLeft + (colWidth - 65) / 2, localY, 65, sigBoxHeight)
                    doc.setFontSize(8)
                    doc.setTextColor(148, 163, 184)
                    doc.text('(Sin firma registrada)', centerX, localY + 15, { align: 'center' })
                    localY += sigBoxHeight + 4
                }

                // Datos Adicionales (Nombre y Apellidos, RUT)
                if (sigField.type === 'signature_with_data') {
                    doc.setFontSize(8)
                    const d1Label = sigField.dato1Label || 'Nombre y Apellidos'
                    const d2Label = sigField.dato2Label || 'RUT'

                    doc.setFont('helvetica', 'bold')
                    doc.setTextColor(30, 41, 59)
                    doc.text(`${d1Label}: `, centerX - 5, localY, { align: 'right' })
                    doc.setFont('helvetica', 'normal')
                    doc.text(dataObj.dato1 || 'N/A', centerX - 3, localY)

                    doc.setFont('helvetica', 'bold')
                    doc.text(`${d2Label}: `, centerX - 5, localY + 5, { align: 'right' })
                    doc.setFont('helvetica', 'normal')
                    doc.text(dataObj.dato2 || 'N/A', centerX - 3, localY + 5)

                    localY += 12
                } else {
                    localY += 4
                }

                if (localY > maxRowY) maxRowY = localY
            })

            y = maxRowY + 4
        })
    }

    return doc
}
