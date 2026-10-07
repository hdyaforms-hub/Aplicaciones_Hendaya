'use client'

import React, { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, ComposedChart, PieChart, Pie, Cell
} from 'recharts'
import * as XLSX from 'xlsx'
import {
    getTableroResolucionSanitariaData,
    getRbdHistoricalTimeline,
    auditExportExcel,
    TableroFiltros,
    RbdMatrizItem,
    YearEvolution,
    SucursalBreakdown,
    InstitucionBreakdown
} from './actions'

type InitialData = Awaited<ReturnType<typeof getTableroResolucionSanitariaData>>

interface Props {
    initialData: InitialData
}

const COLORS = {
    si: '#10b981',       // emerald-500
    no: '#ef4444',       // rose-500
    noAplica: '#9ca3af', // gray-400
    line: '#0284c7',     // sky-600
    conDoc: '#0ea5e9',   // sky-500
    sinDoc: '#f59e0b',   // amber-500
    piePalette: ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6']
}

export default function TableroResolucionSanitariaClient({ initialData }: Props) {
    const [data, setData] = useState<InitialData>(initialData)
    const [isPending, startTransition] = useTransition()

    // Filtros
    const [selectedSucursal, setSelectedSucursal] = useState<string>('')
    const [selectedInstitucion, setSelectedInstitucion] = useState<string>('')
    const [selectedLicitacion, setSelectedLicitacion] = useState<string>('')
    const [selectedUt, setSelectedUt] = useState<string>('')
    // Filtro inteligente y autocompletado RBD o Nombre
    const [searchTerm, setSearchTerm] = useState<string>('')
    const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false)
    const searchContainerRef = useRef<HTMLDivElement>(null)

    // Catálogo maestro de establecimientos para que el autocompletado siempre tenga el universo completo
    const masterEstablecimientosRef = useRef<any[]>(initialData.filterOptions.establecimientos || [])
    if (masterEstablecimientosRef.current.length === 0 && (data.filterOptions.establecimientos?.length || 0) > 0) {
        masterEstablecimientosRef.current = data.filterOptions.establecimientos || []
    }

    // Cierre automático del dropdown al hacer clic fuera del componente
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsSearchDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Sugerencias de autocompletado calculadas en tiempo real
    const searchSuggestions = useMemo(() => {
        const query = searchTerm.trim().toLowerCase()
        if (!query) return []

        const sourceList = masterEstablecimientosRef.current.length > 0
            ? masterEstablecimientosRef.current
            : (data.filterOptions.establecimientos || [])

        return sourceList.filter((item: any) => {
            const rbdStr = item.rbd.toString()
            const nombre = (item.nombreEstablecimiento || '').toLowerCase()
            const comuna = (item.comuna || '').toLowerCase()
            return rbdStr.includes(query) || nombre.includes(query) || comuna.includes(query)
        }).slice(0, 10)
    }, [searchTerm, data.filterOptions.establecimientos])

    const [selectedComportamiento, setSelectedComportamiento] = useState<string>('ALL')
    const [selectedAnioRef, setSelectedAnioRef] = useState<number | ''>('')

    // Paginación de la tabla
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [itemsPerPage, setItemsPerPage] = useState<number>(15)

    // Modal Inspector Histórico
    const [inspectingRbd, setInspectingRbd] = useState<RbdMatrizItem | null>(null)
    const [historicalRecords, setHistoricalRecords] = useState<any[]>([])
    const [loadingTimeline, setLoadingTimeline] = useState<boolean>(false)

    // Función para recargar datos desde el servidor con los filtros actuales
    const handleApplyFilters = (overrideParams?: Partial<TableroFiltros>) => {
        setIsSearchDropdownOpen(false)
        startTransition(async () => {
            try {
                const params: TableroFiltros = {
                    sucursal: overrideParams?.sucursal !== undefined ? overrideParams.sucursal : (selectedSucursal || undefined),
                    institucion: overrideParams?.institucion !== undefined ? overrideParams.institucion : (selectedInstitucion || undefined),
                    licitacion: overrideParams?.licitacion !== undefined ? overrideParams.licitacion : (selectedLicitacion || undefined),
                    ut: overrideParams?.ut !== undefined ? overrideParams.ut : (selectedUt ? Number(selectedUt) : undefined),
                    search: overrideParams?.search !== undefined ? overrideParams.search : (searchTerm || undefined),
                    comportamiento: overrideParams?.comportamiento !== undefined ? overrideParams.comportamiento : (selectedComportamiento !== 'ALL' ? selectedComportamiento : undefined),
                    anioRef: overrideParams?.anioRef !== undefined ? overrideParams.anioRef : (selectedAnioRef ? Number(selectedAnioRef) : undefined)
                }

                const result = await getTableroResolucionSanitariaData(params)
                setData(result)
                setCurrentPage(1)
            } catch (err: any) {
                console.error('Error aplicando filtros:', err)
                alert(err?.message || 'Error al cargar los datos del tablero')
            }
        })
    }

    const handleSelectSuggestion = (item: any) => {
        setSearchTerm(String(item.rbd))
        setIsSearchDropdownOpen(false)
        handleApplyFilters({ search: String(item.rbd) })
    }

    const handleClearSearch = () => {
        setSearchTerm('')
        setIsSearchDropdownOpen(false)
        handleApplyFilters({ search: '' })
    }

    const handleResetFilters = () => {
        setSelectedSucursal('')
        setSelectedInstitucion('')
        setSelectedLicitacion('')
        setSelectedUt('')
        setSearchTerm('')
        setSelectedComportamiento('ALL')
        setSelectedAnioRef('')

        startTransition(async () => {
            const result = await getTableroResolucionSanitariaData({})
            setData(result)
            setCurrentPage(1)
        })
    }

    // Abrir modal de inspección histórica de un RBD
    const handleInspectRbd = async (item: RbdMatrizItem) => {
        setInspectingRbd(item)
        setLoadingTimeline(true)
        try {
            const history = await getRbdHistoricalTimeline(item.rbd)
            setHistoricalRecords(history)
        } catch (err) {
            console.error('Error al consultar historial del RBD:', err)
        } finally {
            setLoadingTimeline(false)
        }
    }

    // Exportar a Excel con formato completo y auditoría
    const handleExportExcel = async () => {
        try {
            const workbook = XLSX.utils.book_new()

            // Hoja 1: Evolución General Multianual
            const evolucionSheetData = data.evolution.map(e => ({
                'Año': e.anio,
                'Total RBDs': e.total,
                'Con Resolución (SI)': e.conResolucion,
                'Sin Resolución (NO)': e.sinResolucion,
                'No Aplica': e.noAplica,
                '% Cumplimiento': `${e.porcentajeCumplimiento.toFixed(1)}%`,
                'Con Respaldo Documental': e.conDocumento,
                'Sin Respaldo Digital': e.sinDocumento,
                '% Cobertura Documentos': `${e.porcentajeDocumental.toFixed(1)}%`
            }))
            const wsEvolucion = XLSX.utils.json_to_sheet(evolucionSheetData)
            XLSX.utils.book_append_sheet(workbook, wsEvolucion, 'Evolucion_Multianual')

            // Hoja 2: Matriz Detallada de RBDs y comportamiento
            const matrizSheetData = data.matrix.map(item => {
                const row: Record<string, any> = {
                    'RBD': item.rbd,
                    'DV': item.rbdDv || '',
                    'Establecimiento': item.nombreEstablecimiento,
                    'Comuna': item.comuna,
                    'Sucursal': item.sucursal || 'Sin Asignar',
                    'Institución': item.institucion,
                    'UT': item.ut,
                    'Licitación': item.licitacion || '',
                    'Comportamiento Histórico': item.comportamiento
                }

                data.years.forEach(yr => {
                    const yearRec = item.aniosData[yr]
                    row[`${yr} - Estado`] = yearRec?.estadoResolucion || 'Sin Registro'
                    row[`${yr} - N° Res.`] = yearRec?.numeroResolucion || ''
                    row[`${yr} - Fecha Res.`] = yearRec?.fechaResolucion ? new Date(yearRec.fechaResolucion).toLocaleDateString('es-CL') : ''
                    row[`${yr} - Tiene Doc`] = yearRec?.documentoUrl ? 'SI' : 'NO'
                    row[`${yr} - Subido Por`] = yearRec?.documentoSubidoPor || ''
                })

                return row
            })
            const wsMatriz = XLSX.utils.json_to_sheet(matrizSheetData)
            XLSX.utils.book_append_sheet(workbook, wsMatriz, 'Matriz_RBD_Comportamiento')

            // Hoja 3: Cumplimiento por Sucursal
            const sucursalSheetData = data.sucursalBreakdown.map(s => ({
                'Sucursal': s.sucursal,
                'Total RBDs': s.total,
                'Con Resolución': s.conResolucion,
                'Sin Resolución': s.sinResolucion,
                'No Aplica': s.noAplica,
                '% Cumplimiento': `${s.porcentajeCumplimiento.toFixed(1)}%`,
                'Con Documento Digital': s.conDocumento
            }))
            const wsSucursales = XLSX.utils.json_to_sheet(sucursalSheetData)
            XLSX.utils.book_append_sheet(workbook, wsSucursales, 'Por_Sucursal')

            const filename = `Tablero_Resolucion_Sanitaria_Hendaya_${new Date().toISOString().slice(0, 10)}.xlsx`
            XLSX.writeFile(workbook, filename)

            // Registrar en auditoría
            await auditExportExcel(`Filtros: Sucursal=${selectedSucursal || 'Todas'}, Institución=${selectedInstitucion || 'Todas'}, Comportamiento=${selectedComportamiento}, Total RBDs exportados=${data.matrix.length}`)
        } catch (err) {
            console.error('Error exportando Excel:', err)
            alert('Ocurrió un error al generar la exportación a Excel')
        }
    }

    // Datos paginados de la matriz
    const totalPages = Math.ceil(data.matrix.length / itemsPerPage)
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return data.matrix.slice(start, start + itemsPerPage)
    }, [data.matrix, currentPage, itemsPerPage])

    // Estadísticas del año de referencia analizado
    const currentYearStats = useMemo(() => {
        const found = data.evolution.find(e => e.anio === data.yearToInspect)
        return found || data.evolution[data.evolution.length - 1] || {
            anio: data.yearToInspect,
            total: 0,
            conResolucion: 0,
            sinResolucion: 0,
            noAplica: 0,
            porcentajeCumplimiento: 0,
            conDocumento: 0,
            sinDocumento: 0,
            porcentajeDocumental: 0
        }
    }, [data.evolution, data.yearToInspect])

    // Helper de estilo para el badge de comportamiento
    const getComportamientoBadge = (comportamiento: RbdMatrizItem['comportamiento']) => {
        switch (comportamiento) {
            case 'MEJORA':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <span>🚀</span> Mejora
                    </span>
                )
            case 'ALERTA':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                        <span>⚠️</span> Alerta
                    </span>
                )
            case 'SOSTENIDO':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                        <span>✅</span> Sostenido
                    </span>
                )
            case 'SIN_RESOLUCION':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        <span>❌</span> Sin Res.
                    </span>
                )
            case 'NO_APLICA':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                        <span>⚪</span> No Aplica
                    </span>
                )
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        Variable
                    </span>
                )
        }
    }

    return (
        <div className="space-y-6">
            {/* ENCABEZADO Y ACCIONES PRINCIPALES */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-50 text-cyan-700 font-black text-xl shadow-inner">
                            🩺
                        </span>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                                Tablero Resoluciones Sanitarias
                            </h1>
                            <p className="text-sm text-gray-500">
                                Monitoreo y comportamiento histórico de establecimientos (RBD) a lo largo de los años
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
                    {/* Selector de Año de Referencia */}
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-sm">
                        <span className="text-gray-500 font-medium">Año Ref:</span>
                        <select
                            value={selectedAnioRef || data.yearToInspect}
                            onChange={(e) => {
                                const newYear = Number(e.target.value)
                                setSelectedAnioRef(newYear)
                                handleApplyFilters({ anioRef: newYear })
                            }}
                            className="bg-transparent font-bold text-gray-800 focus:outline-none cursor-pointer"
                        >
                            {data.years.map(yr => (
                                <option key={yr} value={yr}>{yr}</option>
                            ))}
                        </select>
                    </div>

                    {/* Botón Exportar Excel */}
                    <button
                        onClick={handleExportExcel}
                        disabled={isPending || data.matrix.length === 0}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50"
                        title="Exportar datos a planilla Excel (registrado en auditoría)"
                    >
                        <span>📊</span>
                        <span>Exportar a Excel</span>
                    </button>
                </div>
            </div>

            {/* TARJETAS EJECUTIVAS KPI */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* 1. Total RBDs */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase text-gray-400">Total RBDs</p>
                        <span className="text-gray-400 text-lg">🏫</span>
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 mt-2">{data.matrix.length.toLocaleString()}</h3>
                    <p className="text-xs text-gray-500 mt-1">Registros evaluados</p>
                </div>

                {/* 2. % Cumplimiento Global Año */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase text-emerald-600">Cumplimiento ({data.yearToInspect})</p>
                        <span className="text-emerald-500 text-lg">✅</span>
                    </div>
                    <h3 className="text-2xl font-black text-emerald-600 mt-2">
                        {currentYearStats.porcentajeCumplimiento.toFixed(1)}%
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                        {currentYearStats.conResolucion} con resolución
                    </p>
                </div>

                {/* 3. En Mejora */}
                <div 
                    onClick={() => {
                        setSelectedComportamiento('MEJORA')
                        handleApplyFilters({ comportamiento: 'MEJORA' })
                    }}
                    className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 hover:border-emerald-300 transition cursor-pointer"
                >
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase text-emerald-700">En Mejora</p>
                        <span className="text-emerald-500 text-lg">🚀</span>
                    </div>
                    <h3 className="text-2xl font-black text-emerald-700 mt-2">
                        {data.resumenComportamientos.mejora}
                    </h3>
                    <p className="text-xs text-emerald-600 mt-1">Pasaron a tener resolución</p>
                </div>

                {/* 4. En Alerta */}
                <div 
                    onClick={() => {
                        setSelectedComportamiento('ALERTA')
                        handleApplyFilters({ comportamiento: 'ALERTA' })
                    }}
                    className="bg-white p-5 rounded-2xl shadow-sm border border-rose-100 hover:border-rose-300 transition cursor-pointer"
                >
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase text-rose-700">En Alerta</p>
                        <span className="text-rose-500 text-lg">⚠️</span>
                    </div>
                    <h3 className="text-2xl font-black text-rose-700 mt-2">
                        {data.resumenComportamientos.alerta}
                    </h3>
                    <p className="text-xs text-rose-600 mt-1">Perdieron resolución o "NO"</p>
                </div>

                {/* 5. Sostenidos */}
                <div 
                    onClick={() => {
                        setSelectedComportamiento('SOSTENIDO')
                        handleApplyFilters({ comportamiento: 'SOSTENIDO' })
                    }}
                    className="bg-white p-5 rounded-2xl shadow-sm border border-sky-100 hover:border-sky-300 transition cursor-pointer"
                >
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase text-sky-700">Sostenidos</p>
                        <span className="text-sky-500 text-lg">🛡️</span>
                    </div>
                    <h3 className="text-2xl font-black text-sky-700 mt-2">
                        {data.resumenComportamientos.sostenido}
                    </h3>
                    <p className="text-xs text-sky-600 mt-1">Mantienen "SI" continuo</p>
                </div>

                {/* 6. Brecha Digital / Sin Documento */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-amber-100">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase text-amber-700">Brecha Documental</p>
                        <span className="text-amber-500 text-lg">📄</span>
                    </div>
                    <h3 className="text-2xl font-black text-amber-700 mt-2">
                        {currentYearStats.sinDocumento}
                    </h3>
                    <p className="text-xs text-amber-600 mt-1">Dice "SI" pero falta PDF</p>
                </div>
            </div>

            {/* SECCIÓN DE FILTROS AVANZADOS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                        <span>🔍</span> Filtros y Criterios de Análisis
                    </h3>
                    {(selectedSucursal || selectedInstitucion || selectedLicitacion || selectedUt || searchTerm || selectedComportamiento !== 'ALL' || selectedAnioRef) && (
                        <button
                            onClick={handleResetFilters}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition"
                        >
                            <span>✕</span> Limpiar filtros
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {/* Búsqueda inteligente autocompletativa RBD o Nombre */}
                    <div className="lg:col-span-2 relative" ref={searchContainerRef}>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-medium text-gray-500">
                                Buscar RBD o Nombre <span className="text-[10px] text-cyan-600 font-semibold">(Autocompletado)</span>
                            </label>
                            {searchTerm && (
                                <span className="text-[10px] text-gray-400 font-medium">
                                    {searchSuggestions.length > 0 ? `${searchSuggestions.length} sugerencias` : ''}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Escriba RBD, nombre o comuna..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value)
                                    setIsSearchDropdownOpen(true)
                                }}
                                onFocus={() => {
                                    if (searchTerm.trim()) setIsSearchDropdownOpen(true)
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setIsSearchDropdownOpen(false)
                                        handleApplyFilters()
                                    } else if (e.key === 'Escape') {
                                        setIsSearchDropdownOpen(false)
                                    }
                                }}
                                className="w-full text-sm pl-8 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium text-gray-800"
                            />
                            {/* Ícono de búsqueda */}
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">
                                🔍
                            </span>
                            {/* Botón limpiar */}
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={handleClearSearch}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 text-[10px] flex items-center justify-center transition"
                                    title="Limpiar búsqueda"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Desplegable Autocompletado Inteligente */}
                        {isSearchDropdownOpen && searchSuggestions.length > 0 && (
                            <div className="absolute z-40 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-cyan-100 rounded-2xl shadow-xl divide-y divide-gray-100 text-sm">
                                {searchSuggestions.map((item: any) => (
                                    <div
                                        key={item.rbd}
                                        onClick={() => handleSelectSuggestion(item)}
                                        className="p-3 hover:bg-cyan-50/80 cursor-pointer transition flex items-center justify-between group"
                                    >
                                        <div className="pr-3 min-w-0">
                                            <p className="font-semibold text-gray-900 group-hover:text-cyan-800 truncate text-xs sm:text-sm">
                                                {item.nombreEstablecimiento}
                                            </p>
                                            <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                                <span>{item.comuna}</span>
                                                {item.sucursal && <span> • {item.sucursal}</span>}
                                                {item.institucion && <span> • <span className="font-medium text-gray-600">{item.institucion}</span></span>}
                                            </p>
                                        </div>
                                        <span className="shrink-0 bg-cyan-100 group-hover:bg-cyan-200 text-cyan-900 font-mono text-xs font-bold px-2 py-1 rounded-lg">
                                            RBD {item.rbd}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {isSearchDropdownOpen && searchTerm.trim().length >= 2 && searchSuggestions.length === 0 && (
                            <div className="absolute z-40 left-0 right-0 mt-1 p-3 bg-white border border-gray-200 rounded-2xl shadow-lg text-xs text-gray-400 text-center">
                                No se encontraron establecimientos que coincidan con "{searchTerm}"
                            </div>
                        )}
                    </div>

                    {/* Sucursal */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Sucursal</label>
                        <select
                            value={selectedSucursal}
                            onChange={(e) => {
                                setSelectedSucursal(e.target.value)
                                handleApplyFilters({ sucursal: e.target.value })
                            }}
                            className="w-full text-sm px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="">Todas</option>
                            {data.filterOptions.sucursales.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* Institución */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Institución</label>
                        <select
                            value={selectedInstitucion}
                            onChange={(e) => {
                                setSelectedInstitucion(e.target.value)
                                handleApplyFilters({ institucion: e.target.value })
                            }}
                            className="w-full text-sm px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="">Todas</option>
                            {data.filterOptions.instituciones.map(inst => (
                                <option key={inst} value={inst}>{inst}</option>
                            ))}
                        </select>
                    </div>

                    {/* Comportamiento Histórico */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Tendencia RBD</label>
                        <select
                            value={selectedComportamiento}
                            onChange={(e) => {
                                setSelectedComportamiento(e.target.value)
                                handleApplyFilters({ comportamiento: e.target.value })
                            }}
                            className="w-full text-sm px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="ALL">Todos los comportamientos</option>
                            <option value="MEJORA">🚀 En Mejora (Gana SI)</option>
                            <option value="ALERTA">⚠️ En Alerta (Pierde SI o NO)</option>
                            <option value="SOSTENIDO">✅ Sostenido (SI continuo)</option>
                            <option value="SIN_RESOLUCION">❌ Sin Resolución</option>
                            <option value="NO_APLICA">⚪ No Aplica</option>
                        </select>
                    </div>

                    {/* Botón Aplicar */}
                    <div className="flex items-end">
                        <button
                            onClick={() => handleApplyFilters()}
                            disabled={isPending}
                            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isPending ? (
                                <span className="animate-spin text-xs">🌀</span>
                            ) : (
                                <span>Filtrar</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* GRÁFICOS INTERACTIVOS (SECCIÓN 1: EVOLUCIÓN MULTIANUAL Y BRECHA DOCUMENTAL) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico 1: Evolución Multianual de Cumplimiento */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-base font-bold text-gray-900">
                                Evolución Multianual de Cumplimiento
                            </h3>
                            <p className="text-xs text-gray-500">
                                Cantidad de RBDs con vs sin resolución sanitaria y tasa de cumplimiento (%)
                            </p>
                        </div>
                    </div>

                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={data.evolution}
                                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="anio" stroke="#64748b" fontSize={12} tickLine={false} />
                                <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="right" orientation="right" unit="%" stroke="#0284c7" fontSize={12} domain={[0, 100]} tickLine={false} axisLine={false} />
                                <Tooltip
                                    formatter={(value: any, name: any) => {
                                        if (name === '% Cumplimiento') return [`${Number(value).toFixed(1)}%`, name]
                                        return [value, name]
                                    }}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                <Bar yAxisId="left" dataKey="conResolucion" name="Con Resolución (SI)" fill={COLORS.si} radius={[4, 4, 0, 0]} maxBarSize={45} />
                                <Bar yAxisId="left" dataKey="sinResolucion" name="Sin Resolución (NO)" fill={COLORS.no} radius={[4, 4, 0, 0]} maxBarSize={45} />
                                <Bar yAxisId="left" dataKey="noAplica" name="No Aplica" fill={COLORS.noAplica} radius={[4, 4, 0, 0]} maxBarSize={45} />
                                <Line yAxisId="right" type="monotone" dataKey="porcentajeCumplimiento" name="% Cumplimiento" stroke={COLORS.line} strokeWidth={3} dot={{ r: 4 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Gráfico 2: Brecha Digital y Respaldo de Documentos */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-base font-bold text-gray-900">
                                Cobertura Documental Digital de Resoluciones
                            </h3>
                            <p className="text-xs text-gray-500">
                                Comparación de resoluciones registradas con archivo adjunto vs pendientes de respaldo
                            </p>
                        </div>
                    </div>

                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={data.evolution}
                                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="anio" stroke="#64748b" fontSize={12} tickLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    formatter={(value: any, name: any) => [value, name]}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                <Bar dataKey="conDocumento" name="Con Archivo Adjunto" fill={COLORS.conDoc} radius={[4, 4, 0, 0]} maxBarSize={45} />
                                <Bar dataKey="sinDocumento" name="Sin Documento Digital" fill={COLORS.sinDoc} radius={[4, 4, 0, 0]} maxBarSize={45} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* GRÁFICOS INTERACTIVOS (SECCIÓN 2: POR SUCURSAL E INSTITUCIÓN) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Gráfico 3: Cumplimiento por Sucursal (2 columnas) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                    <div className="mb-4">
                        <h3 className="text-base font-bold text-gray-900">
                            Tasa de Cumplimiento por Sucursal ({data.yearToInspect})
                        </h3>
                        <p className="text-xs text-gray-500">
                            Porcentaje de establecimientos con resolución sanitaria vigente por sede
                        </p>
                    </div>

                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={data.sucursalBreakdown}
                                layout="vertical"
                                margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" unit="%" domain={[0, 100]} stroke="#64748b" fontSize={12} />
                                <YAxis dataKey="sucursal" type="category" stroke="#64748b" fontSize={12} tickLine={false} width={100} />
                                <Tooltip
                                    formatter={(value: any) => [`${Number(value).toFixed(1)}%`, '% Cumplimiento']}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                                />
                                <Bar dataKey="porcentajeCumplimiento" fill="#0284c7" radius={[0, 4, 4, 0]} maxBarSize={25} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Gráfico 4: Distribución por Institución (1 columna) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                    <div className="mb-4">
                        <h3 className="text-base font-bold text-gray-900">
                            Distribución por Institución
                        </h3>
                        <p className="text-xs text-gray-500">
                            Volumen de RBDs gestionados según entidad mandante
                        </p>
                    </div>

                    <div className="h-72 w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.institucionBreakdown}
                                    dataKey="total"
                                    nameKey="institucion"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    innerRadius={50}
                                    paddingAngle={3}
                                    label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                    labelLine={false}
                                >
                                    {data.institucionBreakdown.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS.piePalette[index % COLORS.piePalette.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(val: any, name: any) => [`${val} RBDs`, name]}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* TABLA PRINCIPAL: MATRIZ DE COMPORTAMIENTO DE RBDS A LO LARGO DE LOS AÑOS */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
                            <span>📋</span> Matriz Histórica de Comportamiento por RBD
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            Mostrando {data.matrix.length} establecimientos con su trayectoria interanual
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Página {currentPage} de {totalPages || 1}</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value))
                                setCurrentPage(1)
                            }}
                            className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none"
                        >
                            <option value={10}>10 / pág</option>
                            <option value={15}>15 / pág</option>
                            <option value={25}>25 / pág</option>
                            <option value={50}>50 / pág</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50/75 text-xs uppercase font-semibold text-gray-600 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3.5">RBD</th>
                                <th className="px-4 py-3.5">Establecimiento</th>
                                <th className="px-4 py-3.5">Comuna / Sucursal</th>
                                <th className="px-4 py-3.5">Institución</th>
                                <th className="px-4 py-3.5 text-center">Tendencia</th>
                                {/* Columnas de cada año */}
                                {data.years.map(yr => (
                                    <th key={yr} className="px-3 py-3.5 text-center bg-gray-100/50">
                                        Año {yr}
                                    </th>
                                ))}
                                <th className="px-4 py-3.5 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6 + data.years.length} className="px-6 py-12 text-center text-gray-400">
                                        No se encontraron registros que coincidan con los filtros seleccionados
                                    </td>
                                </tr>
                            ) : (
                                paginatedItems.map((item) => (
                                    <tr key={item.rbd} className="hover:bg-cyan-50/30 transition">
                                        {/* RBD */}
                                        <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                                            {item.rbd}
                                        </td>

                                        {/* Nombre */}
                                        <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate" title={item.nombreEstablecimiento}>
                                            {item.nombreEstablecimiento}
                                        </td>

                                        {/* Comuna / Sucursal */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="text-gray-900 font-medium">{item.comuna}</div>
                                            <div className="text-xs text-gray-400">{item.sucursal || 'Sin sucursal'}</div>
                                        </td>

                                        {/* Institución */}
                                        <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-gray-600">
                                            {item.institucion}
                                        </td>

                                        {/* Tendencia */}
                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            {getComportamientoBadge(item.comportamiento)}
                                        </td>

                                        {/* Estado en cada año */}
                                        {data.years.map(yr => {
                                            const yRec = item.aniosData[yr]
                                            const estado = yRec?.estadoResolucion

                                            return (
                                                <td key={yr} className="px-3 py-3 text-center whitespace-nowrap">
                                                    {estado === 'SI' ? (
                                                        <div className="inline-flex items-center gap-1">
                                                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold" title={`Resolución N° ${yRec?.numeroResolucion || 'S/N'}`}>
                                                                ✓
                                                            </span>
                                                            {yRec?.documentoUrl ? (
                                                                <span className="text-xs text-cyan-600 font-bold" title="Tiene respaldo digital">📎</span>
                                                            ) : (
                                                                <span className="text-xs text-amber-500 font-bold" title="Sin archivo PDF adjunto">⚠️</span>
                                                            )}
                                                        </div>
                                                    ) : estado === 'NO' ? (
                                                        <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 inline-flex items-center justify-center text-xs font-bold" title="No cuenta con resolución">
                                                            ✕
                                                        </span>
                                                    ) : estado === 'NO_APLICA' ? (
                                                        <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 inline-flex items-center justify-center text-xs font-bold" title="No Aplica">
                                                            –
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs font-mono">-</span>
                                                    )}
                                                </td>
                                            )
                                        })}

                                        {/* Acción: Inspeccionar */}
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <button
                                                onClick={() => handleInspectRbd(item)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-gray-100 hover:bg-cyan-100 text-gray-700 hover:text-cyan-800 rounded-lg transition"
                                                title="Ver cronología y detalle de resoluciones"
                                            >
                                                <span>👁️</span>
                                                <span>Historial</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginador */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                        <span>Mostrando {paginatedItems.length} de {data.matrix.length} registros</span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 transition font-medium"
                            >
                                Anterior
                            </button>
                            <span className="px-3 font-semibold text-gray-800">{currentPage} / {totalPages}</span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 transition font-medium"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL INSPECTOR HISTÓRICO DEL RBD */}
            {inspectingRbd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-2xl w-full p-6 space-y-6 relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setInspectingRbd(null)}
                            className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition"
                        >
                            ✕
                        </button>

                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-cyan-100 text-cyan-800">
                                    RBD {inspectingRbd.rbd}
                                </span>
                                {getComportamientoBadge(inspectingRbd.comportamiento)}
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mt-2">
                                {inspectingRbd.nombreEstablecimiento}
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {inspectingRbd.comuna} • Sucursal: {inspectingRbd.sucursal || 'Sin Asignar'} • Institución: {inspectingRbd.institucion}
                            </p>
                        </div>

                        {/* Línea de tiempo vertical */}
                        <div className="border-t border-gray-100 pt-4">
                            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <span>⏳</span> Línea de Tiempo de Resoluciones Sanitarias
                            </h3>

                            {loadingTimeline ? (
                                <div className="py-12 text-center text-gray-400">
                                    <div className="animate-spin text-2xl mb-2">🌀</div>
                                    <span>Cargando antecedentes históricos...</span>
                                </div>
                            ) : historicalRecords.length === 0 ? (
                                <div className="py-8 text-center text-gray-400 text-sm">
                                    No hay registros históricos detallados para este establecimiento
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {historicalRecords.map((rec) => {
                                        const isSi = rec.estadoResolucion === 'SI'
                                        return (
                                            <div
                                                key={rec.id}
                                                className={`p-4 rounded-2xl border transition ${
                                                    isSi ? 'bg-emerald-50/50 border-emerald-200' : 'bg-gray-50 border-gray-200'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-gray-900 text-base">
                                                            Año {rec.anio}
                                                        </span>
                                                        <span
                                                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                                isSi ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                            }`}
                                                        >
                                                            {rec.estadoResolucion}
                                                        </span>
                                                    </div>
                                                    {rec.fechaResolucion && (
                                                        <span className="text-xs text-gray-500 font-medium">
                                                            Fecha: {new Date(rec.fechaResolucion).toLocaleDateString('es-CL')}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs text-gray-600">
                                                    <div>
                                                        <span className="font-semibold text-gray-500">N° Resolución:</span>{' '}
                                                        <span className="font-mono text-gray-800">{rec.numeroResolucion || 'No especificado'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold text-gray-500">Subido por:</span>{' '}
                                                        <span className="text-gray-800">{rec.documentoSubidoPor || rec.updatedBy || 'No registrado'}</span>
                                                    </div>
                                                </div>

                                                {/* Documento adjunto si existe */}
                                                {rec.documentoUrl ? (
                                                    <div className="mt-3 pt-3 border-t border-gray-200/60 flex items-center justify-between">
                                                        <div className="flex items-center gap-2 text-xs text-cyan-700 truncate">
                                                            <span>📄</span>
                                                            <span className="truncate font-medium">{rec.documentoNombre || 'Documento de Resolución'}</span>
                                                        </div>
                                                        <a
                                                            href={rec.documentoUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-bold text-cyan-600 hover:text-cyan-800 hover:underline flex items-center gap-1"
                                                        >
                                                            <span>Ver archivo</span>
                                                            <span>↗</span>
                                                        </a>
                                                    </div>
                                                ) : isSi ? (
                                                    <div className="mt-2 text-xs text-amber-600 flex items-center gap-1 font-medium">
                                                        <span>⚠️</span> Pendiente de carga de archivo PDF de respaldo
                                                    </div>
                                                ) : null}

                                                {rec.observaciones && (
                                                    <p className="mt-2 text-xs text-gray-500 italic bg-white/70 p-2 rounded-lg border border-gray-100">
                                                        "{rec.observaciones}"
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                onClick={() => setInspectingRbd(null)}
                                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition"
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
