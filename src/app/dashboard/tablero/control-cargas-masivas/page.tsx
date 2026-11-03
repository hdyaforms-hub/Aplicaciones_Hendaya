import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import ControlCargasClient from './ControlCargasClient'
import { getControlCargasMasivasData } from './actions'

export const metadata = {
    title: 'Control de Cargas Masivas | Tableros y Avances - Hendaya',
    description: 'Tablero ejecutivo exclusivo para administración sobre el estado de planillas masivas (cargadas vs pendientes) del mes actual y próximo mes.'
}

export default async function ControlCargasMasivasPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin' || roleName.includes('gerencia')
    const permissions = session.user.role?.permissions || []

    if (!isAdmin && !permissions.includes('view_tablero_control_cargas')) {
        redirect('/dashboard')
    }

    const initialData = await getControlCargasMasivasData()

    return (
        <ControlCargasClient
            initialData={initialData}
            currentUser={{
                username: session.user.username,
                name: session.user.name,
                roleName: session.user.role?.name
            }}
        />
    )
}

