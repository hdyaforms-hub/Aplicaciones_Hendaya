'use client'

import React, { useState, useTransition } from 'react'
import {
    createCriterioAction,
    updateCriterioAction,
    toggleCriterioActivoAction,
    deleteCriterioAction
} from './actions'
import { Plus, Search, Edit2, Trash2, CheckCircle2, XCircle, Tag, Sparkles, AlertCircle } from 'lucide-react'

interface Criterio {
    id: string
    nombre: string
    descripcion: string | null
    color: string | null
    activo: boolean
    createdAt: Date | string
    updatedAt: Date | string
}

const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#10b981',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#ec4899', '#64748b', '#475569'
]

export default function CriteriosClient({ initialCriterios }: { initialCriterios: Criterio[] }) {
    const [criterios, setCriterios] = useState<Criterio[]>(initialCriterios)
    const [searchTerm, setSearchTerm] = useState('')
    const [isPending, startTransition] = useTransition()

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<Criterio | null>(null)
    const [nombre, setNombre] = useState('')
    const [descripcion, setDescripcion] = useState('')
    const [color, setColor] = useState('#0ea5e9')
    const [activo, setActivo] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)

    const openCreateModal = () => {
        setEditingItem(null)
        setNombre('')
        setDescripcion('')
        setColor('#0ea5e9')
        setActivo(true)
        setErrorMsg(null)
        setIsModalOpen(true)
    }

    const openEditModal = (item: Criterio) => {
        setEditingItem(item)
        setNombre(item.nombre)
        setDescripcion(item.descripcion || '')
        setColor(item.color || '#0ea5e9')
        setActivo(item.activo)
        setErrorMsg(null)
        setIsModalOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMsg(null)

        if (!nombre.trim()) {
            setErrorMsg('El nombre es requerido')
            return
        }

        startTransition(async () => {
            if (editingItem) {
                const res = await updateCriterioAction(editingItem.id, {
                    nombre,
                    descripcion,
                    color,
                    activo
                })
                if (res.success && res.data) {
                    setCriterios(prev => prev.map(c => c.id === editingItem.id ? (res.data as any) : c))
                    setSuccessMsg('Criterio actualizado correctamente')
                    setIsModalOpen(false)
                    setTimeout(() => setSuccessMsg(null), 3000)
                } else {
                    setErrorMsg(res.error || 'Error al actualizar')
                }
            } else {
                const res = await createCriterioAction({
                    nombre,
                    descripcion,
                    color,
                    activo
                })
                if (res.success && res.data) {
                    setCriterios(prev => [...prev, res.data as any].sort((a, b) => a.nombre.localeCompare(b.nombre)))
                    setSuccessMsg('Criterio creado exitosamente')
                    setIsModalOpen(false)
                    setTimeout(() => setSuccessMsg(null), 3000)
                } else {
                    setErrorMsg(res.error || 'Error al crear')
                }
            }
        })
    }

    const handleToggle = (id: string, current: boolean) => {
        startTransition(async () => {
            const res = await toggleCriterioActivoAction(id, !current)
            if (res.success && res.data) {
                setCriterios(prev => prev.map(c => c.id === id ? { ...c, activo: !current } : c))
            } else {
                alert(res.error || 'Error al alternar estado')
            }
        })
    }

    const handleDelete = (id: string, itemNombre: string) => {
        if (!confirm(`¿Estás seguro de eliminar el criterio "${itemNombre}"?`)) return

        startTransition(async () => {
            const res = await deleteCriterioAction(id)
            if (res.success) {
                setCriterios(prev => prev.filter(c => c.id !== id))
                setSuccessMsg(`Criterio "${itemNombre}" eliminado correctamente`)
                setTimeout(() => setSuccessMsg(null), 3000)
            } else {
                alert(res.error || 'No se pudo eliminar el criterio')
            }
        })
    }

    const filtered = criterios.filter(c =>
        c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.descripcion && c.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const totalActivos = criterios.filter(c => c.activo).length
    const totalInactivos = criterios.filter(c => !c.activo).length

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 p-6 rounded-2xl shadow-xl border border-sky-800/40 text-white">
                <div>
                    <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs tracking-wider uppercase mb-1">
                        <Tag className="w-4 h-4" />
                        <span>Mantenedor · Personal</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                        Criterios de Ausencias
                    </h1>
                    <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                        Configura y cataloga los motivos de ausentismo del personal. Estos criterios se despliegan en el módulo de Asistencia para asociar y tipificar incidencias diarias.
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-sky-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Plus className="w-5 h-5" />
                    <span>Nuevo Criterio</span>
                </button>
            </div>

            {/* Banner de éxito */}
            {successMsg && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-center gap-3 shadow-sm animate-in fade-in">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    <span>{successMsg}</span>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase">Total Criterios</p>
                        <p className="text-2xl font-bold text-white mt-1">{criterios.length}</p>
                    </div>
                    <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400 border border-sky-500/20">
                        <Tag className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase">Activos</p>
                        <p className="text-2xl font-bold text-emerald-400 mt-1">{totalActivos}</p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase">Inactivos</p>
                        <p className="text-2xl font-bold text-amber-400 mt-1">{totalInactivos}</p>
                    </div>
                    <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                        <XCircle className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Filtro y Tabla */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
                <div className="p-4 border-b border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar por nombre o descripción..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                        />
                    </div>
                    <span className="text-xs text-slate-400 self-center">
                        Mostrando {filtered.length} de {criterios.length} registros
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-800/50 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-3.5">Color / Etiqueta</th>
                                <th className="px-6 py-3.5">Nombre Criterio</th>
                                <th className="px-6 py-3.5">Descripción</th>
                                <th className="px-6 py-3.5 text-center">Estado</th>
                                <th className="px-6 py-3.5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-slate-400">
                                        No se encontraron criterios de ausencia coincidentes.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                                                    style={{ backgroundColor: c.color || '#0ea5e9' }}
                                                />
                                                <span className="text-xs font-mono text-slate-400">
                                                    {c.color || '#0ea5e9'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-semibold text-white tracking-wide">
                                                {c.nombre}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs text-slate-400 line-clamp-2">
                                                {c.descripcion || <span className="italic text-slate-600">Sin descripción</span>}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                            <button
                                                onClick={() => handleToggle(c.id, c.activo)}
                                                disabled={isPending}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                                    c.activo
                                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                                                        : 'bg-slate-700/40 text-slate-400 border border-slate-600 hover:bg-slate-700/60'
                                                }`}
                                            >
                                                {c.activo ? (
                                                    <>
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        <span>Activo</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <XCircle className="w-3.5 h-3.5" />
                                                        <span>Inactivo</span>
                                                    </>
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEditModal(c)}
                                                    className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-colors"
                                                    title="Editar criterio"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(c.id, c.nombre)}
                                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Eliminar criterio"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Crear / Editar */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-850">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-sky-400" />
                                {editingItem ? 'Editar Criterio de Ausencia' : 'Nuevo Criterio de Ausencia'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {errorMsg && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                    Nombre del Criterio <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={nombre}
                                    onChange={e => setNombre(e.target.value.toUpperCase())}
                                    placeholder="Ej: LICENCIA MÉDICA, PERMISO CON GOCE..."
                                    required
                                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                />
                                <span className="text-[11px] text-slate-500 mt-1 block">
                                    Se guardará en mayúsculas para mantener consistencia.
                                </span>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                    Descripción (Opcional)
                                </label>
                                <textarea
                                    value={descripcion}
                                    onChange={e => setDescripcion(e.target.value)}
                                    rows={2}
                                    placeholder="Descripción breve de cuándo aplica este criterio..."
                                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                                    Color de Distintivo
                                </label>
                                <div className="flex items-center gap-3 mb-2">
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={e => setColor(e.target.value)}
                                        className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                                    />
                                    <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                                        {color}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_COLORS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setColor(c)}
                                            className={`w-6 h-6 rounded-full border transition-transform ${
                                                color === c ? 'scale-125 border-white ring-2 ring-sky-400' : 'border-slate-600 hover:scale-110'
                                            }`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={activo}
                                        onChange={e => setActivo(e.target.checked)}
                                        className="w-4 h-4 rounded text-sky-500 bg-slate-800 border-slate-700 focus:ring-sky-500"
                                    />
                                    <span className="text-sm text-slate-300 font-medium">
                                        Criterio Activo (disponible para asignación)
                                    </span>
                                </label>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={isPending}
                                    className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="px-5 py-2 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white font-medium text-sm rounded-xl shadow-lg shadow-sky-500/25 transition-all flex items-center gap-2"
                                >
                                    {isPending ? 'Guardando...' : (editingItem ? 'Guardar Cambios' : 'Crear Criterio')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
