import React from 'react'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { obtenerReclamosDataAction } from './actions'
import ReclamosProveedoresClient from './ReclamosProveedoresClient'
import { ShieldAlert } from 'lucide-react'

export const metadata = {
    title: 'Reclamos a Proveedores | Calidad | Hendaya',
    description: 'Gestión y seguimiento de reclamos por desviación de calidad e inocuidad a proveedores.'
}

export default async function ReclamosProveedoresPage() {
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    const roleName = (session.user.role?.name || '').toLowerCase()
    const perms: string[] = session.user.role?.permissions || []
    const isAdmin = roleName.includes('admin') || perms.includes('*')
    const canView = isAdmin || perms.includes('view_calidad_reclamos_proveedores') || perms.includes('view_calidad')

    if (!canView) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
                    <ShieldAlert className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Acceso Restringido</h2>
                <p className="text-sm text-slate-500 max-w-md mt-1">
                    No cuentas con los permisos necesarios para visualizar el módulo de Reclamos a Proveedores.
                    Por favor solicita autorización a tu administrador de sistemas.
                </p>
            </div>
        )
    }

    const initialData = await obtenerReclamosDataAction()

    return (
        <ReclamosProveedoresClient
            initialData={initialData}
            usuarioActual={session.user.name || session.user.username || 'Usuario'}
        />
    )
}
