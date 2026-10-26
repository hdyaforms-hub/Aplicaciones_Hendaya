'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
    TendenciasDashboardData,
    TendenciasFilterParams,
    fetchTendenciasPmpaData
} from './actions'

const SERVICIOS_COLORES: Record<string, string> = {
    'DESAYUNO': '#F59E0B',   // Ámbar cálido / Sol
    'ALMUERZO': '#10B981',   // Esmeralda / Nutrición
    'ONCE': '#0EA5E9',       // Sky / Cyan Hendaya
    'COLACIÓN': '#8B5CF6',   // Violeta
    'COLACION': '#8B5CF6',   // Violeta
    'CENA': '#6366F1',       // Índigo
    'OTROS': '#94A3B8'       // Slate neutro
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

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
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
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 space-y-6">
            {/* ENCABEZADO */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-lg shadow-cyan-500/10">
                            📈
                        </span>
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                                    Tendencias y Oscilación PMPA
                                </h1>
                                <span className="text-[11px] font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                    HENDAYA
                                </span>
                            </div>
                            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                                Comportamiento temporal de cargas, oscilación por programa, servicio alimentario, sucursal y colegios (RBD).
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Badge de seguridad / perfil */}
                    {data.permisos.isRestrictedByRbd ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
                            <span>🔒</span>
                            <span>Filtrado por tu perfil: {data.permisos.assignedRbdsCount ?? 0} colegios asignados</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                            <span>🌐</span>
                            <span>Acceso Global (Todos los Colegios y Sucursales)</span>
                        </div>
                    )}

                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white text-xs font-semibold transition-all shadow-sm"
                        title="Exportar datos a CSV"
                    >
                        <span>📥</span>
                        <span>Exportar CSV</span>
                    </button>

                    <button
                        onClick={handleClearFilters}
                        disabled={isPending}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-all disabled:opacity-50"
                        title="Restablecer filtros"
                    >
                        <span className={isPending ? 'animate-spin' : ''}>🔄</span>
                        <span>{isPending ? 'Actualizando...' : 'Refrescar'}</span>
                    </button>
                </div>
            </div>

            {/* BARRA DE FILTROS EN CASCADA */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl backdrop-blur-sm space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 pb-1">
                    <span className="flex items-center gap-2">
                        <span>🔍</span> Filtros Analíticos en Cascada
                    </span>
                    {(filters.ano || filters.mes || filters.sucursal || filters.programa || filters.servicio || filters.rbd) && (
                        <button
                            onClick={handleClearFilters}
                            className="text-xs text-sky-400 hover:text-sky-300 underline font-normal"
                        >
                            Limpiar todos los filtros
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    {/* AÑO */}
                    <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Año</label>
                        <select
                            value={filters.ano ?? ''}
                            onChange={(e) => handleFilterChange('ano', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        >
                            <option value="">Todos los años</option>
                            {data.filtrosDisponibles.anos.map(a => (
                                <option key={a} value={a}>{a}</option>
                            ))}
                        </select>
                    </div>

                    {/* MES */}
                    <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Mes</label>
                        <select
                            value={filters.mes ?? ''}
                            onChange={(e) => handleFilterChange('mes', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        >
                            <option value="">Todos los meses</option>
                            {data.filtrosDisponibles.meses.map(m => (
                                <option key={m.numero} value={m.numero}>{m.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {/* SUCURSAL */}
                    <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Sucursal / Centro</label>
                        <select
                            value={filters.sucursal ?? ''}
                            onChange={(e) => handleFilterChange('sucursal', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        >
                            <option value="">Todas las sucursales</option>
                            {data.filtrosDisponibles.sucursales.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* PROGRAMA */}
                    <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Programa</label>
                        <select
                            value={filters.programa ?? ''}
                            onChange={(e) => handleFilterChange('programa', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        >
                            <option value="">Todos los programas</option>
                            {data.filtrosDisponibles.programas.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>

                    {/* SERVICIO */}
                    <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Servicio Alimentario</label>
                        <select
                            value={filters.servicio ?? ''}
                            onChange={(e) => handleFilterChange('servicio', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        >
                            <option value="">Todos los servicios</option>
                            {data.filtrosDisponibles.servicios.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* ESTABLECIMIENTO / RBD */}
                    <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Colegio (RBD)</label>
                        <select
                            value={filters.rbd ?? ''}
                            onChange={(e) => handleFilterChange('rbd', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        >
                            <option value="">Todos los establecimientos</option>
                            {data.filtrosDisponibles.colegios.map(c => (
                                <option key={c.rbd} value={c.rbd}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* TARJETAS KPI SUPERIORES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1: TOTAL RACIONES */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-lg group hover:border-cyan-500/50 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Total Raciones
                        </span>
                        <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 text-sm">
                            🍽️
                        </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-white tracking-tight">
                            {data.kpis.totalRaciones.toLocaleString('es-CL')}
                        </span>
                        <span className="text-xs text-slate-400">raciones</span>
                    </div>

                    {data.kpis.variacionIntermensual && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold">
                            {data.kpis.variacionIntermensual.direccion === 'up' && (
                                <span className="text-emerald-400 flex items-center gap-0.5">
                                    ▲ +{data.kpis.variacionIntermensual.porcentaje}% ({data.kpis.variacionIntermensual.absoluta.toLocaleString('es-CL')})
                                </span>
                            )}
                            {data.kpis.variacionIntermensual.direccion === 'down' && (
                                <span className="text-red-400 flex items-center gap-0.5">
                                    ▼ {data.kpis.variacionIntermensual.porcentaje}% ({data.kpis.variacionIntermensual.absoluta.toLocaleString('es-CL')})
                                </span>
                            )}
                            {data.kpis.variacionIntermensual.direccion === 'flat' && (
                                <span className="text-slate-400">Sin variación</span>
                            )}
                            <span className="text-slate-500 text-[10px]">
                                ({data.kpis.variacionIntermensual.periodoComparado})
                            </span>
                        </div>
                    )}
                </div>

                {/* KPI 2: MES PICO GLOBAL */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-lg group hover:border-amber-500/50 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Mes Pico Global
                        </span>
                        <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 text-sm">
                            🏆
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-extrabold text-white tracking-tight">
                            {data.kpis.mesPico ? `${data.kpis.mesPico.mesNombre} ${data.kpis.mesPico.anio}` : 'Sin datos'}
                        </div>
                        <div className="text-xs text-amber-400 font-semibold mt-1">
                            {data.kpis.mesPico ? `${data.kpis.mesPico.cantidad.toLocaleString('es-CL')} raciones asignadas` : 'N/A'}
                        </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                        Período con mayor volumen de raciones registradas.
                    </p>
                </div>

                {/* KPI 3: SERVICIO PREDOMINANTE */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-lg group hover:border-emerald-500/50 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Servicio Top
                        </span>
                        <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm">
                            🥪
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                            <span>{data.kpis.servicioPredominante?.servicio || 'Sin datos'}</span>
                            {data.kpis.servicioPredominante && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                                    {data.kpis.servicioPredominante.porcentaje}%
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-slate-300 font-medium mt-1">
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
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-lg group hover:border-sky-500/50 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Colegios con Asignación
                        </span>
                        <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400 text-sm">
                            🏫
                        </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-white tracking-tight">
                            {data.kpis.colegiosConCarga.toLocaleString('es-CL')}
                        </span>
                        <span className="text-xs text-slate-400">RBDs</span>
                    </div>
                    <div className="text-xs text-sky-400 font-semibold mt-1">
                        Promedio: {data.kpis.promedioMensualRaciones.toLocaleString('es-CL')} rac/mes
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                        {data.kpis.totalRegistros.toLocaleString('es-CL')} registros individuales analizados.
                    </p>
                </div>
            </div>

            {/* SECCIÓN 1: LÍNEA DE TIEMPO INTERACTIVA Y OSCILACIÓN */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
                    <div>
                        <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                            <span>⏱️</span> Línea de Tiempo: Oscilación Histórica de Raciones
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Variación cronológica de volumen mensual y distribución por servicio alimentario.
                        </p>
                    </div>

                    {/* Filtro rápido por servicio para resaltar en el gráfico */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {['TODOS', 'DESAYUNO', 'ALMUERZO', 'ONCE', 'COLACIÓN'].map(s => (
                            <button
                                key={s}
                                onClick={() => setActiveServiceTab(s)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                    activeServiceTab === s
                                        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* GRÁFICO VISUAL DINÁMICO */}
                {data.timeline.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm">
                        <span>📊 No hay datos disponibles para el criterio seleccionado</span>
                    </div>
                ) : (
                    <div className="space-y-6 pt-2">
                        {/* BARRAS APILADAS Y CURVA DE TENDENCIA */}
                        <div className="h-64 md:h-72 w-full flex items-end justify-between gap-4 md:gap-8 px-4 pt-8 pb-4 bg-slate-950/60 border border-slate-800/60 rounded-xl relative overflow-hidden">
                            {/* Líneas guía de fondo */}
                            <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-20">
                                <div className="border-b border-slate-600 w-full" />
                                <div className="border-b border-slate-600 w-full" />
                                <div className="border-b border-slate-600 w-full" />
                            </div>

                            {data.timeline.map((point, idx) => {
                                const heightPct = Math.min(100, Math.max(10, (point.total / maxTimelineValue) * 100))
                                const isHovered = hoveredPoint === idx

                                // Porcentajes de cada servicio para la barra apilada
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
                                            <div className="absolute -top-32 z-30 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl text-xs w-56 animate-in fade-in zoom-in-95 duration-150">
                                                <div className="font-bold text-white flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
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
                                                    <div className="mt-1.5 pt-1 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between">
                                                        <span>Variación vs mes anterior:</span>
                                                        <span className={point.deltaPrevio > 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                                                            {point.deltaPrevio > 0 ? `+${point.deltaPct}%` : `${point.deltaPct}%`}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Delta badge en el tope de la columna */}
                                        <div className="mb-2 text-[10px] font-bold text-slate-400">
                                            {point.deltaPrevio !== 0 && (
                                                <span className={point.deltaPrevio > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                                    {point.deltaPrevio > 0 ? `▲ +${point.deltaPct}%` : `▼ ${point.deltaPct}%`}
                                                </span>
                                            )}
                                        </div>

                                        {/* Barra vertical apilada */}
                                        <div
                                            style={{ height: `${heightPct}%` }}
                                            className={`w-full max-w-[48px] rounded-t-xl overflow-hidden flex flex-col justify-end transition-all duration-300 ${
                                                isHovered ? 'ring-2 ring-cyan-400 shadow-xl shadow-cyan-500/20' : 'opacity-90 hover:opacity-100'
                                            }`}
                                        >
                                            {/* Si hay filtro de servicio activo, destacar sólo ese servicio */}
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
                                                    style={{ height: '100%', backgroundColor: SERVICIOS_COLORES[activeServiceTab] || '#0EA5E9' }}
                                                    className="w-full"
                                                />
                                            )}
                                        </div>

                                        {/* Etiqueta del período */}
                                        <div className="mt-3 text-center">
                                            <div className="text-xs font-bold text-white">{point.label}</div>
                                            <div className="text-[10px] text-slate-400">{point.total.toLocaleString('es-CL')}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* LEYENDA DE SERVICIOS */}
                        <div className="flex items-center justify-center gap-6 flex-wrap pt-1 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: SERVICIOS_COLORES['DESAYUNO'] }} />
                                <span className="text-slate-300">Desayuno</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: SERVICIOS_COLORES['ALMUERZO'] }} />
                                <span className="text-slate-300">Almuerzo</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: SERVICIOS_COLORES['ONCE'] }} />
                                <span className="text-slate-300">Once</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: SERVICIOS_COLORES['COLACIÓN'] }} />
                                <span className="text-slate-300">Colación</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: SERVICIOS_COLORES['CENA'] }} />
                                <span className="text-slate-300">Cena</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* SECCIÓN 2: COMPARATIVA DE MESES POR SERVICIO (¿Qué meses se dieron más?) */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                            <span>🏆</span> Desglose y Récords por Servicio Alimentario
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Resumen detallado de meses con mayor entrega en Desayunos, Almuerzos, Once, etc.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.serviciosAnalisis.map(serv => {
                        return (
                            <div
                                key={serv.servicio}
                                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg space-y-3.5 hover:border-slate-700 transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <span
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: serv.color }}
                                        />
                                        <span className="font-bold text-white text-sm">{serv.servicio}</span>
                                    </div>
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
                                        {serv.porcentaje}% del total
                                    </span>
                                </div>

                                <div className="flex items-baseline justify-between pt-1">
                                    <div>
                                        <div className="text-xl font-extrabold text-white">
                                            {serv.total.toLocaleString('es-CL')}
                                        </div>
                                        <div className="text-[11px] text-slate-400">raciones acumuladas</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-amber-400">
                                            🌟 Mes Récord: {serv.mesPico.mesNombre} {serv.mesPico.anio}
                                        </div>
                                        <div className="text-[11px] text-slate-300 font-semibold">
                                            {serv.mesPico.cantidad.toLocaleString('es-CL')} raciones
                                        </div>
                                    </div>
                                </div>

                                {/* BARRAS MENSUALES COMPARATIVAS DENTRO DE LA TARJETA */}
                                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                                    <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 block">
                                        Distribución Mensual
                                    </span>
                                    {serv.porMes.map(m => {
                                        const pctMes = serv.mesPico.cantidad > 0 ? (m.cantidad / serv.mesPico.cantidad) * 100 : 0
                                        const isRecord = m.cantidad === serv.mesPico.cantidad && m.cantidad > 0

                                        return (
                                            <div key={m.label} className="space-y-0.5">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className={isRecord ? 'font-bold text-amber-300 flex items-center gap-1' : 'text-slate-300'}>
                                                        {isRecord && '⭐'} {m.label}
                                                    </span>
                                                    <span className="font-semibold text-slate-200">
                                                        {m.cantidad.toLocaleString('es-CL')}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
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
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div>
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <span>🍱</span> Distribución por Programa Alimentario
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Concentración de raciones según programa JUNAEB / Hendaya.
                            </p>
                        </div>
                        <span className="text-xs text-slate-400 font-semibold">
                            {data.programasAnalisis.length} programas
                        </span>
                    </div>

                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {data.programasAnalisis.slice(0, 10).map((prog, idx) => {
                            const colors = ['#06B6D4', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#64748B']
                            const c = colors[idx % colors.length]

                            return (
                                <div key={prog.programa} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-white flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                                            {prog.programa}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-300 font-semibold">{prog.total.toLocaleString('es-CL')} rac</span>
                                            <span className="text-slate-400 text-[11px] font-bold">({prog.porcentaje}%)</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
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
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div>
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <span>🗺️</span> Raciones por Sucursal / Centro de Distribución
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Volumen consolidado distribuido por territorio y mes.
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-80">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                                <tr>
                                    <th className="py-2.5 px-3 rounded-l-lg">Sucursal</th>
                                    {data.timeline.map(t => (
                                        <th key={t.label} className="py-2.5 px-3 text-right">{t.label}</th>
                                    ))}
                                    <th className="py-2.5 px-3 text-right rounded-r-lg">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {data.matrizSucursales.map(suc => (
                                    <tr key={suc.sucursal} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                                            <span>🏢</span> {suc.sucursal}
                                        </td>
                                        {data.timeline.map(t => {
                                            const val = suc.meses[t.label] || 0
                                            return (
                                                <td key={t.label} className="py-2.5 px-3 text-right font-medium text-slate-300">
                                                    {val > 0 ? val.toLocaleString('es-CL') : '-'}
                                                </td>
                                            )
                                        })}
                                        <td className="py-2.5 px-3 text-right font-extrabold text-cyan-400">
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
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div>
                        <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                            <span>🏫</span> Detalle por Establecimiento (RBD)
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Raciones totales y desglose por servicio para los colegios evaluados.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <span className="absolute left-3 top-2.5 text-slate-500 text-xs">🔍</span>
                            <input
                                type="text"
                                placeholder="Buscar por RBD, nombre o sucursal..."
                                value={searchTableQuery}
                                onChange={(e) => setSearchTableQuery(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="py-3 px-3.5">RBD</th>
                                <th className="py-3 px-3.5">Establecimiento</th>
                                <th className="py-3 px-3.5">Sucursal</th>
                                <th className="py-3 px-3.5 text-right">Total Raciones</th>
                                <th className="py-3 px-3.5 text-right text-amber-400">Desayuno</th>
                                <th className="py-3 px-3.5 text-right text-emerald-400">Almuerzo</th>
                                <th className="py-3 px-3.5 text-right text-sky-400">Once</th>
                                <th className="py-3 px-3.5 text-right text-violet-400">Colación</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                            {filteredRanking.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-8 text-center text-slate-500">
                                        No se encontraron establecimientos con los criterios seleccionados.
                                    </td>
                                </tr>
                            ) : (
                                filteredRanking.slice(0, 30).map((r) => (
                                    <tr key={r.rbd} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="py-2.5 px-3.5 font-bold text-cyan-400">
                                            {r.rbd}
                                        </td>
                                        <td className="py-2.5 px-3.5 font-medium text-white max-w-xs truncate" title={r.nombre}>
                                            {r.nombre}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-slate-300">
                                            {r.sucursal}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right font-extrabold text-white">
                                            {r.totalRaciones.toLocaleString('es-CL')}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right font-semibold text-amber-300">
                                            {r.desayuno.toLocaleString('es-CL')}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right font-semibold text-emerald-300">
                                            {r.almuerzo.toLocaleString('es-CL')}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right font-semibold text-sky-300">
                                            {r.once.toLocaleString('es-CL')}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right font-semibold text-violet-300">
                                            {r.colacion.toLocaleString('es-CL')}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredRanking.length > 30 && (
                    <p className="text-[11px] text-slate-500 text-center">
                        Mostrando los primeros 30 de {filteredRanking.length} establecimientos. Exporta a CSV para visualizar el universo completo.
                    </p>
                )}
            </div>
        </div>
    )
}
