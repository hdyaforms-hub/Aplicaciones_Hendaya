'use client'

import { useState, useMemo } from 'react'
import {
    Calendar,
    Search,
    ChevronDown,
    ChevronUp,
    Layers,
    CheckCircle2,
    Clock,
    Filter
} from 'lucide-react'

type UTDetail = {
    code: number
    hasJunaeb: boolean
    hasJunji: boolean
    hasIntegra: boolean
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
    // Año seleccionado por defecto (el más reciente)
    const [selectedYear, setSelectedYear] = useState<number>(() => {
        return sortedYears.length > 0 ? sortedYears[0] : new Date().getFullYear()
    })

    const [searchTerm, setSearchTerm] = useState('')
    // Estado para controlar qué meses tienen sus UTs expandidas (por defecto colapsadas para ser compacto)
    const [expandedMonths, setExpandedMonths] = useState<Record<number, boolean>>({})

    const toggleMonthExpanded = (mes: number) => {
        setExpandedMonths(prev => ({
            ...prev,
            [mes]: !prev[mes]
        }))
    }

    const toggleAllMonths = (expand: boolean) => {
        if (!expand) {
            setExpandedMonths({})
            return
        }
        const currentPeriods = groupedPmpaByYear[selectedYear] || []
        const newExpanded: Record<number, boolean> = {}
        currentPeriods.forEach(p => {
            newExpanded[p.mes] = true
        })
        setExpandedMonths(newExpanded)
    }

    // Filtrar períodos del año seleccionado según el término de búsqueda
    const filteredPeriods = useMemo(() => {
        const periods = groupedPmpaByYear[selectedYear] || []
        if (!searchTerm.trim()) return periods

        const term = searchTerm.toLowerCase().trim()
        return periods.filter(p => {
            const monthName = monthNames[p.mes - 1]?.toLowerCase() || ''
            const hasUtMatch = p.uts.some(ut => ut.code.toString().includes(term))
            const matchesJunaeb = 'junaeb'.includes(term) && p.uts.some(ut => ut.hasJunaeb)
            const matchesJunji = 'junji'.includes(term) && p.uts.some(ut => ut.hasJunji)
            const matchesIntegra = 'integra'.includes(term) && p.uts.some(ut => ut.hasIntegra)
            return monthName.includes(term) || hasUtMatch || matchesJunaeb || matchesJunji || matchesIntegra
        })
    }, [groupedPmpaByYear, selectedYear, searchTerm, monthNames])

    if (sortedYears.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <span className="text-4xl mb-2 opacity-30">📭</span>
                <p className="text-gray-400 font-bold uppercase tracking-wider text-xs">
                    No hay registros PMPA cargados actualmente
                </p>
            </div>
        )
    }

    const totalUtsYear = (groupedPmpaByYear[selectedYear] || []).reduce((acc, p) => acc + p.uts.length, 0)
    const allExpanded = filteredPeriods.length > 0 && filteredPeriods.every(p => !!expandedMonths[p.mes])

    return (
        <div className="space-y-4">
            {/* Cabecera compacta: Selector de Año en Tabs + Búsqueda + Leyenda */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                {/* Selector de Años en Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1 hidden sm:inline">
                        Año:
                    </span>
                    {sortedYears.map(year => {
                        const count = (groupedPmpaByYear[year] || []).length
                        const isSelected = year === selectedYear
                        return (
                            <button
                                key={year}
                                type="button"
                                onClick={() => {
                                    setSelectedYear(year)
                                    setExpandedMonths({})
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                    isSelected
                                        ? 'bg-cyan-600 text-white shadow-xs'
                                        : 'bg-gray-100/80 hover:bg-gray-200/70 text-gray-600'
                                }`}
                            >
                                <span>{year}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                    isSelected ? 'bg-cyan-700 text-white' : 'bg-gray-200 text-gray-500'
                                }`}>
                                    {count}m
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* Filtro de búsqueda rápido y controles */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 sm:w-48">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar UT o mes..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-2.5 py-1 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => toggleAllMonths(!allExpanded)}
                        className="px-2.5 py-1 text-xs font-semibold text-gray-500 hover:text-cyan-700 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors whitespace-nowrap"
                        title={allExpanded ? 'Colapsar todas las UTs' : 'Expandir todas las UTs'}
                    >
                        {allExpanded ? 'Colapsar' : 'Expandir'}
                    </button>
                </div>
            </div>

            {/* Barra informativa delgada: Resumen del año y Leyenda */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-100 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                    <Layers className="w-3.5 h-3.5 text-cyan-600" />
                    <span className="font-medium">
                        Período <strong className="text-gray-900 font-bold">{selectedYear}</strong>: {filteredPeriods.length} meses cargados ({totalUtsYear} registros de UT)
                    </span>
                </div>
                {/* Leyenda de Instituciones */}
                <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>JUNAEB</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>JUNJI</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-sky-500" />
                        <span>INTEGRA</span>
                    </span>
                </div>
            </div>

            {/* Cuadrícula compacta de Meses (2 columnas en móvil/tablet, 3 en escritorio) */}
            {filteredPeriods.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                    No se encontraron períodos para el filtro ingresado.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {filteredPeriods.map(item => {
                        const isExpanded = !!expandedMonths[item.mes] || !!searchTerm.trim()
                        const monthName = monthNames[item.mes - 1] || `Mes ${item.mes}`
                        const utsToShow = isExpanded ? item.uts : item.uts.slice(0, 4)
                        const hasMore = item.uts.length > 4

                        return (
                            <div
                                key={item.mes}
                                className={`p-3 rounded-2xl border transition-all duration-200 bg-white ${
                                    isExpanded
                                        ? 'border-cyan-300 shadow-xs ring-1 ring-cyan-500/10'
                                        : 'border-gray-200/80 hover:border-gray-300 hover:shadow-2xs'
                                }`}
                            >
                                {/* Fila Superior del Mes: Nombre + Conteo + Botón Expandir */}
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-lg bg-cyan-50 text-cyan-700 font-bold text-[11px] flex items-center justify-center border border-cyan-100/80">
                                            {item.mes}
                                        </span>
                                        <span className="font-bold text-gray-800 text-xs truncate max-w-[110px]" title={monthName}>
                                            {monthName}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80">
                                            {item.uts.length} UTs
                                        </span>
                                        {hasMore && !searchTerm.trim() && (
                                            <button
                                                type="button"
                                                onClick={() => toggleMonthExpanded(item.mes)}
                                                className="p-1 text-gray-400 hover:text-cyan-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                                title={isExpanded ? 'Ver menos' : 'Ver todas'}
                                            >
                                                {isExpanded ? (
                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                ) : (
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Pastillas de UTs (Compactas) */}
                                <div className="flex flex-wrap items-center gap-1">
                                    {utsToShow.map(ut => (
                                        <span
                                            key={ut.code}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200/80 font-mono font-bold text-[11px]"
                                            title={`UT ${ut.code}${ut.hasJunaeb ? ' • JUNAEB' : ''}${ut.hasJunji ? ' • JUNJI' : ''}${ut.hasIntegra ? ' • INTEGRA' : ''}`}
                                        >
                                            <span>{ut.code}</span>
                                            {/* Dots de Instituciones */}
                                            <span className="inline-flex items-center gap-0.5">
                                                {ut.hasJunaeb && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                                                {ut.hasJunji && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                                                {ut.hasIntegra && <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />}
                                            </span>
                                        </span>
                                    ))}

                                    {!isExpanded && hasMore && !searchTerm.trim() && (
                                        <button
                                            type="button"
                                            onClick={() => toggleMonthExpanded(item.mes)}
                                            className="text-[10px] font-semibold text-cyan-600 hover:text-cyan-800 px-1 py-0.5 hover:underline cursor-pointer"
                                        >
                                            +{item.uts.length - 4} más
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
