import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getPlanAccionDetalleAction, getDiccionarioSolucionesAction } from '../actions'
import DetallePlanClient from './DetallePlanClient'

export const metadata = {
    title: 'Ficha de Plan de Acción | Hendaya',
    description: 'Gestión detallada de acciones correctivas y evidencias por acta fiscalizada.'
}

export default async function DetallePlanPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const permissions = session.user.role?.permissions || []
    const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin'

    const hasAccess = isAdmin ||
        permissions.includes('view_soluciones_multas') ||
        permissions.includes('manage_soluciones_multas')

    if (!hasAccess) {
        redirect('/dashboard')
    }

    const canManage = isAdmin || permissions.includes('manage_soluciones_multas')

    const { id } = await params
    const [planRes, diccRes] = await Promise.all([
        getPlanAccionDetalleAction(id),
        getDiccionarioSolucionesAction()
    ])

    if (!planRes.success || !planRes.data) {
        redirect('/dashboard/areas/multas/soluciones')
    }

    return (
        <div className="w-full py-4 sm:py-6 px-2 sm:px-6 space-y-6">
            <DetallePlanClient
                planInicial={planRes.data}
                diccionarioSoluciones={diccRes.data || []}
                canManage={canManage}
                userName={session.user.name || session.user.username || 'Usuario'}
            />
        </div>
    )
}
