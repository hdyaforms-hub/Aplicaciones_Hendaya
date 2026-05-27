import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import ConsumoGasClient from './ConsumoGasClient'
import { getConsumoGas } from './actions'

export default async function ConsumoGasPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_consumo_gas')) {
        redirect('/dashboard')
    }

    const { data, error } = await getConsumoGas()

    return (
        <ConsumoGasClient initialData={data || []} error={error} />
    )
}
