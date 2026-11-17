import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { checkMultasPermission } from '@/lib/multas/permisos'
import { logAuditAction } from '@/lib/audit'
import { getMetricasTableroConsolidadoAction } from './actions'
import { prisma } from '@/lib/prisma'
import TableroConsolidadoClient from './TableroConsolidadoClient'

export const metadata = {
    title: 'Tablero Consolidado de Multas y Fiscalizaciones | Hendaya',
    description: 'Panel ejecutivo y gerencial con métricas financieras, conciliaciones REX, litigios y planes de acción por sucursal.'
}

export default async function TableroConsolidadoPage() {
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    const { authorized } = await checkMultasPermission([
        'view_tablero_multas_consolidado',
        'view_tablero_multas_ee',
        'view_multas_areas'
    ], session)

    if (!authorized) {
        redirect('/dashboard')
    }

    const canExportRes = await checkMultasPermission('export_multas_consolidado', session)
    const canExport = canExportRes.authorized

    // Registrar en auditoría
    await logAuditAction({
        username: (session.user.username || session.user.email) as string,
        userId: session.user.id || null,
        action: 'ACCESO_TABLERO_CONSOLIDADO_MULTAS',
        modulo: 'Multas · Tablero Consolidado',
        detalle: 'Acceso al Tablero Ejecutivo Consolidado de Multas.'
    })

    const [metricasRes, licitacionesDb] = await Promise.all([
        getMetricasTableroConsolidadoAction(),
        prisma.multas_Elementos_Esenciales_Cab.findMany({
            select: { licitacion: true },
            distinct: ['licitacion'],
            where: { licitacion: { not: null } }
        })
    ])

    const licitaciones = Array.from(new Set(licitacionesDb.map(l => l.licitacion).filter(Boolean))) as string[]

    return (
        <div className="w-full py-4 sm:py-6 px-2 sm:px-6 space-y-6">
            {/* Header del Módulo (Estándar Claro Hendaya) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-cyan-700 font-extrabold tracking-widest text-[11px] uppercase px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-200">
                            HENDAYA · CONTROL EJECUTIVO Y GERENCIAL
                        </span>
                        <span className="text-slate-400 text-xs font-semibold">
                            Módulo C11: Tablero Consolidado y Reportes
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
                        <span className="w-2.5 h-6 bg-cyan-600 rounded-full inline-block"></span>
                        Tablero Consolidado de Multas y Fiscalizaciones
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
                        Visión integrada de contingencias: montos notificados, defensas jurídicas, resoluciones de término de JUNAEB y cumplimiento de planes correctivos en terreno.
                    </p>
                </div>
            </div>

            <TableroConsolidadoClient
                initialMetricas={metricasRes.data}
                licitacionesDisponibles={licitaciones}
                userName={session.user.name || session.user.username || 'Usuario'}
                canExport={canExport}
            />
        </div>
    )
}
