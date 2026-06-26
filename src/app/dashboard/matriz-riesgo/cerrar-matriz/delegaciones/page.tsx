import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import DelegacionesClient from './DelegacionesClient'
import { getDelegacionesData } from './actions'
import Link from 'next/link'

export const metadata = {
    title: 'Delegación de Visualizaciones | AplicacionWeb',
}

export default async function DelegacionesPage() {
    const session = await getSession()
    if (!session) redirect('/auth/login')

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    if (!isAdmin) {
        redirect('/dashboard/matriz-riesgo/cerrar-matriz')
    }

    const data = await getDelegacionesData()

    if (data.error) {
        return (
            <div className="p-8 text-center bg-white rounded-3xl shadow-sm border border-red-100 max-w-xl mx-auto mt-12">
                <div className="text-4xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Error</h2>
                <p className="text-slate-500 mb-4">{data.error}</p>
                <Link href="/dashboard/matriz-riesgo/cerrar-matriz" className="inline-block px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800">
                    Volver a Cerrar Matriz
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-indigo-50 rounded-2xl text-indigo-600">⚙️</span>
                        Delegación de Visualizaciones
                    </h1>
                    <p className="text-gray-500 mt-2 text-lg">
                        Delegue la visualización del estado de avance de supervisores a cualquier usuario por sucursal.
                    </p>
                </div>
                <Link 
                    href="/dashboard/matriz-riesgo/cerrar-matriz"
                    className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-sm transition-all"
                >
                    ⬅️ Volver a Cerrar Matriz
                </Link>
            </div>

            <DelegacionesClient 
                initialUsers={data.users || []}
                initialSucursales={data.sucursales || []}
                initialDelegaciones={data.delegaciones || []}
            />
        </div>
    )
}
