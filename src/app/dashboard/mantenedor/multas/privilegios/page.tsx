import React from 'react'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getUsuariosConPrivilegios } from './actions'
import PrivilegiosMultasClient from './PrivilegiosMultasClient'

export const metadata = {
    title: 'Privilegios Multas EE | Hendaya',
    description: 'Administración de privilegios de eliminación para Carga de Elementos Esenciales'
}

export default async function PrivilegiosMultasPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const perms = session.user.role?.permissions || []

    const isAuthorized =
        roleName === 'administrador' ||
        roleName === 'admin' ||
        roleName === 'super admin' ||
        perms.includes('manage_multa_privilegios')

    if (!isAuthorized) {
        redirect('/dashboard')
    }

    const res = await getUsuariosConPrivilegios()

    return (
        <div className="container mx-auto p-4 md:p-6 max-w-7xl">
            <PrivilegiosMultasClient
                initialUsers={res.success ? res.data : []}
                currentUserName={session.user.name || session.user.username || 'Usuario'}
            />
        </div>
    )
}

