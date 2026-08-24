'use client'

import React, { useState, useEffect } from 'react'
import { getMyDayData, updateCollabTaskStatus, markMentionAsReadAction } from './actions'

interface MyDayProps {
    onNavigateTab?: (tab: string) => void
}

export default function MyDayView({ onNavigateTab }: MyDayProps) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [tasks, setTasks] = useState<any[]>([])
    const [mentions, setMentions] = useState<any[]>([])

    const loadMyDay = async () => {
        setLoading(true)
        const res = await getMyDayData()
        if (res.success) {
            setData(res)
            setTasks(res.tasks || [])
            setMentions(res.mentions || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        loadMyDay()
    }, [])

    const handleToggleTaskDone = async (taskId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setTasks(prev => prev.filter(t => t.id !== taskId))
        await updateCollabTaskStatus(taskId, 'COMPLETADA')
    }

    const handleMarkMentionRead = async (mentionId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setMentions(prev => prev.filter(m => m.id !== mentionId))
        await markMentionAsReadAction(mentionId)
    }

    const priorityColors: Record<string, string> = {
        BAJA: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        MEDIA: 'bg-amber-100 text-amber-800 border-amber-200',
        ALTA: 'bg-orange-100 text-orange-800 border-orange-200',
        URGENTE: 'bg-rose-100 text-rose-800 border-rose-200'
    }

    if (loading) {
        return (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400">
                <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                Cargando tu resumen personal de Mi Día...
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header Mi Día */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-3xl">☀️</span>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                            Mi Día | {data?.currentUser?.name || data?.currentUser?.username}
                        </h2>
                    </div>
                    <p className="text-xs sm:text-sm text-cyan-200/80">
                        {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>

                {/* Resumen de Productividad */}
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/10">
                    <div className="px-3 text-center border-r border-white/10">
                        <span className="text-xl font-black text-white">{tasks.length}</span>
                        <p className="text-[10px] text-cyan-200 font-bold uppercase">Tareas</p>
                    </div>
                    <div className="px-3 text-center border-r border-white/10">
                        <span className="text-xl font-black text-white">{data?.appointments?.length || 0}</span>
                        <p className="text-[10px] text-cyan-200 font-bold uppercase">Citas Hoy</p>
                    </div>
                    <div className="px-3 text-center border-r border-white/10">
                        <span className="text-xl font-black text-white">{mentions.length}</span>
                        <p className="text-[10px] text-cyan-200 font-bold uppercase">Menciones</p>
                    </div>
                    <div className="px-3 text-center">
                        <span className="text-xl font-black text-amber-300">🏆 {data?.totalKudos || 0}</span>
                        <p className="text-[10px] text-cyan-200 font-bold uppercase">Kudos</p>
                    </div>
                </div>
            </div>

            {/* Tres Secciones Principales */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Tareas Asignadas */}
                <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">📋</span>
                            <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">Mis Tareas Pendientes</h3>
                        </div>
                        <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {tasks.length}
                        </span>
                    </div>

                    <div className="space-y-2.5 max-h-[420px] overflow-y-auto flex-1 pr-1">
                        {tasks.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 text-xs">
                                <span className="text-3xl block mb-2">🎉</span>
                                ¡Estás al día! No tienes tareas pendientes asignadas.
                            </div>
                        ) : (
                            tasks.map(t => (
                                <div
                                    key={t.id}
                                    className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                                        t.isOverdue ? 'bg-rose-50/70 border-rose-200' : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/70'
                                    }`}
                                >
                                    <button
                                        onClick={(e) => handleToggleTaskDone(t.id, e)}
                                        className="mt-0.5 w-5 h-5 rounded-lg border-2 border-slate-400 hover:border-emerald-500 hover:bg-emerald-50 text-emerald-600 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                                        title="Marcar tarea como completada"
                                    >
                                        ✓
                                    </button>

                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex items-center justify-between gap-1 flex-wrap">
                                            <h4 className="font-bold text-slate-900 text-xs truncate">{t.title}</h4>
                                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${priorityColors[t.priority]}`}>
                                                {t.priority}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                                            {t.projectTitle ? (
                                                <span className="truncate max-w-[120px] text-cyan-700 font-bold">
                                                    🚀 {t.projectTitle}
                                                </span>
                                            ) : <span></span>}

                                            {t.dueDate && (
                                                <span className={`font-semibold ${t.isOverdue ? 'text-rose-600 font-black' : 'text-slate-500'}`}>
                                                    📅 {new Date(t.dueDate).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                                                    {t.isOverdue ? ' (Atrasada)' : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {onNavigateTab && (
                        <button
                            onClick={() => onNavigateTab('kanban')}
                            className="w-full py-2 bg-slate-100 hover:bg-cyan-50 hover:text-cyan-700 text-slate-600 rounded-xl text-xs font-bold transition-colors text-center"
                        >
                            Ver Tablero Trello ➔
                        </button>
                    )}
                </div>

                {/* 2. Citas y Calendario de Hoy */}
                <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">📅</span>
                            <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">Reuniones de Hoy</h3>
                        </div>
                        <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200">
                            {data?.appointments?.length || 0}
                        </span>
                    </div>

                    <div className="space-y-2.5 max-h-[420px] overflow-y-auto flex-1 pr-1">
                        {!data?.appointments || data.appointments.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 text-xs">
                                <span className="text-3xl block mb-2">☕</span>
                                No tienes reuniones programadas para hoy.
                            </div>
                        ) : (
                            data.appointments.map((a: any) => (
                                <div key={a.id} className="p-3.5 rounded-2xl bg-cyan-50/50 border border-cyan-100 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-slate-900 text-xs">{a.title}</h4>
                                        <span className="text-[10px] font-bold text-cyan-700 bg-white px-2 py-0.5 rounded-md border border-cyan-200">
                                            {new Date(a.startDate).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    {a.description && (
                                        <p className="text-[11px] text-slate-600 line-clamp-2">{a.description}</p>
                                    )}

                                    {a.meetLink && (
                                        <a
                                            href={a.meetLink.startsWith('http') ? a.meetLink : `https://${a.meetLink}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] text-cyan-700 font-bold hover:underline"
                                        >
                                            🔗 Unirse a Videollamada
                                        </a>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {onNavigateTab && (
                        <button
                            onClick={() => onNavigateTab('calendar')}
                            className="w-full py-2 bg-slate-100 hover:bg-cyan-50 hover:text-cyan-700 text-slate-600 rounded-xl text-xs font-bold transition-colors text-center"
                        >
                            Abrir Calendario ➔
                        </button>
                    )}
                </div>

                {/* 3. Menciones Recientes */}
                <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🔔</span>
                            <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">Menciones Recientes</h3>
                        </div>
                        <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-pink-50 text-pink-700 border border-pink-200">
                            {mentions.length}
                        </span>
                    </div>

                    <div className="space-y-2.5 max-h-[420px] overflow-y-auto flex-1 pr-1">
                        {mentions.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 text-xs">
                                <span className="text-3xl block mb-2">✨</span>
                                No tienes menciones pendientes sin leer.
                            </div>
                        ) : (
                            mentions.map((m: any) => (
                                <div key={m.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 relative group">
                                    <div className="flex items-center justify-between gap-1">
                                        <span className="font-bold text-xs text-slate-900 truncate">
                                            @{m.authorUsername}
                                        </span>
                                        <button
                                            onClick={(e) => handleMarkMentionRead(m.id, e)}
                                            className="text-[10px] text-cyan-600 hover:underline font-bold"
                                        >
                                            Marcar leída
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                        {m.previewText}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>

                    {onNavigateTab && (
                        <button
                            onClick={() => onNavigateTab('chat')}
                            className="w-full py-2 bg-slate-100 hover:bg-cyan-50 hover:text-cyan-700 text-slate-600 rounded-xl text-xs font-bold transition-colors text-center"
                        >
                            Ir a Conversaciones ➔
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
