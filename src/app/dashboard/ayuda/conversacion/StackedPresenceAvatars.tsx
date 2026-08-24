'use client'

import React, { useState, useEffect, useRef } from 'react'
import { updatePresenceHeartbeat, getRoomPresence } from './actions'

export interface PresenceUser {
    username: string
    fullName: string
    color: string
    lastSeen: string
}

export function usePresence(roomId: string, userColor: string = '#06b6d4') {
    const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([])

    useEffect(() => {
        if (!roomId) return

        // 1. Emitir heartbeat inicial y obtener usuarios
        const sendHeartbeat = async () => {
            await updatePresenceHeartbeat(roomId, userColor)
            const res = await getRoomPresence(roomId)
            if (res.success && res.activeUsers) {
                setActiveUsers(res.activeUsers)
            }
        }

        sendHeartbeat()

        // 2. Heartbeat periódico cada 12s
        const interval = setInterval(sendHeartbeat, 12000)
        return () => clearInterval(interval)
    }, [roomId, userColor])

    return { activeUsers }
}

interface StackedPresenceAvatarsProps {
    roomId: string
    maxVisible?: number
    className?: string
}

const GRADIENTS = [
    'from-cyan-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-purple-500 to-indigo-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-violet-500 to-purple-600',
    'from-sky-500 to-cyan-600',
    'from-teal-500 to-emerald-600',
    'from-fuchsia-500 to-pink-600'
]

function getUserGradient(username: string) {
    let hash = 0
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash)
    }
    const idx = Math.abs(hash) % GRADIENTS.length
    return GRADIENTS[idx]
}

export default function StackedPresenceAvatars({
    roomId,
    maxVisible = 4,
    className = ''
}: StackedPresenceAvatarsProps) {
    const { activeUsers } = usePresence(roomId)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Cerrar menú al hacer clic afuera
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    if (activeUsers.length === 0) return null

    const visibleUsers = activeUsers.slice(0, maxVisible)
    const hiddenCount = activeUsers.length - maxVisible

    return (
        <div className={`relative inline-block ${className}`} ref={containerRef}>
            {/* Botón de Presencia Interactivo */}
            <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2.5 py-1 px-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 shadow-sm transition-all cursor-pointer select-none group"
                title="Ver quiénes están en línea en esta sección"
            >
                {/* Avatares Apilados con Gradientes */}
                <div className="flex -space-x-2 items-center py-0.5">
                    {visibleUsers.map((user, idx) => (
                        <div
                            key={user.username + idx}
                            className={`w-7 h-7 rounded-full bg-gradient-to-tr ${getUserGradient(user.username)} text-white font-black text-[11px] flex items-center justify-center border-2 border-slate-900 shadow-sm ring-1 ring-white/20 transition-transform group-hover:scale-105`}
                            title={user.fullName || user.username}
                        >
                            {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                        </div>
                    ))}

                    {hiddenCount > 0 && (
                        <div className="w-7 h-7 rounded-full bg-slate-900 text-cyan-300 font-black text-[10px] flex items-center justify-center border-2 border-slate-800 shadow-sm ring-1 ring-cyan-500/40">
                            +{hiddenCount}
                        </div>
                    )}
                </div>

                {/* Texto de Estado y Flecha */}
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50"></span>
                    <span>{activeUsers.length} en vivo</span>
                    <span className="text-slate-400 text-[10px] group-hover:translate-y-0.5 transition-transform">▾</span>
                </div>
            </button>

            {/* Modal Desplegable con la Lista Detallada de Usuarios Conectados */}
            {isMenuOpen && (
                <div className="absolute right-0 mt-2.5 w-72 sm:w-80 bg-white rounded-3xl shadow-2xl border border-slate-200/90 z-[120] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {/* Cabecera del Popover */}
                    <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-md shadow-emerald-400/50"></span>
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-white">
                                    En Línea ({activeUsers.length})
                                </h4>
                                <p className="text-[10px] text-slate-400 font-normal">
                                    Conectados en tiempo real
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsMenuOpen(false)}
                            className="text-slate-400 hover:text-white text-xs p-1 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Lista de Usuarios Conectados */}
                    <div className="p-2 max-h-64 overflow-y-auto space-y-1 divide-y divide-slate-100">
                        {activeUsers.map((user) => (
                            <div
                                key={user.username}
                                className="pt-1.5 first:pt-0 flex items-center justify-between gap-3 p-2 rounded-2xl hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="relative flex-shrink-0">
                                        <div className={`w-9 h-9 rounded-2xl bg-gradient-to-tr ${getUserGradient(user.username)} text-white font-black text-xs flex items-center justify-center shadow-xs`}>
                                            {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></span>
                                    </div>

                                    <div className="min-w-0">
                                        <h5 className="font-bold text-slate-900 text-xs truncate">
                                            {user.fullName || user.username}
                                        </h5>
                                        <p className="text-[10px] font-bold text-cyan-600 truncate">
                                            @{user.username}
                                        </p>
                                    </div>
                                </div>

                                <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200/80 flex-shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Activo
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Pie del Popover */}
                    <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                        <span className="text-[10px] text-slate-400 font-medium">
                            La presencia se actualiza automáticamente cada 12s
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}
