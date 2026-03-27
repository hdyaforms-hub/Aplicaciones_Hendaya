'use client'

import { useState } from 'react'
import { createArea, updateArea, deleteArea } from './actions'
import { useRouter } from 'next/navigation'

interface Area {
    id: number
    nombre: string
    isActive: boolean
}

interface AreaClientProps {
    initialAreas: Area[]
}

export default function AreaClient({ initialAreas }: AreaClientProps) {
    const [areas, setAreas] = useState<Area[]>(initialAreas)
    const [isAdding, setIsAdding] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        nombre: '',
        isActive: true
    })

    const router = useRouter()

    const resetForm = () => {
        setFormData({ nombre: '', isActive: true })
        setEditingId(null)
        setIsAdding(false)
        setError(null)
    }

    const handleEdit = (area: Area) => {
        setFormData({ nombre: area.nombre, isActive: area.isActive })
        setEditingId(area.id)
        setIsAdding(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            let result
            if (editingId) {
                result = await updateArea(editingId, formData.nombre, formData.isActive)
            } else {
                result = await createArea(formData.nombre, formData.isActive)
            }

            if (result.success) {
                setSuccess(editingId ? 'Área actualizada correctamente' : 'Área creada correctamente')
                resetForm()
                router.refresh()
                // Update local state is not strictly necessary with router.refresh() but helps for instant feedback
                // However, fetching all areas again is safer.
                // For now, let's rely on refresh. 
                setTimeout(() => setSuccess(null), 3000)
            } else {
                setError(result.error || 'Ocurrió un error')
            }
        } catch (err) {
            setError('Error de conexión')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar esta área?')) return

        setLoading(true)
        try {
            const result = await deleteArea(id)
            if (result.success) {
                setSuccess('Área eliminada')
                router.refresh()
                setTimeout(() => setSuccess(null), 3000)
            } else {
                alert(result.error)
            }
        } catch (err) {
            alert('Error al eliminar')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>🏢</span> Mantenedor de Áreas
                    </h2>
                    <p className="text-gray-500 mt-1">Administra las áreas de la compañía para categorizar formularios</p>
                </div>

                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-slate-900/10"
                    >
                        <span>➕</span> Nueva Área
                    </button>
                )}
            </div>

            {isAdding && (
                <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        {editingId ? '📝 Editar Área' : '✨ Crear Nueva Área'}
                    </h3>
                    
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Nombre del Área</label>
                            <input
                                title="Nombre del área"
                                type="text"
                                required
                                value={formData.nombre}
                                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none"
                                placeholder="Ej: Mantenimiento"
                            />
                        </div>

                        <div className="flex items-end gap-2 pb-1">
                            <label className="flex items-center gap-3 cursor-pointer group bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100 w-full">
                                <input
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 transition-all"
                                />
                                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                                    Área Activa
                                </span>
                            </label>
                        </div>

                        <div className="md:col-span-3 flex justify-end gap-3 pt-2 border-t border-gray-50">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-6 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-cyan-600/20 disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? 'Guardando...' : editingId ? 'Actualizar Área' : 'Crear Área'}
                            </button>
                        </div>
                    </form>

                    {error && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2">
                            <span>⚠️</span> {error}
                        </div>
                    )}
                </div>
            )}

            {success && (
                <div className="p-4 bg-green-50 border border-green-100 text-green-600 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                    <span>✅</span> {success}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">ID</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Nombre del Área</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Estado</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {initialAreas.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">
                                        No hay áreas registradas todavía.
                                    </td>
                                </tr>
                            ) : (
                                initialAreas.map((area) => (
                                    <tr key={area.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2 py-1 rounded-lg">
                                                #{area.id}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`font-semibold ${area.isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                                                {area.nombre}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                                area.isActive 
                                                ? 'bg-green-50 text-green-700 border-green-100' 
                                                : 'bg-red-50 text-red-700 border-red-100'
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${area.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                                                {area.isActive ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(area)}
                                                    className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-all"
                                                    title="Editar"
                                                >
                                                    <span className="text-lg">✏️</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(area.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Eliminar"
                                                >
                                                    <span className="text-lg">🗑️</span>
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
        </div>
    )
}
