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
    ArrowDown,
    Lock,
    LogIn,
    LogOut
} from 'lucide-react'

interface InitialData {
    data: AsistenciaAtrasosRegistroDTO[]
    total: number
    page: number
    pageSize: number
    sucursales: string[]
    supervisores: string[]
    establecimientos: { rbd: number; establecimiento: string }[]
    tipoActual?: 'ADELANTO' | 'ATRASO'
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
    hasConfiguredPersonal?: boolean
    totalPersonalAsignado?: number
}

export default function AsistenciaAtrasosClient({
    initialData,
    userRbds,
    isAdmin,
    hasConfiguredPersonal = false,
    totalPersonalAsignado = 0
}: Props) {
    const [tipoActivo, setTipoActivo] = useState<'ADELANTO' | 'ATRASO'>(initialData.tipoActual || 'ADELANTO')
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
    const [togglingId, setTogglingId] = useState<string | null>(null)
    const [mensajeFeedback, setMensajeFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

    const fetchData = (
        newPage = pagina,
        newSortBy = sortBy,
        newSortDir = sortDir,
        newPageSize = pageSize,
        targetTipo = tipoActivo
    ) => {
        startTransition(async () => {
            const res = await getAsistenciaAtrasosAction({
                tipo: targetTipo,
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
                    tipoActual: res.tipoActual || targetTipo,
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

    const handleCambioTipo = (nuevoTipo: 'ADELANTO' | 'ATRASO') => {
        if (nuevoTipo === tipoActivo) return
        setTipoActivo(nuevoTipo)
        setPagina(1)
        fetchData(1, sortBy, sortDir, pageSize, nuevoTipo)
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
                tipo: tipoActivo,
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
                    tipoActual: res.tipoActual || tipoActivo,
                    resumen: res.resumen
                })
                setPagina(1)
            }
        })
    }

    // Toggle rápido de Aplica Descuento (botón deslizante para celular y escritorio)
    const handleToggleAplica = async (registro: AsistenciaAtrasosRegistroDTO) => {
        if (registro.estado === 'CERRADO') {
            alert('El período correspondiente a esta planilla se encuentra CERRADO. No es posible modificar registros en un período cerrado.')
            return
        }

        if (!isAdmin && registro.aplicaModificadoPor) {
            alert(`Este registro ya fue modificado previamente por ${registro.aplicaModificadoPor} y se encuentra bloqueado. Para corregir o rectificar el estado, debe solicitarlo a través del módulo de Administración.`)
            return
        }

        const nuevoValor = !registro.aplicaDescuento
        const diff = nuevoValor ? 1 : -1

        // Optimistic update en la grilla y en el contador de la tarjeta KPI
        setData(prev => ({
            ...prev,
            data: prev.data.map(r => r.id === registro.id ? {
                ...r,
                aplicaDescuento: nuevoValor,
                aplicaModificadoPor: r.aplicaModificadoPor || 'Tú',
                aplicaModificadoAt: new Date().toISOString()
            } : r),
            resumen: prev.resumen ? {
                ...prev.resumen,
                totalAplicaDescuento: Math.max(0, (prev.resumen.totalAplicaDescuento ?? 0) + diff)
            } : prev.resumen
        }))
        setTogglingId(registro.id)

        try {
            const res = await actualizarGestionAtrasoAction(
                registro.id,
                nuevoValor,
                registro.justificado || undefined,
                registro.observacion || undefined
            )

            if (res.success) {
                if (res.aplicaModificadoPor) {
                    setData(prev => ({
                        ...prev,
                        data: prev.data.map(r => r.id === registro.id ? {
                            ...r,
                            aplicaModificadoPor: res.aplicaModificadoPor || r.aplicaModificadoPor
                        } : r)
                    }))
                }
                setGuardadoStatus(prev => ({ ...prev, [registro.id]: true }))
                setTimeout(() => {
                    setGuardadoStatus(prev => {
                        const copy = { ...prev }
                        delete copy[registro.id]
                        return copy
                    })
                }, 2000)
            } else {
                // Revertir optimismo en caso de error
                setData(prev => ({
                    ...prev,
                    data: prev.data.map(r => r.id === registro.id ? { ...r, aplicaDescuento: registro.aplicaDescuento } : r),
                    resumen: prev.resumen ? {
                        ...prev.resumen,
                        totalAplicaDescuento: Math.max(0, (prev.resumen.totalAplicaDescuento ?? 0) - diff)
                    } : prev.resumen
                }))
                alert(res.error || 'Error al actualizar estado')
            }
        } catch (err: any) {
            setData(prev => ({
                ...prev,
                data: prev.data.map(r => r.id === registro.id ? { ...r, aplicaDescuento: registro.aplicaDescuento } : r),
                resumen: prev.resumen ? {
                    ...prev.resumen,
                    totalAplicaDescuento: Math.max(0, (prev.resumen.totalAplicaDescuento ?? 0) - diff)
                } : prev.resumen
            }))
            alert(err?.message || 'Error de conexión al servidor')
        } finally {
            setTogglingId(null)
        }
    }

    // Guardar edición del modal
    const handleSaveModal = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!modalEdit.registro) return

        if (!isAdmin && modalEdit.registro.aplicaModificadoPor) {
            alert(`Este registro ya fue modificado previamente por ${modalEdit.registro.aplicaModificadoPor} y se encuentra bloqueado. Para corregir o rectificar, debe ser gestionado desde el módulo de Administración.`)
            return
        }

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

            {/* Aviso de RBDs restringidos para el perfil o Personal Asignado */}
            {hasConfiguredPersonal ? (
                <div className="flex items-center gap-2.5 p-3.5 bg-cyan-50 border border-cyan-200 rounded-xl text-cyan-900 text-xs shadow-sm">
                    <Info className="w-4 h-4 flex-shrink-0 text-cyan-600" />
                    <span>
                        Visualización por Personal Asignado: Tienes <strong>{totalPersonalAsignado}</strong> colaboradores asignados a tu jefatura según el mantenedor <strong>Configuración de Visualización</strong>.
                    </span>
                </div>
            ) : !isAdmin && userRbds.length > 0 ? (
                <div className="flex items-center gap-2.5 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-800 text-xs shadow-sm">
                    <Info className="w-4 h-4 flex-shrink-0 text-amber-600" />
                    <span>
                        Acceso restringido por perfil: Solo puedes visualizar los <strong>{userRbds.length}</strong> establecimientos autorizados en tu cuenta de usuario.
                    </span>
                </div>
            ) : !isAdmin && userRbds.length === 0 ? (
                <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs shadow-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                    <span>
                        Sin colegios autorizados: Tu cuenta de usuario aún no tiene RBDs asignados en el mantenedor correspondiente. Contacta al Administrador.
                    </span>
                </div>
            ) : null}

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

            {/* Selector Principal de Tipo: Adelanto vs Atrasos */}
            <div className="flex items-center gap-2 border-b border-gray-200">
                <button
                    onClick={() => handleCambioTipo('ADELANTO')}
                    className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                        tipoActivo === 'ADELANTO'
                            ? 'border-cyan-600 text-cyan-700'
                            : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                    }`}
                >
                    <LogOut className={`w-4 h-4 ${tipoActivo === 'ADELANTO' ? 'text-cyan-600' : 'text-gray-400'}`} />
                    <span>Adelanto</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                        tipoActivo === 'ADELANTO' ? 'bg-cyan-100 text-cyan-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                        Salidas Anticipadas
                    </span>
                </button>
                <button
                    onClick={() => handleCambioTipo('ATRASO')}
                    className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                        tipoActivo === 'ATRASO'
                            ? 'border-cyan-600 text-cyan-700'
                            : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                    }`}
                >
                    <LogIn className={`w-4 h-4 ${tipoActivo === 'ATRASO' ? 'text-cyan-600' : 'text-gray-400'}`} />
                    <span>Atrasos</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                        tipoActivo === 'ATRASO' ? 'bg-cyan-100 text-cyan-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                        Entradas Tardías
                    </span>
                </button>
            </div>

            {/* Tarjetas de KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {tipoActivo === 'ADELANTO' ? 'Total Adelantos' : 'Total Atrasos'}
                    </span>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{data.total.toLocaleString('es-CL')}</p>
                    <span className="text-[10px] text-gray-400 mt-0.5 block">En períodos abiertos</span>
                </div>
                {tipoActivo === 'ADELANTO' ? (
                    <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                        <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Salidas Anticipadas</span>
                        <p className="text-2xl font-bold text-amber-700 mt-1">
                            {totalAdelantoMin.toLocaleString('es-CL')}
                            <span className="text-xs font-normal text-amber-500 ml-1">min</span>
                        </p>
                        <span className="text-[10px] text-amber-500 mt-0.5 block">{formatMinutesToHours(totalAdelantoMin)}</span>
                    </div>
                ) : (
                    <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm">
                        <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Minutos de Atraso</span>
                        <p className="text-2xl font-bold text-rose-700 mt-1">
                            {totalAtrasoMin.toLocaleString('es-CL')}
                            <span className="text-xs font-normal text-rose-500 ml-1">min</span>
                        </p>
                        <span className="text-[10px] text-rose-500 mt-0.5 block">{formatMinutesToHours(totalAtrasoMin)}</span>
                    </div>
                )}
                <div className="bg-white p-4 rounded-2xl border border-cyan-100 shadow-sm">
                    <span className="text-[11px] font-semibold text-cyan-600 uppercase tracking-wider">Aplica Descuento</span>
                    <p className="text-2xl font-bold text-cyan-700 mt-1">{aplicandoDescCount.toLocaleString('es-CL')}</p>
                    <span className="text-[10px] text-cyan-500 mt-0.5 block">Registros con descuento</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm">
                    <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Justificados</span>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">
                        {(data.resumen?.totalJustificados ?? data.data.filter(r => !!r.justificado || r.minutosJustificados > 0).length).toLocaleString('es-CL')}
                    </p>
                    <span className="text-[10px] text-emerald-500 mt-0.5 block">Registros con justificación</span>
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
                                {tipoActivo === 'ADELANTO' ? (
                                    <>
                                        <th className="py-3 px-3">Fin Turno / Salida Real</th>
                                        <th className="py-3 px-3 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('minutosAdelanto')}>
                                            <div className="flex items-center justify-center gap-1">
                                                <span>Adelanto</span>
                                                {sortBy === 'minutosAdelanto' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                            </div>
                                        </th>
                                    </>
                                ) : (
                                    <>
                                        <th className="py-3 px-3">Turno / Llegada Real</th>
                                        <th className="py-3 px-3 text-center">Holgura</th>
                                        <th className="py-3 px-3 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('minutosAtraso')}>
                                            <div className="flex items-center justify-center gap-1">
                                                <span>Atraso</span>
                                                {sortBy === 'minutosAtraso' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                            </div>
                                        </th>
                                    </>
                                )}
                                <th className="py-3 px-3 text-center">¿Aplica Descuento?</th>
                                <th className="py-3 px-3">Justificación y Obs.</th>
                                <th className="py-3 px-3 text-center">Gestión</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {data.data.length === 0 ? (
                                <tr>
                                    <td colSpan={tipoActivo === 'ADELANTO' ? 9 : 10} className="py-12 text-center text-gray-400">
                                        <Timer className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                        <p className="font-medium text-gray-600">
                                            No se encontraron {tipoActivo === 'ADELANTO' ? 'adelantos ni salidas anticipadas' : 'atrasos ni entradas tardías'}
                                        </p>
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
                                        {tipoActivo === 'ADELANTO' ? (
                                            <>
                                                <td className="py-2.5 px-3 text-xs">
                                                    <div className="text-gray-900 font-medium">Fin: {r.horaFinTurno || r.salioTurno || r.turno || '-'}</div>
                                                    <div className="text-[11px] text-gray-500">Salida: {r.horaSalida || r.salio || '-'}</div>
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
                                            </>
                                        ) : (
                                            <>
                                                <td className="py-2.5 px-3 text-xs">
                                                    <div className="text-gray-900 font-medium">Turno: {r.horaInicioTurno || r.turno || '-'}</div>
                                                    <div className="text-[11px] text-gray-500">Llegada: {r.horaLlegada || r.entro || '-'}</div>
                                                </td>
                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700">
                                                        {r.holguraMin ?? 0}m
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                    {r.minutosAtraso > 0 ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                            {r.minutosAtraso} min
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
                                            </>
                                        )}
                                        <td className="py-2.5 px-3 text-center whitespace-nowrap min-w-[110px]">
                                            {(() => {
                                                const isBloqueado = (!isAdmin && Boolean(r.aplicaModificadoPor)) || r.estado === 'CERRADO'
                                                return (
                                                    <div className="flex flex-col items-center justify-center gap-0.5 py-0.5">
                                                        <button
                                                            type="button"
                                                            role="switch"
                                                            aria-checked={r.aplicaDescuento}
                                                            disabled={isBloqueado || togglingId === r.id}
                                                            onClick={() => handleToggleAplica(r)}
                                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1 select-none ${
                                                                r.aplicaDescuento ? 'bg-rose-600' : 'bg-slate-300 hover:bg-slate-400'
                                                            } ${isBloqueado ? 'opacity-40 cursor-not-allowed' : ''} ${togglingId === r.id ? 'opacity-70 cursor-wait' : ''}`}
                                                            title={
                                                                r.estado === 'CERRADO'
                                                                    ? 'Período cerrado (solo lectura)'
                                                                    : !isAdmin && r.aplicaModificadoPor
                                                                    ? `Registro bloqueado: Modificado por ${r.aplicaModificadoPor}. Solo un administrador puede corregirlo.`
                                                                    : r.aplicaDescuento
                                                                    ? 'Descuento activo: Clic o toca para cambiar a NO APLICA'
                                                                    : 'Sin descuento: Clic o toca para cambiar a APLICA'
                                                            }
                                                        >
                                                            <span className="sr-only">Alternar descuento</span>
                                                            <span
                                                                aria-hidden="true"
                                                                className={`pointer-events-none inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                                                    r.aplicaDescuento ? 'translate-x-5' : 'translate-x-0'
                                                                }`}
                                                            >
                                                                {togglingId === r.id ? (
                                                                    <RefreshCw className="w-2.5 h-2.5 text-gray-500 animate-spin" />
                                                                ) : r.aplicaDescuento ? (
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                                                ) : (
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                                )}
                                                            </span>
                                                        </button>
                                                        <span className={`text-[10px] font-bold tracking-tight select-none mt-0.5 ${
                                                            r.aplicaDescuento ? 'text-rose-700' : 'text-slate-500'
                                                        }`}>
                                                            {r.aplicaDescuento ? 'APLICA' : 'NO APLICA'}
                                                        </span>
                                                        {!isAdmin && r.aplicaModificadoPor && (
                                                            <span
                                                                className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md mt-0.5 select-none"
                                                                title={`Modificado por ${r.aplicaModificadoPor}. Solo Administración puede cambiarlo.`}
                                                            >
                                                                <Lock className="w-2.5 h-2.5 text-amber-600 flex-shrink-0" />
                                                                <span>Bloqueado</span>
                                                            </span>
                                                        )}
                                                        {guardadoStatus[r.id] && (
                                                            <span className="text-[9px] font-semibold text-emerald-600 flex items-center gap-0.5 animate-pulse">
                                                                ✓ Guardado
                                                            </span>
                                                        )}
                                                    </div>
                                                )
                                            })()}
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
                                            {(!isAdmin && Boolean(r.aplicaModificadoPor)) || r.estado === 'CERRADO' ? (
                                                <span
                                                    className="inline-flex p-1.5 rounded-lg text-amber-700 bg-amber-50 border border-amber-200 cursor-not-allowed"
                                                    title={
                                                        r.estado === 'CERRADO'
                                                            ? 'Período cerrado (solo lectura)'
                                                            : `Registro bloqueado tras ser gestionado por ${r.aplicaModificadoPor}. Solo un administrador puede modificarlo.`
                                                    }
                                                >
                                                    <Lock className="w-4 h-4 text-amber-600" />
                                                </span>
                                            ) : (
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
                                            )}
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
                                {modalEdit.registro.tipo === 'ADELANTO' ? (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Fin Turno / Salida:</span>
                                            <strong className="text-gray-800">
                                                {modalEdit.registro.horaFinTurno || modalEdit.registro.salioTurno || modalEdit.registro.turno || '-'} / {modalEdit.registro.horaSalida || modalEdit.registro.salio || '-'}
                                            </strong>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Minutos Adelanto:</span>
                                            <strong className="text-amber-700">{modalEdit.registro.minutosAdelanto} min</strong>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Turno / Llegada:</span>
                                            <strong className="text-gray-800">
                                                {modalEdit.registro.horaInicioTurno || modalEdit.registro.turno || '-'} / {modalEdit.registro.horaLlegada || modalEdit.registro.entro || '-'}
                                            </strong>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Minutos Atraso:</span>
                                            <strong className="text-rose-700">{modalEdit.registro.minutosAtraso} min</strong>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Holgura:</span>
                                            <strong className="text-gray-700">{modalEdit.registro.holguraMin ?? 0} min</strong>
                                        </div>
                                    </>
                                )}
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
