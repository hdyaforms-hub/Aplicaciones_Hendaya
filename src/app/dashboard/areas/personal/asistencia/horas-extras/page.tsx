import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getAsistenciaHorasExtrasAction } from './actions'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import AsistenciaHorasExtrasClient from './AsistenciaHorasExtrasClient'

export const dynamic = 'force-dynamic'

export default async function AsistenciaHorasExtrasPage() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []

    if (!perms.includes('view_personal_horas_extras')) {
        redirect('/dashboard')
    }

    const [dataRes, authorizedRbds] = await Promise.all([
        getAsistenciaHorasExtrasAction({ page: 1, pageSize: 10 }),
        getUserEffectiveRbds()
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
        />
    )
}
