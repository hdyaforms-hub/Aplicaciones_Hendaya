'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

export default function IngresarMatrizDashboard({ matrices }: { matrices: any[] }) {
    const router = useRouter()
    const [selectedLicId, setSelectedLicId] = useState<number | ''>('')
    const [selectedMatrixId, setSelectedMatrixId] = useState<string>('')

    // Unique licitaciones from available matrices
    const licitaciones = useMemo(() => {
        const unique = new Map()
        matrices.forEach(m => {
            if (m.licitacion && !unique.has(m.licId)) {
                unique.set(m.licId, m.licitacion)
            }
        })
        return Array.from(unique.values()).sort((a, b) => a.licId - b.licId)
    }, [matrices])

    // Filtered matrices based on selected licitacion
    const filteredMatrices = useMemo(() => {
        if (!selectedLicId) return []
        return matrices.filter(m => m.licId === selectedLicId)
    }, [matrices, selectedLicId])

    const handleStart = () => {
        if (!selectedMatrixId) return
        router.push(`/dashboard/matriz-riesgo/ingresar/${selectedMatrixId}`)
    }

    return (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        1. Seleccione Licitación
                    </label>
                    <select
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-slate-800 font-medium"
                        value={selectedLicId}
                        onChange={(e) => {
                            setSelectedLicId(Number(e.target.value))
                            setSelectedMatrixId('')
                        }}
                    >
                        <option value="">-- Seleccione Licitación --</option>
                        {licitaciones.map((lic: any) => (
                            <option key={lic.licId} value={lic.licId}>
                                Licitación {lic.licId} {lic.licitacionHomologada ? `(${lic.licitacionHomologada})` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                {selectedLicId && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            2. Seleccione Plantilla de Matriz
                        </label>
                        <select
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-slate-800 font-medium"
                            value={selectedMatrixId}
                            onChange={(e) => setSelectedMatrixId(e.target.value)}
                        >
                            <option value="">-- Seleccione Matriz --</option>
                            {filteredMatrices.map(m => (
                                <option key={m.id} value={m.id}>
                                    {m.titulo} ({m.anio})
                                </option>
                            ))}
                        </select>
                        {filteredMatrices.length === 0 && (
                            <p className="text-xs text-amber-600 mt-2">No hay matrices vigentes para esta licitación.</p>
                        )}
                    </div>
                )}
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-end">
                <button
                    onClick={handleStart}
                    disabled={!selectedMatrixId}
                    className="px-8 py-4 bg-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-all shadow-lg flex items-center gap-2"
                >
                    Comenzar / Ingresar <span>➡️</span>
                </button>
            </div>
        </div>
    )
}
