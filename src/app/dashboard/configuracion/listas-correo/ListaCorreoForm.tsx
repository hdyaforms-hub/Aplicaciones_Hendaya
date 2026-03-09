'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createListaCorreo, updateListaCorreo } from './actions'

type FormProps = {
    lista?: {
        id: string;
        nombre: string;
        descripcion: string | null;
        para: string; // JSON guardado en DB (string[])
        cc: string | null; // JSON guardado en DB (string[])
        sucursalId?: string | null;
    };
    sucursales: { id: string; nombre: string }[];
    onClose: () => void;
}

export default function ListaCorreoForm({ lista, sucursales, onClose }: FormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Parseando y formateando para facilidad de pegado (un correo por línea)
    let initialPara = ''
    let initialCc = ''

    if (lista) {
        try {
            const arrPara = JSON.parse(lista.para)
            initialPara = Array.isArray(arrPara) ? arrPara.join('\n') : ''
        } catch (e) { }
        try {
            if (lista.cc) {
                const arrCc = JSON.parse(lista.cc)
                initialCc = Array.isArray(arrCc) ? arrCc.join('\n') : ''
            }
        } catch (e) { }
    }

    const [formData, setFormData] = useState({
        nombre: lista?.nombre || '',
        descripcion: lista?.descripcion || '',
        paraText: initialPara,
        ccText: initialCc,
        sucursalId: lista?.sucursalId || ''
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    // Extrae correos limpiándolos de comas, saltos de línea o espacios extra
    const extractEmails = (text: string) => {
        return text
            .split(/[\n,;]+/) // Separar por enter, coma o punto y coma
            .map(e => e.trim())
            .filter(e => e !== '')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        const arrPara = extractEmails(formData.paraText)
        const arrCc = extractEmails(formData.ccText)

        if (arrPara.length === 0) {
            setError('Debe incluir al menos un correo válido en el campo "Para".')
            setLoading(false)
            return
        }

        const payload = {
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            para: arrPara,
            cc: arrCc,
            sucursalId: formData.sucursalId || null
        }

        let result;
        if (lista) {
            result = await updateListaCorreo(lista.id, payload)
        } else {
            result = await createListaCorreo(payload)
        }

        if (result.error) {
            setError(result.error)
            setLoading(false)
        } else {
            onClose() // Se cierra exitosamente y se recarga
        }
    }

    return (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-xl font-bold text-gray-900">
                        {lista ? '✏️ Editar Lista de Distribución' : '➕ Nueva Lista de Distribución'}
                    </h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-center w-8 h-8 rounded-full hover:bg-gray-200 transition-colors">✕</button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                    {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 font-medium">{error}</div>}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre de la Lista (Ej: Abastecimiento) <span className="text-red-500">*</span></label>
                            <input
                                name="nombre"
                                required
                                value={formData.nombre}
                                onChange={handleChange}
                                placeholder="Abastecimiento"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50/50 font-medium text-gray-900"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Breve Descripción</label>
                            <input
                                name="descripcion"
                                value={formData.descripcion}
                                onChange={handleChange}
                                placeholder="Lista para notificaciones de stock y rebajas..."
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50/50 text-gray-800"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal Asociada (Opcional)</label>
                            <select
                                name="sucursalId"
                                value={formData.sucursalId}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 appearance-none"
                            >
                                <option value="">Global / Todas las Sucursales</option>
                                {sucursales.map(s => (
                                    <option key={s.id} value={s.id}>{s.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Correos destino (PARA) <span className="text-red-500">*</span></label>
                            <div className="text-xs text-gray-500 mb-2">💡 Puedes copiar y pegar varios correos juntos (separados por renglones, un espacio, comas o punto y coma).</div>
                            <textarea
                                name="paraText"
                                required
                                rows={4}
                                value={formData.paraText}
                                onChange={handleChange}
                                placeholder="correo1@ejemplo.com&#10;correo2@ejemplo.com"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                                style={{ resize: 'vertical' }}
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Correos anexados (CON COPIA - CC)</label>
                            <textarea
                                name="ccText"
                                rows={3}
                                value={formData.ccText}
                                onChange={handleChange}
                                placeholder="gerente@ejemplo.com&#10;auditoria@ejemplo.com"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                                style={{ resize: 'vertical' }}
                            />
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/30">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-2.5 rounded-xl text-white bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 shadow-md shadow-cyan-500/20 font-bold transition-all disabled:opacity-70 disabled:pointer-events-none"
                    >
                        {loading ? 'Guardando...' : '💾 Guardar Lista'}
                    </button>
                </div>
            </form>
        </div>
    )
}
