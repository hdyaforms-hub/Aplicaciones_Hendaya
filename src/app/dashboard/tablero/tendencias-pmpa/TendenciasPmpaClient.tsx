'use client'

import React, { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import GraficoComparativoOscilacion from './GraficoComparativoOscilacion'
import {
    TendenciasDashboardData,
    TendenciasFilterParams,
    fetchTendenciasPmpaData
} from './actions'

const SERVICIOS_COLORES: Record<string, string> = {
    'DESAYUNO': '#D97706',   // Ámbar 600
    'ALMUERZO': '#059669',   // Esmeralda 600
    'ONCE': '#0284C7',       // Sky 600
    'COLACIÓN': '#7C3AED',   // Violeta 600
    'COLACION': '#7C3AED',   // Violeta 600
    'CENA': '#4F46E5',       // Índigo 600
    'OTROS': '#64748B'       // Slate 500
}

type Props = {
    initialData: TendenciasDashboardData
    initialFilters?: TendenciasFilterParams
    currentUser: {
        username: string
        name?: string | null
        roleName?: string | null
    }
}

export default function TendenciasPmpaClient({ initialData, initialFilters, currentUser }: Props) {
    const [data, setData] = useState<TendenciasDashboardData>(initialData)
    const [filters, setFilters] = useState<TendenciasFilterParams>(initialFilters || {})
    const [isPending, startTransition] = useTransition()
    const [activeServiceTab, setActiveServiceTab] = useState<string>('TODOS')
    const [searchTableQuery, setSearchTableQuery] = useState('')
    const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)

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

    // Sincronizar input cuando filters.rbd cambia externamente o se limpia
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
            c.label.toLowerCase().includes(q)
        ).slice(0, 20)
    }, [colegioSearchInput, data.filtrosDisponibles.colegios])

    const handleSelectColegio = (item: { rbd: number; nombre: string; label: string }) => {
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
    const handleFilterChange = (key: keyof TendenciasFilterParams, value: any) => {
        const updated = {
            ...filters,
            [key]: value === '' || value === 'ALL' ? undefined : (key === 'ano' || key === 'mes' || key === 'rbd' ? Number(value) : value)
        }
        setFilters(updated)

        startTransition(async () => {
            try {
                const fresh = await fetchTendenciasPmpaData(updated)
                setData(fresh)
            } catch (err) {
                console.error('Error aplicando filtros en Tendencias PMPA:', err)
            }
        })
    }

    const handleClearFilters = () => {
        setFilters({})
        setColegioSearchInput('')
        setIsAutocompleteOpen(false)
        startTransition(async () => {
            try {
                const fresh = await fetchTendenciasPmpaData({})
                setData(fresh)
            } catch (err) {
                console.error('Error reseteando filtros:', err)
            }
        })
    }

    // Exportar datos a CSV
    const handleExportCSV = () => {
        if (!data.rankingRbds || data.rankingRbds.length === 0) return

        const headers = ['RBD', 'Establecimiento', 'Sucursal', 'Total Raciones', 'Desayunos', 'Almuerzos', 'Onces', 'Colaciones', 'Cenas']
        const rows = data.rankingRbds.map(r => [
            r.rbd,
            `"${r.nombre.replace(/"/g, '""')}"`,
            `"${r.sucursal}"`,
            r.totalRaciones,
            r.desayuno,
            r.almuerzo,
            r.once,
            r.colacion,
            r.cena
        ])

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n')
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement('a')
        link.setAttribute('href', encodedUri)
        link.setAttribute('download', `Tendencias_PMPA_${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // Filtrar tabla de colegios
    const filteredRanking = useMemo(() => {
        if (!searchTableQuery.trim()) return data.rankingRbds
        const q = searchTableQuery.toLowerCase().trim()
        return data.rankingRbds.filter(r =>
            String(r.rbd).includes(q) ||
            r.nombre.toLowerCase().includes(q) ||
            r.sucursal.toLowerCase().includes(q)
        )
    }, [data.rankingRbds, searchTableQuery])

    // Calcular máximo para la escala de la línea de tiempo
    const maxTimelineValue = useMemo(() => {
        if (data.timeline.length === 0) return 1
        return Math.max(...data.timeline.map(t => t.total)) * 1.15
    }, [data.timeline])

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 lg:p-8 space-y-6">
            {/* ENCABEZADO EJECUTIVO (TEMA CLARO CORPORATIVO) */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center text-3xl shadow-sm shrink-0">
                        📈
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                                Tendencias y Oscilación PMPA
                            </h1>
                            <span className="text-[11px] font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-300">
                                HENDAYA
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-slate-500 mt-1">
                            Monitoreo longitudinal de cargas PMPA, oscilación de raciones por programa, servicio, sucursal y colegios (RBD).
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
                    {/* Badge de seguridad / perfil */}
                    {data.permisos.isRestrictedByRbd ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                            <span>🔒</span>
                            <span>Filtrado por tu perfil: {data.permisos.assignedRbdsCount ?? 0} colegios asignados</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                            <span>🌐</span>
                            <span>Acceso Global (Todos los Colegios y Sucursales)</span>
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
                        title="Restablecer filtros"
                    >
                        <span className={isPending ? 'animate-spin' : ''}>🔄</span>
                        <span>{isPending ? 'Actualizando...' : 'Refrescar'}</span>
                    </button>
                </div>
            </div>

            {/* BARRA DE FILTROS EN CASCADA (TEMA CLARO) */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1 border-b border-slate-100">
                    <span className="flex items-center gap-2">
                        <span>🔍</span> Filtros Analíticos en Cascada
                    </span>
                    {(filters.ano || filters.mes || filters.sucursal || filters.programa || filters.servicio || filters.rbd) && (
                        <button
                            onClick={handleClearFilters}
                            className="text-xs text-sky-600 hover:text-sky-700 font-semibold underline"
                        >
                            Limpiar todos los filtros
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-1">
                    {/* AÑO */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">Año</label>
                        <select
                            value={filters.ano ?? ''}
                            onChange={(e) => handleFilterChange('ano', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                        >
                            <option value="">(Todos los años)</option>
                            {data.filtrosDisponibles.anos.map(a => (
                                <option key={a} value={a}>{a}</option>
                            ))}
                        </select>
                    </div>

                    {/* MES */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">Mes</label>
                        <select
                            value={filters.mes ?? ''}
                            onChange={(e) => handleFilterChange('mes', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                        >
                            <option value="">(Todos los meses)</option>
                            {data.filtrosDisponibles.meses.map(m => (
                                <option key={m.numero} value={m.numero}>{m.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {/* SUCURSAL */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">Sucursal / Centro</label>
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

                    {/* PROGRAMA */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">Programa</label>
                        <select
                            value={filters.programa ?? ''}
                            onChange={(e) => handleFilterChange('programa', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                        >
                            <option value="">(Todos los programas)</option>
                            {data.filtrosDisponibles.programas.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>

                    {/* SERVICIO */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">Servicio Alimentario</label>
                        <select
                            value={filters.servicio ?? ''}
                            onChange={(e) => handleFilterChange('servicio', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                        >
                            <option value="">(Todos los servicios)</option>
                            {data.filtrosDisponibles.servicios.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* ESTABLECIMIENTO / RBD CON AUTOCOMPLETADO INTELIGENTE */}
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
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-rose-600 bg-slate-200/80 hover:bg-rose-100 rounded-full w-4 h-4 flex items-center justify-center text-[10px] transition-colors"
                                    title="Quitar filtro de colegio"
                                >
                                    ✕
                                </button>
                            ) : colegioSearchInput ? (
                                <button
                                    type="button"
                                    onClick={() => setColegioSearchInput('')}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 bg-slate-200/80 hover:bg-slate-300 rounded-full w-4 h-4 flex items-center justify-center text-[10px] transition-colors"
                                    title="Limpiar texto"
                                >
                                    ✕
                                </button>
                            ) : null}
                        </div>

                        {/* Dropdown de Sugerencias Autocompletadas */}
                        {isAutocompleteOpen && (
                            <div className="absolute z-50 left-0 sm:right-0 sm:left-auto mt-1 w-full sm:w-[380px] max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl divide-y divide-slate-100 text-xs animate-in fade-in zoom-in-95 duration-150">
                                <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold sticky top-0 z-10">
                                    <span>Resultados ({colegioSuggestions.length})</span>
                                    {filters.rbd && (
                                        <button
                                            type="button"
                                            onClick={handleClearColegio}
                                            className="text-rose-600 hover:text-rose-700 font-bold text-[10px]"
                                        >
                                            Mostrar todos los colegios
                                        </button>
                                    )}
                                </div>
                                {colegioSuggestions.length === 0 ? (
                                    <div className="p-4 text-center text-slate-400">
                                        <p className="font-medium">No se encontraron colegios con &ldquo;{colegioSearchInput}&rdquo;</p>
                                        <p className="text-[10px] text-slate-400 mt-1">Busque por número de RBD o nombre del establecimiento</p>
                                    </div>
                                ) : (
                                    colegioSuggestions.map(item => {
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
            </div>

            {/* TARJETAS KPI SUPERIORES (TEMA CLARO) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1: TOTAL RACIONES */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-sky-300 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Total Raciones
                        </span>
                        <span className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center text-base">
                            🍽️
                        </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                            {data.kpis.totalRaciones.toLocaleString('es-CL')}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">raciones</span>
                    </div>

                    {data.kpis.variacionIntermensual && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-xs font-bold">
                            {data.kpis.variacionIntermensual.direccion === 'up' && (
                                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                    ▲ +{data.kpis.variacionIntermensual.porcentaje}% ({data.kpis.variacionIntermensual.absoluta.toLocaleString('es-CL')})
                                </span>
                            )}
                            {data.kpis.variacionIntermensual.direccion === 'down' && (
                                <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                    ▼ {data.kpis.variacionIntermensual.porcentaje}% ({data.kpis.variacionIntermensual.absoluta.toLocaleString('es-CL')})
                                </span>
                            )}
                            {data.kpis.variacionIntermensual.direccion === 'flat' && (
                                <span className="text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
                                    Sin variación
                                </span>
                            )}
                            <span className="text-slate-400 text-[10px] font-normal">
                                ({data.kpis.variacionIntermensual.periodoComparado})
                            </span>
                        </div>
                    )}
                </div>

                {/* KPI 2: MES PICO GLOBAL */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-amber-300 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Mes Pico Global
                        </span>
                        <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center text-base">
                            🏆
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                            {data.kpis.mesPico ? `${data.kpis.mesPico.mesNombre} ${data.kpis.mesPico.anio}` : 'Sin datos'}
                        </div>
                        <div className="text-xs text-amber-700 font-bold mt-1">
                            {data.kpis.mesPico ? `${data.kpis.mesPico.cantidad.toLocaleString('es-CL')} raciones asignadas` : 'N/A'}
                        </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                        Período con mayor volumen de raciones registradas.
                    </p>
                </div>

                {/* KPI 3: SERVICIO PREDOMINANTE */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Servicio Top
                        </span>
                        <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-base">
                            🥪
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                            <span>{data.kpis.servicioPredominante?.servicio || 'Sin datos'}</span>
                            {data.kpis.servicioPredominante && (
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                                    {data.kpis.servicioPredominante.porcentaje}%
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-slate-600 font-medium mt-1">
                            {data.kpis.servicioPredominante
                                ? `Récord en ${data.kpis.servicioPredominante.mesRecord} (${data.kpis.servicioPredominante.mesRecordCant.toLocaleString('es-CL')})`
                                : 'N/A'
                            }
                        </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                        Servicio alimentario con mayor cuota de raciones.
                    </p>
                </div>

                {/* KPI 4: ESTABLECIMIENTOS CUBIERTOS */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-sky-300 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Colegios con Asignación
                        </span>
                        <span className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center text-base">
                            🏫
                        </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                            {data.kpis.colegiosConCarga.toLocaleString('es-CL')}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">RBDs</span>
                    </div>
                    <div className="text-xs text-sky-700 font-bold mt-1">
                        Promedio: {data.kpis.promedioMensualRaciones.toLocaleString('es-CL')} rac/mes
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                        {data.kpis.totalRegistros.toLocaleString('es-CL')} registros individuales analizados.
                    </p>
                </div>
            </div>

            {/* GRÁFICO COMPARATIVO DE OSCILACIÓN MULTI-DIMENSIONAL (AÑOS, MES, RBD, PROGRAMA, SERVICIO) */}
            <GraficoComparativoOscilacion
                comparativa={data.comparativaOscilacion}
                filtros={filters}
                onFilterChange={handleFilterChange}
                isPending={isPending}
            />

            {/* SECCIÓN 1: LÍNEA DE TIEMPO INTERACTIVA Y OSCILACIÓN (TEMA CLARO) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                            <span>⏱️</span> Línea de Tiempo: Oscilación Histórica de Raciones
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Variación cronológica de volumen mensual y distribución por servicio alimentario.
                        </p>
                    </div>

                    {/* Filtro rápido por servicio para resaltar en el gráfico */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {['TODOS', 'DESAYUNO', 'ALMUERZO', 'ONCE', 'COLACIÓN'].map(s => (
                            <button
                                key={s}
                                onClick={() => setActiveServiceTab(s)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                    activeServiceTab === s
                                        ? 'bg-sky-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* GRÁFICO VISUAL DINÁMICO */}
                {data.timeline.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
                        <span>📊 No hay datos disponibles para el criterio seleccionado</span>
                    </div>
                ) : (
                    <div className="space-y-6 pt-2">
                        {/* BARRAS APILADAS Y CURVA DE TENDENCIA */}
                        <div className="h-64 md:h-72 w-full flex items-end justify-between gap-4 md:gap-8 px-4 pt-8 pb-4 bg-slate-50/80 border border-slate-200 rounded-xl relative overflow-hidden">
                            {/* Líneas guía de fondo */}
                            <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-40">
                                <div className="border-b border-slate-200 w-full" />
                                <div className="border-b border-slate-200 w-full" />
                                <div className="border-b border-slate-200 w-full" />
                            </div>

                            {data.timeline.map((point, idx) => {
                                const heightPct = Math.min(100, Math.max(10, (point.total / maxTimelineValue) * 100))
                                const isHovered = hoveredPoint === idx

                                const pctDes = point.total > 0 ? (point.desayuno / point.total) * 100 : 0
                                const pctAlm = point.total > 0 ? (point.almuerzo / point.total) * 100 : 0
                                const pctOnc = point.total > 0 ? (point.once / point.total) * 100 : 0
                                const pctCol = point.total > 0 ? (point.colacion / point.total) * 100 : 0
                                const pctCen = point.total > 0 ? (point.cena / point.total) * 100 : 0

                                return (
                                    <div
                                        key={point.periodoKey}
                                        onMouseEnter={() => setHoveredPoint(idx)}
                                        onMouseLeave={() => setHoveredPoint(null)}
                                        className="flex-1 flex flex-col items-center h-full justify-end relative group cursor-pointer"
                                    >
                                        {/* Tooltip flotante */}
                                        {isHovered && (
                                            <div className="absolute -top-32 z-30 bg-slate-900 text-white border border-slate-700 rounded-xl p-3 shadow-2xl text-xs w-56 animate-in fade-in zoom-in-95 duration-150">
                                                <div className="font-bold text-white flex items-center justify-between border-b border-slate-700 pb-1.5 mb-1.5">
                                                    <span>{point.label}</span>
                                                    <span className="text-cyan-400 font-extrabold">{point.total.toLocaleString('es-CL')} rac</span>
                                                </div>
                                                <div className="space-y-1 text-[11px]">
                                                    <div className="flex items-center justify-between text-amber-300">
                                                        <span>🌅 Desayunos:</span>
                                                        <span className="font-bold">{point.desayuno.toLocaleString('es-CL')}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-emerald-300">
                                                        <span>☀️ Almuerzos:</span>
                                                        <span className="font-bold">{point.almuerzo.toLocaleString('es-CL')}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-sky-300">
                                                        <span>☕ Onces:</span>
                                                        <span className="font-bold">{point.once.toLocaleString('es-CL')}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-violet-300">
                                                        <span>🍎 Colaciones:</span>
                                                        <span className="font-bold">{point.colacion.toLocaleString('es-CL')}</span>
                                                    </div>
                                                </div>
                                                {point.deltaPrevio !== 0 && (
                                                    <div className="mt-1.5 pt-1 border-t border-slate-700 text-[10px] text-slate-300 flex justify-between">
                                                        <span>Variación vs mes anterior:</span>
                                                        <span className={point.deltaPrevio > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                                            {point.deltaPrevio > 0 ? `+${point.deltaPct}%` : `${point.deltaPct}%`}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Delta badge en el tope de la columna */}
                                        <div className="mb-2 text-[10px] font-bold">
                                            {point.deltaPrevio !== 0 && (
                                                <span className={point.deltaPrevio > 0 ? 'text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200' : 'text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200'}>
                                                    {point.deltaPrevio > 0 ? `▲ +${point.deltaPct}%` : `▼ ${point.deltaPct}%`}
                                                </span>
                                            )}
                                        </div>

                                        {/* Barra vertical apilada */}
                                        <div
                                            style={{ height: `${heightPct}%` }}
                                            className={`w-full max-w-[48px] rounded-t-xl overflow-hidden flex flex-col justify-end transition-all duration-300 ${
                                                isHovered ? 'ring-2 ring-sky-500 shadow-md' : 'opacity-95 hover:opacity-100'
                                            }`}
                                        >
                                            {activeServiceTab === 'TODOS' ? (
                                                <>
                                                    <div style={{ height: `${pctCen}%`, backgroundColor: SERVICIOS_COLORES['CENA'] }} title="Cena" />
                                                    <div style={{ height: `${pctCol}%`, backgroundColor: SERVICIOS_COLORES['COLACIÓN'] }} title="Colación" />
                                                    <div style={{ height: `${pctOnc}%`, backgroundColor: SERVICIOS_COLORES['ONCE'] }} title="Once" />
                                                    <div style={{ height: `${pctAlm}%`, backgroundColor: SERVICIOS_COLORES['ALMUERZO'] }} title="Almuerzo" />
                                                    <div style={{ height: `${pctDes}%`, backgroundColor: SERVICIOS_COLORES['DESAYUNO'] }} title="Desayuno" />
                                                </>
                                            ) : (
                                                <div
                                                    style={{ height: '100%', backgroundColor: SERVICIOS_COLORES[activeServiceTab] || '#0284C7' }}
                                                    className="w-full"
                                                />
                                            )}
                                        </div>

                                        {/* Etiqueta del período */}
                                        <div className="mt-3 text-center">
                                            <div className="text-xs font-bold text-slate-800">{point.label}</div>
                                            <div className="text-[10px] text-slate-500 font-semibold">{point.total.toLocaleString('es-CL')}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* LEYENDA DE SERVICIOS */}
                        <div className="flex items-center justify-center gap-6 flex-wrap pt-1 text-xs font-semibold">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: SERVICIOS_COLORES['DESAYUNO'] }} />
                                <span className="text-slate-700">Desayuno</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: SERVICIOS_COLORES['ALMUERZO'] }} />
                                <span className="text-slate-700">Almuerzo</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: SERVICIOS_COLORES['ONCE'] }} />
                                <span className="text-slate-700">Once</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: SERVICIOS_COLORES['COLACIÓN'] }} />
                                <span className="text-slate-700">Colación</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: SERVICIOS_COLORES['CENA'] }} />
                                <span className="text-slate-700">Cena</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* SECCIÓN 2: COMPARATIVA DE MESES POR SERVICIO (¿Qué meses se dieron más?) */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                            <span>🏆</span> Desglose y Récords por Servicio Alimentario
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Resumen detallado de meses con mayor entrega en Desayunos, Almuerzos, Once, etc.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.serviciosAnalisis.map(serv => {
                        return (
                            <div
                                key={serv.servicio}
                                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3.5 hover:shadow-md hover:border-slate-300 transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <span
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: serv.color }}
                                        />
                                        <span className="font-extrabold text-slate-900 text-sm">{serv.servicio}</span>
                                    </div>
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                                        {serv.porcentaje}% del total
                                    </span>
                                </div>

                                <div className="flex items-baseline justify-between pt-1">
                                    <div>
                                        <div className="text-2xl font-black text-slate-900">
                                            {serv.total.toLocaleString('es-CL')}
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-medium">raciones acumuladas</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 inline-block">
                                            🌟 Mes Récord: {serv.mesPico.mesNombre} {serv.mesPico.anio}
                                        </div>
                                        <div className="text-[11px] text-slate-700 font-bold mt-1">
                                            {serv.mesPico.cantidad.toLocaleString('es-CL')} raciones
                                        </div>
                                    </div>
                                </div>

                                {/* BARRAS MENSUALES COMPARATIVAS */}
                                <div className="pt-2 border-t border-slate-100 space-y-2">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                                        Distribución Mensual
                                    </span>
                                    {serv.porMes.map(m => {
                                        const pctMes = serv.mesPico.cantidad > 0 ? (m.cantidad / serv.mesPico.cantidad) * 100 : 0
                                        const isRecord = m.cantidad === serv.mesPico.cantidad && m.cantidad > 0

                                        return (
                                            <div key={m.label} className="space-y-0.5">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className={isRecord ? 'font-bold text-amber-700 flex items-center gap-1' : 'text-slate-700 font-medium'}>
                                                        {isRecord && '⭐'} {m.label}
                                                    </span>
                                                    <span className="font-bold text-slate-900">
                                                        {m.cantidad.toLocaleString('es-CL')}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        style={{ width: `${pctMes}%`, backgroundColor: serv.color }}
                                                        className="h-full rounded-full transition-all duration-500"
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* SECCIÓN 3: PROGRAMAS ALIMENTARIOS & MATRIZ POR SUCURSAL */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* DISTRIBUCIÓN POR PROGRAMA */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div>
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <span>🍱</span> Distribución por Programa Alimentario
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Concentración de raciones según programa JUNAEB / Hendaya.
                            </p>
                        </div>
                        <span className="text-xs text-slate-600 font-bold bg-slate-100 px-2.5 py-0.5 rounded-full">
                            {data.programasAnalisis.length} programas
                        </span>
                    </div>

                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {data.programasAnalisis.slice(0, 10).map((prog, idx) => {
                            const colors = ['#0284C7', '#059669', '#D97706', '#7C3AED', '#DB2777', '#4F46E5', '#64748B']
                            const c = colors[idx % colors.length]

                            return (
                                <div key={prog.programa} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-slate-900 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                                            {prog.programa}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-900 font-bold">{prog.total.toLocaleString('es-CL')} rac</span>
                                            <span className="text-slate-500 text-[11px] font-semibold">({prog.porcentaje}%)</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div
                                            style={{ width: `${Math.min(100, prog.porcentaje * 2)}%`, backgroundColor: c }}
                                            className="h-full rounded-full transition-all duration-500"
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* MATRIZ SUCURSALES VS MESES */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div>
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <span>🗺️</span> Raciones por Sucursal / Centro de Distribución
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Volumen consolidado distribuido por territorio y mes.
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-80">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider">
                                <tr>
                                    <th className="py-2.5 px-3 rounded-l-lg">Sucursal</th>
                                    {data.timeline.map(t => (
                                        <th key={t.label} className="py-2.5 px-3 text-right">{t.label}</th>
                                    ))}
                                    <th className="py-2.5 px-3 text-right rounded-r-lg">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {data.matrizSucursales.map(suc => (
                                    <tr key={suc.sucursal} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                                            <span>🏢</span> {suc.sucursal}
                                        </td>
                                        {data.timeline.map(t => {
                                            const val = suc.meses[t.label] || 0
                                            return (
                                                <td key={t.label} className="py-2.5 px-3 text-right font-medium text-slate-700">
                                                    {val > 0 ? val.toLocaleString('es-CL') : '-'}
                                                </td>
                                            )
                                        })}
                                        <td className="py-2.5 px-3 text-right font-black text-sky-700">
                                            {suc.total.toLocaleString('es-CL')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 4: RANKING DE ESTABLECIMIENTOS (RBDs) Y DESGLOSE */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                            <span>🏫</span> Detalle por Establecimiento (RBD)
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Raciones totales y desglose por servicio para los colegios evaluados.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                            <input
                                type="text"
                                placeholder="Buscar por RBD, nombre o sucursal..."
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
                                <th className="py-3 px-3.5 text-right">Total Raciones</th>
                                <th className="py-3 px-3.5 text-right text-amber-700">Desayuno</th>
                                <th className="py-3 px-3.5 text-right text-emerald-700">Almuerzo</th>
                                <th className="py-3 px-3.5 text-right text-sky-700">Once</th>
                                <th className="py-3 px-3.5 text-right text-violet-700">Colación</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {filteredRanking.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-8 text-center text-slate-400">
                                        No se encontraron establecimientos con los criterios seleccionados.
                                    </td>
                                </tr>
                            ) : (
                                filteredRanking.slice(0, 30).map((r) => (
                                    <tr key={r.rbd} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-2.5 px-3.5 font-bold text-sky-700">
                                            {r.rbd}
                                        </td>
                                        <td className="py-2.5 px-3.5 font-medium text-slate-900 max-w-xs truncate" title={r.nombre}>
                                            {r.nombre}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-slate-600">
                                            {r.sucursal}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right font-black text-slate-900">
                                            {r.totalRaciones.toLocaleString('es-CL')}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right font-bold text-amber-700">
                                            {r.desayuno.toLocaleString('es-CL')}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right font-bold text-emerald-700">
                                            {r.almuerzo.toLocaleString('es-CL')}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right font-bold text-sky-700">
                                            {r.once.toLocaleString('es-CL')}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right font-bold text-violet-700">
                                            {r.colacion.toLocaleString('es-CL')}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredRanking.length > 30 && (
                    <p className="text-[11px] text-slate-500 text-center font-medium">
                        Mostrando los primeros 30 de {filteredRanking.length} establecimientos. Exporta a CSV para visualizar el universo completo.
                    </p>
                )}
            </div>
        </div>
    )
}
