import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { checkMultasPermission } from '@/lib/multas/permisos'
import { logAuditAction } from '@/lib/audit'
import { getFeriadosAction } from './actions'
import FeriadosClient from './FeriadosClient'

export default async function FeriadosPage() {
    const session = await getSession()
    const { authorized } = await checkMultasPermission([
        'view_multas_areas',
        'manage_ciclo_legal_multas',
        'manage_calculos_ee'
    ], session)

    if (!authorized) {
        redirect('/dashboard')
    }

    const canEditRes = await checkMultasPermission([
        'manage_ciclo_legal_multas',
        'manage_calculos_ee'
    ], session)

    await logAuditAction({
        username: (session.user.username || session.user.email) as string,
        userId: session.user.id || null,
        action: 'ACCESO_CALENDARIO_FERIADOS_MULTAS',
        modulo: 'Multas · Calendario de Feriados',
        detalle: 'Acceso a la configuración y gestión del calendario de feriados oficiales.'
    })

    const currentYear = new Date().getFullYear()
    const res = await getFeriadosAction()
    const feriados = res.success && res.feriados ? res.feriados : []

    return (
        <div className="w-full py-4 sm:py-6 px-2 sm:px-6">
            <FeriadosClient
                initialFeriados={feriados}
                canEdit={canEditRes.authorized}
            />
        </div>
    )
}
