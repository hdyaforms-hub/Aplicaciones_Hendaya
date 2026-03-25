'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FormField, getSystemSourceData, saveFormSubmission, uploadFile, validateChileanRut } from '../actions'

export default function FillFormClient({ form }: { form: any }) {
    const router = useRouter()
    const [formData, setFormData] = useState<Record<string, any>>({})
    const [systemData, setSystemData] = useState<Record<string, string[]>>({})
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })
    
    // Signature Refs and State
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)

    useEffect(() => {
        const fetchSystemData = async () => {
            const sourcesNeeded = new Set<string>()
            form.fields.forEach((f: FormField) => {
                if (f.systemSource) sourcesNeeded.add(f.systemSource)
            })

            const newData: Record<string, string[]> = {}
            for (const source of Array.from(sourcesNeeded)) {
                const data = await getSystemSourceData(source as any)
                newData[source] = data
            }
            setSystemData(newData)
        }

        fetchSystemData()
    }, [form.fields])

    const handleInputChange = (fieldId: string, value: any, validationType?: string) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }))
        
        // Real-time validation
        if (validationType === 'rut' && value) {
            if (!validateChileanRut(value)) {
                setErrors(prev => ({ ...prev, [fieldId]: 'RUT inválido' }))
            } else {
                setErrors(prev => {
                    const newErrs = { ...prev }
                    delete newErrs[fieldId]
                    return newErrs
                })
            }
        } else if (validationType === 'email' && value) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                setErrors(prev => ({ ...prev, [fieldId]: 'Correo inválido' }))
            } else {
                setErrors(prev => {
                    const newErrs = { ...prev }
                    delete newErrs[fieldId]
                    return newErrs
                })
            }
        } else {
            setErrors(prev => {
                const newErrs = { ...prev }
                delete newErrs[fieldId]
                return newErrs
            })
        }
    }

    const handleFileUpload = async (fieldId: string, file: File, maxMB: number) => {
        if (file.size > maxMB * 1024 * 1024) {
            alert(`El archivo excede el límite de ${maxMB}MB`)
            return
        }

        const formData = new FormData()
        formData.append('file', file)

        const res = await uploadFile(formData)
        if (res.success) {
            handleInputChange(fieldId, { url: res.url, name: res.filename })
        } else {
            alert(res.error)
        }
    }

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true)
        draw(e)
    }

    const stopDrawing = () => {
        setIsDrawing(false)
        const canvas = canvasRef.current
        if (canvas) {
            const ctx = canvas.getContext('2d')
            ctx?.beginPath()
        }
    }

    const draw = (e: any) => {
        if (!isDrawing) return
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) return

        const rect = canvas.getBoundingClientRect()
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top

        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.strokeStyle = '#000'

        ctx.lineTo(x, y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x, y)
    }

    const clearSignature = () => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        handleInputChange('signature', '')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        // Validate required fields
        for (const field of form.fields) {
            if (field.required && !formData[field.id] && field.type !== 'signature' && field.type !== 'section') {
                setMessage({ type: 'error', text: `El campo "${field.label}" es obligatorio.` })
                return
            }
            if (errors[field.id]) {
                setMessage({ type: 'error', text: `El campo "${field.label}" tiene errores: ${errors[field.id]}` })
                return
            }
        }

        const canvas = canvasRef.current
        let signatureData = ''
        if (canvas) {
            signatureData = canvas.toDataURL()
        }

        setIsSubmitting(true)
        setMessage({ type: '', text: '' })

        const res = await saveFormSubmission(form.id, { ...formData, signature: signatureData })
        if (res.success) {
            setMessage({ type: 'success', text: 'Formulario enviado correctamente. Redirigiendo...' })
            setTimeout(() => router.push('/dashboard/formularios/abrir'), 2000)
        } else {
            setMessage({ type: 'error', text: res.error || 'Error al enviar' })
            setIsSubmitting(false)
        }
    }

    return (
        <div className="max-w-3xl mx-auto pb-20">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-8">
                <div className="bg-slate-900 p-8">
                    <div className="flex justify-between items-center mb-4">
                        <button 
                            type="button"
                            onClick={() => router.back()}
                            className="text-slate-400 hover:text-white transition-colors text-sm font-bold flex items-center gap-2"
                        >
                            ← Volver al listado
                        </button>
                        <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-cyan-500/30">Formulario Dinámico</span>
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tight uppercase">{form.title}</h2>
                    <p className="text-slate-400 mt-2 font-medium italic">{form.description || 'Complete todos los campos requeridos.'}</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-12">
                    {form.fields.map((field: FormField) => (
                        <div key={field.id} className={`${field.type === 'section' ? 'pt-8 border-t border-gray-100' : 'space-y-4'}`}>
                            {field.type === 'section' ? (
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">{field.label}</h3>
                                    <hr className="mt-2 border-cyan-500 border-2 w-16" />
                                </div>
                            ) : (
                                <label className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                                    {field.label} {field.required && <span className="text-rose-500">*</span>}
                                </label>
                            )}

                            {field.type === 'text' && (
                                <div className="space-y-1">
                                    <input
                                        type="text"
                                        placeholder={field.validationType === 'rut' ? '12.345.678-9' : ''}
                                        onChange={(e) => handleInputChange(field.id, e.target.value, field.validationType)}
                                        className={`w-full px-5 py-4 rounded-xl border ${errors[field.id] ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-gray-50'} focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all font-bold text-gray-800`}
                                    />
                                    {errors[field.id] && <p className="text-[10px] font-black text-red-500 uppercase italic">{errors[field.id]}</p>}
                                </div>
                            )}

                            {field.type === 'textarea' && (
                                <textarea
                                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                                    className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 bg-gray-50 transition-all font-medium text-gray-700 h-32 resize-none"
                                />
                            )}

                            {field.type === 'date' && (
                                <input
                                    type="date"
                                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                                    className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 bg-gray-50 transition-all font-bold text-gray-800"
                                />
                            )}

                            {field.type === 'time' && (
                                <input
                                    type="time"
                                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                                    className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 bg-gray-50 transition-all font-bold text-gray-800"
                                />
                            )}

                            {(field.type === 'select' || field.type === 'multiselect') && (
                                <select
                                    multiple={field.type === 'multiselect'}
                                    onChange={(e) => {
                                        if (field.type === 'multiselect') {
                                            const options = e.target.options
                                            const values = []
                                            for (let i = 0; i < options.length; i++) {
                                                if (options[i].selected) values.push(options[i].value)
                                            }
                                            handleInputChange(field.id, values)
                                        } else {
                                            handleInputChange(field.id, e.target.value)
                                        }
                                    }}
                                    className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 bg-gray-50 transition-all font-bold text-gray-800"
                                >
                                    <option value="">Seleccione una opción...</option>
                                    {field.systemSource ? (
                                        (systemData[field.systemSource] || []).map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))
                                    ) : (
                                        (field.options || []).map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))
                                    )}
                                </select>
                            )}

                            {(field.type === 'radio' || field.type === 'checkbox') && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                    {(field.systemSource ? systemData[field.systemSource] || [] : field.options || []).map(opt => (
                                        <label key={opt} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                                            (field.type === 'radio' ? formData[field.id] === opt : (formData[field.id] || []).includes(opt))
                                            ? 'bg-cyan-50 border-cyan-200 ring-2 ring-cyan-500/10'
                                            : 'bg-white border-gray-100'
                                        }`}>
                                            <input
                                                type={field.type}
                                                name={field.id}
                                                value={opt}
                                                onChange={(e) => {
                                                    if (field.type === 'radio') {
                                                        handleInputChange(field.id, e.target.value)
                                                    } else {
                                                        const current = formData[field.id] || []
                                                        if (e.target.checked) handleInputChange(field.id, [...current, opt])
                                                        else handleInputChange(field.id, current.filter((v: any) => v !== opt))
                                                    }
                                                }}
                                                className={`w-5 h-5 text-cyan-600 ${field.type === 'checkbox' ? 'rounded' : ''} focus:ring-cyan-500`}
                                            />
                                            <span className="font-bold text-gray-700">{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {field.type === 'linear-scale' && (
                                <div className="flex items-center justify-between gap-2 p-6 bg-gray-50 rounded-2xl border border-gray-200 overflow-x-auto">
                                    {Array.from({ length: field.scaleMax || 5 }, (_, i) => i + 1).map(val => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => handleInputChange(field.id, val)}
                                            className={`w-12 h-12 rounded-full font-black transition-all flex items-center justify-center shrink-0 ${
                                                formData[field.id] === val ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-200 scale-110' : 'bg-white text-gray-400 border border-gray-200 hover:border-cyan-300 hover:text-cyan-600'
                                            }`}
                                        >
                                            {val}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {field.type === 'rating' && (
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => handleInputChange(field.id, star)}
                                            className={`text-4xl transition-all ${star <= (formData[field.id] || 0) ? 'text-amber-400 scale-110' : 'text-gray-200 hover:text-amber-200'}`}
                                        >
                                            ★
                                        </button>
                                    ))}
                                </div>
                            )}

                            {['grid-multiple', 'grid-checkbox'].includes(field.type) && (
                                <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
                                    <table className="w-full text-left border-collapse bg-white">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="p-4 border-b border-gray-100"></th>
                                                {(field.gridCols || []).map(col => (
                                                    <th key={col} className="p-4 border-b border-gray-100 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">{col}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(field.gridRows || []).map(row => (
                                                <tr key={row} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="p-4 border-b border-gray-50 font-bold text-gray-700 text-xs">{row}</td>
                                                    {(field.gridCols || []).map(col => (
                                                        <td key={col} className="p-4 border-b border-gray-50 text-center">
                                                            <input
                                                                type={field.type === 'grid-multiple' ? 'radio' : 'checkbox'}
                                                                name={`${field.id}-${row}`}
                                                                checked={field.type === 'grid-multiple' 
                                                                    ? formData[field.id]?.[row] === col
                                                                    : (formData[field.id]?.[row] || []).includes(col)
                                                                }
                                                                onChange={(e) => {
                                                                    const currentAll = formData[field.id] || {}
                                                                    if (field.type === 'grid-multiple') {
                                                                        handleInputChange(field.id, { ...currentAll, [row]: col })
                                                                    } else {
                                                                        const rowVals = currentAll[row] || []
                                                                        const newRowVals = e.target.checked ? [...rowVals, col] : rowVals.filter((v: string) => v !== col)
                                                                        handleInputChange(field.id, { ...currentAll, [row]: newRowVals })
                                                                    }
                                                                }}
                                                                className="w-5 h-5 text-cyan-600 rounded focus:ring-cyan-500"
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {field.type === 'file' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-center w-full">
                                        <label className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${
                                            formData[field.id] ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                                        }`}>
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                {formData[field.id] ? (
                                                    <div className="text-center">
                                                        <span className="text-4xl mb-2 block">📄</span>
                                                        <p className="text-sm font-bold text-green-700">{formData[field.id].name}</p>
                                                        <p className="text-[10px] text-green-600 font-bold uppercase italic mt-1">Archivo Cargado con Éxito</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="text-4xl mb-2 opacity-50">📁</span>
                                                        <p className="mb-2 text-sm text-gray-500 font-bold">Haz clic para subir o arrastra un archivo</p>
                                                        <p className="text-xs text-gray-400 font-medium italic">Máximo {field.maxFileSize || 100}MB • {field.allowedFileTypes?.join(', ') || 'Cualquier tipo'}</p>
                                                    </>
                                                )}
                                            </div>
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                accept={field.allowedFileTypes?.join(',')}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) handleFileUpload(field.id, file, field.maxFileSize || 100)
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}

                            {field.type === 'signature' && (
                                <div className="space-y-3">
                                    <div className="bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 relative overflow-hidden h-48 group">
                                        <canvas
                                            ref={canvasRef}
                                            width={600}
                                            height={192}
                                            onMouseDown={startDrawing}
                                            onMouseMove={draw}
                                            onMouseUp={stopDrawing}
                                            onMouseOut={stopDrawing}
                                            onTouchStart={startDrawing}
                                            onTouchMove={draw}
                                            onTouchEnd={stopDrawing}
                                            className="w-full h-full touch-none cursor-crosshair bg-white"
                                        />
                                        <button
                                            type="button"
                                            onClick={clearSignature}
                                            className="absolute top-4 right-4 px-3 py-1 bg-white/80 backdrop-blur-sm border border-gray-200 text-[10px] font-black text-gray-500 uppercase rounded-lg hover:bg-rose-50 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            Limpiar Firma 🧹
                                        </button>
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 text-6xl font-black italic">FIRMAR AQUI</div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-bold italic text-center">Dibuje su firma en el recuadro superior</p>
                                </div>
                            )}
                        </div>
                    ))}

                    <div className="pt-8 border-t border-gray-100">
                        {message.text && (
                            <div className={`mb-6 p-4 rounded-xl text-center font-bold text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                {message.type === 'success' ? '✅' : '❌'} {message.text}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full py-5 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-3 ${
                                Object.keys(errors).length > 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-black'
                            }`}
                        >
                            {isSubmitting ? 'Procesando...' : 'GUARDAR Y ENVIAR 🚀'}
                        </button>
                    </div>
                </form>
            </div>
            
            <div className="text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-8">
                Registrado por: {form.createdBy} • Hendaya Forms Hub
            </div>

            <style jsx>{`
                input[type="radio"]:checked, input[type="checkbox"]:checked {
                    background-color: #0891b2; /* cyan-600 */
                }
            `}</style>
        </div>
    )
}
