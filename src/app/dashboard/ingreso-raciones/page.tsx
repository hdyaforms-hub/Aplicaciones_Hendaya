import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import IngresoRacionesClient from './IngresoRacionesClient'

export default async function IngresoRacionesPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('view_ingreso_raciones')) {
        redirect('/dashboard')
    }

    return (
        <div className="space-y-6 flex flex-col items-center">
            <div className="w-full max-w-4xl text-center mb-4">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight drop-shadow-sm">Nueva Auditoría / Raciones</h1>
                <p className="text-gray-500 mt-2">Registra y valida la información de los establecimientos según su PMPA planificado.</p>
            </div>

            <IngresoRacionesClient />
        </div>
    )
}
