import { useState } from 'react'
import { anularFolio } from './actions'

export default function AnularModal({ 
    folio, 
    isOpen, 
    onClose, 
    onAnulado 
}: { 
    folio: string, 
    isOpen: boolean, 
    onClose: () => void, 
    onAnulado: () => void 
}) {
    const [motivo, setMotivo] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    if (!isOpen) return null

    const handleAnular = async () => {
        if (!motivo.trim()) {
            setError('Debes ingresar un motivo para anular.')
            return
        }
        setLoading(true)
        setError('')
        const res = await anularFolio(folio, motivo)
        setLoading(false)
        if (res.error) {
            setError(res.error)
        } else {
            onAnulado()
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                    <span className="text-2xl">🚫</span>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight leading-none">Anular Folio</h2>
                        <p className="text-sm text-gray-500 font-medium mt-1">Folio: {folio}</p>
                    </div>
                </div>
                
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Fecha de Anulación</label>
                        <input 
                            type="text" 
                            disabled 
                            value={new Date().toLocaleDateString()} 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-100 text-gray-600 font-bold"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Motivo de Anulación</label>
                        <textarea
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder="Escribe el motivo por el cual se anula el folio..."
                            rows={4}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500 bg-gray-50 text-gray-900 font-medium resize-none"
                        ></textarea>
                        {error && <p className="text-rose-500 text-xs font-bold mt-2">{error}</p>}
                    </div>
                </div>
                
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-xl text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 font-bold transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleAnular}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-xl text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-500/20 font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? 'Anulando...' : 'Anular Folio'}
                    </button>
                </div>
            </div>
        </div>
    )
}
