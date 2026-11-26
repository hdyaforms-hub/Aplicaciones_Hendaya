import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import DiarioMuralClient from './DiarioMuralClient'
import { obtenerDiarioMuralAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function DiarioMuralPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const perms: string[] = session.user.role?.permissions || []
    const isAdmin = roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin'
    const canView = isAdmin || perms.includes('view_diario_mural') || perms.includes('manage_diario_mural')

    if (!canView) {
        return (
            <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800">Acceso No Autorizado</h2>
                <p className="text-slate-600 mt-2">No tienes los privilegios necesarios para acceder al Diario Mural.</p>
            </div>
        )
    }

    const res = await obtenerDiarioMuralAction()

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
            <DiarioMuralClient
                initialItems={res.items || []}
                esAdmin={Boolean(res.esAdmin)}
                usuarioActual={res.usuarioActual || session.user.name || session.user.username || 'Usuario'}
                sucursalesUsuario={res.sucursalesUsuario || []}
                todasSucursales={res.todasSucursales || []}
                sucursalPorDefecto={res.sucursalPorDefecto || 'GLOBAL'}
                tieneAccesoTodasSucursales={Boolean(res.tieneAccesoTodasSucursales)}
            />
        </div>
    )
}
