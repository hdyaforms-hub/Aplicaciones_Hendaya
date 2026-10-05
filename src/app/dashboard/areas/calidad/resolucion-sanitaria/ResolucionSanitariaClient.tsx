'use client'

import React, { useState, useEffect, useCallback, useTransition } from 'react'
import {
    getResolucionSanitariaRecords,
    updateResolucionSanitariaRecord,
    uploadResolucionDocumento,
    deleteResolucionDocumento,
    syncColegiosManualAction,
    ejecutarCargaMasivaResolucionSanitariaAction,
    ResolucionSanitariaFilter
} from './actions'

type ResolucionItem = {
    id: string
    licitacion: string | null
    licId: number | null
    anio: number
    ut: number
    institucion: string
    rbd: number
    rbdDv: string | null
    nombreEstablecimiento: string
    comuna: string
    estadoResolucion: string
    numeroResolucion: string | null
    documentoUrl: string | null
    documentoNombre: string | null
    observaciones: string | null
    updatedBy: string | null
    updatedAt: Date | string
}

type Stats = {
    totalColegios: number
    conResolucion: number
    sinResolucion: number
    noAplica: number
    conDocumento: number
    porcentajeResolucion?: number
}

interface Props {
    canManage: boolean
}

export default function ResolucionSanitariaClient({ canManage }: Props) {
    const [records, setRecords] = useState<ResolucionItem[]>([])
    const [total, setTotal] = useState<number>(0)
    const [totalPages, setTotalPages] = useState<number>(1)
    const [loading, setLoading] = useState<boolean>(true)
    const [stats, setStats] = useState<Stats>({
        totalColegios: 0,
        conResolucion: 0,
        sinResolucion: 0,
        noAplica: 0,
        conDocumento: 0,
        porcentajeResolucion: 0
    })

    // Opciones de filtros
    const [licitaciones, setLicitaciones] = useState<string[]>([])
    const [instituciones, setInstituciones] = useState<string[]>([])
    const [uts, setUts] = useState<number[]>([])
    const [anios, setAnios] = useState<number[]>([])
    const [userSucursales, setUserSucursales] = useState<string[]>([])
    const [isFilteredBySucursal, setIsFilteredBySucursal] = useState<boolean>(false)
    const [isAdminUser, setIsAdminUser] = useState<boolean>(false)

    // Filtros activos
    const [selectedAnio, setSelectedAnio] = useState<number>(new Date().getFullYear())
    const [selectedLicitacion, setSelectedLicitacion] = useState<string>('ALL')
    const [selectedInstitucion, setSelectedInstitucion] = useState<string>('ALL')
    const [selectedUts, setSelectedUts] = useState<number[]>([])
    const [selectedEstados, setSelectedEstados] = useState<string[]>([])
    const [openUtDropdown, setOpenUtDropdown] = useState<boolean>(false)
    const [openEstadoDropdown, setOpenEstadoDropdown] = useState<boolean>(false)
    const [searchQuery, setSearchQuery] = useState<string>('')

    // Paginación y ordenamiento
    const [page, setPage] = useState<number>(1)
    const pageSize = 10
    const [sortField, setSortField] = useState<string>('rbd')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

    // Modales y estados de acción
    const [editingItem, setEditingItem] = useState<ResolucionItem | null>(null)
    const [editEstado, setEditEstado] = useState<string>('No Aplica')
    const [editNumero, setEditNumero] = useState<string>('')
    const [editObservaciones, setEditObservaciones] = useState<string>('')
    const [editFile, setEditFile] = useState<File | null>(null)
    const [saving, setSaving] = useState<boolean>(false)
    const [modalError, setModalError] = useState<string>('')

    // Modal de vista previa de documento
    const [previewDoc, setPreviewDoc] = useState<{ url: string; nombre: string; rbd: number; establecimiento: string } | null>(null)

    // Modal para adjuntar documento rápido
    const [uploadItem, setUploadItem] = useState<ResolucionItem | null>(null)
    const [uploadingFile, setUploadingFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState<boolean>(false)

    // Sincronización manual y carga masiva
    const [isSyncing, startSync] = useTransition()
    const [isCargaMasivaModalOpen, setIsCargaMasivaModalOpen] = useState<boolean>(false)
    const [cargaMasivaFile, setCargaMasivaFile] = useState<File | null>(null)
    const [cargaMasivaAnio, setCargaMasivaAnio] = useState<number>(new Date().getFullYear())
    const [cargaMasivaLoading, setCargaMasivaLoading] = useState<boolean>(false)
    const [cargaMasivaError, setCargaMasivaError] = useState<string>('')
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

    // Mostrar notificación temporal
    const showNotify = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message })
        setTimeout(() => setNotification(null), 5000)
    }

    // Cargar datos del servidor
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await getResolucionSanitariaRecords({
                anio: selectedAnio,
                licitacion: selectedLicitacion,
                institucion: selectedInstitucion,
                uts: selectedUts.length > 0 ? selectedUts : undefined,
                estadosResolucion: selectedEstados.length > 0 ? selectedEstados : undefined,
                search: searchQuery,
                page,
                pageSize,
                sortField,
                sortDirection
            })

            setRecords(res.records as ResolucionItem[])
            setTotal(res.total)
            setTotalPages(res.totalPages || 1)
            setStats(res.stats)
            setLicitaciones(res.licitaciones)
            setInstituciones((res as any).instituciones || [])
            setUts(res.uts)
            if (res.anios && res.anios.length > 0) {
                setAnios(res.anios)
            }
            setUserSucursales(res.userSucursales || [])
            setIsFilteredBySucursal(!!res.isFilteredBySucursal)
            setIsAdminUser(!!res.isAdmin)
        } catch (err: any) {
            console.error('Error cargando registros de resolución sanitaria:', err)
            showNotify('error', err?.message || 'Error al cargar los registros')
        } finally {
            setLoading(false)
        }
    }, [selectedAnio, selectedLicitacion, selectedInstitucion, selectedUts, selectedEstados, searchQuery, page, sortField, sortDirection])

    useEffect(() => {
        loadData()
    }, [loadData])

    // Cerrar popovers de filtros al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (!target.closest('.relative-filter')) {
                setOpenUtDropdown(false)
                setOpenEstadoDropdown(false)
            }
        }
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [])

    // Manejar ordenamiento al hacer clic en cabecera
    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
        setPage(1)
    }

    // Limpiar todos los filtros
    const handleResetFilters = () => {
        setSelectedAnio(new Date().getFullYear())
        setSelectedLicitacion('ALL')
        setSelectedInstitucion('ALL')
        setSelectedUts([])
        setSelectedEstados([])
        setSearchQuery('')
        setPage(1)
    }

    // Abrir modal de edición
    const handleOpenEdit = (item: ResolucionItem) => {
        setEditingItem(item)
        setEditEstado(item.estadoResolucion || 'No Aplica')
        setEditNumero(item.numeroResolucion || '')
        setEditObservaciones(item.observaciones || '')
        setEditFile(null)
        setModalError('')
    }

    // Guardar edición
    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingItem) return

        if (editEstado === 'Si' && (!editNumero || editNumero.trim() === '')) {
            setModalError('Debe ingresar obligatoriamente el N° de Resolución Sanitaria si el estado es "Si"')
            return
        }

        setSaving(true)
        setModalError('')

        try {
            await updateResolucionSanitariaRecord({
                id: editingItem.id,
                estadoResolucion: editEstado,
                numeroResolucion: editEstado === 'Si' ? editNumero : null,
                observaciones: editObservaciones
            })

            // Si además se seleccionó un archivo en el modal, subirlo
            if (editFile) {
                const formData = new FormData()
                formData.append('id', editingItem.id)
                formData.append('file', editFile)
                await uploadResolucionDocumento(formData)
            }

            showNotify('success', `Resolución sanitaria para RBD ${editingItem.rbd} guardada correctamente`)
            setEditingItem(null)
            loadData()
        } catch (err: any) {
            setModalError(err?.message || 'Error al guardar la información')
        } finally {
            setSaving(false)
        }
    }

    // Subida rápida de documento
    const handleUploadQuick = async () => {
        if (!uploadItem || !uploadingFile) return
        setIsUploading(true)
        try {
            const formData = new FormData()
            formData.append('id', uploadItem.id)
            formData.append('file', uploadingFile)
            await uploadResolucionDocumento(formData)
            showNotify('success', `Documento para RBD ${uploadItem.rbd} adjuntado con éxito`)
            setUploadItem(null)
            setUploadingFile(null)
            loadData()
        } catch (err: any) {
            showNotify('error', err?.message || 'Error al subir el documento')
        } finally {
            setIsUploading(false)
        }
    }

    // Eliminar documento adjunto
    const handleDeleteDocumento = async (id: string, rbd: number) => {
        if (!confirm(`¿Estás seguro de eliminar el documento adjunto del RBD ${rbd}?`)) return
        try {
            await deleteResolucionDocumento(id)
            showNotify('success', 'Documento eliminado correctamente')
            if (previewDoc) setPreviewDoc(null)
            loadData()
        } catch (err: any) {
            showNotify('error', err?.message || 'Error al eliminar el documento')
        }
    }

    // Sincronización manual de colegios
    const handleManualSync = () => {
        startSync(async () => {
            try {
                const res = await syncColegiosManualAction(selectedAnio)
                showNotify('success', `Sincronización completada para el año ${selectedAnio}: ${res.added} nuevos, ${res.updated} actualizados de ${res.total} colegios.`)
                loadData()
            } catch (err: any) {
                showNotify('error', err?.message || 'Error durante la sincronización')
            }
        })
    }

    // Abrir ventana de carga masiva (Solo Administrador)
    const handleOpenCargaMasivaModal = () => {
        setCargaMasivaFile(null)
        setCargaMasivaAnio(selectedAnio || 2025)
        setCargaMasivaError('')
        setIsCargaMasivaModalOpen(true)
    }

    // Ejecutar procesamiento de archivo en carga masiva
    const handleExecuteCargaMasiva = async (e: React.FormEvent) => {
        e.preventDefault()
        setCargaMasivaLoading(true)
        setCargaMasivaError('')

        try {
            const formData = new FormData()
            if (cargaMasivaFile) {
                formData.append('file', cargaMasivaFile)
            }
            formData.append('targetAnio', String(cargaMasivaAnio))

            const res = await ejecutarCargaMasivaResolucionSanitariaAction(formData)
            const aniosTxt = res.anios && res.anios.length > 0 ? res.anios.join(', ') : cargaMasivaAnio
            showNotify('success', `Carga masiva completada: ${res.updatedCount} establecimientos actualizados con su Resolución Sanitaria (Año ${aniosTxt}).`)
            setIsCargaMasivaModalOpen(false)
            setSelectedAnio(cargaMasivaAnio)
            setPage(1)
            loadData()
        } catch (err: any) {
            setCargaMasivaError(err?.message || 'Error al ejecutar la carga masiva')
        } finally {
            setCargaMasivaLoading(false)
        }
    }

    // Render de flecha de ordenamiento
    const renderSortIcon = (field: string) => {
        if (sortField !== field) {
            return <span className="text-gray-300 ml-1 text-xs">↕</span>
        }
        return sortDirection === 'asc' ? (
            <span className="text-cyan-600 font-bold ml-1 text-xs">↑</span>
        ) : (
            <span className="text-cyan-600 font-bold ml-1 text-xs">↓</span>
        )
    }

    return (
        <div className="space-y-6">
            {/* Notificación flotante */}
            {notification && (
                <div
                    className={`p-4 rounded-2xl shadow-lg border text-sm font-semibold transition-all flex items-center justify-between ${
                        notification.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <span>{notification.type === 'success' ? '✅' : '⚠️'}</span>
                        <span>{notification.message}</span>
                    </div>
                    <button
                        onClick={() => setNotification(null)}
                        className="text-xs underline text-gray-500 hover:text-gray-800"
                    >
                        Cerrar
                    </button>
                </div>
            )}

            {/* Cabecera Principal */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs font-bold rounded-full uppercase tracking-wider border border-cyan-500/30">
                                Áreas &bull; Calidad
                            </span>
                            <span className="px-3 py-1 bg-slate-800/80 text-slate-300 text-xs font-semibold rounded-full border border-slate-700">
                                Vigencia Anual
                            </span>
                            {isAdminUser ? (
                                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-full border border-emerald-500/30 flex items-center gap-1">
                                    <span>🌐</span> Todas las Sucursales
                                </span>
                            ) : isFilteredBySucursal && (
                                userSucursales.length > 0 ? (
                                    <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs font-bold rounded-full border border-cyan-500/30 flex items-center gap-1">
                                        <span>🏢</span> Sucursal: {userSucursales.join(', ')}
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-full border border-amber-500/30 flex items-center gap-1">
                                        <span>⚠️</span> Sin Sucursal Asignada
                                    </span>
                                )
                            )}
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-3">
                            <span>📋</span> Resolución Sanitaria
                        </h1>
                        <p className="text-slate-300 text-sm mt-1 max-w-2xl">
                            Control anual y seguimiento de resoluciones sanitarias de cada establecimiento educativo por RBD, UT y Licitación.
                            {isFilteredBySucursal && userSucursales.length > 0 && (
                                <span className="block text-cyan-300 text-xs mt-1 font-semibold">
                                    Filtrado exclusivamente a establecimientos de tu sucursal ({userSucursales.join(', ')}).
                                </span>
                            )}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {isAdminUser && (
                            <button
                                onClick={handleOpenCargaMasivaModal}
                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 text-sm cursor-pointer"
                                title="Abrir ventana de carga masiva de Resolución Sanitaria desde archivo Excel"
                            >
                                <span>📥</span>
                                <span>Carga Masiva</span>
                            </button>
                        )}
                        <button
                            onClick={handleManualSync}
                            disabled={isSyncing}
                            className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-cyan-600/30 transition-all flex items-center gap-2 text-sm"
                            title="Actualiza y rescata los colegios del sistema hacia este módulo"
                        >
                            <span>{isSyncing ? '⌛' : '🔄'}</span>
                            {isSyncing ? 'Sincronizando...' : 'Sincronizar Colegios'}
                        </button>
                    </div>
                </div>

                {/* Tarjetas de Métricas (KPIs) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-700/60">
                    <div className="bg-slate-800/60 backdrop-blur-sm p-3.5 rounded-2xl border border-slate-700/50">
                        <p className="text-xs text-slate-400 font-semibold uppercase">Total Establecimientos</p>
                        <p className="text-2xl font-black text-white mt-0.5">{stats.totalColegios}</p>
                    </div>
                    <div className="bg-emerald-950/40 backdrop-blur-sm p-3.5 rounded-2xl border border-emerald-500/30">
                        <p className="text-xs text-emerald-300 font-semibold uppercase flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                            Con Resolución (Si)
                        </p>
                        <p className="text-2xl font-black text-emerald-400 mt-0.5">{stats.conResolucion}</p>
                    </div>
                    <div className="bg-rose-950/40 backdrop-blur-sm p-3.5 rounded-2xl border border-rose-500/30">
                        <p className="text-xs text-rose-300 font-semibold uppercase flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
                            Sin Resolución (No)
                        </p>
                        <p className="text-2xl font-black text-rose-400 mt-0.5">{stats.sinResolucion}</p>
                    </div>
                    <div className="bg-slate-800/40 backdrop-blur-sm p-3.5 rounded-2xl border border-slate-600/30">
                        <p className="text-xs text-slate-300 font-semibold uppercase">No Aplica</p>
                        <p className="text-2xl font-black text-slate-300 mt-0.5">{stats.noAplica}</p>
                    </div>
                    <div className="bg-sky-950/40 backdrop-blur-sm p-3.5 rounded-2xl border border-sky-500/30">
                        <p className="text-xs text-sky-300 font-semibold uppercase flex items-center gap-1">
                            <span>📁</span> Documentos Adjuntos
                        </p>
                        <p className="text-2xl font-black text-sky-400 mt-0.5">{stats.conDocumento}</p>
                    </div>
                    <div className="bg-indigo-950/40 backdrop-blur-sm p-3.5 rounded-2xl border border-indigo-500/30">
                        <p className="text-xs text-indigo-300 font-semibold uppercase flex items-center gap-1" title="Porcentaje de establecimientos con Resolución Sanitaria (Si)">
                            <span>📊</span> % de Establecimiento con Resolución
                        </p>
                        <p className="text-2xl font-black text-indigo-400 mt-0.5">
                            {(() => {
                                const pct = stats.porcentajeResolucion !== undefined
                                    ? stats.porcentajeResolucion
                                    : (stats.totalColegios > 0 ? (stats.conResolucion / stats.totalColegios) * 100 : 0)
                                return pct % 1 === 0 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`
                            })()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Panel de Filtros */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                    <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                        <span>🔍</span> Filtros de Selección
                    </h2>
                    {(selectedLicitacion !== 'ALL' || selectedInstitucion !== 'ALL' || selectedUts.length > 0 || selectedEstados.length > 0 || searchQuery || selectedAnio !== new Date().getFullYear()) && (
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="text-xs font-semibold text-cyan-600 hover:text-cyan-800 hover:underline cursor-pointer"
                        >
                            Limpiar Filtros
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {/* Filtro: Año */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">
                            Año
                        </label>
                        <select
                            value={selectedAnio}
                            onChange={(e) => {
                                setSelectedAnio(Number(e.target.value))
                                setPage(1)
                            }}
                            className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-bold"
                        >
                            {anios.map((a) => (
                                <option key={a} value={a}>
                                    Año {a}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro: Institución */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">
                            Institución
                        </label>
                        <select
                            value={selectedInstitucion}
                            onChange={(e) => {
                                setSelectedInstitucion(e.target.value)
                                setPage(1)
                            }}
                            className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-semibold"
                        >
                            <option value="ALL">-- Todas las Instituciones --</option>
                            {instituciones.map((inst) => (
                                <option key={inst} value={inst}>
                                    {inst}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro: Licitación */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">
                            Licitación
                        </label>
                        <select
                            value={selectedLicitacion}
                            onChange={(e) => {
                                setSelectedLicitacion(e.target.value)
                                setPage(1)
                            }}
                            className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-semibold"
                        >
                            <option value="ALL">-- Todas las Licitaciones --</option>
                            {licitaciones.map((lic) => (
                                <option key={lic} value={lic}>
                                    {lic}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro: UT (Múltiple Selección) */}
                    <div className="relative relative-filter">
                        <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center justify-between">
                            <span>Unidad Territorial (UT)</span>
                            {selectedUts.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedUts([])
                                        setPage(1)
                                    }}
                                    className="text-[10px] text-cyan-600 hover:underline font-bold cursor-pointer"
                                >
                                    Limpiar
                                </button>
                            )}
                        </label>
                        <button
                            type="button"
                            onClick={() => {
                                setOpenUtDropdown(!openUtDropdown)
                                setOpenEstadoDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-semibold flex items-center justify-between text-left cursor-pointer"
                        >
                            <span className="truncate">
                                {selectedUts.length === 0
                                    ? '-- Todas las UTs --'
                                    : selectedUts.length === 1
                                    ? `UT ${selectedUts[0]}`
                                    : `${selectedUts.length} UTs seleccionadas`}
                            </span>
                            <span className="text-gray-400 text-xs ml-1 shrink-0">
                                {openUtDropdown ? '▲' : '▼'}
                            </span>
                        </button>

                        {/* Dropdown Popover */}
                        {openUtDropdown && (
                            <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl p-2.5 space-y-1.5 animate-fadeIn">
                                <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedUts([...uts])
                                            setPage(1)
                                        }}
                                        className="text-[11px] font-bold text-cyan-600 hover:underline cursor-pointer"
                                    >
                                        Seleccionar todas
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedUts([])
                                            setPage(1)
                                        }}
                                        className="text-[11px] font-bold text-gray-400 hover:text-gray-600 cursor-pointer"
                                    >
                                        Deseleccionar
                                    </button>
                                </div>
                                <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                                    {uts.map((utVal) => {
                                        const isChecked = selectedUts.includes(utVal)
                                        return (
                                            <label
                                                key={utVal}
                                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                                                    isChecked
                                                        ? 'bg-cyan-50 text-cyan-900 font-bold'
                                                        : 'hover:bg-gray-50 text-gray-700'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedUts([...selectedUts, utVal])
                                                        } else {
                                                            setSelectedUts(selectedUts.filter((u) => u !== utVal))
                                                        }
                                                        setPage(1)
                                                    }}
                                                    className="w-3.5 h-3.5 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500 cursor-pointer"
                                                />
                                                <span>UT {utVal}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Filtro: Resolución Sanitaria (Múltiple Selección) */}
                    <div className="relative relative-filter">
                        <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center justify-between">
                            <span>Resolución Sanitaria</span>
                            {selectedEstados.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedEstados([])
                                        setPage(1)
                                    }}
                                    className="text-[10px] text-cyan-600 hover:underline font-bold cursor-pointer"
                                >
                                    Limpiar
                                </button>
                            )}
                        </label>
                        <button
                            type="button"
                            onClick={() => {
                                setOpenEstadoDropdown(!openEstadoDropdown)
                                setOpenUtDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-semibold flex items-center justify-between text-left cursor-pointer"
                        >
                            <span className="truncate">
                                {selectedEstados.length === 0
                                    ? '-- Todos los Estados --'
                                    : selectedEstados.length === 1
                                    ? selectedEstados[0] === 'Si'
                                        ? '🟢 Si'
                                        : selectedEstados[0] === 'No'
                                        ? '🔴 No'
                                        : '⚪ No Aplica'
                                    : `${selectedEstados.length} Estados seleccionados`}
                            </span>
                            <span className="text-gray-400 text-xs ml-1 shrink-0">
                                {openEstadoDropdown ? '▲' : '▼'}
                            </span>
                        </button>

                        {/* Dropdown Popover */}
                        {openEstadoDropdown && (
                            <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl p-2.5 space-y-1.5 animate-fadeIn">
                                <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedEstados(['Si', 'No', 'No Aplica'])
                                            setPage(1)
                                        }}
                                        className="text-[11px] font-bold text-cyan-600 hover:underline cursor-pointer"
                                    >
                                        Todos
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedEstados([])
                                            setPage(1)
                                        }}
                                        className="text-[11px] font-bold text-gray-400 hover:text-gray-600 cursor-pointer"
                                    >
                                        Limpiar
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    {[
                                        { val: 'Si', label: '🟢 Si (Con Resolución)' },
                                        { val: 'No', label: '🔴 No (Sin Resolución)' },
                                        { val: 'No Aplica', label: '⚪ No Aplica' }
                                    ].map((opt) => {
                                        const isChecked = selectedEstados.includes(opt.val)
                                        return (
                                            <label
                                                key={opt.val}
                                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                                                    isChecked
                                                        ? 'bg-cyan-50 text-cyan-900 font-bold'
                                                        : 'hover:bg-gray-50 text-gray-700'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedEstados([...selectedEstados, opt.val])
                                                        } else {
                                                            setSelectedEstados(selectedEstados.filter((s) => s !== opt.val))
                                                        }
                                                        setPage(1)
                                                    }}
                                                    className="w-3.5 h-3.5 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500 cursor-pointer"
                                                />
                                                <span>{opt.label}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Filtro: Búsqueda RBD / Nombre */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">
                            RBD / Establecimiento / Comuna
                        </label>
                        <input
                            type="text"
                            placeholder="Ej: 1234, Escuela, Santiago..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setPage(1)
                            }}
                            className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-semibold"
                        />
                    </div>
                </div>
            </div>

            {/* Tabla de Resultados (Exactamente 10 registros por página) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">Registros de Resolución Sanitaria ({selectedAnio})</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Visualizando {records.length} de {total} establecimientos (Página {page} de {totalPages})
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50/80 text-xs font-bold uppercase text-gray-500 border-b border-gray-100 select-none">
                            <tr>
                                <th onClick={() => handleSort('licitacion')} className="py-3.5 px-4 cursor-pointer hover:bg-gray-100 transition-colors">
                                    Licitación {renderSortIcon('licitacion')}
                                </th>
                                <th onClick={() => handleSort('anio')} className="py-3.5 px-3 cursor-pointer hover:bg-gray-100 transition-colors">
                                    Año {renderSortIcon('anio')}
                                </th>
                                <th onClick={() => handleSort('ut')} className="py-3.5 px-3 cursor-pointer hover:bg-gray-100 transition-colors">
                                    UT {renderSortIcon('ut')}
                                </th>
                                <th onClick={() => handleSort('institucion')} className="py-3.5 px-4 cursor-pointer hover:bg-gray-100 transition-colors">
                                    Institución {renderSortIcon('institucion')}
                                </th>
                                <th onClick={() => handleSort('rbd')} className="py-3.5 px-4 cursor-pointer hover:bg-gray-100 transition-colors">
                                    RBD {renderSortIcon('rbd')}
                                </th>
                                <th onClick={() => handleSort('nombreEstablecimiento')} className="py-3.5 px-4 cursor-pointer hover:bg-gray-100 transition-colors">
                                    Nombre Establecimiento {renderSortIcon('nombreEstablecimiento')}
                                </th>
                                <th onClick={() => handleSort('comuna')} className="py-3.5 px-4 cursor-pointer hover:bg-gray-100 transition-colors">
                                    Comuna {renderSortIcon('comuna')}
                                </th>
                                <th onClick={() => handleSort('estadoResolucion')} className="py-3.5 px-4 cursor-pointer hover:bg-gray-100 transition-colors">
                                    Resolución Sanitaria {renderSortIcon('estadoResolucion')}
                                </th>
                                <th onClick={() => handleSort('numeroResolucion')} className="py-3.5 px-4 cursor-pointer hover:bg-gray-100 transition-colors">
                                    N° Resolución {renderSortIcon('numeroResolucion')}
                                </th>
                                <th className="py-3.5 px-4">
                                    Documento
                                </th>
                                {canManage && (
                                    <th className="py-3.5 px-4 text-center">
                                        Acciones
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan={canManage ? 11 : 10} className="py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-2xl animate-spin">🌀</span>
                                            <span>Cargando datos de resoluciones sanitarias...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={canManage ? 11 : 10} className="py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-3xl">📁</span>
                                            <span className="font-semibold text-gray-700">No se encontraron registros</span>
                                            <span className="text-xs text-gray-400">
                                                Prueba cambiando los filtros o presiona &quot;Sincronizar Colegios&quot; para rescatar los establecimientos del sistema.
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                records.map((item) => (
                                    <tr key={item.id} className="hover:bg-cyan-50/20 transition-colors">
                                        <td className="py-3.5 px-4 whitespace-nowrap text-xs font-semibold text-gray-700">
                                            <span className="px-2 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200">
                                                {item.licitacion || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-3 whitespace-nowrap text-xs font-mono text-gray-500 font-bold">
                                            {item.anio}
                                        </td>
                                        <td className="py-3.5 px-3 whitespace-nowrap text-xs font-mono font-bold text-gray-800">
                                            {item.ut}
                                        </td>
                                        <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                {item.institucion}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-gray-900 text-sm">
                                            {item.rbd}
                                        </td>
                                        <td className="py-3.5 px-4 text-xs font-bold text-gray-900 max-w-xs truncate" title={item.nombreEstablecimiento}>
                                            {item.nombreEstablecimiento}
                                        </td>
                                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-gray-600">
                                            {item.comuna}
                                        </td>
                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                            {item.estadoResolucion === 'Si' && (
                                                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1.5">
                                                    <span>🟢</span> Si
                                                </span>
                                            )}
                                            {item.estadoResolucion === 'No' && (
                                                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1.5">
                                                    <span>🔴</span> No
                                                </span>
                                            )}
                                            {item.estadoResolucion === 'No Aplica' && (
                                                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1.5">
                                                    <span>⚪</span> No Aplica
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono font-bold text-gray-800">
                                            {item.estadoResolucion === 'Si' ? (
                                                item.numeroResolucion || <span className="text-amber-600 italic">Sin N°</span>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                                            {item.documentoUrl ? (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setPreviewDoc({
                                                            url: item.documentoUrl as string,
                                                            nombre: item.documentoNombre || 'Resolución Sanitaria',
                                                            rbd: item.rbd,
                                                            establecimiento: item.nombreEstablecimiento
                                                        })}
                                                        className="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-lg font-bold border border-cyan-200 flex items-center gap-1 transition-colors"
                                                        title="Ver documento adjunto"
                                                    >
                                                        <span>👁️</span> Ver
                                                    </button>
                                                    {canManage && (
                                                        <button
                                                            onClick={() => handleDeleteDocumento(item.id, item.rbd)}
                                                            className="text-gray-400 hover:text-rose-600 p-1"
                                                            title="Eliminar documento"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                canManage ? (
                                                    <button
                                                        onClick={() => {
                                                            setUploadItem(item)
                                                            setUploadingFile(null)
                                                        }}
                                                        className="text-xs text-gray-400 hover:text-cyan-600 font-semibold flex items-center gap-1 underline"
                                                    >
                                                        <span>📎</span> Adjuntar
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-300">Sin archivo</span>
                                                )
                                            )}
                                        </td>
                                        {canManage && (
                                            <td className="py-3.5 px-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => handleOpenEdit(item)}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-cyan-600 hover:text-white text-slate-700 font-bold rounded-xl text-xs transition-all shadow-sm"
                                                    title="Editar estado y número de resolución sanitaria"
                                                >
                                                    ✏️ Editar
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación de exactamente 10 registros por página */}
                {!loading && (
                    <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50 text-xs">
                        <span className="text-gray-500 font-medium">
                            Mostrando página <strong className="text-gray-800">{page}</strong> de <strong className="text-gray-800">{totalPages}</strong> ({total} establecimientos filtrados &bull; 10 por página)
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-40 rounded-xl font-bold text-gray-700 shadow-sm transition-all"
                            >
                                &larr; Anterior
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || totalPages === 0}
                                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-40 rounded-xl font-bold text-gray-700 shadow-sm transition-all"
                            >
                                Próximo &rarr;
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL 1: Edición de Resolución Sanitaria */}
            {editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100">
                        <div className="bg-gradient-to-r from-slate-900 to-cyan-950 p-6 text-white flex justify-between items-start">
                            <div>
                                <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-xs font-bold rounded-full uppercase">
                                    Año {editingItem.anio} &bull; RBD {editingItem.rbd}
                                </span>
                                <h3 className="text-lg font-black mt-1 text-white">
                                    Editar Resolución Sanitaria
                                </h3>
                                <p className="text-xs text-slate-300 truncate max-w-md">
                                    {editingItem.nombreEstablecimiento} - {editingItem.comuna}
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingItem(null)}
                                className="text-gray-400 hover:text-white text-xl font-bold p-1"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                            {modalError && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                                    ⚠️ {modalError}
                                </div>
                            )}

                            {/* Selector Estado Resolución */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                                    Resolución Sanitaria *
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Si', 'No', 'No Aplica'].map((estadoOption) => (
                                        <button
                                            type="button"
                                            key={estadoOption}
                                            onClick={() => {
                                                setEditEstado(estadoOption)
                                                if (estadoOption !== 'Si') {
                                                    setEditNumero('')
                                                }
                                            }}
                                            className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all text-center ${
                                                editEstado === estadoOption
                                                    ? estadoOption === 'Si'
                                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                                                        : estadoOption === 'No'
                                                        ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20'
                                                        : 'bg-slate-700 text-white border-slate-700 shadow-md shadow-slate-700/20'
                                                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            {estadoOption === 'Si' ? '🟢 Si' : estadoOption === 'No' ? '🔴 No' : '⚪ No Aplica'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* N° Resolución (Solo requerido si es Si) */}
                            {editEstado === 'Si' && (
                                <div className="animate-fadeIn">
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                                        N° de Resolución Sanitaria <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: RES-10492 / SEREMI-2026"
                                        value={editNumero}
                                        onChange={(e) => setEditNumero(e.target.value)}
                                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-semibold"
                                    />
                                    <p className="text-[11px] text-gray-400 mt-1">
                                        Indica el folio o número oficial emitido por la autoridad sanitaria.
                                    </p>
                                </div>
                            )}

                            {/* Adjuntar o Reemplazar Documento */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center justify-between">
                                    <span>Documento de Resolución (Opcional)</span>
                                    {editingItem.documentoUrl && (
                                        <span className="text-[11px] text-cyan-600 font-semibold">Ya posee documento</span>
                                    )}
                                </label>
                                <input
                                    type="file"
                                    accept=".pdf,image/png,image/jpeg,image/webp"
                                    onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                                    className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 cursor-pointer border border-gray-200 rounded-xl p-1"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">
                                    Formatos permitidos: PDF o Imágenes (PNG, JPG, WEBP).
                                </p>
                            </div>

                            {/* Observaciones */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                                    Observaciones
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Detalles adicionales, fecha de vencimiento o notas..."
                                    value={editObservaciones}
                                    onChange={(e) => setEditObservaciones(e.target.value)}
                                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setEditingItem(null)}
                                    disabled={saving}
                                    className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 text-xs font-bold bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl shadow-md shadow-cyan-600/20"
                                >
                                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: Adjuntar Documento Rápido */}
            {uploadItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
                        <div className="p-6 border-b border-gray-100">
                            <span className="text-xs font-bold text-cyan-600 uppercase">
                                RBD {uploadItem.rbd} &bull; {uploadItem.anio}
                            </span>
                            <h3 className="text-lg font-black text-gray-900 mt-1">
                                Adjuntar Documento de Resolución
                            </h3>
                            <p className="text-xs text-gray-500 truncate">
                                {uploadItem.nombreEstablecimiento}
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            <input
                                type="file"
                                accept=".pdf,image/png,image/jpeg,image/webp"
                                onChange={(e) => setUploadingFile(e.target.files?.[0] || null)}
                                className="w-full text-xs text-gray-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 cursor-pointer border border-gray-200 rounded-2xl p-2"
                            />
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setUploadItem(null)
                                        setUploadingFile(null)
                                    }}
                                    disabled={isUploading}
                                    className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleUploadQuick}
                                    disabled={isUploading || !uploadingFile}
                                    className="px-5 py-2 text-xs font-bold bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl shadow-md shadow-cyan-600/20"
                                >
                                    {isUploading ? 'Subiendo...' : 'Subir Documento'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: Vista Previa de Documento Adjunto */}
            {previewDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden border border-gray-200">
                        {/* Cabecera del visor */}
                        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center">
                                    📄
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-white max-w-md truncate">
                                        {previewDoc.nombre}
                                    </h4>
                                    <p className="text-xs text-slate-400">
                                        RBD: {previewDoc.rbd} &bull; {previewDoc.establecimiento}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={previewDoc.url}
                                    download={previewDoc.nombre}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                                >
                                    <span>⬇️</span> Descargar
                                </a>
                                <button
                                    onClick={() => setPreviewDoc(null)}
                                    className="text-gray-400 hover:text-white text-2xl font-bold p-1 px-2"
                                >
                                    &times;
                                </button>
                            </div>
                        </div>

                        {/* Contenedor del visor (PDF o Imagen) */}
                        <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center p-2">
                            {previewDoc.url.toLowerCase().endsWith('.pdf') ? (
                                <iframe
                                    src={`${previewDoc.url}#toolbar=1`}
                                    title="Vista Previa de Resolución Sanitaria"
                                    className="w-full h-full border-0 rounded-b-2xl bg-white"
                                />
                            ) : (
                                <div className="max-w-full max-h-full p-4 flex items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={previewDoc.url}
                                        alt={previewDoc.nombre}
                                        className="max-h-[70vh] object-contain rounded-xl shadow-lg border border-gray-200"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 4: Ventana de Carga Masiva de Resolución Sanitaria */}
            {isCargaMasivaModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 flex flex-col">
                        {/* Cabecera del modal */}
                        <div className="p-6 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl shadow-inner">
                                    📥
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white">
                                        Carga Masiva de Resolución Sanitaria
                                    </h3>
                                    <p className="text-xs text-emerald-200">
                                        Selecciona el archivo Excel (.xlsx / .xls) a procesar
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => !cargaMasivaLoading && setIsCargaMasivaModalOpen(false)}
                                disabled={cargaMasivaLoading}
                                className="text-white/70 hover:text-white text-2xl font-bold p-1 disabled:opacity-30 cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleExecuteCargaMasiva} className="p-6 space-y-4">
                            {cargaMasivaError && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                                    <span>⚠️</span>
                                    <span>{cargaMasivaError}</span>
                                </div>
                            )}

                            {/* Selector de Archivo Excel */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                                    Seleccionar Archivo Excel <span className="text-red-500">*</span>
                                </label>
                                <div className="border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-2xl p-4 transition-colors bg-gray-50/50 text-center">
                                    <input
                                        type="file"
                                        id="cargaMasivaInput"
                                        accept=".xlsx,.xls"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0] || null
                                            setCargaMasivaFile(f)
                                            setCargaMasivaError('')
                                        }}
                                        className="hidden"
                                    />
                                    <label htmlFor="cargaMasivaInput" className="cursor-pointer block">
                                        {cargaMasivaFile ? (
                                            <div className="flex items-center justify-center gap-3">
                                                <span className="text-3xl">📊</span>
                                                <div className="text-left">
                                                    <p className="text-xs font-bold text-gray-900 truncate max-w-xs">
                                                        {cargaMasivaFile.name}
                                                    </p>
                                                    <p className="text-[11px] text-gray-400">
                                                        {(cargaMasivaFile.size / 1024).toFixed(1)} KB &bull; Clic para cambiar archivo
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <div className="text-3xl">📁</div>
                                                <p className="text-xs font-bold text-emerald-700">
                                                    Haz clic para examinar y seleccionar el archivo
                                                </p>
                                                <p className="text-[11px] text-gray-400">
                                                    Formatos permitidos: .xlsx o .xls
                                                </p>
                                            </div>
                                        )}
                                    </label>
                                </div>
                                <p className="text-[11px] text-gray-400 mt-1">
                                    Si no seleccionas un archivo, se intentará usar el archivo oficial del servidor por defecto.
                                </p>
                            </div>

                            {/* Año de Aplicación */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                                    Año de Aplicación por Defecto
                                </label>
                                <select
                                    value={cargaMasivaAnio}
                                    onChange={(e) => setCargaMasivaAnio(Number(e.target.value))}
                                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold bg-white text-gray-800"
                                >
                                    {anios.map((a) => (
                                        <option key={a} value={a}>
                                            Año {a}
                                        </option>
                                    ))}
                                    {!anios.includes(2025) && <option value={2025}>Año 2025</option>}
                                    {!anios.includes(2026) && <option value={2026}>Año 2026</option>}
                                </select>
                                <p className="text-[11px] text-gray-500 mt-1">
                                    Si el archivo incluye una columna con el año por fila, se respetará el año específico de cada registro; de lo contrario, se aplicará al año seleccionado.
                                </p>
                            </div>

                            {/* Criterios y Reglas */}
                            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1 text-[11px] text-gray-600">
                                <p className="font-bold text-gray-800 flex items-center gap-1.5">
                                    <span>💡</span> Criterios de actualización:
                                </p>
                                <ul className="list-disc list-inside space-y-0.5 text-gray-600 pl-1">
                                    <li>Identificación por columna <strong>RBD</strong> del establecimiento.</li>
                                    <li>Actualiza únicamente la columna <strong>Resolución Sanitaria</strong> (Si, No, No Aplica).</li>
                                    <li>Si el estado es &quot;Si&quot; y el archivo incluye N° de resolución, también se registrará.</li>
                                    <li>No se sobreescriben nombres, comunas ni asignaciones de sucursales.</li>
                                </ul>
                            </div>

                            {/* Botones de acción */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsCargaMasivaModalOpen(false)}
                                    disabled={cargaMasivaLoading}
                                    className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={cargaMasivaLoading}
                                    className="px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-md shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
                                >
                                    <span>{cargaMasivaLoading ? '⌛' : '🚀'}</span>
                                    {cargaMasivaLoading ? 'Procesando archivo...' : 'Procesar Carga Masiva'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
