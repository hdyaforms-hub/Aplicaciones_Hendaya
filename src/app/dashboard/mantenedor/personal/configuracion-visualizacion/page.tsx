import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getConfiguracionVisualizacionDataAction } from './actions'
import ConfiguracionVisualizacionClient from './ConfiguracionVisualizacionClient'

export const metadata = {
    title: 'Configuración de visualización | Mantenedor - Hendaya',
    description: 'Asociación de colaboradores de Dotación a jefaturas por usuarios o roles con restricción de RBD.'
}

export default async function ConfiguracionVisualizacionPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const permissions = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'

    if (!isAdmin && !permissions.includes('manage_personal_visualizacion')) {
        redirect('/dashboard')
    }

    const data = await getConfiguracionVisualizacionDataAction()

    return <ConfiguracionVisualizacionClient initialData={data} />
}
