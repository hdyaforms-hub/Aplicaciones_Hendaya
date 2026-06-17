import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import DetalleMatrizClient from './DetalleMatrizClient'
import { getLicitaciones } from './actions'

export default async function DetalleMatrizPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('view_detalle_matriz')) {
        redirect('/dashboard')
    }

    const { licitaciones } = await getLicitaciones()
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

    return (
        <DetalleMatrizClient 
            licitaciones={licitaciones || []} 
            isAdmin={isAdmin}
        />
    )
}
