import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import ResolucionSanitariaClient from './ResolucionSanitariaClient'
import { logAuditAction } from '@/lib/audit'

export const metadata = {
    title: 'Resolución Sanitaria | Calidad - Hendaya',
    description: 'Gestión anual de Resoluciones Sanitarias de establecimientos por RBD y Licitación.'
}

export default async function ResolucionSanitariaPage() {
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    const permissions = session.user.role?.permissions || []
    const hasCalidadArea = (session.user as any)?.areas?.some((a: any) => a.nombre?.toLowerCase().includes('calidad'))

    if (!isAdmin && !hasCalidadArea && !permissions.includes('view_calidad_resolucion_sanitaria')) {
        redirect('/dashboard')
    }

    // Registrar visita al módulo en auditoría
    await logAuditAction({
        username: session.user.username as string,
        userId: session.user.id || null,
        action: 'NAVEGACION_RESOLUCION_SANITARIA',
        modulo: 'Áreas -> Calidad',
        detalle: 'Ingresó al módulo de Resolución Sanitaria'
    })

    const canManage = isAdmin || hasCalidadArea || permissions.includes('manage_calidad_resolucion_sanitaria')

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
            <ResolucionSanitariaClient canManage={canManage} />
        </div>
    )
}
