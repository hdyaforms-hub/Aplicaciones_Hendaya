import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getAsistenciaAtrasosAction } from './actions'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import AsistenciaAtrasosClient from './AsistenciaAtrasosClient'

export const dynamic = 'force-dynamic'

export default async function AsistenciaAtrasosPage() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []

    if (!perms.includes('view_personal_atrasos')) {
        redirect('/dashboard')
    }

    const [dataRes, authorizedRbds] = await Promise.all([
        getAsistenciaAtrasosAction({ page: 1, pageSize: 10 }),
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
        establecimientos: [],
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
        resumen: dataRes.resumen
    } : fallbackData

    return (
        <AsistenciaAtrasosClient
            initialData={initialData}
            userRbds={userRbds}
            isAdmin={isAdmin}
        />
    )
}
