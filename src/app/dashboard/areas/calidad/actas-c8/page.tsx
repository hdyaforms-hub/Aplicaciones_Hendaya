import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { obtenerActasC8Action, obtenerFiltrosActasC8Action } from './actions'
import ActasC8Client from './ActasC8Client'

export const dynamic = 'force-dynamic'

export default async function ActasC8Page() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const perms: string[] = session.user.role?.permissions || []
    const isAdmin = roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin'
    const canView = isAdmin || perms.includes('view_calidad_actas_c8') || perms.includes('view_calidad')
    const canManage = isAdmin || perms.includes('manage_calidad_actas_c8')
    const canImport = isAdmin || perms.includes('import_calidad_actas_c8') || perms.includes('manage_calidad_actas_c8')

    if (!canView) {
        redirect('/dashboard')
    }

    const [actasRes, filtrosRes] = await Promise.all([
        obtenerActasC8Action(),
        obtenerFiltrosActasC8Action()
    ])

    const actas = actasRes.success && actasRes.data ? actasRes.data : []
    const filtrosData = filtrosRes.success && filtrosRes.data ? filtrosRes.data : {
        licitaciones: [],
        sucursales: [],
        uts: [],
        colegios: [],
        instituciones: ['JUNAEB', 'INTEGRA', 'JUNJI'],
        motivosC8: [],
        valoresContrato: [],
        aniosDisponibles: [new Date().getFullYear()]
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <ActasC8Client
                initialActas={actas}
                filtrosData={filtrosData}
                canManage={canManage}
                canImport={canImport}
                isAdmin={isAdmin}
                userName={session.user.name || session.user.username || 'Usuario'}
            />
        </div>
    )
}
