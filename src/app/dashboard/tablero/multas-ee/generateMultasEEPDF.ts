import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ExportPDFParams {
    stats: any
    filters: {
        licitacion: string
        ano: string
        mes: string
        sucursal: string
        supervisor?: string
    }
    userName?: string
}

const MONTH_NAMES: Record<string, string> = {
    "1": "Enero", "2": "Febrero", "3": "Marzo", "4": "Abril",
    "5": "Mayo", "6": "Junio", "7": "Julio", "8": "Agosto",
    "9": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
}

const formatCLP = (val: number) => {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(val || 0)
}

export async function generateMultasEEPDF({ stats, filters, userName }: ExportPDFParams) {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    })

    const autoTableFn = (autoTable as any).default || autoTable

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14
    const contentWidth = pageWidth - margin * 2
    let currentY = 15

    // Colors
    const primaryColor = '#0f172a' // Slate 900
    const cyanColor = '#0891b2'    // Cyan 600
    const emeraldColor = '#059669' // Emerald 600
    const redColor = '#dc2626'     // Red 600
    const lightBg = '#f8fafc'      // Slate 50
    const borderColor = '#cbd5e1'  // Slate 300

    // --- PAGE HEADER (PAGE 1) ---
    // Background bar header
    doc.setFillColor(15, 23, 42) // Slate 900
    doc.rect(0, 0, pageWidth, 28, 'F')

    // Cyan accent strip
    doc.setFillColor(0, 210, 254) // #00d2fe Cyan
    doc.rect(0, 28, pageWidth, 2, 'F')

    // Official Hendaya Logo (Cyan text matching Imagen 2)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(0, 210, 254)
    doc.text('HENDAYA', margin, 17)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(255, 255, 255)
    doc.text('S.A.C.  |  SISTEMA DE GESTIÓN', margin, 23)

    // Report Title Header Right
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(255, 255, 255)
    doc.text('INFORME GERENCIAL - MULTAS EE', pageWidth - margin, 13, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(203, 213, 225)
    const fechaEmision = new Date().toLocaleDateString('es-CL', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    doc.text(`Fecha de emisión: ${fechaEmision} ${userName ? `| ${userName}` : ''}`, pageWidth - margin, 19, { align: 'right' })

    currentY = 36

    // --- FILTERS SUMMARY BAR ---
    doc.setFillColor(248, 250, 252) // Slate 50
    doc.setDrawColor(226, 232, 240) // Slate 200
    doc.roundedRect(margin, currentY, contentWidth, 14, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(15, 23, 42)
    doc.text('Filtros Aplicados:', margin + 4, currentY + 9)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(51, 65, 85)

    const licTxt = filters.licitacion ? `Licitación: ${filters.licitacion}` : 'Licitación: Todas'
    const anoTxt = filters.ano ? `Año: ${filters.ano}` : 'Año: Todos'
    const mesTxt = filters.mes ? `Mes: ${MONTH_NAMES[filters.mes] || filters.mes}` : 'Mes: Todos'
    const sucTxt = filters.sucursal ? `Sucursal: ${filters.sucursal}` : 'Sucursal: Todas'
    const supTxt = filters.supervisor ? `Supervisor: ${filters.supervisor}` : 'Supervisor: Todos'

    doc.text(`${licTxt}   |   ${anoTxt}   |   ${mesTxt}   |   ${sucTxt}   |   ${supTxt}`, margin + 34, currentY + 9)

    currentY += 20

    // --- KPI CARDS (5 METRICS) ---
    const totalMonto = stats.totals?.totalMonto || 0
    const totalSol = stats.totals?.totalSolucionable || 0
    const totalNoSol = stats.totals?.totalNoSolucionable || 0
    const pctSol = totalMonto > 0 ? ((totalSol / totalMonto) * 100).toFixed(1) : '0'
    const pctNoSol = totalMonto > 0 ? ((totalNoSol / totalMonto) * 100).toFixed(1) : '0'

    const kpiBoxWidth = (contentWidth - 8) / 5
    const kpiHeight = 22

    const kpis = [
        { label: 'MONTO TOTAL MULTA', val: formatCLP(totalMonto), sub: `${stats.totals?.totalNc || 0} NC registradas`, color: primaryColor, border: primaryColor },
        { label: 'SOLUCIONABLE', val: formatCLP(totalSol), sub: `${pctSol}% del total`, color: emeraldColor, border: emeraldColor },
        { label: 'NO SOLUCIONABLE', val: formatCLP(totalNoSol), sub: `${pctNoSol}% del total`, color: redColor, border: redColor },
        { label: 'FOLIOS AFECTADOS', val: `${stats.totals?.totalFolios || 0}`, sub: 'Folios de supervisión', color: cyanColor, border: cyanColor },
        { label: 'HALLAZGOS (NC)', val: `${stats.totals?.totalNc || 0}`, sub: 'Elementos no conformes', color: '#4f46e5', border: '#4f46e5' }
    ]

    kpis.forEach((kpi, idx) => {
        const x = margin + idx * (kpiBoxWidth + 2)
        
        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(226, 232, 240)
        doc.roundedRect(x, currentY, kpiBoxWidth, kpiHeight, 2, 2, 'FD')

        doc.setFillColor(kpi.border)
        doc.rect(x, currentY, kpiBoxWidth, 1.5, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6)
        doc.setTextColor(100, 116, 139)
        doc.text(kpi.label, x + kpiBoxWidth / 2, currentY + 6, { align: 'center' })

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(15, 23, 42)
        doc.text(kpi.val, x + kpiBoxWidth / 2, currentY + 12, { align: 'center' })

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(148, 163, 184)
        doc.text(kpi.sub, x + kpiBoxWidth / 2, currentY + 18, { align: 'center' })
    })

    currentY += kpiHeight + 10

    // --- HELPER SECTION TITLE (WITHOUT EMOJIS TO PREVENT MOJIBAKE) ---
    const addSectionTitle = (title: string) => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(15, 23, 42)
        doc.text(title, margin, currentY)

        doc.setFillColor(8, 145, 178)
        doc.rect(margin, currentY + 2, 25, 0.8, 'F')
        doc.setFillColor(226, 232, 240)
        doc.rect(margin + 25, currentY + 2.3, contentWidth - 25, 0.2, 'F')

        currentY += 7
    }

    // --- TABLE 1: RESUMEN SOP Y JOP ---
    if (stats.sopJopStats && stats.sopJopStats.length > 0) {
        addSectionTitle('RESUMEN SOP Y JOP (ACTAS DE SUPERVISIÓN)')

        const sopJopRows: any[] = []
        let totalActasSopJop = 0

        stats.sopJopStats.forEach((jop: any) => {
            totalActasSopJop += jop.actas
            sopJopRows.push([
                { content: `${jop.nombre} (Jefe de Operaciones)`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
                { content: jop.actas.toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } }
            ])
            if (jop.subItems && jop.subItems.length > 0) {
                jop.subItems.forEach((sub: any) => {
                    sopJopRows.push([
                        `   • ${sub.nombre}`,
                        { content: sub.actas.toString(), styles: { halign: 'right' } }
                    ])
                })
            }
        })

        sopJopRows.push([
            { content: 'TOTAL ACTAS CONSOLIDADAS', styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } },
            { content: totalActasSopJop.toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [226, 232, 240] } }
        ])

        autoTableFn(doc, {
            startY: currentY,
            head: [['SOP y JOP (Jefaturas y Supervisores)', 'Cantidad de Actas']],
            body: sopJopRows,
            theme: 'grid',
            headStyles: { fillColor: [8, 145, 178], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59] },
            columnStyles: {
                0: { cellWidth: contentWidth * 0.75 },
                1: { cellWidth: contentWidth * 0.25, halign: 'right' }
            },
            margin: { left: margin, right: margin }
        })

        currentY = (doc as any).lastAutoTable.finalY + 8
    }

    // --- TABLE 2: EVOLUCIÓN ANUAL ---
    if (stats.anualStats && stats.anualStats.length > 0) {
        if (currentY > pageHeight - 50) {
            doc.addPage()
            currentY = 20
        }

        addSectionTitle('EVOLUCIÓN ANUAL DE MULTAS')

        const anualRows = stats.anualStats.map((item: any) => [
            item.year.toString(),
            formatCLP(item.solucionable),
            formatCLP(item.noSolucionable),
            formatCLP(item.total)
        ])

        autoTableFn(doc, {
            startY: currentY,
            head: [['Año', 'Monto Solucionable (CLP)', 'Monto No Solucionable (CLP)', 'Total Multa (CLP)']],
            body: anualRows,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59] },
            columnStyles: {
                0: { cellWidth: contentWidth * 0.25, fontStyle: 'bold' },
                1: { cellWidth: contentWidth * 0.25, halign: 'right' },
                2: { cellWidth: contentWidth * 0.25, halign: 'right' },
                3: { cellWidth: contentWidth * 0.25, halign: 'right', fontStyle: 'bold' }
            },
            margin: { left: margin, right: margin }
        })

        currentY = (doc as any).lastAutoTable.finalY + 8
    }

    // --- TABLE 2B: EVOLUCIÓN MENSUAL (REQUEST 3) ---
    if (stats.mensualStats && stats.mensualStats.length > 0) {
        if (currentY > pageHeight - 50) {
            doc.addPage()
            currentY = 20
        }

        addSectionTitle('EVOLUCIÓN MENSUAL DE MULTAS')

        const mensualRows = stats.mensualStats.map((item: any) => [
            item.monthName,
            formatCLP(item.solucionable),
            formatCLP(item.noSolucionable),
            formatCLP(item.total)
        ])

        autoTableFn(doc, {
            startY: currentY,
            head: [['Mes', 'Monto Solucionable (CLP)', 'Monto No Solucionable (CLP)', 'Total Multa (CLP)']],
            body: mensualRows,
            theme: 'grid',
            headStyles: { fillColor: [8, 145, 178], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59] },
            columnStyles: {
                0: { cellWidth: contentWidth * 0.25, fontStyle: 'bold' },
                1: { cellWidth: contentWidth * 0.25, halign: 'right' },
                2: { cellWidth: contentWidth * 0.25, halign: 'right' },
                3: { cellWidth: contentWidth * 0.25, halign: 'right', fontStyle: 'bold' }
            },
            margin: { left: margin, right: margin }
        })

        currentY = (doc as any).lastAutoTable.finalY + 8
    }

    // --- TABLE 3: DISTRIBUCIÓN POR ASPECTO MULTADO (REQUEST 4: DESCRIPCIÓN SOLAMENTE) ---
    if (stats.aspectStats && stats.aspectStats.length > 0) {
        if (currentY > pageHeight - 60) {
            doc.addPage()
            currentY = 20
        }

        addSectionTitle('DISTRIBUCIÓN POR ASPECTO MULTADO')

        const aspectRows = stats.aspectStats.slice(0, 10).map((asp: any) => {
            const aspTitle = asp.aspecto || `Aspecto ${asp.letra || ''}`;
            const descTxt = asp.descripcion && asp.descripcion !== aspTitle ? asp.descripcion : '';
            const fullLabel = descTxt ? `${aspTitle} - ${descTxt}` : aspTitle;
            return [
                fullLabel,
                asp.count.toString(),
                formatCLP(asp.monto)
            ];
        })

        autoTableFn(doc, {
            startY: currentY,
            head: [['Aspecto y Descripción', 'Hallazgos (NC)', 'Monto Multa (CLP)']],
            body: aspectRows,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 2, textColor: [30, 41, 59] },
            columnStyles: {
                0: { cellWidth: contentWidth * 0.60 },
                1: { cellWidth: contentWidth * 0.18, halign: 'center' },
                2: { cellWidth: contentWidth * 0.22, halign: 'right', fontStyle: 'bold' }
            },
            margin: { left: margin, right: margin }
        })

        currentY = (doc as any).lastAutoTable.finalY + 8
    }

    // --- TABLE 4: REGIONES MÁS MULTADAS ---
    if (stats.regionStats && stats.regionStats.length > 0) {
        if (currentY > pageHeight - 50) {
            doc.addPage()
            currentY = 20
        }

        addSectionTitle('CLASIFICACIÓN POR REGIONES')

        const regionRows = stats.regionStats.map((reg: any) => [
            reg.region,
            reg.folios.toString(),
            reg.nc.toString(),
            formatCLP(reg.monto)
        ])

        autoTableFn(doc, {
            startY: currentY,
            head: [['Región', 'Folios Afectados', 'Hallazgos (NC)', 'Monto Multa (CLP)']],
            body: regionRows,
            theme: 'grid',
            headStyles: { fillColor: [8, 145, 178], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59] },
            columnStyles: {
                0: { cellWidth: contentWidth * 0.40, fontStyle: 'bold' },
                1: { cellWidth: contentWidth * 0.20, halign: 'center' },
                2: { cellWidth: contentWidth * 0.20, halign: 'center' },
                3: { cellWidth: contentWidth * 0.20, halign: 'right', fontStyle: 'bold' }
            },
            margin: { left: margin, right: margin }
        })

        currentY = (doc as any).lastAutoTable.finalY + 8
    }

    // --- TABLE 5: TOP 10 RBDS MÁS MULTADOS (REQUEST 5: CON SUCURSAL EN PARENTESIS) ---
    if (stats.topSchools && stats.topSchools.length > 0) {
        if (currentY > pageHeight - 60) {
            doc.addPage()
            currentY = 20
        }

        addSectionTitle('TOP 10 ESTABLECIMIENTOS (RBD) MÁS MULTADOS')

        const schoolRows = stats.topSchools.map((sch: any) => [
            sch.rbd.toString(),
            sch.nombreEstablecimiento || 'Desconocido',
            sch.folios.toString(),
            sch.nc.toString(),
            formatCLP(sch.monto)
        ])

        autoTableFn(doc, {
            startY: currentY,
            head: [['RBD', 'Establecimiento (Sucursal)', 'Folios', 'Hallazgos (NC)', 'Monto Multa (CLP)']],
            body: schoolRows,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 2, textColor: [30, 41, 59] },
            columnStyles: {
                0: { cellWidth: contentWidth * 0.12, fontStyle: 'bold' },
                1: { cellWidth: contentWidth * 0.48 },
                2: { cellWidth: contentWidth * 0.10, halign: 'center' },
                3: { cellWidth: contentWidth * 0.12, halign: 'center' },
                4: { cellWidth: contentWidth * 0.18, halign: 'right', fontStyle: 'bold' }
            },
            margin: { left: margin, right: margin }
        })

        currentY = (doc as any).lastAutoTable.finalY + 8
    }

    // --- TABLE 6: TOP SUPERVISORES MÁS MULTADOS ---
    if (stats.supervisorStats && stats.supervisorStats.length > 0) {
        if (currentY > pageHeight - 60) {
            doc.addPage()
            currentY = 20
        }

        addSectionTitle('RANKING SUPERVISORES MÁS MULTADOS')

        const supervisorRows = stats.supervisorStats.map((sup: any) => [
            sup.supervisor,
            sup.sucursal || 'Sin Sucursal',
            sup.rbdCount.toString(),
            sup.nc.toString(),
            formatCLP(sup.monto)
        ])

        autoTableFn(doc, {
            startY: currentY,
            head: [['Supervisor', 'Sucursal', 'RBDs Auditados', 'Hallazgos (NC)', 'Monto Multa (CLP)']],
            body: supervisorRows,
            theme: 'grid',
            headStyles: { fillColor: [8, 145, 178], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 2, textColor: [30, 41, 59] },
            columnStyles: {
                0: { cellWidth: contentWidth * 0.35, fontStyle: 'bold' },
                1: { cellWidth: contentWidth * 0.25 },
                2: { cellWidth: contentWidth * 0.12, halign: 'center' },
                3: { cellWidth: contentWidth * 0.10, halign: 'center' },
                4: { cellWidth: contentWidth * 0.18, halign: 'right', fontStyle: 'bold' }
            },
            margin: { left: margin, right: margin }
        })
    }

    // --- FOOTERS ON ALL PAGES ---
    const totalPages = doc.getNumberOfPages() ? doc.getNumberOfPages() : (doc as any).internal.getNumberOfPages()

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)

        doc.setFillColor(226, 232, 240)
        doc.rect(margin, pageHeight - 12, contentWidth, 0.4, 'F')

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(148, 163, 184)
        doc.text('HENDAYA S.A.C. — Documento Confidencial para Uso Interno de la Gerencia', margin, pageHeight - 7)
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' })
    }

    // Save File
    const cleanDate = new Date().toISOString().slice(0, 10)
    doc.save(`Informe_Gerencial_Multas_EE_${cleanDate}.pdf`)
}
