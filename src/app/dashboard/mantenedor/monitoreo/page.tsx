import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getMonitoreoConfigData } from './actions'
import MonitoreoConfigClient from './MonitoreoConfigClient'

export const metadata = {
    title: 'Monitoreo de Evaluaciones | Mantenedor - Hendaya',
    description: 'Configuración de frecuencias de evaluación para matrices de riesgo y actas de supervisión vigentes.'
}

export default async function MonitoreoPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const permissions = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'

    if (!isAdmin && !permissions.includes('manage_mantenedor_monitoreo')) {
        redirect('/dashboard')
    }

    const data = await getMonitoreoConfigData()

    return <MonitoreoConfigClient initialData={data} />
}
