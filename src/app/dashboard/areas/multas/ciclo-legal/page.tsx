import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import { getDescargosFormalesListAction, getNotificacionesDisponiblesAction } from './actions'
import CicloLegalClient from './CicloLegalClient'

export const metadata = {
    title: 'Ciclo Legal y Descargos | Hendaya',
    description: 'Control de descargos formales ante JUNAEB, plazos legales, resuelves, recursos y procesos judiciales.'
}

export default async function CicloLegalPage() {
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

    // Registrar en auditoría
    await logAuditAction({
        username: session.user.username as string,
        userId: session.user.id || null,
        action: 'ACCESO_CICLO_LEGAL_MULTAS',
        modulo: 'Multas · Ciclo Legal',
        detalle: 'Acceso a la bandeja de Ciclo Legal y Descargos Formales.'
    })

    const [descargosRes, notifsRes] = await Promise.all([
        getDescargosFormalesListAction(),
        getNotificacionesDisponiblesAction()
    ])

    return (
        <div className="w-full py-4 sm:py-6 px-2 sm:px-6 space-y-6">
            <CicloLegalClient
                initialList={descargosRes.data || []}
                initialResumen={descargosRes.resumen || {
                    totalDescargos: 0,
                    enTramite: 0,
                    plazosVencidos: 0,
                    proximosVencer: 0,
                    montoTotalImpugnadoUtm: 0,
                    montoTotalRebajadoUtm: 0,
                    tasaExitoGlobal: 0
                }}
                notificaciones={notifsRes.data || []}
                canManage={canManage}
            />
        </div>
    )
}
