import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import CargarPaeClient from './CargarPaeClient'

export default async function CargarPaePage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    // Verificar permiso
    if (!permissions.includes('view_operaciones_cargar_pae')) {
        redirect('/dashboard')
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-full overflow-x-hidden min-h-screen bg-gray-50/50">
            <CargarPaeClient />
        </div>
    )
}
