import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getGlobalConfig } from '@/lib/global-config'
import GlobalConfigClient from './GlobalConfigClient'
import { getSucursalesGlobalConfigAction } from './actions'

export const metadata = {
    title: 'Configuración Global | Hendaya',
    description: 'Parámetros globales del sistema, duración de sesión y disponibilidad de sala de reuniones'
}

export default async function GlobalConfigPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []
    const isAdmin = session?.user?.role?.name === 'admin' || session?.user?.role?.name === 'Administrador'

    if (!isAdmin && !permissions.includes('manage_global_config')) {
        redirect('/dashboard')
    }

    const config = await getGlobalConfig()
    const sucursales = await getSucursalesGlobalConfigAction()

    return (
        <GlobalConfigClient initialConfig={config} initialSucursales={sucursales} />
    )
}
