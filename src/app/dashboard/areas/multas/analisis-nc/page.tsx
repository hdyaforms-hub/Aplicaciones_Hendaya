import { Metadata } from 'next'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import AnalisisNCClient from './AnalisisNCClient'

export const metadata: Metadata = {
    title: 'Análisis de No Conformidades (NC) | Hendaya',
    description: 'Motor de auditoría de reglas normativas, vicios procedimentales y descargos de actas'
}

export default async function AnalisisNCPage() {
    const session = await getSession()

    if (!session?.user?.id) {
        redirect('/login')
    }

    // Consulta fresca a la base de datos para revocación inmediata de permisos
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true }
    })

    if (!user?.role) {
        redirect('/dashboard')
    }

    const roleName = user.role.name?.toLowerCase().trim() || ''
    const permissions: string[] = Array.isArray(user.role.permissions)
        ? (user.role.permissions as string[])
        : typeof user.role.permissions === 'string'
            ? (() => { try { return JSON.parse(user.role.permissions) } catch { return [] } })()
            : []

    const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin'

    const hasAccess = isAdmin ||
        permissions.includes('*') ||
        permissions.includes('view_analisis_nc') ||
        permissions.includes('manage_analisis_nc') ||
        permissions.includes('manage_calculos_ee') ||
        permissions.includes('manage_descargos') ||
        permissions.includes('view_multas_areas')

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
