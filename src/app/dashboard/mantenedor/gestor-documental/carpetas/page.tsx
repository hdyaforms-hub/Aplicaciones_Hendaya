import React from 'react'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { isGlobalDocAdmin, normalizeUserPermissions } from '@/lib/doc-permissions'
import CarpetasClient from './CarpetasClient'

export const metadata = {
    title: 'Carpetas y Documentos | Gestor Documental | Hendaya',
    description: 'Administración de estructura de carpetas y carga de archivos en Microsoft OneDrive.'
}

export default async function CarpetasPage() {
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    const permissions = normalizeUserPermissions(session.user.role?.permissions)
    const canManage = isGlobalDocAdmin(session.user) || permissions.includes('manage_doc_carpetas')

    if (!canManage) {
        redirect('/dashboard/documentos')
    }

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <CarpetasClient user={session.user} />
        </div>
    )
}
