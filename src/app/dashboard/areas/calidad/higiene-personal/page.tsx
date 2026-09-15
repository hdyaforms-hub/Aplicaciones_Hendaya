import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getSucursalesHigienePersonal } from './actions'
import HigienePersonalClient from './HigienePersonalClient'

export const metadata = {
    title: 'Registro de Transportista interno Higiene Personal | Hendaya Calidad'
}

export default async function HigienePersonalPage() {
    const session = await getSession()

    if (!session?.user) {
        redirect('/login')
    }

    const role = (session.user as any)?.role as { name?: string; permissions?: string[] }
    const roleNameUpper = (role?.name || '').toUpperCase()
    const isAdmin = roleNameUpper === 'ADMINISTRADOR' || roleNameUpper === 'ADMIN'
    const permissions = role?.permissions || []

    if (!permissions.includes('view_calidad_higiene_personal')) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-3xl">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🔒</span>
                    <div>
                        <h3 className="font-bold text-sm">Acceso Restringido</h3>
                        <p className="text-xs text-red-600 mt-0.5">
                            No tienes los permisos asignados para visualizar el módulo de Registro de Transportista interno Higiene Personal.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    const { sucursales, isRestricted, defaultSucursalId } = await getSucursalesHigienePersonal()

    if (sucursales.length === 0) {
        return (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-3xl">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                        <h3 className="font-bold text-sm">Sin Sucursal Asignada</h3>
                        <p className="text-xs text-amber-700 mt-0.5">
                            Tu usuario no tiene ninguna sucursal asignada en el sistema. Contacta al administrador para que configure tus accesos por sucursal.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <HigienePersonalClient
            sucursales={sucursales}
            isRestricted={isRestricted}
            defaultSucursalId={defaultSucursalId}
            userRole={role?.name || ''}
            userPermissions={permissions}
            userName={session.user.name || session.user.username || 'Usuario'}
        />
    )
}
