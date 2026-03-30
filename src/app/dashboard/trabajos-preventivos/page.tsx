import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import TrabajosForm from './TrabajosForm'

export const metadata = {
    title: 'Trabajo Preventivos / Correctivos | Sistema Hendaya',
    description: 'Registro de mantenimientos y reparaciones de infraestructura.',
}

export default async function TrabajosPreventivosPage() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    const { role } = session.user as { role: { name: string, permissions: string[] } }

    if (!role.permissions.includes('view_trabajos_preventivos') && role.name !== 'Administrador') {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 p-8 rounded-3xl animate-in fade-in duration-500">
                <h3 className="text-xl font-black mb-2 flex items-center gap-2">
                    <span>🚫</span> ACCESO DENEGADO
                </h3>
                <p className="font-medium">No cuentas con los privilegios necesarios para registrar Trabajos Preventivos o Correctivos en el sistema.</p>
                <div className="mt-6">
                    <a href="/dashboard" className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-red-200 hover:bg-red-700 transition-colors">Volver al Inicio</a>
                </div>
            </div>
        )
    }

    const userName = session.user.name || session.user.username;

    return (
        <div className="min-h-screen pb-20">
            <TrabajosForm userName={userName} />
        </div>
    )
}
