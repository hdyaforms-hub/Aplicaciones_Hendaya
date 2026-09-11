'use client'

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
    const [mounted, setMounted] = useState(false)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set())

    // Inicializar permisos seleccionados al abrir
    useEffect(() => {
        if (isOpen) {
            try {
                const perms = JSON.parse(role.permissions) as string[]
                setSelectedPerms(new Set(perms))
            } catch {
                setSelectedPerms(new Set())
            }
            setSearchTerm('')
            setError('')
        }
    }, [isOpen, role.permissions])

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))
    }

    const togglePermission = (id: string) => {
        setSelectedPerms(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const selectAllInCategory = (perms: PermissionDef[]) => {
        setSelectedPerms(prev => {
            const next = new Set(prev)
            perms.forEach(p => next.add(p.id))
            return next
        })
    }

    const deselectAllInCategory = (perms: PermissionDef[]) => {
        setSelectedPerms(prev => {
            const next = new Set(prev)
            perms.forEach(p => next.delete(p.id))
            return next
        })
    }

    const selectAllGlobal = () => {
        setSelectedPerms(new Set(availablePermissions.map(p => p.id)))
    }

    const clearAllGlobal = () => {
        setSelectedPerms(new Set())
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        const formData = new FormData(e.currentTarget)
        formData.append('id', role.id)
        formData.delete('permissions')
        selectedPerms.forEach(p => formData.append('permissions', p))

        const result = await updateRole(formData)

        if (result?.error) {
            setError(result.error)
        } else if (result?.success) {
            setIsOpen(false)
        }
        setLoading(false)
    }

    // Filtrar permisos por búsqueda
    const filteredPermissions = useMemo(() => {
        if (!searchTerm.trim()) return availablePermissions
        const term = searchTerm.toLowerCase()
        return availablePermissions.filter(p => 
            p.name.toLowerCase().includes(term) ||
            p.category.toLowerCase().includes(term) ||
            p.description.toLowerCase().includes(term)
        )
    }, [availablePermissions, searchTerm])

    // Agrupar por categoría
    const groupedPermissions = useMemo(() => {
        return filteredPermissions.reduce((acc, p) => {
            if (!acc[p.category]) acc[p.category] = []
            acc[p.category].push(p)
            return acc
        }, {} as Record<string, PermissionDef[]>)
    }, [filteredPermissions])

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="px-3 py-1.5 bg-slate-50 hover:bg-cyan-50 text-slate-700 hover:text-cyan-700 rounded-xl border border-slate-200 hover:border-cyan-300 transition-all text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            >
                <span>✏️</span>
                <span>Editar</span>
            </button>

            {isOpen && mounted && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-3xl shadow-2xl relative max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150">
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                >
                    ✕
                </button>

                <div className="mb-5 pb-4 border-b border-slate-100 pr-10">
                    <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 mb-1">
                        <span>✏️</span> Edición de Perfil
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        Editar Perfil: <span className="text-cyan-700">{role.name}</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Modifica los datos del perfil y actualiza la matriz de autorizaciones concedidas.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-5 pr-1">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs border border-red-200 font-semibold">
                            ⚠️ {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                Nombre del Rol / Perfil *
                            </label>
                            <input 
                                name="name" 
                                type="text" 
                                required 
                                defaultValue={role.name}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-slate-900 font-bold text-sm transition-all" 
                                placeholder="Ej: Jefe de Logística" 
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                Descripción Breve
                            </label>
                            <input 
                                name="description" 
                                type="text" 
                                defaultValue={role.description || ''}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-slate-900 text-sm transition-all" 
                                placeholder="Ej: Control de andenes, despacho y choferes" 
                            />
                        </div>
                    </div>

                    {/* Selector de Permisos con Filtro y Acciones Rápidas */}
                    <div className="space-y-3 pt-2">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
                                    Matriz de Privilegios
                                </label>
                                <span className="text-[11px] text-cyan-700 font-semibold">
                                    {selectedPerms.size} de {availablePermissions.length} permisos seleccionados
                                </span>
                            </div>

                            <div className="flex items-center gap-2 self-stretch sm:self-auto">
                                <button
                                    type="button"
                                    onClick={selectAllGlobal}
                                    className="px-2.5 py-1 text-[11px] font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg transition-colors"
                                >
                                    Seleccionar Todos
                                </button>
                                <button
                                    type="button"
                                    onClick={clearAllGlobal}
                                    className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
                                >
                                    Limpiar Selección
                                </button>
                            </div>
                        </div>

                        {/* Buscador de permisos en vivo */}
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Filtrar permisos por nombre o módulo..."
                                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800 transition-all"
                            />
                        </div>

                        {/* Listado de Categorías de Permisos */}
                        <div className="space-y-2 border border-slate-200 rounded-2xl max-h-[360px] overflow-y-auto bg-slate-50/50 p-2 custom-scrollbar">
                            {Object.entries(groupedPermissions).map(([category, perms]) => {
                                const isExpanded = expandedCategories[category] || searchTerm.trim().length > 0
                                const isSubCategory = category.includes('->')
                                const selectedInCat = perms.filter(p => selectedPerms.has(p.id)).length
                                const allInCatSelected = perms.length > 0 && selectedInCat === perms.length

                                return (
                                    <div 
                                        key={category} 
                                        className={`overflow-hidden rounded-xl border transition-all ${
                                            isExpanded ? 'bg-white border-slate-300 shadow-xs mb-2' : 'bg-white/80 border-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between p-2.5 hover:bg-slate-50 transition-colors">
                                            <button
                                                type="button"
                                                onClick={() => toggleCategory(category)}
                                                className="flex items-center gap-2 flex-1 text-left min-w-0"
                                            >
                                                <span className={`text-[9px] text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-cyan-600' : ''}`}>
                                                    ▶
                                                </span>
                                                <span className={`text-[11px] font-black uppercase tracking-wider truncate ${
                                                    isExpanded ? 'text-cyan-800' : 'text-slate-700'
                                                }`}>
                                                    {isSubCategory ? category.replace('ÁREAS -> ', '↳ ') : category}
                                                </span>
                                            </button>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                                    selectedInCat > 0 
                                                        ? 'bg-cyan-50 text-cyan-800 border-cyan-200' 
                                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                                }`}>
                                                    {selectedInCat} / {perms.length}
                                                </span>

                                                <button
                                                    type="button"
                                                    onClick={() => allInCatSelected ? deselectAllInCategory(perms) : selectAllInCategory(perms)}
                                                    className="text-[10px] font-bold text-cyan-700 hover:text-cyan-800 underline px-1"
                                                >
                                                    {allInCatSelected ? 'Ninguno' : 'Todos'}
                                                </button>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="p-2.5 pt-0 border-t border-slate-100">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 pt-2">
                                                    {perms.map(p => {
                                                        const isChecked = selectedPerms.has(p.id)
                                                        return (
                                                            <div
                                                                key={p.id}
                                                                onClick={() => togglePermission(p.id)}
                                                                className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all border ${
                                                                    isChecked
                                                                        ? 'bg-cyan-50/50 border-cyan-200'
                                                                        : 'bg-white border-slate-200/80 hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => {}} // Manejado por div onClick
                                                                    className="w-4 h-4 mt-0.5 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer shrink-0"
                                                                />
                                                                <div className="flex flex-col min-w-0 flex-1">
                                                                    <span className={`text-xs font-bold leading-snug ${
                                                                        isChecked ? 'text-cyan-900' : 'text-slate-800'
                                                                    }`}>
                                                                        {p.name}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-500 leading-tight line-clamp-1 mt-0.5">
                                                                        {p.description}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}

                            {filteredPermissions.length === 0 && (
                                <p className="text-xs text-slate-400 p-4 text-center italic">
                                    No se encontraron permisos que coincidan con la búsqueda.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3 border-t border-slate-100">
                        <button 
                            type="button" 
                            onClick={() => setIsOpen(false)} 
                            className="px-5 py-2.5 w-full rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold text-sm transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading} 
                            className="px-5 py-2.5 w-full rounded-xl text-white bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 shadow-lg shadow-cyan-600/30 font-bold text-sm transition-all disabled:opacity-70 disabled:pointer-events-none"
                        >
                            {loading ? 'Guardando Cambios...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
