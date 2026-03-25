'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FormField, saveFormDefinition } from '../actions'

interface Props {
    initialForm?: any
    isEditable?: boolean
    submissionCount?: number
}

export default function CrearFormularioClient({ initialForm, isEditable = true, submissionCount = 0 }: Props) {
    const router = useRouter()
    const [title, setTitle] = useState(initialForm?.title || '')
    const [description, setDescription] = useState(initialForm?.description || '')
    const [fields, setFields] = useState<FormField[]>(initialForm?.fields || [])
    const [isActive, setIsActive] = useState(initialForm ? initialForm.isActive : true)
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })

    const addField = () => {
        if (!isEditable) return
        const newField: FormField = {
            id: crypto.randomUUID(),
            type: 'text',
            label: 'Nuevo Campo',
            required: false
        }
        setFields([...fields, newField])
    }

    const removeField = (id: string) => {
        if (!isEditable) return
        setFields(fields.filter(f => f.id !== id))
    }

    const updateField = (id: string, updates: Partial<FormField>) => {
        if (!isEditable) return
        setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f))
    }

    const moveField = (index: number, direction: 'up' | 'down') => {
        if (!isEditable) return
        const newFields = [...fields]
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= newFields.length) return
        [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]]
        setFields(newFields)
    }

    const handleSave = async () => {
        if (!title.trim()) {
            setMessage({ type: 'error', text: 'El título es obligatorio' })
            return
        }
        if (fields.length === 0) {
            setMessage({ type: 'error', text: 'Debes añadir al menos un campo' })
            return
        }

        setIsSaving(true)
        setMessage({ type: '', text: '' })

        const res = await saveFormDefinition(initialForm?.id || null, title, description, fields, isActive)
        if (res.success) {
            setMessage({ type: 'success', text: 'Formulario guardado con éxito. Redirigiendo...' })
            setTimeout(() => router.push('/dashboard/formularios/abrir'), 1500)
        } else {
            setMessage({ type: 'error', text: res.error || 'Error al guardar' })
            setIsSaving(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-8">
                <div className="bg-slate-900 p-8">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                                <span className="text-4xl">{initialForm ? '✏️' : '🏗️'}</span> {initialForm ? 'Editar Formulario' : 'Constructor de Formularios'}
                            </h2>
                            <p className="text-slate-400 mt-2 font-medium italic">Diseña herramientas personalizadas para tu equipo</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <span className={`text-xs font-black uppercase tracking-widest ${isActive ? 'text-green-400' : 'text-red-400'}`}>
                                    {isActive ? 'Estado: ACTIVO' : 'Estado: INACTIVO'}
                                </span>
                                <div 
                                    onClick={() => setIsActive(!isActive)}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isActive ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                            </label>
                            {submissionCount > 0 && (
                                <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                                    {submissionCount} RESPUESTAS ASOCIADAS - EDICIÓN LIMITADA
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    {!isEditable && (
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 text-amber-800 text-sm font-bold">
                            <span>⚠️</span> El formulario no puede ser editado (cambiar campos) porque ya tiene respuestas registradas. Sólo puedes cambiar título, descripción y estado.
                        </div>
                    )}
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Título del Formulario</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ej: Reporte de Incidencias, Control de Calidad..."
                                className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 bg-gray-50 transition-all font-bold text-gray-800"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Descripción (Opcional)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Explica brevemente para qué sirve este formulario..."
                                className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 bg-gray-50 transition-all font-medium text-gray-700 h-24 resize-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Campos del Formulario</h3>
                    {isEditable && (
                        <button
                            onClick={addField}
                            className="px-6 py-2.5 bg-cyan-600 text-white rounded-xl font-bold shadow-lg hover:bg-cyan-700 transition-all flex items-center gap-2 text-sm"
                        >
                            <span>➕</span> Añadir Campo
                        </button>
                    )}
                </div>

                {fields.length === 0 ? (
                    <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
                        <span className="text-6xl mb-4 block opacity-20">📝</span>
                        <p className="text-gray-400 font-bold uppercase tracking-widest">Aún no has añadido campos a este formulario</p>
                        {isEditable && <button onClick={addField} className="mt-4 text-cyan-600 font-black text-sm hover:underline italic">Haz clic aquí para empezar</button>}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {fields.map((field, idx) => (
                            <div key={field.id} className={`bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:border-cyan-200 transition-all group ${!isEditable ? 'opacity-70 pointer-events-none grayscale-[0.5]' : ''}`}>
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1 space-y-4">
                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Etiqueta del Campo / Pregunta</label>
                                                <input
                                                    type="text"
                                                    value={field.label}
                                                    onChange={(e) => updateField(field.id, { label: e.target.value })}
                                                    className="w-full px-4 py-2 text-sm rounded-lg border border-gray-200 focus:border-cyan-500 focus:outline-none font-bold text-gray-900"
                                                />
                                            </div>
                                            <div className="w-1/3">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Tipo de campo</label>
                                                <select
                                                    value={field.type}
                                                    onChange={(e) => updateField(field.id, { type: e.target.value as any, options: undefined, systemSource: undefined, validationType: undefined })}
                                                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-cyan-500 focus:outline-none bg-gray-50 font-bold text-gray-900"
                                                >
                                                    <optgroup label="Básico">
                                                        <option value="text">Texto Corto</option>
                                                        <option value="textarea">Texto Largo</option>
                                                        <option value="date">Fecha</option>
                                                        <option value="time">Hora</option>
                                                    </optgroup>
                                                    <optgroup label="Selección">
                                                        <option value="select">Selección Única (Dropdown)</option>
                                                        <option value="multiselect">Selección Múltiple</option>
                                                        <option value="radio">Radio Button</option>
                                                        <option value="checkbox">Casilla de Verificación</option>
                                                    </optgroup>
                                                    <optgroup label="Avanzado">
                                                        <option value="section">Sección / Título Separador</option>
                                                        <option value="linear-scale">Escala Lineal</option>
                                                        <option value="rating">Calificaciones (Estrellas)</option>
                                                        <option value="grid-multiple">Cuadrícula de Opciones Múltiple</option>
                                                        <option value="grid-checkbox">Cuadrícula de Casilla</option>
                                                        <option value="signature">Firma Digital</option>
                                                        <option value="file">Cargar Archivo</option>
                                                    </optgroup>
                                                </select>
                                            </div>
                                        </div>

                                        {/* VALIDATION TYPE (only for text/textarea) */}
                                        {['text', 'textarea'].includes(field.type) && (
                                            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Validación de Datos</label>
                                                <select
                                                    value={field.validationType || 'text'}
                                                    onChange={(e) => updateField(field.id, { validationType: e.target.value as any })}
                                                    className="px-3 py-1 text-xs rounded-md border border-gray-200 focus:outline-none bg-white text-gray-900 font-bold"
                                                >
                                                    <option value="text">Ninguna (Texto libre)</option>
                                                    <option value="number">Número</option>
                                                    <option value="email">Correo Electrónico</option>
                                                    <option value="rut">RUT (Formato Chileno)</option>
                                                </select>
                                            </div>
                                        )}

                                        {/* SYSTEM SOURCE & OPTIONS */}
                                        {['select', 'multiselect', 'radio', 'checkbox'].includes(field.type) && (
                                            <div className="p-4 bg-cyan-50/50 rounded-xl border border-cyan-100 space-y-3">
                                                <div className="flex items-center gap-4">
                                                    <label className="text-[10px] font-black text-cyan-700 uppercase tracking-widest">¿Vincular a sistema?</label>
                                                    <select
                                                        value={field.systemSource || ''}
                                                        onChange={(e) => updateField(field.id, { systemSource: (e.target.value || undefined) as any })}
                                                        className="px-3 py-1 text-xs rounded-md border border-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-gray-900"
                                                    >
                                                        <option value="">No (Manual)</option>
                                                        <option value="UT">Unidades Territoriales (UT)</option>
                                                        <option value="RBD">Colegios (RBD)</option>
                                                        <option value="SUCURSAL">Sucursales</option>
                                                    </select>
                                                </div>

                                                {!field.systemSource && (
                                                    <div>
                                                        <label className="text-[10px] font-black text-cyan-600 uppercase tracking-widest mb-1 block">Opciones (Separadas por Coma)</label>
                                                        <input
                                                            type="text"
                                                            value={field.options?.join(', ') || ''}
                                                            onChange={(e) => updateField(field.id, { options: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '') })}
                                                            placeholder="Ej: Opción 1, Opción 2, Opción 3"
                                                            className="w-full px-4 py-2 text-xs rounded-lg border border-cyan-100 focus:outline-none bg-white font-medium text-gray-900"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* LINEAR SCALE */}
                                        {field.type === 'linear-scale' && (
                                            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 flex items-center gap-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-purple-700">De 1 a</span>
                                                    <select 
                                                        value={field.scaleMax || 5}
                                                        onChange={(e) => updateField(field.id, { scaleMax: parseInt(e.target.value) })}
                                                        className="px-2 py-1 text-xs border border-purple-200 rounded bg-white text-gray-900 font-bold"
                                                    >
                                                        <option value="3">3</option>
                                                        <option value="5">5</option>
                                                        <option value="10">10</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        {/* GRIDS */}
                                        {['grid-multiple', 'grid-checkbox'].includes(field.type) && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                                    <label className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block mb-2">Filas (una por línea)</label>
                                                    <textarea 
                                                        className="w-full h-24 text-xs p-2 border border-indigo-200 rounded bg-white font-medium text-gray-900"
                                                        value={field.gridRows?.join('\n') || ''}
                                                        onChange={(e) => updateField(field.id, { gridRows: e.target.value.split('\n').filter(l => l.trim() !== '') })}
                                                        placeholder="Fila 1\nFila 2..."
                                                    />
                                                </div>
                                                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                                    <label className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block mb-2">Columnas (una por línea)</label>
                                                    <textarea 
                                                        className="w-full h-24 text-xs p-2 border border-indigo-200 rounded bg-white font-medium text-gray-900"
                                                        value={field.gridCols?.join('\n') || ''}
                                                        onChange={(e) => updateField(field.id, { gridCols: e.target.value.split('\n').filter(l => l.trim() !== '') })}
                                                        placeholder="Col 1\nCol 2..."
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* FILE SETTINGS */}
                                        {field.type === 'file' && (
                                            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 space-y-3">
                                                <div className="flex items-center gap-4">
                                                    <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Peso Máximo (MB)</label>
                                                    <input 
                                                        type="number" 
                                                        value={field.maxFileSize || 100} 
                                                        onChange={(e) => updateField(field.id, { maxFileSize: parseInt(e.target.value) })}
                                                        className="w-20 px-2 py-1 text-xs border border-amber-200 rounded bg-white font-bold text-gray-900"
                                                    />
                                                    <span className="text-[10px] text-amber-600 font-bold italic">(Máximo recomendado: 100 MB)</span>
                                                </div>
                                                <div className="flex flex-wrap gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={field.allowedFileTypes?.includes('image/*') || false} 
                                                            onChange={(e) => {
                                                                const types = field.allowedFileTypes || []
                                                                if (e.target.checked) updateField(field.id, { allowedFileTypes: [...types, 'image/*'] })
                                                                else updateField(field.id, { allowedFileTypes: types.filter(t => t !== 'image/*') })
                                                            }}
                                                        />
                                                        <span className="text-xs font-bold text-amber-700">Imágenes (PNG, JPG)</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={field.allowedFileTypes?.includes('application/pdf') || false} 
                                                            onChange={(e) => {
                                                                const types = field.allowedFileTypes || []
                                                                if (e.target.checked) updateField(field.id, { allowedFileTypes: [...types, 'application/pdf'] })
                                                                else updateField(field.id, { allowedFileTypes: types.filter(t => t !== 'application/pdf') })
                                                            }}
                                                        />
                                                        <span className="text-xs font-bold text-amber-700">PDFs</span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-4">
                                            {field.type !== 'section' && (
                                                <label className="flex items-center gap-2 cursor-pointer group/check">
                                                    <input
                                                        type="checkbox"
                                                        checked={field.required}
                                                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                                                        className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500 cursor-pointer"
                                                    />
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-tighter group-hover/check:text-cyan-600 transition-colors italic">Obligatorio</span>
                                                </label>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-row md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-4">
                                        <button onClick={() => moveField(idx, 'up')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-cyan-600 transition-colors" title="Subir">↑</button>
                                        <button onClick={() => moveField(idx, 'down')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-cyan-600 transition-colors" title="Bajar">↓</button>
                                        <button onClick={() => removeField(field.id)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors" title="Eliminar">🗑️</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-40">
                <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-gray-100 flex items-center justify-between gap-4">
                    {message.text && (
                        <div className={`text-sm font-bold truncate ${message.type === 'success' ? 'text-green-600 bg-green-50 px-3 py-1 rounded' : 'text-red-600 bg-red-50 px-3 py-1 rounded'}`}>
                            {message.type === 'success' ? '✅' : '❌'} {message.text}
                        </div>
                    )}
                    <div className="flex-1"></div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`px-10 py-3 rounded-xl font-black uppercase tracking-widest transition-all shadow-xl disabled:opacity-50 flex items-center gap-2 ${initialForm ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-black'} text-white`}
                    >
                        {isSaving ? 'Guardando...' : initialForm ? 'Actualizar Formulario 💾' : 'Guardar Formulario 💾'}
                    </button>
                </div>
            </div>
        </div>
    )
}
