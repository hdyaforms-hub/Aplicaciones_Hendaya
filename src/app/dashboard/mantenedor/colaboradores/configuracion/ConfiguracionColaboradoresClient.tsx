'use client'

import React, { useState } from 'react'
import {
    Newspaper, Rss, Plus, RefreshCw, Search, Edit3, Trash2, Power,
    ExternalLink, CheckCircle2, AlertCircle, Sparkles, Filter, Globe, Calendar, Link as LinkIcon
} from 'lucide-react'
import {
    NoticiaAdminItem, FuenteRSSItem,
    guardarNoticiaAction, toggleActivoNoticiaAction, eliminarNoticiaAction,
    guardarFuenteRSSAction, toggleActivoFuenteRSSAction, eliminarFuenteRSSAction,
    sincronizarNoticiasRSSAction
} from './actions'

interface Props {
    initialNoticias: NoticiaAdminItem[]
    initialFuentes: FuenteRSSItem[]
    canManage: boolean
    userName: string
}

export default function ConfiguracionColaboradoresClient({
    initialNoticias,
    initialFuentes,
    canManage,
    userName
}: Props) {
    const [activeTab, setActiveTab] = useState<'noticias' | 'rss'>('noticias')
    const [noticias, setNoticias] = useState<NoticiaAdminItem[]>(initialNoticias)
    const [fuentes, setFuentes] = useState<FuenteRSSItem[]>(initialFuentes)

    // Filtros
    const [search, setSearch] = useState('')
    const [filterEstado, setFilterEstado] = useState<'TODOS' | 'ACTIVO' | 'INACTIVO'>('TODOS')
    const [filterTipo, setFilterTipo] = useState<'TODOS' | 'MANUAL' | 'RSS'>('TODOS')

    // Estados de UI
    const [loading, setLoading] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)

    // Modal Noticia
    const [modalNoticiaOpen, setModalNoticiaOpen] = useState(false)
    const [editingNoticia, setEditingNoticia] = useState<NoticiaAdminItem | null>(null)
    const [formTitulo, setFormTitulo] = useState('')
    const [formFuente, setFormFuente] = useState('')
    const [formLink, setFormLink] = useState('')
    const [formOrden, setFormOrden] = useState<number>(1)
    const [formResumen, setFormResumen] = useState('')
    const [formActivo, setFormActivo] = useState(true)

    // Modal Fuente RSS
    const [modalFuenteOpen, setModalFuenteOpen] = useState(false)
    const [editingFuente, setEditingFuente] = useState<FuenteRSSItem | null>(null)
    const [formNombreFuente, setFormNombreFuente] = useState('')
    const [formUrlFeed, setFormUrlFeed] = useState('')
    const [formActivoFuente, setFormActivoFuente] = useState(true)

    const [saving, setSaving] = useState(false)

    // Filtrado de noticias
    const noticiasFiltradas = noticias.filter(n => {
        if (filterEstado === 'ACTIVO' && !n.activo) return false
        if (filterEstado === 'INACTIVO' && n.activo) return false
        if (filterTipo === 'MANUAL' && n.esAutomatica) return false
        if (filterTipo === 'RSS' && !n.esAutomatica) return false

        const term = search.toLowerCase()
        return (
            n.titulo.toLowerCase().includes(term) ||
            n.fuente.toLowerCase().includes(term) ||
            (n.resumen || '').toLowerCase().includes(term)
        )
    })

    // Sincronización RSS
    const handleSincronizarRSS = async () => {
        try {
            setSyncing(true)
            setErrorMsg(null)
            const res = await sincronizarNoticiasRSSAction()
            if (res.success) {
                const count = res.nuevasImportadas ?? 0
                setSuccessMsg(
                    count > 0 
                        ? `Sincronización exitosa: se agregaron ${count} noticias nuevas desde las fuentes activas.`
                        : 'Sincronización completada: todas las fuentes están al día, no se detectaron noticias nuevas.'
                )
                setTimeout(() => setSuccessMsg(null), 5000)
                // Recargar listados
                window.location.reload()
            } else {
                setErrorMsg(res.error || 'No se pudo sincronizar con los feeds RSS')
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error inesperado durante la sincronización')
        } finally {
            setSyncing(false)
        }
    }

    // Handlers Noticia
    const handleOpenNewNoticia = () => {
        setEditingNoticia(null)
        setFormTitulo('')
        setFormFuente('')
        setFormLink('')
        setFormOrden(noticias.length + 1)
        setFormResumen('')
        setFormActivo(true)
        setErrorMsg(null)
        setModalNoticiaOpen(true)
    }

    const handleOpenEditNoticia = (item: NoticiaAdminItem) => {
        setEditingNoticia(item)
        setFormTitulo(item.titulo)
        setFormFuente(item.fuente)
        setFormLink(item.link)
        setFormOrden(item.orden)
        setFormResumen(item.resumen || '')
        setFormActivo(item.activo)
        setErrorMsg(null)
        setModalNoticiaOpen(true)
    }

    const handleSaveNoticia = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formTitulo.trim() || !formFuente.trim() || !formLink.trim()) {
            setErrorMsg('Título, Fuente y Enlace son obligatorios')
            return
        }

        setSaving(true)
        setErrorMsg(null)
        try {
            const res = await guardarNoticiaAction({
                id: editingNoticia?.id,
                titulo: formTitulo,
                fuente: formFuente,
                link: formLink,
                orden: Number(formOrden),
                activo: formActivo,
                resumen: formResumen
            })

            if (res.success) {
                setSuccessMsg(editingNoticia ? 'Noticia actualizada exitosamente' : 'Noticia registrada exitosamente')
                setTimeout(() => setSuccessMsg(null), 3500)
                setModalNoticiaOpen(false)

                if (editingNoticia) {
                    setNoticias(prev => prev.map(n => n.id === editingNoticia.id ? {
                        ...n,
                        titulo: formTitulo,
                        fuente: formFuente,
                        link: formLink,
                        orden: Number(formOrden),
                        activo: formActivo,
                        resumen: formResumen || null,
                        actualizadoPor: userName,
                        updatedAt: new Date().toISOString()
                    } : n).sort((a, b) => a.orden - b.orden))
                } else if (res.id) {
                    const newItem: NoticiaAdminItem = {
                        id: res.id,
                        titulo: formTitulo,
                        fuente: formFuente,
                        link: formLink,
                        orden: Number(formOrden),
                        activo: formActivo,
                        esAutomatica: false,
                        resumen: formResumen || null,
                        fechaPublicacion: null,
                        creadoPor: userName,
                        actualizadoPor: null,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                    setNoticias(prev => [...prev, newItem].sort((a, b) => a.orden - b.orden))
                }
            } else {
                setErrorMsg(res.error || 'Error al guardar la noticia')
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error inesperado')
        } finally {
            setSaving(false)
        }
    }

    const handleToggleNoticia = async (item: NoticiaAdminItem) => {
        const nuevoEstado = !item.activo
        try {
            setLoading(true)
            const res = await toggleActivoNoticiaAction(item.id, nuevoEstado)
            if (res.success) {
                setNoticias(prev => prev.map(n => n.id === item.id ? { ...n, activo: nuevoEstado } : n))
                setSuccessMsg(`Noticia ${nuevoEstado ? 'activada' : 'desactivada'} con éxito`)
                setTimeout(() => setSuccessMsg(null), 3000)
            } else {
                setErrorMsg(res.error || 'Error al cambiar estado')
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error al cambiar estado')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteNoticia = async (item: NoticiaAdminItem) => {
        if (!confirm(`¿Está seguro de eliminar la noticia "${item.titulo}"?`)) return

        try {
            setLoading(true)
            const res = await eliminarNoticiaAction(item.id)
            if (res.success) {
                setNoticias(prev => prev.filter(n => n.id !== item.id))
                setSuccessMsg('Noticia eliminada correctamente')
                setTimeout(() => setSuccessMsg(null), 3000)
            } else {
                setErrorMsg(res.error || 'Error al eliminar')
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error al eliminar')
        } finally {
            setLoading(false)
        }
    }

    // Handlers Fuente RSS
    const handleOpenNewFuente = () => {
        setEditingFuente(null)
        setFormNombreFuente('')
        setFormUrlFeed('')
        setFormActivoFuente(true)
        setErrorMsg(null)
        setModalFuenteOpen(true)
    }

    const handleOpenEditFuente = (item: FuenteRSSItem) => {
        setEditingFuente(item)
        setFormNombreFuente(item.nombre)
        setFormUrlFeed(item.urlFeed)
        setFormActivoFuente(item.activo)
        setErrorMsg(null)
        setModalFuenteOpen(true)
    }

    const handleSaveFuente = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formNombreFuente.trim() || !formUrlFeed.trim()) {
            setErrorMsg('Nombre y URL de feed RSS son obligatorios')
            return
        }

        setSaving(true)
        setErrorMsg(null)
        try {
            const res = await guardarFuenteRSSAction({
                id: editingFuente?.id,
                nombre: formNombreFuente,
                urlFeed: formUrlFeed,
                activo: formActivoFuente
            })

            if (res.success) {
                setSuccessMsg(editingFuente ? 'Fuente RSS actualizada' : 'Fuente RSS registrada con éxito')
                setTimeout(() => setSuccessMsg(null), 3500)
                setModalFuenteOpen(false)

                if (editingFuente) {
                    setFuentes(prev => prev.map(f => f.id === editingFuente.id ? {
                        ...f,
                        nombre: formNombreFuente,
                        urlFeed: formUrlFeed,
                        activo: formActivoFuente
                    } : f))
                } else if (res.id) {
                    const newItem: FuenteRSSItem = {
                        id: res.id,
                        nombre: formNombreFuente,
                        urlFeed: formUrlFeed,
                        activo: formActivoFuente,
                        ultimaSincronizacion: null,
                        totalImportadas: 0,
                        createdAt: new Date().toISOString()
                    }
                    setFuentes(prev => [newItem, ...prev])
                }
            } else {
                setErrorMsg(res.error || 'Error al guardar fuente RSS')
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error inesperado')
        } finally {
            setSaving(false)
        }
    }

    const handleToggleFuente = async (item: FuenteRSSItem) => {
        const nuevoEstado = !item.activo
        try {
            setLoading(true)
            const res = await toggleActivoFuenteRSSAction(item.id, nuevoEstado)
            if (res.success) {
                setFuentes(prev => prev.map(f => f.id === item.id ? { ...f, activo: nuevoEstado } : f))
                setSuccessMsg(`Fuente ${nuevoEstado ? 'activada' : 'desactivada'}`)
                setTimeout(() => setSuccessMsg(null), 2500)
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error al cambiar estado')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteFuente = async (item: FuenteRSSItem) => {
        if (!confirm(`¿Eliminar la fuente RSS "${item.nombre}"?`)) return
        try {
            setLoading(true)
            const res = await eliminarFuenteRSSAction(item.id)
            if (res.success) {
                setFuentes(prev => prev.filter(f => f.id !== item.id))
                setSuccessMsg('Fuente RSS eliminada')
                setTimeout(() => setSuccessMsg(null), 2500)
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error al eliminar')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header corporativo Hendaya */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-cyan-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Newspaper className="w-4 h-4 text-cyan-600" />
                            Mantenedor · Colaboradores
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                        Configuración de Colaboradores
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Administración centralizada de noticias sectoriales, fuentes RSS automáticas y parámetros del área de Colaboradores.
                    </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    {canManage && (
                        <>
                            <button
                                onClick={handleSincronizarRSS}
                                disabled={syncing}
                                className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-cyan-700 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                                title="Sincronizar noticias desde los feeds RSS activos"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-cyan-600' : ''}`} />
                                {syncing ? 'Sincronizando...' : 'Sincronizar RSS'}
                            </button>

                            {activeTab === 'noticias' ? (
                                <button
                                    onClick={handleOpenNewNoticia}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-700 hover:bg-cyan-800 text-white transition-all shadow-md shadow-cyan-700/20 flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Nueva Noticia
                                </button>
                            ) : (
                                <button
                                    onClick={handleOpenNewFuente}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-700 hover:bg-cyan-800 text-white transition-all shadow-md shadow-cyan-700/20 flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Nueva Fuente RSS
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Mensajes de feedback */}
            {errorMsg && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                    <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 font-bold">✕</button>
                </div>
            )}

            {successMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{successMsg}</span>
                    </div>
                    <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold">✕</button>
                </div>
            )}

            {/* Selector de Pestañas */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => {
                        setActiveTab('noticias')
                        setSearch('')
                    }}
                    className={`flex items-center gap-2 px-6 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 rounded-t-xl ${
                        activeTab === 'noticias'
                            ? 'border-cyan-600 text-cyan-700 bg-cyan-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                    <Newspaper className="w-4 h-4" />
                    Noticias Sala de Reuniones
                    <span className="ml-1.5 px-2 py-0.5 text-xs bg-cyan-100 text-cyan-800 rounded-full font-bold">
                        {noticias.length}
                    </span>
                </button>

                <button
                    onClick={() => {
                        setActiveTab('rss')
                        setSearch('')
                    }}
                    className={`flex items-center gap-2 px-6 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 rounded-t-xl ${
                        activeTab === 'rss'
                            ? 'border-cyan-600 text-cyan-700 bg-cyan-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                    <Rss className="w-4 h-4" />
                    Fuentes RSS y Sincronización
                    <span className="ml-1.5 px-2 py-0.5 text-xs bg-cyan-100 text-cyan-800 rounded-full font-bold">
                        {fuentes.length}
                    </span>
                </button>
            </div>

            {/* TAB 1: NOTICIAS SALA DE REUNIONES */}
            {activeTab === 'noticias' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    {/* Barra de Filtros y Búsqueda */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                            <div className="relative w-full sm:w-80">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar por título, medio o fuente..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all font-medium"
                                />
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <select
                                    value={filterEstado}
                                    onChange={e => setFilterEstado(e.target.value as any)}
                                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
                                >
                                    <option value="TODOS">Todos los Estados</option>
                                    <option value="ACTIVO">Solo Activas</option>
                                    <option value="INACTIVO">Solo Inactivas</option>
                                </select>

                                <select
                                    value={filterTipo}
                                    onChange={e => setFilterTipo(e.target.value as any)}
                                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
                                >
                                    <option value="TODOS">Todos los Orígenes</option>
                                    <option value="MANUAL">Manuales</option>
                                    <option value="RSS">Automáticas (RSS)</option>
                                </select>
                            </div>
                        </div>

                        <div className="text-xs text-slate-500">
                            Mostrando <span className="font-bold text-slate-800">{noticiasFiltradas.length}</span> de <span className="font-bold text-slate-800">{noticias.length}</span> noticias
                        </div>
                    </div>

                    {/* Tabla de Noticias */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs text-slate-700">
                            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200 font-bold">
                                <tr>
                                    <th className="py-3 px-3 w-16 text-center">Orden</th>
                                    <th className="py-3 px-4">Título de la Noticia</th>
                                    <th className="py-3 px-4">Fuente / Medio</th>
                                    <th className="py-3 px-4 text-center">Origen</th>
                                    <th className="py-3 px-4 text-center">Estado</th>
                                    {canManage && <th className="py-3 px-4 text-right">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {noticiasFiltradas.length === 0 ? (
                                    <tr>
                                        <td colSpan={canManage ? 6 : 5} className="py-8 text-center text-slate-400 text-xs">
                                            No se encontraron noticias coincidentes con los filtros.
                                        </td>
                                    </tr>
                                ) : (
                                    noticiasFiltradas.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-600">
                                                #{item.orden}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-start gap-1.5">
                                                    <span className="font-semibold text-slate-900 line-clamp-2">
                                                        {item.titulo}
                                                    </span>
                                                    <a
                                                        href={item.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-cyan-600 hover:text-cyan-800 shrink-0 mt-0.5"
                                                        title="Abrir enlace externo"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                </div>
                                                {item.resumen && (
                                                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 italic">
                                                        {item.resumen}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                                    {item.fuente}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {item.esAutomatica ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                                        <Sparkles className="w-3 h-3 text-sky-600" />
                                                        Feed RSS
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                        Manual
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {item.activo ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                        Visible
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                        Oculta
                                                    </span>
                                                )}
                                            </td>
                                            {canManage && (
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => handleToggleNoticia(item)}
                                                            disabled={loading}
                                                            title={item.activo ? 'Ocultar noticia' : 'Mostrar noticia'}
                                                            className={`p-1.5 rounded-lg border transition-colors ${
                                                                item.activo
                                                                    ? 'border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                                                                    : 'border-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                                                            }`}
                                                        >
                                                            <Power className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenEditNoticia(item)}
                                                            title="Editar noticia"
                                                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 transition-colors"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteNoticia(item)}
                                                            disabled={loading}
                                                            title="Eliminar noticia"
                                                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2: FUENTES RSS Y CONFIGURACIÓN AUTOMÁTICA */}
            {activeTab === 'rss' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="p-4 bg-cyan-50/50 rounded-xl border border-cyan-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                            <h3 className="text-xs font-bold text-cyan-900 uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-cyan-600" />
                                Sincronización Automática de Noticias de Alimentación
                            </h3>
                            <p className="text-[11px] text-slate-600 mt-1">
                                Las fuentes RSS configuradas aquí proveen noticias periódicas para el panel de la Sala de Reuniones. 
                                Puedes agregar canales de Google News, portales gubernamentales o medios sectoriales.
                            </p>
                        </div>
                        {canManage && (
                            <button
                                onClick={handleSincronizarRSS}
                                disabled={syncing}
                                className="px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-cyan-700/20 flex items-center gap-2 shrink-0 disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                                {syncing ? 'Sincronizando...' : 'Sincronizar Todo'}
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs text-slate-700">
                            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200 font-bold">
                                <tr>
                                    <th className="py-3 px-4">Nombre de la Fuente</th>
                                    <th className="py-3 px-4">URL Feed RSS</th>
                                    <th className="py-3 px-4 text-center">Última Sincronización</th>
                                    <th className="py-3 px-4 text-center">Importadas</th>
                                    <th className="py-3 px-4 text-center">Estado</th>
                                    {canManage && <th className="py-3 px-4 text-right">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {fuentes.length === 0 ? (
                                    <tr>
                                        <td colSpan={canManage ? 6 : 5} className="py-8 text-center text-slate-400 text-xs">
                                            No hay fuentes RSS registradas. Agrega una para comenzar a sincronizar automáticamente.
                                        </td>
                                    </tr>
                                ) : (
                                    fuentes.map((f) => (
                                        <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-4 font-semibold text-slate-900">
                                                <div className="flex items-center gap-2">
                                                    <Rss className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                                                    <span>{f.nombre}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500 max-w-sm truncate">
                                                <a href={f.urlFeed} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-700 flex items-center gap-1 truncate">
                                                    <LinkIcon className="w-3 h-3 shrink-0" />
                                                    <span className="truncate">{f.urlFeed}</span>
                                                </a>
                                            </td>
                                            <td className="py-3 px-4 text-center text-slate-500 text-[11px]">
                                                {f.ultimaSincronizacion ? (
                                                    new Date(f.ultimaSincronizacion).toLocaleString('es-CL')
                                                ) : (
                                                    <span className="text-slate-400 italic">Nunca sincronizado</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-center font-bold text-slate-700">
                                                {f.totalImportadas}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {f.activo ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                        Activa
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                        Inactiva
                                                    </span>
                                                )}
                                            </td>
                                            {canManage && (
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => handleToggleFuente(f)}
                                                            disabled={loading}
                                                            title={f.activo ? 'Desactivar fuente' : 'Activar fuente'}
                                                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-cyan-700 hover:bg-slate-50 transition-colors"
                                                        >
                                                            <Power className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenEditFuente(f)}
                                                            title="Editar fuente"
                                                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 transition-colors"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteFuente(f)}
                                                            disabled={loading}
                                                            title="Eliminar fuente"
                                                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal para Crear / Editar Noticia */}
            {modalNoticiaOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <Newspaper className="w-4 h-4 text-cyan-600" />
                                {editingNoticia ? 'Editar Noticia' : 'Nueva Noticia'}
                            </h3>
                            <button
                                onClick={() => setModalNoticiaOpen(false)}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveNoticia} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Título de la Noticia *
                                </label>
                                <textarea
                                    required
                                    rows={2}
                                    placeholder="Ej: ¿Adiós Junaeb?: Ministerio de Hacienda recomienda..."
                                    value={formTitulo}
                                    onChange={e => setFormTitulo(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white font-medium resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        Fuente / Medio *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: La Tercera, JUNAEB, etc."
                                        value={formFuente}
                                        onChange={e => setFormFuente(e.target.value)}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white font-medium"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        Prioridad / Orden *
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        required
                                        value={formOrden}
                                        onChange={e => setFormOrden(Number(e.target.value))}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white font-mono font-bold"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Enlace URL de la Noticia *
                                </label>
                                <input
                                    type="url"
                                    required
                                    placeholder="https://www.latercera.com/noticia/..."
                                    value={formLink}
                                    onChange={e => setFormLink(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Resumen Corto (Opcional)
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Breve extracto informativo..."
                                    value={formResumen}
                                    onChange={e => setFormResumen(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white resize-none"
                                />
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formActivo}
                                        onChange={e => setFormActivo(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                                </label>
                                <span className="text-xs font-semibold text-slate-700">
                                    {formActivo ? 'Noticia Visible en Sala de Reuniones' : 'Noticia Oculta'}
                                </span>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setModalNoticiaOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-cyan-700/20 disabled:opacity-50"
                                >
                                    {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    {editingNoticia ? 'Guardar Cambios' : 'Crear Noticia'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal para Crear / Editar Fuente RSS */}
            {modalFuenteOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <Rss className="w-4 h-4 text-cyan-600" />
                                {editingFuente ? 'Editar Fuente RSS' : 'Nueva Fuente RSS'}
                            </h3>
                            <button
                                onClick={() => setModalFuenteOpen(false)}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveFuente} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Nombre de la Fuente *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Google News - Alimentación Escolar Chile"
                                    value={formNombreFuente}
                                    onChange={e => setFormNombreFuente(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    URL del Feed RSS / XML *
                                </label>
                                <input
                                    type="url"
                                    required
                                    placeholder="https://news.google.com/rss/search?q=..."
                                    value={formUrlFeed}
                                    onChange={e => setFormUrlFeed(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white font-mono"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Debe ser una dirección válida con protocolo HTTP o HTTPS que responda formato RSS o Atom.
                                </p>
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formActivoFuente}
                                        onChange={e => setFormActivoFuente(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                                </label>
                                <span className="text-xs font-semibold text-slate-700">
                                    {formActivoFuente ? 'Fuente Activa para Sincronización' : 'Fuente Desactivada'}
                                </span>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setModalFuenteOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-cyan-700/20 disabled:opacity-50"
                                >
                                    {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    {editingFuente ? 'Guardar Cambios' : 'Registrar Fuente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
