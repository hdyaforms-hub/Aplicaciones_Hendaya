import { Metadata } from 'next'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getBodegas } from '@/actions/logistica/andenes'
import { getRutas } from '@/actions/logistica/rutas'
import RutasClient from './RutasClient'

export const metadata: Metadata = {
    title: 'Historial de Rutas y Despachos | Hendaya Logística',
    description: 'Consulta histórica, trazabilidad paso a paso y exportación a Excel de rutas de despacho.'
}

export const dynamic = 'force-dynamic'

export default async function RutasHistoricoPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const permissions = session.user.role?.permissions || ''
    const isAdmin = session.user.role?.name?.toLowerCase().includes('admin')

    if (!isAdmin && !permissions.includes('logistica:rutas:ver')) {
        redirect('/dashboard')
    }

    const [bodegasRes, rutasRes] = await Promise.all([
        getBodegas(),
        getRutas({ take: 300 })
    ])

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
            <RutasClient
                initialBodegas={bodegasRes.bodegas || []}
                initialRutas={rutasRes.rutas || []}
                canForzarEstado={isAdmin || permissions.includes('logistica:rutas:forzar_estado')}
                canCancelar={isAdmin || permissions.includes('logistica:rutas:cancelar')}
            />
        </div>
    )
}
