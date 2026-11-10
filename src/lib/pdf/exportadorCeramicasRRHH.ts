import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'

export interface ExportarCeramicasPdfOptions {
    tabName: string
    titulo: string
    subtitulo?: string
    filtroActivo?: string
    usuarioNombre?: string
}

/**
 * Exporta un contenedor visual de métricas / cerámicas a un documento PDF ejecutivo
 * con formato A4 apaisado (Landscape), cabecera y pie oficiales de Hendaya.
 * Cumple estrictamente con las reglas de identidad corporativa de Hendaya (marca tipográfica Cyan/Sky, sin logos PNG de terceros).
 */
export async function exportarCeramicasAPdf(
    element: HTMLElement,
    options: ExportarCeramicasPdfOptions
): Promise<void> {
    // 1. Capturar el elemento visual en alta resolución (scale: 2)
    const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8fafc', // slate-50 para conservar el contraste de las tarjetas blancas
        windowWidth: element.scrollWidth,
    })

    if (!canvas.width || !canvas.height) {
        throw new Error('No se pudo capturar el contenido visual de las cerámicas.')
    }

    // 2. Configurar documento PDF A4 en orientación Horizontal (Landscape)
    // Dimensiones A4 Landscape: 297 mm ancho x 210 mm alto
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
    })

    const pageWidth = 297
    const pageHeight = 210

    // Márgenes y áreas útiles
    const marginX = 14
    const headerHeight = 18
    const footerMargin = 12
    const contentTopY = 22
    const contentBottomY = pageHeight - footerMargin
    const usableHeightPerPage = contentBottomY - contentTopY // ~176 mm
    const usableWidth = pageWidth - marginX * 2 // 269 mm

    // Relación de escala de la imagen respecto al ancho imprimible
    const totalImageHeightMm = (canvas.height * usableWidth) / canvas.width

    // Calcular cantidad de páginas necesarias
    const totalPages = Math.max(1, Math.ceil(totalImageHeightMm / usableHeightPerPage))

    // Función interna para dibujar cabecera y pie de página corporativos de Hendaya
    const dibujarHeaderYFooter = (pageNum: number) => {
        // --- CABECERA CORPORATIVA ---
        // Barra de fondo slate-900
        pdf.setFillColor(15, 23, 42)
        pdf.rect(0, 0, pageWidth, headerHeight, 'F')

        // Marca tipográfica oficial HENDAYA en tono Cyan/Sky
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(13)
        pdf.setTextColor(56, 189, 248) // Sky-400
        pdf.text('H E N D A Y A', marginX, 11)

        // Separador vertical sutil
        pdf.setDrawColor(71, 85, 105) // slate-600
        pdf.setLineWidth(0.3)
        pdf.line(marginX + 42, 3.5, marginX + 42, 14.5)

        // Título del reporte
        pdf.setFontSize(10)
        pdf.setTextColor(255, 255, 255)
        pdf.text('TABLERO DE MONITOREO RRHH', marginX + 48, 8.5)

        // Subtítulo y fecha de emisión
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        pdf.setTextColor(148, 163, 184) // slate-400
        const fechaHora = new Date().toLocaleString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
        const subInfo = `Vista: ${options.tabName}  •  Generado: ${fechaHora} hrs${
            options.usuarioNombre ? ` por ${options.usuarioNombre}` : ''
        }`
        pdf.text(subInfo, marginX + 48, 14)

        // Filtro activo a la derecha
        if (options.filtroActivo) {
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(7.5)
            pdf.setTextColor(56, 189, 248)
            pdf.text(options.filtroActivo, pageWidth - marginX, 11, { align: 'right' })
        }

        // Línea decorativa Cyan (#0ea5e9) inferior del header
        pdf.setDrawColor(14, 165, 233)
        pdf.setLineWidth(0.8)
        pdf.line(0, headerHeight, pageWidth, headerHeight)

        // --- PIE DE PÁGINA ---
        pdf.setDrawColor(226, 232, 240) // slate-200
        pdf.setLineWidth(0.3)
        pdf.line(marginX, pageHeight - 9, pageWidth - marginX, pageHeight - 9)

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7)
        pdf.setTextColor(100, 116, 139) // slate-500
        pdf.text(
            'Documento Oficial • Hendaya App • Sistema de Control de Gestión RRHH • Uso Interno Confidencial',
            marginX,
            pageHeight - 5
        )
        pdf.text(`Página ${pageNum} de ${totalPages}`, pageWidth - marginX, pageHeight - 5, {
            align: 'right',
        })
    }

    // Si todo cabe en una página, lo centramos verticalmente
    if (totalPages === 1) {
        dibujarHeaderYFooter(1)
        const posY = contentTopY + Math.max(0, (usableHeightPerPage - totalImageHeightMm) / 2)
        const imgData = canvas.toDataURL('image/png')
        pdf.addImage(imgData, 'PNG', marginX, posY, usableWidth, totalImageHeightMm, undefined, 'FAST')
    } else {
        // Si ocupa múltiples páginas, rebanamos el canvas con precisión para evitar solapamientos con el header y footer
        const sliceHeightPx = Math.floor(canvas.height / totalPages)

        for (let i = 0; i < totalPages; i++) {
            if (i > 0) {
                pdf.addPage()
            }
            dibujarHeaderYFooter(i + 1)

            const sourceY = i * sliceHeightPx
            const currentSliceHeightPx = Math.min(sliceHeightPx, canvas.height - sourceY)

            const sliceCanvas = document.createElement('canvas')
            sliceCanvas.width = canvas.width
            sliceCanvas.height = currentSliceHeightPx

            const ctx = sliceCanvas.getContext('2d')
            if (ctx) {
                ctx.drawImage(
                    canvas,
                    0,
                    sourceY,
                    canvas.width,
                    currentSliceHeightPx,
                    0,
                    0,
                    canvas.width,
                    currentSliceHeightPx
                )
                const sliceImgData = sliceCanvas.toDataURL('image/png')
                const sliceHeightMm = (currentSliceHeightPx * usableWidth) / canvas.width
                pdf.addImage(
                    sliceImgData,
                    'PNG',
                    marginX,
                    contentTopY,
                    usableWidth,
                    sliceHeightMm,
                    undefined,
                    'FAST'
                )
            }
        }
    }

    // 3. Descargar el archivo con nombre descriptivo
    const cleanTab = options.tabName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
    const fechaFile = new Date().toISOString().slice(0, 10)
    const fileName = `Reporte_Ceramicas_RRHH_${cleanTab}_${fechaFile}.pdf`

    pdf.save(fileName)
}

