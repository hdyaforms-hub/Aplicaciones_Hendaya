
import { getRetiroDashboardData } from './actions'
import RetiroDashboardClient from './RetiroDashboardClient'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function RetiroDashboardPage({
    searchParams
}: {
    searchParams: { year?: string, month?: string, sucursal?: string, rbd?: string }
}) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_tablero_retiro')) {
        redirect('/dashboard')
    }

    const year = searchParams.year ? parseInt(searchParams.year) : new Date().getFullYear()
    const month = searchParams.month ? parseInt(searchParams.month) : undefined
    const sucursal = searchParams.sucursal
    const rbd = searchParams.rbd ? parseInt(searchParams.rbd) : undefined

    const data = await getRetiroDashboardData({ year, month, sucursal, rbd })

    if ('error' in data) {
        return <div className="p-8 text-red-500 font-bold">{data.error}</div>
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 opacity-60" />
                <div>
                    <h2 className="text-2xl font-black text-black mb-1 flex items-center gap-3">
                        <span className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xl shadow-lg shadow-indigo-200">📈</span>
                        Tablero: Retiro de Saldos
                    </h2>
                    <p className="text-gray-500">Analítica de inventario y devoluciones físicas.</p>
                </div>
            </div>

            <RetiroDashboardClient 
                initialData={data} 
                initialFilters={{ year, month, sucursal, rbd }} 
            />
        </div>
    )
}
