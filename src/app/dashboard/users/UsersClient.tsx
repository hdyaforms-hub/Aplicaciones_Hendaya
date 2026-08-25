'use client'

import { useState } from 'react'
import UserForm from './UserForm'
import EditUserForm from './EditUserForm'

interface UserWithRelations {
    id: string
    username: string
    email: string | null
    name: string | null
    roleId: string
    isActive: boolean
    canReceiveCollab?: boolean
    isDeleted: boolean
    createdAt: Date | string
    role: {
        id: string
        name: string
    }
    sucursales: {
        id: string
        nombre: string
    }[]
    areas: {
        id: number
        nombre: string
    }[]
    licitaciones?: {
        licId: number
        licitacionHomologada?: string | null
    }[]
}

interface RoleDef {
    id: string
    name: string
}

interface SucursalDef {
    id: string
    nombre: string
}

interface AreaDef {
    id: number
    nombre: string
}

interface LicitacionDef {
    licId: number
    estado: number
    licitacionHomologada?: string | null
}

interface UsersClientProps {
    initialUsers: UserWithRelations[]
    roles: RoleDef[]
    sucursales: SucursalDef[]
    areas: AreaDef[]
    licitaciones?: LicitacionDef[]
}

type SortColumn = 'username' | 'name' | 'isActive' | 'createdAt' | 'sucursales' | 'licitaciones'
type SortDirection = 'asc' | 'desc'

export default function UsersClient({ initialUsers, roles, sucursales, areas, licitaciones = [] }: UsersClientProps) {
    const [collapsedRoles, setCollapsedRoles] = useState<Record<string, boolean>>({})
    const [sortConfig, setSortConfig] = useState<{ column: SortColumn; direction: SortDirection } | null>(null)

    const toggleRole = (roleName: string) => {
        setCollapsedRoles(prev => ({
            ...prev,
            [roleName]: !prev[roleName]
        }))
    }

    const toggleCollapseAll = (collapse: boolean) => {
        const uniqueRoles = Array.from(new Set(initialUsers.map(u => u.role.name)))
        const newState: Record<string, boolean> = {}
        uniqueRoles.forEach(rName => {
            newState[rName] = collapse
        })
        setCollapsedRoles(newState)
    }

    const handleSort = (column: SortColumn) => {
        let direction: SortDirection = 'asc'
        if (sortConfig && sortConfig.column === column && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ column, direction })
    }

    // Group and sort users
    const getGroupedAndSortedUsers = () => {
        const groups: Record<string, UserWithRelations[]> = {}
        
        initialUsers.forEach(user => {
            const roleName = user.role.name
            if (!groups[roleName]) {
                groups[roleName] = []
            }
            groups[roleName].push(user)
        })

        // Apply sorting to each group's array
        if (sortConfig) {
            const { column, direction } = sortConfig
            Object.keys(groups).forEach(roleName => {
                groups[roleName].sort((a, b) => {
                    let valA: any = ''
                    let valB: any = ''

                    if (column === 'username') {
                        valA = a.username.toLowerCase()
                        valB = b.username.toLowerCase()
                    } else if (column === 'name') {
                        valA = (a.name || '').toLowerCase()
                        valB = (b.name || '').toLowerCase()
                    } else if (column === 'isActive') {
                        valA = a.isActive ? 1 : 0
                        valB = b.isActive ? 1 : 0
                    } else if (column === 'createdAt') {
                        valA = new Date(a.createdAt).getTime()
                        valB = new Date(b.createdAt).getTime()
                    } else if (column === 'sucursales') {
                        valA = a.sucursales.map(s => s.nombre).sort().join(', ').toLowerCase()
                        valB = b.sucursales.map(s => s.nombre).sort().join(', ').toLowerCase()
                    } else if (column === 'licitaciones') {
                        valA = (a.licitaciones || []).map(l => l.licId).sort().join(', ')
                        valB = (b.licitaciones || []).map(l => l.licId).sort().join(', ')
                    }

                    if (valA < valB) return direction === 'asc' ? -1 : 1
                    if (valA > valB) return direction === 'asc' ? 1 : -1
                    return 0
                })
            })
        }

        return groups
    }

    const usersByRole = getGroupedAndSortedUsers()
    const sortedRoleNames = Object.keys(usersByRole).sort()

    const renderSortIcon = (column: SortColumn) => {
        if (!sortConfig || sortConfig.column !== column) {
            return <span className="ml-1 text-gray-300">⇅</span>
        }
        return sortConfig.direction === 'asc' 
            ? <span className="ml-1 text-cyan-600">▲</span> 
            : <span className="ml-1 text-cyan-600">▼</span>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>👥</span> Gestión de Usuarios
                    </h2>
                    <p className="text-gray-500 mt-1">Administra las cuentas y accesos al sistema</p>
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => toggleCollapseAll(false)}
                        className="px-3.5 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-sm"
                        title="Expandir todos los grupos"
                    >
                        📂 Mostrar Todos
                    </button>
                    <button
                        onClick={() => toggleCollapseAll(true)}
                        className="px-3.5 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-sm"
                        title="Colapsar todos los grupos"
                    >
                        📁 Ocultar Todos
                    </button>
                    <div className="sm:ml-2">
                        <UserForm roles={roles} sucursales={sucursales} areas={areas} licitaciones={licitaciones} />
                    </div>
                </div>
            </div>

            {/* List of Roles */}
            {sortedRoleNames.map(roleName => {
                const isCollapsed = !!collapsedRoles[roleName]
                const roleUsers = usersByRole[roleName]

                return (
                    <div key={roleName} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-200">
                        {/* Accordion Trigger Header */}
                        <div 
                            onClick={() => toggleRole(roleName)}
                            className="bg-slate-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors select-none group"
                        >
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <span>Rol:</span> 
                                <span className="text-cyan-700 font-extrabold">{roleName}</span> 
                                <span className="text-xs text-gray-400 font-normal">({roleUsers.length} usuarios)</span>
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isCollapsed ? 'Hacer clic para mostrar' : 'Hacer clic para ocultar'}
                                </span>
                                <span className={`text-slate-500 font-bold transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                                    ▼
                                </span>
                            </div>
                        </div>

                        {/* Collapsible Content */}
                        <div className={`transition-all duration-300 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[5000px] opacity-100'}`}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-white text-slate-600 border-b border-gray-100">
                                        <tr>
                                            <th 
                                                onClick={() => handleSort('username')}
                                                className="px-6 py-4 font-semibold cursor-pointer hover:text-cyan-700 hover:bg-slate-50/50 select-none transition-colors"
                                            >
                                                Usuario {renderSortIcon('username')}
                                            </th>
                                            <th 
                                                onClick={() => handleSort('name')}
                                                className="px-6 py-4 font-semibold cursor-pointer hover:text-cyan-700 hover:bg-slate-50/50 select-none transition-colors"
                                            >
                                                Nombre {renderSortIcon('name')}
                                            </th>
                                            <th 
                                                onClick={() => handleSort('isActive')}
                                                className="px-6 py-4 font-semibold cursor-pointer hover:text-cyan-700 hover:bg-slate-50/50 select-none transition-colors"
                                            >
                                                Estado {renderSortIcon('isActive')}
                                            </th>
                                            <th 
                                                onClick={() => handleSort('licitaciones')}
                                                className="px-6 py-4 font-semibold cursor-pointer hover:text-cyan-700 hover:bg-slate-50/50 select-none transition-colors"
                                            >
                                                Licitaciones {renderSortIcon('licitaciones')}
                                            </th>
                                            <th 
                                                onClick={() => handleSort('sucursales')}
                                                className="px-6 py-4 font-semibold cursor-pointer hover:text-cyan-700 hover:bg-slate-50/50 select-none transition-colors"
                                            >
                                                Sucursales {renderSortIcon('sucursales')}
                                            </th>
                                            <th 
                                                onClick={() => handleSort('createdAt')}
                                                className="px-6 py-4 font-semibold cursor-pointer hover:text-cyan-700 hover:bg-slate-50/50 select-none transition-colors"
                                            >
                                                Creado {renderSortIcon('createdAt')}
                                            </th>
                                            <th className="px-6 py-4 font-semibold text-right select-none">
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 text-gray-700">
                                        {roleUsers.map((u) => (
                                            <tr key={u.id} className="hover:bg-cyan-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-gray-900">{u.username}</div>
                                                    <div className="text-xs text-gray-400">{u.email || 'Sin correo'}</div>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-slate-800">{u.name || '-'}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        {u.isActive ? (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                Vigente
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                                                                No Vigente
                                                            </span>
                                                        )}
                                                        {u.canReceiveCollab ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200" title="Habilitado para recibir mensajes y tareas">
                                                                <span>💬</span> Conversación Activo
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-400 border border-slate-200" title="Deshabilitado en módulo Conversación">
                                                                <span>💬</span> Conversación Inactivo
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="max-w-[220px] truncate text-gray-700 text-xs font-medium" title={u.licitaciones && u.licitaciones.length > 0 ? u.licitaciones.map((l: any) => `Licitación ${l.licId}${l.licitacionHomologada ? ` (${l.licitacionHomologada})` : ''}`).join(', ') : 'Ninguna'}>
                                                        {u.licitaciones && u.licitaciones.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {u.licitaciones.map((l: any) => (
                                                                    <span key={l.licId} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200">
                                                                        Lic. {l.licId}{l.licitacionHomologada ? ` (${l.licitacionHomologada})` : ''}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 italic">Ninguna</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="max-w-[200px] truncate text-gray-500" title={u.sucursales.map((s: any) => s.nombre).join(', ')}>
                                                        {u.sucursales.length > 0 ? u.sucursales.map((s: any) => s.nombre).join(', ') : 'Ninguna'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 font-medium">
                                                    {new Date(u.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <EditUserForm user={u as any} roles={roles} sucursales={sucursales} areas={areas} licitaciones={licitaciones} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            })}

            {sortedRoleNames.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
                    No se encontraron usuarios registrados
                </div>
            )}
        </div>
    )
}
