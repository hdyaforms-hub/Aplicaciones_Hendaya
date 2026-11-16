import { Metadata } from 'next'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import AnalisisNCClient from './AnalisisNCClient'

export const metadata: Metadata = {
    title: 'Análisis de No Conformidades (NC) | Hendaya',
    description: 'Motor de auditoría de reglas normativas, vicios procedimentales y descargos de actas'
}

export default async function AnalisisNCPage() {
    const session = await getSession()

    if (!session?.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const permissions: string[] = Array.isArray(session.user.role?.permissions)
        ? (session.user.role.permissions as string[])
        : typeof session.user.role?.permissions === 'string'
            ? JSON.parse(session.user.role.permissions)
            : []

    const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin' || roleName.includes('gerencia')

    const hasAccess = isAdmin ||
        permissions.includes('*') ||
        permissions.includes('view_analisis_nc') ||
        permissions.includes('manage_analisis_nc')

    if (!hasAccess) {
        redirect('/dashboard')
    }

    // Registrar en auditoría el acceso al módulo
    await logAuditAction({
        username: session.user.username as string,
        userId: session.user.id || null,
        action: 'ACCESO_ANALISIS_NC',
        modulo: 'Áreas -> Multas',
        detalle: 'El usuario accedió al módulo de Análisis de No Conformidades (NC).'
    })

    return <AnalisisNCClient />
}
