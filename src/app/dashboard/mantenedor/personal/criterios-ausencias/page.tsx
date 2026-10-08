import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getCriteriosAction } from './actions'
import CriteriosClient from './CriteriosClient'

export const dynamic = 'force-dynamic'

export default async function CriteriosAusenciasPage() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []

    if (!perms.includes('manage_personal_criterios')) {
        redirect('/dashboard')
    }

    const res = await getCriteriosAction()
    const criterios = res.success && res.data ? res.data : []

    return <CriteriosClient initialCriterios={criterios} />
}
