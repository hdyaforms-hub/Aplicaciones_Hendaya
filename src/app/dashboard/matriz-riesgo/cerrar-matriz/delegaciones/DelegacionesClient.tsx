'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createDelegacionAction, deleteDelegacionAction } from './actions'

export default function DelegacionesClient({
    initialUsers,
    initialSucursales,
    initialDelegaciones
}: {
    initialUsers: any[]
    initialSucursales: any[]
    initialDelegaciones: any[]
}) {
    const router = useRouter()
    const [selectedUserId, setSelectedUserId] = useState<string>('')
    const [selectedSucursalId, setSelectedSucursalId] = useState<string>('')
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedUserId || !selectedSucursalId) {
            return alert('Debe seleccionar un usuario y una sucursal.')
        }

        setSaving(true)
        const res = await createDelegacionAction(selectedUserId, selectedSucursalId)
        setSaving(false)

        if (res.success) {
            setSelectedUserId('')
            setSelectedSucursalId('')
            router.refresh()
        } else {
            alert(res.error)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Está seguro de eliminar esta delegación?')) {
            return
        }

        setDeletingId(id)
        const res = await deleteDelegacionAction(id)
        setDeletingId(null)

        if (res.success) {
            router.refresh()
        } else {
            alert(res.error)
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Formulario de Asignación */}
            <div className="lg:col-span-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-fit space-y-6">
                <div>
                    <h3 className="font-black text-slate-800 text-lg">Asignar Nueva Delegación</h3>
                    <p className="text-xs text-slate-400 font-bold mt-1">Concede acceso de visualización de avances a un usuario específico por sucursal.</p>
                </div>

                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Usuario</label>
                        <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-medium text-sm"
                            required
                        >
                            <option value="">-- Seleccionar Usuario --</option>
                            {initialUsers.map(user => (
                                <option key={user.id} value={user.id}>
                                    {user.name ? `${user.name} (${user.username})` : user.username}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sucursal</label>
                        <select
                            value={selectedSucursalId}
                            onChange={(e) => setSelectedSucursalId(e.target.value)}
                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-medium text-sm"
                            required
                        >
                            <option value="">-- Seleccionar Sucursal --</option>
                            {initialSucursales.map(suc => (
                                <option key={suc.id} value={suc.id}>
                                    {suc.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl font-black text-sm shadow-md transition-all mt-2"
                    >
                        {saving ? 'Guardando...' : 'Crear Delegación'}
                    </button>
                </form>
            </div>

            {/* Listado de Delegaciones */}
            <div className="lg:col-span-8 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="p-6 bg-slate-50 border-b border-gray-200">
                    <h3 className="font-black text-slate-800 text-lg">Delegaciones Existentes</h3>
                    <p className="text-xs text-slate-400 font-bold mt-1">Usuarios autorizados para ver el avance de supervisores en cada sucursal.</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap text-slate-700">
                        <thead className="bg-white text-slate-600 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-black">Usuario</th>
                                <th className="px-6 py-4 font-black">Sucursal Autorizada</th>
                                <th className="px-6 py-4 font-black">Asignado En</th>
                                <th className="px-6 py-4 font-black text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {initialDelegaciones.map(del => (
                                <tr key={del.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900">
                                            {del.user.name || del.user.username}
                                        </div>
                                        <div className="text-xs text-slate-400">{del.user.username}</div>
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-indigo-700">
                                        {del.sucursal.nombre}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500">
                                        {new Date(del.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(del.id)}
                                            disabled={deletingId === del.id}
                                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-black transition-colors"
                                        >
                                            {deletingId === del.id ? 'Eliminando...' : 'Eliminar'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {initialDelegaciones.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-400 font-semibold">
                                        No hay delegaciones configuradas.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
