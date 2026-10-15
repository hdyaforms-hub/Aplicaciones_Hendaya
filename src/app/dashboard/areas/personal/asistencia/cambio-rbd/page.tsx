import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import CambioRbdClient from './CambioRbdClient'
import { getPersonalDotacionCambioRbdAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function CambioRbdPage() {
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const isAdmin = roleName === 'admin' || roleName === 'administrador'
    const perms = session.user.role?.permissions || []

    if (!isAdmin && !perms.includes('manage_personal_cambio_rbd')) {
        return (
            <div className="p-8 text-center bg-white rounded-2xl shadow-sm border border-red-100 max-w-xl mx-auto mt-12">
                <span className="text-4xl block mb-2">🚫</span>
                <h2 className="text-xl font-bold text-gray-800">Acceso No Autorizado</h2>
                <p className="text-sm text-gray-600 mt-2">
                    No posees los privilegios necesarios para acceder al módulo de Cambio de RBD.
                    Contacta a tu administrador para solicitar acceso.
                </p>
            </div>
        )
    }

    // Consulta inicial de 10 registros
    const initialRes = await getPersonalDotacionCambioRbdAction({
        page: 1,
        pageSize: 10,
        sortBy: 'rbd',
        sortDir: 'asc'
    })

    return (
        <CambioRbdClient
            initialData={initialRes.data || []}
            initialTotal={initialRes.total || 0}
            initialTotalPages={initialRes.totalPages || 1}
            currentUser={{
                name: session.user.name || session.user.username,
                role: session.user.role?.name || 'Usuario'
            }}
        />
    )
}
