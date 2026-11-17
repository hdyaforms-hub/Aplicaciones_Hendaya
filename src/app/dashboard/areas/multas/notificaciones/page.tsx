import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import { getNotificacionesListAction } from './actions'
import { getLicitacionesDisponibles } from '../calculos/actions'
import NotificacionesRexClient from './NotificacionesRexClient'

export const metadata = {
    title: 'Notificaciones JUNAEB (REX) | Hendaya',
    description: 'Recepción de Resoluciones Exentas (REX), conciliación contra cálculo interno y generación de Anexo 1.'
}

export default async function NotificacionesRexPage() {
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const permissions = session.user.role?.permissions || []
    const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin'

    const hasAccess = isAdmin ||
        permissions.includes('view_notificaciones_junaeb') ||
        permissions.includes('manage_notificaciones_junaeb')

    if (!hasAccess) {
        redirect('/dashboard')
    }

    const canManage = isAdmin || permissions.includes('manage_notificaciones_junaeb')

    // Registrar en auditoría
    await logAuditAction({
        username: session.user.username as string,
        userId: session.user.id || null,
        action: 'ACCESO_NOTIFICACIONES_JUNAEB',
        modulo: 'Multas · Notificaciones JUNAEB',
        detalle: 'Acceso al módulo de Notificaciones JUNAEB y Conciliación REX.'
    })

    const [notifRes, licsRes] = await Promise.all([
        getNotificacionesListAction(),
        getLicitacionesDisponibles()
    ])

    return (
        <div className="w-full py-4 sm:py-6 px-2 sm:px-6 space-y-6">
            <NotificacionesRexClient
                initialList={notifRes.data || []}
                licitaciones={licsRes.data || []}
                canManage={canManage}
            />
        </div>
    )
}
