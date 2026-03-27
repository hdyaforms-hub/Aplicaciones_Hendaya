import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import MitigacionClient from './MitigacionClient'
import { getMitigacionData } from './actions'

export default async function MitigacionPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_mitigacion')) {
        redirect('/dashboard')
    }

    const data = await getMitigacionData(1) // Default 1er semestre

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <span className="p-2 bg-emerald-50 rounded-2xl text-emerald-600">🛠️</span>
                    Mitigación de Hallazgos
                </h1>
                <p className="text-gray-500 mt-2 text-lg">
                    Gestione las soluciones y evidencias para los riesgos detectados en la Matriz 2026.
                </p>
            </div>

            {data.error ? (
                <div className="p-8 bg-red-50 text-red-700 rounded-3xl border border-red-100 font-bold">
                    {data.error}
                </div>
            ) : (
                <MitigacionClient 
                    initialMatrices={data.matrices || []} 
                    riskConfigs={data.riskConfigs || []}
                    initialMitigaciones={data.mitigaciones || []}
                    cutoffDate={data.cutoffDate || new Date().toISOString()}
                />
            )}
        </div>
    )
}
