import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface ParticipantePDFItem {
    numero: number
    nombre: string
    cargo: string
    rut: string
    firma?: string | null
}

export interface RegistroCapacitacionPDFData {
    fecha: string | Date
    instalacion: string
    licitacion?: string | null
    sucursal?: string | null
    horario: string
    relatorNombre: string
    relatorCargo: string
    tema: string
    firmaRelator?: string | null
    participantes: ParticipantePDFItem[]
}

function formatDateDDMMAAAA(dateVal: string | Date): string {
    if (!dateVal) return ''
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return String(dateVal)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
}

export function generateRegistroCapacitacionPDF(data: RegistroCapacitacionPDFData): void {
    // Formato Carta vertical estándar (215.9 x 279.4 mm)
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14
    const contentWidth = pageWidth - (margin * 2)

    let currentY = 12

    // -------------------------------------------------------------
    // 1. ENCABEZADO OFICIAL EN 3 COLUMNAS CON BORDE (R PE 7 06)
    // -------------------------------------------------------------
    const headerHeight = 16
    const col1Width = 48
    const col3Width = 48
    const col2Width = contentWidth - col1Width - col3Width

    doc.setDrawColor(100, 100, 100)
    doc.setLineWidth(0.3)

    // Rectángulos de las 3 celdas
    doc.rect(margin, currentY, col1Width, headerHeight)
    doc.rect(margin + col1Width, currentY, col2Width, headerHeight)
    doc.rect(margin + col1Width + col2Width, currentY, col3Width, headerHeight)

    // Columna 1: Logotipo estilizado oficial HENDAYA (Cyan Corporativo)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(0, 163, 224) // Cyan oficial Hendaya #00A3E0
    doc.text('HENDAYA', margin + (col1Width / 2), currentY + 10.5, { align: 'center' })

    // Columna 2: Título Centrado
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(60, 60, 60)
    doc.text('REGISTRO', margin + col1Width + (col2Width / 2), currentY + 6.5, { align: 'center' })
    doc.text('CAPACITACIÓN PERSONAL', margin + col1Width + (col2Width / 2), currentY + 12, { align: 'center' })

    // Columna 3: Información de Control Documental
    const col3X = margin + col1Width + col2Width
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(60, 60, 60)

    // Líneas divisorias internas de la columna 3
    const subH = headerHeight / 3
    doc.line(col3X, currentY + subH, col3X + col3Width, currentY + subH)
    doc.line(col3X, currentY + (subH * 2), col3X + col3Width, currentY + (subH * 2))

    doc.text('CÓDIGO: R PE 7 06', col3X + 3, currentY + 4)
    doc.text('VERSIÓN: 01', col3X + 3, currentY + subH + 4)
    doc.text('FECHA 30-01-2018', col3X + 3, currentY + (subH * 2) + 4)

    currentY += headerHeight + 8

    // -------------------------------------------------------------
    // 2. BLOQUE DE DATOS GENERALES CON LÍNEAS SUBRAYADAS
    // -------------------------------------------------------------
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(20, 20, 20)

    const labelX = margin
    const colonX = margin + 35
    const valueStartX = margin + 38
    const lineEndX = margin + contentWidth
    const rowGap = 5.2

    // Helper para dibujar línea con valor
    const drawMetaRow = (label: string, value: string, yPos: number) => {
        doc.setFont('helvetica', 'bold')
        doc.text(label, labelX, yPos)
        doc.text(':', colonX, yPos)

        // Línea horizontal punteada/continua debajo del texto
        doc.setDrawColor(20, 20, 20)
        doc.setLineWidth(0.25)
        doc.line(valueStartX, yPos + 1.2, lineEndX, yPos + 1.2)

        // Texto del valor
        doc.setFont('helvetica', 'normal')
        doc.text(value || '', valueStartX + 2, yPos)
    }

    // Fila 1: Fecha
    drawMetaRow('Fecha', formatDateDDMMAAAA(data.fecha), currentY)
    currentY += rowGap

    // Fila 2: Instalación (con Licitación y Sucursal)
    let instalacionTexto = data.instalacion || ''
    if (data.licitacion || data.sucursal) {
        const licPart = data.licitacion ? `Lic. ${data.licitacion}` : ''
        const sucPart = data.sucursal || ''
        const extra = [licPart, sucPart].filter(Boolean).join(' - ')
        if (!instalacionTexto) {
            instalacionTexto = extra
        } else if (!instalacionTexto.toLowerCase().includes(sucPart.toLowerCase()) && !instalacionTexto.toLowerCase().includes(licPart.toLowerCase())) {
            instalacionTexto = `${instalacionTexto} (${extra})`
        }
    }
    drawMetaRow('Instalación', instalacionTexto, currentY)
    currentY += rowGap

    // Fila 3: Horario
    drawMetaRow('Horario', data.horario || '', currentY)
    currentY += rowGap

    // Fila 4: Relator - Cargo
    const relatorCompuesto = data.relatorCargo ? `${data.relatorNombre} - ${data.relatorCargo}` : data.relatorNombre
    drawMetaRow('Relator - Cargo', relatorCompuesto, currentY)
    currentY += rowGap

    // Fila 5: Tema de Capacitación (Multilínea con líneas horizontales)
    doc.setFont('helvetica', 'bold')
    doc.text('Tema de', labelX, currentY)
    doc.text('Capacitación', labelX, currentY + 4)
    doc.text(':', colonX, currentY + 1.5)

    // Descomponer el tema en varias líneas si es largo
    const availableTextWidth = lineEndX - valueStartX - 4
    const temaLines = doc.splitTextToSize(data.tema || '', availableTextWidth)

    // Formato oficial: imprimir líneas con subrayado
    const totalLinesToShow = Math.max(temaLines.length, 5) // Al menos 5 líneas subrayadas
    let temaY = currentY

    for (let i = 0; i < totalLinesToShow; i++) {
        doc.setDrawColor(20, 20, 20)
        doc.setLineWidth(0.25)
        doc.line(valueStartX, temaY + 1.2, lineEndX, temaY + 1.2)

        if (temaLines[i]) {
            doc.setFont('helvetica', 'normal')
            doc.text(temaLines[i], valueStartX + 2, temaY)
        }
        temaY += 4.2
    }

    currentY = temaY + 3

    // -------------------------------------------------------------
    // 3. SECCIÓN PARTICIPANTES
    // -------------------------------------------------------------
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(20, 20, 20)
    doc.text('PARTICIPANTES', margin, currentY)
    currentY += 2.5

    // Preparar filas: siempre al menos 15 filas como en la planilla impresa
    const tableRows: any[][] = []
    const totalRowsCount = Math.max(data.participantes.length, 15)

    for (let i = 0; i < totalRowsCount; i++) {
        const p = data.participantes[i]
        if (p) {
            tableRows.push([
                String(p.numero || i + 1),
                p.nombre || '',
                p.cargo || '',
                p.rut || '',
                p.firma || ''
            ])
        } else {
            // Filas vacías con correlativo para mantener el formato físico
            tableRows.push([
                String(i + 1),
                '',
                '',
                '',
                ''
            ])
        }
    }

    autoTable(doc, {
        startY: currentY,
        head: [['Nº', 'NOMBRE', 'CARGO', 'RUT', 'FIRMA']],
        body: tableRows,
        theme: 'grid',
        tableWidth: contentWidth,
        margin: { left: margin, right: margin },
        headStyles: {
            fillColor: [210, 210, 210], // Fondo gris claro idéntico al documento oficial
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            fontSize: 8.5,
            halign: 'center',
            valign: 'middle',
            lineWidth: 0.3,
            lineColor: [40, 40, 40]
        },
        styles: {
            textColor: [10, 10, 10],
            fontSize: 8,
            minCellHeight: 6.8, // Altura adecuada para permitir firma y mantener 15 filas en 1 página
            cellPadding: 1,
            valign: 'middle',
            lineWidth: 0.25,
            lineColor: [60, 60, 60]
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'left', cellWidth: 68 },
            2: { halign: 'left', cellWidth: 36 },
            3: { halign: 'center', cellWidth: 38 },
            4: { halign: 'center', cellWidth: 36 }
        },
        didParseCell: (cellData) => {
            // En la columna de firma (índice 4), vaciamos el texto para que jspdf-autotable no imprima ningún caracter
            if (cellData.section === 'body' && cellData.column.index === 4) {
                cellData.cell.text = []
            }
        },
        didDrawCell: (cellData) => {
            // Incrustar imagen de firma si está presente en la columna 4
            if (cellData.section === 'body' && cellData.column.index === 4) {
                const rawVal = cellData.cell.raw
                if (typeof rawVal === 'string' && rawVal.startsWith('data:image/')) {
                    try {
                        const cellX = cellData.cell.x + 2
                        const cellY = cellData.cell.y + 0.8
                        const cellW = cellData.cell.width - 4
                        const cellH = cellData.cell.height - 1.6
                        doc.addImage(rawVal, 'PNG', cellX, cellY, cellW, cellH)
                    } catch (e) {
                        console.error('Error incrustando firma en tabla:', e)
                    }
                }
            }
        }
    })

    const finalY = (doc as any).lastAutoTable?.finalY || (currentY + 110)

    // -------------------------------------------------------------
    // 4. FIRMA RELATOR (Al pie de la página)
    // -------------------------------------------------------------
    const firmaRelatorY = Math.min(finalY + 12, pageHeight - 16)
    const relatorLineWidth = 65
    const centerRelatorX = (pageWidth / 2) - 15

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(20, 20, 20)
    doc.text('FIRMA RELATOR:', centerRelatorX - 35, firmaRelatorY)

    // Si tiene firma dibujada, incrustarla encima de la línea
    if (data.firmaRelator) {
        try {
            doc.addImage(data.firmaRelator, 'PNG', centerRelatorX, firmaRelatorY - 11, relatorLineWidth, 11)
        } catch (e) {
            console.error('Error incrustando firma de relator:', e)
        }
    }

    // Línea de firma
    doc.setLineWidth(0.35)
    doc.setDrawColor(20, 20, 20)
    doc.line(centerRelatorX, firmaRelatorY + 0.8, centerRelatorX + relatorLineWidth, firmaRelatorY + 0.8)

    // Guardar archivo PDF con nombre descriptivo
    const fechaLimpia = formatDateDDMMAAAA(data.fecha)
    const instalacionLimpia = (data.instalacion || 'Hendaya').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20)
    const fileName = `R_PE_7_06_Registro_Capacitacion_${instalacionLimpia}_${fechaLimpia}.pdf`

    doc.save(fileName)
}
