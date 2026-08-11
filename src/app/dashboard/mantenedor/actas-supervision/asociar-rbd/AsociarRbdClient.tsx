'use client'

import { useState, useTransition } from 'react'
import { updateUserRbds, copyRbdsFromSupervisores } from './actions'

type User = {
    id: string
    name: string | null
    username: string
    email: string | null
    rbds: number[]
    role: {
        id: string
        name: string
    }
    sucursales: Array<{
        id: string
        nombre: string
    }>
}

type Role = {
    id: string
    name: string
}

type Colegio = {
    colRBD: number
    nombreEstablecimiento: string
    sucursal: string
    institucion: string
}

type Props = {
    initialUsers: User[]
    roles: Role[]
    colegios: Colegio[]
}

export default function AsociarRbdClient({ initialUsers, roles, colegios }: Props) {
    const [users, setUsers] = useState<User[]>(initialUsers)
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedRoles, setExpandedRoles] = useState<Record<string, boolean>>(
        roles.reduce((acc, r) => ({ ...acc, [r.id]: true }), {})
    )

    // Modal state
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [selectedRbds, setSelectedRbds] = useState<number[]>([])
    const [searchColegio, setSearchColegio] = useState('')
    const [selectedSucursal, setSelectedSucursal] = useState('')
    const [selectedInstitucion, setSelectedInstitucion] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    const [isPending, startTransition] = useTransition()

    // Filter users based on query
    const filteredUsers = users.filter(user => {
        const query = searchQuery.toLowerCase().trim()
        if (!query) return true
        return (
            (user.name && user.name.toLowerCase().includes(query)) ||
            user.username.toLowerCase().includes(query) ||
            (user.email && user.email.toLowerCase().includes(query))
        )
    })

    // Group users by role
    const usersByRole = roles.reduce<Record<string, User[]>>((acc, role) => {
        acc[role.id] = filteredUsers.filter(u => u.role.id === role.id)
        return acc
    }, {})

    const toggleRole = (roleId: string) => {
        setExpandedRoles(prev => ({ ...prev, [roleId]: !prev[roleId] }))
    }

    const handleOpenEdit = (user: User) => {
        setSelectedUser(user)
        setSelectedRbds([...user.rbds])
        setSearchColegio('')
        setSelectedSucursal('')
        setSelectedInstitucion('')
    }

    const handleCloseEdit = () => {
        setSelectedUser(null)
        setSelectedRbds([])
        setSelectedSucursal('')
        setSelectedInstitucion('')
    }

    const handleToggleRbd = (rbd: number) => {
        setSelectedRbds(prev => 
            prev.includes(rbd) ? prev.filter(r => r !== rbd) : [...prev, rbd]
        )
    }

    const handleSave = async () => {
        if (!selectedUser) return
        setIsSaving(true)
        const res = await updateUserRbds(selectedUser.id, selectedRbds)
        if (res.success) {
            setUsers(prev => 
                prev.map(u => u.id === selectedUser.id ? { ...u, rbds: selectedRbds } : u)
            )
            handleCloseEdit()
        } else {
            alert(res.error || 'Error al guardar los cambios')
        }
        setIsSaving(false)
    }

    const handleCopyFromSupervisores = () => {
        if (!confirm('¿Estás seguro de que deseas copiar las asociaciones de RBD de los supervisores? Esto agregará los RBDs correspondientes a los usuarios cuyos correos o nombres coincidan con los supervisores vigentes.')) {
            return
        }

        startTransition(async () => {
            const res = await copyRbdsFromSupervisores()
            if (res.success) {
                alert(`Sincronización completada exitosamente. Se actualizaron ${res.matchedCount} usuarios.`);
                window.location.reload()
            } else {
                alert(res.error || 'Ocurrió un error al sincronizar');
            }
        })
    }

    // Resolves school name
    const getColegioName = (rbd: number) => {
        const col = colegios.find(c => c.colRBD === rbd)
        return col ? col.nombreEstablecimiento : 'Establecimiento Desconocido'
    }

    // Get unique list of sucursales from colegios list
    const sucursalesList = Array.from(new Set(colegios.map(c => c.sucursal).filter(Boolean))).sort()

    // Get unique list of instituciones from colegios list
    const institucionesList = Array.from(new Set(colegios.map(c => c.institucion).filter(Boolean))).sort()

    // Filter colegios list in modal by search query, sucursal and institucion
    const filteredColegios = colegios.filter(c => {
        const q = searchColegio.toLowerCase().trim()
        const matchQuery = !q || c.colRBD.toString().includes(q) || c.nombreEstablecimiento.toLowerCase().includes(q)
        const matchSucursal = !selectedSucursal || c.sucursal === selectedSucursal
        const matchInstitucion = !selectedInstitucion || c.institucion === selectedInstitucion
        return matchQuery && matchSucursal && matchInstitucion
    })

    // Check if all filtered colegios are currently selected
    const allSelected = filteredColegios.length > 0 && filteredColegios.every(c => selectedRbds.includes(c.colRBD))

    // Toggle select all visible/filtered colegios
    const handleToggleSelectAll = () => {
        if (allSelected) {
            const filteredRbdIds = filteredColegios.map(c => c.colRBD)
            setSelectedRbds(prev => prev.filter(r => !filteredRbdIds.includes(r)))
        } else {
            const filteredRbdIds = filteredColegios.map(c => c.colRBD)
            setSelectedRbds(prev => Array.from(new Set([...prev, ...filteredRbdIds])))
        }
    }

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <span>🏫</span> Asociar RBD a Usuario
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium">
                        Asigna los establecimientos educacionales que cada usuario tiene permitidos auditar y supervisar.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleCopyFromSupervisores}
                        disabled={isPending}
                        className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-cyan-600/30 transition-all flex items-center gap-2 text-sm"
                    >
                        <span>🔄</span>
                        {isPending ? 'Sincronizando...' : 'Copiar desde Supervisores'}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
                <span className="text-slate-400">🔍</span>
                <input
                    type="text"
                    placeholder="Buscar usuario por nombre, usuario o correo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-sm outline-none text-slate-700 placeholder-slate-400 bg-transparent"
                />
            </div>

            {/* List grouped by role */}
            <div className="space-y-4">
                {roles.map(role => {
                    const roleUsers = usersByRole[role.id] || []
                    if (roleUsers.length === 0 && searchQuery) return null

                    const isExpanded = expandedRoles[role.id]

                    return (
                        <div key={role.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <button
                                onClick={() => toggleRole(role.id)}
                                className="w-full flex items-center justify-between p-5 hover:bg-slate-55/30 transition-colors border-b border-gray-50"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">👥</span>
                                    <span className="font-bold text-slate-800 text-base">{role.name}</span>
                                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                                        {roleUsers.length} usuarios
                                    </span>
                                </div>
                                <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                    ▼
                                </span>
                            </button>

                            {isExpanded && (
                                <div className="p-2 overflow-x-auto">
                                    {roleUsers.length === 0 ? (
                                        <p className="text-center py-6 text-sm text-slate-400 font-medium">
                                            No hay usuarios en este rol
                                        </p>
                                    ) : (
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-gray-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                                    <th className="px-4 py-3">Nombre</th>
                                                    <th className="px-4 py-3">Usuario / Correo</th>
                                                    <th className="px-4 py-3">Sucursales</th>
                                                    <th className="px-4 py-3">RBDs Asociados</th>
                                                    <th className="px-4 py-3 text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-55">
                                                {roleUsers.map(user => (
                                                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors text-sm text-slate-700">
                                                        <td className="px-4 py-3.5 font-bold text-slate-900">
                                                            {user.name || 'Sin nombre'}
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <div className="font-semibold text-slate-500">{user.username}</div>
                                                            <div className="text-xs text-slate-400">{user.email || 'Sin correo'}</div>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            {user.sucursales.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {user.sucursales.map(s => (
                                                                        <span key={s.id} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-semibold">
                                                                            {s.nombre}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs">-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3.5 max-w-xs">
                                                            {user.rbds.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                                                    {user.rbds.map(rbd => (
                                                                        <span
                                                                            key={rbd}
                                                                            title={getColegioName(rbd)}
                                                                            className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded-md text-xs font-bold border border-sky-100 cursor-help"
                                                                        >
                                                                            {rbd}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs">Sin RBDs asociados</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-right">
                                                            <button
                                                                onClick={() => handleOpenEdit(user)}
                                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-all"
                                                            >
                                                                ✏️ Editar RBDs
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Modal for editing user RBDs */}
            {selectedUser && (
                <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-150 flex items-center justify-between bg-slate-50">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">
                                    Editar RBDs asociados
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 font-semibold">
                                    Usuario: {selectedUser.name || selectedUser.username} ({selectedUser.role.name})
                                </p>
                            </div>
                            <button
                                onClick={handleCloseEdit}
                                className="text-slate-400 hover:text-slate-600 font-bold text-xl p-1"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            {/* Search & Filter boxes */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-gray-150 flex items-center gap-2">
                                    <span className="text-slate-400">🔍</span>
                                    <input
                                        type="text"
                                        placeholder="Buscar establecimiento por nombre o RBD..."
                                        value={searchColegio}
                                        onChange={(e) => setSearchColegio(e.target.value)}
                                        className="w-full text-sm outline-none text-slate-700 placeholder-slate-400 bg-transparent"
                                    />
                                </div>
                                <div className="w-full sm:w-44 bg-slate-50 p-3 rounded-xl border border-gray-150 flex items-center gap-2">
                                    <span className="text-slate-400">🏢</span>
                                    <select
                                        value={selectedSucursal}
                                        onChange={(e) => setSelectedSucursal(e.target.value)}
                                        className="w-full text-sm outline-none text-slate-750 bg-transparent cursor-pointer font-semibold"
                                    >
                                        <option value="">Todas las Sucursales</option>
                                        {sucursalesList.map(suc => (
                                            <option key={suc} value={suc}>{suc}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-full sm:w-44 bg-slate-50 p-3 rounded-xl border border-gray-150 flex items-center gap-2">
                                    <span className="text-slate-400">🏫</span>
                                    <select
                                        value={selectedInstitucion}
                                        onChange={(e) => setSelectedInstitucion(e.target.value)}
                                        className="w-full text-sm outline-none text-slate-750 bg-transparent cursor-pointer font-semibold"
                                    >
                                        <option value="">Todas las Inst.</option>
                                        {institucionesList.map(inst => (
                                            <option key={inst} value={inst}>{inst}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Summary count */}
                            <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                                <span>Total Colegios: {colegios.length}</span>
                                <span className="text-cyan-600 bg-cyan-50 px-2.5 py-0.5 rounded-full">
                                    {selectedRbds.length} seleccionados
                                </span>
                            </div>

                            {/* Select All Checkbox */}
                            <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={handleToggleSelectAll}
                                        className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-gray-300"
                                    />
                                    <span className="font-bold text-slate-700">Seleccionar Todos ({filteredColegios.length} filtrados)</span>
                                </label>
                            </div>

                            {/* List of schools */}
                            <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-96 overflow-y-auto">
                                {filteredColegios.map(col => {
                                    const isChecked = selectedRbds.includes(col.colRBD)
                                    return (
                                        <label
                                            key={col.colRBD}
                                            className={`flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 transition-colors text-sm ${
                                                isChecked ? 'bg-cyan-50/20' : ''
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => handleToggleRbd(col.colRBD)}
                                                    className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-gray-300"
                                                />
                                                <div>
                                                    <span className="font-bold text-slate-800 mr-2">[{col.colRBD}]</span>
                                                    <span className="text-slate-600 font-medium">{col.nombreEstablecimiento}</span>
                                                </div>
                                            </div>
                                            <span className="text-xs text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded">
                                                {col.sucursal}
                                            </span>
                                        </label>
                                    )
                                })}
                                {filteredColegios.length === 0 && (
                                    <div className="p-6 text-center text-slate-400 text-sm">
                                        No se encontraron colegios con la búsqueda
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-gray-150 flex justify-end gap-3 bg-slate-50">
                            <button
                                onClick={handleCloseEdit}
                                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-sm transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-cyan-600/20"
                            >
                                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
