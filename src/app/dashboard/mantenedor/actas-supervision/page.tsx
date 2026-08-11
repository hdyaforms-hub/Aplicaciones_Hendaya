import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function ActasSupervisionPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

    if (!isAdmin && !permissions.includes('manage_actas_supervision')) {
        redirect('/dashboard')
    }

    redirect('/dashboard/mantenedor/actas-supervision/crear')
}
