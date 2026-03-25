import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export default async function DashboardPage() {
    const session = await getSession()
    const user = session?.user

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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
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
                    {sortedPmpaSummary.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {sortedPmpaSummary.map((item, idx) => (
                                <div key={idx} className="bg-gray-50 border border-gray-100 rounded-2xl p-6 hover:border-cyan-200 transition-all group shadow-sm hover:shadow-md">
                                    <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-200/60">
                                        <div>
                                            <h4 className="text-lg font-black text-gray-800">{monthNames[item.mes - 1]}</h4>
                                            <span className="text-3xl font-black text-cyan-600/20 group-hover:text-cyan-600/40 transition-colors">{item.ano}</span>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-lg">📁</div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Unidades Territoriales:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {item.uts.map(ut => (
                                                <span key={ut} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold shadow-sm hover:bg-cyan-600 hover:text-white hover:border-cyan-600 transition-all cursor-default">
                                                    UT {ut}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <span className="text-6xl mb-4 opacity-20">📭</span>
                            <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">No hay registros PMPA cargados actualmente</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
