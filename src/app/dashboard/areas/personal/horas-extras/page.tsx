import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getHorasExtrasDataAction } from './actions'
import HorasExtrasClient from './HorasExtrasClient'

export const dynamic = 'force-dynamic'

export default async function HorasExtrasPage() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []

    if (!perms.includes('manage_personal_horas_extras_carga')) {
        redirect('/dashboard')
    }

    const dataRes = await getHorasExtrasDataAction({ page: 1, pageSize: 10 })

    return (
        <HorasExtrasClient 
            initialData={dataRes} 
            userRole={session?.user?.role?.name || ''} 
        />
    )
}
