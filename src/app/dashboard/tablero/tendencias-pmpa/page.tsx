import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import TendenciasPmpaClient from './TendenciasPmpaClient'
import { fetchTendenciasPmpaData, TendenciasFilterParams } from './actions'

export const metadata = {
    title: 'Tendencias y Oscilación PMPA | Hendaya',
    description: 'Tablero de seguimiento histórico de cargas PMPA, oscilación y diferencias de raciones por programa, RBD, sucursal y mes.'
}

export default async function TendenciasPmpaPage({
    searchParams
}: {
    searchParams: Promise<{
        ano?: string
        mes?: string
        sucursal?: string
        programa?: string
        servicio?: string
        rbd?: string
    }>
}) {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const isAdmin = session.user.role?.name?.toLowerCase().includes('admin') ||
                    session.user.role?.name?.toLowerCase().includes('gerencia')
    const permissions = session.user.role?.permissions || []

    if (!isAdmin && !permissions.includes('view_tablero_tendencias_pmpa')) {
        redirect('/dashboard')
    }

    const resolved = await searchParams
    const initialFilters: TendenciasFilterParams = {
        ano: resolved.ano ? parseInt(resolved.ano, 10) : undefined,
        mes: resolved.mes ? parseInt(resolved.mes, 10) : undefined,
        sucursal: resolved.sucursal || undefined,
        programa: resolved.programa || undefined,
        servicio: resolved.servicio || undefined,
        rbd: resolved.rbd ? parseInt(resolved.rbd, 10) : undefined
    }

    const initialData = await fetchTendenciasPmpaData(initialFilters)

    return (
        <TendenciasPmpaClient
            initialData={initialData}
            initialFilters={initialFilters}
            currentUser={{
                username: session.user.username,
                name: session.user.name,
                roleName: session.user.role?.name
            }}
        />
    )
}
