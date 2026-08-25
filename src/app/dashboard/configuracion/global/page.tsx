import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getGlobalConfig } from '@/lib/global-config'
import GlobalConfigClient from './GlobalConfigClient'

export const metadata = {
    title: 'Configuración Global | Hendaya',
    description: 'Parámetros globales del sistema y duración de sesión'
}

export default async function GlobalConfigPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []
    const isAdmin = session?.user?.role?.name === 'admin' || session?.user?.role?.name === 'Administrador'

    if (!isAdmin && !permissions.includes('manage_global_config')) {
        redirect('/dashboard')
    }

    const config = await getGlobalConfig()

    return (
        <GlobalConfigClient initialConfig={config} />
    )
}
