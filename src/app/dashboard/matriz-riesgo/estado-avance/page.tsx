import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import EstadoAvanceClient from './EstadoAvanceClient'
import { getEstadoAvanceData } from './actions'

export default async function EstadoAvancePage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_estado_avance')) {
        redirect('/dashboard')
    }

    const currentYear = new Date().getFullYear()
    const resolvedParams = await searchParams
    const selectedYear = resolvedParams.year ? parseInt(resolvedParams.year) : currentYear

    const data = await getEstadoAvanceData(selectedYear)

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-blue-50 rounded-2xl text-blue-600">📈</span>
                        Estado de Avance
                    </h1>
                    <p className="text-gray-500 mt-2 text-lg">
                        Reporte consolidado de auditorías y mitigación Matriz {selectedYear}.
                    </p>
                </div>
            </div>

            <EstadoAvanceClient initialReport={data.report || []} error={data.error} />
        </div>
    )
}
