import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'

export interface ExportarCeramicasPdfOptions {
    tabName: string
    titulo: string
    subtitulo?: string
    filtroActivo?: string
    usuarioNombre?: string
    cardsPerPage?: number // 2, 4 o 6 tarjetas por hoja (por defecto 2)
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
        pdf.text(options.titulo || 'TABLERO DE MONITOREO RRHH', marginX + 48, 8.5)

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
    // Distribución: Página 1 con KPIs (si existen) y siguientes páginas con N tarjetas por hoja (por defecto 2, o 4/6 según opción)
    // =========================================================================
    if (individualCards.length > 0) {
        const cardsPerPage = options.cardsPerPage === 6 || options.cardsPerPage === 4 ? options.cardsPerPage : 2
        let cols = 2
        let rows = 1
        let colWidth = 129
        let gapX = 11
        let rowHeight = usableHeightPerPage
        let gapY = 0

        if (cardsPerPage === 6) {
            cols = 2
            rows = 3
            colWidth = 130
            gapX = 9
            rowHeight = 54
            gapY = 5
        } else if (cardsPerPage === 4) {
            cols = 2
            rows = 2
            colWidth = 130
            gapX = 9
            rowHeight = 82
            gapY = 8
        }

        const hasKpiPage = Boolean(kpiSection)
        const cardPagesCount = Math.ceil(individualCards.length / cardsPerPage)
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

        // 1.2 Páginas de Cerámicas: Distribución en grilla sin cortes
        for (let i = 0; i < individualCards.length; i += cardsPerPage) {
            const pageCards = individualCards.slice(i, i + cardsPerPage)
            notify(`Generando página ${currentPage} de ${totalPages} (Registros ${i + 1} a ${Math.min(i + cardsPerPage, individualCards.length)})...`)

            if (currentPage > 1) {
                pdf.addPage()
            }
            dibujarHeaderYFooter(currentPage, totalPages)

            if (cardsPerPage === 2 && pageCards.length === 1) {
                // Caso última tarjeta impar en modo 2 por hoja: centrarla elegantemente
                const singleCardWidth = 145
                const canvasA = await html2canvas(pageCards[0], {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                })
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
            } else {
                for (let c = 0; c < pageCards.length; c++) {
                    const cardElem = pageCards[c]
                    const col = c % cols
                    const row = Math.floor(c / cols)

                    const slotX = marginX + col * (colWidth + gapX)
                    const slotY = contentTopY + row * (rowHeight + gapY)

                    const canvas = await html2canvas(cardElem, {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff',
                    })

                    let w = colWidth
                    let h = (canvas.height * w) / canvas.width

                    if (h > rowHeight) {
                        const scaleFactor = rowHeight / h
                        h = rowHeight
                        w = w * scaleFactor
                    }

                    const posX = slotX + (colWidth - w) / 2
                    const posY = slotY + (rowHeight - h) / 2

                    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', posX, posY, w, h, undefined, 'FAST')
                }
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
    const prefix = options.titulo ? options.titulo.replace(/[^a-zA-Z0-9]+/g, '_') : 'Reporte_Ceramicas_RRHH'
    const fileName = `${prefix}_${cleanTab}_${fechaFile}.pdf`

    pdf.save(fileName)
}
