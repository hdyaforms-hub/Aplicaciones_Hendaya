import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import HistoricoMatrizClient from './HistoricoMatrizClient'
import { getHistoricoInitialFilters } from './actions'

export const metadata = {
    title: 'Histórico de Matrices | Hendaya',
    description: 'Historial completo de matrices de riesgo, trazabilidad cronológica y estado de mitigaciones.'
}

export default async function HistoricoMatrizPage() {
    const session = await getSession()
    if (!session?.user) {
        redirect('/auth/login')
    }

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    const permissions = session.user.role?.permissions || []
    const hasPermission = permissions.includes('view_historico_matriz') || isAdmin

    if (!hasPermission) {
        redirect('/dashboard')
    }

    const filterOptions = await getHistoricoInitialFilters()

    return (
        <HistoricoMatrizClient 
            initialYears={filterOptions.availableYears || []}
            initialSucursales={filterOptions.sucursales || []}
            initialSupervisors={filterOptions.supervisors || []}
            isAdmin={isAdmin}
        />
    )
}
