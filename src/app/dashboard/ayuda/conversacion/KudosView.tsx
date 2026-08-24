'use client'

import React, { useState, useEffect } from 'react'
import { getKudosAction, createKudoAction, getUserKudosStats } from './actions'

export interface KudoItem {
    id: string
    fromUsername: string
    fromName: string
    toUsername: string
    toName: string
    projectId?: string | null
    message: string
    category: 'EQUIPO' | 'INNOVACION' | 'CALIDAD' | 'LIDERAZGO' | 'AGILIDAD'
    badgeIcon: string
    createdAt: string
}

interface KudosViewProps {
    currentUsername: string
    currentName: string
    users: Array<{ username: string; name: string; role?: string }>
    projectId?: string
}

const CATEGORIES = [
    { id: 'EQUIPO', label: 'Trabajo en Equipo', icon: '🤝', color: 'from-blue-500 to-cyan-500', badge: 'bg-blue-100 text-blue-800' },
    { id: 'INNOVACION', label: 'Innovación & Creatividad', icon: '💡', color: 'from-amber-500 to-yellow-500', badge: 'bg-amber-100 text-amber-800' },
    { id: 'CALIDAD', label: 'Excelencia y Calidad', icon: '⭐', color: 'from-emerald-500 to-teal-500', badge: 'bg-emerald-100 text-emerald-800' },
    { id: 'LIDERAZGO', label: 'Liderazgo Positivo', icon: '🦁', color: 'from-purple-500 to-indigo-500', badge: 'bg-purple-100 text-purple-800' },
    { id: 'AGILIDAD', label: 'Agilidad y Compromiso', icon: '⚡', color: 'from-rose-500 to-pink-500', badge: 'bg-rose-100 text-rose-800' }
]

export default function KudosView({
    currentUsername,
    currentName,
    users,
    projectId
}: KudosViewProps) {
    const [kudos, setKudos] = useState<KudoItem[]>([])
    const [stats, setStats] = useState<{ total: number; categories: Record<string, number> }>({ total: 0, categories: {} })
    const [loading, setLoading] = useState(true)
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL')

    // Modal state
    const [showModal, setShowModal] = useState(false)
    const [toUsername, setToUsername] = useState('')
    const [message, setMessage] = useState('')
    const [category, setCategory] = useState<'EQUIPO' | 'INNOVACION' | 'CALIDAD' | 'LIDERAZGO' | 'AGILIDAD'>('EQUIPO')
    const [sending, setSending] = useState(false)

    const fetchKudos = async () => {
        setLoading(true)
        const [kudosRes, statsRes] = await Promise.all([
            getKudosAction({ projectId, category: selectedCategory }),
            getUserKudosStats(currentUsername)
        ])

        if (kudosRes.success && kudosRes.kudos) {
            setKudos(kudosRes.kudos as KudoItem[])
        }
        if (statsRes) {
            setStats(statsRes)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchKudos()
    }, [selectedCategory, projectId])

    const handleSendKudo = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!toUsername || !message.trim() || sending) return

        const selectedUserObj = users.find(u => u.username === toUsername)
        const catObj = CATEGORIES.find(c => c.id === category) || CATEGORIES[0]

        setSending(true)
        const res = await createKudoAction({
            toUsername,
            toName: selectedUserObj?.name || toUsername,
            projectId: projectId || null,
            message: message.trim(),
            category,
            badgeIcon: catObj.icon
        })

        if (res.success && res.kudo) {
            setShowModal(false)
            setMessage('')
            setToUsername('')
            fetchKudos()
        }
        setSending(false)
    }

    return (
        <div className="space-y-6">
            {/* Header & Trophy Summary */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-3xl sm:text-4xl p-2 bg-white/10 rounded-2xl">🏆</span>
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                                Muro de Reconocimientos (Kudos)
                            </h2>
                            <p className="text-xs sm:text-sm text-cyan-200/80">
                                Celebra logros, buen trabajo y aportes destacados del equipo de Hendaya.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Mis Estadísticas */}
                    <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center">
                        <span className="text-2xl font-black text-amber-300">{stats.total}</span>
                        <p className="text-[10px] text-cyan-200 font-bold uppercase">Kudos Recibidos</p>
                    </div>

                    <button
                        onClick={() => setShowModal(true)}
                        className="px-5 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 rounded-2xl font-black text-xs shadow-lg shadow-amber-500/20 hover:scale-105 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                        <span>✨</span>
                        <span>Enviar Reconocimiento</span>
                    </button>
                </div>
            </div>

            {/* Selector de Categorías */}
            <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                <button
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedCategory === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    Todos ({kudos.length})
                </button>
                {CATEGORIES.map(c => (
                    <button
                        key={c.id}
                        onClick={() => setSelectedCategory(c.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                            selectedCategory === c.id ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <span>{c.icon}</span>
                        <span>{c.label}</span>
                    </button>
                ))}
            </div>

            {/* Feed de Reconocimientos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {loading ? (
                    <div className="col-span-full text-center py-16 text-slate-400 text-xs">
                        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        Cargando muro de reconocimientos...
                    </div>
                ) : kudos.length === 0 ? (
                    <div className="col-span-full text-center py-16 text-slate-400 bg-white rounded-3xl border border-slate-200">
                        <span className="text-5xl block mb-2">🌟</span>
                        <h4 className="text-base font-bold text-slate-700">Sé el primero en enviar un Kudo</h4>
                        <p className="text-xs max-w-sm mx-auto mt-1">
                            Reconoce la labor de un compañero haciendo clic en "Enviar Reconocimiento".
                        </p>
                    </div>
                ) : (
                    kudos.map(k => {
                        const cat = CATEGORIES.find(c => c.id === k.category) || CATEGORIES[0]

                        return (
                            <div
                                key={k.id}
                                className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative overflow-hidden group"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl flex items-center gap-1.5 border border-black/5 ${cat.badge}`}>
                                            <span>{cat.icon}</span>
                                            <span>{cat.label}</span>
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            {new Date(k.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                                        </span>
                                    </div>

                                    {/* Destinatario destacado */}
                                    <div className="flex items-center gap-3 pt-1">
                                        <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white font-black text-sm flex items-center justify-center shadow-xs">
                                            {k.toName ? k.toName.charAt(0).toUpperCase() : k.toUsername.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-900 leading-tight">Para: {k.toName}</p>
                                            <p className="text-[10px] text-slate-400">@{k.toUsername}</p>
                                        </div>
                                    </div>

                                    {/* Mensaje de reconocimiento */}
                                    <p className="text-xs text-slate-700 leading-relaxed font-medium bg-slate-50 p-3.5 rounded-2xl border border-slate-100 select-text">
                                        "{k.message}"
                                    </p>
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                                    <span>De: <strong>@{k.fromUsername}</strong> ({k.fromName})</span>
                                    <span>🏆 Hendaya Kudos</span>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Modal: Enviar Kudo */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">✨</span>
                                <h3 className="font-black text-base text-slate-900">Enviar Reconocimiento (Kudo)</h3>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
                        </div>

                        <form onSubmit={handleSendKudo} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">¿A quién deseas reconocer? *</label>
                                <select
                                    required
                                    value={toUsername}
                                    onChange={e => setToUsername(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
                                >
                                    <option value="">Selecciona un compañero...</option>
                                    {users.filter(u => u.username !== currentUsername).map(u => (
                                        <option key={u.username} value={u.username}>{u.name} (@{u.username}) {u.role ? `• ${u.role}` : ''}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">Categoría del Reconocimiento *</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {CATEGORIES.map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => setCategory(c.id as any)}
                                            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 text-left transition-all ${
                                                category === c.id
                                                    ? 'border-amber-500 bg-amber-50 text-amber-900 ring-1 ring-amber-400 shadow-xs'
                                                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <span className="text-base">{c.icon}</span>
                                            <span className="truncate">{c.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Mensaje de Felicitación *</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="Ej: Excelente gestión en la entrega del informe PAE..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!toUsername || !message.trim() || sending}
                                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-black shadow-md shadow-amber-500/20"
                                >
                                    {sending ? 'Enviando...' : 'Publicar Kudo 🎉'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
