import { getPantallasConfig, getListasCorreo, getPlantillasConfig } from './actions'
import NotificacionesClient from './NotificacionesClient'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

export const metadata = {
    title: 'Notificaciones por Pantalla | Sistema Hendaya'
}

export default async function NotificacionesPage() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    const { role } = session.user as { role: { permissions: string[] } }

    if (!role.permissions.includes('manage_notificaciones')) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
                <h3 className="font-semibold mb-1">Acceso Denegado</h3>
                <p>No tienes permiso para gestionar esta sección.</p>
            </div>
        )
    }

    const configuraciones = await getPantallasConfig()
    const listasCorreo = await getListasCorreo()
    const plantillas = await getPlantillasConfig()

    return (
        <div className="space-y-6">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">🔔</span>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Notificaciones por Pantalla</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Asocia listas de distribución a las acciones clave de las aplicaciones del sitio.<br/>
                            Los usuarios en las listas seleccionadas recibirán un correo cuando se registre nueva información.
                        </p>
                    </div>
                </div>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <NotificacionesClient 
                    configuraciones={configuraciones} 
                    listasCorreo={listasCorreo}
                    plantillas={plantillas}
                />
            </div>
        </div>
    )
}
