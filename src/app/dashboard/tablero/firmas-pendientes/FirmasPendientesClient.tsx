'use client'

import React, { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import {
    TableroFirmasPendientesResponse,
    FirmaPendienteItem,
    SupervisorOficialInfo,
    ItemTotalizadorZona,
    DesgloseDocumentos,
    getFirmasPendientesTableroData,
    cargarExcelFirmasPendientesAction
} from './actions'
import { exportarCeramicasAPdf } from '@/lib/pdf/exportadorCeramicasRRHH'
import {
    FileText,
    UploadCloud,
    Download,
    Search,
    Users,
    Building2,
    Calendar,
    Clock,
    AlertTriangle,
    CheckCircle2,
    X,
    Filter,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    SlidersHorizontal,
    Layers,
    Briefcase,
    Shield,
    Check,
    FileSpreadsheet,
    AlertCircle,
    Info
} from 'lucide-react'

interface Props {
    initialData: TableroFirmasPendientesResponse
}

export default function FirmasPendientesClient({ initialData }: Props) {
    const [data, setData] = useState<TableroFirmasPendientesResponse>(initialData)
    const [isPending, startTransition] = useTransition()

    // Filtros de estado
    const [filtroSucursal, setFiltroSucursal] = useState('TODAS')
    const [filtroSupervisor, setFiltroSupervisor] = useState('TODOS')
    const [filtroTipoDoc, setFiltroTipoDoc] = useState('TODOS')
    const [filtroTramo, setFiltroTramo] = useState('TODOS')
    const [filtroEstadoFirma, setFiltroEstadoFirma] = useState('TODOS')
    const [search, setSearch] = useState('')
    const [filtroRbd, setFiltroRbd] = useState<number | null>(null)

    // Paginación y ordenamiento
    const [page, setPage] = useState(data.page || 1)
    const [pageSize, setPageSize] = useState(data.pageSize || 15)
    const [sortBy, setSortBy] = useState<string>('diasAtraso')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

    // Modal de Carga Masiva
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

    // Pestaña activa de analítica visual
    const [activeTabVisual, setActiveTabVisual] = useState<'TOTALIZADOR' | 'SUCURSALES' | 'SUPERVISORES' | 'ESTABLECIMIENTOS' | 'ANTIGUEDAD' | 'TIPOLOGIA'>('TOTALIZADOR')
    const [filtroUrgenciaSup, setFiltroUrgenciaSup] = useState<'TODOS' | 'CONTRATOS' | 'LIQUIDACIONES' | 'VACACIONES' | 'INFORMATIVOS'>('TODOS')

    // Estados y Refs para Exportación a PDF Oficial Hendaya
    const [isExportingPdf, setIsExportingPdf] = useState(false)
    const [isPdfMenuOpen, setIsPdfMenuOpen] = useState(false)
    const [pdfFeedback, setPdfFeedback] = useState<string | null>(null)
    const pdfDropdownRef = useRef<HTMLDivElement>(null)
    const kpiContainerRef = useRef<HTMLDivElement>(null)
    const fullContainerRef = useRef<HTMLDivElement>(null)

    // Cerrar menú de PDF al hacer clic afuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pdfDropdownRef.current && !pdfDropdownRef.current.contains(event.target as Node)) {
                setIsPdfMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Filtrar lista oficial de supervisores según la sucursal seleccionada
    const supervisoresFiltrados = useMemo(() => {
        const oficiales: SupervisorOficialInfo[] = data.supervisoresOficiales && data.supervisoresOficiales.length > 0
            ? data.supervisoresOficiales
            : (data.supervisoresDisponibles || []).map(s => ({ nombre: s, sucursales: [] }))

        if (filtroSucursal === 'TODAS') {
            return oficiales
        }
        return oficiales.filter(s => s.sucursales.length === 0 || s.sucursales.includes(filtroSucursal))
    }, [data.supervisoresOficiales, data.supervisoresDisponibles, filtroSucursal])

    // Supervisores ordenados o filtrados por nivel de urgencia de documento
    const supervisoresMostrados = useMemo(() => {
        let list = [...(data.graficos.topSupervisores || [])]
        if (filtroUrgenciaSup === 'CONTRATOS') {
            list = list.filter(s => (s.desgloseTipos?.contratos || 0) > 0).sort((a, b) => (b.desgloseTipos?.contratos || 0) - (a.desgloseTipos?.contratos || 0))
        } else if (filtroUrgenciaSup === 'LIQUIDACIONES') {
            list = list.filter(s => (s.desgloseTipos?.liquidaciones || 0) > 0).sort((a, b) => (b.desgloseTipos?.liquidaciones || 0) - (a.desgloseTipos?.liquidaciones || 0))
        } else if (filtroUrgenciaSup === 'VACACIONES') {
            list = list.filter(s => (s.desgloseTipos?.vacaciones || 0) > 0).sort((a, b) => (b.desgloseTipos?.vacaciones || 0) - (a.desgloseTipos?.vacaciones || 0))
        } else if (filtroUrgenciaSup === 'INFORMATIVOS') {
            list = list.filter(s => (s.desgloseTipos?.informativos || 0) > 0).sort((a, b) => (b.desgloseTipos?.informativos || 0) - (a.desgloseTipos?.informativos || 0))
        }
        return list
    }, [data.graficos.topSupervisores, filtroUrgenciaSup])

    const [filtroUrgenciaRbd, setFiltroUrgenciaRbd] = useState<'TODOS' | 'CONTRATOS' | 'LIQUIDACIONES' | 'VACACIONES' | 'INFORMATIVOS'>('TODOS')

    // Establecimientos (RBDs) ordenados o filtrados por nivel de urgencia de documento
    const rbdsMostrados = useMemo(() => {
        let list = [...(data.graficos.porRbd || [])]
        if (filtroUrgenciaRbd === 'CONTRATOS') {
            list = list.filter(r => (r.desgloseTipos?.contratos || 0) > 0).sort((a, b) => (b.desgloseTipos?.contratos || 0) - (a.desgloseTipos?.contratos || 0))
        } else if (filtroUrgenciaRbd === 'LIQUIDACIONES') {
            list = list.filter(r => (r.desgloseTipos?.liquidaciones || 0) > 0).sort((a, b) => (b.desgloseTipos?.liquidaciones || 0) - (a.desgloseTipos?.liquidaciones || 0))
        } else if (filtroUrgenciaRbd === 'VACACIONES') {
            list = list.filter(r => (r.desgloseTipos?.vacaciones || 0) > 0).sort((a, b) => (b.desgloseTipos?.vacaciones || 0) - (a.desgloseTipos?.vacaciones || 0))
        } else if (filtroUrgenciaRbd === 'INFORMATIVOS') {
            list = list.filter(r => (r.desgloseTipos?.informativos || 0) > 0).sort((a, b) => (b.desgloseTipos?.informativos || 0) - (a.desgloseTipos?.informativos || 0))
        }
        return list
    }, [data.graficos.porRbd, filtroUrgenciaRbd])

    // Filtrar por un colegio específico al hacer clic en su tarjeta
    const handleFilterByRbd = (rbdNum: number) => {
        setFiltroRbd(rbdNum)
        fetchData(1, pageSize, sortBy, sortOrder, { rbd: rbdNum })
        const el = document.getElementById('tabla-firmas-detalle')
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' })
        }
    }

    // Función de recarga de datos con filtros
    const fetchData = (
        newPage = page,
        newPageSize = pageSize,
        newSortBy = sortBy,
        newSortOrder = sortOrder,
        overrideFilters?: { sucursal?: string; supervisor?: string; rbd?: number | null }
    ) => {
        const sucursalToUse = overrideFilters?.sucursal !== undefined ? overrideFilters.sucursal : filtroSucursal
        const supervisorToUse = overrideFilters?.supervisor !== undefined ? overrideFilters.supervisor : filtroSupervisor
        const rbdToUse = overrideFilters?.rbd !== undefined ? overrideFilters.rbd : filtroRbd

        startTransition(async () => {
            const res = await getFirmasPendientesTableroData({
                sucursal: sucursalToUse,
                supervisor: supervisorToUse,
                rbd: rbdToUse || undefined,
                tipoDocumento: filtroTipoDoc,
                tramoAntiguedad: filtroTramo,
                estadoFirma: filtroEstadoFirma,
                search: search.trim() || undefined,
                page: newPage,
                pageSize: newPageSize,
                sortBy: newSortBy,
                sortOrder: newSortOrder
            })
            if (res.success) {
                setData(res)
                setPage(newPage)
            } else if (res.error) {
                alert(res.error)
            }
        })
    }

    // Cambio rápido de sucursal desde analítica o tarjetas
    const handleSelectSucursal = (nuevaSucursal: string) => {
        setFiltroSucursal(nuevaSucursal)
        setFiltroSupervisor('TODOS')
        setFiltroRbd(null)
        fetchData(1, pageSize, sortBy, sortOrder, { sucursal: nuevaSucursal, supervisor: 'TODOS', rbd: null })
    }

    // Filtrar por un supervisor específico al hacer clic en su ranking
    const handleFilterBySupervisor = (supNombre: string) => {
        setFiltroSupervisor(supNombre)
        fetchData(1, pageSize, sortBy, sortOrder, { supervisor: supNombre })
        // Desplazar suavemente a la tabla de registros
        const el = document.getElementById('tabla-firmas-detalle')
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' })
        }
    }

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        fetchData(1, pageSize, sortBy, sortOrder)
    }

    const handleClearFilters = () => {
        setFiltroSucursal('TODAS')
        setFiltroSupervisor('TODOS')
        setFiltroTipoDoc('TODOS')
        setFiltroTramo('TODOS')
        setFiltroEstadoFirma('TODOS')
        setSearch('')
        setFiltroRbd(null)
        startTransition(async () => {
            const res = await getFirmasPendientesTableroData({
                page: 1,
                pageSize,
                sortBy: 'diasAtraso',
                sortOrder: 'desc'
            })
            if (res.success) {
                setData(res)
                setPage(1)
            }
        })
    }

    const handleSort = (field: string) => {
        const newOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc'
        setSortBy(field)
        setSortOrder(newOrder)
        fetchData(page, pageSize, field, newOrder)
    }

    // Exportación a formato CSV compatible con Excel con BOM UTF-8
    const handleExportExcel = () => {
        if (!data.registros || data.registros.length === 0) {
            alert('No hay registros para exportar.')
            return
        }

        const headers = [
            'Días Atraso',
            'RUT Colaborador',
            'Nombre Colaborador',
            'Cargo',
            'Sucursal',
            'RBD',
            'Establecimiento',
            'Supervisor',
            'Tipo Documento',
            'Detalle Documento',
            'Estado Firma',
            'Fecha Emisión',
            'Fecha Inicio Firma',
            'Nombre Apoderado 1',
            'Fecha Firma Apoderado 1'
        ]

        const rows = data.registros.map(r => [
            r.diasAtraso,
            `"${r.empleadoRut}"`,
            `"${(r.empleadoNombre || '').replace(/"/g, '""')}"`,
            `"${(r.cargo || '').replace(/"/g, '""')}"`,
            `"${r.sucursal}"`,
            r.rbd || '',
            `"${(r.establecimiento || '').replace(/"/g, '""')}"`,
            `"${(r.supervisorNombre || '').replace(/"/g, '""')}"`,
            `"${(r.tipoDocumento || '').replace(/"/g, '""')}"`,
            `"${(r.detalle || '').replace(/"/g, '""')}"`,
            `"${(r.documentoFirmado || '').replace(/"/g, '""')}"`,
            `"${r.fechaEmision || ''}"`,
            `"${r.fechaInicioFirma || ''}"`,
            `"${(r.nombreApoderado1 || '').replace(/"/g, '""')}"`,
            `"${r.fechaFirmaApoderado1 || ''}"`
        ])

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n')
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement('a')
        link.setAttribute('href', encodedUri)
        link.setAttribute('download', `firmas_pendientes_hendaya_${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // Exportación a PDF Oficial Hendaya (Métricas y Analítica Visual)
    const handleExportarPdf = async (modo: 'KPIS' | 'COMPLETO' = 'KPIS', cardsPerPage = 6) => {
        let targetElement: HTMLElement | null = null
        let tabName = 'Totalizador Zonas'
        let filtroActivo = filtroSucursal !== 'TODAS' ? `Sucursal: ${filtroSucursal}` : 'Todas las Sucursales'

        if (activeTabVisual === 'TOTALIZADOR') {
            tabName = 'Totalizador por Zonas'
        } else if (activeTabVisual === 'SUPERVISORES') {
            tabName = 'Top Supervisores'
            if (filtroSupervisor !== 'TODOS') filtroActivo += ` • Sup: ${filtroSupervisor}`
            if (filtroUrgenciaSup !== 'TODOS') filtroActivo += ` • Prioridad: ${filtroUrgenciaSup}`
        } else if (activeTabVisual === 'SUCURSALES') {
            tabName = 'Concentración por Sucursal'
        } else if (activeTabVisual === 'ESTABLECIMIENTOS') {
            tabName = 'Colegios y RBDs'
            if (filtroRbd) filtroActivo += ` • RBD: ${filtroRbd}`
            if (filtroUrgenciaRbd !== 'TODOS') filtroActivo += ` • Prioridad: ${filtroUrgenciaRbd}`
        } else if (activeTabVisual === 'ANTIGUEDAD') {
            tabName = 'Semáforo de Mora'
        } else if (activeTabVisual === 'TIPOLOGIA') {
            tabName = 'Tipo de Documento'
        }

        targetElement = modo === 'KPIS' ? kpiContainerRef.current : fullContainerRef.current

        if (!targetElement) {
            alert('No se encontró el contenedor visual para exportar a PDF.')
            return
        }

        setIsExportingPdf(true)
        setPdfFeedback('Generando PDF oficial Hendaya en alta resolución...')

        try {
            await exportarCeramicasAPdf(targetElement, {
                tabName: `${tabName} (${modo === 'KPIS' ? 'Resumen Ejecutivo' : `Vista Completa ${cardsPerPage} por hoja`})`,
                titulo: 'TABLERO FIRMAS PENDIENTES',
                subtitulo: 'Monitoreo de Documentos Laborales y Firma de Apoderados',
                filtroActivo,
                cardsPerPage,
                onProgress: (msg) => setPdfFeedback(msg),
            })
            setPdfFeedback('¡PDF descargado con éxito!')
            setTimeout(() => setPdfFeedback(null), 3500)
        } catch (error: any) {
            console.error('Error al generar PDF de firmas:', error)
            alert('Hubo un error al generar el PDF: ' + (error?.message || error))
            setPdfFeedback(null)
        } finally {
            setIsExportingPdf(false)
        }
    }

    // Envío del archivo Excel para Carga Masiva
    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setUploadError(null)
        setUploadSuccess(null)

        const formData = new FormData()
        if (selectedFile) {
            formData.append('file', selectedFile)
        }

        startTransition(async () => {
            const res = await cargarExcelFirmasPendientesAction(formData)
            if (res.success) {
                setUploadSuccess(res.message || 'Planilla cargada exitosamente.')
                setSelectedFile(null)
                // Refrescar el tablero con la nueva nómina
                const freshData = await getFirmasPendientesTableroData()
                if (freshData.success) {
                    setData(freshData)
                    setPage(1)
                }
                setTimeout(() => {
                    setIsUploadModalOpen(false)
                    setUploadSuccess(null)
                }, 2000)
            } else {
                setUploadError(res.error || 'Ocurrió un error al procesar el archivo.')
            }
        })
    }

    const { kpis, graficos, ultimaCarga } = data

    return (
        <div className="space-y-6 max-w-[1700px] mx-auto p-2 sm:p-4">
            {/* CABECERA CORPORATIVA OFICIAL HENDAYA */}
            <div className="relative z-30 bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-700/60">
                {/* Contenedor con overflow-hidden exclusivo para el blur decorativo, evitando recortar dropdowns */}
                <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                    <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="font-mono text-cyan-400 font-extrabold tracking-widest text-xs uppercase px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60">
                                HENDAYA · RECURSOS HUMANOS
                            </span>
                            <span className="text-slate-400 text-xs font-semibold">
                                Control de Documentos con Firma Pendiente
                            </span>
                            {data.isRestrictedByRbd && (
                                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                                    Perfil Restringido: {data.authorizedRbdsCount} colegios autorizados
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                            <span>Tablero Firmas Pendientes</span>
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                            Monitoreo gerencial y operativo de contratos, anexos, liquidaciones y comunicados pendientes de firma. Identifica mora, supervisores a cargo y avance por establecimiento educacional.
                        </p>
                    </div>

                    {/* Botones de Cabecera */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Refrescar */}
                        <button
                            type="button"
                            onClick={() => fetchData()}
                            disabled={isPending}
                            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-sm disabled:opacity-60 cursor-pointer"
                            title="Refrescar datos del tablero"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-cyan-400' : 'text-slate-300'}`} />
                            <span>Actualizar</span>
                        </button>

                        {/* Exportar Excel */}
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            className="px-3.5 py-2.5 bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-sm cursor-pointer"
                            title="Exportar selección a formato Excel (CSV UTF-8)"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Exportar Excel</span>
                        </button>

                        {/* Exportar Cerámicas y Analítica a PDF Oficial Hendaya */}
                        <div className="relative z-50" ref={pdfDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsPdfMenuOpen(prev => !prev)}
                                disabled={isExportingPdf || isPending}
                                className="px-3.5 py-2.5 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-sm disabled:opacity-60 cursor-pointer"
                                title="Exportar métricas y analítica visual a PDF oficial Hendaya"
                            >
                                <span>{isExportingPdf ? '⏳' : '📄'}</span>
                                <span>{isExportingPdf ? 'Generando PDF...' : 'Exportar PDF'}</span>
                                <span className="text-[10px] ml-0.5 opacity-80">▼</span>
                            </button>

                            {isPdfMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 z-50 text-slate-800 animate-in fade-in slide-in-from-top-1">
                                    <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider border-b border-slate-100 flex items-center justify-between">
                                        <span>Formato Oficial Hendaya</span>
                                        <span className="text-cyan-600 font-mono font-bold">PDF A4</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsPdfMenuOpen(false)
                                            handleExportarPdf('KPIS')
                                        }}
                                        className="w-full text-left p-2.5 hover:bg-sky-50 rounded-xl transition flex items-start gap-2.5 group cursor-pointer"
                                    >
                                        <span className="text-base p-1.5 bg-sky-100 rounded-lg text-sky-700">📊</span>
                                        <div>
                                            <div className="text-xs font-bold text-slate-900 group-hover:text-cyan-700">
                                                Resumen Ejecutivo (KPIs)
                                            </div>
                                            <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                                                1 página horizontal limpia con las métricas principales y totalizador general.
                                            </div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsPdfMenuOpen(false)
                                            handleExportarPdf('COMPLETO', 6)
                                        }}
                                        className="w-full text-left p-2.5 hover:bg-emerald-50 rounded-xl transition flex items-start gap-2.5 group cursor-pointer border-t border-slate-100"
                                    >
                                        <span className="text-base p-1.5 bg-emerald-100 rounded-lg text-emerald-700">🔲</span>
                                        <div>
                                            <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 flex items-center gap-1.5">
                                                <span>Vista Completa (6 por hoja)</span>
                                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-extrabold uppercase">Recomendado</span>
                                            </div>
                                            <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                                                6 supervisores / tarjetas por página (2 cols x 3 filas). Ahorro de papel sin cortes.
                                            </div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsPdfMenuOpen(false)
                                            handleExportarPdf('COMPLETO', 4)
                                        }}
                                        className="w-full text-left p-2.5 hover:bg-indigo-50 rounded-xl transition flex items-start gap-2.5 group cursor-pointer border-t border-slate-100"
                                    >
                                        <span className="text-base p-1.5 bg-indigo-100 rounded-lg text-indigo-700">📑</span>
                                        <div>
                                            <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">
                                                Vista Completa (4 por hoja)
                                            </div>
                                            <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                                                4 supervisores / tarjetas por página (2 cols x 2 filas), formato intermedio amplio.
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Cargar Masivamente Excel (Solo usuarios autorizados) */}
                        {data.canUpload && (
                            <button
                                type="button"
                                onClick={() => setIsUploadModalOpen(true)}
                                className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-md cursor-pointer"
                                title="Cargar planilla oficial reemplazando la nómina actual"
                            >
                                <UploadCloud className="w-4 h-4" />
                                <span>Carga Masiva Excel</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Banner de información de última carga */}
                {ultimaCarga && (
                    <div className="mt-5 pt-4 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-300 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-cyan-500/20 text-cyan-400">📂</span>
                            <span>Última planilla procesada: <strong>{ultimaCarga.nombreArchivo}</strong></span>
                            <span>•</span>
                            <span>Fecha: <strong>{ultimaCarga.fechaCarga}</strong></span>
                            <span>•</span>
                            <span>Cargado por: <strong>{ultimaCarga.cargadoPor}</strong></span>
                        </div>
                        <div className="text-cyan-400 font-mono font-bold">
                            Total Registros: {ultimaCarga.totalRegistros.toLocaleString('es-CL')} | {ultimaCarga.totalEmpleados.toLocaleString('es-CL')} colaboradores únicos
                        </div>
                    </div>
                )}
            </div>

            {/* CONTENEDOR VISUAL EXPORTABLE A PDF (KPIS Y ANALÍTICA) */}
            <div ref={fullContainerRef} className="space-y-6">
                {/* 8 TARJETAS DE KPIS EJECUTIVOS */}
                <div
                    ref={kpiContainerRef}
                    data-pdf-kpi="true"
                    className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4"
                >
                {/* 1. Total Documentos */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Documentos</span>
                        <FileText className="w-3.5 h-3.5 text-cyan-600" />
                    </span>
                    <p className="text-2xl font-extrabold text-slate-900 mt-2">{kpis.totalDocumentos.toLocaleString('es-CL')}</p>
                    <span className="text-[10px] text-slate-400 mt-1">Con firma pendiente</span>
                </div>

                {/* 2. Colaboradores Afectados */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Colaboradores</span>
                        <Users className="w-3.5 h-3.5 text-sky-600" />
                    </span>
                    <p className="text-2xl font-extrabold text-sky-700 mt-2">{kpis.totalEmpleados.toLocaleString('es-CL')}</p>
                    <span className="text-[10px] text-slate-400 mt-1">Personal único</span>
                </div>

                {/* 3. Supervisores Involucrados */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Supervisores</span>
                        <Shield className="w-3.5 h-3.5 text-indigo-600" />
                    </span>
                    <p className="text-2xl font-extrabold text-indigo-700 mt-2">{kpis.totalSupervisores.toLocaleString('es-CL')}</p>
                    <span className="text-[10px] text-slate-400 mt-1">A cargo del personal</span>
                </div>

                {/* 4. Colegios / RBDs */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Colegios (RBD)</span>
                        <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    </span>
                    <p className="text-2xl font-extrabold text-emerald-700 mt-2">{kpis.totalRbds.toLocaleString('es-CL')}</p>
                    <span className="text-[10px] text-slate-400 mt-1">Establecimientos</span>
                </div>

                {/* 5. Promedio Días Atraso */}
                <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-sm flex flex-col justify-between">
                    <span className="text-[10.5px] font-bold text-amber-700 uppercase tracking-wider flex items-center justify-between">
                        <span>Promedio Mora</span>
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                    </span>
                    <p className="text-2xl font-extrabold text-amber-700 mt-2">{kpis.promedioDiasAtraso.toLocaleString('es-CL')} <span className="text-xs font-normal">días</span></p>
                    <span className="text-[10px] text-amber-600 mt-1">Tiempo medio de atraso</span>
                </div>

                {/* 6. Críticos > 90 días */}
                <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-sm flex flex-col justify-between">
                    <span className="text-[10.5px] font-bold text-rose-700 uppercase tracking-wider flex items-center justify-between">
                        <span>Mora &gt; 90 Días</span>
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    </span>
                    <p className="text-2xl font-extrabold text-rose-700 mt-2">{kpis.totalCriticos90Dias.toLocaleString('es-CL')}</p>
                    <span className="text-[10px] text-rose-600 font-bold mt-1">{kpis.porcentajeCriticos}% del total general</span>
                </div>

                {/* 7. Firma Apoderado Lista (Si / No) */}
                <div className="bg-white p-4 rounded-2xl border border-sky-200 bg-sky-50/30 shadow-sm flex flex-col justify-between">
                    <span className="text-[10.5px] font-bold text-sky-800 uppercase tracking-wider flex items-center justify-between">
                        <span>Esp. Empleado</span>
                        <Check className="w-3.5 h-3.5 text-sky-600" />
                    </span>
                    <p className="text-2xl font-extrabold text-sky-800 mt-2">{kpis.totalFirmadoApoderado.toLocaleString('es-CL')}</p>
                    <span className="text-[10px] text-sky-700 mt-1">Apoderado ya firmó</span>
                </div>

                {/* 8. Sin Firmas */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <span className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                        <span>Sin Firmas</span>
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                    </span>
                    <p className="text-2xl font-extrabold text-slate-700 mt-2">{kpis.totalSinFirma.toLocaleString('es-CL')}</p>
                    <span className="text-[10px] text-slate-500 mt-1">Pendiente ambas partes</span>
                </div>
            </div>

            {/* SECCIÓN ANALÍTICA: NAVEGADOR DE GRÁFICOS INTERACTIVOS */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                        <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                            <span>📊 Analítica y Distribución de Firmas Pendientes</span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Selecciona una dimensión para analizar la concentración y criticidad de los documentos sin firmar.
                        </p>
                    </div>

                    {/* Switch de Vistas Analíticas */}
                    <div className="bg-slate-100 p-1 rounded-2xl flex items-center flex-wrap gap-1">
                        <button
                            type="button"
                            onClick={() => setActiveTabVisual('TOTALIZADOR')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                                activeTabVisual === 'TOTALIZADOR' ? 'bg-white text-cyan-800 shadow-sm ring-1 ring-cyan-200' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            🏢 Totalizador Zonas
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTabVisual('SUPERVISORES')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                                activeTabVisual === 'SUPERVISORES' ? 'bg-white text-cyan-800 shadow-sm ring-1 ring-cyan-200' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            🛡️ Top Supervisores
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTabVisual('SUCURSALES')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                                activeTabVisual === 'SUCURSALES' ? 'bg-white text-cyan-800 shadow-sm ring-1 ring-cyan-200' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            📍 Por Sucursal
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTabVisual('ESTABLECIMIENTOS')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                                activeTabVisual === 'ESTABLECIMIENTOS' ? 'bg-white text-cyan-800 shadow-sm ring-1 ring-cyan-200' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            🏫 Por Colegio (RBD)
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTabVisual('ANTIGUEDAD')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                                activeTabVisual === 'ANTIGUEDAD' ? 'bg-white text-cyan-800 shadow-sm ring-1 ring-cyan-200' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            ⏳ Semáforo de Mora
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTabVisual('TIPOLOGIA')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                                activeTabVisual === 'TIPOLOGIA' ? 'bg-white text-cyan-800 shadow-sm ring-1 ring-cyan-200' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            📑 Tipo de Documento
                        </button>
                    </div>
                </div>

                {/* SELECTOR DE SUCURSAL PARA ANÁLISIS POR SEDE */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-cyan-700 shrink-0" />
                        <div>
                            <span className="text-xs font-bold text-slate-800">Filtrar análisis por Sucursal:</span>
                            <span className="text-[11px] text-slate-500 ml-1.5 hidden sm:inline">
                                (Actualiza Top Supervisores, Colegios RBD, Semáforo y Documentos)
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => handleSelectSucursal('TODAS')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                filtroSucursal === 'TODAS'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            <span>Todas las Sucursales</span>
                        </button>
                        {data.sucursalesDisponibles.map(s => {
                            const isSelected = filtroSucursal === s
                            return (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => handleSelectSucursal(s)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                        isSelected
                                            ? 'bg-cyan-700 text-white shadow-sm'
                                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                                >
                                    <span>{s}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* VISTA 0: TOTALIZADOR GENERAL DE TODAS LAS ZONAS */}
                {activeTabVisual === 'TOTALIZADOR' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
                            <div>
                                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <span>🏢 Totalizador Comparativo por Zonas / Sedes</span>
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Resumen general de documentos totales, firmados por apoderado, cantidades pendientes y desglose por tipología según nivel de urgencia.
                                </p>
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-3">
                                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Firmado (Apoderado)
                                </span>
                                <span className="flex items-center gap-1 font-semibold text-slate-600">
                                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Falta por Firmar
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {graficos.totalizadorZonas.map(zona => {
                                const isSelected = filtroSucursal === zona.sucursal
                                return (
                                    <div
                                        key={zona.sucursal}
                                        data-pdf-card="true"
                                        className={`p-4 rounded-2xl border transition space-y-3 bg-white shadow-sm hover:shadow-md ${
                                            isSelected ? 'border-cyan-500 ring-2 ring-cyan-100' : 'border-slate-200'
                                        }`}
                                    >
                                        {/* Cabecera de la Zona */}
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                            <div>
                                                <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                                                    <Building2 className="w-4 h-4 text-cyan-600" />
                                                    <span>{zona.sucursal}</span>
                                                </h4>
                                                <span className="text-[10.5px] text-slate-500">{zona.empleados.toLocaleString('es-CL')} colaboradores únicos</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xl font-black text-slate-900 font-mono">{zona.total.toLocaleString('es-CL')}</span>
                                                <span className="text-[10px] text-slate-500 block uppercase font-bold">documentos</span>
                                            </div>
                                        </div>

                                        {/* Cantidades Firmadas vs Cantidades Pendientes */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-xs font-bold">
                                                <span className="text-emerald-700 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                    <span>Firmados:</span>
                                                    <strong className="font-mono">{zona.firmados.toLocaleString('es-CL')}</strong>
                                                </span>
                                                <span className="text-amber-800 flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                                                    <span>Faltan por Firmar:</span>
                                                    <strong className="font-mono text-slate-900">{zona.pendientes.toLocaleString('es-CL')}</strong>
                                                </span>
                                            </div>

                                            {/* Barra bicolor de estado de firma */}
                                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                                                <div
                                                    className="bg-emerald-500 h-full transition-all duration-500"
                                                    style={{ width: `${zona.porcentajeFirma}%` }}
                                                    title={`Firmados por Apoderado: ${zona.firmados} (${zona.porcentajeFirma}%)`}
                                                />
                                                <div
                                                    className="bg-slate-300 h-full transition-all duration-500 flex-1"
                                                    title={`Faltan por firmar: ${zona.pendientes} (${100 - zona.porcentajeFirma}%)`}
                                                />
                                            </div>
                                            <div className="text-[10px] text-right font-medium text-slate-500">
                                                {zona.porcentajeFirma}% con firma de apoderado completada
                                            </div>
                                        </div>

                                        {/* Desglose de Tipos de Documentos por Urgencia */}
                                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                                                Desglose por Tipo de Documento:
                                            </span>

                                            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                                <div className={`p-1.5 rounded-lg border flex items-center justify-between ${
                                                    zona.desgloseTipos.contratos > 0
                                                        ? 'bg-rose-50/80 border-rose-300 text-rose-900'
                                                        : 'bg-slate-50 border-slate-200 text-slate-500'
                                                }`}>
                                                    <span className="font-semibold text-[10.5px]">📑 Contratos / Anexos:</span>
                                                    <strong className="font-mono font-bold">{zona.desgloseTipos.contratos}</strong>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-amber-50/80 border border-amber-300/70 text-amber-900 flex items-center justify-between">
                                                    <span className="font-semibold text-[10.5px]">💰 Liquidaciones:</span>
                                                    <strong className="font-mono font-bold">{zona.desgloseTipos.liquidaciones}</strong>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-sky-50/80 border border-sky-300/70 text-sky-900 flex items-center justify-between">
                                                    <span className="font-semibold text-[10.5px]">🏖️ Vacaciones:</span>
                                                    <strong className="font-mono font-bold">{zona.desgloseTipos.vacaciones}</strong>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-between">
                                                    <span className="font-semibold text-[10.5px]">📢 Comunicados:</span>
                                                    <strong className="font-mono font-bold">{zona.desgloseTipos.informativos}</strong>
                                                </div>
                                            </div>
                                            {zona.desgloseTipos.otros > 0 && (
                                                <div className="text-[10px] text-slate-500 text-right pt-0.5">
                                                    + {zona.desgloseTipos.otros} manuales y procedimientos
                                                </div>
                                            )}
                                        </div>

                                        {/* Botón de acción rápida */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleSelectSucursal(zona.sucursal)
                                                setActiveTabVisual('SUPERVISORES')
                                            }}
                                            className="w-full mt-2 py-2 px-3 rounded-xl bg-slate-100 hover:bg-cyan-50 text-slate-700 hover:text-cyan-800 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200/80"
                                        >
                                            <span>Analizar Supervisores de {zona.sucursal}</span>
                                            <span>→</span>
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* VISTA 1: POR SUCURSAL */}
                {activeTabVisual === 'SUCURSALES' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
                            <div>
                                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <span>📍 Concentración de Firmas por Sucursal / Sede</span>
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Desglose por sede con estado de firmas (firmados vs pendientes) y separación por nivel de urgencia de documento.
                                </p>
                            </div>
                            <span className="text-xs font-mono font-bold text-cyan-700">
                                {graficos.porSucursal.length} sucursales activas
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {graficos.porSucursal.map(s => {
                                const isSelected = filtroSucursal === s.sucursal
                                return (
                                    <div
                                        key={s.sucursal}
                                        data-pdf-card="true"
                                        onClick={() => {
                                            handleSelectSucursal(s.sucursal)
                                            setActiveTabVisual('SUPERVISORES')
                                        }}
                                        className={`p-4 rounded-2xl border transition space-y-3 cursor-pointer group shadow-sm hover:shadow-md ${
                                            isSelected
                                                ? 'bg-cyan-50/80 border-cyan-400 ring-2 ring-cyan-100'
                                                : 'bg-white hover:border-cyan-300 border-slate-200'
                                        }`}
                                        title="Haz clic para analizar los supervisores y colegios de esta sucursal"
                                    >
                                        {/* Cabecera de la Sucursal */}
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                            <div>
                                                <span className="font-extrabold text-sm text-slate-900 group-hover:text-cyan-800 transition flex items-center gap-1.5">
                                                    <Building2 className="w-4 h-4 text-cyan-600" />
                                                    <span>{s.sucursal}</span>
                                                </span>
                                                <span className="text-[10px] text-slate-500 block mt-0.5">
                                                    {s.empleados.toLocaleString('es-CL')} colaboradores únicos
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-center gap-1.5 justify-end">
                                                    <span className="text-lg font-black text-slate-900 font-mono">{s.total.toLocaleString('es-CL')}</span>
                                                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-cyan-100 text-cyan-800">
                                                        {s.porcentaje}%
                                                    </span>
                                                </div>
                                                <span className="text-[9.5px] text-slate-400 font-medium">documentos</span>
                                            </div>
                                        </div>

                                        {/* Línea 1: Estado de Firmas (Firmados vs Por Firmar) */}
                                        <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1.5">
                                            <div className="flex items-center justify-between text-[11px] font-bold">
                                                <span className="text-emerald-700 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                    <span>Firmados (Apoderado):</span>
                                                    <strong className="font-mono">{s.firmados}</strong>
                                                </span>
                                                <span className="text-amber-800 flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                                                    <span>Faltan por Firmar:</span>
                                                    <strong className="font-mono text-slate-900">{s.pendientes}</strong>
                                                </span>
                                            </div>

                                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                                                <div
                                                    className="bg-emerald-500 h-full transition-all"
                                                    style={{ width: `${s.porcentajeFirma}%` }}
                                                    title={`Firmados: ${s.firmados} (${s.porcentajeFirma}%)`}
                                                />
                                                <div
                                                    className="bg-slate-300 h-full transition-all flex-1"
                                                    title={`Faltan por firmar: ${s.pendientes} (${100 - s.porcentajeFirma}%)`}
                                                />
                                            </div>
                                        </div>

                                        {/* Línea 2: Desglose por Tipos de Documentos según Urgencia */}
                                        <div className="space-y-1 pt-1">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                <span>Desglose por Urgencia:</span>
                                                <span className="text-cyan-600 group-hover:underline font-semibold">Ver analítica →</span>
                                            </div>

                                            <div className="flex items-center gap-1.5 flex-wrap text-[10.5px]">
                                                {/* Contratos / Anexos */}
                                                <span className={`px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 border ${
                                                    (s.desgloseTipos?.contratos || 0) > 0
                                                        ? 'bg-rose-50 text-rose-800 border-rose-200 font-extrabold'
                                                        : 'bg-slate-50 text-slate-400 border-slate-100'
                                                }`} title="Contratos y Anexos (Alta Urgencia Legal)">
                                                    <span>📑 Contratos:</span>
                                                    <strong className="font-mono">{s.desgloseTipos?.contratos || 0}</strong>
                                                </span>

                                                {/* Liquidaciones */}
                                                <span className={`px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 border ${
                                                    (s.desgloseTipos?.liquidaciones || 0) > 0
                                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                        : 'bg-slate-50 text-slate-400 border-slate-100'
                                                }`} title="Liquidaciones de Sueldo">
                                                    <span>💰 Liquidac:</span>
                                                    <strong className="font-mono">{s.desgloseTipos?.liquidaciones || 0}</strong>
                                                </span>

                                                {/* Vacaciones */}
                                                <span className={`px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 border ${
                                                    (s.desgloseTipos?.vacaciones || 0) > 0
                                                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                                                        : 'bg-slate-50 text-slate-400 border-slate-100'
                                                }`} title="Vacaciones y Permisos">
                                                    <span>🏖️ Vacaciones:</span>
                                                    <strong className="font-mono">{s.desgloseTipos?.vacaciones || 0}</strong>
                                                </span>

                                                {/* Informativos */}
                                                <span className={`px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1 border ${
                                                    (s.desgloseTipos?.informativos || 0) > 0
                                                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                                                        : 'bg-slate-50 text-slate-400 border-slate-100'
                                                }`} title="Comunicados e Informativos (Baja Urgencia)">
                                                    <span>📢 Informativos:</span>
                                                    <strong className="font-mono">{s.desgloseTipos?.informativos || 0}</strong>
                                                </span>

                                                {/* Otros */}
                                                {(s.desgloseTipos?.otros || 0) > 0 && (
                                                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold text-[10px]">
                                                        +{s.desgloseTipos.otros} otros
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* VISTA 2: TOP SUPERVISORES */}
                {activeTabVisual === 'SUPERVISORES' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div>
                                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <span>Top Supervisores</span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-cyan-100 text-cyan-800">
                                        {filtroSucursal === 'TODAS' ? 'Todas las Sucursales' : filtroSucursal}
                                    </span>
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Lista separada por líneas: estado de firmas (firmados vs pendientes) y desglose por tipología según nivel de urgencia.
                                </p>
                            </div>

                            {/* Filtros rápidos de prioridad de documentos para supervisores */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10.5px] font-bold text-slate-500 mr-1">Priorizar:</span>
                                <button
                                    type="button"
                                    onClick={() => setFiltroUrgenciaSup('TODOS')}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                                        filtroUrgenciaSup === 'TODOS' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Todos ({graficos.topSupervisores.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFiltroUrgenciaSup('CONTRATOS')}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                        filtroUrgenciaSup === 'CONTRATOS' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                                    }`}
                                    title="Priorizar supervisores con Contratos y Anexos urgentes"
                                >
                                    <span>🔴 Contratos</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFiltroUrgenciaSup('LIQUIDACIONES')}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                        filtroUrgenciaSup === 'LIQUIDACIONES' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                                    }`}
                                >
                                    <span>🟠 Liquidaciones</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFiltroUrgenciaSup('VACACIONES')}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                        filtroUrgenciaSup === 'VACACIONES' ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200'
                                    }`}
                                >
                                    <span>🔵 Vacaciones</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFiltroUrgenciaSup('INFORMATIVOS')}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                        filtroUrgenciaSup === 'INFORMATIVOS' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    <span>📢 Informativos</span>
                                </button>
                            </div>
                        </div>

                        {supervisoresMostrados.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs">
                                No se encontraron supervisores para los filtros seleccionados.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {supervisoresMostrados.map((sup, idx) => {
                                    const isSelected = filtroSupervisor === sup.supervisor
                                    return (
                                        <div
                                            key={sup.supervisor}
                                            data-pdf-card="true"
                                            onClick={() => handleFilterBySupervisor(sup.supervisor)}
                                            className={`p-4 rounded-2xl border transition space-y-3 cursor-pointer group ${
                                                isSelected
                                                    ? 'bg-cyan-50/70 border-cyan-400 shadow-sm ring-1 ring-cyan-200'
                                                    : 'bg-white border-slate-200 hover:border-cyan-300 hover:shadow-sm'
                                            }`}
                                            title="Clic para filtrar todos los documentos de este supervisor"
                                        >
                                            {/* Cabecera del Supervisor */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 ${
                                                        idx < 3 ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        #{idx + 1}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-cyan-700 transition truncate flex items-center gap-1.5">
                                                            <span>{sup.supervisor}</span>
                                                            {sup.sucursal && (
                                                                <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                                                    {sup.sucursal}
                                                                </span>
                                                            )}
                                                        </h4>
                                                        <span className="text-[10px] text-slate-400 block mt-0.5">
                                                            {sup.empleados} colaboradores asignados
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="text-base font-black text-cyan-800 font-mono">
                                                        {sup.total.toLocaleString('es-CL')}
                                                    </span>
                                                    <span className="text-[9.5px] text-slate-400 block font-semibold">docs</span>
                                                </div>
                                            </div>

                                            {/* LÍNEA 1: ESTADO DE FIRMAS (FIRMADOS VS POR FIRMAR) */}
                                            <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1.5">
                                                <div className="flex items-center justify-between text-[11px] font-bold">
                                                    <span className="text-emerald-700 flex items-center gap-1">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                        <span>Firmados (Apoderado):</span>
                                                        <strong className="font-mono">{sup.firmados}</strong>
                                                    </span>
                                                    <span className="text-amber-800 flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                                                        <span>Faltan por Firmar:</span>
                                                        <strong className="font-mono text-slate-900">{sup.pendientes}</strong>
                                                    </span>
                                                </div>

                                                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                                                    <div
                                                        className="bg-emerald-500 h-full transition-all"
                                                        style={{ width: `${sup.porcentajeFirma}%` }}
                                                        title={`Firmados: ${sup.firmados} (${sup.porcentajeFirma}%)`}
                                                    />
                                                    <div
                                                        className="bg-slate-300 h-full transition-all flex-1"
                                                        title={`Faltan por firmar: ${sup.pendientes} (${100 - sup.porcentajeFirma}%)`}
                                                    />
                                                </div>
                                            </div>

                                            {/* LÍNEA 2: SEPARACIÓN POR TIPOS DE DOCUMENTOS SEGÚN URGENCIA */}
                                            <div className="space-y-1 pt-1">
                                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    <span>Desglose por Urgencia:</span>
                                                    <span className="text-cyan-600 group-hover:underline font-semibold">Filtrar registros →</span>
                                                </div>

                                                <div className="flex items-center gap-1.5 flex-wrap text-[10.5px]">
                                                    {/* Contratos / Anexos (Alta Urgencia) */}
                                                    <span className={`px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 border ${
                                                        sup.desgloseTipos?.contratos > 0
                                                            ? 'bg-rose-50 text-rose-800 border-rose-200 font-extrabold'
                                                            : 'bg-slate-50 text-slate-400 border-slate-100'
                                                    }`} title="Contratos y Anexos (Alta Urgencia Legal)">
                                                        <span>📑 Contratos:</span>
                                                        <strong className="font-mono">{sup.desgloseTipos?.contratos || 0}</strong>
                                                    </span>

                                                    {/* Liquidaciones (Obligación laboral) */}
                                                    <span className={`px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 border ${
                                                        sup.desgloseTipos?.liquidaciones > 0
                                                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                            : 'bg-slate-50 text-slate-400 border-slate-100'
                                                    }`} title="Liquidaciones de Sueldo Mensuales">
                                                        <span>💰 Liquidac:</span>
                                                        <strong className="font-mono">{sup.desgloseTipos?.liquidaciones || 0}</strong>
                                                    </span>

                                                    {/* Vacaciones */}
                                                    <span className={`px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 border ${
                                                        sup.desgloseTipos?.vacaciones > 0
                                                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                                                            : 'bg-slate-50 text-slate-400 border-slate-100'
                                                    }`} title="Comprobantes de Vacaciones y Permisos">
                                                        <span>🏖️ Vacaciones:</span>
                                                        <strong className="font-mono">{sup.desgloseTipos?.vacaciones || 0}</strong>
                                                    </span>

                                                    {/* Informativos / Comunicados */}
                                                    <span className={`px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1 border ${
                                                        sup.desgloseTipos?.informativos > 0
                                                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                                                            : 'bg-slate-50 text-slate-400 border-slate-100'
                                                    }`} title="Comunicados e Informativos (Baja Urgencia)">
                                                        <span>📢 Informativos:</span>
                                                        <strong className="font-mono">{sup.desgloseTipos?.informativos || 0}</strong>
                                                    </span>

                                                    {/* Otros */}
                                                    {(sup.desgloseTipos?.otros || 0) > 0 && (
                                                        <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold text-[10px]">
                                                            +{sup.desgloseTipos.otros} otros
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* VISTA 3: POR ESTABLECIMIENTO (RBD) */}
                {activeTabVisual === 'ESTABLECIMIENTOS' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div>
                                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <span>Colegios y Establecimientos (RBD)</span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800">
                                        {filtroSucursal === 'TODAS' ? 'Todas las Sucursales' : filtroSucursal}
                                    </span>
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Lista separada por líneas: estado de firmas (firmados vs pendientes) y desglose por tipología según nivel de urgencia.
                                </p>
                            </div>

                            {/* Filtros rápidos de prioridad de documentos para colegios */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10.5px] font-bold text-slate-500 mr-1">Priorizar:</span>
                                <button
                                    type="button"
                                    onClick={() => setFiltroUrgenciaRbd('TODOS')}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                                        filtroUrgenciaRbd === 'TODOS' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Todos ({graficos.porRbd.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFiltroUrgenciaRbd('CONTRATOS')}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                        filtroUrgenciaRbd === 'CONTRATOS' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                                    }`}
                                    title="Priorizar colegios con Contratos y Anexos urgentes"
                                >
                                    <span>🔴 Contratos</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFiltroUrgenciaRbd('LIQUIDACIONES')}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                        filtroUrgenciaRbd === 'LIQUIDACIONES' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                                    }`}
                                    title="Priorizar colegios con Liquidaciones de sueldo pendientes"
                                >
                                    <span>🟠 Liquidaciones</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFiltroUrgenciaRbd('VACACIONES')}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                        filtroUrgenciaRbd === 'VACACIONES' ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200'
                                    }`}
                                    title="Priorizar colegios con Vacaciones y Permisos"
                                >
                                    <span>🔵 Vacaciones</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFiltroUrgenciaRbd('INFORMATIVOS')}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                        filtroUrgenciaRbd === 'INFORMATIVOS' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                                    }`}
                                    title="Priorizar colegios con Comunicados e Informativos"
                                >
                                    <span>📢 Informativos</span>
                                </button>
                            </div>
                        </div>

                        {rbdsMostrados.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs">
                                No se encontraron colegios asociados al filtro o perfil actual.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                {rbdsMostrados.map(r => (
                                    <div
                                        key={r.rbd}
                                        data-pdf-card="true"
                                        onClick={() => handleFilterByRbd(r.rbd)}
                                        className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group space-y-3"
                                        title={`Clic para ver todos los documentos del RBD ${r.rbd} en la tabla de detalle`}
                                    >
                                        {/* CABECERA: RBD + ESTABLECIMIENTO + SUCURSAL */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-mono text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                        RBD {r.rbd}
                                                    </span>
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                                        {r.sucursal}
                                                    </span>
                                                </div>
                                                <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition truncate mt-1" title={r.establecimiento}>
                                                    {r.establecimiento}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="text-xs font-black text-slate-800 font-mono block">
                                                    {r.total} <span className="text-[10px] font-normal text-slate-500">docs</span>
                                                </span>
                                                <span className="text-[10px] text-slate-400 block font-medium">
                                                    {r.empleados} colabs
                                                </span>
                                            </div>
                                        </div>

                                        {/* LÍNEA 1: ESTADO DE FIRMAS (FIRMADOS APODERADO VS FALTAN POR FIRMAR + BARRA DE AVANCE) */}
                                        <div className="bg-slate-50 rounded-xl p-2 border border-slate-100 space-y-1.5">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-emerald-700 font-bold flex items-center gap-1">
                                                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                                                    Firmados: <strong className="font-mono">{r.firmados || 0}</strong>
                                                </span>
                                                <span className="text-slate-600 font-medium flex items-center gap-1">
                                                    <span className="inline-block w-2 h-2 rounded-full bg-slate-300"></span>
                                                    Faltan: <strong className="font-mono text-slate-800">{r.pendientes || 0}</strong>
                                                </span>
                                                <span className="font-mono font-extrabold text-[10.5px] text-emerald-800 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                                                    {r.porcentajeFirma || 0}%
                                                </span>
                                            </div>
                                            {/* Barra de progreso de firma */}
                                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex shadow-inner">
                                                <div
                                                    className="bg-emerald-500 h-full transition-all"
                                                    style={{ width: `${r.porcentajeFirma}%` }}
                                                    title={`Firmados: ${r.firmados} (${r.porcentajeFirma}%)`}
                                                />
                                                <div
                                                    className="bg-slate-300 h-full transition-all flex-1"
                                                    title={`Faltan por firmar: ${r.pendientes} (${100 - r.porcentajeFirma}%)`}
                                                />
                                            </div>
                                        </div>

                                        {/* LÍNEA 2: SEPARACIÓN POR TIPOS DE DOCUMENTOS SEGÚN URGENCIA */}
                                        <div className="space-y-1 pt-0.5">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                <span>Desglose por Urgencia:</span>
                                                <span className="text-emerald-600 group-hover:underline font-semibold">Filtrar registros →</span>
                                            </div>

                                            <div className="flex items-center gap-1.5 flex-wrap text-[10.5px]">
                                                {/* Contratos / Anexos (Alta Urgencia) */}
                                                <span className={`px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 border ${
                                                    r.desgloseTipos?.contratos > 0
                                                        ? 'bg-rose-50 text-rose-800 border-rose-200 font-extrabold'
                                                        : 'bg-slate-50 text-slate-400 border-slate-100'
                                                }`} title="Contratos y Anexos (Alta Urgencia Legal)">
                                                    <span>📑 Contratos:</span>
                                                    <strong className="font-mono">{r.desgloseTipos?.contratos || 0}</strong>
                                                </span>

                                                {/* Liquidaciones (Obligación laboral) */}
                                                <span className={`px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 border ${
                                                    r.desgloseTipos?.liquidaciones > 0
                                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                        : 'bg-slate-50 text-slate-400 border-slate-100'
                                                }`} title="Liquidaciones de Sueldo Mensuales">
                                                    <span>💰 Liquidac:</span>
                                                    <strong className="font-mono">{r.desgloseTipos?.liquidaciones || 0}</strong>
                                                </span>

                                                {/* Vacaciones */}
                                                <span className={`px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 border ${
                                                    r.desgloseTipos?.vacaciones > 0
                                                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                                                        : 'bg-slate-50 text-slate-400 border-slate-100'
                                                }`} title="Comprobantes de Vacaciones y Permisos">
                                                    <span>🏖️ Vacaciones:</span>
                                                    <strong className="font-mono">{r.desgloseTipos?.vacaciones || 0}</strong>
                                                </span>

                                                {/* Informativos / Comunicados */}
                                                <span className={`px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1 border ${
                                                    r.desgloseTipos?.informativos > 0
                                                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                                                        : 'bg-slate-50 text-slate-400 border-slate-100'
                                                }`} title="Comunicados e Informativos (Baja Urgencia)">
                                                    <span>📢 Informativos:</span>
                                                    <strong className="font-mono">{r.desgloseTipos?.informativos || 0}</strong>
                                                </span>

                                                {/* Otros */}
                                                {(r.desgloseTipos?.otros || 0) > 0 && (
                                                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold text-[10px]">
                                                        +{r.desgloseTipos.otros} otros
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* VISTA 4: SEMÁFORO DE ANTIGÜEDAD Y DÍAS DE MORA */}
                {activeTabVisual === 'ANTIGUEDAD' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
                            <div>
                                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <span>Semáforo de Mora y Días de Atraso</span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800">
                                        {filtroSucursal === 'TODAS' ? 'Todas las Sucursales' : filtroSucursal}
                                    </span>
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Distribución de criticidad temporal en la sucursal seleccionada.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            {graficos.porAntiguedad.map(ant => (
                                <div key={ant.tramo} data-pdf-card="true" className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2 flex flex-col justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ant.color }} />
                                        <span className="text-xs font-bold text-slate-800">{ant.label}</span>
                                    </div>
                                    <p className="text-2xl font-black text-slate-900">{ant.total.toLocaleString('es-CL')}</p>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${ant.porcentaje}%`, backgroundColor: ant.color }} />
                                    </div>
                                    <span className="text-[10.5px] font-mono text-slate-500 font-bold">{ant.porcentaje}% de la cartera</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* VISTA 5: TIPOLOGÍA DE DOCUMENTO Y ESTADO DE FIRMA */}
                {activeTabVisual === 'TIPOLOGIA' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
                            <div>
                                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <span>Tipología y Estado de Documentos</span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-indigo-100 text-indigo-800">
                                        {filtroSucursal === 'TODAS' ? 'Todas las Sucursales' : filtroSucursal}
                                    </span>
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Desglose por contrato, anexo, liquidación y estado de firma en la sucursal seleccionada.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-8 space-y-3">
                                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Top Tipos de Documentos</h3>
                                <div className="space-y-2.5">
                                    {graficos.porTipoDocumento.map(t => (
                                        <div key={t.tipoDocumento} data-pdf-card="true" className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
                                                    <span className="truncate">{t.tipoDocumento}</span>
                                                    <span className="font-mono text-cyan-700">{t.total.toLocaleString('es-CL')} docs ({t.porcentaje}%)</span>
                                                </div>
                                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                                    <div className="bg-cyan-600 h-full rounded-full" style={{ width: `${t.porcentaje}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="lg:col-span-4 space-y-3">
                                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Estado de Firma (Apoderado vs Empleado)</h3>
                                <div className="space-y-3">
                                    {graficos.porEstadoFirma.map(e => (
                                        <div key={e.estado} data-pdf-card="true" className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                                                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                                                <span>{e.label}</span>
                                            </div>
                                            <div className="text-2xl font-black text-slate-900">
                                                {e.total.toLocaleString('es-CL')} <span className="text-xs font-normal text-slate-500">docs ({e.porcentaje}%)</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                </div>
            </div>

            {/* BARRA DE FILTROS MULTIFACÉTICOS */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
                    {/* Búsqueda por texto */}
                    <div className="lg:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Búsqueda General
                        </label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="RUT, Colaborador, Supervisor..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                            />
                        </div>
                    </div>

                    {/* Filtro Sucursal */}
                    <div className="lg:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Sucursal
                        </label>
                        <select
                            value={filtroSucursal}
                            onChange={e => handleSelectSucursal(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                        >
                            <option value="TODAS">Todas las Sucursales</option>
                            {data.sucursalesDisponibles.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Supervisor */}
                    <div className="lg:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                            <span>Supervisor</span>
                            {filtroSucursal !== 'TODAS' && (
                                <span className="text-[10px] text-cyan-600 font-semibold">({filtroSucursal})</span>
                            )}
                        </label>
                        <select
                            value={filtroSupervisor}
                            onChange={e => setFiltroSupervisor(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 truncate"
                        >
                            <option value="TODOS">Todos los Supervisores</option>
                            {supervisoresFiltrados.map(sup => (
                                <option key={sup.nombre} value={sup.nombre}>
                                    {sup.nombre} {sup.sucursales && sup.sucursales.length > 0 ? `(${sup.sucursales.join(', ')})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Tipo Documento */}
                    <div className="lg:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Tipo Documento
                        </label>
                        <select
                            value={filtroTipoDoc}
                            onChange={e => setFiltroTipoDoc(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 truncate"
                        >
                            <option value="TODOS">Todos los Tipos</option>
                            {data.tiposDocumentoDisponibles.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Antigüedad */}
                    <div className="lg:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Días de Atraso
                        </label>
                        <select
                            value={filtroTramo}
                            onChange={e => setFiltroTramo(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                        >
                            <option value="TODOS">Cualquier Antigüedad</option>
                            <option value="0-30">0 a 30 días</option>
                            <option value="31-60">31 a 60 días</option>
                            <option value="61-90">61 a 90 días</option>
                            <option value="91-180">91 a 180 días</option>
                            <option value="181-365">181 a 365 días</option>
                            <option value=">365">Más de 1 año</option>
                        </select>
                    </div>

                    {/* Botones Filtrar y Limpiar */}
                    <div className="lg:col-span-1 flex items-center gap-1.5">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                            Filtrar
                        </button>
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            disabled={isPending}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                            title="Limpiar todos los filtros"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </form>
            </div>

            {/* TABLA PRINCIPAL DE REGISTROS DE FIRMAS PENDIENTES */}
            <div id="tabla-firmas-detalle" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-6">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">
                            Mostrando <strong className="text-cyan-700">{data.registros.length}</strong> de <strong className="text-slate-900">{data.totalRegistros.toLocaleString('es-CL')}</strong> documentos
                        </span>
                        {isPending && <span className="text-xs text-cyan-600 animate-pulse font-medium">Actualizando...</span>}
                    </div>

                    {/* Selector de tamaño de página */}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Filas por página:</span>
                        {[5, 10, 15, 25, 50].map(sz => (
                            <button
                                key={sz}
                                type="button"
                                onClick={() => {
                                    setPageSize(sz)
                                    fetchData(1, sz, sortBy, sortOrder)
                                }}
                                className={`px-2 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                                    pageSize === sz ? 'bg-cyan-100 text-cyan-800 font-extrabold ring-1 ring-cyan-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {sz}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                        <thead>
                            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10.5px]">
                                <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('diasAtraso')}>
                                    <div className="flex items-center gap-1">
                                        <span>Mora</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('empleadoNombre')}>
                                    <div className="flex items-center gap-1">
                                        <span>Colaborador</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('rbd')}>
                                    <div className="flex items-center gap-1">
                                        <span>RBD / Establecimiento</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('sucursal')}>
                                    <div className="flex items-center gap-1">
                                        <span>Sucursal</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('supervisorNombre')}>
                                    <div className="flex items-center gap-1">
                                        <span>Supervisor</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('tipoDocumento')}>
                                    <div className="flex items-center gap-1">
                                        <span>Documento</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th className="py-3 px-3 text-center">Estado Firma</th>
                                <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('fechaEmision')}>
                                    <div className="flex items-center gap-1">
                                        <span>Emisión / Inicio</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th className="py-3 px-3">Apoderado Hendaya</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {data.registros.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-slate-400">
                                        <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                        <p className="font-bold text-slate-700">No se encontraron documentos con firma pendiente</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Prueba cambiando o limpiando los filtros aplicados.</p>
                                    </td>
                                </tr>
                            ) : (
                                data.registros.map(r => {
                                    // Badge de mora semafórico
                                    let badgeMoraClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    if (r.diasAtraso > 365) badgeMoraClass = 'bg-pink-100 text-pink-900 border-pink-300 font-black'
                                    else if (r.diasAtraso > 180) badgeMoraClass = 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold'
                                    else if (r.diasAtraso > 90) badgeMoraClass = 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
                                    else if (r.diasAtraso > 60) badgeMoraClass = 'bg-orange-50 text-orange-700 border-orange-200 font-bold'
                                    else if (r.diasAtraso > 30) badgeMoraClass = 'bg-amber-50 text-amber-700 border-amber-200'

                                    const isFirmadoApoderado = r.documentoFirmado.toLowerCase().includes('si / no')

                                    return (
                                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                                            {/* Días Mora */}
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${badgeMoraClass}`}>
                                                    {r.diasAtraso} días
                                                </span>
                                            </td>

                                            {/* Colaborador */}
                                            <td className="py-2.5 px-3">
                                                <div className="font-extrabold text-slate-900 truncate max-w-[170px]" title={r.empleadoNombre}>
                                                    {r.empleadoNombre}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="font-mono text-[10px] text-cyan-800 font-semibold">{r.empleadoRut}</span>
                                                    {r.cargo && <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={r.cargo}>• {r.cargo}</span>}
                                                </div>
                                            </td>

                                            {/* RBD / Establecimiento */}
                                            <td className="py-2.5 px-3">
                                                <div className="font-bold text-slate-800">
                                                    {r.rbd > 0 ? `RBD ${r.rbd}` : '-'}
                                                </div>
                                                <div className="text-[10px] text-slate-500 truncate max-w-[170px]" title={r.establecimiento}>
                                                    {r.establecimiento}
                                                </div>
                                            </td>

                                            {/* Sucursal */}
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <span className="text-xs font-semibold text-slate-700">{r.sucursal}</span>
                                            </td>

                                            {/* Supervisor */}
                                            <td className="py-2.5 px-3">
                                                <div className="font-semibold text-slate-900 truncate max-w-[160px]" title={r.supervisorNombre}>
                                                    {r.supervisorNombre || <span className="text-slate-400 italic">Sin supervisor</span>}
                                                </div>
                                            </td>

                                            {/* Documento y Detalle */}
                                            <td className="py-2.5 px-3">
                                                <div className="font-bold text-slate-900 truncate max-w-[180px]" title={r.tipoDocumento}>
                                                    {r.tipoDocumento}
                                                </div>
                                                {r.detalle && (
                                                    <div className="text-[10px] text-slate-500 truncate max-w-[180px]" title={r.detalle}>
                                                        {r.detalle}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Estado Firma */}
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                {isFirmadoApoderado ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                                                        <Check className="w-3 h-3 text-sky-600" />
                                                        <span>Esperando Empleado</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                        <span>Sin firmas</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* Emisión e Inicio */}
                                            <td className="py-2.5 px-3 text-[10.5px] whitespace-nowrap text-slate-600">
                                                <div>Emi: {r.fechaEmision || '-'}</div>
                                                {r.fechaInicioFirma && <div className="text-[10px] text-slate-400">Ini: {r.fechaInicioFirma}</div>}
                                            </td>

                                            {/* Apoderado 1 */}
                                            <td className="py-2.5 px-3">
                                                <div className="font-medium text-slate-800 truncate max-w-[150px]" title={r.nombreApoderado1}>
                                                    {r.nombreApoderado1 || '-'}
                                                </div>
                                                {r.fechaFirmaApoderado1 && (
                                                    <div className="text-[10px] text-emerald-700 font-semibold">
                                                        ✓ {r.fechaFirmaApoderado1}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINACIÓN */}
                <div className="p-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3 text-xs text-slate-600">
                    <div>
                        Página <strong className="text-slate-900">{data.page}</strong> de <strong className="text-slate-900">{data.totalPages}</strong>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => fetchData(page - 1)}
                            disabled={page <= 1 || isPending}
                            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4 text-slate-600" />
                        </button>
                        <span className="font-bold text-slate-800 px-2">{page}</span>
                        <button
                            type="button"
                            onClick={() => fetchData(page + 1)}
                            disabled={page >= data.totalPages || isPending}
                            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAL DE CARGA MASIVA DE EXCEL */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-cyan-100 text-cyan-800 rounded-xl">
                                    <UploadCloud className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-base text-slate-900">Carga Masiva de Firmas Pendientes</h3>
                                    <p className="text-xs text-slate-500">Recursos Humanos · Actualización de Nómina</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsUploadModalOpen(false)
                                    setUploadError(null)
                                    setUploadSuccess(null)
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Alerta de regla de reemplazo total */}
                        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-800">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="leading-relaxed">
                                <strong>Regla de Actualización:</strong> Al procesar este archivo, el sistema <strong>reemplazará en su totalidad</strong> los registros anteriores con la nueva fotografía oficial. No se conservan históricos.
                            </div>
                        </div>

                        <form onSubmit={handleUploadSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                    Seleccionar Archivo Excel (.xlsx, .xls)
                                </label>
                                <div className="border-2 border-dashed border-slate-200 hover:border-cyan-500 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50/50 hover:bg-cyan-50/20">
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls"
                                        id="excel-file-input"
                                        onChange={e => {
                                            if (e.target.files && e.target.files[0]) {
                                                setSelectedFile(e.target.files[0])
                                            }
                                        }}
                                        className="hidden"
                                    />
                                    <label htmlFor="excel-file-input" className="cursor-pointer space-y-2 block">
                                        <FileSpreadsheet className="w-10 h-10 mx-auto text-cyan-600" />
                                        {selectedFile ? (
                                            <div>
                                                <p className="font-extrabold text-slate-900 text-sm">{selectedFile.name}</p>
                                                <p className="text-xs text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="font-bold text-slate-800 text-xs">Haz clic para buscar o arrastra tu archivo aquí</p>
                                                <p className="text-[11px] text-slate-400 mt-0.5">Planilla oficial con formato Documentos con firma pendiente.xlsx</p>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </div>

                            {/* Mensajes de feedback */}
                            {uploadError && (
                                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                    <span>{uploadError}</span>
                                </div>
                            )}

                            {uploadSuccess && (
                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>{uploadSuccess}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsUploadModalOpen(false)}
                                    disabled={isPending}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!selectedFile || isPending}
                                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                                >
                                    {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />}
                                    <span>{isPending ? 'Procesando planilla...' : 'Cargar y Reemplazar'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Notificación flotante de exportación a PDF */}
            {pdfFeedback && (
                <div className="fixed bottom-5 right-5 z-50 bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-cyan-500/40 text-xs backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
                    <span className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-400 text-sm">
                        {isExportingPdf ? '⏳' : '✅'}
                    </span>
                    <div>
                        <div className="font-bold text-slate-100">Exportación a PDF Oficial Hendaya</div>
                        <div className="text-slate-300 text-[11px]">{pdfFeedback}</div>
                    </div>
                </div>
            )}
        </div>
    )
}

