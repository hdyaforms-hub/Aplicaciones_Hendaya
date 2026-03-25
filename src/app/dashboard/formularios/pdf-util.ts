import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export const generateFormPDF = (form: any, submissionData: any) => {
    const doc = new jsPDF()
    const title = form.title || 'Formulario'
    
    // --- ESTILO Y COLORES ---
    const primaryColor = [15, 23, 42] // Slate 900
    // const accentColor = [8, 145, 178] // Cyan 600
    
    // --- ENCABEZADO MODERNO ---
    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, 210, 45, 'F')
    
    doc.setFillColor(8, 145, 178) // Cyan 600
    doc.rect(0, 45, 210, 1.5, 'F')
    
    doc.setTextColor(34, 211, 238) // Cyan 400
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(28)
    doc.text('HENDAYA', 15, 20)
    
    doc.setDrawColor(51, 65, 85)
    doc.line(75, 10, 75, 35)
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(title.toUpperCase(), 82, 20)
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text('SISTEMA DE GESTIÓN DINÁMICA DE FORMULARIOS', 82, 26)
    
    if (form.formCode || form.formVersion || form.formDate) {
        doc.setFontSize(8)
        doc.setTextColor(165, 180, 252)
        let info = []
        if (form.formCode) info.push(`CÓDIGO: ${form.formCode}`)
        if (form.formVersion) info.push(`VERSIÓN: ${form.formVersion}`)
        if (form.formDate) info.push(`FECHA: ${form.formDate}`)
        doc.text(info.join('   |   '), 82, 32)
    }
    
    doc.setTextColor(51, 65, 85)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('HENDAYA FORMS HUB', 170, 35)
    
    // --- PREPARACIÓN DE DATOS ---
    const tableData: any[][] = []
    
    // Ensure fields is an object if it comes as string
    const fields = typeof form.fields === 'string' ? JSON.parse(form.fields) : form.fields

    fields.forEach((f: any) => {
        if (f.type === 'section') {
            tableData.push([{ 
                content: f.label.toUpperCase(), 
                colSpan: 2, 
                styles: { 
                    fillColor: [241, 245, 249], 
                    fontStyle: 'bold', 
                    textColor: [15, 23, 42], 
                    halign: 'left',
                    fontSize: 11,
                    cellPadding: { top: 7, bottom: 4, left: 5 }
                } 
            }])
        } else {
            let val = submissionData[f.id]
            if (val === undefined || val === null || val === '') {
                val = 'No registrado'
            } else if (f.type === 'signature') {
                val = '[FIRMA DIGITAL REGISTRADA]'
            } else if (typeof val === 'object' && val.url) {
                val = `ADJUNTO: ${val.name || val.url}`
            } else if (Array.isArray(val)) {
                val = val.join(', ')
            }
            tableData.push([f.label, val])
        }
    })

    autoTable(doc, {
        startY: 55,
        head: [['CAMPO / PREGUNTA', 'RESPUESTA / VALOR REGISTRADO']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
            fillColor: [15, 23, 42], 
            textColor: [255, 255, 255], 
            fontStyle: 'bold',
            fontSize: 10,
            cellPadding: 5
        },
        bodyStyles: { 
            fontSize: 10, 
            cellPadding: 5,
            textColor: [51, 65, 85]
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 70, textColor: [15, 23, 42] },
            1: { fontStyle: 'normal' }
        },
        alternateRowStyles: {
            fillColor: [252, 252, 252]
        },
        margin: { left: 15, right: 15 }
    })
    
    // --- RENDERIZADO DE FIRMAS ---
    let yPos = (doc as any).lastAutoTable.finalY + 15
    fields.forEach((f: any) => {
        if (f.type === 'signature') {
            const sigData = submissionData[f.id]
            if (sigData && sigData.startsWith('data:image')) {
                // Verificar espacio en la página
                if (yPos > 240) {
                    doc.addPage()
                    yPos = 25
                }
                
                doc.setFontSize(9)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(15, 23, 42)
                doc.text(`FIRMA: ${f.label.toUpperCase()}`, 15, yPos)
                
                // Dibujar línea de firma
                doc.setDrawColor(203, 213, 225)
                doc.line(15, yPos + 18, 75, yPos + 18)
                
                doc.addImage(sigData, 'PNG', 15, yPos + 2, 60, 15)
                yPos += 30
            }
        }
    })

    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(`Documento de control interno generado por Hendaya Forms Hub el ${new Date().toLocaleString()}`, 15, doc.internal.pageSize.height - 15)
        doc.setDrawColor(226, 232, 240)
        doc.line(15, doc.internal.pageSize.height - 20, 195, doc.internal.pageSize.height - 20)
        doc.setFont('helvetica', 'bold')
        doc.text(`PÁGINA ${i} DE ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 15)
    }

    return doc
}

export const generateBlankFormPDF = (form: any) => {
    const doc = new jsPDF()
    const title = form.title || 'Formulario (Versión Offline)'
    
    // --- ESTILO Y COLORES ---
    const primaryColor = [15, 23, 42] // Slate 900
    
    // --- ENCABEZADO MODERNO ---
    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, 210, 45, 'F')
    
    doc.setFillColor(8, 145, 178) // Cyan 600
    doc.rect(0, 45, 210, 1.5, 'F')
    
    doc.setTextColor(34, 211, 238) // Cyan 400
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(28)
    doc.text('HENDAYA', 15, 20)
    
    doc.setDrawColor(51, 65, 85)
    doc.line(75, 10, 75, 35)
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(title.toUpperCase(), 82, 20)
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text('VERSIÓN PARA LLENADO MANUAL (OFFLINE)', 82, 26)
    
    if (form.formCode || form.formVersion || form.formDate) {
        doc.setFontSize(8)
        doc.setTextColor(165, 180, 252)
        let info = []
        if (form.formCode) info.push(`CÓDIGO: ${form.formCode}`)
        if (form.formVersion) info.push(`VERSIÓN: ${form.formVersion}`)
        if (form.formDate) info.push(`FECHA: ${form.formDate}`)
        doc.text(info.join('   |   '), 82, 32)
    }
    
    // --- PREPARACIÓN DE TABLA VACÍA ---
    const tableData: any[][] = []
    const fields = typeof form.fields === 'string' ? JSON.parse(form.fields) : form.fields

    fields.forEach((f: any) => {
        if (f.type === 'section') {
            tableData.push([{ 
                content: f.label.toUpperCase(), 
                colSpan: 2, 
                styles: { 
                    fillColor: [241, 245, 249], 
                    fontStyle: 'bold', 
                    textColor: [15, 23, 42], 
                    halign: 'left',
                    fontSize: 11,
                    cellPadding: { top: 7, bottom: 4, left: 5 }
                } 
            }])
        } else {
            // Placeholder boxes or lines depending on type
            let placeholder = '________________________________________________'
            if (f.type === 'signature') {
                placeholder = '\n\n\n\n__________________________\nFirma'
            } else if (f.type === 'selection') {
                placeholder = '[  ] ' + (f.options ? f.options.split(',').join('   [  ] ') : 'Opciones')
            }
            tableData.push([f.label, placeholder])
        }
    })

    autoTable(doc, {
        startY: 55,
        head: [['CAMPO / PREGUNTA', 'RESPUESTA A MANO']],
        body: tableData,
        theme: 'grid', // Grid is better for manual filling
        headStyles: { 
            fillColor: [15, 23, 42], 
            textColor: [255, 255, 255], 
            fontStyle: 'bold',
            fontSize: 10,
            cellPadding: 5
        },
        bodyStyles: { 
            fontSize: 10, 
            cellPadding: 8, // More space for handwriting
            textColor: [51, 65, 85],
            minCellHeight: 15
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 70, textColor: [15, 23, 42] },
            1: { fontStyle: 'normal' }
        },
        margin: { left: 15, right: 15 }
    })

    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(`Documento para llenado manual generado por Hendaya Forms Hub el ${new Date().toLocaleString()}`, 15, doc.internal.pageSize.height - 15)
        doc.setFont('helvetica', 'bold')
        doc.text(`PÁGINA ${i} DE ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 15)
    }

    return doc
}
