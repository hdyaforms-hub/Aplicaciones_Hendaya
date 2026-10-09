import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getAsistenciaRegistrosAction, getEstablecimientosAutocompletadoAction } from './actions'
import { getCriteriosAction } from '@/app/dashboard/mantenedor/personal/criterios-ausencias/actions'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import AsistenciaClient from './AsistenciaClient'

export const dynamic = 'force-dynamic'

export default async function AsistenciaPage() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []

    if (!perms.includes('view_personal_asistencia')) {
        redirect('/dashboard')
    }

    const [regRes, critRes, estabRes, authorizedRbds] = await Promise.all([
        getAsistenciaRegistrosAction(),
        getCriteriosAction(),
        getEstablecimientosAutocompletadoAction(),
        getUserEffectiveRbds()
    ])

    const registros = regRes.success && regRes.data ? regRes.data : []
    const criterios = critRes.success && critRes.data ? critRes.data : []
    const establecimientos = estabRes.success && estabRes.data ? estabRes.data : []

    const isAdmin = authorizedRbds === null
    const userRbds = authorizedRbds ?? []

    return (
        <AsistenciaClient
            initialRegistros={registros}
            criterios={criterios}
            establecimientos={establecimientos}
            userRbds={userRbds}
            isAdmin={isAdmin}
        />
    )
}
