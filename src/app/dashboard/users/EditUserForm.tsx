'use client'

import { useState } from 'react'
import { updateUser } from '../actions'

type UserData = {
    id: string
    username: string
    name: string | null
    email: string | null
    isActive: boolean
    roleId: string
    sucursales: { id: string }[]
    areas: { id: number }[]
}

type Role = { id: string, name: string }
type SucursalVar = { id: string, nombre: string }
type Area = { id: number, nombre: string }

export default function EditUserForm({
    user,
    roles,
    sucursales,
    areas
}: {
    user: UserData
    roles: Role[]
    sucursales: SucursalVar[]
    areas: Area[]
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        const formData = new FormData(e.currentTarget)
        formData.append('id', user.id) // Ensure ID is sent
        const result = await updateUser(formData)

        if (result?.error) {
            setError(result.error)
        } else if (result?.success) {
            setIsOpen(false)
        }
        setLoading(false)
    }

    // Identificar seleccionados
    const initialSucursales = user.sucursales.map(s => s.id)
    const initialAreas = user.areas.map(a => a.id)

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="text-cyan-600 hover:text-cyan-800 transition-colors font-medium text-xs px-2 py-1 bg-cyan-50 hover:bg-cyan-100 rounded border border-cyan-200"
            >
                ✏️ Editar
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                        >
                            ✕
                        </button>

                        <h3 className="text-xl font-bold text-gray-900 mb-6 tracking-tight">Editar Usuario</h3>

                        <form onSubmit={handleSubmit} className="space-y-4 text-left">
                            {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Usuario</label>
                                <input type="text" disabled defaultValue={user.username} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                                <input name="email" type="email" defaultValue={user.email || ''} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900" placeholder="Ej: jperez@empresa.com" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña (Opcional)</label>
                                <input name="password" type="password" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900" placeholder="Dejar en blanco para no cambiar" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rol / Perfil</label>
                                <select name="roleId" defaultValue={user.roleId} required className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 appearance-none">
                                    {roles.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Estado del Usuario</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="isActive" value="true" defaultChecked={user.isActive} className="w-4 h-4 text-cyan-600 focus:ring-cyan-500 border-gray-300" />
                                        <span className="text-sm text-gray-700">Vigente</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="isActive" value="false" defaultChecked={!user.isActive} className="w-4 h-4 text-cyan-600 focus:ring-cyan-500 border-gray-300" />
                                        <span className="text-sm text-gray-700">No Vigente</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Áreas Asignadas (Menú Áreas)</label>
                                <div className="max-h-40 overflow-y-auto w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 flex flex-col gap-2">
                                    {areas.map(a => (
                                        <label key={a.id} className="flex items-center gap-2 cursor-pointer select-none">
                                            <input type="checkbox" name="areas" value={a.id} defaultChecked={initialAreas.includes(a.id)} className="w-4 h-4 text-sky-600 rounded border-gray-300 focus:ring-sky-500" />
                                            <span className="text-sm text-gray-700">{a.nombre}</span>
                                        </label>
                                    ))}
                                    {areas.length === 0 && (
                                        <span className="text-sm text-gray-500">No hay áreas configuradas.</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Sucursales Permitidas</label>
                                <div className="max-h-40 overflow-y-auto w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 flex flex-col gap-2">
                                    {sucursales.map(s => (
                                        <label key={s.id} className="flex items-center gap-2 cursor-pointer select-none">
                                            <input type="checkbox" name="sucursales" value={s.id} defaultChecked={initialSucursales.includes(s.id)} className="w-4 h-4 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500" />
                                            <span className="text-sm text-gray-700">{s.nombre}</span>
                                        </label>
                                    ))}
                                    {sucursales.length === 0 && (
                                        <span className="text-sm text-gray-500">No hay sucursales disponibles.</span>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 w-full rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-medium transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={loading} className="px-5 py-2.5 w-full rounded-xl text-white bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 shadow-md shadow-cyan-500/20 font-medium transition-all disabled:opacity-70 disabled:pointer-events-none">
                                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}
