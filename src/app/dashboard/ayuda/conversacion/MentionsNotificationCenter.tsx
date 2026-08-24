'use client'

import React, { useState, useEffect, useRef } from 'react'
import { getMentionsAction, markMentionAsReadAction, markAllMentionsAsReadAction } from './actions'

export interface MentionNotificationItem {
    id: string
    sourceType: 'chat' | 'task' | 'note' | 'kudo' | 'decision'
    sourceId: string
    projectId?: string | null
    mentionedUsername: string
    authorUsername: string
    authorName?: string | null
    previewText: string
    readAt?: string | null
    createdAt: string
}

interface Props {
    onSelectMention?: (mention: MentionNotificationItem) => void
}

export default function MentionsNotificationCenter({ onSelectMention }: Props) {
    const [isOpen, setIsOpen] = useState(false)
    const [mentions, setMentions] = useState<MentionNotificationItem[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [filterType, setFilterType] = useState<string>('ALL')
    const [loading, setLoading] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const fetchMentions = async () => {
        const res = await getMentionsAction({ page: 1, limit: 30 })
        if (res.success && res.mentions) {
            setMentions(res.mentions)
            setUnreadCount(res.unreadCount || 0)
        }
    }

    useEffect(() => {
        fetchMentions()
        // Polling de menciones cada 20 segundos
        const interval = setInterval(fetchMentions, 20000)
        return () => clearInterval(interval)
    }, [])

    // Cerrar al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        await markMentionAsReadAction(id)
        setMentions(prev => prev.map(m => m.id === id ? { ...m, readAt: new Date().toISOString() } : m))
        setUnreadCount(prev => Math.max(0, prev - 1))
    }

    const handleMarkAllRead = async () => {
        setLoading(true)
        await markAllMentionsAsReadAction()
        setMentions(prev => prev.map(m => ({ ...m, readAt: new Date().toISOString() })))
        setUnreadCount(0)
        setLoading(false)
    }

    const filteredMentions = mentions.filter(m => {
        if (filterType === 'ALL') return true
        return m.sourceType === filterType
    })

    const sourceIcons: Record<string, { icon: string; label: string; badge: string }> = {
        chat: { icon: '💬', label: 'Chat', badge: 'bg-cyan-100 text-cyan-800' },
        task: { icon: '📋', label: 'Tarea Trello', badge: 'bg-indigo-100 text-indigo-800' },
        note: { icon: '📌', label: 'Nota Post-it', badge: 'bg-amber-100 text-amber-800' },
        kudo: { icon: '🏆', label: 'Reconocimiento', badge: 'bg-emerald-100 text-emerald-800' },
        decision: { icon: '⚖️', label: 'Decisión', badge: 'bg-purple-100 text-purple-800' }
    }

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            {/* Botón Campana con Contador */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
                title="Menciones y Notificaciones"
            >
                <span className="text-base">🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black text-[10px] rounded-full flex items-center justify-center shadow-lg shadow-rose-500/30 animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown de Menciones */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200/90 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🔔</span>
                            <div>
                                <h3 className="font-black text-xs uppercase tracking-wider text-white">Menciones Recibidas</h3>
                                <p className="text-[10px] text-slate-400">
                                    {unreadCount} sin leer de {mentions.length} totales
                                </p>
                            </div>
                        </div>

                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                disabled={loading}
                                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-cyan-300 text-[10px] font-bold rounded-xl transition-colors disabled:opacity-50"
                            >
                                Marcar todo leído
                            </button>
                        )}
                    </div>

                    {/* Filtros por Módulo */}
                    <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-100 overflow-x-auto text-[11px]">
                        <button
                            onClick={() => setFilterType('ALL')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${filterType === 'ALL' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'}`}
                        >
                            Todas
                        </button>
                        <button
                            onClick={() => setFilterType('chat')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${filterType === 'chat' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'}`}
                        >
                            💬 Chat
                        </button>
                        <button
                            onClick={() => setFilterType('task')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${filterType === 'task' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'}`}
                        >
                            📋 Tareas
                        </button>
                        <button
                            onClick={() => setFilterType('note')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${filterType === 'note' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'}`}
                        >
                            📌 Notas
                        </button>
                        <button
                            onClick={() => setFilterType('kudo')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${filterType === 'kudo' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'}`}
                        >
                            🏆 Kudos
                        </button>
                    </div>

                    {/* Lista de Menciones */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {filteredMentions.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <span className="text-3xl block mb-1">🎉</span>
                                <p className="text-xs font-bold text-slate-600">No tienes menciones pendientes</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">Cuando un colega te mencione con @, aparecerá aquí.</p>
                            </div>
                        ) : (
                            filteredMentions.map(m => {
                                const info = sourceIcons[m.sourceType] || sourceIcons.chat
                                const isUnread = !m.readAt

                                return (
                                    <div
                                        key={m.id}
                                        onClick={() => {
                                            if (isUnread) markMentionAsReadAction(m.id)
                                            if (onSelectMention) onSelectMention(m)
                                            setIsOpen(false)
                                        }}
                                        className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                                            isUnread ? 'bg-cyan-50/60 hover:bg-cyan-100/60' : 'hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                                            {m.authorName ? m.authorName.charAt(0).toUpperCase() : m.authorUsername.charAt(0).toUpperCase()}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1 mb-0.5">
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <span className="font-extrabold text-slate-900 text-xs truncate">
                                                        {m.authorName || m.authorUsername}
                                                    </span>
                                                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${info.badge}`}>
                                                        {info.icon} {info.label}
                                                    </span>
                                                </div>

                                                {isUnread && (
                                                    <button
                                                        onClick={(e) => handleMarkAsRead(m.id, e)}
                                                        className="w-2 h-2 rounded-full bg-cyan-600 hover:scale-125 transition-transform"
                                                        title="Marcar como leída"
                                                    />
                                                )}
                                            </div>

                                            <p className="text-xs text-slate-700 leading-snug line-clamp-2 select-none">
                                                {m.previewText}
                                            </p>

                                            <p className="text-[10px] text-slate-400 mt-1">
                                                {new Date(m.createdAt).toLocaleDateString('es-CL', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
