
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import SolicitudGasReportClient from './SolicitudGasReportClient'

export const metadata = {
    title: 'Reporte Solicitud de Gas | Sistema Hendaya',
}

export default async function SolicitudGasReportPage() {
    const session = await getSession()
    
    const permissions = session?.user?.role?.permissions || []
    if (!permissions.includes('view_solicitud_gas_report')) {
        redirect('/dashboard')
    }

    return (
        <div className="space-y-6 flex flex-col items-center">
            <div className="w-full max-w-6xl text-center mb-2">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight drop-shadow-sm flex items-center justify-center gap-3">
                    📄 Reporte: Solicitud de Gas
                </h1>
                <p className="text-gray-500 mt-2 font-medium">Historial detallado de pedidos de gas, distribuidores y consumos calculados.</p>
            </div>

            <SolicitudGasReportClient />
        </div>
    )
}
