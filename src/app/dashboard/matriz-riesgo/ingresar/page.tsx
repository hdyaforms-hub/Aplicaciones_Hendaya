import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import IngresarMatrizDashboard from './IngresarMatrizDashboard'
import { getActiveMatrices } from './actions'

export const metadata = {
    title: 'Ingresar nueva Matriz | AplicacionWeb',
}

export default async function IngresarMatrizPage() {
    const session = await getSession()
    if (!session) redirect('/auth/login')

    const hasPermission = session.user.role.permissions.includes('fill_nueva_matriz')
    if (!hasPermission) {
        return (
            <div className="p-8 text-center bg-white rounded-3xl shadow-sm border border-red-100">
                <div className="text-4xl mb-4">🔒</div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Acceso Denegado</h2>
                <p className="text-slate-500">No tienes los permisos necesarios para ingresar matrices.</p>
            </div>
        )
    }

    const { matrices } = await getActiveMatrices()

    return (
        <div className="max-w-4xl mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Ingresar nueva Matriz</h1>
                <p className="text-sm text-slate-500 mt-1">Seleccione la licitación y la plantilla de matriz para comenzar a responder.</p>
            </div>

            <IngresarMatrizDashboard matrices={matrices || []} />
        </div>
    )
}
