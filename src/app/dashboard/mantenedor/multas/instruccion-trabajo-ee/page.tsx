import React from 'react'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getLicitacionesParaIT } from './actions'
import InstruccionTrabajoEEClient from './InstruccionTrabajoEEClient'

export const metadata = {
    title: 'Instrucción de Trabajo EE | Hendaya',
    description: 'Carga, validación y gestión de la Instrucción de Trabajo de Elementos Esenciales por licitación'
}

export default async function InstruccionTrabajoEEPage() {
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
        perms.includes('manage_multa_instruccion_ee')

    if (!isAuthorized) {
        redirect('/dashboard')
    }

    const res = await getLicitacionesParaIT()

    return (
        <div className="container mx-auto p-4 md:p-6 max-w-7xl">
            <InstruccionTrabajoEEClient
                licitaciones={res.success ? res.data : []}
                currentUserName={session.user.name || session.user.username || 'Usuario'}
            />
        </div>
    )
}

