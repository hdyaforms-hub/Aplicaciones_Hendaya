import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getUsuariosCuentasRHAction } from './actions'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import AdmCuentasClient from './AdmCuentasClient'

export const dynamic = 'force-dynamic'

export default async function AdmCuentasPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const perms = session.user.role?.permissions || []
    const roleName = session.user.role?.name || ''
    const isAdmin = roleName === 'Administrador' || roleName === 'admin'
    const hasPermission = isAdmin || perms.includes('manage_personal_cuentas_admin')

    if (!hasPermission) {
        redirect('/dashboard')
    }

    const [usuariosRes, authorizedRbds] = await Promise.all([
        getUsuariosCuentasRHAction({ filtroAlcance: 'SOLO_RH' }),
        getUserEffectiveRbds()
    ])

    const isSystemAdmin = authorizedRbds === null

    return (
        <AdmCuentasClient
            initialUsuarios={usuariosRes.success && usuariosRes.data ? usuariosRes.data : []}
            currentUserId={session.user.id}
            isAdmin={isSystemAdmin}
        />
    )
}
