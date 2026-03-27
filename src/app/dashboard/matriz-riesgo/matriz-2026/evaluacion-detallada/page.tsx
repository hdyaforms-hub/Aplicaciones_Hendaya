import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import EvaluacionDetalleForm from './EvaluacionDetalleForm'

export default async function EvaluacionDetalladaPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_evaluacion_detallada')) {
        redirect('/dashboard')
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <span className="p-2 bg-rose-50 rounded-2xl text-rose-600">⚙️</span>
                    Matriz de Configuración de Riesgos
                </h1>
                <p className="text-gray-500 mt-2 text-lg">
                    Defina los niveles de Gravedad, Probabilidad y Mitigación para cada pregunta de la Matriz 2026.
                </p>
            </div>

            <EvaluacionDetalleForm user={session.user} />
        </div>
    )
}
