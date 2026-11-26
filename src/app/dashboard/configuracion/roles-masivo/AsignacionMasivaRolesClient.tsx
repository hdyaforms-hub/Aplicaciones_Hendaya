'use client'

import React, { useState, useTransition } from 'react'
import {
    RoleMasivoItem,
    aplicarPermisosMasivoAction
} from './actions'
import { PermissionDefinition } from '@/lib/permissions-catalog'
import {
    Shield,
    Users,
    CheckSquare,
    Square,
    Search,
    PlusCircle,
    MinusCircle,
    CheckCircle2,
    AlertCircle,
    Layers,
    Info,
    RefreshCw,
    X,
    Filter,
    ChevronDown,
    ChevronRight,
    ArrowRight
} from 'lucide-react'

interface AsignacionMasivaRolesClientProps {
    initialRoles: RoleMasivoItem[]
    permisos: PermissionDefinition[]
    categorias: string[]
}

export default function AsignacionMasivaRolesClient({
    initialRoles,
    permisos,
    categorias
}: AsignacionMasivaRolesClientProps) {
    const [roles, setRoles] = useState<RoleMasivoItem[]>(initialRoles)
    const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])
    const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([])

    // Filtros de Permisos
    const [busquedaPermisos, setBusquedaPermisos] = useState('')
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('TODAS')
    const [categoriasExpandidas, setCategoriasExpandidas] = useState<Record<string, boolean>>({})

    // Filtros de Roles
    const [busquedaRoles, setBusquedaRoles] = useState('')

    // Modal de Confirmación
    const [modalConfirmacion, setModalConfirmacion] = useState<{
        open: boolean
        operacion: 'agregar' | 'remover'
    }>({ open: false, operacion: 'agregar' })

    const [isExecuting, setIsExecuting] = useState(false)
    const [mensajeExito, setMensajeExito] = useState<string | null>(null)
    const [mensajeError, setMensajeError] = useState<string | null>(null)

    // Filtrar Permisos
    const permisosFiltrados = permisos.filter(p => {
        const matchesCat = categoriaSeleccionada === 'TODAS' || p.category === categoriaSeleccionada
        const matchesText =
            p.name.toLowerCase().includes(busquedaPermisos.toLowerCase()) ||
            p.id.toLowerCase().includes(busquedaPermisos.toLowerCase()) ||
            p.description.toLowerCase().includes(busquedaPermisos.toLowerCase()) ||
            p.category.toLowerCase().includes(busquedaPermisos.toLowerCase())
        return matchesCat && matchesText
    })

    // Agrupar permisos filtrados por categoría
    const permisosPorCategoria = permisosFiltrados.reduce((acc, p) => {
        if (!acc[p.category]) acc[p.category] = []
        acc[p.category].push(p)
        return acc
    }, {} as Record<string, PermissionDefinition[]>)

    // Filtrar Roles
    const rolesFiltrados = roles.filter(r =>
        r.name.toLowerCase().includes(busquedaRoles.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(busquedaRoles.toLowerCase()))
    )

    // Handlers de Selección de Roles
    const toggleRole = (roleId: string) => {
        setSelectedRoleIds(prev =>
            prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
        )
    }

    const toggleSelectAllRoles = () => {
        const rolesVisiblesIds = rolesFiltrados.map(r => r.id)
        const todosSeleccionados = rolesVisiblesIds.every(id => selectedRoleIds.includes(id))

        if (todosSeleccionados) {
            setSelectedRoleIds(prev => prev.filter(id => !rolesVisiblesIds.includes(id)))
        } else {
            setSelectedRoleIds(prev => Array.from(new Set([...prev, ...rolesVisiblesIds])))
        }
    }

    // Handlers de Selección de Permisos
    const togglePermission = (permId: string) => {
        setSelectedPermissionIds(prev =>
            prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
        )
    }

    const toggleSelectCategoryPermissions = (categoria: string) => {
        const permsCat = (permisosPorCategoria[categoria] || []).map(p => p.id)
        const todosCatSeleccionados = permsCat.every(id => selectedPermissionIds.includes(id))

        if (todosCatSeleccionados) {
            setSelectedPermissionIds(prev => prev.filter(id => !permsCat.includes(id)))
        } else {
            setSelectedPermissionIds(prev => Array.from(new Set([...prev, ...permsCat])))
        }
    }

    const toggleSelectAllVisiblePermisos = () => {
        const idsVisibles = permisosFiltrados.map(p => p.id)
        const todosSeleccionados = idsVisibles.every(id => selectedPermissionIds.includes(id))

        if (todosSeleccionados) {
            setSelectedPermissionIds(prev => prev.filter(id => !idsVisibles.includes(id)))
        } else {
            setSelectedPermissionIds(prev => Array.from(new Set([...prev, ...idsVisibles])))
        }
    }

    // Ejecución de Asignación Masiva
    const handleConfirmarOperacion = async () => {
        setIsExecuting(true)
        setMensajeExito(null)
        setMensajeError(null)

        try {
            const res = await aplicarPermisosMasivoAction({
                roleIds: selectedRoleIds,
                permissionIds: selectedPermissionIds,
                operacion: modalConfirmacion.operacion
            })

            if (res.success) {
                // Actualizar estado local de los roles
                setRoles(prev =>
                    prev.map(r => {
                        if (!selectedRoleIds.includes(r.id)) return r
                        const permsSet = new Set(r.permissions)
                        if (modalConfirmacion.operacion === 'agregar') {
                            selectedPermissionIds.forEach(p => permsSet.add(p))
                        } else {
                            selectedPermissionIds.forEach(p => permsSet.delete(p))
                        }
                        return { ...r, permissions: Array.from(permsSet) }
                    })
                )

                setMensajeExito(
                    `¡Operación exitosa! Se ${
                        modalConfirmacion.operacion === 'agregar' ? 'incorporaron' : 'removieron'
                    } ${selectedPermissionIds.length} permisos en ${selectedRoleIds.length} roles seleccionados.`
                )
                setModalConfirmacion({ open: false, operacion: 'agregar' })
                setSelectedPermissionIds([])
                setSelectedRoleIds([])
            } else {
                setMensajeError(res.error || 'Ocurrió un error al procesar la operación.')
            }
        } catch (err: any) {
            setMensajeError(err.message || 'Error inesperado de comunicación.')
        } finally {
            setIsExecuting(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Cabecera */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 tracking-wider uppercase mb-1">
                        <Shield className="w-4 h-4 text-cyan-600" />
                        <span>Configuración • Gestión Masiva</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Asignación Masiva de Permisos a Roles
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 max-w-3xl">
                        Asocia o remueve módulos y permisos en lote a múltiples roles simultáneamente. Ideal cuando se crean nuevos módulos en el sistema y se requiere habilitarlos en todos los perfiles de una sola vez.
                    </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <div className="px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                        <Users className="w-4 h-4 text-cyan-600" />
                        <span><strong>{roles.length}</strong> Roles</span>
                    </div>
                    <div className="px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-cyan-600" />
                        <span><strong>{permisos.length}</strong> Permisos</span>
                    </div>
                </div>
            </div>

            {/* Mensajes de feedback */}
            {mensajeExito && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span>{mensajeExito}</span>
                    </div>
                    <button onClick={() => setMensajeExito(null)} className="text-emerald-600 hover:text-emerald-800">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
            {mensajeError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2.5">
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        <span>{mensajeError}</span>
                    </div>
                    <button onClick={() => setMensajeError(null)} className="text-rose-600 hover:text-rose-800">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Panel Principal a 2 Columnas */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* COLUMNA 1: Selección de Permisos (7 columnas) */}
                <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-cyan-700 text-white font-bold text-xs flex items-center justify-center">1</span>
                                <h2 className="text-base font-bold text-slate-900">Seleccionar Módulos / Permisos</h2>
                            </div>
                            <p className="text-xs text-slate-500 ml-8">Marca los permisos que deseas asociar o remover</p>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                            <span className="text-xs font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200">
                                {selectedPermissionIds.length} seleccionados
                            </span>
                            <button
                                onClick={toggleSelectAllVisiblePermisos}
                                className="text-xs font-semibold text-slate-600 hover:text-cyan-700 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
                            >
                                {permisosFiltrados.every(p => selectedPermissionIds.includes(p.id)) ? 'Desmarcar' : 'Marcar Todos'}
                            </button>
                        </div>
                    </div>

                    {/* Filtros de Permisos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3 border-b border-slate-100">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={busquedaPermisos}
                                onChange={e => setBusquedaPermisos(e.target.value)}
                                placeholder="Buscar permiso por nombre o código..."
                                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
                            />
                        </div>

                        <div>
                            <select
                                value={categoriaSeleccionada}
                                onChange={e => setCategoriaSeleccionada(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                <option value="TODAS">Todas las categorías ({categorias.length})</option>
                                {categorias.map(cat => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Lista de Permisos por Categoría */}
                    <div className="flex-1 overflow-y-auto max-h-[560px] divide-y divide-slate-100 pr-1 mt-2">
                        {Object.keys(permisosPorCategoria).length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-xs">
                                No se encontraron permisos coincidentes con los filtros.
                            </div>
                        ) : (
                            Object.entries(permisosPorCategoria).map(([categoria, listaPerms]) => {
                                const todosCatSeleccionados = listaPerms.every(p => selectedPermissionIds.includes(p.id))
                                const algunosCatSeleccionados = listaPerms.some(p => selectedPermissionIds.includes(p.id))

                                return (
                                    <div key={categoria} className="py-3">
                                        <div className="flex items-center justify-between mb-2 bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleSelectCategoryPermissions(categoria)}
                                                    className="text-cyan-700 hover:text-cyan-900"
                                                >
                                                    {todosCatSeleccionados ? (
                                                        <CheckSquare className="w-4 h-4 text-cyan-700" />
                                                    ) : algunosCatSeleccionados ? (
                                                        <div className="w-4 h-4 bg-cyan-700 rounded-xs flex items-center justify-center text-white text-[10px] font-bold">
                                                            -
                                                        </div>
                                                    ) : (
                                                        <Square className="w-4 h-4 text-slate-400" />
                                                    )}
                                                </button>
                                                <span className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                                                    {categoria}
                                                </span>
                                            </div>
                                            <span className="text-[11px] font-semibold text-slate-500">
                                                {listaPerms.filter(p => selectedPermissionIds.includes(p.id)).length} / {listaPerms.length}
                                            </span>
                                        </div>

                                        <div className="space-y-1.5 pl-6">
                                            {listaPerms.map(permiso => {
                                                const isChecked = selectedPermissionIds.includes(permiso.id)
                                                return (
                                                    <label
                                                        key={permiso.id}
                                                        className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border ${
                                                            isChecked
                                                                ? 'bg-cyan-50/60 border-cyan-200'
                                                                : 'hover:bg-slate-50 border-transparent'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => togglePermission(permiso.id)}
                                                            className="mt-0.5 rounded text-cyan-700 focus:ring-cyan-500 border-slate-300 w-4 h-4"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-xs font-semibold text-slate-900 truncate">
                                                                    {permiso.name}
                                                                </span>
                                                                <code className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                                                                    {permiso.id}
                                                                </code>
                                                            </div>
                                                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                                                {permiso.description}
                                                            </p>
                                                        </div>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* COLUMNA 2: Selección de Roles Destino (5 columnas) */}
                <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-cyan-700 text-white font-bold text-xs flex items-center justify-center">2</span>
                                <h2 className="text-base font-bold text-slate-900">Seleccionar Roles Destino</h2>
                            </div>
                            <p className="text-xs text-slate-500 ml-8">Elige los perfiles que recibirán el cambio</p>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                            <span className="text-xs font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200">
                                {selectedRoleIds.length} seleccionados
                            </span>
                            <button
                                onClick={toggleSelectAllRoles}
                                className="text-xs font-semibold text-slate-600 hover:text-cyan-700 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
                            >
                                {rolesFiltrados.every(r => selectedRoleIds.includes(r.id)) ? 'Desmarcar' : 'Marcar Todos'}
                            </button>
                        </div>
                    </div>

                    {/* Filtro de Roles */}
                    <div className="py-3 border-b border-slate-100">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={busquedaRoles}
                                onChange={e => setBusquedaRoles(e.target.value)}
                                placeholder="Buscar rol por nombre..."
                                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
                            />
                        </div>
                    </div>

                    {/* Lista de Roles */}
                    <div className="flex-1 overflow-y-auto max-h-[560px] space-y-2 mt-3 pr-1">
                        {rolesFiltrados.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-xs">
                                No se encontraron roles coincidentes.
                            </div>
                        ) : (
                            rolesFiltrados.map(rol => {
                                const isChecked = selectedRoleIds.includes(rol.id)
                                // Cuántos de los permisos seleccionados ya tiene este rol
                                const permisosYaPoseidos = selectedPermissionIds.filter(pId =>
                                    rol.permissions.includes(pId)
                                ).length

                                return (
                                    <label
                                        key={rol.id}
                                        className={`block p-3 rounded-xl border cursor-pointer transition-all ${
                                            isChecked
                                                ? 'bg-cyan-50/70 border-cyan-300 shadow-xs'
                                                : 'bg-white hover:bg-slate-50 border-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => toggleRole(rol.id)}
                                                className="mt-1 rounded text-cyan-700 focus:ring-cyan-500 border-slate-300 w-4 h-4"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-bold text-slate-900 truncate">
                                                        {rol.name}
                                                    </span>
                                                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                                                        {rol.userCount} usuarios
                                                    </span>
                                                </div>

                                                {rol.description && (
                                                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                                        {rol.description}
                                                    </p>
                                                )}

                                                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                                                    <span>Permisos actuales: <strong>{rol.permissions.length}</strong></span>
                                                    {selectedPermissionIds.length > 0 && (
                                                        <span className="text-cyan-700 font-semibold">
                                                            {permisosYaPoseidos} ya asignados
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </label>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Barra Flotante de Acciones */}
            <div className="sticky bottom-4 z-30 bg-slate-900 text-white rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-800">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                        <Layers className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 uppercase font-semibold">Resumen de Selección</div>
                        <div className="text-sm font-medium">
                            Se aplicará a <strong className="text-white">{selectedRoleIds.length} roles</strong> con <strong className="text-cyan-400">{selectedPermissionIds.length} permisos</strong> seleccionados.
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                    <button
                        onClick={() => {
                            setSelectedRoleIds([])
                            setSelectedPermissionIds([])
                        }}
                        disabled={selectedRoleIds.length === 0 && selectedPermissionIds.length === 0}
                        className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
                    >
                        Limpiar Selección
                    </button>

                    <button
                        onClick={() => setModalConfirmacion({ open: true, operacion: 'remover' })}
                        disabled={selectedRoleIds.length === 0 || selectedPermissionIds.length === 0}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 font-semibold text-xs transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                        <MinusCircle className="w-4 h-4 text-rose-400" />
                        <span>Remover Permisos</span>
                    </button>

                    <button
                        onClick={() => setModalConfirmacion({ open: true, operacion: 'agregar' })}
                        disabled={selectedRoleIds.length === 0 || selectedPermissionIds.length === 0}
                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                    >
                        <PlusCircle className="w-4 h-4" />
                        <span>Incorporar a Roles</span>
                    </button>
                </div>
            </div>

            {/* MODAL DE CONFIRMACIÓN */}
            {modalConfirmacion.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-scaleUp">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`p-2 rounded-lg ${modalConfirmacion.operacion === 'agregar' ? 'bg-cyan-100 text-cyan-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {modalConfirmacion.operacion === 'agregar' ? <PlusCircle className="w-5 h-5" /> : <MinusCircle className="w-5 h-5" />}
                                </div>
                                <h3 className="text-base font-bold text-slate-900">
                                    {modalConfirmacion.operacion === 'agregar' ? 'Confirmar Incorporación Masiva' : 'Confirmar Remoción Masiva'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setModalConfirmacion({ open: false, operacion: 'agregar' })}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-xs text-slate-600">
                            <p className="text-slate-700 text-sm">
                                ¿Estás seguro de que deseas{' '}
                                <strong className={modalConfirmacion.operacion === 'agregar' ? 'text-cyan-700' : 'text-rose-700'}>
                                    {modalConfirmacion.operacion === 'agregar' ? 'incorporar' : 'remover'}
                                </strong>{' '}
                                estos <strong>{selectedPermissionIds.length} permisos</strong> en los siguientes <strong>{selectedRoleIds.length} roles</strong>?
                            </p>

                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-40 overflow-y-auto space-y-1">
                                <span className="font-bold text-slate-800 uppercase block mb-1">Roles afectados:</span>
                                {roles
                                    .filter(r => selectedRoleIds.includes(r.id))
                                    .map(r => (
                                        <div key={r.id} className="flex items-center justify-between text-slate-700">
                                            <span>• {r.name}</span>
                                            <span className="text-slate-400">({r.userCount} usuarios)</span>
                                        </div>
                                    ))}
                            </div>

                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-36 overflow-y-auto space-y-1">
                                <span className="font-bold text-slate-800 uppercase block mb-1">Permisos involucrados:</span>
                                {permisos
                                    .filter(p => selectedPermissionIds.includes(p.id))
                                    .map(p => (
                                        <div key={p.id} className="text-slate-700 truncate">
                                            • {p.name} <code className="text-[10px] text-slate-400">({p.id})</code>
                                        </div>
                                    ))}
                            </div>

                            <p className="text-[11px] text-slate-500 italic">
                                Esta acción se registrará en el módulo de auditoría de actividad del sistema.
                            </p>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setModalConfirmacion({ open: false, operacion: 'agregar' })}
                                disabled={isExecuting}
                                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmarOperacion}
                                disabled={isExecuting}
                                className={`px-5 py-2 rounded-lg text-xs font-bold text-white shadow-md flex items-center gap-2 transition-all ${
                                    modalConfirmacion.operacion === 'agregar'
                                        ? 'bg-cyan-700 hover:bg-cyan-800'
                                        : 'bg-rose-600 hover:bg-rose-700'
                                }`}
                            >
                                {isExecuting ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>Procesando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Sí, {modalConfirmacion.operacion === 'agregar' ? 'Incorporar Permisos' : 'Remover Permisos'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
