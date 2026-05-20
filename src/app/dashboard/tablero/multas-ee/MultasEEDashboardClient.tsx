'use client'

import { useState, useEffect } from 'react'
import {
    BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts'

interface Totals {
    totalMonto: number
    totalSolucionable: number
    totalNoSolucionable: number
    totalFolios: number
    totalNc: number
}

interface AnualStat {
    year: number
    solucionable: number
    noSolucionable: number
    total: number
}

interface RegionStat {
    region: string
    monto: number
    folios: number
    nc: number
}

interface SchoolStat {
    rbd: number
    nombreEstablecimiento: string
    monto: number
    folios: number
    nc: number
}

interface AspectStat {
    aspecto: string
    monto: number
    count: number
}

interface StatsData {
    totals: Totals
    anualStats: AnualStat[]
    regionStats: RegionStat[]
    topSchools: SchoolStat[]
    aspectStats: AspectStat[]
}

const MONTH_NAMES = [
    { value: 1, name: "Enero" },
    { value: 2, name: "Febrero" },
    { value: 3, name: "Marzo" },
    { value: 4, name: "Abril" },
    { value: 5, name: "Mayo" },
    { value: 6, name: "Junio" },
    { value: 7, name: "Julio" },
    { value: 8, name: "Agosto" },
    { value: 9, name: "Septiembre" },
    { value: 10, name: "Octubre" },
    { value: 11, name: "Noviembre" },
    { value: 12, name: "Diciembre" }
]

export default function MultasEEDashboardClient({
    availableLicitaciones,
    availableAnos
}: {
    availableLicitaciones: string[]
    availableAnos: number[]
}) {
    const [stats, setStats] = useState<StatsData | null>(null)
    const [loading, setLoading] = useState(true)

    // Filters state
    const [licitacion, setLicitacion] = useState('')
    const [ano, setAno] = useState('')
    const [mes, setMes] = useState('')

    const fetchStats = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (licitacion) params.append('licitacion', licitacion)
            if (ano) params.append('ano', ano)
            if (mes) params.append('mes', mes)

            const res = await fetch(`/api/tablero/multas-ee?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setStats(data)
            }
        } catch (error) {
            console.error("Error fetching multas-ee statistics:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStats()
    }, [licitacion, ano, mes])

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val)
    }

    const formatShortNumber = (val: number) => {
        if (val >= 1e6) {
            return `${(val / 1e6).toFixed(1)}M`
        }
        return val.toLocaleString('es-CL')
    }

    const clearFilters = () => {
        setLicitacion('')
        setAno('')
        setMes('')
    }

    return (
        <div className="space-y-8">
            {/* Filter Panel */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Licitación</label>
                    <select
                        value={licitacion}
                        onChange={(e) => setLicitacion(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-bold text-slate-700 text-sm"
                    >
                        <option value="">Todas las licitaciones</option>
                        {availableLicitaciones.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>

                <div className="w-48">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Año</label>
                    <select
                        value={ano}
                        onChange={(e) => setAno(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-bold text-slate-700 text-sm"
                    >
                        <option value="">Todos los años</option>
                        {availableAnos.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>

                <div className="w-48">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Mes</label>
                    <select
                        value={mes}
                        onChange={(e) => setMes(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-bold text-slate-700 text-sm"
                    >
                        <option value="">Todos los meses</option>
                        {MONTH_NAMES.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                    </select>
                </div>

                <button
                    onClick={clearFilters}
                    className="px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer h-[42px]"
                >
                    Limpiar Filtros
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border border-gray-100 shadow-sm">
                    <div className="w-12 h-12 border-4 border-cyan-100 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-500 font-bold animate-pulse text-sm">Cargando analíticas para Gerencia...</p>
                </div>
            ) : stats ? (
                <div className="space-y-8 animate-in fade-in duration-500">
                    
                    {/* Executive KPI Summary Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        {/* Card 1: Total Multas */}
                        <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full -mr-12 -mt-12 blur-xl transition-transform group-hover:scale-125" />
                            <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Total Multas Calculadas (Estimado)</p>
                            <h4 className="text-2xl font-black text-white mt-4 tracking-tight">
                                {formatCurrency(stats.totals.totalMonto)}
                            </h4>
                            <p className="text-slate-500 text-[10px] mt-2 font-medium">Acumulado según filtros</p>
                        </div>

                        {/* Card 2: Monto Solucionable */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-xl" />
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Monto Solucionable (Estimado)</p>
                            <h4 className="text-2xl font-black text-emerald-700 mt-4 tracking-tight">
                                {formatCurrency(stats.totals.totalSolucionable)}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-2">
                                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-black border border-emerald-100">
                                    {stats.totals.totalMonto > 0 ? ((stats.totals.totalSolucionable / stats.totals.totalMonto) * 100).toFixed(1) : 0}%
                                </span>
                                <span className="text-slate-400 text-[10px] font-medium">del total</span>
                            </div>
                        </div>

                        {/* Card 3: Monto No Solucionable */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-red-100 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full -mr-12 -mt-12 blur-xl" />
                            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Monto No Solucionable (Estimado)</p>
                            <h4 className="text-2xl font-black text-red-700 mt-4 tracking-tight">
                                {formatCurrency(stats.totals.totalNoSolucionable)}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-2">
                                <span className="text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-black border border-red-100">
                                    {stats.totals.totalMonto > 0 ? ((stats.totals.totalNoSolucionable / stats.totals.totalMonto) * 100).toFixed(1) : 0}%
                                </span>
                                <span className="text-slate-400 text-[10px] font-medium">del total</span>
                            </div>
                        </div>

                        {/* Card 4: Cantidad de Folios */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-slate-500/5 rounded-full -mr-12 -mt-12 blur-xl" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Folios Afectados</p>
                            <h4 className="text-2xl font-black text-slate-800 mt-4 tracking-tight">
                                {stats.totals.totalFolios}
                            </h4>
                            <p className="text-slate-400 text-[10px] mt-2 font-medium">Folios con al menos 1 NC</p>
                        </div>

                        {/* Card 5: Cantidad de NC */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-100 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-12 -mt-12 blur-xl" />
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Hallazgos NC</p>
                            <h4 className="text-2xl font-black text-indigo-800 mt-4 tracking-tight">
                                {stats.totals.totalNc}
                            </h4>
                            <p className="text-slate-400 text-[10px] mt-2 font-medium">Elementos no conformes detectados</p>
                        </div>
                    </div>

                    {/* Chart Row 1: Annual Trends and Aspects */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        
                        {/* Chart: Montos por Año (Solucionable vs No Solucionable) */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:col-span-7 flex flex-col justify-between">
                            <div>
                                <h3 className="text-slate-900 text-lg font-bold tracking-tight">
                                    📈 Montos de Multas por Año
                                </h3>
                                <p className="text-slate-400 text-xs mt-1">Evolución de multas anuales catalogadas como solucionable y no solucionable</p>
                            </div>

                            <div className="h-[350px] w-full mt-6">
                                {stats.anualStats.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.anualStats} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis dataKey="year" fontSize={11} stroke="#94a3b8" fontWeight="bold" />
                                            <YAxis 
                                                fontSize={10} 
                                                stroke="#94a3b8" 
                                                tickFormatter={(val) => formatShortNumber(val)}
                                                width={50}
                                            />
                                            <Tooltip 
                                                formatter={(value: any) => [formatCurrency(value), '']}
                                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: 'white' }}
                                                labelStyle={{ fontWeight: 'black', color: '#38bdf8', marginBottom: '4px' }}
                                            />
                                            <Legend verticalAlign="top" height={36} iconType="circle" />
                                            <Bar dataKey="noSolucionable" name="No Solucionable" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={24} stackId="a" />
                                            <Bar dataKey="solucionable" name="Solucionable" fill="#10b981" radius={[6, 6, 0, 0]} barSize={24} stackId="a" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-400 italic text-sm">
                                        No hay información disponible para graficar.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Chart: Aspectos más multados */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:col-span-5 flex flex-col justify-between">
                            <div>
                                <h3 className="text-slate-900 text-lg font-bold tracking-tight">
                                    🧩 Distribución por Aspecto Multado
                                </h3>
                                <p className="text-slate-400 text-xs mt-1">Comparativa de los aspectos que acumulan mayor valor financiero de multa</p>
                            </div>

                            <div className="h-[350px] w-full mt-6">
                                {stats.aspectStats.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart 
                                            data={stats.aspectStats.slice(0, 7)} 
                                            layout="vertical"
                                            margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                            <XAxis 
                                                type="number" 
                                                fontSize={10} 
                                                stroke="#94a3b8" 
                                                tickFormatter={(val) => formatShortNumber(val)}
                                            />
                                            <YAxis 
                                                dataKey="aspecto" 
                                                type="category" 
                                                fontSize={10} 
                                                stroke="#94a3b8" 
                                                width={75}
                                                fontWeight="bold"
                                            />
                                            <Tooltip 
                                                formatter={(value: any) => [formatCurrency(value), 'Monto Multado']}
                                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: 'white' }}
                                            />
                                            <Bar dataKey="monto" fill="#06b6d4" radius={[0, 6, 6, 0]} barSize={14}>
                                                {stats.aspectStats.slice(0, 7).map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#0e7490' : '#06b6d4'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-400 italic text-sm">
                                        No hay información disponible.
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Chart Row 2: Region Ranking and TOP 10 Schools */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        
                        {/* Region Ranking Panel */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:col-span-5 flex flex-col justify-between">
                            <div>
                                <h3 className="text-slate-900 text-lg font-bold tracking-tight">
                                    🗺️ Regiones más Multadas
                                </h3>
                                <p className="text-slate-400 text-xs mt-1">Clasificación de regiones ordenadas por volumen monetario de multas aplicadas</p>
                            </div>

                            <div className="mt-6 flex-1 overflow-hidden">
                                {stats.regionStats.length > 0 ? (
                                    <div className="space-y-4">
                                        {stats.regionStats.map((reg, idx) => {
                                            const maxMonto = stats.regionStats[0]?.monto || 1;
                                            const percentage = (reg.monto / maxMonto) * 100;

                                            return (
                                                <div key={reg.region} className="space-y-1.5">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <div className="flex items-center gap-2 font-bold text-slate-700">
                                                            <span className="text-[10px] bg-slate-100 text-slate-500 w-5 h-5 rounded-full flex items-center justify-center font-black">
                                                                {idx + 1}
                                                            </span>
                                                            {reg.region}
                                                        </div>
                                                        <div className="font-black text-slate-950">
                                                            {formatCurrency(reg.monto)}
                                                            <span className="text-[9px] text-slate-400 font-medium ml-1.5">({reg.nc} NC)</span>
                                                        </div>
                                                    </div>
                                                    <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden border border-slate-100">
                                                        <div 
                                                            className="bg-gradient-to-r from-cyan-500 to-sky-500 h-full rounded-full transition-all duration-1000"
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-400 italic text-sm py-12">
                                        Sin datos de regiones.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Top 10 Schools Panel */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:col-span-7 flex flex-col justify-between">
                            <div>
                                <h3 className="text-slate-900 text-lg font-bold tracking-tight">
                                    🏆 Top 10 RBDs más Multados
                                </h3>
                                <p className="text-slate-400 text-xs mt-1">Colegios que registran los montos de multas consolidados más altos</p>
                            </div>

                            <div className="mt-6 flex-1 overflow-x-auto">
                                {stats.topSchools.length > 0 ? (
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-widest text-[9px] font-black">
                                                <th className="py-2.5 pr-2 pl-1">RBD</th>
                                                <th className="py-2.5">Establecimiento</th>
                                                <th className="py-2.5 text-center">Folios</th>
                                                <th className="py-2.5 text-center">NC</th>
                                                <th className="py-2.5 text-right pr-1">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {stats.topSchools.map((school) => (
                                                <tr key={school.rbd} className="hover:bg-slate-50/50 transition-all font-medium text-slate-700">
                                                    <td className="py-3 font-bold text-slate-900 pr-2 pl-1">{school.rbd}</td>
                                                    <td className="py-3 max-w-[200px] truncate font-bold text-slate-800" title={school.nombreEstablecimiento}>
                                                        {school.nombreEstablecimiento}
                                                    </td>
                                                    <td className="py-3 text-center font-bold">{school.folios}</td>
                                                    <td className="py-3 text-center">
                                                        <span className="bg-indigo-50 border border-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-[10px] font-black">
                                                            {school.nc}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-right font-black text-slate-900 pr-1">
                                                        {formatCurrency(school.monto)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-400 italic text-sm py-12">
                                        Sin datos de colegios.
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                </div>
            ) : (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                    <p className="text-slate-400 font-medium">No se encontraron datos para graficar con los filtros actuales.</p>
                </div>
            )}
        </div>
    )
}
