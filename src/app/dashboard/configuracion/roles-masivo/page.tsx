import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import AsignacionMasivaRolesClient from './AsignacionMasivaRolesClient'
import { obtenerDatosRolesMasivoAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function AsignacionMasivaRolesPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const perms: string[] = session.user.role?.permissions || []
    const isAdmin = roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin'
    const canManage = isAdmin || perms.includes('manage_roles') || perms.includes('manage_roles_masivo') || perms.includes('view_roles_masivo')

    if (!canManage) {
        return (
            <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800">Acceso No Autorizado</h2>
                <p className="text-slate-600 mt-2">No tienes los privilegios necesarios para gestionar la asignación masiva de permisos.</p>
            </div>
        )
    }

    const res = await obtenerDatosRolesMasivoAction()

    if (!res.success || !res.roles || !res.permisos) {
        return (
            <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800">Error al Cargar Datos</h2>
                <p className="text-slate-600 mt-2">{res.error || 'No se pudieron recuperar los roles y permisos del sistema.'}</p>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
            <AsignacionMasivaRolesClient
                initialRoles={res.roles}
                permisos={res.permisos}
                categorias={res.categorias || []}
            />
        </div>
    )
}
