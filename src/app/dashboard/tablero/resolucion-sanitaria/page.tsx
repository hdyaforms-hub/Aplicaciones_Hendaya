import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import TableroResolucionSanitariaClient from './TableroResolucionSanitariaClient'
import { getTableroResolucionSanitariaData } from './actions'

export const metadata = {
    title: 'Tablero Resolución Sanitaria | Hendaya',
    description: 'Comportamiento histórico y análisis multianual de resoluciones sanitarias por RBD'
}

export default async function TableroResolucionSanitariaPage() {
    const session = await getSession()

    if (!session?.user) {
        redirect('/login')
    }

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    const permissions = session.user.role?.permissions || []
    const hasCalidadArea = (session.user as any)?.areas?.some((a: any) => a.nombre?.toLowerCase().includes('calidad'))

    const hasAccess = isAdmin ||
        hasCalidadArea ||
        permissions.includes('view_tablero_resolucion_sanitaria') ||
        permissions.includes('view_tablero') ||
        permissions.includes('view_calidad_resolucion_sanitaria')

    if (!hasAccess) {
        redirect('/dashboard')
    }

    // Registrar en auditoría el acceso al tablero
    await logAuditAction({
        username: session.user.username as string,
        userId: session.user.id || null,
        action: 'ACCESO_TABLERO_RESOLUCION_SANITARIA',
        modulo: 'Tableros y Avances',
        detalle: 'El usuario ingresó al Tablero y Monitoreo Multianual de Resoluciones Sanitarias'
    })

    // Cargar datos iniciales
    const initialData = await getTableroResolucionSanitariaData()

    return (
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
            <TableroResolucionSanitariaClient initialData={initialData} />
        </div>
    )
}
