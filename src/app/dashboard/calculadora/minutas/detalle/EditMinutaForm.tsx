'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateMinutaEntries, createMinutaEntry, deleteMinutaEntry } from '../actions'

type MinutaEntry = {
    id: string
    numeroPreparacion: string
    nombrePreparacion?: string
    codigoServicio: string
    nombreServicio: string
    codigoEnlace: number
    nombreEnlace: string
}

interface EditMinutaFormProps {
    licitacion: string
    numeroMinuta: string
    metaData: {
        numeroPrograma: string
        programa: string
        numeroCocina: number
        cocina: string
        dia: number
        mes: number
        anio: number
        sucid: string
    }
    initialEntries: MinutaEntry[]
}

export default function EditMinutaForm({
    licitacion,
    numeroMinuta,
    metaData,
    initialEntries
}: EditMinutaFormProps) {
    const [entries, setEntries] = useState<MinutaEntry[]>(initialEntries)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [newEntry, setNewEntry] = useState({
        numeroPreparacion: '',
        codigoServicio: '',
        nombreServicio: '',
        codigoEnlace: 0,
        nombreEnlace: ''
    })

    const router = useRouter()

    const handleInputChange = (id: string, field: keyof MinutaEntry, value: string) => {
        setEntries(prev => prev.map(e => {
            if (e.id === id) {
                if (field === 'codigoEnlace') {
                    return { ...e, [field]: parseInt(value) || 0 }
                }
                return { ...e, [field]: value }
            }
            return e
        }))
    }

    const handleSave = async () => {
        setLoading(true)
        setMessage(null)

        const result = await updateMinutaEntries(entries.map(e => ({
            id: e.id,
            numeroPreparacion: e.numeroPreparacion,
            codigoEnlace: e.codigoEnlace,
            nombreEnlace: e.nombreEnlace
        })))

        if (result.success) {
            setMessage({ type: 'success', text: 'Minuta actualizada correctamente.' })
            setTimeout(() => {
                setMessage(null)
                router.refresh()
            }, 2000)
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al actualizar.' })
        }
        setLoading(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Está seguro de eliminar esta entrada de la minuta?')) return

        setLoading(true)
        const result = await deleteMinutaEntry(id)
        if (result.success) {
            setEntries(prev => prev.filter(e => e.id !== id))
            setMessage({ type: 'success', text: 'Entrada eliminada correctamente.' })
            router.refresh()
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al eliminar.' })
        }
        setLoading(false)
    }

    const handleAddEntry = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const result = await createMinutaEntry({
            licitacion,
            numeroMinuta,
            ...metaData,
            ...newEntry
        })

        if (result.success) {
            setMessage({ type: 'success', text: 'Entrada agregada correctamente.' })
            setShowAddModal(false)
            setNewEntry({ numeroPreparacion: '', codigoServicio: '', nombreServicio: '', codigoEnlace: 0, nombreEnlace: '' })
            router.refresh()
            window.location.reload()
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al agregar.' })
        }
        setLoading(false)
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <span className="text-indigo-600">Minuta #{numeroMinuta}</span>
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <p>Licitación: <span className="text-gray-900">{licitacion}</span></p>
                        <p>Fecha: <span className="text-gray-900">{metaData.dia}/{metaData.mes}/{metaData.anio}</span></p>
                        <p>Cocina: <span className="text-gray-900">{metaData.cocina}</span></p>
                        <p>Programa: <span className="text-gray-900">{metaData.programa}</span></p>
                    </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 flex-1 md:flex-none rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-bold text-sm transition-colors"
                    >
                        Volver
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 flex-1 md:flex-none rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 font-bold text-sm transition-all shadow-sm"
                    >
                        ➕ Agregar Fila
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2 flex-1 md:flex-none rounded-xl text-white bg-slate-800 hover:bg-slate-900 shadow-md font-bold text-sm transition-all disabled:opacity-50"
                    >
                        {loading ? '...' : '💾 Guardar Cambios'}
                    </button>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-xl text-sm font-bold border animate-in fade-in slide-in-from-top-1 ${
                    message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
                }`}>
                    {message.type === 'success' ? '✅' : '❌'} {message.text}
                </div>
            )}

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-600 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 font-black uppercase tracking-tighter text-[11px]">N° Prep / Nombre</th>
                                <th className="px-6 py-4 font-black uppercase tracking-tighter text-[11px]">Servicio</th>
                                <th className="px-6 py-4 font-black uppercase tracking-tighter text-[11px]">Cód. Enlace</th>
                                <th className="px-6 py-4 font-black uppercase tracking-tighter text-[11px]">Nombre Enlace</th>
                                <th className="px-6 py-4 font-black uppercase tracking-tighter text-[11px] text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-bold text-xs">
                            {entries.map((e) => (
                                <tr key={e.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={e.numeroPreparacion}
                                                    onChange={(ev) => handleInputChange(e.id, 'numeroPreparacion', ev.target.value)}
                                                    className="w-32 px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-indigo-500 bg-slate-50 focus:bg-white outline-none transition-all font-mono text-indigo-700 font-bold"
                                                />
                                                <a 
                                                    href={`/dashboard/calculadora/preparaciones/detalle?licitacion=${licitacion}&numero=${e.numeroPreparacion}`}
                                                    className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                                    title="Ver Detalle de Preparación"
                                                >
                                                    👁️
                                                </a>
                                            </div>
                                            {e.nombrePreparacion && (
                                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider ml-1 truncate max-w-[200px]">
                                                    {e.nombrePreparacion}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {e.codigoServicio} - {e.nombreServicio}
                                    </td>
                                    <td className="px-6 py-4">
                                        <input
                                            type="number"
                                            value={e.codigoEnlace}
                                            onChange={(ev) => handleInputChange(e.id, 'codigoEnlace', ev.target.value)}
                                            className="w-20 px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-indigo-500 bg-transparent focus:bg-white outline-none transition-all font-bold"
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <input
                                            type="text"
                                            value={e.nombreEnlace}
                                            onChange={(ev) => handleInputChange(e.id, 'nombreEnlace', ev.target.value)}
                                            className="w-full min-w-[200px] px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-indigo-500 bg-transparent focus:bg-white outline-none transition-all font-bold"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => handleDelete(e.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Agregar Fila */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in fade-in duration-200">
                        <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                            <span>📝</span> Nueva Entrada de Minuta
                        </h3>

                        <form onSubmit={handleAddEntry} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">N° Preparación</label>
                                <input
                                    required
                                    type="text"
                                    value={newEntry.numeroPreparacion}
                                    onChange={(e) => setNewEntry({ ...newEntry, numeroPreparacion: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 font-bold"
                                    placeholder="Ej: 123456789"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Cód. Servicio</label>
                                    <input
                                        required
                                        type="text"
                                        value={newEntry.codigoServicio}
                                        onChange={(e) => setNewEntry({ ...newEntry, codigoServicio: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Nombre Servicio</label>
                                    <input
                                        required
                                        type="text"
                                        value={newEntry.nombreServicio}
                                        onChange={(e) => setNewEntry({ ...newEntry, nombreServicio: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 font-bold"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Cód. Enlace</label>
                                    <input
                                        required
                                        type="number"
                                        value={newEntry.codigoEnlace}
                                        onChange={(e) => setNewEntry({ ...newEntry, codigoEnlace: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Nombre Enlace</label>
                                    <input
                                        required
                                        type="text"
                                        value={newEntry.nombreEnlace}
                                        onChange={(e) => setNewEntry({ ...newEntry, nombreEnlace: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 font-bold"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-6 py-2.5 w-full rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2.5 w-full rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
                                >
                                    {loading ? '...' : 'Confirmar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
