'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { searchColegiosMatriz } from '../../actions'

const CATEGORIES = [
    { id: 'PATIO_SERVICIO', label: 'Patio de servicio', activeTabClass: 'bg-amber-100 text-amber-900 border-amber-300' },
    { id: 'BODEGA', label: 'Bodega', activeTabClass: 'bg-orange-100 text-orange-950 border-orange-300' },
    { id: 'COCINA', label: 'Cocina', activeTabClass: 'bg-emerald-100 text-emerald-950 border-emerald-300' },
    { id: 'BANO', label: 'Baño', activeTabClass: 'bg-cyan-100 text-cyan-950 border-cyan-300' },
    { id: 'LEVANTAMIENTO_GENERAL', label: 'Levantamiento General', activeTabClass: 'bg-blue-100 text-blue-950 border-blue-300' }
]

export default function MatrizResponderClient({ matrix, uts, colegios, sessionUser }: any) {
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [selectedRbd, setSelectedRbd] = useState<string>('')
    const [activeCategory, setActiveCategory] = useState<string>('PATIO_SERVICIO')
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)
    const [selectedColegioData, setSelectedColegioData] = useState<any>(null)

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSearch = async (query: string) => {
        setSearchQuery(query)
        if (query.length < 3) {
            setSearchResults([])
            setShowDropdown(false)
            return
        }
        
        setIsSearching(true)
        setShowDropdown(true)
        const res = await searchColegiosMatriz(query)
        setSearchResults(res.colegios || [])
        setIsSearching(false)
    }

    const selectColegio = (colegio: any) => {
        setSelectedRbd(String(colegio.colRBD))
        setSelectedColegioData(colegio)
        setSearchQuery(String(colegio.colRBD))
        setShowDropdown(false)
    }

    // Auto-derived UT and Colegio Name
    const selectedColegio = useMemo(() => {
        if (!selectedRbd) return null
        return selectedColegioData || null
    }, [selectedRbd, selectedColegioData])

    // Answers state: Record<preguntaId, { valor: string, archivos: File[] }>
    const [answers, setAnswers] = useState<Record<string, { valor: string, archivos: File[] }>>({})

    const instructions = useMemo(() => {
        try { return matrix.instrucciones ? JSON.parse(matrix.instrucciones) : {} } catch(e) { return {} }
    }, [matrix.instrucciones])

    const handleAnswerChange = (preguntaId: string, valor: string) => {
        setAnswers(prev => ({
            ...prev,
            [preguntaId]: { ...(prev[preguntaId] || { archivos: [] }), valor }
        }))
    }

    const handleFileChange = (preguntaId: string, files: FileList | null) => {
        if (!files) return
        const newFiles = Array.from(files)
        
        // Validate types
        const validFiles = newFiles.filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'))
        if (validFiles.length !== newFiles.length) {
            alert('Solo se permiten archivos PDF o Imágenes.')
        }

        setAnswers(prev => {
            const current = prev[preguntaId]?.archivos || []
            const combined = [...current, ...validFiles]
            if (combined.length > 5) {
                alert('Solo se permiten hasta 5 archivos por pregunta.')
                return prev
            }
            return {
                ...prev,
                [preguntaId]: { ...(prev[preguntaId] || { valor: '' }), archivos: combined }
            }
        })
    }

    const removeFile = (preguntaId: string, fileIndex: number) => {
        setAnswers(prev => {
            const current = prev[preguntaId]?.archivos || []
            return {
                ...prev,
                [preguntaId]: { ...prev[preguntaId], archivos: current.filter((_, idx) => idx !== fileIndex) }
            }
        })
    }

    const getSelectColorClass = (val: string) => {
        switch (val) {
            case 'BUENO_CUMPLE': return 'bg-emerald-100 text-emerald-900'
            case 'MALO_NO_CUMPLE':
            case 'NO_HAY_REQUIERE': return 'bg-red-100 text-red-900'
            case 'NO_HAY_NO_REQUIERE':
            case 'NO_EXISTE':
            case 'NO_APLICA': return 'bg-slate-200 text-slate-800'
            default: return 'bg-white'
        }
    }

    const handleSubmit = async () => {
        if (!selectedRbd || !selectedColegio) {
            return alert('Debe seleccionar un colegio (RBD) válido.')
        }

        // Validate required fields
        for (const detalle of matrix.detalles) {
            if (detalle.obligatorio) {
                const ans = answers[detalle.id]
                if (!ans || (!ans.valor && detalle.tipoRespuesta !== 'ADJUNTAR') || (detalle.tipoRespuesta === 'ADJUNTAR' && ans.archivos.length === 0)) {
                    setActiveCategory(detalle.seccion)
                    return alert(`Debe responder la pregunta obligatoria: "${detalle.preguntaNombre}" en la sección correspondiente.`)
                }
            }
        }

        setSaving(true)

        // Convert files to base64
        const formattedAnswers = await Promise.all(
            matrix.detalles.map(async (detalle: any) => {
                const ans = answers[detalle.id]
                let adjuntoUrl = ''
                if (ans && ans.archivos.length > 0) {
                    // For simplicity, we stringify an array of base64s. In production, an S3 upload is better.
                    const b64Files = await Promise.all(ans.archivos.map(file => {
                        return new Promise<string>((resolve) => {
                            const reader = new FileReader()
                            reader.onloadend = () => resolve(reader.result as string)
                            reader.readAsDataURL(file)
                        })
                    }))
                    adjuntoUrl = JSON.stringify(b64Files)
                }

                return {
                    preguntaId: detalle.id,
                    valor: ans?.valor || '',
                    adjuntoUrl
                }
            })
        )

        try {
            const payload = {
                cabeceraId: matrix.id,
                ut: selectedColegio.colut,
                rbd: selectedColegio.colRBD,
                respuestas: formattedAnswers
            }
            
            const res = await fetch('/api/matriz-riesgo/save-respuesta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            const data = await res.json()
            
            if (data.success) {
                alert('¡Matriz guardada con éxito!')
                router.push('/dashboard/matriz-riesgo/ingresar')
            } else {
                alert(data.error || 'Ocurrió un error.')
            }
        } catch (error) {
            console.error(error)
            alert('Error de conexión.')
        }
        setSaving(false)
    }

    const renderQuestionInput = (detalle: any) => {
        const ans = answers[detalle.id] || { valor: '', archivos: [] }
        
        switch (detalle.tipoRespuesta) {
            case 'SI_NO':
                return (
                    <select className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-500"
                        value={ans.valor} onChange={e => handleAnswerChange(detalle.id, e.target.value)}>
                        <option value="">Seleccione</option>
                        <option value="SI">Sí</option>
                        <option value="NO">No</option>
                    </select>
                )
            case 'EXISTE_NO_EXISTE':
                return (
                    <select className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-500"
                        value={ans.valor} onChange={e => handleAnswerChange(detalle.id, e.target.value)}>
                        <option value="">Seleccione</option>
                        <option value="EXISTE">Existe</option>
                        <option value="NO_EXISTE">No Existe</option>
                    </select>
                )
            case 'NUMERICO':
                return (
                    <input type="number" className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-500"
                        value={ans.valor} onChange={e => handleAnswerChange(detalle.id, e.target.value)} />
                )
            case 'OBSERVACION':
                return (
                    <textarea className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-500 min-h-[60px]"
                        value={ans.valor} onChange={e => handleAnswerChange(detalle.id, e.target.value)} />
                )
            case 'ADJUNTAR':
                return (
                    <div className="space-y-2">
                        <input 
                            type="file" 
                            multiple 
                            accept="image/*,application/pdf"
                            onChange={e => handleFileChange(detalle.id, e.target.files)}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
                            disabled={ans.archivos.length >= 5}
                        />
                        {ans.archivos.length > 0 && (
                            <ul className="text-xs space-y-1">
                                {ans.archivos.map((f: File, i: number) => (
                                    <li key={i} className="flex items-center gap-2 text-slate-600 bg-slate-50 px-2 py-1 rounded">
                                        <button onClick={() => removeFile(detalle.id, i)} className="text-red-500 font-bold hover:text-red-700">✕</button>
                                        <span className="truncate max-w-[200px]">{f.name}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="text-[10px] text-slate-400">Máximo 5 archivos (PDF o Imágenes).</p>
                    </div>
                )
            case 'ENCUESTA':
                return (
                    <select className={`w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-500 transition-colors ${getSelectColorClass(ans.valor)}`}
                        value={ans.valor} onChange={e => handleAnswerChange(detalle.id, e.target.value)}>
                        <option value="" className="bg-white text-black">Seleccione</option>
                        <option value="BUENO_CUMPLE" className="bg-emerald-100 text-emerald-900">Bueno / Cumple</option>
                        <option value="MALO_NO_CUMPLE" className="bg-red-100 text-red-900">Malo requiere cambio o reparación / No Cumple</option>
                        <option value="NO_HAY_REQUIERE" className="bg-red-100 text-red-900">No hay y requiere instalar</option>
                        <option value="NO_HAY_NO_REQUIERE" className="bg-slate-200 text-slate-800">No hay y no requiere</option>
                        <option value="NO_EXISTE" className="bg-slate-200 text-slate-800">No existe</option>
                        <option value="NO_APLICA" className="bg-slate-200 text-slate-800">No aplica</option>
                    </select>
                )
            default:
                return <input type="text" className="w-full p-2 border border-gray-200 rounded-lg" value={ans.valor} onChange={e => handleAnswerChange(detalle.id, e.target.value)} />
        }
    }

    const currentQuestions = matrix.detalles.filter((d: any) => d.seccion === activeCategory)

    return (
        <div className="space-y-6">
            {/* Cabecera (Ocultos: Fecha Ingreso, Supervisor, Correo. Visibles: RBD, UT, Colegio) */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Datos del Establecimiento</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="relative" ref={searchRef}>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">RBD o Nombre de Colegio</label>
                        <input 
                            type="text"
                            placeholder="Buscar (Mínimo 3 caracteres)"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-slate-800 font-bold text-sm"
                            value={searchQuery}
                            onChange={e => {
                                handleSearch(e.target.value)
                                if (e.target.value !== selectedRbd) {
                                    setSelectedRbd('')
                                    setSelectedColegioData(null)
                                }
                            }}
                            onFocus={() => {
                                if (searchQuery.length >= 3) setShowDropdown(true)
                            }}
                        />
                        {showDropdown && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                {isSearching ? (
                                    <div className="p-3 text-sm text-slate-500 text-center">Buscando...</div>
                                ) : searchResults.length > 0 ? (
                                    <ul className="py-1">
                                        {searchResults.map(col => (
                                            <li 
                                                key={col.id}
                                                onClick={() => selectColegio(col)}
                                                className="px-4 py-2 hover:bg-cyan-50 cursor-pointer text-sm text-slate-700 transition-colors"
                                            >
                                                <span className="font-bold text-cyan-800">{col.colRBD}</span> - {col.nombreEstablecimiento}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="p-3 text-sm text-slate-500 text-center">No se encontraron colegios activos.</div>
                                )}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">UT</label>
                        <div className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-bold text-sm">
                            {selectedColegio ? selectedColegio.colut : '---'}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Establecimiento</label>
                        <div className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-bold text-sm truncate">
                            {selectedColegio ? selectedColegio.nombreEstablecimiento : '---'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Pestañas */}
            <div className="flex gap-2 border-b border-slate-100 pb-2 overflow-x-auto">
                {CATEGORIES.map(cat => {
                    const isActive = activeCategory === cat.id
                    return (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${isActive ? cat.activeTabClass : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent'}`}
                        >
                            {cat.label}
                        </button>
                    )
                })}
            </div>

            {/* Contenido de Pestaña */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                {instructions[activeCategory] && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6">
                        <p className="text-xs font-black text-amber-800 uppercase mb-1">Nota Informativa</p>
                        <p className="text-sm text-slate-700">{instructions[activeCategory]}</p>
                    </div>
                )}

                <div className="space-y-6">
                    {currentQuestions.map((q: any, i: number) => (
                        <div key={q.id} className="border-b border-slate-50 pb-6 last:border-0 last:pb-0">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-800 flex items-start gap-2">
                                        <span className="bg-slate-100 text-slate-500 px-2 rounded-md text-xs mt-0.5">{i + 1}</span>
                                        {q.preguntaNombre}
                                        {q.obligatorio && <span className="text-red-500">*</span>}
                                    </p>
                                </div>
                                <div className="w-full md:w-64 shrink-0">
                                    {renderQuestionInput(q)}
                                </div>
                            </div>
                        </div>
                    ))}
                    {currentQuestions.length === 0 && (
                        <p className="text-center text-slate-400 text-sm py-8">No hay preguntas configuradas en esta sección.</p>
                    )}
                </div>
            </div>

            {/* Botón Guardar */}
            <div className="flex justify-end pt-4 pb-12">
                <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="px-8 py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl font-black shadow-lg transition-all"
                >
                    {saving ? 'Guardando...' : 'Finalizar y Guardar'}
                </button>
            </div>
        </div>
    )
}
