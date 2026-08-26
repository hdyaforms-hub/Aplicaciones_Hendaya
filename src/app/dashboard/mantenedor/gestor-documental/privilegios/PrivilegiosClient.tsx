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
    const [sucursales, setSucursales] = useState<{ id: string; nombre: string }[]>([])
    const [licitaciones, setLicitaciones] = useState<{ id: string; nombre: string }[]>([])
    const [colegios, setColegios] = useState<{ rbd: number; nombre: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingPrivs, setLoadingPrivs] = useState(false)
    const [loadingCatalogos, setLoadingCatalogos] = useState(true)
    const [errorCarpetas, setErrorCarpetas] = useState<string | null>(null)
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})

    // Form inputs
    const [tipo, setTipo] = useState<TipoPrivilegio>('rol')
    const [referenciaId, setReferenciaId] = useState('')
    const [permiso, setPermiso] = useState<NivelPermiso>('ver')
    const [userSearchTerm, setUserSearchTerm] = useState('')
    const [colegioSearchTerm, setColegioSearchTerm] = useState('')
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Cargar listas maestras de catálogos inmediatamente al montar
    const fetchCatalogos = useCallback(async () => {
        setLoadingCatalogos(true)
        try {
            const res = await fetch('/api/admin/documentos/privilegios', { cache: 'no-store' })
            const data = await res.json()
            if (res.ok) {
                if (data.roles) setRoles(data.roles)
                if (data.usuarios) setUsuarios(data.usuarios)
                if (data.sucursales) setSucursales(data.sucursales)
                if (data.licitaciones) setLicitaciones(data.licitaciones)
                if (data.colegios) setColegios(data.colegios)
            }
        } catch (e: any) {
            console.error('Error al cargar catálogos maestros:', e)
        } finally {
            setLoadingCatalogos(false)
        }
    }, [])

    useEffect(() => {
        fetchCatalogos()
    }, [fetchCatalogos])

    // Cargar carpetas
    const fetchCarpetas = useCallback(async () => {
        setLoading(true)
        setErrorCarpetas(null)
        try {
            const res = await fetch('/api/admin/documentos/carpetas', { cache: 'no-store' })
            const data = await res.json()
            if (res.ok && Array.isArray(data.carpetas)) {
                setCarpetas(data.carpetas)
                if (data.carpetas.length > 0) {
                    setSelectedCarpeta(prev => {
                        if (prev && data.carpetas.some((c: CarpetaUI) => c.id === prev.id)) {
                            return prev
                        }
                        setExpandedFolders(f => ({ ...f, [data.carpetas[0].id]: true }))
                        return data.carpetas[0]
                    })
                }
            } else {
                setErrorCarpetas(data.message || 'Error al obtener estructura de carpetas')
            }
        } catch (e: any) {
            console.error('Error al cargar carpetas:', e)
            setErrorCarpetas(e?.message || 'Error de conexión al cargar carpetas')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchCarpetas()
    }, [fetchCarpetas])

    // Cargar privilegios de la carpeta seleccionada
    const fetchPrivilegios = useCallback(async (carpetaId: string) => {
        setLoadingPrivs(true)
        setMessage(null)
        try {
            const res = await fetch(`/api/admin/documentos/privilegios?carpetaId=${carpetaId}`, { cache: 'no-store' })
            const data = await res.json()
            if (res.ok) {
                setPrivilegios(data.privilegios || [])
                if (data.roles && data.roles.length > 0) setRoles(data.roles)
                if (data.usuarios && data.usuarios.length > 0) setUsuarios(data.usuarios)
                if (data.sucursales && data.sucursales.length > 0) setSucursales(data.sucursales)
                if (data.licitaciones && data.licitaciones.length > 0) setLicitaciones(data.licitaciones)
                if (data.colegios && data.colegios.length > 0) setColegios(data.colegios)
            } else {
                setMessage({ type: 'error', text: data.message || 'Error al cargar privilegios' })
            }
        } catch (e: any) {
            console.error('Error al cargar privilegios:', e)
            setMessage({ type: 'error', text: e?.message || 'Error de conexión al cargar privilegios' })
        } finally {
            setLoadingPrivs(false)
        }
    }, [])

    useEffect(() => {
        if (selectedCarpeta?.id) {
            fetchPrivilegios(selectedCarpeta.id)
        }
    }, [selectedCarpeta?.id, fetchPrivilegios])

    // Sincronizar automáticamente referenciaId cuando cambia el criterio o cargan los datos
    useEffect(() => {
        if (tipo === 'rol' && roles.length > 0) {
            if (!referenciaId || !roles.some(r => r.id === referenciaId)) {
                setReferenciaId(roles[0].id)
            }
        } else if (tipo === 'sucursal' && sucursales.length > 0) {
            if (!referenciaId || !sucursales.some(s => s.id === referenciaId)) {
                setReferenciaId(sucursales[0].id)
            }
        } else if (tipo === 'licitacion' && licitaciones.length > 0) {
            if (!referenciaId || !licitaciones.some(l => l.id === referenciaId)) {
                setReferenciaId(licitaciones[0].id)
            }
        } else if (tipo === 'rbd' && colegios.length > 0) {
            if (!referenciaId || !colegios.some(c => String(c.rbd) === referenciaId)) {
                setReferenciaId(String(colegios[0].rbd))
            }
        } else if (tipo === 'usuario' && usuarios.length > 0) {
            if (!referenciaId || !usuarios.some(u => u.id === referenciaId)) {
                setReferenciaId(usuarios[0].id)
            }
        }
    }, [tipo, roles, sucursales, licitaciones, colegios, usuarios, referenciaId])

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

    // Badges de tipo y nivel de permiso
    const getTipoBadge = (t: TipoPrivilegio) => {
        switch (t) {
            case 'rol':
                return { label: '👥 Rol', bg: 'bg-indigo-100 text-indigo-900 border-indigo-200' }
            case 'sucursal':
                return { label: '🏢 Sucursal', bg: 'bg-emerald-100 text-emerald-900 border-emerald-200' }
            case 'licitacion':
                return { label: '📑 Licitación', bg: 'bg-cyan-100 text-cyan-900 border-cyan-200' }
            case 'rbd':
                return { label: '🏫 Colegio (RBD)', bg: 'bg-amber-100 text-amber-900 border-amber-200' }
            case 'usuario':
                return { label: '👤 Usuario', bg: 'bg-purple-100 text-purple-900 border-purple-200' }
            default:
                return { label: t, bg: 'bg-slate-100 text-slate-800 border-slate-200' }
        }
    }

    // Badge de nivel de permiso
    const getPermisoBadge = (perm: NivelPermiso) => {
        switch (perm) {
            case 'ver':
                return { label: '👁️ Solo Ver', bg: 'bg-blue-100 text-blue-900 border-blue-300' }
            case 'descargar':
            case 'ver_descargar':
                return { label: '👁️ Ver y ⬇️ Descargar', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' }
            case 'subir':
                return { label: '⬆️ Ver, Descargar y Subir', bg: 'bg-amber-100 text-amber-900 border-amber-300' }
            case 'administrar':
                return { label: '🛡️ Administrar Total', bg: 'bg-rose-100 text-rose-900 border-rose-300' }
            default:
                return { label: perm, bg: 'bg-slate-100 text-slate-800 border-slate-300' }
        }
    }

    // Filtrar usuarios y colegios en buscador
    const filteredUsers = usuarios.filter(u =>
        u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(userSearchTerm.toLowerCase())
    )

    const filteredColegios = colegios.filter(c =>
        c.nombre.toLowerCase().includes(colegioSearchTerm.toLowerCase()) ||
        String(c.rbd).includes(colegioSearchTerm.trim())
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
                        <div key={folder.id} className="select-none">
                            <div
                                onClick={() => setSelectedCarpeta(folder)}
                                style={{ paddingLeft: `${level * 16 + 8}px` }}
                                className={`flex items-center justify-between py-2 pr-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    isSelected
                                        ? 'bg-cyan-50 text-cyan-900 border border-cyan-200 font-black shadow-xs'
                                        : 'text-slate-700 hover:bg-slate-50'
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
                                            className="p-1 hover:bg-slate-200/60 rounded-md text-slate-400"
                                        >
                                            {isExpanded ? '▼' : '▶'}
                                        </button>
                                    ) : (
                                        <span className="w-5 text-center text-slate-300">•</span>
                                    )}
                                    <span className="text-base shrink-0">{folder.icono || '📁'}</span>
                                    <span className="truncate">{folder.nombre}</span>
                                </div>
                            </div>

                            {hasSubfolders && isExpanded && (
                                <div className="mt-1">
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
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-sky-500 text-white flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/25">
                        🔐
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">
                            Privilegios de Acceso Documental
                        </h1>
                        <p className="text-xs text-slate-400 font-bold">
                            Asignación granular de permisos por Rol, Sucursal, Licitación, Colegio (RBD) o Usuario.
                        </p>
                    </div>
                </div>
            </div>

            {/* Layout Árbol Izquierdo + Panel de Privilegios */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Árbol de Carpetas */}
                <div className="lg:col-span-4 bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <span>🗂️</span>
                            <span>Estructura de Carpetas</span>
                        </h2>
                        <button
                            type="button"
                            onClick={fetchCarpetas}
                            className="text-[11px] font-bold text-cyan-600 hover:text-cyan-800 cursor-pointer"
                        >
                            🔄 Refrescar
                        </button>
                    </div>

                    {loading ? (
                        <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                            <div className="w-6 h-6 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p>Cargando estructura de carpetas...</p>
                        </div>
                    ) : errorCarpetas ? (
                        <div className="py-8 text-center space-y-3 px-2">
                            <p className="text-xs font-bold text-rose-600">⚠️ {errorCarpetas}</p>
                            <button
                                type="button"
                                onClick={fetchCarpetas}
                                className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-xs font-bold rounded-xl border border-cyan-200 cursor-pointer"
                            >
                                🔄 Reintentar conexión
                            </button>
                        </div>
                    ) : carpetas.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs space-y-2">
                            <p>No hay carpetas registradas en el sistema.</p>
                            <button
                                type="button"
                                onClick={fetchCarpetas}
                                className="text-[11px] font-bold text-cyan-600 underline cursor-pointer"
                            >
                                Actualizar
                            </button>
                        </div>
                    ) : (
                        <div className="max-h-[600px] overflow-y-auto pr-1">
                            {renderFolderTree(carpetas)}
                        </div>
                    )}
                </div>

                {/* Panel de Privilegios */}
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
                                Ruta: {selectedCarpeta.rutaCompleta}
                            </p>
                        )}
                    </div>

                    {/* Alertas Informativas */}
                    <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 text-xs text-blue-950 space-y-1">
                        <p className="font-bold flex items-center gap-1.5">
                            <span>ℹ️</span>
                            <span>Jerarquía y Herencia de Permisos:</span>
                        </p>
                        <p className="text-[11px] text-blue-800 leading-relaxed">
                            • <strong>Multi-criterio</strong>: El usuario hereda accesos otorgados a su <strong>Rol</strong>, <strong>Sucursales</strong>, <strong>Licitaciones</strong> o <strong>Colegios (RBD)</strong> asignados.<br />
                            • Un usuario con permiso <strong>Administrar</strong> puede ver, descargar y subir automáticamente.<br />
                            • Un usuario con permiso <strong>Ver y Descargar</strong> puede explorar y descargar los documentos.<br />
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

                    {/* Tabla de Privilegios */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                            Privilegios Asignados ({privilegios.length}):
                        </h3>

                        {loadingPrivs ? (
                            <div className="py-10 text-center text-slate-400 text-xs">Cargando permisos...</div>
                        ) : privilegios.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <p className="font-bold text-slate-600 mb-1">Sin privilegios explícitos asignados</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-[10px] uppercase tracking-wider">
                                            <th className="py-2.5 px-3">Criterio</th>
                                            <th className="py-2.5 px-3">Destinatario / Entidad</th>
                                            <th className="py-2.5 px-3">Nivel de Permiso</th>
                                            <th className="py-2.5 px-3 text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {privilegios.map(p => {
                                            const badge = getPermisoBadge(p.permiso)
                                            const tipoBadge = getTipoBadge(p.tipo)
                                            return (
                                                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="py-3 px-3">
                                                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${tipoBadge.bg}`}>
                                                            {tipoBadge.label}
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

                    {/* Formulario */}
                    <div className="p-5 bg-slate-50/80 rounded-3xl border border-slate-200 space-y-4">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <span>➕</span>
                            <span>Asignar Nuevo Privilegio</span>
                        </h3>

                        <form onSubmit={handleAddPrivilege} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700">1. Criterio de Asignación</label>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 bg-white p-1 rounded-2xl border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTipo('rol')
                                            if (roles.length > 0) setReferenciaId(roles[0].id)
                                        }}
                                        className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                            tipo === 'rol' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                        }`}
                                    >
                                        👥 Rol ({roles.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTipo('sucursal')
                                            if (sucursales.length > 0) setReferenciaId(sucursales[0].id)
                                        }}
                                        className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                            tipo === 'sucursal' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                        }`}
                                    >
                                        🏢 Sucursal ({sucursales.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTipo('licitacion')
                                            if (licitaciones.length > 0) setReferenciaId(licitaciones[0].id)
                                        }}
                                        className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                            tipo === 'licitacion' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                        }`}
                                    >
                                        📑 Licitación ({licitaciones.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTipo('rbd')
                                            if (colegios.length > 0) setReferenciaId(String(colegios[0].rbd))
                                        }}
                                        className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                            tipo === 'rbd' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                        }`}
                                    >
                                        🏫 Colegio ({colegios.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTipo('usuario')
                                            if (usuarios.length > 0) setReferenciaId(usuarios[0].id)
                                        }}
                                        className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 col-span-2 sm:col-span-1 ${
                                            tipo === 'usuario' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                        }`}
                                    >
                                        👤 Usuario ({usuarios.length})
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-slate-700">
                                        {tipo === 'rol' && '2. Seleccionar Rol'}
                                        {tipo === 'sucursal' && '2. Seleccionar Sucursal'}
                                        {tipo === 'licitacion' && '2. Seleccionar Licitación'}
                                        {tipo === 'rbd' && '2. Seleccionar Colegio (RBD)'}
                                        {tipo === 'usuario' && '2. Seleccionar Usuario'}
                                    </label>

                                    {tipo === 'rol' && (
                                        roles.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic py-2">Cargando roles...</p>
                                        ) : (
                                            <select
                                                value={referenciaId}
                                                onChange={(e) => setReferenciaId(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-cyan-500 shadow-xs"
                                            >
                                                {roles.map(r => (
                                                    <option key={r.id} value={r.id}>
                                                        👥 {r.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )
                                    )}

                                    {tipo === 'sucursal' && (
                                        sucursales.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic py-2">Cargando sucursales...</p>
                                        ) : (
                                            <select
                                                value={referenciaId}
                                                onChange={(e) => setReferenciaId(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-cyan-500 shadow-xs"
                                            >
                                                {sucursales.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        🏢 {s.nombre}
                                                    </option>
                                                ))}
                                            </select>
                                        )
                                    )}

                                    {tipo === 'licitacion' && (
                                        licitaciones.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic py-2">Cargando licitaciones...</p>
                                        ) : (
                                            <select
                                                value={referenciaId}
                                                onChange={(e) => setReferenciaId(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-cyan-500 shadow-xs"
                                            >
                                                {licitaciones.map(l => (
                                                    <option key={l.id} value={l.id}>
                                                        📑 {l.nombre}
                                                    </option>
                                                ))}
                                            </select>
                                        )
                                    )}

                                    {tipo === 'rbd' && (
                                        <div className="space-y-1.5">
                                            <input
                                                type="text"
                                                value={colegioSearchTerm}
                                                onChange={(e) => setColegioSearchTerm(e.target.value)}
                                                placeholder="Buscar por RBD o nombre de establecimiento..."
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-cyan-500"
                                            />
                                            <select
                                                value={referenciaId}
                                                onChange={(e) => setReferenciaId(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-cyan-500 shadow-xs"
                                            >
                                                {filteredColegios.length === 0 ? (
                                                    <option value="">No se encontraron colegios con esa búsqueda</option>
                                                ) : (
                                                    filteredColegios.slice(0, 100).map(c => (
                                                        <option key={c.rbd} value={String(c.rbd)}>
                                                            🏫 {c.nombre}
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        </div>
                                    )}

                                    {tipo === 'usuario' && (
                                        <div className="space-y-1.5">
                                            <input
                                                type="text"
                                                value={userSearchTerm}
                                                onChange={(e) => setUserSearchTerm(e.target.value)}
                                                placeholder="Buscar por nombre o usuario..."
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-cyan-500"
                                            />
                                            <select
                                                value={referenciaId}
                                                onChange={(e) => setReferenciaId(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-cyan-500 shadow-xs"
                                            >
                                                {filteredUsers.length === 0 ? (
                                                    <option value="">No se encontraron usuarios</option>
                                                ) : (
                                                    filteredUsers.map(u => (
                                                        <option key={u.id} value={u.id}>
                                                            👤 {u.name} (@{u.username})
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-slate-700">3. Nivel de Permiso</label>
                                    <select
                                        value={permiso}
                                        onChange={(e) => setPermiso(e.target.value as NivelPermiso)}
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-cyan-500 shadow-xs"
                                    >
                                        <option value="ver">👁️ Solo Ver Documentos</option>
                                        <option value="descargar">👁️ Ver y ⬇️ Descargar Documentos</option>
                                        <option value="subir">⬆️ Subir Archivos (Ver, Descargar y Cargar)</option>
                                        <option value="administrar">🛡️ Administrar Carpeta (Acceso Total)</option>
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
