'use client'

import { useState, useMemo } from 'react'
import { saveConsumoGas, getConsumoGas, getPendingConsumoRBDs, getColegiosForAutocomplete, getConsumoGasHistory } from './actions'
import BulkUploadModalConsumo from './BulkUploadModalConsumo'
import * as XLSX from 'xlsx'

type ConsumoGas = {
    id: string
    rbd: number
    nombreEstablecimiento: string
    litros: number
    cantidad: number
    meses: string
    updatedAt?: string | Date
}

export default function ConsumoGasClient({ initialData, error: initialError }: { initialData: ConsumoGas[], error?: string }) {
    const [data, setData] = useState<ConsumoGas[]>(initialData)
    const [filter, setFilter] = useState('')
    const [editingItem, setEditingItem] = useState<ConsumoGas | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState(initialError || '')
    const [modalOpen, setModalOpen] = useState(false)
    const [pendingModalOpen, setPendingModalOpen] = useState(false)
    const [pendingData, setPendingData] = useState<any[]>([])
    const [isLoadingPending, setIsLoadingPending] = useState(false)
    const [allColegios, setAllColegios] = useState<{ colRBD: number, nombreEstablecimiento: string }[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [historyModalOpen, setHistoryModalOpen] = useState(false)
    const [historyData, setHistoryData] = useState<any[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)
    const [formData, setFormData] = useState({
        rbd: 0,
        litros: 0,
        cantidad: 1,
        meses: "1,2,3,4,5,6,7,8,9,10,11,12",
        observacion: ""
    })

    const fetchData = async () => {
        const { data: newData, error: fetchError } = await getConsumoGas()
        if (newData) setData(newData)
        if (fetchError) setError(fetchError)
    }

    const filteredData = useMemo(() => {
        if (!filter) return data
        const lowercaseFilter = filter.toLowerCase()
        return data.filter(item =>
            item.rbd.toString().includes(filter) ||
            item.nombreEstablecimiento.toLowerCase().includes(lowercaseFilter)
        )
    }, [data, filter])

    const handleEdit = (item: ConsumoGas) => {
        setEditingItem(item)
        setFormData({
            rbd: item.rbd,
            litros: item.litros,
            cantidad: item.cantidad,
            meses: item.meses,
            observacion: "" // Siempre vacío al abrir para forzar nueva explicación
        })
        setSearchTerm(`${item.rbd} - ${item.nombreEstablecimiento}`)
        setModalOpen(true)
    }

    const handleNew = async () => {
        setEditingItem(null)
        setFormData({
            rbd: 0,
            litros: 0,
            cantidad: 1,
            meses: "1,2,3,4,5,6,7,8,9,10,11,12",
            observacion: ""
        })
        setSearchTerm('')
        setModalOpen(true)
        
        // Cargar colegios para el autocomplete si no están cargados
        if (allColegios.length === 0) {
            const res = await getColegiosForAutocomplete()
            if (res.data) setAllColegios(res.data)
        }
    }

    const filteredColegios = useMemo(() => {
        if (!searchTerm || searchTerm.length < 2) return []
        const lowSearch = searchTerm.toLowerCase()
        return allColegios.filter(c => 
            c.colRBD.toString().includes(lowSearch) || 
            c.nombreEstablecimiento.toLowerCase().includes(lowSearch)
        ).slice(0, 10) // Limitar a 10 sugerencias
    }, [allColegios, searchTerm])

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        if (!formData.observacion.trim()) {
            setError('La observación es obligatoria para registrar el motivo del cambio.')
            return
        }

        setIsSaving(true)
        setError('')

        const result = await saveConsumoGas(formData)
        if (result.success) {
            await fetchData()
            setModalOpen(false)
            setEditingItem(null)
        } else {
            setError(result.error || 'Error al guardar')
        }
        setIsSaving(false)
    }

    const handleViewHistory = async (rbd: number) => {
        setIsLoadingHistory(true)
        setHistoryModalOpen(true)
        const res = await getConsumoGasHistory(rbd)
        if (res.data) {
            setHistoryData(res.data)
        } else {
            setError(res.error || 'Error al cargar historial')
        }
        setIsLoadingHistory(false)
    }

    const handleOpenPending = async () => {
        setPendingModalOpen(true)
        setIsLoadingPending(true)
        const res = await getPendingConsumoRBDs()
        if (res.data) {
            setPendingData(res.data)
        } else {
            setError(res.error || 'Error al cargar pendientes')
        }
        setIsLoadingPending(false)
    }

    const handleExportPending = () => {
        const ws = XLSX.utils.json_to_sheet(pendingData.map(c => ({
            RBD: c.colRBD,
            Colegio: c.nombreEstablecimiento,
            UT: c.colut
        })))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Pendientes")
        XLSX.writeFile(wb, "RBDs_Sin_Configurar_Gas.xlsx")
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>🔥</span> Consumo de Gas por RBD
                    </h2>
                    <p className="text-gray-500 mt-1">Configuración de límites y periodos de carga</p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleNew}
                        className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-sky-500/30 transition-all font-medium flex items-center gap-2"
                    >
                        <span>+</span> Nuevo RBD
                    </button>
                    <button
                        onClick={handleOpenPending}
                        className="px-4 py-2 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-xl shadow-sm transition-all font-medium flex items-center gap-2"
                    >
                        <span>📋</span> RBDs sin Configurar
                    </button>
                    <BulkUploadModalConsumo onUploadSuccess={fetchData} />
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
                    <span>⚠️</span> {error}
                </div>
            )}

            {/* Panel de Filtros */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Buscar por RBD o Colegio</label>
                    <input
                        type="text"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Ej: 8532 o Colegio San José..."
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                    />
                </div>
            </div>

            {/* Tabla de Resultados */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-600 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold">RBD</th>
                                <th className="px-6 py-4 font-semibold">Colegio</th>
                                <th className="px-6 py-4 font-semibold text-center">Litros</th>
                                <th className="px-6 py-4 font-semibold text-center">Cantidad (Máx)</th>
                                <th className="px-6 py-4 font-semibold">Meses (Permitidos)</th>
                                <th className="px-6 py-4 font-semibold text-right">Última Act.</th>
                                <th className="px-6 py-4 font-semibold text-center">Historial</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {filteredData.map((item) => (
                                <tr key={item.id} className="hover:bg-cyan-50/50 transition-colors">
                                    <td className="px-6 py-4 font-bold">
                                        <button
                                            onClick={() => handleEdit(item)}
                                            className="text-cyan-700 hover:text-cyan-900 hover:underline flex items-center gap-1 group"
                                        >
                                            {item.rbd} <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="max-w-[300px] truncate font-medium text-gray-900" title={item.nombreEstablecimiento}>
                                            {item.nombreEstablecimiento}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="bg-orange-50 text-orange-700 px-2.5 py-1 rounded-lg font-semibold border border-orange-100">
                                            {item.litros.toLocaleString()} Lts
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center font-bold text-slate-900">
                                        {item.cantidad}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {item.meses.split(',').map((m, idx) => (
                                                <span key={idx} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 uppercase">
                                                    Mes {m.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-400 text-xs text-center">
                                        {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => handleViewHistory(item.rbd)}
                                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors"
                                            title="Ver Historial"
                                        >
                                            🕒
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        No se encontraron registros de consumo.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Edición */}
            {modalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">
                                {editingItem ? `Editar Consumo RBD: ${editingItem.rbd}` : 'Nuevo Consumo de Gas'}
                            </h3>
                            <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="relative">
                                <label className="block text-sm font-bold text-gray-900 mb-1">Buscar Colegio o RBD</label>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value)
                                        setShowSuggestions(true)
                                    }}
                                    placeholder="Ingresa nombre o RBD..."
                                    required={!editingItem}
                                    disabled={!!editingItem}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-cyan-500 outline-none disabled:bg-gray-100 font-medium text-gray-900 placeholder:text-gray-400"
                                />
                                {showSuggestions && filteredColegios.length > 0 && !editingItem && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-auto">
                                        {filteredColegios.map(c => (
                                            <button
                                                key={c.colRBD}
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ ...formData, rbd: c.colRBD })
                                                    setSearchTerm(`${c.colRBD} - ${c.nombreEstablecimiento}`)
                                                    setShowSuggestions(false)
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-cyan-50 transition-colors border-b border-gray-50 last:border-none flex flex-col"
                                            >
                                                <span className="font-bold text-gray-900">{c.colRBD}</span>
                                                <span className="text-xs text-gray-600">{c.nombreEstablecimiento}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <input type="hidden" name="rbd" value={formData.rbd} />
                            </div>
                            {editingItem && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-900 mb-1">Colegio Seleccionado</label>
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-sm text-gray-900 font-semibold">
                                        {editingItem.rbd} - {editingItem.nombreEstablecimiento}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-1">Litros Permitidos</label>
                                <input
                                    name="litros"
                                    type="number"
                                    step="0.01"
                                    value={formData.litros}
                                    onChange={(e) => setFormData({ ...formData, litros: parseFloat(e.target.value) })}
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-gray-900"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-1">Cantidad de Cargas (Máximo)</label>
                                <input
                                    name="cantidad"
                                    type="number"
                                    value={formData.cantidad}
                                    onChange={(e) => setFormData({ ...formData, cantidad: parseInt(e.target.value) })}
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-gray-900"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-1">Meses (Ej: 1,3,5)</label>
                                <input
                                    name="meses"
                                    type="text"
                                    value={formData.meses}
                                    onChange={(e) => setFormData({ ...formData, meses: e.target.value })}
                                    placeholder="1, 2, 3..."
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-gray-900"
                                />
                                <p className="text-[10px] text-gray-500 mt-1 font-medium">Ingresa los números de los meses separados por coma.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-1">
                                    Observación de Cambio <span className="text-red-500 font-black text-xs">* Obligatorio</span>
                                </label>
                                <textarea
                                    name="observacion"
                                    value={formData.observacion}
                                    onChange={(e) => setFormData({ ...formData, observacion: e.target.value })}
                                    required
                                    rows={3}
                                    placeholder="Explica el motivo del cambio (ej: Aumento por temporada de invierno, corrección de litros...)"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-cyan-500 outline-none font-medium text-gray-900 text-sm"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-semibold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 transition-colors font-bold shadow-lg shadow-cyan-200 disabled:opacity-50"
                                >
                                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de RBDs Pendientes */}
            {pendingModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">RBDs sin Configurar</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Colegios que aún no tienen límites de gas establecidos</p>
                            </div>
                            <button onClick={() => setPendingModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2">✕</button>
                        </div>
                        
                        <div className="flex-1 overflow-auto p-0">
                            {isLoadingPending ? (
                                <div className="p-20 text-center flex flex-col items-center gap-3">
                                    <div className="animate-spin h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
                                    <p className="text-gray-500 font-medium tracking-tight">Cargando lista...</p>
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-white sticky top-0 border-b border-gray-100 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                                        <tr>
                                            <th className="px-6 py-3">RBD</th>
                                            <th className="px-6 py-3">Colegio</th>
                                            <th className="px-6 py-3">UT</th>
                                            <th className="px-6 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {pendingData.map((c) => (
                                            <tr key={c.colRBD} className="hover:bg-cyan-50/30 transition-colors">
                                                <td className="px-6 py-3 font-bold text-cyan-700">{c.colRBD}</td>
                                                <td className="px-6 py-3 font-medium text-gray-900">{c.nombreEstablecimiento}</td>
                                                <td className="px-6 py-3 text-gray-500">{c.colut}</td>
                                                <td className="px-6 py-3 text-right">
                                                    <button 
                                                        onClick={() => {
                                                            setPendingModalOpen(false)
                                                            setEditingItem(null)
                                                            setFormData({
                                                                rbd: c.colRBD,
                                                                litros: 0,
                                                                cantidad: 1,
                                                                meses: "1,2,3,4,5,6,7,8,9,10,11,12",
                                                                observacion: ""
                                                            })
                                                            setSearchTerm(`${c.colRBD} - ${c.nombreEstablecimiento}`)
                                                            setModalOpen(true)
                                                        }}
                                                        className="text-[10px] font-bold bg-cyan-100 text-cyan-700 px-2 py-1 rounded hover:bg-cyan-200"
                                                    >
                                                        CONFIGURAR
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {pendingData.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-10 text-center text-gray-500 italic">
                                                    Todos los RBDs han sido configurados.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                            <span className="text-xs text-gray-500 font-medium">Total: {pendingData.length} establecimientos</span>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setPendingModalOpen(false)}
                                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800"
                                >
                                    Cerrar
                                </button>
                                <button
                                    onClick={handleExportPending}
                                    disabled={pendingData.length === 0}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-bold text-sm shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center gap-2"
                                >
                                    <span>📊</span> Exportar a Excel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Historial */}
            {historyModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Historial de Cambios</h3>
                                <p className="text-xs text-indigo-700 mt-0.5 font-medium">Auditoría de configuraciones de gas en el tiempo</p>
                            </div>
                            <button onClick={() => setHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2">✕</button>
                        </div>

                        <div className="flex-1 overflow-auto p-0">
                            {isLoadingHistory ? (
                                <div className="p-20 text-center flex flex-col items-center gap-3">
                                    <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
                                    <p className="text-gray-500 font-medium tracking-tight">Cargando historial...</p>
                                </div>
                            ) : (
                                <div className="p-6 relative">
                                    <div className="space-y-8">
                                        {historyData.map((h, idx) => (
                                            <div key={h.id} className="relative flex flex-col sm:flex-row gap-4 sm:gap-6">
                                                
                                                <div className="sm:w-28 pt-0.5">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                                        {new Date(h.createdAt).toLocaleDateString()}
                                                    </p>
                                                    <p className="text-xs font-bold text-slate-800">
                                                        {new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>

                                                <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                    <div className="flex flex-col gap-3">
                                                        {/* Comparativa Literal */}
                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] text-slate-400 font-bold uppercase">Litros</span>
                                                                <div className="flex items-center gap-2">
                                                                    {h.old_litros !== null && h.old_litros !== h.litros && (
                                                                        <>
                                                                            <span className="line-through text-slate-400">{h.old_litros}</span>
                                                                            <span className="text-indigo-600">→</span>
                                                                        </>
                                                                    )}
                                                                    <span className="font-bold text-slate-900">{h.litros} Lts</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] text-slate-400 font-bold uppercase">Cargas</span>
                                                                <div className="flex items-center gap-2">
                                                                    {h.old_cantidad !== null && h.old_cantidad !== h.cantidad && (
                                                                        <>
                                                                            <span className="line-through text-slate-400">{h.old_cantidad}</span>
                                                                            <span className="text-indigo-600">→</span>
                                                                        </>
                                                                    )}
                                                                    <span className="font-bold text-slate-900">{h.cantidad} Máx</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col ml-auto">
                                                                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[9px] font-black border border-indigo-200">
                                                                    POR: {h.user}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Meses si cambiaron */}
                                                        {h.old_meses !== null && h.old_meses !== h.meses && (
                                                            <div className="text-[10px] bg-amber-50 text-amber-700 p-2 rounded-lg border border-amber-100 italic">
                                                                Cambio en meses: <span className="line-through opacity-50">{h.old_meses}</span> → <b>{h.meses}</b>
                                                            </div>
                                                        )}

                                                        <div className="text-sm text-slate-800 font-medium italic border-l-4 border-indigo-400 pl-3 py-1 bg-white rounded-r-lg shadow-sm">
                                                            "{h.observacion}"
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {historyData.length === 0 && (
                                            <div className="text-center py-10 text-slate-500 italic">
                                                No hay registros históricos para este RBD anteriores al sistema actual.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setHistoryModalOpen(false)}
                                className="px-6 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-bold text-sm shadow-sm"
                            >
                                Cerrar Historial
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
