import { getSession } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import { getDescargoFormalDetalleAction } from '../actions'
import DetalleDescargoClient from './DetalleDescargoClient'

interface Props {
    params: Promise<{ id: string }>
}

export const metadata = {
    title: 'Ficha de Descargo Formal | Hendaya',
    description: 'Seguimiento del descargo formal, folios impugnados, dictamen de Resuelve, recursos y juicio.'
}

export default async function DetalleDescargoPage({ params }: Props) {
    const { id } = await params
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const permissions = session.user.role?.permissions || []
    const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin'

    const hasAccess = isAdmin ||
        permissions.includes('view_ciclo_legal_multas') ||
        permissions.includes('manage_ciclo_legal_multas')

    if (!hasAccess) {
        redirect('/dashboard')
    }

    const canManage = isAdmin || permissions.includes('manage_ciclo_legal_multas')

    const res = await getDescargoFormalDetalleAction(id)
    if (!res.success || !res.descargo) {
        notFound()
    }

    // Registrar auditoría
    await logAuditAction({
        username: session.user.username as string,
        userId: session.user.id || null,
        action: 'ACCESO_DETALLE_DESCARGO_FORMAL',
        modulo: 'Multas · Ciclo Legal',
        detalle: `Consulta de ficha de descargo formal ${res.descargo.codigoIngreso}.`
    })

    return (
        <div className="w-full py-4 sm:py-6 px-2 sm:px-6 space-y-6">
            <DetalleDescargoClient
                descargo={res.descargo}
                initialFolios={res.folios || []}
                initialResuelves={res.resuelves || []}
                initialRecursos={res.recursos || []}
                initialProcesos={res.procesosJudiciales || []}
                canManage={canManage}
            />
        </div>
    )
}
