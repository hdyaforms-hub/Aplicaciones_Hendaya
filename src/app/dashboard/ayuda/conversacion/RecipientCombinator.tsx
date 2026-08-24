'use client'

import React, { useState, useMemo } from 'react'

export interface CombinatorUser {
    id?: string
    username: string
    name: string
    role?: string
    sucursales?: string[]
}

interface RecipientCombinatorProps {
    users: CombinatorUser[]
    currentUsername: string
    selectedUsernames: string[]
    onSelectionChange: (newSelected: string[], suggestedTitle?: string) => void
    title?: string
    subtitle?: string
}

export default function RecipientCombinator({
    users,
    currentUsername,
    selectedUsernames,
    onSelectionChange,
    title = 'Segmentación Avanzada por Sucursal y Rol',
    subtitle = 'Combina una o varias sucursales con uno o varios roles para seleccionar exactamente a tu audiencia.'
}: RecipientCombinatorProps) {
    const [selectedBranches, setSelectedBranches] = useState<string[]>([])
    const [selectedRoles, setSelectedRoles] = useState<string[]>([])
    const [searchTerm, setSearchTerm] = useState('')

    // Obtener lista única de sucursales disponibles
    const allBranches = useMemo(() => {
        const set = new Set<string>()
        users.forEach(u => {
            if (Array.isArray(u.sucursales)) {
                u.sucursales.forEach(s => s && set.add(s))
            }
        })
        return Array.from(set).sort()
    }, [users])

    // Obtener lista única de roles disponibles
    const allRoles = useMemo(() => {
        const set = new Set<string>()
        users.forEach(u => {
            if (u.role) set.add(u.role)
        })
        return Array.from(set).sort()
    }, [users])

    // Usuarios que coinciden con los filtros de Sucursal y Rol seleccionados
    const matchingUsers = useMemo(() => {
        return users.filter(u => {
            if (u.username === currentUsername) return false

            // Filtro por sucursales
            let matchBranch = true
            if (selectedBranches.length > 0) {
                const userBranches = u.sucursales || []
                matchBranch = selectedBranches.some(sb =>
                    userBranches.some(ub => ub.toLowerCase() === sb.toLowerCase())
                )
            }

            // Filtro por roles
            let matchRole = true
            if (selectedRoles.length > 0) {
                const userRole = (u.role || '').toLowerCase()
                matchRole = selectedRoles.some(sr => sr.toLowerCase() === userRole)
            }

            return matchBranch && matchRole
        })
    }, [users, currentUsername, selectedBranches, selectedRoles])

    // Generador de título descriptivo sugerido según los filtros activos
    const generateSuggestedTitle = (roles: string[], branches: string[]): string => {
        let rolePart = ''
        if (roles.length === 1) {
            rolePart = `${roles[0]}s`
        } else if (roles.length > 1) {
            rolePart = roles.slice(0, 2).map(r => `${r}s`).join(' y ')
            if (roles.length > 2) rolePart += ` (+${roles.length - 2})`
        }

        let branchPart = ''
        if (branches.length === 1) {
            branchPart = branches[0]
        } else if (branches.length > 1) {
            branchPart = branches.slice(0, 2).join(' & ')
            if (branches.length > 2) branchPart += ` (+${branches.length - 2})`
        }

        if (rolePart && branchPart) return `${rolePart} - ${branchPart}`
        if (rolePart) return `Equipo de ${rolePart}`
        if (branchPart) return `Equipo ${branchPart}`
        return 'Equipo Colaborativo'
    }

    // Toggle de sucursal
    const toggleBranch = (branch: string) => {
        const next = selectedBranches.includes(branch)
            ? selectedBranches.filter(b => b !== branch)
            : [...selectedBranches, branch]
        setSelectedBranches(next)
    }

    // Toggle de rol
    const toggleRole = (role: string) => {
        const next = selectedRoles.includes(role)
            ? selectedRoles.filter(r => r !== role)
            : [...selectedRoles, role]
        setSelectedRoles(next)
    }

    // Aplicar selección en masa de los coincidentes
    const handleAddAllMatching = () => {
        const matchingUsernames = matchingUsers.map(u => u.username)
        const combined = Array.from(new Set([...selectedUsernames, ...matchingUsernames]))
        const suggested = generateSuggestedTitle(selectedRoles, selectedBranches)
        onSelectionChange(combined, suggested)
    }

    // Seleccionar ÚNICAMENTE los coincidentes del filtro
    const handleSelectOnlyMatching = () => {
        const matchingUsernames = matchingUsers.map(u => u.username)
        const suggested = generateSuggestedTitle(selectedRoles, selectedBranches)
        onSelectionChange(matchingUsernames, suggested)
    }

    // Desmarcar los coincidentes
    const handleRemoveAllMatching = () => {
        const matchingUsernames = matchingUsers.map(u => u.username)
        const filtered = selectedUsernames.filter(u => !matchingUsernames.includes(u))
        onSelectionChange(filtered)
    }

    // Toggle individual de usuario
    const toggleIndividualUser = (username: string) => {
        const next = selectedUsernames.includes(username)
            ? selectedUsernames.filter(u => u !== username)
            : [...selectedUsernames, username]
        onSelectionChange(next)
    }

    // Usuarios visibles en la lista con filtro de texto
    const visibleUsers = useMemo(() => {
        const term = searchTerm.toLowerCase().trim()
        if (!term) return matchingUsers
        return matchingUsers.filter(u =>
            u.name.toLowerCase().includes(term) ||
            u.username.toLowerCase().includes(term) ||
            (u.role && u.role.toLowerCase().includes(term))
        )
    }, [matchingUsers, searchTerm])

    return (
        <div className="space-y-4 bg-slate-50/80 p-4 sm:p-5 rounded-3xl border border-slate-200/80">
            {/* Cabecera */}
            <div>
                <div className="flex items-center gap-2">
                    <span className="text-base">🎯</span>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900">{title}</h4>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>
            </div>

            {/* 1. SECTOR DE SUCURSALES */}
            <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black text-cyan-900 uppercase tracking-wider flex items-center gap-1">
                        <span>🏢</span> 1. Filtra por Sucursales ({selectedBranches.length > 0 ? `${selectedBranches.length} seleccionadas` : 'Todas'}):
                    </span>
                    {selectedBranches.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setSelectedBranches([])}
                            className="text-[10px] font-bold text-cyan-600 hover:underline cursor-pointer"
                        >
                            Limpiar sucursales
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    <button
                        type="button"
                        onClick={() => setSelectedBranches([])}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                            selectedBranches.length === 0
                                ? 'bg-cyan-700 text-white border-cyan-700 shadow-xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-cyan-50'
                        }`}
                    >
                        🌐 Todas las sucursales
                    </button>
                    {allBranches.map(branch => {
                        const isSelected = selectedBranches.includes(branch)
                        const countInBranch = users.filter(u => (u.sucursales || []).includes(branch)).length
                        return (
                            <button
                                key={branch}
                                type="button"
                                onClick={() => toggleBranch(branch)}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                    isSelected
                                        ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs ring-2 ring-cyan-300/50'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-cyan-50/80 hover:border-cyan-200'
                                }`}
                            >
                                <span>{isSelected ? '✓' : '🏢'}</span>
                                <span>{branch}</span>
                                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-cyan-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    {countInBranch}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 2. SECTOR DE ROLES / CARGOS */}
            <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                        <span>🛡️</span> 2. Filtra por Roles / Cargos ({selectedRoles.length > 0 ? `${selectedRoles.length} seleccionados` : 'Todos'}):
                    </span>
                    {selectedRoles.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setSelectedRoles([])}
                            className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                        >
                            Limpiar roles
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    <button
                        type="button"
                        onClick={() => setSelectedRoles([])}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                            selectedRoles.length === 0
                                ? 'bg-indigo-700 text-white border-indigo-700 shadow-xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50'
                        }`}
                    >
                        👥 Todos los roles
                    </button>
                    {allRoles.map(role => {
                        const isSelected = selectedRoles.includes(role)
                        const countInRole = users.filter(u => u.role === role).length
                        return (
                            <button
                                key={role}
                                type="button"
                                onClick={() => toggleRole(role)}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                    isSelected
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-300/50'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50/80 hover:border-indigo-200'
                                }`}
                            >
                                <span>{isSelected ? '✓' : '🛡️'}</span>
                                <span className="capitalize">{role}</span>
                                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    {countInRole}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 3. RESUMEN DE COINCIDENCIAS Y ACCIONES EN MASA */}
            <div className="p-3 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-800 font-black text-sm flex items-center justify-center">
                        {matchingUsers.length}
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-900">
                            {matchingUsers.length} {matchingUsers.length === 1 ? 'usuario coincide' : 'usuarios coinciden'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                            {selectedUsernames.filter(u => matchingUsers.some(m => m.username === u)).length} ya seleccionados de este grupo
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    <button
                        type="button"
                        onClick={handleAddAllMatching}
                        disabled={matchingUsers.length === 0}
                        className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white rounded-xl text-[11px] font-bold shadow-xs transition-all cursor-pointer"
                    >
                        ➕ Añadir Coincidentes
                    </button>
                    <button
                        type="button"
                        onClick={handleSelectOnlyMatching}
                        disabled={matchingUsers.length === 0}
                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-[11px] font-bold shadow-xs transition-all cursor-pointer"
                    >
                        🎯 Solo Coincidentes
                    </button>
                    <button
                        type="button"
                        onClick={handleRemoveAllMatching}
                        disabled={matchingUsers.length === 0}
                        className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                    >
                        Desmarcar
                    </button>
                </div>
            </div>

            {/* 4. LISTA DE USUARIOS CON CHECKBOX INDIVIDUAL */}
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                        Revisa o ajusta usuarios individualmente ({selectedUsernames.length} elegidos en total):
                    </span>
                    {selectedUsernames.length > 0 && (
                        <button
                            type="button"
                            onClick={() => onSelectionChange([])}
                            className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                            Limpiar todos ({selectedUsernames.length})
                        </button>
                    )}
                </div>

                {/* Input de filtro de texto */}
                <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar dentro de este grupo por nombre o usuario..."
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-cyan-400 outline-none"
                />

                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 bg-white p-2 rounded-2xl border border-slate-200">
                    {visibleUsers.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-3">
                            No hay usuarios que coincidan con la combinación seleccionada.
                        </p>
                    ) : (
                        visibleUsers.map(user => {
                            const isChecked = selectedUsernames.includes(user.username)
                            const branchLabel = (user.sucursales || []).join(', ') || 'Sin sucursal'
                            return (
                                <label
                                    key={user.username}
                                    className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition-all ${
                                        isChecked
                                            ? 'bg-cyan-50/90 border-cyan-300 text-cyan-950 shadow-2xs'
                                            : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-6 h-6 rounded-lg text-white font-bold text-[10px] flex items-center justify-center shrink-0 ${isChecked ? 'bg-cyan-700' : 'bg-slate-700'}`}>
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold truncate leading-tight">{user.name}</p>
                                            <p className="text-[10px] text-slate-400 truncate">
                                                @{user.username} • <span className="text-indigo-600 font-semibold">{user.role}</span> • <span className="text-cyan-700">{branchLabel}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleIndividualUser(user.username)}
                                        className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer shrink-0 ml-2"
                                    />
                                </label>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
