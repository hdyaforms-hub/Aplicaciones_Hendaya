import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import { getPlanesAccionListAction } from './actions'
import SolucionesClient from './SolucionesClient'

export const metadata = {
    title: 'Planes de Acción y Soluciones Operativas | Hendaya',
    description: 'Gestión y seguimiento de planes de acción correctivos por acta y sucursal según Anexo 3 de la Instrucción de Trabajo JUNAEB.'
}

export default async function SolucionesPage() {
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const permissions = session.user.role?.permissions || []
    const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin'

    const hasAccess = isAdmin ||
        permissions.includes('view_soluciones_multas') ||
        permissions.includes('manage_soluciones_multas')

    if (!hasAccess) {
        redirect('/dashboard')
    }

    const canManage = isAdmin || permissions.includes('manage_soluciones_multas')

    // Registrar en auditoría
    await logAuditAction({
        username: (session.user.username || session.user.email) as string,
        userId: session.user.id || null,
        action: 'ACCESO_PLANES_ACCION_SOLUCIONES',
        modulo: 'Multas · Soluciones y Planes de Acción',
        detalle: 'Acceso a la bandeja de Planes de Acción Operativos.'
    })

    const res = await getPlanesAccionListAction()

    return (
        <div className="w-full py-4 sm:py-6 px-2 sm:px-6 space-y-6">
            {/* Header del Módulo (Estándar Claro) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-cyan-700 font-extrabold tracking-widest text-[11px] uppercase px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-200">
                            HENDAYA · GESTIÓN OPERATIVA EN TERRENO
                        </span>
                        <span className="text-slate-400 text-xs font-semibold">
                            Módulo C9: Soluciones y Planes de Acción
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
                        <span className="w-2.5 h-6 bg-cyan-600 rounded-full inline-block"></span>
                        Planes de Acción y Soluciones por Acta
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
                        Control y seguimiento de acciones correctivas implementadas en casinos escolares frente a no conformidades detectadas en actas de fiscalización JUNAEB.
                    </p>
                </div>
            </div>

            <SolucionesClient
                initialList={res.data || []}
                initialResumen={res.resumen}
                canManage={canManage}
                userName={session.user.name || session.user.username || 'Usuario'}
            />
        </div>
    )
}
