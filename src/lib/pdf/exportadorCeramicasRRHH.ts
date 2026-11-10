import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'

export interface ExportarCeramicasPdfOptions {
    tabName: string
    titulo: string
    subtitulo?: string
    filtroActivo?: string
    usuarioNombre?: string
    onProgress?: (mensaje: string) => void
}

/**
 * Motor de exportación PDF oficial Hendaya para cerámicas de RRHH.
 * Cumple con el requerimiento de:
 * 1. NUNCA cortar ningún cuadro o tarjeta (0 cerámicas cortadas).
 * 2. Mostrar exactamente 2 cerámicas por hoja (lado a lado, ajustadas y proporcionadas).
 * 3. En modo KPIs/Resumen, ajustar y achicar para que quepa 100% en 1 sola hoja sin desbordar.
 * 4. Identidad oficial Hendaya: Marca tipográfica Cyan/Sky, sin logos PNG de terceros.
 */
export async function exportarCeramicasAPdf(
    element: HTMLElement,
    options: ExportarCeramicasPdfOptions
): Promise<void> {
    const notify = (msg: string) => {
        if (options.onProgress) options.onProgress(msg)
    }

    notify('Iniciando preparación del reporte PDF oficial...')

    // Configurar documento PDF A4 en orientación Horizontal (Landscape)
    // Dimensiones: 297 mm ancho x 210 mm alto
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
    })

    const pageWidth = 297
    const pageHeight = 210

    // Márgenes y áreas de dibujo
    const marginX = 14
    const headerHeight = 18
    const footerMargin = 12
    const contentTopY = 22
    const contentBottomY = pageHeight - footerMargin
    const usableHeightPerPage = contentBottomY - contentTopY // ~176 mm
    const usableWidth = pageWidth - marginX * 2 // 269 mm

    // Buscar sección de KPIs principales y tarjetas individuales de cerámicas
    const kpiSection = element.querySelector('[data-pdf-kpi="true"]') as HTMLElement | null
    const individualCards = Array.from(element.querySelectorAll('[data-pdf-card="true"]')) as HTMLElement[]

    // Función para dibujar encabezado y pie de página oficiales de Hendaya
    const dibujarHeaderYFooter = (pageNum: number, totalPages: number) => {
        // --- CABECERA CORPORATIVA ---
        pdf.setFillColor(15, 23, 42) // slate-900
        pdf.rect(0, 0, pageWidth, headerHeight, 'F')

        // Marca tipográfica oficial HENDAYA en tono Cyan/Sky
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(13)
        pdf.setTextColor(56, 189, 248) // Sky-400
        pdf.text('H E N D A Y A', marginX, 11)

        // Separador vertical
        pdf.setDrawColor(71, 85, 105) // slate-600
        pdf.setLineWidth(0.3)
        pdf.line(marginX + 42, 3.5, marginX + 42, 14.5)

        // Título del reporte
        pdf.setFontSize(10)
        pdf.setTextColor(255, 255, 255)
        pdf.text('TABLERO DE MONITOREO RRHH', marginX + 48, 8.5)

        // Subtítulo con fecha y hora
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

        // Línea decorativa Cyan (#0ea5e9) inferior
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

    // =========================================================================
    // CASO 1: Si hay tarjetas individuales identificadas ([data-pdf-card="true"])
    // Distribución: Página 1 con KPIs (si existen) y siguientes páginas con 2 cerámicas por hoja
    // =========================================================================
    if (individualCards.length > 0) {
        const hasKpiPage = Boolean(kpiSection)
        const cardPagesCount = Math.ceil(individualCards.length / 2)
        const totalPages = (hasKpiPage ? 1 : 0) + cardPagesCount
        let currentPage = 1

        // 1.1 Página 1: KPIs Ejecutivos (si existen)
        if (kpiSection) {
            notify(`Generando página 1 de ${totalPages} (Cerámicas Ejecutivas)...`)
            dibujarHeaderYFooter(currentPage, totalPages)

            const kpiCanvas = await html2canvas(kpiSection, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#f8fafc',
            })

            let drawWidth = usableWidth
            let drawHeight = (kpiCanvas.height * drawWidth) / kpiCanvas.width

            // Si es más alto que el área disponible, achicar proporcionalmente para que no se corte
            if (drawHeight > usableHeightPerPage) {
                const scale = usableHeightPerPage / drawHeight
                drawHeight = usableHeightPerPage
                drawWidth = drawWidth * scale
            }

            const posX = marginX + (usableWidth - drawWidth) / 2
            const posY = contentTopY + (usableHeightPerPage - drawHeight) / 2
            pdf.addImage(kpiCanvas.toDataURL('image/png'), 'PNG', posX, posY, drawWidth, drawHeight, undefined, 'FAST')
            currentPage++
        }

        // 1.2 Páginas de Cerámicas: Exactamente 2 cerámicas por hoja (lado a lado)
        for (let i = 0; i < individualCards.length; i += 2) {
            notify(`Generando página ${currentPage} de ${totalPages} (Cerámicas ${i + 1} y ${Math.min(i + 2, individualCards.length)})...`)

            if (currentPage > 1) {
                pdf.addPage()
            }
            dibujarHeaderYFooter(currentPage, totalPages)

            const cardA = individualCards[i]
            const cardB = individualCards[i + 1] as HTMLElement | undefined

            // Ancho para 2 columnas con separación
            const cardColWidth = 129 // mm
            const cardGap = 11 // mm
            const slotX_A = marginX // 14 mm
            const slotX_B = marginX + cardColWidth + cardGap // 154 mm

            // Capturar Tarjeta A
            const canvasA = await html2canvas(cardA, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
            })

            if (cardB) {
                // Capturar Tarjeta B
                const canvasB = await html2canvas(cardB, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                })

                // Calcular dimensiones proporcionales para Tarjeta A
                let wA = cardColWidth
                let hA = (canvasA.height * wA) / canvasA.width
                if (hA > usableHeightPerPage) {
                    const s = usableHeightPerPage / hA
                    hA = usableHeightPerPage
                    wA = wA * s
                }

                // Calcular dimensiones proporcionales para Tarjeta B
                let wB = cardColWidth
                let hB = (canvasB.height * wB) / canvasB.width
                if (hB > usableHeightPerPage) {
                    const s = usableHeightPerPage / hB
                    hB = usableHeightPerPage
                    wB = wB * s
                }

                // Centrar verticalmente cada tarjeta en su ranura
                const posXA = slotX_A + (cardColWidth - wA) / 2
                const posYA = contentTopY + (usableHeightPerPage - hA) / 2
                const posXB = slotX_B + (cardColWidth - wB) / 2
                const posYB = contentTopY + (usableHeightPerPage - hB) / 2

                pdf.addImage(canvasA.toDataURL('image/png'), 'PNG', posXA, posYA, wA, hA, undefined, 'FAST')
                pdf.addImage(canvasB.toDataURL('image/png'), 'PNG', posXB, posYB, wB, hB, undefined, 'FAST')
            } else {
                // Caso última tarjeta impar: centrarla elegantemente en la hoja
                const singleCardWidth = 145 // mm
                let wA = singleCardWidth
                let hA = (canvasA.height * wA) / canvasA.width
                if (hA > usableHeightPerPage) {
                    const s = usableHeightPerPage / hA
                    hA = usableHeightPerPage
                    wA = wA * s
                }

                const posXA = marginX + (usableWidth - wA) / 2
                const posYA = contentTopY + (usableHeightPerPage - hA) / 2

                pdf.addImage(canvasA.toDataURL('image/png'), 'PNG', posXA, posYA, wA, hA, undefined, 'FAST')
            }

            currentPage++
        }
    } else {
        // =========================================================================
        // CASO 2: Modo Resumen / Solo Cerámicas Ejecutivas (1 sola hoja garantizada)
        // Se achica proporcionalmente si es necesario para que NUNCA se corte ningún cuadro
        // =========================================================================
        notify('Generando hoja ejecutiva (ajuste automático sin cortes)...')

        const target = kpiSection || element
        const canvas = await html2canvas(target, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#f8fafc',
            windowWidth: target.scrollWidth,
        })

        dibujarHeaderYFooter(1, 1)

        let drawWidth = usableWidth
        let drawHeight = (canvas.height * drawWidth) / canvas.width

        // Achicar proporcionalmente si excede la altura de la página para que quepa completa
        if (drawHeight > usableHeightPerPage) {
            const scaleFactor = usableHeightPerPage / drawHeight
            drawHeight = usableHeightPerPage
            drawWidth = drawWidth * scaleFactor
        }

        const posX = marginX + (usableWidth - drawWidth) / 2
        const posY = contentTopY + (usableHeightPerPage - drawHeight) / 2

        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', posX, posY, drawWidth, drawHeight, undefined, 'FAST')
    }

    // Descargar el documento PDF con nombre representativo
    const cleanTab = options.tabName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
    const fechaFile = new Date().toISOString().slice(0, 10)
    const fileName = `Reporte_Ceramicas_RRHH_${cleanTab}_${fechaFile}.pdf`

    pdf.save(fileName)
}
