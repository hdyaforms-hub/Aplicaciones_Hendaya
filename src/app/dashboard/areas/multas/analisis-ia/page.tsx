import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import { getConfigIaAction, getLogsConsumoIaAction } from './actions'
import { prisma } from '@/lib/prisma'
import AnalisisIaClient from './AnalisisIaClient'

export const metadata = {
    title: 'Asistente y Análisis con Inteligencia Artificial | Hendaya',
    description: 'Generación asistida de defensas jurídicas por folio y digitalización multimodal de planillas de pesaje.'
}

export default async function AnalisisIaPage() {
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const permissions = session.user.role?.permissions || []
    const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin'

    const hasAccess = isAdmin ||
        permissions.includes('view_ia_multas') ||
        permissions.includes('manage_config_ia_multas')

    if (!hasAccess) {
        redirect('/dashboard')
    }

    const canManageConfig = isAdmin || permissions.includes('manage_config_ia_multas')

    // Registrar en auditoría
    await logAuditAction({
        username: (session.user.username || session.user.email) as string,
        userId: session.user.id || null,
        action: 'ACCESO_ANALISIS_IA_MULTAS',
        modulo: 'Multas · Inteligencia Artificial',
        detalle: 'Acceso al módulo de Asistente y Análisis con Inteligencia Artificial.'
    })

    const [configRes, logsRes, foliosDisponibles] = await Promise.all([
        getConfigIaAction(),
        getLogsConsumoIaAction(),
        prisma.multas_Elementos_Esenciales_Cab.findMany({
            select: {
                folioOriginal: true,
                rbd: true,
                licitacion: true,
                montoTotalCalculado: true
            },
            orderBy: { fechaSupervision: 'desc' },
            take: 50
        })
    ])

    return (
        <div className="w-full py-4 sm:py-6 px-2 sm:px-6 space-y-6">
            {/* Header del Módulo (Estándar Claro Hendaya) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-cyan-700 font-extrabold tracking-widest text-[11px] uppercase px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-200">
                            HENDAYA · ASISTENTE COGNITIVO Y VISIÓN
                        </span>
                        <span className="text-slate-400 text-xs font-semibold">
                            Módulo C10: Inteligencia Artificial
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
                        <span className="w-2.5 h-6 bg-cyan-600 rounded-full inline-block"></span>
                        Asistente Legal y Análisis con IA
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
                        Formulación asistida de defensas jurídicas fundamentadas en las 19 reglas normativas y extracción visual automática de planillas de pesaje de supervisión.
                    </p>
                </div>
            </div>

            <AnalisisIaClient
                initialConfig={configRes.data}
                initialLogs={logsRes.data || []}
                foliosDisponibles={foliosDisponibles.map(f => ({
                    folio: f.folioOriginal,
                    rbd: f.rbd,
                    licitacion: f.licitacion,
                    monto: f.montoTotalCalculado
                }))}
                canManageConfig={canManageConfig}
                userName={session.user.name || session.user.username || 'Usuario'}
            />
        </div>
    )
}
