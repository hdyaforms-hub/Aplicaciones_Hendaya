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
    '#dc2626', '#ea580c', '#eab308', '#16a34a',
    '#06b6d4', '#0284c7', '#2563eb', '#6366f1',
    '#8b5cf6', '#d946ef', '#64748b', '#475569'
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
    const [color, setColor] = useState('#0284c7')
    const [activo, setActivo] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)

    const openCreateModal = () => {
        setEditingItem(null)
        setNombre('')
        setDescripcion('')
        setColor('#0284c7')
        setActivo(true)
        setErrorMsg(null)
        setIsModalOpen(true)
    }

    const openEditModal = (item: Criterio) => {
        setEditingItem(item)
        setNombre(item.nombre)
        setDescripcion(item.descripcion || '')
        setColor(item.color || '#0284c7')
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
        <div className="space-y-6 max-w-7xl mx-auto p-6">
            {/* Header Estándar Claro */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <div className="flex items-center gap-2 text-cyan-600 font-semibold text-xs tracking-wider uppercase mb-1">
                        <Tag className="w-4 h-4" />
                        <span>Mantenedor · Recursos Humanos</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        Criterios de Ausencias
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Configura y cataloga los motivos de ausentismo del personal. Estos criterios se despliegan en el módulo de Asistencia para tipificar incidencias diarias.
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-md shadow-cyan-600/20 transition-all text-sm"
                >
                    <Plus className="w-5 h-5" />
                    <span>Nuevo Criterio</span>
                </button>
            </div>

            {/* Banner de éxito */}
            {successMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center gap-3 shadow-sm animate-in fade-in">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                    <span>{successMsg}</span>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">Total Criterios</p>
                        <p className="text-2xl font-extrabold text-gray-900 mt-1">{criterios.length}</p>
                    </div>
                    <div className="p-3 bg-cyan-50 rounded-xl text-cyan-600 border border-cyan-100">
                        <Tag className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white border border-emerald-100 shadow-sm rounded-2xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-emerald-700 uppercase">Activos</p>
                        <p className="text-2xl font-extrabold text-emerald-600 mt-1">{totalActivos}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white border border-amber-100 shadow-sm rounded-2xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-amber-700 uppercase">Inactivos</p>
                        <p className="text-2xl font-extrabold text-amber-600 mt-1">{totalInactivos}</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl text-amber-600 border border-amber-100">
                        <XCircle className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Filtro y Tabla */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-50/50">
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar por nombre o descripción..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        />
                    </div>
                    <span className="text-xs text-gray-500 self-center">
                        Mostrando {filtered.length} de {criterios.length} registros
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-700">
                        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3.5">Color / Etiqueta</th>
                                <th className="px-6 py-3.5">Nombre Criterio</th>
                                <th className="px-6 py-3.5">Descripción</th>
                                <th className="px-6 py-3.5 text-center">Estado</th>
                                <th className="px-6 py-3.5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-gray-400">
                                        No se encontraron criterios de ausencia coincidentes.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="w-4 h-4 rounded-full border border-gray-300 shadow-2xs"
                                                    style={{ backgroundColor: c.color || '#0284c7' }}
                                                />
                                                <span className="text-xs font-mono text-gray-500">
                                                    {c.color || '#0284c7'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-bold text-gray-900 tracking-wide">
                                                {c.nombre}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs text-gray-600 line-clamp-2">
                                                {c.descripcion || <span className="italic text-gray-400">Sin descripción</span>}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                            <button
                                                onClick={() => handleToggle(c.id, c.activo)}
                                                disabled={isPending}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                                                    c.activo
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                                        : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
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
                                                    className="p-1.5 text-gray-500 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors"
                                                    title="Editar criterio"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(c.id, c.nombre)}
                                                    className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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

            {/* Modal Crear / Editar Estándar Claro */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-cyan-600" />
                                {editingItem ? 'Editar Criterio de Ausencia' : 'Nuevo Criterio de Ausencia'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {errorMsg && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2 font-medium">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                    Nombre del Criterio <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={nombre}
                                    onChange={e => setNombre(e.target.value.toUpperCase())}
                                    placeholder="Ej: LICENCIA MÉDICA, PERMISO CON GOCE..."
                                    required
                                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                />
                                <span className="text-[11px] text-gray-500 mt-1 block">
                                    Se guardará en mayúsculas para mantener consistencia.
                                </span>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                    Descripción (Opcional)
                                </label>
                                <textarea
                                    value={descripcion}
                                    onChange={e => setDescripcion(e.target.value)}
                                    rows={2}
                                    placeholder="Descripción breve de cuándo aplica este criterio..."
                                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5">
                                    Color de Distintivo
                                </label>
                                <div className="flex items-center gap-3 mb-2">
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={e => setColor(e.target.value)}
                                        className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                                    />
                                    <span className="text-xs font-mono text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
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
                                                color === c ? 'scale-125 border-gray-900 ring-2 ring-cyan-500' : 'border-gray-200 hover:scale-110'
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
                                        className="w-4 h-4 rounded text-cyan-600 border-gray-300 focus:ring-cyan-500"
                                    />
                                    <span className="text-sm text-gray-700 font-medium">
                                        Criterio Activo (disponible para asignación)
                                    </span>
                                </label>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={isPending}
                                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-bold text-sm rounded-xl shadow-md shadow-cyan-600/20 transition-all flex items-center gap-2"
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
