import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import MitigacionClient from './MitigacionClient'
import { getMitigacionData } from './actions'

export default async function MitigacionPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_mitigacion')) {
        redirect('/dashboard')
    }

    const currentYear = new Date().getFullYear()
    const resolvedParams = await searchParams
    const selectedYear = resolvedParams.year ? parseInt(resolvedParams.year) : currentYear

    const data = await getMitigacionData(selectedYear) // Fetch all year

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <span className="p-2 bg-emerald-50 rounded-2xl text-emerald-600">🛠️</span>
                    Mitigación de Hallazgos
                </h1>
                <p className="text-gray-500 mt-2 text-lg">
                    Gestione las soluciones y evidencias para los hallazgos detectados en las evaluaciones de Matriz de Riesgo.
                </p>
            </div>

            <MitigacionClient 
                initialEvaluaciones={data.matrices || []} 
                initialMitigaciones={data.mitigaciones || []}
                cutoffDate={data.cutoffDate || new Date().toISOString()}
                error={data.error}
            />
        </div>
    )
}
