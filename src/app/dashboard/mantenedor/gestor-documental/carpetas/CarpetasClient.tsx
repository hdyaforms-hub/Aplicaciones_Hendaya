'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { CarpetaUI, ArchivoUI } from '@/types/documentos'

interface CarpetasClientProps {
    user: any
}

const EMOJI_ICONS = ['📁', '📂', '🗂️', '📋', '📊', '📈', '📝', '🔒', '🔓', '📗', '📘', '📙', '🏢', '🏷️', '📦']

export default function CarpetasClient({ user }: CarpetasClientProps) {
    const [carpetas, setCarpetas] = useState<CarpetaUI[]>([])
    const [todasCarpetas, setTodasCarpetas] = useState<CarpetaUI[]>([])
    const [loadingCarpetas, setLoadingCarpetas] = useState(true)
    const [selectedCarpeta, setSelectedCarpeta] = useState<CarpetaUI | null>(null)
    const [archivos, setArchivos] = useState<ArchivoUI[]>([])
    const [loadingArchivos, setLoadingArchivos] = useState(false)
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})

    // Modal Carpeta (Crear / Editar)
    const [showFolderModal, setShowFolderModal] = useState(false)
    const [editingFolder, setEditingFolder] = useState<CarpetaUI | null>(null)
    const [folderName, setFolderName] = useState('')
    const [folderDesc, setFolderDesc] = useState('')
    const [folderIcon, setFolderIcon] = useState('📁')
    const [folderParentId, setFolderParentId] = useState<string>('')
    const [folderOrden, setFolderOrden] = useState(0)
    const [savingFolder, setSavingFolder] = useState(false)

    // Modal Subir Archivos
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; currentFileName: string } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Cargar carpetas
    const fetchCarpetas = useCallback(async () => {
        setLoadingCarpetas(true)
        try {
            const res = await fetch('/api/admin/documentos/carpetas')
            const data = await res.json()
            if (res.ok) {
                setCarpetas(data.carpetas || [])
                setTodasCarpetas(data.todas || [])
                if (data.carpetas && data.carpetas.length > 0 && !selectedCarpeta) {
                    setSelectedCarpeta(data.carpetas[0])
                    setExpandedFolders({ [data.carpetas[0].id]: true })
                }
            }
        } catch (e) {
            console.error('Error al cargar carpetas:', e)
        } finally {
            setLoadingCarpetas(false)
        }
    }, [selectedCarpeta])

    useEffect(() => {
        fetchCarpetas()
    }, [fetchCarpetas])

    // Cargar archivos de la carpeta seleccionada
    const fetchArchivos = useCallback(async (carpetaId: string) => {
        setLoadingArchivos(true)
        try {
            const res = await fetch(`/api/documentos/${carpetaId}/archivos`)
            const data = await res.json()
            if (res.ok) {
                setArchivos(data.archivos || [])
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
            fetchArchivos(selectedCarpeta.id)
        }
    }, [selectedCarpeta, fetchArchivos])

    // Abrir Modal Nueva Carpeta Raíz o Subcarpeta
    const handleOpenCreateFolder = (parent?: CarpetaUI) => {
        setEditingFolder(null)
        setFolderName('')
        setFolderDesc('')
        setFolderIcon('📁')
        setFolderParentId(parent ? parent.id : '')
        setFolderOrden(0)
        setShowFolderModal(true)
    }

    // Abrir Modal Editar Carpeta
    const handleOpenEditFolder = (folder: CarpetaUI, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingFolder(folder)
        setFolderName(folder.nombre)
        setFolderDesc(folder.descripcion || '')
        setFolderIcon(folder.icono || '📁')
        setFolderParentId(folder.parentId || '')
        setFolderOrden(folder.orden || 0)
        setShowFolderModal(true)
    }

    // Guardar Carpeta (Crear o Actualizar)
    const handleSaveFolder = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!folderName.trim() || savingFolder) return
        setSavingFolder(true)

        try {
            const url = editingFolder
                ? `/api/admin/documentos/carpetas/${editingFolder.id}`
                : '/api/admin/documentos/carpetas'

            const method = editingFolder ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: folderName.trim(),
                    descripcion: folderDesc.trim() || null,
                    icono: folderIcon,
                    parentId: folderParentId || null,
                    orden: folderOrden
                })
            })

            const data = await res.json()
            if (res.ok && data.success) {
                setShowFolderModal(false)
                fetchCarpetas()
                if (data.carpeta) {
                    setSelectedCarpeta(data.carpeta)
                }
            } else {
                alert(data.message || 'Error al guardar la carpeta')
            }
        } catch (e: any) {
            alert(e?.message || 'Error al guardar la carpeta')
        } finally {
            setSavingFolder(false)
        }
    }

    // Eliminar Carpeta
    const handleDeleteFolder = async (folder: CarpetaUI, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm(`¿Estás seguro de eliminar la carpeta "${folder.nombre}" y todos sus archivos asociados en OneDrive?`)) {
            return
        }

        try {
            const res = await fetch(`/api/admin/documentos/carpetas/${folder.id}`, {
                method: 'DELETE'
            })
            const data = await res.json()
            if (res.ok && data.success) {
                if (selectedCarpeta?.id === folder.id) {
                    setSelectedCarpeta(null)
                }
                fetchCarpetas()
            } else {
                alert(data.message || 'Error al eliminar carpeta')
            }
        } catch (e: any) {
            alert(e?.message || 'Error al eliminar carpeta')
        }
    }

    // Manejo de Dropzone para archivos
    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault()
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const filesArray = Array.from(e.dataTransfer.files)
            setSelectedFiles(prev => [...prev, ...filesArray])
        }
    }

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files)
            setSelectedFiles(prev => [...prev, ...filesArray])
        }
    }

    // Subir lista de archivos secuencialmente
    const handleUploadFiles = async () => {
        if (!selectedCarpeta || selectedFiles.length === 0 || uploading) return
        setUploading(true)

        const total = selectedFiles.length
        let successCount = 0

        for (let i = 0; i < total; i++) {
            const file = selectedFiles[i]
            setUploadProgress({ current: i + 1, total, currentFileName: file.name })

            const formData = new FormData()
            formData.append('file', file)

            try {
                const res = await fetch(`/api/admin/documentos/carpetas/${selectedCarpeta.id}/archivos`, {
                    method: 'POST',
                    body: formData
                })
                if (res.ok) {
                    successCount++
                } else {
                    const err = await res.json()
                    console.error(`Error al subir ${file.name}:`, err.message)
                }
            } catch (e) {
                console.error(`Error al subir ${file.name}:`, e)
            }
        }

        setUploading(false)
        setUploadProgress(null)
        setSelectedFiles([])
        setShowUploadModal(false)
        fetchArchivos(selectedCarpeta.id)
    }

    // Eliminar archivo
    const handleDeleteFile = async (file: ArchivoUI) => {
        if (!selectedCarpeta || !confirm(`¿Eliminar el archivo "${file.nombre}" de OneDrive?`)) return

        try {
            const res = await fetch(
                `/api/admin/documentos/carpetas/${selectedCarpeta.id}/archivos?archivoId=${file.id}&nombre=${encodeURIComponent(file.nombre)}`,
                { method: 'DELETE' }
            )
            const data = await res.json()
            if (res.ok && data.success) {
                fetchArchivos(selectedCarpeta.id)
            } else {
                alert(data.message || 'Error al eliminar el archivo')
            }
        } catch (e: any) {
            alert(e?.message || 'Error al eliminar el archivo')
        }
    }

    // Render recursivo del árbol admin
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
                                className={`group flex items-center justify-between pr-2.5 py-2 rounded-2xl cursor-pointer text-xs font-bold transition-all select-none ${
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

                                {/* Acciones Rápidas en Hover */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleOpenCreateFolder(folder)
                                        }}
                                        className={`p-1 rounded-md text-[10px] cursor-pointer ${
                                            isSelected ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                        }`}
                                        title="Agregar subcarpeta"
                                    >
                                        ➕
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => handleOpenEditFolder(folder, e)}
                                        className={`p-1 rounded-md text-[10px] cursor-pointer ${
                                            isSelected ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                        }`}
                                        title="Editar carpeta"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => handleDeleteFolder(folder, e)}
                                        className={`p-1 rounded-md text-[10px] cursor-pointer ${
                                            isSelected ? 'bg-rose-500/80 hover:bg-rose-500 text-white' : 'bg-rose-100 hover:bg-rose-200 text-rose-700'
                                        }`}
                                        title="Eliminar carpeta"
                                    >
                                        🗑️
                                    </button>
                                </div>
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

    return (
        <div className="space-y-6">
            {/* Cabecera */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/20 border border-cyan-400/30 rounded-full text-cyan-300 text-xs font-black tracking-wider uppercase">
                        <span>🗂️</span>
                        <span>Mantenedor • Estructura & Archivos</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">
                        Carpetas y Documentos en OneDrive
                    </h1>
                    <p className="text-xs text-slate-400">
                        Crea carpetas sincronizadas en tiempo real con OneDrive y carga archivos institucionales.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => handleOpenCreateFolder()}
                        className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-600 hover:to-sky-600 text-slate-950 font-black rounded-2xl text-xs shadow-md shadow-cyan-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                        <span>📁</span>
                        <span>Nueva Carpeta Raíz</span>
                    </button>
                </div>
            </div>

            {/* Layout Árbol Admin + Contenido de Carpeta */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Árbol Izquierdo */}
                <div className="lg:col-span-4 bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="text-base">📁</span>
                            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                Árbol de Carpetas
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={fetchCarpetas}
                            className="text-xs text-cyan-600 hover:text-cyan-800 font-bold cursor-pointer"
                            title="Recargar árbol"
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
                        <div className="py-12 text-center text-slate-400 text-xs p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                            <p className="text-2xl">📁</p>
                            <p className="font-bold text-slate-700">No hay carpetas registradas</p>
                            <button
                                type="button"
                                onClick={() => handleOpenCreateFolder()}
                                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl text-xs transition-colors"
                            >
                                Crear la primera carpeta
                            </button>
                        </div>
                    ) : (
                        <div className="max-h-[600px] overflow-y-auto pr-1">
                            {renderFolderTree(carpetas)}
                        </div>
                    )}
                </div>

                {/* Contenido de la Carpeta */}
                <div className="lg:col-span-8 bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-lg">{selectedCarpeta?.icono || '📂'}</span>
                                <h2 className="text-sm font-black text-slate-900 truncate">
                                    {selectedCarpeta ? selectedCarpeta.nombre : 'Selecciona una carpeta'}
                                </h2>
                                {selectedCarpeta?.rutaCompleta && (
                                    <span className="text-[10px] text-slate-400 font-bold truncate">
                                        ({selectedCarpeta.rutaCompleta})
                                    </span>
                                )}
                            </div>
                            {selectedCarpeta?.descripcion && (
                                <p className="text-xs text-slate-500">{selectedCarpeta.descripcion}</p>
                            )}
                        </div>

                        {selectedCarpeta && (
                            <button
                                type="button"
                                onClick={() => setShowUploadModal(true)}
                                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 self-end sm:self-auto"
                            >
                                <span>⬆️</span>
                                <span>Subir Archivo</span>
                            </button>
                        )}
                    </div>

                    {/* Tabla de Archivos */}
                    {loadingArchivos ? (
                        <div className="py-20 text-center text-slate-400 text-xs space-y-2">
                            <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p>Consultando archivos en OneDrive...</p>
                        </div>
                    ) : !selectedCarpeta ? (
                        <div className="py-20 text-center text-slate-400 text-xs p-6 bg-slate-50 rounded-2xl">
                            <p className="text-2xl mb-1">👈</p>
                            <p className="font-bold text-slate-700">Selecciona una carpeta del árbol izquierdo</p>
                        </div>
                    ) : archivos.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 text-xs p-6 bg-slate-50/60 rounded-3xl border border-dashed border-slate-200 space-y-3">
                            <p className="text-3xl">📂</p>
                            <p className="font-bold text-slate-700 text-sm">Esta carpeta no tiene archivos</p>
                            <button
                                type="button"
                                onClick={() => setShowUploadModal(true)}
                                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl text-xs transition-colors"
                            >
                                ⬆️ Subir el primer archivo
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-[10px] uppercase tracking-wider">
                                        <th className="py-3 px-3">Nombre</th>
                                        <th className="py-3 px-3">Tamaño</th>
                                        <th className="py-3 px-3">Modificado</th>
                                        <th className="py-3 px-3 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {archivos.map(file => (
                                        <tr key={file.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-3 font-bold text-slate-800">
                                                <div className="flex items-center gap-2 truncate max-w-xs sm:max-w-md">
                                                    <span>📄</span>
                                                    <span className="truncate" title={file.nombre}>{file.nombre}</span>
                                                </div>
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
                                                    <a
                                                        href={`/api/documentos/archivo/${file.id}/descargar`}
                                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition-colors"
                                                        title="Descargar"
                                                    >
                                                        ⬇️
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteFile(file)}
                                                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                                                        title="Eliminar archivo de OneDrive"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ========================================================= */}
            {/* MODAL: NUEVA / EDITAR CARPETA                             */}
            {/* ========================================================= */}
            {showFolderModal && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                <span>{editingFolder ? '✏️' : '📁'}</span>
                                <span>{editingFolder ? 'Editar Carpeta' : 'Nueva Carpeta en OneDrive'}</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowFolderModal(false)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold transition-colors cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveFolder} className="p-5 space-y-4">
                            {/* Nombre */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-700">Nombre de la Carpeta *</label>
                                <input
                                    type="text"
                                    required
                                    value={folderName}
                                    onChange={(e) => setFolderName(e.target.value)}
                                    placeholder="Ej: Manuales de Calidad 2026"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
                                />
                            </div>

                            {/* Descripción */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-700">Descripción (Opcional)</label>
                                <textarea
                                    rows={2}
                                    value={folderDesc}
                                    onChange={(e) => setFolderDesc(e.target.value)}
                                    placeholder="Detalle o propósito de los documentos contenidos..."
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white resize-none"
                                />
                            </div>

                            {/* Selector de Emoji Icono */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-700">Ícono Visual</label>
                                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                                    {EMOJI_ICONS.map(emoji => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => setFolderIcon(emoji)}
                                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-transform cursor-pointer ${
                                                folderIcon === emoji ? 'bg-cyan-600 text-white scale-110 shadow-xs' : 'hover:bg-slate-200'
                                            }`}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Carpeta Padre */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-700">Carpeta Padre (Ubicación)</label>
                                <select
                                    value={folderParentId}
                                    onChange={(e) => setFolderParentId(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">🌐 Raíz del Gestor Documental</option>
                                    {todasCarpetas
                                        .filter(f => !editingFolder || f.id !== editingFolder.id)
                                        .map(f => (
                                            <option key={f.id} value={f.id}>
                                                {f.icono || '📁'} {f.rutaCompleta || f.nombre}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            {/* Orden */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-700">Orden de Visualización</label>
                                <input
                                    type="number"
                                    value={folderOrden}
                                    onChange={(e) => setFolderOrden(Number(e.target.value))}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>

                            {/* Botones */}
                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowFolderModal(false)}
                                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingFolder || !folderName.trim()}
                                    className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white rounded-xl text-xs font-black shadow-md shadow-cyan-600/20 transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {savingFolder ? 'Guardando en OneDrive...' : 'Guardar Carpeta'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL: SUBIR ARCHIVOS (DRAG & DROP)                       */}
            {/* ========================================================= */}
            {showUploadModal && selectedCarpeta && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <span>⬆️</span>
                                    <span>Subir Archivos a: {selectedCarpeta.nombre}</span>
                                </h3>
                                <p className="text-[11px] text-slate-400">Archivos permitidos: PDF, Word, Excel, PPTX, Imágenes y Videos (hasta 50MB).</p>
                            </div>
                            <button
                                type="button"
                                disabled={uploading}
                                onClick={() => setShowUploadModal(false)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold transition-colors cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto flex-1">
                            {/* Dropzone */}
                            <div
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleFileDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className="p-8 border-2 border-dashed border-cyan-300 hover:border-cyan-500 bg-cyan-50/40 hover:bg-cyan-50/80 rounded-3xl text-center cursor-pointer transition-all space-y-2"
                            >
                                <span className="text-4xl block">☁️</span>
                                <p className="text-xs font-bold text-slate-800">
                                    Arrastra y suelta aquí tus archivos o <span className="text-cyan-600 underline">haz clic para examinar</span>
                                </p>
                                <p className="text-[10px] text-slate-400">Puedes seleccionar múltiples archivos a la vez.</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    onChange={handleFileInputChange}
                                    className="hidden"
                                />
                            </div>

                            {/* Progreso de Carga */}
                            {uploadProgress && (
                                <div className="p-4 bg-cyan-50 rounded-2xl border border-cyan-200 space-y-2">
                                    <div className="flex justify-between items-center text-xs font-black text-cyan-950">
                                        <span>Subiendo a OneDrive ({uploadProgress.current} de {uploadProgress.total})...</span>
                                        <span>{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 truncate">{uploadProgress.currentFileName}</p>
                                    <div className="w-full bg-cyan-200 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-cyan-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Lista de Archivos Seleccionados */}
                            {selectedFiles.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs font-black text-slate-800">
                                        <span>Archivos en cola ({selectedFiles.length}):</span>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedFiles([])}
                                            className="text-[10px] text-rose-600 hover:underline font-bold"
                                        >
                                            Limpiar lista
                                        </button>
                                    </div>

                                    <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200">
                                        {selectedFiles.map((file, idx) => (
                                            <div
                                                key={idx}
                                                className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs font-medium text-slate-800"
                                            >
                                                <div className="flex items-center gap-2 truncate min-w-0 pr-2">
                                                    <span>📄</span>
                                                    <span className="truncate">{file.name}</span>
                                                    <span className="text-[10px] text-slate-400 shrink-0">
                                                        ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={uploading}
                                                    onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                                                    className="text-slate-400 hover:text-rose-600 font-bold px-1"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2 shrink-0">
                            <button
                                type="button"
                                disabled={uploading}
                                onClick={() => setShowUploadModal(false)}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={uploading || selectedFiles.length === 0}
                                onClick={handleUploadFiles}
                                className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-2"
                            >
                                <span>☁️</span>
                                <span>{uploading ? 'Subiendo...' : `Subir ${selectedFiles.length} Archivo(s)`}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
