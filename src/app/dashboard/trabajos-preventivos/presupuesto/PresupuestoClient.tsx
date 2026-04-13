'use client'

import { useState, useTransition } from 'react'
import { savePresupuesto, deletePresupuesto } from './actions'

interface Sucursal {
    id: string
    nombre: string
}

interface Presupuesto {
    id: string
    ano: number
    sucursalId: string
    montoAnual: number
    usuario: string
    sucursal: {
        nombre: string
    }
}

export default function PresupuestoClient({ 
    sucursales, 
    initialPresupuestos 
}: { 
    sucursales: Sucursal[], 
    initialPresupuestos: Presupuesto[] 
}) {
    const [isPending, startTransition] = useTransition()
    const [montoAnual, setMontoAnual] = useState<number>(0)
    const [selectedAno, setSelectedAno] = useState<number>(2026)
    const [selectedSucursal, setSelectedSucursal] = useState<string>('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [isEditing, setIsEditing] = useState(false)

    const trimesterValue = montoAnual / 4

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError('')
        setSuccess(false)

        const formData = new FormData(e.currentTarget)
        
        startTransition(async () => {
            const result = await savePresupuesto(formData)
            if (result.error) {
                setError(result.error)
            } else {
                setSuccess(true)
                if (!isEditing) {
                    // Reset if not editing
                    setMontoAnual(0)
                    setSelectedSucursal('')
                }
                setIsEditing(false)
            }
        })
    }

    const handleEdit = (p: Presupuesto) => {
        setSelectedAno(p.ano)
        setSelectedSucursal(p.sucursalId)
        setMontoAnual(p.montoAnual)
        setIsEditing(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleCancelEdit = () => {
        setIsEditing(false)
        setMontoAnual(0)
        setSelectedSucursal('')
    }

    return (
        <div className="space-y-8">
            {/* Form section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 transition-all hover:shadow-md">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm">
                            {isEditing ? '✏️' : '📅'}
                        </span>
                        {isEditing ? 'Actualizar Presupuesto' : 'Configurar Presupuesto Anual'}
                    </div>
                    {isEditing && (
                        <button 
                            onClick={handleCancelEdit}
                            className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                        >
                            Cancelar Edición ✕
                        </button>
                    )}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Año del Presupuesto</label>
                            <select 
                                name="ano" 
                                value={selectedAno}
                                onChange={(e) => setSelectedAno(parseInt(e.target.value))}
                                required 
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 text-black font-bold outline-none"
                            >
                                {[2024, 2025, 2026, 2027, 2028].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Sucursal</label>
                            <select 
                                name="sucursalId" 
                                value={selectedSucursal}
                                onChange={(e) => setSelectedSucursal(e.target.value)}
                                required 
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 text-black font-bold outline-none"
                            >
                                <option value="">Seleccione una sucursal</option>
                                {sucursales.map(s => (
                                    <option key={s.id} value={s.id}>{s.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Monto Anual ($)</label>
                            <input 
                                name="montoAnual" 
                                type="number" 
                                value={montoAnual || ''}
                                required 
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                onChange={(e) => setMontoAnual(parseFloat(e.target.value) || 0)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 text-black font-bold outline-none"
                            />
                        </div>
                    </div>

                    {/* Desglose Trimestral */}
                    <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 animate-in fade-in slide-in-from-top-2 duration-300">
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-4">Desglose Trimestral Automático</p>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map(t => (
                                <div key={t} className="bg-white p-4 rounded-xl border border-emerald-200/50 shadow-sm transition-transform hover:scale-[1.02]">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Trimestre {t}</p>
                                    <p className="text-xl font-black text-emerald-600">
                                        ${trimesterValue.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>}
                    {success && <div className="p-3 bg-green-50 text-green-600 rounded-xl text-sm border border-green-100">Presupuesto {isEditing ? 'actualizado' : 'guardado'} exitosamente.</div>}

                    <div className="flex justify-end border-t border-gray-50 pt-6">
                        <button 
                            type="submit" 
                            disabled={isPending}
                            className={`px-8 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 text-white ${isEditing ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'}`}
                        >
                            {isPending ? 'Procesando...' : isEditing ? 'Actualizar Presupuesto' : 'Guardar Presupuesto'}
                        </button>
                    </div>
                </form>
            </div>

            {/* List section */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md">
                <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <span className="text-xl">📋</span> Presupuestos Registrados
                    </h3>
                    <span className="text-xs font-black bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full uppercase tracking-wider">
                        {initialPresupuestos.length} Registros
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Año</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Sucursal</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Monto Anual</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Trimestre</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Usuario</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {initialPresupuestos.map((p) => (
                                <tr key={p.id} className={`hover:bg-gray-50/50 transition-colors group ${isEditing && selectedAno === p.ano && selectedSucursal === p.sucursalId ? 'bg-emerald-50/30' : ''}`}>
                                    <td className="px-6 py-4 font-black text-gray-900">{p.ano}</td>
                                    <td className="px-6 py-4">
                                        <span className="font-bold text-gray-700">{p.sucursal.nombre}</span>
                                    </td>
                                    <td className="px-6 py-4 font-black text-emerald-600">
                                        ${p.montoAnual.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                                            ${(p.montoAnual / 4).toLocaleString('es-CL', { minimumFractionDigits: 0 })}/trim
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 font-medium">👤 {p.usuario}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => handleEdit(p)}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                title="Editar"
                                            >
                                                ✏️
                                            </button>
                                            <button 
                                                onClick={async () => {
                                                    if (confirm('¿Está seguro de eliminar este presupuesto?')) {
                                                        await deletePresupuesto(p.id)
                                                    }
                                                }}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                title="Eliminar"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {initialPresupuestos.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">
                                        No se han registrado presupuestos aún.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
