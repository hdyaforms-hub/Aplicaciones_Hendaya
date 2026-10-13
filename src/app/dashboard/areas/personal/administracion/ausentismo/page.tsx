import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getAdmAusentismoRegistrosAction, getHistorialCargasAction } from './actions'
import { getCriteriosAction } from '@/app/dashboard/mantenedor/personal/criterios-ausencias/actions'
import { getEstablecimientosAutocompletadoAction } from '@/app/dashboard/areas/personal/asistencia/actions'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { puedeUsuarioCerrarPeriodosRH } from '@/lib/personal-cuentas-db-init'
import AdmAusentismoClient from './AdmAusentismoClient'

export const dynamic = 'force-dynamic'

export default async function AdmAusentismoPage() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []

    if (!perms.includes('manage_personal_asistencia_admin')) {
        redirect('/dashboard')
    }

    const [regRes, cargasRes, critRes, estabRes, authorizedRbds, puedeCerrar] = await Promise.all([
        getAdmAusentismoRegistrosAction(),
        getHistorialCargasAction(),
        getCriteriosAction(),
        getEstablecimientosAutocompletadoAction(),
        getUserEffectiveRbds(),
        puedeUsuarioCerrarPeriodosRH(session.user.id)
    ])

    const registros = regRes.success && regRes.data ? regRes.data : []
    const cargas = cargasRes.success && cargasRes.data ? cargasRes.data : []
    const criterios = critRes.success && critRes.data ? critRes.data : []
    const establecimientos = estabRes.success && estabRes.data ? estabRes.data : []

    const isAdmin = authorizedRbds === null
    const userRbds = authorizedRbds ?? []

    return (
        <AdmAusentismoClient
            initialRegistros={registros}
            initialCargas={cargas}
            criterios={criterios}
            establecimientos={establecimientos}
            userRbds={userRbds}
            isAdmin={isAdmin}
            puedeGestionarPeriodos={puedeCerrar}
        />
    )
}
