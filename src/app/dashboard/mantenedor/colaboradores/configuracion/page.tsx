import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { obtenerNoticiasAdminAction, obtenerFuentesRSSAction } from './actions'
import ConfiguracionColaboradoresClient from './ConfiguracionColaboradoresClient'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Configuración de Colaboradores | Mantenedor Hendaya',
    description: 'Gestión y sincronización de noticias para la Sala de Reuniones y parámetros de Colaboradores.'
}

export default async function ConfiguracionColaboradoresPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const perms: string[] = session.user.role?.permissions || []
    const isAdmin = roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin'
    const canView = isAdmin || perms.includes('view_mantenedor_colaboradores_configuracion') || perms.includes('view_colaboradores')
    const canManage = isAdmin || perms.includes('manage_mantenedor_colaboradores_configuracion')

    if (!canView) {
        redirect('/dashboard')
    }

    const [noticiasRes, fuentesRes] = await Promise.all([
        obtenerNoticiasAdminAction(),
        obtenerFuentesRSSAction()
    ])

    const noticias = noticiasRes.success && noticiasRes.data ? noticiasRes.data : []
    const fuentes = fuentesRes.success && fuentesRes.data ? fuentesRes.data : []

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <ConfiguracionColaboradoresClient
                initialNoticias={noticias}
                initialFuentes={fuentes}
                canManage={canManage}
                userName={session.user.name || session.user.username || 'Usuario'}
            />
        </div>
    )
}
