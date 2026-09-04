import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import WidgetsDashboardClient from './WidgetsDashboardClient'
import { getUserWidgetLayoutsAction, fetchPlatformWidgetsDataAction } from './actions'

export const metadata = {
    title: 'Widgets Personalizables | Hendaya',
    description: 'Tablero dinámico de control con widgets modulares y esqueletos personalizables.'
}

export default async function WidgetsPage() {
    const session = await getSession()

    if (!session?.user) {
        redirect('/login')
    }

    const permissions = session.user.role?.permissions || []
    const roleName = (session.user.role?.name || '').toLowerCase()
    const isAdmin = roleName.includes('admin') || roleName.includes('administrador')

    // Control de acceso por Roles y Perfiles
    if (!isAdmin && !permissions.includes('view_tablero_widgets')) {
        redirect('/dashboard')
    }

    // Cargar formatos guardados y datos consolidados iniciales
    const [layouts, platformData] = await Promise.all([
        getUserWidgetLayoutsAction(),
        fetchPlatformWidgetsDataAction()
    ])

    const currentUser = {
        username: session.user.username,
        name: session.user.name,
        roleName: session.user.role?.name
    }

    return (
        <WidgetsDashboardClient
            initialLayouts={layouts}
            initialData={platformData}
            currentUser={currentUser}
        />
    )
}
