'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
    MonitoreoRRHHConfigResponse,
    guardarRolesMonitoreoRRHHAction
} from './actions'
import {
    Users,
    Shield,
    Check,
    Save,
    Search,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    Info,
    Clock,
    UserCheck,
    Sliders
} from 'lucide-react'

interface Props {
    initialData: MonitoreoRRHHConfigResponse
}

export default function MonitoreoRRHHConfigClient({ initialData }: Props) {
    const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(initialData.configuredRoles || [])
    const [searchTerm, setSearchTerm] = useState('')
    const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null)
    const [isPending, startTransition] = useTransition()
    const [lastUpdate, setLastUpdate] = useState<{ por?: string | null; at?: string | null }>({
        por: initialData.actualizadoPor,
        at: initialData.updatedAt
    })

    // Roles filtrados por búsqueda
    const filteredRoles = useMemo(() => {
        if (!searchTerm.trim()) return initialData.roles
        const term = searchTerm.toLowerCase().trim()
        return initialData.roles.filter(
            r => r.name.toLowerCase().includes(term) || (r.description && r.description.toLowerCase().includes(term))
        )
    }, [initialData.roles, searchTerm])

    // Total de usuarios activos alcanzados por los roles seleccionados
    const totalUsuariosAlcanzados = useMemo(() => {
        return initialData.roles
            .filter(r => selectedRoleIds.includes(r.id))
            .reduce((acc, r) => acc + r.activeUsersCount, 0)
    }, [initialData.roles, selectedRoleIds])

    // Toggle individual de rol
    const handleToggleRole = (roleId: string) => {
        setSelectedRoleIds(prev =>
            prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
        )
    }

    // Seleccionar / Deseleccionar todos
    const handleSelectAll = () => {
        const allIds = initialData.roles.map(r => r.id)
        setSelectedRoleIds(allIds)
    }

    const handleDeselectAll = () => {
        setSelectedRoleIds([])
    }

    // Guardar cambios en el servidor
    const handleSave = () => {
        startTransition(async () => {
            const res = await guardarRolesMonitoreoRRHHAction(selectedRoleIds)
            if (res.success) {
                setFeedback({ tipo: 'success', mensaje: res.message || 'Configuración guardada exitosamente.' })
                setLastUpdate({ por: 'Tú', at: new Date().toISOString() })
                setTimeout(() => setFeedback(null), 4000)
            } else {
                setFeedback({ tipo: 'error', mensaje: res.error || 'Error al guardar configuración.' })
                setTimeout(() => setFeedback(null), 5000)
            }
        })
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
            {/* Cabecera Estándar Hendaya */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <div className="flex items-center gap-2 text-cyan-600 font-semibold text-xs tracking-wider uppercase mb-1">
                        <Users className="w-4 h-4" />
                        <span>Mantenedores · Recursos Humanos · Monitoreo</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        Monitoreo de Recursos Humanos
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Configura qué perfiles y roles de usuario estarán sujetos a la supervisión y control del <strong>Tablero de Monitoreo RRHH</strong> (avance en Ausentismo, Horas Extras, Atrasos y Adelantos abiertos).
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-cyan-600/20 active:scale-95 cursor-pointer"
                    >
                        {isPending ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Guardando...</span>
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                <span>Guardar Configuración</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Banner de Feedback */}
            {feedback && (
                <div
                    className={`flex items-center gap-2.5 p-4 rounded-xl text-xs font-medium border shadow-sm transition-all animate-fadeIn ${
                        feedback.tipo === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    {feedback.tipo === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    )}
                    <span>{feedback.mensaje}</span>
                </div>
            )}

            {/* Tarjetas de Resumen Rápido */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Roles Seleccionados</span>
                        <div className="text-2xl font-black text-gray-900 mt-1">
                            {selectedRoleIds.length} <span className="text-xs text-gray-400 font-normal">de {initialData.roles.length} roles</span>
                        </div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600">
                        <Shield className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Usuarios Monitoreados</span>
                        <div className="text-2xl font-black text-cyan-700 mt-1">
                            {totalUsuariosAlcanzados} <span className="text-xs text-gray-400 font-normal">usuarios activos</span>
                        </div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                        <UserCheck className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Última Modificación</span>
                        <div className="text-xs font-semibold text-gray-700 mt-1 truncate max-w-[200px]" title={lastUpdate.por || 'Sin cambios'}>
                            Por: <strong className="text-gray-900">{lastUpdate.por || 'Sistema'}</strong>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                            {lastUpdate.at ? new Date(lastUpdate.at).toLocaleString('es-CL') : 'Configuración inicial'}
                        </div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500">
                        <Clock className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Contenedor Principal: Roles Asignados a Monitoreo */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Sliders className="w-4 h-4 text-cyan-600" />
                            <span>Roles Asignados a Monitoreo</span>
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Activa el switch en los perfiles cuyos colaboradores deban rendir cuentas de avance en el tablero de RRHH.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        {/* Buscador de roles */}
                        <div className="relative w-full sm:w-64">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Buscar rol..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-gray-50/70 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all placeholder:text-gray-400"
                            />
                        </div>

                        {/* Botones de selección masiva */}
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="px-3 py-1.5 text-xs font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg transition-colors cursor-pointer"
                            >
                                Marcar Todos
                            </button>
                            <button
                                type="button"
                                onClick={handleDeselectAll}
                                className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors cursor-pointer"
                            >
                                Desmarcar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Grid de Roles */}
                <div className="p-5">
                    {filteredRoles.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 space-y-2">
                            <Search className="w-8 h-8 mx-auto text-gray-300" />
                            <p className="font-semibold text-gray-600 text-sm">No se encontraron roles coincidentes</p>
                            <p className="text-xs text-gray-400">Intenta con otro término de búsqueda.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {filteredRoles.map(rol => {
                                const isSelected = selectedRoleIds.includes(rol.id)
                                return (
                                    <div
                                        key={rol.id}
                                        onClick={() => handleToggleRole(rol.id)}
                                        className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none flex items-start justify-between gap-3 ${
                                            isSelected
                                                ? 'bg-cyan-50/40 border-cyan-300 shadow-xs'
                                                : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                                        }`}
                                    >
                                        <div className="space-y-1 flex-1 pr-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className={`font-bold text-sm leading-tight transition-colors ${
                                                    isSelected ? 'text-cyan-950' : 'text-gray-900'
                                                }`}>
                                                    {rol.name}
                                                </h3>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    rol.activeUsersCount > 0
                                                        ? isSelected
                                                            ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                                                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                                                        : 'bg-gray-50 text-gray-400 border border-gray-200'
                                                }`}>
                                                    {rol.activeUsersCount} {rol.activeUsersCount === 1 ? 'usuario' : 'usuarios'}
                                                </span>
                                            </div>
                                            {rol.description && (
                                                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                                    {rol.description}
                                                </p>
                                            )}
                                        </div>

                                        {/* Toggle switch deslizante táctil */}
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={isSelected}
                                            onClick={e => {
                                                e.stopPropagation()
                                                handleToggleRole(rol.id)
                                            }}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1 ${
                                                isSelected ? 'bg-cyan-600' : 'bg-slate-300 hover:bg-slate-400'
                                            }`}
                                            title={isSelected ? 'Habilitado: Clic para deshabilitar' : 'Deshabilitado: Clic para habilitar'}
                                        >
                                            <span className="sr-only">Habilitar monitoreo para {rol.name}</span>
                                            <span
                                                aria-hidden="true"
                                                className={`pointer-events-none inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                                    isSelected ? 'translate-x-5' : 'translate-x-0'
                                                }`}
                                            >
                                                {isSelected ? (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
                                                ) : (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                )}
                                            </span>
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Barra Inferior Informativa */}
                <div className="p-4 bg-gray-50/70 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-cyan-600 shrink-0" />
                        <span>
                            Solo los usuarios asignados a los roles seleccionados aparecerán como cerámicas en el <strong>Tablero de Monitoreo RRHH</strong>.
                        </span>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="w-full sm:w-auto px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        {isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>Guardar Cambios</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
