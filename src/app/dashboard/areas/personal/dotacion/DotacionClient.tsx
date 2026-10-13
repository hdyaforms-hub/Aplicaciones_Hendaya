'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
    DotacionRegistroDTO,
    DotacionResponse,
    getDotacionDataAction,
    cargarDotacionAction,
    cargarDotacionDesdeArchivoLocalAction,
    eliminarDotacionAction,
    exportarDotacionExcelAction
} from './actions'
import {
    Users,
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
    Phone,
    Mail,
    Calendar,
    Home,
    FolderSync,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react'

interface Props {
    initialData: DotacionResponse
    userRole: string
}

export default function DotacionClient({ initialData, userRole }: Props) {
    const [data, setData] = useState<DotacionResponse>(initialData)
    const [isPending, startTransition] = useTransition()

    // Filtros
    const [search, setSearch] = useState('')
    const [filtroSucursal, setFiltroSucursal] = useState('TODAS')
    const [filtroCargo, setFiltroCargo] = useState('TODOS')
    const [filtroRbd, setFiltroRbd] = useState<string>('')
    const [pagina, setPagina] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [sortField, setSortField] = useState<string>('sucursal')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

    // Modal de subida de archivo
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

    // Modal de Detalle / Ficha Completa del colaborador
    const [selectedEmployee, setSelectedEmployee] = useState<DotacionRegistroDTO | null>(null)

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
            const res = await getDotacionDataAction({
                search: search.trim() || undefined,
                sucursal: filtroSucursal !== 'TODAS' ? filtroSucursal : undefined,
                cargo: filtroCargo !== 'TODOS' ? filtroCargo : undefined,
                rbd: filtroRbd ? parseInt(filtroRbd, 10) : undefined,
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
                setAlertMessage(null) // Limpiar cualquier alerta de error previa
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
        setFiltroCargo('TODOS')
        setFiltroRbd('')
        setAlertMessage(null)
        startTransition(async () => {
            const res = await getDotacionDataAction({
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
            const res = await cargarDotacionAction(formData)
            if (res.success) {
                setUploadSuccess(`Planilla procesada con éxito: ${res.total} colaboradores cargados reemplazando la dotación anterior.`)
                setSelectedFile(null)
                setAlertMessage({
                    type: 'success',
                    text: `Planilla procesada con éxito: ${res.total} colaboradores registrados.`
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
        if (!confirm('¿Deseas cargar la planilla desde la ruta local de prueba? Esta acción REEMPLAZARÁ completamente la dotación existente con los datos del archivo oficial.')) {
            return
        }

        setAlertMessage(null)
        startTransition(async () => {
            const res = await cargarDotacionDesdeArchivoLocalAction()
            if (res.success) {
                setAlertMessage({
                    type: 'success',
                    text: `Carga completada con éxito desde el servidor: ${res.total} colaboradores sincronizados.`
                })
                fetchData(1)
            } else {
                setAlertMessage({ type: 'error', text: res.error || 'Error al cargar archivo local' })
            }
        })
    }

    // Vaciar dotación
    const handleEliminarTodo = () => {
        if (!confirm('ATENCIÓN: ¿Estás seguro de vaciar toda la dotación de personal? Esta acción eliminará permanentemente la planilla actual.')) {
            return
        }

        startTransition(async () => {
            const res = await eliminarDotacionAction()
            if (res.success) {
                setAlertMessage({ type: 'success', text: 'Dotación eliminada con éxito.' })
                fetchData(1)
            } else {
                setAlertMessage({ type: 'error', text: res.error || 'Error al vaciar dotación' })
            }
        })
    }

    // Exportar Excel
    const handleExportarExcel = () => {
        startTransition(async () => {
            const res = await exportarDotacionExcelAction({
                search: search.trim() || undefined,
                sucursal: filtroSucursal !== 'TODAS' ? filtroSucursal : undefined,
                cargo: filtroCargo !== 'TODOS' ? filtroCargo : undefined,
                rbd: filtroRbd ? parseInt(filtroRbd, 10) : undefined
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
                a.download = res.filename || 'Dotacion_Personal.xlsx'
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
                title={`Ordenar por ${label} (${isActive && sortOrder === 'asc' ? 'Actualmente Ascendente - Clic para Descendente' : 'Clic para ordenar'})`}
            >
                <div className="flex items-center gap-1.5">
                    <span className={isActive ? 'text-cyan-700 font-extrabold' : 'text-gray-600 group-hover:text-gray-900 font-bold'}>
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
                        <Users className="w-4 h-4" />
                        <span>Áreas · Recursos Humanos · Carga masiva</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        Dotación de Personal
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Gestión y consulta consolidada de la dotación de colaboradores. La planilla se carga una sola vez y su actualización reemplaza íntegramente los datos vigentes.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        onClick={handleExportarExcel}
                        disabled={isPending || (data?.total || 0) === 0}
                        className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2.5 rounded-xl transition-all border border-gray-200 shadow-2xs text-xs disabled:opacity-50"
                        title="Descargar toda la dotación desencriptada en Excel"
                    >
                        <Download className="w-4 h-4 text-emerald-600" />
                        <span>Exportar Excel</span>
                    </button>

                    <button
                        onClick={handleCargarLocal}
                        disabled={isPending}
                        className="flex items-center gap-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 font-semibold px-4 py-2.5 rounded-xl transition-all border border-cyan-200 shadow-2xs text-xs disabled:opacity-50"
                        title="Cargar y sincronizar directamente desde la ruta local de prueba"
                    >
                        <FolderSync className="w-4 h-4 text-cyan-600" />
                        <span>Cargar Planilla Local</span>
                    </button>

                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        disabled={isPending}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-slate-900/10 text-xs disabled:opacity-50"
                    >
                        <UploadCloud className="w-4 h-4 text-cyan-400" />
                        <span>Subir Planilla Excel</span>
                    </button>

                    {(data?.total || 0) > 0 && (
                        <button
                            onClick={handleEliminarTodo}
                            disabled={isPending}
                            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium px-3 py-2.5 rounded-xl transition-all border border-rose-200 text-xs disabled:opacity-50"
                            title="Vaciar dotación actual"
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
                        <h4 className="font-bold text-sm text-cyan-200 flex items-center gap-2">
                            Protección Criptográfica Avanzada (AES-256-GCM)
                        </h4>
                        <p className="text-xs text-slate-300 mt-0.5 max-w-3xl leading-relaxed">
                            Los 17 campos personales sensibles (RUT, Nombre, Sexo, Fecha Nacimiento, Estado Civil, País, Dirección, Comuna, Villa/Población, Bloque, Ciudad, Cód. Postal, Región, Teléfono, Correo Electrónico, Banco y Cuenta Bancaria) se almacenan estrictamente cifrados en la base de datos y se desencriptan de forma segura para su visualización.
                        </p>
                    </div>
                </div>
                {data?.ultimaCarga && (
                    <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/15 text-right shrink-0">
                        <span className="block text-[10px] text-cyan-300 uppercase tracking-wider font-semibold">Última Carga Registrada</span>
                        <span className="text-xs font-medium text-white">{data.ultimaCarga.fechaCarga}</span>
                        <span className="block text-[10px] text-slate-300 truncate max-w-[200px]">{data.ultimaCarga.nombreArchivo}</span>
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
                    <button onClick={() => setAlertMessage(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Tarjetas de Resumen KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-100 shadow-sm p-4 rounded-2xl">
                    <span className="text-xs uppercase font-semibold text-gray-500">Total Dotación</span>
                    <p className="text-2xl font-extrabold text-gray-900 mt-1">{data?.resumen?.totalGeneral || 0}</p>
                    <span className="text-[11px] text-gray-400">Colaboradores registrados</span>
                </div>

                <div className="bg-white border border-cyan-100 shadow-sm p-4 rounded-2xl">
                    <span className="text-xs uppercase font-semibold text-cyan-700">RBDs con Personal</span>
                    <p className="text-2xl font-extrabold text-cyan-600 mt-1">{data?.resumen?.totalConRbd || 0}</p>
                    <span className="text-[11px] text-cyan-500">Establecimientos activos</span>
                </div>

                <div className="bg-white border border-emerald-100 shadow-sm p-4 rounded-2xl">
                    <span className="text-xs uppercase font-semibold text-emerald-700">Sucursales / CD</span>
                    <p className="text-2xl font-extrabold text-emerald-600 mt-1">{data?.resumen?.totalSucursales || 0}</p>
                    <span className="text-[11px] text-emerald-500">Centros de distribución</span>
                </div>

                <div className="bg-white border border-purple-100 shadow-sm p-4 rounded-2xl">
                    <span className="text-xs uppercase font-semibold text-purple-700">Cargos Catalogados</span>
                    <p className="text-2xl font-extrabold text-purple-600 mt-1">{data?.resumen?.totalCargos || 0}</p>
                    <span className="text-[11px] text-purple-500">Perfiles ocupacionales</span>
                </div>
            </div>

            {/* Barra de Búsqueda y Filtros */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
                <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Búsqueda general */}
                    <div className="lg:col-span-2">
                        <label className="text-[11px] font-semibold text-gray-600 uppercase block mb-1">
                            Buscar por RUT o Nombre
                        </label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Ej: 14647888-3 o GIOVANNA..."
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            />
                        </div>
                    </div>

                    {/* Filtro Sucursal */}
                    <div>
                        <label className="text-[11px] font-semibold text-gray-600 uppercase block mb-1">
                            Sucursal
                        </label>
                        <select
                            value={filtroSucursal}
                            onChange={e => { setFiltroSucursal(e.target.value); }}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        >
                            <option value="TODAS">Todas las Sucursales</option>
                            {data?.resumen?.sucursalesList?.map(suc => (
                                <option key={suc} value={suc}>{suc}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Cargo */}
                    <div>
                        <label className="text-[11px] font-semibold text-gray-600 uppercase block mb-1">
                            Cargo
                        </label>
                        <select
                            value={filtroCargo}
                            onChange={e => { setFiltroCargo(e.target.value); }}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        >
                            <option value="TODOS">Todos los Cargos</option>
                            {data?.resumen?.cargosList?.map(cargo => (
                                <option key={cargo} value={cargo}>{cargo}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro RBD */}
                    <div>
                        <label className="text-[11px] font-semibold text-gray-600 uppercase block mb-1">
                            RBD (Entero)
                        </label>
                        <div className="relative">
                            <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={filtroRbd}
                                onChange={e => setFiltroRbd(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="Ej: 10253"
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            />
                        </div>
                    </div>
                </form>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-500 font-medium">
                        Mostrando {data?.registros?.length || 0} de {data?.total || 0} colaboradores
                    </span>
                    <div className="flex items-center gap-2">
                        {(search || filtroSucursal !== 'TODAS' || filtroCargo !== 'TODOS' || filtroRbd) && (
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-1.5"
                            >
                                Limpiar filtros
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => fetchData(1)}
                            disabled={isPending}
                            className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-2xs disabled:opacity-50"
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
                                {renderSortHeader('RBD', 'rbd')}
                                {renderSortHeader('Establecimiento', 'establecimiento')}
                                {renderSortHeader('Sucursal', 'sucursal')}
                                {renderSortHeader('RUT (Desencriptado)', 'rut')}
                                {renderSortHeader('Nombre (Desencriptado)', 'nombre')}
                                {renderSortHeader('Cargo', 'cargo')}
                                {renderSortHeader('Teléfono', 'telefono')}
                                {renderSortHeader('Banco', 'banco')}
                                {renderSortHeader('Situación', 'situacion')}
                                <th className="px-4 py-3.5 text-center text-gray-500 font-bold whitespace-nowrap">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isPending ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-16 text-gray-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCw className="w-6 h-6 animate-spin text-cyan-600" />
                                            <span>Consultando registros de dotación...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : data?.registros?.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-16 text-gray-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <FileSpreadsheet className="w-8 h-8 text-gray-300" />
                                            <span className="font-semibold text-gray-600">No se encontraron colaboradores</span>
                                            <span className="text-xs">
                                                {(data?.total || 0) === 0 ? 'Aún no se ha cargado la planilla de dotación. Utiliza el botón "Subir Planilla Excel" o "Cargar Planilla Local".' : 'No hay registros que coincidan con los filtros seleccionados.'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                data?.registros?.map(emp => (
                                    <tr key={emp.id} className="hover:bg-cyan-50/40 transition-colors">
                                        {/* RBD */}
                                        <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-cyan-700">
                                            {emp.rbd ? emp.rbd : <span className="text-gray-400 font-normal">-</span>}
                                        </td>

                                        {/* Establecimiento */}
                                        <td className="px-4 py-3 max-w-[200px] truncate" title={emp.establecimiento || ''}>
                                            <span className="font-semibold text-gray-900">{emp.establecimiento || emp.rbdRaw || '-'}</span>
                                        </td>

                                        {/* Sucursal */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                                                {emp.sucursal || emp.centroDistribucion || '-'}
                                            </span>
                                        </td>

                                        {/* RUT */}
                                        <td className="px-4 py-3 whitespace-nowrap font-mono font-medium text-gray-900">
                                            {emp.rut}
                                        </td>

                                        {/* Nombre */}
                                        <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-900">
                                            {emp.nombre}
                                        </td>

                                        {/* Cargo */}
                                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                                            {emp.cargo || '-'}
                                        </td>

                                        {/* Teléfono */}
                                        <td className="px-4 py-3 whitespace-nowrap font-mono text-gray-600 text-[11px]">
                                            {emp.telefono || '-'}
                                        </td>

                                        {/* Banco */}
                                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                                            {emp.banco ? `${emp.banco} (${emp.cuentaBanco || ''})` : '-'}
                                        </td>

                                        {/* Situación */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${emp.situacion?.toLowerCase().includes('activo') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                {emp.situacion || 'Activo'}
                                            </span>
                                        </td>

                                        {/* Acciones */}
                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                            <button
                                                onClick={() => setSelectedEmployee(emp)}
                                                className="inline-flex items-center gap-1 text-cyan-700 hover:text-cyan-900 font-semibold bg-cyan-50 hover:bg-cyan-100 px-2.5 py-1 rounded-lg border border-cyan-200 transition-colors text-xs"
                                                title="Ver Ficha Completa con los 17 datos personales"
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
                            </span> de <span className="font-bold text-gray-900">{data?.total || 0}</span> colaboradores
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
                                <h3 className="font-bold text-base">Carga Masiva de Dotación</h3>
                            </div>
                            <button
                                onClick={() => { setIsUploadModalOpen(false); setUploadError(null); }}
                                className="text-gray-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
                            {/* Alerta de regla de reemplazo total */}
                            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2.5">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <strong className="block font-bold">Regla de Reemplazo Absoluto:</strong>
                                    Esta planilla se carga una sola vez. Al subir una nueva versión, se eliminarán automáticamente todos los registros anteriores y se sustituirán por los nuevos. No se añadirá información duplicada.
                                </div>
                            </div>

                            {/* Dropzone */}
                            <div className="border-2 border-dashed border-gray-300 hover:border-cyan-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-gray-50/50">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    id="dotacionFileInput"
                                    className="hidden"
                                    onChange={e => {
                                        if (e.target.files && e.target.files[0]) {
                                            setSelectedFile(e.target.files[0])
                                            setUploadError(null)
                                        }
                                    }}
                                />
                                <label htmlFor="dotacionFileInput" className="cursor-pointer flex flex-col items-center">
                                    <FileSpreadsheet className="w-10 h-10 text-cyan-600 mb-2" />
                                    <span className="text-sm font-bold text-gray-800">
                                        {selectedFile ? selectedFile.name : 'Haz clic o arrastra aquí tu archivo Excel'}
                                    </span>
                                    <span className="text-xs text-gray-500 mt-1">
                                        {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : 'Formato compatible: .xlsx'}
                                    </span>
                                </label>
                            </div>

                            {uploadError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                                    {uploadError}
                                </div>
                            )}

                            {uploadSuccess && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>{uploadSuccess}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsUploadModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!selectedFile || isPending}
                                    className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition-all disabled:opacity-40"
                                >
                                    {isPending ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                                            <span>Procesando y Encriptando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <UploadCloud className="w-4 h-4 text-cyan-400" />
                                            <span>Procesar y Reemplazar</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Ficha Completa del Colaborador (17 campos desencriptados) */}
            {selectedEmployee && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Ficha de Dotación de Personal</span>
                                <h3 className="font-bold text-lg text-white mt-0.5">{selectedEmployee.nombre}</h3>
                                <span className="font-mono text-xs text-slate-300">{selectedEmployee.rut}</span>
                            </div>
                            <button
                                onClick={() => setSelectedEmployee(null)}
                                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6 text-xs">
                            {/* Sección 1: Datos de Identificación Personal (Encriptados/Desencriptados) */}
                            <div>
                                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-3 flex items-center gap-1.5 text-cyan-700">
                                    <ShieldCheck className="w-4 h-4 text-cyan-600" />
                                    <span>Identificación Personal (Desencriptado)</span>
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Sexo</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.sexo || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Fecha Nacimiento</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.fechaNacimiento || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Estado Civil</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.estadoCivil || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">País</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.pais || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Teléfono</span>
                                        <span className="font-mono font-medium text-gray-900">{selectedEmployee.telefono || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Correo Electrónico</span>
                                        <span className="font-medium text-gray-900 truncate block" title={selectedEmployee.correoElectronico}>
                                            {selectedEmployee.correoElectronico || '-'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Sección 2: Domicilio y Ubicación */}
                            <div>
                                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-3 flex items-center gap-1.5 text-cyan-700">
                                    <Home className="w-4 h-4 text-cyan-600" />
                                    <span>Dirección y Residencia</span>
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <div className="col-span-2">
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Dirección</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.direccion || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Comuna</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.comuna || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Villa / Población</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.villaPoblacion || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Bloque</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.bloque || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Ciudad</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.ciudad || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Región</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.region || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Cód. Postal</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.codPostal || '-'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Sección 3: Datos Bancarios */}
                            <div>
                                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-3 flex items-center gap-1.5 text-cyan-700">
                                    <CreditCard className="w-4 h-4 text-cyan-600" />
                                    <span>Información Bancaria</span>
                                </h4>
                                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Banco</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.banco || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Cuenta Bancaria</span>
                                        <span className="font-mono font-medium text-gray-900">{selectedEmployee.cuentaBanco || '-'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Sección 4: Asignación Operativa y Laboral */}
                            <div>
                                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-3 flex items-center gap-1.5 text-cyan-700">
                                    <Briefcase className="w-4 h-4 text-cyan-600" />
                                    <span>Asignación Operativa y Contrato</span>
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">RBD</span>
                                        <span className="font-mono font-bold text-cyan-700">{selectedEmployee.rbd || '-'}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Establecimiento</span>
                                        <span className="font-semibold text-gray-900">{selectedEmployee.establecimiento || selectedEmployee.rbdRaw || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Sucursal</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.sucursal || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Centro de Distribución</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.centroDistribucion || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Cargo</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.cargo || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Área</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.area || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Supervisor</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.supervisor || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Empresa</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.empresa || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Tipo Contrato</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.tipoContrato || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Inicio Contrato</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.fechaInicioContrato || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Término Contrato</span>
                                        <span className="font-medium text-gray-900">{selectedEmployee.fechaTerminoContrato || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
                            <button
                                onClick={() => setSelectedEmployee(null)}
                                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
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
