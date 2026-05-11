'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteMassiveMinutas } from './actions'

const MESES = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
]

export default function DeleteMassiveMinutasModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [mes, setMes] = useState<number>(new Date().getMonth() + 1)
    const [anio, setAnio] = useState<number>(new Date().getFullYear())
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [confirmText, setConfirmText] = useState('')

    const router = useRouter()

    const handleDelete = async () => {
        if (confirmText !== 'ELIMINAR') {
            alert('Por favor escriba ELIMINAR para confirmar.')
            return
        }

        setLoading(true)
        setMessage(null)
        
        const result = await deleteMassiveMinutas(mes, anio)

        if (result.success) {
            setMessage({ type: 'success', text: `Se eliminaron ${result.count} registros correctamente.` })
            setTimeout(() => {
                setIsOpen(false)
                setMessage(null)
                setConfirmText('')
                router.refresh()
            }, 3000)
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al eliminar.' })
        }
        setLoading(false)
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="px-6 py-3 rounded-xl bg-red-50 text-red-600 font-black text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm border border-red-100 flex items-center gap-2"
            >
                🗑️ Eliminación Masiva
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-[2rem] p-10 w-full max-w-md shadow-2xl animate-in zoom-in fade-in duration-300 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 to-orange-500"></div>
                        
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-colors text-2xl"
                        >
                            ✕
                        </button>

                        <div className="mb-8">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                <span className="bg-red-100 p-2 rounded-xl">⚠️</span> Borrado Masivo
                            </h3>
                            <p className="text-slate-500 font-bold text-sm mt-2">
                                Se eliminarán todas las minutas que coincidan con el Mes y Año seleccionados.
                            </p>
                        </div>

                        {message && (
                            <div className={`mb-6 p-4 rounded-2xl text-xs font-black border uppercase tracking-widest ${
                                message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'
                            }`}>
                                {message.text}
                            </div>
                        )}

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Seleccionar Mes</label>
                                <select
                                    value={mes}
                                    onChange={(e) => setMes(parseInt(e.target.value))}
                                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 bg-slate-50 text-slate-900 font-black text-sm transition-all appearance-none"
                                >
                                    {MESES.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Seleccionar Año</label>
                                <input
                                    type="number"
                                    value={anio}
                                    onChange={(e) => setAnio(parseInt(e.target.value))}
                                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 bg-slate-50 text-slate-900 font-black text-sm transition-all"
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-[10px] font-black text-red-500 uppercase mb-3 ml-1 tracking-widest">Escriba "ELIMINAR" para confirmar</p>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder="ELIMINAR"
                                    className="w-full px-5 py-3.5 rounded-2xl border-2 border-red-100 focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 bg-red-50/30 text-red-600 font-black text-center text-sm transition-all placeholder:text-red-200"
                                />
                            </div>

                            <div className="pt-6 flex gap-4">
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="px-6 py-4 flex-1 rounded-2xl text-slate-500 bg-slate-100 hover:bg-slate-200 font-black text-xs uppercase tracking-widest transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={loading || confirmText !== 'ELIMINAR'}
                                    className="px-6 py-4 flex-[2] rounded-2xl text-white bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:grayscale font-black text-xs uppercase tracking-widest shadow-xl shadow-red-500/20 transition-all transform active:scale-95"
                                >
                                    {loading ? 'Eliminando...' : '🚀 Confirmar Borrado'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
