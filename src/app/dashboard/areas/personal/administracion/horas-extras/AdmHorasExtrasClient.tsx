'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
    AdmHextraRegistroDTO,
    CargaHextraDTO,
    cambiarEstadoPeriodoCargaHextraAction,
    getAdmHorasExtrasAction,
    getHistorialCargasHextraAction,
    registrarAuditoriaExportacionHextraAction,
    toggleAplicaAdmHorasExtrasAction
} from './actions'
import {
    Clock,
    Search,
    Calendar,
    Download,
    Building2,
    RefreshCw,
    X,
    Check,
    Filter,
    Info,
    CheckCircle2,
    AlertCircle,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Lock,
    Unlock,
    FileSpreadsheet,
    ShieldCheck,
    FolderArchive,
    History
} from 'lucide-react'
import * as xlsx from 'xlsx'

interface EstablecimientoOption {
    rbd: number
    establecimiento: string
}

interface AdmHorasExtrasClientProps {
    initialRegistrosData: {
        data: AdmHextraRegistroDTO[]
        total: number
        page: number
        pageSize: number
        sucursales: string[]
        supervisores: string[]
        establecimientos: EstablecimientoOption[]
    }
    initialCargas: CargaHextraDTO[]
    userRbds: number[]
    isAdmin: boolean
}

export default function AdmHorasExtrasClient({
    initialRegistrosData,
    initialCargas,
    userRbds,
    isAdmin
}: AdmHorasExtrasClientProps) {
    const [tabActivo, setTabActivo] = useState<'cargas' | 'registros'>('cargas')

    const [cargas, setCargas] = useState<CargaHextraDTO[]>(initialCargas)
    const [registros, setRegistros] = useState<AdmHextraRegistroDTO[]>(initialRegistrosData.data)
    const [totalRegistros, setTotalRegistros] = useState(initialRegistrosData.total)
    const [isPending, startTransition] = useTransition()

    // Filtros Tab Registros
    const [filtroRbd, setFiltroRbd] = useState<number | null>(null)
    const [busquedaRbdNombre, setBusquedaRbdNombre] = useState('')
    const [isRbdDropdownOpen, setIsRbdDropdownOpen] = useState(false)
    const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'ABIERTO' | 'CERRADO'>('TODOS')
    const [filtroCargaId, setFiltroCargaId] = useState<string>('TODOS')
    const [filtroAplica, setFiltroAplica] = useState<'TODOS' | 'APLICA' | 'NO_APLICA'>('TODOS')
    const [filtroSucursal, setFiltroSucursal] = useState('TODAS')
    const [filtroSupervisor, setFiltroSupervisor] = useState('TODOS')
    const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
    const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
    const [busquedaTexto, setBusquedaTexto] = useState('')

    // Paginación y Ordenamiento Tab Registros (10 por página)
    const [paginaActual, setPaginaActual] = useState(1)
    const pageSize = 10
    type SortField = 'fecha' | 'rbd' | 'establecimiento' | 'nombreCompleto' | 'supervisor' | 'sucursal' | 'hhee' | 'atraso' | 'aplica' | 'estado'
    const [sortField, setSortField] = useState<SortField>('fecha')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

    const handleSort = (field: SortField) => {
        const newDirection = sortField === field ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'
        setSortField(field)
        setSortDirection(newDirection)
        recargarDatos(1, field, newDirection)
    }

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
        return sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
    }

    // Paginación y Ordenamiento Tab Cargas (10 por página)
    const [paginaCargas, setPaginaCargas] = useState(1)
    const porPaginaCargas = 10
    type SortFieldCargas = 'nombreArchivo' | 'fechaCarga' | 'cargadoPor' | 'totalRegistros' | 'estado'
    const [sortFieldCargas, setSortFieldCargas] = useState<SortFieldCargas>('fechaCarga')
    const [sortDirectionCargas, setSortDirectionCargas] = useState<'asc' | 'desc'>('desc')

    const handleSortCargas = (field: SortFieldCargas) => {
        if (sortFieldCargas === field) {
            setSortDirectionCargas(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortFieldCargas(field)
            setSortDirectionCargas('asc')
        }
        setPaginaCargas(1)
    }

    const renderSortIconCargas = (field: SortFieldCargas) => {
        if (sortFieldCargas !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
        return sortDirectionCargas === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
    }

    const cargasOrdenadas = useMemo(() => {
        return [...cargas].sort((a, b) => {
            let valA: any = a[sortFieldCargas] || ''
            let valB: any = b[sortFieldCargas] || ''
            if (typeof valA === 'string') valA = valA.toLowerCase()
            if (typeof valB === 'string') valB = valB.toLowerCase()

            if (valA < valB) return sortDirectionCargas === 'asc' ? -1 : 1
            if (valA > valB) return sortDirectionCargas === 'asc' ? 1 : -1
            return 0
        })
    }, [cargas, sortFieldCargas, sortDirectionCargas])

    const totalPaginasCargas = Math.ceil(cargasOrdenadas.length / porPaginaCargas) || 1
    const cargasPaginadas = useMemo(() => {
        const start = (paginaCargas - 1) * porPaginaCargas
        return cargasOrdenadas.slice(start, start + porPaginaCargas)
    }, [cargasOrdenadas, paginaCargas, porPaginaCargas])

    // Feedback
    const [guardadoStatus, setGuardadoStatus] = useState<{ [id: string]: boolean }>({})
    const [mensajeFeedback, setMensajeFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

    // Modal para Abrir / Cerrar Período
    const [modalPeriodo, setModalPeriodo] = useState<{
        isOpen: boolean
        carga: CargaHextraDTO | null
        accion: 'CERRAR' | 'ABRIR'
    }>({
        isOpen: false,
        carga: null,
        accion: 'CERRAR'
    })
    const [procesandoPeriodo, setProcesandoPeriodo] = useState(false)

    // Autocompletado de Establecimientos
    const establecimientosSugeridos = useMemo(() => {
        if (!busquedaRbdNombre.trim()) return initialRegistrosData.establecimientos.slice(0, 15)
        const term = busquedaRbdNombre.toLowerCase()
        return initialRegistrosData.establecimientos.filter(e =>
            e.rbd.toString().includes(term) ||
            e.establecimiento.toLowerCase().includes(term)
        ).slice(0, 15)
    }, [initialRegistrosData.establecimientos, busquedaRbdNombre])

    // Cargar / Refrescar datos
    const recargarDatos = (
        pagina: number = paginaActual,
        sortBy: SortField = sortField,
        sortDir: 'asc' | 'desc' = sortDirection
    ) => {
        startTransition(async () => {
            const [resReg, resCargas] = await Promise.all([
                getAdmHorasExtrasAction({
                    rbd: filtroRbd || undefined,
                    sucursal: filtroSucursal,
                    supervisor: filtroSupervisor,
                    fechaDesde: filtroFechaDesde || undefined,
                    fechaHasta: filtroFechaHasta || undefined,
                    aplica: filtroAplica,
                    estado: filtroEstado,
                    cargaId: filtroCargaId !== 'TODOS' ? filtroCargaId : undefined,
                    search: busquedaTexto || undefined,
                    page: pagina,
                    pageSize,
                    sortBy,
                    sortDir
                }),
                getHistorialCargasHextraAction()
            ])

            if (resReg.success) {
                setRegistros(resReg.data)
                setTotalRegistros(resReg.total)
                setPaginaActual(pagina)
            }
            if (resCargas.success) {
                setCargas(resCargas.data)
            }
            setMensajeFeedback({ tipo: 'success', texto: 'Datos actualizados correctamente.' })
            setTimeout(() => setMensajeFeedback(null), 3000)
        })
    }

    // Toggle Aplica / No Aplica en Administración
    const handleToggleAplica = async (registroId: string, valorActual: boolean, estadoPeriodo: string) => {
        if (estadoPeriodo === 'CERRADO') {
            setMensajeFeedback({
                tipo: 'error',
                texto: 'El período se encuentra CERRADO. No es posible modificar registros cerrados.'
            })
            setTimeout(() => setMensajeFeedback(null), 4000)
            return
        }

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

        const res = await toggleAplicaAdmHorasExtrasAction(registroId, nuevoValor)
        if (res.success) {
            setGuardadoStatus(prev => ({ ...prev, [registroId]: true }))
            setTimeout(() => {
                setGuardadoStatus(prev => ({ ...prev, [registroId]: false }))
            }, 2000)
        } else {
            recargarDatos()
            setMensajeFeedback({ tipo: 'error', texto: res.error || 'No se pudo actualizar el estado de la hora extra' })
            setTimeout(() => setMensajeFeedback(null), 4000)
        }
    }

    // Ejecutar Apertura / Cierre de Período
    const ejecutarCambioPeriodo = async () => {
        if (!modalPeriodo.carga) return
        setProcesandoPeriodo(true)

        const res = await cambiarEstadoPeriodoCargaHextraAction(
            modalPeriodo.carga.id,
            modalPeriodo.accion === 'CERRAR' ? 'CERRADO' : 'ABIERTO'
        )

        setProcesandoPeriodo(false)
        setModalPeriodo({ isOpen: false, carga: null, accion: 'CERRAR' })

        if (res.success) {
            setMensajeFeedback({
                tipo: 'success',
                texto: res.message || 'Estado del período actualizado con éxito.'
            })
            recargarDatos(1)
            setTimeout(() => setMensajeFeedback(null), 4000)
        } else {
            setMensajeFeedback({
                tipo: 'error',
                texto: res.error || 'Ocurrió un error al cambiar el estado del período.'
            })
            setTimeout(() => setMensajeFeedback(null), 4000)
        }
    }

    // Exportar a Excel (Con Auditoría)
    const exportarExcel = async () => {
        if (registros.length === 0) {
            alert('No hay registros para exportar con los filtros seleccionados.')
            return
        }

        const datosExport = registros.map(r => ({
            'Fecha': r.fecha,
            'RBD': r.rbd || '',
            'Establecimiento': r.establecimiento || '',
            'Sucursal': r.sucursal,
            'Supervisor': r.supervisor || '',
            'RUT': r.rut,
            'Colaborador': r.nombreCompleto,
            'Cargo': r.cargo || '',
            'Entró': r.entro || '',
            'Salió': r.salio || '',
            'Turno': r.turno || '',
            'HHEE': r.hhee,
            'Atraso': r.atraso,
            '¿Aplica HHEE?': r.aplica ? 'SÍ (Aplica)' : 'NO (No Aplica)',
            'Modificado Por': r.aplicaModificadoPor || 'Por Defecto (No Aplica)',
            'Fecha Modificación': r.aplicaModificadoAt ? new Date(r.aplicaModificadoAt).toLocaleString('es-CL') : '',
            'Estado Período': r.estado,
            'Planilla Origen': r.cargaNombreArchivo || ''
        }))

        const ws = xlsx.utils.json_to_sheet(datosExport)
        const wb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(wb, ws, 'Adm_Hrs_Extras')
        const nombreArchivo = `Adm_Hrs_Extras_Reporte_${new Date().toISOString().slice(0, 10)}.xlsx`
        xlsx.writeFile(wb, nombreArchivo)

        // Registrar auditoría
        await registrarAuditoriaExportacionHextraAction(
            registros.length,
            `Filtros: [Estado: ${filtroEstado}, Aplica: ${filtroAplica}, Sucursal: ${filtroSucursal}, Carga: ${filtroCargaId}]`
        )
    }

    // Salto rápido a registros de una carga
    const irARegistrosDeCarga = (cargaId: string) => {
        setFiltroCargaId(cargaId)
        setTabActivo('registros')
        setTimeout(() => recargarDatos(1), 50)
    }

    // Métricas
    const totalAplica = useMemo(() => registros.filter(r => r.aplica).length, [registros])
    const totalNoAplica = useMemo(() => registros.filter(r => !r.aplica).length, [registros])
    const totalHhee = useMemo(() => registros.reduce((acc, r) => acc + (r.aplica ? r.hhee : 0), 0), [registros])
    const totalPaginas = Math.ceil(totalRegistros / pageSize) || 1

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
            {/* Header Corporativo Hendaya */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <div className="flex items-center gap-2 text-cyan-600 font-semibold text-xs tracking-wider uppercase mb-1">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Áreas · Recursos Humanos · Administración</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        Adm. de Hrs Extras
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Control administrativo de horas extras, cierre y apertura de períodos por planilla Excel, auditoría de aprobación y exportación consolidada.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => recargarDatos(1)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-xl border border-gray-200 text-xs font-semibold transition-colors shadow-sm"
                        title="Recargar datos"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-cyan-600' : 'text-gray-500'}`} />
                        <span>Refrescar</span>
                    </button>
                    {tabActivo === 'registros' && (
                        <button
                            onClick={exportarExcel}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                            title="Exportar a Excel con registro de auditoría"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Exportar Excel</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Notificación de feedback */}
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

            {/* Aviso de RBDs restringidos por perfil */}
            {!isAdmin && userRbds.length > 0 && (
                <div className="flex items-center gap-2 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs shadow-sm">
                    <Info className="w-4 h-4 flex-shrink-0 text-amber-600" />
                    <span>
                        Acceso restringido por perfil: Solo puedes visualizar y gestionar los <strong>{userRbds.length}</strong> establecimientos (RBDs) asociados a tu cuenta.
                    </span>
                </div>
            )}

            {/* Barra de Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                <button
                    onClick={() => setTabActivo('cargas')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
                        tabActivo === 'cargas'
                            ? 'bg-cyan-600 text-white shadow-sm'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                >
                    <FolderArchive className="w-4 h-4" />
                    <span>Historial de Documentos Cargados</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tabActivo === 'cargas' ? 'bg-cyan-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {cargas.length}
                    </span>
                </button>
                <button
                    onClick={() => setTabActivo('registros')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
                        tabActivo === 'registros'
                            ? 'bg-cyan-600 text-white shadow-sm'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                >
                    <History className="w-4 h-4" />
                    <span>Historial y Gestión de Registros</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tabActivo === 'registros' ? 'bg-cyan-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {totalRegistros}
                    </span>
                </button>
            </div>

            {/* ======================================================== */}
            {/* TAB 1: HISTORIAL DE DOCUMENTOS CARGADOS (PLANILLAS)     */}
            {/* ======================================================== */}
            {tabActivo === 'cargas' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500 font-medium">Total Planillas Horas Extras</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{cargas.length}</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600">
                                <FileSpreadsheet className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs text-emerald-600 font-medium">Períodos Abiertos</p>
                                <p className="text-2xl font-bold text-emerald-700 mt-1">
                                    {cargas.filter(c => c.estado === 'ABIERTO').length}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <Unlock className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs text-rose-600 font-medium">Períodos Cerrados</p>
                                <p className="text-2xl font-bold text-rose-700 mt-1">
                                    {cargas.filter(c => c.estado === 'CERRADO').length}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                                <Lock className="w-5 h-5" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-gray-900 text-sm">Planillas Excel de Horas Extras Cargadas</h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Al cerrar un período, todos sus puntos quedan congelados y dejan de mostrarse en el módulo operativo de Asistencia.
                                </p>
                            </div>
                        </div>

                        {cargas.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 text-xs">
                                No hay planillas Excel de horas extras registradas en el sistema.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-gray-100 text-gray-600 uppercase text-[10px] tracking-wider font-semibold">
                                        <tr>
                                            <th 
                                                onClick={() => handleSortCargas('nombreArchivo')}
                                                className="py-3 px-4 cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por Archivo"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortFieldCargas === 'nombreArchivo' ? 'text-cyan-800 font-bold' : ''}>Archivo</span>
                                                    {renderSortIconCargas('nombreArchivo')}
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSortCargas('fechaCarga')}
                                                className="py-3 px-4 cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por Fecha Carga"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortFieldCargas === 'fechaCarga' ? 'text-cyan-800 font-bold' : ''}>Fecha Carga</span>
                                                    {renderSortIconCargas('fechaCarga')}
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSortCargas('cargadoPor')}
                                                className="py-3 px-4 cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por Cargado Por"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortFieldCargas === 'cargadoPor' ? 'text-cyan-800 font-bold' : ''}>Cargado Por</span>
                                                    {renderSortIconCargas('cargadoPor')}
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSortCargas('totalRegistros')}
                                                className="py-3 px-4 text-center cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por Registros"
                                            >
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span className={sortFieldCargas === 'totalRegistros' ? 'text-cyan-800 font-bold' : ''}>Registros</span>
                                                    {renderSortIconCargas('totalRegistros')}
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSortCargas('estado')}
                                                className="py-3 px-4 text-center cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por Estado"
                                            >
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span className={sortFieldCargas === 'estado' ? 'text-cyan-800 font-bold' : ''}>Estado Período</span>
                                                    {renderSortIconCargas('estado')}
                                                </div>
                                            </th>
                                            <th className="py-3 px-4">Detalle Cierre</th>
                                            <th className="py-3 px-4 text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-gray-700">
                                        {cargasPaginadas.map(c => {
                                            const esCerrado = c.estado === 'CERRADO'
                                            return (
                                                <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                                                    <td className="py-3 px-4 font-semibold text-gray-900">
                                                        <div className="flex items-center gap-2">
                                                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                                            <span className="truncate max-w-xs" title={c.nombreArchivo}>
                                                                {c.nombreArchivo}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-gray-500">
                                                        {c.fechaCarga ? new Date(c.fechaCarga).toLocaleString('es-CL') : '-'}
                                                    </td>
                                                    <td className="py-3 px-4 font-medium text-gray-700">
                                                        {c.cargadoPor}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                                                            {c.totalRegistros} filas
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        {esCerrado ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                                <Lock className="w-3 h-3 text-rose-600" />
                                                                <span>CERRADO</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                <Unlock className="w-3 h-3 text-emerald-600" />
                                                                <span>ABIERTO</span>
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-gray-500 text-[11px]">
                                                        {esCerrado ? (
                                                            <div>
                                                                <p className="font-semibold text-gray-700">Por: {c.cerradoPor || 'Admin'}</p>
                                                                <p className="text-[10px] text-gray-400">
                                                                    {c.cerradoAt ? new Date(c.cerradoAt).toLocaleString('es-CL') : ''}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 italic">En revisión activa</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => irARegistrosDeCarga(c.id)}
                                                                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-[11px] transition-colors"
                                                                title="Ver registros vinculados a esta planilla"
                                                            >
                                                                Ver registros
                                                            </button>

                                                            {esCerrado ? (
                                                                <button
                                                                    onClick={() => setModalPeriodo({ isOpen: true, carga: c, accion: 'ABRIR' })}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold rounded-lg text-[11px] transition-colors"
                                                                    title="Reabrir período para permitir modificaciones"
                                                                >
                                                                    <Unlock className="w-3 h-3" />
                                                                    <span>Abrir</span>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setModalPeriodo({ isOpen: true, carga: c, accion: 'CERRAR' })}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold rounded-lg text-[11px] transition-colors"
                                                                    title="Cerrar período y congelar registros cargados"
                                                                >
                                                                    <Lock className="w-3 h-3" />
                                                                    <span>Cerrar período</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Paginación Cargas */}
                        {cargasOrdenadas.length > porPaginaCargas && (
                            <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50">
                                <span>
                                    Mostrando {((paginaCargas - 1) * porPaginaCargas) + 1} - {Math.min(paginaCargas * porPaginaCargas, cargasOrdenadas.length)} de {cargasOrdenadas.length} planillas
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={paginaCargas === 1}
                                        onClick={() => setPaginaCargas(p => Math.max(p - 1, 1))}
                                        className="px-3 py-1.5 bg-white hover:bg-gray-50 disabled:opacity-40 rounded-lg text-gray-700 border border-gray-200 font-semibold shadow-2xs"
                                    >
                                        Anterior
                                    </button>
                                    <span className="font-semibold text-gray-700">
                                        Página {paginaCargas} de {totalPaginasCargas}
                                    </span>
                                    <button
                                        disabled={paginaCargas >= totalPaginasCargas}
                                        onClick={() => setPaginaCargas(p => Math.min(p + 1, totalPaginasCargas))}
                                        className="px-3 py-1.5 bg-white hover:bg-gray-50 disabled:opacity-40 rounded-lg text-gray-700 border border-gray-200 font-semibold shadow-2xs"
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* TAB 2: HISTORIAL Y GESTIÓN DE REGISTROS                 */}
            {/* ======================================================== */}
            {tabActivo === 'registros' && (
                <div className="space-y-4">
                    {/* Tarjetas de Métricas */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Registros</span>
                            <p className="text-xl font-bold text-gray-900 mt-0.5">{totalRegistros}</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Aplica HHEE</span>
                            <p className="text-xl font-bold text-emerald-700 mt-0.5">{totalAplica}</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">No Aplica HHEE</span>
                            <p className="text-xl font-bold text-amber-700 mt-0.5">{totalNoAplica}</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-cyan-600 uppercase tracking-wider">Horas HHEE Aprobadas</span>
                            <p className="text-xl font-bold text-cyan-700 mt-0.5">{totalHhee.toFixed(1)} hrs</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Períodos Cerrados</span>
                            <p className="text-xl font-bold text-rose-700 mt-0.5">
                                {registros.filter(r => r.estado === 'CERRADO').length}
                            </p>
                        </div>
                    </div>

                    {/* Barra de Filtros */}
                    <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                                <Filter className="w-3.5 h-3.5 text-cyan-600" />
                                <span>Filtros de Búsqueda Avanzada</span>
                            </div>
                            {(busquedaRbdNombre || filtroRbd || filtroEstado !== 'TODOS' || filtroCargaId !== 'TODOS' || filtroAplica !== 'TODOS' || filtroSucursal !== 'TODAS' || filtroSupervisor !== 'TODOS' || filtroFechaDesde || filtroFechaHasta || busquedaTexto) && (
                                <button
                                    onClick={() => {
                                        setBusquedaRbdNombre('')
                                        setFiltroRbd(null)
                                        setFiltroEstado('TODOS')
                                        setFiltroCargaId('TODOS')
                                        setFiltroAplica('TODOS')
                                        setFiltroSucursal('TODAS')
                                        setFiltroSupervisor('TODOS')
                                        setFiltroFechaDesde('')
                                        setFiltroFechaHasta('')
                                        setBusquedaTexto('')
                                        setTimeout(() => recargarDatos(1), 50)
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

                            {/* Filtro Estado del Período */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Estado Período</label>
                                <select
                                    value={filtroEstado}
                                    onChange={e => setFiltroEstado(e.target.value as any)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                                >
                                    <option value="TODOS">Todos los Estados</option>
                                    <option value="ABIERTO">Abiertos (Modificables)</option>
                                    <option value="CERRADO">Cerrados (Bloqueados)</option>
                                </select>
                            </div>

                            {/* Filtro Planilla / Carga */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Planilla Origen</label>
                                <select
                                    value={filtroCargaId}
                                    onChange={e => setFiltroCargaId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white truncate"
                                >
                                    <option value="TODOS">Todas las planillas</option>
                                    {cargas.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.nombreArchivo} ({c.estado})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro Aplica / No Aplica */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">¿Aplica Hr Extra?</label>
                                <select
                                    value={filtroAplica}
                                    onChange={e => setFiltroAplica(e.target.value as any)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                                >
                                    <option value="TODOS">Todos</option>
                                    <option value="APLICA">Solo Aplica</option>
                                    <option value="NO_APLICA">Solo No Aplica</option>
                                </select>
                            </div>

                            {/* Sucursal */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Sucursal / Sede</label>
                                <select
                                    value={filtroSucursal}
                                    onChange={e => setFiltroSucursal(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                                >
                                    <option value="TODAS">Todas las Sucursales</option>
                                    {initialRegistrosData.sucursales.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Supervisor */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Supervisor</label>
                                <select
                                    value={filtroSupervisor}
                                    onChange={e => setFiltroSupervisor(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                                >
                                    <option value="TODOS">Todos los Supervisores</option>
                                    {initialRegistrosData.supervisores.map(sup => (
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

                            {/* Búsqueda general */}
                            <div className="md:col-span-4">
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Buscar por RUT, Nombre o Cargo</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Escribe para buscar..."
                                        value={busquedaTexto}
                                        onChange={e => setBusquedaTexto(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') recargarDatos(1) }}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                                    />
                                    <button
                                        onClick={() => recargarDatos(1)}
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
                        {registros.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 text-xs">
                                No se encontraron registros de horas extras que coincidan con los filtros aplicados.
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
                                                onClick={() => handleSort('estado')}
                                                className="py-3 px-3 text-center cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por Estado Período"
                                            >
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span className={sortField === 'estado' ? 'text-cyan-800 font-bold' : ''}>Estado Período</span>
                                                    {renderSortIcon('estado')}
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
                                        {registros.map(r => {
                                            const esCerrado = r.estado === 'CERRADO'
                                            return (
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

                                                    {/* Estado Período */}
                                                    <td className="py-3 px-3 text-center whitespace-nowrap">
                                                        {esCerrado ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                                <Lock className="w-3 h-3 text-rose-600" />
                                                                <span>CERRADO</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                <Unlock className="w-3 h-3 text-emerald-600" />
                                                                <span>ABIERTO</span>
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Botón Aplica / No Aplica */}
                                                    <td className="py-3 px-3 text-center whitespace-nowrap">
                                                        {esCerrado ? (
                                                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-400 text-xs font-semibold">
                                                                <Lock className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                                                                <span>{r.aplica ? 'Aplica (Bloqueado)' : 'No Aplica (Bloqueado)'}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="inline-flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleToggleAplica(r.id, r.aplica, r.estado)}
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
                                                        )}
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
                                            )
                                        })}
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
                                        onClick={() => recargarDatos(paginaActual - 1)}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-semibold"
                                    >
                                        Anterior
                                    </button>
                                    <span className="px-3 py-1.5 font-bold text-gray-800">
                                        {paginaActual} / {totalPaginas}
                                    </span>
                                    <button
                                        disabled={paginaActual === totalPaginas || isPending}
                                        onClick={() => recargarDatos(paginaActual + 1)}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-semibold"
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Confirmación para Abrir / Cerrar Período */}
            {modalPeriodo.isOpen && modalPeriodo.carga && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                modalPeriodo.accion === 'CERRAR' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                                {modalPeriodo.accion === 'CERRAR' ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-base">
                                    {modalPeriodo.accion === 'CERRAR' ? '¿Cerrar período de horas extras?' : '¿Reabrir período de horas extras?'}
                                </h3>
                                <p className="text-xs text-gray-500">
                                    Planilla: <strong>{modalPeriodo.carga.nombreArchivo}</strong>
                                </p>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs text-gray-600 space-y-2">
                            {modalPeriodo.accion === 'CERRAR' ? (
                                <>
                                    <p>
                                        Al cerrar este período, los <strong>{modalPeriodo.carga.totalRegistros}</strong> registros de esta planilla quedarán <strong>bloqueados</strong>.
                                    </p>
                                    <p className="text-rose-700 font-medium">
                                        ⚠️ Esta información dejará de mostrarse en el módulo operativo de Asistencia y los usuarios ya no podrán alterar la condición "Aplica / No aplica".
                                    </p>
                                </>
                            ) : (
                                <p>
                                    Al reabrir este período, los <strong>{modalPeriodo.carga.totalRegistros}</strong> registros volverán a estar disponibles y podrán modificarse nuevamente en Asistencia.
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                disabled={procesandoPeriodo}
                                onClick={() => setModalPeriodo({ isOpen: false, carga: null, accion: 'CERRAR' })}
                                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={procesandoPeriodo}
                                onClick={ejecutarCambioPeriodo}
                                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-colors flex items-center gap-1.5 ${
                                    modalPeriodo.accion === 'CERRAR'
                                        ? 'bg-rose-600 hover:bg-rose-700'
                                        : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                            >
                                {procesandoPeriodo && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                <span>
                                    {modalPeriodo.accion === 'CERRAR' ? 'Sí, Cerrar Período' : 'Sí, Reabrir Período'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
