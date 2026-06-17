import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import EstadoAvanceClient from './EstadoAvanceClient'
import { getEstadoAvanceData } from './actions'

export default async function EstadoAvancePage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_estado_avance')) {
        redirect('/dashboard')
    }

    const data = await getEstadoAvanceData()

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-blue-50 rounded-2xl text-blue-600">📈</span>
                        Estado de Avance
                    </h1>
                    <p className="text-gray-500 mt-2 text-lg">
                        Reporte consolidado de auditorías y mitigación Matriz 2026.
                    </p>
                </div>
            </div>

            {data.error ? (
                <div className="p-12 bg-red-50 text-red-700 rounded-3xl border border-red-100 font-bold text-center">
                    {data.error}
                </div>
            ) : (
                <EstadoAvanceClient initialReport={data.report || []} />
            )}
        </div>
    )
}
