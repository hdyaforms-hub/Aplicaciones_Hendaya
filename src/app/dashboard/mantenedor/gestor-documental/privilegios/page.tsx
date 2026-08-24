import React from 'react'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { isGlobalDocAdmin, normalizeUserPermissions } from '@/lib/doc-permissions'
import PrivilegiosClient from './PrivilegiosClient'

export const metadata = {
    title: 'Privilegios de Acceso | Gestor Documental | Hendaya',
    description: 'Gestión granular de permisos por carpeta para roles y usuarios en el Gestor Documental.'
}

export default async function PrivilegiosPage() {
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    const permissions = normalizeUserPermissions(session.user.role?.permissions)
    const canManage = isGlobalDocAdmin(session.user) || permissions.includes('manage_doc_privilegios')

    if (!canManage) {
        redirect('/dashboard/documentos')
    }

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <PrivilegiosClient user={session.user} />
        </div>
    )
}
