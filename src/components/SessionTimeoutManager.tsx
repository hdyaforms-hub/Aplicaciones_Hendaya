'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

interface SessionTimeoutManagerProps {
    timeoutMinutes: number
}

export default function SessionTimeoutManager({ timeoutMinutes }: SessionTimeoutManagerProps) {
    const [showWarning, setShowWarning] = useState(false)
    const [secondsLeft, setSecondsLeft] = useState(60)

    const lastActivityRef = useRef<number>(Date.now())
    const isLoggingOutRef = useRef<boolean>(false)
    const warningThresholdMs = 60 * 1000 // 60 segundos antes del timeout
    const totalTimeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000

    // Función para renovar la actividad
    const resetActivity = useCallback(() => {
        lastActivityRef.current = Date.now()
        if (showWarning) {
            setShowWarning(false)
        }
    }, [showWarning])

    // Función de cierre de sesión
    const triggerLogout = useCallback(async () => {
        if (isLoggingOutRef.current) return
        isLoggingOutRef.current = true

        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: 'timeout' }),
            })
        } catch (err) {
            console.error('Error al ejecutar logout automático:', err)
        } finally {
            window.location.href = '/login?reason=timeout'
        }
    }, [])

    // Escuchar eventos de interacción del usuario
    useEffect(() => {
        const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'pointerdown']
        let throttleTimer: NodeJS.Timeout | null = null

        const handleUserActivity = () => {
            if (!throttleTimer) {
                throttleTimer = setTimeout(() => {
                    // Si la advertencia NO está en pantalla, actualizar timestamp
                    if (!showWarning) {
                        lastActivityRef.current = Date.now()
                    }
                    throttleTimer = null
                }, 1000)
            }
        }

        events.forEach(event => {
            window.addEventListener(event, handleUserActivity, { passive: true })
        })

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleUserActivity)
            })
            if (throttleTimer) clearTimeout(throttleTimer)
        }
    }, [showWarning])

    // Timer de verificación periódica
    useEffect(() => {
        const interval = setInterval(() => {
            if (isLoggingOutRef.current) return

            const now = Date.now()
            const elapsed = now - lastActivityRef.current
            const remaining = totalTimeoutMs - elapsed

            if (remaining <= 0) {
                // Tiempo agotado -> Cerrar sesión
                triggerLogout()
            } else if (remaining <= warningThresholdMs) {
                // Quedan menos de 60 segundos -> Mostrar advertencia
                setShowWarning(true)
                setSecondsLeft(Math.ceil(remaining / 1000))
            } else {
                if (showWarning) {
                    setShowWarning(false)
                }
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [totalTimeoutMs, triggerLogout, showWarning, warningThresholdMs])

    if (!showWarning) return null

    return (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-amber-200 text-center space-y-5 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-3xl mx-auto ring-8 ring-amber-50">
                    ⏱️
                </div>

                <div className="space-y-2">
                    <h3 className="text-xl font-black text-slate-900">
                        ¿Sigues ahí?
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Tu sesión está a punto de cerrarse por inactividad debido a las políticas de seguridad del sistema.
                    </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/70">
                    <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                        Cierre automático en
                    </div>
                    <div className="text-3xl font-black text-amber-600 font-mono tracking-tight">
                        {secondsLeft}s
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                        type="button"
                        onClick={triggerLogout}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors"
                    >
                        Cerrar Sesión
                    </button>
                    <button
                        type="button"
                        onClick={resetActivity}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all active:scale-95"
                    >
                        Mantener Sesión
                    </button>
                </div>
            </div>
        </div>
    )
}
