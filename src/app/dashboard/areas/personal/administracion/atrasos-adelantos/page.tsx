import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getAdmAtrasosAction, getHistorialCargasAtrasosAction, getFiltrosMetadatosAtrasosAction } from './actions'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { puedeUsuarioCerrarPeriodosRH } from '@/lib/personal-cuentas-db-init'
import AdmAtrasosClient from './AdmAtrasosClient'

export const dynamic = 'force-dynamic'

export default async function AdmAtrasosPage() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []

    if (!perms.includes('manage_personal_atrasos_admin')) {
        redirect('/dashboard')
    }

    const [regRes, cargasRes, authorizedRbds, puedeCerrar, metadatosFiltros] = await Promise.all([
        getAdmAtrasosAction({ page: 1, pageSize: 10, tipo: 'ADELANTO' }),
        getHistorialCargasAtrasosAction('ADELANTO'),
        getUserEffectiveRbds(),
        puedeUsuarioCerrarPeriodosRH(session.user.id),
        getFiltrosMetadatosAtrasosAction()
    ])

    const isGlobal = authorizedRbds === null || 
                     perms.includes('view_all_personal_asistencia') || 
                     perms.includes('manage_personal_atrasos_admin') ||
                     session?.user?.role?.name?.toLowerCase().includes('admin') ||
                     session?.user?.role?.name?.toLowerCase().includes('gerencia')

    const isAdmin = isGlobal
    const userRbds = isGlobal ? [] : (authorizedRbds ?? [])

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

    const initialRegistrosData = (regRes.success && regRes.data) ? {
        data: regRes.data,
        total: regRes.total ?? 0,
        page: regRes.page ?? 1,
        pageSize: regRes.pageSize ?? 10,
        sucursales: regRes.sucursales ?? [],
        supervisores: regRes.supervisores ?? [],
        establecimientos: regRes.establecimientos ?? [],
        resumen: regRes.resumen
    } : fallbackData

    return (
        <AdmAtrasosClient
            initialRegistrosData={initialRegistrosData}
            initialCargas={cargasRes.success && cargasRes.data ? cargasRes.data : []}
            userRbds={userRbds}
            isAdmin={isAdmin}
            puedeGestionarPeriodos={puedeCerrar}
            metadatosFiltros={metadatosFiltros}
        />
    )
}
