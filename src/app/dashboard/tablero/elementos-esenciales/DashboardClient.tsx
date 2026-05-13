'use client'

import { useState, useEffect, useRef } from 'react'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, Cell
} from 'recharts'
import { useDebounce } from '@/hooks/use-debounce'
import { searchColegios } from '../../areas/operaciones/captura-certificacion/actions'

interface Stats {
    timeSeries: any[]
    regionSeries: Record<string, any[]>
    aspectStats: any[]
}

export default function DashboardClient({ 
    availableLicitaciones, 
    availableRegions,
    availableAnos 
}: { 
    availableLicitaciones: string[], 
    availableRegions: string[],
    availableAnos: number[]
}) {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)

    // Filters
    const [licitacion, setLicitacion] = useState('')
    const [region, setRegion] = useState('')
    const [ano, setAno] = useState('')
    
    // Autocomplete RBD
    const [searchInput, setSearchInput] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [showDropdown, setShowDropdown] = useState(false)
    const [selectedRbd, setSelectedRbd] = useState<number | null>(null)
    const debouncedSearch = useDebounce(searchInput, 400)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const fetchStats = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (licitacion) params.append('licitacion', licitacion)
            if (region) params.append('region', region)
            if (ano) params.append('ano', ano)
            if (selectedRbd) params.append('rbd', selectedRbd.toString())

            const res = await fetch(`/api/tablero/elementos-esenciales?${params.toString()}`)
            const data = await res.json()
            if (res.ok) setStats(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStats()
    }, [licitacion, region, ano, selectedRbd])

    // Autocomplete effect
    useEffect(() => {
        if (debouncedSearch && debouncedSearch.length > 2 && !selectedRbd) {
            searchColegios(debouncedSearch).then(setSearchResults)
            setShowDropdown(true)
        } else {
            setSearchResults([])
            setShowDropdown(false)
        }
    }, [debouncedSearch])

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const handleSelectColegio = (col: any) => {
        setSelectedRbd(col.colRBD)
        setSearchInput(`${col.colRBD} - ${col.nombreEstablecimiento}`)
        setShowDropdown(false)
    }

    const clearRbd = () => {
        setSelectedRbd(null)
        setSearchInput('')
    }

    const colors = ['#0891b2', '#0ea5e9', '#0284c7', '#0369a1', '#1e40af', '#3730a3']

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px] relative" ref={dropdownRef}>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Establecimiento / RBD</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Buscar RBD o Nombre..." 
                            value={searchInput}
                            onChange={(e) => {
                                setSearchInput(e.target.value)
                                if (selectedRbd) setSelectedRbd(null)
                            }}
                            className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-medium"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        {searchInput && (
                            <button 
                                onClick={clearRbd}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    {showDropdown && searchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                            {searchResults.map((col) => (
                                <button
                                    key={col.colRBD}
                                    onClick={() => handleSelectColegio(col)}
                                    className="w-full text-left px-4 py-3 hover:bg-cyan-50 transition-colors border-b border-gray-50 last:border-0"
                                >
                                    <p className="font-bold text-gray-900 text-sm">{col.colRBD}</p>
                                    <p className="text-xs text-gray-500 truncate">{col.nombreEstablecimiento}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="w-40">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Región</label>
                    <select 
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-semibold"
                    >
                        <option value="">Todas</option>
                        {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>

                <div className="w-40">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Licitación</label>
                    <select 
                        value={licitacion}
                        onChange={(e) => setLicitacion(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-semibold"
                    >
                        <option value="">Todas</option>
                        {availableLicitaciones.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>

                <div className="w-32">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Año</label>
                    <select 
                        value={ano}
                        onChange={(e) => setAno(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-semibold"
                    >
                        <option value="">Todos</option>
                        {availableAnos.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>

                <button 
                    onClick={fetchStats}
                    className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-95 h-[42px]"
                >
                    Filtrar
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                    <div className="w-12 h-12 border-4 border-cyan-100 border-t-cyan-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-500 font-medium animate-pulse">Cargando estadísticas...</p>
                </div>
            ) : stats ? (
                <div className="grid grid-cols-1 gap-6">
                    {/* 1) Cumplimiento Consolidado */}
                    <div className="bg-[#1a5a75] p-6 rounded-3xl shadow-xl border border-white/10 overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
                        <h3 className="text-white text-lg font-bold mb-6 flex items-center gap-2">
                            <span className="opacity-70">1)</span> Cumplimiento consolidado
                        </h3>
                        <div className="text-center mb-4">
                            <p className="text-white/60 text-xs font-black uppercase tracking-[0.2em]">% CUMPL</p>
                        </div>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stats.timeSeries}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                    <XAxis 
                                        dataKey="name" 
                                        stroke="rgba(255,255,255,0.5)" 
                                        fontSize={10}
                                        tick={{ fill: 'white' }}
                                        tickLine={{ stroke: 'white' }}
                                    />
                                    <YAxis 
                                        stroke="rgba(255,255,255,0.5)" 
                                        fontSize={10} 
                                        domain={[60, 100]}
                                        tick={{ fill: 'white' }}
                                        tickFormatter={(val) => `${val}%`}
                                    />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: 'white' }}
                                        itemStyle={{ color: '#22d3ee' }}
                                        formatter={(value: any) => [`${value}%`, 'Cumplimiento']}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="cumplimiento" 
                                        stroke="#ffffff" 
                                        strokeWidth={4} 
                                        dot={{ r: 6, fill: '#ffffff', strokeWidth: 0 }}
                                        activeDot={{ r: 8, strokeWidth: 0 }}
                                    />
                                    {/* Trend line simulator */}
                                    <Line 
                                        type="linear" 
                                        dataKey="cumplimiento" 
                                        stroke="rgba(255,255,255,0.2)" 
                                        strokeWidth={10} 
                                        dot={false}
                                        strokeDasharray="5 5"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 2) Cumplimiento por Región */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {Object.entries(stats.regionSeries).map(([reg, data], idx) => (
                            <div key={reg} className="bg-[#1a5a75] p-6 rounded-3xl shadow-xl border border-white/10">
                                <h3 className="text-white text-center text-xl font-black uppercase tracking-widest mb-6">
                                    {reg}
                                </h3>
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={data}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                            <XAxis 
                                                dataKey="name" 
                                                stroke="rgba(255,255,255,0.5)" 
                                                fontSize={10}
                                                tick={{ fill: 'white' }}
                                            />
                                            <YAxis 
                                                stroke="rgba(255,255,255,0.5)" 
                                                fontSize={10} 
                                                domain={[60, 105]}
                                                tick={{ fill: 'white' }}
                                                tickFormatter={(val) => `${val}%`}
                                            />
                                            <Tooltip />
                                            <Line 
                                                type="monotone" 
                                                dataKey="cumplimiento" 
                                                stroke="#ffffff" 
                                                strokeWidth={3} 
                                                dot={{ r: 4, fill: '#ffffff' }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 3) Cumplimiento por Aspecto */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                        <h3 className="text-gray-900 text-lg font-bold mb-2 flex items-center gap-2">
                            <span className="text-cyan-600">3)</span> Cumplimiento por aspecto – promedio anual
                        </h3>
                        <p className="text-gray-400 text-sm mb-8 text-center font-bold">Promedio de % Cumpl por Aspecto</p>
                        
                        <div className="h-[450px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.aspectStats} margin={{ bottom: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="aspecto" 
                                        tick={({ x, y, payload }) => (
                                            <g transform={`translate(${x},${y})`}>
                                                <text x={0} y={0} dy={16} textAnchor="middle" fill="#64748b" fontSize={11} fontWeight="bold">
                                                    {payload.value}
                                                </text>
                                            </g>
                                        )}
                                        interval={0}
                                    />
                                    <YAxis 
                                        domain={[0, 120]} 
                                        tickFormatter={(val) => `${val}%`}
                                        fontSize={11}
                                        stroke="#94a3b8"
                                    />
                                    <Tooltip 
                                        cursor={{ fill: '#f8fafc' }}
                                        formatter={(val: any) => [`${val}%`, 'Cumplimiento']}
                                    />
                                    <Bar dataKey="cumplimiento" radius={[4, 4, 0, 0]} barSize={12}>
                                        {stats.aspectStats.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={
                                                    entry.ano === '2024' ? '#1e40af' :
                                                    entry.ano === '2025' ? '#0891b2' : '#84cc16'
                                                } 
                                            />
                                        ))}
                                    </Bar>
                                    <Legend 
                                        verticalAlign="bottom" 
                                        height={36} 
                                        content={() => (
                                            <div className="flex justify-center gap-8 mt-4 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#1e40af] rounded"></span> 2024</div>
                                                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#0891b2] rounded"></span> 2025</div>
                                                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#84cc16] rounded"></span> 2026</div>
                                            </div>
                                        )}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                    <p className="text-gray-400">No hay datos disponibles para los filtros seleccionados.</p>
                </div>
            )}
        </div>
    )
}
