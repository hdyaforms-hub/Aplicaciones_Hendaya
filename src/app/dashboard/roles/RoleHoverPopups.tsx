'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'

export type RoleUser = {
    id: string
    name: string | null
    username: string
    email: string | null
    isActive: boolean
}

export type PermissionDef = {
    id: string
    name: string
    description: string
    category: string
}

interface PositionCoords {
    top: number
    left: number
    placement: 'bottom' | 'top'
}

function calculatePopupPosition(rect: DOMRect | null, popupWidth: number, estimatedHeight: number): PositionCoords {
    if (!rect || typeof window === 'undefined') {
        return { top: 0, left: 0, placement: 'bottom' }
    }

    const margin = 12
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Calculo horizontal
    let left = rect.left
    if (left + popupWidth > vw - margin) {
        left = Math.max(margin, vw - popupWidth - margin)
    }
    if (left < margin) {
        left = margin
    }

    // Calculo vertical (abajo por defecto, arriba si no cabe)
    const spaceBelow = vh - rect.bottom
    const spaceAbove = rect.top
    let top = rect.bottom + 8
    let placement: 'bottom' | 'top' = 'bottom'

    if (spaceBelow < estimatedHeight + margin && spaceAbove > estimatedHeight + margin) {
        top = Math.max(margin, rect.top - estimatedHeight - 8)
        placement = 'top'
    } else if (top + estimatedHeight > vh - margin) {
        top = Math.max(margin, vh - estimatedHeight - margin)
    }

    return { top, left, placement }
}

// -------------------------------------------------------------
// POPUP 1: USUARIOS ASOCIADOS AL ROL
// -------------------------------------------------------------
interface RoleUsersPopupProps {
    isOpen: boolean
    roleName: string
    users: RoleUser[]
    anchorRect: DOMRect | null
    onMouseEnter: () => void
    onMouseLeave: () => void
}

export function RoleUsersPopup({
    isOpen,
    roleName,
    users,
    anchorRect,
    onMouseEnter,
    onMouseLeave
}: RoleUsersPopupProps) {
    const [mounted, setMounted] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const popupRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    const filteredUsers = useMemo(() => {
        if (!searchTerm.trim()) return users
        const term = searchTerm.toLowerCase()
        return users.filter(u => 
            (u.name && u.name.toLowerCase().includes(term)) ||
            u.username.toLowerCase().includes(term) ||
            (u.email && u.email.toLowerCase().includes(term))
        )
    }, [users, searchTerm])

    if (!mounted || !isOpen || !anchorRect) return null

    const width = Math.min(360, window.innerWidth - 24)
    const estimatedHeight = 320
    const { top, left } = calculatePopupPosition(anchorRect, width, estimatedHeight)

    const content = (
        <div
            ref={popupRef}
            style={{
                position: 'fixed',
                top: `${top}px`,
                left: `${left}px`,
                width: `${width}px`,
                zIndex: 9999
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={(e) => e.stopPropagation()}
            className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/90 text-slate-800 p-4 animate-in fade-in zoom-in-95 duration-150 select-none"
        >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white flex items-center justify-center text-sm font-bold shadow-sm shrink-0">
                        👥
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-xs font-bold text-gray-900 truncate">
                            Usuarios Asignados
                        </h4>
                        <p className="text-[11px] text-cyan-700 font-semibold truncate">
                            Rol: {roleName}
                        </p>
                    </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-50 text-cyan-800 border border-cyan-200 shrink-0">
                    {users.length} {users.length === 1 ? 'Usuario' : 'Usuarios'}
                </span>
            </div>

            {/* Buscador interno si hay más de 3 usuarios */}
            {users.length > 3 && (
                <div className="mt-2.5 mb-1.5 relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por nombre o usuario..."
                        className="w-full pl-7 pr-3 py-1 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500 text-gray-800"
                    />
                </div>
            )}

            {/* Listado de Usuarios */}
            <div className="mt-2.5 max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-gray-50">
                {filteredUsers.map((user) => {
                    const initials = (user.name || user.username || 'U')
                        .split(' ')
                        .map(n => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()

                    return (
                        <div
                            key={user.id}
                            className="pt-1.5 first:pt-0 flex items-center justify-between gap-2.5 p-1.5 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="w-7 h-7 rounded-full bg-cyan-100 text-cyan-800 font-bold flex items-center justify-center text-[10px] shrink-0 border border-cyan-200">
                                    {initials}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-gray-900 truncate">
                                        {user.name || user.username}
                                    </p>
                                    <p className="text-[10px] text-gray-400 font-mono truncate">
                                        @{user.username} {user.email ? `· ${user.email}` : ''}
                                    </p>
                                </div>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                                user.isActive
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                                {user.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>
                    )
                })}

                {users.length === 0 && (
                    <div className="py-6 text-center text-gray-400 text-xs">
                        <span className="text-2xl block mb-1">👤</span>
                        No hay usuarios asignados a este rol.
                    </div>
                )}

                {users.length > 0 && filteredUsers.length === 0 && (
                    <div className="py-4 text-center text-gray-400 text-xs">
                        No se encontraron usuarios que coincidan con &quot;{searchTerm}&quot;.
                    </div>
                )}
            </div>

            {/* Footer */}
            {users.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-500">
                    <span>Vigentes en el sistema</span>
                    <span className="font-semibold text-cyan-700">{users.filter(u => u.isActive).length} activos</span>
                </div>
            )}
        </div>
    )

    return createPortal(content, document.body)
}

// -------------------------------------------------------------
// POPUP 2: MÓDULOS ASOCIADOS Y DESASOCIADOS
// -------------------------------------------------------------
interface RolePermissionsPopupProps {
    isOpen: boolean
    roleName: string
    rolePerms: string[]
    availablePermissions: PermissionDef[]
    anchorRect: DOMRect | null
    onMouseEnter: () => void
    onMouseLeave: () => void
}

export function RolePermissionsPopup({
    isOpen,
    roleName,
    rolePerms,
    availablePermissions,
    anchorRect,
    onMouseEnter,
    onMouseLeave
}: RolePermissionsPopupProps) {
    const [mounted, setMounted] = useState(false)
    const [viewMode, setViewMode] = useState<'both' | 'associated' | 'unassociated'>('both')
    const [searchTerm, setSearchTerm] = useState('')
    const popupRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    const { associated, unassociated } = useMemo(() => {
        const assoc: PermissionDef[] = []
        const unassoc: PermissionDef[] = []

        availablePermissions.forEach(p => {
            if (rolePerms.includes(p.id)) {
                assoc.push(p)
            } else {
                unassoc.push(p)
            }
        })

        return { associated: assoc, unassociated: unassoc }
    }, [rolePerms, availablePermissions])

    const filterPerms = (list: PermissionDef[]) => {
        if (!searchTerm.trim()) return list
        const term = searchTerm.toLowerCase()
        return list.filter(p => 
            p.name.toLowerCase().includes(term) ||
            p.category.toLowerCase().includes(term) ||
            p.description.toLowerCase().includes(term)
        )
    }

    const filteredAssociated = useMemo(() => filterPerms(associated), [associated, searchTerm])
    const filteredUnassociated = useMemo(() => filterPerms(unassociated), [unassociated, searchTerm])

    if (!mounted || !isOpen || !anchorRect) return null

    const width = Math.min(680, window.innerWidth - 24)
    const estimatedHeight = 440
    const { top, left } = calculatePopupPosition(anchorRect, width, estimatedHeight)
    const coveragePercent = availablePermissions.length > 0 
        ? Math.round((associated.length / availablePermissions.length) * 100) 
        : 0

    const content = (
        <div
            ref={popupRef}
            style={{
                position: 'fixed',
                top: `${top}px`,
                left: `${left}px`,
                width: `${width}px`,
                zIndex: 9999
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={(e) => e.stopPropagation()}
            className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/90 text-slate-800 p-4 sm:p-5 animate-in fade-in zoom-in-95 duration-150 select-none max-w-[95vw]"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-600 text-white flex items-center justify-center text-sm font-bold shadow-sm shrink-0">
                        🛡️
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 truncate">
                            Módulos y Accesos del Sistema
                        </h4>
                        <p className="text-xs text-indigo-600 font-semibold truncate">
                            Rol: {roleName}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span>✓</span> {associated.length} Asociados
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                        <span>✕</span> {unassociated.length} Desasociados
                    </span>
                </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mt-3 mb-3">
                {/* Segmented control */}
                <div className="flex items-center bg-gray-100 p-0.5 rounded-xl text-xs font-semibold self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => setViewMode('both')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                            viewMode === 'both' 
                                ? 'bg-white text-gray-900 shadow-xs font-bold' 
                                : 'text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        Ambos ({availablePermissions.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('associated')}
                        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                            viewMode === 'associated' 
                                ? 'bg-emerald-500 text-white shadow-xs font-bold' 
                                : 'text-emerald-700 hover:text-emerald-800'
                        }`}
                    >
                        <span>✓</span> Asociados ({associated.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('unassociated')}
                        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                            viewMode === 'unassociated' 
                                ? 'bg-slate-700 text-white shadow-xs font-bold' 
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <span>✕</span> Desasociados ({unassociated.length})
                    </button>
                </div>

                {/* Input de Búsqueda */}
                <div className="relative flex-1 sm:max-w-xs">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar módulo por nombre..."
                        className="w-full pl-7 pr-3 py-1 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-800"
                    />
                </div>
            </div>

            {/* Contenedor Principal de Módulos */}
            <div className="mt-1 max-h-72 overflow-y-auto pr-1">
                {viewMode === 'both' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Columna Asociados */}
                        <div className="space-y-1.5 bg-emerald-50/40 p-2.5 rounded-2xl border border-emerald-100">
                            <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200/60 text-emerald-800 font-bold text-xs">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    Módulos Asociados
                                </span>
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-extrabold">
                                    {filteredAssociated.length}
                                </span>
                            </div>
                            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                {filteredAssociated.map(p => (
                                    <div 
                                        key={p.id} 
                                        className="p-1.5 bg-white rounded-xl border border-emerald-100/80 shadow-2xs hover:border-emerald-300 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-1.5">
                                            <span className="text-xs font-bold text-emerald-950 truncate flex items-center gap-1">
                                                <span className="text-emerald-600 text-[11px]">✓</span> {p.name}
                                            </span>
                                            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                                                {p.category.split('->').pop()?.trim() || p.category}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">
                                            {p.description}
                                        </p>
                                    </div>
                                ))}
                                {filteredAssociated.length === 0 && (
                                    <p className="text-center text-xs text-emerald-600/70 italic py-4">
                                        Sin módulos asociados coincidentes.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Columna Desasociados */}
                        <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
                            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 text-slate-700 font-bold text-xs">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                    Módulos Desasociados
                                </span>
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full font-extrabold">
                                    {filteredUnassociated.length}
                                </span>
                            </div>
                            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                {filteredUnassociated.map(p => (
                                    <div 
                                        key={p.id} 
                                        className="p-1.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs hover:border-slate-300 transition-colors opacity-80 hover:opacity-100"
                                    >
                                        <div className="flex items-center justify-between gap-1.5">
                                            <span className="text-xs font-semibold text-slate-700 truncate flex items-center gap-1">
                                                <span className="text-slate-400 text-[10px]">✕</span> {p.name}
                                            </span>
                                            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                                                {p.category.split('->').pop()?.trim() || p.category}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">
                                            {p.description}
                                        </p>
                                    </div>
                                ))}
                                {filteredUnassociated.length === 0 && (
                                    <p className="text-center text-xs text-slate-500 italic py-4">
                                        Sin módulos desasociados coincidentes.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'associated' && (
                    <div className="space-y-1.5">
                        {filteredAssociated.map(p => (
                            <div 
                                key={p.id} 
                                className="p-2 bg-emerald-50/40 rounded-xl border border-emerald-100 flex items-center justify-between gap-3 hover:border-emerald-200 transition-colors"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-emerald-600 font-bold text-xs">✓</span>
                                        <h5 className="text-xs font-bold text-gray-900 truncate">{p.name}</h5>
                                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                            {p.category}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-0.5">{p.description}</p>
                                </div>
                                <span className="text-[10px] font-extrabold text-emerald-700 bg-white border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                                    Habilitado
                                </span>
                            </div>
                        ))}
                        {filteredAssociated.length === 0 && (
                            <div className="py-8 text-center text-gray-400 text-xs">
                                No se encontraron módulos asociados con ese criterio.
                            </div>
                        )}
                    </div>
                )}

                {viewMode === 'unassociated' && (
                    <div className="space-y-1.5">
                        {filteredUnassociated.map(p => (
                            <div 
                                key={p.id} 
                                className="p-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 font-bold text-xs">✕</span>
                                        <h5 className="text-xs font-semibold text-gray-800 truncate">{p.name}</h5>
                                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                                            {p.category}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-0.5">{p.description}</p>
                                </div>
                                <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full shrink-0">
                                    No asignado
                                </span>
                            </div>
                        ))}
                        {filteredUnassociated.length === 0 && (
                            <div className="py-8 text-center text-gray-400 text-xs">
                                No se encontraron módulos desasociados con ese criterio.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer con Porcentaje de Cobertura */}
            <div className="mt-3.5 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2 flex-1">
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden max-w-[140px]">
                        <div 
                            className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${coveragePercent}%` }}
                        />
                    </div>
                    <span className="text-[11px] font-bold text-gray-600">
                        {coveragePercent}% de cobertura global
                    </span>
                </div>
                <span className="text-[10px] text-gray-400">
                    Total {availablePermissions.length} permisos
                </span>
            </div>
        </div>
    )

    return createPortal(content, document.body)
}
