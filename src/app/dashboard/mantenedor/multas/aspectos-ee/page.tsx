'use client'

import { useState, useEffect } from 'react'
import { getAspectosEE, saveAspectoEE, deleteAspectoEE, getLicitaciones, testFormula, getPmpaLevelsForFolio } from './actions'

export default function AspectosEEPage() {
    const [aspectos, setAspectos] = useState<any[]>([])
    const [licitaciones, setLicitaciones] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Help Modal
    const [showHelp, setShowHelp] = useState(false)

    // Test Formula State
    const [testFolio, setTestFolio] = useState('')
    const [testResult, setTestResult] = useState<any>(null)
    const [testing, setTesting] = useState(false)
    const [testError, setTestError] = useState('')
    const [testCustomValues, setTestCustomValues] = useState<any>({})
    const [pmpaLevels, setPmpaLevels] = useState<any[]>([])
    const [loadingLevels, setLoadingLevels] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        id: '',
        licId: '',
        letra: '',
        descripcion: '',
        formula: '',
        solucionable: ''
    })
    const [isEdit, setIsEdit] = useState(false)
    const [formulaError, setFormulaError] = useState('')

    const RESERVED_KEYWORDS = ['UTM', 'RACIONES', 'MATERIAPRIMA', 'MATERIAPRIMATPMPAP', 'INSTRUMENTO', 'MANIPULADORA', 'MANIPULADORAAFECTADA', 'NIVELCONTROLADO', 'CANTSERVICIO', 'ELEMENTOS']

    const fetchData = async () => {
        setLoading(true)
        const [resAsp, resLic] = await Promise.all([getAspectosEE(), getLicitaciones()])
        if (resAsp.aspectos) setAspectos(resAsp.aspectos)
        if (resLic.licitaciones) setLicitaciones(resLic.licitaciones)
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError('')
        setSuccess('')

        const res = await saveAspectoEE({
            id: isEdit ? formData.id : undefined,
            licId: parseInt(formData.licId),
            letra: formData.letra,
            descripcion: formData.descripcion,
            formula: formData.formula,
            solucionable: formData.solucionable
        })

        if (res.error) {
            setError(res.error)
        } else {
            setSuccess('Aspecto guardado correctamente.')
            setFormData({ id: '', licId: '', letra: '', descripcion: '', formula: '', solucionable: '' })
            setIsEdit(false)
            fetchData()
        }
        setSaving(false)
    }

    const handleEdit = (asp: any) => {
        setFormData({
            id: asp.id,
            licId: String(asp.licId),
            letra: asp.letra,
            descripcion: asp.descripcion || '',
            formula: asp.formula || '',
            solucionable: asp.solucionable || ''
        })
        setIsEdit(true)
        setError('')
        setSuccess('')
        setTestResult(null)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este aspecto?')) return
        const res = await deleteAspectoEE(id)
        if (res.error) setError(res.error)
        else fetchData()
    }

    const handleTest = async () => {
        if (!testFolio || !formData.formula) {
            setTestError('Ingrese un folio y asegúrese que el aspecto tenga una fórmula.')
            return
        }
        setTesting(true)
        setTestError('')
        setTestResult(null)
        
        const res = await testFormula(testFolio, formData.formula, {
            materiaPrima: Number(testCustomValues.MATERIAPRIMA || 0),
            instrumento: Number(testCustomValues.INSTRUMENTO || 0),
            manipuladora: Number(testCustomValues.MANIPULADORA || 0),
            manipuladoraAfectada: Number(testCustomValues.MANIPULADORAAFECTADA || 0),
            nivelControlado: Number(testCustomValues.NIVELCONTROLADO || 0),
            cantServicio: Number(testCustomValues.CANTSERVICIO || 0),
            elementos: Number(testCustomValues.ELEMENTOS || 0),
            materiaPrimaTpmpap: Number(testCustomValues.MATERIAPRIMATPMPAP || 0)
        })
        if (res.error) setTestError(res.error)
        else setTestResult(res.data)
        
        setTesting(false)
    }

    const fetchLevels = async (folio: string) => {
        if (!folio || folio.length < 5) return
        setLoadingLevels(true)
        const res = await getPmpaLevelsForFolio(folio)
        if (res.levels) setPmpaLevels(res.levels)
        setLoadingLevels(false)
    }

    const keywords = ['MATERIAPRIMA', 'MATERIAPRIMATPMPAP', 'INSTRUMENTO', 'MANIPULADORA', 'MANIPULADORAAFECTADA', 'NIVELCONTROLADO', 'CANTSERVICIO', 'ELEMENTOS']
    const activeKeywords = keywords.filter(k => formData.formula.toUpperCase().includes(k))

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>📐</span> Fórmulas de Aspecto EE
                    </h2>
                    <p className="text-gray-500 mt-1">Asocia letras de aspectos y fórmulas de multas por licitación.</p>
                </div>
                <button 
                    onClick={() => setShowHelp(true)}
                    className="mt-4 sm:mt-0 w-10 h-10 flex items-center justify-center bg-cyan-50 text-cyan-600 rounded-full hover:bg-cyan-100 transition-colors border border-cyan-100 shadow-sm font-bold text-xl"
                    title="Ayuda de Fórmulas"
                >
                    ?
                </button>
            </div>

            {/* Help Modal */}
            {showHelp && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-100">
                        <div className="p-6 border-b border-gray-100 bg-cyan-600 flex justify-between items-center">
                            <h3 className="text-white font-bold text-xl flex items-center gap-2">
                                <span>📙</span> Diccionario de Palabras Reservadas
                            </h3>
                            <button onClick={() => setShowHelp(false)} className="text-white/80 hover:text-white text-2xl font-bold">&times;</button>
                        </div>
                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="space-y-4">
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <h4 className="font-black text-cyan-700 text-sm tracking-widest uppercase mb-1">UTM</h4>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Representa el valor de la **Unidad Tributaria Mensual**. 
                                        El sistema buscará automáticamente el valor correspondiente al **Mes y Año de la Fecha de Supervisión** del folio controlado.
                                    </p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <h4 className="font-black text-cyan-700 text-sm tracking-widest uppercase mb-1">RACIONES</h4>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Representa la cantidad de raciones (**RacEqJunaeb**) del PMPA. 
                                        El sistema suma automáticamente los registros que coincidan con el **RBD**, **Licitación**, **Año**, **Mes** y **Código de Servicio** del folio.
                                    </p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <h4 className="font-black text-cyan-700 text-sm tracking-widest uppercase mb-1">MateriaPrima</h4>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Palabra reservada que habilitará un campo de entrada para que el usuario ingrese información sobre la materia prima durante la supervisión.
                                    </p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <h4 className="font-black text-cyan-700 text-sm tracking-widest uppercase mb-1">MateriaPrimaTpmpap</h4>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Palabra reservada que habilitará un campo de entrada para que el usuario ingrese información sobre la materia prima según TPMPAP.
                                    </p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <h4 className="font-black text-cyan-700 text-sm tracking-widest uppercase mb-1">Instrumento</h4>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Palabra reservada que habilitará un campo de entrada para registrar el instrumento utilizado en la medición.
                                    </p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <h4 className="font-black text-cyan-700 text-sm tracking-widest uppercase mb-1">Manipuladora</h4>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Palabra reservada que habilitará un campo de entrada para registrar el nombre o RUT de la manipuladora observada.
                                    </p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <h4 className="font-black text-cyan-700 text-sm tracking-widest uppercase mb-1">ManipuladoraAfectada</h4>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Palabra reservada que habilitará un campo de entrada para registrar la cantidad de manipuladoras afectadas.
                                    </p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <h4 className="font-black text-cyan-700 text-sm tracking-widest uppercase mb-1">NivelControlado</h4>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Habilitará una lista desplegable con los niveles disponibles en el PMPA (filtrados por RBD y Periodo). Al seleccionar uno, el sistema utilizará la sumatoria de raciones (**RacEqJunaeb**) de dicho nivel.
                                    </p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <h4 className="font-black text-cyan-700 text-sm tracking-widest uppercase mb-1">CantServicio</h4>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Palabra reservada que habilitará un campo de entrada para registrar la cantidad del servicio observado o controlado.
                                    </p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <h4 className="font-black text-cyan-700 text-sm tracking-widest uppercase mb-1">ELEMENTOS</h4>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Palabra reservada relacionada con los elementos EPP (Guantes, delantales, pecheras, etc.). Habilitará un campo de entrada para su registro.
                                    </p>
                                </div>
                            </div>
                            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-amber-800 text-sm">
                                <strong>💡 Tips:</strong>
                                <ul className="list-disc ml-4 mt-2 space-y-1">
                                    <li>Las fórmulas aceptan operadores estándar: <code>+</code>, <code>-</code>, <code>*</code>, <code>/</code> y paréntesis <code>( )</code>.</li>
                                    <li>Puedes usar decimales con punto (Ej: <code>0.05</code>).</li>
                                    <li>Ejemplo de multa del 5% raciones: <code>0.05 * UTM * RACIONES</code>.</li>
                                </ul>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 border-t border-gray-100 text-right">
                            <button onClick={() => setShowHelp(false)} className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors">Entendido</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Formulario */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 text-lg mb-4 pb-2 border-b">
                            {isEdit ? 'Editar Aspecto' : 'Nuevo Aspecto'}
                        </h3>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Licitación</label>
                                <select
                                    required
                                    disabled={isEdit}
                                    value={formData.licId}
                                    onChange={e => setFormData({ ...formData, licId: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                                >
                                    <option value="">Seleccione Licitación</option>
                                    {licitaciones.map(lic => (
                                        <option key={lic.licId} value={lic.licId}>
                                            {lic.licId} {lic.licitacionHomologada ? `(${lic.licitacionHomologada})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Letra Aspecto</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={5}
                                    placeholder="Ej: A, B, C..."
                                    value={formData.letra}
                                    onChange={e => setFormData({ ...formData, letra: e.target.value.toUpperCase() })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Descripción</label>
                                <textarea
                                    rows={2}
                                    value={formData.descripcion}
                                    onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Solucionable / No Solucionable</label>
                                <select
                                    required
                                    value={formData.solucionable}
                                    onChange={e => setFormData({ ...formData, solucionable: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-bold"
                                >
                                    <option value="">Seleccione Criterio</option>
                                    <option value="Solucionable">Solucionable</option>
                                    <option value="No Solucionable">No Solucionable</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1 flex justify-between">
                                    <span>Fórmula Multa</span>
                                    <span className="text-cyan-500 lowercase font-medium">Ej: 0.05 * UTM * RACIONES</span>
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Ej: (Incumplimientos * 0.5) * UTM"
                                    value={formData.formula}
                                    onChange={e => {
                                        const val = e.target.value
                                        setFormData({ ...formData, formula: val })
                                        
                                        // Validar palabras reservadas
                                        if (val) {
                                            const words = val.match(/[A-Za-z]+/g) || []
                                            const invalidWords = words.filter(w => !RESERVED_KEYWORDS.includes(w.toUpperCase()))
                                            if (invalidWords.length > 0) {
                                                setFormulaError(`Palabra(s) no reconocida(s): ${invalidWords.join(', ')}`)
                                            } else {
                                                setFormulaError('')
                                            }
                                        } else {
                                            setFormulaError('')
                                        }
                                    }}
                                    className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-mono text-sm transition-all ${formulaError ? 'border-red-400 ring-red-100' : 'border-gray-200'}`}
                                />
                                {formulaError && <p className="text-[10px] text-red-500 font-bold mt-1 animate-pulse">⚠️ {formulaError}</p>}
                            </div>

                            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
                            {success && <p className="text-xs text-emerald-500 font-medium">{success}</p>}

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="submit"
                                    disabled={saving || !!formulaError}
                                    className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                                >
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                                {isEdit && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEdit(false)
                                            setFormData({ id: '', licId: '', letra: '', descripcion: '', formula: '', solucionable: '' })
                                            setTestResult(null)
                                        }}
                                        className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-bold transition-all"
                                    >
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Probar Fórmula */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 text-lg mb-4 pb-2 border-b flex items-center gap-2">
                            <span>🧪</span> Probar Fórmula
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Folio de Prueba</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Ej: 2024004477"
                                        value={testFolio}
                                        onChange={e => {
                                            setTestFolio(e.target.value)
                                            if (e.target.value.length >= 8) fetchLevels(e.target.value)
                                        }}
                                        className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-sm"
                                    />
                                </div>
                            </div>

                            {/* Dynamic Inputs for Keywords */}
                            {activeKeywords.length > 0 && (
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valores para la Fórmula:</p>
                                    {activeKeywords.map(k => (
                                        <div key={k}>
                                            <label className="block text-[10px] font-bold text-slate-600 mb-1">{k}</label>
                                            {k === 'NIVELCONTROLADO' ? (
                                                <select
                                                    value={testCustomValues[k] || ''}
                                                    onChange={e => setTestCustomValues({ ...testCustomValues, [k]: e.target.value })}
                                                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white"
                                                >
                                                    <option value="">Seleccione Nivel...</option>
                                                    {pmpaLevels.map(l => (
                                                        <option key={l.nivel} value={l.raciones}>{l.nivel} ({l.raciones} rac)</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type="number"
                                                    placeholder="Ingrese valor..."
                                                    value={testCustomValues[k] || ''}
                                                    onChange={e => setTestCustomValues({ ...testCustomValues, [k]: e.target.value })}
                                                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button
                                type="button"
                                disabled={testing || !formData.formula || !testFolio}
                                onClick={handleTest}
                                className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-colors disabled:opacity-50"
                            >
                                {testing ? 'Calculando...' : 'Probar Fórmula'}
                            </button>

                            {testError && <p className="text-xs text-red-500">{testError}</p>}

                            {testResult && (
                                <div className="p-4 bg-cyan-50 rounded-2xl border border-cyan-100 space-y-2">
                                    <div className="flex justify-between text-xs border-b border-cyan-100 pb-1">
                                        <span className="text-gray-500">RBD: {testResult.rbd}</span>
                                        <span className="text-gray-500">Servicio: {testResult.servicio}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div><span className="text-gray-400">UTM:</span> <span className="font-bold text-gray-700">${testResult.utm.toLocaleString()}</span></div>
                                        <div><span className="text-gray-400">Raciones:</span> <span className="font-bold text-gray-700">{testResult.raciones.toLocaleString()}</span></div>
                                    </div>
                                    <div className="pt-1">
                                        <div className="text-[10px] text-gray-400 uppercase font-black mb-1">Cálculo Evaluado:</div>
                                        <div className="font-mono text-[11px] text-cyan-800 bg-white/50 p-1.5 rounded border border-cyan-100 overflow-x-auto">
                                            {testResult.formulaEvaluada}
                                        </div>
                                    </div>
                                    <div className="pt-2 flex justify-between items-end border-t border-cyan-100">
                                        <span className="text-xs font-bold text-cyan-700 uppercase">Resultado Multa:</span>
                                        <span className="text-lg font-black text-cyan-900">${testResult.resultado.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabla */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Licitación</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Letra</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Fórmula</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Criterio</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">Cargando...</td></tr>
                                ) : aspectos.length > 0 ? (
                                    aspectos.map(asp => (
                                        <tr key={asp.id} className="hover:bg-gray-50/50 transition-colors group text-sm">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{asp.licId}</div>
                                                <div className="text-xs text-gray-400">{asp.licitacion?.licitacionHomologada}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 font-black border border-cyan-100">
                                                    {asp.letra}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 max-w-xs">
                                                <div className="font-mono text-xs text-gray-600 truncate" title={asp.formula}>
                                                    {asp.formula || 'Sin fórmula'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {asp.solucionable ? (
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${asp.solucionable === 'Solucionable' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                                        {asp.solucionable}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">No definido</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEdit(asp)}
                                                        className="p-2 text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(asp.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No hay aspectos configurados.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
