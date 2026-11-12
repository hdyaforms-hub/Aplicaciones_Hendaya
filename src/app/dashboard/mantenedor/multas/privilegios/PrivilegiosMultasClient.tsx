'use client'

import React, { useState, useMemo } from 'react'
import { UsuarioPrivilegioEE, updatePrivilegioUsuario } from './actions'
import {
    ShieldCheck,
    Trash2,
    CheckSquare,
    Search,
    Users,
    Key,
    Lock,
    CheckCircle2,
    AlertCircle,
    Building2,
    RefreshCw
} from 'lucide-react'

interface Props {
    initialUsers: UsuarioPrivilegioEE[]
    currentUserName: string
}

export default function PrivilegiosMultasClient({ initialUsers, currentUserName }: Props) {
    const [users, setUsers] = useState<UsuarioPrivilegioEE[]>(initialUsers)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'with-privilege' | 'without-privilege' | 'admin'>('all')
    const [savingUserId, setSavingUserId] = useState<string | null>(null)
    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        setToastMessage({ type, text })
        setTimeout(() => setToastMessage(null), 3500)
    }

    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            const matchesSearch =
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                user.roleName.toLowerCase().includes(searchTerm.toLowerCase())

            if (!matchesSearch) return false

            const hasAnyPrivilege = user.puedeEliminarIndividual || user.puedeEliminarMasivo

            if (filterType === 'with-privilege') return hasAnyPrivilege && !user.isAdmin
            if (filterType === 'without-privilege') return !hasAnyPrivilege && !user.isAdmin
            if (filterType === 'admin') return user.isAdmin

            return true
        })
    }, [users, searchTerm, filterType])

    // KPIs
    const stats = useMemo(() => {
        const total = users.length
        const admins = users.filter(u => u.isAdmin).length
        const withPrivileges = users.filter(u => !u.isAdmin && (u.puedeEliminarIndividual || u.puedeEliminarMasivo)).length
        const withoutPrivileges = total - admins - withPrivileges
        return { total, admins, withPrivileges, withoutPrivileges }
    }, [users])

    const handleTogglePrivilege = async (
        userId: string,
        key: 'puedeEliminarIndividual' | 'puedeEliminarMasivo' | 'both',
        newValue: boolean
    ) => {
        const targetUser = users.find(u => u.id === userId)
        if (!targetUser || targetUser.isAdmin) return

        let updatedIndividual = targetUser.puedeEliminarIndividual
        let updatedMasivo = targetUser.puedeEliminarMasivo

        if (key === 'puedeEliminarIndividual') {
            updatedIndividual = newValue
        } else if (key === 'puedeEliminarMasivo') {
            updatedMasivo = newValue
        } else if (key === 'both') {
            updatedIndividual = newValue
            updatedMasivo = newValue
        }

        // Optimistic update
        setUsers(prev =>
            prev.map(u =>
                u.id === userId
                    ? {
                          ...u,
                          puedeEliminarIndividual: updatedIndividual,
                          puedeEliminarMasivo: updatedMasivo,
                          otorgadoPor: currentUserName,
                          updatedAt: new Date().toISOString()
                      }
                    : u
            )
        )

        setSavingUserId(userId)
        try {
            const res = await updatePrivilegioUsuario(userId, {
                puedeEliminarIndividual: updatedIndividual,
                puedeEliminarMasivo: updatedMasivo
            })

            if (res.success) {
                showToast(`Privilegios de "${targetUser.username}" actualizados correctamente`)
            } else {
                throw new Error(res.error || 'No se pudo guardar el cambio')
            }
        } catch (error: any) {
            // Revert on error
            setUsers(prev =>
                prev.map(u =>
                    u.id === userId
                        ? {
                              ...u,
                              puedeEliminarIndividual: targetUser.puedeEliminarIndividual,
                              puedeEliminarMasivo: targetUser.puedeEliminarMasivo
                          }
                        : u
                )
            )
            showToast(error.message || 'Error al actualizar privilegios', 'error')
        } finally {
            setSavingUserId(null)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header corporativo HENDAYA */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 p-6 rounded-2xl border border-cyan-800/40 shadow-xl relative overflow-hidden text-white">
                <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-black tracking-widest text-cyan-400 uppercase bg-cyan-950/80 px-2.5 py-1 rounded-md border border-cyan-800/60">
                                MANTENEDOR &bull; MULTAS
                            </span>
                            <span className="text-xs text-slate-400">Control de Accesos EE</span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1">
                            Privilegios de Borrado en Carga de Elementos Esenciales
                        </h1>
                        <p className="text-sm text-slate-300 mt-1 max-w-3xl">
                            Administra qué usuarios de la plataforma cuentan con autorización para utilizar los botones de{' '}
                            <span className="text-cyan-400 font-semibold">Eliminación Individual (🗑️)</span> y{' '}
                            <span className="text-cyan-400 font-semibold">Eliminación Masiva (Eliminar N)</span> en el módulo de Carga de Elementos Esenciales.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="bg-slate-800/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-700/60 flex items-center gap-3">
                            <Key className="w-5 h-5 text-cyan-400" />
                            <div>
                                <div className="text-[10px] uppercase font-bold text-slate-400">Operador</div>
                                <div className="text-xs font-semibold text-white">{currentUserName}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toast flotante */}
            {toastMessage && (
                <div
                    className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border transition-all text-sm font-medium animate-in slide-in-from-top-3 ${
                        toastMessage.type === 'success'
                            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                            : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
                    }`}
                >
                    {toastMessage.type === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-rose-400" />
                    )}
                    <span>{toastMessage.text}</span>
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Usuarios</div>
                        <div className="text-2xl font-black text-slate-800 mt-0.5">{stats.total}</div>
                        <div className="text-[11px] text-slate-500 mt-1">En plataforma</div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                        <Users className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-cyan-200 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-cyan-700 uppercase tracking-wider">Con Privilegio</div>
                        <div className="text-2xl font-black text-cyan-700 mt-0.5">{stats.withPrivileges}</div>
                        <div className="text-[11px] text-cyan-600 mt-1">Asignados manualmente</div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-indigo-200 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Administradores</div>
                        <div className="text-2xl font-black text-indigo-700 mt-0.5">{stats.admins}</div>
                        <div className="text-[11px] text-indigo-600 mt-1">Acceso total nativo</div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Lock className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sin Privilegio</div>
                        <div className="text-2xl font-black text-slate-500 mt-0.5">{stats.withoutPrivileges}</div>
                        <div className="text-[11px] text-slate-400 mt-1">Solo lectura / carga</div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                        <Trash2 className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, usuario, rol o correo..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-slate-700 placeholder:text-slate-400"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            filterType === 'all'
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        Todos ({users.length})
                    </button>
                    <button
                        onClick={() => setFilterType('with-privilege')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            filterType === 'with-privilege'
                                ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30'
                                : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
                        }`}
                    >
                        Con Privilegio ({stats.withPrivileges})
                    </button>
                    <button
                        onClick={() => setFilterType('admin')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            filterType === 'admin'
                                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                                : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                        }`}
                    >
                        Admins ({stats.admins})
                    </button>
                    <button
                        onClick={() => setFilterType('without-privilege')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            filterType === 'without-privilege'
                                ? 'bg-slate-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        Sin Privilegio ({stats.withoutPrivileges})
                    </button>
                </div>
            </div>

            {/* Tabla de Usuarios y Privilegios */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50/80 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Usuario</th>
                                <th className="px-4 py-4">Rol en Plataforma</th>
                                <th className="px-4 py-4 text-center">Cobertura RBD</th>
                                <th className="px-6 py-4 text-center">
                                    <div className="inline-flex items-center gap-1.5">
                                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                        <span>Borrado Individual</span>
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-center">
                                    <div className="inline-flex items-center gap-1.5">
                                        <CheckSquare className="w-3.5 h-3.5 text-amber-500" />
                                        <span>Borrado Masivo</span>
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-center">Acceso Total</th>
                                <th className="px-6 py-4 text-right">Trazabilidad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                        <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                                        <p className="font-semibold text-slate-600">No se encontraron usuarios</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Ajusta el término de búsqueda o cambia el filtro seleccionado.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map(user => {
                                    const isSaving = savingUserId === user.id
                                    const hasBoth = user.puedeEliminarIndividual && user.puedeEliminarMasivo

                                    return (
                                        <tr
                                            key={user.id}
                                            className={`hover:bg-slate-50/70 transition-colors ${
                                                user.isAdmin
                                                    ? 'bg-indigo-50/20'
                                                    : hasBoth
                                                    ? 'bg-cyan-50/20'
                                                    : ''
                                            }`}
                                        >
                                            {/* Datos del usuario */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-cyan-900 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                                                        {user.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800 flex items-center gap-2">
                                                            {user.name}
                                                            {user.isAdmin && (
                                                                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
                                                                    Admin
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-slate-400 flex items-center gap-2">
                                                            <span>@{user.username}</span>
                                                            {user.email && (
                                                                <>
                                                                    <span>&bull;</span>
                                                                    <span>{user.email}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Rol */}
                                            <td className="px-4 py-4">
                                                <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                                    {user.roleName}
                                                </span>
                                            </td>

                                            {/* RBDs */}
                                            <td className="px-4 py-4 text-center">
                                                <div className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                                                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="font-semibold">
                                                        {user.isAdmin ? 'Todos' : user.rbdsCount > 0 ? `${user.rbdsCount} RBDs` : 'Sin asignación'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Borrado Individual */}
                                            <td className="px-6 py-4 text-center">
                                                {user.isAdmin ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Habilitado
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={isSaving}
                                                        onClick={() =>
                                                            handleTogglePrivilege(
                                                                user.id,
                                                                'puedeEliminarIndividual',
                                                                !user.puedeEliminarIndividual
                                                            )
                                                        }
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${
                                                            user.puedeEliminarIndividual ? 'bg-cyan-600' : 'bg-slate-200'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                                                                user.puedeEliminarIndividual ? 'translate-x-6' : 'translate-x-1'
                                                            }`}
                                                        />
                                                    </button>
                                                )}
                                            </td>

                                            {/* Borrado Masivo */}
                                            <td className="px-6 py-4 text-center">
                                                {user.isAdmin ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Habilitado
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={isSaving}
                                                        onClick={() =>
                                                            handleTogglePrivilege(
                                                                user.id,
                                                                'puedeEliminarMasivo',
                                                                !user.puedeEliminarMasivo
                                                            )
                                                        }
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${
                                                            user.puedeEliminarMasivo ? 'bg-cyan-600' : 'bg-slate-200'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                                                                user.puedeEliminarMasivo ? 'translate-x-6' : 'translate-x-1'
                                                            }`}
                                                        />
                                                    </button>
                                                )}
                                            </td>

                                            {/* Interruptor Maestro (Ambos) */}
                                            <td className="px-6 py-4 text-center">
                                                {user.isAdmin ? (
                                                    <span className="text-xs text-indigo-600 font-bold">Nativo</span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={isSaving}
                                                        onClick={() =>
                                                            handleTogglePrivilege(user.id, 'both', !hasBoth)
                                                        }
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                                                            hasBoth
                                                                ? 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100'
                                                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        {hasBoth ? 'Activo Total' : 'Inactivo'}
                                                    </button>
                                                )}
                                            </td>

                                            {/* Trazabilidad */}
                                            <td className="px-6 py-4 text-right">
                                                {isSaving ? (
                                                    <div className="inline-flex items-center gap-1.5 text-xs text-cyan-600 animate-pulse">
                                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Guardando...
                                                    </div>
                                                ) : user.isAdmin ? (
                                                    <span className="text-[11px] text-slate-400 italic">Por rol Administrador</span>
                                                ) : user.otorgadoPor ? (
                                                    <div>
                                                        <div className="text-xs font-semibold text-slate-700">
                                                            {user.otorgadoPor}
                                                        </div>
                                                        {user.updatedAt && (
                                                            <div className="text-[10px] text-slate-400">
                                                                {new Date(user.updatedAt).toLocaleDateString('es-CL', {
                                                                    day: '2-digit',
                                                                    month: 'short',
                                                                    year: 'numeric'
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
                    <div>
                        Mostrando <span className="font-bold text-slate-700">{filteredUsers.length}</span> de{' '}
                        <span className="font-bold text-slate-700">{users.length}</span> usuarios registrados
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                        <ShieldCheck className="w-4 h-4 text-cyan-500" />
                        <span>Los cambios se guardan y registran en Auditoría automáticamente.</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

