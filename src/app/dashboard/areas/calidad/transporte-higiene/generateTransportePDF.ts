import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface TransportePDFItem {
    patente: string
    limpiezaInterior: string // Cumple, No Cumple, No Aplica
    limpiezaExterior: string
    puertaCamara: string
    piezasSinOxidacion: string
    equipoCongelacion: string
    equipoRefrigeracion: string
    observacion?: string | null
    accionCorrectiva?: string | null
}

export interface TransportePDFData {
    fecha: string // DD/MM/AAAA
    sucursalNombre: string
    items: TransportePDFItem[]
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

// Convierte 'Cumple' -> 'C', 'No Cumple' -> 'NC', 'No Aplica' -> 'NA'
function toShortCode(val: string): string {
    if (!val) return 'C'
    const lower = val.toLowerCase().trim()
    if (lower === 'cumple' || lower === 'c') return 'C'
    if (lower === 'no cumple' || lower === 'nc') return 'NC'
    if (lower === 'no aplica' || lower === 'na') return 'NA'
    return val
}

export function generateTransporteHigienePDF(data: TransportePDFData) {
    // Formato Carta vertical (Portrait)
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14
    const contentWidth = pageWidth - (margin * 2)

    let currentY = 14

    // 1. ENCABEZADO OFICIAL EN 3 COLUMNAS CON BORDE
    const headerHeight = 22
    const col1Width = 48
    const col3Width = 46
    const col2Width = contentWidth - col1Width - col3Width

    doc.setDrawColor(80, 80, 80)
    doc.setLineWidth(0.3)

    // Rectángulos de las 3 celdas de encabezado
    doc.rect(margin, currentY, col1Width, headerHeight)
    doc.rect(margin + col1Width, currentY, col2Width, headerHeight)
    doc.rect(margin + col1Width + col2Width, currentY, col3Width, headerHeight)

    // Columna 1: Marca tipográfica oficial HENDAYA (Cyan oficial)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(19)
    doc.setTextColor(0, 163, 224) // Cyan oficial Hendaya #00A3E0
    doc.text('HENDAYA', margin + (col1Width / 2), currentY + 14, { align: 'center' })

    // Columna 2: Título Centrado
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(20, 20, 20)
    doc.text('REGISTRO DE TRANSPORTISTA INTERNO', margin + col1Width + (col2Width / 2), currentY + 9, { align: 'center' })
    doc.text('HIGIENE Y ESTADO TRANSPORTE', margin + col1Width + (col2Width / 2), currentY + 16, { align: 'center' })

    // Columna 3: Recuadro técnico
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(30, 30, 30)
    const col3X = margin + col1Width + col2Width + 4
    doc.text('Codigo: R_GL_8_11', col3X, currentY + 7)
    doc.text('Version 02', col3X, currentY + 12.5)
    doc.text('Fecha: 08/01/2018', col3X, currentY + 18)

    currentY += headerHeight + 8

    // 2. SUB-ENCABEZADO: Fecha y Sucursal
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(20, 20, 20)
    doc.text(`Fecha: ${data.fecha}`, margin, currentY)
    if (data.sucursalNombre) {
        doc.text(`Sucursal: ${data.sucursalNombre}`, margin + 65, currentY)
    }

    currentY += 4

    // 3. TABLA DE REGISTROS DIARIOS (Respetando columnas exactas)
    const tableColumns = [
        { header: 'Patente Vehículo', dataKey: 'patente' },
        { header: 'Limpieza\nInterior', dataKey: 'interior' },
        { header: 'Limpieza\nExterior', dataKey: 'exterior' },
        { header: 'Puertas\nde camara\nen buen\nestado', dataKey: 'puerta' },
        { header: 'Piezas sin\noxidación', dataKey: 'piezas' },
        { header: 'Equipo de\ncongelado\nen buen\nestado', dataKey: 'congelado' },
        { header: 'Equipo de\nrefrigerado\nen buen\nestado', dataKey: 'refrigerado' },
        { header: 'Observación', dataKey: 'observacion' },
        { header: 'Acción correctiva', dataKey: 'accion' }
    ]

    const tableRows = data.items.map(item => ({
        patente: item.patente || '',
        interior: toShortCode(item.limpiezaInterior),
        exterior: toShortCode(item.limpiezaExterior),
        puerta: toShortCode(item.puertaCamara),
        piezas: toShortCode(item.piezasSinOxidacion),
        congelado: toShortCode(item.equipoCongelacion),
        refrigerado: toShortCode(item.equipoRefrigeracion),
        observacion: item.observacion || '',
        accion: item.accionCorrectiva || ''
    }))

    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [tableColumns.map(c => c.header)],
        body: tableRows.map(r => [
            r.patente,
            r.interior,
            r.exterior,
            r.puerta,
            r.piezas,
            r.congelado,
            r.refrigerado,
            r.observacion,
            r.accion
        ]),
        theme: 'grid',
        tableLineColor: [100, 100, 100],
        tableLineWidth: 0.3,
        styles: {
            font: 'helvetica',
            fontSize: 7.5,
            cellPadding: 1.8,
            lineColor: [130, 130, 130],
            lineWidth: 0.25,
            textColor: [30, 30, 30],
            valign: 'middle'
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [20, 20, 20],
            fontStyle: 'bold',
            fontSize: 6.8,
            halign: 'center',
            valign: 'middle',
            lineWidth: 0.3,
            lineColor: [80, 80, 80]
        },
        columnStyles: {
            0: { cellWidth: 24, halign: 'center', fontStyle: 'bold' }, // Patente
            1: { cellWidth: 15, halign: 'center' }, // Limpieza Interior
            2: { cellWidth: 15, halign: 'center' }, // Limpieza Exterior
            3: { cellWidth: 16, halign: 'center' }, // Puertas
            4: { cellWidth: 15, halign: 'center' }, // Piezas
            5: { cellWidth: 17, halign: 'center' }, // Eq Congelado
            6: { cellWidth: 17, halign: 'center' }, // Eq Refrigerado
            7: { cellWidth: 'auto', halign: 'left' }, // Observación
            8: { cellWidth: 'auto', halign: 'left' }  // Acción correctiva
        }
    })

    const finalY = (doc as any).lastAutoTable?.finalY || (currentY + 20)

    // 4. RECUADRO DE SIMBOLOGÍA / LEYENDA (C: Cumple  NC: No Cumple  NA: No Aplica)
    const legendWidth = 98
    const legendHeight = 7
    const signBoxHeight = 35

    let legendY = finalY + 6
    if (legendY + legendHeight + 4 + signBoxHeight > pageHeight - margin) {
        doc.addPage()
        legendY = margin + 5
    }

    doc.setDrawColor(100, 100, 100)
    doc.setLineWidth(0.3)
    doc.rect(margin, legendY, legendWidth, legendHeight)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(30, 30, 30)
    doc.text('C: Cumple     NC: No Cumple     NA: No Aplica', margin + 4, legendY + 4.8)

    // 5. RECUADRO DE FIRMAS DUALES (Al pie de la hoja)
    const signBoxY = legendY + legendHeight + 4

    doc.rect(margin, signBoxY, contentWidth, signBoxHeight)

    const signLineWidth = 75
    const leftSignX = margin + 12
    const rightSignX = margin + contentWidth - signLineWidth - 12
    const lineY = signBoxY + 23

    // Firma Izquierda: Encargado de Calidad
    if (data.firmaCalidad?.img) {
        try {
            doc.addImage(data.firmaCalidad.img, 'PNG', leftSignX + (signLineWidth / 2) - 26, lineY - 17, 52, 15)
        } catch (e) {
            console.error('Error adding calidad signature image:', e)
        }
    }

    doc.setLineWidth(0.4)
    doc.setDrawColor(40, 40, 40)
    doc.line(leftSignX, lineY, leftSignX + signLineWidth, lineY)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(20, 20, 20)
    const calidadName = data.firmaCalidad?.nombre || ''
    doc.text(calidadName, leftSignX + (signLineWidth / 2), lineY - 2.5, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(60, 60, 60)
    doc.text('Monitoreado encargado de calidad', leftSignX + (signLineWidth / 2), lineY + 4.5, { align: 'center' })
    if (data.firmaCalidad?.fecha) {
        doc.setFontSize(7)
        doc.setTextColor(100, 100, 100)
        let fechaLabel = `Firmado: ${data.firmaCalidad.fecha}`
        if (data.firmaCalidad.diasAtraso && data.firmaCalidad.diasAtraso > 0) {
            fechaLabel += ` (${data.firmaCalidad.diasAtraso} d. atraso)`
        }
        doc.text(fechaLabel, leftSignX + (signLineWidth / 2), lineY + 8.5, { align: 'center' })
    }

    // Firma Derecha: Jefe de Bodega
    if (data.firmaBodega?.img) {
        try {
            doc.addImage(data.firmaBodega.img, 'PNG', rightSignX + (signLineWidth / 2) - 26, lineY - 17, 52, 15)
        } catch (e) {
            console.error('Error adding bodega signature image:', e)
        }
    }

    doc.line(rightSignX, lineY, rightSignX + signLineWidth, lineY)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(20, 20, 20)
    const bodegaName = data.firmaBodega?.nombre || (data.firmaBodega ? 'Firmado electrónicamente' : '')
    doc.text(bodegaName, rightSignX + (signLineWidth / 2), lineY - 2.5, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(60, 60, 60)
    doc.text('Verificado Jefe de Bodega', rightSignX + (signLineWidth / 2), lineY + 4.5, { align: 'center' })
    if (data.firmaBodega?.fecha) {
        doc.setFontSize(7)
        doc.setTextColor(100, 100, 100)
        doc.text(`Validado: ${data.firmaBodega.fecha}`, rightSignX + (signLineWidth / 2), lineY + 8.5, { align: 'center' })
    }

    // Guardar archivo
    const cleanFecha = data.fecha.replace(/\//g, '-')
    const cleanSucursal = (data.sucursalNombre || 'Sucursal').replace(/[^a-zA-Z0-9_-]/g, '_')
    const filename = `R_GL_8_11_HigieneTransporte_${cleanSucursal}_${cleanFecha}.pdf`
    doc.save(filename)
}
