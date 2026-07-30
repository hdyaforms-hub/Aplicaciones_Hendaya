'use client'

import { useState } from 'react'

type UTDetail = {
    code: number
    hasJunaeb: boolean
    hasJunji: boolean
}

type PMPAItem = {
    ano: number
    mes: number
    uts: UTDetail[]
}

interface PMPASummaryAccordionProps {
    groupedPmpaByYear: Record<number, PMPAItem[]>
    sortedYears: number[]
    monthNames: string[]
}

export default function PMPASummaryAccordion({
    groupedPmpaByYear,
    sortedYears,
    monthNames,
}: PMPASummaryAccordionProps) {
    // Accordion state: first (most recent) year expanded by default
    const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>(() => {
        const initial: Record<number, boolean> = {}
        if (sortedYears.length > 0) {
            initial[sortedYears[0]] = true // expand most recent year
        }
        return initial
    })

    const [searchTerm, setSearchTerm] = useState('')

    const toggleYear = (year: number) => {
        setExpandedYears(prev => ({
            ...prev,
            [year]: !prev[year]
        }))
    }

    const expandAll = () => {
        const all: Record<number, boolean> = {}
        sortedYears.forEach(y => all[y] = true)
        setExpandedYears(all)
    }

    const collapseAll = () => {
        setExpandedYears({})
    }

    if (sortedYears.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="text-6xl mb-4 opacity-20">📭</span>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">
                    No hay registros PMPA cargados actualmente
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Filter and Controls Header */}
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Períodos:</span>
                        <button
                            type="button"
                            onClick={expandAll}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
                        >
                            Expandir Todos
                        </button>
                        <button
                            type="button"
                            onClick={collapseAll}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
                        >
                            Colapsar Todos
                        </button>
                    </div>

                    {/* Leyenda Instituciones */}
                    <div className="flex items-center gap-2.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 shadow-2xs">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Cargado:</span>
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-700" title="Punto verde: JUNAEB cargado">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>JUNAEB</span>
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-700" title="Punto amarillo: JUNJI cargado">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>JUNJI</span>
                        </span>
                    </div>
                </div>

                {/* Quick Search Filter */}
                <div className="relative w-full md:w-64">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    <input
                        type="text"
                        placeholder="Buscar por UT, Mes o Institución..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                    />
                </div>
            </div>

            {/* Accordion Tables grouped by Year */}
            {sortedYears.map(year => {
                const rawPeriods = groupedPmpaByYear[year] || []
                
                const periods = rawPeriods.filter(p => {
                    if (!searchTerm.trim()) return true
                    const term = searchTerm.toLowerCase().trim()
                    const monthName = monthNames[p.mes - 1]?.toLowerCase() || ''
                    const hasUtMatch = p.uts.some(ut => ut.code.toString().includes(term))
                    const matchesJunaeb = 'junaeb'.includes(term) && p.uts.some(ut => ut.hasJunaeb)
                    const matchesJunji = 'junji'.includes(term) && p.uts.some(ut => ut.hasJunji)
                    return monthName.includes(term) || hasUtMatch || p.ano.toString().includes(term) || matchesJunaeb || matchesJunji
                })

                if (periods.length === 0 && searchTerm.trim()) return null

                // Auto-expand when searching
                const isExpanded = searchTerm.trim() ? true : !!expandedYears[year]
                const totalUtsCount = periods.reduce((acc, p) => acc + p.uts.length, 0)

                return (
                    <div key={year} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition-all duration-200">
                        {/* Accordion Header Banner */}
                        <button
                            type="button"
                            onClick={() => toggleYear(year)}
                            className="w-full bg-slate-900 hover:bg-slate-800 px-6 py-4 flex items-center justify-between transition-colors text-left group cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-cyan-500/20 border border-cyan-500/30 rounded-xl flex items-center justify-center text-cyan-300 text-lg shadow-sm">
                                    📦
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                                        Período {year}
                                    </h4>
                                    <p className="text-xs text-slate-400 font-medium">
                                        {periods.length} {periods.length === 1 ? 'mes registrado' : 'meses registrados'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <span className="hidden sm:inline-flex px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full text-xs font-black uppercase tracking-wider">
                                    {totalUtsCount} Total Registros UT
                                </span>
                                <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center text-white text-xs font-bold transition-all">
                                    {isExpanded ? '▲' : '▼'}
                                </div>
                            </div>
                        </button>

                        {/* Accordion Content (Table) */}
                        {isExpanded && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200 border-t border-slate-200">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                                <th className="py-3 px-6 w-36">Mes</th>
                                                <th className="py-3 px-6 w-28 text-center">N° de UTs</th>
                                                <th className="py-3 px-6">Unidades Territoriales (UTs) Cargadas</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-sm">
                                            {periods.map((item) => (
                                                <tr key={item.mes} className="hover:bg-slate-50/70 transition-colors">
                                                    {/* Mes */}
                                                    <td className="py-2.5 px-6 font-bold text-slate-800">
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="w-7 h-7 rounded-lg bg-cyan-50 text-cyan-700 font-bold text-xs flex items-center justify-center border border-cyan-100">
                                                                {item.mes}
                                                            </span>
                                                            <span>{monthNames[item.mes - 1]}</span>
                                                        </div>
                                                    </td>

                                                    {/* Cantidad UTs */}
                                                    <td className="py-2.5 px-6 text-center">
                                                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                                                            {item.uts.length} {item.uts.length === 1 ? 'UT' : 'UTs'}
                                                        </span>
                                                    </td>

                                                    {/* List of UT Badges */}
                                                    <td className="py-2.5 px-6">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            {item.uts.map((ut) => (
                                                                <span
                                                                    key={ut.code}
                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200/80 font-mono font-bold text-xs hover:bg-cyan-50/60 hover:border-cyan-200 transition-colors cursor-default"
                                                                >
                                                                    <span className="text-[9px] text-slate-400 font-sans font-semibold">UT</span>
                                                                    <span className="text-slate-800">{ut.code}</span>

                                                                    {/* Micro indicadores de institución */}
                                                                    {(ut.hasJunaeb || ut.hasJunji) && (
                                                                        <span className="inline-flex items-center gap-0.5 ml-0.5">
                                                                            {ut.hasJunaeb && (
                                                                                <span
                                                                                    className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                                                                                    title="JUNAEB cargado"
                                                                                />
                                                                            )}
                                                                            {ut.hasJunji && (
                                                                                <span
                                                                                    className="w-1.5 h-1.5 rounded-full bg-amber-400"
                                                                                    title="JUNJI cargado"
                                                                                />
                                                                            )}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
