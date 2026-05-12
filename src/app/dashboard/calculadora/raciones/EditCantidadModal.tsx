'use client'

import { useState } from 'react'
import { updateRacion } from './actions'

export default function EditCantidadModal({ 
    racionId, 
    initialCantidad 
}: { 
    racionId: string, 
    initialCantidad: number
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [cantidad, setCantidad] = useState(initialCantidad.toString())
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSave = async () => {
        setLoading(true)
        setError('')
        const res = await updateRacion(racionId, Number(cantidad))
        if (res.error) {
            setError(res.error)
            setLoading(false)
        } else {
            setIsOpen(false)
            setLoading(false)
        }
    }

    if (!isOpen) {
        return (
            <div 
                onClick={() => setIsOpen(true)}
                className="cursor-pointer hover:bg-teal-100 p-2 rounded-lg transition-colors group flex items-center justify-center gap-2"
                title="Haga clic para editar la cantidad"
            >
                <span className="font-black text-teal-700 text-sm">{initialCantidad}</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">✏️</span>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    🍽️ Editar Raciones Asignadas
                </h3>
                
                {error && <p className="mb-4 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">{error}</p>}

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">Cantidad</label>
                        <input
                            type="number"
                            value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 font-bold text-gray-900"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 transition-colors shadow-lg shadow-teal-500/20 disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
