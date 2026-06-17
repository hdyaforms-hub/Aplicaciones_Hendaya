import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getLicitaciones, getMatrices } from './actions'
import NuevaMatrizDashboard from './NuevaMatrizDashboard'

export default async function NuevaMatrizPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_nueva_matriz')) {
        redirect('/dashboard')
    }

    const { licitaciones } = await getLicitaciones()
    const { matrices } = await getMatrices()

    return (
        <NuevaMatrizDashboard
            initialLicitaciones={licitaciones || []}
            initialMatrices={matrices || []}
        />
    )
}
