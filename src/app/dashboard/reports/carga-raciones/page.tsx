import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import CargaRacionesClient from './CargaRacionesClient'

export default async function CargaRacionesPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('view_reports')) {
        redirect('/dashboard')
    }

    return (
        <div className="space-y-6 flex flex-col items-center animate-in fade-in">
            <div className="w-full max-w-6xl text-center mb-2">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight drop-shadow-sm">Reporte: Carga de Raciones</h1>
                <p className="text-gray-500 mt-2">Visualiza las liquidaciones operativas y consolidadas exportables a formato PDF.</p>
            </div>

            <CargaRacionesClient />
        </div>
    )
}
