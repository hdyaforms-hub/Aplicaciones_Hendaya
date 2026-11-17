import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import SupervisionFirmasClient from './SupervisionFirmasClient'
import { getFirmasPendientesTableroData } from '../firmas-pendientes/actions'

export const metadata = {
    title: 'Supervisión de Firmas Pendientes | Hendaya',
    description: 'Control y supervisión de documentos con firma pendiente de personal mediante filtros y tabla de detalle.'
}

export default async function SupervisionFirmasPendientesPage() {
    const session = await getSession()

    if (!session?.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const permissions = session.user.role?.permissions || []
    const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin'

    const hasAccess = isAdmin ||
        permissions.includes('view_tablero_supervision_firmas') ||
        permissions.includes('manage_tablero_supervision_firmas') ||
        permissions.includes('view_tablero_firmas_pendientes')

    if (!hasAccess) {
        redirect('/dashboard')
    }

    // Registrar en auditoría el acceso al módulo de supervisión
    await logAuditAction({
        username: session.user.username as string,
        userId: session.user.id || null,
        action: 'ACCESO_TABLERO_SUPERVISION_FIRMAS',
        modulo: 'Tableros y Avances · Supervisión',
        detalle: 'El usuario accedió al Tablero de Supervisión de Firmas Pendientes (Filtro y Tabla).'
    })

    // Cargar datos iniciales
    const initialData = await getFirmasPendientesTableroData()

    return (
        <div className="w-full py-4 sm:py-6 px-2 sm:px-6 space-y-6">
            <SupervisionFirmasClient initialData={initialData} />
        </div>
    )
}
