'use client'

import { useState } from 'react'
import { createUser } from '../actions'

type Role = {
    id: string
    name: string
}

type Area = {
    id: number
    nombre: string
}

type SucursalVar = { id: string, nombre: string }

type LicitacionVar = {
    licId: number
    estado: number
    licitacionHomologada?: string | null
}

export default function UserForm({ 
    roles, 
    sucursales, 
    areas,
    licitaciones = []
}: { 
    roles: Role[]
    sucursales: SucursalVar[]
    areas: Area[]
    licitaciones?: LicitacionVar[]
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        const formData = new FormData(e.currentTarget)
        const result = await createUser(formData)

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
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl shadow-md shadow-cyan-500/30 transition-all font-medium flex items-center gap-2"
            >
                <span>+</span> Nuevo Usuario
            </button>
        )
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                {/* Cabecera Fija */}
                <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-slate-900">Crear Nuevo Usuario</h3>
                        <p className="text-xs text-slate-500">Configura los accesos, rol, licitaciones, sucursales y permisos del colaborador.</p>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 transition-colors cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* Formulario con Scroll Interno */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-200">
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Grid de 2 Columnas para Datos Principales */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo</label>
                                <input
                                    name="name"
                                    type="text"
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 focus:bg-white text-slate-900 text-xs font-medium"
                                    placeholder="Ej: Juan Pérez"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre de Usuario *</label>
                                <input
                                    name="username"
                                    type="text"
                                    required
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 focus:bg-white text-slate-900 text-xs font-medium"
                                    placeholder="Ej: jperez"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico</label>
                                <input
                                    name="email"
                                    type="email"
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 focus:bg-white text-slate-900 text-xs font-medium"
                                    placeholder="Ej: jperez@empresa.com"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Contraseña *</label>
                                <input
                                    name="password"
                                    type="password"
                                    required
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 focus:bg-white text-slate-900 text-xs font-medium"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Rol / Perfil *</label>
                                <select
                                    name="roleId"
                                    required
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 focus:bg-white text-slate-900 text-xs font-bold"
                                >
                                    <option value="">Selecciona un rol</option>
                                    {roles.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Estado del Usuario</label>
                                <div className="flex gap-4 pt-1">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="isActive" value="true" defaultChecked className="w-4 h-4 text-cyan-600 focus:ring-cyan-500 border-slate-300" />
                                        <span className="text-xs font-bold text-slate-700">Vigente</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="isActive" value="false" className="w-4 h-4 text-cyan-600 focus:ring-cyan-500 border-slate-300" />
                                        <span className="text-xs font-bold text-slate-700">No Vigente</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Asignaciones: Licitaciones, Áreas y Sucursales en 3 Columnas */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Licitaciones Asignadas
                                </label>
                                <div className="max-h-36 overflow-y-auto w-full p-2 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-1.5">
                                    {licitaciones.map(l => (
                                        <label key={l.licId} className="flex items-center gap-2 p-1 hover:bg-white rounded-lg cursor-pointer select-none text-xs">
                                            <input type="checkbox" name="licitaciones" value={l.licId} className="w-3.5 h-3.5 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500" />
                                            <span className="text-slate-700 font-medium">
                                                Licitación {l.licId} {l.licitacionHomologada ? `(${l.licitacionHomologada})` : ''}
                                            </span>
                                        </label>
                                    ))}
                                    {licitaciones.length === 0 && (
                                        <span className="text-xs text-slate-400 italic py-1">No hay licitaciones disponibles.</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Áreas Asignadas (Menú Áreas)</label>
                                <div className="max-h-36 overflow-y-auto w-full p-2 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-1.5">
                                    {areas.map(a => (
                                        <label key={a.id} className="flex items-center gap-2 p-1 hover:bg-white rounded-lg cursor-pointer select-none text-xs">
                                            <input type="checkbox" name="areas" value={a.id} className="w-3.5 h-3.5 text-sky-600 rounded border-slate-300 focus:ring-sky-500" />
                                            <span className="text-slate-700 font-medium">{a.nombre}</span>
                                        </label>
                                    ))}
                                    {areas.length === 0 && (
                                        <span className="text-xs text-slate-400 italic py-1">No hay áreas configuradas.</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Sucursales Permitidas</label>
                                <div className="max-h-36 overflow-y-auto w-full p-2 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-1.5">
                                    {sucursales.map(s => (
                                        <label key={s.id} className="flex items-center gap-2 p-1 hover:bg-white rounded-lg cursor-pointer select-none text-xs">
                                            <input type="checkbox" name="sucursales" value={s.id} className="w-3.5 h-3.5 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500" />
                                            <span className="text-slate-700 font-medium">{s.nombre}</span>
                                        </label>
                                    ))}
                                    {sucursales.length === 0 && (
                                        <span className="text-xs text-slate-400 py-1">No hay sucursales disponibles.</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Módulo Conversación & Colaboración */}
                        <div className="p-3 bg-cyan-50/60 rounded-2xl border border-cyan-100 mt-2">
                            <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    name="canReceiveCollab"
                                    value="true"
                                    defaultChecked={false}
                                    className="w-4 h-4 mt-0.5 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
                                />
                                <div>
                                    <span className="text-xs font-bold text-cyan-950 block">Módulo Conversación & Colaboración</span>
                                    <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                                        Permite que este usuario aparezca como miembro elegible para recibir mensajes, tareas y reuniones (deshabilitado por defecto).
                                    </span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Botonera Fija al Fondo */}
                    <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-5 py-2.5 rounded-xl text-slate-600 bg-slate-200 hover:bg-slate-300 font-bold text-xs transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 rounded-xl text-white bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 shadow-md shadow-cyan-500/20 font-bold text-xs transition-all disabled:opacity-70 disabled:pointer-events-none cursor-pointer"
                        >
                            {loading ? 'Guardando...' : 'Crear Usuario'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
