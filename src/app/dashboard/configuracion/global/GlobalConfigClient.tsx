'use client'

import { useState } from 'react'
import { updateGlobalConfigAction } from './actions'
import { GlobalConfigData } from '@/lib/global-config'

export default function GlobalConfigClient({ initialConfig }: { initialConfig: GlobalConfigData }) {
    const [timeoutMinutes, setTimeoutMinutes] = useState<number>(initialConfig.sessionTimeoutMin || 30)
    const [loading, setLoading] = useState(false)
    const [successMessage, setSuccessMessage] = useState('')
    const [errorMessage, setErrorMessage] = useState('')

    const presets = [
        { label: '15 min (Alta seguridad)', value: 15 },
        { label: '30 min (Recomendado)', value: 30 },
        { label: '60 min (1 hora)', value: 60 },
        { label: '120 min (2 horas)', value: 120 },
        { label: '240 min (4 horas)', value: 240 },
        { label: '480 min (8 horas)', value: 480 },
    ]

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setSuccessMessage('')
        setErrorMessage('')

        const formData = new FormData()
        formData.append('sessionTimeoutMin', timeoutMinutes.toString())

        const res = await updateGlobalConfigAction(formData)

        if (res?.error) {
            setErrorMessage(res.error)
        } else if (res?.success) {
            setSuccessMessage('Configuración global actualizada y aplicada exitosamente.')
            setTimeout(() => setSuccessMessage(''), 5000)
        }
        setLoading(false)
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Cabecera Principal */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-sky-500 text-white flex items-center justify-center text-xl shadow-md shadow-cyan-500/20">
                            ⚙️
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                Configuración Global
                            </h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Parámetros generales, políticas de seguridad y comportamiento del sistema.
                            </p>
                        </div>
                    </div>
                </div>

                {initialConfig.updatedAt && (
                    <div className="text-right text-[11px] text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
                        <span>Última modificación: </span>
                        <span className="font-semibold text-slate-600">
                            {new Date(initialConfig.updatedAt).toLocaleString()}
                        </span>
                        {initialConfig.updatedBy && (
                            <span className="text-slate-500"> por @{initialConfig.updatedBy}</span>
                        )}
                    </div>
                )}
            </div>

            {/* Mensajes de Feedback */}
            {successMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-3 shadow-sm animate-in slide-in-from-top-2">
                    <span className="text-lg">✅</span>
                    <span className="flex-1">{successMessage}</span>
                    <button 
                        onClick={() => setSuccessMessage('')}
                        className="text-emerald-600 hover:text-emerald-900 text-sm font-bold"
                    >
                        ✕
                    </button>
                </div>
            )}

            {errorMessage && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-3 shadow-sm animate-in slide-in-from-top-2">
                    <span className="text-lg">⚠️</span>
                    <span className="flex-1">{errorMessage}</span>
                    <button 
                        onClick={() => setErrorMessage('')}
                        className="text-rose-600 hover:text-rose-900 text-sm font-bold"
                    >
                        ✕
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* SECCIÓN: Sesión y Seguridad */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">⏱️</span>
                            <div>
                                <h2 className="text-base font-bold text-slate-900">
                                    Sesión y Cierre Automático por Inactividad
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Configura el tiempo máximo que un usuario puede permanecer sin interactuar antes de que su sesión expire automáticamente.
                                </p>
                            </div>
                        </div>
                        <span className="px-3 py-1 text-[11px] font-bold rounded-full bg-cyan-100/70 text-cyan-800 border border-cyan-200">
                            Seguridad
                        </span>
                    </div>

                    <div className="p-6 md:p-8 space-y-6">
                        <div className="max-w-xl space-y-4">
                            <label className="block text-xs font-bold text-slate-700">
                                Tiempo de duración de la sesión (en minutos) *
                            </label>

                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <input
                                        type="number"
                                        min={1}
                                        max={1440}
                                        required
                                        value={timeoutMinutes}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value, 10)
                                            setTimeoutMinutes(isNaN(val) ? 0 : val)
                                        }}
                                        className="w-full pl-4 pr-16 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50/50 focus:bg-white text-slate-900 font-extrabold text-base transition-all shadow-inner"
                                        placeholder="Ej: 30"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">
                                        minutos
                                    </span>
                                </div>

                                <div className="flex gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setTimeoutMinutes(prev => Math.max(1, prev - 5))}
                                        className="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-lg transition-colors"
                                        title="Restar 5 minutos"
                                    >
                                        -5
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTimeoutMinutes(prev => Math.min(1440, prev + 5))}
                                        className="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-lg transition-colors"
                                        title="Sumar 5 minutos"
                                    >
                                        +5
                                    </button>
                                </div>
                            </div>

                            {/* Presets Rápidos */}
                            <div className="pt-2">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    Valores predefinidos rápidos
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {presets.map(p => (
                                        <button
                                            key={p.value}
                                            type="button"
                                            onClick={() => setTimeoutMinutes(p.value)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                                timeoutMinutes === p.value
                                                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/30'
                                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                            }`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Caja informativa de funcionamiento */}
                        <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-5 text-xs text-sky-950 space-y-2">
                            <div className="font-bold flex items-center gap-2 text-sky-900 text-sm">
                                <span>ℹ️</span> ¿Cómo funciona el cierre automático de sesión?
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                                <li>
                                    El sistema detecta automáticamente la actividad en tiempo real (movimiento del mouse, pulsación de teclas, clics o toques táctiles).
                                </li>
                                <li>
                                    Al quedar <strong>60 segundos</strong> para que expire la sesión, se mostrará una ventana emergente de advertencia permitiéndole al usuario extender su tiempo.
                                </li>
                                <li>
                                    Si transcurren <strong>{timeoutMinutes || 0} minutos</strong> sin ninguna actividad, la sesión se cerrará de forma automática y segura, registrándose en el módulo de <strong>Auditoría</strong>.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* SECCIÓN EXTENSIBLE: Futuras Opciones Globales */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 opacity-80">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">🛠️</span>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">Parámetros Adicionales del Sistema</h3>
                                <p className="text-xs text-slate-400">Espacio preparado para la integración de futuras configuraciones corporativas.</p>
                            </div>
                        </div>
                        <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-100 text-slate-500">
                            Próximamente
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col justify-center items-center text-center py-6 text-slate-400">
                            <span className="text-2xl mb-1">🔔</span>
                            <span className="text-xs font-bold text-slate-600">Políticas de Alertas Globales</span>
                            <span className="text-[11px]">Configuración de intervalos de chequeo en segundo plano.</span>
                        </div>
                        <div className="p-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col justify-center items-center text-center py-6 text-slate-400">
                            <span className="text-2xl mb-1">📊</span>
                            <span className="text-xs font-bold text-slate-600">Límites y Retención de Auditoría</span>
                            <span className="text-[11px]">Periodo de almacenamiento y purga de logs del sistema.</span>
                        </div>
                    </div>
                </div>

                {/* Botonera de Acción Fija */}
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-3.5 rounded-2xl text-white bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 shadow-lg shadow-cyan-500/25 font-bold text-sm transition-all active:scale-98 disabled:opacity-70 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Guardando...</span>
                            </>
                        ) : (
                            <>
                                <span>💾</span>
                                <span>Guardar Configuración</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}
