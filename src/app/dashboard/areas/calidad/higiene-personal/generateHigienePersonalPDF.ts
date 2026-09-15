import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface HigienePersonalPDFItem {
    nombre: string
    uniformeLimpio: string // Cumple, No Cumple, No Aplica
    zapatosSeguridad: string
    peloCorto: string
    usoJockey: string
    sinJoyas: string
    unasCortas: string
    rasurado: string
    estadoSalud: string
    habitosCorrectos: string
    heridas: string
    observacion?: string | null
    accionCorrectiva?: string | null
}

export interface HigienePersonalPDFData {
    fecha: string // DD/MM/AAAA
    sucursalNombre: string
    items: HigienePersonalPDFItem[]
    firmaCalidad?: {
        nombre: string
        fecha?: string | null
        diasAtraso?: number
        img?: string | null
    } | null
    firmaBodega?: {
        nombre: string
        fecha?: string | null
        img?: string | null
    } | null
}

// Convierte Cumple / No Cumple / No Aplica a C / NC / NA
function toShortCode(val: string): string {
    if (!val) return 'C'
    const lower = val.toLowerCase().trim()
    if (lower === 'cumple' || lower === 'c') return 'C'
    if (lower === 'no cumple' || lower === 'nc') return 'NC'
    if (lower === 'no aplica' || lower === 'na') return 'NA'
    return val
}

// Convierte estado de salud al código numérico 0..5 del formato oficial
function toSaludCode(val: string): string {
    if (!val) return '0'
    const clean = val.toLowerCase().trim()
    if (clean === 'no aplica' || clean === '0' || clean === 'ninguno' || clean === 'ausencia') return '0'
    if (clean.includes('diarrea')) return '1'
    if (clean.includes('vómito') || clean.includes('vomito')) return '2'
    if (clean.includes('fiebre')) return '3'
    if (clean.includes('resfrio') || clean.includes('resfrío')) return '4'
    if (clean.includes('lesión') || clean.includes('lesion') || clean.includes('piel')) return '5'
    if (/^[0-5]$/.test(clean)) return clean
    return '0'
}

// Convierte hábitos al código numérico 0..7 del formato oficial
function toHabitosCode(val: string): string {
    if (!val) return '0'
    const clean = val.toLowerCase().trim()
    if (clean === 'no aplica' || clean === '0' || clean === 'ninguno') return '0'
    if (clean.includes('telefono') || clean.includes('teléfono')) return '1'
    if (clean.includes('audifono') || clean.includes('audífono')) return '2'
    if (clean.includes('chicle') || clean.includes('mascar')) return '3'
    if (clean.includes('estornudar')) return '4'
    if (clean.includes('escupir')) return '5'
    if (clean.includes('hálito') || clean.includes('halito') || clean.includes('alcohol')) return '6'
    if (clean.includes('manejo') || clean.includes('producto')) return '7'
    if (/^[0-7]$/.test(clean)) return clean
    return '0'
}

// Convierte heridas a A (Ausencia) o P (Presencia)
function toHeridasCode(val: string): string {
    if (!val) return 'A'
    const clean = val.toLowerCase().trim()
    if (clean.includes('presencia') || clean === 'p') return 'P'
    return 'A'
}

export function generateHigienePersonalPDF(data: HigienePersonalPDFData) {
    // Formato Carta Vertical (Portrait) tal como el modelo oficial
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
    })

    const pageWidth = doc.internal.pageSize.getWidth() // ~215.9 mm
    const pageHeight = doc.internal.pageSize.getHeight() // ~279.4 mm
    const margin = 10
    const contentWidth = pageWidth - (margin * 2) // ~195.9 mm

    // Dimensiones de Encabezado Oficial
    const headerHeight = 17
    const col1Width = 42
    const col3Width = 46
    const col2Width = contentWidth - col1Width - col3Width

    // Función auxiliar para dibujar encabezado de página
    const drawHeader = (pageNumber: number, totalPagesPlaceholder: boolean = false, totalPages: number = 1) => {
        const headerY = margin

        doc.setDrawColor(80, 80, 80)
        doc.setLineWidth(0.3)

        // Rectángulos de las 3 celdas de encabezado
        doc.rect(margin, headerY, col1Width, headerHeight)
        doc.rect(margin + col1Width, headerY, col2Width, headerHeight)
        doc.rect(margin + col1Width + col2Width, headerY, col3Width, headerHeight)

        // Columna 1: Marca tipográfica oficial HENDAYA (Cyan oficial)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(20)
        doc.setTextColor(0, 163, 224) // Cyan oficial Hendaya #00A3E0
        doc.text('HENDAYA', margin + (col1Width / 2), headerY + 11.5, { align: 'center' })

        // Columna 2: Título Centrado
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10.5)
        doc.setTextColor(20, 20, 20)
        doc.text('REGISTRO DE TRANSPORTISTA INTERNO', margin + col1Width + (col2Width / 2), headerY + 7, { align: 'center' })
        doc.text('HIGIENE PERSONAL', margin + col1Width + (col2Width / 2), headerY + 13, { align: 'center' })

        // Columna 3: Recuadro técnico
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(30, 30, 30)
        const col3X = margin + col1Width + col2Width + 3
        doc.text('Codigo: R_GL_8_11', col3X, headerY + 5.2)
        doc.text('Version 02', col3X, headerY + 10)
        if (totalPagesPlaceholder) {
            doc.text(`Pagina: ${pageNumber} de {totalPages}`, col3X, headerY + 14.8)
        } else {
            doc.text(`Pagina: ${pageNumber} de ${totalPages}`, col3X, headerY + 14.8)
        }
    }

    // Dibujar encabezado inicial en página 1
    drawHeader(1, true)

    let currentY = margin + headerHeight + 5

    // Sub-encabezado: Fecha y Sucursal
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(30, 30, 30)
    let fechaTxt = `Fecha: ${data.fecha}`
    if (data.sucursalNombre) {
        fechaTxt += `      Sucursal: ${data.sucursalNombre}`
    }
    doc.text(fechaTxt, margin, currentY)

    currentY += 2.5

    // Columnas exactas del reporte (13 columnas)
    const tableColumns = [
        { header: 'Nombre', dataKey: 'nombre' },
        { header: 'Uniforme\nlimpio *', dataKey: 'uniforme' },
        { header: 'Uso\nzapatos\nseguridad\n*', dataKey: 'zapatos' },
        { header: 'Pelo corto\n*', dataKey: 'pelo' },
        { header: 'Uso\ncorrecto\nJockey *', dataKey: 'jockey' },
        { header: 'Sin Joyas *', dataKey: 'joyas' },
        { header: 'Uñas\ncortas *', dataKey: 'unas' },
        { header: 'Rasurado\n*', dataKey: 'rasurado' },
        { header: 'Buen\nestado\nSalud **', dataKey: 'salud' },
        { header: 'Habitos\ncorrectos\n***', dataKey: 'habitos' },
        { header: 'Heridas\n****', dataKey: 'heridas' },
        { header: 'Observación', dataKey: 'observacion' },
        { header: 'Acción Correciva', dataKey: 'accion' }
    ]

    const tableRows = data.items.map(item => ({
        nombre: (item.nombre || '').toUpperCase(),
        uniforme: toShortCode(item.uniformeLimpio),
        zapatos: toShortCode(item.zapatosSeguridad),
        pelo: toShortCode(item.peloCorto),
        jockey: toShortCode(item.usoJockey),
        joyas: toShortCode(item.sinJoyas),
        unas: toShortCode(item.unasCortas),
        rasurado: toShortCode(item.rasurado),
        salud: toSaludCode(item.estadoSalud),
        habitos: toHabitosCode(item.habitosCorrectos),
        heridas: toHeridasCode(item.heridas),
        observacion: (item.observacion || '').toUpperCase(),
        accion: (item.accionCorrectiva || '').toUpperCase()
    }))

    // Renderizar la tabla principal
    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [tableColumns.map(c => c.header)],
        body: tableRows.map(r => [
            r.nombre,
            r.uniforme,
            r.zapatos,
            r.pelo,
            r.jockey,
            r.joyas,
            r.unas,
            r.rasurado,
            r.salud,
            r.habitos,
            r.heridas,
            r.observacion,
            r.accion
        ]),
        theme: 'grid',
        tableLineColor: [80, 80, 80],
        tableLineWidth: 0.3,
        styles: {
            font: 'helvetica',
            fontSize: 5.5,
            cellPadding: 1.2,
            lineColor: [100, 100, 100],
            lineWidth: 0.25,
            textColor: [20, 20, 20],
            valign: 'middle'
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [10, 10, 10],
            fontStyle: 'bold',
            fontSize: 5.4,
            halign: 'center',
            valign: 'middle',
            lineWidth: 0.3,
            lineColor: [80, 80, 80]
        },
        columnStyles: {
            0: { cellWidth: 26, halign: 'left', fontStyle: 'bold' }, // Nombre
            1: { cellWidth: 8.5, halign: 'center' }, // Uniforme
            2: { cellWidth: 10, halign: 'center' }, // Zapatos
            3: { cellWidth: 8, halign: 'center' }, // Pelo
            4: { cellWidth: 9, halign: 'center' }, // Jockey
            5: { cellWidth: 8, halign: 'center' }, // Sin Joyas
            6: { cellWidth: 8, halign: 'center' }, // Uñas
            7: { cellWidth: 8.5, halign: 'center' }, // Rasurado
            8: { cellWidth: 9, halign: 'center' }, // Salud (0..5)
            9: { cellWidth: 9, halign: 'center' }, // Habitos (0..7)
            10: { cellWidth: 7.5, halign: 'center' }, // Heridas (A/P)
            11: { cellWidth: 41.5, halign: 'left' }, // Observación
            12: { cellWidth: 42.9, halign: 'left' } // Acción Correctiva
        },
        didDrawPage: (dataHook) => {
            if (dataHook.pageNumber > 1) {
                drawHeader(dataHook.pageNumber, true)
            }
        }
    })

    const finalY = (doc as any).lastAutoTable?.finalY || (currentY + 20)

    // Sección de Leyendas (4 cajas rectangulares contiguas)
    const legendsHeight = 11.5
    const signBoxHeight = 28
    const requiredSpace = legendsHeight + 3 + signBoxHeight + 5

    let legendsY = finalY + 4
    if (legendsY + requiredSpace > pageHeight - margin) {
        doc.addPage()
        drawHeader(doc.getNumberOfPages(), true)
        legendsY = margin + headerHeight + 6
    }

    doc.setDrawColor(80, 80, 80)
    doc.setLineWidth(0.3)

    // Dimensiones de las 4 cajas de leyenda
    const box1Width = 24
    const box2Width = 60
    const box3Width = 82
    const box4Width = contentWidth - box1Width - box2Width - box3Width // ~29.9 mm

    const box1X = margin
    const box2X = box1X + box1Width
    const box3X = box2X + box2Width
    const box4X = box3X + box3Width

    // Dibujar rectángulos de las 4 cajas
    doc.rect(box1X, legendsY, box1Width, legendsHeight)
    doc.rect(box2X, legendsY, box2Width, legendsHeight)
    doc.rect(box3X, legendsY, box3Width, legendsHeight)
    doc.rect(box4X, legendsY, box4Width, legendsHeight)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.4)
    doc.setTextColor(20, 20, 20)

    // Caja 1: * C: Cumple / NC: No Cumple / NA: No Aplica
    doc.text('* C: Cumple', box1X + 1.8, legendsY + 3.4)
    doc.text('  NC: No Cumple', box1X + 1.8, legendsY + 6.6)
    doc.text('  NA: No Aplica', box1X + 1.8, legendsY + 9.8)

    // Caja 2: ** Estado Salud
    doc.text('** Estado Salud  1: Diarrea          2: Vómitos', box2X + 1.8, legendsY + 3.4)
    doc.text('                 3: Fiebre           4: Resfrío', box2X + 1.8, legendsY + 6.6)
    doc.text('                 5: Lesión en la Piel', box2X + 1.8, legendsY + 9.8)

    // Caja 3: *** Hábitos
    doc.text('*** Hábitos  1: Teléfono        2: Audífonos        3: Mascar Chicle', box3X + 1.8, legendsY + 3.4)
    doc.text('             4: Estornudar       5: Escupir          6: Hálito alcohólico', box3X + 1.8, legendsY + 6.6)
    doc.text('             7: Manejo de productos', box3X + 1.8, legendsY + 9.8)

    // Caja 4: **** Heridas
    doc.text('**** A: Ausencia', box4X + 1.8, legendsY + 4.8)
    doc.text('     P: Presencia', box4X + 1.8, legendsY + 8.2)

    // Sección de Firmas (Recuadro general inferior)
    const signBoxY = legendsY + legendsHeight + 2.5
    doc.rect(margin, signBoxY, contentWidth, signBoxHeight)

    const signLineWidth = 80
    const leftSignX = margin + 10
    const rightSignX = margin + contentWidth - signLineWidth - 10
    const lineY = signBoxY + 18

    // Firma Izquierda: Encargado de Calidad
    if (data.firmaCalidad?.img) {
        try {
            doc.addImage(data.firmaCalidad.img, 'PNG', leftSignX + (signLineWidth / 2) - 24, lineY - 14, 48, 12)
        } catch (e) {
            console.error('Error adding calidad signature image:', e)
        }
    }

    doc.setLineWidth(0.4)
    doc.setDrawColor(30, 30, 30)
    doc.line(leftSignX, lineY, leftSignX + signLineWidth, lineY)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(20, 20, 20)
    const calidadName = data.firmaCalidad?.nombre || ''
    doc.text(calidadName, leftSignX + (signLineWidth / 2), lineY - 1.8, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(40, 40, 40)
    doc.text('Monitoreado encargado de calidad', leftSignX + (signLineWidth / 2), lineY + 3.8, { align: 'center' })

    if (data.firmaCalidad?.fecha) {
        doc.setFontSize(5.8)
        doc.setTextColor(100, 100, 100)
        let fechaLabel = `Firmado: ${data.firmaCalidad.fecha}`
        if (data.firmaCalidad.diasAtraso && data.firmaCalidad.diasAtraso > 0) {
            fechaLabel += ` (${data.firmaCalidad.diasAtraso} d. atraso)`
        }
        doc.text(fechaLabel, leftSignX + (signLineWidth / 2), lineY + 6.8, { align: 'center' })
    }

    // Firma Derecha: Jefe de Bodega
    if (data.firmaBodega?.img) {
        try {
            doc.addImage(data.firmaBodega.img, 'PNG', rightSignX + (signLineWidth / 2) - 24, lineY - 14, 48, 12)
        } catch (e) {
            console.error('Error adding bodega signature image:', e)
        }
    }

    doc.line(rightSignX, lineY, rightSignX + signLineWidth, lineY)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(20, 20, 20)
    const bodegaName = data.firmaBodega?.nombre || (data.firmaBodega ? 'Firmado electrónicamente' : '')
    doc.text(bodegaName, rightSignX + (signLineWidth / 2), lineY - 1.8, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(40, 40, 40)
    doc.text('Verificado Jefe de Bodega', rightSignX + (signLineWidth / 2), lineY + 3.8, { align: 'center' })

    if (data.firmaBodega?.fecha) {
        doc.setFontSize(5.8)
        doc.setTextColor(100, 100, 100)
        doc.text(`Validado: ${data.firmaBodega.fecha}`, rightSignX + (signLineWidth / 2), lineY + 6.8, { align: 'center' })
    }

    // Segunda pasada: Escribir "Pagina: X de Y" en todas las páginas generadas
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        // Redibujar el recuadro técnico de encabezado con el total de páginas exacto
        const col3X = margin + col1Width + col2Width + 3
        const headerY = margin
        doc.setFillColor(255, 255, 255)
        doc.rect(col3X - 1, headerY + 11.5, col3Width - 2, 4.5, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(30, 30, 30)
        doc.text(`Pagina: ${i} de ${totalPages}`, col3X, headerY + 14.8)
    }

    // Descargar archivo PDF
    const cleanFecha = data.fecha.replace(/\//g, '-')
    const cleanSucursal = (data.sucursalNombre || 'Sucursal').replace(/[^a-zA-Z0-9_-]/g, '_')
    const filename = `R_GL_8_11_HigienePersonal_${cleanSucursal}_${cleanFecha}.pdf`
    doc.save(filename)
}
