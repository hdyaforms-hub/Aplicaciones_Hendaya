'use client'

import React, { useState, useEffect } from 'react'
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

interface NCItem {
    folio: string
    letraAspecto: string
    descripcion: string
    montoMulta: number
    fechaSupervision: string
}

interface SchoolStat {
    rbd: number
    nombreEstablecimiento: string
    monto: number
    folios: number
    nc: number
    ncList?: NCItem[]
}

interface AspectStat {
    aspecto: string
    monto: number
    count: number
    descripcion?: string
}

interface SupervisorStat {
    supervisor: string
    monto: number
    folios: number
    rbdCount: number
    nc: number
    sucursal?: string
}

interface SopJopSubItem {
    nombre: string
    actas: number
}

interface SopJopStat {
    nombre: string
    actas: number
    subItems: SopJopSubItem[]
}

interface MensualStat {
    month: number
    monthName: string
    solucionable: number
    noSolucionable: number
    total: number
}

interface StatsData {
    totals: Totals
    anualStats: AnualStat[]
    mensualStats?: MensualStat[]
    regionStats: RegionStat[]
    topSchools: SchoolStat[]
    aspectStats: AspectStat[]
    supervisorStats?: SupervisorStat[]
    sopJopStats?: SopJopStat[]
    availableSupervisores?: string[]
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
    availableAnos,
    availableSucursales,
    availableSupervisores = []
}: {
    availableLicitaciones: string[]
    availableAnos: number[]
    availableSucursales: string[]
    availableSupervisores?: string[]
}) {
    const [stats, setStats] = useState<StatsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedRbdNC, setSelectedRbdNC] = useState<SchoolStat | null>(null)

    // Filters state
    const [licitacion, setLicitacion] = useState('')
    const [ano, setAno] = useState('')
    const [mes, setMes] = useState('')
    const [sucursal, setSucursal] = useState('')
    const [supervisor, setSupervisor] = useState('')

    // SOP y JOP table state
    const [sortSopJopAsc, setSortSopJopAsc] = useState(false)
    const [expandedSopJops, setExpandedSopJops] = useState<Record<string, boolean>>({})

    const toggleExpandSopJop = (nombre: string) => {
        setExpandedSopJops(prev => ({ ...prev, [nombre]: !prev[nombre] }))
    }

    // PDF Export state
    const [isExportingPdf, setIsExportingPdf] = useState(false)

    const handleExportPDF = async () => {
        if (!stats) return
        setIsExportingPdf(true)
        try {
            const { generateMultasEEPDF } = await import('./generateMultasEEPDF')
            await generateMultasEEPDF({
                stats,
                filters: { licitacion, ano, mes, sucursal, supervisor }
            })
        } catch (err) {
            console.error('Error al generar informe PDF:', err)
            alert('Ocurrió un error al generar el informe PDF para Gerencia.')
        } finally {
            setIsExportingPdf(false)
        }
    }

    const fetchStats = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (licitacion) params.append('licitacion', licitacion)
            if (ano) params.append('ano', ano)
            if (mes) params.append('mes', mes)
            if (sucursal) params.append('sucursal', sucursal)
            if (supervisor) params.append('supervisor', supervisor)

            const res = await fetch(`/api/tablero/multas-ee?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setStats(data)
                if (supervisor && data.availableSupervisores && !data.availableSupervisores.includes(supervisor)) {
                    setSupervisor('')
                }
            }
        } catch (error) {
            console.error("Error fetching multas-ee statistics:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStats()
    }, [licitacion, ano, mes, sucursal, supervisor])

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

    const CustomAspectTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload as AspectStat
            return (
                <div className="bg-slate-900/95 border border-slate-700/80 p-4 rounded-2xl shadow-xl max-w-md text-white backdrop-blur-md">
                    <p className="font-bold text-cyan-400 text-xs mb-1 tracking-tight">
                        {data.aspecto}
                    </p>
                    <p className="text-xs text-slate-200 mb-2 leading-relaxed font-normal">
                        {data.descripcion && data.descripcion !== data.aspecto ? data.descripcion : 'Sin descripción registrada'}
                    </p>
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-400">Monto Multado:</span>
                        <span className="text-cyan-300 font-black">{formatCurrency(data.monto)}</span>
                    </div>
                </div>
            )
        }
        return null
    }

    const CustomSupervisorTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload as SupervisorStat
            return (
                <div className="bg-slate-900/95 border border-slate-700/80 p-4 rounded-2xl shadow-xl max-w-xs text-white backdrop-blur-md">
                    <p className="font-black text-indigo-400 text-sm tracking-tight mb-1">{data.supervisor}</p>

                    <div className="space-y-1.5 my-3 text-xs text-slate-300">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-400 font-medium">Colegios (RBDs) afectados:</span>
                            <span className="font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                {data.rbdCount} {data.rbdCount === 1 ? 'RBD' : 'RBDs'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-400 font-medium">Folios con hallazgos:</span>
                            <span className="font-bold text-slate-200">{data.folios}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-400 font-medium">No Conformidades (NC):</span>
                            <span className="font-bold text-indigo-300">{data.nc}</span>
                        </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-400">Monto Total Multas:</span>
                        <span className="text-cyan-300 font-black">{formatCurrency(data.monto)}</span>
                    </div>
                </div>
            )
        }
        return null
    }

    const clearFilters = () => {
        setLicitacion('')
        setAno('')
        setMes('')
        setSucursal('')
        setSupervisor('')
    }

    const supervisorOptions = stats?.availableSupervisores?.length ? stats.availableSupervisores : availableSupervisores

    return (
        <div className="space-y-8">
            {/* Filter Panel */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex-1 min-w-[180px]">
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

                <div className="w-40">
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

                <div className="w-40">
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

                <div className="w-44">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Sucursal</label>
                    <select
                        value={sucursal}
                        onChange={(e) => {
                            setSucursal(e.target.value)
                            setSupervisor('')
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-bold text-slate-700 text-sm"
                    >
                        <option value="">Todas las sucursales</option>
                        {availableSucursales.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <div className="w-60">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Supervisor</label>
                    <select
                        value={supervisor}
                        onChange={(e) => setSupervisor(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-bold text-slate-700 text-sm"
                    >
                        <option value="">Todos los supervisores</option>
                        {supervisorOptions.map(sup => <option key={sup} value={sup}>{sup}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    <button
                        onClick={clearFilters}
                        className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer h-[42px]"
                    >
                        Limpiar Filtros
                    </button>

                    <button
                        onClick={handleExportPDF}
                        disabled={isExportingPdf || !stats}
                        className="px-5 py-2.5 text-xs font-black text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-red-500/20 transition-all cursor-pointer flex items-center gap-2 h-[42px] hover:scale-105 active:scale-95"
                        title="Generar informe profesional en PDF"
                    >
                        {isExportingPdf ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Generando PDF...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <span>Exportar a PDF</span>
                            </>
                        )}
                    </button>
                </div>
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
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:col-span-6 flex flex-col justify-between">
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

                        {/* Chart: Montos por Mes (Solucionable vs No Solucionable) */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:col-span-6 flex flex-col justify-between">
                            <div>
                                <h3 className="text-slate-900 text-lg font-bold tracking-tight">
                                    📊 Montos de Multas por Mes
                                </h3>
                                <p className="text-slate-400 text-xs mt-1">Evolución de multas mensuales catalogadas como solucionable y no solucionable</p>
                            </div>

                            <div className="h-[350px] w-full mt-6">
                                {stats.mensualStats && stats.mensualStats.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.mensualStats} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis dataKey="monthName" fontSize={10} stroke="#94a3b8" fontWeight="bold" />
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
                                            <Bar dataKey="noSolucionable" name="No Solucionable" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={20} stackId="b" />
                                            <Bar dataKey="solucionable" name="Solucionable" fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} stackId="b" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-400 italic text-sm">
                                        No hay información mensual disponible para graficar.
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Chart Row 2: Aspectos and Region Ranking */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        
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
                                                stroke="#64748b" 
                                                width={90}
                                                fontWeight="bold"
                                                tickFormatter={(val) => val}
                                            />
                                            <Tooltip content={<CustomAspectTooltip />} />
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

                        {/* Region Ranking Panel */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:col-span-7 flex flex-col justify-between">
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

                    </div>

                    {/* Chart Row 3: TOP 10 Schools Panel */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:col-span-12 flex flex-col justify-between">
                            <div>
                                <h3 className="text-slate-900 text-lg font-bold tracking-tight">
                                    🏆 Top 10 RBDs más Multados
                                </h3>
                                <p className="text-slate-400 text-xs mt-1">Colegios que registran los montos de multas consolidados más altos (con Sucursal asociada)</p>
                            </div>

                            <div className="mt-6 flex-1 overflow-x-auto">
                                {stats.topSchools.length > 0 ? (
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-widest text-[9px] font-black">
                                                <th className="py-2.5 pr-2 pl-1">RBD</th>
                                                <th className="py-2.5">Establecimiento (Sucursal)</th>
                                                <th className="py-2.5 text-center">Folios</th>
                                                <th className="py-2.5 text-center">NC</th>
                                                <th className="py-2.5 text-right pr-1">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {stats.topSchools.map((school) => (
                                                <tr key={school.rbd} className="hover:bg-slate-50/50 transition-all font-medium text-slate-700">
                                                    <td className="py-3 font-bold text-slate-900 pr-2 pl-1">{school.rbd}</td>
                                                    <td className="py-3 font-bold text-slate-800" title={school.nombreEstablecimiento}>
                                                        {school.nombreEstablecimiento}
                                                    </td>
                                                    <td className="py-3 text-center font-bold">{school.folios}</td>
                                                    <td className="py-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedRbdNC(school)}
                                                            className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-2.5 py-1 rounded-full text-[10px] font-black transition-all cursor-pointer hover:scale-105 shadow-2xs inline-flex items-center gap-1 group/ncbtn"
                                                            title="Haz clic para ver el detalle de No Conformidades"
                                                        >
                                                            <span>{school.nc}</span>
                                                            <span className="text-[9px] opacity-60 group-hover/ncbtn:opacity-100">🔍</span>
                                                        </button>
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

                    {/* Chart Row 3: SOP y JOP Resumen & Supervisores con más Multas */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        
                        {/* SOP y JOP Summary Table */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:col-span-5 flex flex-col justify-between">
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <h3 className="text-slate-900 text-lg font-bold tracking-tight flex items-center gap-2">
                                            <span>📋</span> SOP y JOP
                                        </h3>
                                        <p className="text-slate-400 text-xs mt-1">
                                            Resumen de actas asignadas a Jefes de Operación y sus Supervisores
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-cyan-600 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-full">
                                        Actas Totales
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 flex-1 overflow-x-auto">
                                {stats.sopJopStats && stats.sopJopStats.length > 0 ? (
                                    (() => {
                                        const sortedData = [...stats.sopJopStats].sort((a, b) => 
                                            sortSopJopAsc ? a.actas - b.actas : b.actas - a.actas
                                        )
                                        const totalActasSum = stats.sopJopStats.reduce((sum, item) => sum + item.actas, 0)

                                        return (
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="border-b border-slate-200 text-cyan-600 font-bold uppercase tracking-wider text-[10px]">
                                                        <th className="py-2.5 px-3">SOP y JOP</th>
                                                        <th className="py-2.5 px-3 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSortSopJopAsc(!sortSopJopAsc)}
                                                                className="inline-flex items-center gap-1 hover:text-cyan-800 transition-colors font-black cursor-pointer"
                                                                title="Haz clic para ordenar por actas"
                                                            >
                                                                Actas {sortSopJopAsc ? '▲' : '▼'}
                                                            </button>
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {sortedData.map((item) => {
                                                        const isExpanded = expandedSopJops[item.nombre]
                                                        const hasChildren = item.subItems && item.subItems.length > 0

                                                        return (
                                                            <React.Fragment key={item.nombre}>
                                                                <tr className="hover:bg-slate-50/80 transition-colors font-medium text-slate-800">
                                                                    <td className="py-2.5 px-3">
                                                                        <div className="flex items-center gap-2">
                                                                            {hasChildren ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => toggleExpandSopJop(item.nombre)}
                                                                                    className="w-5 h-5 flex items-center justify-center rounded border border-slate-300 text-slate-600 hover:border-cyan-500 hover:text-cyan-600 text-[11px] font-mono bg-white shadow-2xs transition-all cursor-pointer"
                                                                                >
                                                                                    {isExpanded ? '-' : '+'}
                                                                                </button>
                                                                            ) : (
                                                                                <span className="w-5" />
                                                                            )}
                                                                            <span className="font-bold text-slate-800 uppercase tracking-tight">{item.nombre}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right font-black text-cyan-700 text-sm">
                                                                        {item.actas}
                                                                    </td>
                                                                </tr>
                                                                {isExpanded && item.subItems.map((sub) => (
                                                                    <tr key={sub.nombre} className="bg-slate-50/60 text-slate-600 text-[11px]">
                                                                        <td className="py-2 px-3 pl-10 border-l-2 border-cyan-400">
                                                                            <span className="font-medium text-slate-700">{sub.nombre}</span>
                                                                        </td>
                                                                        <td className="py-2 px-3 text-right font-bold text-slate-600">
                                                                            {sub.actas}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </React.Fragment>
                                                        )
                                                    })}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="border-t-2 border-slate-300 font-black text-slate-900 bg-slate-50/80">
                                                        <td className="py-3 px-3 uppercase tracking-wider font-extrabold">Total</td>
                                                        <td className="py-3 px-3 text-right text-cyan-800 text-sm font-black">
                                                            {totalActasSum}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        )
                                    })()
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-400 italic text-sm py-12">
                                        Sin datos de actas para SOP y JOP.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Supervisores más Multados Panel */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:col-span-7 flex flex-col justify-between">
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <h3 className="text-slate-900 text-lg font-bold tracking-tight flex items-center gap-2">
                                            <span>👨‍💼</span> Supervisores más Multados
                                        </h3>
                                        <p className="text-slate-400 text-xs mt-1">Ranking de los supervisores con mayor impacto financiero por multas en los colegios bajo su supervisión</p>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
                                        Top Supervisores
                                    </span>
                                </div>
                            </div>

                            <div className="h-[380px] w-full mt-6">
                                {stats.supervisorStats && stats.supervisorStats.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart 
                                            data={stats.supervisorStats} 
                                            layout="vertical"
                                            margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                            <XAxis 
                                                type="number" 
                                                fontSize={10} 
                                                stroke="#94a3b8" 
                                                tickFormatter={(val) => formatShortNumber(val)}
                                            />
                                            <YAxis 
                                                dataKey="supervisor" 
                                                type="category" 
                                                fontSize={11} 
                                                stroke="#475569" 
                                                width={180}
                                                fontWeight="bold"
                                            />
                                            <Tooltip content={<CustomSupervisorTooltip />} />
                                            <Bar dataKey="monto" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={18}>
                                                {stats.supervisorStats.map((entry, index) => (
                                                    <Cell 
                                                        key={`cell-sup-${index}`} 
                                                        fill={index === 0 ? '#4338ca' : index === 1 ? '#4f46e5' : '#6366f1'} 
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-400 italic text-sm">
                                        No se registran datos de supervisores para el filtro seleccionado.
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                </div>
            ) : null}

            {/* Modal Detail of NCs for selected RBD */}
            {selectedRbdNC && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="bg-slate-900 text-white p-6 relative">
                            <button
                                onClick={() => setSelectedRbdNC(null)}
                                className="absolute top-5 right-5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all"
                            >
                                ✕
                            </button>
                            <div className="flex items-center gap-2 text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-1">
                                <span>🏫 RBD {selectedRbdNC.rbd}</span>
                            </div>
                            <h3 className="text-xl font-black text-white tracking-tight pr-8">
                                {selectedRbdNC.nombreEstablecimiento}
                            </h3>
                            <p className="text-slate-400 text-xs mt-1">
                                Listado de {selectedRbdNC.nc} No Conformidad(es) detectada(s)
                            </p>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3.5 divide-y divide-slate-100">
                            {selectedRbdNC.ncList && selectedRbdNC.ncList.length > 0 ? (
                                selectedRbdNC.ncList.map((nc, idx) => (
                                    <div key={idx} className="pt-3.5 first:pt-0 flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-cyan-50 text-cyan-700 border border-cyan-200">
                                                <span>🧩</span> Aspecto {nc.letraAspecto}
                                            </span>
                                            <span className="text-xs font-black text-slate-900">
                                                {formatCurrency(nc.montoMulta)}
                                            </span>
                                        </div>

                                        {nc.descripcion && (
                                            <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100/80">
                                                {nc.descripcion}
                                            </p>
                                        )}

                                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold px-1">
                                            {nc.folio && <span>Folio: #{nc.folio}</span>}
                                            {nc.fechaSupervision && <span>Fecha: {nc.fechaSupervision}</span>}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-slate-400 italic text-sm py-6">
                                    No se encontraron detalles para estas No Conformidades.
                                </p>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-600">
                                Total Multa RBD: <span className="text-slate-950 font-black">{formatCurrency(selectedRbdNC.monto)}</span>
                            </span>
                            <button
                                onClick={() => setSelectedRbdNC(null)}
                                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-sm"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
