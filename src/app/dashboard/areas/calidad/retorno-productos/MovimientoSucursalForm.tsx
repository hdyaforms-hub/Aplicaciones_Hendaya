'use client'

import { useState, useEffect } from 'react'
import { registrarMovimiento, cerrarAlertaDefinitiva } from './actions'
import { useRouter } from 'next/navigation'

export default function MovimientoSucursalForm({ alerta, onClose, user }: { alerta: any, onClose: () => void, user: any }) {
    const [loading, setLoading] = useState(false)
    const [files, setFiles] = useState<File[]>([])
    const [conclusion, setConclusion] = useState('')
    const [isClosingModal, setIsClosingModal] = useState(false)
    const router = useRouter()
    
    // Time remaining state
    const [timeLeft, setTimeLeft] = useState('')

    useEffect(() => {
        const updateTimer = () => {
            const end = new Date(alerta.fechaCreacion).getTime() + (alerta.horas * 60 * 60 * 1000)
            const now = new Date().getTime()
            const dist = end - now
            
            if (dist < 0) {
                setTimeLeft('Tiempo Expirado')
            } else {
                const h = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
                const m = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60))
                setTimeLeft(`${h}h ${m}m restantes`)
            }
        }
        updateTimer()
        const interval = setInterval(updateTimer, 60000)
        return () => clearInterval(interval)
    }, [alerta])

    const userAreas = user.areas || []
    const isCalidad = userAreas.some((a: any) => a.nombre.toUpperCase() === 'CALIDAD')
    const userSucursalesNames = (user.sucursales || []).map((s: any) => s.nombre)
    
    // Filtro de estados por sucursal del usuario (solo sus sucursales asignadas)
    const misEstados = alerta.sucursalesEstado.filter((se: any) => 
        userSucursalesNames.includes(se.sucursal.nombre)
    )
    
    const [selectedSucursalId, setSelectedSucursalId] = useState<string>(
        misEstados.find((se:any) => se.estado !== 'FINALIZADO')?.sucursalId || (misEstados.length > 0 ? misEstados[0].sucursalId : '')
    )

    const canSubmit = misEstados.length > 0 && alerta.estado === 'ABIERTA'
    const isFinalizado = selectedSucursalId ? misEstados.find((se: any) => se.sucursalId === selectedSucursalId)?.estado === 'FINALIZADO' : false

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!selectedSucursalId) return
        setLoading(true)
        try {
            const formData = new FormData(e.currentTarget)
            files.forEach((file, index) => {
                if (index < 5) formData.append(`archivo_${index}`, file)
            })

            const res = await registrarMovimiento(formData, alerta.id, selectedSucursalId, user.username || user.name || 'Usuario')
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

    const handleCerrarAlerta = async () => {
        if (!conclusion.trim()) return alert('Debe ingresar una conclusión final')
        setLoading(true)
        try {
            const res = await cerrarAlertaDefinitiva(alerta.id, conclusion, user.username || user.name || 'Usuario')
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
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col md:flex-row">
                
                {/* Lateral Izquierdo: Info Alerta e Historial */}
                <div className="w-full md:w-1/2 bg-amber-50 p-6 overflow-y-auto border-r border-amber-200/50">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className={`text-xs font-bold px-2 py-1 rounded inline-block mb-2 ${alerta.estado === 'CERRADA' ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'}`}>
                                {alerta.estado}
                            </span>
                            <h2 className="text-xl font-bold text-amber-900 leading-tight">{alerta.titulo}</h2>
                        </div>
                    </div>
                    
                    <p className="text-sm text-gray-700 bg-white/60 p-4 rounded-xl border border-amber-200 whitespace-pre-wrap">
                        {alerta.observacion}
                    </p>

                    {alerta.estado === 'CERRADA' && alerta.conclusionFinal && (
                        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <h4 className="text-emerald-800 font-bold text-sm mb-1 uppercase tracking-wider flex items-center gap-2">
                                <span>🏆</span> Conclusión Final de Cierre
                            </h4>
                            <p className="text-sm text-emerald-900 italic">"{alerta.conclusionFinal}"</p>
                            <div className="text-[10px] text-emerald-600 mt-2 text-right">
                                Por: {alerta.usuarioCierre} | {new Date(alerta.fechaCierre!).toLocaleDateString()}
                            </div>
                        </div>
                    )}

                    <div className="mt-6">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <span>🕒</span> Historial de Movimientos
                        </h3>
                        <div className="space-y-4">
                            {alerta.movimientos.map((mov: any) => {
                                const sucEstado = alerta.sucursalesEstado.find((se: any) => se.sucursalId === mov.sucursalId)
                                const isFinalizadoSuc = sucEstado?.estado === 'FINALIZADO'
                                const archivos = mov.archivos ? JSON.parse(mov.archivos) : []

                                return (
                                    <div key={mov.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative group/card">
                                        <div className="absolute top-4 right-4 text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">
                                            {new Date(mov.fechaRegistro).toLocaleDateString()} {new Date(mov.fechaRegistro).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="text-sm font-bold text-sky-700">{mov.sucursal.nombre}</div>
                                            {isFinalizadoSuc && (
                                                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold border border-green-200 shadow-sm">
                                                    FINALIZADO ✓
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray-600 text-sm whitespace-pre-wrap">{mov.comentario}</p>
                                        
                                        {archivos.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {archivos.map((path: string, idx: number) => {
                                                    const isImg = path.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                                                    return (
                                                        <a 
                                                            key={idx} 
                                                            href={path} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-sky-50 text-sky-700 rounded-lg border border-gray-100 hover:border-sky-200 transition-all text-[11px] font-bold shadow-sm"
                                                        >
                                                            {isImg ? '🖼️' : '📄'} Ver Adjunto {archivos.length > 1 ? idx + 1 : ''}
                                                        </a>
                                                    )
                                                })}
                                            </div>
                                        )}
                                        
                                        <div className="text-[10px] text-gray-400 mt-3 flex justify-between items-center">
                                            <span>Por: {mov.usuarioRegistro}</span>
                                        </div>
                                    </div>
                                )
                            })}
                            {alerta.movimientos.length === 0 && (
                                <div className="text-sm text-gray-500 italic">No hay movimientos registrados.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Lateral Derecho: Formulario de Ingreso */}
                <div className="w-full md:w-1/2 p-6 flex flex-col relative overflow-y-auto">
                    <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors font-bold">✕</button>
                    
                    <div className="mb-6 flex justify-between items-end pr-8">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Registrar Novedad</h3>
                            <p className="text-sm text-gray-500">Agrega un movimiento para tu sucursal</p>
                        </div>
                        {alerta.estado === 'ABIERTA' && (
                            <div className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2">
                                <span>⏳</span> {timeLeft}
                            </div>
                        )}
                    </div>

                    {!canSubmit ? (
                        <div className="flex-1 flex items-center justify-center text-center p-6 bg-gray-50 rounded-2xl border border-gray-100 mb-6">
                            <div>
                                <span className="text-4xl block mb-2">👁️</span>
                                <p className="text-gray-600 font-medium">Modo solo lectura</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {alerta.estado === 'CERRADA' ? 'La alerta ya fue finalizada.' : 'No tienes asignada una sucursal para responder o no estás involucrado en esta alerta.'}
                                </p>
                            </div>
                        </div>
                    ) : isFinalizado ? (
                        <div className="flex-1 flex items-center justify-center text-center p-6 bg-green-50 rounded-2xl border border-green-200 mb-6">
                            <div>
                                <span className="text-4xl block mb-2">✅</span>
                                <p className="text-green-700 font-bold">Gestión Finalizada</p>
                                <p className="text-sm text-green-600 mt-1">Esta sucursal ya marcó su tarea como finalizada.</p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex-1 flex flex-col mb-6">
                            {misEstados.length > 1 && (
                                <div className="mb-4">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Sucursal a reportar</label>
                                    <select 
                                        value={selectedSucursalId}
                                        onChange={(e) => setSelectedSucursalId(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none"
                                    >
                                        {misEstados.map((se: any) => (
                                            <option key={se.sucursalId} value={se.sucursalId}>
                                                {se.sucursal.nombre} {se.estado === 'FINALIZADO' ? '(Finalizado)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Comentario <span className="text-red-500">*</span></label>
                                <textarea 
                                    name="comentario" 
                                    required 
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all outline-none resize-none"
                                    placeholder="Ej. Estamos buscando en bodega..."
                                />
                            </div>

                            <div className="bg-sky-50/50 p-4 rounded-xl border border-dashed border-sky-200 mb-6">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Adjuntar Archivos (Opcional)</label>
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
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-100 file:text-sky-700 hover:file:bg-sky-200 transition-all cursor-pointer"
                                />
                                {files.length > 0 && (
                                    <ul className="mt-2 space-y-1">
                                        {files.map((f, i) => (
                                            <li key={i} className="text-xs text-sky-700">📄 {f.name}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="mt-auto pt-4 border-t border-gray-100">
                                <label className="flex items-center gap-3 mb-4 cursor-pointer">
                                    <input type="checkbox" name="finalizar" value="true" className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500" />
                                    <span className="text-sm font-bold text-gray-700 select-none">Tarea finalizada (No se requerirán más acciones)</span>
                                </label>

                                <button 
                                    type="submit" 
                                    disabled={loading}
                                    className="w-full py-3.5 rounded-xl bg-gray-900 hover:bg-black text-white font-bold shadow-md transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Guardando...' : 'Guardar Novedad'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Sección de Cierre para Perfil Calidad */}
                    {alerta.estado === 'ABIERTA' && isCalidad && (
                        <div className="mt-auto pt-6 border-t-2 border-dashed border-gray-100">
                            {(() => {
                                const validSucursales = alerta.sucursalesEstado.filter((s:any) => s.sucursal?.nombre !== 'CASA MATRIZ')
                                const todasFinalizadas = validSucursales.length > 0 && validSucursales.every((s: any) => s.estado === 'FINALIZADO')
                                
                                if (!todasFinalizadas) {
                                    return (
                                        <div>
                                            <button 
                                                disabled={true}
                                                className="w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 bg-gray-200 text-gray-500 cursor-not-allowed"
                                                title="Debe esperar a que todas las bodegas finalicen."
                                            >
                                                <span>🏁</span> Realizar Cierre Final del Caso
                                            </button>
                                            <p className="text-center text-xs text-gray-500 mt-2 font-medium">
                                                * El cierre se habilitará cuando todas las bodegas finalicen sus registros.
                                            </p>
                                        </div>
                                    )
                                }

                                return !isClosingModal ? (
                                    <button 
                                        onClick={() => setIsClosingModal(true)}
                                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span>🏁</span> Realizar Cierre Final del Caso
                                    </button>
                                ) : (
                                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-4 animate-in slide-in-from-bottom-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-bold text-emerald-900">Finalizar Alerta de Calidad</h4>
                                        <button onClick={() => setIsClosingModal(false)} className="text-emerald-700 hover:text-emerald-900 font-bold text-xs uppercase">Cancelar</button>
                                    </div>
                                    <textarea 
                                        className="w-full px-4 py-3 rounded-xl border border-emerald-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm min-h-[100px]"
                                        placeholder="Escribe aquí la conclusión final del retiro y cierre del caso..."
                                        value={conclusion}
                                        onChange={(e) => setConclusion(e.target.value)}
                                        required
                                    />
                                    <button 
                                        onClick={handleCerrarAlerta}
                                        disabled={loading}
                                        className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-md transition-all disabled:opacity-50"
                                    >
                                        {loading ? 'Cerrando...' : 'Confirmar Cierre y Enviar Conclusión'}
                                    </button>
                                </div>
                                )
                            })()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
