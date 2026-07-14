'use client'

import { useState, useEffect } from 'react'
import { getDetalleFolioParaCalculo, saveCalculo, guardarServicioManual } from './actions'
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
    const [pmpaNiveles, setPmpaNiveles] = useState<{ label: string, value: number }[]>([])
    const [customValues, setCustomValues] = useState<Record<string, string>>({})
    const [calculating, setCalculating] = useState(false)
    const [error, setError] = useState('')
    const [result, setResult] = useState<{ total: number, detallesCalculados: any[] } | null>(null)

    // Manual service states
    const [serviciosDisponibles, setServiciosDisponibles] = useState<any[]>([])
    const [selectedServicioManual, setSelectedServicioManual] = useState('')
    const [observacionManualServicio, setObservacionManualServicio] = useState('')
    const [guardandoServicioManual, setGuardandoServicioManual] = useState(false)

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
            setPmpaNiveles(res.pmpaNiveles || [])
            
            // Populate services lists
            setServiciosDisponibles(res.serviciosDisponibles || [])
            if (res.data?.esServicioManual) {
                const rawServManual = res.data?.servicioManual || ''
                const sMatch = rawServManual.match(/\(([A-Z])\)/)
                const code = sMatch ? sMatch[1] : ''
                setSelectedServicioManual(code)
                setObservacionManualServicio(res.data?.observacionManualServicio || '')
            } else {
                setSelectedServicioManual('')
                setObservacionManualServicio('')
            }
            
            // Pre-populate with saved variables if any
            const loadedValues = res.savedVariables ? { ...res.savedVariables } : {}
            
            // Backward compatibility: if NIVELCONTROLADO is stored as a number, map it back to the level label
            const rawNivel = loadedValues['NIVELCONTROLADO']
            if (rawNivel && !isNaN(Number(rawNivel))) {
                const racionesNum = Number(rawNivel)
                const matchingLevel = (res.pmpaNiveles || []).find(n => n.value === racionesNum)
                if (matchingLevel) {
                    loadedValues['NIVELCONTROLADO'] = matchingLevel.label
                }
            }
            
            // Apply defaults for numeric variables if they are needed but not present
            if (res.keywordsNeeded) {
                res.keywordsNeeded.forEach((k: string) => {
                    if (['CANTSERVICIO', 'MANIPULADORAAFECTADA', 'MANIPULADORA', 'INSTRUMENTO', 'ELEMENTOS'].includes(k)) {
                        if (!loadedValues[k] || loadedValues[k] === '0') {
                            loadedValues[k] = '1'
                        }
                    } else if (k === 'MATERIAPRIMA') {
                        if (!loadedValues[k]) {
                            loadedValues[k] = '1'
                        }
                    }
                })
            }
            
            setCustomValues(loadedValues)
        }
        setLoading(false)
    }

    const evaluateFormulaLocal = (formula: string, customVals: Record<string, string>) => {
        try {
            const cleanFormula = formula.toUpperCase()
            const utmVal = data?.utmValue || 0
            const totalRaciones = data?.racionesValue || 0
            
            // Get NIVELCONTROLADO raciones based on selection
            const selectedLevelLabel = customVals['NIVELCONTROLADO'] || ''
            const selectedLevelObj = pmpaNiveles.find(n => n.label === selectedLevelLabel)
            
            // If user has not selected a level yet, default to total raciones as fallback
            const nivelControladoVal = selectedLevelObj ? selectedLevelObj.value : totalRaciones
            
            const materiaPrimaVal = customVals['MATERIAPRIMA'] !== undefined && customVals['MATERIAPRIMA'] !== '' ? Number(customVals['MATERIAPRIMA']) : 1
            const instrumentoVal = Number(customVals['INSTRUMENTO'] || 1)
            const manipuladoraVal = Number(customVals['MANIPULADORA'] || 1)
            let manipuladoraAfectadaVal = Number(customVals['MANIPULADORAAFECTADA'] || 1)
            if (manipuladoraAfectadaVal === 0) manipuladoraAfectadaVal = 1;
            const cantServicioVal = Number(customVals['CANTSERVICIO'] || 1)
            const elementosVal = Number(customVals['ELEMENTOS'] || 1)

            let evalForm = cleanFormula
                .replace(/UTM/g, utmVal.toString())
                .replace(/RACIONES/g, totalRaciones.toString())
                .replace(/NIVELCONTROLADO/g, nivelControladoVal.toString())
                .replace(/MATERIAPRIMA/g, materiaPrimaVal.toString())
                .replace(/INSTRUMENTO/g, instrumentoVal.toString())
                .replace(/MANIPULADORAAFECTADA/g, manipuladoraAfectadaVal.toString())
                .replace(/MANIPULADORA/g, manipuladoraVal.toString())
                .replace(/CANTSERVICIO/g, cantServicioVal.toString())
                .replace(/ELEMENTOS/g, elementosVal.toString())

            const sanitized = evalForm.replace(/[^0-9+\-*/().]/g, '')
            const resultValue = new Function(`return ${sanitized}`)()
            return {
                formulaEvaluada: evalForm,
                resultado: Number(resultValue) || 0
            }
        } catch (e) {
            return { error: 'Error al evaluar' }
        }
    }

    const calculatePreview = () => {
        let totalMonto = 0
        const detallesCalc: any[] = []
        let hasError = false

        for (const d of detalles) {
            if (!d.formulaAsignada) continue

            const evalRes = evaluateFormulaLocal(d.formulaAsignada, customValues)
            if (evalRes.error) {
                hasError = true
                continue
            }

            totalMonto += evalRes.resultado || 0
            detallesCalc.push({
                letraAspecto: d.letraAspecto,
                descripcion: d.observacionesOMedioDeVerificacion,
                formulaAplicada: evalRes.formulaEvaluada,
                montoMulta: evalRes.resultado || 0,
                variablesUsadas: customValues
            })
        }

        if (!hasError) {
            setResult({ total: totalMonto, detallesCalculados: detallesCalc })
        }
    }

    useEffect(() => {
        if (data && detalles.length > 0) {
            calculatePreview()
        } else {
            setResult(null)
        }
    }, [customValues, detalles, data])

    const handleCalculate = async () => {
        setCalculating(true)
        setError('')

        if (!hasPmpa) {
            setError('No se puede guardar porque falta la información del PMPA para este folio.')
            setCalculating(false)
            return
        }

        if (!result) {
            setError('No hay un cálculo válido para guardar.')
            setCalculating(false)
            return
        }

        // Detect if any required variables are missing
        const missingKeywords = keywordsNeeded.filter(k => !customValues[k])
        const isAnyMissing = missingKeywords.length > 0

        try {
            // Save to DB (PENDIENTE if missing variables, CALCULADO if complete)
            const estado = isAnyMissing ? 'PENDIENTE' : 'CALCULADO'

            const saveRes = await saveCalculo(
                folio, 
                data.rbd, 
                data.fechaSupervision, 
                data.licitacion || '', 
                result.total, 
                estado, 
                result.detallesCalculados
            )

            if (saveRes.error) {
                setError(saveRes.error)
            } else {
                if (isAnyMissing) {
                    alert(`Cálculo guardado como PARCIAL. Quedaron variables pendientes: ${missingKeywords.join(', ')}. El estado del folio sigue siendo PENDIENTE.`)
                } else {
                    alert(`Cálculo guardado exitosamente como COMPLETADO.`)
                }
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
                                    <div className="space-y-2 mt-1">
                                        {data?.esServicioManual ? (
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5 text-xs text-gray-700">
                                                    <span className="font-semibold">Servicio:</span>
                                                    <span className="font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                                                        ✋ {data?.servicioManual} (Manual)
                                                    </span>
                                                </div>
                                                {data?.observacionManualServicio && (
                                                    <p className="text-[11px] text-gray-500 bg-indigo-50/30 p-2 rounded-lg border border-indigo-50 mt-1.5 leading-relaxed">
                                                        <span className="font-bold text-indigo-900 block mb-0.5 text-[9px] uppercase tracking-wider">Obs. Selección Manual:</span>
                                                        {data?.observacionManualServicio}
                                                    </p>
                                                )}
                                                
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setData((prev: any) => ({ ...prev, esServicioManual: false, servicio: '' }))
                                                    }}
                                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-black underline mt-1.5 block flex items-center gap-1 cursor-pointer"
                                                >
                                                    ✏️ Modificar Servicio Manual
                                                </button>
                                            </div>
                                        ) : data?.servicio ? (
                                            <p className="text-xs text-gray-700"><span className="font-semibold">Servicio:</span> {data?.servicio}</p>
                                        ) : (
                                            <div className="space-y-2.5 p-3.5 bg-amber-50/50 rounded-xl border border-amber-100 mt-2">
                                                <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-1">
                                                    ⚠️ Sin Servicio Asignado
                                                </p>
                                                <div className="space-y-1">
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">Seleccionar Servicio:</label>
                                                    <select
                                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-white text-xs font-bold text-gray-700"
                                                        value={selectedServicioManual}
                                                        onChange={e => setSelectedServicioManual(e.target.value)}
                                                    >
                                                        <option value="">-- Seleccionar servicio --</option>
                                                        {serviciosDisponibles.map(s => (
                                                            <option key={s.codigo} value={s.codigo}>
                                                                {s.nombre} ({s.codigo})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">Observación Explicativa:</label>
                                                    <textarea
                                                        rows={2}
                                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-white text-xs text-gray-700 font-medium leading-normal"
                                                        placeholder="Detalle por qué se selecciona el servicio o por qué el folio viene sin servicio..."
                                                        value={observacionManualServicio}
                                                        onChange={e => setObservacionManualServicio(e.target.value)}
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={!selectedServicioManual || !observacionManualServicio.trim() || guardandoServicioManual}
                                                    onClick={async () => {
                                                        setGuardandoServicioManual(true)
                                                        const res = await guardarServicioManual(folio, selectedServicioManual, observacionManualServicio)
                                                        if (res.error) {
                                                            alert(res.error)
                                                        } else {
                                                            await fetchData()
                                                            onCalculated() // Tell the parent list that the data changed
                                                        }
                                                        setGuardandoServicioManual(false)
                                                    }}
                                                    className="w-full py-2 bg-gray-900 hover:bg-black text-white text-xs font-black rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm shadow-black/10 cursor-pointer"
                                                >
                                                    {guardandoServicioManual ? (
                                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    ) : (
                                                        <>Aplicar Servicio ✋</>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
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
                                            {k === 'NIVELCONTROLADO' ? (
                                                <select
                                                    className="w-full px-3 py-2 rounded-lg border border-amber-200 focus:ring-2 focus:ring-amber-500 bg-white"
                                                    value={customValues[k] || ''}
                                                    onChange={e => setCustomValues(prev => ({ ...prev, [k]: e.target.value }))}
                                                >
                                                    <option value="" disabled>Seleccione nivel...</option>
                                                    {pmpaNiveles.length > 0 ? (
                                                        pmpaNiveles.map(n => (
                                                            <option key={n.label} value={n.label}>
                                                                {n.label} ({n.value} raciones)
                                                            </option>
                                                        ))
                                                    ) : (
                                                        <option value="0">Sin niveles disponibles (0 raciones)</option>
                                                    )}
                                                </select>
                                            ) : (
                                                <input
                                                    type="number"
                                                    className="w-full px-3 py-2 rounded-lg border border-amber-200 focus:ring-2 focus:ring-amber-500 bg-white"
                                                    placeholder={`Ingrese valor para ${k}`}
                                                    value={customValues[k] || ''}
                                                    onChange={e => {
                                                        let val = e.target.value;
                                                        if (['CANTSERVICIO', 'MANIPULADORAAFECTADA', 'MANIPULADORA', 'INSTRUMENTO', 'ELEMENTOS'].includes(k) && val === '0') {
                                                            val = '1';
                                                        }
                                                        setCustomValues(prev => ({ ...prev, [k]: val }))
                                                    }}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Detalles de Aspectos */}
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Aspectos a Evaluar (NC = X)</p>
                            <div className="space-y-3">
                                {detalles.map(d => {
                                    const calcObj = result?.detallesCalculados.find(c => c.letraAspecto === d.letraAspecto)

                                    return (
                                        <div key={d.id} className={`p-4 rounded-2xl border bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow`}>
                                            <div className="flex gap-4">
                                                <div className="w-12 h-12 shrink-0 bg-cyan-50 rounded-xl flex items-center justify-center font-black text-cyan-700 text-xl border border-cyan-100">
                                                    {d.letraAspecto || '?'}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm text-gray-800 font-semibold leading-relaxed">{d.aspecto}</p>
                                                    <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg italic">
                                                        <span className="font-bold">Observación:</span> {d.observacionesOMedioDeVerificacion || 'Sin observaciones'}
                                                    </p>
                                                    
                                                    {/* Real-time aspect calculation display */}
                                                    {calcObj && (
                                                        <div className="mt-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 animate-in fade-in duration-300">
                                                            <div>
                                                                <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">Cálculo en Tiempo Real</p>
                                                                <p className="text-xs font-mono text-emerald-700 bg-white/80 px-2 py-1 rounded border border-emerald-100/50 w-fit">
                                                                    {calcObj.formulaAplicada}
                                                                </p>
                                                            </div>
                                                            <div className="text-left sm:text-right">
                                                                <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-0.5">Monto Multa</p>
                                                                <p className="text-lg font-black text-emerald-600">${calcObj.montoMulta.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                                                        <div className="text-xs font-mono text-cyan-700 bg-cyan-50 px-2 py-1 rounded w-fit border border-cyan-100">
                                                            Fórmula: {d.formulaAsignada || 'NO ASIGNADA'}
                                                        </div>
                                                        {d.solucionable === 'Solucionable' ? (
                                                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded border border-emerald-100 flex items-center gap-1">
                                                                🟢 Solucionable
                                                            </span>
                                                        ) : d.solucionable === 'No Solucionable' ? (
                                                            <span className="px-2 py-1 bg-rose-50 text-rose-700 text-[10px] font-black rounded border border-rose-100 flex items-center gap-1">
                                                                🔴 No Solucionable
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-1 bg-slate-50 text-slate-500 text-[10px] font-bold rounded border border-slate-100 italic flex items-center gap-1">
                                                                ⚪ Criterio no definido
                                                            </span>
                                                        )}
                                                        {d.formulaAsignada && (
                                                            <div className="text-[10px] font-bold text-amber-800 bg-amber-100/50 px-2 py-1 rounded border border-amber-200 flex flex-wrap gap-x-3 gap-y-1">
                                                                {d.formulaAsignada.toUpperCase().includes('UTM') && (
                                                                    <span>💰 UTM: ${data?.utmValue?.toLocaleString()} <span className="font-normal opacity-70">({data?.utmPeriod})</span></span>
                                                                )}
                                                                {d.formulaAsignada.toUpperCase().includes('RACIONES') && (
                                                                    <span>📊 RACIONES: {data?.racionesValue?.toLocaleString()}</span>
                                                                )}
                                                                {d.formulaAsignada.toUpperCase().includes('NIVELCONTROLADO') && (() => {
                                                                    const selectedLevelLabel = customValues['NIVELCONTROLADO'] || ''
                                                                    const selectedLevelObj = pmpaNiveles.find(n => n.label === selectedLevelLabel)
                                                                    return selectedLevelObj ? (
                                                                        <span>⚖️ NIVEL CONTROLADO: {selectedLevelObj.label} ({selectedLevelObj.value} raciones)</span>
                                                                    ) : (
                                                                        <span className="text-amber-700 italic">⚖️ NIVEL CONTROLADO: Sin seleccionar (Raciones generales: {data?.racionesValue})</span>
                                                                    )
                                                                })()}
                                                                {d.formulaAsignada.toUpperCase().includes('MATERIAPRIMA') && (
                                                                    <span>📦 MATERIAPRIMA: {customValues['MATERIAPRIMA'] || 1}</span>
                                                                )}
                                                                {d.formulaAsignada.toUpperCase().includes('INSTRUMENTO') && (
                                                                    <span>🔧 INSTRUMENTO: {customValues['INSTRUMENTO'] || 1}</span>
                                                                )}
                                                                {/\bMANIPULADORAAFECTADA\b/.test(d.formulaAsignada.toUpperCase()) && (
                                                                    <span>👩‍🍳 MANIPULADORA AFECTADA: {customValues['MANIPULADORAAFECTADA'] || 1}</span>
                                                                )}
                                                                {/\bMANIPULADORA\b/.test(d.formulaAsignada.toUpperCase()) && (
                                                                    <span>👩‍🍳 MANIPULADORA: {customValues['MANIPULADORA'] || 1}</span>
                                                                )}
                                                                {d.formulaAsignada.toUpperCase().includes('CANTSERVICIO') && (
                                                                    <span>🍽️ CANTSERVICIO: {customValues['CANTSERVICIO'] || 1}</span>
                                                                )}
                                                                {d.formulaAsignada.toUpperCase().includes('ELEMENTOS') && (
                                                                    <span>🧩 ELEMENTOS: {customValues['ELEMENTOS'] || 1}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}

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
                            {calculating ? 'Guardando...' : 'Guardar Cálculo'}
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
