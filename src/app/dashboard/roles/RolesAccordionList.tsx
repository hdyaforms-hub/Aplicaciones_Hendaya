'use client'

import { useState } from 'react'
import EditRoleForm from './EditRoleForm'
import CopyRoleForm from './CopyRoleForm'
import RolePermissionList from './RolePermissionList'

type PermissionDef = {
    id: string
    name: string
    description: string
    category: string
}

type RoleItem = {
    id: string
    name: string
    description: string | null
    permissions: string
    _count: {
        users: number
    }
}

interface Props {
    roles: RoleItem[]
    availablePermissions: PermissionDef[]
}

export default function RolesAccordionList({ roles, availablePermissions }: Props) {
    const [openRoles, setOpenRoles] = useState<Record<string, boolean>>({})
    const [searchTerm, setSearchTerm] = useState('')

    const toggleRole = (roleId: string) => {
        setOpenRoles(prev => ({ ...prev, [roleId]: !prev[roleId] }))
    }

    const expandAll = () => {
        const allOpen: Record<string, boolean> = {}
        roles.forEach(r => { allOpen[r.id] = true })
        setOpenRoles(allOpen)
    }

    const collapseAll = () => {
        setOpenRoles({})
    }

    const filteredRoles = roles.filter(r => {
        if (!searchTerm.trim()) return true
        const term = searchTerm.toLowerCase()
        return r.name.toLowerCase().includes(term) || (r.description && r.description.toLowerCase().includes(term))
    })

    return (
        <div className="space-y-4">
            {/* Control Bar: Búsqueda y Botones de Expansión Colectiva */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar rol por nombre o descripción..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-sm text-gray-800 transition-all"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                        type="button"
                        onClick={expandAll}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-cyan-700 bg-slate-50 hover:bg-cyan-50 border border-slate-200 hover:border-cyan-200 rounded-xl transition-all flex items-center gap-1.5"
                    >
                        <span>📂</span> Expandir Todos
                    </button>
                    <button
                        type="button"
                        onClick={collapseAll}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5"
                    >
                        <span>📁</span> Colapsar Todos
                    </button>
                </div>
            </div>

            {/* Lista de Acordeones */}
            <div className="space-y-3">
                {filteredRoles.map((role) => {
                    const isExpanded = !!openRoles[role.id]
                    let rolePerms: string[] = []
                    try {
                        rolePerms = JSON.parse(role.permissions) as string[]
                    } catch {
                        rolePerms = []
                    }

                    const activePermsCount = rolePerms.filter(rp => availablePermissions.some(ap => ap.id === rp)).length

                    return (
                        <div
                            key={role.id}
                            className={`bg-white rounded-2xl shadow-sm border transition-all duration-200 overflow-hidden ${
                                isExpanded
                                    ? 'border-cyan-200 ring-2 ring-cyan-500/10 shadow-md'
                                    : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
                            }`}
                        >
                            {/* Header del Acordeón (Clickable) */}
                            <div
                                onClick={() => toggleRole(role.id)}
                                className={`p-4 sm:p-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors select-none ${
                                    isExpanded ? 'bg-gradient-to-r from-slate-50/80 via-white to-cyan-50/30' : 'hover:bg-slate-50/60'
                                }`}
                            >
                                <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                                    <div className={`p-2.5 rounded-xl text-lg shrink-0 transition-colors ${
                                        isExpanded ? 'bg-cyan-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                        🛡️
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-base font-bold text-gray-900 truncate">
                                                {role.name}
                                            </h3>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-50 text-cyan-700 border border-cyan-100">
                                                {role._count.users} {role._count.users === 1 ? 'Usuario' : 'Usuarios'}
                                            </span>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                {activePermsCount} / {availablePermissions.length} accesos
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                            {role.description || 'Sin descripción configurada.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 shrink-0">
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <EditRoleForm role={role} availablePermissions={availablePermissions} />
                                        <CopyRoleForm role={role} />
                                    </div>

                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs text-gray-400 bg-slate-50 border border-slate-200 transition-transform duration-200 ${
                                        isExpanded ? 'rotate-180 bg-cyan-50 border-cyan-200 text-cyan-600 font-bold' : ''
                                    }`}>
                                        ▼
                                    </div>
                                </div>
                            </div>

                            {/* Contenido Expandible del Acordeón */}
                            {isExpanded && (
                                <div className="px-5 pb-5 pt-2 border-t border-gray-100 bg-slate-50/40 animate-in fade-in-50 slide-in-from-top-2 duration-200">
                                    {role.description && (
                                        <div className="mb-4 p-3 rounded-xl bg-white border border-gray-100 text-xs text-gray-600">
                                            <span className="font-bold text-gray-400 uppercase text-[10px] tracking-wider block mb-1">Descripción:</span>
                                            {role.description}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                                Aplicaciones y Permisos Asignados
                                            </p>
                                            <span className="text-[10px] text-gray-400 font-medium">
                                                Haz clic en los grupos para ver más detalles
                                            </span>
                                        </div>

                                        {rolePerms.length > 0 ? (
                                            <RolePermissionList 
                                                rolePerms={rolePerms} 
                                                availablePermissions={availablePermissions} 
                                            />
                                        ) : (
                                            <div className="p-4 text-center bg-white rounded-xl border border-dashed border-gray-200">
                                                <p className="text-xs text-gray-400 italic">No tiene permisos operativos asignados.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}

                {filteredRoles.length === 0 && (
                    <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-gray-300">
                        <span className="text-4xl block mb-2">🤷‍♂️</span>
                        <p className="text-gray-500 font-medium">
                            {searchTerm ? `No se encontraron roles que coincidan con "${searchTerm}".` : 'No se encontraron roles creados.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
