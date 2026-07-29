import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import MultasEEDashboardClient from './MultasEEDashboardClient'

export default async function MultasEEDashboardPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_tablero_multas_ee')) {
        redirect('/dashboard')
    }

    // Fetch non-annulled valid folios from ElementosEsenciales_Cab
    const validOriginalCabs = await prisma.elementosEsenciales_Cab.findMany({
        where: { anulado: { not: true } },
        select: { folio: true }
    })
    const validFoliosSet = new Set(validOriginalCabs.map(c => c.folio).filter(Boolean))

    // Fetch calculated fines
    const allCalculos = await prisma.multas_Elementos_Esenciales_Cab.findMany({
        select: {
            licitacion: true,
            fechaSupervision: true,
            folioOriginal: true
        }
    })

    // Filter to only include active calculations matching valid imported folios
    const activeCalculos = allCalculos.filter(c => c.folioOriginal && validFoliosSet.has(c.folioOriginal))

    const availableLicitaciones = Array.from(new Set(activeCalculos.map(c => c.licitacion).filter(Boolean))) as string[]
    const availableAnos = Array.from(new Set(activeCalculos.map(c => c.fechaSupervision?.getFullYear()).filter(Boolean))) as number[]

    // Fetch distinct sucursales for filter
    const sucursalesDb = await prisma.colegiosMatriz.findMany({
        select: { sucursal: true },
        distinct: ['sucursal'],
        where: { sucursal: { not: '' } },
        orderBy: { sucursal: 'asc' }
    })
    const availableSucursales = sucursalesDb.map(s => s.sucursal).filter(Boolean) as string[]

    // Fetch active supervisores for filter
    const supervisoresDb = await prisma.supervisor.findMany({
        where: { vigente: true },
        include: { rbdsAuditar: { select: { rbd: true } } },
        orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }]
    })
    const rbdSucursalMap = new Map<number, string>()
    sucursalesDb.forEach(s => {
        if (s.sucursal) {
            // We also fetch colegiosMatriz mapping below for accurate sucursal labels
        }
    })
    const colegiosMatrizDb = await prisma.colegiosMatriz.findMany({
        select: { colRBD: true, sucursal: true }
    })
    colegiosMatrizDb.forEach(c => {
        if (c.colRBD && c.sucursal) rbdSucursalMap.set(c.colRBD, c.sucursal)
    })

    const availableSupervisores = Array.from(new Set(supervisoresDb.map(s => {
        const nombreBase = `${s.nombre} ${s.apellido}`.trim()
        const sucursales = Array.from(new Set(s.rbdsAuditar.map(r => rbdSucursalMap.get(r.rbd)).filter((v): v is string => Boolean(v))))
        const sucursalName = sucursales.length > 0 ? sucursales[0] : ''
        return sucursalName ? `${nombreBase} (${sucursalName})` : nombreBase
    }))).sort()

    return (
        <div className="space-y-6">
            {/* Title / Header */}
            <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full -mr-40 -mt-40 blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.25em] bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                                Tableros Gerenciales
                            </span>
                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-[0.25em] bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 flex items-center gap-1">
                                <span>⚠️</span> Montos Estimados
                            </span>
                        </div>
                        <h2 className="text-3xl font-black tracking-tight mt-3 flex items-center gap-2">
                            <span>📊</span> Analítica de Multas EE
                        </h2>
                        <p className="text-slate-400 mt-2 text-sm leading-relaxed max-w-xl">
                            Visualización analítica de multas estimadas por Elementos Esenciales no conformes. Estos montos son de carácter preliminar y se consolidarán como reales una vez finalizada la parametrización final.
                        </p>
                    </div>
                </div>

                {/* Banner Leyenda Estimado */}
                <div className="mt-6 bg-slate-800/50 border border-amber-500/20 p-4 rounded-2xl flex items-start gap-3">
                    <span className="text-xl">ℹ️</span>
                    <div>
                        <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Leyenda de Control Presupuestario</p>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            Los montos financieros exhibidos en los gráficos e indicadores a continuación corresponden a **estimaciones preliminares**. Una vez auditada la configuración completa de fórmulas y variables asociadas a cada licitación, se eliminará el estado de estimación para reflejar montos definitivos.
                        </p>
                    </div>
                </div>
            </div>

            <MultasEEDashboardClient 
                availableLicitaciones={availableLicitaciones.sort()}
                availableAnos={availableAnos.sort((a, b) => b - a)}
                availableSucursales={availableSucursales}
                availableSupervisores={availableSupervisores}
            />
        </div>
    )
}
