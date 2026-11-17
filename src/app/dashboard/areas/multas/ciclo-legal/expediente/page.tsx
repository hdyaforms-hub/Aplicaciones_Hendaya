import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import { getExpedienteTimelineAction, HitoTimelineDTO } from '../actions'
import ExpedienteTimelineClient from './ExpedienteTimelineClient'

interface Props {
    searchParams: Promise<{ folio?: string; rex?: string }>
}

export const metadata = {
    title: 'Expediente Digital (Timeline) | Hendaya',
    description: 'Línea de tiempo cronológica unificada de expedientes de multas por folio o por resolución.'
}

export default async function ExpedienteTimelinePage({ searchParams }: Props) {
    const { folio, rex } = await searchParams
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

    // Registrar auditoría
    await logAuditAction({
        username: session.user.username as string,
        userId: session.user.id || null,
        action: 'ACCESO_EXPEDIENTE_TIMELINE_MULTAS',
        modulo: 'Multas · Ciclo Legal',
        detalle: `Consulta de expediente digital para ${folio ? `Folio #${folio}` : rex ? `REX ${rex}` : 'Buscador'}.`
    })

    let initialHitos: HitoTimelineDTO[] = []
    let identificador = ''
    if (folio || rex) {
        const res = await getExpedienteTimelineAction({ folio, numeroResolucion: rex })
        if (res.success && res.hitos) {
            initialHitos = res.hitos
            identificador = res.identificador || ''
        }
    }

    return (
        <div className="w-full py-4 sm:py-6 px-2 sm:px-6 space-y-6">
            <ExpedienteTimelineClient
                initialHitos={initialHitos}
                initialIdentificador={identificador}
                queryFolio={folio || ''}
                queryRex={rex || ''}
            />
        </div>
    )
}
