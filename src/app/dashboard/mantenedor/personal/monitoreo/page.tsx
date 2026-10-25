import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getMonitoreoRRHHConfigData } from './actions'
import MonitoreoRRHHConfigClient from './MonitoreoRRHHConfigClient'

export const metadata = {
    title: 'Roles Asignados a Monitoreo RRHH | Mantenedor - Hendaya',
    description: 'Configuración de roles y perfiles sujetos a supervisión y monitoreo operativo de Recursos Humanos.'
}

export default async function MantenedorMonitoreoRRHHPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const permissions = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'

    if (!isAdmin && !permissions.includes('manage_mantenedor_monitoreo_rrhh')) {
        redirect('/dashboard')
    }

    const data = await getMonitoreoRRHHConfigData()

    return <MonitoreoRRHHConfigClient initialData={data} />
}
