'use client'

import { useState, useMemo, useEffect } from 'react'
import { format, addDays, isAfter, isBefore, differenceInDays } from 'date-fns'
import { saveMitigacionAction, approveAndCloseMatrixAction, deleteMatrixAction } from './actions'
import { useRouter, useSearchParams } from 'next/navigation'
import MitigacionFileUploader from './MitigacionFileUploader'

const PROBLEM_VALUES = ['NO', 'NO_EXISTE', 'MALO_NO_CUMPLE', 'NO_HAY_REQUIERE']

export default function MitigacionClient({ 
    initialEvaluaciones, 
    initialMitigaciones,
    cutoffDate,
    isAdmin,
    error
}: { 
    initialEvaluaciones: any[], 
    initialMitigaciones: any[],
    cutoffDate: Date | string,
    isAdmin?: boolean,
    error?: string
}) {
    const evaluaciones = initialEvaluaciones
    const mitigaciones = initialMitigaciones
    const [semestre, setSemestre] = useState<1 | 2>(1)
    const [selectedEvaluacionId, setSelectedEvaluacionId] = useState<string | null>(null)
    const [saving, setSaving] = useState<string | null>(null)
    const [approving, setApproving] = useState<boolean>(false)
    const [deleting, setDeleting] = useState<boolean>(false)
    const [selectedImage, setSelectedImage] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState<'PENDIENTES' | 'FINALIZADAS'>('PENDIENTES')
    const [searchQuery, setSearchQuery] = useState('')
    const [showDropdown, setShowDropdown] = useState(false)
    
    const router = useRouter()
    const searchParams = useSearchParams()
    
    const currentYear = new Date().getFullYear()
    const selectedYear = searchParams.get('year') ? parseInt(searchParams.get('year')!) : currentYear
    const availableYears = Array.from({ length: Math.max(5, currentYear + 5 - 2024 + 1) }, (_, i) => 2024 + i)

    const cutoff = new Date(cutoffDate)

    const getProblems = (evaluacion: any) => {
        const problems: any[] = []
        
        // Match respuestas con detalles de la plantilla
        const respuestasMap = new Map(evaluacion.detalles.map((d: any) => [d.preguntaId, d]))
        const plantillaDetalles = evaluacion.cabecera?.detalles || []

        plantillaDetalles.forEach((pregunta: any) => {
            const respuesta = respuestasMap.get(pregunta.id)
            if (respuesta && PROBLEM_VALUES.includes((respuesta as any).valor)) {
                const mitigacion = mitigaciones.find(m => m.matrizId === evaluacion.id && m.preguntaId === pregunta.id)
                
                // Extraer días del nivel de riesgo configurado en la pregunta
                let days = 30
                if (pregunta.nivelRiesgo === 1) days = 90
                else if (pregunta.nivelRiesgo === 2) days = 60
                else if (pregunta.nivelRiesgo === 3) days = 30

                const deadline = addDays(new Date(evaluacion.fechaIngreso), days)
                const nivelStr = pregunta.nivelRiesgo === 1 ? 'Bajo (90d)' : pregunta.nivelRiesgo === 2 ? 'Medio (60d)' : pregunta.nivelRiesgo === 3 ? 'Alto (30d)' : 'No Configurado (30d)'

                // Extraer fotos originales de la respuesta
                let originalPhotos: string[] = []
                try {
                    if ((respuesta as any).adjuntoUrl) {
                        const parsed = JSON.parse((respuesta as any).adjuntoUrl)
                        originalPhotos = Array.isArray(parsed) ? parsed : [(respuesta as any).adjuntoUrl]
                    }
                } catch(e) {
                    if ((respuesta as any).adjuntoUrl) originalPhotos = [(respuesta as any).adjuntoUrl]
                }

                problems.push({
                    ...pregunta,
                    response: (respuesta as any).valor,
                    nivelRiesgoStr: nivelStr,
                    deadline,
                    mitigacion: mitigacion || null,
                    originalPhotos
                })
            }
        })
        return problems
    }

    const isFinalizada = (ev: any) => {
        // En auditoría, está finalizada si su estado en cabecera es 'cerrado'
        return ev.estado === 'cerrado'
    }

    const filteredEvaluaciones = useMemo(() => {
        return evaluaciones.filter(evaluacion => {
            const evalDate = new Date(evaluacion.fechaIngreso)
            const inSemestre = semestre === 1 
                ? (isBefore(evalDate, cutoff) || evalDate.getTime() === cutoff.getTime())
                : isAfter(evalDate, cutoff)
                
            if (!inSemestre) return false

            const matchSearch = evaluacion.rbd.toString().includes(searchQuery) || 
                                (evaluacion.cabecera?.titulo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (evaluacion.nombreColegio || '').toLowerCase().includes(searchQuery.toLowerCase())
            
            if (searchQuery && !matchSearch) return false

            const fin = isFinalizada(evaluacion)
            if (filterStatus === 'PENDIENTES' && fin) return false
            if (filterStatus === 'FINALIZADAS' && !fin) return false

            return true
        })
    }, [evaluaciones, semestre, cutoff, searchQuery, filterStatus])

    useEffect(() => {
        if (selectedEvaluacionId && !filteredEvaluaciones.some(e => e.id === selectedEvaluacionId)) {
            setSelectedEvaluacionId(null)
        }
    }, [filteredEvaluaciones, selectedEvaluacionId])

    const handleSave = async (matrizId: string, preguntaId: string, fechaSolucion: string, adjuntos?: string[]) => {
        const key = `${matrizId}-${preguntaId}`
        setSaving(key)
        const res = await saveMitigacionAction({
            matrizId,
            preguntaId,
            fechaSolucion,
            adjuntos
        })
        setSaving(null)
        if (res.success) {
            router.refresh()
        } else {
            alert(res.error)
        }
    }

    const selectedEvaluacion = evaluaciones.find(e => e.id === selectedEvaluacionId)
    const problemList = selectedEvaluacion ? getProblems(selectedEvaluacion) : []

    const sectionColors: Record<string, string> = {
        'PATIO_SERVICIO': 'bg-amber-100 text-amber-900 border-amber-300',
        'BODEGA': 'bg-orange-100 text-orange-950 border-orange-300',
        'COCINA': 'bg-emerald-100 text-emerald-950 border-emerald-300',
        'BANO': 'bg-cyan-100 text-cyan-950 border-cyan-300',
        'LEVANTAMIENTO_GENERAL': 'bg-blue-100 text-blue-950 border-blue-300'
    }

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
            {/* Sidebar de Evaluaciones */}
            <div className="lg:col-span-4 space-y-4">
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Año de Matriz:</p>
                        <select 
                            value={selectedYear}
                            onChange={(e) => router.push(`?year=${e.target.value}`)}
                            className="p-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-cyan-500 font-medium outline-none text-sm text-slate-900"
                        >
                            {availableYears.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex p-1 bg-slate-100 rounded-2xl">
                        <button 
                            onClick={() => setSemestre(1)}
                            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${semestre === 1 ? 'bg-white shadow-sm text-cyan-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            1er Semestre
                        </button>
                        <button 
                            onClick={() => setSemestre(2)}
                            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${semestre === 2 ? 'bg-white shadow-sm text-cyan-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            2do Semestre
                        </button>
                    </div>
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Buscar RBD o Nombre..." 
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setShowDropdown(true)
                            }}
                            onFocus={() => setShowDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900"
                        />
                        {showDropdown && searchQuery && (
                            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl mt-1 max-h-60 overflow-y-auto shadow-lg text-slate-900">
                                {Array.from(new Map(evaluaciones
                                    .filter(ev => ev.rbd.toString().includes(searchQuery) || (ev.nombreColegio || '').toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map(ev => [ev.rbd, ev])
                                 ).values()).map((ev: any) => (
                                    <li
                                        key={ev.rbd}
                                        onClick={() => {
                                            setSearchQuery(ev.rbd.toString())
                                            setShowDropdown(false)
                                        }}
                                        className="p-3 hover:bg-slate-50 cursor-pointer text-sm border-b border-gray-100 last:border-0"
                                    >
                                        <span className="font-bold text-cyan-600 mr-2">{ev.rbd}</span>
                                        {ev.nombreColegio || 'Sin Nombre'}
                                    </li>
                                ))}
                                {Array.from(new Map(evaluaciones
                                    .filter(ev => ev.rbd.toString().includes(searchQuery) || (ev.nombreColegio || '').toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map(ev => [ev.rbd, ev])
                                 ).values()).length === 0 && (
                                    <li className="p-3 text-sm text-gray-500">No se encontraron resultados</li>
                                )}
                            </ul>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setFilterStatus('PENDIENTES')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${filterStatus === 'PENDIENTES' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                        >
                            Pendientes
                        </button>
                        <button 
                            onClick={() => setFilterStatus('FINALIZADAS')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${filterStatus === 'FINALIZADAS' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                        >
                            Cerradas / Historial
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 font-bold text-sm text-center">
                        {error}
                    </div>
                )}

                {!error && (
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-gray-100">
                        <h3 className="font-bold text-slate-700 text-sm">Evaluaciones Matriz Riesgo</h3>
                    </div>
                    <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                        {filteredEvaluaciones.map(ev => {
                            const problems = getProblems(ev)
                            const solved = problems.filter(p => p.mitigacion?.fechaSolucion).length
                            const pct = problems.length > 0 ? Math.round((solved / problems.length) * 100) : 100
                            
                            return (
                                <div 
                                    key={ev.id} 
                                    onClick={() => setSelectedEvaluacionId(ev.id)}
                                    className={`p-4 cursor-pointer transition-all hover:bg-slate-50 ${selectedEvaluacionId === ev.id ? 'bg-cyan-50 border-l-4 border-cyan-500' : ''}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-black text-slate-900 text-sm">{ev.nombreColegio || `RBD: ${ev.rbd}`}</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-0.5">{format(new Date(ev.fechaIngreso), 'dd/MM/yyyy HH:mm')} - RBD: {ev.rbd}</p>
                                            <p className="text-[11px] text-cyan-700 mt-1">{ev.cabecera?.titulo} ({ev.cabecera?.anio})</p>
                                        </div>
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-black ${ev.estado === 'cerrado' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {ev.estado.toUpperCase()}
                                        </div>
                                    </div>
                                    <div className="mt-2 text-[11px] text-slate-600 font-bold grid grid-cols-2 gap-2">
                                        <div className="flex items-center gap-1">
                                            <span className="text-orange-500">⚠️</span> {problems.length} Hallazgos
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-emerald-500">✅</span> {solved} Soluciones
                                        </div>
                                    </div>
                                    <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div className={`h-full transition-all duration-500 ${ev.estado === 'cerrado' ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }}></div>
                                    </div>
                                </div>
                            )
                        })}
                        {filteredEvaluaciones.length === 0 && (
                            <div className="p-8 text-center text-slate-400 text-sm font-medium">
                                No hay evaluaciones en este periodo.
                            </div>
                        )}
                    </div>
                </div>
                )}
            </div>

            {/* Panel de Detalle de Mitigación */}
            <div className="lg:col-span-8">
                {selectedEvaluacion ? (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">Auditoría de Mitigación</h2>
                                <p className="text-sm text-slate-500 font-medium mt-1">{selectedEvaluacion.nombreColegio || `RBD ${selectedEvaluacion.rbd}`} - {format(new Date(selectedEvaluacion.fechaIngreso), 'dd MMMM yyyy')}</p>
                                {selectedEvaluacion.latIngreso && selectedEvaluacion.lngIngreso && (
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1 flex items-center gap-1">
                                        📍 Lat Ingreso: {selectedEvaluacion.latIngreso.toFixed(6)}, Lng: {selectedEvaluacion.lngIngreso.toFixed(6)}
                                    </p>
                                )}
                                {selectedEvaluacion.latCierre && selectedEvaluacion.lngCierre && (
                                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight mt-0.5 flex items-center gap-1">
                                        📍 Lat Cierre: {selectedEvaluacion.latCierre.toFixed(6)}, Lng: {selectedEvaluacion.lngCierre.toFixed(6)}
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                {selectedEvaluacion.estado === 'por supervisar' && (
                                    <button
                                        onClick={async () => {
                                            if (!confirm('¿Está seguro de aprobar y cerrar definitivamente esta matriz?')) return
                                            setApproving(true)
                                            const res = await approveAndCloseMatrixAction(selectedEvaluacion.id)
                                            setApproving(false)
                                            if (res.success) {
                                                alert('¡Matriz aprobada y cerrada definitivamente!')
                                                router.refresh()
                                            } else {
                                                alert(res.error)
                                            }
                                        }}
                                        disabled={approving}
                                        className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all"
                                    >
                                        {approving ? 'Procesando...' : '✅ Aprobar y Cerrar'}
                                    </button>
                                )}

                                {selectedEvaluacion.estado === 'cerrado' && (
                                    <span className="px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs text-center flex-1 sm:flex-none">
                                        🔒 CERRADA POR AUDITORÍA
                                    </span>
                                )}

                                {isAdmin && (
                                    <button
                                        onClick={async () => {
                                            if (!confirm('¿Está seguro de eliminar esta evaluación permanentemente? Esta acción es irreversible.')) return
                                            setDeleting(true)
                                            const res = await deleteMatrixAction(selectedEvaluacion.id)
                                            setDeleting(false)
                                            if (res.success) {
                                                alert('¡Evaluación eliminada exitosamente!')
                                                setSelectedEvaluacionId(null)
                                                router.refresh()
                                            } else {
                                                alert(res.error)
                                            }
                                        }}
                                        disabled={deleting}
                                        className="flex-1 sm:flex-none px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-all"
                                    >
                                        {deleting ? 'Eliminando...' : '🗑️ Eliminar'}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {problemList.map((p) => {
                                const remaining = differenceInDays(p.deadline, new Date())
                                const isExpired = remaining < 0 && !p.mitigacion?.fechaSolucion
                                const isReadOnly = selectedEvaluacion.estado === 'cerrado' && !isAdmin
                                
                                return (
                                    <div key={p.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                                        <div className={`px-6 py-3 flex justify-between items-center bg-slate-50`}>
                                            <span className={`text-[10px] font-black uppercase tracking-widest text-slate-600`}>
                                                SECCIÓN: {p.seccion.replace('_', ' ')}
                                            </span>
                                            <div className="flex gap-2">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${p.nivelRiesgo === 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : p.nivelRiesgo === 2 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                    RIESGO: {p.nivelRiesgoStr}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-6">
                                            <p className="text-slate-800 font-bold text-sm leading-relaxed">{p.preguntaNombre}</p>
                                            <div className="mt-2 p-2 bg-slate-50 rounded-xl text-xs text-slate-500 border border-slate-100 italic">
                                                Respuesta del usuario: <span className="font-bold text-slate-700">{p.response}</span>
                                            </div>

                                            {p.originalPhotos?.length > 0 && (
                                                <div className="mt-4">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2">Evidencia Original</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {p.originalPhotos.map((photo: string, i: number) => (
                                                            <div 
                                                                key={i} 
                                                                onClick={() => setSelectedImage(photo)}
                                                                className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden cursor-pointer hover:ring-4 hover:ring-cyan-500/30 transition-all shadow-sm border border-slate-200"
                                                            >
                                                                <img src={photo} alt="Evidencia" className="w-full h-full object-cover" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                                                {/* Plazos */}
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2">Seguimiento de Plazos</p>
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                                            <span className="text-xs font-bold text-slate-600">Fecha Tope</span>
                                                            <span className="text-xs font-black text-slate-900">{format(p.deadline, 'dd/MM/yyyy')}</span>
                                                        </div>
                                                        <div className={`flex justify-between items-center p-3 rounded-2xl border ${p.mitigacion?.fechaSolucion ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : isExpired ? 'bg-red-50 border-red-100 text-red-700' : 'bg-cyan-50 border-cyan-100 text-cyan-700'}`}>
                                                            <span className="text-xs font-bold">Estado</span>
                                                            <span className="text-xs font-black">
                                                                {p.mitigacion?.fechaSolucion ? 'RESUELTO' : isExpired ? `VENCIDO (${Math.abs(remaining)} días)` : `PENDIENTE (${remaining} días rest.)`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Acciones */}
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2">Completar Solución</p>
                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 ml-1">FECHA DE SOLUCIÓN</label>
                                                            <input 
                                                                type="date"
                                                                disabled={isReadOnly}
                                                                defaultValue={p.mitigacion?.fechaSolucion ? format(new Date(p.mitigacion.fechaSolucion), 'yyyy-MM-dd') : ''}
                                                                onBlur={(e) => {
                                                                    if (isReadOnly) return
                                                                    handleSave(selectedEvaluacion.id, p.id, e.target.value, p.mitigacion?.adjuntos ? JSON.parse(p.mitigacion.adjuntos) : undefined)
                                                                }}
                                                                className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-cyan-500 outline-none disabled:opacity-50"
                                                            />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold text-slate-500 ml-1 mb-2">EVIDENCIAS (MÁX. 4)</p>
                                                            {isReadOnly ? (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {p.mitigacion?.adjuntos && JSON.parse(p.mitigacion.adjuntos).map((path: string, i: number) => (
                                                                        <div key={i} className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center relative group">
                                                                            {path.endsWith('.pdf') ? <span className="text-lg">📄</span> : <img src={path} className="w-full h-full object-cover" />}
                                                                            <a href={path} target="_blank" className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">Ver</a>
                                                                        </div>
                                                                    ))}
                                                                    {(!p.mitigacion?.adjuntos || JSON.parse(p.mitigacion.adjuntos).length === 0) && (
                                                                        <p className="text-xs text-slate-400 italic font-medium ml-1">Sin archivos adjuntos</p>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <MitigacionFileUploader 
                                                                    initialFiles={p.mitigacion?.adjuntos ? JSON.parse(p.mitigacion.adjuntos) : []}
                                                                    onUpload={(paths) => handleSave(selectedEvaluacion.id, p.id, p.mitigacion?.fechaSolucion ? format(new Date(p.mitigacion.fechaSolucion), 'yyyy-MM-dd') : '', paths)}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            {problemList.length === 0 && (
                                <div className="bg-emerald-50 border border-emerald-100 p-12 rounded-3xl text-center">
                                    <div className="text-5xl mb-4">✅</div>
                                    <h3 className="text-emerald-800 font-black text-xl">¡Sin Hallazgos Pendientes!</h3>
                                    <p className="text-emerald-600 mt-2 font-medium">Esta evaluación cumple con todos los puntos críticos del semestre.</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white p-20 rounded-[40px] shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                        <div className="w-24 h-24 bg-slate-50 rounded-[35px] flex items-center justify-center text-4xl mb-6 border border-slate-100 animate-pulse">
                            🔍
                        </div>
                        <h3 className="text-2xl font-black text-slate-900">Seleccione una Evaluación</h3>
                        <p className="text-slate-500 mt-3 max-w-sm text-lg font-medium">Elija un colegio del listado izquierdo para auditar sus hallazgos de mitigación.</p>
                    </div>
                )}
            </div>
        </div>
            
            {/* Modal para ver imagen */}
            {selectedImage && (
                <div 
                    className="fixed inset-0 z-[100] bg-slate-900/90 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
                        <button 
                            className="absolute -top-12 right-0 w-10 h-10 bg-white/10 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-2xl font-bold transition-colors"
                            onClick={() => setSelectedImage(null)}
                        >
                            &times;
                        </button>
                        <img 
                            src={selectedImage} 
                            alt="Evidencia Ampliada" 
                            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl ring-1 ring-white/10"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </>
    )
}
