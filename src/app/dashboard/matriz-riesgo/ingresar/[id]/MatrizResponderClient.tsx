'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { searchColegiosMatriz } from '../../actions'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'

const CATEGORIES = [
    { id: 'PATIO_SERVICIO', label: 'Patio de servicio', activeTabClass: 'bg-amber-100 text-amber-900 border-amber-300' },
    { id: 'BODEGA', label: 'Bodega', activeTabClass: 'bg-orange-100 text-orange-950 border-orange-300' },
    { id: 'COCINA', label: 'Cocina', activeTabClass: 'bg-emerald-100 text-emerald-950 border-emerald-300' },
    { id: 'BANO', label: 'Baño', activeTabClass: 'bg-cyan-100 text-cyan-950 border-cyan-300' },
    { id: 'LEVANTAMIENTO_GENERAL', label: 'Levantamiento General', activeTabClass: 'bg-blue-100 text-blue-950 border-blue-300' }
]

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

export default function MatrizResponderClient({ matrix, uts, colegios, sessionUser }: any) {
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [geoStatus, setGeoStatus] = useState<'checking' | 'active' | 'denied' | 'unavailable' | 'unsupported'>('checking')
    const [geoCoords, setGeoCoords] = useState<{ lat: number, lng: number } | null>(null)
    const [geoRetrying, setGeoRetrying] = useState(false)

    const requestGeoPosition = (isRetry = false) => {
        if (isRetry) setGeoRetrying(true)
        setGeoStatus('checking')
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGeoStatus('active')
                setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
                setGeoRetrying(false)
            },
            (err) => {
                setGeoRetrying(false)
                if (err.code === err.PERMISSION_DENIED) {
                    setGeoStatus('denied') // Blocked by user/site
                } else {
                    setGeoStatus('unavailable') // Timeout or position unavailable
                }
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
        )
    }

    useEffect(() => {
        if (!navigator.geolocation) {
            setGeoStatus('unsupported')
            return
        }
        requestGeoPosition()
    }, [])

    // Modal state for Sostenedor Letter
    const [sostenedorModal, setSostenedorModal] = useState<{
        isOpen: boolean
        findings: any[]
        formatos: any[]
        email: string
        selectedFormatoIdx: number | null
        asunto: string
        cuerpo: string
        enviando: boolean
    }>({
        isOpen: false,
        findings: [],
        formatos: [],
        email: '',
        selectedFormatoIdx: null,
        asunto: '',
        cuerpo: '',
        enviando: false
    })

    const pdfRef = useRef<HTMLDivElement | null>(null)

    const replaceSostenedorTags = (text: string) => {
        if (!selectedColegio) return text
        const auditor = sessionUser?.name || sessionUser?.username || 'Supervisor'
        const now = new Date()
        const day = String(now.getDate()).padStart(2, '0')
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const year = now.getFullYear()
        const formattedDate = `${day}/${month}/${year}`

        return text
            .replace(/(?:<RBD.*?>|&lt;RBD.*?&gt;)/gi, String(selectedColegio.colRBD))
            .replace(/(?:<Colegio.*?>|&lt;Colegio.*?&gt;)/gi, selectedColegio.nombreEstablecimiento)
            .replace(/(?:<Usuario.*?>|&lt;Usuario.*?&gt;)/gi, auditor)
            .replace(/(?:<Sucursal.*?>|&lt;Sucursal.*?&gt;)/gi, selectedColegio.sucursal)
            .replace(/(?:<Comuna.*?>|&lt;Comuna.*?&gt;)/gi, selectedColegio.comuna || '')
            .replace(/(?:<Fecha.*?>|&lt;Fecha.*?&gt;)/gi, formattedDate)
    }

    const handleEnviarCarta = async () => {
        if (!sostenedorModal.email || !sostenedorModal.email.includes('@')) {
            return alert('Por favor, ingrese un correo válido para el Sostenedor.')
        }

        setSostenedorModal(prev => ({ ...prev, enviando: true }))

        try {
            // Wait for DOM to render the offscreen div
            await new Promise(resolve => setTimeout(resolve, 300))

            if (!pdfRef.current) {
                throw new Error('Elemento de referencia del PDF no encontrado.')
            }

            const canvas = await html2canvas(pdfRef.current, {
                scale: 1.5,
                useCORS: true,
                backgroundColor: '#ffffff',
                windowWidth: 800,
                windowHeight: pdfRef.current.scrollHeight
            })

            const imgData = canvas.toDataURL('image/jpeg', 0.95)
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            })

            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = pdf.internal.pageSize.getHeight()
            const imgProps = pdf.getImageProperties(imgData)
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight)
            const pdfBase64 = pdf.output('datauristring')

            const response = await fetch('/api/matriz-riesgo/enviar-carta-sostenedor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: sostenedorModal.email,
                    subject: replaceSostenedorTags(sostenedorModal.asunto),
                    body: replaceSostenedorTags(sostenedorModal.cuerpo),
                    pdfBase64,
                    filename: `Carta_Compromiso_Sostenedor_RBD_${selectedColegio.colRBD}.pdf`
                })
            })

            const result = await response.json()
            if (result.success) {
                alert('¡Carta al Sostenedor enviada con éxito!')
                router.push('/dashboard/matriz-riesgo/ingresar')
            } else {
                alert(result.error || 'Error al enviar el correo.')
            }
        } catch (e: any) {
            console.error(e)
            alert('Error al generar o enviar la carta en PDF: ' + e.message)
        } finally {
            setSostenedorModal(prev => ({ ...prev, enviando: false }))
        }
    }
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

        // Capture Geolocation
        let latIngreso: number | null = null
        let lngIngreso: number | null = null
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                })
            })
            latIngreso = position.coords.latitude
            lngIngreso = position.coords.longitude
        } catch (err) {
            console.warn('Fallo o denegación de geolocalización:', err)
        }

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
                respuestas: formattedAnswers,
                latIngreso,
                lngIngreso
            }
            
            const res = await fetch('/api/matriz-riesgo/save-respuesta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            const data = await res.json()
            
            if (data.success) {
                if (data.sostenedorFindings && data.sostenedorFindings.length > 0) {
                    const formats = data.formatosCarta || []
                    const finalFormats = formats.length > 0 ? formats : [{
                        id: 'default-fallback',
                        nombre: 'Formato R_GO_8_12',
                        asuntoEmail: 'Carta Informativa Condiciones de Infraestructura - RBD <RBD>',
                        cuerpoEmail: 'Estimado Sostenedor,\n\nAdjuntamos Carta Informativa sobre las Condiciones de Infraestructura de Responsabilidad del Sostenedor para el establecimiento <Colegio> (RBD <RBD>).\n\nAtentamente,\nEquipo Hendaya.',
                        cuerpoInicio: DEFAULT_CARTA_INICIO,
                        cuerpoFin: DEFAULT_CARTA_FIN,
                        activo: true
                    }]
                    
                    setSostenedorModal({
                        isOpen: true,
                        findings: data.sostenedorFindings,
                        formatos: finalFormats,
                        email: '',
                        selectedFormatoIdx: 0,
                        asunto: finalFormats[0].asuntoEmail,
                        cuerpo: finalFormats[0].cuerpoEmail,
                        enviando: false
                    })
                } else {
                    alert('¡Matriz guardada con éxito!')
                    router.push('/dashboard/matriz-riesgo/ingresar')
                }
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
            {/* Geolocation Status Banner */}
            {geoStatus === 'active' && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-300">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-3 w-3 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                                📍 Compartiendo Geolocalización
                            </p>
                            <p className="text-xs text-emerald-800 mt-0.5 font-medium">
                                Su ubicación está siendo compartida activamente para el registro seguro de la auditoría.
                            </p>
                        </div>
                    </div>
                    {geoCoords && (
                        <div className="bg-white/80 backdrop-blur-sm border border-emerald-200/50 px-3 py-1 rounded-2xl text-[10px] font-black text-emerald-900 tracking-wider shrink-0 self-start sm:self-center">
                            LAT: {geoCoords.lat.toFixed(6)} | LNG: {geoCoords.lng.toFixed(6)}
                        </div>
                    )}
                </div>
            )}
            {geoStatus === 'denied' && (
                <div className="bg-red-50 border border-red-200 rounded-3xl p-4 animate-in fade-in duration-300 space-y-3">
                    <div className="flex items-start gap-3">
                        <span className="text-red-500 text-lg shrink-0 mt-0.5">🔒</span>
                        <div className="flex-1">
                            <p className="text-sm font-black text-red-900">
                                Geolocalización bloqueada para este sitio
                            </p>
                            <p className="text-xs text-red-700 mt-1 font-medium leading-relaxed">
                                El navegador tiene bloqueado el acceso a la ubicación <b>para esta página</b>. Siga estos pasos para activarla:
                            </p>
                            <ol className="mt-2 space-y-1 text-xs text-red-800 font-medium list-decimal list-inside leading-relaxed">
                                <li>Haga clic en el ícono 🔒 (candado) a la izquierda de la URL en el navegador</li>
                                <li>Seleccione <b>"Permisos del sitio"</b> o <b>"Configuración del sitio"</b></li>
                                <li>En <b>"Ubicación"</b>, cambie de <b>"Bloquear"</b> a <b>"Permitir"</b></li>
                                <li>Recargue la página y vuelva a ingresar</li>
                            </ol>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={() => requestGeoPosition(true)}
                            disabled={geoRetrying}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                        >
                            {geoRetrying ? <><span className="animate-spin">↻</span> Verificando...</> : '🔄 Reintentar'}
                        </button>
                    </div>
                </div>
            )}
            {geoStatus === 'unavailable' && (
                <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 flex items-center justify-between gap-3 animate-in fade-in duration-300">
                    <div className="flex items-center gap-3">
                        <span className="text-amber-500 text-lg shrink-0">⚠️</span>
                        <div>
                            <p className="text-sm font-bold text-amber-950">
                                No se pudo obtener la ubicación
                            </p>
                            <p className="text-xs text-amber-800 mt-0.5 font-medium">
                                El servicio de ubicación tardó demasiado o no está disponible. Verifique que la ubicación esté activada en su dispositivo.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => requestGeoPosition(true)}
                        disabled={geoRetrying}
                        className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                    >
                        {geoRetrying ? <><span className="animate-spin">↻</span> Verificando...</> : '🔄 Reintentar'}
                    </button>
                </div>
            )}
            {geoStatus === 'checking' && (
                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4 flex items-center gap-3 animate-in fade-in duration-300">
                    <span className="animate-spin text-slate-500 text-xs shrink-0">🔄</span>
                    <div>
                        <p className="text-sm font-bold text-slate-900">
                            Verificando geolocalización...
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            Si aparece un diálogo del navegador solicitando permiso, por favor seleccione <b>Permitir</b>.
                        </p>
                    </div>
                </div>
            )}
            {geoStatus === 'unsupported' && (
                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4 flex items-center gap-3 animate-in fade-in duration-300">
                    <span className="text-slate-500 shrink-0">🚫</span>
                    <div>
                        <p className="text-sm font-bold text-slate-900">
                            Geolocalización no soportada
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            Su navegador o dispositivo actual no permite el uso de ubicación.
                        </p>
                    </div>
                </div>
            )}

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

            {/* MODAL CARTA SOSTENEDOR */}
            {sostenedorModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <span>✉️</span> Carta de Compromiso del Sostenedor
                            </h3>
                            <button 
                                onClick={() => {
                                    if (confirm('¿Está seguro de cerrar? Se omitirá el envío de la carta al sostenedor.')) {
                                        router.push('/dashboard/matriz-riesgo/ingresar')
                                    }
                                }} 
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="bg-cyan-50 border border-cyan-100 rounded-2xl p-4 text-xs text-cyan-800 leading-normal">
                                Se han detectado <b>{sostenedorModal.findings.length} desviaciones</b> de responsabilidad del Sostenedor. Complete los datos para enviar la carta de compromisos.
                            </div>

                            {/* Dropdown Formatos */}
                            {sostenedorModal.formatos.length > 0 && (
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Formato de Carta</label>
                                    <select
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-black font-semibold text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                                        value={sostenedorModal.selectedFormatoIdx !== null ? sostenedorModal.selectedFormatoIdx : ''}
                                        onChange={(e) => {
                                            const idx = Number(e.target.value)
                                            const selected = sostenedorModal.formatos[idx]
                                            setSostenedorModal(prev => ({
                                                ...prev,
                                                selectedFormatoIdx: idx,
                                                asunto: selected.asuntoEmail,
                                                cuerpo: selected.cuerpoEmail
                                            }))
                                        }}
                                    >
                                        {sostenedorModal.formatos.map((f, idx) => (
                                            <option key={f.id} value={idx}>{f.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Correo Sostenedor */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Correo del Sostenedor</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="ejemplo@sostenedor.cl"
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 text-black font-semibold text-sm outline-none"
                                    value={sostenedorModal.email}
                                    onChange={(e) => setSostenedorModal(prev => ({ ...prev, email: e.target.value }))}
                                />
                            </div>

                            {/* Asunto Correo */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Asunto Correo</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 text-black font-semibold text-sm outline-none"
                                    value={sostenedorModal.asunto}
                                    onChange={(e) => setSostenedorModal(prev => ({ ...prev, asunto: e.target.value }))}
                                />
                            </div>

                            {/* Cuerpo Correo */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Cuerpo Correo (Email)</label>
                                <textarea
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 text-black font-semibold text-sm outline-none min-h-[100px]"
                                    value={sostenedorModal.cuerpo}
                                    onChange={(e) => setSostenedorModal(prev => ({ ...prev, cuerpo: e.target.value }))}
                                />
                            </div>

                            {/* Detalle de compromisos a incluir */}
                            <div className="space-y-2">
                                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Compromisos a incluir en PDF:</span>
                                <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-xl p-3 bg-slate-50/50 space-y-2">
                                    {sostenedorModal.findings.map((f, i) => (
                                        <div key={i} className="text-xs text-slate-700 bg-white border border-slate-100 p-2.5 rounded-lg font-medium leading-normal shadow-sm">
                                            <span className="font-bold text-cyan-700 uppercase block text-[9px] mb-1">{f.seccion}</span>
                                            {f.compromisoSostenedor}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 flex justify-between bg-gray-50/50">
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirm('Se omitirá el envío de la carta. ¿Desea continuar?')) {
                                        router.push('/dashboard/matriz-riesgo/ingresar')
                                    }
                                }}
                                className="px-5 py-2.5 text-slate-500 hover:bg-slate-100 rounded-xl font-bold transition-all text-sm"
                            >
                                Omitir y Salir
                            </button>

                            <button
                                type="button"
                                onClick={handleEnviarCarta}
                                disabled={sostenedorModal.enviando}
                                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all text-sm disabled:opacity-50 flex items-center gap-2"
                            >
                                {sostenedorModal.enviando ? (
                                    <>
                                        <span className="animate-spin">↻</span> Enviando...
                                    </>
                                ) : (
                                    '✉️ Generar y Enviar Carta'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* HIDDEN CARTA SOSTENEDOR PDF CONTAINER FOR HTML2CANVAS */}
            {sostenedorModal.isOpen && selectedColegio && (
                <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                    <div
                        ref={pdfRef}
                        style={{
                            width: '800px',
                            padding: '60px',
                            background: '#ffffff',
                            color: '#1e293b',
                            fontFamily: 'sans-serif',
                            boxSizing: 'border-box'
                        }}
                    >
                        {/* Company logo/header side-by-side */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0891b2', paddingBottom: '15px', marginBottom: '30px' }}>
                            <div>
                                <span style={{ fontSize: '32px', fontWeight: 'black', color: '#0891b2', letterSpacing: '-1px' }}>HENDAYA</span>
                            </div>
                            <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '12px', color: '#000000' }}>
                                <span style={{ display: 'block', fontSize: '8px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px', fontWeight: 'semibold' }}>Fecha de Creación</span>
                                {(() => {
                                    const now = new Date()
                                    const day = String(now.getDate()).padStart(2, '0')
                                    const month = String(now.getMonth() + 1).padStart(2, '0')
                                    const year = now.getFullYear()
                                    return `${day} / ${month} / ${year}`
                                })()}
                            </div>
                        </div>

                        {/* Document Title */}
                        <div style={{ textAlign: 'center', margin: '30px 0 25px 0' }}>
                            <h2 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a', margin: '0 0 5px 0', lineHeight: '1.4' }}>
                                CARTA INFORMATIVA
                            </h2>
                            <h2 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a', margin: '0', lineHeight: '1.4' }}>
                                CONDICIONES DE INFRAESTRUCTURA DE RESPONSABILIDAD SOSTENEDOR
                            </h2>
                        </div>

                        {/* Intro text (contains Colegio, RBD, Comuna dynamically) */}
                        <div 
                            className="rich-text-content"
                            style={{ fontSize: '12px', lineHeight: '1.6', color: '#1e293b', marginBottom: '20px', textAlign: 'justify' }}
                            dangerouslySetInnerHTML={{
                                __html: sostenedorModal.selectedFormatoIdx !== null && sostenedorModal.formatos[sostenedorModal.selectedFormatoIdx]
                                    ? replaceSostenedorTags(sostenedorModal.formatos[sostenedorModal.selectedFormatoIdx].cuerpoInicio)
                                    : replaceSostenedorTags(DEFAULT_CARTA_INICIO)
                            }}
                        />

                        {/* Compromises Table (only if findings exist) */}
                        {sostenedorModal.findings.length > 0 && (
                            <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                                <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                                    Desviaciones y Compromisos Asignados (Dinámicos)
                                </p>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1' }}>
                                    <thead>
                                        <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                                            <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'left', fontSize: '10px', fontWeight: 'bold', color: '#334155', width: '25%' }}>Área / Sección</th>
                                            <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'left', fontSize: '10px', fontWeight: 'bold', color: '#334155' }}>Compromiso a realizar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sostenedorModal.findings.map((f, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #cbd5e1' }}>
                                                <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold', color: '#0891b2' }}>{f.seccion}</td>
                                                <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontSize: '10px', color: '#334155', lineHeight: '1.4' }}>{f.compromisoSostenedor}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Outro text */}
                        <div 
                            className="rich-text-content"
                            style={{ fontSize: '12px', lineHeight: '1.6', color: '#1e293b', marginBottom: '40px', textAlign: 'justify' }}
                            dangerouslySetInnerHTML={{
                                __html: sostenedorModal.selectedFormatoIdx !== null && sostenedorModal.formatos[sostenedorModal.selectedFormatoIdx]
                                    ? replaceSostenedorTags(sostenedorModal.formatos[sostenedorModal.selectedFormatoIdx].cuerpoFin)
                                    : replaceSostenedorTags(DEFAULT_CARTA_FIN)
                            }}
                        />

                        {/* Signatures block */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 20px' }}>
                            <div style={{ width: '45%', textAlign: 'center' }}>
                                <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '10px', fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>
                                    Nombre y Timbre Encargado PAE/ Director
                                </div>
                            </div>
                            <div style={{ width: '45%', textAlign: 'center' }}>
                                <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '10px', fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>
                                    Nombre y Firma Representante Empresa
                                </div>
                            </div>
                        </div>

                        {/* Footer metadata */}
                        <div style={{ textAlign: 'right', fontSize: '9px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '40px' }}>
                            Código: R_GO_8_12<br />
                            Versión: 04
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
