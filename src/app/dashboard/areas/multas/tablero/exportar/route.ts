import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultasPermission } from '@/lib/multas/permisos'
import { getReporteMaestroExcelDataAction } from '../actions'
import * as XLSX from 'xlsx'

export async function GET() {
    try {
        const session = await getSession()
        if (!session?.user) {
            return new NextResponse('No autorizado', { status: 401 })
        }

        const { authorized } = await checkMultasPermission('export_multas_consolidado', session)
        if (!authorized) {
            return new NextResponse('No tienes permisos para exportar el consolidado de multas', { status: 403 })
        }

        const res = await getReporteMaestroExcelDataAction()
        if (!res.success || !res.data) {
            return new NextResponse('Error compilando datos del reporte', { status: 500 })
        }

        // Mapear encabezados amigables para el usuario en Excel distinguiendo CLP y UTM
        const excelRows = res.data.map(r => ({
            'Folio Acta': r.folio,
            'Fecha Supervisión': r.fechaSupervision,
            'RBD': r.rbd || '',
            'Sucursal': r.sucursal,
            'Licitación / Contrato': r.licitacion,
            'Aspecto': r.aspecto,
            'Descripción No Conformidad': r.descripcionAspecto,
            'Monto Calculado (CLP)': r.montoCalculadoPesos,
            'Monto Calculado Est. (UTM)': r.montoNotificadoUtm,
            'Monto Impugnado (UTM)': r.montoImpugnadoUtm,
            'Monto Rebajado (UTM)': r.montoRebajadoUtm,
            'Estado Legal Descargo': r.estadoDescargo,
            'N° Resolución / REX': r.resolucionJunaeb,
            'Dictamen Resuelve': r.dictamenResuelve,
            'Estado Plan de Acción': r.estadoPlanAccion,
            'Medida Correctiva Implementada': r.medidaCorrectiva
        }))

        const worksheet = XLSX.utils.json_to_sheet(excelRows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Consolidado Multas')

        // Ajuste de ancho de columnas
        worksheet['!cols'] = [
            { wch: 14 }, // Folio
            { wch: 14 }, // Fecha
            { wch: 10 }, // RBD
            { wch: 20 }, // Sucursal
            { wch: 25 }, // Licitacion
            { wch: 12 }, // Aspecto
            { wch: 35 }, // Descripcion
            { wch: 22 }, // Monto Calculado (CLP)
            { wch: 24 }, // Monto Calculado Est. (UTM)
            { wch: 20 }, // Monto Impugnado (UTM)
            { wch: 20 }, // Monto Rebajado (UTM)
            { wch: 20 }, // Estado Descargo
            { wch: 18 }, // Resolucion
            { wch: 18 }, // Dictamen
            { wch: 18 }, // Estado Plan
            { wch: 35 }  // Medida Correctiva
        ]

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
        const dateStr = new Date().toISOString().split('T')[0]

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="reporte_maestro_multas_hendaya_${dateStr}.xlsx"`
            }
        })
    } catch (error: any) {
        console.error('Error generando archivo Excel maestro:', error)
        return new NextResponse(`Error generando exportación: ${error.message}`, { status: 500 })
    }
}
