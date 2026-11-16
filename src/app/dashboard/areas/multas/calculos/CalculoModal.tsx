'use client'

import { useState, useEffect } from 'react'
import { 
    getDetalleFolioParaCalculo, 
    saveCalculo, 
    guardarServicioManual,
    guardarDatosFolio,
    guardarCantidadOverride,
    eliminarCantidadOverride,
    getDiagnosticoFolio
} from './actions'
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
    const [isEditServicioModalOpen, setIsEditServicioModalOpen] = useState(false)

    // C3 States: Datos Complementarios de Folio & Overrides
    const [moduloC3Activo, setModuloC3Activo] = useState(false)
    const [c3Submodulos, setC3Submodulos] = useState<{
        nivelSupervisado?: boolean
        bandejasAql?: boolean
        correccionManual?: boolean
    }>({})
    const [folioDato, setFolioDato] = useState<any>(null)
    const [overrides, setOverrides] = useState<any[]>([])

    // C3.1: Form States Folio Dato
    const [nivelSupervisadoState, setNivelSupervisadoState] = useState<string>('AUTO')
    const [bandejasEvaluadasState, setBandejasEvaluadasState] = useState<string | number>('')
    const [bandejasRechazadasState, setBandejasRechazadasState] = useState<string | number>('')
    const [motivoFolioDatoState, setMotivoFolioDatoState] = useState('')
    const [savingFolioDato, setSavingFolioDato] = useState(false)

    // C3.2: Form States Override Manual
    const [overrideModalOpen, setOverrideModalOpen] = useState(false)
    const [overrideTarget, setOverrideTarget] = useState<{
        letraAspecto: string
        aspectoDesc?: string
        variable: string
        valorActual: number
        valorOriginal?: number | null
        overrideId?: string
        motivo?: string
    } | null>(null)
    const [overrideNuevoValor, setOverrideNuevoValor] = useState('')
    const [overrideMotivo, setOverrideMotivo] = useState('')
    const [savingOverride, setSavingOverride] = useState(false)
    const [deletingOverride, setDeletingOverride] = useState(false)

    // C4 States: Diagnóstico de Extracción
    const [isDiagnosticoOpen, setIsDiagnosticoOpen] = useState(false)
    const [diagnosticoData, setDiagnosticoData] = useState<any>(null)
    const [loadingDiagnostico, setLoadingDiagnostico] = useState(false)

    const handleOpenDiagnostico = async () => {
        setIsDiagnosticoOpen(true)
        setLoadingDiagnostico(true)
        try {
            const res = await getDiagnosticoFolio(folio)
            if (res.error) {
                alert(res.error)
            } else {
                setDiagnosticoData(res)
            }
        } catch (e: any) {
            alert('Error al cargar diagnóstico de extracción.')
        } finally {
            setLoadingDiagnostico(false)
        }
    }

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
                racionesValue: res.racionesValue,
                racionesExcluidas: res.racionesExcluidas || 0,
                estratosExcluidos: res.estratosExcluidos || []
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
            if (rawNivel !== undefined && rawNivel !== '') {
                if (rawNivel === '0' || rawNivel === 'No Aplica (0 Raciones)' || rawNivel === 'No Aplica') {
                    loadedValues['NIVELCONTROLADO'] = 'No Aplica (0 Raciones)'
                } else if (!isNaN(Number(rawNivel))) {
                    const racionesNum = Number(rawNivel)
                    if (racionesNum === 0) {
                        loadedValues['NIVELCONTROLADO'] = 'No Aplica (0 Raciones)'
                    } else {
                        const matchingLevel = (res.pmpaNiveles || []).find(n => n.value === racionesNum)
                        if (matchingLevel) {
                            loadedValues['NIVELCONTROLADO'] = matchingLevel.label
                        }
                    }
                }
            }
            
            // Apply defaults for numeric variables if they are needed but not present
            if (res.keywordsNeeded) {
                res.keywordsNeeded.forEach((k: string) => {
                    if (['CANTSERVICIO', 'MANIPULADORAAFECTADA', 'MANIPULADORA', 'INSTRUMENTO', 'ELEMENTOS'].includes(k)) {
                        if (!loadedValues[k] || loadedValues[k] === '0') {
                            loadedValues[k] = '1'
                        }
                    } else if (k === 'MATERIAPRIMA' || k === 'MATERIAPRIMATPMPAP') {
                        if (!loadedValues[k]) {
                            loadedValues[k] = '1'
                        }
                    }
                })
            }
            
            setCustomValues(loadedValues)

            // C3 Data & Submodulos
            setModuloC3Activo(res.moduloC3Activo || false)
            setC3Submodulos(res.c3Submodulos || {})
            setFolioDato(res.folioDato || null)
            setOverrides(res.overrides || [])

            // Initialize Folio Dato form inputs
            setNivelSupervisadoState(res.folioDato?.nivelSupervisado || 'AUTO')
            setBandejasEvaluadasState(res.folioDato?.bandejasEvaluadas !== null && res.folioDato?.bandejasEvaluadas !== undefined ? res.folioDato.bandejasEvaluadas : '')
            setBandejasRechazadasState(res.folioDato?.bandejasRechazadas !== null && res.folioDato?.bandejasRechazadas !== undefined ? res.folioDato.bandejasRechazadas : '')
            setMotivoFolioDatoState(res.folioDato?.motivo || '')
        }
        setLoading(false)
    }

    const handleGuardarDatosFolio = async () => {
        setSavingFolioDato(true)
        setError('')
        try {
            const res = await guardarDatosFolio({
                folio,
                nivelSupervisado: nivelSupervisadoState === 'AUTO' ? null : nivelSupervisadoState,
                bandejasEvaluadas: bandejasEvaluadasState === '' ? null : Number(bandejasEvaluadasState),
                bandejasRechazadas: bandejasRechazadasState === '' ? null : Number(bandejasRechazadasState),
                motivo: motivoFolioDatoState
            })
            if (res.error) {
                alert(res.error)
            } else {
                await fetchData()
                onCalculated()
            }
        } catch (e: any) {
            alert('Error al guardar datos complementarios del folio.')
        } finally {
            setSavingFolioDato(false)
        }
    }

    const handleGuardarOverride = async () => {
        if (!overrideTarget) return
        const cleanMotivo = overrideMotivo.trim()
        if (!cleanMotivo) {
            alert('El motivo de la corrección manual es obligatorio.')
            return
        }
        const valNum = Number(overrideNuevoValor)
        if (isNaN(valNum) || valNum < 0) {
            alert('El valor ingresado debe ser un número válido mayor o igual a 0.')
            return
        }

        setSavingOverride(true)
        try {
            const res = await guardarCantidadOverride({
                folio,
                letraAspecto: overrideTarget.letraAspecto,
                variable: overrideTarget.variable,
                valor: valNum,
                motivo: cleanMotivo,
                valorOriginal: overrideTarget.valorOriginal ?? overrideTarget.valorActual
            })
            if (res.error) {
                alert(res.error)
            } else {
                setOverrideModalOpen(false)
                setOverrideTarget(null)
                await fetchData()
                onCalculated()
            }
        } catch (e: any) {
            alert('Error al guardar corrección manual.')
        } finally {
            setSavingOverride(false)
        }
    }

    const handleEliminarOverride = async () => {
        if (!overrideTarget?.overrideId) return
        if (!confirm('¿Desea revertir esta corrección manual y restablecer el valor original?')) return

        setDeletingOverride(true)
        try {
            const res = await eliminarCantidadOverride(overrideTarget.overrideId)
            if (res.error) {
                alert(res.error)
            } else {
                setOverrideModalOpen(false)
                setOverrideTarget(null)
                await fetchData()
                onCalculated()
            }
        } catch (e: any) {
            alert('Error al revertir corrección.')
        } finally {
            setDeletingOverride(false)
        }
    }

    const evaluateFormulaLocal = (formula: string, customVals: Record<string, string>) => {
        try {
            const cleanFormula = formula.toUpperCase()
            const utmVal = data?.utmValue || 0
            const totalRaciones = data?.racionesValue || 0
            
            // Get NIVELCONTROLADO raciones based on selection
            const selectedLevelLabel = customVals['NIVELCONTROLADO'] || ''
            let nivelControladoVal = totalRaciones
            if (selectedLevelLabel === 'No Aplica (0 Raciones)' || selectedLevelLabel === 'No Aplica' || selectedLevelLabel === '0') {
                nivelControladoVal = 0
            } else {
                const selectedLevelObj = pmpaNiveles.find(n => n.label === selectedLevelLabel)
                if (selectedLevelObj) {
                    nivelControladoVal = selectedLevelObj.value
                } else if (selectedLevelLabel && !isNaN(Number(selectedLevelLabel))) {
                    nivelControladoVal = Number(selectedLevelLabel)
                }
            }
            
            const materiaPrimaVal = customVals['MATERIAPRIMA'] !== undefined && customVals['MATERIAPRIMA'] !== '' ? Number(customVals['MATERIAPRIMA']) : 1
            const materiaPrimaTpmpapVal = customVals['MATERIAPRIMATPMPAP'] !== undefined && customVals['MATERIAPRIMATPMPAP'] !== '' ? Number(customVals['MATERIAPRIMATPMPAP']) : 1
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
                .replace(/MATERIAPRIMATPMPAP/g, materiaPrimaTpmpapVal.toString())
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

            // Build aspect-specific variables using priority overrides if available
            const aspectCustomValues: Record<string, string> = { ...customValues }
            if (d.detalleVariables) {
                for (const [vKey, vInfo] of Object.entries(d.detalleVariables)) {
                    if ((vInfo as any)?.valor !== undefined && (vInfo as any)?.valor !== null) {
                        aspectCustomValues[vKey] = String((vInfo as any).valor)
                    }
                }
            }

            // Si el aspecto tiene una restricción activa aplicada (ej: Aspecto M año 2024 = $0)
            if (d.restriccionAplicada) {
                const r = d.restriccionAplicada
                const montoR = r.accion === 'VALOR_CERO' ? 0 : (r.valorFijo || 0)
                const glosaR = r.accion === 'VALOR_CERO'
                    ? `RESTRICCIÓN APLICADA: Año ${r.anho || ''} -> $0 (Exento)`
                    : `RESTRICCIÓN APLICADA: Monto fijo $${montoR.toLocaleString('es-CL')}`

                totalMonto += montoR
                detallesCalc.push({
                    letraAspecto: d.letraAspecto,
                    descripcion: d.observacionesOMedioDeVerificacion,
                    formulaAplicada: glosaR,
                    montoMulta: montoR,
                    variablesUsadas: aspectCustomValues,
                    restriccionAplicada: r
                })
                continue
            }

            const evalRes = evaluateFormulaLocal(d.formulaAsignada, aspectCustomValues)
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
                variablesUsadas: aspectCustomValues
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
        <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-4xl shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                >
                    ✕
                </button>

                <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pr-10">
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>🧮</span> Cálculo de Multas: Folio {folio}
                    </h3>
                    <button
                        type="button"
                        onClick={handleOpenDiagnostico}
                        className="px-3.5 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                        <span>🔍</span>
                        <span>Diagnóstico C4</span>
                    </button>
                </div>

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
                                                        const rawServManual = data?.servicioManual || ''
                                                        const sMatch = rawServManual.match(/\(([A-Z])\)/)
                                                        const code = sMatch ? sMatch[1] : ''
                                                        setSelectedServicioManual(code)
                                                        setObservacionManualServicio(data?.observacionManualServicio || '')
                                                        setIsEditServicioModalOpen(true)
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

                        {/* C3.1: Datos Complementarios del Folio (Nivel Supervisado y Bandejas AQL) */}
                        {moduloC3Activo && (c3Submodulos?.nivelSupervisado || c3Submodulos?.bandejasAql) && (
                            <div className="p-4 bg-gradient-to-br from-cyan-50/70 via-sky-50/40 to-slate-50 rounded-2xl border border-cyan-200/80 shadow-xs space-y-3.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">📑</span>
                                        <span className="text-xs font-black text-cyan-950 uppercase tracking-wider">
                                            Datos Complementarios del Folio (Módulo C3)
                                        </span>
                                    </div>
                                    {folioDato?.updatedBy && (
                                        <span className="text-[10px] text-cyan-800 bg-white/80 px-2.5 py-0.5 rounded-full font-semibold border border-cyan-200">
                                            Última mod.: <strong>{folioDato.updatedBy}</strong>
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                                    {c3Submodulos?.nivelSupervisado && (
                                        <div className={c3Submodulos?.bandejasAql ? "md:col-span-6" : "md:col-span-12"}>
                                            <label className="block text-[10px] font-black text-cyan-900 uppercase tracking-wider mb-1.5">
                                                Nivel Supervisado en Terreno:
                                            </label>
                                            <div className="grid grid-cols-4 gap-1.5">
                                                {[
                                                    { id: 'AUTO', label: 'Auto (Todos)' },
                                                    { id: 'T', label: 'Transición (T)' },
                                                    { id: 'B', label: 'Básica (B)' },
                                                    { id: 'M', label: 'Media (M)' }
                                                ].map(opt => (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => setNivelSupervisadoState(opt.id)}
                                                        className={`px-2 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                                            nivelSupervisadoState === opt.id
                                                                ? 'bg-cyan-700 text-white border-cyan-800 shadow-xs ring-1 ring-cyan-700'
                                                                : 'bg-white text-cyan-950 border-cyan-200 hover:bg-cyan-100/60'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-cyan-700 mt-1 leading-tight">
                                                Filtra las raciones del PMPA al nivel educativo evaluado en terreno.
                                            </p>
                                        </div>
                                    )}

                                    {c3Submodulos?.bandejasAql && (
                                        <>
                                            <div className="md:col-span-3">
                                                <label className="block text-[10px] font-black text-cyan-900 uppercase tracking-wider mb-1.5">
                                                    Bandejas Evaluadas:
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="50"
                                                    placeholder="Ej: 8"
                                                    value={bandejasEvaluadasState}
                                                    onChange={e => setBandejasEvaluadasState(e.target.value)}
                                                    className="w-full px-3 py-1.5 rounded-xl border border-cyan-200 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-cyan-500 outline-none"
                                                />
                                                <p className="text-[10px] text-cyan-700 mt-1 leading-tight">
                                                    Muestra AQL 6.5 (Anexo N°1).
                                                </p>
                                            </div>

                                            <div className="md:col-span-3">
                                                <label className="block text-[10px] font-black text-cyan-900 uppercase tracking-wider mb-1.5">
                                                    Bandejas Rechazadas:
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="Ej: 0"
                                                    value={bandejasRechazadasState}
                                                    onChange={e => setBandejasRechazadasState(e.target.value)}
                                                    className="w-full px-3 py-1.5 rounded-xl border border-cyan-200 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-cyan-500 outline-none"
                                                />
                                                <p className="text-[10px] text-cyan-700 mt-1 leading-tight">
                                                    Rechazos bajo norma (-5%).
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-cyan-200/60">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            placeholder="Motivo u observación del folio en terreno (opcional)..."
                                            value={motivoFolioDatoState}
                                            onChange={e => setMotivoFolioDatoState(e.target.value)}
                                            className="w-full px-3 py-1.5 rounded-xl border border-cyan-200 bg-white text-xs text-gray-700 focus:ring-2 focus:ring-cyan-500 outline-none"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        disabled={savingFolioDato}
                                        onClick={handleGuardarDatosFolio}
                                        className="px-4 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                                    >
                                        {savingFolioDato ? (
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>💾 Guardar Datos Folio</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

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
                                                    <option value="No Aplica (0 Raciones)">No Aplica (0 Raciones)</option>
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

                                                    {/* Restricción Normativa Badge if applicable */}
                                                    {d.restriccionAplicada && (
                                                        <div className="mt-3 p-3 bg-cyan-50/80 border border-cyan-200 rounded-xl flex items-start justify-between gap-3 text-xs">
                                                            <div className="flex items-start gap-2.5">
                                                                <span className="text-cyan-700 font-bold text-base">🛡️</span>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-cyan-900">Restricción Normativa Aplicada</span>
                                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                                                                            {d.restriccionAplicada.tipo === 'ANHO' ? `Año ${d.restriccionAplicada.anho}` : 'Rango Fechas'}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-gray-700 mt-1">
                                                                        {d.restriccionAplicada.accion === 'VALOR_CERO'
                                                                            ? 'El valor de la multa para este aspecto ha sido fijado en $0 (Exento).'
                                                                            : `El valor de la multa para este aspecto ha sido fijado en monto fijo de $${d.restriccionAplicada.valorFijo?.toLocaleString('es-CL')}.`}
                                                                    </p>
                                                                    {d.restriccionAplicada.descripcion && (
                                                                        <p className="text-[11px] text-gray-500 italic mt-0.5">
                                                                            &quot;{d.restriccionAplicada.descripcion}&quot;
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                                                $0 EXENTO
                                                            </span>
                                                        </div>
                                                    )}
                                                    
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
                                                                    <span className="flex items-center gap-1.5 flex-wrap">
                                                                        <span>📊 RACIONES: {data?.racionesValue?.toLocaleString()}</span>
                                                                        {data?.racionesExcluidas > 0 && (
                                                                            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded" title={`Se excluyeron ${data.racionesExcluidas} raciones de estratos: ${data.estratosExcluidos?.join(', ')}`}>
                                                                                (Se excluyeron {data.racionesExcluidas} por estratos {data.estratosExcluidos?.join(', ')})
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                )}
                                                                 {d.formulaAsignada.toUpperCase().includes('NIVELCONTROLADO') && (() => {
                                                                    const selectedLevelLabel = customValues['NIVELCONTROLADO'] || ''
                                                                    if (selectedLevelLabel === 'No Aplica (0 Raciones)' || selectedLevelLabel === 'No Aplica' || selectedLevelLabel === '0') {
                                                                        return <span>⚖️ NIVEL CONTROLADO: No Aplica (0 raciones)</span>
                                                                    }
                                                                    const selectedLevelObj = pmpaNiveles.find(n => n.label === selectedLevelLabel)
                                                                    return selectedLevelObj ? (
                                                                        <span>⚖️ NIVEL CONTROLADO: {selectedLevelObj.label} ({selectedLevelObj.value} raciones)</span>
                                                                    ) : selectedLevelLabel ? (
                                                                        <span>⚖️ NIVEL CONTROLADO: {selectedLevelLabel}</span>
                                                                    ) : (
                                                                        <span className="text-amber-700 italic">⚖️ NIVEL CONTROLADO: Sin seleccionar (Raciones generales: {data?.racionesValue})</span>
                                                                    )
                                                                })()}
                                                                {(() => {
                                                                    const renderVariableBadge = (varKey: string, label: string, icon: string) => {
                                                                        const varInfo = d.detalleVariables?.[varKey]
                                                                        const val = (varInfo?.valor !== undefined && varInfo?.valor !== null) ? varInfo.valor : (customValues[varKey] || 1)
                                                                        const isOverride = varInfo?.origen === 'OVERRIDE_MANUAL'
                                                                        const isAuto = varInfo?.origen === 'EXTRACCION_AUTO'

                                                                        return (
                                                                            <span
                                                                                key={varKey}
                                                                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] transition-colors ${
                                                                                    isOverride
                                                                                        ? 'bg-amber-100 text-amber-950 border-amber-300 font-black shadow-2xs'
                                                                                        : isAuto
                                                                                            ? 'bg-sky-100/70 text-sky-950 border-sky-300 font-bold'
                                                                                            : 'bg-white/80 text-amber-900 border-amber-200/80 font-bold'
                                                                                }`}
                                                                            >
                                                                                <span>{icon} {label}: <strong className="font-mono text-[11px]">{val}</strong></span>

                                                                                {isOverride && (
                                                                                    <span
                                                                                        className="px-1.5 py-0.2 rounded-md bg-amber-200 text-amber-950 text-[9px] uppercase font-black cursor-help border border-amber-300"
                                                                                        title={`Corregido manualmente por ${varInfo.autor || 'Usuario'}: "${varInfo.motivo || 'Sin motivo'}"`}
                                                                                    >
                                                                                        Corregido
                                                                                    </span>
                                                                                )}

                                                                                {isAuto && (
                                                                                    <span
                                                                                        className="px-1.5 py-0.2 rounded-md bg-sky-200 text-sky-950 text-[9px] uppercase font-bold cursor-help border border-sky-300"
                                                                                        title="Extraído automáticamente del texto de la observación del acta"
                                                                                    >
                                                                                        Auto
                                                                                    </span>
                                                                                )}

                                                                                {moduloC3Activo && c3Submodulos?.correccionManual && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setOverrideTarget({
                                                                                                letraAspecto: d.letraAspecto,
                                                                                                aspectoDesc: d.aspecto,
                                                                                                variable: varKey,
                                                                                                valorActual: Number(val),
                                                                                                valorOriginal: varInfo?.valorOriginal,
                                                                                                overrideId: varInfo?.overrideId,
                                                                                                motivo: varInfo?.motivo
                                                                                            })
                                                                                            setOverrideNuevoValor(String(val))
                                                                                            setOverrideMotivo(varInfo?.motivo || '')
                                                                                            setOverrideModalOpen(true)
                                                                                        }}
                                                                                        title="Modificar cantidad de este aspecto con motivo obligatorio (C3.2)"
                                                                                        className="ml-0.5 hover:scale-125 transition-transform text-cyan-800 hover:text-cyan-950 font-bold cursor-pointer"
                                                                                    >
                                                                                        ✏️
                                                                                    </button>
                                                                                )}
                                                                            </span>
                                                                        )
                                                                    }

                                                                    return (
                                                                        <>
                                                                            {/\bMATERIAPRIMATPMPAP\b/.test(d.formulaAsignada.toUpperCase()) && renderVariableBadge('MATERIAPRIMATPMPAP', 'MATERIAPRIMATPMPAP', '📦')}
                                                                            {/\bMATERIAPRIMA\b/.test(d.formulaAsignada.toUpperCase()) && renderVariableBadge('MATERIAPRIMA', 'MATERIAPRIMA', '📦')}
                                                                            {d.formulaAsignada.toUpperCase().includes('INSTRUMENTO') && renderVariableBadge('INSTRUMENTO', 'INSTRUMENTO', '🔧')}
                                                                            {/\bMANIPULADORAAFECTADA\b/.test(d.formulaAsignada.toUpperCase()) && renderVariableBadge('MANIPULADORAAFECTADA', 'MANIPULADORA AFECTADA', '👩‍🍳')}
                                                                            {/\bMANIPULADORA\b/.test(d.formulaAsignada.toUpperCase()) && renderVariableBadge('MANIPULADORA', 'MANIPULADORA', '👩‍🍳')}
                                                                            {d.formulaAsignada.toUpperCase().includes('CANTSERVICIO') && renderVariableBadge('CANTSERVICIO', 'CANTSERVICIO', '🍽️')}
                                                                            {d.formulaAsignada.toUpperCase().includes('ELEMENTOS') && renderVariableBadge('ELEMENTOS', 'ELEMENTOS', '🧩')}
                                                                        </>
                                                                    )
                                                                })()}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Bloque Inteligente: Orientación Normativa IT (Verificación y Solución) */}
                                                    {d.itInfo && (
                                                        <div className="mt-3.5 rounded-xl border border-slate-200 overflow-hidden bg-white text-xs shadow-sm">
                                                            {/* Encabezado IT */}
                                                            <div className={`px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 border-b ${
                                                                d.itInfo.subsanabilidadHabilitada && d.itInfo.tienePeriodoCorreccion 
                                                                    ? 'bg-emerald-50/80 border-emerald-100 text-emerald-950' 
                                                                    : 'bg-slate-50 border-slate-200 text-slate-800'
                                                            }`}>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-black text-[11px] uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                                                        📋 Instrucción de Trabajo: Aspecto {d.itInfo.letra}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-500 font-medium">({d.itInfo.itDocumento})</span>
                                                                </div>
                                                                {d.itInfo.subsanabilidadHabilitada && (
                                                                    <div>
                                                                        {d.itInfo.tienePeriodoCorreccion ? (
                                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                                                🟢 Subsanable — Plazo: {d.itInfo.plazoDias || 5} Días Hábiles
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                                                                                ⚪ No Subsanable en Visita
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="p-3.5 space-y-2.5">
                                                                {/* Alerta de Causa No Imputable detectada */}
                                                                {d.itInfo.posibleCausaNoImputable && (
                                                                    <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 flex items-start gap-2.5">
                                                                        <span className="text-base shrink-0">💡</span>
                                                                        <div>
                                                                            <span className="font-bold block text-[10px] uppercase tracking-wider text-indigo-900">
                                                                                Causal de Descargo Detectada (Tabla N°1 IT)
                                                                            </span>
                                                                            <p className="mt-0.5 text-xs text-indigo-800 leading-relaxed font-medium">
                                                                                {d.itInfo.posibleCausaNoImputable}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Alerta Técnica Aspecto G: Muestra AQL 6,5 y Tolerancia 5% */}
                                                                {d.itInfo.alertaTecnica?.tipo === 'AQL_PESAJE' && (
                                                                    <div className={`p-3 rounded-xl border ${
                                                                        d.itInfo.alertaTecnica.esDefensaGanable 
                                                                            ? 'bg-rose-50 border-rose-200 text-rose-950' 
                                                                            : 'bg-cyan-50/70 border-cyan-200 text-cyan-950'
                                                                    }`}>
                                                                        <div className="flex flex-wrap items-center justify-between gap-1 font-bold text-xs mb-1.5">
                                                                            <span className="flex items-center gap-1.5 text-slate-800">
                                                                                ⚖️ Control de Pesaje AQL 6,5 (Anexo N°1)
                                                                            </span>
                                                                            <span className="font-mono bg-white px-2 py-0.5 rounded-lg border border-cyan-200 text-cyan-800 text-[11px]">
                                                                                {d.itInfo.alertaTecnica.raciones} raciones ({d.itInfo.alertaTecnica.rangoTexto})
                                                                            </span>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-cyan-200/60 text-xs">
                                                                            <div>
                                                                                <span className="text-slate-500 block text-[10px] font-bold uppercase">Muestra Mínima Obligatoria:</span>
                                                                                <span className="font-black text-slate-900 text-sm">
                                                                                    {d.itInfo.alertaTecnica.muestraMinima} bandejas
                                                                                </span>
                                                                                <span className="text-slate-500 text-[10px] ml-1.5 font-medium">
                                                                                    ({d.itInfo.alertaTecnica.criterioAceptacionRechazo})
                                                                                </span>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-slate-500 block text-[10px] font-bold uppercase">Margen de Tolerancia FEP:</span>
                                                                                <span className="font-black text-slate-900 text-sm">5% bajo gramaje neto</span>
                                                                            </div>
                                                                        </div>
                                                                        {d.itInfo.alertaTecnica.advertenciaMuestra && (
                                                                            <div className="mt-2.5 pt-2 border-t border-cyan-200/60 font-semibold text-xs flex items-start gap-1.5 leading-relaxed">
                                                                                <span className="shrink-0 text-sm">📌</span>
                                                                                <span>{d.itInfo.alertaTecnica.advertenciaMuestra}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Aspecto H: Manipuladoras */}
                                                                {d.itInfo.alertaTecnica?.tipo === 'PERSONAL_MANIPULADOR' && (
                                                                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs leading-relaxed space-y-1.5">
                                                                        <span className="font-bold block text-[10px] uppercase text-slate-500 mb-0.5">
                                                                            Criterio de Dotación Manipuladora (1:70):
                                                                        </span>
                                                                        {d.itInfo.alertaTecnica.advertenciaDotacion && (
                                                                            <div className={`p-2 rounded-lg text-xs font-bold ${
                                                                                d.itInfo.alertaTecnica.advertenciaDotacion.startsWith('⚠️')
                                                                                    ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                                                                    : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                                                                            }`}>
                                                                                {d.itInfo.alertaTecnica.advertenciaDotacion}
                                                                            </div>
                                                                        )}
                                                                        <p>
                                                                            Ratio normativo: <strong>1 manipuladora cada 70 raciones</strong>{' '}
                                                                            {d.itInfo.alertaTecnica.manipuladorasRequeridas 
                                                                                ? `(Exige ${d.itInfo.alertaTecnica.manipuladorasRequeridas} manipuladoras para ${d.itInfo.alertaTecnica.racionesEstablecimiento || d.itInfo.alertaTecnica.raciones || 'este servicio'})` 
                                                                                : ''}. {d.itInfo.alertaTecnica.tolerancia}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {/* Aspecto A: Minuta Planificada del Día */}
                                                                {d.minutaPlanificadaDelDia && d.minutaPlanificadaDelDia.length > 0 && (
                                                                    <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-950 text-xs leading-relaxed">
                                                                        <span className="font-bold block text-[10px] uppercase text-sky-700 mb-1 flex items-center gap-1">
                                                                            <span>📋</span>
                                                                            <span>Minuta Oficial Planificada para el Día:</span>
                                                                        </span>
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {d.minutaPlanificadaDelDia.map((mItem: any, mIdx: number) => (
                                                                                <span key={mIdx} className="px-2 py-0.5 rounded-md bg-white border border-sky-200 text-[11px] font-semibold text-sky-900 shadow-2xs">
                                                                                    <strong className="text-sky-700">{mItem.servicio}:</strong> {mItem.preparacion}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Aspecto F: Calidad Frutas y Verduras */}
                                                                {d.itInfo.alertaTecnica?.tipo === 'CALIDAD_FRUTAS_VERDURAS' && (
                                                                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs leading-relaxed">
                                                                        <span className="font-bold block text-[10px] uppercase text-slate-500 mb-0.5">
                                                                            Tolerancias de Calidad Frutas y Verduras (Anexo N°2):
                                                                        </span>
                                                                        <p>{d.itInfo.alertaTecnica.criterio} {d.itInfo.alertaTecnica.rotulacion}</p>
                                                                    </div>
                                                                )}

                                                                {/* Aspecto K: Temperaturas */}
                                                                {d.itInfo.alertaTecnica?.tipo === 'TEMPERATURA' && (
                                                                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs leading-relaxed">
                                                                        <span className="font-bold block text-[10px] uppercase text-slate-500 mb-0.5">
                                                                            Rangos Normativos de Temperatura:
                                                                        </span>
                                                                        <p><strong>{d.itInfo.alertaTecnica.rangos}</strong> {d.itInfo.alertaTecnica.criterio}</p>
                                                                    </div>
                                                                )}

                                                                {/* Pauta de Solución (Anexo N°3) para subsanables */}
                                                                {d.itInfo.pautaSolucion && (
                                                                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs">
                                                                        <span className="font-black text-[10px] uppercase tracking-wider text-emerald-900 block mb-1 flex items-center gap-1.5">
                                                                            🛠️ Pauta de Solución Oficial (Medio de Descargo Exigido — Anexo N°3):
                                                                        </span>
                                                                        <p className="leading-relaxed font-semibold text-emerald-900">{d.itInfo.pautaSolucion}</p>
                                                                    </div>
                                                                )}

                                                                {/* Desplegable de Criterio Oficial y Consideraciones 5.4 */}
                                                                <details className="text-[11px] text-slate-600 bg-slate-50/70 rounded-xl p-2.5 border border-slate-200 cursor-pointer">
                                                                    <summary className="font-bold text-slate-700 hover:text-cyan-700 select-none">
                                                                        🔍 Ver Criterio Completo de la IT (Forma de evaluar y Consideraciones 5.4)
                                                                    </summary>
                                                                    <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5 text-slate-700 leading-relaxed">
                                                                        {d.itInfo.formaEvaluar && (
                                                                            <p><strong className="text-slate-900">Forma de Evaluar:</strong> {d.itInfo.formaEvaluar}</p>
                                                                        )}
                                                                        {d.itInfo.consideraciones && (
                                                                            <p><strong className="text-slate-900">Consideraciones 5.4:</strong> {d.itInfo.consideraciones}</p>
                                                                        )}
                                                                    </div>
                                                                </details>
                                                            </div>
                                                        </div>
                                                    )}
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
                    
                    <div className="flex gap-3 w-full sm:w-auto flex-wrap">
                        <button
                            type="button"
                            onClick={() => window.open(data?.link || '', '_blank')}
                            className="px-5 py-2.5 w-full sm:w-auto rounded-xl text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-100 font-bold transition-colors"
                        >
                            Ver PDF Original
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (data?.esServicioManual) {
                                    const rawServManual = data?.servicioManual || ''
                                    const sMatch = rawServManual.match(/\(([A-Z])\)/)
                                    const code = sMatch ? sMatch[1] : ''
                                    setSelectedServicioManual(code)
                                    setObservacionManualServicio(data?.observacionManualServicio || '')
                                } else {
                                    setSelectedServicioManual('')
                                    setObservacionManualServicio('')
                                }
                                setIsEditServicioModalOpen(true)
                            }}
                            className="px-5 py-2.5 w-full sm:w-auto rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            ✏️ Editar Servicio
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
        </div>

            {/* Sub-modal Editar Servicio */}
            {isEditServicioModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-2xl border border-gray-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                            <h4 className="text-base font-black text-gray-900 flex items-center gap-2">
                                <span>🍽️</span> Editar Servicio del Folio
                            </h4>
                            <button
                                type="button"
                                onClick={() => setIsEditServicioModalOpen(false)}
                                className="text-gray-400 hover:text-gray-700 font-bold text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                                <p className="text-gray-500 font-semibold">Folio: <span className="font-bold text-slate-800">{folio}</span></p>
                                <p className="text-gray-500 font-semibold">Servicio Actual: <span className="font-bold text-indigo-700">{data?.esServicioManual ? `${data?.servicioManual} (Manual)` : (data?.servicio || 'Sin asignación')}</span></p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-black text-gray-500 uppercase tracking-wider">
                                    Seleccionar Nuevo Servicio (*):
                                </label>
                                <select
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 bg-white text-xs font-bold text-gray-800 outline-none"
                                    value={selectedServicioManual}
                                    onChange={e => setSelectedServicioManual(e.target.value)}
                                >
                                    <option value="">-- Seleccionar Servicio del Mantenedor --</option>
                                    {serviciosDisponibles.map(s => (
                                        <option key={s.codigo} value={s.codigo}>
                                            {s.nombre} ({s.codigo})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-black text-gray-500 uppercase tracking-wider">
                                    Observación / Motivo del Cambio (*):
                                </label>
                                <textarea
                                    rows={3}
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 bg-white text-xs text-gray-700 font-medium leading-normal outline-none"
                                    placeholder="Escriba el motivo por el cual se actualiza el servicio..."
                                    value={observacionManualServicio}
                                    onChange={e => setObservacionManualServicio(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setIsEditServicioModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 text-xs font-bold transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={!selectedServicioManual || guardandoServicioManual}
                                onClick={async () => {
                                    setGuardandoServicioManual(true)
                                    const obs = observacionManualServicio.trim() || 'Modificación manual de servicio desde módulo de cálculo'
                                    const res = await guardarServicioManual(folio, selectedServicioManual, obs)
                                    if (res.error) {
                                        alert(res.error)
                                    } else {
                                        await fetchData()
                                        setIsEditServicioModalOpen(false)
                                    }
                                    setGuardandoServicioManual(false)
                                }}
                                className="px-5 py-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 text-xs font-bold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {guardandoServicioManual ? 'Guardando...' : 'Guardar Servicio'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-modal C3.2: Corrección Manual de Cantidad */}
            {overrideModalOpen && overrideTarget && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                            <h4 className="text-base font-black text-gray-900 flex items-center gap-2">
                                <span>✏️</span> Corrección Manual de Cantidad (C3.2)
                            </h4>
                            <button
                                type="button"
                                onClick={() => {
                                    setOverrideModalOpen(false)
                                    setOverrideTarget(null)
                                }}
                                className="text-gray-400 hover:text-gray-700 font-bold text-lg cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                                <p className="text-gray-500 font-semibold">Folio: <span className="font-bold text-slate-800">{folio}</span></p>
                                <p className="text-gray-500 font-semibold">
                                    Aspecto: <span className="font-bold text-cyan-800">{overrideTarget.letraAspecto}</span>
                                    {overrideTarget.aspectoDesc ? <span className="text-gray-600 block text-[11px] mt-0.5">{overrideTarget.aspectoDesc}</span> : null}
                                </p>
                                <p className="text-gray-500 font-semibold">Variable: <span className="font-mono font-bold text-amber-800">{overrideTarget.variable}</span></p>
                                <p className="text-gray-500 font-semibold">Valor Actual: <span className="font-bold text-gray-800 font-mono">{overrideTarget.valorActual}</span></p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider">
                                    Nuevo Valor de la Cantidad (*):
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-white text-xs font-bold text-gray-800 outline-none"
                                    value={overrideNuevoValor}
                                    onChange={e => setOverrideNuevoValor(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider flex items-center justify-between">
                                    <span>Motivo Obligatorio de la Corrección (*):</span>
                                    <span className="text-[10px] text-rose-600 font-bold">Obligatorio</span>
                                </label>
                                <textarea
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-white text-xs text-gray-700 font-medium leading-normal outline-none"
                                    placeholder="Explique el motivo por el cual se rectifica la cantidad (ej: acta rectificatoria, error de digitación del supervisor)..."
                                    value={overrideMotivo}
                                    onChange={e => setOverrideMotivo(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                            <div>
                                {overrideTarget.overrideId ? (
                                    <button
                                        type="button"
                                        disabled={deletingOverride}
                                        onClick={handleEliminarOverride}
                                        className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all border border-rose-200 disabled:opacity-50 cursor-pointer"
                                    >
                                        {deletingOverride ? 'Revirtiendo...' : 'Revertir al Original'}
                                    </button>
                                ) : <div />}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOverrideModalOpen(false)
                                        setOverrideTarget(null)
                                    }}
                                    className="px-4 py-2 rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 text-xs font-bold transition-all cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    disabled={!overrideMotivo.trim() || overrideNuevoValor === '' || savingOverride}
                                    onClick={handleGuardarOverride}
                                    className="px-5 py-2 rounded-xl text-white bg-cyan-700 hover:bg-cyan-800 text-xs font-bold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {savingOverride ? 'Guardando...' : 'Aplicar Corrección'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-modal C4: Diagnóstico de Extracción */}
            {isDiagnosticoOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[70] p-4">
                    <div className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-3xl shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                            <div>
                                <h4 className="text-base font-black text-gray-900 flex items-center gap-2">
                                    <span>🔍</span> Diagnóstico de Extracción de Variables (Módulo C4)
                                </h4>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Folio: <strong className="text-gray-800">{folio}</strong> | RBD: <strong className="text-gray-800">{data?.rbd}</strong> | Licitación: <strong className="text-gray-800">{data?.licitacion}</strong>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsDiagnosticoOpen(false)}
                                className="text-gray-400 hover:text-gray-700 font-bold text-lg cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {loadingDiagnostico ? (
                            <div className="py-12 text-center text-gray-500 text-xs">
                                <div className="w-6 h-6 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                Analizando texto de observaciones y ejecutando algoritmos de extracción...
                            </div>
                        ) : diagnosticoData?.aspectos && diagnosticoData.aspectos.length > 0 ? (
                            <div className="space-y-4">
                                {diagnosticoData.aspectos.map((asp: any) => (
                                    <div key={asp.letraAspecto} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-7 h-7 rounded-lg bg-cyan-700 text-white font-black text-xs flex items-center justify-center">
                                                    {asp.letraAspecto}
                                                </span>
                                                <span className="font-bold text-slate-800">{asp.aspecto}</span>
                                            </div>
                                            {asp.formulaAsignada && (
                                                <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                                                    Fórmula: {asp.formulaAsignada}
                                                </span>
                                            )}
                                        </div>

                                        {/* Observación textual */}
                                        <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 text-[11px] text-slate-700 leading-relaxed">
                                            <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px] block mb-0.5">
                                                Texto de la Observación (Acta):
                                            </span>
                                            <p className="italic">{asp.observacion}</p>
                                        </div>

                                        {/* Alertas Técnicas */}
                                        {asp.alertas && asp.alertas.length > 0 && (
                                            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] space-y-1">
                                                <span className="font-bold uppercase tracking-wider text-[9px] block text-amber-800">
                                                    Alertas de Extracción:
                                                </span>
                                                {asp.alertas.map((al: string, alIdx: number) => (
                                                    <p key={alIdx} className="flex items-start gap-1.5 font-medium">
                                                        <span>⚠️</span>
                                                        <span>{al}</span>
                                                    </p>
                                                ))}
                                            </div>
                                        )}

                                        {/* Tabla Comparativa de Variables */}
                                        {Object.keys(asp.comparacionVariables || {}).length > 0 ? (
                                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                                        <tr>
                                                            <th className="p-2">Variable</th>
                                                            <th className="p-2 text-center">Clásica</th>
                                                            <th className="p-2 text-center">Robusta C4</th>
                                                            <th className="p-2 text-center">Estado</th>
                                                            <th className="p-2">Fuente Detectada</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 text-[11px]">
                                                        {Object.entries(asp.comparacionVariables).map(([vKey, vComp]: [string, any]) => (
                                                            <tr key={vKey} className={!vComp.coincide ? 'bg-amber-50/50' : ''}>
                                                                <td className="p-2 font-mono font-bold text-slate-800">{vKey}</td>
                                                                <td className="p-2 text-center font-mono text-slate-600">{vComp.clasico}</td>
                                                                <td className="p-2 text-center font-mono font-bold text-cyan-800">{vComp.robusto}</td>
                                                                <td className="p-2 text-center">
                                                                    {vComp.coincide ? (
                                                                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold text-[9px]">
                                                                            Coincide
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-black text-[9px]">
                                                                            Difiere ⚠️
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="p-2 text-slate-500 text-[10px]">
                                                                    {asp.fuentes?.[vKey] || 'conteo general'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-slate-400 italic">No requiere variables específicas de conteo.</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-8 text-center text-slate-400 text-xs">
                                No se encontraron aspectos con incumplimiento (NC) para diagnosticar en este folio.
                            </div>
                        )}

                        <div className="flex justify-end pt-3 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setIsDiagnosticoOpen(false)}
                                className="px-5 py-2 rounded-xl text-white bg-slate-900 hover:bg-black text-xs font-bold transition-all shadow-md cursor-pointer"
                            >
                                Cerrar Diagnóstico
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
            `}</style>
        </>
    )
}
