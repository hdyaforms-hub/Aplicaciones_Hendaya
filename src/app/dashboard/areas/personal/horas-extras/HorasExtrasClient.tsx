'use client'

import React, { useState, useTransition } from 'react'
import {
    HorasExtrasRegistroDTO,
    HorasExtrasResponse,
    getHorasExtrasDataAction,
    cargarHorasExtrasAction,
    cargarHorasExtrasDesdeArchivoLocalAction,
    eliminarHorasExtrasAction,
    exportarHorasExtrasExcelAction
} from './actions'
import { formatHorasMinutos, formatHorasMinutosTexto } from '@/lib/personal-time-format'
import {
    Clock,
    UploadCloud,
    ShieldCheck,
    Download,
    RefreshCw,
    FileSpreadsheet,
    Search,
    Building2,
    MapPin,
    CreditCard,
    Trash2,
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
    DollarSign,
    User,
    CheckCircle
} from 'lucide-react'

interface Props {
    initialData: HorasExtrasResponse
    userRole: string
}

export default function HorasExtrasClient({ initialData, userRole }: Props) {
    const [data, setData] = useState<HorasExtrasResponse>(initialData)
    const [isPending, startTransition] = useTransition()

    // Filtros
    const [search, setSearch] = useState('')
    const [filtroSucursal, setFiltroSucursal] = useState('TODAS')
    const [filtroSupervisor, setFiltroSupervisor] = useState('TODOS')
    const [filtroRbd, setFiltroRbd] = useState<string>('')
    const [fechaDesde, setFechaDesde] = useState('')
    const [fechaHasta, setFechaHasta] = useState('')
    const [pagina, setPagina] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [sortField, setSortField] = useState<string>('fecha')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

    // Modal de subida de archivo
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

    // Modal de Detalle / Ficha Completa del colaborador
    const [selectedItem, setSelectedItem] = useState<HorasExtrasRegistroDTO | null>(null)

    // Mensaje de estado global
    const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Cargar datos del servidor con los filtros y ordenamiento actuales
    const fetchData = (
        newPage = pagina,
        newSortField = sortField,
        newSortOrder = sortOrder,
        newPageSize = pageSize
    ) => {
        startTransition(async () => {
            const res = await getHorasExtrasDataAction({
                search: search.trim() || undefined,
                sucursal: filtroSucursal !== 'TODAS' ? filtroSucursal : undefined,
                supervisor: filtroSupervisor !== 'TODOS' ? filtroSupervisor : undefined,
                rbd: filtroRbd ? parseInt(filtroRbd, 10) : undefined,
                fechaDesde: fechaDesde || undefined,
                fechaHasta: fechaHasta || undefined,
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
                setAlertMessage(null) // Limpiar cualquier alerta residual
            } else if (res.error) {
                setAlertMessage({ type: 'error', text: res.error })
            }
        })
    }

    const handleSort = (field: string) => {
        let newOrder: 'asc' | 'desc' = 'asc'
        if (sortField === field) {
            newOrder = sortOrder === 'asc' ? 'desc' : 'asc'
        }
        setSortField(field)
        setSortOrder(newOrder)
        fetchData(1, field, newOrder, pageSize)
    }

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize)
        fetchData(1, sortField, sortOrder, newSize)
    }

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setAlertMessage(null)
        fetchData(1, sortField, sortOrder, pageSize)
    }

    const handleClearFilters = () => {
        setSearch('')
        setFiltroSucursal('TODAS')
        setFiltroSupervisor('TODOS')
        setFiltroRbd('')
        setFechaDesde('')
        setFechaHasta('')
        setAlertMessage(null)
        startTransition(async () => {
            const res = await getHorasExtrasDataAction({
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

    // Subir archivo Excel
    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedFile) {
            setUploadError('Por favor selecciona un archivo .xlsx')
            return
        }

        setUploadError(null)
        setUploadSuccess(null)
        setAlertMessage(null)

        const formData = new FormData()
        formData.append('file', selectedFile)

        startTransition(async () => {
            const res = await cargarHorasExtrasAction(formData)
            if (res.success) {
                setUploadSuccess(`Planilla procesada con éxito: ${res.nuevos} nuevos ingresados y ${res.actualizados} registros actualizados.`)
                setSelectedFile(null)
                setAlertMessage({
                    type: 'success',
                    text: `Carga de horas extras completada: ${res.nuevos} nuevos, ${res.actualizados} actualizados.`
                })
                setTimeout(() => {
                    setIsUploadModalOpen(false)
                    setUploadSuccess(null)
                    fetchData(1)
                }, 1500)
            } else {
                setUploadError(res.error || 'Error al procesar la planilla')
            }
        })
    }

    // Cargar desde ruta local (botón directo para pruebas y sincronización)
    const handleCargarLocal = () => {
        if (!confirm('¿Deseas cargar la planilla desde la ruta local de prueba? Esta acción actualizará los registros existentes y agregará los nuevos por Identificador y Fecha.')) {
            return
        }

        setAlertMessage(null)
        startTransition(async () => {
            const res = await cargarHorasExtrasDesdeArchivoLocalAction()
            if (res.success) {
                setAlertMessage({
                    type: 'success',
                    text: `Carga completada desde el servidor: ${res.nuevos} nuevos registros y ${res.actualizados} actualizados.`
                })
                fetchData(1)
            } else {
                setAlertMessage({ type: 'error', text: res.error || 'Error al cargar archivo local' })
            }
        })
    }

    // Vaciar registros
    const handleEliminarTodo = () => {
        if (!confirm('ATENCIÓN: ¿Estás seguro de vaciar todos los registros de horas extras? Esta acción eliminará permanentemente los datos actuales.')) {
            return
        }

        startTransition(async () => {
            const res = await eliminarHorasExtrasAction()
            if (res.success) {
                setAlertMessage({ type: 'success', text: 'Registros de horas extras eliminados con éxito.' })
                fetchData(1)
            } else {
                setAlertMessage({ type: 'error', text: res.error || 'Error al vaciar registros' })
            }
        })
    }

    // Exportar a Excel
    const handleExportarExcel = () => {
        startTransition(async () => {
            const res = await exportarHorasExtrasExcelAction({
                search: search.trim() || undefined,
                sucursal: filtroSucursal !== 'TODAS' ? filtroSucursal : undefined,
                supervisor: filtroSupervisor !== 'TODOS' ? filtroSupervisor : undefined,
                rbd: filtroRbd ? parseInt(filtroRbd, 10) : undefined,
                fechaDesde: fechaDesde || undefined,
                fechaHasta: fechaHasta || undefined
            })

            if (res.success && res.dataBase64) {
                const byteCharacters = atob(res.dataBase64)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = res.filename || 'Horas_Extras.xlsx'
                a.click()
                URL.revokeObjectURL(url)
            } else {
                alert(res.error || 'Error al exportar la planilla')
            }
        })
    }

    const totalPaginas = Math.ceil((data?.total || 0) / pageSize) || 1

    const renderSortHeader = (label: string, field: string) => {
        const isActive = sortField === field
        return (
            <th
                key={field}
                onClick={() => handleSort(field)}
                className="px-4 py-3.5 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                title={`Ordenar por ${label} (${isActive && sortOrder === 'asc' ? 'Ascendente - Clic para Descendente' : 'Clic para ordenar'})`}
            >
                <div className="flex items-center gap-1.5 font-bold">
                    <span className={isActive ? 'text-cyan-700 font-extrabold' : 'text-gray-600 group-hover:text-gray-900'}>
                        {label}
                    </span>
                    {isActive ? (
                        sortOrder === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5] shrink-0" />
                        ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5] shrink-0" />
                        )
                    ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
                    )}
                </div>
            </th>
        )
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 animate-in fade-in duration-200">
            {/* Header Estándar Hendaya */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <div className="flex items-center gap-2 text-cyan-600 font-semibold text-xs tracking-wider uppercase mb-1">
                        <Clock className="w-4 h-4" />
                        <span>Áreas · Recursos Humanos · Carga masiva</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        Horas Extras de Personal
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Registro y control de horas extraordinarias. La planilla se actualiza por identificador y fecha, permitiendo sobreescritura de datos sin duplicar registros.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        onClick={handleExportarExcel}
                        disabled={isPending || (data?.total || 0) === 0}
                        className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2.5 rounded-xl transition-all border border-gray-200 shadow-2xs text-xs disabled:opacity-50 cursor-pointer"
                        title="Descargar datos en Excel"
                    >
                        <Download className="w-4 h-4 text-emerald-600" />
                        <span>Exportar Excel</span>
                    </button>

                    <button
                        onClick={handleCargarLocal}
                        disabled={isPending}
                        className="flex items-center gap-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 font-semibold px-4 py-2.5 rounded-xl transition-all border border-cyan-200 shadow-2xs text-xs disabled:opacity-50 cursor-pointer"
                        title="Sincronizar directamente desde el archivo oficial del servidor"
                    >
                        <RefreshCw className={`w-4 h-4 text-cyan-600 ${isPending ? 'animate-spin' : ''}`} />
                        <span>Cargar Planilla Local</span>
                    </button>

                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        disabled={isPending}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-slate-900/10 text-xs disabled:opacity-50 cursor-pointer"
                    >
                        <UploadCloud className="w-4 h-4 text-cyan-400" />
                        <span>Subir Planilla Excel</span>
                    </button>

                    {(data?.total || 0) > 0 && (
                        <button
                            onClick={handleEliminarTodo}
                            disabled={isPending}
                            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium px-3 py-2.5 rounded-xl transition-all border border-rose-200 text-xs disabled:opacity-50 cursor-pointer"
                            title="Vaciar horas extras"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>Vaciar</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Banner de Criptografía & Resguardo de Datos */}
            <div className="bg-gradient-to-r from-cyan-900/90 via-slate-900 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm border border-cyan-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-cyan-500/20 rounded-xl border border-cyan-400/30 text-cyan-300">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white tracking-wide">
                            Protección Criptográfica Avanzada (AES-256-GCM)
                        </h4>
                        <p className="text-xs text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                            Los campos personales (Identificador / RUT, Apellidos y Nombre) se almacenan estrictamente cifrados en la base de datos y se desencriptan de forma segura para su visualización.
                        </p>
                    </div>
                </div>

                {data?.ultimaCarga && (
                    <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2 text-right shrink-0">
                        <span className="text-[10px] uppercase font-bold text-cyan-400 block tracking-wider">Última Carga Registrada</span>
                        <span className="text-xs font-medium text-white">{data.ultimaCarga.fechaCarga}</span>
                        <span className="block text-[10px] text-slate-300 truncate max-w-[220px]">{data.ultimaCarga.nombreArchivo}</span>
                        <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                            +{data.ultimaCarga.nuevos} nuevos · ⟳ {data.ultimaCarga.actualizados} actualizados
                        </span>
                    </div>
                )}
            </div>

            {/* Mensajes de Alerta */}
            {alertMessage && (
                <div className={`p-4 rounded-xl flex items-center justify-between text-xs font-medium border animate-in fade-in ${alertMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                    <div className="flex items-center gap-2">
                        {alertMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                        <span>{alertMessage.text}</span>
                    </div>
                    <button onClick={() => setAlertMessage(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Tarjetas de Resumen KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="bg-white border border-gray-100 shadow-sm p-4 rounded-2xl">
                    <span className="text-xs uppercase font-semibold text-gray-500">Registros HHEE</span>
                    <p className="text-2xl font-extrabold text-gray-900 mt-1">{data?.resumen?.totalRegistros || 0}</p>
                    <span className="text-[11px] text-gray-400">Total turnos reportados</span>
                </div>

                <div className="bg-white border border-cyan-100 shadow-sm p-4 rounded-2xl">
                    <span className="text-xs uppercase font-semibold text-cyan-700">Colaboradores</span>
                    <p className="text-2xl font-extrabold text-cyan-600 mt-1">{data?.resumen?.totalPersonas || 0}</p>
                    <span className="text-[11px] text-cyan-500">Personas únicas con HHEE</span>
                </div>

                <div className="bg-white border border-emerald-100 shadow-sm p-4 rounded-2xl">
                    <span className="text-xs uppercase font-semibold text-emerald-700">RBDs con HHEE</span>
                    <p className="text-2xl font-extrabold text-emerald-600 mt-1">{data?.resumen?.totalRbds || 0}</p>
                    <span className="text-[11px] text-emerald-500">Establecimientos activos</span>
                </div>

                <div className="bg-white border border-amber-100 shadow-sm p-4 rounded-2xl">
                    <span className="text-xs uppercase font-semibold text-amber-700">Horas Totales (Rex)</span>
                    <p className="text-2xl font-extrabold text-amber-600 mt-1">{data?.resumen?.totalHorasRex || 0} hrs</p>
                    <span className="text-[11px] text-amber-500">Total acumulado de horas</span>
                </div>

                <div className="bg-white border border-indigo-100 shadow-sm p-4 rounded-2xl">
                    <span className="text-xs uppercase font-semibold text-indigo-700">Monto Total</span>
                    <p className="text-2xl font-extrabold text-indigo-600 mt-1">
                        ${(data?.resumen?.totalMontoPagar || 0).toLocaleString('es-CL')}
                    </p>
                    <span className="text-[11px] text-indigo-500">Total a pagar estimado</span>
                </div>
            </div>

            {/* Panel de Filtros y Búsqueda */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                    {/* Búsqueda por RUT o Nombre */}
                    <div className="sm:col-span-2 space-y-1">
                        <label className="text-[11px] font-bold text-gray-600 uppercase">Buscar por RUT, Nombre o Apellido</label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Ej: 17609915-1 o GARCIA..."
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            />
                        </div>
                    </div>

                    {/* Filtro Sucursal */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-600 uppercase">Sucursal</label>
                        <select
                            value={filtroSucursal}
                            onChange={(e) => setFiltroSucursal(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 cursor-pointer"
                        >
                            <option value="TODAS">Todas las Sucursales</option>
                            {data?.resumen?.sucursalesList?.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Supervisor */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-600 uppercase">Supervisor</label>
                        <select
                            value={filtroSupervisor}
                            onChange={(e) => setFiltroSupervisor(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 cursor-pointer"
                        >
                            <option value="TODOS">Todos los Supervisores</option>
                            {data?.resumen?.supervisoresList?.map(sup => (
                                <option key={sup} value={sup}>{sup}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro RBD */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-600 uppercase">RBD (Entero)</label>
                        <div className="relative">
                            <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                            <input
                                type="number"
                                value={filtroRbd}
                                onChange={(e) => setFiltroRbd(e.target.value)}
                                placeholder="Ej: 10516"
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            />
                        </div>
                    </div>

                    {/* Rango de Fechas */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-600 uppercase">Fecha Desde</label>
                        <input
                            type="date"
                            value={fechaDesde}
                            onChange={(e) => setFechaDesde(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                    </div>
                </form>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-500 font-medium">
                        Mostrando {data?.registros?.length || 0} de {data?.total || 0} registros
                    </span>
                    <div className="flex items-center gap-2">
                        {(search || filtroSucursal !== 'TODAS' || filtroSupervisor !== 'TODOS' || filtroRbd || fechaDesde || fechaHasta) && (
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-1.5 cursor-pointer"
                            >
                                Limpiar filtros
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => fetchData(1, sortField, sortOrder, pageSize)}
                            disabled={isPending}
                            className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                        >
                            <Search className="w-3.5 h-3.5" />
                            <span>Aplicar Búsqueda</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabla de Resultados */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-700">
                        <thead className="bg-slate-50 font-semibold uppercase text-gray-600 border-b border-gray-200 tracking-wider text-[11px]">
                            <tr>
                                {renderSortHeader('Fecha', 'fecha')}
                                {renderSortHeader('RBD', 'rbd')}
                                {renderSortHeader('Establecimiento', 'establecimiento')}
                                {renderSortHeader('Sucursal', 'sucursal')}
                                {renderSortHeader('Identificador', 'identificador')}
                                {renderSortHeader('Apellidos', 'apellidos')}
                                {renderSortHeader('Nombre', 'nombre')}
                                {renderSortHeader('Supervisor', 'supervisor')}
                                {renderSortHeader('Turno', 'turno')}
                                {renderSortHeader('HHEE Rex', 'hheeRex')}
                                {renderSortHeader('Monto ($)', 'montoPagar')}
                                <th className="px-4 py-3.5 text-center text-gray-500 font-bold whitespace-nowrap">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isPending ? (
                                <tr>
                                    <td colSpan={12} className="text-center py-16 text-gray-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCw className="w-6 h-6 animate-spin text-cyan-600" />
                                            <span>Consultando registros de horas extras...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : data?.registros?.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="text-center py-16 text-gray-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <FileSpreadsheet className="w-8 h-8 text-gray-300" />
                                            <span className="font-semibold text-gray-600">No se encontraron horas extras registradas</span>
                                            <span className="text-xs">
                                                {(data?.total || 0) === 0 ? 'Aún no se ha cargado la planilla. Utiliza el botón "Subir Planilla Excel" o "Cargar Planilla Local".' : 'No hay registros que coincidan con los filtros seleccionados.'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                data?.registros?.map(item => (
                                    <tr key={item.id} className="hover:bg-cyan-50/40 transition-colors">
                                        {/* Fecha */}
                                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                                            {item.fecha}
                                        </td>

                                        {/* RBD */}
                                        <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-cyan-700">
                                            {item.rbd ? item.rbd : <span className="text-gray-400 font-normal">-</span>}
                                        </td>

                                        {/* Establecimiento */}
                                        <td className="px-4 py-3 max-w-[180px] truncate" title={item.establecimiento || ''}>
                                            <span className="font-semibold text-gray-900">{item.establecimiento || item.rbdRaw || '-'}</span>
                                        </td>

                                        {/* Sucursal */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                                                {item.sucursal}
                                            </span>
                                        </td>

                                        {/* Identificador (RUT) */}
                                        <td className="px-4 py-3 whitespace-nowrap font-mono font-medium text-gray-900">
                                            {item.identificador}
                                        </td>

                                        {/* Apellidos */}
                                        <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-900">
                                            {item.apellidos}
                                        </td>

                                        {/* Nombre */}
                                        <td className="px-4 py-3 whitespace-nowrap text-gray-800">
                                            {item.nombre}
                                        </td>

                                        {/* Supervisor */}
                                        <td className="px-4 py-3 max-w-[160px] truncate text-gray-600" title={item.supervisor || ''}>
                                            {item.supervisor || '-'}
                                        </td>

                                        {/* Turno */}
                                        <td className="px-4 py-3 whitespace-nowrap text-[11px] text-gray-500">
                                            {item.turno || '-'}
                                        </td>

                                        {/* HHEE Rex */}
                                        <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-amber-700">
                                            {item.hheeRex > 0 ? `${item.hheeRex} hrs` : '-'}
                                        </td>

                                        {/* Monto ($) */}
                                        <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-emerald-700">
                                            {item.montoPagar > 0 ? `$${item.montoPagar.toLocaleString('es-CL')}` : '-'}
                                        </td>

                                        {/* Acciones */}
                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                            <button
                                                onClick={() => setSelectedItem(item)}
                                                className="inline-flex items-center gap-1 text-cyan-700 hover:text-cyan-900 font-semibold bg-cyan-50 hover:bg-cyan-100 px-2.5 py-1 rounded-lg border border-cyan-200 transition-colors text-xs cursor-pointer"
                                                title="Ver Ficha y desglose completo del turno"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                <span>Ficha</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Paginación */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
                    <div className="flex flex-wrap items-center gap-3">
                        <div>
                            Mostrando <span className="font-bold text-gray-900">
                                {data?.total ? Math.min((pagina - 1) * pageSize + 1, data.total) : 0}
                            </span> a <span className="font-bold text-gray-900">
                                {Math.min(pagina * pageSize, data?.total || 0)}
                            </span> de <span className="font-bold text-gray-900">{data?.total || 0}</span> registros
                        </div>
                        <div className="flex items-center gap-1.5 pl-3 border-l border-gray-300">
                            <span className="text-gray-500">Mostrar:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                disabled={isPending}
                                className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span className="text-gray-500">por pág.</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 mr-1">
                            Página <span className="font-bold text-gray-900">{pagina}</span> de <span className="font-bold text-gray-900">{totalPaginas}</span>
                        </span>
                        <button
                            onClick={() => fetchData(pagina - 1, sortField, sortOrder, pageSize)}
                            disabled={pagina <= 1 || isPending}
                            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Anterior</span>
                        </button>
                        <button
                            onClick={() => fetchData(pagina + 1, sortField, sortOrder, pageSize)}
                            disabled={pagina >= totalPaginas || isPending}
                            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                            <span>Siguiente</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal: Subida de Planilla Excel */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-gray-100 overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white">
                            <div className="flex items-center gap-2.5">
                                <UploadCloud className="w-5 h-5 text-cyan-400" />
                                <h3 className="font-bold text-base">Carga de Horas Extras</h3>
                            </div>
                            <button
                                onClick={() => { setIsUploadModalOpen(false); setUploadError(null); }}
                                className="text-gray-400 hover:text-white cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
                            {/* Alerta de regla de no duplicación / upsert */}
                            <div className="p-3.5 bg-cyan-50 border border-cyan-200 rounded-xl text-cyan-900 text-xs flex items-start gap-2.5">
                                <AlertTriangle className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                                <div>
                                    <strong className="block font-bold">Actualización Inteligente por Identificador y Fecha:</strong>
                                    Esta planilla se puede procesar de forma incremental. Si un registro ya existe con el mismo Identificador y Fecha, se actualizarán sus horas y datos asociados; si es nuevo, se agregará automáticamente sin generar duplicados.
                                </div>
                            </div>

                            {/* Dropzone de archivo */}
                            <div className="border-2 border-dashed border-gray-300 hover:border-cyan-500 rounded-2xl p-6 text-center transition-colors bg-gray-50/50">
                                <input
                                    type="file"
                                    id="excel-file-hextra"
                                    accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setSelectedFile(e.target.files[0])
                                            setUploadError(null)
                                        }
                                    }}
                                    className="hidden"
                                />
                                <label htmlFor="excel-file-hextra" className="cursor-pointer flex flex-col items-center">
                                    <FileSpreadsheet className="w-10 h-10 text-cyan-600 mb-2" />
                                    <span className="font-semibold text-gray-800 text-sm">
                                        {selectedFile ? selectedFile.name : 'Haz clic para seleccionar la planilla Excel'}
                                    </span>
                                    <span className="text-[11px] text-gray-500 mt-1">
                                        {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Formato compatible: .xlsx (Horas Extras)'}
                                    </span>
                                </label>
                            </div>

                            {uploadError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>{uploadError}</span>
                                </div>
                            )}

                            {uploadSuccess && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>{uploadSuccess}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2.5 pt-3">
                                <button
                                    type="button"
                                    onClick={() => { setIsUploadModalOpen(false); setSelectedFile(null); setUploadError(null); }}
                                    className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!selectedFile || isPending}
                                    className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-cyan-600/20 disabled:opacity-50 cursor-pointer"
                                >
                                    {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                                    <span>{isPending ? 'Procesando Planilla...' : 'Procesar Horas Extras'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Ficha Detalle de Horas Extras */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white">
                            <div className="flex items-center gap-2.5">
                                <Clock className="w-5 h-5 text-cyan-400" />
                                <div>
                                    <h3 className="font-bold text-base">Ficha de Horas Extras</h3>
                                    <span className="text-xs text-slate-300">Turno del {selectedItem.fecha}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="text-gray-400 hover:text-white cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-5">
                            {/* Colaborador */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                                <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block mb-2">Colaborador (Datos Desencriptados)</span>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                    <div>
                                        <span className="text-gray-400 block text-[11px]">RUT / Identificador:</span>
                                        <span className="font-mono font-bold text-gray-900">{selectedItem.identificador}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block text-[11px]">Apellidos:</span>
                                        <span className="font-bold text-gray-900">{selectedItem.apellidos}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block text-[11px]">Nombre:</span>
                                        <span className="font-bold text-gray-900">{selectedItem.nombre}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block text-[11px]">Cargo:</span>
                                        <span className="font-semibold text-gray-800">{selectedItem.cargo || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block text-[11px]">Supervisor:</span>
                                        <span className="font-semibold text-gray-800">{selectedItem.supervisor || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block text-[11px]">Institución:</span>
                                        <span className="font-semibold text-gray-800">{selectedItem.institucion || '-'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Ubicación y Establecimiento */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                                <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block mb-2">Establecimiento y Sucursal</span>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                    <div>
                                        <span className="text-gray-400 block text-[11px]">RBD:</span>
                                        <span className="font-mono font-bold text-cyan-800">{selectedItem.rbd || '-'}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-400 block text-[11px]">Nombre Establecimiento:</span>
                                        <span className="font-semibold text-gray-900">{selectedItem.establecimiento || selectedItem.rbdRaw || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block text-[11px]">Sucursal Homologada:</span>
                                        <span className="font-bold text-slate-800">{selectedItem.sucursal}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-400 block text-[11px]">Sede Original en Planilla:</span>
                                        <span className="text-gray-600">{selectedItem.sedeRaw || '-'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Detalle del Turno y Marcaciones */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                                <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block mb-2">Marcaciones y Jornada</span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                    <div>
                                        <span className="text-gray-400 block text-[11px]">Turno Asignado:</span>
                                        <span className="font-medium text-gray-900">{selectedItem.turno || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block text-[11px]">Marcó Registro:</span>
                                        <span className="font-semibold text-gray-800">{selectedItem.marco || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block text-[11px]">Hora Entrada:</span>
                                        <span className="font-mono text-gray-800">{selectedItem.entro || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block text-[11px]">Hora Salida:</span>
                                        <span className="font-mono text-gray-800">{selectedItem.salio || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block text-[11px]">Término de Turno:</span>
                                        <span className="font-mono text-gray-800">{selectedItem.salioTurno || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block text-[11px]">Minutos Atraso:</span>
                                        <span className="font-mono text-gray-800">{selectedItem.atraso || 0}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-400 block text-[11px]">Justificación:</span>
                                        <span className="text-gray-700">{selectedItem.justificado || 'Sin justificación'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Cómputo de Horas Extras y Monto */}
                            <div className="bg-cyan-50/70 p-4 rounded-xl border border-cyan-200">
                                <span className="text-[10px] font-bold text-cyan-900 uppercase tracking-wider block mb-2">Cómputo Económico de HHEE</span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                    <div>
                                        <span className="text-cyan-800 block text-[11px]">HHEE Calculadas:</span>
                                        <span className="font-mono font-bold text-cyan-950">{formatHorasMinutos(selectedItem.hhee)} ({formatHorasMinutosTexto(selectedItem.hhee)})</span>
                                    </div>
                                    <div>
                                        <span className="text-cyan-800 block text-[11px]">HHEE con Atraso:</span>
                                        <span className="font-mono font-bold text-cyan-950">{formatHorasMinutos(selectedItem.hheeAtraso)} ({formatHorasMinutosTexto(selectedItem.hheeAtraso)})</span>
                                    </div>
                                    <div>
                                        <span className="text-cyan-800 block text-[11px]">Horas Rex Oficiales:</span>
                                        <span className="font-mono font-extrabold text-amber-700 text-sm">{selectedItem.hheeRex} hrs</span>
                                    </div>
                                    <div>
                                        <span className="text-cyan-800 block text-[11px]">Monto a Pagar:</span>
                                        <span className="font-mono font-extrabold text-emerald-700 text-sm">${selectedItem.montoPagar.toLocaleString('es-CL')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50">
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
                            >
                                Cerrar Ficha
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
