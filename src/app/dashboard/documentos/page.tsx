import React from 'react'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import DocumentosClient from './DocumentosClient'

export const metadata = {
    title: 'Gestor Documental | Hendaya',
    description: 'Explorador y repositorio seguro de documentos corporativos Hendaya.'
}

export default async function DocumentosPage() {
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <DocumentosClient user={session.user} />
        </div>
    )
}
