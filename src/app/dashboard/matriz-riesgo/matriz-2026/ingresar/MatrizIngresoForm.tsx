'use client'

import { useState, useEffect } from 'react'
import { searchColegiosMatriz, saveMatriz2026, uploadMatrizFile, getMatrizExistence } from '../../actions'

// DO NOT CHANGE THESE LABELS OR VALUES UNLESS EXPLICITLY INSTRUCTED BY THE USER.
const OPTIONS_CONFIG = [
    { label: "Bueno / Cumple", value: "Bueno / Cumple", color: "bg-emerald-500 text-white", activeClass: "ring-4 ring-emerald-200 shadow-emerald-200" },
    { label: "Malo requiere cambio o reparación / No Cumple", value: "Malo requiere cambio o reparación / No Cumple", color: "bg-red-500 text-white", activeClass: "ring-4 ring-red-200 shadow-red-200" },
    { label: "No hay y requiere instalar", value: "No hay y requiere instalar", color: "bg-orange-500 text-white", activeClass: "ring-4 ring-orange-200 shadow-orange-200" },
    { label: "No hay y no requiere", value: "No hay y no requiere", color: "bg-gray-400 text-white", activeClass: "ring-4 ring-gray-100 shadow-gray-100" },
    { label: "No existe", value: "No existe", color: "bg-slate-700 text-white", activeClass: "ring-4 ring-slate-200 shadow-slate-200" },
    { label: "No Aplica", value: "No aplica", color: "bg-slate-500 text-white", activeClass: "ring-4 ring-slate-100 shadow-slate-100" }
]

// DO NOT CHANGE THESE LABELS OR VALUES UNLESS EXPLICITLY INSTRUCTED BY THE USER.
const EXISTENCE_OPTIONS = [
    { label: "Existe", value: "Existe", color: "bg-emerald-500 text-white", activeClass: "ring-4 ring-emerald-200 shadow-emerald-200" },
    { label: "No existe", value: "No existe", color: "bg-slate-700 text-white", activeClass: "ring-4 ring-slate-200 shadow-slate-200" }
]

const QuickOptionButtons = ({ label, field, formData, handleInputChange, errors = [], options = OPTIONS_CONFIG }: { label: string, field: string, formData: any, handleInputChange: any, errors?: string[], options?: any[] }) => {
    const currentValue = formData[field]
    return (
        <div className="space-y-3 p-4 bg-gray-50/50 rounded-2xl border border-gray-100 transition-all hover:bg-white hover:shadow-sm">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-tight">{label}</label>
            <div className={`grid gap-2 ${options.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                {options.map(opt => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleInputChange(field, opt.value)}
                        className={`py-2.5 px-2 rounded-xl text-[10px] font-black transition-all transform active:scale-95 flex items-center justify-center text-center leading-tight
                            ${currentValue === opt.value ? `${opt.color} ${opt.activeClass} scale-105` : 'bg-white text-slate-500 border border-gray-200 hover:border-slate-300 hover:bg-slate-50'}
                        `}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

const TextAreaField = ({ label, field, formData, handleInputChange }: { label: string, field: string, formData: any, handleInputChange: any }) => (
    <div className="space-y-1">
        <label className="block text-sm font-semibold text-gray-700">{label}</label>
        <textarea 
            maxLength={500}
            placeholder="Indicar observaciones..."
            className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none h-24 bg-white text-black font-black"
            value={formData[field] || ''}
            onChange={(e) => handleInputChange(field, e.target.value)}
        />
        <div className="text-[10px] text-right text-gray-400">{(formData[field] || '').length}/500</div>
    </div>
)

const FileUploadField = ({ label, section, files, handleFileChange, removeFile }: { label: string, section: string, files: any, handleFileChange: (s: string, e: React.ChangeEvent<HTMLInputElement>) => void, removeFile: (s: string, i: number) => void }) => (
    <div className="mt-4 p-4 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
        <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
        <p className="text-[10px] text-gray-500 mb-2">Máximo 5 archivos (Imagen o PDF). Máx 100MB por archivo.</p>
        <input 
            type="file" 
            multiple 
            accept="image/*,application/pdf"
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
            onChange={(e) => handleFileChange(section, e)}
        />
        {files[section] && files[section].length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {files[section].map((f: any, i: number) => (
                    <div key={i} className="relative group p-2 bg-white rounded-lg border border-gray-200">
                        <div className="text-[10px] truncate pr-4">{f.name}</div>
                        <button onClick={() => removeFile(section, i)} className="absolute top-1 right-1 text-red-500 hover:text-red-700">✕</button>
                    </div>
                ))}
            </div>
        )}
    </div>
)

const StepHeader = ({ step }: { step: number }) => (
    <div className="flex justify-between items-center mb-8 bg-gray-50 p-4 rounded-xl">
        {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step === s ? 'bg-cyan-600 text-white' : (step > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500')}`}>
                     {step > s ? '✓' : s}
                </div>
            </div>
        ))}
    </div>
)

export default function MatrizIngresoForm({ user }: { user: any }) {
    const [step, setStep] = useState<number>(1)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [errors, setErrors] = useState<string[]>([])
    
    // Header Data
    const [colegioQuery, setColegioQuery] = useState('')
    const [colegioResults, setColegioResults] = useState<any[]>([])
    const [selectedColegio, setSelectedColegio] = useState<any>(null)
    const [existingAuditDate, setExistingAuditDate] = useState<Date | null>(null)

    // Form State
    const [formData, setFormData] = useState<any>({
        patio_servicio: '', basurero_patio: '', zonas_libres_residuos: '', vias_acceso_pavimentas: '',
        caseta_gas: '', bombona_estado: '', focos_insalubridad: '', obs_patio: '',
        bodega_mp: '', ventilacion_bodega: '', cielos_bodega: '', puertas_bodega: '', ventanas_bodega: '',
        malla_bodega: '', pisos_bodega: '', paredes_bodega: '', uniones_bodega: '', iluminacion_estado_bodega: '',
        iluminacion_protegida_bodega: '', iluminacion_adecuada_bodega: '', botiquin: '', extintores: '',
        conexiones_electricas_bodega: '', equipos_frio_sin_visor: 0, obs_bodega: '',
        tamano_cocina: '', ventilacion_cocina: '', puertas_cocina: '', ventanas_cocina: '', malla_cocina: '',
        pisos_cocina: '', paredes_cocina: '', uniones_cocina: '', drenajes: '', inclinacion_pisos: '',
        cielos_cocina: '', lava_fondos: '', lavamanos_manipulacion: '', dispensador_jabon_papel: '',
        calefon: '', pre_wash: '', extractor_campana: '', carros_bandejas: '', iluminacion_estado_cocina: '',
        iluminacion_protegida_cocina: '', iluminacion_adecuada_cocina: '', basureros_tapa_cocina: '',
        llaves_sifon_cocina: '', canerias_agua: '', canerias_gas: '', conexiones_electricas_cocina: '',
        trampas_residuos: '', obs_cocina: '',
        bano_exclusivo: '', sin_conexion_directa: '', puertas_bano: '', malla_bano: '', pisos_bano: '',
        paredes_bano: '', lavamanos_caliente_fria: '', ducha: '', cortina: '', dispensadores_jabon_bano: '',
        estanque_tapa_wc: '', espejo: '', basurero_tapa_bano: '', llaves_sifon_bano: '', dispensador_papel: '',
        iluminaria_bano: '', obs_bano: '',
        obs_generales: ''
    })

    // Files State
    const [files, setFiles] = useState<{ [key: string]: File[] }>({
        patio: [], bodega: [], cocina: [], bano: [], sostenedor: []
    })

    // Search Logic
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (colegioQuery.length > 1 && !selectedColegio) {
                const res = await searchColegiosMatriz(colegioQuery)
                if (res?.colegios) setColegioResults(res.colegios)
            } else {
                setColegioResults([])
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [colegioQuery, selectedColegio])

    const handleSelectColegio = async (colegio: any) => {
        setSelectedColegio(colegio)
        setColegioResults([])
        setColegioQuery(colegio.nombreEstablecimiento)
        setFormData((prev: any) => ({ ...prev, rbd: colegio.colRBD, ut: colegio.colut }))
        
        // Verificar existencia
        const check = await getMatrizExistence(colegio.colRBD)
        if (check?.exists) {
            setExistingAuditDate(new Date(check.date))
        } else {
            setExistingAuditDate(null)
        }
        setErrors(prev => prev.filter(e => !e.includes('RBD')))
    }

    const handleInputChange = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }))
        setErrors([]) 
    }

    const handleFileChange = (section: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles = Array.from(e.target.files || [])
        setFiles((prev: any) => {
            const currentFiles = prev[section] || []
            const combined = [...currentFiles, ...newFiles]
            if (combined.length > 5) {
                alert('Solo se permite un máximo de 5 archivos por sección.')
                return { ...prev, [section]: combined.slice(0, 5) }
            }
            return { ...prev, [section]: combined }
        })
    }

    const removeFile = (section: string, index: number) => {
        setFiles((prev: any) => ({
            ...prev,
            [section]: prev[section].filter((_: any, i: number) => i !== index)
        }))
    }

    const validateStep = (s: number) => {
        const newErrors: string[] = []
        if (s === 1) {
            if (!selectedColegio) newErrors.push('Debe seleccionar un establecimiento (RBD).')
            if (!formData.patio_servicio) newErrors.push('Debe responder si existe Patio o no.')
            if (formData.patio_servicio !== "No existe") {
                const required = ['basurero_patio', 'zonas_libres_residuos', 'vias_acceso_pavimentas', 'caseta_gas', 'bombona_estado', 'focos_insalubridad']
                required.forEach(f => { if (!formData[f]) newErrors.push(`Falta responder ítem en Patio.`) })
            }
        }
        if (s === 2) {
            const required = ['bodega_mp', 'ventilacion_bodega', 'cielos_bodega', 'puertas_bodega', 'ventanas_bodega', 'malla_bodega', 'pisos_bodega', 'paredes_bodega', 'uniones_bodega', 'iluminacion_estado_bodega', 'iluminacion_protegida_bodega', 'iluminacion_adecuada_bodega', 'botiquin', 'extintores', 'conexiones_electricas_bodega']
            required.forEach(f => { if (!formData[f]) newErrors.push(`Falta responder ítem en Bodega.`) })
        }
        if (s === 3) {
            const required = ['tamano_cocina', 'ventilacion_cocina', 'puertas_cocina', 'ventanas_cocina', 'malla_cocina', 'pisos_cocina', 'paredes_cocina', 'uniones_cocina', 'drenajes', 'inclinacion_pisos', 'cielos_cocina', 'lava_fondos', 'lavamanos_manipulacion', 'dispensador_jabon_papel', 'calefon', 'pre_wash', 'extractor_campana', 'carros_bandejas', 'iluminacion_estado_cocina', 'iluminacion_protegida_cocina', 'iluminacion_adecuada_cocina', 'basureros_tapa_cocina', 'llaves_sifon_cocina', 'canerias_agua', 'canerias_gas', 'conexiones_electricas_cocina', 'trampas_residuos']
            required.forEach(f => { if (!formData[f]) newErrors.push(`Falta responder ítem en Cocina.`) })
        }
        if (s === 4) {
            if (!formData.bano_exclusivo) newErrors.push('Debe responder si existe Baño o no.')
            if (formData.bano_exclusivo !== "No existe") {
                const required = ['sin_conexion_directa', 'puertas_bano', 'malla_bano', 'pisos_bano', 'paredes_bano', 'lavamanos_caliente_fria', 'ducha', 'cortina', 'dispensadores_jabon_bano', 'estanque_tapa_wc', 'espejo', 'basurero_tapa_bano', 'llaves_sifon_bano', 'dispensador_papel', 'iluminaria_bano']
                required.forEach(f => { if (!formData[f]) newErrors.push(`Falta responder ítem en Baño.`) })
            }
        }
        setErrors(newErrors)
        return newErrors.length === 0
    }

    const handleNext = () => {
        if (validateStep(step)) {
            setStep(prev => prev + 1)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }

    const handleSubmit = async () => {
        if (!validateStep(step)) return

        setLoading(true)
        setMessage(null)

        try {
            const adjuntos: any = { patio: [], bodega: [], cocina: [], bano: [], sostenedor: [] }
            
            for (const section of Object.keys(files)) {
                for (const file of files[section]) {
                    const reader = new FileReader()
                    const base64: string = await new Promise((resolve) => {
                        reader.onload = () => resolve(reader.result as string)
                        reader.readAsDataURL(file)
                    })
                    const res = await uploadMatrizFile(base64, file.name, selectedColegio.colRBD, section)
                    if (res?.success) adjuntos[section].push(res.path)
                }
            }

            const finalData = {
                ...formData,
                rbd: selectedColegio.colRBD,
                ut: selectedColegio.colut,
                nombreEstablecimiento: selectedColegio.nombreEstablecimiento,
                sucursal: selectedColegio.sucursal,
                adjuntos_patio: JSON.stringify(adjuntos.patio),
                adjuntos_bodega: JSON.stringify(adjuntos.bodega),
                adjuntos_cocina: JSON.stringify(adjuntos.cocina),
                adjuntos_bano: JSON.stringify(adjuntos.bano),
                adjunto_sostenedor: adjuntos.sostenedor[0] || null
            }

            const res = await saveMatriz2026(finalData)
            if (res.success) {
                setMessage({ type: 'success', text: '¡Matriz guardada correctamente!' })
                setStep(1)
                setSelectedColegio(null)
                setColegioQuery('')
                setFiles({ patio: [], bodega: [], cocina: [], bano: [], sostenedor: [] })
                setFormData({
                    patio_servicio: '', basurero_patio: '', zonas_libres_residuos: '', vias_acceso_pavimentas: '',
                    caseta_gas: '', bombona_estado: '', focos_insalubridad: '', obs_patio: '',
                    bodega_mp: '', ventilacion_bodega: '', cielos_bodega: '', puertas_bodega: '', ventanas_bodega: '',
                    malla_bodega: '', pisos_bodega: '', paredes_bodega: '', uniones_bodega: '', iluminacion_estado_bodega: '',
                    iluminacion_protegida_bodega: '', iluminacion_adecuada_bodega: '', botiquin: '', extintores: '',
                    conexiones_electricas_bodega: '', equipos_frio_sin_visor: 0, obs_bodega: '',
                    tamano_cocina: '', ventilacion_cocina: '', puertas_cocina: '', ventanas_cocina: '', malla_cocina: '',
                    pisos_cocina: '', paredes_cocina: '', uniones_cocina: '', drenajes: '', inclinacion_pisos: '',
                    cielos_cocina: '', lava_fondos: '', lavamanos_manipulacion: '', dispensador_jabon_papel: '',
                    calefon: '', pre_wash: '', extractor_campana: '', carros_bandejas: '', iluminacion_estado_cocina: '',
                    iluminacion_protegida_cocina: '', iluminacion_adecuada_cocina: '', basureros_tapa_cocina: '',
                    llaves_sifon_cocina: '', canerias_agua: '', canerias_gas: '', conexiones_electricas_cocina: '',
                    trampas_residuos: '', obs_cocina: '',
                    bano_exclusivo: '', sin_conexion_directa: '', puertas_bano: '', malla_bano: '', pisos_bano: '',
                    paredes_bano: '', lavamanos_caliente_fria: '', ducha: '', cortina: '', dispensadores_jabon_bano: '',
                    estanque_tapa_wc: '', espejo: '', basurero_tapa_bano: '', llaves_sifon_bano: '', dispensador_papel: '',
                    iluminaria_bano: '', obs_bano: '',
                    obs_generales: ''
                })
                window.scrollTo({ top: 0, behavior: 'smooth' })
            } else {
                setMessage({ type: 'error', text: res.error || 'Error al guardar.' })
            }
        } catch (e) {
            console.error(e)
            setMessage({ type: 'error', text: 'Ocurrió un error inesperado.' })
        } finally {
            setLoading(false)
        }
    }

    const commonProps = { formData, handleInputChange, errors }
    const fileProps = { files, handleFileChange, removeFile }

    return (
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 mb-12">
            <StepHeader step={step} />

            <div className="p-8">
                {message && (
                    <div className={`p-4 rounded-xl mb-6 font-bold ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        {message.text}
                    </div>
                )}

                {errors.length > 0 && (
                    <div className="p-4 rounded-xl mb-6 bg-red-50 text-red-600 border border-red-100 text-sm">
                        <p className="font-bold mb-1">Por favor completa los campos marcados:</p>
                        <ul className="list-disc list-inside">
                            {Array.from(new Set(errors)).map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                    </div>
                )}

                {step === 1 && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8 border-b border-gray-100">
                            {/* Selector de Colegio */}
                            <div className="space-y-4">
                                <label className="block text-sm font-bold text-slate-700">Seleccionar Establecimiento (RBD o Nombre) *</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="w-full p-4 pl-12 border-2 border-slate-100 rounded-[24px] focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all font-black text-slate-900 bg-white"
                                        placeholder="Escriba RBD o Nombre..."
                                        value={colegioQuery}
                                        onChange={(e) => {
                                            setColegioQuery(e.target.value)
                                            setExistingAuditDate(null)
                                        }}
                                    />
                                    <div className="absolute left-4 top-4.5 text-slate-400">🔍</div>
                                    {colegioResults.length > 0 && (
                                        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-3xl shadow-2xl max-h-60 overflow-y-auto overflow-x-hidden">
                                            {colegioResults.map(c => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    className="w-full p-4 text-left hover:bg-cyan-50 border-b border-gray-50 last:border-0 transition-colors flex justify-between items-center group"
                                                    onClick={() => handleSelectColegio(c)}
                                                >
                                                    <span className="font-black text-slate-900 group-hover:text-cyan-700">{c.nombreEstablecimiento}</span>
                                                    <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-500">RBD: {c.colRBD}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {existingAuditDate && (
                                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <span className="text-2xl">⚠️</span>
                                        <div>
                                            <p className="text-amber-900 font-bold text-[10px] uppercase tracking-tight">Atención: Colegio ya auditado</p>
                                            <p className="text-amber-700 text-xs">Este establecimiento ya presenta una matriz registrada con fecha <b>{existingAuditDate.toLocaleDateString()}</b>.</p>
                                        </div>
                                    </div>
                                )}

                                {selectedColegio && !existingAuditDate && (
                                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3">
                                        <span className="text-xl">✅</span>
                                        <div>
                                            <p className="text-emerald-900 font-bold text-[10px] uppercase">Establecimiento Seleccionado</p>
                                            <p className="text-emerald-700 text-xs font-medium">{selectedColegio.nombreEstablecimiento}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Info Adicional */}
                            <div className="grid grid-cols-2 gap-4 h-fit">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 pl-1">Código UT</label>
                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                                        {selectedColegio?.colut || '---'}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 pl-1">Auditor</label>
                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-slate-300 rounded-full"></span>
                                        {user.username}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Preguntas de la sección */}
                        <div className="space-y-8 pt-4">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-cyan-600 rounded-full"></span>
                                Sección: Patio o Entorno
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <QuickOptionButtons label="¿Existe Patio de servicio? *" field="patio_servicio" options={EXISTENCE_OPTIONS} {...commonProps} />
                                <QuickOptionButtons label={`a).-¿Cuenta con basurero (concesionario) en el patio de servicio o en el espacio asignado, en buen estado y de tamaño adecuado? ${formData.patio_servicio === "No existe" ? "" : "*"}`} field="basurero_patio" {...commonProps} />
                                <QuickOptionButtons label={`b).-¿La zona que rodea estas áreas se mantienen libres de residuos (ejemplo: escombros, muebles, otros)? ${formData.patio_servicio === "No existe" ? "" : "*"}`} field="zonas_libres_residuos" {...commonProps} />
                                <QuickOptionButtons label={`c).-¿Las vías de acceso y zonas de circulación se encuentran pavimentadas? ${formData.patio_servicio === "No existe" ? "" : "*"}`} field="vias_acceso_pavimentas" {...commonProps} />
                                <QuickOptionButtons label={`d).-Cuenta con caseta de Gas en buen estado ${formData.patio_servicio === "No existe" ? "" : "*"}`} field="caseta_gas" {...commonProps} />
                                <QuickOptionButtons label={`e).-Bombona en buen estado ${formData.patio_servicio === "No existe" ? "" : "*"}`} field="bombona_estado" {...commonProps} />
                                <QuickOptionButtons label={`f).-¿El recinto del servicio de alimentación se encuentra ubicada alejada de focos de insalubridad, olores objetables, humo, contaminantes y no expuestas a inundaciones? ${formData.patio_servicio === "No existe" ? "" : "*"}`} field="focos_insalubridad" {...commonProps} />
                            </div>
                            <TextAreaField label="g).-Indicar observaciones para los ítems que NO CUMPLEN" field="obs_patio" {...commonProps} />
                            <FileUploadField label="h).-Suba las imágenes del Patio o Entorno" section="patio" {...fileProps} />
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                         <h3 className="text-lg font-black text-cyan-700 uppercase">Sección: Bodega</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <QuickOptionButtons label="a).-¿Cuenta con bodega para almacenamiento de materias primas? *" field="bodega_mp" {...commonProps} />
                             <QuickOptionButtons label="b).-¿La bodega tiene buenas condiciones de ventilación para un correcto almacenamiento de materias primas? *" field="ventilacion_bodega" {...commonProps} />
                             <QuickOptionButtons label="c).-¿Los cielos y estructuras elevadas de la bodega se encuentran en buen estado de conservación, de manera de reducir al mínimo la acumulación de suciedad y de condensación, así como el desprendimiento de partículas? *" field="cielos_bodega" {...commonProps} />
                             <QuickOptionButtons label="d).-Puertas, permiten mantener el recinto hermético de tal forma que no exista riesgo de ingreso de plagas? *" field="puertas_bodega" {...commonProps} />
                             <QuickOptionButtons label="e).-¿Las ventanas y otras aberturas se encuentran en buen estado de modo de reducir al mínimo la acumulación de suciedad y son herméticas? *" field="ventanas_bodega" {...commonProps} />
                             <QuickOptionButtons label="f).-¿Las ventanas que se abren cuentan con malla mosquitera en buen estado y son herméticas? *" field="malla_bodega" {...commonProps} />
                             <QuickOptionButtons label="g).-¿Los pisos de la bodega se encuentran en buen estado de conservación, son de material liso, resistente, fácil de drenar, impermeables al líquido y fácil de limpiar? *" field="pisos_bodega" {...commonProps} />
                             <QuickOptionButtons label="h).-¿Las paredes, puertas, tabiques, techos y zócalos de la bodega se encuentran en buen estado de conservación, son se superficie lisa, e impermeables y de fácil limpieza? *" field="paredes_bodega" {...commonProps} />
                             <QuickOptionButtons label="i).-¿Las uniones de Pared - Pared y de Pared - Piso permiten la fácil limpieza para evitar la acumulación de suciedad y polvo? *" field="uniones_bodega" {...commonProps} />
                             <QuickOptionButtons label="j).-¿Los elementos de iluminación se encuentran en buen estado de funcionamiento (Ampolletas, tubos fluorescentes, halógeno entre otros)? *" field="iluminacion_estado_bodega" {...commonProps} />
                             <QuickOptionButtons label="k).-¿Los equipos de iluminación suspendidos sobre el material alimentario están protegidos para evitar la contaminación de alimentos en caso de rotura? *" field="iluminacion_protegida_bodega" {...commonProps} />
                             <QuickOptionButtons label="l).-¿La iluminación es adecuada para el proceso de manipulación? *" field="iluminacion_adecuada_bodega" {...commonProps} />
                             <QuickOptionButtons label="m).-Botiquín *" field="botiquin" {...commonProps} />
                             <QuickOptionButtons label="n).-Extintores vigentes y en buen estado *" field="extintores" {...commonProps} />
                             <QuickOptionButtons label="o).-Conexiones eléctricas en buen estado y de fácil limpieza *" field="conexiones_electricas_bodega" {...commonProps} />
                             <div className="space-y-1">
                                <label className="block text-sm font-semibold text-gray-700">q).-Indique el número de equipos de frío que no cuentan con visor externo de temperatura (si todos tienen, indique 0).</label>
                                <input type="number" min="0" className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-black font-black" value={formData.equipos_frio_sin_visor} onChange={(e) => handleInputChange('equipos_frio_sin_visor', e.target.value)} />
                             </div>
                         </div>
                         <TextAreaField label="r).-Indicar observaciones para los ítems que NO CUMPLEN?" field="obs_bodega" {...commonProps} />
                         <FileUploadField label="p).-Suba las imágenes de los equipos o aspectos que requieren cambio o reparación. Sólo una foto por ítem." section="bodega" {...fileProps} />
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6">
                         <h3 className="text-lg font-black text-cyan-700 uppercase">Sección: Cocina</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <QuickOptionButtons label="a).-¿El tamaño del recinto de cocina permite una operación fluida, higiénica y fácil de controlar? *" field="tamano_cocina" {...commonProps} />
                             <QuickOptionButtons label="b).-¿Existe ventilación adecuada en la cocina para evitar el calor excesivo, la condensación de vapor de agua? *" field="ventilacion_cocina" {...commonProps} />
                             <QuickOptionButtons label="c).-Puertas, permiten mantener el recinto hermético de tal forma que no exista riesgo de ingreso de plagas? *" field="puertas_cocina" {...commonProps} />
                             <QuickOptionButtons label="d).-Las ventanas y otras aberturas se encuentran en buen estado de modo de reducir al mínimo la acumulación de suciedad y son herméticas? *" field="ventanas_cocina" {...commonProps} />
                             <QuickOptionButtons label="e).-¿Las ventanas que se abren cuentan con malla mosquitera en buen estado y son herméticas? *" field="malla_cocina" {...commonProps} />
                             <QuickOptionButtons label="f).-¿Los pisos de la cocina se encuentran en buen estado de conservación, son de material liso, resistente, fácil de drenar, impermeables al líquido y fácil de limpiar? *" field="pisos_cocina" {...commonProps} />
                             <QuickOptionButtons label="g).-¿Las paredes, tabiques, techos, puertas y zócalos de la cocina se encuentran en buen estado de conservación, son se superficie lisa, e impermeables y de fácil limpieza? *" field="paredes_cocina" {...commonProps} />
                             <QuickOptionButtons label="h).-¿Las uniones de Pared - Pared y de Pared - Piso permiten la fácil limpieza para evitar la acumulación de suciedad y polvo? *" field="uniones_cocina" {...commonProps} />
                             <QuickOptionButtons label="i).-¿Los drenajes están construidos y ubicados para fácil limpieza y no representan riesgos de contaminación cruzadas? *" field="drenajes" {...commonProps} />
                             <QuickOptionButtons label="j).-¿La inclinación de los pisos guían los líquidos a los desagües y éstos tienen pendiente adecuada para permitir la eliminación efectiva de toda las aguas residuales y eviten desbordamiento o estancamiento de aguas? *" field="inclinacion_pisos" {...commonProps} />
                             <QuickOptionButtons label="k).-¿Los cielos y estructuras elevadas de la cocina se encuentran en buen estado de conservación, de manera de reducir al mínimo la acumulación de suciedad y de condensación, así como el desprendimiento de partículas? *" field="cielos_cocina" {...commonProps} />
                             <QuickOptionButtons label="l).-Lava Fondos, cantidad requerida y en buen estado *" field="lava_fondos" {...commonProps} />
                             <QuickOptionButtons label="m).-¿Cuenta con lavamanos con agua fría en zona de manipulación y este se encuentra en buen estado? RSA Art. 31 *" field="lavamanos_manipulacion" {...commonProps} />
                             <QuickOptionButtons label="n).-Si hay lavamanos, ¿éste cuenta con dispensador de jabón y toalla de papel? *" field="dispensador_jabon_papel" {...commonProps} />
                             <QuickOptionButtons label="o).-Calefon *" field="calefon" {...commonProps} />
                             <QuickOptionButtons label="p).-Pre Wash (Media solo si aplica) *" field="pre_wash" {...commonProps} />
                             <QuickOptionButtons label="q).-¿El extractor de la campana se encuentra en buen estado y con adecuada potencia y velocidad de extracción, el sombrero se encuentra en buen estado? *" field="extractor_campana" {...commonProps} />
                             <QuickOptionButtons label="r).-Carros porta Bandejas (Enseñanza media cuando aplique) *" field="carros_bandejas" {...commonProps} />
                             <QuickOptionButtons label="s).-¿Los elementos de iluminación se encuentran en buen estado de funcionamiento (Ampolletas, tubos fluorescentes, halógeno entre otros)? *" field="iluminacion_estado_cocina" {...commonProps} />
                             <QuickOptionButtons label="t).-¿Los equipos de iluminación suspendidos sobre el material alimentario están protegidos para evitar la contaminación de alimentos en caso de rotura? *" field="iluminacion_protegida_cocina" {...commonProps} />
                             <QuickOptionButtons label="u).-¿La iluminación es adecuada para el proceso de manipulación? *" field="iluminacion_adecuada_cocina" {...commonProps} />
                             <QuickOptionButtons label="v).-Basureros con tapa *" field="basureros_tapa_cocina" {...commonProps} />
                             <QuickOptionButtons label="w).-Llaves y sifón en buen estado (Sin fuga de agua) *" field="llaves_sifon_cocina" {...commonProps} />
                             <QuickOptionButtons label="x).-Cañerías de agua en buen estado *" field="canerias_agua" {...commonProps} />
                             <QuickOptionButtons label="y).-Cañerías de Gas en buen estado *" field="canerias_gas" {...commonProps} />
                             <QuickOptionButtons label="z).-Conexiones eléctricas en buen estado y de fácil limpieza *" field="conexiones_electricas_cocina" {...commonProps} />
                             <QuickOptionButtons label="aa).- Los sistemas de trampas de residuos (por ejemplo, trampas de grasa) deberán contenerse para evitar la contaminación cruzada o se ubicarán lejos de cualquier zona de manipulación de alimentos... *" field="trampas_residuos" {...commonProps} />
                         </div>
                         <TextAreaField label="ac).-Indicar observaciones para los ítems que NO CUMPLEN?" field="obs_cocina" {...commonProps} />
                         <FileUploadField label="ab).-Suba las imágenes de los equipos o aspectos que requieren cambio o reparación. Sólo una foto por ítem." section="cocina" {...fileProps} />
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-6">
                         <h3 className="text-lg font-black text-cyan-700 uppercase">Sección: Baño y Vestidor</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <QuickOptionButtons label="a).-¿Existe Baño y vestidor exclusivo para el personal manipulador? *" field="bano_exclusivo" {...commonProps} />
                             <QuickOptionButtons label={`b).-¿Los vestuarios y/o servicios higiénicos del personal manipulador se encuentran sin conexión directa a la zona de preparación de alimentos? ${formData.bano_exclusivo === "No existe" ? "" : "*"}`} field="sin_conexion_directa" {...commonProps} />
                             <QuickOptionButtons label={`c).-Puertas, permiten mantener el recinto hermético de tal forma que no exista riesgo de ingreso de plagas?? ${formData.bano_exclusivo === "No existe" ? "" : "*"}`} field="puertas_bano" {...commonProps} />
                             <QuickOptionButtons label={`d).-Las ventanas que se abren cuentan con malla mosquitera en buen estado y son hermética? ${formData.bano_exclusivo === "No existe" ? "" : "*"}`} field="malla_bano" {...commonProps} />
                             <QuickOptionButtons label={`e).-Los pisos del baño se encuentran en buen estado de conservación, son de material liso, resistente, fácil de drenar, impermeables al líquido y fácil de limpiar? ${formData.bano_exclusivo === "No existe" ? "" : "*"}`} field="pisos_bano" {...commonProps} />
                             <QuickOptionButtons label={`f).-Las paredes, tabiques, techo, puertas y zócalos del baño se encuentran en buen estado de conservación, son se superficie lisa, e impermeables y de fácil limpieza? ${formData.bano_exclusivo === "No existe" ? "" : "*"}`} field="paredes_bano" {...commonProps} />
                             <QuickOptionButtons label={`g).-¿Lava Manos con agua caliente y fría? ${formData.bano_exclusivo === "No existe" ? "" : "*"}`} field="lavamanos_caliente_fria" {...commonProps} />
                             <QuickOptionButtons label={`h).-Ducha ${formData.bano_exclusivo === "No existe" ? "" : "*"}`} field="ducha" {...commonProps} />
                             <QuickOptionButtons label={`i).-Cortina ${formData.bano_exclusivo === "No existe" ? "" : "*"}`} field="cortina" {...commonProps} />
                             <QuickOptionButtons label={`j).-¿Dispensadores de Jabón? ${formData.bano_exclusivo === "No existe" ? "" : "*"}`} field="dispensadores_jabon_bano" {...commonProps} />
                             <QuickOptionButtons label={`k).-Estanque y Tapa WC en buen estado ${formData.bano_exclusivo === "No existe" ? "" : "*"}`} field="estanque_tapa_wc" {...commonProps} />
                             <QuickOptionButtons label={`l).-En caso de contar con espejo, está en buen estado (no es requisito) ${formData.bano_exclusivo === "No existe" ? "" : "*"}`} field="espejo" {...commonProps} />
                             <QuickOptionButtons label={`m).-Basurero con tapa ${formData.bano_exclusivo === "No existe" ? "" : "*"}`} field="basurero_tapa_bano" {...commonProps} />
                             <QuickOptionButtons label={`n).-Llaves y sifón en buen estado (Sin fuga de agua) ${formData.bano_exclusivo === "No existe" ? "" : "*"}`} field="llaves_sifon_bano" {...commonProps} />
                             <QuickOptionButtons label={`o).-¿Existe dispensador de papel higiénico y toalla de papel? ${formData.bano_exclusivo === "No existe" ? "" : "*"}`} field="dispensador_papel" {...commonProps} />
                             <QuickOptionButtons label={`p).-La iluminaria esta en buen estado? ${formData.bano_exclusivo === "No existe" ? "" : "*"}`} field="iluminaria_bano" {...commonProps} />
                         </div>
                         <TextAreaField label="r).-Indicar observaciones para los ítems que NO CUMPLEN" field="obs_bano" {...commonProps} />
                         <FileUploadField label="q).-Suba las imágenes de los equipos o aspectos que requieren cambio o reparación. Sólo una foto por ítem." section="bano" {...fileProps} />
                    </div>
                )}

                {step === 5 && (
                    <div className="space-y-6">
                         <h3 className="text-lg font-black text-slate-800 uppercase">Finalizar</h3>
                         <TextAreaField label="a).-Observaciones Generales" field="obs_generales" {...commonProps} />
                         <FileUploadField label="b).-Si existen desviaciones asociadas al sostenedor, cargar la carta al sostenedor, como evidencia" section="sostenedor" {...fileProps} />
                    </div>
                )}

                <div className="flex justify-between mt-12 pt-8 border-t border-gray-100">
                    <button 
                        onClick={() => setStep(prev => Math.max(1, prev - 1))}
                        disabled={step === 1 || loading}
                        className="px-6 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold disabled:opacity-30"
                    >
                        Anterior
                    </button>

                    {step < 5 ? (
                        <button 
                            onClick={handleNext}
                            className="px-8 py-3 bg-cyan-600 text-white rounded-2xl font-bold shadow-lg"
                        >
                            Siguiente
                        </button>
                    ) : (
                        <button 
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold shadow-lg disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : 'Finalizar y Guardar'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
