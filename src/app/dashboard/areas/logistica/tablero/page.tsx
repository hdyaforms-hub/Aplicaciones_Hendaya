import { Metadata } from 'next'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getBodegas, getAndenes } from '@/actions/logistica/andenes'
import { getRutas } from '@/actions/logistica/rutas'
import { getChoferes, getCamiones, getClientes, getTransportistas } from '@/actions/logistica/maestros'
import TableroClient from './TableroClient'

export const metadata: Metadata = {
    title: 'Tablero de Despacho en Vivo | Hendaya Logística',
    description: 'Control visual en tiempo real de andenes, flujo de camiones y despacho de rutas.'
}

export const dynamic = 'force-dynamic'

function getTodayChileISO(): string {
    const d = new Date()
    const formatter = new Intl.DateTimeFormat('es-CL', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    })
    const parts = formatter.formatToParts(d)
    const year = parts.find(p => p.type === 'year')?.value
    const month = parts.find(p => p.type === 'month')?.value
    const day = parts.find(p => p.type === 'day')?.value
    return `${year}-${month}-${day}`
}

export default async function TableroDespachoPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const permissions = session.user.role?.permissions || ''
    const isAdmin = session.user.role?.name?.toLowerCase().includes('admin')

    if (!isAdmin && !permissions.includes('logistica:tablero:ver')) {
        redirect('/dashboard')
    }

    const fechaHoy = getTodayChileISO()

    const [bodegasRes, choferesRes, camionesRes, clientesRes, transportistasRes] = await Promise.all([
        getBodegas(),
        getChoferes(),
        getCamiones(),
        getClientes(),
        getTransportistas()
    ])

    const bodegas = bodegasRes.bodegas || []
    const defaultBodegaId = bodegas[0]?.id || ''

    const [andenesRes, rutasRes] = await Promise.all([
        defaultBodegaId ? getAndenes(defaultBodegaId) : { andenes: [] },
        defaultBodegaId ? getRutas({ bodegaId: defaultBodegaId, fechaRuta: fechaHoy }) : { rutas: [] }
    ])

    return (
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
            <TableroClient
                initialBodegas={bodegas}
                initialAndenes={andenesRes.andenes || []}
                initialRutas={rutasRes.rutas || []}
                initialFecha={fechaHoy}
                catalogos={{
                    choferes: choferesRes.choferes || [],
                    camiones: camionesRes.camiones || [],
                    clientes: clientesRes.clientes || [],
                    transportistas: transportistasRes.transportistas || []
                }}
            />
        </div>
    )
}
