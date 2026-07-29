'use client'

import React, { useState, useEffect, useTransition } from 'react'
import {
    getDescargosList,
    getDetalleDescargoFolio,
    guardarAspectoDescargo,
    updateResolucionFolio,
    updateResolucionMasiva,
    eliminarResolucionFolio,
    eliminarResolucionMasiva,
    searchColegiosDescargos
} from './actions'

interface DescargosClientProps {
    initialFilters: {
        sucursales: string[]
        licitaciones: string[]
        anos: number[]
    }
}

interface DescargoItem {
    folio: string
    licitacion: string
    rbd: number
    establecimiento: string
    sucursal: string
    fechaSupervision: string
    resolucion: number
    estado: string
    aspectosDetalles?: Array<{
        letraAspecto: string
        aspectoTexto: string
        descripcionMaster: string
        observacionOriginalNC: string
        estadoAspecto: 'Sin antecedente' | 'Solucionado' | 'No Solucionado'
        fechaNoSolucionado: string
        observacionNoSolucionado: string
        montoAspecto?: number
    }>
    montoTotalFolio?: number
}

interface AspectoDetail {
    id: string | null
    letraAspecto: string
    aspectoTexto: string
    descripcionMaster: string
    observacionOriginalNC: string
    estadoAspecto: 'Sin antecedente' | 'Solucionado' | 'No Solucionado'
    fechaNoSolucionado: string
    observacionNoSolucionado: string
    montoAspecto?: number
}

interface FolioDetailModalData {
    folio: string
    licitacion: string
    rbd: number
    establecimiento: string
    sucursal: string
    fechaSupervision: string
    resolucion: number
    estado: string
    aspectos: AspectoDetail[]
    montoTotalFolio?: number
}

const MONTH_NAMES = [
    { value: 1, name: "Enero" },
    { value: 2, name: "Febrero" },
    { value: 3, name: "Marzo" },
    { value: 4, name: "Abril" },
    { value: 5, name: "Mayo" },
    { value: 6, name: "Junio" },
    { value: 7, name: "Julio" },
    { value: 8, name: "Agosto" },
    { value: 9, name: "Septiembre" },
    { value: 10, name: "Octubre" },
    { value: 11, name: "Noviembre" },
    { value: 12, name: "Diciembre" }
]

export default function DescargosClient({ initialFilters }: DescargosClientProps) {
    const [isPending, startTransition] = useTransition()
    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState<DescargoItem[]>([])

    // Filters state (9 filters)
    const [sucursal, setSucursal] = useState('')
    const [rbdSearch, setRbdSearch] = useState('')
    const [licitacion, setLicitacion] = useState('')
    const [ano, setAno] = useState('')
    const [mes, setMes] = useState('')
    const [folio, setFolio] = useState('')
    const [resolucionSearch, setResolucionSearch] = useState('')
    const [criterioAspecto, setCriterioAspecto] = useState('Todos')
    const [estado, setEstado] = useState('Todos')

    // Table Column Sorting state
    const [sortField, setSortField] = useState<keyof DescargoItem>('fechaSupervision')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

    // Mass selection state
    const [selectedFolios, setSelectedFolios] = useState<string[]>([])

    // Detail Modal state
    const [openFolio, setOpenFolio] = useState<string | null>(null)
    const [modalData, setModalData] = useState<FolioDetailModalData | null>(null)
    const [modalLoading, setModalLoading] = useState(false)
    const [resolucionInput, setResolucionInput] = useState<number>(0)

    // Popup "No Solucionado" state
    const [noSolucionadoPopup, setNoSolucionadoPopup] = useState<{
        letraAspecto: string
        aspectoTexto: string
        prevEstado: 'Sin antecedente' | 'Solucionado' | 'No Solucionado'
    } | null>(null)
    const [fechaNoSol, setFechaNoSol] = useState(new Date().toISOString().split('T')[0])
    const [obsNoSol, setObsNoSol] = useState('')
    const [popupError, setPopupError] = useState('')

    // Intelligent school autocomplete search state
    const [colegioSuggestions, setColegioSuggestions] = useState<Array<{ colRBD: number; nombreEstablecimiento: string; sucursal: string }>>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [loadingSuggestions, setLoadingSuggestions] = useState(false)

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (rbdSearch.trim().length >= 1) {
                setLoadingSuggestions(true)
                try {
                    const res = await searchColegiosDescargos(rbdSearch, sucursal)
                    setColegioSuggestions(res)
                    setShowSuggestions(true)
                } catch (e) {
                    console.error('Error buscando colegios:', e)
                } finally {
                    setLoadingSuggestions(false)
                }
            } else {
                setColegioSuggestions([])
                setShowSuggestions(false)
            }
        }, 250)

        return () => clearTimeout(timer)
    }, [rbdSearch, sucursal])

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    const fetchItems = async () => {
        setLoading(true)
        try {
            const data = await getDescargosList({
                sucursal,
                rbdSearch,
                licitacion,
                ano,
                mes,
                folio,
                resolucion: resolucionSearch,
                criterioAspecto,
                estado
            })
            setItems(data as any)
            setCurrentPage(1)
        } catch (e) {
            console.error('Error al cargar descargos:', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchItems()
    }, [sucursal, rbdSearch, licitacion, ano, mes, folio, resolucionSearch, criterioAspecto, estado])

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        fetchItems()
    }

    const clearFilters = () => {
        setSucursal('')
        setRbdSearch('')
        setLicitacion('')
        setAno('')
        setMes('')
        setFolio('')
        setResolucionSearch('')
        setCriterioAspecto('Todos')
        setEstado('Todos')
    }

    const handleSort = (field: keyof DescargoItem) => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }

    const sortedItems = [...items].sort((a, b) => {
        let aVal = a[sortField]
        let bVal = b[sortField]

        if (typeof aVal === 'string') {
            const cmp = (aVal as string).localeCompare((bVal as string) || '')
            return sortOrder === 'asc' ? cmp : -cmp
        }

        if (typeof aVal === 'number') {
            const cmp = (aVal as number) - (bVal as number)
            return sortOrder === 'asc' ? cmp : -cmp
        }

        return 0
    })

    const totalPages = Math.max(1, Math.ceil(sortedItems.length / itemsPerPage))
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedItems = sortedItems.slice(startIndex, endIndex)

    // Mass selection handlers & calculations
    const [massResolucionInput, setMassResolucionInput] = useState<number>(0)
    const [massMontoResolucionInput, setMassMontoResolucionInput] = useState<number>(0)
    const [popupFolioAspectos, setPopupFolioAspectos] = useState<string | null>(null)
    const [aspectosOmitidos, setAspectosOmitidos] = useState<Record<string, string[]>>({})

    // Helper: calculate effective total amount of a folio considering omitted aspects
    const getMontoEfectivoFolio = (item: DescargoItem) => {
        if (!item.aspectosDetalles || item.aspectosDetalles.length === 0) {
            return item.montoTotalFolio || 0
        }
        const omitidos = aspectosOmitidos[item.folio] || []
        return item.aspectosDetalles.reduce((acc, asp) => {
            if (omitidos.includes(asp.letraAspecto)) {
                return acc // Omit amount if marked as 'No Considerado'
            }
            return acc + (asp.montoAspecto || 0)
        }, 0)
    }

    // Calculate sum of total effective amounts for selected folios
    const sumaFoliosSeleccionados = selectedFolios.reduce((acc, fStr) => {
        const item = items.find(i => i.folio === fStr)
        if (!item) return acc
        return acc + getMontoEfectivoFolio(item)
    }, 0)

    // Calculate difference (Suma Folios - Monto Resolucion)
    const diferenciaMonto = sumaFoliosSeleccionados - (massMontoResolucionInput || 0)

    const toggleSelectAll = () => {
        if (selectedFolios.length === items.length) {
            setSelectedFolios([])
        } else {
            setSelectedFolios(items.map(i => i.folio))
        }
    }

    const toggleSelectFolio = (f: string) => {
        setSelectedFolios(prev =>
            prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
        )
    }

    const handleSaveResolucionMasiva = async () => {
        if (selectedFolios.length === 0) return

        if (!massResolucionInput || massResolucionInput <= 0) {
            alert('Por favor ingrese un número de resolución válido.')
            return
        }

        // Validate client-side:
        // 1. Folio must not already have a resolution assigned
        // 2. All aspects must be evaluated (no 'Sin antecedente')
        for (const folioStr of selectedFolios) {
            const item = items.find(i => i.folio === folioStr)
            if (!item) continue

            if (item.resolucion && item.resolucion > 0) {
                alert(`No se puede asignar resolución. El Folio #${folioStr} ya tiene asignada la Resolución #${item.resolucion}. Para asociarlo a una nueva resolución, primero debe desasociar la resolución actual.`)
                return
            }

            if (!item.aspectosDetalles || item.aspectosDetalles.length === 0) {
                alert(`No se puede asignar resolución. El Folio #${folioStr} no tiene aspectos evaluados.`)
                return
            }
            const hasSinAntecedente = item.aspectosDetalles.some(asp => asp.estadoAspecto === 'Sin antecedente')
            if (hasSinAntecedente) {
                alert(`No se puede asignar resolución al Folio #${folioStr}. Aún posee aspectos con "Sin antecedente". Todos los aspectos deben estar en "Solucionado" o "No Solucionado".`)
                return
            }
        }

        startTransition(async () => {
            const res = await updateResolucionMasiva(selectedFolios, massResolucionInput)
            if (res?.error) {
                alert(res.error)
                return
            }
            setSelectedFolios([])
            setMassResolucionInput(0)
            setMassMontoResolucionInput(0)
            fetchItems()
        })
    }

    const handleDesasociarResolucionMasiva = async () => {
        if (selectedFolios.length === 0) return
        if (!confirm(`¿Está seguro de desasociar/eliminar la resolución de los ${selectedFolios.length} folios seleccionados?`)) return
        startTransition(async () => {
            await eliminarResolucionMasiva(selectedFolios)
            setSelectedFolios([])
            setMassResolucionInput(0)
            setMassMontoResolucionInput(0)
            fetchItems()
        })
    }

    const handleDesasociarFolio = async (folio: string) => {
        if (!confirm(`¿Está seguro de desasociar/eliminar la resolución del Folio #${folio}?`)) return
        startTransition(async () => {
            await eliminarResolucionFolio(folio)
            if (openFolio === folio) {
                const updated = await getDetalleDescargoFolio(folio)
                setModalData(updated)
                setResolucionInput(0)
            }
            fetchItems()
        })
    }

    // Open detail modal
    const handleAbrirFolio = async (f: string) => {
        setOpenFolio(f)
        setModalLoading(true)
        try {
            const data = await getDetalleDescargoFolio(f)
            setModalData(data)
            setResolucionInput(data.resolucion)
        } catch (e) {
            console.error('Error al abrir folio:', e)
            alert('Error al abrir el detalle del folio')
            setOpenFolio(null)
        } finally {
            setModalLoading(false)
        }
    }

    // Change aspect estado in modal
    const handleAspectoEstadoChange = async (
        aspecto: AspectoDetail,
        newEstado: 'Sin antecedente' | 'Solucionado' | 'No Solucionado'
    ) => {
        if (newEstado === 'No Solucionado') {
            setNoSolucionadoPopup({
                letraAspecto: aspecto.letraAspecto,
                aspectoTexto: aspecto.aspectoTexto,
                prevEstado: aspecto.estadoAspecto
            })
            setFechaNoSol(new Date().toISOString().split('T')[0])
            setObsNoSol(aspecto.observacionNoSolucionado || '')
            setPopupError('')
            return
        }

        // Apply immediately if Sin antecedente or Solucionado
        if (!modalData) return
        startTransition(async () => {
            const res = await guardarAspectoDescargo({
                folio: modalData.folio,
                letraAspecto: aspecto.letraAspecto,
                estadoAspecto: newEstado,
                resolucion: resolucionInput
            })

            // Refresh modal data
            const updated = await getDetalleDescargoFolio(modalData.folio)
            setModalData(updated)
            fetchItems()
        })
    }

    // Submit No Solucionado Popup
    const handleConfirmNoSolucionado = async () => {
        if (!obsNoSol.trim()) {
            setPopupError('Debes ingresar la observación o justificación.')
            return
        }
        if (!modalData || !noSolucionadoPopup) return

        startTransition(async () => {
            await guardarAspectoDescargo({
                folio: modalData.folio,
                letraAspecto: noSolucionadoPopup.letraAspecto,
                estadoAspecto: 'No Solucionado',
                fechaNoSolucionado: fechaNoSol,
                observacionNoSolucionado: obsNoSol.trim(),
                resolucion: resolucionInput
            })

            setNoSolucionadoPopup(null)
            const updated = await getDetalleDescargoFolio(modalData.folio)
            setModalData(updated)
            fetchItems()
        })
    }

    // Save resolucion change
    const handleSaveResolucion = async () => {
        if (!modalData) return
        startTransition(async () => {
            await updateResolucionFolio(modalData.folio, resolucionInput)
            fetchItems()
        })
    }

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val || 0)
    }

    return (
        <div className="space-y-6">
            {/* Header Title */}
            <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full -mr-40 -mt-40 blur-3xl pointer-events-none" />
                <div className="relative z-10">
                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.25em] bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                        ÁREAS -&gt; MULTAS
                    </span>
                    <h2 className="text-3xl font-black tracking-tight mt-3 flex items-center gap-2">
                        <span>🛡️</span> Descargos de Actas
                    </h2>
                    <p className="text-slate-400 mt-2 text-sm leading-relaxed max-w-2xl">
                        Gestión y seguimiento de resoluciones y descargos de actas por folio de supervisión. Evalúe cada aspecto no conforme de las actas, justifique desviaciones y determine el estado final.
                    </p>
                </div>
            </div>

            {/* Panel de Filtros (7 Filtros) */}
            <form onSubmit={handleSearchSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                        <span>🔍</span> Filtros de Búsqueda
                    </h3>
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        Limpiar Filtros
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
                    {/* 1. Sucursal */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Sucursal</label>
                        <select
                            value={sucursal}
                            onChange={(e) => setSucursal(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-bold text-slate-700 text-xs"
                        >
                            <option value="">Todas</option>
                            {initialFilters.sucursales.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* 2. RBD / Establecimiento Inteligente */}
                    <div className="relative">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                            RBD / Colegio
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="RBD o Nombre..."
                                value={rbdSearch}
                                onChange={(e) => setRbdSearch(e.target.value)}
                                onFocus={() => rbdSearch.trim().length >= 1 && setShowSuggestions(true)}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-bold text-slate-700 text-xs"
                            />
                            {loadingSuggestions && (
                                <div className="absolute right-3 top-2.5 w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin pointer-events-none" />
                            )}
                        </div>

                        {/* Dropdown flotante de sugerencias inteligentes */}
                        {showSuggestions && colegioSuggestions.length > 0 && (
                            <div className="absolute z-50 left-0 w-80 max-w-[90vw] mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                                {colegioSuggestions.map((col) => (
                                    <button
                                        key={col.colRBD}
                                        type="button"
                                        onClick={() => {
                                            setRbdSearch(col.colRBD.toString())
                                            setShowSuggestions(false)
                                            fetchItems()
                                        }}
                                        className="w-full text-left px-3.5 py-2.5 hover:bg-cyan-50/70 transition-colors flex flex-col gap-0.5"
                                    >
                                        <span className="font-black text-slate-900 leading-tight">
                                            {col.nombreEstablecimiento}
                                        </span>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                                            <span className="text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                                                RBD: {col.colRBD}
                                            </span>
                                            {col.sucursal && (
                                                <span className="text-slate-400">
                                                    📍 {col.sucursal}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Overlay para cerrar al hacer clic fuera */}
                        {showSuggestions && (
                            <div
                                className="fixed inset-0 z-40 bg-transparent"
                                onClick={() => setShowSuggestions(false)}
                            />
                        )}
                    </div>

                    {/* 3. Licitación */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Licitación</label>
                        <select
                            value={licitacion}
                            onChange={(e) => setLicitacion(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-bold text-slate-700 text-xs"
                        >
                            <option value="">Todas</option>
                            {initialFilters.licitaciones.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>

                    {/* 4. Año */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Año</label>
                        <select
                            value={ano}
                            onChange={(e) => setAno(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-bold text-slate-700 text-xs"
                        >
                            <option value="">Todos</option>
                            {initialFilters.anos.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>

                    {/* 5. Mes */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Mes</label>
                        <select
                            value={mes}
                            onChange={(e) => setMes(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-bold text-slate-700 text-xs"
                        >
                            <option value="">Todos</option>
                            {MONTH_NAMES.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                        </select>
                    </div>

                    {/* 6. Folio */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Folio</label>
                        <input
                            type="text"
                            placeholder="Folio..."
                            value={folio}
                            onChange={(e) => setFolio(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-bold text-slate-700 text-xs"
                        />
                    </div>

                    {/* 7. Resolución */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Resolución</label>
                        <input
                            type="text"
                            placeholder="Resolución..."
                            value={resolucionSearch}
                            onChange={(e) => setResolucionSearch(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-bold text-slate-700 text-xs"
                        />
                    </div>

                    {/* 8. Criterio Aspectos */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Criterio Aspectos</label>
                        <select
                            value={criterioAspecto}
                            onChange={(e) => setCriterioAspecto(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-bold text-slate-700 text-xs"
                        >
                            <option value="Todos">Todos los aspectos</option>
                            <option value="No Solucionado">No Solucionado ⚠️</option>
                            <option value="Solucionado">Solucionado ✅</option>
                            <option value="Sin antecedente">Sin antecedente ⏳</option>
                        </select>
                    </div>

                    {/* 9. Estado */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Estado Folio</label>
                        <select
                            value={estado}
                            onChange={(e) => setEstado(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-bold text-slate-700 text-xs"
                        >
                            <option value="Todos">Todos</option>
                            <option value="Abierto">Abierto</option>
                            <option value="Cerrado">Cerrado</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all shadow-sm"
                    >
                        Filtrar Resultados
                    </button>
                </div>
            </form>

            {/* Mass Actions & Selection Memory Toolbar */}
            {selectedFolios.length > 0 && (
                <div className="bg-cyan-950 border border-cyan-800 p-5 rounded-3xl space-y-4 text-white animate-in fade-in duration-200 shadow-xl">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-cyan-900/60 pb-4">
                        <div className="flex items-center gap-3">
                            <span className="bg-cyan-500/20 text-cyan-300 px-3 py-1.5 rounded-full text-xs font-black border border-cyan-500/30">
                                {selectedFolios.length} seleccionado(s)
                            </span>
                            <span className="text-xs text-slate-300 font-medium">
                                Folios en memoria para asignación masiva de resolución
                            </span>
                        </div>

                        {/* Control panel: inputs, calculations & actions */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Input 1: N° Resolución */}
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-cyan-300 uppercase mb-1">N° Resolución</label>
                                <input
                                    type="number"
                                    placeholder="N° Resolución..."
                                    value={massResolucionInput === 0 ? '' : massResolucionInput}
                                    onChange={(e) => setMassResolucionInput(e.target.value === '' ? 0 : Number(e.target.value))}
                                    className="w-36 px-3 py-1.5 rounded-xl border border-cyan-400 bg-white text-slate-900 font-black text-xs focus:ring-2 focus:ring-cyan-300 focus:outline-none placeholder-slate-400 shadow-sm"
                                />
                            </div>

                            {/* Input 2: Monto Resolución ($) */}
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-cyan-300 uppercase mb-1">Monto ($)</label>
                                <input
                                    type="number"
                                    placeholder="Monto ($)..."
                                    value={massMontoResolucionInput === 0 ? '' : massMontoResolucionInput}
                                    onChange={(e) => setMassMontoResolucionInput(e.target.value === '' ? 0 : Number(e.target.value))}
                                    className="w-36 px-3 py-1.5 rounded-xl border border-cyan-400 bg-white text-slate-900 font-black text-xs focus:ring-2 focus:ring-cyan-300 focus:outline-none placeholder-slate-400 shadow-sm"
                                />
                            </div>

                            {/* Field 3: Suma Folios Asociados */}
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Suma Folios</label>
                                <div className="px-3 py-1.5 bg-slate-900/90 border border-slate-700 rounded-xl text-xs font-mono font-black text-emerald-400">
                                    ${sumaFoliosSeleccionados.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                                </div>
                            </div>

                            {/* Field 4: Diferencia (Suma Folios - Monto Resolución) */}
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Diferencia</label>
                                <div className={`px-3 py-1.5 bg-slate-900/90 border rounded-xl text-xs font-mono font-black ${
                                    diferenciaMonto === 0
                                        ? 'border-emerald-500/50 text-emerald-300'
                                        : diferenciaMonto > 0
                                            ? 'border-cyan-500/50 text-cyan-300'
                                            : 'border-rose-500/50 text-rose-300'
                                }`}>
                                    ${diferenciaMonto.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 self-end pt-1">
                                <button
                                    type="button"
                                    onClick={handleSaveResolucionMasiva}
                                    disabled={isPending}
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow"
                                >
                                    Guardar Resolución
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDesasociarResolucionMasiva}
                                    disabled={isPending}
                                    className="px-3.5 py-2 bg-rose-600/90 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1"
                                    title="Desasociar / Eliminar resolución de folios seleccionados"
                                >
                                    <span>🗑️</span> Desasociar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedFolios([])}
                                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all"
                                    title="Desmarcar todos"
                                >
                                    Limpiar Selección
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Selected Folios Chips / Memory List */}
                    <div className="flex items-center gap-2 flex-wrap max-h-28 overflow-y-auto pt-1">
                        <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider shrink-0">Folios marcados:</span>
                        {selectedFolios.map(f => {
                            const item = items.find(i => i.folio === f)
                            const montoEfectivo = item ? getMontoEfectivoFolio(item) : 0
                            const omitidosCount = (aspectosOmitidos[f] || []).length

                            return (
                                <div 
                                    key={f} 
                                    className="inline-flex items-center rounded-xl bg-cyan-900/80 border border-cyan-700/80 text-cyan-200 font-mono text-xs font-bold shadow-xs hover:border-cyan-400 transition-all overflow-hidden"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setPopupFolioAspectos(f)}
                                        className="px-3 py-1.5 hover:text-white flex items-center gap-1.5 transition-colors text-left"
                                        title="Haga clic para ver los aspectos y elegir cuáles considerar o no considerar"
                                    >
                                        <span>#{f}</span>
                                        <span className="text-emerald-300 font-black">
                                            (${montoEfectivo.toLocaleString('es-CL', { maximumFractionDigits: 0 })})
                                        </span>
                                        {omitidosCount > 0 && (
                                            <span 
                                                className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-md font-sans font-bold"
                                                title={`${omitidosCount} aspecto(s) marcado(s) como No Considerado`}
                                            >
                                                ⚠️ {omitidosCount} omitido(s)
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => toggleSelectFolio(f)}
                                        className="px-2.5 py-1.5 hover:bg-rose-500/20 hover:text-rose-300 font-bold text-xs transition-colors border-l border-cyan-700/60"
                                        title="Desmarcar este folio"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Tabla Principal de Descargos */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-gray-100 text-[10px] uppercase font-black tracking-wider text-slate-400">
                                <th className="p-4 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={items.length > 0 && selectedFolios.length === items.length}
                                        onChange={toggleSelectAll}
                                        className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                                    />
                                </th>
                                <th onClick={() => handleSort('licitacion')} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors select-none">
                                    <div className="flex items-center gap-1">
                                        <span>Licitación</span>
                                        <span className="text-[10px] text-slate-400">{sortField === 'licitacion' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </div>
                                </th>
                                <th onClick={() => handleSort('folio')} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors select-none">
                                    <div className="flex items-center gap-1">
                                        <span>Folio</span>
                                        <span className="text-[10px] text-slate-400">{sortField === 'folio' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </div>
                                </th>
                                <th onClick={() => handleSort('resolucion')} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors select-none">
                                    <div className="flex items-center gap-1">
                                        <span>Resolución</span>
                                        <span className="text-[10px] text-slate-400">{sortField === 'resolucion' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </div>
                                </th>
                                <th onClick={() => handleSort('fechaSupervision')} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors select-none">
                                    <div className="flex items-center gap-1">
                                        <span>Fecha Sup.</span>
                                        <span className="text-[10px] text-slate-400">{sortField === 'fechaSupervision' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </div>
                                </th>
                                <th onClick={() => handleSort('rbd')} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors select-none">
                                    <div className="flex items-center gap-1">
                                        <span>RBD</span>
                                        <span className="text-[10px] text-slate-400">{sortField === 'rbd' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </div>
                                </th>
                                <th onClick={() => handleSort('establecimiento')} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors select-none">
                                    <div className="flex items-center gap-1">
                                        <span>Establecimiento</span>
                                        <span className="text-[10px] text-slate-400">{sortField === 'establecimiento' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </div>
                                </th>
                                <th onClick={() => handleSort('estado')} className="p-4 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none">
                                    <div className="flex items-center justify-center gap-1">
                                        <span>Estado</span>
                                        <span className="text-[10px] text-slate-400">{sortField === 'estado' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </div>
                                </th>
                                <th className="p-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-xs font-medium text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center text-slate-400 italic">
                                        <div className="inline-block w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-2" />
                                        <p>Cargando lista de descargos...</p>
                                    </td>
                                </tr>
                            ) : sortedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center text-slate-400 italic">
                                        No se encontraron descargos con los filtros seleccionados.
                                    </td>
                                </tr>
                            ) : (
                                paginatedItems.map(item => (
                                    <tr key={item.folio} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="p-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedFolios.includes(item.folio)}
                                                onChange={() => toggleSelectFolio(item.folio)}
                                                className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                                            />
                                        </td>
                                        <td className="p-4 font-bold text-slate-900">{item.licitacion}</td>
                                        <td className="p-4 font-mono font-bold text-cyan-700 relative group">
                                            <div className="flex items-center gap-1.5 cursor-pointer">
                                                <span className="hover:underline">#{item.folio}</span>
                                                {item.aspectosDetalles && item.aspectosDetalles.some(a => a.estadoAspecto === 'No Solucionado') && (
                                                    <span className="bg-rose-100 text-rose-700 text-[10px] px-1.5 py-0.5 rounded-md border border-rose-300 font-sans font-black flex items-center gap-1 shadow-xs" title="Tiene aspectos NO solucionados">
                                                        ⚠️ No Solucionado
                                                    </span>
                                                )}
                                            </div>

                                            {/* Floating Hover Card / Popup on Folio */}
                                            <div className="absolute left-4 top-12 z-50 hidden group-hover:block w-84 p-4 bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl space-y-3 pointer-events-auto transition-all animate-in fade-in duration-150">
                                                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                                    <span className="font-mono text-cyan-400 font-bold text-xs">Folio #{item.folio}</span>
                                                    <span className="text-[10px] font-semibold text-slate-400">Resumen de Aspectos</span>
                                                </div>

                                                {item.aspectosDetalles && item.aspectosDetalles.length > 0 ? (
                                                    <>
                                                        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                                                            {item.aspectosDetalles.map(asp => (
                                                                <div key={asp.letraAspecto} className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1.5 text-left">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span className="font-black text-xs text-slate-200">Aspecto {asp.letraAspecto}</span>
                                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                                                            asp.estadoAspecto === 'No Solucionado'
                                                                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                                                                : asp.estadoAspecto === 'Solucionado'
                                                                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                                                                    : 'bg-slate-700 text-slate-300 border-slate-600'
                                                                        }`}>
                                                                            {asp.estadoAspecto === 'No Solucionado' ? '❌ No Solucionado' : asp.estadoAspecto === 'Solucionado' ? '✅ Solucionado' : '⏳ Sin antecedente'}
                                                                        </span>
                                                                    </div>

                                                                    <p className="text-[11px] text-slate-300 font-normal line-clamp-2">{asp.descripcionMaster}</p>

                                                                    <div className="flex items-center justify-between pt-1 border-t border-slate-700/40 text-[11px]">
                                                                        <span className="text-slate-400 font-medium">Monto Aspecto:</span>
                                                                        <span className="font-mono font-bold text-emerald-400">
                                                                            ${(asp.montoAspecto || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                                                                        </span>
                                                                    </div>

                                                                    {asp.estadoAspecto === 'No Solucionado' && (
                                                                        <div className="mt-1.5 p-2 rounded-lg bg-rose-950/70 border border-rose-800/60 space-y-1 text-rose-200">
                                                                            {asp.fechaNoSolucionado && (
                                                                                <p className="text-[10px] font-bold">📅 Fecha: {asp.fechaNoSolucionado}</p>
                                                                            )}
                                                                            {asp.observacionNoSolucionado ? (
                                                                                <p className="text-[11px] italic">💬 "{asp.observacionNoSolucionado}"</p>
                                                                            ) : (
                                                                                <p className="text-[10px] italic text-rose-400 font-medium">(Sin observación registrada)</p>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Total Footer inside Popup */}
                                                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                                                            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Monto Total Folio:</span>
                                                            <span className="text-sm font-mono font-black text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/50">
                                                                ${(item.montoTotalFolio || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                                                            </span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <p className="text-xs text-slate-400 italic">No hay aspectos evaluados aun.</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 font-mono font-bold text-slate-900">
                                            <div className="flex items-center gap-2">
                                                <span>{item.resolucion ? item.resolucion : '-'}</span>
                                                {item.resolucion > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDesasociarFolio(item.folio)}
                                                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1 font-sans shrink-0"
                                                        title="Desasociar / Eliminar resolución"
                                                    >
                                                        <span>🗑️</span> Desasociar
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 font-semibold text-slate-500">
                                            {item.fechaSupervision ? new Date(item.fechaSupervision).toLocaleDateString('es-CL') : '-'}
                                        </td>
                                        <td className="p-4 font-bold text-slate-800">{item.rbd}</td>
                                        <td className="p-4">
                                            <p className="font-bold text-slate-900">{item.establecimiento}</p>
                                            {item.sucursal && (
                                                <span className="text-[10px] font-semibold text-slate-400">
                                                    {item.sucursal}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${
                                                item.estado === 'Cerrado'
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                            }`}>
                                                {item.estado === 'Cerrado' ? '🟢 Cerrado' : '🟠 Abierto'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleAbrirFolio(item.folio)}
                                                className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-1 ml-auto"
                                            >
                                                <span>📂</span> Abrir
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Controles de Paginación (10 registros por página) */}
                {!loading && sortedItems.length > 0 && (
                    <div className="bg-slate-50 px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                        <div>
                            Mostrando <span className="font-bold text-slate-900">{startIndex + 1}</span> a <span className="font-bold text-slate-900">{Math.min(endIndex, sortedItems.length)}</span> de <span className="font-bold text-slate-900">{sortedItems.length}</span> registros
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-3.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 transition-all shadow-sm flex items-center gap-1"
                            >
                                <span>←</span> Anterior
                            </button>

                            <span className="px-3 py-1 bg-white border border-gray-200 rounded-xl font-bold text-slate-800">
                                {currentPage} / {totalPages}
                            </span>

                            <button
                                type="button"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-3.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 transition-all shadow-sm flex items-center gap-1"
                            >
                                Siguiente <span>→</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Detalle de Folio / Aspectos ("Abrir") */}
            {openFolio && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="bg-slate-900 text-white p-6 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-cyan-500/20 text-cyan-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                                        DETALLE DE DESCARGOS
                                    </span>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                        modalData?.estado === 'Cerrado'
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    }`}>
                                        {modalData?.estado === 'Cerrado' ? '🟢 Cerrado' : '🟠 Abierto'}
                                    </span>
                                </div>
                                <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                                    <span>Folio #{openFolio}</span>
                                    {modalData?.montoTotalFolio !== undefined && (
                                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-800/60">
                                            Total: ${(modalData.montoTotalFolio || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                                        </span>
                                    )}
                                </h3>
                                {modalData && (
                                    <p className="text-xs text-slate-400 mt-1">
                                        {modalData.establecimiento} (RBD {modalData.rbd}) {modalData.sucursal ? `| ${modalData.sucursal}` : ''} | Licitación: {modalData.licitacion}
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={() => setOpenFolio(null)}
                                className="text-slate-400 hover:text-white transition-colors p-1"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
                            {modalLoading || !modalData ? (
                                <div className="py-20 text-center text-slate-400 italic">
                                    <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                    <p>Cargando detalles de aspectos del folio...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Visualización de Resolución (Edición masiva en pantalla principal) */}
                                    <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between gap-4 flex-wrap">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">N° Resolución:</span>
                                            {modalData.resolucion > 0 ? (
                                                <span className="font-mono font-black text-cyan-800 text-sm bg-cyan-50 px-3 py-1 rounded-xl border border-cyan-200">
                                                    #{modalData.resolucion}
                                                </span>
                                            ) : (
                                                <span className="text-xs italic text-slate-400 font-medium">
                                                    Sin resolución asignada
                                                </span>
                                            )}
                                        </div>

                                        {modalData.resolucion > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleDesasociarFolio(modalData.folio)}
                                                disabled={isPending}
                                                className="px-3.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                                                title="Desasociar o eliminar resolución de este folio"
                                            >
                                                <span>🗑️</span> Desasociar / Eliminar Resolución
                                            </button>
                                        )}
                                    </div>

                                    {/* Lista de Aspectos del Folio */}
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider flex items-center justify-between">
                                            <span>Aspectos No Conformes ({modalData.aspectos.length})</span>
                                            <span className="text-[11px] font-normal text-slate-400 italic">
                                                (Todos en Solucionado / No Solucionado marca el folio como Cerrado)
                                            </span>
                                        </h4>

                                        {modalData.aspectos.map((asp, idx) => (
                                            <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-50 pb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-50 text-cyan-700 border border-cyan-200 shrink-0">
                                                            Aspecto {asp.letraAspecto}
                                                        </span>
                                                        {asp.montoAspecto !== undefined && (
                                                            <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                                                ${asp.montoAspecto.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                                                            </span>
                                                        )}
                                                        <p className="text-xs font-bold text-slate-800 leading-snug">
                                                            {asp.descripcionMaster}
                                                        </p>
                                                    </div>

                                                    {/* Dropdown de Estado por Aspecto */}
                                                    <div className="w-48 shrink-0">
                                                        <select
                                                            value={asp.estadoAspecto}
                                                            onChange={(e) => handleAspectoEstadoChange(asp, e.target.value as any)}
                                                            className={`w-full px-3 py-2 rounded-xl border font-bold text-xs transition-all ${
                                                                asp.estadoAspecto === 'Solucionado'
                                                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                                    : asp.estadoAspecto === 'No Solucionado'
                                                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                                                    : 'bg-gray-50 text-slate-600 border-gray-200'
                                                            }`}
                                                        >
                                                            <option value="Sin antecedente">Sin antecedente</option>
                                                            <option value="Solucionado">Solucionado</option>
                                                            <option value="No Solucionado">No Solucionado</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Observación original del hallazgo */}
                                                {asp.observacionOriginalNC && (
                                                    <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 font-medium">
                                                        <span className="font-bold text-slate-400 block text-[10px] uppercase mb-0.5">Observación del Hallazgo:</span>
                                                        {asp.observacionOriginalNC}
                                                    </div>
                                                )}

                                                {/* Justificación si es No Solucionado */}
                                                {asp.estadoAspecto === 'No Solucionado' && (
                                                    <div className="bg-rose-50/70 border border-rose-100 p-3.5 rounded-xl text-xs space-y-1 text-rose-900">
                                                        <div className="flex items-center justify-between font-bold">
                                                            <span className="flex items-center gap-1 text-rose-700">
                                                                <span>⚠️</span> Justificación de No Solución
                                                            </span>
                                                            <span className="text-[10px] text-rose-500 font-semibold">
                                                                Fecha: {asp.fechaNoSolucionado}
                                                            </span>
                                                        </div>
                                                        <p className="text-slate-700 leading-relaxed font-medium bg-white/80 p-2.5 rounded-lg border border-rose-100">
                                                            {asp.observacionNoSolucionado || 'Sin observación ingresada.'}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-white p-4 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setOpenFolio(null)}
                                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all"
                            >
                                Cerrar Ventana
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Popup Justificación "No Solucionado" */}
            {noSolucionadoPopup && (
                <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-rose-100 animate-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                            <div>
                                <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                                    JUSTIFICACIÓN REQUERIDA
                                </span>
                                <h4 className="text-lg font-black text-slate-900 tracking-tight mt-1">
                                    No Solucionado - Aspecto {noSolucionadoPopup.letraAspecto}
                                </h4>
                            </div>
                            <button
                                onClick={() => setNoSolucionadoPopup(null)}
                                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed">
                            Por favor ingrese la fecha de registro y la observación que justifica el motivo por el cual este aspecto no fue solucionado.
                        </p>

                        {popupError && (
                            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold border border-rose-200">
                                {popupError}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Fecha del Registro</label>
                                <input
                                    type="date"
                                    value={fechaNoSol}
                                    onChange={(e) => setFechaNoSol(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 font-bold text-xs text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Observación / Justificación</label>
                                <textarea
                                    rows={4}
                                    placeholder="Explique detalladamente el motivo de la no solución..."
                                    value={obsNoSol}
                                    onChange={(e) => setObsNoSol(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-gray-200 font-medium text-xs text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 leading-relaxed"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setNoSolucionadoPopup(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmNoSolucionado}
                                disabled={isPending}
                                className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-all shadow-md shadow-rose-500/20"
                            >
                                Guardar Justificación
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Popup Modal: Considerar / No Considerar Aspectos por Folio */}
            {popupFolioAspectos && (() => {
                const item = items.find(i => i.folio === popupFolioAspectos)
                if (!item) return null

                const omitidos = aspectosOmitidos[item.folio] || []
                const montoEfectivo = getMontoEfectivoFolio(item)
                const montoOriginal = item.montoTotalFolio || 0

                const toggleAspectoConsiderado = (letra: string) => {
                    setAspectosOmitidos(prev => {
                        const currentOmitidos = prev[item.folio] || []
                        const isOmitted = currentOmitidos.includes(letra)
                        const nextOmitidos = isOmitted
                            ? currentOmitidos.filter(l => l !== letra)
                            : [...currentOmitidos, letra]

                        return {
                            ...prev,
                            [item.folio]: nextOmitidos
                        }
                    })
                }

                const considerarTodos = () => {
                    setAspectosOmitidos(prev => {
                        const next = { ...prev }
                        delete next[item.folio]
                        return next
                    })
                }

                return (
                    <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
                        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col border border-gray-100 animate-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="bg-slate-900 text-white p-6 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="bg-cyan-500/20 text-cyan-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                                            CONSIDERACIÓN DE ASPECTOS POR FOLIO
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                                        <span>Folio #{item.folio}</span>
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {item.establecimiento} (RBD {item.rbd}) {item.sucursal ? `| ${item.sucursal}` : ''}
                                    </p>
                                </div>

                                <button
                                    onClick={() => setPopupFolioAspectos(null)}
                                    className="text-slate-400 hover:text-white transition-colors p-1"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Summary bar inside modal */}
                            <div className="bg-slate-100 p-4 border-b border-gray-200 flex items-center justify-between gap-4">
                                <div>
                                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Monto Calculado para Folio:</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-lg font-mono font-black text-emerald-600">
                                            ${montoEfectivo.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                                        </span>
                                        {omitidos.length > 0 && (
                                            <span className="text-xs font-mono text-slate-400 line-through">
                                                ${montoOriginal.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {omitidos.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={considerarTodos}
                                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 transition-colors"
                                    >
                                        ✓ Considerar Todos los Aspectos
                                    </button>
                                )}
                            </div>

                            {/* Body */}
                            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-3 bg-slate-50/50">
                                <p className="text-xs text-slate-500 font-medium mb-2">
                                    Marque o desmarque los aspectos para <strong>Considerar</strong> o <strong>No Considerar</strong> su monto en la sumatoria total del folio. Por defecto todos los aspectos están considerados:
                                </p>

                                {item.aspectosDetalles && item.aspectosDetalles.length > 0 ? (
                                    item.aspectosDetalles.map((asp) => {
                                        const isConsidered = !omitidos.includes(asp.letraAspecto)
                                        const monto = asp.montoAspecto || 0

                                        return (
                                            <div
                                                key={asp.letraAspecto}
                                                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                                                    isConsidered
                                                        ? 'bg-white border-gray-200 shadow-xs'
                                                        : 'bg-slate-100/80 border-slate-200 opacity-60'
                                                }`}
                                            >
                                                <div className="flex items-start gap-3 flex-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={isConsidered}
                                                        onChange={() => toggleAspectoConsiderado(asp.letraAspecto)}
                                                        className="mt-1 w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                                    />
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-cyan-50 text-cyan-700 border border-cyan-200">
                                                                Aspecto {asp.letraAspecto}
                                                            </span>
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                                                asp.estadoAspecto === 'No Solucionado'
                                                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                                    : asp.estadoAspecto === 'Solucionado'
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                        : 'bg-gray-100 text-slate-600 border-gray-200'
                                                            }`}>
                                                                {asp.estadoAspecto}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-800 leading-snug">
                                                            {asp.descripcionMaster}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Action button & Monto */}
                                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                    <span className={`text-sm font-mono font-black ${isConsidered ? 'text-emerald-600' : 'text-slate-400 line-through'}`}>
                                                        ${monto.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                                                    </span>

                                                    <button
                                                        type="button"
                                                        onClick={() => toggleAspectoConsiderado(asp.letraAspecto)}
                                                        className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                                                            isConsidered
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                                : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'
                                                        }`}
                                                    >
                                                        {isConsidered ? '✅ Considerado' : '❌ No Considerado'}
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <p className="text-xs text-slate-400 italic">No hay aspectos para evaluar en este folio.</p>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="bg-white p-4 border-t border-gray-100 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setPopupFolioAspectos(null)}
                                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all shadow-xs"
                                >
                                    Aceptar y Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
