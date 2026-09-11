import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import ConsumoGasClient from './ConsumoGasClient'
import { getConsumoGas } from './actions'

export default async function ConsumoGasPage() {
    const session = await getSession()
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'
    const permissions = session?.user?.role?.permissions || []

    if (!isAdmin && !permissions.includes('view_consumo_gas')) {
        redirect('/dashboard')
    }

    const { data, error } = await getConsumoGas()

    return (
        <ConsumoGasClient initialData={data || []} error={error} />
    )
}
