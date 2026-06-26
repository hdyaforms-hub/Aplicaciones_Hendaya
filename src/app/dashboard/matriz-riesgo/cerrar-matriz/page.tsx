import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CerrarMatrizClient from './CerrarMatrizClient'
import { getCerrarMatrizData } from './actions'
import Link from 'next/link'

export const metadata = {
    title: 'Sol. desviación Matriz | AplicacionWeb',
}

export default async function CerrarMatrizPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
    const session = await getSession()
    if (!session) redirect('/auth/login')

    const permissions = session?.user?.role?.permissions || []
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'
    
    // Check if user has visual delegation
    const delegationsCount = await prisma.delegacionVisualizacion.count({
        where: { userId: session.user.id }
    })
    const isDelegated = delegationsCount > 0

    if (!permissions.includes('close_matriz_riesgo') && !isAdmin && !isDelegated) {
        redirect('/dashboard')
    }

    const currentYear = new Date().getFullYear()
    const resolvedParams = await searchParams
    const selectedYear = resolvedParams.year ? parseInt(resolvedParams.year) : currentYear

    const data = await getCerrarMatrizData(selectedYear)

    if (data.error) {
        return (
            <div className="p-8 text-center bg-white rounded-3xl shadow-sm border border-red-100 max-w-xl mx-auto mt-12">
                <div className="text-4xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Error</h2>
                <p className="text-slate-500 mb-4">{data.error}</p>
                <Link href="/dashboard" className="inline-block px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800">
                    Volver al Inicio
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-indigo-50 rounded-2xl text-indigo-600">🏁</span>
                        Sol. desviación Matriz
                    </h1>
                    <p className="text-gray-500 mt-2 text-lg">
                        Mitigue y envíe a supervisión las evaluaciones de Matriz de Riesgo asignadas.
                    </p>
                </div>
                {isAdmin && (
                    <Link 
                        href="/dashboard/matriz-riesgo/cerrar-matriz/delegaciones"
                        className="px-5 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl font-bold text-sm transition-all"
                    >
                        ⚙️ Configurar Delegaciones
                    </Link>
                )}
            </div>

            <CerrarMatrizClient 
                initialEvaluaciones={data.matrices || []} 
                initialMitigaciones={data.mitigaciones || []}
                cutoffDate={data.cutoffDate || new Date().toISOString()}
                supervisorProgressList={data.supervisorProgressList || []}
                myProgress={data.myProgress}
                sucursales={data.sucursales || []}
                delegatedSucursales={data.delegatedSucursales || []}
                isAdmin={data.isAdmin || false}
            />
        </div>
    )
}
