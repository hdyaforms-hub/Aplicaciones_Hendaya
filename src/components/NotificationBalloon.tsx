'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
    getUserCollabNotifications,
    markNotificationAsRead,
    CollabNotificationItem
} from '@/app/dashboard/notifications-actions'

export default function NotificationBalloon() {
    const router = useRouter()
    const [notifications, setNotifications] = useState<CollabNotificationItem[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [latestAlert, setLatestAlert] = useState<CollabNotificationItem | null>(null)
    const [showPopupBalloon, setShowPopupBalloon] = useState(false)
    const [showSummaryModal, setShowSummaryModal] = useState(false)
    const [selectedNotification, setSelectedNotification] = useState<CollabNotificationItem | null>(null)
    const [activeFilter, setActiveFilter] = useState<'ALL' | 'MESSAGE' | 'TASK' | 'APPOINTMENT'>('ALL')
    const lastSeenNotificationId = useRef<string | null>(null)

    // Reproducir sonido sutil de notificación con Web Audio API (sin dependencias externas)
    const playChime = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext
            if (!AudioContext) return
            const ctx = new AudioContext()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()

            osc.type = 'sine'
            osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15) // A5

            gain.gain.setValueAtTime(0.08, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)

            osc.connect(gain)
            gain.connect(ctx.destination)

            osc.start()
            osc.stop(ctx.currentTime + 0.3)
        } catch {}
    }

    const checkNotifications = async () => {
        try {
            const res = await getUserCollabNotifications()
            setNotifications(res.notifications)
            setUnreadCount(res.unreadCount)

            // Detectar si hay una nueva notificación entrante
            if (res.notifications.length > 0) {
                const newest = res.notifications[0]
                if (lastSeenNotificationId.current && lastSeenNotificationId.current !== newest.id && !newest.isRead) {
                    setLatestAlert(newest)
                    setShowPopupBalloon(true)
                    playChime()
                } else if (!lastSeenNotificationId.current && !newest.isRead) {
                    // Primera carga si hay mensajes no leídos
                    setLatestAlert(newest)
                    setShowPopupBalloon(true)
                }
                lastSeenNotificationId.current = newest.id
            }
        } catch (e) {
            console.error('Error al chequear notificaciones:', e)
        }
    }

    // Polling ligero cada 12 segundos
    useEffect(() => {
        checkNotifications()
        const interval = setInterval(checkNotifications, 12000)
        return () => clearInterval(interval)
    }, [])

    const handleBalloonClick = () => {
        setShowPopupBalloon(false)
        if (latestAlert) {
            setSelectedNotification(latestAlert)
        }
        setShowSummaryModal(true)
    }

    const handleItemClick = async (notif: CollabNotificationItem) => {
        setSelectedNotification(notif)
        if (!notif.isRead) {
            await markNotificationAsRead(notif.id)
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n))
            setUnreadCount(prev => Math.max(0, prev - 1))
        }
    }

    const handleNavigate = (url: string) => {
        setShowSummaryModal(false)
        setShowPopupBalloon(false)
        router.push(url)
    }

    const filteredNotifications = notifications.filter(n => {
        if (activeFilter === 'ALL') return true
        return n.type === activeFilter
    })

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'MESSAGE': return '💬'
            case 'TASK': return '📋'
            case 'APPOINTMENT': return '📅'
            case 'PROJECT': return '🚀'
            default: return '🔔'
        }
    }

    return (
        <>
            {/* ========================================================================= */}
            {/* 1. GLOBO FLOTANTE DE ALERTA EN VIVO (TOAST BALLOON)                      */}
            {/* ========================================================================= */}
            {showPopupBalloon && latestAlert && (
                <div
                    onClick={handleBalloonClick}
                    className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900/95 text-white p-4 rounded-3xl shadow-2xl border border-cyan-500/50 backdrop-blur-md cursor-pointer hover:scale-105 transition-all duration-300 animate-in slide-in-from-bottom-5 fade-in group"
                >
                    <div className="flex items-start gap-3">
                        <div className="relative flex-shrink-0">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center text-xl shadow-md">
                                {getTypeIcon(latestAlert.type)}
                            </div>
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 border-2 border-slate-900 rounded-full animate-ping"></span>
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 border-2 border-slate-900 rounded-full"></span>
                        </div>

                        <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider">
                                    {latestAlert.type === 'MESSAGE' ? 'Nuevo Mensaje' : latestAlert.type === 'TASK' ? 'Nueva Tarea' : 'Nueva Cita'}
                                </span>
                                <span className="text-[9px] text-slate-400">• Hace un momento</span>
                            </div>
                            <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                                {latestAlert.title}
                            </h4>
                            <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 leading-snug">
                                {latestAlert.summary}
                            </p>
                        </div>

                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setShowPopupBalloon(false)
                            }}
                            className="text-slate-400 hover:text-white text-xs p-1"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-cyan-400 font-bold">
                        <span>Haz clic para ver el resumen</span>
                        <span>Abrir ➔</span>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 2. BOTÓN FLOTANTE O BADGE DE NOTIFICACIONES (SIEMPRE DISPONIBLE)          */}
            {/* ========================================================================= */}
            <button
                onClick={() => setShowSummaryModal(true)}
                className="fixed bottom-6 left-6 z-40 bg-white/90 hover:bg-white text-slate-700 hover:text-cyan-700 p-3 rounded-2xl shadow-lg border border-slate-200 backdrop-blur-sm transition-all hover:scale-110 flex items-center gap-2 group"
                title="Ver notificaciones y actividades"
            >
                <div className="relative">
                    <span className="text-xl">🔔</span>
                    {unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-2 px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full shadow-sm animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </div>
                <span className="text-xs font-bold hidden sm:inline-block pr-1">
                    {unreadCount > 0 ? `${unreadCount} nuevas` : 'Actividad'}
                </span>
            </button>

            {/* ========================================================================= */}
            {/* 3. VENTANA MODAL DE RESUMEN COMPLETO DE NOTIFICACIONES                    */}
            {/* ========================================================================= */}
            {showSummaryModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
                        {/* Cabecera del Resumen */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white font-bold flex items-center justify-center shadow-md">
                                    🔔
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900">
                                        Centro de Notificaciones & Actividades
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Mensajes cifrados, tareas asignadas y citas de calendario.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowSummaryModal(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Filtros */}
                        <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center gap-2 overflow-x-auto">
                            <button
                                onClick={() => setActiveFilter('ALL')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                                    activeFilter === 'ALL'
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Todas ({notifications.length})
                            </button>
                            <button
                                onClick={() => setActiveFilter('MESSAGE')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                                    activeFilter === 'MESSAGE'
                                        ? 'bg-cyan-600 text-white'
                                        : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                                }`}
                            >
                                💬 Mensajes ({notifications.filter(n => n.type === 'MESSAGE').length})
                            </button>
                            <button
                                onClick={() => setActiveFilter('TASK')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                                    activeFilter === 'TASK'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                }`}
                            >
                                📋 Tareas ({notifications.filter(n => n.type === 'TASK').length})
                            </button>
                            <button
                                onClick={() => setActiveFilter('APPOINTMENT')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                                    activeFilter === 'APPOINTMENT'
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                }`}
                            >
                                📅 Citas ({notifications.filter(n => n.type === 'APPOINTMENT').length})
                            </button>
                        </div>

                        {/* Lista de Notificaciones y Detalle */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-3">
                            {filteredNotifications.length === 0 ? (
                                <div className="text-center py-16 text-slate-400">
                                    <p className="text-4xl mb-2">🎉</p>
                                    <p className="text-sm font-bold text-slate-700">¡Estás al día!</p>
                                    <p className="text-xs mt-1">No hay alertas ni notificaciones pendientes en esta categoría.</p>
                                </div>
                            ) : (
                                filteredNotifications.map(notif => {
                                    const isSelected = selectedNotification?.id === notif.id

                                    return (
                                        <div
                                            key={notif.id}
                                            onClick={() => handleItemClick(notif)}
                                            className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                                                isSelected
                                                    ? 'bg-cyan-50/80 border-cyan-300 ring-2 ring-cyan-200'
                                                    : !notif.isRead
                                                    ? 'bg-white border-cyan-200 shadow-sm ring-1 ring-cyan-100'
                                                    : 'bg-slate-50/80 border-slate-200/80 opacity-90'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-xl p-2 bg-white rounded-xl shadow-2xs border border-slate-100">
                                                        {getTypeIcon(notif.type)}
                                                    </span>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-slate-900 text-xs">
                                                                {notif.title}
                                                            </h4>
                                                            {!notif.isRead && (
                                                                <span className="w-2 h-2 rounded-full bg-cyan-600"></span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-slate-400">
                                                            {new Date(notif.date).toLocaleDateString('es-CL')} a las {new Date(notif.date).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                                            {notif.senderUsername && ` • De: @${notif.senderUsername}`}
                                                        </p>
                                                    </div>
                                                </div>

                                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white border border-slate-200 text-slate-600">
                                                    {notif.type}
                                                </span>
                                            </div>

                                            {/* Resumen o Detalle expandido */}
                                            <div className="p-3 bg-white rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                                                {notif.detail || notif.summary}
                                            </div>

                                            {/* Botón de acción directa */}
                                            <div className="flex justify-end pt-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleNavigate(notif.url)
                                                    }}
                                                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                                                >
                                                    <span>Ir al Módulo</span>
                                                    <span>➔</span>
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Pie del modal */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
                            <button
                                onClick={() => handleNavigate('/dashboard/ayuda/conversacion')}
                                className="text-cyan-700 hover:text-cyan-900 text-xs font-bold flex items-center gap-1"
                            >
                                <span>💬 Abrir Espacio Colaborativo Completo</span>
                            </button>
                            <button
                                onClick={() => setShowSummaryModal(false)}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
