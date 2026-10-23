'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
    AdmAtrasosRegistroDTO,
    CargaAtrasosDTO,
    getAdmAtrasosAction,
    getHistorialCargasAtrasosAction,
    cambiarEstadoPeriodoCargaAtrasosAction,
    actualizarAtrasoAdminAction,
    eliminarCargaAtrasosAdminAction
} from './actions'
import * as xlsx from 'xlsx'
import {
    Clock,
    FileSpreadsheet,
    Lock,
    Unlock,
    RefreshCw,
    Download,
    Search,
    Building2,
    Calendar,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    AlertTriangle,
    CheckCircle2,
    Check,
    X,
    Filter,
    Eye,
    Edit3,
    ShieldAlert,
    Timer,
    Info,
    CheckCircle,
    Trash2
} from 'lucide-react'

interface EstablecimientoOption {
    rbd: number
    establecimiento: string
}

interface Props {
    initialRegistrosData: {
        data: AdmAtrasosRegistroDTO[]
        total: number
        page: number
        pageSize: number
        sucursales: string[]
        supervisores: string[]
        establecimientos: EstablecimientoOption[]
        resumen?: {
            totalRegistros: number
            totalMinutosAtraso: number
            totalMinutosAdelanto: number
            totalAplicaDescuento: number
            totalJustificados: number
        }
    }
    initialCargas: CargaAtrasosDTO[]
    userRbds: number[]
    isAdmin: boolean
    puedeGestionarPeriodos?: boolean
}

export default function AdmAtrasosClient({
    initialRegistrosData,
    initialCargas,
    userRbds,
    isAdmin,
    puedeGestionarPeriodos = false
}: Props) {
    const [tabActivo, setTabActivo] = useState<'cargas' | 'registros'>('cargas')

    const [cargas, setCargas] = useState<CargaAtrasosDTO[]>(initialCargas)
    const [registros, setRegistros] = useState<AdmAtrasosRegistroDTO[]>(initialRegistrosData.data)
    const [totalRegistros, setTotalRegistros] = useState(initialRegistrosData.total)
    const [resumen, setResumen] = useState(initialRegistrosData.resumen)
    const [isPending, startTransition] = useTransition()

    const formatMinutesToHours = (mins: number) => {
        const hours = Math.floor(mins / 60)
        const remMins = mins % 60
        return `${hours.toLocaleString('es-CL')} hrs ${remMins > 0 ? `${remMins} min` : ''}`
    }

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

    // Paginación Tab Registros
    const [paginaActual, setPaginaActual] = useState(1)
    const pageSize = 10
    type SortField = 'fecha' | 'rbd' | 'establecimiento' | 'nombreCompleto' | 'supervisor' | 'sucursal' | 'minutosAtraso' | 'minutosAdelanto' | 'aplicaDescuento' | 'estado'
    const [sortField, setSortField] = useState<SortField>('fecha')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

    // Paginación Tab Cargas
    const [paginaCargas, setPaginaCargas] = useState(1)
    const porPaginaCargas = 10
    type SortFieldCargas = 'nombreArchivo' | 'fechaCarga' | 'cargadoPor' | 'totalRegistros' | 'estado'
    const [sortFieldCargas, setSortFieldCargas] = useState<SortFieldCargas>('fechaCarga')
    const [sortDirectionCargas, setSortDirectionCargas] = useState<'asc' | 'desc'>('desc')

    // Modal de confirmación para Cerrar / Abrir Período
    const [modalPeriodo, setModalPeriodo] = useState<{
        isOpen: boolean
        carga: CargaAtrasosDTO | null
        accion: 'CERRAR' | 'ABRIR'
    }>({
        isOpen: false,
        carga: null,
        accion: 'CERRAR'
    })
    const [procesandoPeriodo, setProcesandoPeriodo] = useState(false)

    // Modal de confirmación para Eliminar Carga / Planilla
    const [modalDeleteCarga, setModalDeleteCarga] = useState<{
        isOpen: boolean
        carga: CargaAtrasosDTO | null
    }>({
        isOpen: false,
        carga: null
    })
    const [procesandoDeleteCarga, setProcesandoDeleteCarga] = useState(false)

    // Modal de Edición de Registro
    const [modalEdit, setModalEdit] = useState<{
        isOpen: boolean
        registro: AdmAtrasosRegistroDTO | null
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

    const [mensajeFeedback, setMensajeFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

    // Recargar datos desde el servidor
    const recargarDatos = (
        newPage = paginaActual,
        newSortField = sortField,
        newSortDir = sortDirection
    ) => {
        startTransition(async () => {
            const [resReg, resCargas] = await Promise.all([
                getAdmAtrasosAction({
                    rbd: filtroRbd || undefined,
                    sucursal: filtroSucursal !== 'TODAS' ? filtroSucursal : undefined,
                    supervisor: filtroSupervisor !== 'TODOS' ? filtroSupervisor : undefined,
                    fechaDesde: filtroFechaDesde || undefined,
                    fechaHasta: filtroFechaHasta || undefined,
                    aplicaDescuento: filtroAplica !== 'TODOS' ? filtroAplica : undefined,
                    estado: filtroEstado !== 'TODOS' ? filtroEstado : undefined,
                    cargaId: filtroCargaId !== 'TODOS' ? filtroCargaId : undefined,
                    search: busquedaTexto.trim() || undefined,
                    page: newPage,
                    pageSize,
                    sortBy: newSortField,
                    sortDir: newSortDir
                }),
                getHistorialCargasAtrasosAction()
            ])

            if (resReg.success && resReg.data) {
                setRegistros(resReg.data)
                setTotalRegistros(resReg.total)
                if (resReg.resumen) setResumen(resReg.resumen)
                setPaginaActual(newPage)
                setSortField(newSortField)
                setSortDirection(newSortDir)
            }
            if (resCargas.success && resCargas.data) {
                setCargas(resCargas.data)
            }
        })
    }

    const handleSort = (field: SortField) => {
        const newDirection = sortField === field ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'
        setSortField(field)
        setSortDirection(newDirection)
        recargarDatos(1, field, newDirection)
    }

    const handleSortCargas = (field: SortFieldCargas) => {
        if (sortFieldCargas === field) {
            setSortDirectionCargas(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortFieldCargas(field)
            setSortDirectionCargas('asc')
        }
        setPaginaCargas(1)
    }

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        recargarDatos(1, sortField, sortDirection)
    }

    const handleClearFilters = () => {
        setFiltroRbd(null)
        setBusquedaRbdNombre('')
        setFiltroEstado('TODOS')
        setFiltroCargaId('TODOS')
        setFiltroAplica('TODOS')
        setFiltroSucursal('TODAS')
        setFiltroSupervisor('TODOS')
        setFiltroFechaDesde('')
        setFiltroFechaHasta('')
        setBusquedaTexto('')
        startTransition(async () => {
            const res = await getAdmAtrasosAction({ page: 1, pageSize })
            if (res.success && res.data) {
                setRegistros(res.data)
                setTotalRegistros(res.total)
                if (res.resumen) setResumen(res.resumen)
                setPaginaActual(1)
            }
        })
    }

    // Ejecutar Apertura / Cierre de Período
    const handleConfirmarPeriodo = async () => {
        if (!modalPeriodo.carga) return
        setProcesandoPeriodo(true)

        const nuevoEstado = modalPeriodo.accion === 'CERRAR' ? 'CERRADO' : 'ABIERTO'
        const res = await cambiarEstadoPeriodoCargaAtrasosAction(modalPeriodo.carga.id, nuevoEstado)

        setProcesandoPeriodo(false)
        setModalPeriodo({ isOpen: false, carga: null, accion: 'CERRAR' })

        if (res.success) {
            setMensajeFeedback({
                tipo: 'success',
                texto: res.message || `Período actualizado a ${nuevoEstado} con éxito.`
            })
            recargarDatos(paginaActual, sortField, sortDirection)
            setTimeout(() => setMensajeFeedback(null), 4000)
        } else {
            setMensajeFeedback({
                tipo: 'error',
                texto: res.error || 'Error al modificar el estado del período'
            })
            setTimeout(() => setMensajeFeedback(null), 5000)
        }
    }

    // Ejecutar Eliminación de Carga / Planilla completa
    const handleConfirmarEliminarCarga = async () => {
        if (!modalDeleteCarga.carga) return
        setProcesandoDeleteCarga(true)

        const cargaId = modalDeleteCarga.carga.id
        const nombreArchivo = modalDeleteCarga.carga.nombreArchivo
        const res = await eliminarCargaAtrasosAdminAction(cargaId)

        setProcesandoDeleteCarga(false)
        setModalDeleteCarga({ isOpen: false, carga: null })

        if (res.success) {
            setMensajeFeedback({
                tipo: 'success',
                texto: `Planilla "${nombreArchivo}" eliminada correctamente (${res.eliminados || 0} registros removidos).`
            })
            recargarDatos(1, sortField, sortDirection)
            setTimeout(() => setMensajeFeedback(null), 4000)
        } else {
            setMensajeFeedback({
                tipo: 'error',
                texto: res.error || 'Error al eliminar la planilla'
            })
            setTimeout(() => setMensajeFeedback(null), 5000)
        }
    }

    // Exportar a Excel
    const handleExportarExcel = async () => {
        startTransition(async () => {
            // Traer todos los registros que coinciden con los filtros actuales
            const res = await getAdmAtrasosAction({
                rbd: filtroRbd || undefined,
                sucursal: filtroSucursal !== 'TODAS' ? filtroSucursal : undefined,
                supervisor: filtroSupervisor !== 'TODOS' ? filtroSupervisor : undefined,
                fechaDesde: filtroFechaDesde || undefined,
                fechaHasta: filtroFechaHasta || undefined,
                aplicaDescuento: filtroAplica !== 'TODOS' ? filtroAplica : undefined,
                estado: filtroEstado !== 'TODOS' ? filtroEstado : undefined,
                cargaId: filtroCargaId !== 'TODOS' ? filtroCargaId : undefined,
                search: busquedaTexto.trim() || undefined,
                page: 1,
                pageSize: 50000 // Traer todos para el reporte
            })

            const exportData = (res.allMatchingData || res.data).map(r => ({
                'Fecha': r.fecha,
                'RUT': r.rut,
                'Colaborador': r.nombreCompleto,
                'Cargo': r.cargo || '',
                'RBD': r.rbd || '',
                'Establecimiento': r.establecimiento || '',
                'Sede': r.sucursal,
                'Supervisor': r.supervisor || '',
                'Turno': r.turno || '',
                'Marcó': r.marco || '',
                'Entrada': r.entro || '',
                'Salida': r.salio || '',
                'Minutos Atraso': r.minutosAtraso,
                'Minutos Adelanto': r.minutosAdelanto,
                '¿Aplica Descuento?': r.aplicaDescuento ? 'SÍ' : 'NO',
                'Justificación': r.justificado || 'SIN JUSTIFICAR',
                'Observación': r.observacion || '',
                'Estado Período': r.estado,
                'Planilla Origen': r.cargaNombreArchivo || 'Sin Carga'
            }))

            const ws = xlsx.utils.json_to_sheet(exportData)
            const wb = xlsx.utils.book_new()
            xlsx.utils.book_append_sheet(wb, ws, 'Atrasos_Adelantos')
            const nombreArchivo = `Reporte_Atrasos_Adelantos_${new Date().toISOString().slice(0, 10)}.xlsx`
            xlsx.writeFile(wb, nombreArchivo)
        })
    }

    // Guardar edición admin
    const handleSaveAdminEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!modalEdit.registro) return

        startTransition(async () => {
            const res = await actualizarAtrasoAdminAction(
                modalEdit.registro!.id,
                modalEdit.aplicaDescuento,
                modalEdit.justificado.trim(),
                modalEdit.observacion.trim()
            )

            if (res.success) {
                setRegistros(prev => prev.map(r =>
                    r.id === modalEdit.registro!.id
                        ? {
                            ...r,
                            aplicaDescuento: modalEdit.aplicaDescuento,
                            justificado: modalEdit.justificado.trim() || null,
                            observacion: modalEdit.observacion.trim() || null
                        }
                        : r
                ))
                setModalEdit({ isOpen: false, registro: null, aplicaDescuento: false, justificado: '', observacion: '' })
                setMensajeFeedback({ tipo: 'success', texto: 'Registro actualizado correctamente por Administración.' })
                setTimeout(() => setMensajeFeedback(null), 3000)
            } else {
                alert(res.error || 'Error al actualizar el registro')
            }
        })
    }

    // Ordenamiento Tab Cargas
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
    }, [cargasOrdenadas, paginaCargas])

    const totalPagesRegistros = Math.ceil(totalRegistros / pageSize) || 1

    // Establecimientos filtrados
    const establecimientosFiltrados = initialRegistrosData.establecimientos.filter(e => {
        if (!busquedaRbdNombre.trim()) return true
        const term = busquedaRbdNombre.toLowerCase()
        return e.rbd.toString().includes(term) || e.establecimiento.toLowerCase().includes(term)
    }).slice(0, 15)

    return (
        <div className="space-y-6">
            {/* Header Corporativo Hendaya */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <div className="flex items-center gap-2 text-cyan-600 font-semibold text-xs tracking-wider uppercase mb-1">
                        <Clock className="w-4 h-4" />
                        <span>Áreas · Recursos Humanos · Administración</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        Adm. Atrasos y Adelantos
                        <span className="text-xs px-2.5 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-full font-medium">
                            Control de Períodos
                        </span>
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Control administrativo de planillas de atrasos y adelantos, cierre/reapertura de períodos, auditoría y descarga consolidada para remuneraciones.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleExportarExcel}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                        title="Descargar reporte en Excel con los filtros aplicados"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Exportar a Excel</span>
                    </button>
                    <button
                        onClick={() => recargarDatos()}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-xl border border-gray-200 text-xs font-semibold transition-colors shadow-sm"
                        title="Refrescar datos"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-cyan-600' : 'text-gray-500'}`} />
                        <span>Refrescar</span>
                    </button>
                </div>
            </div>

            {/* Mensaje de feedback */}
            {mensajeFeedback && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                    mensajeFeedback.tipo === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                    {mensajeFeedback.tipo === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    ) : (
                        <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                    )}
                    <span className="text-xs font-medium">{mensajeFeedback.texto}</span>
                </div>
            )}

            {/* Selector de Pestañas */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setTabActivo('cargas')}
                    className={`pb-3 px-4 text-xs font-bold transition-all relative flex items-center gap-2 ${
                        tabActivo === 'cargas'
                            ? 'text-cyan-600 border-b-2 border-cyan-600'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Planillas y Períodos Cargados</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-50 text-cyan-700 font-bold border border-cyan-200">
                        {cargas.length}
                    </span>
                </button>
                <button
                    onClick={() => setTabActivo('registros')}
                    className={`pb-3 px-4 text-xs font-bold transition-all relative flex items-center gap-2 ${
                        tabActivo === 'registros'
                            ? 'text-cyan-600 border-b-2 border-cyan-600'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Clock className="w-4 h-4" />
                    <span>Historial Consolidado de Registros</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-700 font-bold">
                        {totalRegistros.toLocaleString('es-CL')}
                    </span>
                </button>
            </div>

            {/* ======================================================== */}
            {/* TAB 1: HISTORIAL DE DOCUMENTOS EXCEL Y CIERRE DE PERÍODOS */}
            {/* ======================================================== */}
            {tabActivo === 'cargas' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-gray-900 text-sm">Planillas Excel de Atrasos Cargadas</h3>
                                <p className="text-xs text-gray-500">
                                    Al cerrar un período, sus registros quedan congelados para supervisores en Asistencia.
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                                        <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortCargas('nombreArchivo')}>
                                            <div className="flex items-center gap-1">
                                                <span>Planilla / Archivo</span>
                                                {sortFieldCargas === 'nombreArchivo' ? (sortDirectionCargas === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                            </div>
                                        </th>
                                        <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortCargas('fechaCarga')}>
                                            <div className="flex items-center gap-1">
                                                <span>Fecha de Carga</span>
                                                {sortFieldCargas === 'fechaCarga' ? (sortDirectionCargas === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                            </div>
                                        </th>
                                        <th className="py-3 px-4">Cargado Por</th>
                                        <th className="py-3 px-4 text-center">Registros</th>
                                        <th className="py-3 px-4 text-center">Estado Período</th>
                                        <th className="py-3 px-4">Detalle Cierre</th>
                                        <th className="py-3 px-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-gray-700">
                                    {cargasPaginadas.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-gray-400">
                                                No hay planillas de atrasos y adelantos cargadas en el sistema.
                                            </td>
                                        </tr>
                                    ) : (
                                        cargasPaginadas.map(c => {
                                            const esCerrado = c.estado === 'CERRADO'
                                            return (
                                                <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                                                    <td className="py-3 px-4 font-semibold text-gray-900">
                                                        <div className="flex items-center gap-2">
                                                            <FileSpreadsheet className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                                                            <span className="truncate max-w-xs" title={c.nombreArchivo}>{c.nombreArchivo}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
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
                                                            <span className="text-gray-400 italic">En edición activa</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-center whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            {puedeGestionarPeriodos ? (
                                                                <button
                                                                    onClick={() => setModalPeriodo({
                                                                        isOpen: true,
                                                                        carga: c,
                                                                        accion: esCerrado ? 'ABRIR' : 'CERRAR'
                                                                    })}
                                                                    className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                                                                        esCerrado
                                                                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                                                                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                                                    }`}
                                                                    title={esCerrado ? 'Reabrir período para supervisores' : 'Cerrar período y congelar registros'}
                                                                >
                                                                    {esCerrado ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                                                    <span>{esCerrado ? 'Reabrir' : 'Cerrar'}</span>
                                                                </button>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-400 italic">Sin permiso cierre</span>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    setFiltroCargaId(c.id)
                                                                    setTabActivo('registros')
                                                                    recargarDatos(1)
                                                                }}
                                                                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
                                                                title="Ver registros de esta planilla"
                                                            >
                                                                Ver Filas
                                                            </button>
                                                            {isAdmin && (
                                                                <button
                                                                    onClick={() => setModalDeleteCarga({ isOpen: true, carga: c })}
                                                                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                    title="Eliminar planilla y sus registros"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginación Cargas */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 border-t border-gray-200 text-xs text-gray-500">
                            <span>Total planillas: <strong>{cargas.length}</strong></span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setPaginaCargas(prev => Math.max(1, prev - 1))}
                                    disabled={paginaCargas <= 1}
                                    className="p-1 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40"
                                >
                                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                                </button>
                                <span>Página {paginaCargas} de {totalPaginasCargas}</span>
                                <button
                                    onClick={() => setPaginaCargas(prev => Math.min(totalPaginasCargas, prev + 1))}
                                    disabled={paginaCargas >= totalPaginasCargas}
                                    className="p-1 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40"
                                >
                                    <ChevronRight className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* TAB 2: HISTORIAL Y GESTIÓN CONSOLIDADA DE REGISTROS      */}
            {/* ======================================================== */}
            {tabActivo === 'registros' && (
                <div className="space-y-4">
                    {/* Tarjetas de Resumen Consolidado */}
                    {resumen && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Registros</span>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{resumen.totalRegistros.toLocaleString('es-CL')}</p>
                                <span className="text-[10px] text-gray-400 mt-0.5 block">Filas coincidentes</span>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm">
                                <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Minutos de Atraso</span>
                                <p className="text-2xl font-bold text-rose-700 mt-1">
                                    {resumen.totalMinutosAtraso.toLocaleString('es-CL')}
                                    <span className="text-xs font-normal text-rose-500 ml-1">min</span>
                                </p>
                                <span className="text-[10px] text-rose-500 mt-0.5 block">{formatMinutesToHours(resumen.totalMinutosAtraso)}</span>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                                <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Salidas Anticipadas</span>
                                <p className="text-2xl font-bold text-amber-700 mt-1">
                                    {resumen.totalMinutosAdelanto.toLocaleString('es-CL')}
                                    <span className="text-xs font-normal text-amber-500 ml-1">min</span>
                                </p>
                                <span className="text-[10px] text-amber-500 mt-0.5 block">{formatMinutesToHours(resumen.totalMinutosAdelanto)}</span>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-cyan-100 shadow-sm">
                                <span className="text-[11px] font-semibold text-cyan-600 uppercase tracking-wider">Aplica Descuento</span>
                                <p className="text-2xl font-bold text-cyan-700 mt-1">{resumen.totalAplicaDescuento.toLocaleString('es-CL')}</p>
                                <span className="text-[10px] text-cyan-500 mt-0.5 block">Registros con descuento</span>
                            </div>
                        </div>
                    )}
                    {/* Barra de Filtros */}
                    <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                            <div className="sm:col-span-3">
                                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                    Búsqueda General (RUT, Colaborador)
                                </label>
                                <div className="relative">
                                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                    <input
                                        type="text"
                                        value={busquedaTexto}
                                        onChange={e => setBusquedaTexto(e.target.value)}
                                        placeholder="Buscar..."
                                        className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                    />
                                </div>
                            </div>

                            <div className="sm:col-span-3 relative">
                                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                    Establecimiento (RBD)
                                </label>
                                <input
                                    type="text"
                                    value={busquedaRbdNombre}
                                    onChange={e => {
                                        setBusquedaRbdNombre(e.target.value)
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
                                                setBusquedaRbdNombre('')
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
                                                    setBusquedaRbdNombre(`RBD ${est.rbd} - ${est.establecimiento}`)
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
                                    Estado Período
                                </label>
                                <select
                                    value={filtroEstado}
                                    onChange={e => setFiltroEstado(e.target.value as any)}
                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                >
                                    <option value="TODOS">Todos los Estados</option>
                                    <option value="ABIERTO">Período Abierto</option>
                                    <option value="CERRADO">Período Cerrado</option>
                                </select>
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

                            <div className="sm:col-span-2">
                                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                    Planilla Origen
                                </label>
                                <select
                                    value={filtroCargaId}
                                    onChange={e => setFiltroCargaId(e.target.value)}
                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                >
                                    <option value="TODOS">Todas las Planillas</option>
                                    {cargas.map(cg => (
                                        <option key={cg.id} value={cg.id}>
                                            {cg.nombreArchivo}
                                        </option>
                                    ))}
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
                                {(busquedaTexto || filtroRbd !== null || filtroEstado !== 'TODOS' || filtroCargaId !== 'TODOS' || filtroAplica !== 'TODOS' || filtroSucursal !== 'TODAS' || filtroSupervisor !== 'TODOS' || filtroFechaDesde || filtroFechaHasta) && (
                                    <button
                                        onClick={handleClearFilters}
                                        disabled={isPending}
                                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                                    >
                                        Limpiar Filtros
                                    </button>
                                )}
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
                                                {sortField === 'fecha' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                            </div>
                                        </th>
                                        <th className="py-3 px-3">RUT Colaborador</th>
                                        <th className="py-3 px-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('nombreCompleto')}>
                                            <div className="flex items-center gap-1">
                                                <span>Colaborador</span>
                                                {sortField === 'nombreCompleto' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                            </div>
                                        </th>
                                        <th className="py-3 px-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('rbd')}>
                                            <div className="flex items-center gap-1">
                                                <span>RBD / Establecimiento</span>
                                                {sortField === 'rbd' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />) : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                                            </div>
                                        </th>
                                        <th className="py-3 px-3 text-center">Atraso</th>
                                        <th className="py-3 px-3 text-center">Adelanto</th>
                                        <th className="py-3 px-3 text-center">¿Aplica Descuento?</th>
                                        <th className="py-3 px-3">Justificación</th>
                                        <th className="py-3 px-3 text-center">Estado Período</th>
                                        <th className="py-3 px-3 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-gray-700">
                                    {registros.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="py-12 text-center text-gray-400">
                                                No se encontraron registros de atrasos para los filtros seleccionados.
                                            </td>
                                        </tr>
                                    ) : (
                                        registros.map(r => (
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
                                                    <div className="font-medium text-gray-900">{r.rbd ? `RBD ${r.rbd}` : '-'}</div>
                                                    <div className="text-[11px] text-gray-500 truncate max-w-xs">{r.establecimiento || 'Sin Nombre'}</div>
                                                </td>
                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                    {r.minutosAtraso > 0 ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                            {r.minutosAtraso} min
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                    {r.minutosAdelanto > 0 ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                            {r.minutosAdelanto} min
                                                        </span>
                                                    ) : '-'}
                                                    {r.minutosJustificados > 0 && (
                                                        <span className="block text-[10px] text-emerald-600 font-semibold mt-0.5" title="Minutos justificados">
                                                            ✓ {r.minutosJustificados}m just.
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                                        r.aplicaDescuento
                                                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    }`}>
                                                        {r.aplicaDescuento ? 'APLICA' : 'NO APLICA'}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <div className="font-medium text-gray-900 truncate max-w-xs" title={r.justificado || ''}>
                                                        {r.justificado || <span className="text-gray-400 italic">Sin justificar</span>}
                                                    </div>
                                                    {r.justificadoPor && (
                                                        <div className="text-[10px] text-gray-500 truncate max-w-xs" title={r.justificadoPor}>
                                                            Por: {r.justificadoPor}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        r.estado === 'ABIERTO'
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                    }`}>
                                                        {r.estado === 'CERRADO' && <Lock className="w-2.5 h-2.5" />}
                                                        <span>{r.estado}</span>
                                                    </span>
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
                                                        title="Editar datos administrativos"
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

                        {/* Paginación Registros */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-gray-50/50 border-t border-gray-200 text-xs text-gray-500">
                            <div>
                                Mostrando del <strong className="text-gray-900">{totalRegistros > 0 ? (paginaActual - 1) * pageSize + 1 : 0}</strong> al{' '}
                                <strong className="text-gray-900">{Math.min(paginaActual * pageSize, totalRegistros)}</strong> de{' '}
                                <strong className="text-gray-900">{totalRegistros.toLocaleString('es-CL')}</strong> registros
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => recargarDatos(paginaActual - 1, sortField, sortDirection)}
                                    disabled={paginaActual <= 1 || isPending}
                                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40"
                                >
                                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                                </button>
                                <span className="px-3 py-1 font-semibold text-gray-700">
                                    Página {paginaActual} de {totalPagesRegistros}
                                </span>
                                <button
                                    onClick={() => recargarDatos(paginaActual + 1, sortField, sortDirection)}
                                    disabled={paginaActual >= totalPagesRegistros || isPending}
                                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40"
                                >
                                    <ChevronRight className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación Cerrar / Abrir Período */}
            {modalPeriodo.isOpen && modalPeriodo.carga && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-2xl ${
                                modalPeriodo.accion === 'CERRAR' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                            }`}>
                                {modalPeriodo.accion === 'CERRAR' ? <Lock className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-base">
                                    {modalPeriodo.accion === 'CERRAR' ? '¿Cerrar Período de Atrasos?' : '¿Reabrir Período de Atrasos?'}
                                </h3>
                                <p className="text-xs text-gray-500 truncate max-w-xs">{modalPeriodo.carga.nombreArchivo}</p>
                            </div>
                        </div>

                        <div className="text-xs text-gray-600 bg-gray-50 p-3.5 rounded-2xl space-y-2">
                            {modalPeriodo.accion === 'CERRAR' ? (
                                <p>
                                    ⚠️ <strong>Atención:</strong> Al cerrar este período, todos los registros de atrasos y adelantos vinculados a esta planilla quedarán <strong>congelados</strong>. Los supervisores en Asistencia ya no podrán alterar justificaciones ni descuentos.
                                </p>
                            ) : (
                                <p>
                                    ℹ️ <strong>Atención:</strong> Al reabrir este período, los supervisores y jefaturas podrán volver a modificar justificaciones y estados en el módulo de Asistencia.
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setModalPeriodo({ isOpen: false, carga: null, accion: 'CERRAR' })}
                                disabled={procesandoPeriodo}
                                className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-semibold"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmarPeriodo}
                                disabled={procesandoPeriodo}
                                className={`px-4 py-2 text-white rounded-xl text-xs font-semibold shadow-sm transition-all ${
                                    modalPeriodo.accion === 'CERRAR'
                                        ? 'bg-rose-600 hover:bg-rose-700'
                                        : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                            >
                                {procesandoPeriodo ? 'Procesando...' : (modalPeriodo.accion === 'CERRAR' ? 'Sí, Cerrar Período' : 'Sí, Reabrir Período')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación Eliminar Planilla */}
            {modalDeleteCarga.isOpen && modalDeleteCarga.carga && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-rose-50 text-rose-600">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-base">¿Eliminar Planilla Completa?</h3>
                                <p className="text-xs text-gray-500 truncate max-w-xs">{modalDeleteCarga.carga.nombreArchivo}</p>
                            </div>
                        </div>

                        <div className="text-xs text-gray-600 bg-rose-50/60 border border-rose-100 p-3.5 rounded-2xl space-y-1.5">
                            <p className="font-semibold text-rose-900">
                                ⚠️ Esta acción no se puede deshacer.
                            </p>
                            <p>
                                Se eliminarán <strong>{modalDeleteCarga.carga.totalRegistros} registros</strong> asociados a esta planilla en el historial de atrasos y adelantos.
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setModalDeleteCarga({ isOpen: false, carga: null })}
                                disabled={procesandoDeleteCarga}
                                className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-semibold"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmarEliminarCarga}
                                disabled={procesandoDeleteCarga}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                            >
                                {procesandoDeleteCarga ? 'Eliminando...' : 'Sí, Eliminar Planilla'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Edición Administrativa */}
            {modalEdit.isOpen && modalEdit.registro && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-cyan-50 rounded-xl text-cyan-600">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-base">Modificación Administrativa</h3>
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

                        <form onSubmit={handleSaveAdminEdit} className="space-y-4 text-xs">
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
                                    <span className="text-gray-500">Estado Período:</span>
                                    <strong className={modalEdit.registro.estado === 'ABIERTO' ? 'text-emerald-700' : 'text-rose-700'}>
                                        {modalEdit.registro.estado}
                                    </strong>
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
                                        No Aplica
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
                                    Motivo / Justificación
                                </label>
                                <input
                                    type="text"
                                    value={modalEdit.justificado}
                                    onChange={e => setModalEdit(prev => ({ ...prev, justificado: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block font-semibold text-gray-700 mb-1">
                                    Observaciones
                                </label>
                                <textarea
                                    value={modalEdit.observacion}
                                    onChange={e => setModalEdit(prev => ({ ...prev, observacion: e.target.value }))}
                                    rows={2}
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
