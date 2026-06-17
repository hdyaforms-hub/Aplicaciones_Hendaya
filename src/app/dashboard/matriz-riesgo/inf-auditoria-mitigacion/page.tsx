import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import InfAuditoriaClient from './InfAuditoriaClient'
import { getFiltrosIniciales } from './actions'

export const metadata = {
    title: 'Inf. Auditoria Mitigación | AplicacionWeb',
}

export default async function InfAuditoriaMitigacionPage() {
    const session = await getSession()
    if (!session) redirect('/auth/login')

    const hasPermission = session.user.role.permissions.includes('view_inf_auditoria_mitigacion')
    if (!hasPermission) {
        return (
            <div className="p-8 text-center bg-white rounded-3xl shadow-sm border border-red-100">
                <div className="text-4xl mb-4">🔒</div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Acceso Denegado</h2>
                <p className="text-slate-500">No tienes los permisos necesarios para ver este reporte.</p>
            </div>
        )
    }

    const res = await getFiltrosIniciales()

    return (
        <div className="max-w-7xl mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Informe Auditoría Mitigación</h1>
                <p className="text-sm text-slate-500 mt-1">Filtre y genere los reportes consolidados del estado de mitigación.</p>
            </div>

            <InfAuditoriaClient licitaciones={res.licitaciones || []} plantillas={res.plantillas || []} />
        </div>
    )
}
