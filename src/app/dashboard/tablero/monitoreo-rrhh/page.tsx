import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getMonitoreoRRHHTableroData } from './actions'
import MonitoreoRRHHClient from './MonitoreoRRHHClient'

export const metadata = {
    title: 'Monitoreo RRHH | Tableros y Avances - Hendaya',
    description: 'Control de avances operativo de RRHH (Ausentismo, Horas Extras, Atrasos y Adelantos) por colaborador y establecimiento.'
}

export default async function MonitoreoRRHHPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const permissions = session.user.role?.permissions || []
    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin' || roleName.includes('gerencia')

    if (!isAdmin && !permissions.includes('view_tablero_monitoreo_rrhh')) {
        redirect('/dashboard')
    }

    const data = await getMonitoreoRRHHTableroData()

    return <MonitoreoRRHHClient initialData={data} />
}
