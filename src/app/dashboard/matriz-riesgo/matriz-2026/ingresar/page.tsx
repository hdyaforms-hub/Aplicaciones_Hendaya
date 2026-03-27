import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import MatrizIngresoForm from './MatrizIngresoForm'

export default async function IngresarMatrizPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_matriz_2026')) {
        redirect('/dashboard')
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <span>📋</span> Ingresar Nueva Matriz de Riesgo 2026
                    </h1>
                    <p className="text-gray-500 mt-1">Completa todos los campos técnicos de la evaluación por sección.</p>
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-4 py-3 rounded-2xl border border-gray-100 space-y-0.5 min-w-[140px]">
                    <div className="flex justify-between gap-4"><span>Código:</span> <span className="text-gray-600">R_GO_8_11</span></div>
                    <div className="flex justify-between gap-4"><span>Fecha:</span> <span className="text-gray-600">03/02/2025</span></div>
                    <div className="flex justify-between gap-4"><span>Versión:</span> <span className="text-gray-600">03</span></div>
                </div>
            </div>

            <MatrizIngresoForm user={session.user} />
        </div>
    )
}
