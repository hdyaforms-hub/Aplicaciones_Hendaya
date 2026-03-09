import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import SolicitudPanClient from './SolicitudPanClient'

export const metadata = {
    title: 'Solicitud de Pan | Sistema Hendaya',
    description: 'Registro de solicitudes de Aumento y Suspensión de Pan.',
}

export default async function SolicitudPanPage() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    const { role } = session.user as { role: { permissions: string[] } }

    if (!role.permissions.includes('view_solicitud_pan')) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
                <h3 className="font-semibold mb-1">Acceso Denegado</h3>
                <p>No tienes permiso para acceder a la aplicación Solicitud de Pan.</p>
            </div>
        )
    }

    const userName = session.user.name || session.user.username;

    return (
        <div className="space-y-6">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <span>🍞</span> Solicitud de Pan
                    </h1>
                    <p className="text-gray-500 mt-1">Registra aquí las solicitudes de Aumento o Suspensión de pan para el colegio seleccionado.</p>
                </div>
                <div className="bg-sky-50 px-4 py-2 rounded-xl border border-sky-100 flex items-center gap-2 text-sm text-sky-800 font-medium">
                    <span>👤</span> Solicitante: {userName}
                </div>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                <SolicitudPanClient userName={userName} />
            </div>
        </div>
    )
}
