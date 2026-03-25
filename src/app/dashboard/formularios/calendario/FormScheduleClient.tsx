'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateFormSchedules } from '../actions'

const DAYS = [
    { id: 0, name: 'Domingo' },
    { id: 1, name: 'Lunes' },
    { id: 2, name: 'Martes' },
    { id: 3, name: 'Miércoles' },
    { id: 4, name: 'Jueves' },
    { id: 5, name: 'Viernes' },
    { id: 6, name: 'Sábado' },
]

export default function FormScheduleClient({ form }: { form: any }) {
    const router = useRouter()
    const [schedules, setSchedules] = useState<any[]>(form.schedules || [])
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })

    const addSchedule = () => {
        setSchedules([...schedules, { startDay: 1, startTime: '09:00', endDay: 1, endTime: '18:00' }])
    }

    const removeSchedule = (index: number) => {
        setSchedules(schedules.filter((_, i) => i !== index))
    }

    const updateSchedule = (index: number, updates: any) => {
        setSchedules(schedules.map((s, i) => i === index ? { ...s, ...updates } : s))
    }

    const handleSave = async () => {
        setIsSaving(true)
        const res = await updateFormSchedules(form.id, schedules)
        if (res.success) {
            setMessage({ type: 'success', text: 'Calendario actualizado con éxito' })
            setTimeout(() => router.push('/dashboard/formularios/abrir'), 1500)
        } else {
            setMessage({ type: 'error', text: res.error || 'Error al actualizar' })
            setIsSaving(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-8">
                <div className="bg-slate-900 p-8">
                    <div className="flex justify-between items-center mb-6">
                        <button 
                            onClick={() => router.back()} 
                            className="text-slate-400 hover:text-white transition-colors text-xs font-black uppercase tracking-widest flex items-center gap-2 py-2 px-4 rounded-lg bg-slate-800/50 hover:bg-slate-800"
                        >
                            ← Volver al Listado
                        </button>
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <span className="text-4xl">⏰</span> Programar: {form.title}
                    </h2>
                    <p className="text-slate-400 mt-2 font-medium italic">Define ventanas de tiempo semanales en las que el formulario estará visible y activo.</p>
                </div>

                <div className="p-8 space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-black text-gray-800 uppercase tracking-widest">Ventanas de Activación</h3>
                        <button
                            onClick={addSchedule}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-amber-100 flex items-center gap-2"
                        >
                            <span>➕</span> Añadir Periodo
                        </button>
                    </div>

                    {schedules.length === 0 ? (
                        <div className="bg-amber-50 border border-dashed border-amber-200 p-12 rounded-3xl text-center">
                            <span className="text-4xl mb-4 block opacity-30">🔔</span>
                            <p className="text-amber-800 font-bold uppercase tracking-widest text-sm">Sin programación específica</p>
                            <p className="text-amber-600 text-xs mt-1 italic font-medium">El formulario estará activo permanentemente según su estado general.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {schedules.map((s, idx) => (
                                <div key={idx} className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex flex-col md:flex-row gap-6 items-center group relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                                    
                                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Día Inicio</label>
                                            <select
                                                value={s.startDay}
                                                onChange={(e) => updateSchedule(idx, { startDay: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white font-bold text-gray-700 focus:outline-none focus:border-amber-500"
                                            >
                                                {DAYS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Hora Inicio</label>
                                            <input
                                                type="time"
                                                value={s.startTime}
                                                onChange={(e) => updateSchedule(idx, { startTime: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white font-bold text-gray-700 focus:outline-none focus:border-amber-500"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Día Fin</label>
                                            <select
                                                value={s.endDay}
                                                onChange={(e) => updateSchedule(idx, { endDay: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white font-bold text-gray-700 focus:outline-none focus:border-amber-500"
                                            >
                                                {DAYS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Hora Fin</label>
                                            <input
                                                type="time"
                                                value={s.endTime}
                                                onChange={(e) => updateSchedule(idx, { endTime: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white font-bold text-gray-700 focus:outline-none focus:border-amber-500"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => removeSchedule(idx)}
                                        className="p-3 text-red-100 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                        title="Eliminar periodo"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                    <div className="text-xs font-bold text-gray-400 italic">
                        {schedules.length} periodos de activación configurados
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-10 py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-black uppercase tracking-widest shadow-xl transition-all disabled:opacity-50"
                    >
                        {isSaving ? 'Guardando...' : 'Guardar Calendario 💾'}
                    </button>
                </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex gap-4">
                <span className="text-2xl">💡</span>
                <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-800">Consejo de Uso</p>
                    <p className="text-xs text-amber-700 font-medium">Puedes configurar periodos que crucen la medianoche o el fin de semana. Por ejemplo, desde el Lunes a las 10:00 hasta el Martes a las 14:30. El sistema ocultará el formulario automáticamente fuera de estos rangos.</p>
                </div>
            </div>
        </div>
    )
}
