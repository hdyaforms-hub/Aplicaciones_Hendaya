'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { CarpetaUI, PrivilegioUI, NivelPermiso, TipoPrivilegio } from '@/types/documentos'

interface PrivilegiosClientProps {
    user: any
}

export default function PrivilegiosClient({ user }: PrivilegiosClientProps) {
    const [carpetas, setCarpetas] = useState<CarpetaUI[]>([])
    const [selectedCarpeta, setSelectedCarpeta] = useState<CarpetaUI | null>(null)
    const [privilegios, setPrivilegios] = useState<PrivilegioUI[]>([])
    const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
    const [usuarios, setUsuarios] = useState<{ id: string; name: string; username: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingPrivs, setLoadingPrivs] = useState(false)
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})

    // Form inputs
    const [tipo, setTipo] = useState<TipoPrivilegio>('rol')
    const [referenciaId, setReferenciaId] = useState('')
    const [permiso, setPermiso] = useState<NivelPermiso>('ver')
    const [userSearchTerm, setUserSearchTerm] = useState('')
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Cargar carpetas y listas maestras
    const fetchCarpetas = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/documentos/carpetas')
            const data = await res.json()
            if (res.ok && data.carpetas) {
                setCarpetas(data.carpetas)
                if (data.carpetas.length > 0 && !selectedCarpeta) {
                    setSelectedCarpeta(data.carpetas[0])
                    setExpandedFolders({ [data.carpetas[0].id]: true })
                }
            }
        } catch (e) {
            console.error('Error al cargar carpetas:', e)
        } finally {
            setLoading(false)
        }
    }, [selectedCarpeta])

    useEffect(() => {
        fetchCarpetas()
    }, [fetchCarpetas])

    // Cargar privilegios de la carpeta seleccionada
    const fetchPrivilegios = useCallback(async (carpetaId: string) => {
        setLoadingPrivs(true)
        setMessage(null)
        try {
            const res = await fetch(`/api/admin/documentos/privilegios/${carpetaId}`)
            const data = await res.json()
            if (res.ok) {
                setPrivilegios(data.privilegios || [])
                if (data.roles) setRoles(data.roles)
                if (data.usuarios) setUsuarios(data.usuarios)
                if (data.roles && data.roles.length > 0 && !referenciaId) {
                    setReferenciaId(data.roles[0].id)
                }
            }
        } catch (e) {
            console.error('Error al cargar privilegios:', e)
        } finally {
            setLoadingPrivs(false)
        }
    }, [referenciaId])

    useEffect(() => {
        if (selectedCarpeta) {
            fetchPrivilegios(selectedCarpeta.id)
        }
    }, [selectedCarpeta, fetchPrivilegios])

    // Asignar nuevo privilegio
    const handleAddPrivilege = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedCarpeta || !referenciaId || saving) return
        setSaving(true)
        setMessage(null)

        try {
            const res = await fetch('/api/admin/documentos/privilegios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    carpetaId: selectedCarpeta.id,
                    tipo,
                    referenciaId,
                    permiso
                })
            })

            const data = await res.json()
            if (res.ok && data.success) {
                setMessage({ type: 'success', text: 'Privilegio asignado exitosamente.' })
                fetchPrivilegios(selectedCarpeta.id)
            } else {
                setMessage({ type: 'error', text: data.message || 'Error al asignar privilegio' })
            }
        } catch (e: any) {
            setMessage({ type: 'error', text: e?.message || 'Error de red al asignar' })
        } finally {
            setSaving(false)
        }
    }

    // Revocar privilegio
    const handleDeletePrivilege = async (privId: string) => {
        if (!confirm('¿Estás seguro de revocar este permiso de acceso?')) return

        try {
            const res = await fetch(`/api/admin/documentos/privilegios?id=${privId}`, {
                method: 'DELETE'
            })
            const data = await res.json()
            if (res.ok && data.success) {
                if (selectedCarpeta) {
                    fetchPrivilegios(selectedCarpeta.id)
                }
            } else {
                alert(data.message || 'Error al revocar privilegio')
            }
        } catch (e: any) {
            alert(e?.message || 'Error al revocar privilegio')
        }
    }

    // Badge de nivel de permiso
    const getPermisoBadge = (perm: NivelPermiso) => {
        switch (perm) {
            case 'ver':
                return { label: '👁️ Ver Documentos', bg: 'bg-blue-100 text-blue-900 border-blue-300' }
            case 'descargar':
                return { label: '⬇️ Descargar', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' }
            case 'subir':
                return { label: '⬆️ Subir y Cargar', bg: 'bg-amber-100 text-amber-900 border-amber-300' }
            case 'administrar':
                return { label: '🛡️ Administrar Total', bg: 'bg-rose-100 text-rose-900 border-rose-300' }
            default:
                return { label: perm, bg: 'bg-slate-100 text-slate-800 border-slate-300' }
        }
    }

    // Filtrar usuarios en buscador
    const filteredUsers = usuarios.filter(u =>
        u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(userSearchTerm.toLowerCase())
    )

    // Render recursivo de carpetas
    const renderFolderTree = (folderList: CarpetaUI[], level = 0) => {
        return (
            <div className="space-y-1">
                {folderList.map(folder => {
                    const isSelected = selectedCarpeta?.id === folder.id
                    const isExpanded = !!expandedFolders[folder.id]
                    const hasSubfolders = folder.subCarpetas && folder.subCarpetas.length > 0

                    return (
                        <div key={folder.id} className="space-y-1">
                            <div
                                onClick={() => setSelectedCarpeta(folder)}
                                style={{ paddingLeft: `${Math.max(10, level * 16 + 10)}px` }}
                                className={`group flex items-center justify-between pr-3 py-2 rounded-2xl cursor-pointer text-xs font-bold transition-all select-none ${
                                    isSelected
                                        ? 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white shadow-md shadow-cyan-600/20'
                                        : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                                }`}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    {hasSubfolders ? (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setExpandedFolders(prev => ({ ...prev, [folder.id]: !prev[folder.id] }))
                                            }}
                                            className={`w-4 h-4 flex items-center justify-center rounded-md transition-transform cursor-pointer ${
                                                isExpanded ? 'rotate-90' : ''
                                            } ${isSelected ? 'text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            ▶
                                        </button>
                                    ) : (
                                        <span className="w-4" />
                                    )}
                                    <span className="text-base flex-shrink-0">{folder.icono || '📁'}</span>
                                    <span className="truncate">{folder.nombre}</span>
                                </div>
                            </div>

                            {hasSubfolders && isExpanded && (
                                <div className="border-l-2 border-slate-200/60 ml-5 pl-1 space-y-1">
                                    {renderFolderTree(folder.subCarpetas!, level + 1)}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Cabecera */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/20 border border-cyan-400/30 rounded-full text-cyan-300 text-xs font-black tracking-wider uppercase">
                        <span>🛡️</span>
                        <span>Mantenedor • Seguridad y Control</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">
                        Privilegios de Acceso Documental
                    </h1>
                    <p className="text-xs text-slate-400">
                        Define qué roles de la empresa o colaboradores específicos pueden ver, descargar o cargar en cada carpeta.
                    </p>
                </div>
            </div>

            {/* Layout Árbol Izquierdo + Panel de Privilegios */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Árbol de Selección de Carpeta */}
                <div className="lg:col-span-4 bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="text-base">📁</span>
                            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                Selecciona Carpeta
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={fetchCarpetas}
                            className="text-xs text-cyan-600 hover:text-cyan-800 font-bold cursor-pointer"
                        >
                            🔄
                        </button>
                    </div>

                    {loading ? (
                        <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                            <div className="w-6 h-6 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p>Cargando carpetas...</p>
                        </div>
                    ) : carpetas.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-8">No hay carpetas registradas.</p>
                    ) : (
                        <div className="max-h-[600px] overflow-y-auto pr-1">
                            {renderFolderTree(carpetas)}
                        </div>
                    )}
                </div>

                {/* Panel de Privilegios de la Carpeta */}
                <div className="lg:col-span-8 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
                    <div className="space-y-1 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">{selectedCarpeta?.icono || '📂'}</span>
                            <h2 className="text-base font-black text-slate-900">
                                Privilegios para: {selectedCarpeta ? selectedCarpeta.nombre : 'Selecciona una carpeta'}
                            </h2>
                        </div>
                        {selectedCarpeta?.rutaCompleta && (
                            <p className="text-xs text-slate-400 font-bold">
                                Ruta en OneDrive: {selectedCarpeta.rutaCompleta}
                            </p>
                        )}
                    </div>

                    {/* Alertas Informativas */}
                    <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 text-xs text-blue-950 space-y-1">
                        <p className="font-bold flex items-center gap-1.5">
                            <span>ℹ️</span>
                            <span>Jerarquía de Permisos Automática:</span>
                        </p>
                        <p className="text-[11px] text-blue-800 leading-relaxed">
                            • Un usuario con permiso <strong>Administrar</strong> puede ver, descargar y subir automáticamente.<br />
                            • Un usuario con permiso <strong>Subir</strong> o <strong>Descargar</strong> puede ver automáticamente.<br />
                            • Los usuarios con rol <strong>Administrador</strong> siempre tienen acceso total.
                        </p>
                    </div>

                    {message && (
                        <div className={`p-3 rounded-xl text-xs font-bold border flex items-center gap-2 ${
                            message.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-900 border-rose-300'
                        }`}>
                            <span>{message.type === 'success' ? '✅' : '❌'}</span>
                            <span>{message.text}</span>
                        </div>
                    )}

                    {/* Tabla de Privilegios Actuales */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                            Privilegios Asignados ({privilegios.length}):
                        </h3>

                        {loadingPrivs ? (
                            <div className="py-10 text-center text-slate-400 text-xs">Cargando permisos...</div>
                        ) : privilegios.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <p className="font-bold text-slate-600 mb-1">Sin privilegios explícitos asignados</p>
                                <p className="text-[11px]">Solo los Administradores pueden acceder a esta carpeta actualmente.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-[10px] uppercase tracking-wider">
                                            <th className="py-2.5 px-3">Tipo</th>
                                            <th className="py-2.5 px-3">Destinatario</th>
                                            <th className="py-2.5 px-3">Nivel de Permiso</th>
                                            <th className="py-2.5 px-3 text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {privilegios.map(p => {
                                            const badge = getPermisoBadge(p.permiso)
                                            return (
                                                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="py-3 px-3">
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                                            p.tipo === 'rol' ? 'bg-indigo-100 text-indigo-900' : 'bg-purple-100 text-purple-900'
                                                        }`}>
                                                            {p.tipo === 'rol' ? '🛡️ Rol' : '👤 Usuario'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 font-bold text-slate-900">
                                                        {p.referenciaNombre}
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${badge.bg}`}>
                                                            {badge.label}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeletePrivilege(p.id)}
                                                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                                                        >
                                                            Revocar
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Formulario: Asignar Nuevo Privilegio */}
                    <div className="p-5 bg-slate-50/80 rounded-3xl border border-slate-200 space-y-4">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <span>➕</span>
                            <span>Asignar Nuevo Privilegio</span>
                        </h3>

                        <form onSubmit={handleAddPrivilege} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {/* Selector Tipo */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-slate-700">Tipo de Asignación</label>
                                    <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTipo('rol')
                                                if (roles.length > 0) setReferenciaId(roles[0].id)
                                            }}
                                            className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                tipo === 'rol' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            🛡️ Por Rol
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTipo('usuario')
                                                if (usuarios.length > 0) setReferenciaId(usuarios[0].id)
                                            }}
                                            className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                tipo === 'usuario' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            👤 Por Usuario
                                        </button>
                                    </div>
                                </div>

                                {/* Selector de Rol o Usuario */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-slate-700">
                                        {tipo === 'rol' ? 'Seleccionar Rol' : 'Seleccionar Usuario'}
                                    </label>

                                    {tipo === 'rol' ? (
                                        <select
                                            value={referenciaId}
                                            onChange={(e) => setReferenciaId(e.target.value)}
                                            className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-cyan-500"
                                        >
                                            {roles.map(r => (
                                                <option key={r.id} value={r.id}>
                                                    🛡️ {r.name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="space-y-1.5">
                                            <input
                                                type="text"
                                                value={userSearchTerm}
                                                onChange={(e) => setUserSearchTerm(e.target.value)}
                                                placeholder="Filtrar colaborador..."
                                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                                            />
                                            <select
                                                value={referenciaId}
                                                onChange={(e) => setReferenciaId(e.target.value)}
                                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-cyan-500"
                                            >
                                                {filteredUsers.map(u => (
                                                    <option key={u.id} value={u.id}>
                                                        👤 {u.name} (@{u.username})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* Nivel de Permiso */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-slate-700">Nivel de Permiso</label>
                                    <select
                                        value={permiso}
                                        onChange={(e) => setPermiso(e.target.value as NivelPermiso)}
                                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-cyan-500"
                                    >
                                        <option value="ver">👁️ Ver Documentos</option>
                                        <option value="descargar">⬇️ Descargar Documentos</option>
                                        <option value="subir">⬆️ Subir y Cargar Documentos</option>
                                        <option value="administrar">🛡️ Administrar Carpeta (Total)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={saving || !selectedCarpeta || !referenciaId}
                                    className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
                                >
                                    {saving ? 'Asignando...' : '➕ Asignar Privilegio'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
