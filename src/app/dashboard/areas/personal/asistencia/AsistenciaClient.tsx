'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
    AsistenciaRegistroDTO,
    asignarCriterioAction,
    getAsistenciaRegistrosAction,
    adjuntarDocumentoAsistenciaAction,
    eliminarDocumentoAsistenciaAction
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
    UploadCloud,
    SlidersHorizontal,
    Info,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Paperclip,
    FileText,
    Trash2,
    AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import * as xlsx from 'xlsx'

interface CriterioItem {
    id: string
    nombre: string
    color: string | null
    activo: boolean
    solicitaDocumento?: boolean
}

interface EstablecimientoItem {
    rbd: number
    establecimiento: string
}

interface AsistenciaClientProps {
    initialRegistros: AsistenciaRegistroDTO[]
    criterios: CriterioItem[]
    establecimientos: EstablecimientoItem[]
    userRbds: number[]
    isAdmin: boolean
}

export default function AsistenciaClient({
    initialRegistros,
    criterios,
    establecimientos,
    userRbds,
    isAdmin
}: AsistenciaClientProps) {
    const [registros, setRegistros] = useState<AsistenciaRegistroDTO[]>(initialRegistros)
    const [isPending, startTransition] = useTransition()

    // Filtros
    const [busquedaRbdNombre, setBusquedaRbdNombre] = useState('')
    const [filtroRbdSeleccionado, setFiltroRbdSeleccionado] = useState<number | null>(null)
    const [filtroFecha, setFiltroFecha] = useState('')
    const [filtroRut, setFiltroRut] = useState('')
    const [filtroNombre, setFiltroNombre] = useState('')
    const [filtroCriterio, setFiltroCriterio] = useState<string>('TODOS')

    // Control autocompletado inteligente
    const [isRbdDropdownOpen, setIsRbdDropdownOpen] = useState(false)

    // Estado de retroalimentación de guardado por registro ID
    const [guardadoStatus, setGuardadoStatus] = useState<{ [id: string]: boolean }>({})

    // Paginación
    const [paginaActual, setPaginaActual] = useState(1)
    const porPagina = 10

    // Ordenamiento
    type SortField = 'fecha' | 'rbd' | 'establecimiento' | 'supervisorNombre' | 'rut' | 'nombreCompleto' | 'cargo' | 'criterioNombre'
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

    // Opciones activas de criterios para el select
    const criteriosActivos = useMemo(() => {
        return criterios.filter(c => c.activo)
    }, [criterios])

    const criteriosMap = useMemo(() => {
        return new Map<string, CriterioItem>(criterios.map(c => [c.id, c]))
    }, [criterios])

    // Estado del modal de documento adjunto
    const [modalAdjunto, setModalAdjunto] = useState<{
        isOpen: boolean
        registro: AsistenciaRegistroDTO | null
        criterioId: string | null
        criterioNombre: string | null
    }>({
        isOpen: false,
        registro: null,
        criterioId: null,
        criterioNombre: null
    })
    const [archivoAdjunto, setArchivoAdjunto] = useState<File | null>(null)
    const [uploadingDoc, setUploadingDoc] = useState(false)
    const [docError, setDocError] = useState<string | null>(null)

    // Establecimientos filtrados para autocompletado inteligente
    const establecimientosSugeridos = useMemo(() => {
        if (!busquedaRbdNombre.trim()) return establecimientos.slice(0, 15)
        const term = busquedaRbdNombre.toLowerCase()
        return establecimientos.filter(e =>
            e.rbd.toString().includes(term) ||
            e.establecimiento.toLowerCase().includes(term)
        ).slice(0, 15)
    }, [establecimientos, busquedaRbdNombre])

    // Filtrado de registros en memoria
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
            if (filtroRut.trim()) {
                const termRut = filtroRut.toLowerCase().replace(/[^0-9k]/g, '')
                const regRut = r.rut.toLowerCase().replace(/[^0-9k]/g, '')
                if (!regRut.includes(termRut)) return false
            }

            // Filtro Nombre
            if (filtroNombre.trim()) {
                const termNom = filtroNombre.toLowerCase()
                if (!r.nombreCompleto.toLowerCase().includes(termNom)) return false
            }

            // Filtro Criterio
            if (filtroCriterio === 'SIN_CRITERIO' && r.criterioId !== null) {
                return false
            } else if (filtroCriterio !== 'TODOS' && filtroCriterio !== 'SIN_CRITERIO') {
                if (r.criterioId !== filtroCriterio) return false
            }

            return true
        })
    }, [registros, filtroRbdSeleccionado, busquedaRbdNombre, filtroFecha, filtroRut, filtroNombre, filtroCriterio])

    // Ordenamiento de registros filtrados
    const registrosOrdenados = useMemo(() => {
        return [...registrosFiltrados].sort((a, b) => {
            let valA: any = a[sortField]
            let valB: any = b[sortField]

            if (valA === null || valA === undefined) valA = ''
            if (valB === null || valB === undefined) valB = ''

            if (sortField === 'rbd') {
                const numA = Number(valA) || 0
                const numB = Number(valB) || 0
                return sortDirection === 'asc' ? numA - numB : numB - numA
            }

            const strA = String(valA).toLowerCase()
            const strB = String(valB).toLowerCase()
            const cmp = strA.localeCompare(strB, 'es', { numeric: true, sensitivity: 'base' })
            return sortDirection === 'asc' ? cmp : -cmp
        })
    }, [registrosFiltrados, sortField, sortDirection])

    // Registros de la página actual
    const registrosPaginados = useMemo(() => {
        const start = (paginaActual - 1) * porPagina
        return registrosOrdenados.slice(start, start + porPagina)
    }, [registrosOrdenados, paginaActual, porPagina])

    const totalPaginas = Math.ceil(registrosOrdenados.length / porPagina) || 1

    // Manejar cambio de Criterio de Ausencia en vivo
    const handleCriterioChange = async (registroId: string, nuevoCriterioIdStr: string) => {
        const nuevoCriterioId = nuevoCriterioIdStr ? nuevoCriterioIdStr : null
        const criterioObj = criterios.find(c => c.id === nuevoCriterioId)

        // Actualización optimista en cliente
        setRegistros(prev => prev.map(r => {
            if (r.id === registroId) {
                return {
                    ...r,
                    criterioId: nuevoCriterioId,
                    criterioNombre: criterioObj ? criterioObj.nombre : null,
                    criterioColor: criterioObj ? criterioObj.color : null,
                    numActualizaciones: r.numActualizaciones + 1
                }
            }
            return r
        }))

        startTransition(async () => {
            const res = await asignarCriterioAction(registroId, nuevoCriterioId)
            if (res.success && res.data) {
                setGuardadoStatus(prev => ({ ...prev, [registroId]: true }))
                setTimeout(() => {
                    setGuardadoStatus(prev => {
                        const copy = { ...prev }
                        delete copy[registroId]
                        return copy
                    })
                }, 2500)
            } else {
                alert(res.error || 'No se pudo guardar el criterio')
            }
        })
    }

    // Interceptar selección si el criterio solicita documento
    const handleCriterioSelect = (registroId: string, nuevoCriterioIdStr: string) => {
        if (!nuevoCriterioIdStr) {
            handleCriterioChange(registroId, '')
            return
        }

        const crit = criterios.find(c => c.id === nuevoCriterioIdStr)
        if (crit && crit.solicitaDocumento) {
            const reg = registros.find(r => r.id === registroId)
            if (reg) {
                setArchivoAdjunto(null)
                setDocError(null)
                setModalAdjunto({
                    isOpen: true,
                    registro: reg,
                    criterioId: crit.id,
                    criterioNombre: crit.nombre
                })
            }
        } else {
            handleCriterioChange(registroId, nuevoCriterioIdStr)
        }
    }

    const openModalAdjuntoDirecto = (r: AsistenciaRegistroDTO) => {
        const crit = criterios.find(c => c.id === r.criterioId)
        setArchivoAdjunto(null)
        setDocError(null)
        setModalAdjunto({
            isOpen: true,
            registro: r,
            criterioId: r.criterioId,
            criterioNombre: crit ? crit.nombre : (r.criterioNombre || 'Criterio')
        })
    }

    const handleGuardarDocumento = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!modalAdjunto.registro || !modalAdjunto.criterioId) return
        if (!archivoAdjunto) {
            setDocError('Por favor selecciona un archivo o documento para adjuntar.')
            return
        }

        setUploadingDoc(true)
        setDocError(null)

        try {
            const formData = new FormData()
            formData.append('registroId', modalAdjunto.registro.id)
            formData.append('criterioId', modalAdjunto.criterioId)
            formData.append('file', archivoAdjunto)

            const res = await adjuntarDocumentoAsistenciaAction(formData)
            if (res.success && res.data) {
                const updatedData = res.data
                const critObj = criterios.find(c => c.id === updatedData.criterioId)

                setRegistros(prev => prev.map(r => {
                    if (r.id === updatedData.registroId) {
                        return {
                            ...r,
                            criterioId: updatedData.criterioId,
                            criterioNombre: updatedData.criterioNombre,
                            criterioColor: critObj?.color || '#0891b2',
                            documentoUrl: updatedData.documentoUrl,
                            documentoNombre: updatedData.documentoNombre,
                            documentoSubidoAt: updatedData.fechaActualizacion,
                            documentoSubidoPor: updatedData.actualizadoPor,
                            actualizadoPor: updatedData.actualizadoPor,
                            fechaActualizacion: updatedData.fechaActualizacion,
                            numActualizaciones: r.numActualizaciones + 1
                        }
                    }
                    return r
                }))

                setGuardadoStatus(prev => ({ ...prev, [updatedData.registroId]: true }))
                setTimeout(() => {
                    setGuardadoStatus(prev => {
                        const copy = { ...prev }
                        delete copy[updatedData.registroId]
                        return copy
                    })
                }, 2500)

                setModalAdjunto({ isOpen: false, registro: null, criterioId: null, criterioNombre: null })
                setArchivoAdjunto(null)
            } else {
                setDocError(res.error || 'Error al subir el documento')
            }
        } catch (err: any) {
            setDocError(err.message || 'Error al procesar el archivo')
        } finally {
            setUploadingDoc(false)
        }
    }

    const handleEliminarDocumento = async (registroId: string) => {
        if (!confirm('¿Estás seguro de eliminar el archivo de respaldo adjunto?')) return
        startTransition(async () => {
            const res = await eliminarDocumentoAsistenciaAction(registroId)
            if (res.success) {
                setRegistros(prev => prev.map(r => {
                    if (r.id === registroId) {
                        return {
                            ...r,
                            documentoUrl: null,
                            documentoNombre: null,
                            documentoSubidoAt: null,
                            documentoSubidoPor: null
                        }
                    }
                    return r
                }))
            } else {
                alert(res.error || 'Error al eliminar el documento')
            }
        })
    }

    // Refrescar registros desde el servidor
    const recargarDatos = () => {
        startTransition(async () => {
            const res = await getAsistenciaRegistrosAction({
                rbd: filtroRbdSeleccionado || undefined,
                fechaInicio: filtroFecha || undefined,
                fechaFin: filtroFecha || undefined,
                criterioId: filtroCriterio as any
            })
            if (res.success && res.data) {
                setRegistros(res.data)
            }
        })
    }

    // Limpiar todos los filtros
    const limpiarFiltros = () => {
        setBusquedaRbdNombre('')
        setFiltroRbdSeleccionado(null)
        setFiltroFecha('')
        setFiltroRut('')
        setFiltroNombre('')
        setFiltroCriterio('TODOS')
        setPaginaActual(1)
    }

    // Exportar tabla a Excel
    const exportarExcel = () => {
        const datosExport = registrosFiltrados.map(r => ({
            'Fecha': r.fechaTexto || r.fecha,
            'RBD': r.rbd,
            'Establecimiento': r.establecimiento,
            'Supervisor': r.supervisorNombre,
            'RUT': r.rut,
            'Colaborador': r.nombreCompleto,
            'Cargo': r.cargo || '',
            'Criterio Ausencia': r.criterioNombre || 'SIN CRITERIO',
            'Cargado Por': r.creadoPor,
            'Fecha Carga': new Date(r.fechaCreacion).toLocaleString('es-CL'),
            'Actualizado Por': r.actualizadoPor || '',
            'Fecha Actualización': r.fechaActualizacion ? new Date(r.fechaActualizacion).toLocaleString('es-CL') : '',
            'Num Actualizaciones': r.numActualizaciones
        }))

        const ws = xlsx.utils.json_to_sheet(datosExport)
        const wb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(wb, ws, 'Ausentismo')
        xlsx.writeFile(wb, `Reporte_Ausentismo_${new Date().toISOString().slice(0, 10)}.xlsx`)
    }

    const conCriterio = registrosFiltrados.filter(r => r.criterioId !== null).length
    const sinCriterio = registrosFiltrados.filter(r => r.criterioId === null).length

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-6">
            {/* Header Estándar Claro */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <div className="flex items-center gap-2 text-cyan-600 font-semibold text-xs tracking-wider uppercase mb-1">
                        <Users className="w-4 h-4" />
                        <span>Áreas · Recursos Humanos · Asistencia</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        Módulo de Ausentismo
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Visualización y gestión diaria de ausencias del personal. Asocia directamente los motivos de ausentismo o tipificación a cada colaborador y establecimiento.
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
                    <button
                        onClick={exportarExcel}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Exportar Excel</span>
                    </button>
                </div>
            </div>

            {/* Aviso de RBDs restringidos para el usuario */}
            {!isAdmin && userRbds.length > 0 && (
                <div className="flex items-center gap-2 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs shadow-sm">
                    <Info className="w-4 h-4 flex-shrink-0 text-amber-600" />
                    <span>
                        Acceso restringido: Solo puedes visualizar los <strong>{userRbds.length}</strong> establecimientos (RBDs) autorizados para tu cuenta de usuario.
                    </span>
                </div>
            )}

            {/* Tarjetas de KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-100 shadow-sm p-4 rounded-2xl">
                    <span className="text-xs uppercase font-semibold text-gray-500">Total Mostrados</span>
                    <p className="text-2xl font-extrabold text-gray-900 mt-1">{registrosFiltrados.length}</p>
                </div>
                <div className="bg-white border border-emerald-100 shadow-sm p-4 rounded-2xl">
                    <span className="text-xs uppercase font-semibold text-emerald-700">Con Criterio Asignado</span>
                    <p className="text-2xl font-extrabold text-emerald-600 mt-1">{conCriterio}</p>
                </div>
                <div className="bg-white border border-amber-100 shadow-sm p-4 rounded-2xl">
                    <span className="text-xs uppercase font-semibold text-amber-700">Pendientes (Sin Criterio)</span>
                    <p className="text-2xl font-extrabold text-amber-600 mt-1">{sinCriterio}</p>
                </div>
                <div className="bg-white border border-sky-100 shadow-sm p-4 rounded-2xl">
                    <span className="text-xs uppercase font-semibold text-sky-700">Criterios Activos</span>
                    <p className="text-2xl font-extrabold text-cyan-600 mt-1">{criteriosActivos.length}</p>
                </div>
            </div>

            {/* Filtros Inteligentes */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-700">
                        <SlidersHorizontal className="w-4 h-4 text-cyan-600" />
                        <span>Filtros de Búsqueda Avanzada</span>
                    </div>
                    {(busquedaRbdNombre || filtroRbdSeleccionado || filtroFecha || filtroRut || filtroNombre || filtroCriterio !== 'TODOS') && (
                        <button
                            onClick={limpiarFiltros}
                            className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 font-semibold transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>Limpiar filtros</span>
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Filtro 1: Autocompletado RBD / Nombre */}
                    <div className="relative">
                        <label className="text-[11px] font-semibold text-gray-600 uppercase block mb-1">
                            RBD / Establecimiento
                        </label>
                        <div className="relative">
                            <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={busquedaRbdNombre}
                                onChange={e => {
                                    setBusquedaRbdNombre(e.target.value)
                                    setFiltroRbdSeleccionado(null)
                                    setIsRbdDropdownOpen(true)
                                }}
                                onFocus={() => setIsRbdDropdownOpen(true)}
                                placeholder="Escribe RBD o Colegio..."
                                className="w-full pl-9 pr-7 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            />
                            {busquedaRbdNombre && (
                                <button
                                    onClick={() => {
                                        setBusquedaRbdNombre('')
                                        setFiltroRbdSeleccionado(null)
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Dropdown autocompletado */}
                        {isRbdDropdownOpen && (
                            <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100 animate-in fade-in">
                                <div className="p-2 bg-gray-50 text-[10px] uppercase font-bold text-gray-500 flex justify-between">
                                    <span>Establecimientos Sugeridos</span>
                                    <button
                                        onClick={() => setIsRbdDropdownOpen(false)}
                                        className="text-gray-400 hover:text-gray-700"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                                {establecimientosSugeridos.length === 0 ? (
                                    <div className="p-3 text-xs text-gray-400 text-center">
                                        No se encontraron colegios con este término
                                    </div>
                                ) : (
                                    establecimientosSugeridos.map(item => (
                                        <button
                                            key={item.rbd}
                                            type="button"
                                            onClick={() => {
                                                setBusquedaRbdNombre(`(${item.rbd}) ${item.establecimiento}`)
                                                setFiltroRbdSeleccionado(item.rbd)
                                                setIsRbdDropdownOpen(false)
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-cyan-50 hover:text-cyan-900 flex items-center justify-between transition-colors"
                                        >
                                            <span className="truncate pr-2 font-medium">{item.establecimiento}</span>
                                            <span className="font-mono text-[11px] bg-gray-100 px-1.5 py-0.5 rounded text-cyan-700 border border-gray-200">
                                                {item.rbd}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Filtro 2: Fecha */}
                    <div>
                        <label className="text-[11px] font-semibold text-gray-600 uppercase block mb-1">
                            Fecha
                        </label>
                        <div className="relative">
                            <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="date"
                                value={filtroFecha}
                                onChange={e => { setFiltroFecha(e.target.value); setPaginaActual(1); }}
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            />
                        </div>
                    </div>

                    {/* Filtro 3: RUT */}
                    <div>
                        <label className="text-[11px] font-semibold text-gray-600 uppercase block mb-1">
                            RUT
                        </label>
                        <input
                            type="text"
                            value={filtroRut}
                            onChange={e => { setFiltroRut(e.target.value); setPaginaActual(1); }}
                            placeholder="Ej: 12345678-9"
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 font-mono"
                        />
                    </div>

                    {/* Filtro 4: Nombre */}
                    <div>
                        <label className="text-[11px] font-semibold text-gray-600 uppercase block mb-1">
                            Colaborador
                        </label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={filtroNombre}
                                onChange={e => { setFiltroNombre(e.target.value); setPaginaActual(1); }}
                                placeholder="Buscar nombre..."
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            />
                        </div>
                    </div>

                    {/* Filtro 5: Criterios */}
                    <div>
                        <label className="text-[11px] font-semibold text-gray-600 uppercase block mb-1">
                            Criterios de Ausencias
                        </label>
                        <select
                            value={filtroCriterio}
                            onChange={e => { setFiltroCriterio(e.target.value); setPaginaActual(1); }}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        >
                            <option value="TODOS">Todos los Criterios</option>
                            <option value="SIN_CRITERIO">⚠️ Sin Criterio (Pendientes)</option>
                            {criteriosActivos.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.nombre}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabla de Registros Estándar Claro */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 bg-gray-50/50">
                    <div>
                        Mostrando registros <strong>{Math.min(registrosFiltrados.length, (paginaActual - 1) * porPagina + 1)}</strong> - <strong>{Math.min(registrosFiltrados.length, paginaActual * porPagina)}</strong> de <strong>{registrosFiltrados.length}</strong>
                    </div>

                    {/* Paginación */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                            disabled={paginaActual === 1}
                            className="px-2.5 py-1 bg-white hover:bg-gray-50 disabled:opacity-40 rounded-lg text-gray-700 border border-gray-200 font-medium shadow-2xs"
                        >
                            Anterior
                        </button>
                        <span className="font-semibold text-gray-700">
                            Página {paginaActual} de {totalPaginas}
                        </span>
                        <button
                            onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                            disabled={paginaActual >= totalPaginas}
                            className="px-2.5 py-1 bg-white hover:bg-gray-50 disabled:opacity-40 rounded-lg text-gray-700 border border-gray-200 font-medium shadow-2xs"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-700">
                        <thead className="bg-gray-50 font-semibold uppercase text-gray-500 border-b border-gray-200 tracking-wider">
                            <tr>
                                {/* Fecha */}
                                <th
                                    onClick={() => handleSort('fecha')}
                                    className="px-4 py-3.5 whitespace-nowrap cursor-pointer select-none transition-colors group hover:bg-gray-100"
                                    title={`Ordenar por Fecha (${sortField === 'fecha' ? (sortDirection === 'asc' ? 'Descendente' : 'Ascendente') : 'Ascendente'})`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className={sortField === 'fecha' ? 'text-cyan-800 font-bold' : ''}>Fecha</span>
                                        <span className="inline-flex">
                                            {sortField === 'fecha' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                                                ) : (
                                                    <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                                                )
                                            ) : (
                                                <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </span>
                                    </div>
                                </th>

                                {/* RBD */}
                                <th
                                    onClick={() => handleSort('rbd')}
                                    className="px-4 py-3.5 whitespace-nowrap cursor-pointer select-none transition-colors group hover:bg-gray-100"
                                    title={`Ordenar por RBD (${sortField === 'rbd' ? (sortDirection === 'asc' ? 'Descendente' : 'Ascendente') : 'Ascendente'})`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className={sortField === 'rbd' ? 'text-cyan-800 font-bold' : ''}>RBD</span>
                                        <span className="inline-flex">
                                            {sortField === 'rbd' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                                                ) : (
                                                    <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                                                )
                                            ) : (
                                                <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </span>
                                    </div>
                                </th>

                                {/* Establecimiento */}
                                <th
                                    onClick={() => handleSort('establecimiento')}
                                    className="px-4 py-3.5 whitespace-nowrap cursor-pointer select-none transition-colors group hover:bg-gray-100"
                                    title={`Ordenar por Establecimiento (${sortField === 'establecimiento' ? (sortDirection === 'asc' ? 'Descendente' : 'Ascendente') : 'Ascendente'})`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className={sortField === 'establecimiento' ? 'text-cyan-800 font-bold' : ''}>Establecimiento</span>
                                        <span className="inline-flex">
                                            {sortField === 'establecimiento' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                                                ) : (
                                                    <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                                                )
                                            ) : (
                                                <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </span>
                                    </div>
                                </th>

                                {/* Supervisor */}
                                <th
                                    onClick={() => handleSort('supervisorNombre')}
                                    className="px-4 py-3.5 whitespace-nowrap cursor-pointer select-none transition-colors group hover:bg-gray-100"
                                    title={`Ordenar por Supervisor (${sortField === 'supervisorNombre' ? (sortDirection === 'asc' ? 'Descendente' : 'Ascendente') : 'Ascendente'})`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className={sortField === 'supervisorNombre' ? 'text-cyan-800 font-bold' : ''}>Supervisor</span>
                                        <span className="inline-flex">
                                            {sortField === 'supervisorNombre' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                                                ) : (
                                                    <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                                                )
                                            ) : (
                                                <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </span>
                                    </div>
                                </th>

                                {/* RUT */}
                                <th
                                    onClick={() => handleSort('rut')}
                                    className="px-4 py-3.5 whitespace-nowrap cursor-pointer select-none transition-colors group hover:bg-gray-100"
                                    title={`Ordenar por RUT (${sortField === 'rut' ? (sortDirection === 'asc' ? 'Descendente' : 'Ascendente') : 'Ascendente'})`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className={sortField === 'rut' ? 'text-cyan-800 font-bold' : ''}>RUT</span>
                                        <span className="inline-flex">
                                            {sortField === 'rut' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                                                ) : (
                                                    <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                                                )
                                            ) : (
                                                <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </span>
                                    </div>
                                </th>

                                {/* Colaborador */}
                                <th
                                    onClick={() => handleSort('nombreCompleto')}
                                    className="px-4 py-3.5 whitespace-nowrap cursor-pointer select-none transition-colors group hover:bg-gray-100"
                                    title={`Ordenar por Colaborador (${sortField === 'nombreCompleto' ? (sortDirection === 'asc' ? 'Descendente' : 'Ascendente') : 'Ascendente'})`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className={sortField === 'nombreCompleto' ? 'text-cyan-800 font-bold' : ''}>Colaborador</span>
                                        <span className="inline-flex">
                                            {sortField === 'nombreCompleto' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                                                ) : (
                                                    <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                                                )
                                            ) : (
                                                <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </span>
                                    </div>
                                </th>

                                {/* Cargo */}
                                <th
                                    onClick={() => handleSort('cargo')}
                                    className="px-4 py-3.5 whitespace-nowrap cursor-pointer select-none transition-colors group hover:bg-gray-100"
                                    title={`Ordenar por Cargo (${sortField === 'cargo' ? (sortDirection === 'asc' ? 'Descendente' : 'Ascendente') : 'Ascendente'})`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className={sortField === 'cargo' ? 'text-cyan-800 font-bold' : ''}>Cargo</span>
                                        <span className="inline-flex">
                                            {sortField === 'cargo' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                                                ) : (
                                                    <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                                                )
                                            ) : (
                                                <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </span>
                                    </div>
                                </th>

                                {/* Trazabilidad Carga */}
                                <th className="px-4 py-3.5 whitespace-nowrap">Trazabilidad Carga</th>

                                {/* Criterio de Ausencia */}
                                <th
                                    onClick={() => handleSort('criterioNombre')}
                                    className="px-4 py-3.5 whitespace-nowrap min-w-[240px] cursor-pointer select-none transition-colors group hover:bg-gray-100 text-cyan-700 font-bold"
                                    title={`Ordenar por Criterio (${sortField === 'criterioNombre' ? (sortDirection === 'asc' ? 'Descendente' : 'Ascendente') : 'Ascendente'})`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className={sortField === 'criterioNombre' ? 'text-cyan-800 font-bold' : ''}>Criterio de Ausencia</span>
                                        <span className="inline-flex">
                                            {sortField === 'criterioNombre' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                                                ) : (
                                                    <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                                                )
                                            ) : (
                                                <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {registrosPaginados.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-14 text-gray-400">
                                        No se encontraron registros de ausentismo que coincidan con los filtros aplicados.
                                    </td>
                                </tr>
                            ) : (
                                registrosPaginados.map(r => {
                                    const isSaved = guardadoStatus[r.id]
                                    return (
                                        <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                                            {/* Fecha */}
                                            <td className="px-4 py-3 whitespace-nowrap font-mono font-medium text-gray-800">
                                                {r.fechaTexto || r.fecha}
                                            </td>

                                            {/* RBD */}
                                            <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-cyan-700">
                                                {r.rbd}
                                            </td>

                                            {/* Establecimiento */}
                                            <td className="px-4 py-3 max-w-[180px] truncate" title={r.establecimiento}>
                                                <span className="font-semibold text-gray-900">{r.establecimiento}</span>
                                            </td>

                                            {/* Supervisor */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="text-xs font-medium text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-100">
                                                    {r.supervisorNombre}
                                                </span>
                                            </td>

                                            {/* RUT (Desencriptado) */}
                                            <td className="px-4 py-3 whitespace-nowrap font-mono text-gray-800 font-medium">
                                                {r.rut}
                                            </td>

                                            {/* Nombre y Apellidos (Desencriptados) */}
                                            <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-900">
                                                {r.nombreCompleto}
                                            </td>

                                            {/* Cargo */}
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                                                {r.cargo || <span className="italic text-gray-400">-</span>}
                                            </td>

                                            {/* Trazabilidad Carga */}
                                            <td className="px-4 py-3 whitespace-nowrap text-[11px] text-gray-500">
                                                <div>
                                                    <span className="text-gray-400">Cargado: </span>
                                                    <span>{r.creadoPor}</span>
                                                </div>
                                                {r.numActualizaciones > 0 && r.actualizadoPor && (
                                                    <div className="text-cyan-700 text-[10px] mt-0.5 font-medium">
                                                        <span>Act: {r.actualizadoPor} ({r.numActualizaciones})</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Columna final: Lista desplegable Criterios de Ausencias */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex flex-col gap-1.5 min-w-[260px]">
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            value={r.criterioId ?? ''}
                                                            onChange={e => handleCriterioSelect(r.id, e.target.value)}
                                                            className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer ${
                                                                r.criterioId
                                                                    ? 'bg-white text-gray-900 border-gray-300 shadow-2xs'
                                                                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:border-amber-400'
                                                            }`}
                                                            style={{
                                                                borderLeftColor: r.criterioColor || (r.criterioId ? '#0891b2' : '#f59e0b'),
                                                                borderLeftWidth: '4px'
                                                            }}
                                                        >
                                                            <option value="" className="text-amber-700">
                                                                -- Seleccionar Criterio --
                                                            </option>
                                                            {criteriosActivos.map(crit => (
                                                                <option
                                                                    key={crit.id}
                                                                    value={crit.id}
                                                                    className="text-gray-900"
                                                                >
                                                                    {crit.nombre} {crit.solicitaDocumento ? '📎' : ''}
                                                                </option>
                                                            ))}
                                                        </select>

                                                        {/* Micro indicador de guardado */}
                                                        {isSaved && (
                                                            <span
                                                                className="text-emerald-600 flex items-center gap-0.5 animate-in fade-in"
                                                                title="Guardado exitosamente"
                                                            >
                                                                <Check className="w-4 h-4 stroke-[3]" />
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Indicador de documento adjunto */}
                                                    {r.documentoUrl ? (
                                                        <div className="flex items-center justify-between text-[11px] bg-cyan-50/70 border border-cyan-200/60 rounded-lg px-2 py-1 text-cyan-900">
                                                            <a
                                                                href={r.documentoUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1.5 hover:underline font-semibold truncate max-w-[190px]"
                                                                title={`Ver documento: ${r.documentoNombre || 'Respaldo'}`}
                                                            >
                                                                <Paperclip className="w-3.5 h-3.5 text-cyan-700 flex-shrink-0" />
                                                                <span className="truncate">{r.documentoNombre || 'Ver Respaldo'}</span>
                                                            </a>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openModalAdjuntoDirecto(r)}
                                                                    className="text-cyan-700 hover:text-cyan-900 p-0.5 hover:bg-cyan-100 rounded"
                                                                    title="Reemplazar archivo"
                                                                >
                                                                    <UploadCloud className="w-3 h-3" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleEliminarDocumento(r.id)}
                                                                    className="text-rose-500 hover:text-rose-700 p-0.5 hover:bg-rose-50 rounded"
                                                                    title="Eliminar archivo"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        // Si el criterio actual solicita documento y aún no tiene
                                                        r.criterioId && criteriosMap.get(r.criterioId)?.solicitaDocumento ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => openModalAdjuntoDirecto(r)}
                                                                className="flex items-center justify-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg px-2 py-1 transition-colors"
                                                            >
                                                                <Paperclip className="w-3 h-3 text-amber-600" />
                                                                <span>⚠️ Adjuntar respaldo obligatorio</span>
                                                            </button>
                                                        ) : null
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

                {/* Footer paginación */}
                <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50">
                    <span>
                        Total filtrados: <strong>{registrosFiltrados.length}</strong> registros
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                            disabled={paginaActual === 1}
                            className="px-3 py-1.5 bg-white hover:bg-gray-50 disabled:opacity-40 rounded-lg text-gray-700 border border-gray-200 font-semibold shadow-2xs"
                        >
                            Anterior
                        </button>
                        <span>
                            Página {paginaActual} de {totalPaginas}
                        </span>
                        <button
                            onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                            disabled={paginaActual >= totalPaginas}
                            className="px-3 py-1.5 bg-white hover:bg-gray-50 disabled:opacity-40 rounded-lg text-gray-700 border border-gray-200 font-semibold shadow-2xs"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal para Adjuntar Documento de Respaldo */}
            {modalAdjunto.isOpen && modalAdjunto.registro && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 block mb-0.5">
                                    Áreas · Recursos Humanos · Asistencia
                                </span>
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Paperclip className="w-5 h-5 text-cyan-600" />
                                    <span>Adjuntar Documento de Respaldo</span>
                                </h3>
                            </div>
                            <button
                                onClick={() => setModalAdjunto({ isOpen: false, registro: null, criterioId: null, criterioNombre: null })}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleGuardarDocumento} className="p-6 space-y-4">
                            {docError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2 font-medium">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                                    <span>{docError}</span>
                                </div>
                            )}

                            {/* Resumen del colaborador */}
                            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Colaborador:</span>
                                    <span className="font-bold text-gray-900">{modalAdjunto.registro.nombreCompleto}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">RUT:</span>
                                    <span className="font-mono text-gray-700">{modalAdjunto.registro.rut}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Establecimiento:</span>
                                    <span className="font-semibold text-gray-800">({modalAdjunto.registro.rbd}) {modalAdjunto.registro.establecimiento}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1 border-t border-gray-200/60 mt-1">
                                    <span className="text-gray-500">Criterio a Asignar:</span>
                                    <span className="font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-100">
                                        {modalAdjunto.criterioNombre}
                                    </span>
                                </div>
                            </div>

                            <p className="text-xs text-gray-500">
                                Este criterio está configurado para <strong>requerir documento adjunto</strong> (licencia médica, certificado, comprobante o permiso). Adjunta el archivo a continuación para validar la justificación:
                            </p>

                            {/* Campo de archivo */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                    Seleccionar Archivo (PDF, Imagen, Word) <span className="text-red-500">*</span>
                                </label>
                                <div className="relative border-2 border-dashed border-gray-300 hover:border-cyan-500 rounded-xl p-5 text-center transition-colors bg-gray-50/50">
                                    <input
                                        type="file"
                                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                        onChange={e => {
                                            const file = e.target.files?.[0]
                                            setArchivoAdjunto(file || null)
                                            setDocError(null)
                                        }}
                                        required
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="flex flex-col items-center pointer-events-none">
                                        <UploadCloud className="w-8 h-8 text-cyan-600 mb-1" />
                                        {archivoAdjunto ? (
                                            <div>
                                                <span className="text-xs font-bold text-gray-900 block">{archivoAdjunto.name}</span>
                                                <span className="text-[11px] text-gray-500 font-mono">
                                                    ({(archivoAdjunto.size / 1024).toFixed(1)} KB)
                                                </span>
                                            </div>
                                        ) : (
                                            <div>
                                                <span className="text-xs font-semibold text-gray-700 block">
                                                    Haz clic o arrastra un archivo aquí
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    Formatos permitidos: PDF, JPG, PNG, DOC, DOCX
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 flex justify-end gap-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setModalAdjunto({ isOpen: false, registro: null, criterioId: null, criterioNombre: null })}
                                    disabled={uploadingDoc}
                                    className="px-4 py-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors font-semibold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploadingDoc || !archivoAdjunto}
                                    className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-cyan-600/20 transition-all flex items-center gap-2"
                                >
                                    {uploadingDoc ? (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            <span>Subiendo...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Paperclip className="w-3.5 h-3.5" />
                                            <span>Guardar y Adjuntar</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
