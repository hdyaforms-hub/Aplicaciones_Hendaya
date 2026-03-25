'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FormField, getSystemSourceData, saveFormSubmission, uploadFile, sendSubmissionEmail, getSubmissionTemplate } from '../actions'
import { validateChileanRut } from '@/lib/validation'
import { generateFormPDF } from '../pdf-util'

export default function FillFormClient({ form }: { form: any }) {
    const router = useRouter()
    const [formData, setFormData] = useState<Record<string, any>>({})
    const [systemData, setSystemData] = useState<Record<string, string[]>>({})
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })
    
    // Post-Save Modal State
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [lastSubmissionId, setLastSubmissionId] = useState('')
    const [emailModal, setEmailModal] = useState({ isOpen: false, to: '', subject: '', body: '' })
    const [isSendingEmail, setIsSendingEmail] = useState(false)

    // Signature Refs and State
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)

    useEffect(() => {
        const fetchSystemData = async () => {
            const sourcesInForm = form.fields
                .filter((f: any) => f.systemSource)
                .map((f: any) => f.systemSource)

            const newData: Record<string, string[]> = {}
            if (sourcesInForm.includes('SUCURSAL')) {
                newData['SUCURSAL'] = await getSystemSourceData('SUCURSAL')
            }
            if (sourcesInForm.includes('UT') && !sourcesInForm.includes('SUCURSAL')) {
                newData['UT'] = await getSystemSourceData('UT')
            }
            if (sourcesInForm.includes('RBD') && !sourcesInForm.includes('UT') && !sourcesInForm.includes('SUCURSAL')) {
                newData['RBD'] = await getSystemSourceData('RBD')
            }
            setSystemData(prev => ({ ...prev, ...newData }))
        }
        fetchSystemData()
    }, [form.fields])

    const handleSystemSourceCascade = async (source: string, value: any) => {
        const sucursalField = form.fields.find((f: any) => f.systemSource === 'SUCURSAL')
        const utField = form.fields.find((f: any) => f.systemSource === 'UT')
        const rbdField = form.fields.find((f: any) => f.systemSource === 'RBD')

        if (source === 'SUCURSAL') {
            setFormData(prev => {
                const updated = { ...prev }
                if (utField) updated[utField.id] = ''
                if (rbdField) updated[rbdField.id] = ''
                return updated
            })
            setSystemData(prev => ({ ...prev, UT: [], RBD: [] }))
            if (utField) {
                const filteredUts = await getSystemSourceData('UT', { sucursal: value })
                setSystemData(prev => ({ ...prev, UT: filteredUts }))
            } else if (rbdField) {
                const filteredRbds = await getSystemSourceData('RBD', { sucursal: value })
                setSystemData(prev => ({ ...prev, RBD: filteredRbds }))
            }
        } 
        else if (source === 'UT') {
            if (rbdField) {
                setFormData(prev => ({ ...prev, [rbdField.id]: '' }))
                setSystemData(prev => ({ ...prev, RBD: [] }))
                setFormData(currentForm => {
                    const currentSucursal = sucursalField ? currentForm[sucursalField.id] : undefined
                    getSystemSourceData('RBD', { ut: value, sucursal: currentSucursal }).then(filteredRbds => {
                        setSystemData(prev => ({ ...prev, RBD: filteredRbds }))
                    })
                    return currentForm
                })
            }
        }
    }

    const handleInputChange = (fieldId: string, value: any, validationType?: string) => {
        let finalValue = value

        // RUT Formatting & Validation logic
        if (validationType === 'rut' && typeof value === 'string') {
            // Clean input (keep numbers and K)
            let clean = value.replace(/[^0-9kK]/g, '').toUpperCase()
            if (clean.length > 9) clean = clean.slice(0, 9)
            
            // Apply formatting: XX.XXX.XXX-X
            if (clean.length > 1) {
                const body = clean.slice(0, -1)
                const dv = clean.slice(-1)
                const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
                finalValue = `${formattedBody}-${dv}`
            } else {
                finalValue = clean
            }
        }

        setFormData(prev => ({ ...prev, [fieldId]: finalValue }))
        
        const field = form.fields.find((f: any) => f.id === fieldId)
        if (field?.systemSource) {
            handleSystemSourceCascade(field.systemSource, finalValue)
        }

        // Error Validation
        if (validationType === 'rut' && finalValue) {
            if (!validateChileanRut(finalValue)) setErrors(prev => ({ ...prev, [fieldId]: 'Formato de RUT inválido' }))
            else setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n })
        } else if (validationType === 'email' && finalValue) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalValue)) setErrors(prev => ({ ...prev, [fieldId]: 'Correo electrónico inválido' }))
            else setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n })
        } else {
            setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n })
        }
    }

    const handleFileUpload = async (fieldId: string, file: File, maxMB: number) => {
        if (file.size > maxMB * 1024 * 1024) { alert(`El archivo excede el límite de ${maxMB}MB`); return }
        const fd = new FormData(); fd.append('file', file)
        const res = await uploadFile(fd)
        if (res.success) handleInputChange(fieldId, { url: res.url, name: res.filename })
        else alert(res.error)
    }

    const startDrawing = (e: any) => { setIsDrawing(true); draw(e) }
    const stopDrawing = () => { setIsDrawing(false); canvasRef.current?.getContext('2d')?.beginPath() }
    const draw = (e: any) => {
        if (!isDrawing) return
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) return
        const rect = canvas.getBoundingClientRect()
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top
        ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'
        ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y)
    }
    const clearSignature = () => {
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d')
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
        handleInputChange('signature', '')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        for (const field of form.fields) {
            if (field.required && !formData[field.id] && field.type !== 'signature' && field.type !== 'section') {
                setMessage({ type: 'error', text: `El campo "${field.label}" es obligatorio.` }); return
            }
            if (errors[field.id]) {
                setMessage({ type: 'error', text: `El campo "${field.label}" tiene errores.` }); return
            }
        }

        const canvas = canvasRef.current
        let signatureData = canvas ? canvas.toDataURL() : ''
        const signatureField = form.fields.find((f: any) => f.type === 'signature')
        
        const finalData = { ...formData }
        if (signatureField && signatureData) {
            finalData[signatureField.id] = signatureData
        }

        setIsSubmitting(true)
        const res = await saveFormSubmission(form.id, { ...finalData, signature: signatureData }) as any
        if (res.success) {
            setLastSubmissionId(res.id)
            setShowSuccessModal(true)
            setIsSubmitting(false)
        } else {
            setMessage({ type: 'error', text: res.error || 'Error al enviar' })
            setIsSubmitting(false)
        }
    }

    const handleDownloadPDF = () => {
        const canvas = canvasRef.current
        const sig = canvas ? canvas.toDataURL() : ''
        const signatureField = form.fields.find((f: any) => f.type === 'signature')
        const finalData = { ...formData }
        if (signatureField && sig) {
            finalData[signatureField.id] = sig
        }
        
        const doc = generateFormPDF(form, finalData)
        doc.save(`${form.title.replace(/\s+/g, '_')}_Resumen.pdf`)
    }

    const openEmailModal = async () => {
        const template = await getSubmissionTemplate()
        // Reemplazar tags básicos
        const subject = template.asunto.replace('<Formulario>', form.title)
        const body = template.cuerpo.replace('<Formulario>', form.title)
        
        setEmailModal({ isOpen: true, to: '', subject, body })
    }

    const handleSendEmail = async () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailModal.to || !emailRegex.test(emailModal.to)) { 
            alert('Por favor, ingrese un correo electrónico válido.')
            return 
        }
        setIsSendingEmail(true)
        
        const canvas = canvasRef.current
        const sig = canvas ? canvas.toDataURL() : ''
        const signatureField = form.fields.find((f: any) => f.type === 'signature')
        const finalData = { ...formData }
        if (signatureField && sig) {
            finalData[signatureField.id] = sig
        }

        const doc = generateFormPDF(form, finalData)
        const pdfBase64 = doc.output('datauristring')

        const res = await sendSubmissionEmail(lastSubmissionId, pdfBase64, emailModal.to, emailModal.subject, emailModal.body) as any
        if (res.success) {
            alert('Correo enviado correctamente.')
            setEmailModal({ ...emailModal, isOpen: false })
        } else {
            alert(res.error || 'Error al enviar correo.')
        }
        setIsSendingEmail(false)
    }

    return (
        <div className="max-w-3xl mx-auto pb-20">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-8">
                <div className="bg-slate-900 p-8">
                    <div className="flex justify-between items-center mb-4">
                        <button type="button" onClick={() => router.back()} className="text-slate-400 hover:text-white transition-colors text-sm font-bold flex items-center gap-2">← Volver</button>
                        <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-cyan-500/30">Formulario</span>
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tight uppercase">{form.title}</h2>
                    <p className="text-slate-400 mt-2 font-medium italic">{form.description}</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-12">
                    {form.fields.map((field: FormField) => (
                        <div key={field.id} className={`${field.type === 'section' ? 'pt-8 border-t border-gray-100' : 'space-y-4'}`}>
                            {field.type === 'section' ? (
                                <div><h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">{field.label}</h3><hr className="mt-2 border-cyan-500 border-2 w-16" /></div>
                            ) : (
                                <label className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">{field.label} {field.required && <span className="text-rose-500">*</span>}</label>
                            )}

                            {field.type === 'text' && (
                                <input 
                                    type="text" 
                                    value={formData[field.id] || ''}
                                    onChange={(e) => handleInputChange(field.id, e.target.value, field.validationType)} 
                                    className={`w-full px-5 py-4 rounded-xl border ${errors[field.id] ? 'border-rose-500 bg-rose-50' : 'border-gray-200 bg-white'} text-black font-black transition-all`} 
                                />
                            )}
                            {field.type === 'textarea' && (
                                <textarea 
                                    value={formData[field.id] || ''}
                                    onChange={(e) => handleInputChange(field.id, e.target.value)} 
                                    className={`w-full px-5 py-4 rounded-xl border ${errors[field.id] ? 'border-rose-500 bg-rose-50' : 'border-gray-200 bg-white'} h-32 text-black font-black transition-all`} 
                                />
                            )}
                            {field.type === 'date' && (
                                <input 
                                    type="date" 
                                    value={formData[field.id] || ''}
                                    onChange={(e) => handleInputChange(field.id, e.target.value)} 
                                    className="w-full px-5 py-4 rounded-xl border border-gray-200 text-black font-black" 
                                />
                            )}
                            {field.type === 'time' && (
                                <input 
                                    type="time" 
                                    value={formData[field.id] || ''}
                                    onChange={(e) => handleInputChange(field.id, e.target.value)} 
                                    className="w-full px-5 py-4 rounded-xl border border-gray-200 text-black font-black" 
                                />
                            )}
                            {errors[field.id] && <p className="text-rose-600 text-xs font-black uppercase tracking-tighter mt-1 animate-pulse">⚠️ {errors[field.id]}</p>}
                            {(field.type === 'select' || field.type === 'multiselect') && (
                                <select 
                                    multiple={field.type === 'multiselect'} 
                                    onChange={(e) => {
                                        if (field.type === 'multiselect') {
                                            const vals = Array.from(e.target.selectedOptions, o => o.value)
                                            handleInputChange(field.id, vals)
                                        } else handleInputChange(field.id, e.target.value)
                                    }}
                                    className="w-full px-5 py-4 rounded-xl border border-gray-200 text-black font-black"
                                >
                                    <option value="">Seleccione...</option>
                                    {(field.systemSource ? (systemData[field.systemSource] || []) : (field.options || [])).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            )}
                            {(field.type === 'radio' || field.type === 'checkbox') && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                    {(field.systemSource ? systemData[field.systemSource] || [] : field.options || []).map(opt => (
                                        <label key={opt} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                                            (field.type === 'radio' ? formData[field.id] === opt : (formData[field.id] || []).includes(opt)) ? 'bg-cyan-50 border-cyan-200 ring-2 ring-cyan-500/10' : 'bg-white border-gray-100'
                                        }`}>
                                            <input 
                                                type={field.type} 
                                                name={field.id} 
                                                value={opt} 
                                                onChange={(e) => {
                                                    if (field.type === 'radio') handleInputChange(field.id, opt)
                                                    else {
                                                        const cur = formData[field.id] || []
                                                        if (e.target.checked) handleInputChange(field.id, [...cur, opt])
                                                        else handleInputChange(field.id, cur.filter((v: any) => v !== opt))
                                                    }
                                                }}
                                                className="w-5 h-5 text-cyan-600"
                                            />
                                            <span className="font-black text-black">{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                            {field.type === 'file' && (
                                <input type="file" onChange={(e) => e.target.files?.[0] && handleFileUpload(field.id, e.target.files[0], field.maxFileSize || 100)} />
                            )}
                            {field.type === 'signature' && (
                                <div className="space-y-3">
                                    <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 relative overflow-hidden h-48">
                                        <canvas ref={canvasRef} width={600} height={192} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className="w-full h-full touch-none" />
                                        <button type="button" onClick={clearSignature} className="absolute top-4 right-4 px-3 py-1 bg-gray-100 text-[10px] font-black uppercase rounded-lg">Limpiar</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    <div className="pt-8 border-t border-gray-100">
                        {message.text && (
                            <div className={`mb-6 p-4 rounded-xl text-center font-bold text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {message.text}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? 'Procesando...' : 'GUARDAR Y ENVIAR 🚀'}
                        </button>
                    </div>
                </form>
            </div>

            {/* MODAL DE ÉXITO Y OPCIONES */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden transform animate-in zoom-in duration-300">
                        <div className="p-10 text-center space-y-6">
                            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-5xl mx-auto shadow-inner">✓</div>
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase">¡Registro Guardado!</h3>
                                <p className="text-slate-500 font-medium mt-2">¿Qué deseas hacer a continuación?</p>
                            </div>
                            <div className="space-y-3 pt-4">
                                <button
                                    onClick={handleDownloadPDF}
                                    className="w-full py-5 bg-cyan-50 text-cyan-700 rounded-2xl font-black uppercase tracking-widest hover:bg-cyan-100 transition-all flex items-center justify-center gap-3"
                                >
                                    <span className="text-2xl">📄</span> Descargar Archivo PDF
                                </button>
                                <button
                                    onClick={openEmailModal}
                                    className="w-full py-5 bg-indigo-50 text-indigo-700 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-3"
                                >
                                    <span className="text-2xl">📧</span> Enviar por Correo
                                </button>
                                <button
                                    onClick={() => router.push('/dashboard/formularios/abrir')}
                                    className="w-full py-5 text-slate-400 font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
                                >
                                    Finalizar y Salir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE ENVÍO POR CORREO */}
            {emailModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-indigo-600 p-6 text-white">
                            <h4 className="text-xl font-black uppercase tracking-tight">Enviar Documento</h4>
                            <p className="text-indigo-100 text-xs mt-1">El PDF se adjuntará automáticamente.</p>
                        </div>
                        <div className="p-8 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Para</label>
                                <input 
                                    type="email" 
                                    placeholder="correo@ejemplo.com"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 font-black text-black"
                                    value={emailModal.to}
                                    onChange={(e) => setEmailModal({...emailModal, to: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Asunto</label>
                                <input 
                                    type="text" 
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 font-black text-black"
                                    value={emailModal.subject}
                                    onChange={(e) => setEmailModal({...emailModal, subject: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Mensaje</label>
                                <textarea 
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 font-black text-black h-24 resize-none"
                                    value={emailModal.body}
                                    onChange={(e) => setEmailModal({...emailModal, body: e.target.value})}
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button onClick={() => setEmailModal({...emailModal, isOpen: false})} className="flex-1 py-4 text-slate-500 font-bold uppercase tracking-widest text-xs">Cancelar</button>
                                <button 
                                    onClick={handleSendEmail}
                                    disabled={isSendingEmail}
                                    className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-200 disabled:opacity-50"
                                >
                                    {isSendingEmail ? 'Enviando...' : 'Enviar Correo 🚀'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
