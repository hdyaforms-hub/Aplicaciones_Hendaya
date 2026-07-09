'use client'

import { useState } from 'react'
import { copyRole } from '../actions'

type Role = {
  id: string
  name: string
  [key: string]: unknown
}

export default function CopyRoleForm({ role }: { role: Role }) {
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        const formData = new FormData(e.currentTarget)
        formData.append('sourceRoleId', role.id)

        const result = await copyRole(formData)

        if (result?.error) {
            setError(result.error)
        } else {
            setIsOpen(false)
        }
        setLoading(false)
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-cyan-700 bg-slate-50 hover:bg-cyan-50 border border-slate-200 hover:border-cyan-200 rounded-full transition-colors flex items-center justify-between"
            >
                <span>Copiar Rol</span>
                <span>📄</span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-slate-50 p-6 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Copiar Rol</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Se copiarán todos los privilegios de <strong>{role.name}</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label htmlFor="newName" className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Nuevo Nombre para el Rol
                                </label>
                                <input
                                    id="newName"
                                    name="newName"
                                    type="text"
                                    required
                                    placeholder="Ej: Supervisor Zona Sur"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 font-medium">
                                    {error}
                                </div>
                            )}

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 font-medium transition-colors text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-white bg-slate-800 hover:bg-slate-900 shadow-md font-medium transition-colors text-sm disabled:opacity-70 disabled:pointer-events-none"
                                >
                                    {loading ? 'Copiando...' : 'Guardar Copia'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}
