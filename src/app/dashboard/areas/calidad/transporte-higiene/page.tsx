import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getSucursalesForUser } from './actions'
import TransporteHigieneClient from './TransporteHigieneClient'

export const metadata = {
    title: 'Registro Transportista Interno Higiene y Estado Transporte | Hendaya Calidad'
}

export default async function TransporteHigienePage() {
    const session = await getSession()

    if (!session?.user) {
        redirect('/login')
    }

    const role = (session.user as any)?.role as { name?: string; permissions?: string[] }
    const isAdmin = role?.name === 'Administrador' || role?.name === 'admin'
    const permissions = role?.permissions || []

    if (!permissions.includes('view_calidad_transporte_higiene')) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-3xl">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🔒</span>
                    <div>
                        <h3 className="font-bold text-sm">Acceso Restringido</h3>
                        <p className="text-xs text-red-600 mt-0.5">
                            No tienes los permisos asignados para visualizar el módulo de Registro transportista interno higiene y estado Transporte.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    const { sucursales, isRestricted, defaultSucursalId } = await getSucursalesForUser()

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
        <TransporteHigieneClient
            sucursales={sucursales}
            isRestricted={isRestricted}
            defaultSucursalId={defaultSucursalId}
            userRole={role?.name || ''}
            userPermissions={permissions}
            userName={session.user.name || session.user.username || 'Usuario'}
        />
    )
}
