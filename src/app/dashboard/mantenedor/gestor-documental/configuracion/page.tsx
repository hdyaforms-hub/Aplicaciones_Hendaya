import React from 'react'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { isGlobalDocAdmin, normalizeUserPermissions } from '@/lib/doc-permissions'
import ConfiguracionClient from './ConfiguracionClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
    title: 'Configuración OneDrive | Gestor Documental | Hendaya',
    description: 'Configuración de conexión y credenciales de Microsoft Graph API / Azure para el Gestor Documental.'
}

export default async function ConfiguracionPage() {
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    const permissions = normalizeUserPermissions(session.user.role?.permissions)
    const canManage = isGlobalDocAdmin(session.user) || permissions.includes('manage_doc_configuracion')

    if (!canManage) {
        redirect('/dashboard/documentos')
    }

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <ConfiguracionClient user={session.user} />
        </div>
    )
}
