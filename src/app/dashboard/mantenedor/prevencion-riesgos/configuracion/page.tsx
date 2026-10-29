import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import { getPrevRiesgosConfigData } from './actions'
import ConfiguracionRiesgoClient from './ConfiguracionRiesgoClient'

export const metadata = {
    title: 'Configuración Prevención de Riesgos | Hendaya',
    description: 'Configuración de roles a visualizar y parámetros operativos de Prevención de Riesgos.'
}

export default async function ConfiguracionPrevRiesgosPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const permissions = session.user.role?.permissions || []
    const roleName = session.user.role?.name?.toLowerCase() || ''
    const isAdmin = roleName.includes('admin') || roleName.includes('gerencia')

    if (!isAdmin && !permissions.includes('manage_prev_riesgos_config')) {
        redirect('/dashboard')
    }

    // Registrar ingreso a auditoría
    try {
        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'VISUALIZAR_CONFIG_PREV_RIESGOS',
            modulo: 'Mantenedor -> Prev. de Riesgos',
            detalle: 'Acceso al mantenedor de configuración de roles a visualizar en Prevención de Riesgos'
        })
    } catch (e) {
        console.error('Error registrando auditoría en ConfiguracionPrevRiesgosPage:', e)
    }

    const configData = await getPrevRiesgosConfigData()

    return (
        <ConfiguracionRiesgoClient
            initialRoles={configData.roles}
            initialConfiguredRoles={configData.configuredRoles}
            actualizadoPor={configData.actualizadoPor}
            updatedAt={configData.updatedAt}
            currentUser={{
                username: session.user.username,
                name: session.user.name,
                roleName: session.user.role?.name
            }}
        />
    )
}

