import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getMonitoreoAvancesData } from './actions'
import MonitoreoAvancesClient from './MonitoreoAvancesClient'

export const metadata = {
    title: 'Monitoreo de Avances | Tableros y Avances - Hendaya',
    description: 'Control de avances periódicos de matrices de riesgo y actas de supervisión en terreno con semáforo de cumplimiento.'
}

export default async function MonitoreoAvancesPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const permissions = session.user.role?.permissions || []
    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin' || roleName.includes('gerencia')

    if (!isAdmin && !permissions.includes('view_tablero_monitoreo_avances')) {
        redirect('/dashboard')
    }

    const data = await getMonitoreoAvancesData()

    return <MonitoreoAvancesClient data={data} />
}
