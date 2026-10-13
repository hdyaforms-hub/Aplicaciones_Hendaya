import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getDotacionDataAction } from './actions'
import DotacionClient from './DotacionClient'

export const dynamic = 'force-dynamic'

export default async function DotacionPage() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []

    if (!perms.includes('manage_personal_dotacion_carga')) {
        redirect('/dashboard')
    }

    const dataRes = await getDotacionDataAction({ page: 1, pageSize: 10 })

    return (
        <DotacionClient 
            initialData={dataRes} 
            userRole={session?.user?.role?.name || ''} 
        />
    )
}
