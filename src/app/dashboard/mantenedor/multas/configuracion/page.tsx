import React from 'react'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getLicitacionesConfiguracion } from './actions'
import ConfiguracionMultasClient from './ConfiguracionMultasClient'

export const metadata = {
    title: 'Configuración de Multas | Hendaya',
    description: 'Hub de configuración global de multas, parámetros técnicos y módulos del sistema por licitación'
}

export default async function ConfiguracionMultasPage() {
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
        perms.includes('manage_multa_configuracion')

    if (!isAuthorized) {
        redirect('/dashboard')
    }

    const res = await getLicitacionesConfiguracion()

    return (
        <div className="container mx-auto p-4 md:p-6 max-w-7xl">
            <ConfiguracionMultasClient
                licitaciones={res.licitaciones || []}
            />
        </div>
    )
}
