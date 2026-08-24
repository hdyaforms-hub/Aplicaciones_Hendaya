'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { CarpetaUI, ArchivoUI } from '@/types/documentos'

interface DocumentosClientProps {
    user: any
}

export default function DocumentosClient({ user }: DocumentosClientProps) {
    const [carpetas, setCarpetas] = useState<CarpetaUI[]>([])
    const [loadingCarpetas, setLoadingCarpetas] = useState(true)
    const [selectedCarpeta, setSelectedCarpeta] = useState<CarpetaUI | null>(null)
    const [archivos, setArchivos] = useState<ArchivoUI[]>([])
    const [loadingArchivos, setLoadingArchivos] = useState(false)
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<ArchivoUI[] | null>(null)
    const [searching, setSearching] = useState(false)
    const [previewFile, setPreviewFile] = useState<ArchivoUI | null>(null)
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})

    // Cargar árbol de carpetas accesibles
    const fetchCarpetas = useCallback(async () => {
        setLoadingCarpetas(true)
        try {
            const res = await fetch('/api/documentos/carpetas')
            const data = await res.json()
            if (res.ok && data.carpetas) {
                setCarpetas(data.carpetas)
                // Seleccionar primera carpeta por defecto
                if (data.carpetas.length > 0) {
                    setSelectedCarpeta(data.carpetas[0])
                    setExpandedFolders({ [data.carpetas[0].id]: true })
                }
            }
        } catch (e) {
            console.error('Error al cargar carpetas:', e)
        } finally {
            setLoadingCarpetas(false)
        }
    }, [])

    useEffect(() => {
        fetchCarpetas()
    }, [fetchCarpetas])

    // Cargar archivos de la carpeta seleccionada
    const fetchArchivos = useCallback(async (carpetaId: string) => {
        setLoadingArchivos(true)
        try {
            const res = await fetch(`/api/documentos/${carpetaId}/archivos`)
            const data = await res.json()
            if (res.ok && data.archivos) {
                setArchivos(data.archivos)
            } else {
                setArchivos([])
            }
        } catch (e) {
            console.error('Error al cargar archivos:', e)
            setArchivos([])
        } finally {
            setLoadingArchivos(false)
        }
    }, [])

    useEffect(() => {
        if (selectedCarpeta) {
            setSearchResults(null)
            setSearchTerm('')
            fetchArchivos(selectedCarpeta.id)
        }
    }, [selectedCarpeta, fetchArchivos])

    // Búsqueda en OneDrive
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!searchTerm.trim()) {
            setSearchResults(null)
            return
        }

        setSearching(true)
        try {
            const res = await fetch(`/api/documentos/buscar?q=${encodeURIComponent(searchTerm.trim())}`)
            const data = await res.json()
            if (res.ok && data.archivos) {
                setSearchResults(data.archivos)
            } else {
                setSearchResults([])
            }
        } catch (e) {
            console.error('Error en búsqueda:', e)
            setSearchResults([])
        } finally {
            setSearching(false)
        }
    }

    const toggleFolderExpand = (folderId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setExpandedFolders(prev => ({
            ...prev,
            [folderId]: !prev[folderId]
        }))
    }

    // Lista de archivos a mostrar (búsqueda o carpeta actual)
    const displayedFiles = searchResults !== null ? searchResults : archivos

    // Render recursivo del árbol de carpetas
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
                                onClick={() => {
                                    setSelectedCarpeta(folder)
                                    setSearchResults(null)
                                }}
                                style={{ paddingLeft: `${Math.max(12, level * 16 + 12)}px` }}
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
                                            onClick={(e) => toggleFolderExpand(folder.id, e)}
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

                                {folder.puedeSubir && (
                                    <span
                                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-extrabold uppercase ${
                                            isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                                        }`}
                                        title="Permiso para subir documentos"
                                    >
                                        Subir
                                    </span>
                                )}
                            </div>

                            {/* Subcarpetas */}
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

    // Helper de iconos de archivo
    const getFileBadge = (type: string) => {
        switch (type) {
            case 'pdf':
                return { label: 'PDF', bg: 'bg-rose-100 text-rose-800 border-rose-200', icon: '📕' }
            case 'imagen':
                return { label: 'IMAGEN', bg: 'bg-purple-100 text-purple-800 border-purple-200', icon: '🖼️' }
            case 'video':
                return { label: 'VIDEO', bg: 'bg-cyan-100 text-cyan-800 border-cyan-200', icon: '🎬' }
            case 'documento':
                return { label: 'DOC', bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: '📄' }
            default:
                return { label: 'ARCHIVO', bg: 'bg-slate-100 text-slate-800 border-slate-200', icon: '📦' }
        }
    }

    return (
        <div className="space-y-5">
            {/* Header del Módulo */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/20 border border-cyan-400/30 rounded-full text-cyan-300 text-xs font-black tracking-wider uppercase">
                        <span>🗂️</span>
                        <span>Repositorio Central Hendaya</span>
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-white">
                        Gestor Documental
                    </h1>
                    <p className="text-xs text-slate-400">
                        Explora, consulta y descarga manuales, procedimientos, informes y multimedia corporativa.
                    </p>
                </div>

                {/* Buscador Rápido */}
                <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-96">
                    <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar en todos los documentos..."
                            className="w-full pl-9 pr-8 py-2.5 bg-slate-800/90 border border-slate-700 rounded-2xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm('')
                                    setSearchResults(null)
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={searching}
                        className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-600 hover:to-sky-600 text-slate-950 font-black rounded-2xl text-xs shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
                    >
                        {searching ? '...' : 'Buscar'}
                    </button>
                </form>
            </div>

            {/* Layout Principal: Árbol de Carpetas + Listado de Archivos */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Panel Izquierdo: Árbol de Carpetas */}
                <div className="lg:col-span-4 bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="text-base">📁</span>
                            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                Carpetas y Categorías
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={fetchCarpetas}
                            className="text-xs text-cyan-600 hover:text-cyan-800 font-bold cursor-pointer"
                            title="Recargar árbol de carpetas"
                        >
                            🔄
                        </button>
                    </div>

                    {loadingCarpetas ? (
                        <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                            <div className="w-6 h-6 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p>Cargando estructura...</p>
                        </div>
                    ) : carpetas.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-xs p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <p className="text-2xl mb-1">🔒</p>
                            <p className="font-bold text-slate-700 mb-1">Sin carpetas asignadas</p>
                            <p className="text-[11px]">No tienes privilegios de acceso sobre carpetas o aún no se han registrado.</p>
                        </div>
                    ) : (
                        <div className="max-h-[600px] overflow-y-auto pr-1">
                            {renderFolderTree(carpetas)}
                        </div>
                    )}
                </div>

                {/* Panel Derecho: Explorador de Archivos */}
                <div className="lg:col-span-8 bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
                    {/* Barra de Control de la Carpeta Actual */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-lg">{selectedCarpeta?.icono || '📂'}</span>
                                <h2 className="text-sm font-black text-slate-900 truncate">
                                    {searchResults !== null
                                        ? `Resultados de búsqueda: "${searchTerm}"`
                                        : (selectedCarpeta ? selectedCarpeta.nombre : 'Selecciona una carpeta')}
                                </h2>
                                {searchResults !== null ? (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md text-[10px] font-extrabold">
                                        {searchResults.length} {searchResults.length === 1 ? 'coincidencia' : 'coincidencias'}
                                    </span>
                                ) : selectedCarpeta?.rutaCompleta && (
                                    <span className="text-[10px] text-slate-400 font-bold truncate">
                                        ({selectedCarpeta.rutaCompleta})
                                    </span>
                                )}
                            </div>
                            {selectedCarpeta?.descripcion && searchResults === null && (
                                <p className="text-xs text-slate-500">{selectedCarpeta.descripcion}</p>
                            )}
                        </div>

                        {/* Controles de Vista (Lista / Cuadrícula) */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto bg-slate-100 p-1 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                    viewMode === 'list'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                <span>☰</span>
                                <span className="hidden sm:inline">Lista</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('grid')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                    viewMode === 'grid'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                <span>⊞</span>
                                <span className="hidden sm:inline">Cuadrícula</span>
                            </button>
                        </div>
                    </div>

                    {/* Contenido: Listado de Archivos */}
                    {loadingArchivos ? (
                        <div className="py-20 text-center text-slate-400 text-xs space-y-2">
                            <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p>Cargando documentos de OneDrive...</p>
                        </div>
                    ) : displayedFiles.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 text-xs p-6 bg-slate-50/60 rounded-3xl border border-dashed border-slate-200">
                            <p className="text-3xl mb-2">📂</p>
                            <p className="font-bold text-slate-700 text-sm mb-1">Esta carpeta está vacía</p>
                            <p className="text-xs text-slate-500">No se encontraron archivos en este directorio de OneDrive.</p>
                        </div>
                    ) : viewMode === 'list' ? (
                        /* Vista en Lista */
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-[10px] uppercase tracking-wider">
                                        <th className="py-3 px-3">Documento</th>
                                        <th className="py-3 px-3">Tipo</th>
                                        <th className="py-3 px-3">Tamaño</th>
                                        <th className="py-3 px-3">Modificado</th>
                                        <th className="py-3 px-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {displayedFiles.map(file => {
                                        const badge = getFileBadge(file.tipoArchivo)
                                        return (
                                            <tr
                                                key={file.id}
                                                className="group hover:bg-cyan-50/40 transition-colors"
                                            >
                                                <td className="py-3 px-3 font-bold text-slate-800">
                                                    <div className="flex items-center gap-2.5 min-w-[200px]">
                                                        <span className="text-lg">{badge.icon}</span>
                                                        <span
                                                            onClick={() => setPreviewFile(file)}
                                                            className="hover:text-cyan-600 hover:underline cursor-pointer truncate max-w-xs sm:max-w-md"
                                                            title={file.nombre}
                                                        >
                                                            {file.nombre}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${badge.bg}`}>
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-slate-500 font-medium">
                                                    {file.tamanoMB} MB
                                                </td>
                                                <td className="py-3 px-3 text-slate-500 font-medium">
                                                    {new Date(file.fechaModificacion).toLocaleDateString('es-CL', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    })}
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewFile(file)}
                                                            className="px-2.5 py-1 bg-slate-100 hover:bg-cyan-100 text-slate-700 hover:text-cyan-800 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                                                            title="Ver vista previa"
                                                        >
                                                            👁️ Ver
                                                        </button>
                                                        {file.puedeDescargar && (
                                                            <a
                                                                href={`/api/documentos/archivo/${file.id}/descargar`}
                                                                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                                                title="Descargar archivo"
                                                            >
                                                                <span>⬇️</span>
                                                                <span className="hidden sm:inline">Descargar</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* Vista en Cuadrícula (Grid) */
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                            {displayedFiles.map(file => {
                                const badge = getFileBadge(file.tipoArchivo)
                                return (
                                    <div
                                        key={file.id}
                                        className="p-4 bg-slate-50/80 hover:bg-cyan-50/50 rounded-2xl border border-slate-200/80 hover:border-cyan-300 transition-all flex flex-col justify-between space-y-3 group shadow-2xs"
                                    >
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-2xl">{badge.icon}</span>
                                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black border ${badge.bg}`}>
                                                    {badge.label}
                                                </span>
                                            </div>
                                            <h4
                                                onClick={() => setPreviewFile(file)}
                                                className="text-xs font-bold text-slate-900 line-clamp-2 hover:text-cyan-600 cursor-pointer"
                                                title={file.nombre}
                                            >
                                                {file.nombre}
                                            </h4>
                                        </div>

                                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                                            <span>{file.tamanoMB} MB</span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewFile(file)}
                                                    className="p-1 bg-white hover:bg-cyan-100 text-slate-700 rounded-md transition-colors cursor-pointer"
                                                    title="Vista previa"
                                                >
                                                    👁️
                                                </button>
                                                {file.puedeDescargar && (
                                                    <a
                                                        href={`/api/documentos/archivo/${file.id}/descargar`}
                                                        className="p-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md transition-colors cursor-pointer"
                                                        title="Descargar"
                                                    >
                                                        ⬇️
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ========================================================= */}
            {/* MODAL DE VISTA PREVIA MULTIFORMATO                        */}
            {/* ========================================================= */}
            {previewFile && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-5xl h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
                        {/* Cabecera del Modal */}
                        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="text-2xl">{getFileBadge(previewFile.tipoArchivo).icon}</span>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-black text-slate-900 truncate" title={previewFile.nombre}>
                                        {previewFile.nombre}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-semibold">
                                        {previewFile.tamanoMB} MB • {previewFile.tipoMime}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {previewFile.puedeDescargar && (
                                    <a
                                        href={`/api/documentos/archivo/${previewFile.id}/descargar`}
                                        className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                                    >
                                        <span>⬇️</span>
                                        <span className="hidden sm:inline">Descargar</span>
                                    </a>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setPreviewFile(null)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold transition-colors cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Visor según tipo de archivo */}
                        <div className="flex-1 bg-slate-900 flex items-center justify-center overflow-hidden relative">
                            {previewFile.tipoArchivo === 'pdf' ? (
                                <iframe
                                    src={`/api/documentos/archivo/${previewFile.id}/preview#toolbar=1`}
                                    className="w-full h-full border-none"
                                    title={previewFile.nombre}
                                />
                            ) : previewFile.tipoArchivo === 'imagen' ? (
                                <div className="p-4 w-full h-full flex items-center justify-center overflow-auto">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={`/api/documentos/archivo/${previewFile.id}/preview`}
                                        alt={previewFile.nombre}
                                        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                                    />
                                </div>
                            ) : previewFile.tipoArchivo === 'video' ? (
                                <div className="w-full h-full flex items-center justify-center p-4">
                                    <video
                                        controls
                                        autoPlay
                                        className="max-w-full max-h-full rounded-2xl shadow-2xl"
                                        src={`/api/documentos/archivo/${previewFile.id}/preview`}
                                    >
                                        Tu navegador no soporta reproducción de este formato de video.
                                    </video>
                                </div>
                            ) : (
                                /* Otros formatos / Documentos de Office */
                                <div className="text-center p-8 bg-slate-800 text-white rounded-3xl max-w-md mx-4 space-y-4 shadow-xl border border-slate-700">
                                    <span className="text-5xl block">📄</span>
                                    <div className="space-y-1">
                                        <h4 className="text-base font-black truncate">{previewFile.nombre}</h4>
                                        <p className="text-xs text-slate-400">
                                            Este formato ({previewFile.tipoMime}) no admite previsualización directa en el navegador.
                                        </p>
                                    </div>
                                    {previewFile.puedeDescargar && (
                                        <a
                                            href={`/api/documentos/archivo/${previewFile.id}/descargar`}
                                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 font-black rounded-2xl text-xs shadow-md shadow-cyan-500/20 hover:scale-105 transition-all"
                                        >
                                            <span>⬇️</span>
                                            <span>Descargar para Abrir</span>
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
