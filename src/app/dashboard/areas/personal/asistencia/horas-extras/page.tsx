import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getAsistenciaHorasExtrasAction } from './actions'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { getUserAssignedPersonalVisualizacion } from '@/lib/authPersonalVisualizacion'
import AsistenciaHorasExtrasClient from './AsistenciaHorasExtrasClient'

export const dynamic = 'force-dynamic'

export default async function AsistenciaHorasExtrasPage() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []

    if (!perms.includes('view_personal_horas_extras')) {
        redirect('/dashboard')
    }

    const [dataRes, authorizedRbds, assignedPersonal] = await Promise.all([
        getAsistenciaHorasExtrasAction({ page: 1, pageSize: 10 }),
        getUserEffectiveRbds(),
        getUserAssignedPersonalVisualizacion()
    ])

    const hasGlobalPersonalPermission = perms.includes('view_all_personal_asistencia')
    const isAdmin = authorizedRbds === null || hasGlobalPersonalPermission
    const userRbds = authorizedRbds ?? []
    const hasConfiguredPersonal = assignedPersonal.hasConfiguredVisualizacion
    const totalPersonalAsignado = assignedPersonal.totalAsignados

    const fallbackData = {
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
        sucursales: [],
        supervisores: [],
        establecimientos: []
    }

    const initialData = (dataRes.success && dataRes.data) ? {
        data: dataRes.data,
        total: dataRes.total ?? 0,
        page: dataRes.page ?? 1,
        pageSize: dataRes.pageSize ?? 10,
        sucursales: dataRes.sucursales ?? [],
        supervisores: dataRes.supervisores ?? [],
        establecimientos: dataRes.establecimientos ?? []
    } : fallbackData

    return (
        <AsistenciaHorasExtrasClient
            initialData={initialData}
            userRbds={userRbds}
            isAdmin={isAdmin}
            hasConfiguredPersonal={hasConfiguredPersonal}
            totalPersonalAsignado={totalPersonalAsignado}
        />
    )
}
