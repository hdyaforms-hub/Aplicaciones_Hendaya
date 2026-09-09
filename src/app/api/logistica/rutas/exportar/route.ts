import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/prisma'
import ExcelJS from 'exceljs'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const bodegaId = searchParams.get('bodegaId')
        const fechaDesde = searchParams.get('fechaDesde')
        const fechaHasta = searchParams.get('fechaHasta')
        const estado = searchParams.get('estado')

        const where: any = {}
        if (bodegaId && bodegaId !== 'ALL') where.bodegaId = bodegaId
        if (estado && estado !== 'ALL') where.estado = estado

        if (fechaDesde || fechaHasta) {
            where.fechaRuta = {}
            if (fechaDesde) where.fechaRuta.gte = fechaDesde
            if (fechaHasta) where.fechaRuta.lte = fechaHasta
        }

        const rutas = await rawPrisma.logRuta.findMany({
            where,
            include: {
                bodega: true,
                chofer: true,
                camion: true,
                transportista: true,
                cliente: true,
                anden: true
            },
            orderBy: [{ fechaRuta: 'desc' }, { horaProgramada: 'asc' }]
        })

        // Crear libro Excel
        const workbook = new ExcelJS.Workbook()
        workbook.creator = 'Hendaya Logística'
        workbook.created = new Date()

        const sheet = workbook.addWorksheet('Control de Despacho', {
            views: [{ showGridLines: true }]
        })

        // Título corporativo
        sheet.mergeCells('A1:L1')
        const titleCell = sheet.getCell('A1')
        titleCell.value = 'HENDAYA - REPORTE DE CONTROL DE DESPACHO Y RUTAS'
        titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7490' } } // Cyan-700
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
        sheet.getRow(1).height = 30

        // Encabezados
        const headers = [
            'N° Ruta',
            'Fecha',
            'Hora Prog.',
            'Estado',
            'Bodega / CD',
            'Andén',
            'Patente Camión',
            'Tipo Vehículo',
            'Chofer',
            'Teléfono',
            'Cliente / Destino',
            'Bultos',
            'Kilos',
            'Sello Salida',
            'Llegada Portón',
            'Entrada Andén',
            'Salida / Cierre'
        ]

        const headerRow = sheet.addRow(headers)
        headerRow.height = 24
        headerRow.eachCell((cell) => {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF155E75' } } // Cyan-800
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                bottom: { style: 'medium', color: { argb: 'FF0E7490' } }
            }
        })

        // Filas de datos
        for (const r of rutas) {
            const row = sheet.addRow([
                r.numeroRuta,
                r.fechaRuta,
                r.horaProgramada,
                r.estado,
                r.bodega?.nombre || 'N/A',
                r.anden?.nombre || 'Sin Asignar',
                r.camion?.patente || 'N/A',
                r.camion?.tipoVehiculo || 'N/A',
                r.chofer?.nombre || 'N/A',
                r.chofer?.telefono || 'N/A',
                r.cliente?.razonSocial || 'N/A',
                r.totalBultos || 0,
                r.totalKilos ? Number(r.totalKilos) : 0,
                r.selloSalida || '-',
                r.horaLlegadaPorton ? new Date(r.horaLlegadaPorton).toLocaleTimeString('es-CL') : '-',
                r.horaEntradaAnden ? new Date(r.horaEntradaAnden).toLocaleTimeString('es-CL') : '-',
                r.horaSalidaAnden ? new Date(r.horaSalidaAnden).toLocaleTimeString('es-CL') : '-'
            ])

            row.height = 20
            row.alignment = { vertical: 'middle' }
        }

        // Autoajuste de ancho de columnas
        sheet.columns.forEach((col) => {
            let maxLen = 12
            col.eachCell?.({ includeEmpty: false }, (cell) => {
                const len = cell.value ? String(cell.value).length : 0
                if (len > maxLen) maxLen = len
            })
            col.width = Math.min(maxLen + 3, 35)
        })

        const buffer = await workbook.xlsx.writeBuffer()

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="Despacho_Hendaya_${new Date().toISOString().slice(0, 10)}.xlsx"`
            }
        })
    } catch (error: any) {
        console.error('Error exportando Excel de rutas:', error)
        return NextResponse.json({ error: error?.message }, { status: 500 })
    }
}
