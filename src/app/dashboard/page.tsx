import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export default async function DashboardPage() {
    const session = await getSession()
    const user = session?.user

    const rolePermissions = user?.role?.permissions || []
    const canViewStats = rolePermissions.includes('view_dashboard_home') || user?.role?.name === 'Administrador'

    const usuariosActivos = await prisma.user.count({ where: { isActive: true } })
    const totalRoles = await prisma.role.count()
    const totalEstablecimientos = await prisma.colegios.count()

    // PMPA Load Status Logic
    const pmpaData = await prisma.pMPA.findMany({
        select: { ano: true, mes: true, rbd: true },
        distinct: ['ano', 'mes', 'rbd']
    })

    const rbdsFound = Array.from(new Set(pmpaData.map(p => p.rbd)))
    const colegiosMapData = await prisma.colegios.findMany({
        where: { colRBD: { in: rbdsFound } },
        select: { colRBD: true, colut: true }
    })

    const rbdToUt = new Map(colegiosMapData.map(c => [c.colRBD, c.colut]))
    const groups: Record<string, { ano: number, mes: number, uts: Set<number> }> = {}
    
    for (const item of pmpaData) {
        const ut = rbdToUt.get(item.rbd)
        if (ut === undefined) continue
        const key = `${item.ano}-${item.mes}`
        if (!groups[key]) {
            groups[key] = { ano: item.ano, mes: item.mes, uts: new Set() }
        }
        groups[key].uts.add(ut)
    }

    const sortedPmpaSummary = Object.values(groups)
        .sort((a, b) => b.ano !== a.ano ? b.ano - a.ano : b.mes - a.mes)
        .map(g => ({
            ...g,
            uts: Array.from(g.uts).sort((a, b) => a - b)
        }))

    // Group periods by Year for a cleaner, structured presentation
    const groupedPmpaByYear = sortedPmpaSummary.reduce((acc, curr) => {
        if (!acc[curr.ano]) {
            acc[curr.ano] = []
        }
        acc[curr.ano].push(curr)
        return acc
    }, {} as Record<number, typeof sortedPmpaSummary>)

    const sortedYears = Object.keys(groupedPmpaByYear)
        .map(Number)
        .sort((a, b) => b - a)

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-gradient-to-br from-cyan-50 to-sky-50 rounded-full blur-3xl opacity-50" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">
                            Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-sky-600 font-black">{user?.name || user?.username}</span> 👋
                        </h2>
                        <p className="mt-2 text-gray-500 text-lg font-medium">
                            Bienvenido al panel central. Acceso nivel <strong className="text-cyan-700 bg-cyan-50 px-3 py-1 rounded-lg border border-cyan-100 uppercase text-sm tracking-widest">{user?.role?.name}</strong>.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-2xl border border-gray-100">
                        <span className="text-2xl">📅</span>
                        <div>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Hoy es</p>
                            <p className="text-sm font-bold text-gray-700">{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Conditionally rendered content */}
            {canViewStats && (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                        {[
                            { title: 'Usuarios Activos', value: usuariosActivos.toString(), icon: '👥', color: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-100' },
                            { title: 'Roles Creados', value: totalRoles.toString(), icon: '🛡️', color: 'bg-sky-50 text-sky-600', border: 'border-sky-100' },
                            { title: 'Total Establecimientos', value: totalEstablecimientos.toLocaleString(), icon: '🏫', color: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-100' },
                        ].map((stat, i) => (
                            <div key={i} className={`bg-white p-7 rounded-2xl shadow-sm border ${stat.border} flex items-center justify-between group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer`}>
                                <div>
                                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{stat.title}</p>
                                    <h3 className="text-4xl font-black text-gray-900 group-hover:text-cyan-600 transition-colors uppercase italic">{stat.value}</h3>
                                </div>
                                <div className={`w-16 h-16 rounded-2xl ${stat.color} flex items-center justify-center text-4xl shadow-inner group-hover:rotate-12 transition-transform`}>
                                    {stat.icon}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* PMPA Load Status Dashboard */}
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mt-8">
                        <div className="bg-slate-900 p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl backdrop-blur-sm">📦</div>
                                <div>
                                    <h3 className="text-xl font-bold text-white tracking-tight">Estado de Carga PMPA</h3>
                                    <p className="text-slate-400 text-sm">Resumen de periodos y UTs disponibles para planificación</p>
                                </div>
                            </div>
                            <div className="bg-cyan-500/10 text-cyan-400 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-cyan-500/20">
                                {sortedPmpaSummary.length} Periodos Detectados
                            </div>
                        </div>

                        <div className="p-6">
                            {sortedYears.length > 0 ? (
                                <div className="space-y-6">
                                    {sortedYears.map((year) => {
                                        const periods = groupedPmpaByYear[year]
                                        return (
                                            <div key={year} className="bg-white border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:border-gray-300/80 transition-all duration-200">
                                                {/* Year Header */}
                                                <div className="bg-slate-50/50 border-b border-gray-200/80 px-6 py-3.5 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                                                        <h4 className="text-base font-bold text-slate-800 tracking-tight">{year}</h4>
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        {periods.length} {periods.length === 1 ? 'Periodo' : 'Periodos'}
                                                    </span>
                                                </div>

                                                {/* Period Rows */}
                                                <div className="divide-y divide-gray-100">
                                                    {periods.map((item, idx) => (
                                                        <div key={idx} className="px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-slate-50/40 transition-colors duration-150">
                                                            {/* Month Badge */}
                                                            <div className="sm:w-36 flex-shrink-0 flex items-center">
                                                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-50 text-cyan-700 rounded-lg text-xs font-bold border border-cyan-100/50 shadow-sm w-full sm:w-auto justify-center sm:justify-start">
                                                                    <span className="text-xs">📅</span>
                                                                    {monthNames[item.mes - 1]}
                                                                </span>
                                                            </div>

                                                            {/* Territorial Units */}
                                                            <div className="flex-1">
                                                                <div className="flex flex-wrap gap-1.5 items-center">
                                                                    {item.uts.map(ut => (
                                                                        <span key={ut} className="px-2.5 py-1 bg-white border border-gray-200/60 hover:bg-cyan-600 hover:text-white hover:border-cyan-600 text-slate-600 rounded-lg text-xs font-bold shadow-sm transition-all duration-150 cursor-default">
                                                                            UT {ut}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <span className="text-6xl mb-4 opacity-20">📭</span>
                                    <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">No hay registros PMPA cargados actualmente</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
