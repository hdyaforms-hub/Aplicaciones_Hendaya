'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
    AsistenciaHextraRegistroDTO,
    getAsistenciaHorasExtrasAction,
    toggleAplicaHorasExtrasAction
} from './actions'
import {
    Clock,
    Search,
    Calendar,
    Building2,
    RefreshCw,
    X,
    Check,
    Filter,
    Info,
    CheckCircle2,
    XCircle,
    UserCheck,
    AlertCircle,
    MapPin,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react'

interface EstablecimientoOption {
    rbd: number
    establecimiento: string
}

interface AsistenciaHorasExtrasClientProps {
    initialData: {
        data: AsistenciaHextraRegistroDTO[]
        total: number
        page: number
        pageSize: number
        sucursales: string[]
        supervisores: string[]
        establecimientos: EstablecimientoOption[]
    }
    userRbds: number[]
    isAdmin: boolean
}

export default function AsistenciaHorasExtrasClient({
    initialData,
    userRbds,
    isAdmin
}: AsistenciaHorasExtrasClientProps) {
    const [registros, setRegistros] = useState<AsistenciaHextraRegistroDTO[]>(initialData.data)
    const [totalRegistros, setTotalRegistros] = useState(initialData.total)
    const [isPending, startTransition] = useTransition()

    // Filtros
    const [filtroRbd, setFiltroRbd] = useState<number | null>(null)
    const [busquedaRbdNombre, setBusquedaRbdNombre] = useState('')
    const [isRbdDropdownOpen, setIsRbdDropdownOpen] = useState(false)
    const [filtroSucursal, setFiltroSucursal] = useState('TODAS')
    const [filtroSupervisor, setFiltroSupervisor] = useState('TODOS')
    const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
    const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
    const [filtroAplica, setFiltroAplica] = useState<'TODOS' | 'APLICA' | 'NO_APLICA'>('TODOS')
    const [busquedaTexto, setBusquedaTexto] = useState('')

    // Paginación y Ordenamiento (10 registros por página)
    const [paginaActual, setPaginaActual] = useState(1)
    const pageSize = 10

    type SortField = 'fecha' | 'rbd' | 'establecimiento' | 'nombreCompleto' | 'supervisor' | 'sucursal' | 'hhee' | 'atraso' | 'aplica'
    const [sortField, setSortField] = useState<SortField>('fecha')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

    const handleSort = (field: SortField) => {
        const newDirection = sortField === field ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'
        setSortField(field)
        setSortDirection(newDirection)
        cargarDatos(1, field, newDirection)
    }

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
        return sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
    }

    // Feedback
    const [guardadoStatus, setGuardadoStatus] = useState<{ [id: string]: boolean }>({})
    const [mensajeFeedback, setMensajeFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

    // Establecimientos filtrados para autocompletado
    const establecimientosSugeridos = useMemo(() => {
        if (!busquedaRbdNombre.trim()) return initialData.establecimientos.slice(0, 15)
        const term = busquedaRbdNombre.toLowerCase()
        return initialData.establecimientos.filter(e =>
            e.rbd.toString().includes(term) ||
            e.establecimiento.toLowerCase().includes(term)
        ).slice(0, 15)
    }, [initialData.establecimientos, busquedaRbdNombre])

    // Cargar / refrescar datos del servidor con filtros
    const cargarDatos = (
        pagina: number = paginaActual,
        sortBy: SortField = sortField,
        sortDir: 'asc' | 'desc' = sortDirection
    ) => {
        startTransition(async () => {
            const res = await getAsistenciaHorasExtrasAction({
                rbd: filtroRbd || undefined,
                sucursal: filtroSucursal,
                supervisor: filtroSupervisor,
                fechaDesde: filtroFechaDesde || undefined,
                fechaHasta: filtroFechaHasta || undefined,
                aplica: filtroAplica,
                search: busquedaTexto || undefined,
                page: pagina,
                pageSize,
                sortBy,
                sortDir
            })
            if (res.success) {
                setRegistros(res.data)
                setTotalRegistros(res.total)
                setPaginaActual(pagina)
            } else {
                setMensajeFeedback({ tipo: 'error', texto: res.error || 'Error al cargar registros' })
                setTimeout(() => setMensajeFeedback(null), 3500)
            }
        })
    }

    // Toggle Aplica / No Aplica
    const handleToggleAplica = async (registroId: string, valorActual: boolean) => {
        const nuevoValor = !valorActual

        // Optimistic update
        setRegistros(prev =>
            prev.map(r =>
                r.id === registroId
                    ? {
                        ...r,
                        aplica: nuevoValor,
                        aplicaModificadoPor: 'Tú',
                        aplicaModificadoAt: new Date().toISOString()
                    }
                    : r
            )
        )

        const res = await toggleAplicaHorasExtrasAction(registroId, nuevoValor)
        if (res.success) {
            setGuardadoStatus(prev => ({ ...prev, [registroId]: true }))
            setTimeout(() => {
                setGuardadoStatus(prev => ({ ...prev, [registroId]: false }))
            }, 2000)
        } else {
            // Revertir en caso de falla
            cargarDatos()
            setMensajeFeedback({ tipo: 'error', texto: res.error || 'No se pudo actualizar el estado de la hora extra' })
            setTimeout(() => setMensajeFeedback(null), 4000)
        }
    }

    // Métricas
    const totalAplica = useMemo(() => registros.filter(r => r.aplica).length, [registros])
    const totalNoAplica = useMemo(() => registros.filter(r => !r.aplica).length, [registros])
    const totalHorasHhee = useMemo(() => registros.reduce((acc, r) => acc + (r.aplica ? r.hhee : 0), 0), [registros])

    const totalPaginas = Math.ceil(totalRegistros / pageSize) || 1

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
            {/* Header Estándar Claro Hendaya */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <div className="flex items-center gap-2 text-cyan-600 font-semibold text-xs tracking-wider uppercase mb-1">
                        <Clock className="w-4 h-4" />
                        <span>Áreas · Recursos Humanos · Asistencia</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        Módulo de Hrs Extras
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Revisión operativa diaria de horas extras de personal. Indica si la hora extra reportada <strong>Aplica</strong> o <strong>No aplica</strong> para su respectivo proceso.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => cargarDatos(1)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-xl border border-gray-200 text-xs font-semibold transition-colors shadow-sm"
                        title="Recargar datos"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-cyan-600' : 'text-gray-500'}`} />
                        <span>Refrescar</span>
                    </button>
                </div>
            </div>

            {/* Aviso de RBDs restringidos para el usuario */}
            {!isAdmin && userRbds.length > 0 && (
                <div className="flex items-center gap-2 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs shadow-sm">
                    <Info className="w-4 h-4 flex-shrink-0 text-amber-600" />
                    <span>
                        Acceso restringido por perfil: Solo puedes visualizar los <strong>{userRbds.length}</strong> establecimientos (RBDs) asociados a tu cuenta.
                    </span>
                </div>
            )}

            {/* Feedback alert */}
            {mensajeFeedback && (
                <div
                    className={`flex items-center gap-2 p-4 rounded-xl text-xs font-medium border shadow-sm transition-all ${
                        mensajeFeedback.tipo === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    {mensajeFeedback.tipo === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    )}
                    <span>{mensajeFeedback.texto}</span>
                </div>
            )}

            {/* Tarjetas de Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Registros Abiertos</span>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{totalRegistros}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Aplica Hora Extra</span>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">{totalAplica}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">No Aplica Hora Extra</span>
                    <p className="text-2xl font-bold text-amber-700 mt-1">{totalNoAplica}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <span className="text-[11px] font-semibold text-cyan-600 uppercase tracking-wider">Total Horas Aprobadas</span>
                    <p className="text-2xl font-bold text-cyan-700 mt-1">{totalHorasHhee.toFixed(1)} hrs</p>
                </div>
            </div>

            {/* Filtros de Búsqueda */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                        <Filter className="w-3.5 h-3.5 text-cyan-600" />
                        <span>Filtros de Búsqueda</span>
                    </div>
                    {(busquedaRbdNombre || filtroRbd || filtroSucursal !== 'TODAS' || filtroSupervisor !== 'TODOS' || filtroFechaDesde || filtroFechaHasta || filtroAplica !== 'TODOS' || busquedaTexto) && (
                        <button
                            onClick={() => {
                                setBusquedaRbdNombre('')
                                setFiltroRbd(null)
                                setFiltroSucursal('TODAS')
                                setFiltroSupervisor('TODOS')
                                setFiltroFechaDesde('')
                                setFiltroFechaHasta('')
                                setFiltroAplica('TODOS')
                                setBusquedaTexto('')
                                setTimeout(() => cargarDatos(1), 50)
                            }}
                            className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition-colors"
                        >
                            <X className="w-3 h-3" />
                            <span>Limpiar Filtros</span>
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {/* Autocompletado RBD / Establecimiento */}
                    <div className="relative">
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">RBD / Establecimiento</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar por RBD o colegio..."
                                value={busquedaRbdNombre}
                                onChange={e => {
                                    setBusquedaRbdNombre(e.target.value)
                                    setFiltroRbd(null)
                                    setIsRbdDropdownOpen(true)
                                }}
                                onFocus={() => setIsRbdDropdownOpen(true)}
                                className="w-full pl-8 pr-7 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                            />
                            <Building2 className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                            {busquedaRbdNombre && (
                                <button
                                    onClick={() => {
                                        setBusquedaRbdNombre('')
                                        setFiltroRbd(null)
                                    }}
                                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        {isRbdDropdownOpen && establecimientosSugeridos.length > 0 && (
                            <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {establecimientosSugeridos.map(item => (
                                    <button
                                        key={item.rbd}
                                        type="button"
                                        onClick={() => {
                                            setFiltroRbd(item.rbd)
                                            setBusquedaRbdNombre(`${item.rbd} - ${item.establecimiento}`)
                                            setIsRbdDropdownOpen(false)
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-cyan-50 text-xs border-b border-gray-50 flex items-center justify-between text-gray-700"
                                    >
                                        <span className="font-medium truncate">{item.establecimiento}</span>
                                        <span className="text-[10px] font-bold text-cyan-600 bg-cyan-100 px-1.5 py-0.5 rounded ml-2">
                                            RBD {item.rbd}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Filtro Aplica / No Aplica */}
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Estado de Aplicación</label>
                        <select
                            value={filtroAplica}
                            onChange={e => setFiltroAplica(e.target.value as any)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                        >
                            <option value="TODOS">Todos los Registros</option>
                            <option value="APLICA">Solo Aplica</option>
                            <option value="NO_APLICA">Solo No Aplica</option>
                        </select>
                    </div>

                    {/* Filtro Sucursal */}
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Sucursal / Sede</label>
                        <select
                            value={filtroSucursal}
                            onChange={e => setFiltroSucursal(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                        >
                            <option value="TODAS">Todas las Sucursales</option>
                            {initialData.sucursales.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Supervisor */}
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Supervisor</label>
                        <select
                            value={filtroSupervisor}
                            onChange={e => setFiltroSupervisor(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                        >
                            <option value="TODOS">Todos los Supervisores</option>
                            {initialData.supervisores.map(sup => (
                                <option key={sup} value={sup}>{sup}</option>
                            ))}
                        </select>
                    </div>

                    {/* Fecha Desde */}
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Fecha Desde</label>
                        <input
                            type="date"
                            value={filtroFechaDesde}
                            onChange={e => setFiltroFechaDesde(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                        />
                    </div>

                    {/* Fecha Hasta */}
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Fecha Hasta</label>
                        <input
                            type="date"
                            value={filtroFechaHasta}
                            onChange={e => setFiltroFechaHasta(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                        />
                    </div>

                    {/* Búsqueda por RUT o Nombre */}
                    <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Colaborador / RUT</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Buscar por RUT, nombre o cargo..."
                                value={busquedaTexto}
                                onChange={e => setBusquedaTexto(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') cargarDatos(1) }}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                            />
                            <button
                                onClick={() => cargarDatos(1)}
                                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                            >
                                Filtrar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabla de Registros */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-gray-900 text-sm">Registros de Horas Extras en Período Abierto</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Los registros de períodos cerrados no se despliegan en esta pantalla.
                        </p>
                    </div>
                </div>

                {registros.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 text-xs">
                        No se encontraron registros de horas extras abiertas que coincidan con los filtros aplicados.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-gray-100 text-gray-600 uppercase text-[10px] tracking-wider font-semibold">
                                <tr>
                                    <th 
                                        onClick={() => handleSort('fecha')}
                                        className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                        title="Ordenar por Fecha"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className={sortField === 'fecha' ? 'text-cyan-800 font-bold' : ''}>Fecha</span>
                                            {renderSortIcon('fecha')}
                                        </div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('rbd')}
                                        className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                        title="Ordenar por RBD / Establecimiento"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className={sortField === 'rbd' ? 'text-cyan-800 font-bold' : ''}>RBD / Establecimiento</span>
                                            {renderSortIcon('rbd')}
                                        </div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('nombreCompleto')}
                                        className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                        title="Ordenar por Colaborador"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className={sortField === 'nombreCompleto' ? 'text-cyan-800 font-bold' : ''}>Colaborador</span>
                                            {renderSortIcon('nombreCompleto')}
                                        </div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('supervisor')}
                                        className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                        title="Ordenar por Supervisor / Sucursal"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className={sortField === 'supervisor' ? 'text-cyan-800 font-bold' : ''}>Supervisor / Sucursal</span>
                                            {renderSortIcon('supervisor')}
                                        </div>
                                    </th>
                                    <th className="py-3 px-3 text-center">Horario</th>
                                    <th 
                                        onClick={() => handleSort('hhee')}
                                        className="py-3 px-3 text-center cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                        title="Ordenar por Horas Extras"
                                    >
                                        <div className="flex items-center justify-center gap-1.5">
                                            <span className={sortField === 'hhee' ? 'text-cyan-800 font-bold' : ''}>Horas Extras</span>
                                            {renderSortIcon('hhee')}
                                        </div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('aplica')}
                                        className="py-3 px-3 text-center cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                        title="Ordenar por ¿Aplica Hr Extra?"
                                    >
                                        <div className="flex items-center justify-center gap-1.5">
                                            <span className={sortField === 'aplica' ? 'text-cyan-800 font-bold' : ''}>¿Aplica Hr Extra?</span>
                                            {renderSortIcon('aplica')}
                                        </div>
                                    </th>
                                    <th className="py-3 px-3">Trazabilidad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-gray-700">
                                {registros.map(r => (
                                    <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                                        {/* Fecha */}
                                        <td className="py-3 px-3 font-semibold text-gray-900 whitespace-nowrap">
                                            {r.fecha}
                                        </td>

                                        {/* RBD / Establecimiento */}
                                        <td className="py-3 px-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-900">{r.establecimiento}</span>
                                                {r.rbd && (
                                                    <span className="text-[10px] font-semibold text-cyan-600">RBD: {r.rbd}</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Colaborador */}
                                        <td className="py-3 px-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-900">{r.nombreCompleto}</span>
                                                <span className="text-[11px] text-gray-500 font-mono">{r.rut}</span>
                                                {r.cargo && (
                                                    <span className="text-[10px] text-gray-400 truncate max-w-xs">{r.cargo}</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Supervisor y Sucursal */}
                                        <td className="py-3 px-3">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-700">{r.supervisor || 'Sin Supervisor'}</span>
                                                <span className="text-[10px] text-gray-400">{r.sucursal}</span>
                                            </div>
                                        </td>

                                        {/* Horario */}
                                        <td className="py-3 px-3 text-center">
                                            <div className="flex flex-col text-[11px]">
                                                <span className="font-semibold text-gray-800">{r.entro || '--'} - {r.salio || '--'}</span>
                                                {r.turno && (
                                                    <span className="text-[10px] text-gray-400">{r.turno}</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Horas Extras */}
                                        <td className="py-3 px-3 text-center">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-cyan-700 text-xs">
                                                    {r.hhee} hrs
                                                </span>
                                                {r.atraso > 0 && (
                                                    <span className="text-[10px] text-rose-500">Atraso: {r.atraso} hrs</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Botón o Check "Aplica / No aplica" */}
                                        <td className="py-3 px-3 text-center whitespace-nowrap">
                                            <div className="inline-flex items-center gap-2">
                                                <button
                                                    onClick={() => handleToggleAplica(r.id, r.aplica)}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm ${
                                                        r.aplica
                                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                            : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300'
                                                    }`}
                                                    title="Haz clic para alternar entre Aplica y No Aplica"
                                                >
                                                    {r.aplica ? (
                                                        <>
                                                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                            <span>Aplica</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <X className="w-3.5 h-3.5 stroke-[3]" />
                                                            <span>No Aplica</span>
                                                        </>
                                                    )}
                                                </button>
                                                {guardadoStatus[r.id] && (
                                                    <span className="text-[10px] font-bold text-emerald-600 animate-pulse">
                                                        ✓ Guardado
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Trazabilidad */}
                                        <td className="py-3 px-3 text-[11px] text-gray-500">
                                            <div className="flex flex-col">
                                                {r.aplicaModificadoPor ? (
                                                    <>
                                                        <span className="font-semibold text-gray-700">Por: {r.aplicaModificadoPor}</span>
                                                        <span className="text-[10px] text-gray-400">
                                                            {r.aplicaModificadoAt ? new Date(r.aplicaModificadoAt).toLocaleString('es-CL') : ''}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-gray-400 italic">Por defecto (No Aplica)</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Paginación */}
                {totalRegistros > pageSize && (
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                        <span>
                            Mostrando {((paginaActual - 1) * pageSize) + 1} - {Math.min(paginaActual * pageSize, totalRegistros)} de {totalRegistros} registros
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                disabled={paginaActual === 1 || isPending}
                                onClick={() => cargarDatos(paginaActual - 1)}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-semibold"
                            >
                                Anterior
                            </button>
                            <span className="px-3 py-1.5 font-bold text-gray-800">
                                {paginaActual} / {totalPaginas}
                            </span>
                            <button
                                disabled={paginaActual === totalPaginas || isPending}
                                onClick={() => cargarDatos(paginaActual + 1)}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-semibold"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
