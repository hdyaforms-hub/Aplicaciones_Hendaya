import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import RiesgoMinutaClient from './RiesgoMinutaClient'
import { fetchRiesgoMinutaData, RiesgoMinutaFilterParams } from './actions'

export const metadata = {
    title: 'Riesgo en Minuta | Hendaya',
    description: 'Monitoreo preventivo del nivel de riesgo en minutas alimentarias cruzado con la matriz de gravedad de preparaciones.'
}

export default async function RiesgoMinutaPage({
    searchParams
}: {
    searchParams: Promise<{
        fecha?: string
        licitacion?: string
        sucursal?: string
        rbd?: string
        nivelRiesgo?: string
        usuarioId?: string
    }>
}) {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const isAdmin = session.user.role?.name?.toLowerCase().includes('admin') ||
                    session.user.role?.name?.toLowerCase().includes('gerencia')
    const permissions = session.user.role?.permissions || []

    if (!isAdmin && !permissions.includes('view_prev_riesgo_minuta')) {
        redirect('/dashboard')
    }

    const resolved = await searchParams
    const initialFilters: RiesgoMinutaFilterParams = {
        fecha: resolved.fecha || undefined,
        licitacion: resolved.licitacion || undefined,
        sucursal: resolved.sucursal || undefined,
        rbd: resolved.rbd ? parseInt(resolved.rbd, 10) : undefined,
        nivelRiesgo: resolved.nivelRiesgo || undefined,
        usuarioId: resolved.usuarioId || undefined
    }

    const initialData = await fetchRiesgoMinutaData(initialFilters)

    return (
        <RiesgoMinutaClient
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
