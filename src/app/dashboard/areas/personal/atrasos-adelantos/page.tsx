import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getAtrasosDataAction } from './actions'
import AtrasosAdelantosCargaClient from './AtrasosAdelantosCargaClient'

export const dynamic = 'force-dynamic'

export default async function AtrasosAdelantosCargaPage() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []

    if (!perms.includes('manage_personal_atrasos_carga')) {
        redirect('/dashboard')
    }

    const dataRes = await getAtrasosDataAction({ page: 1, pageSize: 10 })

    return (
        <AtrasosAdelantosCargaClient
            initialData={dataRes}
            userRole={session?.user?.role?.name || ''}
        />
    )
}
