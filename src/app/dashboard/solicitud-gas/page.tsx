
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import SolicitudGasClient from './SolicitudGasClient'

export const metadata = {
    title: 'Solicitud de Gas | Sistema Hendaya',
}

export default async function SolicitudGasPage() {
    const session = await getSession()
    
    // Admin has access to everything
    const permissions = session?.user?.role?.permissions || []
    if (!permissions.includes('view_solicitud_gas') && session?.user?.role?.name !== 'Administrador') {
        redirect('/dashboard')
    }

    return (
        <div className="py-2">
            <SolicitudGasClient userName={session?.user?.name || session?.user?.username || 'Usuario'} />
        </div>
    )
}
