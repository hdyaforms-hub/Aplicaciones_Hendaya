'use client'

import { useState } from 'react'
import { crearAlerta } from './actions'
import { useRouter } from 'next/navigation'

export default function CrearAlertaForm({ onClose, user }: { onClose: () => void, user: any }) {
    const [loading, setLoading] = useState(false)
    const [files, setFiles] = useState<File[]>([])
    const router = useRouter()
    const [selectedColor, setSelectedColor] = useState('yellow')

    const colors = [
        { id: 'yellow', name: 'Amarillo', bg: 'bg-yellow-200', border: 'border-yellow-300' },
        { id: 'pink', name: 'Rosado', bg: 'bg-pink-200', border: 'border-pink-300' },
        { id: 'cyan', name: 'Celeste', bg: 'bg-cyan-200', border: 'border-cyan-300' },
        { id: 'green', name: 'Verde', bg: 'bg-green-200', border: 'border-green-300' },
        { id: 'purple', name: 'Púrpura', bg: 'bg-purple-200', border: 'border-purple-300' },
    ]

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        
        try {
            const formData = new FormData(e.currentTarget)
            
            // Append files
            files.forEach((file, index) => {
                if (index < 5) formData.append(`archivo_${index}`, file)
            })
            formData.append('color', selectedColor)

            const res = await crearAlerta(formData, user.username || user.name || 'Usuario')
            if (res.error) {
                alert('Error: ' + res.error)
            } else {
                router.refresh()
                onClose()
            }
        } catch (error) {
            console.error(error)
            alert('Error inesperado')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-amber-500 p-6 text-white flex justify-between items-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
                    <h2 className="text-2xl font-bold relative z-10 flex items-center gap-2">
                        <span>📝</span> Nueva Alerta de Calidad
                    </h2>
                    <button onClick={onClose} className="text-white/80 hover:text-white relative z-10 text-xl font-bold p-2">✕</button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Título de la Alerta <span className="text-red-500">*</span></label>
                        <input 
                            name="titulo" 
                            required 
                            maxLength={150}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all outline-none"
                            placeholder="Ej. Búsqueda de Lote Vencido"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Observación <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(Max 1500 caract.)</span></label>
                        <textarea 
                            name="observacion" 
                            required 
                            maxLength={1500}
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all outline-none resize-none"
                            placeholder="Detalla qué producto, lote y motivo de la búsqueda..."
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Horas para gestión <span className="text-red-500">*</span></label>
                        <input 
                            name="horas" 
                            type="number"
                            min="1"
                            max="720"
                            required 
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all outline-none"
                            placeholder="Cantidad de horas límite"
                        />
                        <p className="text-xs text-gray-500 mt-1">Tiempo que tendrán las sucursales para responder.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Color del Post-it</label>
                        <div className="flex gap-3">
                            {colors.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setSelectedColor(c.id)}
                                    className={`
                                        w-10 h-10 rounded-full border-2 transition-all 
                                        ${c.bg} ${c.border} 
                                        ${selectedColor === c.id ? 'scale-125 shadow-lg ring-2 ring-amber-500 ring-offset-2' : 'hover:scale-110'}
                                    `}
                                    title={c.name}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Adjuntar Archivos (Opcional, max 5)</label>
                        <input 
                            type="file" 
                            multiple 
                            accept="image/*,.pdf"
                            onChange={(e) => {
                                if (e.target.files) {
                                    const selected = Array.from(e.target.files).slice(0, 5)
                                    setFiles(selected)
                                }
                            }}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 transition-all cursor-pointer"
                        />
                        {files.length > 0 && (
                            <ul className="mt-3 space-y-1">
                                {files.map((f, i) => (
                                    <li key={i} className="text-xs text-gray-600 flex items-center gap-2">
                                        📄 {f.name} ({(f.size / 1024).toFixed(1)} KB)
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-md shadow-amber-500/20 transition-all disabled:opacity-50"
                        >
                            {loading ? 'Creando...' : 'Guardar y Emitir Alerta'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
