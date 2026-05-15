'use client'

import { useState, useEffect } from 'react'
import { getDetalleFolioParaCalculo, saveCalculo } from './actions'
import { testFormula } from '@/app/dashboard/mantenedor/multas/aspectos-ee/actions'

interface CalculoModalProps {
    folio: string
    isOpen: boolean
    onClose: () => void
    onCalculated: () => void
}

export default function CalculoModal({ folio, isOpen, onClose, onCalculated }: CalculoModalProps) {
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>(null)
    const [detalles, setDetalles] = useState<any[]>([])
    const [hasPmpa, setHasPmpa] = useState(true)
    const [keywordsNeeded, setKeywordsNeeded] = useState<string[]>([])
    const [customValues, setCustomValues] = useState<Record<string, string>>({})
    const [calculating, setCalculating] = useState(false)
    const [error, setError] = useState('')
    const [result, setResult] = useState<{ total: number, detallesCalculados: any[] } | null>(null)

    useEffect(() => {
        if (isOpen && folio) {
            fetchData()
        }
    }, [isOpen, folio])

    const fetchData = async () => {
        setLoading(true)
        setError('')
        setResult(null)
        const res = await getDetalleFolioParaCalculo(folio)
        if (res.error) {
            setError(res.error)
        } else {
            setData({
                ...res.data,
                utmValue: res.utmValue,
                utmPeriod: res.utmPeriod,
                racionesValue: res.racionesValue
            })
            setDetalles(res.detalles || [])
            setHasPmpa(res.hasPmpa || false)
            setKeywordsNeeded(res.keywordsNeeded || [])
        }
        setLoading(false)
    }

    const handleCalculate = async () => {
        setCalculating(true)
        setError('')

        // Validate missing inputs
        for (const k of keywordsNeeded) {
            if (!customValues[k]) {
                setError(`Falta ingresar el valor para: ${k}`)
                setCalculating(false)
                return
            }
        }

        if (!hasPmpa) {
            setError('No se puede calcular porque falta la información del PMPA para este folio.')
            setCalculating(false)
            return
        }

        let totalMonto = 0
        const detallesCalc: any[] = []

        try {
            for (const d of detalles) {
                if (d.incompleto) continue // Ignore incomplete aspects from calculation sum, but warn

                if (!d.formulaAsignada) {
                    setError(`El aspecto ${d.letraAspecto || ''} no tiene una fórmula asignada en el mantenedor.`)
                    setCalculating(false)
                    return
                }

                const testRes = await testFormula(folio, d.formulaAsignada, {
                    materiaPrima: Number(customValues['MATERIAPRIMA'] || 0),
                    instrumento: Number(customValues['INSTRUMENTO'] || 0),
                    manipuladora: Number(customValues['MANIPULADORA'] || 0),
                    nivelControlado: Number(customValues['NIVELCONTROLADO'] || 0),
                    cantServicio: Number(customValues['CANTSERVICIO'] || 0),
                    elementos: Number(customValues['ELEMENTOS'] || 0)
                })

                if (testRes.error) {
                    setError(`Error en la fórmula del aspecto ${d.letraAspecto}: ${testRes.error}`)
                    setCalculating(false)
                    return
                }

                totalMonto += testRes.data?.resultado || 0

                detallesCalc.push({
                    letraAspecto: d.letraAspecto,
                    descripcion: d.observacionesOMedioDeVerificacion,
                    formulaAplicada: testRes.data?.formulaEvaluada,
                    montoMulta: testRes.data?.resultado || 0,
                    variablesUsadas: customValues
                })
            }

            setResult({ total: totalMonto, detallesCalculados: detallesCalc })
            
            // Save to DB
            const incompletoWarning = detalles.some(d => d.incompleto)
            const estado = incompletoWarning ? 'INCOMPLETO_POR_DATOS' : 'COMPLETO'

            const saveRes = await saveCalculo(
                folio, 
                data.rbd, 
                data.fechaSupervision, 
                data.licitacion || '', 
                totalMonto, 
                estado, 
                detallesCalc
            )

            if (saveRes.error) {
                setError(saveRes.error)
            } else {
                onCalculated() // Refresh parent list
            }

        } catch (e) {
            setError('Error inesperado durante el cálculo.')
        }

        setCalculating(false)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-4xl shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                >
                    ✕
                </button>

                <h3 className="text-xl font-bold text-gray-900 mb-6 tracking-tight flex items-center gap-2">
                    <span>🧮</span> Cálculo de Multas: Folio {folio}
                </h3>

                {loading ? (
                    <div className="py-12 text-center text-gray-500">Cargando información del folio...</div>
                ) : error ? (
                    <div className="p-4 bg-red-50 text-red-600 rounded-xl mb-4 text-sm font-medium border border-red-100">{error}</div>
                ) : (
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                        
                        {/* Información General */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Información Establecimiento</p>
                                <div className="space-y-1 text-sm text-gray-700">
                                    <p><span className="font-semibold">Licitación:</span> {data?.licitacion}</p>
                                    <p><span className="font-semibold">RBD:</span> {data?.rbd}</p>
                                    <p><span className="font-semibold">Comuna:</span> {data?.comuna}</p>
                                    <p><span className="font-semibold">Servicio:</span> {data?.servicio}</p>
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tiempos</p>
                                <div className="space-y-1 text-sm text-gray-700">
                                    <p><span className="font-semibold">Fecha:</span> {data?.fechaSupervision ? new Date(data.fechaSupervision).toLocaleDateString() : '-'}</p>
                                    <p><span className="font-semibold">Hora Inicio:</span> {data?.horaInicio}</p>
                                    <p><span className="font-semibold">Hora Término:</span> {data?.hora}</p>
                                </div>
                            </div>
                        </div>

                        {!hasPmpa && (
                            <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-bold flex items-center gap-2">
                                <span>⚠️</span> No se encontró información del PMPA para este RBD y Periodo. El cálculo no se puede realizar.
                            </div>
                        )}

                        {/* Variables requeridas */}
                        {keywordsNeeded.length > 0 && (
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-3">Información Adicional Requerida por las Fórmulas</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {keywordsNeeded.map(k => (
                                        <div key={k}>
                                            <label className="block text-xs font-bold text-amber-800 mb-1">{k}</label>
                                            <input
                                                type="number"
                                                className="w-full px-3 py-2 rounded-lg border border-amber-200 focus:ring-2 focus:ring-amber-500 bg-white"
                                                placeholder={`Ingrese valor para ${k}`}
                                                value={customValues[k] || ''}
                                                onChange={e => setCustomValues(prev => ({ ...prev, [k]: e.target.value }))}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Detalles de Aspectos */}
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Aspectos a Evaluar (NC = X)</p>
                            <div className="space-y-3">
                                {detalles.map(d => (
                                    <div key={d.id} className={`p-4 rounded-2xl border ${d.incompleto ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-200'} shadow-sm`}>
                                        <div className="flex gap-4">
                                            <div className="w-12 h-12 shrink-0 bg-cyan-50 rounded-xl flex items-center justify-center font-black text-cyan-700 text-xl border border-cyan-100">
                                                {d.letraAspecto || '?'}
                                            </div>
                                            <div className="flex-1">
                                                {d.incompleto && (
                                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-orange-200 text-orange-800 mb-2">
                                                        ⚠️ INCOMPLETO: No tiene X en CO, NC o NA
                                                    </span>
                                                )}
                                                <p className="text-sm text-gray-800 font-medium leading-relaxed">{d.aspecto}</p>
                                                <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg italic">
                                                    <span className="font-bold">Observación:</span> {d.observacionesOMedioDeVerificacion || 'Sin observaciones'}
                                                </p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <div className="text-xs font-mono text-cyan-700 bg-cyan-50 px-2 py-1 rounded w-fit border border-cyan-100">
                                                        Fórmula: {d.formulaAsignada || 'NO ASIGNADA'}
                                                    </div>
                                                    {d.formulaAsignada && (
                                                        <div className="text-[10px] font-bold text-amber-800 bg-amber-100/50 px-2 py-1 rounded border border-amber-200 flex gap-3">
                                                            <span>💰 UTM: ${data?.utmValue?.toLocaleString()} <span className="font-normal opacity-70">({data?.utmPeriod})</span></span>
                                                            <span>📊 RACIONES: {data?.racionesValue?.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {detalles.length === 0 && (
                                    <p className="text-sm text-gray-500 italic text-center py-4">No hay aspectos con NC = X.</p>
                                )}
                            </div>
                        </div>

                    </div>
                )}

                {/* Footer / Actions */}
                <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-left w-full sm:w-auto">
                        {result && (
                            <div className="animate-in slide-in-from-bottom-2">
                                <span className="text-xs font-bold text-gray-400 uppercase">Total Multa Calculada</span>
                                <p className="text-3xl font-black text-emerald-600">${result.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => window.open(data?.link || '', '_blank')}
                            className="px-5 py-2.5 w-full sm:w-auto rounded-xl text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-100 font-bold transition-colors"
                        >
                            Ver PDF Original
                        </button>
                        <button
                            type="button"
                            onClick={handleCalculate}
                            disabled={calculating || !hasPmpa || detalles.length === 0}
                            className="px-6 py-2.5 w-full sm:w-auto rounded-xl text-white bg-gray-900 hover:bg-black shadow-md font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {calculating ? 'Calculando...' : 'Calcular Multa'}
                        </button>
                    </div>
                </div>

            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
            `}</style>
        </div>
    )
}
