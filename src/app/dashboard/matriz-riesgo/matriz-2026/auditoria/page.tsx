import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import AuditoriaClient from './AuditoriaClient'
import { getAuditoriaData } from './actions'
import { SECCIONES, PREGUNTAS } from '../evaluacion-detallada/questions'
import { FIELD_MAPPING, PROBLEM_VALUES } from '../mitigacion/mapping'

export default async function AuditoriaPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_auditoria')) {
        redirect('/dashboard')
    }

    const data = await getAuditoriaData()

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-900 opacity-5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <span className="p-2 bg-slate-100 rounded-2xl text-slate-700">🔍</span>
                    Auditoría Externa
                </h1>
                <p className="text-gray-500 mt-2 text-lg">
                    Vista global del cumplimiento y estado de mitigaciones de la Matriz de Riesgo 2026.
                </p>
            </div>

            {data.error ? (
                <div className="p-8 bg-red-50 text-red-700 rounded-3xl border border-red-100 font-bold">
                    {data.error}
                </div>
            ) : (
                <AuditoriaClient 
                    matrices={data.matrices || []} 
                    colegios={data.colegios || []}
                    mitigaciones={data.mitigaciones || []}
                    riskConfigs={data.riskConfigs || []}
                    SECCIONES={SECCIONES}
                    PREGUNTAS={PREGUNTAS}
                    FIELD_MAPPING={FIELD_MAPPING}
                    PROBLEM_VALUES={PROBLEM_VALUES}
                />
            )}
        </div>
    )
}
