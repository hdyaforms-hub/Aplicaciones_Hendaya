import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import AuditoriaClient from './AuditoriaClient'
import { getAuditoriaData } from './actions'

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_auditoria')) {
        redirect('/dashboard')
    }

    const currentYear = new Date().getFullYear()
    const resolvedParams = await searchParams
    const selectedYear = resolvedParams.year ? parseInt(resolvedParams.year) : currentYear

    const data = await getAuditoriaData(selectedYear)

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-900 opacity-5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <span className="p-2 bg-slate-100 rounded-2xl text-slate-700">🔍</span>
                    Auditoría Externa
                </h1>
                <p className="text-gray-500 mt-2 text-lg">
                    Vista global del cumplimiento y estado de mitigaciones de la Matriz de Riesgo.
                </p>
            </div>

            <AuditoriaClient 
                respuestas={data.respuestas || []} 
                cabecerasConfig={data.cabecerasConfig || []}
                colegios={data.colegios || []}
                mitigaciones={data.mitigaciones || []}
                error={data.error}
            />
        </div>
    )
}
