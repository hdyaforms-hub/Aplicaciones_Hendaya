'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const router = useRouter()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    // Nuevos estados para el cambio de clave
    const [requirePasswordChange, setRequirePasswordChange] = useState(false)
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), password }),
                credentials: 'same-origin',
            })

            console.log('[Login] Response status:', res.status)
            console.log('[Login] Response ok:', res.ok)

            if (res.status === 202) {
                const data = await res.json()
                if (data.mustChangePassword) {
                    setRequirePasswordChange(true)
                    setError('')
                }
            } else if (res.ok) {
                console.log('[Login] Login exitoso, redirigiendo a /dashboard...')
                window.location.href = '/dashboard'
            } else {
                const data = await res.json()
                console.log('[Login] Error:', data)
                setError(data.message || 'Error al iniciar sesión')
            }
        } catch (err: any) {
            console.error('[Login] Error de red:', err)
            setError('Error de conexión: ' + (err?.message || 'desconocido'))
        } finally {
            setLoading(false)
        }
    }

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden')
            return
        }

        setLoading(true)

        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, currentPassword: password, newPassword }),
            })

            if (res.ok) {
                window.location.href = '/dashboard'
            } else {
                const data = await res.json()
                setError(data.message || 'Error al cambiar la contraseña')
            }
        } catch (err) {
            setError('Error de conexión o fallo interno del servidor')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-sky-950 to-black flex items-center justify-center p-4">
            {/* Círculos de fondo decorativos */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-sky-500/20 rounded-full blur-[120px]" />
            </div>

            <div className="relative w-full max-w-md z-10 backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
                <div className="text-center mb-10">
                    <div className="mb-8">
                        <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-400 inline-block drop-shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                            HENDAYA
                        </h1>
                    </div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight">
                        Bienvenido de nuevo
                    </h2>
                    <p className="mt-2 text-sm text-gray-300">
                        Ingresa tus credenciales para acceder al portal
                    </p>
                </div>

                {!requirePasswordChange ? (
                    <form onSubmit={handleLogin} className="space-y-6" translate="no" lang="es">
                        {error && (
                            <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/50 text-red-100 text-sm animate-pulse">
                                {error}
                            </div>
                        )}

                        <div>
                            <label
                                htmlFor="username"
                                className="block text-sm font-medium text-gray-200 mb-2"
                            >
                                Usuario
                            </label>
                            <input
                                id="username"
                                type="text"
                                required
                                autoComplete="username"
                                className="w-full px-5 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                                placeholder="Ej: laviles"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-200 mb-2"
                            >
                                Contraseña
                            </label>
                            <input
                                id="password"
                                type="password"
                                required
                                autoComplete="current-password"
                                className="w-full px-5 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <button
                            id="btn-login-submit"
                            type="submit"
                            disabled={loading}
                            onClick={(e) => {
                                if (e.currentTarget.form) {
                                    // fallback explícito en caso de conflicto con extensiones del navegador
                                }
                            }}
                            className={`w-full py-3 px-4 rounded-xl text-white font-medium text-lg bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900 shadow-lg shadow-cyan-500/30 transform transition-all duration-200 ${loading ? 'opacity-75 cursor-not-allowed scale-95' : 'hover:scale-[1.02] active:scale-95'
                                }`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Ingresando...
                                </span>
                            ) : (
                                'Iniciar Sesión'
                            )}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleChangePassword} className="space-y-6">
                        {error && (
                            <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/50 text-red-100 text-sm animate-pulse">
                                {error}
                            </div>
                        )}
                        <div className="text-center mb-6">
                            <p className="text-sm text-sky-200 font-medium">Por razones de seguridad, debes cambiar tu contraseña por defecto para poder ingresar.</p>
                        </div>
                        
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-200 mb-2">
                                Nueva Contraseña
                            </label>
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                className="w-full px-5 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 pr-12"
                                placeholder="Escribe tu nueva clave"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <button 
                                type="button" 
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-11 text-gray-400 hover:text-white transition-colors"
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-200 mb-2">
                                Confirmar Contraseña
                            </label>
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                className="w-full px-5 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                                placeholder="Repite tu nueva clave"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 px-4 rounded-xl text-white font-medium text-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900 shadow-lg shadow-emerald-500/30 transform transition-all duration-200 ${loading ? 'opacity-75 cursor-not-allowed scale-95' : 'hover:scale-[1.02] active:scale-95'}`}
                        >
                            {loading ? 'Actualizando...' : 'Cambiar Contraseña e Ingresar'}
                        </button>
                        
                        <div className="text-center mt-4">
                           <button type="button" onClick={() => { setRequirePasswordChange(false); setPassword(''); }} className="text-sm text-gray-400 hover:text-white underline">
                               Volver al inicio de sesión
                           </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
