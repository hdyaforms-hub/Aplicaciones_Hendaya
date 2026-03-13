
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import SolicitudPanReportClient from './SolicitudPanReportClient'

export const metadata = {
    title: 'Reporte Solicitudes de Pan | Sistema Hendaya',
    description: 'Informe detallado de aumentos y suspensiones de pan.',
}

export default async function SolicitudPanReportPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('view_solicitud_pan_report')) {
        redirect('/dashboard')
    }

    return (
        <div className="space-y-6 flex flex-col items-center">
            <div className="w-full max-w-6xl text-center mb-2">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight drop-shadow-sm flex items-center justify-center gap-3">
                    📄 Reporte: Solicitud de Pan
                </h1>
                <p className="text-gray-500 mt-2 font-medium">Filtra, visualiza y exporta el historial de solicitudes de pan registradas en el sistema.</p>
            </div>

            <SolicitudPanReportClient />
        </div>
    )
}
