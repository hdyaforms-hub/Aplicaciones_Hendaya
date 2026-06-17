'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { saveMatrixTemplate, deleteMatrix } from '../actions'

type Licitacion = {
    licId: number
    licitacionHomologada: string | null
    estado: number
}

type MatrizDetalle = {
    id: string
    cabeceraId: string
    preguntaNombre: string
    tipoRespuesta: string
    obligatorio: boolean
    seccion: string
    orden: number
    gravedad: number | null
    probabilidad: number | null
    nivelRiesgo: number | null
    justificacion: string | null
    riesgoSignificativo: string | null
    recursoNecesario: string | null
    resultadoEsperado: string | null
    respImplementacion: string | null
    respSeguimiento: string | null
    evidenciaCumplimiento: string | null
    evidenciaEficacia: string | null
}

type Matriz = {
    id: string
    licId: number
    anio: number
    titulo: string
    estado: boolean
    instrucciones?: string | null
    licitacion: Licitacion
    detalles: MatrizDetalle[]
}

interface NuevaMatrizEditorClientProps {
    matrix: Matriz
    licitaciones: Licitacion[]
}

// Categories definitions
const CATEGORIES = [
    { id: 'PATIO_SERVICIO', label: 'Patio de servicio', colorName: 'yellow', activeTabClass: 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-200/50', bgClass: 'bg-amber-50/30 border-amber-200/70', bulletColor: 'bg-amber-500' },
    { id: 'BODEGA', label: 'Bodega', colorName: 'orange', activeTabClass: 'bg-orange-100 text-orange-950 border-orange-300 ring-2 ring-orange-200/50', bgClass: 'bg-orange-50/30 border-orange-200/70', bulletColor: 'bg-orange-500' },
    { id: 'COCINA', label: 'Cocina', colorName: 'green', activeTabClass: 'bg-emerald-100 text-emerald-950 border-emerald-300 ring-2 ring-emerald-200/50', bgClass: 'bg-emerald-50/30 border-emerald-200/70', bulletColor: 'bg-emerald-500' },
    { id: 'BANO', label: 'Baño', colorName: 'celeste', activeTabClass: 'bg-cyan-100 text-cyan-950 border-cyan-300 ring-2 ring-cyan-200/50', bgClass: 'bg-cyan-50/30 border-cyan-200/70', bulletColor: 'bg-cyan-500' },
    { id: 'LEVANTAMIENTO_GENERAL', label: 'Levantamiento General', colorName: 'blue', activeTabClass: 'bg-blue-100 text-blue-950 border-blue-300 ring-2 ring-blue-200/50', bgClass: 'bg-blue-50/30 border-blue-200/70', bulletColor: 'bg-blue-500' }
]

const getSelectBgColor = (val: any) => {
    if (val === '1' || val === 1) return 'bg-green-100 text-green-900 border-green-300'
    if (val === '2' || val === 2) return 'bg-orange-100 text-orange-900 border-orange-300'
    if (val === '3' || val === 3) return 'bg-red-100 text-red-900 border-red-300'
    return 'bg-white border-gray-200 text-slate-700'
}

export default function NuevaMatrizEditorClient({
    matrix,
    licitaciones
}: NuevaMatrizEditorClientProps) {
    const router = useRouter()
    
    // Main tabs: 'preguntas', 'calculo', 'hoja_b'
    const [activeMainTab, setActiveMainTab] = useState<'preguntas' | 'calculo' | 'hoja_b'>('preguntas')
    
    // Sub tabs: category id
    const [activeCategory, setActiveCategory] = useState<string>('PATIO_SERVICIO')

    // Loaded questions list
    const [questions, setQuestions] = useState<any[]>(
        matrix.detalles.map(d => ({
            id: d.id,
            preguntaNombre: d.preguntaNombre,
            tipoRespuesta: d.tipoRespuesta,
            obligatorio: d.obligatorio,
            seccion: d.seccion,
            orden: d.orden,
            gravedad: d.gravedad || '',
            probabilidad: d.probabilidad || '',
            nivelRiesgo: d.nivelRiesgo || '',
            justificacion: d.justificacion || '',
            riesgoSignificativo: d.riesgoSignificativo || '',
            recursoNecesario: d.recursoNecesario || '',
            resultadoEsperado: d.resultadoEsperado || '',
            respImplementacion: d.respImplementacion || '',
            respSeguimiento: d.respSeguimiento || '',
            evidenciaCumplimiento: d.evidenciaCumplimiento || '',
            evidenciaEficacia: d.evidenciaEficacia || ''
        }))
    )

    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Notes instructions state
    const [instructions, setInstructions] = useState<Record<string, string>>(() => {
        try {
            return matrix.instrucciones ? JSON.parse(matrix.instrucciones) : {}
        } catch(e) {
            return {}
        }
    })

    const handleInstructionChange = (catId: string, val: string) => {
        setInstructions(prev => ({ ...prev, [catId]: val }))
    }

    // Helper: Get category background class
    const currentCategoryInfo = CATEGORIES.find(c => c.id === activeCategory) || CATEGORIES[0]

    // Filtered questions for current category
    const categoryQuestions = questions
        .filter(q => q.seccion === activeCategory)
        .sort((a, b) => a.orden - b.orden)

    // Questions filtered for calculo and hoja_b tabs (exclude specific types)
    const calculoQuestions = categoryQuestions.filter(q => 
        !['OBSERVACION', 'ADJUNTAR', 'NUMERICO'].includes(q.tipoRespuesta)
    )

    // Add a new question
    const handleAddQuestion = () => {
        const newQuestion = {
            id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            preguntaNombre: '',
            tipoRespuesta: 'SI_NO',
            obligatorio: true,
            seccion: activeCategory,
            orden: questions.filter(q => q.seccion === activeCategory).length,
            gravedad: '',
            probabilidad: '',
            nivelRiesgo: '',
            justificacion: '',
            riesgoSignificativo: '',
            recursoNecesario: '',
            resultadoEsperado: '',
            respImplementacion: '',
            respSeguimiento: '',
            evidenciaCumplimiento: '',
            evidenciaEficacia: ''
        }
        setQuestions(prev => [...prev, newQuestion])
    }

    // Remove a question
    const handleRemoveQuestion = (id: string) => {
        setQuestions(prev => {
            const remaining = prev.filter(q => q.id !== id)
            // Re-order remaining questions in this category
            let counter = 0
            return remaining.map(q => {
                if (q.seccion === activeCategory) {
                    return { ...q, orden: counter++ }
                }
                return q
            })
        })
    }

    // Move question Up
    const handleMoveUp = (index: number) => {
        if (index === 0) return
        const list = [...categoryQuestions]
        // Swap elements
        const temp = list[index]
        list[index] = list[index - 1]
        list[index - 1] = temp

        // Update orders
        const updatedList = list.map((item, idx) => ({ ...item, orden: idx }))

        // Update main state
        setQuestions(prev => {
            const others = prev.filter(q => q.seccion !== activeCategory)
            return [...others, ...updatedList]
        })
    }

    // Move question Down
    const handleMoveDown = (index: number) => {
        const list = [...categoryQuestions]
        if (index === list.length - 1) return
        // Swap elements
        const temp = list[index]
        list[index] = list[index + 1]
        list[index + 1] = temp

        // Update orders
        const updatedList = list.map((item, idx) => ({ ...item, orden: idx }))

        // Update main state
        setQuestions(prev => {
            const others = prev.filter(q => q.seccion !== activeCategory)
            return [...others, ...updatedList]
        })
    }

    // Handle inputs for specific question
    const handleQuestionChange = (id: string, field: string, value: any) => {
        setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q))
    }

    // Save Template Details
    const handleSave = async () => {
        // Validation: Verify all questions in this template have a name
        const emptyQuestion = questions.find(q => !q.preguntaNombre || q.preguntaNombre.trim() === '')
        if (emptyQuestion) {
            const catInfo = CATEGORIES.find(c => c.id === emptyQuestion.seccion)
            alert(`Por favor escriba el nombre de la pregunta vacía en la sección "${catInfo?.label}".`)
            setActiveCategory(emptyQuestion.seccion)
            setActiveMainTab('preguntas')
            return
        }

        setSaving(true)
        setMessage(null)

        const res = await saveMatrixTemplate(matrix.id, questions, JSON.stringify(instructions))
        setSaving(false)

        if (res.success) {
            setMessage({ type: 'success', text: '¡Plantilla guardada correctamente!' })
            router.refresh()
            // Reset page after 1.5s
            setTimeout(() => setMessage(null), 2000)
        } else {
            setMessage({ type: 'error', text: res.error || 'Error al guardar la plantilla.' })
        }
    }

    // Delete Matrix
    const handleDeleteMatrix = async () => {
        const answersCount = matrix.detalles.length > 0 ? 0 : 0 // The deletion API handles checks correctly
        if (!confirm(`¿Está completamente seguro que desea eliminar esta plantilla de matriz ("${matrix.titulo}")?`)) {
            return
        }

        setDeleting(true)
        const res = await deleteMatrix(matrix.id)
        setDeleting(false)

        if (res.success) {
            alert('Matriz eliminada con éxito.')
            router.push('/dashboard/mantenedor/matriz-riesgo/nueva-matriz')
        } else {
            alert(res.error || 'Error al eliminar la matriz.')
        }
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Top Navigation Row */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <Link
                    href="/dashboard/mantenedor/matriz-riesgo/nueva-matriz"
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-bold"
                >
                    <span>⬅️</span> Volver al listado
                </Link>
                <div className="text-right">
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Plantilla seleccionada</span>
                    <h2 className="text-sm font-black text-slate-900 leading-tight">
                        {matrix.titulo} ({matrix.anio})
                    </h2>
                </div>
            </div>

            {/* Main Tabs Selection */}
            <div className="bg-slate-900 p-2 rounded-2xl flex gap-2 shadow-inner border border-slate-800">
                <button
                    onClick={() => setActiveMainTab('preguntas')}
                    className={`flex-1 py-3 text-center rounded-xl text-xs font-black transition-all ${
                        activeMainTab === 'preguntas'
                            ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-md shadow-cyan-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    📋 Preguntas Matriz de Riesgo
                </button>
                <button
                    onClick={() => setActiveMainTab('calculo')}
                    className={`flex-1 py-3 text-center rounded-xl text-xs font-black transition-all ${
                        activeMainTab === 'calculo'
                            ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-md shadow-cyan-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    🧮 Cálculo Matriz
                </button>
                <button
                    onClick={() => setActiveMainTab('hoja_b')}
                    className={`flex-1 py-3 text-center rounded-xl text-xs font-black transition-all ${
                        activeMainTab === 'hoja_b'
                            ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-md shadow-cyan-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    📄 Hoja B Estándar Pae
                </button>
            </div>

            {/* Message alert */}
            {message && (
                <div className={`p-4 rounded-2xl text-sm font-semibold border ${
                    message.type === 'success' 
                        ? 'bg-green-50 text-green-700 border-green-100' 
                        : 'bg-red-50 text-red-700 border-red-100'
                }`}>
                    {message.text}
                </div>
            )}

            {/* Sub-Tabs Categories */}
            <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => {
                    const isActive = activeCategory === cat.id
                    const count = questions.filter(q => q.seccion === cat.id).length
                    return (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-4 py-3 rounded-xl text-xs font-black border transition-all flex items-center gap-2 ${
                                isActive 
                                    ? cat.activeTabClass
                                    : 'bg-white border-gray-100 text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                            }`}
                        >
                            <span className={`w-2 h-2 rounded-full ${cat.bulletColor}`} />
                            {cat.label}
                            <span className="bg-slate-200/60 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-700">
                                {count}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Content Container (Color Coded BG) */}
            <div className={`p-6 rounded-3xl border transition-colors ${currentCategoryInfo.bgClass}`}>
                
                {/* 1. PREGUNTAS TAMP/FORM BUILDER */}
                {activeMainTab === 'preguntas' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                Preguntas en {currentCategoryInfo.label}
                            </h3>
                            <button
                                onClick={handleAddQuestion}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                            >
                                <span>+</span> Agregar Pregunta
                            </button>
                        </div>

                        {/* Instructional Note box */}
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl shadow-sm mb-4">
                            <label className="block text-[10px] font-black text-amber-800 uppercase tracking-wider mb-2">Nota Informativa (Instrucciones para el auditor)</label>
                            <textarea
                                className="w-full p-3 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-slate-700 text-sm placeholder:text-amber-300 resize-y min-h-[60px]"
                                placeholder="Ingrese aquí las instrucciones o consideraciones para esta sección (Opcional)"
                                value={instructions[activeCategory] || ''}
                                onChange={(e) => handleInstructionChange(activeCategory, e.target.value)}
                            />
                        </div>

                        {categoryQuestions.length === 0 ? (
                            <div className="bg-white/80 p-12 text-center rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm font-medium">
                                No hay preguntas añadidas en esta sección. Haga clic en "+ Agregar Pregunta" para crear una.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {categoryQuestions.map((q, index) => (
                                    <div 
                                        key={q.id} 
                                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-4 transition-all hover:shadow-md animate-in fade-in slide-in-from-top-2 duration-200"
                                    >
                                        <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-black min-w-[28px] text-center">
                                            {index + 1}
                                        </span>

                                        {/* Question name */}
                                        <div className="flex-1 w-full space-y-1">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase pl-0.5">Nombre de la pregunta</label>
                                            <input
                                                type="text"
                                                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-black font-semibold text-sm bg-slate-50/50 focus:bg-white"
                                                placeholder="Ej: ¿El basurero del patio cuenta con tapa?"
                                                value={q.preguntaNombre}
                                                onChange={(e) => handleQuestionChange(q.id, 'preguntaNombre', e.target.value)}
                                            />
                                        </div>

                                        {/* Response type dropdown */}
                                        <div className="w-full md:w-60 space-y-1">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase pl-0.5">Tipo de Respuesta</label>
                                            <select
                                                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-black font-semibold text-sm bg-white"
                                                value={q.tipoRespuesta}
                                                onChange={(e) => handleQuestionChange(q.id, 'tipoRespuesta', e.target.value)}
                                            >
                                                <option value="SI_NO">Si / No</option>
                                                <option value="EXISTE_NO_EXISTE">Existe / No existe</option>
                                                <option value="ENCUESTA">Encuesta (Predefinida)</option>
                                                <option value="OBSERVACION">Observación</option>
                                                <option value="ADJUNTAR">Adjuntar documento</option>
                                                <option value="NUMERICO">Numérico</option>
                                            </select>
                                        </div>

                                        {/* Obligatorio switch */}
                                        <div className="w-full md:w-36 space-y-2 shrink-0">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase pl-0.5">Requerido</label>
                                            <div className="flex items-center gap-2 h-9">
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuestionChange(q.id, 'obligatorio', !q.obligatorio)}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${q.obligatorio ? 'bg-cyan-600' : 'bg-gray-200'}`}
                                                >
                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${q.obligatorio ? 'translate-x-4.5' : 'translate-x-1'}`} />
                                                </button>
                                                <span className={`text-[10px] font-black tracking-tight ${q.obligatorio ? 'text-cyan-700' : 'text-gray-400'}`}>
                                                    {q.obligatorio ? 'OBLIGATORIO' : 'OPCIONAL'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Sort and Delete Controls */}
                                        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-0 pt-3 md:pt-0 mt-2 md:mt-0">
                                            {/* Reorder Up */}
                                            <button
                                                type="button"
                                                onClick={() => handleMoveUp(index)}
                                                disabled={index === 0}
                                                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-30 transition-colors"
                                                title="Subir orden"
                                            >
                                                ⬆️
                                            </button>
                                            {/* Reorder Down */}
                                            <button
                                                type="button"
                                                onClick={() => handleMoveDown(index)}
                                                disabled={index === categoryQuestions.length - 1}
                                                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-30 transition-colors"
                                                title="Bajar orden"
                                            >
                                                ⬇️
                                            </button>
                                            {/* Delete */}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveQuestion(q.id)}
                                                className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors border border-red-100"
                                                title="Eliminar pregunta"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex justify-end pt-2">
                                    <button
                                        onClick={handleAddQuestion}
                                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                                    >
                                        <span>+</span> Agregar Pregunta
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 2. CALCULO MATRIZ TABLE */}
                {activeMainTab === 'calculo' && (
                    <div className="space-y-6">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                            Ponderación de Riesgos en {currentCategoryInfo.label}
                        </h3>

                        {calculoQuestions.length === 0 ? (
                            <div className="bg-white/80 p-12 text-center rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm font-medium">
                                No hay preguntas añadidas en esta sección para ponderar. Por favor agréguelas primero en la pestaña "Preguntas".
                            </div>
                        ) : (
                            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
                                <table className="w-full text-left text-xs whitespace-nowrap">
                                    <thead className="bg-slate-50 border-b border-gray-200 text-slate-500 font-bold uppercase tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3 min-w-[200px]">Pregunta</th>
                                            <th className="px-4 py-3 w-40">Gravedad</th>
                                            <th className="px-4 py-3 w-40">Probabilidad</th>
                                            <th className="px-4 py-3 w-64">Nivel de Riesgo</th>
                                            <th className="px-4 py-3">Justificación de Probabilidad</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-slate-700">
                                        {calculoQuestions.map((q) => (
                                            <tr key={q.id} className="hover:bg-slate-50/50">
                                                {/* Pregunta */}
                                                <td className="px-4 py-3 max-w-[300px] truncate font-medium text-slate-900" title={q.preguntaNombre}>
                                                    {q.preguntaNombre || <span className="text-gray-400 italic">(Sin nombre)</span>}
                                                </td>

                                                {/* Gravedad select */}
                                                <td className="px-4 py-3">
                                                    <select
                                                        className={`w-full p-2 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-cyan-500 border outline-none ${getSelectBgColor(q.gravedad)}`}
                                                        value={q.gravedad}
                                                        onChange={(e) => handleQuestionChange(q.id, 'gravedad', e.target.value)}
                                                    >
                                                        <option value="">Seleccione...</option>
                                                        <option value="1">1: Bajo</option>
                                                        <option value="2">2: Medio</option>
                                                        <option value="3">3: Alto</option>
                                                    </select>
                                                </td>

                                                {/* Probabilidad select */}
                                                <td className="px-4 py-3">
                                                    <select
                                                        className={`w-full p-2 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-cyan-500 border outline-none ${getSelectBgColor(q.probabilidad)}`}
                                                        value={q.probabilidad}
                                                        onChange={(e) => handleQuestionChange(q.id, 'probabilidad', e.target.value)}
                                                    >
                                                        <option value="">Seleccione...</option>
                                                        <option value="1">1: Bajo</option>
                                                        <option value="2">2: Medio</option>
                                                        <option value="3">3: Alto</option>
                                                    </select>
                                                </td>

                                                {/* Nivel riesgo select */}
                                                <td className="px-4 py-3">
                                                    <select
                                                        className={`w-full p-2 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-cyan-500 border outline-none ${getSelectBgColor(q.nivelRiesgo)}`}
                                                        value={q.nivelRiesgo}
                                                        onChange={(e) => handleQuestionChange(q.id, 'nivelRiesgo', e.target.value)}
                                                    >
                                                        <option value="">Seleccione...</option>
                                                        <option value="1">1: Bajo riesgo (Mitigar &lt; 90 días)</option>
                                                        <option value="2">2: Medio riesgo (Mitigar &lt; 60 días)</option>
                                                        <option value="3">3: Alto riesgo (Mitigar &lt; 30 días)</option>
                                                    </select>
                                                </td>

                                                {/* Justificacion */}
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-cyan-500 outline-none bg-slate-50/50 focus:bg-white"
                                                        placeholder="Justificación..."
                                                        value={q.justificacion}
                                                        onChange={(e) => handleQuestionChange(q.id, 'justificacion', e.target.value)}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. HOJA B ESTANDAR PAE TABLE */}
                {activeMainTab === 'hoja_b' && (
                    <div className="space-y-6">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                            Parámetros Hoja B en {currentCategoryInfo.label}
                        </h3>

                        {calculoQuestions.length === 0 ? (
                            <div className="bg-white/80 p-12 text-center rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm font-medium">
                                No hay preguntas añadidas en esta sección para configurar la Hoja B. Por favor agréguelas primero en la pestaña "Preguntas".
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {calculoQuestions.map((q) => (
                                    <div key={q.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                                        <div className="border-b border-gray-100 pb-2 flex justify-between items-center">
                                            <h4 className="font-black text-sm text-slate-900 truncate max-w-2xl" title={q.preguntaNombre}>
                                                Pregunta: {q.preguntaNombre || <span className="text-gray-400 italic">(Sin nombre)</span>}
                                            </h4>
                                            <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full font-bold text-slate-500 uppercase tracking-widest">
                                                Hoja B
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Riesgos significativos */}
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Para riesgos significativos describir la(s)...</label>
                                                <input
                                                    type="text"
                                                    className="w-full p-2.5 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
                                                    value={q.riesgoSignificativo}
                                                    onChange={(e) => handleQuestionChange(q.id, 'riesgoSignificativo', e.target.value)}
                                                />
                                            </div>

                                            {/* Recurso necesario */}
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recurso necesario</label>
                                                <input
                                                    type="text"
                                                    className="w-full p-2.5 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
                                                    value={q.recursoNecesario}
                                                    onChange={(e) => handleQuestionChange(q.id, 'recursoNecesario', e.target.value)}
                                                />
                                            </div>

                                            {/* Resultado Esperado */}
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resultado Esperado</label>
                                                <input
                                                    type="text"
                                                    className="w-full p-2.5 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
                                                    value={q.resultadoEsperado}
                                                    onChange={(e) => handleQuestionChange(q.id, 'resultadoEsperado', e.target.value)}
                                                />
                                            </div>

                                            {/* Responsable Implementacion */}
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resp. Implementación</label>
                                                <input
                                                    type="text"
                                                    className="w-full p-2.5 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
                                                    value={q.respImplementacion}
                                                    onChange={(e) => handleQuestionChange(q.id, 'respImplementacion', e.target.value)}
                                                />
                                            </div>

                                            {/* Responsable Seguimiento */}
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resp. Seguimiento</label>
                                                <input
                                                    type="text"
                                                    className="w-full p-2.5 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
                                                    value={q.respSeguimiento}
                                                    onChange={(e) => handleQuestionChange(q.id, 'respSeguimiento', e.target.value)}
                                                />
                                            </div>

                                            {/* Evidencia cumplimiento */}
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Evidencia Cumplimiento</label>
                                                <input
                                                    type="text"
                                                    className="w-full p-2.5 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
                                                    value={q.evidenciaCumplimiento}
                                                    onChange={(e) => handleQuestionChange(q.id, 'evidenciaCumplimiento', e.target.value)}
                                                />
                                            </div>

                                            {/* Evidencia eficacia */}
                                            <div className="space-y-1 md:col-span-2">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Evidencia eficacia</label>
                                                <input
                                                    type="text"
                                                    className="w-full p-2.5 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
                                                    value={q.evidenciaEficacia}
                                                    onChange={(e) => handleQuestionChange(q.id, 'evidenciaEficacia', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Bottom Actions Row */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <button
                    onClick={handleDeleteMatrix}
                    disabled={deleting || saving}
                    className="w-full sm:w-auto px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-2xl font-bold text-sm transition-all"
                >
                    {deleting ? 'Eliminando...' : 'Eliminar Matriz'}
                </button>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Link
                        href="/dashboard/mantenedor/matriz-riesgo/nueva-matriz"
                        className="w-full sm:w-auto px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-sm text-center transition-all"
                    >
                        Volver al Panel
                    </Link>
                    <button
                        onClick={handleSave}
                        disabled={saving || deleting}
                        className="w-full sm:w-auto px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-slate-950/15 disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Guardar Plantilla'}
                    </button>
                </div>
            </div>
        </div>
    )
}
