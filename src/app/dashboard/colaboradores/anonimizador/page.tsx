import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import AnonimizadorClient from './AnonimizadorClient'

export const metadata = {
    title: 'Anonimizador de Planillas | Sistema Hendaya',
    description: 'Anonimización de datos personales en planillas Excel con consistencia y preservación de formato.'
}

export default async function AnonimizadorPage() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    const roleName = session.user?.role?.name
    const isAdmin = roleName === 'Administrador' || roleName === 'admin'
    const permissions = session.user?.role?.permissions || []

    if (!isAdmin && !permissions.includes('view_anonimizador')) {
        redirect('/dashboard')
    }

    return <AnonimizadorClient user={session.user} />
}
