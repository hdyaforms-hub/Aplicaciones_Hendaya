import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getAsistenciaAtrasosAction } from './actions'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { getUserAssignedPersonalVisualizacion } from '@/lib/authPersonalVisualizacion'
import AsistenciaAtrasosClient from './AsistenciaAtrasosClient'

export const dynamic = 'force-dynamic'

export default async function AsistenciaAtrasosPage() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []

    if (!perms.includes('view_personal_atrasos')) {
        redirect('/dashboard')
    }

    const [dataRes, authorizedRbds, assignedPersonal] = await Promise.all([
        getAsistenciaAtrasosAction({ page: 1, pageSize: 10, tipo: 'ADELANTO' }),
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
        establecimientos: [],
        tipoActual: 'ADELANTO' as const,
        resumen: {
            totalRegistros: 0,
            totalMinutosAtraso: 0,
            totalMinutosAdelanto: 0,
            totalAplicaDescuento: 0,
            totalJustificados: 0
        }
    }

    const initialData = (dataRes.success && dataRes.data) ? {
        data: dataRes.data,
        total: dataRes.total ?? 0,
        page: dataRes.page ?? 1,
        pageSize: dataRes.pageSize ?? 10,
        sucursales: dataRes.sucursales ?? [],
        supervisores: dataRes.supervisores ?? [],
        establecimientos: dataRes.establecimientos ?? [],
        tipoActual: dataRes.tipoActual || 'ADELANTO',
        resumen: dataRes.resumen
    } : fallbackData

    return (
        <AsistenciaAtrasosClient
            initialData={initialData}
            userRbds={userRbds}
            isAdmin={isAdmin}
            hasConfiguredPersonal={hasConfiguredPersonal}
            totalPersonalAsignado={totalPersonalAsignado}
        />
    )
}
