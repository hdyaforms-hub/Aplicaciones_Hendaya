import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import FirmasPendientesClient from './FirmasPendientesClient'
import { getFirmasPendientesTableroData } from './actions'

export const metadata = {
    title: 'Tablero Firmas Pendientes | Hendaya',
    description: 'Control y analítica de documentos con firma pendiente de personal por sucursal, supervisor y establecimiento.'
}

export default async function TableroFirmasPendientesPage() {
    const session = await getSession()

    if (!session?.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const permissions = session.user.role?.permissions || []
    const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin' || roleName.includes('gerencia')

    const hasAccess = isAdmin ||
        permissions.includes('view_tablero_firmas_pendientes') ||
        permissions.includes('manage_tablero_firmas_pendientes')

    if (!hasAccess) {
        redirect('/dashboard')
    }

    // Registrar en auditoría el acceso al tablero
    await logAuditAction({
        username: session.user.username as string,
        userId: session.user.id || null,
        action: 'ACCESO_TABLERO_FIRMAS_PENDIENTES',
        modulo: 'Tableros y Avances · Recursos Humanos',
        detalle: 'El usuario accedió al Tablero de Documentos con Firma Pendiente de Personal.'
    })

    // Cargar datos iniciales
    const initialData = await getFirmasPendientesTableroData()

    return (
        <div className="w-full py-4 sm:py-6 px-2 sm:px-6 space-y-6">
            <FirmasPendientesClient initialData={initialData} />
        </div>
    )
}

