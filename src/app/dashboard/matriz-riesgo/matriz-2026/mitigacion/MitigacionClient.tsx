'use client'

import { useState, useMemo } from 'react'
import { format, addDays, isAfter, isBefore, differenceInDays } from 'date-fns'
import { SECCIONES, PREGUNTAS, RIESGO_OPCIONES } from '../evaluacion-detallada/questions'
import { FIELD_MAPPING, PROBLEM_VALUES } from './mapping'
import { saveMitigacionAction } from './actions'
import { useRouter } from 'next/navigation'
import MitigacionFileUploader from './MitigacionFileUploader'

export default function MitigacionClient({ 
    initialMatrices, 
    riskConfigs, 
    initialMitigaciones,
    cutoffDate 
}: { 
    initialMatrices: any[], 
    riskConfigs: any[], 
    initialMitigaciones: any[],
    cutoffDate: Date | string
}) {
    const [matrices] = useState(initialMatrices)
    const [mitigaciones, setMitigaciones] = useState(initialMitigaciones)
    const [semestre, setSemestre] = useState<1 | 2>(1)
    const [selectedMatrizId, setSelectedMatrizId] = useState<string | null>(null)
    const [saving, setSaving] = useState<string | null>(null)
    const router = useRouter()

    const cutoff = new Date(cutoffDate)

    const filteredMatrices = useMemo(() => {
        return matrices.filter(m => {
            const evalDate = new Date(m.createdAt)
            if (semestre === 1) return isBefore(evalDate, cutoff) || evalDate.getTime() === cutoff.getTime()
            return isAfter(evalDate, cutoff)
        })
    }, [matrices, semestre, cutoff])

    const getProblems = (matriz: any) => {
        const problems: any[] = []
        PREGUNTAS.forEach(p => {
            const fieldName = FIELD_MAPPING[p.id]
            const responseValue = matriz[fieldName]
            if (PROBLEM_VALUES.includes(responseValue)) {
                const config = riskConfigs.find(c => c.preguntaId === p.id)
                const mitigacion = mitigaciones.find(m => m.matrizId === matriz.id && m.preguntaId === p.id)
                
                // Extraer días del nivel de riesgo
                let days = 90
                if (config?.nivelRiesgo.includes('30')) days = 30
                else if (config?.nivelRiesgo.includes('60')) days = 60

                const deadline = addDays(new Date(matriz.createdAt), days)

                problems.push({
                    ...p,
                    response: responseValue,
                    nivelRiesgo: config?.nivelRiesgo || 'No configurado',
                    deadline,
                    mitigacion: mitigacion || null
                })
            }
        })
        return problems
    }

    const handleSave = async (matrizId: string, preguntaId: string, fechaSolucion: string, adjuntos?: string[]) => {
        const key = `${matrizId}-${preguntaId}`
        setSaving(key)
        const res = await saveMitigacionAction({
            matrizId,
            preguntaId,
            fechaSolucion,
            adjuntos
        })
        setSaving(null)
        if (res.success) {
            router.refresh()
            // Update local state is more complex, better to refresh or re-fetch
        } else {
            alert(res.error)
        }
    }

    const selectedMatriz = matrices.find(m => m.id === selectedMatrizId)
    const problemList = selectedMatriz ? getProblems(selectedMatriz) : []

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sidebar de Evaluaciones */}
            <div className="lg:col-span-4 space-y-4">
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex p-1 bg-slate-100 rounded-2xl">
                        <button 
                            onClick={() => setSemestre(1)}
                            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${semestre === 1 ? 'bg-white shadow-sm text-cyan-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            1er Semestre
                        </button>
                        <button 
                            onClick={() => setSemestre(2)}
                            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${semestre === 2 ? 'bg-white shadow-sm text-cyan-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            2do Semestre
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-gray-100">
                        <h3 className="font-bold text-slate-700 text-sm">Evaluaciones Matriz 2026</h3>
                    </div>
                    <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                        {filteredMatrices.map(m => {
                            const problems = getProblems(m)
                            const solved = problems.filter(p => p.mitigacion?.fechaSolucion).length
                            const pct = problems.length > 0 ? Math.round((solved / problems.length) * 100) : 100
                            
                            return (
                                <div 
                                    key={m.id} 
                                    onClick={() => setSelectedMatrizId(m.id)}
                                    className={`p-4 cursor-pointer transition-all hover:bg-slate-50 ${selectedMatrizId === m.id ? 'bg-cyan-50 border-l-4 border-cyan-500' : ''}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-black text-slate-900 text-sm">RBD: {m.rbd}</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{format(new Date(m.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                                        </div>
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-black ${pct === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {pct}% Avance
                                        </div>
                                    </div>
                                    <div className="mt-2 text-[11px] text-slate-600 font-bold grid grid-cols-2 gap-2">
                                        <div className="flex items-center gap-1">
                                            <span className="text-orange-500">⚠️</span> {problems.length} Hallazgos
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-emerald-500">✅</span> {solved} Soluciones
                                        </div>
                                    </div>
                                    <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div className={`h-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }}></div>
                                    </div>
                                </div>
                            )
                        })}
                        {filteredMatrices.length === 0 && (
                            <div className="p-8 text-center text-slate-400 text-sm font-medium">
                                No hay evaluaciones en este periodo.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Panel de Detalle de Mitigación */}
            <div className="lg:col-span-8">
                {selectedMatriz ? (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-black text-slate-900">Hallazgos y Mitigación</h2>
                            <p className="text-sm text-slate-500 font-medium mt-1">RBD {selectedMatriz.rbd} - {format(new Date(selectedMatriz.createdAt), 'dd MMMM yyyy')}</p>
                        </div>

                        <div className="space-y-4">
                            {problemList.map((p, idx) => {
                                const section = SECCIONES.find(s => s.id === p.seccion)
                                const remaining = differenceInDays(p.deadline, new Date())
                                const isExpired = remaining < 0 && !p.mitigacion?.fechaSolucion
                                
                                return (
                                    <div key={p.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                                        <div className={`px-6 py-3 flex justify-between items-center ${section?.color || 'bg-slate-50'} bg-opacity-10`}>
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${section?.textColor || 'text-slate-500'}`}>
                                                {section?.nombre}
                                            </span>
                                            <div className="flex gap-2">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${p.nivelRiesgo.includes('Bajo') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : p.nivelRiesgo.includes('Medio') ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                    {p.nivelRiesgo}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-6">
                                            <p className="text-slate-800 font-bold text-sm leading-relaxed">{p.text}</p>
                                            <div className="mt-1 p-2 bg-slate-50 rounded-xl text-xs text-slate-500 border border-slate-100 italic">
                                                Respuesta: <span className="font-bold text-slate-700">{p.response}</span>
                                            </div>

                                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                                                {/* Plazos */}
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2">Seguimiento de Plazos</p>
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                                            <span className="text-xs font-bold text-slate-600">Fecha Tope</span>
                                                            <span className="text-xs font-black text-slate-900">{format(p.deadline, 'dd/MM/yyyy')}</span>
                                                        </div>
                                                        <div className={`flex justify-between items-center p-3 rounded-2xl border ${isExpired ? 'bg-red-50 border-red-100 text-red-700' : 'bg-cyan-50 border-cyan-100 text-cyan-700'}`}>
                                                            <span className="text-xs font-bold">Estado</span>
                                                            <span className="text-xs font-black">
                                                                {p.mitigacion?.fechaSolucion ? 'RESUELTO' : isExpired ? `VENCIDO (${Math.abs(remaining)} días)` : `PENDIENTE (${remaining} días rest.)`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Acciones */}
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2">Completar Solución</p>
                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 ml-1">FECHA DE SOLUCIÓN</label>
                                                            <input 
                                                                type="date"
                                                                defaultValue={p.mitigacion?.fechaSolucion ? format(new Date(p.mitigacion.fechaSolucion), 'yyyy-MM-dd') : ''}
                                                                onBlur={(e) => handleSave(selectedMatriz.id, p.id, e.target.value)}
                                                                className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-cyan-500 outline-none"
                                                            />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold text-slate-500 ml-1 mb-2">EVIDENCIAS (MÁX. 4)</p>
                                                            <MitigacionFileUploader 
                                                                initialFiles={p.mitigacion?.adjuntos ? JSON.parse(p.mitigacion.adjuntos) : []}
                                                                onUpload={(paths) => handleSave(selectedMatriz.id, p.id, p.mitigacion?.fechaSolucion ? format(new Date(p.mitigacion.fechaSolucion), 'yyyy-MM-dd') : '', paths)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            {problemList.length === 0 && (
                                <div className="bg-emerald-50 border border-emerald-100 p-12 rounded-3xl text-center">
                                    <div className="text-5xl mb-4">✅</div>
                                    <h3 className="text-emerald-800 font-black text-xl">¡Sin Hallazgos Pendientes!</h3>
                                    <p className="text-emerald-600 mt-2 font-medium">Esta evaluación cumple con todos los puntos críticos del semestre.</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white p-20 rounded-[40px] shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                        <div className="w-24 h-24 bg-slate-50 rounded-[35px] flex items-center justify-center text-4xl mb-6 border border-slate-100 animate-pulse">
                            🔍
                        </div>
                        <h3 className="text-2xl font-black text-slate-900">Seleccione una Evaluación</h3>
                        <p className="text-slate-500 mt-3 max-w-sm text-lg font-medium">Elija un colegio del listado izquierdo para gestionar sus hallazgos de mitigación.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
