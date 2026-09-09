import { Metadata } from 'next'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getBodegas } from '@/actions/logistica/andenes'
import { getMetricasDespacho } from '@/actions/logistica/metricas'
import MetricasClient from './MetricasClient'

export const metadata: Metadata = {
    title: 'Métricas y KPIs de Despacho | Hendaya Logística',
    description: 'Dashboard de rotación de andenes, tiempos de permanencia, demoras y cumplimiento.'
}

export const dynamic = 'force-dynamic'

export default async function MetricasLogisticaPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const permissions = session.user.role?.permissions || ''
    const isAdmin = session.user.role?.name?.toLowerCase().includes('admin')

    if (!isAdmin && !permissions.includes('logistica:metricas:ver')) {
        redirect('/dashboard')
    }

    const fechaHoy = new Date().toISOString().slice(0, 10)
    const [bodegasRes, metricasRes] = await Promise.all([
        getBodegas(),
        getMetricasDespacho(undefined, fechaHoy)
    ])

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
            <MetricasClient
                initialBodegas={bodegasRes.bodegas || []}
                initialMetricas={metricasRes}
                initialFecha={fechaHoy}
            />
        </div>
    )
}
