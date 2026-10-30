import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import { getHistorialCargasIndicadoresAction } from './actions'
import CargaMasivaClient from './CargaMasivaClient'

export const metadata = {
    title: 'Carga Masiva Prevención de Riesgos | Hendaya',
    description: 'Módulo de importación masiva de planillas de indicadores y siniestralidad de Prevención de Riesgos.'
}

export default async function CargaMasivaPrevRiesgosPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const permissions = session.user.role?.permissions || []
    const roleName = session.user.role?.name?.toLowerCase() || ''
    const isAdmin = roleName.includes('admin') || roleName.includes('gerencia')

    if (!isAdmin && !permissions.includes('manage_prev_riesgos_carga')) {
        redirect('/dashboard')
    }

    // Registrar ingreso a auditoría
    try {
        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'VISUALIZAR_CARGA_MASIVA_PREV_RIESGOS',
            modulo: 'Áreas -> Prev. de riesgos -> Carga masiva',
            detalle: 'Acceso a la pantalla de carga masiva de planillas de Prevención de Riesgos'
        })
    } catch (e) {
        console.error('Error registrando auditoría en CargaMasivaPrevRiesgosPage:', e)
    }

    const initialHistorial = await getHistorialCargasIndicadoresAction()

    return (
        <CargaMasivaClient
            initialHistorial={initialHistorial}
            currentUser={{
                username: session.user.username,
                name: session.user.name,
                roleName: session.user.role?.name
            }}
        />
    )
}

