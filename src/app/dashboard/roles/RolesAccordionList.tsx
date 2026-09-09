'use client'

import { useState, useMemo, useRef } from 'react'
import EditRoleForm from './EditRoleForm'
import CopyRoleForm from './CopyRoleForm'
import RolePermissionList from './RolePermissionList'
import { RoleUsersPopup, RolePermissionsPopup, RoleUser, PermissionDef } from './RoleHoverPopups'

type RoleItem = {
    id: string
    name: string
    description: string | null
    permissions: string
    _count?: {
        users: number
    }
    users?: RoleUser[]
}

interface Props {
    roles: RoleItem[]
    availablePermissions: PermissionDef[]
}

export default function RolesAccordionList({ roles, availablePermissions }: Props) {
    const [openRoles, setOpenRoles] = useState<Record<string, boolean>>({})
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'with-users' | 'no-users'>('all')

    // Popups flotantes al hacer hover
    const [activeUsersPopup, setActiveUsersPopup] = useState<{
        roleName: string
        users: RoleUser[]
        rect: DOMRect | null
    } | null>(null)

    const [activePermsPopup, setActivePermsPopup] = useState<{
        roleName: string
        rolePerms: string[]
        rect: DOMRect | null
    } | null>(null)

    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const clearCloseTimeout = () => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current)
            closeTimeoutRef.current = null
        }
    }

    const scheduleClosePopups = () => {
        clearCloseTimeout()
        closeTimeoutRef.current = setTimeout(() => {
            setActiveUsersPopup(null)
            setActivePermsPopup(null)
        }, 180)
    }

    const handleUsersBadgeEnter = (e: React.MouseEvent<HTMLElement>, role: RoleItem) => {
        clearCloseTimeout()
        setActivePermsPopup(null)
        const rect = e.currentTarget.getBoundingClientRect()
        setActiveUsersPopup({
            roleName: role.name,
            users: role.users || [],
            rect
        })
    }

    const handlePermsBadgeEnter = (e: React.MouseEvent<HTMLElement>, role: RoleItem, rolePerms: string[]) => {
        clearCloseTimeout()
        setActiveUsersPopup(null)
        const rect = e.currentTarget.getBoundingClientRect()
        setActivePermsPopup({
            roleName: role.name,
            rolePerms,
            rect
        })
    }

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

    // Ordenamiento alfabético estricto en español (A - Z)
    const sortedRoles = useMemo(() => {
        return [...roles].sort((a, b) => 
            a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true })
        )
    }, [roles])

    // Conteo para las pestañas de filtro
    const filterCounts = useMemo(() => {
        const withUsers = sortedRoles.filter(r => (r.users ? r.users.length : (r._count?.users ?? 0)) > 0).length
        const noUsers = sortedRoles.length - withUsers
        return { all: sortedRoles.length, withUsers, noUsers }
    }, [sortedRoles])

    // Filtrado según término de búsqueda y pestaña seleccionada
    const filteredRoles = useMemo(() => {
        return sortedRoles.filter(r => {
            const userCount = r.users ? r.users.length : (r._count?.users ?? 0)
            if (filterType === 'with-users' && userCount === 0) return false
            if (filterType === 'no-users' && userCount > 0) return false

            if (!searchTerm.trim()) return true
            const term = searchTerm.toLowerCase()
            return (
                r.name.toLowerCase().includes(term) || 
                (r.description && r.description.toLowerCase().includes(term))
            )
        })
    }, [sortedRoles, searchTerm, filterType])

    return (
        <div className="space-y-4">
            {/* Barra de Control: Pestañas de Filtro, Buscador y Acciones */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-3">
                <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
                    {/* Filtros por Pestañas */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto shrink-0">
                        <button
                            type="button"
                            onClick={() => setFilterType('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                filterType === 'all'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>Todos</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700">
                                {filterCounts.all}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterType('with-users')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                filterType === 'with-users'
                                    ? 'bg-cyan-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-cyan-700'
                            }`}
                        >
                            <span>En Uso</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                filterType === 'with-users' ? 'bg-cyan-700 text-white' : 'bg-slate-200/80 text-slate-700'
                            }`}>
                                {filterCounts.withUsers}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterType('no-users')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                filterType === 'no-users'
                                    ? 'bg-slate-800 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>Vacantes</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                filterType === 'no-users' ? 'bg-slate-700 text-white' : 'bg-slate-200/80 text-slate-700'
                            }`}>
                                {filterCounts.noUsers}
                            </span>
                        </button>
                    </div>

                    {/* Buscador */}
                    <div className="relative flex-1 max-w-md">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar perfil por nombre o descripción..."
                            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm text-slate-800 transition-all placeholder:text-slate-400"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-200 rounded-full w-4 h-4 flex items-center justify-center"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Botones de Expansión Colectiva */}
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
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
                    const userCount = role.users ? role.users.length : (role._count?.users ?? 0)
                    const coveragePct = Math.round((activePermsCount / (availablePermissions.length || 1)) * 100)

                    return (
                        <div
                            key={role.id}
                            className={`bg-white rounded-2xl shadow-sm border transition-all duration-200 overflow-hidden ${
                                isExpanded
                                    ? 'border-cyan-300 ring-2 ring-cyan-500/15 shadow-md'
                                    : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md'
                            }`}
                        >
                            {/* Header del Acordeón (Clickable) */}
                            <div
                                onClick={() => toggleRole(role.id)}
                                className={`p-4 sm:p-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors select-none ${
                                    isExpanded ? 'bg-gradient-to-r from-slate-50 via-white to-cyan-50/40' : 'hover:bg-slate-50/70'
                                }`}
                            >
                                <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                                    <div className={`p-2.5 rounded-xl text-lg shrink-0 transition-all ${
                                        isExpanded 
                                            ? 'bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-sm shadow-cyan-500/30' 
                                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                                    }`}>
                                        🛡️
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-base font-bold text-slate-900 truncate">
                                                {role.name}
                                            </h3>

                                            {/* Badge 1: Conteo de Usuarios con Popup al hacer Hover */}
                                            <div
                                                className="inline-flex items-center"
                                                onMouseEnter={(e) => handleUsersBadgeEnter(e, role)}
                                                onMouseLeave={scheduleClosePopups}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <span 
                                                    title="Pasa el cursor para ver usuarios asociados"
                                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border transition-all cursor-help shadow-2xs ${
                                                        userCount > 0
                                                            ? 'bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100 hover:border-cyan-300'
                                                            : 'bg-slate-100 text-slate-500 border-slate-200'
                                                    }`}
                                                >
                                                    <span>👥</span>
                                                    <span>{userCount} {userCount === 1 ? 'Usuario' : 'Usuarios'}</span>
                                                </span>
                                            </div>

                                            {/* Badge 2: Accesos y Módulos con Popup al hacer Hover */}
                                            <div
                                                className="inline-flex items-center"
                                                onMouseEnter={(e) => handlePermsBadgeEnter(e, role, rolePerms)}
                                                onMouseLeave={scheduleClosePopups}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <span 
                                                    title="Pasa el cursor para ver detalles de permisos"
                                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 hover:border-slate-300 transition-all cursor-help shadow-2xs"
                                                >
                                                    <span>🔑</span>
                                                    <span>{activePermsCount} / {availablePermissions.length} accesos</span>
                                                </span>
                                            </div>

                                            {/* Mini Barra de Cobertura */}
                                            <div 
                                                className="hidden xl:inline-flex items-center gap-1.5 ml-1"
                                                title={`Cobertura de privilegios: ${coveragePct}% (${activePermsCount} de ${availablePermissions.length})`}
                                            >
                                                <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                                                    <div 
                                                        className="bg-gradient-to-r from-cyan-500 to-sky-600 h-full rounded-full transition-all"
                                                        style={{ width: `${coveragePct}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400">{coveragePct}%</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                                            {role.description || 'Sin descripción configurada.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <EditRoleForm role={role} availablePermissions={availablePermissions} />
                                        <CopyRoleForm role={role} />
                                    </div>

                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs text-slate-400 bg-slate-50 border border-slate-200 transition-transform duration-200 ${
                                        isExpanded ? 'rotate-180 bg-cyan-50 border-cyan-200 text-cyan-600 font-bold' : ''
                                    }`}>
                                        ▼
                                    </div>
                                </div>
                            </div>

                            {/* Contenido Expandible del Acordeón */}
                            {isExpanded && (
                                <div className="px-5 pb-5 pt-3 border-t border-slate-100 bg-slate-50/50 animate-in fade-in-50 slide-in-from-top-2 duration-200">
                                    {role.description && (
                                        <div className="mb-4 p-3 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2">
                                            <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider shrink-0 mt-0.5">Descripción:</span>
                                            <span>{role.description}</span>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                                <span>🔒</span> Matriz de Permisos Concedidos
                                            </p>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                Haz clic en cualquier grupo para desplegar u ocultar los permisos
                                            </span>
                                        </div>

                                        {rolePerms.length > 0 ? (
                                            <RolePermissionList 
                                                rolePerms={rolePerms} 
                                                availablePermissions={availablePermissions} 
                                            />
                                        ) : (
                                            <div className="p-4 text-center bg-white rounded-xl border border-dashed border-slate-300">
                                                <p className="text-xs text-slate-400 italic">No tiene permisos operativos asignados.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}

                {filteredRoles.length === 0 && (
                    <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                        <span className="text-4xl block mb-2">🔍</span>
                        <p className="text-slate-600 font-medium">
                            {searchTerm ? `No se encontraron perfiles que coincidan con "${searchTerm}".` : 'No hay perfiles disponibles para este filtro.'}
                        </p>
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="mt-2 text-xs font-bold text-cyan-600 hover:text-cyan-700 underline"
                            >
                                Limpiar término de búsqueda
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* POPUPS FLOTANTES (PORTAL) */}
            <RoleUsersPopup
                isOpen={!!activeUsersPopup}
                roleName={activeUsersPopup?.roleName || ''}
                users={activeUsersPopup?.users || []}
                anchorRect={activeUsersPopup?.rect || null}
                onMouseEnter={clearCloseTimeout}
                onMouseLeave={scheduleClosePopups}
            />

            <RolePermissionsPopup
                isOpen={!!activePermsPopup}
                roleName={activePermsPopup?.roleName || ''}
                rolePerms={activePermsPopup?.rolePerms || []}
                availablePermissions={availablePermissions}
                anchorRect={activePermsPopup?.rect || null}
                onMouseEnter={clearCloseTimeout}
                onMouseLeave={scheduleClosePopups}
            />
        </div>
    )
}
