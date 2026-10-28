'use client'

import React, { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import {
    RiesgoMinutaDashboardData,
    RiesgoMinutaFilterParams,
    ColegioRiesgoItem,
    fetchRiesgoMinutaData
} from './actions'

type Props = {
    initialData: RiesgoMinutaDashboardData
    initialFilters?: RiesgoMinutaFilterParams
    currentUser: {
        username: string
        name?: string | null
        roleName?: string | null
    }
}

export default function RiesgoMinutaClient({ initialData, initialFilters, currentUser }: Props) {
    const [data, setData] = useState<RiesgoMinutaDashboardData>(initialData)
    const [filters, setFilters] = useState<RiesgoMinutaFilterParams>(initialFilters || { fecha: initialData.fechaConsultada })
    const [isPending, startTransition] = useTransition()
    const [searchTableQuery, setSearchTableQuery] = useState('')
    const [selectedColegioModal, setSelectedColegioModal] = useState<ColegioRiesgoItem | null>(null)
    const [expandedColegioRbd, setExpandedColegioRbd] = useState<number | null>(null)

    // Autocompletado inteligente RBD / Colegio
    const [colegioSearchInput, setColegioSearchInput] = useState<string>(() => {
        if (initialFilters?.rbd) {
            const found = initialData.filtrosDisponibles.colegios.find(c => c.rbd === initialFilters.rbd)
            return found ? `${found.rbd} - ${found.nombre}` : String(initialFilters.rbd)
        }
        return ''
    })
    const [isAutocompleteOpen, setIsAutocompleteOpen] = useState<boolean>(false)
    const autocompleteContainerRef = useRef<HTMLDivElement>(null)

    // Sincronizar input cuando filters.rbd cambia
    useEffect(() => {
        if (!filters.rbd) {
            setColegioSearchInput('')
        } else {
            const found = data.filtrosDisponibles.colegios.find(c => c.rbd === filters.rbd)
            if (found) {
                setColegioSearchInput(`${found.rbd} - ${found.nombre}`)
            }
        }
    }, [filters.rbd, data.filtrosDisponibles.colegios])

    // Cierre de dropdown al hacer click fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (autocompleteContainerRef.current && !autocompleteContainerRef.current.contains(event.target as Node)) {
                setIsAutocompleteOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Sugerencias filtradas en tiempo real
    const colegioSuggestions = useMemo(() => {
        const list = data.filtrosDisponibles.colegios || []
        if (!colegioSearchInput.trim()) {
            return list.slice(0, 15)
        }
        const q = colegioSearchInput.toLowerCase().trim()
        return list.filter(c =>
            c.rbd.toString().includes(q) ||
            c.nombre.toLowerCase().includes(q) ||
            (c.comuna && c.comuna.toLowerCase().includes(q)) ||
            (c.sucursal && c.sucursal.toLowerCase().includes(q))
        ).slice(0, 20)
    }, [colegioSearchInput, data.filtrosDisponibles.colegios])

    const handleSelectColegio = (item: { rbd: number; nombre: string }) => {
        setColegioSearchInput(`${item.rbd} - ${item.nombre}`)
        setIsAutocompleteOpen(false)
        handleFilterChange('rbd', item.rbd)
    }

    const handleClearColegio = () => {
        setColegioSearchInput('')
        setIsAutocompleteOpen(false)
        handleFilterChange('rbd', '')
    }

    // Recargar datos al cambiar filtros
    const handleFilterChange = (key: keyof RiesgoMinutaFilterParams, value: any) => {
        const updated = {
            ...filters,
            [key]: value === '' || value === 'ALL'
                ? undefined
                : (key === 'rbd' ? Number(value) : value)
        }
        setFilters(updated)

        startTransition(async () => {
            try {
                const fresh = await fetchRiesgoMinutaData(updated)
                setData(fresh)
            } catch (err) {
                console.error('Error aplicando filtros en Riesgo en Minuta:', err)
            }
        })
    }

    const handleClearFilters = () => {
        const resetFilters = { fecha: data.fechaConsultada }
        setFilters(resetFilters)
        setColegioSearchInput('')
        setIsAutocompleteOpen(false)
        startTransition(async () => {
            try {
                const fresh = await fetchRiesgoMinutaData(resetFilters)
                setData(fresh)
            } catch (err) {
                console.error('Error reseteando filtros:', err)
            }
        })
    }

    // Exportar datos a CSV
    const handleExportCSV = () => {
        if (!data.colegiosDetalle || data.colegiosDetalle.length === 0) return

        const headers = ['RBD', 'Establecimiento', 'Sucursal', 'Institución', 'Nivel Riesgo', 'Score Peligro', 'Total Raciones', 'Platos Alto Riesgo', 'Platos Medio Riesgo', 'Platos Leve', 'Platos Sin Asignar', 'Detalle Platos Críticos']
        const rows = data.colegiosDetalle.map(c => [
            c.rbd,
            `"${c.nombre.replace(/"/g, '""')}"`,
            `"${c.sucursal}"`,
            `"${c.institucion}"`,
            c.nivelRiesgo,
            c.score,
            c.totalRaciones,
            c.countAlto,
            c.countMedio,
            c.countLeve,
            c.countSinAsignar,
            `"${c.platosCriticos.map(p => `[${p.gravedad}] ${p.nombre} (${p.servicio})`).join(' | ').replace(/"/g, '""')}"`
        ])

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n')
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement('a')
        link.setAttribute('href', encodedUri)
        link.setAttribute('download', `Riesgo_en_Minuta_${data.fechaConsultada}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // Filtrar tabla de colegios
    const filteredColegios = useMemo(() => {
        if (!searchTableQuery.trim()) return data.colegiosDetalle
        const q = searchTableQuery.toLowerCase().trim()
        return data.colegiosDetalle.filter(c =>
            String(c.rbd).includes(q) ||
            c.nombre.toLowerCase().includes(q) ||
            c.sucursal.toLowerCase().includes(q) ||
            c.platosCriticos.some(p => p.nombre.toLowerCase().includes(q))
        )
    }, [data.colegiosDetalle, searchTableQuery])

    const getGravedadBadge = (gravedad: string) => {
        switch (gravedad) {
            case 'ALTO':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">🔴 ALTO</span>
            case 'MEDIO':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">🟡 MEDIO</span>
            case 'LEVE':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">🟢 LEVE</span>
            default:
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">⚪ Sin evaluar</span>
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 lg:p-8 space-y-6">
            {/* ENCABEZADO EJECUTIVO HENDAYA */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-3xl shadow-sm shrink-0">
                        🛡️
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                                Riesgo en Minuta
                            </h1>
                            <span className="text-[11px] font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-300">
                                HENDAYA
                            </span>
                            <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                                Prev. de Riesgos
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-slate-500 mt-1">
                            Evaluación preventiva de preparaciones y minutas en base a su nivel de gravedad y asignación por colegio.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
                    {/* Badge de seguridad / perfil */}
                    {data.permisos.isRestrictedByRbd ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                            <span>🔒</span>
                            <span>Restringido a tu perfil ({data.permisos.assignedRbdsCount ?? 0} colegios)</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                            <span>🌐</span>
                            <span>Acceso Global (Todas las Sucursales y Colegios)</span>
                        </div>
                    )}

                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-sm"
                        title="Exportar datos a CSV"
                    >
                        <span>📥</span>
                        <span>Exportar CSV</span>
                    </button>

                    <button
                        onClick={handleClearFilters}
                        disabled={isPending}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                    >
                        <span className={isPending ? 'animate-spin' : ''}>🔄</span>
                        <span>{isPending ? 'Evaluando...' : 'Refrescar'}</span>
                    </button>
                </div>
            </div>

            {/* BARRA DE FILTROS */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1 border-b border-slate-100">
                    <span className="flex items-center gap-2">
                        <span>🔍</span> Filtros de Evaluación Preventiva
                    </span>
                    {(filters.licitacion || filters.sucursal || filters.rbd || (filters.nivelRiesgo && filters.nivelRiesgo !== 'TODOS')) && (
                        <button
                            onClick={handleClearFilters}
                            className="text-xs text-sky-600 hover:text-sky-700 font-semibold underline"
                        >
                            Limpiar filtros
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
                    {/* FECHA */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                Fecha de Evaluación
                            </label>
                            <span className="text-[10px] text-slate-400 font-medium">Día / Mes / Año</span>
                        </div>
                        <input
                            type="date"
                            value={filters.fecha || data.fechaConsultada}
                            onChange={(e) => handleFilterChange('fecha', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                        />
                    </div>

                    {/* LICITACIÓN */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                            Licitación
                        </label>
                        <select
                            value={filters.licitacion ?? ''}
                            onChange={(e) => handleFilterChange('licitacion', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                        >
                            <option value="">(Todas las licitaciones)</option>
                            {data.filtrosDisponibles.licitaciones.map(l => (
                                <option key={l} value={l}>Licitación {l}</option>
                            ))}
                        </select>
                    </div>

                    {/* SUCURSAL */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                            Sucursal / Centro
                        </label>
                        <select
                            value={filters.sucursal ?? ''}
                            onChange={(e) => handleFilterChange('sucursal', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                        >
                            <option value="">(Todas las sucursales)</option>
                            {data.filtrosDisponibles.sucursales.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* ESTABLECIMIENTO CON AUTOCOMPLETADO INTELIGENTE */}
                    <div className="relative" ref={autocompleteContainerRef}>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                Colegio (RBD / Nombre)
                            </label>
                            {filters.rbd && (
                                <span className="text-[9px] font-extrabold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                                    Filtrado
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 text-xs pointer-events-none">
                                🏫
                            </span>
                            <input
                                type="text"
                                placeholder="Escriba RBD o nombre..."
                                value={colegioSearchInput}
                                onChange={(e) => {
                                    setColegioSearchInput(e.target.value)
                                    setIsAutocompleteOpen(true)
                                }}
                                onFocus={() => setIsAutocompleteOpen(true)}
                                className={`w-full bg-slate-50 border rounded-xl pl-8 pr-7 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all ${
                                    filters.rbd
                                        ? 'border-sky-400 bg-sky-50/50 text-sky-950 font-bold'
                                        : 'border-slate-200 text-slate-800'
                                }`}
                            />
                            {filters.rbd ? (
                                <button
                                    type="button"
                                    onClick={handleClearColegio}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-rose-600 text-xs font-bold"
                                    title="Quitar filtro de colegio"
                                >
                                    ✕
                                </button>
                            ) : null}
                        </div>

                        {/* LISTA DE SUGERENCIAS */}
                        {isAutocompleteOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50 divide-y divide-slate-100">
                                <div className="p-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase flex justify-between items-center">
                                    <span>Resultados ({colegioSuggestions.length})</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsAutocompleteOpen(false)}
                                        className="text-slate-400 hover:text-slate-600 text-xs"
                                    >
                                        ✕
                                    </button>
                                </div>
                                {colegioSuggestions.length === 0 ? (
                                    <div className="p-3 text-xs text-slate-400 text-center">
                                        No se encontraron colegios coincidentes
                                    </div>
                                ) : (
                                    colegioSuggestions.map((item) => {
                                        const isSelected = filters.rbd === item.rbd
                                        return (
                                            <div
                                                key={item.rbd}
                                                onClick={() => handleSelectColegio(item)}
                                                className={`p-3 cursor-pointer transition-colors flex items-center justify-between gap-3 group ${
                                                    isSelected ? 'bg-sky-50/90 border-l-4 border-sky-600' : 'hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className={`font-bold truncate text-xs ${
                                                        isSelected ? 'text-sky-900 font-extrabold' : 'text-slate-900 group-hover:text-sky-700'
                                                    }`}>
                                                        {item.nombre}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                                        {item.comuna ? `Comuna: ${item.comuna}` : ''}
                                                        {item.comuna && item.sucursal ? ' | ' : ''}
                                                        {item.sucursal ? `Sucursal: ${item.sucursal}` : ''}
                                                    </p>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 ${
                                                    isSelected
                                                        ? 'bg-sky-600 text-white shadow-sm'
                                                        : 'bg-sky-50 text-sky-700 border border-sky-200 group-hover:bg-sky-100'
                                                }`}>
                                                    RBD {item.rbd}
                                                </span>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ACCESO RÁPIDO A FECHAS RECIENTES CON DATOS Y ALERTAS */}
                {data.filtrosDisponibles.fechasConDatos.length > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap text-xs">
                        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                            <span>📅</span> Fechas sugeridas (⚠️ con alertas de riesgo):
                        </span>
                        {data.filtrosDisponibles.fechasConDatos.slice(0, 8).map(f => {
                            const hasRisk = data.filtrosDisponibles.fechasConRiesgo?.includes(f)
                            const isSelectedDate = (filters.fecha || data.fechaConsultada) === f
                            return (
                                <button
                                    key={f}
                                    onClick={() => handleFilterChange('fecha', f)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                                        isSelectedDate
                                            ? 'bg-sky-600 text-white shadow-sm'
                                            : hasRisk
                                            ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    {hasRisk && <span>⚠️</span>}
                                    <span>{f}</span>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* BANNER INFORMATIVO SI NO HAY DATOS PARA LA FECHA EXACTA */}
            {!data.hasDataForDate && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">⚠️</span>
                        <div>
                            <h3 className="font-bold text-sm">
                                No se encontraron cargas de minutas para el día {filters.fecha || data.fechaConsultada}
                            </h3>
                            <p className="text-xs text-amber-800 mt-0.5">
                                La fecha filtrada no posee minutas asociadas en este mes o licitación. Puedes seleccionar una de las fechas sugeridas con cargas activas arriba.
                            </p>
                        </div>
                    </div>
                    {data.filtrosDisponibles.fechasConDatos.length > 0 && (
                        <button
                            onClick={() => handleFilterChange('fecha', data.filtrosDisponibles.fechasConDatos[0])}
                            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shrink-0"
                        >
                            Ver fecha con datos ({data.filtrosDisponibles.fechasConDatos[0]})
                        </button>
                    )}
                </div>
            )}

            {/* TARJETAS KPI RESUMEN DE RIESGO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1: COLEGIOS EN RIESGO ALTO */}
                <div className="bg-white border border-rose-200/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">
                            Colegios en Riesgo Alto
                        </span>
                        <span className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center text-base font-bold">
                            🔴
                        </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-rose-900 tracking-tight">
                            {data.kpis.colegiosRiesgoAlto.toLocaleString('es-CL')}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">establecimientos</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                        Colegios con al menos una preparación de gravedad ALTO programada.
                    </p>
                </div>

                {/* KPI 2: RACIONES EN RIESGO CRÍTICO */}
                <div className="bg-white border border-amber-200/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                            Raciones en Riesgo Alto
                        </span>
                        <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-base">
                            🍽️
                        </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-amber-900 tracking-tight">
                            {data.kpis.racionesEnRiesgoAlto.toLocaleString('es-CL')}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">raciones</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                        Volumen total de raciones correspondientes a servicios con platos de alto riesgo.
                    </p>
                </div>

                {/* KPI 3: COLEGIOS EVALUADOS */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                            Colegios Evaluados Hoy
                        </span>
                        <span className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center text-base">
                            🏫
                        </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                            {data.kpis.totalColegiosEvaluados.toLocaleString('es-CL')}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">RBDs con servicio</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-2">
                        <span>🟡 Medio: {data.kpis.colegiosRiesgoMedio}</span>
                        <span>•</span>
                        <span>🟢 Leve: {data.kpis.colegiosRiesgoLeve}</span>
                    </div>
                </div>

                {/* KPI 4: PREPARACIONES CRÍTICAS DETECTADAS */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                            Platos Críticos en Menú
                        </span>
                        <span className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center text-base">
                            🍲
                        </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                            {data.kpis.platosCriticosDetectados}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">recetas en alerta</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                        Recetas con nivel de gravedad Alto o Medio calendarizadas para esta fecha.
                    </p>
                </div>
            </div>

            {/* SECCIÓN: TOP 10 DE COLEGIOS CON LAS MINUTAS MÁS PELIGROSAS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🏆</span>
                            <h2 className="text-lg font-extrabold text-slate-900">
                                Top 10 Colegios con las Minutas más Peligrosas
                            </h2>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                Prioridad Prevención
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Establecimientos priorizados según su índice ponderado de preparaciones críticas (Alto × 10, Medio × 4, Leve × 1) para el día {filters.fecha || data.fechaConsultada}.
                        </p>
                    </div>
                </div>

                {data.top10Peligrosos.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                        No se detectaron colegios con minutas peligrosas para los criterios seleccionados.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                        {data.top10Peligrosos.map((col, index) => {
                            const rank = index + 1
                            const isTop3 = rank <= 3
                            return (
                                <div
                                    key={col.rbd}
                                    className={`rounded-2xl border p-4.5 transition-all ${
                                        col.nivelRiesgo === 'ALTO'
                                            ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400'
                                            : col.nivelRiesgo === 'MEDIO'
                                            ? 'bg-amber-50/30 border-amber-200 hover:border-amber-400'
                                            : 'bg-emerald-50/30 border-emerald-200 hover:border-emerald-400'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                                                rank === 1
                                                    ? 'bg-amber-400 text-amber-950 shadow-sm'
                                                    : rank === 2
                                                    ? 'bg-slate-300 text-slate-800'
                                                    : rank === 3
                                                    ? 'bg-amber-600 text-white'
                                                    : 'bg-slate-100 text-slate-700'
                                            }`}>
                                                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                                            </div>
                                            <div>
                                                <h3 className="font-extrabold text-slate-900 text-sm leading-snug line-clamp-1" title={col.nombre}>
                                                    {col.nombre}
                                                </h3>
                                                <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                                    <span className="font-bold text-sky-700">RBD {col.rbd}</span>
                                                    <span>•</span>
                                                    <span>{col.sucursal}</span>
                                                    <span>•</span>
                                                    <span className="font-semibold text-slate-600">{col.institucion}</span>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            {getGravedadBadge(col.nivelRiesgo)}
                                            <div className="text-[10px] text-slate-500 font-bold mt-1">
                                                Score: {col.score} pts
                                            </div>
                                        </div>
                                    </div>

                                    {/* Platos Críticos del colegio */}
                                    <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2">
                                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                                            <span>Platos Críticos en Minuta:</span>
                                            <span className="text-slate-500 font-normal">
                                                {col.totalRaciones.toLocaleString('es-CL')} raciones
                                            </span>
                                        </div>

                                        {col.platosCriticos.length === 0 ? (
                                            <p className="text-[11px] text-slate-400 italic">
                                                Sin preparaciones críticas catalogadas (menú estándar).
                                            </p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {col.platosCriticos.map((p, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center justify-between p-2 rounded-xl bg-white/90 border border-slate-200 text-xs gap-2"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className="text-xs">
                                                                {p.gravedad === 'ALTO' ? '🔴' : '🟡'}
                                                            </span>
                                                            <span className="font-bold text-slate-800 truncate text-[11px]">
                                                                {p.nombre}
                                                            </span>
                                                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                                                                {p.subServicio}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-500 shrink-0">
                                                            {p.servicio}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="pt-1 flex items-center justify-end">
                                            <button
                                                onClick={() => setSelectedColegioModal(col)}
                                                className="text-xs font-bold text-sky-600 hover:text-sky-800 hover:underline flex items-center gap-1"
                                            >
                                                <span>Ver Minuta Completa</span>
                                                <span>→</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* SECCIÓN: LISTADO COMPLETO Y DETALLE POR COLEGIO */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                            <span>📋</span> Todos los Establecimientos Evaluados ({data.colegiosDetalle.length})
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Detalle de minutas, servicios asignados y preparaciones por establecimiento para la fecha seleccionada.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                            <input
                                type="text"
                                placeholder="Buscar por RBD, nombre o plato..."
                                value={searchTableQuery}
                                onChange={(e) => setSearchTableQuery(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="py-3 px-3.5">RBD</th>
                                <th className="py-3 px-3.5">Establecimiento</th>
                                <th className="py-3 px-3.5">Sucursal</th>
                                <th className="py-3 px-3.5">Nivel Riesgo</th>
                                <th className="py-3 px-3.5 text-right">Score</th>
                                <th className="py-3 px-3.5 text-right">Raciones</th>
                                <th className="py-3 px-3.5 text-center text-rose-700">Platos Alto</th>
                                <th className="py-3 px-3.5 text-center text-amber-700">Platos Medio</th>
                                <th className="py-3 px-3.5 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {filteredColegios.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-8 text-center text-slate-400">
                                        No se encontraron colegios con los filtros seleccionados.
                                    </td>
                                </tr>
                            ) : (
                                filteredColegios.slice(0, 30).map((c) => (
                                    <React.Fragment key={c.rbd}>
                                        <tr className="hover:bg-slate-50 transition-colors">
                                            <td className="py-2.5 px-3.5 font-bold text-sky-700">
                                                {c.rbd}
                                            </td>
                                            <td className="py-2.5 px-3.5 font-medium text-slate-900 max-w-xs truncate" title={c.nombre}>
                                                {c.nombre}
                                            </td>
                                            <td className="py-2.5 px-3.5 text-slate-600">
                                                {c.sucursal}
                                            </td>
                                            <td className="py-2.5 px-3.5">
                                                {getGravedadBadge(c.nivelRiesgo)}
                                            </td>
                                            <td className="py-2.5 px-3.5 text-right font-black text-slate-900">
                                                {c.score}
                                            </td>
                                            <td className="py-2.5 px-3.5 text-right font-bold text-slate-700">
                                                {c.totalRaciones.toLocaleString('es-CL')}
                                            </td>
                                            <td className="py-2.5 px-3.5 text-center font-extrabold text-rose-700">
                                                {c.countAlto > 0 ? `${c.countAlto} 🔴` : '-'}
                                            </td>
                                            <td className="py-2.5 px-3.5 text-center font-bold text-amber-700">
                                                {c.countMedio > 0 ? `${c.countMedio} 🟡` : '-'}
                                            </td>
                                            <td className="py-2.5 px-3.5 text-center">
                                                <button
                                                    onClick={() => setSelectedColegioModal(c)}
                                                    className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-[11px] transition-all"
                                                >
                                                    Ver Minuta
                                                </button>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredColegios.length > 30 && (
                    <p className="text-[11px] text-slate-500 text-center font-medium">
                        Mostrando los primeros 30 de {filteredColegios.length} establecimientos. Exporta a CSV para visualizar el universo completo.
                    </p>
                )}
            </div>

            {/* MODAL DETALLE DE MINUTA DEL COLEGIO SELECCIONADO */}
            {selectedColegioModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        {/* Cabecera del modal */}
                        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-black text-slate-900">
                                        {selectedColegioModal.nombre}
                                    </h3>
                                    {getGravedadBadge(selectedColegioModal.nivelRiesgo)}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    RBD: <strong>{selectedColegioModal.rbd}</strong> • Sucursal: <strong>{selectedColegioModal.sucursal}</strong> • Institución: <strong>{selectedColegioModal.institucion}</strong>
                                </p>
                                <p className="text-[11px] text-slate-600 mt-0.5">
                                    Fecha evaluada: <strong>{data.fechaConsultada}</strong> • Raciones totales: <strong>{selectedColegioModal.totalRaciones.toLocaleString('es-CL')}</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedColegioModal(null)}
                                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Contenido: Servicios y platos */}
                        <div className="p-6 overflow-y-auto space-y-5">
                            {selectedColegioModal.servicios.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-8">
                                    No hay servicios asignados para este día.
                                </p>
                            ) : (
                                selectedColegioModal.servicios.map((serv, sIdx) => (
                                    <div key={sIdx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 flex-wrap gap-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-extrabold text-slate-900 text-sm uppercase">
                                                    {serv.servicio}
                                                </span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                                                    Programa {serv.programa} (#{serv.numeroPrograma})
                                                </span>
                                                {serv.area && (
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                                                        Área: {serv.area}
                                                    </span>
                                                )}
                                                {serv.numeroMinuta && (
                                                    <span className="text-[10px] text-slate-500 font-mono">
                                                        Minuta #{serv.numeroMinuta}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-slate-900">
                                                    {serv.cantidad.toLocaleString('es-CL')} rac
                                                </span>
                                                {getGravedadBadge(serv.nivelRiesgoServicio)}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {serv.preparaciones.map((prep, pIdx) => (
                                                <div
                                                    key={pIdx}
                                                    className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs gap-3"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="text-xs">
                                                            {prep.gravedad === 'ALTO' ? '🔴' : prep.gravedad === 'MEDIO' ? '🟡' : prep.gravedad === 'LEVE' ? '🟢' : '⚪'}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-slate-900 truncate text-xs">
                                                                {prep.nombre}
                                                            </p>
                                                            <p className="text-[10px] text-slate-500">
                                                                SubServicio: {prep.subServicio} • N° Prep: {prep.numeroPreparacion}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        {getGravedadBadge(prep.gravedad)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Pie del modal */}
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setSelectedColegioModal(null)}
                                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-sm"
                            >
                                Cerrar Detalle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
