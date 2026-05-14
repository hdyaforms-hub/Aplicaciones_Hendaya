'use client'

import { useState, useEffect } from 'react'
import { getMultaServicios, saveMultaServicio, deleteMultaServicio } from './actions'

export default function MultaServiciosPage() {
    const [servicios, setServicios] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const [formData, setFormData] = useState({ id: '', codigo: '', nombre: '' })
    const [isEdit, setIsEdit] = useState(false)

    const fetchData = async () => {
        setLoading(true)
        const res = await getMultaServicios()
        if (res.servicios) setServicios(res.servicios)
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError('')
        setSuccess('')

        const res = await saveMultaServicio(formData)

        if (res.error) {
            setError(res.error)
        } else {
            setSuccess('Servicio guardado correctamente.')
            setFormData({ id: '', codigo: '', nombre: '' })
            setIsEdit(false)
            fetchData()
        }
        setSaving(false)
    }

    const handleEdit = (s: any) => {
        setFormData({ id: s.id, codigo: s.codigo, nombre: s.nombre })
        setIsEdit(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este servicio?')) return
        const res = await deleteMultaServicio(id)
        if (res.error) setError(res.error)
        else fetchData()
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                    <span>🍽️</span> Mantenedor de Servicios
                </h2>
                <p className="text-gray-500 mt-1">Define los códigos de servicio para el cálculo de raciones y multas.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                    <h3 className="font-bold text-gray-800 text-lg mb-4 pb-2 border-b">
                        {isEdit ? 'Editar Servicio' : 'Nuevo Servicio'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Código</label>
                            <input
                                type="text"
                                required
                                maxLength={5}
                                placeholder="Ej: D, A, O..."
                                value={formData.codigo}
                                onChange={e => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Nombre del Servicio</label>
                            <input
                                type="text"
                                required
                                value={formData.nombre}
                                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                            />
                        </div>
                        {error && <p className="text-xs text-red-500">{error}</p>}
                        {success && <p className="text-xs text-emerald-500">{success}</p>}
                        <div className="flex gap-2">
                            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-cyan-600 text-white rounded-xl font-bold transition-all disabled:opacity-50">
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                            {isEdit && (
                                <button type="button" onClick={() => { setIsEdit(false); setFormData({ id: '', codigo: '', nombre: '' }) }} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold">
                                    Cancelar
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Código</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Servicio</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic">Cargando...</td></tr>
                            ) : servicios.length > 0 ? (
                                servicios.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 font-black text-cyan-700">{s.codigo}</td>
                                        <td className="px-6 py-4 text-gray-700 font-medium">{s.nombre}</td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            <button onClick={() => handleEdit(s)} className="p-2 hover:bg-cyan-50 rounded-lg">✏️</button>
                                            <button onClick={() => handleDelete(s.id)} className="p-2 hover:bg-red-50 rounded-lg">🗑️</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-400">No hay servicios definidos.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
