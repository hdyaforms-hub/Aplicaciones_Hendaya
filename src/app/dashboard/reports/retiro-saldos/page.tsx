
import { getRetiroReport } from './actions'
import RetiroReportClient from './RetiroReportClient'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function RetiroReportPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_retiro_report')) {
        redirect('/dashboard')
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 opacity-60" />
                <div>
                    <h2 className="text-2xl font-black text-black mb-1 flex items-center gap-3">
                        <span className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xl shadow-lg shadow-indigo-200">📊</span>
                        Informe: Retiro de Saldos
                    </h2>
                    <p className="text-gray-500">Consulta histórica y exportación de datos.</p>
                </div>
            </div>

            <RetiroReportClient />
        </div>
    )
}
