'use client'

import React, { useState } from 'react'
import { createCollabNote, updateCollabNote, deleteCollabNote } from './actions'
import RecipientCombinator, { CombinatorUser } from './RecipientCombinator'

export interface NoteItem {
    id: string
    title?: string | null
    content: string
    color: string
    isPinned: boolean
    rotation: number
    tags: string[]
    isPublic: boolean
    sharedWith?: string[]
    createdBy: string
    isMine: boolean
    createdAt: string
    updatedAt: string
}

export interface UserSummary {
    id?: string
    username: string
    name: string
    role?: string
    sucursales?: string[]
}

interface NotesViewProps {
    initialNotes: NoteItem[]
    currentUsername: string
    users?: UserSummary[]
    onConvertToAppointment?: (note: NoteItem) => void
}

const NOTE_COLORS: { id: string; label: string; bg: string; border: string; header: string; text: string; pin: string }[] = [
    { id: 'yellow', label: 'Amarillo Clásico', bg: 'bg-amber-100', border: 'border-amber-300', header: 'bg-amber-200/70', text: 'text-amber-950', pin: 'text-amber-600' },
    { id: 'pink', label: 'Rosa Pastel', bg: 'bg-pink-100', border: 'border-pink-300', header: 'bg-pink-200/70', text: 'text-pink-950', pin: 'text-pink-600' },
    { id: 'cyan', label: 'Celeste / Cyan', bg: 'bg-cyan-100', border: 'border-cyan-300', header: 'bg-cyan-200/70', text: 'text-cyan-950', pin: 'text-cyan-600' },
    { id: 'green', label: 'Verde Menta', bg: 'bg-emerald-100', border: 'border-emerald-300', header: 'bg-emerald-200/70', text: 'text-emerald-950', pin: 'text-emerald-600' },
    { id: 'purple', label: 'Lavanda / Violeta', bg: 'bg-purple-100', border: 'border-purple-300', header: 'bg-purple-200/70', text: 'text-purple-950', pin: 'text-purple-600' },
    { id: 'orange', label: 'Naranja Cítrico', bg: 'bg-orange-100', border: 'border-orange-300', header: 'bg-orange-200/70', text: 'text-orange-950', pin: 'text-orange-600' },
]

export default function NotesView({ initialNotes, currentUsername, users = [], onConvertToAppointment }: NotesViewProps) {
    const [notes, setNotes] = useState<NoteItem[]>(initialNotes)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedTag, setSelectedTag] = useState<string | null>(null)
    const [colorFilter, setColorFilter] = useState<string | null>(null)
    const [filterScope, setFilterScope] = useState<'all' | 'mine' | 'shared' | 'public'>('all')

    // Modal state
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [editingNote, setEditingNote] = useState<NoteItem | null>(null)
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [selectedColor, setSelectedColor] = useState('yellow')
    const [isPinned, setIsPinned] = useState(false)
    const [privacyMode, setPrivacyMode] = useState<'private' | 'segmented' | 'public'>('private')
    const [selectedSharedUsers, setSelectedSharedUsers] = useState<string[]>([])
    const [userSearchTerm, setUserSearchTerm] = useState('')
    const [tagInput, setTagInput] = useState('')
    const [tags, setTags] = useState<string[]>([])
    const [isSaving, setIsSaving] = useState(false)

    // Roles disponibles del sistema y rol del usuario actual
    const currentUserObj = users.find(u => u.username.toLowerCase() === currentUsername.toLowerCase())
    const currentUserRole = currentUserObj?.role || ''
    const availableRoles = Array.from(new Set(users.map(u => u.role).filter(Boolean))) as string[]

    // Recopilar todos los tags disponibles
    const allTags = Array.from(new Set(notes.flatMap(n => n.tags || [])))

    // Filtrar notas
    const filteredNotes = notes.filter(note => {
        const hasRoleAccess = currentUserRole && note.sharedWith && note.sharedWith.some(s => {
            const low = s.toLowerCase()
            return low === `role:${currentUserRole.toLowerCase()}` || low === currentUserRole.toLowerCase()
        })
        const hasUserAccess = note.sharedWith && note.sharedWith.some(u => u.toLowerCase() === currentUsername.toLowerCase())
        const isSharedWithMe = hasRoleAccess || hasUserAccess

        if (filterScope === 'mine' && !note.isMine) return false
        if (filterScope === 'public' && !note.isPublic) return false
        if (filterScope === 'shared' && !isSharedWithMe) return false
        if (colorFilter && note.color !== colorFilter) return false
        if (selectedTag && (!note.tags || !note.tags.includes(selectedTag))) return false
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase()
            const matchTitle = note.title?.toLowerCase().includes(term)
            const matchContent = note.content.toLowerCase().includes(term)
            const matchUser = note.createdBy.toLowerCase().includes(term)
            if (!matchTitle && !matchContent && !matchUser) return false
        }
        return true
    })

    const openCreateModal = () => {
        setEditingNote(null)
        setTitle('')
        setContent('')
        setSelectedColor('yellow')
        setIsPinned(false)
        setPrivacyMode('private')
        setSelectedSharedUsers([])
        setUserSearchTerm('')
        setTags([])
        setTagInput('')
        setIsCreateOpen(true)
    }

    const openEditModal = (note: NoteItem) => {
        if (!note.isMine) return
        setEditingNote(note)
        setTitle(note.title || '')
        setContent(note.content)
        setSelectedColor(note.color || 'yellow')
        setIsPinned(note.isPinned)
        if (note.isPublic) {
            setPrivacyMode('public')
            setSelectedSharedUsers([])
        } else if (note.sharedWith && note.sharedWith.length > 0) {
            setPrivacyMode('segmented')
            setSelectedSharedUsers(note.sharedWith)
        } else {
            setPrivacyMode('private')
            setSelectedSharedUsers([])
        }
        setUserSearchTerm('')
        setTags(note.tags || [])
        setTagInput('')
        setIsCreateOpen(true)
    }

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            const cleaned = tagInput.trim().replace(/^#/, '')
            if (cleaned && !tags.includes(cleaned)) {
                setTags([...tags, cleaned])
            }
            setTagInput('')
        }
    }

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove))
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!content.trim()) return

        setIsSaving(true)
        const isPublicVal = privacyMode === 'public'
        const sharedWithVal = privacyMode === 'segmented' ? selectedSharedUsers : []

        if (editingNote) {
            const res = await updateCollabNote(editingNote.id, {
                title,
                content,
                color: selectedColor,
                isPinned,
                isPublic: isPublicVal,
                sharedWith: sharedWithVal,
                tags
            })
            if (res.success && res.note) {
                setNotes(prev => prev.map(n => n.id === editingNote.id ? {
                    ...n,
                    title: res.note.title,
                    content: res.note.content,
                    color: res.note.color,
                    isPinned: res.note.isPinned,
                    isPublic: res.note.isPublic,
                    sharedWith: sharedWithVal,
                    tags,
                    updatedAt: new Date().toISOString()
                } : n))
                setIsCreateOpen(false)
            }
        } else {
            const res = await createCollabNote({
                title,
                content,
                color: selectedColor,
                isPinned,
                isPublic: isPublicVal,
                sharedWith: sharedWithVal,
                tags
            })
            if (res.success && res.note) {
                const newNote: NoteItem = {
                    id: res.note.id,
                    title: res.note.title,
                    content: res.note.content,
                    color: res.note.color,
                    isPinned: res.note.isPinned,
                    rotation: res.note.rotation,
                    tags,
                    isPublic: res.note.isPublic,
                    sharedWith: sharedWithVal,
                    createdBy: res.note.createdBy,
                    isMine: true,
                    createdAt: res.note.createdAt ? res.note.createdAt.toISOString() : new Date().toISOString(),
                    updatedAt: res.note.updatedAt ? res.note.updatedAt.toISOString() : new Date().toISOString()
                }
                setNotes(prev => [newNote, ...prev])
                setIsCreateOpen(false)
            }
        }
        setIsSaving(false)
    }

    const handleDelete = async (noteId: string) => {
        if (!confirm('¿Deseas eliminar esta nota adhesiva?')) return
        const res = await deleteCollabNote(noteId)
        if (res.success) {
            setNotes(prev => prev.filter(n => n.id !== noteId))
            if (editingNote?.id === noteId) setIsCreateOpen(false)
        }
    }

    const handleTogglePin = async (note: NoteItem, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!note.isMine) return
        const newPinned = !note.isPinned
        setNotes(prev => prev.map(n => n.id === note.id ? { ...n, isPinned: newPinned } : n))
        await updateCollabNote(note.id, { isPinned: newPinned })
    }

    const getColorScheme = (colorId: string) => {
        return NOTE_COLORS.find(c => c.id === colorId) || NOTE_COLORS[0]
    }

    // Filtrar colegas para el selector de compartir (excluyendo al usuario actual)
    const otherUsers = users.filter(u => u.username !== currentUsername)
    const filteredShareUsers = otherUsers.filter(u =>
        u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(userSearchTerm.toLowerCase())
    )

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-sm">
                <div>
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">📌</span>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Muro de Notas Adhesivas</h2>
                            <p className="text-sm text-slate-500">
                                Escribe recordatorios, ideas rápidas y compártelas de forma privada, con usuarios específicos o con todo el equipo.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Botón de crear */}
                    <button
                        onClick={openCreateModal}
                        className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white rounded-2xl font-bold shadow-md shadow-amber-500/20 hover:shadow-lg transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                    >
                        <span>➕</span> Nueva Nota Post-it
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                {/* Search */}
                <div className="relative flex-1 min-w-[240px] max-w-md">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Buscar notas por contenido o autor..."
                        className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 text-slate-800"
                    />
                </div>

                {/* Scope Filters */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 flex-wrap">
                    <button
                        onClick={() => setFilterScope('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterScope === 'all' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        Todas ({notes.length})
                    </button>
                    <button
                        onClick={() => setFilterScope('mine')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterScope === 'mine' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        Mis Notas ({notes.filter(n => n.isMine).length})
                    </button>
                    <button
                        onClick={() => setFilterScope('shared')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterScope === 'shared' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        👥 Compartidas Conmigo ({notes.filter(n => n.sharedWith && n.sharedWith.includes(currentUsername)).length})
                    </button>
                    <button
                        onClick={() => setFilterScope('public')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterScope === 'public' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        🌐 Públicas ({notes.filter(n => n.isPublic).length})
                    </button>
                </div>

                {/* Color Selector Filter */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setColorFilter(null)}
                        className={`w-6 h-6 rounded-full border text-[10px] font-bold flex items-center justify-center transition-transform ${!colorFilter ? 'ring-2 ring-slate-800 scale-110' : 'opacity-70 hover:opacity-100'}`}
                        title="Todos los colores"
                    >
                        ✨
                    </button>
                    {NOTE_COLORS.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setColorFilter(colorFilter === c.id ? null : c.id)}
                            className={`w-6 h-6 rounded-full ${c.bg} ${c.border} border shadow-sm transition-all ${colorFilter === c.id ? 'ring-2 ring-slate-800 scale-125' : 'hover:scale-110 opacity-80'}`}
                            title={c.label}
                        />
                    ))}
                </div>
            </div>

            {/* Tags Pills */}
            {allTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-1">
                    <span className="text-xs font-bold text-slate-400">Etiquetas:</span>
                    {allTags.map(tag => (
                        <button
                            key={tag}
                            onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${selectedTag === tag ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            #{tag}
                        </button>
                    ))}
                </div>
            )}

            {/* Sticky Notes Corkboard Grid */}
            <div className="flex-1 min-h-[500px] p-6 sm:p-8 rounded-3xl bg-amber-50/40 border-2 border-dashed border-amber-200/80 shadow-inner overflow-y-auto">
                {filteredNotes.length === 0 ? (
                    <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 text-amber-900/60">
                        <div className="text-6xl mb-3 animate-bounce">📝</div>
                        <h4 className="text-lg font-bold">No hay notas que coincidan</h4>
                        <p className="text-sm max-w-sm mt-1">
                            Haz clic en el botón <strong className="text-amber-700">"Nueva Nota Post-it"</strong> para pegar tu primer recordatorio o compartirlo con tus colegas.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {filteredNotes.map((note) => {
                            const scheme = getColorScheme(note.color)
                            const rotStyle = { transform: `rotate(${note.rotation || 0}deg)` }

                            return (
                                <div
                                    key={note.id}
                                    style={rotStyle}
                                    onClick={() => note.isMine && openEditModal(note)}
                                    className={`group relative flex flex-col justify-between ${scheme.bg} ${scheme.border} border-2 rounded-2xl p-4 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer min-h-[220px]`}
                                >
                                    {/* Post-it Pin Top */}
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                                        <button
                                            onClick={(e) => handleTogglePin(note, e)}
                                            className={`p-1 rounded-full bg-white/90 shadow-sm border border-slate-200 hover:scale-125 transition-transform ${note.isPinned ? 'text-rose-500' : 'text-slate-400'}`}
                                            title={note.isPinned ? 'Desfijar' : 'Fijar con chincheta'}
                                        >
                                            📌
                                        </button>
                                    </div>

                                    {/* Note Header / Title */}
                                    <div className="pt-2">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            {note.title ? (
                                                <h3 className={`font-black text-base ${scheme.text} line-clamp-1`}>
                                                    {note.title}
                                                </h3>
                                            ) : (
                                                <span />
                                            )}
                                            
                                            {/* Insignia de Privacidad / Compartido */}
                                            {note.isPublic ? (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white/90 rounded-md text-emerald-800 border border-emerald-200 flex-shrink-0" title="Visible para todos">
                                                    🌐 Pública
                                                </span>
                                            ) : note.sharedWith && note.sharedWith.length > 0 ? (
                                                <span
                                                    className="text-[10px] font-black px-1.5 py-0.5 bg-indigo-100 text-indigo-900 rounded-md border border-indigo-300 flex-shrink-0"
                                                    title={`Compartida con: ${note.sharedWith.map(u => u.startsWith('ROLE:') ? u.slice(5) : '@' + u).join(', ')}`}
                                                >
                                                    🎯 {note.sharedWith.length} {note.sharedWith.length === 1 ? 'destinatario' : 'destinatarios'}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white/70 rounded-md text-slate-500 border border-slate-200 flex-shrink-0" title="Solo tú puedes verla">
                                                    🔒 Solo tú
                                                </span>
                                            )}
                                        </div>

                                        {/* Note Content */}
                                        <p className={`text-sm ${scheme.text} font-medium whitespace-pre-wrap leading-relaxed select-text`}>
                                            {note.content}
                                        </p>
                                    </div>

                                    {/* Note Footer */}
                                    <div className="mt-4 pt-3 border-t border-black/10">
                                        {/* Tags */}
                                        {note.tags && note.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {note.tags.map((t, idx) => (
                                                    <span key={idx} className="text-[10px] font-bold px-1.5 py-0.5 bg-white/70 rounded text-slate-700">
                                                        #{t}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                                            <span className="truncate max-w-[110px]" title={note.createdBy}>
                                                ✍️ {note.createdBy}
                                            </span>
                                            <span className="text-[10px] opacity-75">
                                                {new Date(note.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                                            </span>
                                        </div>

                                        {/* Action Bar with Quick Conversion */}
                                        <div className="flex items-center justify-between gap-1.5 mt-2 pt-2 border-t border-black/5">
                                            {onConvertToAppointment ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onConvertToAppointment(note)
                                                    }}
                                                    className="px-2 py-1 bg-white/90 hover:bg-cyan-600 hover:text-white text-cyan-800 rounded-lg text-[11px] font-bold shadow-xs border border-cyan-200/60 flex items-center gap-1 transition-all active:scale-95 group/btn"
                                                    title="Convertir esta nota en un evento de calendario"
                                                >
                                                    <span className="group-hover/btn:scale-110 transition-transform">📅</span>
                                                    <span>Agendar</span>
                                                </button>
                                            ) : <div />}

                                            {note.isMine && (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            openEditModal(note)
                                                        }}
                                                        className="p-1 hover:bg-black/10 rounded-lg text-slate-600 transition-colors"
                                                        title="Editar nota"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleDelete(note.id)
                                                        }}
                                                        className="p-1 hover:bg-rose-100 rounded-lg text-rose-600 transition-colors"
                                                        title="Eliminar nota"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Modal: Crear / Editar Nota */}
            {isCreateOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        {/* Cabecera Fija */}
                        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">
                                    {editingNote ? 'Editar Nota Adhesiva' : 'Nueva Nota Post-it'}
                                </h3>
                                <p className="text-xs text-slate-500">Captura ideas, recordatorios y notas compartidas con segmentación inteligente.</p>
                            </div>
                            <button
                                onClick={() => setIsCreateOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 transition-colors cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Formulario con Scroll Interno */}
                        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                                {/* Selector de Color */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-2">Color del Post-it</label>
                                    <div className="grid grid-cols-6 gap-2">
                                        {NOTE_COLORS.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => setSelectedColor(c.id)}
                                                className={`h-9 rounded-xl border-2 transition-all ${c.bg} ${c.border} ${
                                                    selectedColor === c.id ? 'ring-2 ring-slate-800 scale-105 shadow-sm' : 'opacity-80 hover:opacity-100'
                                                }`}
                                                title={c.label}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Título */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Título (Opcional)</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Recordatorio Auditoría JUNAEB"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-300 outline-none"
                                    />
                                </div>

                                {/* Contenido */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Contenido de la Nota *</label>
                                    <textarea
                                        rows={4}
                                        required
                                        placeholder="Escribe lo que necesitas recordar o comunicar..."
                                        value={content}
                                        onChange={e => setContent(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-300 outline-none resize-none leading-relaxed"
                                    />
                                </div>

                                {/* Etiquetas */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Etiquetas / Tags</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Escribe un tag y presiona Enter..."
                                            value={tagInput}
                                            onChange={e => setTagInput(e.target.value)}
                                            onKeyDown={handleAddTag}
                                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-300 outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const cleaned = tagInput.trim().replace(/^#/, '')
                                                if (cleaned && !tags.includes(cleaned)) {
                                                    setTags([...tags, cleaned])
                                                    setTagInput('')
                                                }
                                            }}
                                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                                        >
                                            + Tag
                                        </button>
                                    </div>
                                    {tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {tags.map(t => (
                                                <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg text-xs font-bold">
                                                    #{t}
                                                    <button type="button" onClick={() => handleRemoveTag(t)} className="hover:text-rose-600">×</button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Fijar chincheta */}
                                <div>
                                    <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={isPinned}
                                            onChange={e => setIsPinned(e.target.checked)}
                                            className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400"
                                        />
                                        <span className="text-xs font-bold text-slate-700">📌 Fijar al inicio del muro</span>
                                    </label>
                                </div>

                                {/* ========================================================= */}
                                {/* OPCIONES DE PRIVACIDAD Y SEGMENTACIÓN                     */}
                                {/* ========================================================= */}
                                <div className="space-y-3 pt-2 border-t border-slate-100">
                                    <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                                        ¿Con quién deseas compartir esta nota?
                                    </label>

                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPrivacyMode('private')
                                                setSelectedSharedUsers([])
                                            }}
                                            className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                                                privacyMode === 'private'
                                                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300/50 shadow-xs'
                                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            <span className="text-base">🔒</span>
                                            <span className="text-xs font-bold text-slate-800">Solo Yo</span>
                                            <span className="text-[9px] text-slate-400">Privada</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setPrivacyMode('segmented')}
                                            className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                                                privacyMode === 'segmented'
                                                    ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-300/50 shadow-xs'
                                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            <span className="text-base">🎯</span>
                                            <span className="text-xs font-bold text-slate-800">Segmentada</span>
                                            <span className="text-[9px] text-indigo-600 font-bold">
                                                {selectedSharedUsers.length > 0
                                                    ? `${selectedSharedUsers.length} destinatarios`
                                                    : 'Sucursal + Rol'}
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPrivacyMode('public')
                                                setSelectedSharedUsers([])
                                            }}
                                            className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                                                privacyMode === 'public'
                                                    ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300/50 shadow-xs'
                                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            <span className="text-base">🌐</span>
                                            <span className="text-xs font-bold text-slate-800">Pública</span>
                                            <span className="text-[9px] text-slate-400">Toda la empresa</span>
                                        </button>
                                    </div>

                                    {/* Segmentador Avanzado Integrado */}
                                    {privacyMode === 'segmented' && (
                                        <RecipientCombinator
                                            users={users}
                                            currentUsername={currentUsername}
                                            selectedUsernames={selectedSharedUsers}
                                            onSelectionChange={(newSelected) => setSelectedSharedUsers(newSelected)}
                                            title="Segmentador de Audiencia (Sucursal + Rol + Colegas)"
                                            subtitle="Filtra por sucursales y roles para compartir esta nota solo con las personas que necesitas (ej: Supervisores de CD Copiapó)."
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Botonera Fija */}
                            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
                                {editingNote ? (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(editingNote.id)}
                                        className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                                    >
                                        🗑️ Eliminar Nota
                                    </button>
                                ) : (
                                    <span />
                                )}
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateOpen(false)}
                                        className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving || !content.trim()}
                                        className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 disabled:opacity-50 text-white rounded-xl font-black text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                                    >
                                        {isSaving ? 'Guardando...' : (editingNote ? 'Guardar Cambios' : 'Pegar en el Muro ✨')}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
