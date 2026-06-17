'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateRespuesta } from '../actions'

const CATEGORIES = [
    { id: 'PATIO_SERVICIO', label: 'Patio de servicio', activeTabClass: 'bg-amber-100 text-amber-900 border-amber-300' },
    { id: 'BODEGA', label: 'Bodega', activeTabClass: 'bg-orange-100 text-orange-950 border-orange-300' },
    { id: 'COCINA', label: 'Cocina', activeTabClass: 'bg-emerald-100 text-emerald-950 border-emerald-300' },
    { id: 'BANO', label: 'Baño', activeTabClass: 'bg-cyan-100 text-cyan-950 border-cyan-300' },
    { id: 'LEVANTAMIENTO_GENERAL', label: 'Levantamiento General', activeTabClass: 'bg-blue-100 text-blue-950 border-blue-300' }
]

export default function RespuestaEditorClient({ respuestaCabecera, colegioNombre, mode }: any) {
    const router = useRouter()
    const matrix = respuestaCabecera.cabecera
    const isEdit = mode === 'edit'
    
    const [saving, setSaving] = useState(false)
    const [activeCategory, setActiveCategory] = useState<string>('PATIO_SERVICIO')

    // Parse answers from DB
    const initialAnswers = useMemo(() => {
        const parsed: Record<string, { valor: string, archivos: File[], oldFiles: string[] }> = {}
        if (respuestaCabecera.detalles) {
            for (const d of respuestaCabecera.detalles) {
                let oldFiles: string[] = []
                if (d.adjuntoUrl) {
                    try {
                        oldFiles = JSON.parse(d.adjuntoUrl)
                        if (!Array.isArray(oldFiles)) oldFiles = [d.adjuntoUrl]
                    } catch {
                        oldFiles = [d.adjuntoUrl]
                    }
                }
                parsed[d.preguntaId] = {
                    valor: d.valor || '',
                    archivos: [],
                    oldFiles
                }
            }
        }
        return parsed
    }, [respuestaCabecera.detalles])

    const [answers, setAnswers] = useState(initialAnswers)

    const handleAnswerChange = (preguntaId: string, valor: string) => {
        if (!isEdit) return
        setAnswers(prev => ({
            ...prev,
            [preguntaId]: { ...(prev[preguntaId] || { archivos: [], oldFiles: [] }), valor }
        }))
    }

    const handleFileChange = (preguntaId: string, files: FileList | null) => {
        if (!isEdit || !files) return
        const newFiles = Array.from(files)
        
        const validFiles = newFiles.filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'))
        if (validFiles.length !== newFiles.length) {
            alert('Solo se permiten archivos PDF o Imágenes.')
        }

        setAnswers(prev => {
            const currentObj = prev[preguntaId] || { valor: '', archivos: [], oldFiles: [] }
            const combined = [...currentObj.archivos, ...validFiles]
            const totalCount = combined.length + currentObj.oldFiles.length
            
            if (totalCount > 5) {
                alert('Solo se permiten hasta 5 archivos por pregunta (contando los ya existentes).')
                return prev
            }
            return {
                ...prev,
                [preguntaId]: { ...currentObj, archivos: combined }
            }
        })
    }

    const removeNewFile = (preguntaId: string, fileIndex: number) => {
        if (!isEdit) return
        setAnswers(prev => {
            const currentObj = prev[preguntaId]
            return {
                ...prev,
                [preguntaId]: { ...currentObj, archivos: currentObj.archivos.filter((_, idx) => idx !== fileIndex) }
            }
        })
    }

    const removeOldFile = (preguntaId: string, oldFileIndex: number) => {
        if (!isEdit) return
        if (!confirm('¿Seguro que desea eliminar este archivo adjunto? (Se aplicará al guardar)')) return
        setAnswers(prev => {
            const currentObj = prev[preguntaId]
            return {
                ...prev,
                [preguntaId]: { ...currentObj, oldFiles: currentObj.oldFiles.filter((_, idx) => idx !== oldFileIndex) }
            }
        })
    }

    const handleSubmit = async () => {
        if (!isEdit) return

        // Validate required
        for (const detalle of matrix.detalles) {
            if (detalle.obligatorio) {
                const ans = answers[detalle.id]
                const hasFiles = ans && (ans.archivos.length > 0 || ans.oldFiles.length > 0)
                if (!ans || (!ans.valor && detalle.tipoRespuesta !== 'ADJUNTAR') || (detalle.tipoRespuesta === 'ADJUNTAR' && !hasFiles)) {
                    setActiveCategory(detalle.seccion)
                    return alert(`Debe responder la pregunta obligatoria: "${detalle.preguntaNombre}" en la sección correspondiente.`)
                }
            }
        }

        setSaving(true)

        const formattedAnswers = await Promise.all(
            matrix.detalles.map(async (detalle: any) => {
                const ans = answers[detalle.id]
                let finalAdjuntos = ans ? [...ans.oldFiles] : []
                
                if (ans && ans.archivos.length > 0) {
                    const b64Files = await Promise.all(ans.archivos.map((file: File) => {
                        return new Promise<string>((resolve) => {
                            const reader = new FileReader()
                            reader.onloadend = () => resolve(reader.result as string)
                            reader.readAsDataURL(file)
                        })
                    }))
                    finalAdjuntos = [...finalAdjuntos, ...b64Files]
                }

                return {
                    preguntaId: detalle.id,
                    valor: ans?.valor || '',
                    adjuntoUrl: finalAdjuntos.length > 0 ? JSON.stringify(finalAdjuntos) : ''
                }
            })
        )

        const res = await updateRespuesta(respuestaCabecera.id, formattedAnswers)
        if (res.success) {
            alert('¡Cambios guardados con éxito!')
            router.push('/dashboard/matriz-riesgo/detalle')
        } else {
            alert(res.error || 'Ocurrió un error al guardar.')
        }
        setSaving(false)
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

    const renderQuestionInput = (detalle: any) => {
        const ans = answers[detalle.id] || { valor: '', archivos: [], oldFiles: [] }
        
        switch (detalle.tipoRespuesta) {
            case 'SI_NO':
                return (
                    <select className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-gray-100 disabled:opacity-70"
                        value={ans.valor} onChange={e => handleAnswerChange(detalle.id, e.target.value)} disabled={!isEdit}>
                        <option value="">Seleccione</option>
                        <option value="SI">Sí</option>
                        <option value="NO">No</option>
                    </select>
                )
            case 'EXISTE_NO_EXISTE':
                return (
                    <select className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-gray-100 disabled:opacity-70"
                        value={ans.valor} onChange={e => handleAnswerChange(detalle.id, e.target.value)} disabled={!isEdit}>
                        <option value="">Seleccione</option>
                        <option value="EXISTE">Existe</option>
                        <option value="NO_EXISTE">No Existe</option>
                    </select>
                )
            case 'NUMERICO':
                return (
                    <input type="number" className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-gray-100 disabled:opacity-70"
                        value={ans.valor} onChange={e => handleAnswerChange(detalle.id, e.target.value)} disabled={!isEdit} />
                )
            case 'OBSERVACION':
                return (
                    <textarea className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-500 min-h-[60px] disabled:bg-gray-100 disabled:opacity-70"
                        value={ans.valor} onChange={e => handleAnswerChange(detalle.id, e.target.value)} disabled={!isEdit} />
                )
            case 'ADJUNTAR':
                return (
                    <div className="space-y-2">
                        {isEdit && (
                            <input 
                                type="file" 
                                multiple 
                                accept="image/*,application/pdf"
                                onChange={e => handleFileChange(detalle.id, e.target.files)}
                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
                                disabled={ans.archivos.length + ans.oldFiles.length >= 5}
                            />
                        )}
                        {(ans.archivos.length > 0 || ans.oldFiles.length > 0) && (
                            <ul className="text-xs space-y-1">
                                {ans.oldFiles.map((b64: string, i: number) => (
                                    <li key={`old-${i}`} className="flex items-center gap-2 text-slate-600 bg-slate-50 px-2 py-1 rounded">
                                        {isEdit && (
                                            <button onClick={() => removeOldFile(detalle.id, i)} className="text-red-500 font-bold hover:text-red-700">✕</button>
                                        )}
                                        <a href={b64} download={`adjunto_${detalle.id}_${i}`} className="truncate max-w-[200px] text-blue-600 hover:underline">
                                            [Descargar/Ver Archivo Adjunto Anterior {i+1}]
                                        </a>
                                    </li>
                                ))}
                                {ans.archivos.map((f: File, i: number) => (
                                    <li key={`new-${i}`} className="flex items-center gap-2 text-slate-600 bg-slate-50 px-2 py-1 rounded">
                                        {isEdit && (
                                            <button onClick={() => removeNewFile(detalle.id, i)} className="text-red-500 font-bold hover:text-red-700">✕</button>
                                        )}
                                        <span className="truncate max-w-[200px] text-green-600">{f.name} (Nuevo)</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="text-[10px] text-slate-400">Máximo 5 archivos (PDF o Imágenes).</p>
                    </div>
                )
            case 'ENCUESTA':
                return (
                    <select className={`w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-70 transition-colors ${!isEdit && !ans.valor ? 'bg-gray-100' : getSelectColorClass(ans.valor)}`}
                        value={ans.valor} onChange={e => handleAnswerChange(detalle.id, e.target.value)} disabled={!isEdit}>
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
                return null
        }
    }

    const currentQuestions = matrix.detalles.filter((d: any) => d.seccion === activeCategory).sort((a: any, b: any) => a.orden - b.orden)

    return (
        <div className="space-y-6 pb-20">
            {/* Header info */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-start">
                    <div>
                        <Link href="/dashboard/matriz-riesgo/detalle" className="text-sm text-cyan-600 font-bold hover:underline flex items-center gap-1 mb-2">
                            ← Volver al listado
                        </Link>
                        <h1 className="text-2xl font-black tracking-tight text-slate-800">
                            {isEdit ? 'Modificar Respuesta' : 'Ver Respuesta'}: {matrix.titulo} ({matrix.anio})
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Licitación: <span className="font-bold">{respuestaCabecera.licId}</span> | 
                            UT: <span className="font-bold">{respuestaCabecera.ut}</span> | 
                            Establecimiento: <span className="font-bold text-cyan-600">{respuestaCabecera.rbd} - {colegioNombre}</span>
                        </p>
                    </div>
                    {isEdit && (
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
                        >
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    )}
                </div>
            </div>

            {/* Formulario */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex flex-wrap border-b border-gray-100 bg-slate-50 p-2 gap-2">
                    {CATEGORIES.map(cat => {
                        const count = matrix.detalles.filter((d: any) => d.seccion === cat.id).length
                        if (count === 0) return null
                        const isActive = activeCategory === cat.id

                        return (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                    isActive 
                                    ? cat.activeTabClass + ' shadow-sm' 
                                    : 'text-slate-500 hover:bg-white hover:text-slate-700'
                                }`}
                            >
                                {cat.label} ({count})
                            </button>
                        )
                    })}
                </div>

                <div className="p-6 space-y-6">
                    {currentQuestions.map((q: any, idx: number) => (
                        <div key={q.id} className="p-4 bg-slate-50 rounded-xl border border-gray-100">
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                {idx + 1}. {q.preguntaNombre}
                                {q.obligatorio && <span className="text-red-500 ml-1" title="Obligatorio">*</span>}
                            </label>
                            {renderQuestionInput(q)}
                        </div>
                    ))}
                    {currentQuestions.length === 0 && (
                        <p className="text-center text-slate-400 py-10 font-medium">No hay preguntas configuradas en esta sección.</p>
                    )}
                </div>
            </div>
        </div>
    )
}
