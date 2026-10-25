'use client'

import React, { useState, useTransition } from 'react'
import {
    AtrasosRegistroDTO,
    AtrasosResponse,
    getAtrasosDataAction,
    cargarAtrasosAction,
    eliminarCargaAtrasosAction
} from './actions'
import {
    Clock,
    UploadCloud,
    ShieldCheck,
    RefreshCw,
    FileSpreadsheet,
    Search,
    Building2,
    MapPin,
    Eye,
    X,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    CheckCircle2,
    Briefcase,
    Calendar,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    User,
    Timer,
    AlertCircle,
    LogOut,
    LogIn,
    CheckCircle
} from 'lucide-react'

interface Props {
    initialData: AtrasosResponse
    userRole: string
}

function formatMinutesToHours(minutes: number): string {
    if (!minutes || minutes === 0) return '0 min'
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    if (h === 0) return `${m} min`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
}

export default function AtrasosAdelantosCargaClient({ initialData }: Props) {
    const [tabActivo, setTabActivo] = useState<'ADELANTO' | 'ATRASO'>(initialData.tipoActual || 'ADELANTO')
    const [data, setData] = useState<AtrasosResponse>(initialData)
    const [isPending, startTransition] = useTransition()

    // Filtros
    const [search, setSearch] = useState('')
    const [filtroSucursal, setFiltroSucursal] = useState('TODAS')
    const [filtroSupervisor, setFiltroSupervisor] = useState('TODOS')
    const [filtroRbd, setFiltroRbd] = useState<string>('')
    const [fechaDesde, setFechaDesde] = useState('')
    const [fechaHasta, setFechaHasta] = useState('')
    const [filtroAplica, setFiltroAplica] = useState<'TODOS' | 'APLICA' | 'NO_APLICA'>('TODOS')
    const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'ABIERTO' | 'CERRADO'>('TODOS')
    const [pagina, setPagina] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [sortField, setSortField] = useState<string>('fecha')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

    // Modal de subida
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [uploadTipo, setUploadTipo] = useState<'ADELANTO' | 'ATRASO'>('ADELANTO')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

    // Modal de Detalle
    const [selectedItem, setSelectedItem] = useState<AtrasosRegistroDTO | null>(null)

    // Mensaje de estado global
    const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const fetchData = (
        newPage = pagina,
        newSortField = sortField,
        newSortOrder = sortOrder,
        newPageSize = pageSize,
        tipo = tabActivo
    ) => {
        startTransition(async () => {
            const res = await getAtrasosDataAction({
                tipo,
                search: search.trim() || undefined,
                sucursal: filtroSucursal !== 'TODAS' ? filtroSucursal : undefined,
                supervisor: filtroSupervisor !== 'TODOS' ? filtroSupervisor : undefined,
                rbd: filtroRbd ? parseInt(filtroRbd, 10) : undefined,
                fechaDesde: fechaDesde || undefined,
                fechaHasta: fechaHasta || undefined,
                aplicaDescuento: filtroAplica !== 'TODOS' ? filtroAplica : undefined,
                estado: filtroEstado !== 'TODOS' ? filtroEstado : undefined,
                page: newPage,
                pageSize: newPageSize,
                sortField: newSortField,
                sortOrder: newSortOrder
            })
            if (res.success) {
                setData(res)
                setPagina(newPage)
                setSortField(newSortField)
                setSortOrder(newSortOrder)
                setPageSize(newPageSize)
                setAlertMessage(null)
            } else if (res.error) {
                setAlertMessage({ type: 'error', text: res.error })
            }
        })
    }

    const handleTabChange = (nuevoTab: 'ADELANTO' | 'ATRASO') => {
        if (nuevoTab === tabActivo) return
        setTabActivo(nuevoTab)
        setPagina(1)
        setAlertMessage(null)
        fetchData(1, sortField, sortOrder, pageSize, nuevoTab)
    }

    const handleSort = (field: string) => {
        let newOrder: 'asc' | 'desc' = 'asc'
        if (sortField === field) {
            newOrder = sortOrder === 'asc' ? 'desc' : 'asc'
        }
        setSortField(field)
        setSortOrder(newOrder)
        fetchData(1, field, newOrder, pageSize, tabActivo)
    }

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize)
        fetchData(1, sortField, sortOrder, newSize, tabActivo)
    }

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setAlertMessage(null)
        fetchData(1, sortField, sortOrder, pageSize, tabActivo)
    }

    const handleClearFilters = () => {
        setSearch('')
        setFiltroSucursal('TODAS')
        setFiltroSupervisor('TODOS')
        setFiltroRbd('')
        setFechaDesde('')
        setFechaHasta('')
        setFiltroAplica('TODOS')
        setFiltroEstado('TODOS')
        setAlertMessage(null)
        startTransition(async () => {
            const res = await getAtrasosDataAction({
                tipo: tabActivo,
                page: 1,
                pageSize,
                sortField,
                sortOrder
            })
            if (res.success) {
                setData(res)
                setPagina(1)
                setAlertMessage(null)
            }
        })
    }

    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedFile) {
            setUploadError('Por favor selecciona un archivo Excel (.xlsx o .xls)')
            return
        }
        setUploadError(null)
        setUploadSuccess(null)

        const formData = new FormData()
        formData.append('file', selectedFile)
        formData.append('tipo', uploadTipo)

        startTransition(async () => {
            const res = await cargarAtrasosAction(formData)
            if (res.success) {
                const tipoFinal = res.tipo || uploadTipo
                setUploadSuccess(`Planilla de ${tipoFinal === 'ATRASO' ? 'Atrasos' : 'Adelantos'} procesada con éxito: ${res.nuevos || 0} nuevos registros y ${res.actualizados || 0} actualizados.`)
                setSelectedFile(null)

                // Si se detectó o subió un tipo distinto al tab activo, cambiar automáticamente de tab
                if (tipoFinal !== tabActivo) {
                    setTabActivo(tipoFinal)
                }
                fetchData(1, sortField, sortOrder, pageSize, tipoFinal)

                setTimeout(() => {
                    setIsUploadModalOpen(false)
                    setUploadSuccess(null)
                }, 2200)
            } else {
                setUploadError(res.error || 'Ocurrió un error al procesar el archivo')
            }
        })
    }

    const totalPages = Math.ceil(data.total / pageSize) || 1

    return (
        <div className="space-y-6">
            {/* Header Corporativo Hendaya */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <div className="flex items-center gap-2 text-cyan-600 font-semibold text-xs tracking-wider uppercase mb-1">
                        <Clock className="w-4 h-4" />
                        <span>Áreas · Recursos Humanos · Carga Masiva</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        Atrasos y Adelantos
                        <span className="text-xs px-2.5 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-full font-medium">
                            Planilla Masiva
                        </span>
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Carga masiva, consulta y control de planillas de atrasos y salidas anticipadas. Los datos personales son protegidos mediante encriptación AES-256-GCM.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => {
                            setUploadError(null)
                            setUploadSuccess(null)
                            setSelectedFile(null)
                            setUploadTipo(tabActivo)
                            setIsUploadModalOpen(true)
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                    >
                        <UploadCloud className="w-4 h-4" />
                        <span>Cargar Planilla Excel</span>
                    </button>
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

            {/* Selector de Tabs Principales: Adelantos vs Atrasos */}
            <div className="flex border-b border-gray-200 bg-white px-4 pt-3 rounded-2xl shadow-sm border gap-3">
                <button
                    onClick={() => handleTabChange('ADELANTO')}
                    className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                        tabActivo === 'ADELANTO'
                            ? 'border-cyan-600 text-cyan-700'
                            : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                    }`}
                >
                    <LogOut className={`w-4 h-4 ${tabActivo === 'ADELANTO' ? 'text-cyan-600' : 'text-gray-400'}`} />
                    <span>Adelanto</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                        tabActivo === 'ADELANTO' ? 'bg-cyan-100 text-cyan-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                        Salidas Anticipadas
                    </span>
                </button>
                <button
                    onClick={() => handleTabChange('ATRASO')}
                    className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                        tabActivo === 'ATRASO'
                            ? 'border-cyan-600 text-cyan-700'
                            : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                    }`}
                >
                    <LogIn className={`w-4 h-4 ${tabActivo === 'ATRASO' ? 'text-cyan-600' : 'text-gray-400'}`} />
                    <span>Atrasos</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                        tabActivo === 'ATRASO' ? 'bg-cyan-100 text-cyan-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                        Entradas Tardías
                    </span>
                </button>
            </div>

            {/* Alerta Global */}
            {alertMessage && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                    alertMessage.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                    {alertMessage.type === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    ) : (
                        <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                    )}
                    <span className="text-xs font-medium">{alertMessage.text}</span>
                </div>
            )}

            {/* Tarjetas de KPIs según el Tab Activo */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {tabActivo === 'ADELANTO' ? 'Total Adelantos' : 'Total Atrasos'}
                    </span>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{data.resumen.totalRegistros.toLocaleString('es-CL')}</p>
                    <span className="text-[10px] text-gray-400 mt-0.5 block">{data.resumen.totalPersonas} colaboradores únicos</span>
                </div>

                {tabActivo === 'ADELANTO' ? (
                    <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                        <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Salidas Anticipadas</span>
                        <p className="text-2xl font-bold text-amber-700 mt-1">
                            {data.resumen.totalMinutosAdelanto.toLocaleString('es-CL')}
                            <span className="text-xs font-normal text-amber-500 ml-1">min</span>
                        </p>
                        <span className="text-[10px] text-amber-500 mt-0.5 block">{formatMinutesToHours(data.resumen.totalMinutosAdelanto)}</span>
                    </div>
                ) : (
                    <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm">
                        <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Minutos de Atraso</span>
                        <p className="text-2xl font-bold text-rose-700 mt-1">
                            {data.resumen.totalMinutosAtraso.toLocaleString('es-CL')}
                            <span className="text-xs font-normal text-rose-500 ml-1">min</span>
                        </p>
                        <span className="text-[10px] text-rose-500 mt-0.5 block">{formatMinutesToHours(data.resumen.totalMinutosAtraso)}</span>
                    </div>
                )}

                <div className="bg-white p-4 rounded-2xl border border-cyan-100 shadow-sm">
                    <span className="text-[11px] font-semibold text-cyan-600 uppercase tracking-wider">RBDs con Incidencias</span>
                    <p className="text-2xl font-bold text-cyan-700 mt-1">{data.resumen.totalRbds}</p>
                    <span className="text-[10px] text-cyan-500 mt-0.5 block">Establecimientos activos</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm">
                    <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Justificados</span>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">{data.resumen.totalJustificados}</p>
                    <span className="text-[10px] text-emerald-500 mt-0.5 block">{formatMinutesToHours(data.resumen.totalMinutosJustificados || 0)} justificados</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-sm">
                    <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">Aplica Descuento</span>
                    <p className="text-2xl font-bold text-purple-700 mt-1">{data.resumen.totalAplicaDescuento}</p>
                    <span className="text-[10px] text-purple-500 mt-0.5 block">Para nómina/remuneración</span>
                </div>
            </div>

            {/* Banner de Última Carga del Tab Activo */}
            {data.ultimaCarga && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-cyan-50/70 to-sky-50/70 border border-cyan-200/80 rounded-2xl text-xs">
                    <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="w-5 h-5 text-cyan-700 flex-shrink-0" />
                        <div>
                            <span className="font-semibold text-cyan-950">
                                Última Planilla de {tabActivo === 'ADELANTO' ? 'Adelantos' : 'Atrasos'}:
                            </span>{' '}
                            <span className="text-cyan-800 font-medium">{data.ultimaCarga.nombreArchivo}</span>
                            <span className="text-cyan-600 text-[11px] ml-2">
                                ({new Date(data.ultimaCarga.fechaCarga).toLocaleString('es-CL')} por {data.ultimaCarga.cargadoPor})
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 rounded-md font-bold text-[11px]">
                            {data.ultimaCarga.totalRegistros} filas
                        </span>
                    </div>
                </div>
            )}

            {/* Barra de Filtros */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                            Búsqueda Directa (RUT, Nombre, Colegio)
                        </label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Ej: 12345678-9, González, Liceo..."
                                className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                            />
                        </div>
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                            Sucursal / Sede
                        </label>
                        <select
                            value={filtroSucursal}
                            onChange={e => setFiltroSucursal(e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                        >
                            <option value="TODAS">Todas las Sedes</option>
                            {data.resumen.sucursalesList.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                            Supervisor
                        </label>
                        <select
                            value={filtroSupervisor}
                            onChange={e => setFiltroSupervisor(e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                        >
                            <option value="TODOS">Todos los Supervisores</option>
                            {data.resumen.supervisoresList.map(sup => (
                                <option key={sup} value={sup}>{sup}</option>
                            ))}
                        </select>
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                            Fecha Desde
                        </label>
                        <input
                            type="date"
                            value={fechaDesde}
                            onChange={e => setFechaDesde(e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                            Fecha Hasta
                        </label>
                        <input
                            type="date"
                            value={fechaHasta}
                            onChange={e => setFechaHasta(e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                        />
                    </div>
                </form>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSearchSubmit}
                            disabled={isPending}
                            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-medium transition-colors cursor-pointer"
                        >
                            Aplicar Filtros
                        </button>
                        {(search || filtroSucursal !== 'TODAS' || filtroSupervisor !== 'TODOS' || fechaDesde || fechaHasta || filtroAplica !== 'TODOS' || filtroEstado !== 'TODOS') && (
                            <button
                                onClick={handleClearFilters}
                                disabled={isPending}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors cursor-pointer"
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
                                onClick={() => handlePageSizeChange(sz)}
                                className={`px-2 py-0.5 rounded-lg font-semibold text-[11px] cursor-pointer ${
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

            {/* Tabla de Registros adaptada al Tab Activo */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                                <th className="py-3 px-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('fecha')}>
                                    <div className="flex items-center gap-1">
                                        <span>Fecha</span>
                                        {sortField === 'fecha' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                    </div>
                                </th>
                                <th className="py-3 px-3">RUT Colaborador</th>
                                <th className="py-3 px-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('nombreCompleto')}>
                                    <div className="flex items-center gap-1">
                                        <span>Colaborador</span>
                                        {sortField === 'nombreCompleto' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                    </div>
                                </th>
                                <th className="py-3 px-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('rbd')}>
                                    <div className="flex items-center gap-1">
                                        <span>RBD / Establecimiento</span>
                                        {sortField === 'rbd' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                    </div>
                                </th>
                                <th className="py-3 px-3">Sede</th>

                                {tabActivo === 'ADELANTO' ? (
                                    <>
                                        <th className="py-3 px-3">Fin Turno / Salida</th>
                                        <th className="py-3 px-3 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('minutosAdelanto')}>
                                            <div className="flex items-center justify-center gap-1">
                                                <span>Adelanto</span>
                                                {sortField === 'minutosAdelanto' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                            </div>
                                        </th>
                                    </>
                                ) : (
                                    <>
                                        <th className="py-3 px-3">Turno / Llegada</th>
                                        <th className="py-3 px-3 text-center">Holgura</th>
                                        <th className="py-3 px-3 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('minutosAtraso')}>
                                            <div className="flex items-center justify-center gap-1">
                                                <span>Atraso</span>
                                                {sortField === 'minutosAtraso' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                            </div>
                                        </th>
                                    </>
                                )}

                                <th className="py-3 px-3 text-center">Justificación</th>
                                <th className="py-3 px-3 text-center">Descuento</th>
                                <th className="py-3 px-3 text-center">Estado</th>
                                <th className="py-3 px-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {data.registros.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="py-12 text-center text-gray-400">
                                        <Timer className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                        <p className="font-medium text-gray-600">
                                            No se encontraron registros de {tabActivo === 'ADELANTO' ? 'adelantos' : 'atrasos'}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">Sube una planilla Excel o ajusta los filtros aplicados.</p>
                                    </td>
                                </tr>
                            ) : (
                                data.registros.map(r => (
                                    <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
                                        <td className="py-2.5 px-3 font-medium text-gray-900 whitespace-nowrap">
                                            {r.fecha}
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            <span className="font-mono text-gray-600">{r.identificador}</span>
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <div className="font-semibold text-gray-900">{r.nombreCompleto}</div>
                                            {r.cargo && <div className="text-[11px] text-gray-400 truncate max-w-xs">{r.cargo}</div>}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <div className="font-medium text-gray-900">
                                                {r.rbd ? `RBD ${r.rbd}` : (r.rbdRaw || '-')}
                                            </div>
                                            <div className="text-[11px] text-gray-500 truncate max-w-xs" title={r.establecimiento || ''}>
                                                {r.establecimiento || 'Sin Nombre'}
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-700">
                                                {r.sucursal}
                                            </span>
                                        </td>

                                        {tabActivo === 'ADELANTO' ? (
                                            <>
                                                <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-gray-600">
                                                    <div>Fin Turno: <strong className="text-gray-900">{r.horaFinTurno || r.salioTurno || '-'}</strong></div>
                                                    <div>Salió: <strong className="text-gray-900">{r.salio || '-'}</strong></div>
                                                </td>
                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                    {r.minutosAdelanto > 0 ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                            {r.minutosAdelanto} min
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-gray-600">
                                                    <div>Turno: <strong className="text-gray-900">{r.horaInicioTurno || r.turno || '-'}</strong></div>
                                                    <div>Llegó: <strong className="text-gray-900">{r.horaLlegada || r.entro || '-'}</strong></div>
                                                </td>
                                                <td className="py-2.5 px-3 text-center whitespace-nowrap text-[11px] text-gray-500">
                                                    {r.holguraMin ? `${r.holguraMin} min` : '-'}
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
                                            </>
                                        )}

                                        <td className="py-2.5 px-3 text-center">
                                            {r.justificado ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 truncate max-w-[120px]" title={r.justificado}>
                                                    {r.justificado}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-[11px]">Pendiente</span>
                                            )}
                                        </td>

                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            {r.aplicaDescuento ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                    APLICA
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-gray-600 border border-gray-200">
                                                    NO APLICA
                                                </span>
                                            )}
                                        </td>

                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                r.estado === 'ABIERTO'
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                            }`}>
                                                {r.estado}
                                            </span>
                                        </td>

                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            <button
                                                onClick={() => setSelectedItem(r)}
                                                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-cyan-700 transition-colors cursor-pointer"
                                                title="Ver detalle completo"
                                            >
                                                <Eye className="w-4 h-4" />
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
                        Mostrando registros del{' '}
                        <strong className="text-gray-900">{data.total > 0 ? (pagina - 1) * pageSize + 1 : 0}</strong> al{' '}
                        <strong className="text-gray-900">{Math.min(pagina * pageSize, data.total)}</strong> de un total de{' '}
                        <strong className="text-gray-900">{data.total.toLocaleString('es-CL')}</strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => fetchData(pagina - 1)}
                            disabled={pagina <= 1 || isPending}
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4 text-gray-600" />
                        </button>
                        <span className="px-3 py-1 font-semibold text-gray-700">
                            Página {pagina} de {totalPages}
                        </span>
                        <button
                            onClick={() => fetchData(pagina + 1)}
                            disabled={pagina >= totalPages || isPending}
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Subida de Archivo Excel */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-cyan-50 rounded-xl text-cyan-600">
                                    <FileSpreadsheet className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-base">Cargar Planilla Excel</h3>
                                    <p className="text-xs text-gray-500">
                                        Sube planillas de Atrasos o Salidas Anticipadas (Adelantos)
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsUploadModalOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Selector de Tipo en el Modal */}
                        <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setUploadTipo('ADELANTO')}
                                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    uploadTipo === 'ADELANTO' ? 'bg-white text-cyan-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Adelanto (Salida Anticipada)
                            </button>
                            <button
                                type="button"
                                onClick={() => setUploadTipo('ATRASO')}
                                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    uploadTipo === 'ATRASO' ? 'bg-white text-cyan-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Atrasos (Llegada Tardía)
                            </button>
                        </div>

                        {uploadError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                <span>{uploadError}</span>
                            </div>
                        )}

                        {uploadSuccess && (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs">
                                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                <span>{uploadSuccess}</span>
                            </div>
                        )}

                        <form onSubmit={handleUploadSubmit} className="space-y-4">
                            <div className="border-2 border-dashed border-gray-200 hover:border-cyan-500 rounded-2xl p-6 text-center transition-colors">
                                <UploadCloud className="w-10 h-10 text-cyan-500 mx-auto mb-2" />
                                <label className="cursor-pointer">
                                    <span className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 underline">
                                        Selecciona un archivo Excel
                                    </span>
                                    <span className="text-xs text-gray-500"> o arrástralo aquí</span>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={e => {
                                            if (e.target.files && e.target.files[0]) {
                                                setSelectedFile(e.target.files[0])
                                                setUploadError(null)
                                            }
                                        }}
                                        className="hidden"
                                    />
                                </label>
                                {selectedFile && (
                                    <div className="mt-3 p-2 bg-cyan-50/50 rounded-xl text-xs font-medium text-cyan-900 flex items-center justify-center gap-2">
                                        <FileSpreadsheet className="w-4 h-4 text-cyan-600" />
                                        <span>{selectedFile.name}</span>
                                        <span className="text-[10px] text-cyan-500">
                                            ({Math.round(selectedFile.size / 1024)} KB)
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="p-3 bg-cyan-50/70 border border-cyan-200/80 rounded-xl text-[11px] text-cyan-900 space-y-1">
                                <p className="font-semibold text-cyan-950 flex items-center gap-1.5">
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-600" />
                                    <span>Detección automática compatible Hendaya:</span>
                                </p>
                                <p className="text-[10px] text-cyan-800 leading-relaxed">
                                    {uploadTipo === 'ATRASO' ? (
                                        <>Formatos de Atrasos: <em>Apellidos, Nombre, Grupo Usuario, Rut, Fecha, Hora Inicio Turno, Holgura (min), Hora Llegada, Minutos de Atraso, Minutos Justificados, Grupo marcación, Cargo, Justificado por, Comentario.</em></>
                                    ) : (
                                        <>Formatos de Adelanto: <em>Apellidos, Nombre, Grupo Usuario, Rut, Fecha, Hora Fin Turno, Hora Salida, Minutos Adelanto, Minutos Justificados, Centro de Costos, Cargo, Justificado por, Comentario.</em></>
                                    )}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-gray-500 bg-gray-50 p-3 rounded-xl">
                                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                <span>Los datos sensibles de RUT, nombres y apellidos se encriptan con AES-256-GCM.</span>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsUploadModalOpen(false)}
                                    className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-semibold cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!selectedFile || isPending}
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                >
                                    {isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                                    <span>{isPending ? 'Procesando...' : 'Subir y Procesar'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Detalle Completo */}
            {selectedItem && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-cyan-50 rounded-xl text-cyan-600">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-base">{selectedItem.nombreCompleto}</h3>
                                    <p className="text-xs text-gray-500 font-mono">
                                        RUT: {selectedItem.identificador} · Tipo: {selectedItem.tipo}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-3 bg-gray-50 rounded-xl">
                                <span className="text-[10px] uppercase font-semibold text-gray-400 block">Fecha</span>
                                <strong className="text-gray-900">{selectedItem.fecha}</strong>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl">
                                <span className="text-[10px] uppercase font-semibold text-gray-400 block">Sede</span>
                                <strong className="text-gray-900">{selectedItem.sucursal}</strong>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl">
                                <span className="text-[10px] uppercase font-semibold text-gray-400 block">Establecimiento</span>
                                <strong className="text-gray-900">
                                    {selectedItem.rbd ? `RBD ${selectedItem.rbd} - ` : ''}{selectedItem.establecimiento || 'Sin Nombre'}
                                </strong>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl">
                                <span className="text-[10px] uppercase font-semibold text-gray-400 block">Supervisor</span>
                                <strong className="text-gray-900">{selectedItem.supervisor || 'Sin Asignar'}</strong>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl">
                                <span className="text-[10px] uppercase font-semibold text-gray-400 block">Cargo</span>
                                <strong className="text-gray-900">{selectedItem.cargo || '-'}</strong>
                            </div>

                            {selectedItem.tipo === 'ATRASO' ? (
                                <>
                                    <div className="p-3 bg-gray-50 rounded-xl">
                                        <span className="text-[10px] uppercase font-semibold text-gray-400 block">Turno Inicio / Llegada</span>
                                        <strong className="text-gray-900">
                                            Turno: {selectedItem.horaInicioTurno || selectedItem.turno || '-'} | Llegó: {selectedItem.horaLlegada || selectedItem.entro || '-'}
                                        </strong>
                                    </div>
                                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                                        <span className="text-[10px] uppercase font-semibold text-rose-600 block">Minutos Atraso</span>
                                        <strong className="text-rose-700 text-sm">{selectedItem.minutosAtraso} min</strong>
                                        {selectedItem.holguraMin ? (
                                            <span className="text-[10px] text-rose-500 block mt-0.5">Holgura: {selectedItem.holguraMin} min</span>
                                        ) : null}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="p-3 bg-gray-50 rounded-xl">
                                        <span className="text-[10px] uppercase font-semibold text-gray-400 block">Fin Turno / Salida</span>
                                        <strong className="text-gray-900">
                                            Turno: {selectedItem.horaFinTurno || selectedItem.salioTurno || '-'} | Salió: {selectedItem.salio || '-'}
                                        </strong>
                                    </div>
                                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                                        <span className="text-[10px] uppercase font-semibold text-amber-600 block">Minutos Adelanto</span>
                                        <strong className="text-amber-700 text-sm">{selectedItem.minutosAdelanto} min</strong>
                                    </div>
                                </>
                            )}

                            {selectedItem.minutosJustificados > 0 && (
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <span className="text-[10px] uppercase font-semibold text-emerald-700 block">Minutos Justificados</span>
                                    <strong className="text-emerald-800 text-sm">{selectedItem.minutosJustificados} min</strong>
                                    {selectedItem.justificadoPor && (
                                        <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium truncate" title={selectedItem.justificadoPor}>
                                            Por: {selectedItem.justificadoPor}
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                                <span className="text-[10px] uppercase font-semibold text-purple-700 block">Aplica Descuento</span>
                                <strong className={selectedItem.aplicaDescuento ? 'text-rose-700 font-bold' : 'text-gray-700'}>
                                    {selectedItem.aplicaDescuento ? 'SÍ (Aplica descuento)' : 'NO'}
                                </strong>
                            </div>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-xl text-xs space-y-1">
                            <span className="text-[10px] uppercase font-semibold text-gray-400 block">Justificación / Motivo</span>
                            <p className="text-gray-700 font-medium">{selectedItem.justificado || 'Sin justificación registrada.'}</p>
                            {selectedItem.observacion && (
                                <p className="text-gray-500 text-[11px] mt-1 border-t border-gray-200/60 pt-1">
                                    Obs: {selectedItem.observacion}
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
