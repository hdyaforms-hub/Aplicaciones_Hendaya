import { Metadata } from 'next'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getBodegas, getAndenes } from '@/actions/logistica/andenes'
import {
    getChoferes,
    getCamiones,
    getTransportistas,
    getClientes,
    getParametros
} from '@/actions/logistica/maestros'
import ConfiguracionClient from './ConfiguracionClient'

export const metadata: Metadata = {
    title: 'Configuración Logística | Hendaya',
    description: 'Administración de bodegas, andenes, choferes, camiones, transportistas y parámetros logísticos.'
}

export const dynamic = 'force-dynamic'

export default async function ConfiguracionLogisticaPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const permissions = session.user.role?.permissions || ''
    const isAdmin = session.user.role?.name?.toLowerCase().includes('admin')

    if (!isAdmin && !permissions.includes('logistica:config:ver')) {
        redirect('/dashboard')
    }

    const [bodegasRes, choferesRes, camionesRes, transportistasRes, clientesRes, parametrosRes] =
        await Promise.all([
            getBodegas(),
            getChoferes(),
            getCamiones(),
            getTransportistas(),
            getClientes(),
            getParametros()
        ])

    const bodegas = bodegasRes.bodegas || []
    const defaultBodegaId = bodegas[0]?.id || ''
    const andenesRes = defaultBodegaId ? await getAndenes(defaultBodegaId) : { andenes: [] }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <ConfiguracionClient
                initialBodegas={bodegas}
                initialAndenes={andenesRes.andenes || []}
                initialChoferes={choferesRes.choferes || []}
                initialCamiones={camionesRes.camiones || []}
                initialTransportistas={transportistasRes.transportistas || []}
                initialClientes={clientesRes.clientes || []}
                initialParametros={parametrosRes.parametros || []}
            />
        </div>
    )
}
