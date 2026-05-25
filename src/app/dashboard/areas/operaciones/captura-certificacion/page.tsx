import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import CapturaCertificacionClient from './CapturaCertificacionClient'

export default async function CapturaCertificacionPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    const isAdmin = session?.user?.role?.name === 'admin' || session?.user?.role?.name === 'Administrador'
    if (!isAdmin && !permissions.includes('view_captura_certificacion')) {
        redirect('/dashboard')
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <span className="text-3xl">📋</span> Cálculo de gramaje
                    </h2>
                    <p className="text-gray-500 font-bold text-sm ml-1">Cálculo de insumos y brechas por RBD</p>
                </div>
            </div>

            <CapturaCertificacionClient />
        </div>
    )
}
