import { getSession } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import { getNotificacionDetalleAction } from '../actions'
import DetalleConciliacionRexClient from './DetalleConciliacionRexClient'

interface Props {
    params: Promise<{ id: string }>
}

export const metadata = {
    title: 'Detalle y Conciliación REX | Hendaya',
    description: 'Cruce fila por fila de resolución exenta JUNAEB contra cálculo interno y clasificación de discrepancias.'
}

export default async function DetalleNotificacionRexPage({ params }: Props) {
    const { id } = await params
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

    const res = await getNotificacionDetalleAction(id)
    if (!res.success || !res.cabecera || !res.items) {
        notFound()
    }

    // Registrar auditoría
    await logAuditAction({
        username: session.user.username as string,
        userId: session.user.id || null,
        action: 'ACCESO_DETALLE_NOTIFICACION_REX',
        modulo: 'Multas · Notificaciones JUNAEB',
        detalle: `Consulta de detalle y conciliación para REX N° ${res.cabecera.numeroResolucion}.`
    })

    return (
        <div className="w-full py-4 sm:py-6 px-2 sm:px-6 space-y-6">
            <DetalleConciliacionRexClient
                cabecera={res.cabecera}
                initialItems={res.items}
                initialResumen={res.resumen!}
                canManage={canManage}
            />
        </div>
    )
}
