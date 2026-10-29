'use client'

import React, { useState, useTransition } from 'react'
import { RolVisualizableItem, saveRolesVisualizarAction } from './actions'

interface Props {
    initialRoles: RolVisualizableItem[]
    initialConfiguredRoles: string[]
    actualizadoPor?: string | null
    updatedAt?: string | null
    currentUser: {
        username: string
        name?: string | null
        roleName?: string | null
    }
}

export default function ConfiguracionRiesgoClient({
    initialRoles,
    initialConfiguredRoles,
    actualizadoPor,
    updatedAt,
    currentUser
}: Props) {
    const [activeTab, setActiveTab] = useState<'lista-visualizar'>('lista-visualizar')
    const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set(initialConfiguredRoles))
    const [searchQuery, setSearchQuery] = useState('')
    const [isPending, startTransition] = useTransition()
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const [lastUpdated, setLastUpdated] = useState<{ by?: string | null; at?: string | null }>({
        by: actualizadoPor,
        at: updatedAt
    })

    // Alternar selección de un rol individual
    const handleToggleRole = (roleId: string) => {
        setFeedback(null)
        setSelectedRoleIds(prev => {
            const next = new Set(prev)
            if (next.has(roleId)) {
                next.delete(roleId)
            } else {
                next.add(roleId)
            }
            return next
        })
    }

    // Seleccionar o deseleccionar todos
    const handleSelectAll = (select: boolean) => {
        setFeedback(null)
        if (select) {
            setSelectedRoleIds(new Set(initialRoles.map(r => r.id)))
        } else {
            setSelectedRoleIds(new Set())
        }
    }

    // Guardar cambios en el servidor
    const handleSave = () => {
        setFeedback(null)
        startTransition(async () => {
            const roleIdsArray = Array.from(selectedRoleIds)
            const res = await saveRolesVisualizarAction(roleIdsArray)
            if (res.success) {
                setFeedback({
                    type: 'success',
                    message: `Configuración guardada exitosamente. Se autorizaron ${roleIdsArray.length} roles para visualización.`
                })
                setLastUpdated({
                    by: currentUser.username || currentUser.name,
                    at: new Date().toISOString()
                })
            } else {
                setFeedback({
                    type: 'error',
                    message: res.error || 'Ocurrió un error al guardar la configuración.'
                })
            }
        })
    }

    // Roles filtrados por búsqueda
    const filteredRoles = initialRoles.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    )

    const isDirty = Array.from(selectedRoleIds).sort().join(',') !== initialConfiguredRoles.sort().join(',')

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 lg:p-8 space-y-6">
            {/* ENCABEZADO EJECUTIVO HENDAYA */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center text-3xl shadow-sm shrink-0">
                        🛡️
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                                Prev. de Riesgos
                            </h1>
                            <span className="text-[11px] font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-300">
                                HENDAYA
                            </span>
                            <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                                Mantenedor
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-slate-500 mt-1">
                            Configuración de parámetros, roles a visualizar y filtros de supervisión para Prevención de Riesgos.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                            isPending
                                ? 'bg-slate-400 text-white cursor-not-allowed'
                                : isDirty
                                ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-200 ring-2 ring-sky-400/40'
                                : 'bg-slate-800 hover:bg-slate-900 text-white'
                        }`}
                    >
                        {isPending ? (
                            <>
                                <span className="animate-spin">🔄</span>
                                <span>Guardando...</span>
                            </>
                        ) : (
                            <>
                                <span>💾</span>
                                <span>Guardar Configuración</span>
                                {isDirty && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* FEEDBACK ALERT */}
            {feedback && (
                <div className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
                    feedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                    <div className="flex items-center gap-2">
                        <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
                        <span>{feedback.message}</span>
                    </div>
                    <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                        ✕
                    </button>
                </div>
            )}

            {/* TAB CONTAINER */}
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
                {/* TAB BAR */}
                <div className="flex items-center border-b border-slate-200 px-6 pt-3 bg-slate-50/70 gap-2">
                    <button
                        onClick={() => setActiveTab('lista-visualizar')}
                        className={`pb-3 px-4 text-xs font-extrabold transition-all border-b-2 flex items-center gap-2 ${
                            activeTab === 'lista-visualizar'
                                ? 'border-sky-600 text-sky-700 bg-white rounded-t-lg border-t border-l border-r border-slate-200 -mb-[1px]'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <span>👁️</span>
                        <span>Lista a visualizar</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-100 text-sky-800 font-bold">
                            {selectedRoleIds.size}
                        </span>
                    </button>
                </div>

                {/* CONTENIDO DEL TAB */}
                <div className="p-6 space-y-5">
                    {/* BARRA DE HERRAMIENTAS Y BÚSQUEDA */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-md">
                            <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                            <input
                                type="text"
                                placeholder="Buscar rol por nombre o descripción..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                            />
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => handleSelectAll(true)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all"
                            >
                                Seleccionar todos
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSelectAll(false)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all"
                            >
                                Deseleccionar todos
                            </button>
                        </div>
                    </div>

                    {/* METADATOS / ESTADO INFORMATIVO */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 bg-slate-50 border border-slate-200/80 rounded-xl p-3 gap-2">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-700">Resumen:</span>
                            <span>
                                <strong className="text-sky-700 font-black">{selectedRoleIds.size}</strong> de {initialRoles.length} roles marcados para visualizar.
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[11px] text-slate-400">
                                (Por defecto los roles no están autorizados a menos que se marquen con el check).
                            </span>
                        </div>
                        {lastUpdated.by && (
                            <div className="text-[11px] text-slate-400">
                                Última modificación por <strong className="text-slate-600">{lastUpdated.by}</strong>
                                {lastUpdated.at ? ` el ${new Date(lastUpdated.at).toLocaleString('es-CL')}` : ''}
                            </div>
                        )}
                    </div>

                    {/* TABLA DE ROLES */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="py-3 px-4 text-center w-24">Visualizar</th>
                                    <th className="py-3 px-4">Nombre del Rol</th>
                                    <th className="py-3 px-4">Descripción</th>
                                    <th className="py-3 px-4 text-center w-36">Usuarios Activos</th>
                                    <th className="py-3 px-4 text-center w-28">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {filteredRoles.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-slate-400">
                                            No se encontraron roles coincidentes con la búsqueda.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRoles.map(role => {
                                        const isChecked = selectedRoleIds.has(role.id)
                                        return (
                                            <tr
                                                key={role.id}
                                                onClick={() => handleToggleRole(role.id)}
                                                className={`cursor-pointer transition-colors ${
                                                    isChecked ? 'bg-sky-50/40 hover:bg-sky-50/70' : 'hover:bg-slate-50'
                                                }`}
                                            >
                                                {/* CHECKBOX / SWITCH */}
                                                <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => handleToggleRole(role.id)}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                                                    </label>
                                                </td>

                                                {/* NOMBRE */}
                                                <td className="py-3 px-4 font-bold text-slate-900">
                                                    <div className="flex items-center gap-2">
                                                        <span>{role.name}</span>
                                                        {isChecked && (
                                                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-sky-100 text-sky-800 border border-sky-300">
                                                                Visible
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* DESCRIPCIÓN */}
                                                <td className="py-3 px-4 text-slate-600 max-w-md truncate" title={role.description || ''}>
                                                    {role.description || <span className="text-slate-400 italic">Sin descripción</span>}
                                                </td>

                                                {/* USUARIOS ACTIVOS */}
                                                <td className="py-3 px-4 text-center font-bold text-slate-700">
                                                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-xs">
                                                        {role.activeUsersCount} {role.activeUsersCount === 1 ? 'usuario' : 'usuarios'}
                                                    </span>
                                                </td>

                                                {/* ESTADO */}
                                                <td className="py-3 px-4 text-center">
                                                    {isChecked ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            ✓ Visualizar
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                                            No visualizar
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

