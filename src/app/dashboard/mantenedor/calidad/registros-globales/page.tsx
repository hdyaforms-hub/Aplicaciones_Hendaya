import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { obtenerMotivosC8Action, obtenerValoresContratoAction } from './actions'
import RegistrosGlobalesClient from './RegistrosGlobalesClient'

export const dynamic = 'force-dynamic'

export default async function RegistrosGlobalesPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const perms: string[] = session.user.role?.permissions || []
    const isAdmin = roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin'
    const canView = isAdmin || perms.includes('view_calidad_registros_globales') || perms.includes('view_calidad')
    const canManage = isAdmin || perms.includes('manage_calidad_registros_globales')

    if (!canView) {
        redirect('/dashboard')
    }

    const [motivosRes, contratosRes, licitacionesDb] = await Promise.all([
        obtenerMotivosC8Action(),
        obtenerValoresContratoAction(),
        prisma.licitacion.findMany({
            select: { licId: true, licitacionHomologada: true },
            orderBy: { licId: 'asc' }
        })
    ])

    const motivos = motivosRes.success && motivosRes.data ? motivosRes.data : []
    const valoresContrato = contratosRes.success && contratosRes.data ? contratosRes.data : []
    const licitaciones = licitacionesDb.map(l => ({
        id: String(l.licId),
        label: l.licitacionHomologada 
            ? `Licitación ${l.licId} - ${l.licitacionHomologada}` 
            : `Licitación ${l.licId}`
    }))

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <RegistrosGlobalesClient
                initialMotivos={motivos}
                initialValoresContrato={valoresContrato}
                licitaciones={licitaciones}
                canManage={canManage}
                userName={session.user.name || session.user.username || 'Usuario'}
            />
        </div>
    )
}
