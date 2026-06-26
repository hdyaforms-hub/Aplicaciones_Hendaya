'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import jsPDF from 'jspdf'
import { saveMatrixTemplate, deleteMatrix, saveFormatosCartaSostenedor } from '../actions'

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
    compromisoSostenedor: string | null
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
    formatosCarta?: any[]
}

interface NuevaMatrizEditorClientProps {
    matrix: Matriz
    licitaciones: Licitacion[]
}

// Categories definitions
const CATEGORIES = [
    { id: 'PATIO_SERVICIO', label: 'Patio de servicio', colorName: 'yellow', activeTabClass: 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-200/50', bgClass: 'bg-amber-50/30 border-amber-200/70', bulletColor: 'bg-amber-500', badgeClass: 'bg-amber-100 text-amber-905 border-amber-200 text-amber-800', borderClass: 'border-l-amber-500' },
    { id: 'BODEGA', label: 'Bodega', colorName: 'orange', activeTabClass: 'bg-orange-100 text-orange-950 border-orange-300 ring-2 ring-orange-200/50', bgClass: 'bg-orange-50/30 border-orange-200/70', bulletColor: 'bg-orange-500', badgeClass: 'bg-orange-100 text-orange-950 border-orange-200 text-orange-850', borderClass: 'border-l-orange-500' },
    { id: 'COCINA', label: 'Cocina', colorName: 'green', activeTabClass: 'bg-emerald-100 text-emerald-950 border-emerald-300 ring-2 ring-emerald-200/50', bgClass: 'bg-emerald-50/30 border-emerald-200/70', bulletColor: 'bg-emerald-500', badgeClass: 'bg-emerald-100 text-emerald-950 border-emerald-200 text-emerald-800', borderClass: 'border-l-emerald-500' },
    { id: 'BANO', label: 'Baño', colorName: 'celeste', activeTabClass: 'bg-cyan-100 text-cyan-950 border-cyan-300 ring-2 ring-cyan-200/50', bgClass: 'bg-cyan-50/30 border-cyan-200/70', bulletColor: 'bg-cyan-500', badgeClass: 'bg-cyan-100 text-cyan-950 border-cyan-200 text-cyan-800', borderClass: 'border-l-cyan-500' },
    { id: 'LEVANTAMIENTO_GENERAL', label: 'Levantamiento General', colorName: 'blue', activeTabClass: 'bg-blue-100 text-blue-950 border-blue-300 ring-2 ring-blue-200/50', bgClass: 'bg-blue-50/30 border-blue-200/70', bulletColor: 'bg-blue-500', badgeClass: 'bg-blue-100 text-blue-950 border-blue-200 text-blue-800', borderClass: 'border-l-blue-500' }
]

const getSelectBgColor = (val: any) => {
    if (val === '1' || val === 1) return 'bg-green-100 text-green-900 border-green-300'
    if (val === '2' || val === 2) return 'bg-orange-100 text-orange-900 border-orange-300'
    if (val === '3' || val === 3) return 'bg-red-100 text-red-900 border-red-300'
    return 'bg-white border-gray-200 text-slate-700'
}

const DEFAULT_CARTA_INICIO = `Mediante la presente se informa a Establecimiento <Colegio> RBD <RBD> de la comuna de <Comuna>, que, en base a la licitación en curso del Programa de Alimentación escolar, es que se debe implementar en el servicio de alimentación, “Sistema de Gestión de Calidad y Seguridad Alimentaria PAE”, el cual está enfocado en los procesos de producción de alimentos y establecer sistemas de control que se centran en la prevención para lograr la inocuidad de los productos y preparaciones.

Para una correcta implementación del sistema, existen aspectos que son de Responsabilidad del Sostenedor como: Infraestructura, Calidad de agua y documentación legal referida a Resolución sanitaria de Cocina del establecimiento y autorización entregada por SEC, los cuales se informan a través de este documento.

El establecimiento hace entrega de copia de los siguientes documentos (Indicar como SI o NO / solo para plagas NA):
- Resolución sanitaria servicio alimentación (detalla lo que se puede realizar en cocina) ________
- Foto o respaldo Sello verde (SEC) para electricidad y combustible en el recinto de cocina (vigente) _______
- Si establecimiento cuenta con empresa de servicio de control de plaga, hace entrega Fotocopia o Foto de última Hoja de servicio de control de plaga _______
- Fotocopia o Foto Boleta de agua de red pública, para acreditar agua potable________. En caso de ser agua de pozo, noria o agua potable rural, se completa Carta Determinación de calidad de agua de pozo o potable rural y se hace entrega al establecimiento de esta______ (SI o NO)

Para condiciones generales, se detallan los aspectos que el Sostenedor debiese gestionar:
- Cuenta con Baño de uso exclusivo personal manipulador ________. Indicar SI o NO
- Cuenta con Vestidor de uso exclusivo personal manipulador ________. Indicar SI o NO
- Cuenta con Patio de servicio de uso exclusivo ________ o compartido ______. Indicar SI o NO
- Requiere eliminación de pasto o maleza al exterior de recinto cocina ______. Indicar SI o NO
- Requiere eliminación de escombros o muebles y/u orden al exterior de recinto cocina ______. Indicar SI o NO

Para Infraestructura, marcar con ✓ si el ítem cumple o con una X si infraestructura requiere acciones por parte del establecimiento para mitigar riesgo.
- Vía acceso cocina pavimentada______ Piso______ Pendiente Piso______ Desagües _______ Drenajes de fácil limpieza______ Muros______ Cielo______ Conexiones de agua______ Conexiones de gas______ Conexiones eléctricas______ Ductos de Extracción y/o ventilación cocina______ Ductos de Extracción y/o ventilación bodegas de almacenamiento______ Ventanas en buen estado______ Ventanas Herméticas______ Puertas Herméticas______ Bombona con fecha vigente______ Lavafondo con agua fría y caliente______ Lavamanos baño con agua fría y caliente______ Lavamanos cocina con agua fría______ Espacio suficiente para instalación de equipos______`

const DEFAULT_CARTA_FIN = `Observaciones ________________________________________________________________________________
____________________________________________________________________________________________
____________________________________________________________________________________________
____________________________________________________________________________________________

Nota: Este levantamiento es semestral, pero en base a nuevos Hallazgos o mejoras del establecimiento, esta carta se podría entregar más de 2 veces en el año.

Se firma este documento como toma de conocimiento y gestión de las mejoras, por parte de la dirección del establecimiento o su representante. Se firma en dos ejemplares uno para el establecimiento y uno para la empresa`

const replaceMockTags = (text: string) => {
    if (!text) return ''
    return text
        .replace(/(?:<RBD.*?>|&lt;RBD.*?&gt;)/gi, '9999')
        .replace(/(?:<Colegio.*?>|&lt;Colegio.*?&gt;)/gi, 'Colegio de Prueba Hendaya')
        .replace(/(?:<Usuario.*?>|&lt;Usuario.*?&gt;)/gi, 'Supervisor de Prueba')
        .replace(/(?:<Sucursal.*?>|&lt;Sucursal.*?&gt;)/gi, 'CD METRO')
        .replace(/(?:<Comuna.*?>|&lt;Comuna.*?&gt;)/gi, 'Santiago')
        .replace(/(?:<Fecha.*?>|&lt;Fecha.*?&gt;)/gi, '24/06/2026')
}

export default function NuevaMatrizEditorClient({
    matrix,
    licitaciones
}: NuevaMatrizEditorClientProps) {
    const router = useRouter()
    
    // Main tabs: 'preguntas', 'calculo', 'hoja_b' | 'carta_sostenedor'
    const [activeMainTab, setActiveMainTab] = useState<'preguntas' | 'calculo' | 'hoja_b' | 'carta_sostenedor'>('preguntas')
    
    // Sub tabs: category id
    const [activeCategory, setActiveCategory] = useState<string>('PATIO_SERVICIO')

    // States for letter preview
    const [showPreviewModal, setShowPreviewModal] = useState(false)
    const [showHelpTags, setShowHelpTags] = useState(false)

    const handleDownloadMockPDF = () => {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        })
        
        const fmt = selectedFormatoIdx !== null && formatos[selectedFormatoIdx] 
            ? formatos[selectedFormatoIdx] 
            : {
                nombre: 'Formato Estándar',
                asuntoEmail: 'Carta de Compromiso Sostenedor - RBD <RBD>',
                cuerpoInicio: DEFAULT_CARTA_INICIO,
                cuerpoFin: DEFAULT_CARTA_FIN
            }

        const title = 'CARTA INFORMATIVA CONDICIONES DE INFRAESTRUCTURA DE RESPONSABILIDAD SOSTENEDOR'
        const subject = replaceMockTags(fmt.asuntoEmail || 'Carta de Compromiso Sostenedor - RBD <RBD>')
        const startText = replaceMockTags(fmt.cuerpoInicio || '')
        const endText = replaceMockTags(fmt.cuerpoFin || '')

        // Title
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.text(title, 105, 20, { align: 'center' })

        // Info
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.text('Fecha: 24-06-2026', 15, 32)
        doc.text('RBD: 9999', 15, 37)
        doc.text('Establecimiento: Colegio de Prueba Hendaya', 15, 42)
        doc.setFont('helvetica', 'bold')
        doc.text('Asunto: ' + subject, 15, 49)

        doc.line(15, 53, 195, 53)

        // Start text
        doc.setFont('helvetica', 'normal')
        const splitStart = doc.splitTextToSize(startText, 180)
        doc.text(splitStart, 15, 60)

        let yPos = 60 + (splitStart.length * 5) + 10

        // Compromises
        doc.setFont('helvetica', 'bold')
        doc.text('Compromisos adquiridos:', 15, yPos)
        yPos += 7

        const sostenedorQuestions = questions
            .filter(q => q.respImplementacion === 'Sostenedor')
            .sort((a, b) => {
                const idxA = CATEGORIES.findIndex(c => c.id === a.seccion)
                const idxB = CATEGORIES.findIndex(c => c.id === b.seccion)
                if (idxA !== idxB) return idxA - idxB
                return a.orden - b.orden
            })
        
        doc.setFont('helvetica', 'normal')
        if (sostenedorQuestions.length === 0) {
            doc.text('(No hay compromisos configurados en la plantilla)', 20, yPos)
            yPos += 7
        } else {
            sostenedorQuestions.forEach((q, idx) => {
                const cat = CATEGORIES.find(c => c.id === q.seccion)?.label || q.seccion
                const compText = q.compromisoSostenedor || q.preguntaNombre || 'Sin compromiso redactado.'
                
                const line = `${idx + 1}. [${cat}] - ${compText}`
                const splitLine = doc.splitTextToSize(line, 175)
                
                if (yPos + (splitLine.length * 5) > 260) {
                    doc.addPage()
                    yPos = 20
                }
                
                doc.text(splitLine, 15, yPos)
                yPos += (splitLine.length * 5) + 2
            })
        }

        yPos += 8
        // End text
        const splitEnd = doc.splitTextToSize(endText, 180)
        if (yPos + (splitEnd.length * 5) > 260) {
            doc.addPage()
            yPos = 20
        }
        doc.text(splitEnd, 15, yPos)

        yPos += (splitEnd.length * 5) + 30
        if (yPos > 265) {
            doc.addPage()
            yPos = 40
        }
        doc.line(65, yPos, 145, yPos)
        doc.setFont('helvetica', 'bold')
        doc.text('Firma Sostenedor', 105, yPos + 5, { align: 'center' })
        doc.setFont('helvetica', 'normal')
        doc.text('Colegio de Prueba Hendaya', 105, yPos + 10, { align: 'center' })

        const blobUrl = doc.output('bloburl')
        window.open(blobUrl)
    }

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
            evidenciaEficacia: d.evidenciaEficacia || '',
            compromisoSostenedor: d.compromisoSostenedor || ''
        }))
    )

    // Sostenedor letter formats state
    const [formatos, setFormatos] = useState<any[]>(matrix.formatosCarta || [])
    const [selectedFormatoIdx, setSelectedFormatoIdx] = useState<number | null>(
        matrix.formatosCarta && matrix.formatosCarta.length > 0 ? 0 : null
    )
    const [savingFormatos, setSavingFormatos] = useState(false)
    const [expandedTextarea, setExpandedTextarea] = useState<{ field: 'cuerpoInicio' | 'cuerpoFin', label: string } | null>(null)

    const handleSaveFormatos = async () => {
        setSavingFormatos(true)
        const res = await saveFormatosCartaSostenedor(matrix.id, formatos)
        setSavingFormatos(false)
        if (res.success) {
            alert('Formatos de carta guardados correctamente.')
        } else {
            alert(res.error || 'Error al guardar formatos.')
        }
    }

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
            evidenciaEficacia: '',
            compromisoSostenedor: ''
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
                    📋 Preguntas
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
                <button
                    onClick={() => setActiveMainTab('carta_sostenedor')}
                    className={`flex-1 py-3 text-center rounded-xl text-xs font-black transition-all ${
                        activeMainTab === 'carta_sostenedor'
                            ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-md shadow-cyan-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    ✉️ Carta del Sostenedor
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
            {activeMainTab !== 'carta_sostenedor' && (
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
            )}

            {/* Content Container (Color Coded BG) */}
            <div className={`p-6 rounded-3xl border transition-colors ${activeMainTab === 'carta_sostenedor' ? 'bg-white border-gray-200' : currentCategoryInfo.bgClass}`}>
                
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
                                                <select
                                                    className="w-full p-2.5 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-cyan-500 outline-none bg-white font-bold text-black"
                                                    value={q.respImplementacion || ''}
                                                    onChange={(e) => handleQuestionChange(q.id, 'respImplementacion', e.target.value)}
                                                >
                                                    <option value="">Seleccione...</option>
                                                    <option value="Prestador">Prestador</option>
                                                    <option value="Sostenedor">Sostenedor</option>
                                                    {q.respImplementacion && q.respImplementacion !== 'Prestador' && q.respImplementacion !== 'Sostenedor' && (
                                                        <option value={q.respImplementacion}>{q.respImplementacion}</option>
                                                    )}
                                                </select>
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

                {/* 4. CARTA AL SOSTENEDOR CONFIGURATION */}
                {activeMainTab === 'carta_sostenedor' && (
                    <div className="space-y-8">
                        <div className="border-b border-gray-100 pb-4 space-y-4">
                            <div className="flex items-center gap-3">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                    Configuración de Carta al Sostenedor
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setShowHelpTags(!showHelpTags)}
                                    className="w-6 h-6 rounded-full bg-slate-100 hover:bg-cyan-100 hover:text-cyan-700 text-slate-500 flex items-center justify-center font-bold text-sm transition-colors border border-slate-200"
                                    title="Ver palabras reservadas (tags)"
                                >
                                    ?
                                </button>
                                <span className="text-[10px] text-amber-600 font-bold bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded-full">
                                    Borrador editable (No requiere guardar para previsualizar)
                                </span>
                            </div>

                            {showHelpTags && (
                                <div className="bg-cyan-50 border border-cyan-100 p-4 rounded-2xl shadow-sm text-xs text-cyan-800 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                    <p className="font-bold uppercase tracking-wider text-[10px]">Palabras Reservadas (Tags) Disponibles:</p>
                                    <p className="text-[11px] text-cyan-700 leading-normal">
                                        Puedes insertar las siguientes palabras en el Asunto del Correo, Inicio de Carta o Fin de Carta. El sistema las reemplazará automáticamente con la información del colegio al generarse:
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-2 font-mono text-[10px]">
                                        <div className="bg-white p-2.5 rounded-xl border border-cyan-100/50 shadow-sm">
                                            <span className="font-bold text-cyan-900">&lt;Colegio&gt;</span>
                                            <span className="block text-slate-500 font-sans mt-0.5">Nombre del establecimiento</span>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-cyan-100/50 shadow-sm">
                                            <span className="font-bold text-cyan-900">&lt;RBD&gt;</span>
                                            <span className="block text-slate-500 font-sans mt-0.5">RBD del colegio</span>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-cyan-100/50 shadow-sm">
                                            <span className="font-bold text-cyan-900">&lt;Comuna&gt;</span>
                                            <span className="block text-slate-500 font-sans mt-0.5">Comuna del colegio</span>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-cyan-100/50 shadow-sm">
                                            <span className="font-bold text-cyan-900">&lt;Fecha&gt;</span>
                                            <span className="block text-slate-500 font-sans mt-0.5">Fecha de emisión (dd/mm/yyyy)</span>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-cyan-100/50 shadow-sm">
                                            <span className="font-bold text-cyan-900">&lt;Usuario&gt;</span>
                                            <span className="block text-slate-500 font-sans mt-0.5">Nombre del supervisor auditor</span>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-cyan-100/50 shadow-sm">
                                            <span className="font-bold text-cyan-900">&lt;Sucursal&gt;</span>
                                            <span className="block text-slate-500 font-sans mt-0.5">Sucursal asociada al colegio</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <p className="text-xs text-slate-500">
                                Administra los formatos de carta PDF y edita la redacción de compromisos para las preguntas asociadas al Sostenedor.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Column 1: Format Management */}
                            <div className="lg:col-span-1 space-y-4 lg:border-r lg:border-slate-100 lg:pr-6">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider">Formatos de Carta</h4>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const nuevoFormato = {
                                                id: `temp-${Date.now()}`,
                                                nombre: `Nuevo Formato`,
                                                asuntoEmail: 'Carta de Compromiso Sostenedor - RBD <RBD>',
                                                cuerpoEmail: 'Estimado Sostenedor, adjunto enviamos la carta de compromisos de la auditoría de casino del establecimiento <Colegio> (RBD <RBD>).',
                                                cuerpoInicio: DEFAULT_CARTA_INICIO,
                                                cuerpoFin: DEFAULT_CARTA_FIN,
                                                activo: true
                                            }
                                            setFormatos([...formatos, nuevoFormato])
                                            setSelectedFormatoIdx(formatos.length)
                                        }}
                                        className="text-xs bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1.5 rounded-lg font-bold"
                                    >
                                        + Agregar
                                    </button>
                                </div>

                                {formatos.length === 0 ? (
                                    <div className="text-xs text-slate-400 italic p-4 text-center border border-dashed border-slate-200 rounded-xl">
                                        No hay formatos creados. Haga clic en "+ Agregar" para crear uno.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {formatos.map((f, idx) => (
                                            <button
                                                key={f.id}
                                                type="button"
                                                onClick={() => setSelectedFormatoIdx(idx)}
                                                className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all flex justify-between items-center ${
                                                    selectedFormatoIdx === idx
                                                        ? 'border-cyan-500 bg-cyan-50/50 text-cyan-900'
                                                        : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                                                }`}
                                            >
                                                <span>{f.nombre}</span>
                                                <span className={`w-2.5 h-2.5 rounded-full ${f.activo ? 'bg-green-500' : 'bg-slate-300'}`} title={f.activo ? 'Activo' : 'Inactivo'} />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {selectedFormatoIdx !== null && formatos[selectedFormatoIdx] && (
                                    <div className="pt-4 border-t border-slate-100 space-y-3">
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase">Nombre Formato</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-black bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                                                value={formatos[selectedFormatoIdx].nombre}
                                                onChange={(e) => {
                                                    const updated = [...formatos]
                                                    updated[selectedFormatoIdx].nombre = e.target.value
                                                    setFormatos(updated)
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase">Asunto Correo</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-black bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                                                value={formatos[selectedFormatoIdx].asuntoEmail}
                                                onChange={(e) => {
                                                    const updated = [...formatos]
                                                    updated[selectedFormatoIdx].asuntoEmail = e.target.value
                                                    setFormatos(updated)
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase">Cuerpo Correo (Email)</label>
                                            <textarea
                                                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-black bg-white focus:ring-1 focus:ring-cyan-500 outline-none min-h-[60px]"
                                                value={formatos[selectedFormatoIdx].cuerpoEmail}
                                                onChange={(e) => {
                                                    const updated = [...formatos]
                                                    updated[selectedFormatoIdx].cuerpoEmail = e.target.value
                                                    setFormatos(updated)
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Inicio Carta (PDF)</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedTextarea({ field: 'cuerpoInicio', label: 'Inicio de Carta (PDF)' })}
                                                    className="text-[9px] text-cyan-600 hover:text-cyan-800 font-bold uppercase flex items-center gap-1 transition-all"
                                                >
                                                    <span>🔍</span> Expandir
                                                </button>
                                            </div>
                                            <textarea
                                                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 bg-slate-50 outline-none min-h-[60px] cursor-not-allowed"
                                                value={formatos[selectedFormatoIdx].cuerpoInicio}
                                                readOnly
                                                placeholder="Presione 'Expandir' para editar el texto con formato..."
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Fin Carta (PDF)</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedTextarea({ field: 'cuerpoFin', label: 'Fin de Carta (PDF)' })}
                                                    className="text-[9px] text-cyan-600 hover:text-cyan-800 font-bold uppercase flex items-center gap-1 transition-all"
                                                >
                                                    <span>🔍</span> Expandir
                                                </button>
                                            </div>
                                            <textarea
                                                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-black bg-white focus:ring-1 focus:ring-cyan-500 outline-none min-h-[60px]"
                                                value={formatos[selectedFormatoIdx].cuerpoFin}
                                                onChange={(e) => {
                                                    const updated = [...formatos]
                                                    updated[selectedFormatoIdx].cuerpoFin = e.target.value
                                                    setFormatos(updated)
                                                }}
                                                readOnly
                                                placeholder="Presione 'Expandir' para editar el texto con formato..."
                                            />
                                        </div>
                                        <div className="flex justify-between items-center pt-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formatos[selectedFormatoIdx].activo}
                                                    onChange={(e) => {
                                                        const updated = [...formatos]
                                                        updated[selectedFormatoIdx].activo = e.target.checked
                                                        setFormatos(updated)
                                                    }}
                                                />
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Formato Activo</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = formatos.filter((_, i) => i !== selectedFormatoIdx)
                                                    setFormatos(updated)
                                                    setSelectedFormatoIdx(updated.length > 0 ? 0 : null)
                                                }}
                                                className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase"
                                            >
                                                Eliminar
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleSaveFormatos}
                                            disabled={savingFormatos}
                                            className="w-full mt-2 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                                        >
                                            {savingFormatos ? 'Guardando...' : '💾 Guardar Formatos'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Column 2: Question Compromises Redaction */}
                            <div className="lg:col-span-2 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
                                    <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider">Redacción de Compromisos del Sostenedor</h4>
                                    <button
                                        type="button"
                                        onClick={() => setShowPreviewModal(true)}
                                        className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0"
                                    >
                                        <span>👁️</span> Vista Previa Carta
                                    </button>
                                </div>
                                
                                {questions.filter(q => q.respImplementacion === 'Sostenedor').length === 0 ? (
                                    <div className="bg-slate-50 border border-dashed border-slate-200 p-8 text-center rounded-2xl text-slate-400 text-sm">
                                        No hay preguntas asignadas al Sostenedor. Para configurar compromisos, vaya a la pestaña <b>"Hoja B Estándar Pae"</b> y asigne preguntas al Sostenedor en el campo "Resp. Implementación".
                                    </div>
                                ) : (
                                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                        {questions
                                            .filter(q => q.respImplementacion === 'Sostenedor')
                                            .sort((a, b) => {
                                                const idxA = CATEGORIES.findIndex(c => c.id === a.seccion)
                                                const idxB = CATEGORIES.findIndex(c => c.id === b.seccion)
                                                if (idxA !== idxB) return idxA - idxB
                                                return a.orden - b.orden
                                            })
                                            .map(q => {
                                                const catInfo = CATEGORIES.find(c => c.id === q.seccion)
                                                const badgeClass = catInfo?.badgeClass || 'bg-cyan-50 border-cyan-100 text-cyan-700'
                                                const borderClass = catInfo?.borderClass || 'border-l-cyan-500'
                                                
                                                return (
                                                    <div 
                                                        key={q.id} 
                                                        className={`bg-white p-4 border border-slate-100 border-l-4 rounded-r-xl rounded-l-md space-y-3 shadow-sm hover:shadow-md transition-all ${borderClass}`}
                                                    >
                                                        <div className="flex justify-between items-start gap-2">
                                                            <span className={`text-[9px] border font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${badgeClass}`}>
                                                                {catInfo?.label || q.seccion}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-800 leading-normal">
                                                            Pregunta: {q.preguntaNombre}
                                                        </p>
                                                        <div className="space-y-1">
                                                            <label className="block text-[10px] font-bold text-slate-400 uppercase">Texto Compromiso en Carta</label>
                                                            <input
                                                                type="text"
                                                                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs text-black font-semibold bg-white outline-none focus:ring-1 focus:ring-cyan-500"
                                                                placeholder="Ej: Me comprometo a limpiar la zona y retirar escombros..."
                                                                value={q.compromisoSostenedor || ''}
                                                                onChange={(e) => handleQuestionChange(q.id, 'compromisoSostenedor', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                    </div>
                                )}
                            </div>
                        </div>
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

            {/* Modal de Vista Previa */}
            {showPreviewModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div 
                        className="bg-slate-100 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in duration-200"
                        style={{ maxHeight: '80vh' }}
                    >
                        {/* Header */}
                        <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-base font-black text-slate-800">Vista Previa: Carta al Sostenedor</h3>
                                <p className="text-[10px] text-slate-500 font-medium">Visualización de cómo se estructurará el PDF con los compromisos y formato elegidos</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleDownloadMockPDF}
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                                >
                                    <span>📥</span> Descargar PDF de Prueba
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowPreviewModal(false)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors font-bold text-xs"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <style>{`
                            .custom-scrollbar::-webkit-scrollbar {
                                width: 10px !important;
                                height: 10px !important;
                            }
                            .custom-scrollbar::-webkit-scrollbar-track {
                                background: rgba(0, 0, 0, 0.05) !important;
                                border-radius: 10px !important;
                            }
                            .custom-scrollbar::-webkit-scrollbar-thumb {
                                background: #64748b !important;
                                border-radius: 10px !important;
                                border: 2px solid transparent !important;
                                background-clip: content-box !important;
                            }
                            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                                background: #475569 !important;
                            }
                            .custom-scrollbar {
                                scrollbar-width: thin !important;
                                scrollbar-color: #64748b rgba(0, 0, 0, 0.05) !important;
                            }
                        `}</style>

                        {/* Page Content (Mocking A4) */}
                        <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-slate-200/50 custom-scrollbar">
                            {(() => {
                                const fmt = selectedFormatoIdx !== null && formatos[selectedFormatoIdx] 
                                    ? formatos[selectedFormatoIdx] 
                                    : {
                                        nombre: 'Formato R_GO_8_12 (Por Defecto)',
                                        asuntoEmail: 'Carta Informativa Condiciones de Infraestructura - RBD <RBD>',
                                        cuerpoInicio: DEFAULT_CARTA_INICIO,
                                        cuerpoFin: DEFAULT_CARTA_FIN
                                    }
                                return (
                                    <div className="bg-white w-full max-w-[210mm] mx-auto shadow-lg border border-slate-200 rounded-xl p-8 sm:p-12 text-slate-800 text-xs font-sans leading-relaxed space-y-6 relative overflow-hidden">
                                        {/* Logo Hendaya (Top-Left) and Date Box (Top-Right) */}
                                        <div className="flex justify-between items-start border-b-2 border-cyan-600 pb-4 mb-4">
                                            <div>
                                                <span className="text-3xl font-black text-cyan-500 tracking-tighter" style={{ fontFamily: 'Outfit, Inter, sans-serif' }}>HENDAYA</span>
                                            </div>
                                            <div className="text-right font-bold text-xs text-black">
                                                <span className="block text-[8px] text-slate-400 uppercase tracking-widest mb-1 font-semibold">Fecha de Creación</span>
                                                24 / 06 / 2026
                                            </div>
                                        </div>

                                        {/* Document Title */}
                                        <div className="text-center my-6 space-y-1">
                                            <h2 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                                                CARTA INFORMATIVA
                                            </h2>
                                            <h2 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                                                CONDICIONES DE INFRAESTRUCTURA DE RESPONSABILIDAD SOSTENEDOR
                                            </h2>
                                        </div>

                                        {/* Cuerpo Inicio */}
                                        <div 
                                            className="space-y-2 text-xs text-slate-800 text-justify leading-relaxed rich-text-content"
                                            dangerouslySetInnerHTML={{ __html: replaceMockTags(fmt.cuerpoInicio) }}
                                        />

                                        {/* Commitments Table/List */}
                                        <div className="space-y-3 mt-6">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Desviaciones y Compromisos Asignados (Dinámicos)</p>
                                            
                                            {questions.filter(q => q.respImplementacion === 'Sostenedor').length === 0 ? (
                                                <p className="text-slate-400 italic text-center py-4 bg-slate-50 rounded-lg">
                                                    (No hay compromisos configurados en la plantilla)
                                                </p>
                                            ) : (
                                                <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden">
                                                    {questions
                                                        .filter(q => q.respImplementacion === 'Sostenedor')
                                                        .sort((a, b) => {
                                                            const idxA = CATEGORIES.findIndex(c => c.id === a.seccion)
                                                            const idxB = CATEGORIES.findIndex(c => c.id === b.seccion)
                                                            if (idxA !== idxB) return idxA - idxB
                                                            return a.orden - b.orden
                                                        })
                                                        .map((q, index) => {
                                                            const catInfo = CATEGORIES.find(c => c.id === q.seccion)
                                                            return (
                                                                <div key={q.id} className="p-3 hover:bg-slate-50/40 flex items-start gap-3 transition-colors">
                                                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                                                                        {index + 1}
                                                                    </span>
                                                                    <div className="space-y-1">
                                                                        <span className={`text-[8px] border font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${catInfo?.badgeClass}`}>
                                                                            {catInfo?.label || q.seccion}
                                                                        </span>
                                                                        <p className="font-semibold text-slate-800">
                                                                            {q.preguntaNombre || '(Pregunta sin nombre)'}
                                                                        </p>
                                                                        <p className="text-cyan-700 font-medium bg-cyan-50/50 px-2 py-1 rounded border border-cyan-100/50">
                                                                            <b>Compromiso:</b> {q.compromisoSostenedor || '(Sin compromiso redactado)'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Cuerpo Fin */}
                                        <div 
                                            className="space-y-2 text-xs text-slate-800 text-justify leading-relaxed rich-text-content mt-6"
                                            dangerouslySetInnerHTML={{ __html: replaceMockTags(fmt.cuerpoFin) }}
                                        />

                                        {/* Signatures structured side-by-side */}
                                        <div className="flex justify-between mt-12 pt-8 border-t border-slate-100">
                                            <div className="w-[45%] text-center">
                                                <div className="border-t border-slate-300 pt-2 font-bold text-[10px] text-slate-600">
                                                    Nombre y Timbre Encargado PAE/ Director
                                                </div>
                                            </div>
                                            <div className="w-[45%] text-center">
                                                <div className="border-t border-slate-300 pt-2 font-bold text-[10px] text-slate-600">
                                                    Nombre y Firma Representante Empresa
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer metadata */}
                                        <div className="text-right text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-6">
                                            Código: R_GO_8_12<br />
                                            Versión: 04
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="bg-white px-6 py-4 border-t border-slate-200 flex justify-end shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowPreviewModal(false)}
                                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors"
                            >
                                Cerrar Vista Previa
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Edición Ampliada para Textareas */}
            {expandedTextarea && selectedFormatoIdx !== null && formatos[selectedFormatoIdx] && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
                    <div
                        className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 animate-in zoom-in duration-200 flex flex-col"
                        style={{ maxHeight: '90vh' }}
                    >
                        {/* Header — always visible */}
                        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                Editar {expandedTextarea.label}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setExpandedTextarea(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors font-bold text-xs"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Scrollable body */}
                        <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-6 py-4 gap-4">
                            <div className="text-[10px] text-slate-500 font-medium bg-cyan-50 border border-cyan-100 rounded-xl p-3 leading-relaxed shrink-0">
                                💡 <b>Palabras reservadas permitidas:</b> Puede usar placeholders como <code>&lt;Colegio&gt;</code>, <code>&lt;RBD&gt;</code>, <code>&lt;Comuna&gt;</code>, y <code>&lt;Fecha&gt;</code> para que el sistema los reemplace dinámicamente al generar el PDF de la carta.
                            </div>

                            <RichTextEditor
                                value={formatos[selectedFormatoIdx][expandedTextarea.field]}
                                onChange={(val) => {
                                    const updated = [...formatos]
                                    updated[selectedFormatoIdx][expandedTextarea.field] = val
                                    setFormatos(updated)
                                }}
                            />
                        </div>

                        {/* Footer — always visible */}
                        <div className="flex justify-end px-6 py-4 border-t border-slate-100 shrink-0">
                            <button
                                type="button"
                                onClick={() => setExpandedTextarea(null)}
                                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors shadow-md"
                            >
                                Guardar y Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

import { useRef, useEffect } from 'react'

function RichTextEditor({
    value,
    onChange
}: {
    value: string
    onChange: (val: string) => void
}) {
    const editorRef = useRef<HTMLDivElement>(null)

    // Convert plain text to HTML if necessary (handles values saved before rich-editor)
    const toHtml = (val: string): string => {
        if (!val) return ''
        // Check for actual HTML structural tags (not system reserved tags like <Colegio>, <RBD>)
        const hasHtmlTags = /<(p|br|b|i|u|em|strong|span|div|ul|ol|li|h[1-6]|font|table|tr|td|th)[^>]*>/i.test(val)
        if (hasHtmlTags) return val
        // Plain text: convert newlines to <br> and escape special chars
        return val
            .split('\n')
            .map(line => {
                if (line === '') return '<br>'
                const escaped = line
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                return `<span>${escaped}</span>`
            })
            .join('<br>')
    }

    // Sync HTML from value prop to contentEditable (only on mount or when value changes externally)
    const lastSyncedValue = useRef<string | null>(null)
    useEffect(() => {
        if (editorRef.current && lastSyncedValue.current !== value) {
            const html = toHtml(value)
            editorRef.current.innerHTML = html
            lastSyncedValue.current = editorRef.current.innerHTML
        }
    }, [value])

    const handleInput = () => {
        if (editorRef.current) {
            lastSyncedValue.current = editorRef.current.innerHTML
            onChange(editorRef.current.innerHTML)
        }
    }

    const executeCommand = (command: string, arg: string = '') => {
        document.execCommand(command, false, arg)
        handleInput()
        if (editorRef.current) {
            editorRef.current.focus()
        }
    }

    const colors = [
        '#000000', '#334155', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'
    ]

    const highlights = [
        'transparent', '#fef9c3', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#ddd6fe'
    ]

    const fonts = [
        { label: 'Outfit (Defecto)', value: 'Outfit, sans-serif' },
        { label: 'Inter', value: 'Inter, sans-serif' },
        { label: 'Arial', value: 'Arial, sans-serif' },
        { label: 'Times New Roman', value: 'Times New Roman, serif' },
        { label: 'Courier New', value: 'Courier New, monospace' },
        { label: 'Georgia', value: 'Georgia, serif' }
    ]

    const sizes = [
        { label: 'Pequeño', value: '2' },
        { label: 'Normal', value: '3' },
        { label: 'Mediano', value: '4' },
        { label: 'Grande', value: '5' },
        { label: 'Muy Grande', value: '6' }
    ]

    return (
        <div className="flex flex-col border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 flex-1 min-h-0 shadow-sm">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-slate-100/80 backdrop-blur-sm border-b border-slate-200 shrink-0">
                {/* Font Selector */}
                <select
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                    onChange={(e) => executeCommand('fontName', e.target.value)}
                >
                    {fonts.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                </select>

                {/* Size Selector */}
                <select
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                    onChange={(e) => executeCommand('fontSize', e.target.value)}
                    defaultValue="3"
                >
                    {sizes.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>

                <div className="h-4 w-px bg-slate-300 mx-1 shrink-0" />

                {/* Bold, Italic, Underline (N, K, S) */}
                <button
                    type="button"
                    onClick={() => executeCommand('bold')}
                    className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-lg font-black text-xs transition-colors"
                    title="Negrita"
                >
                    N
                </button>
                <button
                    type="button"
                    onClick={() => executeCommand('italic')}
                    className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-lg font-serif italic text-xs transition-colors"
                    title="Cursiva"
                >
                    K
                </button>
                <button
                    type="button"
                    onClick={() => executeCommand('underline')}
                    className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-lg underline text-xs transition-colors"
                    title="Subrayado"
                >
                    S
                </button>

                <div className="h-4 w-px bg-slate-300 mx-1 shrink-0" />

                {/* Font Color Button */}
                <div className="relative group">
                    <button
                        type="button"
                        className="w-7 h-7 flex flex-col items-center justify-center hover:bg-slate-200 text-slate-800 rounded-lg transition-colors"
                        title="Color de fuente"
                    >
                        <span className="text-[10px] font-black leading-none">A</span>
                        <div className="w-3.5 h-0.5 bg-red-500 mt-0.5" />
                    </button>
                    <div className="absolute left-0 top-full mt-1 hidden group-hover:grid grid-cols-4 gap-1 p-2 bg-white border border-slate-200 rounded-xl shadow-xl z-[70] w-28">
                        {colors.map(c => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => executeCommand('foreColor', c)}
                                className="w-5 h-5 rounded-full border border-slate-200 hover:scale-110 transition-transform shadow-sm"
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                </div>

                {/* Highlight/Pen Button */}
                <div className="relative group">
                    <button
                        type="button"
                        className="w-7 h-7 flex flex-col items-center justify-center hover:bg-slate-200 text-slate-800 rounded-lg transition-colors"
                        title="Color de resaltado"
                    >
                        <span className="text-[9px] leading-none">🖊️</span>
                        <div className="w-3.5 h-0.5 bg-yellow-400 mt-0.5" />
                    </button>
                    <div className="absolute left-0 top-full mt-1 hidden group-hover:grid grid-cols-4 gap-1 p-2 bg-white border border-slate-200 rounded-xl shadow-xl z-[70] w-28">
                        {highlights.map(h => (
                            <button
                                key={h}
                                type="button"
                                onClick={() => executeCommand('hiliteColor', h)}
                                className="w-5 h-5 rounded-full border border-slate-200 hover:scale-110 transition-transform shadow-sm flex items-center justify-center"
                                style={{ backgroundColor: h === 'transparent' ? '#ffffff' : h }}
                                title={h === 'transparent' ? 'Sin color' : h}
                            >
                                {h === 'transparent' && <span className="text-[8px] text-red-500 font-bold">✕</span>}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-4 w-px bg-slate-300 mx-1 shrink-0" />

                {/* Alignment buttons */}
                <button
                    type="button"
                    onClick={() => executeCommand('justifyLeft')}
                    className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 text-slate-700 rounded-lg text-xs"
                    title="Alinear a la izquierda"
                >
                    ⫷
                </button>
                <button
                    type="button"
                    onClick={() => executeCommand('justifyCenter')}
                    className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 text-slate-700 rounded-lg text-xs"
                    title="Centrar"
                >
                    ⫸⫷
                </button>
                <button
                    type="button"
                    onClick={() => executeCommand('justifyRight')}
                    className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 text-slate-700 rounded-lg text-xs"
                    title="Alinear a la derecha"
                >
                    ⫸
                </button>
                <button
                    type="button"
                    onClick={() => executeCommand('justifyFull')}
                    className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 text-slate-700 rounded-lg text-xs"
                    title="Justificar"
                >
                    ⫶⫶
                </button>

                <div className="h-4 w-px bg-slate-300 mx-1 shrink-0" />

                {/* List buttons */}
                <button
                    type="button"
                    onClick={() => executeCommand('insertUnorderedList')}
                    className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                    title="Viñetas"
                >
                    •⦚
                </button>
                <button
                    type="button"
                    onClick={() => executeCommand('insertOrderedList')}
                    className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                    title="Numeración"
                >
                    1.⦚
                </button>

                <div className="h-4 w-px bg-slate-300 mx-1 shrink-0" />

                {/* Undo / Redo */}
                <button
                    type="button"
                    onClick={() => executeCommand('undo')}
                    className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                    title="Deshacer"
                >
                    ↶
                </button>
                <button
                    type="button"
                    onClick={() => executeCommand('redo')}
                    className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                    title="Rehacer"
                >
                    ↷
                </button>
            </div>

            {/* Editable Area */}
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                className="w-full flex-1 min-h-[120px] p-6 bg-white outline-none overflow-y-auto text-sm text-slate-800 focus:ring-0 leading-relaxed custom-scrollbar rich-text-content prose max-w-none text-justify"
                style={{ fontFamily: 'Outfit, sans-serif' }}
            />
        </div>
    )
}
