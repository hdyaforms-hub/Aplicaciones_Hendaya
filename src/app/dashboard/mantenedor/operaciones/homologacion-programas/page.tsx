import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getProgramasHomologacionAction } from './actions'
import HomologacionProgramasClient from './HomologacionProgramasClient'

export const dynamic = 'force-dynamic'

export default async function HomologacionProgramasPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const isAdmin = roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin' || roleName.includes('gerencia')
    const permissions = session.user.role?.permissions || []
    const hasPermission = isAdmin || permissions.includes('manage_homologacion_programas') || permissions.includes('view_pmpa')

    if (!hasPermission) {
        redirect('/dashboard')
    }

    const response = await getProgramasHomologacionAction()

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            <HomologacionProgramasClient
                initialItems={response.data}
                isRestricted={response.isRestricted}
                allowedRbdsCount={response.allowedRbdsCount}
                resumen={response.resumen}
            />
        </div>
    )
}

