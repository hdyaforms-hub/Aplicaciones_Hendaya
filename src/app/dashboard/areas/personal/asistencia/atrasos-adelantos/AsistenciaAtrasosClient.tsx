'use client'

import React, { useState, useTransition } from 'react'
import {
    AsistenciaAtrasosRegistroDTO,
    getAsistenciaAtrasosAction,
    actualizarGestionAtrasoAction
} from './actions'
import {
    Clock,
    RefreshCw,
    Search,
    Building2,
    Eye,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    CheckCircle2,
    Check,
    X,
    Filter,
    Edit3,
    ShieldAlert,
    Timer,
    Info,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react'

interface InitialData {
    data: AsistenciaAtrasosRegistroDTO[]
    total: number
    page: number
    pageSize: number
    sucursales: string[]
    supervisores: string[]
    establecimientos: { rbd: number; establecimiento: string }[]
    resumen?: {
        totalRegistros: number
        totalMinutosAtraso: number
        totalMinutosAdelanto: number
        totalAplicaDescuento: number
        totalJustificados: number
    }
}

interface Props {
    initialData: InitialData
    userRbds: number[]
    isAdmin: boolean
}

export default function AsistenciaAtrasosClient({ initialData, userRbds, isAdmin }: Props) {
    const [data, setData] = useState<InitialData>(initialData)
    const [isPending, startTransition] = useTransition()

    // Filtros
    const [search, setSearch] = useState('')
    const [filtroSucursal, setFiltroSucursal] = useState('TODAS')
    const [filtroSupervisor, setFiltroSupervisor] = useState('TODOS')
    const [filtroRbd, setFiltroRbd] = useState<number | null>(null)
    const [busquedaRbdInput, setBusquedaRbdInput] = useState('')
    const [isRbdDropdownOpen, setIsRbdDropdownOpen] = useState(false)
    const [fechaDesde, setFechaDesde] = useState('')
    const [fechaHasta, setFechaHasta] = useState('')
    const [filtroAplica, setFiltroAplica] = useState<'TODOS' | 'APLICA' | 'NO_APLICA'>('TODOS')
    const [filtroJustificado, setFiltroJustificado] = useState<'TODOS' | 'CON_JUSTIFICACION' | 'SIN_JUSTIFICACION'>('TODOS')

    const [pagina, setPagina] = useState(initialData.page || 1)
    const [pageSize, setPageSize] = useState(initialData.pageSize || 10)
    const [sortBy, setSortBy] = useState('fecha')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

    // Modal de edición de justificación y observación
    const [modalEdit, setModalEdit] = useState<{
        isOpen: boolean
        registro: AsistenciaAtrasosRegistroDTO | null
        aplicaDescuento: boolean
        justificado: string
        observacion: string
    }>({
        isOpen: false,
        registro: null,
        aplicaDescuento: false,
        justificado: '',
        observacion: ''
    })

    // Feedback visual de guardado por registro
    const [guardadoStatus, setGuardadoStatus] = useState<{ [id: string]: boolean }>({})
    const [mensajeFeedback, setMensajeFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

    const fetchData = (
        newPage = pagina,
        newSortBy = sortBy,
        newSortDir = sortDir,
        newPageSize = pageSize
    ) => {
        startTransition(async () => {
            const res = await getAsistenciaAtrasosAction({
                search: search.trim() || undefined,
                sucursal: filtroSucursal !== 'TODAS' ? filtroSucursal : undefined,
                supervisor: filtroSupervisor !== 'TODOS' ? filtroSupervisor : undefined,
                rbd: filtroRbd || undefined,
                fechaDesde: fechaDesde || undefined,
                fechaHasta: fechaHasta || undefined,
                aplicaDescuento: filtroAplica !== 'TODOS' ? filtroAplica : undefined,
                justificado: filtroJustificado !== 'TODOS' ? filtroJustificado : undefined,
                page: newPage,
                pageSize: newPageSize,
                sortBy: newSortBy,
                sortDir: newSortDir
            })
            if (res.success) {
                setData({
                    data: res.data,
                    total: res.total,
                    page: res.page,
                    pageSize: res.pageSize,
                    sucursales: res.sucursales,
                    supervisores: res.supervisores,
                    establecimientos: res.establecimientos,
                    resumen: res.resumen
                })
                setPagina(newPage)
                setSortBy(newSortBy)
                setSortDir(newSortDir)
                setPageSize(newPageSize)
            } else if (res.error) {
                setMensajeFeedback({ tipo: 'error', texto: res.error })
            }
        })
    }

    const handleSort = (field: string) => {
        let newDir: 'asc' | 'desc' = 'asc'
        if (sortBy === field) {
            newDir = sortDir === 'asc' ? 'desc' : 'asc'
        }
        setSortBy(field)
        setSortDir(newDir)
        fetchData(1, field, newDir, pageSize)
    }

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        fetchData(1, sortBy, sortDir, pageSize)
    }

    const handleClearFilters = () => {
        setSearch('')
        setFiltroSucursal('TODAS')
        setFiltroSupervisor('TODOS')
        setFiltroRbd(null)
        setBusquedaRbdInput('')
        setFechaDesde('')
        setFechaHasta('')
        setFiltroAplica('TODOS')
        setFiltroJustificado('TODOS')
        startTransition(async () => {
            const res = await getAsistenciaAtrasosAction({
                page: 1,
                pageSize,
                sortBy,
                sortDir
            })
            if (res.success) {
                setData({
                    data: res.data,
                    total: res.total,
                    page: res.page,
                    pageSize: res.pageSize,
                    sucursales: res.sucursales,
                    supervisores: res.supervisores,
                    establecimientos: res.establecimientos,
                    resumen: res.resumen
                })
                setPagina(1)
            }
        })
    }

    // Toggle rápido de Aplica Descuento
    const handleToggleAplica = async (registro: AsistenciaAtrasosRegistroDTO) => {
        const nuevoValor = !registro.aplicaDescuento
        // Optimistic update
        setData(prev => ({
            ...prev,
            data: prev.data.map(r => r.id === registro.id ? { ...r, aplicaDescuento: nuevoValor } : r)
        }))

        const res = await actualizarGestionAtrasoAction(
            registro.id,
            nuevoValor,
            registro.justificado || undefined,
            registro.observacion || undefined
        )

        if (res.success) {
            setGuardadoStatus(prev => ({ ...prev, [registro.id]: true }))
            setTimeout(() => {
                setGuardadoStatus(prev => {
                    const copy = { ...prev }
                    delete copy[registro.id]
                    return copy
                })
            }, 2000)
        } else {
            // Revertir
            setData(prev => ({
                ...prev,
                data: prev.data.map(r => r.id === registro.id ? { ...r, aplicaDescuento: registro.aplicaDescuento } : r)
            }))
            alert(res.error || 'Error al actualizar estado')
        }
    }

    // Guardar edición del modal
    const handleSaveModal = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!modalEdit.registro) return

        startTransition(async () => {
            const res = await actualizarGestionAtrasoAction(
                modalEdit.registro!.id,
                modalEdit.aplicaDescuento,
                modalEdit.justificado.trim(),
                modalEdit.observacion.trim()
            )

            if (res.success) {
                setData(prev => ({
                    ...prev,
                    data: prev.data.map(r =>
                        r.id === modalEdit.registro!.id
                            ? {
                                ...r,
                                aplicaDescuento: modalEdit.aplicaDescuento,
                                justificado: modalEdit.justificado.trim() || null,
                                observacion: modalEdit.observacion.trim() || null
                            }
                            : r
                    )
                }))
                setGuardadoStatus(prev => ({ ...prev, [modalEdit.registro!.id]: true }))
                setModalEdit({ isOpen: false, registro: null, aplicaDescuento: false, justificado: '', observacion: '' })
                setMensajeFeedback({ tipo: 'success', texto: 'Gestión guardada correctamente.' })
                setTimeout(() => setMensajeFeedback(null), 3000)
            } else {
                alert(res.error || 'Error al guardar cambios')
            }
        })
    }

    // Establecimientos filtrados para autocompletado
    const establecimientosFiltrados = data.establecimientos.filter(e => {
        if (!busquedaRbdInput.trim()) return true
        const term = busquedaRbdInput.toLowerCase()
        return e.rbd.toString().includes(term) || e.establecimiento.toLowerCase().includes(term)
    }).slice(0, 15)

    const totalPages = Math.ceil(data.total / pageSize) || 1

    const formatMinutesToHours = (mins: number) => {
        const hours = Math.floor(mins / 60)
        const remMins = mins % 60
        return `${hours.toLocaleString('es-CL')} hrs ${remMins > 0 ? `${remMins} min` : ''}`
    }

    // Métricas consolidadas (globales de la consulta / filtros aplicados)
    const totalAtrasoMin = data.resumen?.totalMinutosAtraso ?? data.data.reduce((acc, r) => acc + (r.minutosAtraso || 0), 0)
    const totalAdelantoMin = data.resumen?.totalMinutosAdelanto ?? data.data.reduce((acc, r) => acc + (r.minutosAdelanto || 0), 0)
    const aplicandoDescCount = data.resumen?.totalAplicaDescuento ?? data.data.filter(r => r.aplicaDescuento).length

    return (
        <div className="space-y-6">
            {/* Header Corporativo Hendaya */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <div className="flex items-center gap-2 text-cyan-600 font-semibold text-xs tracking-wider uppercase mb-1">
                        <Clock className="w-4 h-4" />
                        <span>Áreas · Recursos Humanos · Asistencia</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        Atrasos y Adelantos
                        <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-medium">
                            Períodos Abiertos
                        </span>
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Gestión operativa diaria de atrasos y salidas anticipadas de personal. Tipifica si aplica descuento y registra las justificaciones para los colegios autorizados.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => fetchData()}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-xl border border-gray-200 text-xs font-semibold transition-colors shadow-sm"
                        title="Refrescar datos"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-cyan-600' : 'text-gray-500'}`} />
                        <span>Refrescar</span>
                    </button>
                </div>
            </div>

            {/* Aviso de RBDs restringidos para el perfil */}
            {!isAdmin && userRbds.length > 0 && (
                <div className="flex items-center gap-2.5 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-800 text-xs shadow-sm">
                    <Info className="w-4 h-4 flex-shrink-0 text-amber-600" />
                    <span>
                        Acceso restringido por perfil: Solo puedes visualizar los <strong>{userRbds.length}</strong> establecimientos autorizados en tu cuenta de usuario.
                    </span>
                </div>
            )}
            {!isAdmin && userRbds.length === 0 && (
                <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs shadow-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                    <span>
                        Sin colegios autorizados: Tu cuenta de usuario aún no tiene RBDs asignados en el mantenedor correspondiente. Contacta al Administrador.
                    </span>
                </div>
            )}

            {/* Alerta de Feedback */}
            {mensajeFeedback && (
                <div className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-medium ${
                    mensajeFeedback.tipo === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{mensajeFeedback.texto}</span>
                </div>
            )}

            {/* Tarjetas de KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Registros</span>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{data.total.toLocaleString('es-CL')}</p>
                    <span className="text-[10px] text-gray-400 mt-0.5 block">En períodos abiertos</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm">
                    <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Minutos de Atraso</span>
                    <p className="text-2xl font-bold text-rose-700 mt-1">
                        {totalAtrasoMin.toLocaleString('es-CL')}
                        <span className="text-xs font-normal text-rose-500 ml-1">min</span>
                    </p>
                    <span className="text-[10px] text-rose-500 mt-0.5 block">{formatMinutesToHours(totalAtrasoMin)}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                    <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Salidas Anticipadas</span>
                    <p className="text-2xl font-bold text-amber-700 mt-1">
                        {totalAdelantoMin.toLocaleString('es-CL')}
                        <span className="text-xs font-normal text-amber-500 ml-1">min</span>
                    </p>
                    <span className="text-[10px] text-amber-500 mt-0.5 block">{formatMinutesToHours(totalAdelantoMin)}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-cyan-100 shadow-sm">
                    <span className="text-[11px] font-semibold text-cyan-600 uppercase tracking-wider">Aplica Descuento</span>
                    <p className="text-2xl font-bold text-cyan-700 mt-1">{aplicandoDescCount.toLocaleString('es-CL')}</p>
                    <span className="text-[10px] text-cyan-500 mt-0.5 block">Registros con descuento</span>
                </div>
            </div>

            {/* Barra de Filtros */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                            Búsqueda Colaborador / RUT
                        </label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="RUT, Nombre, Apellido, Cargo..."
                                className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                            />
                        </div>
                    </div>

                    <div className="sm:col-span-3 relative">
                        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                            Establecimiento (RBD)
                        </label>
                        <input
                            type="text"
                            value={busquedaRbdInput}
                            onChange={e => {
                                setBusquedaRbdInput(e.target.value)
                                setIsRbdDropdownOpen(true)
                                if (!e.target.value) setFiltroRbd(null)
                            }}
                            onFocus={() => setIsRbdDropdownOpen(true)}
                            placeholder={filtroRbd ? `RBD ${filtroRbd} Seleccionado` : 'Buscar por RBD o Nombre...'}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                        />
                        {isRbdDropdownOpen && establecimientosFiltrados.length > 0 && (
                            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-50 text-xs">
                                <div
                                    onClick={() => {
                                        setFiltroRbd(null)
                                        setBusquedaRbdInput('')
                                        setIsRbdDropdownOpen(false)
                                    }}
                                    className="p-2 hover:bg-gray-50 cursor-pointer font-medium text-cyan-600"
                                >
                                    -- Todos los Establecimientos --
                                </div>
                                {establecimientosFiltrados.map(est => (
                                    <div
                                        key={est.rbd}
                                        onClick={() => {
                                            setFiltroRbd(est.rbd)
                                            setBusquedaRbdInput(`RBD ${est.rbd} - ${est.establecimiento}`)
                                            setIsRbdDropdownOpen(false)
                                        }}
                                        className="p-2 hover:bg-gray-50 cursor-pointer text-gray-700"
                                    >
                                        <strong className="text-gray-900">RBD {est.rbd}:</strong> {est.establecimiento}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                            ¿Aplica Descuento?
                        </label>
                        <select
                            value={filtroAplica}
                            onChange={e => setFiltroAplica(e.target.value as any)}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                        >
                            <option value="TODOS">Todos</option>
                            <option value="APLICA">Aplica Descuento</option>
                            <option value="NO_APLICA">No Aplica</option>
                        </select>
                    </div>

                    <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                            Justificación
                        </label>
                        <select
                            value={filtroJustificado}
                            onChange={e => setFiltroJustificado(e.target.value as any)}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                        >
                            <option value="TODOS">Todas las incidencias</option>
                            <option value="CON_JUSTIFICACION">Con Justificación</option>
                            <option value="SIN_JUSTIFICACION">Pendientes (Sin Justificar)</option>
                        </select>
                    </div>
                </form>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSearchSubmit}
                            disabled={isPending}
                            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-medium transition-colors"
                        >
                            Aplicar Filtros
                        </button>
                        {(search || filtroSucursal !== 'TODAS' || filtroSupervisor !== 'TODOS' || filtroRbd !== null || fechaDesde || fechaHasta || filtroAplica !== 'TODOS' || filtroJustificado !== 'TODOS') && (
                            <button
                                onClick={handleClearFilters}
                                disabled={isPending}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                            >
                                Limpiar Filtros
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                        <span>Mostrar:</span>
                        {[10, 25, 50, 100].map(sz => (
                            <button
                                key={sz}
                                onClick={() => {
                                    setPageSize(sz)
                                    fetchData(1, sortBy, sortDir, sz)
                                }}
                                className={`px-2 py-0.5 rounded-lg font-semibold text-[11px] ${
                                    pageSize === sz
                                        ? 'bg-cyan-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {sz}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tabla de Registros */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                                <th className="py-3 px-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('fecha')}>
                                    <div className="flex items-center gap-1">
                                        <span>Fecha</span>
                                        {sortBy === 'fecha' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                    </div>
                                </th>
                                <th className="py-3 px-3">RUT Colaborador</th>
                                <th className="py-3 px-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('nombreCompleto')}>
                                    <div className="flex items-center gap-1">
                                        <span>Colaborador</span>
                                        {sortBy === 'nombreCompleto' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                    </div>
                                </th>
                                <th className="py-3 px-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('rbd')}>
                                    <div className="flex items-center gap-1">
                                        <span>RBD / Establecimiento</span>
                                        {sortBy === 'rbd' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                    </div>
                                </th>
                                <th className="py-3 px-3">Entrada / Salida</th>
                                <th className="py-3 px-3 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('minutosAtraso')}>
                                    <div className="flex items-center justify-center gap-1">
                                        <span>Atraso</span>
                                        {sortBy === 'minutosAtraso' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                    </div>
                                </th>
                                <th className="py-3 px-3 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('minutosAdelanto')}>
                                    <div className="flex items-center justify-center gap-1">
                                        <span>Adelanto</span>
                                        {sortBy === 'minutosAdelanto' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                    </div>
                                </th>
                                <th className="py-3 px-3 text-center">¿Aplica Descuento?</th>
                                <th className="py-3 px-3">Justificación y Obs.</th>
                                <th className="py-3 px-3 text-center">Gestión</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {data.data.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-gray-400">
                                        <Timer className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                        <p className="font-medium text-gray-600">No se encontraron atrasos ni salidas anticipadas</p>
                                        <p className="text-xs text-gray-400 mt-0.5">No hay registros abiertos para los filtros o colegios seleccionados.</p>
                                    </td>
                                </tr>
                            ) : (
                                data.data.map(r => (
                                    <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
                                        <td className="py-2.5 px-3 font-medium text-gray-900 whitespace-nowrap">
                                            {r.fecha}
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            <span className="font-mono text-gray-600">{r.rut}</span>
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <div className="font-semibold text-gray-900">{r.nombreCompleto}</div>
                                            {r.cargo && <div className="text-[11px] text-gray-400 truncate max-w-xs">{r.cargo}</div>}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <div className="font-medium text-gray-900">
                                                {r.rbd ? `RBD ${r.rbd}` : '-'}
                                            </div>
                                            <div className="text-[11px] text-gray-500 truncate max-w-xs" title={r.establecimiento || ''}>
                                                {r.establecimiento || 'Sin Nombre'}
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-gray-600">
                                            {r.horaFinTurno || r.salioTurno ? (
                                                <div>Fin Turno: <strong className="text-gray-900">{r.horaFinTurno || r.salioTurno}</strong></div>
                                            ) : null}
                                            {r.entro ? (
                                                <div>Entró: <strong className="text-gray-900">{r.entro}</strong></div>
                                            ) : null}
                                            <div>Salió: <strong className="text-gray-900">{r.salio || '-'}</strong></div>
                                        </td>
                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            {r.minutosAtraso > 0 ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                    {r.minutosAtraso} min
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            {r.minutosAdelanto > 0 ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                    {r.minutosAdelanto} min
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                            {r.minutosJustificados > 0 && (
                                                <span className="block text-[10px] text-emerald-600 font-semibold mt-0.5" title="Minutos justificados">
                                                    ✓ {r.minutosJustificados}m just.
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            <button
                                                onClick={() => handleToggleAplica(r)}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all shadow-xs ${
                                                    r.aplicaDescuento
                                                        ? 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200'
                                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                                }`}
                                                title="Haz clic para alternar si aplica o no descuento"
                                            >
                                                {r.aplicaDescuento ? (
                                                    <>
                                                        <Check className="w-3 h-3 text-rose-600" />
                                                        <span>APLICA</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <X className="w-3 h-3 text-emerald-600" />
                                                        <span>NO APLICA</span>
                                                    </>
                                                )}
                                            </button>
                                            {guardadoStatus[r.id] && (
                                                <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                                                    ✓ Guardado
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <div className="font-medium text-gray-900 truncate max-w-xs" title={r.justificado || ''}>
                                                {r.justificado || <span className="text-gray-400 italic">Sin justificación</span>}
                                            </div>
                                            {r.observacion && (
                                                <div className="text-[10px] text-gray-500 truncate max-w-xs" title={r.observacion}>
                                                    Obs: {r.observacion}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            <button
                                                onClick={() => setModalEdit({
                                                    isOpen: true,
                                                    registro: r,
                                                    aplicaDescuento: r.aplicaDescuento,
                                                    justificado: r.justificado || '',
                                                    observacion: r.observacion || ''
                                                })}
                                                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-cyan-700 transition-colors"
                                                title="Editar justificación y descuento"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación Inferior */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-gray-50/50 border-t border-gray-200 text-xs text-gray-500">
                    <div>
                        Mostrando del <strong className="text-gray-900">{data.total > 0 ? (pagina - 1) * pageSize + 1 : 0}</strong> al{' '}
                        <strong className="text-gray-900">{Math.min(pagina * pageSize, data.total)}</strong> de{' '}
                        <strong className="text-gray-900">{data.total.toLocaleString('es-CL')}</strong> registros
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => fetchData(pagina - 1)}
                            disabled={pagina <= 1 || isPending}
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 text-gray-600" />
                        </button>
                        <span className="px-3 py-1 font-semibold text-gray-700">
                            Página {pagina} de {totalPages}
                        </span>
                        <button
                            onClick={() => fetchData(pagina + 1)}
                            disabled={pagina >= totalPages || isPending}
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Edición de Justificación */}
            {modalEdit.isOpen && modalEdit.registro && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-cyan-50 rounded-xl text-cyan-600">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-base">Gestionar Incidencia</h3>
                                    <p className="text-xs text-gray-500">{modalEdit.registro.nombreCompleto} ({modalEdit.registro.fecha})</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setModalEdit({ isOpen: false, registro: null, aplicaDescuento: false, justificado: '', observacion: '' })}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveModal} className="space-y-4 text-xs">
                            <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Minutos Atraso:</span>
                                    <strong className="text-rose-700">{modalEdit.registro.minutosAtraso} min</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Minutos Adelanto:</span>
                                    <strong className="text-amber-700">{modalEdit.registro.minutosAdelanto} min</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Establecimiento:</span>
                                    <strong className="text-gray-800">RBD {modalEdit.registro.rbd}</strong>
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold text-gray-700 mb-1">
                                    ¿Aplica Descuento Remuneracional?
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setModalEdit(prev => ({ ...prev, aplicaDescuento: false }))}
                                        className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                                            !modalEdit.aplicaDescuento
                                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-500/20'
                                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        No Aplica (Justificado)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setModalEdit(prev => ({ ...prev, aplicaDescuento: true }))}
                                        className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                                            modalEdit.aplicaDescuento
                                                ? 'bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-500/20'
                                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        Aplica Descuento
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold text-gray-700 mb-1">
                                    Motivo o Criterio de Justificación
                                </label>
                                <input
                                    type="text"
                                    value={modalEdit.justificado}
                                    onChange={e => setModalEdit(prev => ({ ...prev, justificado: e.target.value }))}
                                    placeholder="Ej: Tráfico justificado, Autorizado por Supervisor, Permiso..."
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block font-semibold text-gray-700 mb-1">
                                    Observaciones Adicionales
                                </label>
                                <textarea
                                    value={modalEdit.observacion}
                                    onChange={e => setModalEdit(prev => ({ ...prev, observacion: e.target.value }))}
                                    rows={2}
                                    placeholder="Detalles complementarios..."
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setModalEdit({ isOpen: false, registro: null, aplicaDescuento: false, justificado: '', observacion: '' })}
                                    className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-semibold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-semibold shadow-sm transition-all"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
