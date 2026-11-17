import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ensureSolucionesPlanTables } from '@/lib/multas/soluciones-plan-db-init'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession()
        if (!session?.user) {
            return new NextResponse('No autorizado', { status: 401 })
        }

        await ensureSolucionesPlanTables()
        const { id } = await params

        const plan = await prisma.multas_Plan_Accion.findUnique({
            where: { id },
            include: {
                items: {
                    orderBy: { aspecto: 'asc' }
                }
            }
        })

        if (!plan) {
            return new NextResponse('Plan de acción no encontrado', { status: 404 })
        }

        // Crear documento PDF tamaño carta
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'letter'
        })

        const pageWidth = doc.internal.pageSize.getWidth()

        // 1. Cabecera Institucional HENDAYA (Estética Corporativa Oficial)
        doc.setFillColor(15, 23, 42) // slate-900
        doc.rect(0, 0, pageWidth, 28, 'F')

        // Marca tipográfica HENDAYA
        doc.setTextColor(6, 182, 212) // Cyan-500
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(20)
        doc.text('HENDAYA', 14, 15)

        doc.setTextColor(203, 213, 225) // slate-300
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text('GESTIÓN OPERATIVA Y DE CALIDAD · PROGRAMA DE ALIMENTACIÓN ESCOLAR (PAE)', 14, 21)

        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(`ACTA FOLIO #${plan.folio}`, pageWidth - 14, 15, { align: 'right' })

        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(148, 163, 184)
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-CL')}`, pageWidth - 14, 21, { align: 'right' })

        // 2. Título del Reporte
        let currentY = 36
        doc.setTextColor(30, 41, 59)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.text('INFORME TÉCNICO DE PLAN DE ACCIÓN Y MEDIDAS CORRECTIVAS', 14, currentY)

        currentY += 5
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 116, 139)
        doc.text('Subsanación formal de no conformidades detectadas en supervisión JUNAEB (Anexo 3 IT EE)', 14, currentY)

        // 3. Cuadro de Metadatos del Establecimiento y del Plan
        currentY += 6
        doc.setFillColor(248, 250, 252) // slate-50
        doc.setDrawColor(226, 232, 240) // slate-200
        doc.roundedRect(14, currentY, pageWidth - 28, 26, 3, 3, 'FD')

        doc.setFontSize(8.5)
        doc.setTextColor(71, 85, 105)

        // Columna 1
        doc.setFont('helvetica', 'bold')
        doc.text('Folio Supervisado:', 18, currentY + 6)
        doc.setFont('helvetica', 'normal')
        doc.text(plan.folio, 50, currentY + 6)

        doc.setFont('helvetica', 'bold')
        doc.text('Establecimiento / RBD:', 18, currentY + 13)
        doc.setFont('helvetica', 'normal')
        doc.text(plan.rbd ? `RBD ${plan.rbd}` : 'No consignado', 50, currentY + 13)

        doc.setFont('helvetica', 'bold')
        doc.text('Licitación / Contrato:', 18, currentY + 20)
        doc.setFont('helvetica', 'normal')
        doc.text(plan.licitacionNombre || 'Estándar Hendaya', 50, currentY + 20)

        // Columna 2
        doc.setFont('helvetica', 'bold')
        doc.text('Sucursal Operativa:', 110, currentY + 6)
        doc.setFont('helvetica', 'normal')
        doc.text(plan.sucursal || 'Central', 145, currentY + 6)

        doc.setFont('helvetica', 'bold')
        doc.text('Estado del Plan:', 110, currentY + 13)
        doc.setFont('helvetica', 'normal')
        doc.text(plan.estado, 145, currentY + 13)

        doc.setFont('helvetica', 'bold')
        doc.text('Avance Subsanación:', 110, currentY + 20)
        doc.setFont('helvetica', 'normal')
        const pct = plan.totalItems > 0 ? Math.round((plan.itemsResueltos / plan.totalItems) * 100) : 0
        doc.text(`${plan.itemsResueltos} de ${plan.totalItems} medidas (${pct}%)`, 145, currentY + 20)

        // 4. Tabla de Medidas Correctivas e Ítems
        currentY += 32

        const tableRows = plan.items.map(it => [
            `Aspecto ${it.aspecto}`,
            it.hallazgoDetectado,
            it.accionTomada || 'Sin acción registrada',
            it.evidenciaNombre || 'Pendiente',
            it.estadoItem
        ])

        autoTable(doc, {
            startY: currentY,
            head: [['Aspecto', 'Hallazgo / No Conformidad', 'Acción Correctiva Ejecutada', 'Evidencia / Respaldo', 'Estado']],
            body: tableRows,
            theme: 'grid',
            headStyles: {
                fillColor: [15, 23, 42],
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 7.5,
                cellPadding: 2.5,
                valign: 'middle',
                textColor: [51, 65, 85]
            },
            columnStyles: {
                0: { cellWidth: 20, fontStyle: 'bold', halign: 'center' },
                1: { cellWidth: 45 },
                2: { cellWidth: 65 },
                3: { cellWidth: 35 },
                4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }
            },
            didDrawPage: (data) => {
                currentY = data.cursor?.y || currentY
            }
        })

        // 5. Observaciones de Validación y Cierre (si existen)
        if (plan.observacionesCierre) {
            currentY += 8
            doc.setFillColor(241, 245, 249)
            doc.roundedRect(14, currentY, pageWidth - 28, 18, 2, 2, 'F')

            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8)
            doc.setTextColor(30, 41, 59)
            doc.text('Dictamen de Validación y Cierre Operativo:', 18, currentY + 5)

            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7.5)
            doc.setTextColor(71, 85, 105)
            doc.text(plan.observacionesCierre, 18, currentY + 11, { maxWidth: pageWidth - 36 })
            currentY += 24
        } else {
            currentY += 12
        }

        // 6. Bloque de Firmas de Responsabilidad
        if (currentY > 230) {
            doc.addPage()
            currentY = 30
        } else {
            currentY = Math.max(currentY + 10, 220)
        }

        const colWidth = (pageWidth - 28 - 20) / 2

        // Firma Supervisor Zonal
        doc.setDrawColor(148, 163, 184)
        doc.line(14, currentY + 15, 14 + colWidth, currentY + 15)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(30, 41, 59)
        doc.text(plan.responsableAsignado || 'Supervisor(a) Zonal de Terreno', 14 + colWidth / 2, currentY + 20, { align: 'center' })
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(100, 116, 139)
        doc.text('Operaciones Hendaya · Implementación en Terreno', 14 + colWidth / 2, currentY + 24, { align: 'center' })

        // Firma Calidad / Administración
        const rightColX = 14 + colWidth + 20
        doc.line(rightColX, currentY + 15, rightColX + colWidth, currentY + 15)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(30, 41, 59)
        doc.text(plan.cerradoPor || 'Jefatura de Calidad / Auditoría', rightColX + colWidth / 2, currentY + 20, { align: 'center' })
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(100, 116, 139)
        doc.text('Validación y Cierre de Plan de Acción', rightColX + colWidth / 2, currentY + 24, { align: 'center' })

        // Pie de página institucional
        const totalPages = doc.getNumberOfPages()
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i)
            doc.setFontSize(7)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(148, 163, 184)
            doc.text(
                'Documento emitido por el Sistema Integrado de Gestión Hendaya · Confidencial',
                pageWidth / 2,
                272,
                { align: 'center' }
            )
            doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, 272, { align: 'right' })
        }

        const pdfBytes = doc.output('arraybuffer')

        return new NextResponse(pdfBytes, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="plan_accion_hendaya_folio_${plan.folio}.pdf"`
            }
        })
    } catch (error: any) {
        console.error('Error generando PDF de plan de accion:', error)
        return new NextResponse(`Error generando PDF: ${error.message}`, { status: 500 })
    }
}
