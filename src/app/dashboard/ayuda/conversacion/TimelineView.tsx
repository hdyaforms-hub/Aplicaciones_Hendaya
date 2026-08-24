'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { getProjectTimelineAction } from './actions'

export interface ActivityItem {
    id: string
    projectId: string
    type: 'CHAT' | 'TASK' | 'GANTT' | 'DECISION' | 'WHITEBOARD' | 'NOTE'
    title: string
    description?: string | null
    metadata?: any
    username: string
    userFullName?: string | null
    createdAt: string
}

interface TimelineViewProps {
    projectId: string
    projectTitle: string
    members: string[]
    currentUsername: string
}

export default function TimelineView({
    projectId,
    projectTitle,
    members,
    currentUsername
}: TimelineViewProps) {
    const [activities, setActivities] = useState<ActivityItem[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [selectedType, setSelectedType] = useState<string>('ALL')
    const [selectedUser, setSelectedUser] = useState<string>('ALL')
    const [searchTerm, setSearchTerm] = useState('')
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const [totalActivities, setTotalActivities] = useState(0)

    const fetchTimeline = useCallback(async (pageNum: number = 1, append: boolean = false) => {
        if (append) setLoadingMore(true)
        else setLoading(true)

        const res = await getProjectTimelineAction(projectId, {
            type: selectedType,
            username: selectedUser,
            page: pageNum,
            limit: 20
        })

        if (res.success && res.activities) {
            if (append) {
                setActivities(prev => [...prev, ...res.activities])
            } else {
                setActivities(res.activities)
            }
            setHasMore(res.pagination?.hasMore || false)
            setTotalActivities(res.pagination?.total || 0)
            setPage(pageNum)
        }
        setLoading(false)
        setLoadingMore(false)
    }, [projectId, selectedType, selectedUser])

    useEffect(() => {
        fetchTimeline(1, false)
    }, [fetchTimeline])

    const handleLoadMore = () => {
        if (!loadingMore && hasMore) {
            fetchTimeline(page + 1, true)
        }
    }

    const typeConfig: Record<string, { icon: string; label: string; color: string; dot: string; bg: string }> = {
        CHAT: { icon: '💬', label: 'Mensaje Chat', color: 'text-cyan-700 border-cyan-300', dot: 'bg-cyan-500', bg: 'bg-cyan-50' },
        TASK: { icon: '📋', label: 'Tarea Trello', color: 'text-indigo-700 border-indigo-300', dot: 'bg-indigo-500', bg: 'bg-indigo-50' },
        GANTT: { icon: '📊', label: 'Cronograma Gantt', color: 'text-emerald-700 border-emerald-300', dot: 'bg-emerald-500', bg: 'bg-emerald-50' },
        DECISION: { icon: '⚖️', label: 'Acuerdo / Decisión', color: 'text-purple-700 border-purple-300', dot: 'bg-purple-500', bg: 'bg-purple-50' },
        WHITEBOARD: { icon: '🎨', label: 'Pizarra / Diagrama', color: 'text-amber-700 border-amber-300', dot: 'bg-amber-500', bg: 'bg-amber-50' },
        NOTE: { icon: '📌', label: 'Nota Post-it', color: 'text-rose-700 border-rose-300', dot: 'bg-rose-500', bg: 'bg-rose-50' }
    }

    const filteredActivities = activities.filter(a => {
        if (!searchTerm.trim()) return true
        const term = searchTerm.toLowerCase()
        return (
            a.title.toLowerCase().includes(term) ||
            (a.description && a.description.toLowerCase().includes(term)) ||
            a.username.toLowerCase().includes(term) ||
            (a.userFullName && a.userFullName.toLowerCase().includes(term))
        )
    })

    return (
        <div className="space-y-6">
            {/* Header de la Línea de Tiempo */}
            <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-sky-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-cyan-600/20">
                        ⏱️
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                Timeline Unificado de Proyecto
                            </h2>
                            <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-cyan-100 text-cyan-800 border border-cyan-200">
                                {totalActivities} eventos
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Bitácora automática con eventos de chat, tareas, decisiones, notas y avances Gantt para: <strong className="text-slate-800">{projectTitle}</strong>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchTimeline(1, false)}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                        <span>🔄</span> Actualizar
                    </button>
                </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    <input
                        type="text"
                        placeholder="Buscar en la bitácora..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Filtro por Tipo */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
                        <button
                            onClick={() => setSelectedType('ALL')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${selectedType === 'ALL' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setSelectedType('CHAT')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${selectedType === 'CHAT' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            💬 Chat
                        </button>
                        <button
                            onClick={() => setSelectedType('TASK')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${selectedType === 'TASK' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            📋 Tareas
                        </button>
                        <button
                            onClick={() => setSelectedType('GANTT')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${selectedType === 'GANTT' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            📊 Gantt
                        </button>
                        <button
                            onClick={() => setSelectedType('DECISION')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${selectedType === 'DECISION' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            ⚖️ Decisiones
                        </button>
                    </div>

                    {/* Filtro por Miembro */}
                    <select
                        value={selectedUser}
                        onChange={e => setSelectedUser(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-cyan-400"
                    >
                        <option value="ALL">👤 Todos los miembros</option>
                        {members.map(m => (
                            <option key={m} value={m}>@{m}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Línea de Tiempo Cronológica */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm min-h-[400px]">
                {loading ? (
                    <div className="text-center py-16 text-slate-400 text-xs">
                        <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        Cargando bitácora del proyecto...
                    </div>
                ) : filteredActivities.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <span className="text-5xl block mb-2">📜</span>
                        <h4 className="text-base font-bold text-slate-700">Sin actividades registradas</h4>
                        <p className="text-xs max-w-sm mx-auto mt-1">
                            A medida que el equipo intercambie mensajes, cree tareas o ajuste el Gantt de este proyecto, los eventos se consolidarán aquí automáticamente.
                        </p>
                    </div>
                ) : (
                    <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                        {filteredActivities.map((act) => {
                            const cfg = typeConfig[act.type] || typeConfig.CHAT
                            const dateObj = new Date(act.createdAt)
                            const dateFormatted = dateObj.toLocaleDateString('es-CL', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })

                            return (
                                <div key={act.id} className="relative group">
                                    {/* Nodo indicador en la línea vertical */}
                                    <div className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 sm:w-8 sm:h-8 rounded-2xl ${cfg.bg} border-2 ${cfg.color} flex items-center justify-center text-xs sm:text-sm shadow-xs group-hover:scale-110 transition-transform bg-white`}>
                                        <span>{cfg.icon}</span>
                                    </div>

                                    {/* Tarjeta de Evento */}
                                    <div className="bg-slate-50/70 hover:bg-slate-100/80 p-4 rounded-2xl border border-slate-200/80 transition-all space-y-2">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${cfg.color} ${cfg.bg}`}>
                                                    {cfg.label}
                                                </span>
                                                <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                                                    {act.title}
                                                </h4>
                                            </div>

                                            <span className="text-[10px] font-medium text-slate-400">
                                                🕒 {dateFormatted}
                                            </span>
                                        </div>

                                        {act.description && (
                                            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap select-text">
                                                {act.description}
                                            </p>
                                        )}

                                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[9px] flex items-center justify-center">
                                                    {act.userFullName ? act.userFullName.charAt(0).toUpperCase() : act.username.charAt(0).toUpperCase()}
                                                </span>
                                                <span className="font-bold text-slate-700">{act.userFullName || act.username}</span>
                                                <span className="text-[10px] text-slate-400">(@{act.username})</span>
                                            </span>

                                            {act.metadata && (
                                                <span className="text-[10px] text-slate-400 italic">
                                                    Ref: {typeof act.metadata === 'object' ? JSON.stringify(act.metadata).slice(0, 40) : act.metadata}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}

                        {/* Botón Cargar Más */}
                        {hasMore && (
                            <div className="pt-4 text-center">
                                <button
                                    onClick={handleLoadMore}
                                    disabled={loadingMore}
                                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-2xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                                >
                                    {loadingMore ? 'Cargando más...' : '⬇ Cargar más eventos'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
