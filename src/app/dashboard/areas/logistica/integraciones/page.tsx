import { Metadata } from 'next'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getIntegracionConfig } from '@/actions/logistica/maestros'
import IntegracionesClient from './IntegracionesClient'

export const metadata: Metadata = {
    title: 'Integración n8n & Telegram | Hendaya Logística',
    description: 'Configuración de webhooks bidireccionales con n8n y bot de Telegram para despacho y andenes.'
}

export const dynamic = 'force-dynamic'

export default async function IntegracionesLogisticaPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const permissions = session.user.role?.permissions || ''
    const isAdmin = session.user.role?.name?.toLowerCase().includes('admin')

    if (!isAdmin && !permissions.includes('logistica:integraciones:ver')) {
        redirect('/dashboard')
    }

    const { config, logs } = await getIntegracionConfig()

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <IntegracionesClient initialConfig={config} initialLogs={logs || []} />
        </div>
    )
}
