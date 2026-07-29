import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getDescargosFilters } from './actions'
import DescargosClient from './DescargosClient'

export default async function DescargosPage() {
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    const hasPerm = session.user.role?.permissions.includes('manage_descargos')
    if (!isAdmin && !hasPerm) {
        redirect('/dashboard')
    }

    const initialFilters = await getDescargosFilters()

    return (
        <DescargosClient initialFilters={initialFilters} />
    )
}
