'use client'

import { useState, useEffect } from 'react'
import { saveMatrizConfig, getMatrizConfig } from './actions'
import { SECCIONES, PREGUNTAS, GRAVEDAD_OPCIONES, PROBABILIDAD_OPCIONES, RIESGO_OPCIONES } from './questions'

export default function EvaluacionDetalleForm({ user }: { user: any }) {
    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    
    // Form State: { preguntaId: { gravedad: number, probabilidad: number, nivelRiesgo: string } }
    const [responses, setResponses] = useState<Record<string, any>>({})

    // Load existing config
    useEffect(() => {
        async function loadConfig() {
            const res = await getMatrizConfig()
            if (res.success && res.config) {
                const configMap: Record<string, any> = {}
                res.config.forEach((item: any) => {
                    configMap[item.preguntaId] = {
                        gravedad: item.gravedad,
                        probabilidad: item.probabilidad,
                        nivelRiesgo: item.nivelRiesgo
                    }
                })
                setResponses(configMap)
            }
            setInitialLoading(false)
        }
        loadConfig()
    }, [])

    const handleResponseChange = (preguntaId: string, field: string, value: any) => {
        setResponses(prev => ({
            ...prev,
            [preguntaId]: {
                ...(prev[preguntaId] || { gravedad: 0, probabilidad: 0, nivelRiesgo: '' }),
                [field]: value
            }
        }))
    }

    const handleSubmit = async () => {
        const itemsToSave = PREGUNTAS.map(p => ({
            preguntaId: p.id,
            seccion: p.seccion,
            gravedad: responses[p.id]?.gravedad || 1, // Default to 1 if not set
            probabilidad: responses[p.id]?.probabilidad || 1,
            nivelRiesgo: responses[p.id]?.nivelRiesgo || RIESGO_OPCIONES[0].value
        }))

        setLoading(true)
        const result = await saveMatrizConfig(itemsToSave)
        setLoading(false)

        if (result.success) {
            setMessage({ type: 'success', text: 'Configuración general de riesgos guardada correctamente' })
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al guardar' })
        }
    }

    if (initialLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                <span className="w-12 h-12 border-4 border-cyan-100 border-t-cyan-500 rounded-full animate-spin"></span>
                <p className="mt-4 text-gray-500 font-medium">Cargando configuración...</p>
            </div>
        )
    }

    return (
        <div className="space-y-8 pb-12">
            {message && (
                <div className={`p-4 rounded-2xl font-bold animate-in fade-in slide-in-from-top-4 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                    {message.text}
                </div>
            )}

            <div className="flex justify-end sticky top-4 z-10">
                <button 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold shadow-2xl hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center gap-3 border border-slate-700"
                >
                    {loading ? (
                        <>
                            <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                            Guardando...
                        </>
                    ) : (
                        <>
                            <span>💾</span> Guardar Cambios Detallados
                        </>
                    )}
                </button>
            </div>

            {SECCIONES.map((seccion) => (
                <div key={seccion.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className={`${seccion.color} ${seccion.textColor} px-8 py-5 flex items-center justify-between`}>
                        <h3 className="text-xl font-black uppercase tracking-tight">{seccion.nombre}</h3>
                    </div>
                    <div className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-normal min-w-[800px]">
                                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-gray-100">
                                    <tr>
                                        <th className="px-8 py-4 w-1/2">Pregunta de la Matriz</th>
                                        <th className="px-4 py-4 w-1/6 text-center">Gravedad</th>
                                        <th className="px-4 py-4 w-1/6 text-center">Probabilidad</th>
                                        <th className="px-8 py-4 w-1/6 text-right">Nivel de Riesgo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {PREGUNTAS.filter(p => p.seccion === seccion.id).map((p) => {
                                        const currentRiesgo = RIESGO_OPCIONES.find(opt => opt.value === responses[p.id]?.nivelRiesgo)
                                        const bgColor = currentRiesgo ? currentRiesgo.color.split(' ')[0] : 'hover:bg-slate-50'
                                        
                                        return (
                                            <tr key={p.id} className={`${bgColor} transition-colors`}>
                                                <td className="px-8 py-6 font-medium text-slate-700 leading-relaxed">{p.text}</td>
                                                <td className="px-4 py-6">
                                                    <select 
                                                        className="w-full p-2 border border-blue-100 rounded-xl bg-white/80 text-black font-semibold focus:ring-2 focus:ring-cyan-500 outline-none text-center"
                                                        value={responses[p.id]?.gravedad || 0}
                                                        onChange={(e) => handleResponseChange(p.id, 'gravedad', parseInt(e.target.value))}
                                                    >
                                                        <option value={0}>-</option>
                                                        {GRAVEDAD_OPCIONES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-6">
                                                    <select 
                                                        className="w-full p-2 border border-blue-100 rounded-xl bg-white/80 text-black font-semibold focus:ring-2 focus:ring-cyan-500 outline-none text-center"
                                                        value={responses[p.id]?.probabilidad || 0}
                                                        onChange={(e) => handleResponseChange(p.id, 'probabilidad', parseInt(e.target.value))}
                                                    >
                                                        <option value={0}>-</option>
                                                        {PROBABILIDAD_OPCIONES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <select 
                                                        className={`w-full p-2 border border-gray-100 rounded-xl bg-white/80 text-black font-medium focus:ring-2 focus:ring-cyan-500 outline-none text-[12px]`}
                                                        value={responses[p.id]?.nivelRiesgo || ''}
                                                        onChange={(e) => handleResponseChange(p.id, 'nivelRiesgo', e.target.value)}
                                                    >
                                                        <option value="">Seleccione Riesgo...</option>
                                                        {RIESGO_OPCIONES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    </select>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ))}

            <div className="flex justify-end pt-4">
                <button 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center gap-3"
                >
                    {loading ? (
                        <>
                            <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                            Guardando...
                        </>
                    ) : (
                        <>
                            <span>💾</span> Guardar Configuración de Riesgos
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
