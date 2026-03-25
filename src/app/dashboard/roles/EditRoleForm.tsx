'use client'

import { useState } from 'react'
import { updateRole } from '../actions'

type PermissionDef = {
    id: string
    name: string
    description: string
    category: string
}

type RoleData = {
    id: string
    name: string
    description: string | null
    permissions: string // JSON string array
}

export default function EditRoleForm({ role, availablePermissions }: { role: RoleData, availablePermissions: PermissionDef[] }) {
    const [isOpen, setIsOpen] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    // Parse the initially saved permissions
    let initialPerms: string[] = []
    try {
        initialPerms = JSON.parse(role.permissions)
    } catch (e) {
        console.error('Error parsing role permissions', e)
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        const formData = new FormData(e.currentTarget)
        formData.append('id', role.id)

        const result = await updateRole(formData)

        if (result?.error) {
            setError(result.error)
        } else if (result?.success) {
            setIsOpen(false)
        }
        setLoading(false)
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-cyan-50 text-gray-700 hover:text-cyan-700 rounded-lg border border-gray-200 hover:border-cyan-200 transition-colors text-sm font-medium flex items-center gap-1"
            >
                ✏️ Editar
            </button>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                >
                    ✕
                </button>

                <h3 className="text-xl font-bold text-gray-900 mb-6 tracking-tight">Editar Perfil: {role.name}</h3>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Rol *</label>
                        <input name="name" type="text" required defaultValue={role.name} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-black" placeholder="Ej: Vendedor" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción Breve</label>
                        <input name="description" type="text" defaultValue={role.description || ''} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-black" placeholder="A qué tipo de usuario aplica..." />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">Permisos de Acceso</label>
                        <div className="space-y-6 border border-gray-200 rounded-2xl max-h-72 overflow-y-auto bg-gray-50 p-4 custom-scrollbar">
                            {Object.entries(
                                availablePermissions.reduce((acc, p) => {
                                    if (!acc[p.category]) acc[p.category] = []
                                    acc[p.category].push(p)
                                    return acc
                                }, {} as Record<string, PermissionDef[]>)
                            ).map(([category, perms]) => (
                                <div key={category} className="space-y-3">
                                    <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest border-b border-gray-200 pb-1 mb-2">
                                        📁 {category}
                                    </h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {perms.map(p => (
                                            <label key={p.id} className="flex items-start gap-3 p-2.5 hover:bg-white rounded-xl cursor-pointer transition-all border border-transparent hover:border-gray-200 hover:shadow-sm group">
                                                <div className="flex h-5 items-center">
                                                    <input
                                                        name="permissions"
                                                        value={p.id}
                                                        type="checkbox"
                                                        defaultChecked={initialPerms.includes(p.id)}
                                                        className="w-4 h-4 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500 cursor-pointer"
                                                    />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-800 group-hover:text-cyan-700">{p.name}</span>
                                                    <span className="text-[10px] text-gray-500 uppercase font-medium">{p.description}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {availablePermissions.length === 0 && (
                                <p className="text-sm text-gray-500 p-2 text-center italic">No hay permisos definidos</p>
                            )}
                        </div>
                    </div>

                    <style jsx>{`
                        .custom-scrollbar::-webkit-scrollbar {
                            width: 6px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-track {
                            background: transparent;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb {
                            background: #E2E8F0;
                            border-radius: 10px;
                        }
                    `}</style>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 w-full rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-medium transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="px-5 py-2.5 w-full rounded-xl text-white bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 shadow-md shadow-cyan-500/20 font-medium transition-all disabled:opacity-70 disabled:pointer-events-none">
                            {loading ? 'Guardando...' : 'Actualizar Perfil'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
