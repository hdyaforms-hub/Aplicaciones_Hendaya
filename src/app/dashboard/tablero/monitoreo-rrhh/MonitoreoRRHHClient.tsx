'use client'

import React, { useState, useMemo, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
    MonitoreoRRHHTableroResponse,
    ColaboradorRRHHCardData,
    SemaforoStatus,
    getMonitoreoRRHHTableroData
} from './actions'

interface Props {
    initialData: MonitoreoRRHHTableroResponse
}

export default function MonitoreoRRHHClient({ initialData }: Props) {
    const [currentData, setCurrentData] = useState<MonitoreoRRHHTableroResponse>(initialData)
    const [isPending, startTransition] = useTransition()

    // Filtros de estado
    const [filterSemaforo, setFilterSemaforo] = useState<'TODOS' | SemaforoStatus>('TODOS')
    const [filterRole, setFilterRole] = useState<string>('TODOS')
    const [filterSucursal, setFilterSucursal] = useState<string>('TODOS')
    const [searchUserQuery, setSearchUserQuery] = useState<string>('')
    const [viewMode, setViewMode] = useState<'CERAMICAS' | 'TABLA'>('CERAMICAS')
    const [selectedColaborador, setSelectedColaborador] = useState<ColaboradorRRHHCardData | null>(null)
    const [modalSearchQuery, setModalSearchQuery] = useState<string>('')

    // Dropdowns personalizados
    const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false)
    const [isSucursalDropdownOpen, setIsSucursalDropdownOpen] = useState(false)
    const roleDropdownRef = useRef<HTMLDivElement>(null)
    const sucursalDropdownRef = useRef<HTMLDivElement>(null)

    // Cierre al hacer clic fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
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

    // Recargar datos en vivo
    const handleRefresh = () => {
        startTransition(async () => {
            const res = await getMonitoreoRRHHTableroData()
            if (res.success) {
                setCurrentData(res)
            }
        })
    }

    // Filtrado de colaboradores
    const filteredColaboradores = useMemo(() => {
        return (currentData.colaboradores || []).filter((c) => {
            if (filterSemaforo !== 'TODOS' && c.semaforoGlobal !== filterSemaforo) {
                return false
            }
            if (filterRole !== 'TODOS' && c.roleName !== filterRole) {
                return false
            }
            if (filterSucursal !== 'TODOS') {
                const tieneSucursal = (c.sucursales || []).includes(filterSucursal)
                if (!tieneSucursal) return false
            }
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

    // Exportar datos a CSV para Excel
    const handleExportCsv = () => {
        if (!filteredColaboradores.length) return

        const headers = [
            'Colaborador',
            'Usuario',
            'Rol',
            'Sucursales',
            'Colegios Asignados',
            'Semáforo',
            '% Cumplimiento Abierto',
            'Total Registros Abiertos',
            'Gestionados',
            'Pendientes',
            'Ausentismo (Gest/Total)',
            'Horas Extras (Gest/Total - Aplica/NoAplica)',
            'Atrasos (Gest/Total - AplicaDesc/NoAplica)',
            'Adelantos (Gest/Total - AplicaDesc/NoAplica)'
        ]

        const rows = filteredColaboradores.map(c => {
            const modAus = c.modulos.find(m => m.tipo === 'AUSENTISMO')
            const modHhee = c.modulos.find(m => m.tipo === 'HORAS_EXTRAS')
            const modAtr = c.modulos.find(m => m.tipo === 'ATRASOS')
            const modAde = c.modulos.find(m => m.tipo === 'ADELANTOS')

            const ausText = `${modAus?.gestionados || 0}/${modAus?.totalAbiertos || 0}`
            const hheeText = `${modHhee?.gestionados || 0}/${modHhee?.totalAbiertos || 0} (Aplica: ${modHhee?.aplicaCount || 0}, No: ${modHhee?.noAplicaCount || 0})`
            const atrText = `${modAtr?.gestionados || 0}/${modAtr?.totalAbiertos || 0} (Desc: ${modAtr?.aplicaCount || 0}, No: ${modAtr?.noAplicaCount || 0})`
            const adeText = `${modAde?.gestionados || 0}/${modAde?.totalAbiertos || 0} (Desc: ${modAde?.aplicaCount || 0}, No: ${modAde?.noAplicaCount || 0})`

            return [
                `"${c.name}"`,
                `"${c.username}"`,
                `"${c.roleName}"`,
                `"${(c.sucursales || []).join(', ')}"`,
                c.rbdsCount,
                c.semaforoGlobal,
                `${c.porcentajeGlobal}%`,
                c.totalRegistrosAbiertos,
                c.totalGestionados,
                c.totalPendientes,
                `"${ausText}"`,
                `"${hheeText}"`,
                `"${atrText}"`,
                `"${adeText}"`
            ]
        })

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n')
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement('a')
        link.setAttribute('href', encodedUri)
        link.setAttribute('download', `monitoreo_rrhh_${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // Modal Colegios filtrados
    const modalFilteredColegios = useMemo(() => {
        if (!selectedColaborador) return []
        if (!modalSearchQuery.trim()) return selectedColaborador.colegiosDetalle
        const q = modalSearchQuery.toLowerCase().trim()
        return selectedColaborador.colegiosDetalle.filter(col => {
            const matchRbd = col.rbd.toString().includes(q)
            const matchName = col.nombreEstablecimiento.toLowerCase().includes(q)
            const matchComuna = col.comuna ? col.comuna.toLowerCase().includes(q) : false
            const matchSucursal = col.sucursal ? col.sucursal.toLowerCase().includes(q) : false
            return matchRbd || matchName || matchComuna || matchSucursal
        })
    }, [selectedColaborador, modalSearchQuery])

    // Pantalla de error si la consulta falló
    if (!currentData.success) {
        return (
            <div className="min-h-screen bg-slate-50 text-slate-800 p-6 flex flex-col items-center justify-center text-center">
                <div className="max-w-md p-8 bg-white border border-rose-200 rounded-3xl shadow-xl space-y-5">
                    <div className="w-16 h-16 mx-auto bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center text-3xl">
                        ⚠️
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Error al Cargar Monitoreo</h2>
                    <p className="text-sm text-slate-500">
                        {currentData.error || 'Ocurrió un error al procesar las métricas de monitoreo de RRHH.'}
                    </p>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-sm transition-all"
                    >
                        <span>🔄</span>
                        <span>Reintentar</span>
                    </button>
                </div>
            </div>
        )
    }

    // Pantalla si no está configurado ningún rol
    if (!currentData.isConfigured) {
        return (
            <div className="min-h-screen bg-slate-50 text-slate-800 p-6 flex flex-col items-center justify-center text-center">
                <div className="max-w-md p-8 bg-white border border-slate-200 rounded-3xl shadow-xl space-y-5">
                    <div className="w-16 h-16 mx-auto bg-cyan-50 border border-cyan-200 text-cyan-600 rounded-2xl flex items-center justify-center text-3xl">
                        ⚙️
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Monitoreo RRHH No Configurado</h2>
                    <p className="text-sm text-slate-500">
                        Aún no se han seleccionado los roles que serán sujetos al control operativo de Recursos Humanos.
                    </p>
                    {currentData.canConfig ? (
                        <Link
                            href="/dashboard/mantenedor/personal/monitoreo"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white font-semibold rounded-xl text-sm shadow-md shadow-sky-600/20 transition-all"
                        >
                            <span>Configurar Roles Monitoreados</span>
                            <span>→</span>
                        </Link>
                    ) : (
                        <p className="text-xs text-slate-400">
                            Comuníquese con un administrador o usuario con permisos para configurar los roles.
                        </p>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50/60 text-slate-800 p-4 sm:p-6 lg:p-8 space-y-6">
            {/* CABECERA PRINCIPAL TIPO HENDAYA */}
            <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-sky-900/30 flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
                <div className="relative z-10 space-y-2">
                    <div className="flex items-center gap-2.5">
                        <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 rounded-full text-xs font-bold tracking-wide uppercase">
                            Control Operativo RRHH
                        </span>
                        <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-xs font-semibold">
                            Solo Estado Abierto
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                        <span>Tablero Monitoreo RRHH</span>
                    </h1>
                    <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
                        Control de avance en tiempo real por colaborador y colegio en los módulos de <strong className="text-cyan-300">Ausentismo</strong>, <strong className="text-cyan-300">Horas Extras</strong>, <strong className="text-cyan-300">Atrasos</strong> y <strong className="text-cyan-300">Adelantos</strong>.
                    </p>
                </div>

                {/* Botones de Cabecera */}
                <div className="relative z-10 flex items-center flex-wrap gap-2.5">
                    {/* Switcher Cerámicas / Tabla */}
                    <div className="bg-slate-800/90 border border-slate-700/80 p-1 rounded-xl flex items-center shadow-inner">
                        <button
                            type="button"
                            onClick={() => setViewMode('CERAMICAS')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                viewMode === 'CERAMICAS'
                                    ? 'bg-gradient-to-r from-sky-600 to-cyan-600 text-white shadow'
                                    : 'text-slate-300 hover:text-white'
                            }`}
                        >
                            <span>🔲</span>
                            <span>Cerámicas</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('TABLA')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                viewMode === 'TABLA'
                                    ? 'bg-gradient-to-r from-sky-600 to-cyan-600 text-white shadow'
                                    : 'text-slate-300 hover:text-white'
                            }`}
                        >
                            <span>📑</span>
                            <span>Tabla</span>
                        </button>
                    </div>

                    {/* Actualizar en vivo */}
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isPending}
                        className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm disabled:opacity-60"
                        title="Actualizar datos del tablero"
                    >
                        <span className={isPending ? 'animate-spin' : ''}>🔄</span>
                        <span>{isPending ? 'Cargando...' : 'Actualizar'}</span>
                    </button>

                    {/* Exportar Excel */}
                    <button
                        type="button"
                        onClick={handleExportCsv}
                        className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm"
                        title="Exportar datos a formato CSV para Excel"
                    >
                        <span>📥</span>
                        <span>Exportar Excel</span>
                    </button>

                    {/* Mantenedor Config */}
                    {currentData.canConfig && (
                        <Link
                            href="/dashboard/mantenedor/personal/monitoreo"
                            className="px-3.5 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm"
                            title="Configurar los roles asignados a monitoreo RRHH"
                        >
                            <span>⚙️</span>
                            <span>Configurar Roles</span>
                        </Link>
                    )}
                </div>
            </div>

            {/* BANNER INFORMATIVO: FILTRO EXCLUSIVO DE REGISTROS ABIERTOS */}
            <div className="bg-sky-50/80 border border-sky-200/90 rounded-2xl p-3.5 px-4 flex items-center justify-between gap-3 text-xs text-sky-900 shadow-sm">
                <div className="flex items-center gap-2.5">
                    <span className="text-base">📌</span>
                    <span>
                        <strong>Criterio de Monitoreo:</strong> Solo se computan registros en estado <strong>ABIERTO</strong>. Las solicitudes cerradas ya concluyeron su ciclo operativo y han sido excluidas de estas métricas.
                    </span>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-sky-700 bg-sky-100/70 border border-sky-200 px-2.5 py-1 rounded-lg shrink-0">
                    <span>Total Abiertos:</span>
                    <strong>{currentData.kpis.totalRegistrosAbiertos}</strong>
                </div>
            </div>

            {/* TARJETAS EJECUTIVAS KPIS (Tema Claro Hendaya) */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                {/* Total Colaboradores */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                        <span>Colaboradores</span>
                        <span className="p-1 bg-slate-100 rounded-lg text-slate-700">👥</span>
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
                        {currentData.kpis.totalColaboradores}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                        Roles monitoreados
                    </div>
                </div>

                {/* Al Día (Verde) */}
                <div
                    onClick={() => setFilterSemaforo(filterSemaforo === 'VERDE' ? 'TODOS' : 'VERDE')}
                    className={`cursor-pointer bg-white border rounded-2xl p-4 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] ${
                        filterSemaforo === 'VERDE'
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/50'
                            : 'border-slate-200 hover:border-emerald-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-emerald-700 text-xs font-bold">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Al Día (&gt;=95%)
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
                        filterSemaforo === 'AMARILLO'
                            ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/50'
                            : 'border-slate-200 hover:border-amber-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-amber-700 text-xs font-bold">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            Atraso Leve (70-94%)
                        </span>
                        <span className="p-1 bg-amber-100/70 rounded-lg text-amber-700">🟡</span>
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-600">
                        {currentData.kpis.totalAtrasoLeve}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                        {currentData.kpis.totalColaboradores > 0 ? Math.round((currentData.kpis.totalAtrasoLeve / currentData.kpis.totalColaboradores) * 100) : 0}% en gestión
                    </div>
                </div>

                {/* Atraso Grave (Rojo) */}
                <div
                    onClick={() => setFilterSemaforo(filterSemaforo === 'ROJO' ? 'TODOS' : 'ROJO')}
                    className={`cursor-pointer bg-white border rounded-2xl p-4 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] ${
                        filterSemaforo === 'ROJO'
                            ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/50'
                            : 'border-slate-200 hover:border-rose-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-rose-700 text-xs font-bold">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                            Atraso Grave (&lt;70%)
                        </span>
                        <span className="p-1 bg-rose-100/70 rounded-lg text-rose-700">🔴</span>
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-rose-600">
                        {currentData.kpis.totalAtrasoGrave}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                        Requiere regularización
                    </div>
                </div>

                {/* Cumplimiento Global Abierto */}
                <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-cyan-800 text-xs font-bold">
                        <span>Cumplimiento Abierto</span>
                        <span className="p-1 bg-cyan-100/70 rounded-lg text-cyan-800">📈</span>
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-cyan-700">
                        {currentData.kpis.cumplimientoGlobalPorcentaje}%
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full mt-1.5 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${currentData.kpis.cumplimientoGlobalPorcentaje}%` }}
                        />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 flex justify-between font-mono">
                        <span>Gest: {currentData.kpis.totalRegistrosGestionados}</span>
                        <span>Pend: {currentData.kpis.totalRegistrosPendientes}</span>
                    </div>
                </div>
            </div>

            {/* BARRA DE FILTROS (Rol, Sucursal, Búsqueda, Semáforos) */}
            <div className="relative z-30 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 relative">
                    {/* 1. FILTRO DE ROL */}
                    <div className={`space-y-1 relative ${isRoleDropdownOpen ? 'z-50' : 'z-20'}`} ref={roleDropdownRef}>
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <span>🛡️</span>
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
                                    setIsSucursalDropdownOpen(false)
                                }}
                                className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-sky-400 focus:border-sky-500 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-left transition shadow-sm group"
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="text-sky-600 text-sm">👤</span>
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
                                        <span>Roles Monitoreados</span>
                                        <span className="text-[10px] text-sky-600 font-mono font-bold">{currentData.rolesDisponibles.length} activos</span>
                                    </div>
                                    <div className="py-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilterRole('TODOS')
                                                setIsRoleDropdownOpen(false)
                                            }}
                                            className={`w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between ${
                                                filterRole === 'TODOS'
                                                    ? 'bg-sky-50 text-sky-900 font-bold border-l-4 border-sky-600'
                                                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium'
                                            }`}
                                        >
                                            <span>Todos los Roles ({currentData.rolesDisponibles.length})</span>
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
                                                    className={`w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between ${
                                                        isSelected
                                                            ? 'bg-sky-50 text-sky-900 font-bold border-l-4 border-sky-600'
                                                            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium'
                                                    }`}
                                                >
                                                    <span className="truncate pr-2">{r}</span>
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

                    {/* 2. FILTRO DE SUCURSAL */}
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
                                            className={`w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between ${
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
                                                    className={`w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between ${
                                                        isSelected
                                                            ? 'bg-sky-50 text-sky-900 font-bold border-l-4 border-sky-600'
                                                            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium'
                                                    }`}
                                                >
                                                    <span className="truncate pr-2">{suc}</span>
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

                    {/* 3. FILTRO POR COLABORADOR O RBD */}
                    <div className="space-y-1 relative z-10">
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <span>🔎</span>
                                <span>Buscar Colaborador o RBD</span>
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
                                value={searchUserQuery}
                                onChange={(e) => setSearchUserQuery(e.target.value)}
                                placeholder="Nombre, @usuario o RBD..."
                                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition shadow-sm font-medium"
                            />
                            <span className="absolute left-3 top-3 text-slate-400 text-xs">🔍</span>
                        </div>
                    </div>
                </div>

                {/* FILTROS POR SEMÁFORO RÁPIDO Y CONTADOR */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-600 mr-1">Filtrar Estado:</span>
                        <button
                            type="button"
                            onClick={() => setFilterSemaforo('TODOS')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                                filterSemaforo === 'TODOS'
                                    ? 'bg-slate-800 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Todos ({currentData.kpis.totalColaboradores})
                        </button>
                        <button
                            type="button"
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
                            type="button"
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
                            type="button"
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

            {/* RENDERIZADO: CERÁMICAS O TABLA */}
            {filteredColaboradores.length === 0 ? (
                <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-3xl space-y-2 shadow-sm">
                    <span className="text-3xl">🔎</span>
                    <h3 className="text-base font-bold text-slate-800">No se encontraron colaboradores con los filtros seleccionados</h3>
                    <p className="text-xs text-slate-500">Prueba cambiando el rol, la sucursal o limpiando el texto de búsqueda.</p>
                </div>
            ) : viewMode === 'CERAMICAS' ? (
                /* GRID DE CERÁMICAS SEMAFÓRICAS HENDAYA */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 relative z-0">
                    {filteredColaboradores.map((colab) => {
                        const isVerde = colab.semaforoGlobal === 'VERDE'
                        const isAmarillo = colab.semaforoGlobal === 'AMARILLO'

                        const borderClass = isVerde
                            ? 'border-emerald-200 hover:border-emerald-400'
                            : isAmarillo
                            ? 'border-amber-200 hover:border-amber-400'
                            : 'border-rose-200 hover:border-rose-400'

                        const badgeStatusClass = isVerde
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isAmarillo
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'

                        const badgeText = isVerde ? '🟢 Al Día' : isAmarillo ? '🟡 Atraso Leve' : '🔴 Atraso Grave'

                        return (
                            <div
                                key={colab.userId}
                                onClick={() => {
                                    setSelectedColaborador(colab)
                                    setModalSearchQuery('')
                                }}
                                className={`cursor-pointer group relative bg-white border rounded-3xl p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.01] ${borderClass} flex flex-col justify-between`}
                            >
                                {/* Barra indicadora luminosa superior */}
                                <div
                                    className={`absolute top-0 left-6 right-6 h-1.5 rounded-b-full transition-all ${
                                        isVerde ? 'bg-emerald-500' : isAmarillo ? 'bg-amber-400' : 'bg-rose-500'
                                    }`}
                                />

                                <div>
                                    {/* Cabecera de la Cerámica */}
                                    <div className="flex items-start justify-between gap-3 pt-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-50 to-sky-100 border border-sky-200 text-sky-800 font-extrabold flex items-center justify-center text-sm shadow-inner shrink-0">
                                                {colab.name ? colab.name.slice(0, 2).toUpperCase() : 'CO'}
                                            </div>
                                            <div>
                                                <h3 className="font-extrabold text-slate-900 text-base leading-snug group-hover:text-cyan-700 transition-colors">
                                                    {colab.name}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                    <span className="text-xs font-mono text-cyan-700 font-semibold">
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

                                    {/* Información de Colegios y Sucursales */}
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
                                        <div className="font-extrabold text-cyan-700">
                                            {colab.porcentajeGlobal}% avance
                                        </div>
                                    </div>

                                    {/* Barra de progreso global del colaborador */}
                                    <div className="mt-2 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${
                                                isVerde ? 'bg-emerald-500' : isAmarillo ? 'bg-amber-400' : 'bg-rose-500'
                                            }`}
                                            style={{ width: `${colab.porcentajeGlobal}%` }}
                                        />
                                    </div>
                                    <div className="mt-1 flex justify-between text-[10px] text-slate-500 font-mono">
                                        <span>Total Abiertos: <strong>{colab.totalRegistrosAbiertos}</strong></span>
                                        <span>Gestionados: <strong>{colab.totalGestionados}</strong> ({colab.porcentajeGlobal}%)</span>
                                        <span>Pendientes: <strong className={colab.totalPendientes > 0 ? 'text-rose-600' : 'text-slate-600'}>{colab.totalPendientes}</strong></span>
                                    </div>

                                    {/* DETALLE DE LOS 4 MÓDULOS DE RRHH DENTRO DE LA CERÁMICA */}
                                    <div className="mt-4 space-y-2.5">
                                        {colab.modulos.map((mod) => {
                                            const modVerde = mod.semaforo === 'VERDE'
                                            const modAmarillo = mod.semaforo === 'AMARILLO'
                                            const barColor = modVerde ? 'bg-emerald-500' : modAmarillo ? 'bg-amber-400' : 'bg-rose-500'

                                            let icon = '📋'
                                            if (mod.tipo === 'AUSENTISMO') icon = '🏥'
                                            if (mod.tipo === 'HORAS_EXTRAS') icon = '⏱️'
                                            if (mod.tipo === 'ATRASOS') icon = '⏳'
                                            if (mod.tipo === 'ADELANTOS') icon = '🏃'

                                            return (
                                                <div
                                                    key={mod.tipo}
                                                    className="bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/90 space-y-1.5"
                                                >
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                                            <span>{icon}</span>
                                                            <span>{mod.nombre}</span>
                                                        </span>
                                                        <span className="text-[11px] font-mono text-slate-600 font-semibold">
                                                            {mod.gestionados}/{mod.totalAbiertos} ({mod.porcentaje}%)
                                                        </span>
                                                    </div>

                                                    {/* Barra de progreso del módulo */}
                                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                                            style={{ width: `${mod.porcentaje}%` }}
                                                        />
                                                    </div>

                                                    {/* Badges de Estado Específico (Aplica / No Aplica) */}
                                                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                                                        {mod.tipo === 'AUSENTISMO' ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-emerald-700 font-medium">Gestionados: {mod.gestionados}</span>
                                                                <span>•</span>
                                                                <span className="text-slate-600">Pendientes: {mod.pendientes}</span>
                                                            </div>
                                                        ) : mod.tipo === 'HORAS_EXTRAS' ? (
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold">
                                                                    Aplica: {mod.aplicaCount || 0}
                                                                </span>
                                                                <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 border border-slate-200 rounded font-semibold">
                                                                    No Aplica: {mod.noAplicaCount || 0}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            /* ATRASOS O ADELANTOS */
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="px-1.5 py-0.2 bg-rose-50 text-rose-700 border border-rose-200 rounded font-semibold">
                                                                    Aplica Desc: {mod.aplicaCount || 0}
                                                                </span>
                                                                <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 border border-slate-200 rounded font-semibold">
                                                                    No Aplica: {mod.noAplicaCount || 0}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <span className={`font-bold font-mono ${
                                                            mod.pendientes > 0 ? 'text-amber-600' : 'text-emerald-600'
                                                        }`}>
                                                            {mod.pendientes > 0 ? `${mod.pendientes} pend.` : 'Al día'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Botón inferior de acción para ver desglose */}
                                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-[11px] text-slate-400">Clic para desglose por colegio</span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setSelectedColaborador(colab)
                                            setModalSearchQuery('')
                                        }}
                                        className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold rounded-xl transition flex items-center gap-1"
                                    >
                                        <span>Ver Detalle RBD</span>
                                        <span>→</span>
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                /* MODO TABLA COMPLETA */
                <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                                    <th className="py-3.5 px-4">Colaborador</th>
                                    <th className="py-3.5 px-3">Rol</th>
                                    <th className="py-3.5 px-3">Colegios</th>
                                    <th className="py-3.5 px-3">Ausentismo</th>
                                    <th className="py-3.5 px-3">Horas Extras</th>
                                    <th className="py-3.5 px-3">Atrasos</th>
                                    <th className="py-3.5 px-3">Adelantos</th>
                                    <th className="py-3.5 px-3 text-center">Abiertos</th>
                                    <th className="py-3.5 px-3 text-center">Cumplimiento</th>
                                    <th className="py-3.5 px-3 text-center">Semáforo</th>
                                    <th className="py-3.5 px-4 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredColaboradores.map((colab) => {
                                    const modAus = colab.modulos.find(m => m.tipo === 'AUSENTISMO')
                                    const modHhee = colab.modulos.find(m => m.tipo === 'HORAS_EXTRAS')
                                    const modAtr = colab.modulos.find(m => m.tipo === 'ATRASOS')
                                    const modAde = colab.modulos.find(m => m.tipo === 'ADELANTOS')

                                    const isVerde = colab.semaforoGlobal === 'VERDE'
                                    const isAmarillo = colab.semaforoGlobal === 'AMARILLO'
                                    const semaforoBadge = isVerde
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : isAmarillo
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-rose-50 text-rose-700 border-rose-200'

                                    return (
                                        <tr
                                            key={colab.userId}
                                            className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                                            onClick={() => {
                                                setSelectedColaborador(colab)
                                                setModalSearchQuery('')
                                            }}
                                        >
                                            <td className="py-3.5 px-4 font-bold text-slate-900">
                                                <div>{colab.name}</div>
                                                <div className="text-[11px] font-mono text-cyan-700">@{colab.username}</div>
                                            </td>
                                            <td className="py-3.5 px-3 text-slate-700 font-medium">
                                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
                                                    {colab.roleName}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-3 text-slate-600 font-mono">
                                                {colab.rbdsCount} colegios
                                            </td>
                                            <td className="py-3.5 px-3">
                                                <span className="font-mono font-semibold text-slate-800">
                                                    {modAus?.gestionados || 0}/{modAus?.totalAbiertos || 0}
                                                </span>
                                                <span className="ml-1 text-[11px] text-slate-500">({modAus?.porcentaje || 100}%)</span>
                                            </td>
                                            <td className="py-3.5 px-3">
                                                <span className="font-mono font-semibold text-slate-800">
                                                    {modHhee?.gestionados || 0}/{modHhee?.totalAbiertos || 0}
                                                </span>
                                                <div className="text-[10px] text-slate-500">
                                                    Aplica: {modHhee?.aplicaCount || 0} | No: {modHhee?.noAplicaCount || 0}
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-3">
                                                <span className="font-mono font-semibold text-slate-800">
                                                    {modAtr?.gestionados || 0}/{modAtr?.totalAbiertos || 0}
                                                </span>
                                                <div className="text-[10px] text-slate-500">
                                                    Desc: {modAtr?.aplicaCount || 0} | No: {modAtr?.noAplicaCount || 0}
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-3">
                                                <span className="font-mono font-semibold text-slate-800">
                                                    {modAde?.gestionados || 0}/{modAde?.totalAbiertos || 0}
                                                </span>
                                                <div className="text-[10px] text-slate-500">
                                                    Desc: {modAde?.aplicaCount || 0} | No: {modAde?.noAplicaCount || 0}
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-800">
                                                {colab.totalRegistrosAbiertos}
                                            </td>
                                            <td className="py-3.5 px-3 text-center">
                                                <span className="text-xs font-extrabold text-cyan-800">
                                                    {colab.porcentajeGlobal}%
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${semaforoBadge}`}>
                                                    {isVerde ? '🟢 Al Día' : isAmarillo ? '🟡 Leve' : '🔴 Grave'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setSelectedColaborador(colab)
                                                        setModalSearchQuery('')
                                                    }}
                                                    className="px-3 py-1 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold rounded-lg transition"
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

            {/* MODAL / DRAWER DE DESGLOSE POR COLEGIO (RBD) */}
            {selectedColaborador && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
                    <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Cabecera del Modal */}
                        <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50">
                            <div>
                                <span className="text-xs font-bold text-cyan-700 uppercase tracking-widest flex items-center gap-1.5">
                                    <span>🏫</span>
                                    <span>Desglose por Colegio y Tipo de Documento</span>
                                </span>
                                <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
                                    {selectedColaborador.name}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    <span className="text-cyan-700 font-mono font-bold">@{selectedColaborador.username}</span> • {selectedColaborador.roleName} • {selectedColaborador.rbdsCount} colegios asignados
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedColaborador(null)}
                                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-sm font-bold transition"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Barra de búsqueda de colegio dentro del modal */}
                        <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-4">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={modalSearchQuery}
                                    onChange={(e) => setModalSearchQuery(e.target.value)}
                                    placeholder="Buscar por RBD, nombre de establecimiento, comuna o sucursal..."
                                    className="w-full bg-slate-50 border border-slate-200 focus:border-cyan-500 focus:bg-white rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition"
                                />
                                <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                            </div>
                            <span className="text-xs font-medium text-slate-500 shrink-0">
                                Mostrando {modalFilteredColegios.length} de {selectedColaborador.colegiosDetalle.length} colegios
                            </span>
                        </div>

                        {/* Contenido scrolleable con los colegios */}
                        <div className="p-6 overflow-y-auto space-y-4 flex-1">
                            {modalFilteredColegios.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 text-xs">
                                    No se encontraron colegios con el criterio de búsqueda ingresado.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {modalFilteredColegios.map((col) => {
                                        const isVerde = col.semaforo === 'VERDE'
                                        const isAmarillo = col.semaforo === 'AMARILLO'
                                        const badgeClass = isVerde
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : isAmarillo
                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                            : 'bg-rose-50 text-rose-700 border-rose-200'

                                        return (
                                            <div
                                                key={col.rbd}
                                                className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition shadow-sm space-y-3"
                                            >
                                                {/* Encabezado del Colegio */}
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-xs px-2.5 py-0.5 bg-cyan-100 text-cyan-900 rounded-md font-bold border border-cyan-200">
                                                                RBD {col.rbd}
                                                            </span>
                                                            <h4 className="font-extrabold text-slate-900 text-sm">
                                                                {col.nombreEstablecimiento}
                                                            </h4>
                                                        </div>
                                                        <div className="text-xs text-slate-500 mt-0.5">
                                                            {col.comuna ? `Comuna: ${col.comuna}` : ''} {col.sucursal ? `• Sucursal: ${col.sucursal}` : ''}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-mono font-bold text-slate-700">
                                                            {col.totalGeneralGestionados}/{col.totalGeneralAbiertos} abiertos ({col.porcentajeGeneral}%)
                                                        </span>
                                                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${badgeClass}`}>
                                                            {isVerde ? '🟢 Al Día' : isAmarillo ? '🟡 Leve' : '🔴 Grave'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Grid de 4 Tipos de Documentos para este Colegio */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                                    {/* 1. Ausentismo */}
                                                    <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                                                        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                                            <span>🏥 Ausentismo</span>
                                                            <span className="font-mono text-cyan-700">
                                                                {col.ausentismo.gestionados}/{col.ausentismo.total}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 flex justify-between">
                                                            <span>Pendientes: {col.ausentismo.pendientes}</span>
                                                            <span className={col.ausentismo.pendientes === 0 ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                                                                {col.ausentismo.pendientes === 0 ? '✓ Al día' : 'Pendiente'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* 2. Horas Extras */}
                                                    <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                                                        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                                            <span>⏱️ Horas Extras</span>
                                                            <span className="font-mono text-cyan-700">
                                                                {col.horasExtras.gestionados}/{col.horasExtras.total}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 flex justify-between">
                                                            <span>Aplica: <strong>{col.horasExtras.aplica}</strong> | No: <strong>{col.horasExtras.noAplica}</strong></span>
                                                            <span className={col.horasExtras.pendientes === 0 ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                                                                {col.horasExtras.pendientes === 0 ? '✓ Al día' : 'Pendiente'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* 3. Atrasos */}
                                                    <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                                                        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                                            <span>⏳ Atrasos</span>
                                                            <span className="font-mono text-cyan-700">
                                                                {col.atrasos.gestionados}/{col.atrasos.total}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 flex justify-between">
                                                            <span>Desc: <strong>{col.atrasos.aplicaDescuento}</strong> | No: <strong>{col.atrasos.noAplica}</strong></span>
                                                            <span className={col.atrasos.pendientes === 0 ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                                                                {col.atrasos.pendientes === 0 ? '✓ Al día' : 'Pendiente'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* 4. Adelantos */}
                                                    <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                                                        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                                            <span>🏃 Adelantos</span>
                                                            <span className="font-mono text-cyan-700">
                                                                {col.adelantos.gestionados}/{col.adelantos.total}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 flex justify-between">
                                                            <span>Desc: <strong>{col.adelantos.aplicaDescuento}</strong> | No: <strong>{col.adelantos.noAplica}</strong></span>
                                                            <span className={col.adelantos.pendientes === 0 ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                                                                {col.adelantos.pendientes === 0 ? '✓ Al día' : 'Pendiente'}
                                                            </span>
                                                        </div>
                                                    </div>
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
                                type="button"
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
