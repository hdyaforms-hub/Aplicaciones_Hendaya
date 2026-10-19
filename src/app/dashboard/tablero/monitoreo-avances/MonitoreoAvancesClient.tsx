'use client'

import React, { useState, useMemo, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
    MonitoreoAvancesResponse,
    ColaboradorCardData,
    SemaforoStatus,
    getMonitoreoAvancesData
} from './actions'

interface Props {
    data: MonitoreoAvancesResponse
}

export default function MonitoreoAvancesClient({ data: initialData }: Props) {
    const [currentData, setCurrentData] = useState<MonitoreoAvancesResponse>(initialData)
    const [isPending, startTransition] = useTransition()

    // Filtros de estado
    const [filterSemaforo, setFilterSemaforo] = useState<'TODOS' | SemaforoStatus>('TODOS')
    const [filterRole, setFilterRole] = useState<string>('TODOS')
    const [filterSucursal, setFilterSucursal] = useState<string>('TODOS')
    const [searchUserQuery, setSearchUserQuery] = useState<string>('')
    const [selectedMonthKey, setSelectedMonthKey] = useState<string>(
        `${initialData.mesActual}_${initialData.anioActual}`
    )
    const [viewMode, setViewMode] = useState<'CERAMICAS' | 'TABLA'>('CERAMICAS')
    const [selectedColaborador, setSelectedColaborador] = useState<ColaboradorCardData | null>(null)

    // Estados y refs para dropdowns personalizados de alto contraste (tema claro)
    const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false)
    const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false)
    const [isSucursalDropdownOpen, setIsSucursalDropdownOpen] = useState(false)
    const monthDropdownRef = useRef<HTMLDivElement>(null)
    const roleDropdownRef = useRef<HTMLDivElement>(null)
    const sucursalDropdownRef = useRef<HTMLDivElement>(null)

    // Cierre automático de dropdowns al hacer clic fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
                setIsMonthDropdownOpen(false)
            }
            if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
                setIsRoleDropdownOpen(false)
            }
            if (sucursalDropdownRef.current && !sucursalDropdownRef.current.contains(event.target as Node)) {
                setIsSucursalDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const currentSelectedMonth = useMemo(() => {
        return currentData.mesesDisponibles.find(m => `${m.mes}_${m.anio}` === selectedMonthKey)
    }, [currentData.mesesDisponibles, selectedMonthKey])

    // Manejar cambio de mes histórico
    const handleMonthChange = (monthKey: string) => {
        setSelectedMonthKey(monthKey)
        const [mesStr, anioStr] = monthKey.split('_')
        const mes = Number(mesStr)
        const anio = Number(anioStr)

        startTransition(async () => {
            const res = await getMonitoreoAvancesData(mes, anio)
            if (res.success) {
                setCurrentData(res)
            }
        })
    }

    // Filtrado interactivo de colaboradores
    const filteredColaboradores = useMemo(() => {
        return (currentData.colaboradores || []).filter((c) => {
            // 1. Filtro por semáforo
            if (filterSemaforo !== 'TODOS' && c.semaforoGlobal !== filterSemaforo) {
                return false
            }

            // 2. Filtro por rol seleccionado
            if (filterRole !== 'TODOS' && c.roleName !== filterRole) {
                return false
            }

            // 3. Filtro por sucursal
            if (filterSucursal !== 'TODOS') {
                const tieneSucursal = (c.sucursales || []).includes(filterSucursal)
                if (!tieneSucursal) return false
            }

            // 4. Filtro por nombre de usuario, nombre, email o RBD
            if (searchUserQuery.trim() !== '') {
                const q = searchUserQuery.toLowerCase().trim()
                const matchesUsername = c.username.toLowerCase().includes(q)
                const matchesName = c.name.toLowerCase().includes(q)
                const matchesEmail = c.email ? c.email.toLowerCase().includes(q) : false
                const matchesRbd = c.rbds.some(r => r.toString().includes(q))
                return matchesUsername || matchesName || matchesEmail || matchesRbd
            }

            return true
        })
    }, [currentData.colaboradores, filterSemaforo, filterRole, filterSucursal, searchUserQuery])

    // Exportar a CSV para Excel
    const handleExportCsv = () => {
        if (!filteredColaboradores.length) return

        const headers = ['Mes/Año', 'Nombre', 'Usuario', 'Rol', 'Sucursales', 'RBDs a Cargo', 'Estado Semáforo', '% Cumplimiento', 'Evaluaciones Detalle']
        const mesLabel = currentData.mesesDisponibles.find(m => `${m.mes}_${m.anio}` === selectedMonthKey)?.label || `${currentData.mesActual}/${currentData.anioActual}`

        const rows = filteredColaboradores.map(c => {
            const evalsText = c.evaluaciones.map(e => 
                `${e.nombre}: Llevan ${e.realizadas}/${e.totalRequerido} (Faltan ${e.faltantes}) - Tope: ${e.fechaTopeFormatted} [${e.semaforo}]`
            ).join(' | ')

            const sucursalesText = (c.sucursales || []).join(', ')

            return [
                `"${mesLabel}"`,
                `"${c.name}"`,
                `"${c.username}"`,
                `"${c.roleName}"`,
                `"${sucursalesText}"`,
                c.rbdsCount,
                c.semaforoGlobal,
                `${c.porcentajeGlobal}%`,
                `"${evalsText}"`
            ]
        })

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n')
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement('a')
        link.setAttribute('href', encodedUri)
        link.setAttribute('download', `monitoreo_avances_${selectedMonthKey}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    if (!currentData.isConfigured) {
        return (
            <div className="min-h-screen bg-slate-50 text-slate-800 p-6 flex flex-col items-center justify-center text-center">
                <div className="max-w-md p-8 bg-white border border-slate-200 rounded-3xl shadow-xl space-y-5">
                    <div className="w-16 h-16 mx-auto bg-sky-50 border border-sky-200 text-sky-600 rounded-2xl flex items-center justify-center text-3xl">
                        ⚙️
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Módulo de Monitoreo No Configurado</h2>
                    <p className="text-sm text-slate-500">
                        Aún no se han configurado las periodicidades de matrices o actas, o no se han marcado los roles a supervisar.
                    </p>
                    {currentData.canConfig && (
                        <Link
                            href="/dashboard/mantenedor/monitoreo"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white font-semibold rounded-xl text-sm shadow-md shadow-sky-600/20 transition-all"
                        >
                            <span>Ir a Mantenedor &gt; Monitoreo</span>
                            <span>→</span>
                        </Link>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50/70 text-slate-800 p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Header Ejecutivo Oficial Hendaya */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 md:p-8 rounded-3xl text-white shadow-xl border border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-black tracking-wider text-sky-400 bg-sky-950/80 px-3 py-1 rounded-xl border border-sky-500/30 shadow-inner">
                            HENDAYA
                        </span>
                        <span className="text-xs uppercase font-bold text-sky-300 tracking-widest bg-sky-900/60 px-2.5 py-1 rounded-lg">
                            Tableros & Avances
                        </span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                        <span>🚦</span> Monitoreo de Avances
                        {isPending && (
                            <span className="text-xs font-normal text-sky-300 animate-pulse bg-sky-950/60 px-2.5 py-0.5 rounded-full border border-sky-500/30">
                                Cargando período...
                            </span>
                        )}
                    </h1>
                    <p className="text-slate-300 text-sm mt-1 max-w-2xl">
                        Supervisión y control visual del estado de avance de matrices de riesgo y actas de supervisión con alertas semafóricas e histórico mensual.
                    </p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {/* Conmutador de Vistas */}
                    <div className="flex items-center bg-white/10 backdrop-blur-md border border-white/15 p-1 rounded-xl shadow-inner">
                        <button
                            onClick={() => setViewMode('CERAMICAS')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                viewMode === 'CERAMICAS'
                                    ? 'bg-sky-500 text-white shadow'
                                    : 'text-slate-300 hover:text-white'
                            }`}
                        >
                            <span>🔲</span>
                            <span>Cerámicas</span>
                        </button>
                        <button
                            onClick={() => setViewMode('TABLA')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                viewMode === 'TABLA'
                                    ? 'bg-sky-500 text-white shadow'
                                    : 'text-slate-300 hover:text-white'
                            }`}
                        >
                            <span>📑</span>
                            <span>Tabla</span>
                        </button>
                    </div>

                    <button
                        onClick={handleExportCsv}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition shadow-sm"
                        title="Exportar datos del período a archivo Excel CSV"
                    >
                        <span>📥</span>
                        <span>Exportar Excel</span>
                    </button>

                    {currentData.canConfig && (
                        <Link
                            href="/dashboard/mantenedor/monitoreo"
                            className="px-4 py-2 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-xs font-semibold rounded-xl flex items-center gap-2 transition shadow-sm"
                        >
                            <span>⚙️</span>
                            <span>Configurar</span>
                        </Link>
                    )}
                </div>
            </div>

            {/* Fila de Tarjetas KPIs Ejecutivas (Tema Claro) */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                {/* Total Colaboradores */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                        <span>Monitoreados</span>
                        <span className="p-1 bg-slate-100 rounded-lg text-slate-700">👥</span>
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
                        {currentData.kpis.totalColaboradores}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Colaboradores evaluados</div>
                </div>

                {/* Al Día (Verde) */}
                <div 
                    onClick={() => setFilterSemaforo(filterSemaforo === 'VERDE' ? 'TODOS' : 'VERDE')}
                    className={`cursor-pointer bg-white border rounded-2xl p-4 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] ${
                        filterSemaforo === 'VERDE' ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/50' : 'border-slate-200/90 hover:border-emerald-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Al Día
                        </span>
                        <span className="p-1 bg-emerald-100/70 rounded-lg text-emerald-700">🟢</span>
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-600">
                        {currentData.kpis.totalAlDia}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                        {currentData.kpis.totalColaboradores > 0 ? Math.round((currentData.kpis.totalAlDia / currentData.kpis.totalColaboradores) * 100) : 0}% al día
                    </div>
                </div>

                {/* Atraso Leve (Amarillo) */}
                <div 
                    onClick={() => setFilterSemaforo(filterSemaforo === 'AMARILLO' ? 'TODOS' : 'AMARILLO')}
                    className={`cursor-pointer bg-white border rounded-2xl p-4 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] ${
                        filterSemaforo === 'AMARILLO' ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/50' : 'border-slate-200/90 hover:border-amber-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-amber-700 text-xs font-semibold">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            Atraso Leve
                        </span>
                        <span className="p-1 bg-amber-100/70 rounded-lg text-amber-700">🟡</span>
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-600">
                        {currentData.kpis.totalAtrasoLeve}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                        {currentData.kpis.totalColaboradores > 0 ? Math.round((currentData.kpis.totalAtrasoLeve / currentData.kpis.totalColaboradores) * 100) : 0}% en riesgo
                    </div>
                </div>

                {/* Atraso Grave (Rojo) */}
                <div 
                    onClick={() => setFilterSemaforo(filterSemaforo === 'ROJO' ? 'TODOS' : 'ROJO')}
                    className={`cursor-pointer bg-white border rounded-2xl p-4 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] ${
                        filterSemaforo === 'ROJO' ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/50' : 'border-slate-200/90 hover:border-rose-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-rose-700 text-xs font-semibold">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                            Atraso Grave
                        </span>
                        <span className="p-1 bg-rose-100/70 rounded-lg text-rose-700">🔴</span>
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-rose-600">
                        {currentData.kpis.totalAtrasoGrave}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Vencidos o críticos</div>
                </div>

                {/* Cumplimiento Global */}
                <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-sky-700 text-xs font-semibold">
                        <span>Cumplimiento Período</span>
                        <span className="p-1 bg-sky-100/70 rounded-lg text-sky-700">📈</span>
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-sky-700">
                        {currentData.kpis.cumplimientoGlobalPorcentaje}%
                    </div>
                    {/* Barra de progreso global */}
                    <div className="w-full bg-slate-100 h-2 rounded-full mt-1.5 overflow-hidden">
                        <div 
                            className="bg-gradient-to-r from-sky-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${currentData.kpis.cumplimientoGlobalPorcentaje}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* BARRA DE FILTROS PRINCIPALES (Mes, Rol, Sucursal, Búsqueda, Semáforo) */}
            <div className="relative z-30 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 relative">
                    {/* 1. FILTRO DE MES HISTÓRICO */}
                    <div className={`space-y-1 relative ${isMonthDropdownOpen ? 'z-50' : 'z-20'}`} ref={monthDropdownRef}>
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <span>📅</span>
                                <span>Mes / Período</span>
                            </span>
                            {isPending && (
                                <span className="text-[10px] text-sky-600 font-semibold animate-pulse">
                                    Cargando...
                                </span>
                            )}
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMonthDropdownOpen(!isMonthDropdownOpen)
                                    setIsRoleDropdownOpen(false)
                                    setIsSucursalDropdownOpen(false)
                                }}
                                disabled={isPending}
                                className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-sky-400 focus:border-sky-500 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-left transition shadow-sm group disabled:opacity-60"
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="text-sky-600 text-sm">🗓️</span>
                                    <span className="text-xs font-bold text-slate-800 tracking-wide truncate">
                                        {currentSelectedMonth?.label || 'Seleccionar Período'}
                                    </span>
                                    {currentSelectedMonth?.mes === currentData.mesActual && currentSelectedMonth?.anio === currentData.anioActual && (
                                        <span className="hidden sm:inline-block text-[10px] bg-sky-100 text-sky-700 border border-sky-300 px-2 py-0.5 rounded-full font-semibold">
                                            Actual
                                        </span>
                                    )}
                                </div>
                                <svg
                                    className={`w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-transform duration-200 shrink-0 ml-2 ${
                                        isMonthDropdownOpen ? 'rotate-180 text-sky-600' : ''
                                    }`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isMonthDropdownOpen && (
                                <div className="absolute left-0 right-0 mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 max-h-64 overflow-y-auto divide-y divide-slate-100 ring-1 ring-black/5">
                                    <div className="px-3.5 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                                        Períodos Históricos (12 Meses)
                                    </div>
                                    <div className="py-1">
                                        {currentData.mesesDisponibles.map((m) => {
                                            const isSelected = `${m.mes}_${m.anio}` === selectedMonthKey
                                            const isActual = m.mes === currentData.mesActual && m.anio === currentData.anioActual
                                            return (
                                                <button
                                                    key={`${m.mes}_${m.anio}`}
                                                    type="button"
                                                    onClick={() => {
                                                        handleMonthChange(`${m.mes}_${m.anio}`)
                                                        setIsMonthDropdownOpen(false)
                                                    }}
                                                    className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors flex items-center justify-between ${
                                                        isSelected
                                                            ? 'bg-sky-50 text-sky-900 font-bold border-l-4 border-sky-600'
                                                            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium'
                                                    }`}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <span>{m.label}</span>
                                                        {isActual && (
                                                            <span className="text-[10px] bg-sky-100 text-sky-700 border border-sky-300 px-1.5 py-0.2 rounded font-semibold">
                                                                Actual
                                                            </span>
                                                        )}
                                                    </span>
                                                    {isSelected && (
                                                        <span className="text-sky-600 font-extrabold text-sm">✓</span>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. FILTRO DE ROLES SELECCIONADOS */}
                    <div className={`space-y-1 relative ${isRoleDropdownOpen ? 'z-50' : 'z-20'}`} ref={roleDropdownRef}>
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <span>👥</span>
                                <span>Rol Monitoreado</span>
                            </span>
                            {filterRole !== 'TODOS' && (
                                <button
                                    type="button"
                                    onClick={() => setFilterRole('TODOS')}
                                    className="text-[10px] text-sky-600 hover:text-sky-700 underline font-semibold"
                                >
                                    Ver todos
                                </button>
                            )}
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsRoleDropdownOpen(!isRoleDropdownOpen)
                                    setIsMonthDropdownOpen(false)
                                    setIsSucursalDropdownOpen(false)
                                }}
                                className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-sky-400 focus:border-sky-500 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-left transition shadow-sm group"
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="text-sky-600 text-sm">🛡️</span>
                                    <span className="text-xs font-bold text-slate-800 tracking-wide truncate">
                                        {filterRole === 'TODOS'
                                            ? `Todos los Roles (${currentData.rolesDisponibles.length})`
                                            : `Rol: ${filterRole}`}
                                    </span>
                                </div>
                                <svg
                                    className={`w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-transform duration-200 shrink-0 ml-2 ${
                                        isRoleDropdownOpen ? 'rotate-180 text-sky-600' : ''
                                    }`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isRoleDropdownOpen && (
                                <div className="absolute left-0 right-0 mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 max-h-64 overflow-y-auto divide-y divide-slate-100 ring-1 ring-black/5">
                                    <div className="px-3.5 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 flex items-center justify-between">
                                        <span>Roles Configurados</span>
                                        <span className="text-[10px] text-sky-600 font-mono font-bold">{currentData.rolesDisponibles.length} roles</span>
                                    </div>
                                    <div className="py-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilterRole('TODOS')
                                                setIsRoleDropdownOpen(false)
                                            }}
                                            className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors flex items-center justify-between ${
                                                filterRole === 'TODOS'
                                                    ? 'bg-sky-50 text-sky-900 font-bold border-l-4 border-sky-600'
                                                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium'
                                            }`}
                                        >
                                            <span>Todos los Roles Seleccionados ({currentData.rolesDisponibles.length})</span>
                                            {filterRole === 'TODOS' && (
                                                <span className="text-sky-600 font-extrabold text-sm">✓</span>
                                            )}
                                        </button>

                                        {currentData.rolesDisponibles.map((r) => {
                                            const isSelected = filterRole === r
                                            return (
                                                <button
                                                    key={r}
                                                    type="button"
                                                    onClick={() => {
                                                        setFilterRole(r)
                                                        setIsRoleDropdownOpen(false)
                                                    }}
                                                    className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors flex items-center justify-between ${
                                                        isSelected
                                                            ? 'bg-sky-50 text-sky-900 font-bold border-l-4 border-sky-600'
                                                            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium'
                                                    }`}
                                                >
                                                    <span className="truncate pr-2">Rol: {r}</span>
                                                    {isSelected && (
                                                        <span className="text-sky-600 font-extrabold text-sm">✓</span>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. NUEVO FILTRO DE SUCURSAL */}
                    <div className={`space-y-1 relative ${isSucursalDropdownOpen ? 'z-50' : 'z-20'}`} ref={sucursalDropdownRef}>
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <span>📍</span>
                                <span>Sucursal</span>
                            </span>
                            {filterSucursal !== 'TODOS' && (
                                <button
                                    type="button"
                                    onClick={() => setFilterSucursal('TODOS')}
                                    className="text-[10px] text-sky-600 hover:text-sky-700 underline font-semibold"
                                >
                                    Ver todas
                                </button>
                            )}
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsSucursalDropdownOpen(!isSucursalDropdownOpen)
                                    setIsMonthDropdownOpen(false)
                                    setIsRoleDropdownOpen(false)
                                }}
                                className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-sky-400 focus:border-sky-500 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-left transition shadow-sm group"
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="text-sky-600 text-sm">🏢</span>
                                    <span className="text-xs font-bold text-slate-800 tracking-wide truncate">
                                        {filterSucursal === 'TODOS'
                                            ? `Todas las Sucursales (${currentData.sucursalesDisponibles?.length || 0})`
                                            : `Sucursal: ${filterSucursal}`}
                                    </span>
                                </div>
                                <svg
                                    className={`w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-transform duration-200 shrink-0 ml-2 ${
                                        isSucursalDropdownOpen ? 'rotate-180 text-sky-600' : ''
                                    }`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isSucursalDropdownOpen && (
                                <div className="absolute left-0 right-0 mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 max-h-64 overflow-y-auto divide-y divide-slate-100 ring-1 ring-black/5">
                                    <div className="px-3.5 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 flex items-center justify-between">
                                        <span>Sucursales</span>
                                        <span className="text-[10px] text-sky-600 font-mono font-bold">{currentData.sucursalesDisponibles?.length || 0} disponibles</span>
                                    </div>
                                    <div className="py-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilterSucursal('TODOS')
                                                setIsSucursalDropdownOpen(false)
                                            }}
                                            className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors flex items-center justify-between ${
                                                filterSucursal === 'TODOS'
                                                    ? 'bg-sky-50 text-sky-900 font-bold border-l-4 border-sky-600'
                                                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium'
                                            }`}
                                        >
                                            <span>Todas las Sucursales ({currentData.sucursalesDisponibles?.length || 0})</span>
                                            {filterSucursal === 'TODOS' && (
                                                <span className="text-sky-600 font-extrabold text-sm">✓</span>
                                            )}
                                        </button>

                                        {(currentData.sucursalesDisponibles || []).map((suc) => {
                                            const isSelected = filterSucursal === suc
                                            return (
                                                <button
                                                    key={suc}
                                                    type="button"
                                                    onClick={() => {
                                                        setFilterSucursal(suc)
                                                        setIsSucursalDropdownOpen(false)
                                                    }}
                                                    className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors flex items-center justify-between ${
                                                        isSelected
                                                            ? 'bg-sky-50 text-sky-900 font-bold border-l-4 border-sky-600'
                                                            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium'
                                                    }`}
                                                >
                                                    <span className="truncate pr-2">Sucursal: {suc}</span>
                                                    {isSelected && (
                                                        <span className="text-sky-600 font-extrabold text-sm">✓</span>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 4. FILTRO POR NOMBRE DE USUARIO / COLABORADOR */}
                    <div className="space-y-1 relative z-10">
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <span>👤</span>
                                <span>Nombre o Usuario</span>
                            </span>
                            {searchUserQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchUserQuery('')}
                                    className="text-[10px] text-sky-600 hover:text-sky-700 underline font-semibold"
                                >
                                    Limpiar
                                </button>
                            )}
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar @usuario, nombre o RBD..."
                                value={searchUserQuery}
                                onChange={(e) => setSearchUserQuery(e.target.value)}
                                className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-xs font-bold text-slate-900 placeholder-slate-400 rounded-xl pl-9 pr-8 py-2.5 transition shadow-sm outline-none"
                                style={{ color: '#0f172a' }}
                            />
                            <span className="absolute left-3 top-2.5 text-sky-600 text-xs">🔍</span>
                            {searchUserQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchUserQuery('')}
                                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 p-1 text-xs"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* FILTRO RÁPIDO POR SEMÁFORO (PILLS) */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-slate-500 font-bold mr-1">Semáforo:</span>
                        <button
                            onClick={() => setFilterSemaforo('TODOS')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                                filterSemaforo === 'TODOS'
                                    ? 'bg-sky-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Todos ({currentData.kpis.totalColaboradores})
                        </button>
                        <button
                            onClick={() => setFilterSemaforo('VERDE')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                                filterSemaforo === 'VERDE'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/70'
                            }`}
                        >
                            <span>🟢</span>
                            <span>Al Día ({currentData.kpis.totalAlDia})</span>
                        </button>
                        <button
                            onClick={() => setFilterSemaforo('AMARILLO')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                                filterSemaforo === 'AMARILLO'
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100/70'
                            }`}
                        >
                            <span>🟡</span>
                            <span>Atraso Leve ({currentData.kpis.totalAtrasoLeve})</span>
                        </button>
                        <button
                            onClick={() => setFilterSemaforo('ROJO')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                                filterSemaforo === 'ROJO'
                                    ? 'bg-rose-600 text-white shadow-sm'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100/70'
                            }`}
                        >
                            <span>🔴</span>
                            <span>Atraso Grave ({currentData.kpis.totalAtrasoGrave})</span>
                        </button>
                    </div>

                    <div className="text-xs text-slate-500 font-medium">
                        Mostrando <strong className="text-sky-700 font-bold">{filteredColaboradores.length}</strong> de {currentData.colaboradores.length} colaboradores
                    </div>
                </div>
            </div>

            {/* RENDERIZADO PRINCIPAL: CERÁMICAS O TABLA */}
            {filteredColaboradores.length === 0 ? (
                <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-3xl space-y-2 shadow-sm">
                    <span className="text-3xl">🔎</span>
                    <h3 className="text-base font-bold text-slate-800">No se encontraron colaboradores con los filtros seleccionados</h3>
                    <p className="text-xs text-slate-500">Prueba cambiando el rol, la sucursal, el mes o limpiando la búsqueda.</p>
                </div>
            ) : viewMode === 'CERAMICAS' ? (
                /* GRID DE CERÁMICAS SEMAFÓRICAS (Tema Claro) */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 relative z-0">
                    {filteredColaboradores.map((colab) => {
                        const isVerde = colab.semaforoGlobal === 'VERDE'
                        const isAmarillo = colab.semaforoGlobal === 'AMARILLO'

                        const borderClass = isVerde 
                            ? 'border-emerald-200/90 hover:border-emerald-400'
                            : isAmarillo
                            ? 'border-amber-200/90 hover:border-amber-400'
                            : 'border-rose-200/90 hover:border-rose-400'

                        const badgeStatusClass = isVerde
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isAmarillo
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'

                        const badgeText = isVerde ? '🟢 Al Día' : isAmarillo ? '🟡 Atraso Leve' : '🔴 Atraso Grave'

                        return (
                            <div
                                key={colab.userId}
                                onClick={() => setSelectedColaborador(colab)}
                                className={`cursor-pointer group relative bg-white border rounded-3xl p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.01] ${borderClass}`}
                            >
                                {/* Barra indicadora luminosa superior */}
                                <div 
                                    className={`absolute top-0 left-6 right-6 h-1.5 rounded-b-full transition-all ${
                                        isVerde ? 'bg-emerald-500' : isAmarillo ? 'bg-amber-400' : 'bg-rose-500'
                                    }`}
                                />

                                {/* Cabecera de la Cerámica */}
                                <div className="flex items-start justify-between gap-3 pt-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100 border border-sky-200 text-sky-800 font-extrabold flex items-center justify-center text-sm shadow-inner shrink-0">
                                            {colab.name ? colab.name.slice(0, 2).toUpperCase() : 'US'}
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-slate-900 text-base leading-snug group-hover:text-sky-700 transition-colors">
                                                {colab.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                <span className="text-xs font-mono text-sky-600 font-semibold">
                                                    @{colab.username}
                                                </span>
                                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-medium">
                                                    {colab.roleName}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Badge Semáforo */}
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${badgeStatusClass}`}>
                                        {badgeText}
                                    </span>
                                </div>

                                {/* Barra de Información de Sucursales y Colegios */}
                                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-1.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="flex items-center gap-1 font-medium">
                                            <span>🏫</span>
                                            <span><strong>{colab.rbdsCount}</strong> colegios asignados</span>
                                        </span>
                                        {colab.sucursales && colab.sucursales.length > 0 && (
                                            <span className="text-[11px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                                                📍 {colab.sucursales.join(', ')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="font-extrabold text-sky-700">
                                        {colab.porcentajeGlobal}% avance
                                    </div>
                                </div>

                                {/* Lista de Evaluaciones Monitoreadas */}
                                <div className="mt-3 space-y-2.5">
                                    {colab.evaluaciones.length === 0 ? (
                                        <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                                            No hay pautas asignadas para el rol {colab.roleName}
                                        </div>
                                    ) : (
                                        colab.evaluaciones.map((ev, idx) => {
                                            const evIsVerde = ev.semaforo === 'VERDE'
                                            const evIsAmarillo = ev.semaforo === 'AMARILLO'
                                            const barColor = evIsVerde
                                                ? 'bg-emerald-500'
                                                : evIsAmarillo
                                                ? 'bg-amber-400'
                                                : 'bg-rose-500'

                                            return (
                                                <div key={idx} className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="font-bold text-slate-800 truncate max-w-[210px]" title={ev.nombre}>
                                                            {ev.tipo === 'MATRIZ' ? '🛡️' : '📜'} {ev.nombre}
                                                        </span>
                                                        <span className="text-[11px] font-mono text-slate-500 font-medium">
                                                            {ev.periodicidadLabel}
                                                        </span>
                                                    </div>

                                                    {/* Barra de progreso */}
                                                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                                            style={{ width: `${ev.porcentaje}%` }}
                                                        />
                                                    </div>

                                                    {/* Detalle de cantidades y fecha tope */}
                                                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                                                        <div>
                                                            Llevan: <strong className="text-slate-900">{ev.realizadas}</strong> / {ev.totalRequerido}{' '}
                                                            {ev.faltantes > 0 ? (
                                                                <span className="text-rose-600 font-bold">(Faltan: {ev.faltantes})</span>
                                                            ) : (
                                                                <span className="text-emerald-600 font-bold">(Completo)</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 text-slate-600 font-medium">
                                                            <span>Tope:</span>
                                                            <span className={ev.semaforo === 'ROJO' ? 'text-rose-600 font-bold' : ''}>
                                                                {ev.fechaTopeFormatted}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>

                                {/* Footer con botón para ver desglose */}
                                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 group-hover:text-sky-600 font-medium transition-colors">
                                    <span>Haz clic para ver colegios</span>
                                    <span>Ver desglose →</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                /* VISTA TABLA EJECUTIVA (Tema Claro) */
                <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-sm relative z-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-xs uppercase bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="py-3.5 px-4">Semáforo</th>
                                    <th className="py-3.5 px-4">Colaborador</th>
                                    <th className="py-3.5 px-4">Rol</th>
                                    <th className="py-3.5 px-4">Sucursal</th>
                                    <th className="py-3.5 px-4 text-center">Colegios (RBD)</th>
                                    <th className="py-3.5 px-4">Avance Pautas</th>
                                    <th className="py-3.5 px-4 text-center">Cumplimiento</th>
                                    <th className="py-3.5 px-4 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredColaboradores.map((colab) => {
                                    const isVerde = colab.semaforoGlobal === 'VERDE'
                                    const isAmarillo = colab.semaforoGlobal === 'AMARILLO'
                                    const badgeClass = isVerde
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : isAmarillo
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-rose-50 text-rose-700 border-rose-200'

                                    return (
                                        <tr key={colab.userId} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badgeClass}`}>
                                                    {isVerde ? '🟢 Al Día' : isAmarillo ? '🟡 Atraso Leve' : '🔴 Atraso Grave'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="font-bold text-slate-900">{colab.name}</div>
                                                <div className="text-xs text-sky-600 font-mono">@{colab.username}</div>
                                            </td>
                                            <td className="py-3.5 px-4 text-xs text-slate-700">
                                                <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-medium">
                                                    {colab.roleName}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-xs text-slate-600">
                                                {colab.sucursales && colab.sucursales.length > 0 
                                                    ? colab.sucursales.join(', ')
                                                    : '-'}
                                            </td>
                                            <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-800 font-bold">
                                                {colab.rbdsCount}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="space-y-1.5 max-w-xs">
                                                    {colab.evaluaciones.map((ev, i) => (
                                                        <div key={i} className="text-xs flex items-center justify-between gap-2">
                                                            <span className="truncate text-slate-700 font-medium" title={ev.nombre}>
                                                                {ev.nombre}
                                                            </span>
                                                            <span className="font-mono text-slate-500 text-[11px] whitespace-nowrap font-bold">
                                                                {ev.realizadas}/{ev.totalRequerido} ({ev.porcentaje}%)
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <span className="text-sm font-extrabold text-sky-700">
                                                    {colab.porcentajeGlobal}%
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <button
                                                    onClick={() => setSelectedColaborador(colab)}
                                                    className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-xs font-bold rounded-lg transition"
                                                >
                                                    Ver Desglose
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL / DRAWER DE DESGLOSE POR COLEGIO (Tema Claro) */}
            {selectedColaborador && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Cabecera Modal */}
                        <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50">
                            <div>
                                <span className="text-xs font-bold text-sky-700 uppercase tracking-widest">
                                    Desglose de Cumplimiento por Colegio
                                </span>
                                <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
                                    {selectedColaborador.name}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    <span className="text-sky-700 font-mono font-bold">@{selectedColaborador.username}</span> • {selectedColaborador.roleName} • {selectedColaborador.rbdsCount} colegios asignados
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedColaborador(null)}
                                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-sm font-bold transition"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Contenido Scrolleable */}
                        <div className="p-6 overflow-y-auto space-y-4 flex-1">
                            {selectedColaborador.colegiosDetalle.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    No hay colegios asignados o dentro de tu alcance para este colaborador.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {selectedColaborador.colegiosDetalle.map((col) => {
                                        const totalPautas = col.evaluaciones.length
                                        const realizadas = col.evaluaciones.filter(e => e.completado).length
                                        const todasCompletas = totalPautas > 0 && realizadas === totalPautas

                                        return (
                                            <div
                                                key={col.rbd}
                                                className={`p-4 rounded-2xl border transition ${
                                                    todasCompletas
                                                        ? 'bg-slate-50/60 border-slate-200'
                                                        : 'bg-rose-50/30 border-rose-200'
                                                }`}
                                            >
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-xs px-2 py-0.5 bg-sky-100 text-sky-800 rounded-md font-bold border border-sky-200">
                                                                RBD {col.rbd}
                                                            </span>
                                                            <h4 className="font-bold text-slate-900 text-sm">
                                                                {col.nombreEstablecimiento}
                                                            </h4>
                                                        </div>
                                                        <div className="text-xs text-slate-500 mt-0.5">
                                                            {col.comuna ? `Comuna: ${col.comuna}` : ''} {col.sucursal ? `• Sucursal: ${col.sucursal}` : ''}
                                                        </div>
                                                    </div>

                                                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                                                        todasCompletas
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}>
                                                        {realizadas}/{totalPautas} Evaluadas
                                                    </span>
                                                </div>

                                                {/* Detalle por pauta en este colegio */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3">
                                                    {col.evaluaciones.map((ev, i) => (
                                                        <div
                                                            key={i}
                                                            className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 border ${
                                                                ev.completado
                                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                                                    : 'bg-white border-slate-200 text-slate-700'
                                                                }`}
                                                        >
                                                            <div className="truncate">
                                                                <span className="mr-1">{ev.tipo === 'MATRIZ' ? '🛡️' : '📜'}</span>
                                                                <span className="font-bold text-slate-900">{ev.nombrePauta}</span>
                                                            </div>
                                                            <div className="whitespace-nowrap font-mono text-[11px]">
                                                                {ev.completado ? (
                                                                    <span className="text-emerald-700 font-bold">✓ {ev.fechaRealizacion}</span>
                                                                ) : (
                                                                    <span className="text-rose-600 font-bold">Pendiente</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer Modal */}
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setSelectedColaborador(null)}
                                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition"
                            >
                                Cerrar Ventana
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
