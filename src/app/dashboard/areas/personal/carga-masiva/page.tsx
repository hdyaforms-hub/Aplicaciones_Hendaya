import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getHistorialCargasAction } from './actions'
import CargaMasivaClient from './CargaMasivaClient'

export const dynamic = 'force-dynamic'

export default async function CargaMasivaPage() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []

    if (!perms.includes('manage_personal_asistencia_carga')) {
        redirect('/dashboard')
    }

    const res = await getHistorialCargasAction()
    const cargas = res.success && res.data ? res.data : []

    return <CargaMasivaClient initialCargas={cargas} />
}
