import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getAdmHorasExtrasAction, getHistorialCargasHextraAction } from './actions'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { puedeUsuarioCerrarPeriodosRH } from '@/lib/personal-cuentas-db-init'
import AdmHorasExtrasClient from './AdmHorasExtrasClient'

export const dynamic = 'force-dynamic'

export default async function AdmHorasExtrasPage() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []

    if (!perms.includes('manage_personal_horas_extras_admin')) {
        redirect('/dashboard')
    }

    const [regRes, cargasRes, authorizedRbds, puedeCerrar] = await Promise.all([
        getAdmHorasExtrasAction({ page: 1, pageSize: 10 }),
        getHistorialCargasHextraAction(),
        getUserEffectiveRbds(),
        puedeUsuarioCerrarPeriodosRH(session.user.id)
    ])

    const isAdmin = authorizedRbds === null
    const userRbds = authorizedRbds ?? []

    const fallbackData = {
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
        sucursales: [],
        supervisores: [],
        establecimientos: []
    }

    const initialRegistrosData = (regRes.success && regRes.data) ? {
        data: regRes.data,
        total: regRes.total ?? 0,
        page: regRes.page ?? 1,
        pageSize: regRes.pageSize ?? 10,
        sucursales: regRes.sucursales ?? [],
        supervisores: regRes.supervisores ?? [],
        establecimientos: regRes.establecimientos ?? []
    } : fallbackData

    return (
        <AdmHorasExtrasClient
            initialRegistrosData={initialRegistrosData}
            initialCargas={cargasRes.success && cargasRes.data ? cargasRes.data : []}
            userRbds={userRbds}
            isAdmin={isAdmin}
            puedeGestionarPeriodos={puedeCerrar}
        />
    )
}
