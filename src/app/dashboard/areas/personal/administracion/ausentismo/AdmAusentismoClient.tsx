'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
    AdmAsistenciaRegistroDTO,
    CargaHistorialDTO,
    asignarCriterioAdminAction,
    cambiarEstadoPeriodoCargaAction,
    getAdmAusentismoRegistrosAction,
    getHistorialCargasAction,
    registrarAuditoriaExportacionAction
} from './actions'
import {
    Users,
    Search,
    Calendar,
    Download,
    Building2,
    RefreshCw,
    X,
    Check,
    SlidersHorizontal,
    Info,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Lock,
    Unlock,
    FileSpreadsheet,
    ShieldCheck,
    FolderArchive,
    History,
    AlertCircle,
    CheckCircle2,
    ChevronRight,
    Filter
} from 'lucide-react'
import * as xlsx from 'xlsx'

interface CriterioItem {
    id: string
    nombre: string
    color: string | null
    activo: boolean
}

interface EstablecimientoItem {
    rbd: number
    establecimiento: string
}

interface AdmAusentismoClientProps {
    initialRegistros: AdmAsistenciaRegistroDTO[]
    initialCargas: CargaHistorialDTO[]
    criterios: CriterioItem[]
    establecimientos: EstablecimientoItem[]
    userRbds: number[]
    isAdmin: boolean
}

export default function AdmAusentismoClient({
    initialRegistros,
    initialCargas,
    criterios,
    establecimientos,
    userRbds,
    isAdmin
}: AdmAusentismoClientProps) {
    // Pestañas activas: 'cargas' (Historial Documentos) | 'registros' (Historial de Registros)
    const [tabActivo, setTabActivo] = useState<'cargas' | 'registros'>('cargas')

    const [registros, setRegistros] = useState<AdmAsistenciaRegistroDTO[]>(initialRegistros)
    const [cargas, setCargas] = useState<CargaHistorialDTO[]>(initialCargas)
    const [isPending, startTransition] = useTransition()

    // Filtros Tab Registros
    const [busquedaRbdNombre, setBusquedaRbdNombre] = useState('')
    const [filtroRbdSeleccionado, setFiltroRbdSeleccionado] = useState<number | null>(null)
    const [filtroFecha, setFiltroFecha] = useState('')
    const [filtroRut, setFiltroRut] = useState('')
    const [filtroNombre, setFiltroNombre] = useState('')
    const [filtroCriterio, setFiltroCriterio] = useState<string>('TODOS')
    const [filtroEstado, setFiltroEstado] = useState<string>('TODOS')
    const [filtroCargaId, setFiltroCargaId] = useState<string>('TODOS')

    // Control autocompletado RBD
    const [isRbdDropdownOpen, setIsRbdDropdownOpen] = useState(false)

    // Estado de retroalimentación de guardado
    const [guardadoStatus, setGuardadoStatus] = useState<{ [id: string]: boolean }>({})
    const [mensajeFeedback, setMensajeFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

    // Modal de confirmación para Cerrar / Abrir Período
    const [modalPeriodo, setModalPeriodo] = useState<{
        isOpen: boolean
        carga: CargaHistorialDTO | null
        accion: 'CERRAR' | 'ABRIR'
    }>({
        isOpen: false,
        carga: null,
        accion: 'CERRAR'
    })
    const [procesandoPeriodo, setProcesandoPeriodo] = useState(false)

    // Paginación Tab Registros
    const [paginaActual, setPaginaActual] = useState(1)
    const porPagina = 10

    // Ordenamiento Tab Registros
    type SortField = 'fecha' | 'rbd' | 'establecimiento' | 'supervisorNombre' | 'rut' | 'nombreCompleto' | 'criterioNombre' | 'estado'
    const [sortField, setSortField] = useState<SortField>('fecha')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
        setPaginaActual(1)
    }

    // Paginación y ordenamiento Tab Cargas (10 por página)
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

    const renderSortIconCargas = (field: SortFieldCargas) => {
        if (sortFieldCargas !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
        return sortDirectionCargas === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
    }

    const renderSortIconRegistros = (field: SortField) => {
        if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
        return sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
    }

    // Criterios
    const criteriosActivos = useMemo(() => criterios.filter(c => c.activo), [criterios])
    const criteriosMap = useMemo(() => new Map<string, CriterioItem>(criterios.map(c => [c.id, c])), [criterios])

    // Autocompletado Establecimientos
    const establecimientosSugeridos = useMemo(() => {
        if (!busquedaRbdNombre.trim()) return establecimientos.slice(0, 15)
        const term = busquedaRbdNombre.toLowerCase()
        return establecimientos.filter(e =>
            e.rbd.toString().includes(term) ||
            e.establecimiento.toLowerCase().includes(term)
        ).slice(0, 15)
    }, [establecimientos, busquedaRbdNombre])

    // Filtrado de Registros en memoria
    const registrosFiltrados = useMemo(() => {
        return registros.filter(r => {
            // Filtro RBD
            if (filtroRbdSeleccionado !== null && r.rbd !== filtroRbdSeleccionado) {
                return false
            } else if (!filtroRbdSeleccionado && busquedaRbdNombre.trim()) {
                const term = busquedaRbdNombre.toLowerCase()
                const matchRbd = r.rbd.toString().includes(term)
                const matchEst = r.establecimiento.toLowerCase().includes(term)
                if (!matchRbd && !matchEst) return false
            }

            // Filtro Fecha
            if (filtroFecha && r.fecha !== filtroFecha) {
                return false
            }

            // Filtro RUT
            if (filtroRut.trim() && !r.rut.toLowerCase().includes(filtroRut.toLowerCase())) {
                return false
            }

            // Filtro Nombre
            if (filtroNombre.trim() && !r.nombreCompleto.toLowerCase().includes(filtroNombre.toLowerCase())) {
                return false
            }

            // Filtro Criterio
            if (filtroCriterio !== 'TODOS') {
                if (filtroCriterio === 'SIN_CRITERIO') {
                    if (r.criterioId !== null) return false
                } else if (r.criterioId !== filtroCriterio) {
                    return false
                }
            }

            // Filtro Estado (ABIERTO / CERRADO)
            if (filtroEstado !== 'TODOS' && r.estado !== filtroEstado) {
                return false
            }

            // Filtro CargaId
            if (filtroCargaId !== 'TODOS' && r.cargaId !== filtroCargaId) {
                return false
            }

            return true
        })
    }, [registros, filtroRbdSeleccionado, busquedaRbdNombre, filtroFecha, filtroRut, filtroNombre, filtroCriterio, filtroEstado, filtroCargaId])

    // Ordenamiento de registros
    const registrosOrdenados = useMemo(() => {
        return [...registrosFiltrados].sort((a, b) => {
            let valA: any = a[sortField] || ''
            let valB: any = b[sortField] || ''
            if (typeof valA === 'string') valA = valA.toLowerCase()
            if (typeof valB === 'string') valB = valB.toLowerCase()

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1
            return 0
        })
    }, [registrosFiltrados, sortField, sortDirection])

    // Paginación
    const totalPaginas = Math.ceil(registrosOrdenados.length / porPagina) || 1
    const registrosPaginados = useMemo(() => {
        const start = (paginaActual - 1) * porPagina
        return registrosOrdenados.slice(start, start + porPagina)
    }, [registrosOrdenados, paginaActual, porPagina])

    // Recargar Datos
    const recargarDatos = async () => {
        startTransition(async () => {
            const [resReg, resCargas] = await Promise.all([
                getAdmAusentismoRegistrosAction(),
                getHistorialCargasAction()
            ])
            if (resReg.success && resReg.data) setRegistros(resReg.data)
            if (resCargas.success && resCargas.data) setCargas(resCargas.data)
            setMensajeFeedback({ tipo: 'success', texto: 'Datos actualizados correctamente.' })
            setTimeout(() => setMensajeFeedback(null), 3000)
        })
    }

    // Manejar cambio de criterio (Solo permitido si el período está abierto)
    const handleCriterioChange = async (registroId: string, nuevoCriterioId: string) => {
        const criterioVal = nuevoCriterioId === '' ? null : nuevoCriterioId
        const criterioObj = criterioVal ? criteriosMap.get(criterioVal) : null

        // Optimistic update
        setRegistros(prev =>
            prev.map(r =>
                r.id === registroId
                    ? {
                        ...r,
                        criterioId: criterioVal,
                        criterioNombre: criterioObj ? criterioObj.nombre : null,
                        criterioColor: criterioObj?.color || null
                    }
                    : r
            )
        )

        const res = await asignarCriterioAdminAction(registroId, criterioVal)
        if (res.success && res.data) {
            setGuardadoStatus(prev => ({ ...prev, [registroId]: true }))
            setTimeout(() => {
                setGuardadoStatus(prev => ({ ...prev, [registroId]: false }))
            }, 2500)
        } else {
            // Revertir en caso de error
            recargarDatos()
            setMensajeFeedback({ tipo: 'error', texto: res.error || 'No se pudo actualizar el criterio.' })
            setTimeout(() => setMensajeFeedback(null), 4000)
        }
    }

    // Ejecutar Apertura / Cierre de Período
    const ejecutarCambioPeriodo = async () => {
        if (!modalPeriodo.carga) return
        setProcesandoPeriodo(true)

        const res = await cambiarEstadoPeriodoCargaAction(
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
            recargarDatos()
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
        if (registrosFiltrados.length === 0) {
            alert('No hay registros para exportar con los filtros seleccionados.')
            return
        }

        const datosExport = registrosFiltrados.map(r => ({
            'Fecha': r.fecha,
            'RBD': r.rbd,
            'Establecimiento': r.establecimiento,
            'Supervisor': r.supervisorNombre,
            'RUT': r.rut,
            'Colaborador': r.nombreCompleto,
            'Cargo': r.cargo || '',
            'Estado Período': r.estado,
            'Planilla Origen': r.cargaNombreArchivo || 'Sin Carga',
            'Criterio Ausencia': r.criterioNombre || 'SIN CRITERIO',
            'Cargado Por': r.creadoPor,
            'Fecha Carga': r.fechaCreacion ? new Date(r.fechaCreacion).toLocaleString('es-CL') : '',
            'Actualizado Por': r.actualizadoPor || '',
            'Fecha Actualización': r.fechaActualizacion ? new Date(r.fechaActualizacion).toLocaleString('es-CL') : '',
            'Num Actualizaciones': r.numActualizaciones
        }))

        const ws = xlsx.utils.json_to_sheet(datosExport)
        const wb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(wb, ws, 'Adm_Ausentismo')
        const nombreArchivo = `Adm_Ausentismo_Reporte_${new Date().toISOString().slice(0, 10)}.xlsx`
        xlsx.writeFile(wb, nombreArchivo)

        // Registrar acción en auditoría
        await registrarAuditoriaExportacionAction(
            registrosFiltrados.length,
            `Filtros aplicados: [Estado: ${filtroEstado}, Criterio: ${filtroCriterio}, Carga: ${filtroCargaId}]`
        )
    }

    // Filtro rápido hacia registros de una carga específica
    const irARegistrosDeCarga = (cargaId: string) => {
        setFiltroCargaId(cargaId)
        setTabActivo('registros')
        setPaginaActual(1)
    }

    // Métricas
    const totalReg = registros.length
    const totalAbiertos = registros.filter(r => r.estado === 'ABIERTO').length
    const totalCerrados = registros.filter(r => r.estado === 'CERRADO').length
    const totalConCriterio = registros.filter(r => r.criterioId !== null).length
    const totalSinCriterio = registros.filter(r => r.criterioId === null).length

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
                        Adm. Ausentismo
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Control administrativo de períodos de ausentismo, cierre/reapertura de planillas Excel, auditoría de supervisión y descarga consolidada de datos.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={recargarDatos}
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

            {/* Banner de restricción por RBD si aplica */}
            {!isAdmin && userRbds.length > 0 && (
                <div className="flex items-center gap-2 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs shadow-sm">
                    <Info className="w-4 h-4 flex-shrink-0 text-amber-600" />
                    <span>
                        Acceso restringido por perfil: Solo tienes autorización para visualizar los <strong>{userRbds.length}</strong> establecimientos (RBDs) asociados a tu cuenta.
                    </span>
                </div>
            )}

            {/* Barra de Pestañas (Tabs) */}
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
                    <span>Historial y Gestión de Supervisores</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tabActivo === 'registros' ? 'bg-cyan-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {registrosFiltrados.length}
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
                                <p className="text-xs text-gray-500 font-medium">Total Planillas Cargadas</p>
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
                                <h3 className="font-bold text-gray-900 text-sm">Documentos Excel de Ausentismo Cargados</h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Al cerrar un período, todos sus puntos quedan congelados y dejan de mostrarse en el módulo de Ausentismo general.
                                </p>
                            </div>
                        </div>

                        {cargas.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 text-xs">
                                No hay planillas Excel registradas en el sistema.
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
                                                            <span className="text-gray-400 italic">En edición activa</span>
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
            {/* TAB 2: HISTORIAL Y GESTIÓN DE REGISTROS / SUPERVISORES   */}
            {/* ======================================================== */}
            {tabActivo === 'registros' && (
                <div className="space-y-4">
                    {/* Tarjetas de Resumen */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Registros</span>
                            <p className="text-xl font-bold text-gray-900 mt-0.5">{registrosFiltrados.length}</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">En Período Abierto</span>
                            <p className="text-xl font-bold text-emerald-700 mt-0.5">
                                {registrosFiltrados.filter(r => r.estado === 'ABIERTO').length}
                            </p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">En Período Cerrado</span>
                            <p className="text-xl font-bold text-rose-700 mt-0.5">
                                {registrosFiltrados.filter(r => r.estado === 'CERRADO').length}
                            </p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-cyan-600 uppercase tracking-wider">Con Criterio</span>
                            <p className="text-xl font-bold text-cyan-700 mt-0.5">
                                {registrosFiltrados.filter(r => r.criterioId !== null).length}
                            </p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Sin Criterio</span>
                            <p className="text-xl font-bold text-amber-700 mt-0.5">
                                {registrosFiltrados.filter(r => r.criterioId === null).length}
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
                            {(busquedaRbdNombre || filtroRbdSeleccionado || filtroFecha || filtroRut || filtroNombre || filtroCriterio !== 'TODOS' || filtroEstado !== 'TODOS' || filtroCargaId !== 'TODOS') && (
                                <button
                                    onClick={() => {
                                        setBusquedaRbdNombre('')
                                        setFiltroRbdSeleccionado(null)
                                        setFiltroFecha('')
                                        setFiltroRut('')
                                        setFiltroNombre('')
                                        setFiltroCriterio('TODOS')
                                        setFiltroEstado('TODOS')
                                        setFiltroCargaId('TODOS')
                                        setPaginaActual(1)
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
                                            setFiltroRbdSeleccionado(null)
                                            setIsRbdDropdownOpen(true)
                                            setPaginaActual(1)
                                        }}
                                        onFocus={() => setIsRbdDropdownOpen(true)}
                                        className="w-full pl-8 pr-7 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                                    />
                                    <Building2 className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                                    {busquedaRbdNombre && (
                                        <button
                                            onClick={() => {
                                                setBusquedaRbdNombre('')
                                                setFiltroRbdSeleccionado(null)
                                                setPaginaActual(1)
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
                                                    setFiltroRbdSeleccionado(item.rbd)
                                                    setBusquedaRbdNombre(`${item.rbd} - ${item.establecimiento}`)
                                                    setIsRbdDropdownOpen(false)
                                                    setPaginaActual(1)
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
                                    onChange={e => {
                                        setFiltroEstado(e.target.value)
                                        setPaginaActual(1)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                                >
                                    <option value="TODOS">Todos los Estados</option>
                                    <option value="ABIERTO">Abiertos (Modificables)</option>
                                    <option value="CERRADO">Cerrados (Bloqueados)</option>
                                </select>
                            </div>

                            {/* Filtro Planilla / Carga */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Documento / Planilla</label>
                                <select
                                    value={filtroCargaId}
                                    onChange={e => {
                                        setFiltroCargaId(e.target.value)
                                        setPaginaActual(1)
                                    }}
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

                            {/* Filtro Criterio */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Criterio Ausencia</label>
                                <select
                                    value={filtroCriterio}
                                    onChange={e => {
                                        setFiltroCriterio(e.target.value)
                                        setPaginaActual(1)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                                >
                                    <option value="TODOS">Todos los Criterios</option>
                                    <option value="SIN_CRITERIO">Sin Criterio Asignado</option>
                                    {criteriosActivos.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro Fecha */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Fecha</label>
                                <input
                                    type="date"
                                    value={filtroFecha}
                                    onChange={e => {
                                        setFiltroFecha(e.target.value)
                                        setPaginaActual(1)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                                />
                            </div>

                            {/* Filtro RUT */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Buscar RUT</label>
                                <input
                                    type="text"
                                    placeholder="Ej: 12.345.678-9"
                                    value={filtroRut}
                                    onChange={e => {
                                        setFiltroRut(e.target.value)
                                        setPaginaActual(1)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                                />
                            </div>

                            {/* Filtro Nombre */}
                            <div className="md:col-span-2">
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Nombre Colaborador</label>
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o apellidos..."
                                    value={filtroNombre}
                                    onChange={e => {
                                        setFiltroNombre(e.target.value)
                                        setPaginaActual(1)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tabla de Registros */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        {registrosPaginados.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 text-xs">
                                No se encontraron registros de ausentismo que coincidan con los filtros aplicados.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-gray-100 text-gray-600 uppercase text-[10px] tracking-wider font-semibold">
                                        <tr>
                                            <th 
                                                className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors" 
                                                onClick={() => handleSort('fecha')}
                                                title="Ordenar por Fecha"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortField === 'fecha' ? 'text-cyan-800 font-bold' : ''}>Fecha</span>
                                                    {renderSortIconRegistros('fecha')}
                                                </div>
                                            </th>
                                            <th 
                                                className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors" 
                                                onClick={() => handleSort('rbd')}
                                                title="Ordenar por RBD / Establecimiento"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortField === 'rbd' ? 'text-cyan-800 font-bold' : ''}>RBD / Establecimiento</span>
                                                    {renderSortIconRegistros('rbd')}
                                                </div>
                                            </th>
                                            <th 
                                                className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors" 
                                                onClick={() => handleSort('supervisorNombre')}
                                                title="Ordenar por Supervisor"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortField === 'supervisorNombre' ? 'text-cyan-800 font-bold' : ''}>Supervisor</span>
                                                    {renderSortIconRegistros('supervisorNombre')}
                                                </div>
                                            </th>
                                            <th 
                                                className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors" 
                                                onClick={() => handleSort('nombreCompleto')}
                                                title="Ordenar por Colaborador"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortField === 'nombreCompleto' ? 'text-cyan-800 font-bold' : ''}>Colaborador</span>
                                                    {renderSortIconRegistros('nombreCompleto')}
                                                </div>
                                            </th>
                                            <th 
                                                className="py-3 px-3 text-center cursor-pointer select-none group hover:bg-gray-200 transition-colors" 
                                                onClick={() => handleSort('estado')}
                                                title="Ordenar por Estado"
                                            >
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span className={sortField === 'estado' ? 'text-cyan-800 font-bold' : ''}>Estado</span>
                                                    {renderSortIconRegistros('estado')}
                                                </div>
                                            </th>
                                            <th 
                                                className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors" 
                                                onClick={() => handleSort('criterioNombre')}
                                                title="Ordenar por Criterio Ausencia"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortField === 'criterioNombre' ? 'text-cyan-800 font-bold' : ''}>Criterio Ausencia</span>
                                                    {renderSortIconRegistros('criterioNombre')}
                                                </div>
                                            </th>
                                            <th className="py-3 px-3">Trazabilidad / Auditoría</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-gray-700">
                                        {registrosPaginados.map(r => {
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
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-bold text-gray-900">{r.establecimiento}</span>
                                                            </div>
                                                            <span className="text-[10px] font-semibold text-cyan-600">RBD: {r.rbd}</span>
                                                        </div>
                                                    </td>

                                                    {/* Supervisor */}
                                                    <td className="py-3 px-3 text-gray-600 font-medium whitespace-nowrap">
                                                        {r.supervisorNombre}
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

                                                    {/* Estado del Período */}
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

                                                    {/* Selector de Criterio */}
                                                    <td className="py-3 px-3 min-w-[210px]">
                                                        {esCerrado ? (
                                                            <div className="flex items-center gap-1.5 text-gray-400 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200">
                                                                <Lock className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                                                                <span className="text-[11px] font-semibold truncate text-gray-700">
                                                                    {r.criterioNombre || 'SIN CRITERIO'}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="relative">
                                                                <select
                                                                    value={r.criterioId || ''}
                                                                    onChange={e => handleCriterioChange(r.id, e.target.value)}
                                                                    className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                                                                    style={{
                                                                        color: r.criterioColor || '#1e293b'
                                                                    }}
                                                                >
                                                                    <option value="">-- Sin Criterio Asignado --</option>
                                                                    {criteriosActivos.map(crit => (
                                                                        <option key={crit.id} value={crit.id}>
                                                                            {crit.nombre}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                {guardadoStatus[r.id] && (
                                                                    <span className="absolute -top-2 -right-1 text-[9px] bg-emerald-500 text-white font-bold px-1.5 py-0.2 rounded-full shadow-sm animate-pulse">
                                                                        Guardado
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Trazabilidad */}
                                                    <td className="py-3 px-3 text-[11px] text-gray-500">
                                                        <div className="flex flex-col">
                                                            {r.actualizadoPor ? (
                                                                <>
                                                                    <span className="font-semibold text-gray-700">
                                                                        Actualizado: {r.actualizadoPor}
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-400">
                                                                        {r.fechaActualizacion ? new Date(r.fechaActualizacion).toLocaleString('es-CL') : ''} ({r.numActualizaciones} cambios)
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <span className="text-gray-400 italic">Cargado por: {r.creadoPor}</span>
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
                        {registrosOrdenados.length > porPagina && (
                            <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                                <span>
                                    Mostrando {((paginaActual - 1) * porPagina) + 1} - {Math.min(paginaActual * porPagina, registrosOrdenados.length)} de {registrosOrdenados.length} registros
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        disabled={paginaActual === 1}
                                        onClick={() => setPaginaActual(p => Math.max(p - 1, 1))}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                                    >
                                        Anterior
                                    </button>
                                    <span className="px-3 py-1.5 font-bold text-gray-800">
                                        {paginaActual} / {totalPaginas}
                                    </span>
                                    <button
                                        disabled={paginaActual === totalPaginas}
                                        onClick={() => setPaginaActual(p => Math.min(p + 1, totalPaginas))}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
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
                                    {modalPeriodo.accion === 'CERRAR' ? '¿Cerrar período de ausentismo?' : '¿Reabrir período de ausentismo?'}
                                </h3>
                                <p className="text-xs text-gray-500">
                                    Documento: <strong>{modalPeriodo.carga.nombreArchivo}</strong>
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
                                        ⚠️ Esta información dejará de mostrarse en el módulo regular de Ausentismo y los supervisores ya no podrán alterar los criterios.
                                    </p>
                                </>
                            ) : (
                                <p>
                                    Al reabrir este período, los <strong>{modalPeriodo.carga.totalRegistros}</strong> registros volverán a estar disponibles y podrán tipificarse nuevamente por los supervisores.
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
