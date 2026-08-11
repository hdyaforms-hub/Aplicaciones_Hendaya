'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { duplicateActaPlantilla, deleteActaPlantilla, toggleActaState } from './actions'

interface Props {
    initialPlantillas: any[]
    licitaciones: { licId: number; licitacionHomologada: string | null }[]
}

export default function ActasDashboardClient({ initialPlantillas, licitaciones }: Props) {
    const router = useRouter()
    const [plantillas, setPlantillas] = useState(initialPlantillas)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedLicitacion, setSelectedLicitacion] = useState('')
    const [loadingId, setLoadingId] = useState<string | null>(null)

    const filtered = plantillas.filter(p => {
        const matchSearch = !searchTerm.trim() || p.nombre.toLowerCase().includes(searchTerm.toLowerCase().trim())
        const matchLic = !selectedLicitacion || p.licitacionId?.toString() === selectedLicitacion
        return matchSearch && matchLic
    })

    const handleToggleState = async (id: string, currentState: boolean) => {
        setLoadingId(id)
        const res = await toggleActaState(id, !currentState)
        if (res.success) {
            setPlantillas(prev => prev.map(p => p.id === id ? { ...p, estado: !currentState } : p))
        } else {
            alert(res.error || 'Error al cambiar estado')
        }
        setLoadingId(null)
    }

    const handleDuplicate = async (id: string) => {
        setLoadingId(id)
        const res = await duplicateActaPlantilla(id)
        if (res.success) {
            router.refresh()
        } else {
            alert(res.error || 'Error al duplicar')
        }
        setLoadingId(null)
    }

    const handleDelete = async (id: string, nombre: string) => {
        if (!confirm(`¿Estás seguro de eliminar el acta "${nombre}"?`)) return
        setLoadingId(id)
        const res = await deleteActaPlantilla(id)
        if (res.success) {
            setPlantillas(prev => prev.filter(p => p.id !== id))
        } else {
            alert(res.error || 'Error al eliminar')
        }
        setLoadingId(null)
    }

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-50 to-indigo-50 rounded-bl-full -z-0 opacity-70" />
                <div className="relative z-10">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                        <span className="text-3xl">📋</span> Actas de Supervisión
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Gestión de plantillas institucionales para actas de terreno
                    </p>
                </div>

                <div className="relative z-10 w-full sm:w-auto">
                    <Link
                        href="/dashboard/mantenedor/actas-supervision/crear"
                        className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-cyan-600/20 transition-all flex items-center justify-center gap-2"
                    >
                        <span>➕</span> Crear Nueva Acta
                    </Link>
                </div>
            </div>

            {/* Controls and filters */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-1">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Buscar por Nombre</label>
                    <input
                        type="text"
                        placeholder="Buscar acta..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-sm text-gray-800 outline-none"
                    />
                </div>

                <div className="w-full sm:w-64 space-y-1">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Filtrar por Licitación</label>
                    <select
                        title="Filtrar por licitación"
                        value={selectedLicitacion}
                        onChange={(e) => setSelectedLicitacion(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-sm font-bold text-gray-800 outline-none cursor-pointer"
                    >
                        <option value="">Todas las licitaciones</option>
                        {licitaciones.map(l => (
                            <option key={l.licId} value={l.licId}>
                                Lic. #{l.licId} {l.licitacionHomologada ? `(${l.licitacionHomologada})` : ''}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* List of Actas */}
            {filtered.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map(plantilla => (
                        <div key={plantilla.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between space-y-4 relative group">
                            <div className="space-y-3">
                                <div className="flex justify-between items-start gap-2">
                                    <span className="px-2.5 py-1 bg-cyan-50 text-cyan-700 border border-cyan-100 font-extrabold text-[10px] uppercase rounded-lg">
                                        Lic. #{plantilla.licitacionId || 'N/A'} • {plantilla.anio}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleState(plantilla.id, plantilla.estado)}
                                        disabled={loadingId === plantilla.id}
                                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors ${
                                            plantilla.estado 
                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                                        }`}
                                    >
                                        {plantilla.estado ? 'Vigente' : 'No Vigente'}
                                    </button>
                                </div>

                                {/* Badges de Instituciones */}
                                {(() => {
                                    let insts: string[] = []
                                    try {
                                        const p = JSON.parse(plantilla.instituciones || '[]')
                                        insts = Array.isArray(p) ? p : [plantilla.instituciones]
                                    } catch {
                                        insts = (plantilla.instituciones || '').split(',').map((s: string) => s.trim()).filter(Boolean)
                                    }
                                    if (insts.length === 0) return null
                                    return (
                                        <div className="flex flex-wrap gap-1">
                                            {insts.map((i: string) => (
                                                <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-bold rounded">
                                                    🏛️ {i}
                                                </span>
                                            ))}
                                        </div>
                                    )
                                })()}

                                <div>
                                    <h3 className="font-extrabold text-base text-slate-900 group-hover:text-cyan-600 transition-colors line-clamp-2">
                                        {plantilla.nombre}
                                    </h3>
                                    {plantilla.instrucciones && (
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 italic">
                                            {plantilla.instrucciones}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 pt-2 text-xs font-bold text-slate-500 border-t border-gray-50">
                                    <span>🧩 {plantilla.campos?.length || 0} Campos</span>
                                    <span>•</span>
                                    <span>📝 {plantilla._count?.respuestas || 0} Respuestas</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100">
                                <Link
                                    href={`/dashboard/mantenedor/actas-supervision/crear/${plantilla.id}`}
                                    className="py-2 px-3 bg-slate-50 hover:bg-cyan-50 text-slate-700 hover:text-cyan-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-gray-200"
                                >
                                    <span>✏️</span> Editar
                                </Link>

                                <button
                                    type="button"
                                    onClick={() => handleDuplicate(plantilla.id)}
                                    disabled={loadingId === plantilla.id}
                                    className="py-2 px-3 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-gray-200 disabled:opacity-50"
                                >
                                    <span>📋</span> Copiar
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleDelete(plantilla.id, plantilla.nombre)}
                                    disabled={loadingId === plantilla.id}
                                    className="py-2 px-3 bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-gray-200 disabled:opacity-50"
                                >
                                    <span>🗑️</span> Borrar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white py-16 px-6 rounded-3xl border-2 border-dashed border-gray-200 text-center space-y-3 shadow-sm">
                    <span className="text-5xl block animate-bounce">📭</span>
                    <h3 className="text-lg font-bold text-gray-800">No se encontraron plantillas de actas</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        Aún no se han creado actas de supervisión o ninguna coincide con los filtros aplicados.
                    </p>
                    <Link
                        href="/dashboard/mantenedor/actas-supervision/crear"
                        className="inline-flex px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md items-center gap-2"
                    >
                        <span>➕</span> Crear Nueva Acta
                    </Link>
                </div>
            )}
        </div>
    )
}
