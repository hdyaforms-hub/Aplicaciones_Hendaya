'use client'

import { useState, useEffect } from 'react'
import { registrarMovimiento, cerrarAlertaDefinitiva, cambiarEstadoBloqueoAlerta, getColegiosParaRetorno } from './actions'
import { useRouter } from 'next/navigation'

export default function MovimientoSucursalForm({ alerta, onClose, user }: { alerta: any, onClose: () => void, user: any }) {
    const [loading, setLoading] = useState(false)
    const [changingState, setChangingState] = useState(false)
    const [showHistorialEstados, setShowHistorialEstados] = useState(false)
    const [activeImageZoom, setActiveImageZoom] = useState<string | null>(null)
    const [files, setFiles] = useState<File[]>([])
    const [conclusion, setConclusion] = useState('')
    const [isClosingModal, setIsClosingModal] = useState(false)
    const router = useRouter()

    // Estado tipo de destino: Bodega vs Establecimiento
    const [tipoDestino, setTipoDestino] = useState<'BODEGA' | 'ESTABLECIMIENTO'>('BODEGA')
    const [selectedRbd, setSelectedRbd] = useState<number | null>(null)
    const [selectedEstablecimientoNombre, setSelectedEstablecimientoNombre] = useState<string>('')
    const [busquedaColegio, setBusquedaColegio] = useState<string>('')
    const [isColegioDropdownOpen, setIsColegioDropdownOpen] = useState<boolean>(false)
    const [cantidadRbd, setCantidadRbd] = useState<string>('')
    const [colegiosList, setColegiosList] = useState<any[]>([])
    
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

    // Cargar colegios para autocompletado inteligente
    useEffect(() => {
        let isMounted = true
        async function loadColegios() {
            try {
                const data = await getColegiosParaRetorno()
                if (isMounted) setColegiosList(data)
            } catch (err) {
                console.error('Error cargando colegios:', err)
            }
        }
        loadColegios()
        return () => { isMounted = false }
    }, [])

    const userAreas = user.areas || []
    const isCalidad = userAreas.some((a: any) => a.nombre.toUpperCase() === 'CALIDAD')
    const isAdmin = user.role?.name === 'Administrador'
    const canChangeBloqueo = (isCalidad || isAdmin) && alerta.estado === 'ABIERTA'

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

    // Parse de archivos adjuntos en la alerta de origen
    let alertaArchivos: string[] = []
    try {
        if (alerta.archivos) alertaArchivos = JSON.parse(alerta.archivos)
    } catch {
        alertaArchivos = []
    }
    const alertaImagenes = alertaArchivos.filter((p: string) => p.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i))
    const alertaOtrosArchivos = alertaArchivos.filter((p: string) => !p.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i))

    // Parse de historial de estados de bloqueo
    let historialEstados: any[] = []
    try {
        if (alerta.historialEstado) historialEstados = JSON.parse(alerta.historialEstado)
    } catch {
        historialEstados = []
    }

    // Filtrar colegios por texto de búsqueda
    const colegiosFiltrados = colegiosList.filter(c => {
        if (!busquedaColegio.trim()) return true
        const term = busquedaColegio.toLowerCase()
        return (
            c.rbd.toString().includes(term) ||
            c.establecimiento.toLowerCase().includes(term) ||
            (c.comuna && c.comuna.toLowerCase().includes(term))
        )
    }).slice(0, 20)

    // Calcular resumen consolidado por sucursal
    const validSucursales = alerta.sucursalesEstado.filter((s: any) => s.sucursal?.nombre !== 'CASA MATRIZ')
    const sucursalesResumen = validSucursales.map((se: any) => {
        const movs = alerta.movimientos.filter((m: any) => m.sucursalId === se.sucursalId)
        const rec = movs.reduce((acc: number, m: any) => acc + (Number(m.cantidadRecepcionada) || 0), 0)
        const stk = movs.reduce((acc: number, m: any) => acc + (Number(m.stockBodega) || 0), 0)
        const desp = movs.reduce((acc: number, m: any) => acc + (Number(m.cantidadDespachada) || 0), 0)
        const mer = movs.reduce((acc: number, m: any) => acc + (Number(m.cantidadMermada) || 0), 0)
        const rbdTotal = movs.reduce((acc: number, m: any) => acc + (Number(m.cantidadRbd) || 0), 0)

        return {
            sucursalNombre: se.sucursal.nombre,
            estado: se.estado,
            rec,
            stk,
            desp,
            mer,
            rbdTotal,
            movsCount: movs.length
        }
    })

    const totalGeneral = sucursalesResumen.reduce((acc: any, item: any) => ({
        rec: acc.rec + item.rec,
        stk: acc.stk + item.stk,
        desp: acc.desp + item.desp,
        mer: acc.mer + item.mer,
        rbdTotal: acc.rbdTotal + item.rbdTotal
    }), { rec: 0, stk: 0, desp: 0, mer: 0, rbdTotal: 0 })

    const handleCambiarBloqueo = async () => {
        const nuevoTipo = alerta.tipoBloqueo === 'Permanente' ? 'Preventivo' : 'Permanente'
        const confirmar = confirm(`¿Deseas cambiar el estado de bloqueo a "${nuevoTipo}"?`)
        if (!confirmar) return

        setChangingState(true)
        try {
            const res = await cambiarEstadoBloqueoAlerta(
                alerta.id, 
                nuevoTipo, 
                user.username || user.name || 'Usuario', 
                `Transición manual de ${alerta.tipoBloqueo || 'Preventivo'} a ${nuevoTipo}`
            )
            if (res.error) {
                alert('Error: ' + res.error)
            } else {
                router.refresh()
                onClose()
            }
        } catch (error) {
            console.error(error)
            alert('Error al cambiar estado')
        } finally {
            setChangingState(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!selectedSucursalId) return

        if (tipoDestino === 'ESTABLECIMIENTO') {
            if (!selectedRbd) {
                alert('Debe seleccionar un Establecimiento / RBD válido del listado.')
                return
            }
            if (!cantidadRbd || parseFloat(cantidadRbd) <= 0) {
                alert('Debe ingresar una cantidad mayor a cero para el establecimiento.')
                return
            }
        }

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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[94vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col md:flex-row">
                
                {/* Lateral Izquierdo: Info Alerta, Imagen Adjunta, Resumen por Sucursal e Historial */}
                <div className="w-full md:w-1/2 bg-amber-50/70 p-5 sm:p-6 overflow-y-auto border-r border-amber-200/50 space-y-4">
                    
                    {/* Header y Badges de Estado */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded shadow-sm ${alerta.estado === 'CERRADA' ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-900'}`}>
                                {alerta.estado}
                            </span>
                            <span className={`text-xs font-extrabold px-2 py-0.5 rounded shadow-sm text-white ${
                                alerta.tipoBloqueo === 'Permanente' ? 'bg-red-600' : 'bg-amber-600'
                            }`}>
                                {alerta.tipoBloqueo === 'Permanente' ? '🔴 Permanente' : '🟡 Preventivo'}
                            </span>
                            {alerta.alcance && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                    {alerta.alcance}
                                </span>
                            )}
                        </div>

                        {canChangeBloqueo && (
                            <button
                                type="button"
                                disabled={changingState}
                                onClick={handleCambiarBloqueo}
                                className="text-xs font-bold px-3 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 transition-all shadow-sm"
                                title="Cambiar entre Preventivo y Permanente"
                            >
                                {changingState ? 'Cambiando...' : `Pasar a ${alerta.tipoBloqueo === 'Permanente' ? 'Preventivo' : 'Permanente'}`}
                            </button>
                        )}
                    </div>

                    <div>
                        <h2 className="text-xl font-black text-amber-950 leading-tight">{alerta.titulo}</h2>
                        <div className="text-xs text-amber-800/80 mt-1">
                            Creado por <strong>{alerta.usuarioCreacion}</strong> el {new Date(alerta.fechaCreacion).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                    </div>

                    {/* Ficha Técnica del Producto */}
                    <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-sm text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-900 text-sm">
                                📦 {alerta.nombreProducto || 'Sin nombre especificado'}
                            </span>
                            {alerta.marcaProducto && (
                                <span className="text-gray-600 font-medium bg-gray-100 px-2 py-0.5 rounded">
                                    Marca: {alerta.marcaProducto}
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-gray-100 text-gray-700">
                            <div>
                                <span className="text-gray-400 block text-[10px] uppercase font-bold">Lote</span>
                                <span className="font-mono font-bold text-gray-900">{alerta.lote || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="text-gray-400 block text-[10px] uppercase font-bold">Fecha Elab.</span>
                                <span className="font-semibold text-gray-900">{alerta.fechaElaboracion || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="text-gray-400 block text-[10px] uppercase font-bold">Fecha Venc.</span>
                                <span className="font-semibold text-red-700">{alerta.fechaVencimiento || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Botón / Toggle Historial de Estados */}
                    {historialEstados.length > 0 && (
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowHistorialEstados(!showHistorialEstados)}
                                className="text-xs font-bold text-amber-900 hover:text-amber-950 flex items-center gap-1.5"
                            >
                                <span>📜</span> {showHistorialEstados ? 'Ocultar historial de estados' : `Ver historial de estados (${historialEstados.length})`}
                            </button>
                            {showHistorialEstados && (
                                <div className="mt-2 p-3 bg-white/80 rounded-xl border border-amber-200 space-y-2 text-xs">
                                    {historialEstados.map((h: any, idx: number) => (
                                        <div key={idx} className="border-b border-amber-100 last:border-0 pb-1.5 last:pb-0">
                                            <div className="flex justify-between items-center font-bold">
                                                <span className={h.estado === 'Permanente' ? 'text-red-700' : 'text-amber-800'}>
                                                    ● {h.estado}
                                                </span>
                                                <span className="text-gray-400 text-[10px]">
                                                    {new Date(h.fecha).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                </span>
                                            </div>
                                            <div className="text-gray-600 text-[11px] flex justify-between">
                                                <span>{h.motivo || 'Cambio registrado'}</span>
                                                <span className="italic text-gray-400">Por: {h.usuario}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Observación de la Alerta */}
                    <div className="bg-white/80 p-3.5 rounded-xl border border-amber-200">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-amber-800 block mb-1">
                            Observación Inicial
                        </span>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {alerta.observacion}
                        </p>
                    </div>

                    {/* IMAGEN ADJUNTA DE LA ALERTA (Rectángulo Rojo - Imagen 1) */}
                    {alertaImagenes.length > 0 && (
                        <div className="bg-white p-3 rounded-xl border-2 border-red-300 shadow-sm">
                            <span className="text-xs font-bold text-red-900 flex items-center gap-1.5 mb-2">
                                <span>🖼️</span> Imagen Adjunta de la Alerta (Clic para ampliar)
                            </span>
                            <div className="flex flex-wrap gap-3">
                                {alertaImagenes.map((imgPath: string, idx: number) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => setActiveImageZoom(imgPath)}
                                        className="relative group cursor-pointer overflow-hidden rounded-lg border border-gray-200 hover:border-red-500 shadow-sm hover:shadow-md transition-all w-28 h-28 bg-gray-100 flex items-center justify-center"
                                    >
                                        <img 
                                            src={imgPath} 
                                            alt="Adjunto alerta" 
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" 
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                                            🔍 Ampliar
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {alertaOtrosArchivos.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {alertaOtrosArchivos.map((filePath: string, idx: number) => (
                                <a 
                                    key={idx}
                                    href={filePath}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-bold text-amber-900 bg-white px-3 py-1.5 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1.5"
                                >
                                    📄 Ver Documento {idx + 1}
                                </a>
                            ))}
                        </div>
                    )}

                    {/* RESUMEN POR SUCURSAL CON SUMATORIA DE CANTIDADES Y COLUMNA RBD (Rectángulo Verde Imagen 2) */}
                    <div className="bg-white p-3.5 rounded-xl border-2 border-sky-300 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-xs font-bold text-sky-950 uppercase tracking-wider flex items-center gap-1.5">
                                <span>📊</span> Resumen Consolidado por Sucursal
                            </h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead>
                                    <tr className="border-b border-sky-100 text-[10px] text-gray-500 uppercase bg-sky-50/50">
                                        <th className="py-1.5 px-2 font-bold">Sucursal</th>
                                        <th className="py-1.5 px-1 text-right font-bold">Recep.</th>
                                        <th className="py-1.5 px-1 text-right font-bold">Bodega</th>
                                        <th className="py-1.5 px-1 text-right font-bold">Desp.</th>
                                        <th className="py-1.5 px-1 text-right font-bold">Merma</th>
                                        {/* Columna RBD en recuadro verde solicitado */}
                                        <th className="py-1.5 px-1.5 text-right font-black text-emerald-800 bg-emerald-50/70 border-x border-emerald-200">
                                            RBD
                                        </th>
                                        <th className="py-1.5 px-2 text-center font-bold">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sucursalesResumen.map((s: any, idx: number) => (
                                        <tr key={idx} className="border-b border-gray-100 hover:bg-sky-50/30">
                                            <td className="py-1.5 px-2 font-semibold text-gray-800">
                                                {s.sucursalNombre}
                                            </td>
                                            <td className="py-1.5 px-1 text-right font-mono text-gray-700">
                                                {s.rec.toLocaleString()}
                                            </td>
                                            <td className="py-1.5 px-1 text-right font-mono font-bold text-sky-900">
                                                {s.stk.toLocaleString()}
                                            </td>
                                            <td className="py-1.5 px-1 text-right font-mono text-gray-700">
                                                {s.desp.toLocaleString()}
                                            </td>
                                            <td className="py-1.5 px-1 text-right font-mono text-red-600">
                                                {s.mer.toLocaleString()}
                                            </td>
                                            {/* Valor sumatoria RBD */}
                                            <td className="py-1.5 px-1.5 text-right font-mono font-black text-emerald-800 bg-emerald-50/40 border-x border-emerald-100">
                                                {s.rbdTotal.toLocaleString()}
                                            </td>
                                            <td className="py-1.5 px-2 text-center">
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                                    s.estado === 'FINALIZADO'
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {s.estado === 'FINALIZADO' ? 'FINALIZADO' : 'PENDIENTE'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-sky-100/70 font-bold text-sky-950 border-t border-sky-300">
                                        <td className="py-1.5 px-2">TOTAL</td>
                                        <td className="py-1.5 px-1 text-right font-mono">{totalGeneral.rec.toLocaleString()}</td>
                                        <td className="py-1.5 px-1 text-right font-mono">{totalGeneral.stk.toLocaleString()}</td>
                                        <td className="py-1.5 px-1 text-right font-mono">{totalGeneral.desp.toLocaleString()}</td>
                                        <td className="py-1.5 px-1 text-right font-mono text-red-700">{totalGeneral.mer.toLocaleString()}</td>
                                        {/* Total general columna RBD */}
                                        <td className="py-1.5 px-1.5 text-right font-mono font-black text-emerald-900 bg-emerald-100 border-x border-emerald-300">
                                            {totalGeneral.rbdTotal.toLocaleString()}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {alerta.estado === 'CERRADA' && alerta.conclusionFinal && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <h4 className="text-emerald-800 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                                <span>🏆</span> Conclusión Final de Cierre
                            </h4>
                            <p className="text-xs text-emerald-900 italic mt-1">"{alerta.conclusionFinal}"</p>
                            <div className="text-[10px] text-emerald-600 mt-2 text-right">
                                Por: {alerta.usuarioCierre} | {new Date(alerta.fechaCierre!).toLocaleDateString()}
                            </div>
                        </div>
                    )}

                    {/* Historial de Movimientos */}
                    <div>
                        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 text-sm">
                            <span>🕒</span> Historial de Movimientos
                        </h3>
                        <div className="space-y-3">
                            {alerta.movimientos.map((mov: any) => {
                                const sucEstado = alerta.sucursalesEstado.find((se: any) => se.sucursalId === mov.sucursalId)
                                const isFinalizadoSuc = sucEstado?.estado === 'FINALIZADO'
                                const archivos = mov.archivos ? JSON.parse(mov.archivos) : []
                                const isEstablecimiento = mov.tipoDestino === 'ESTABLECIMIENTO' || mov.rbd

                                return (
                                    <div key={mov.id} className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100 relative group/card text-xs">
                                        <div className="absolute top-3 right-3 text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                                            {new Date(mov.fechaRegistro).toLocaleDateString()} {new Date(mov.fechaRegistro).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="text-sm font-bold text-sky-700">{mov.sucursal.nombre}</div>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                                isEstablecimiento ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'
                                            }`}>
                                                {isEstablecimiento ? '🏫 Establecimiento' : '🏢 Bodega'}
                                            </span>
                                            {isFinalizadoSuc && (
                                                <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold border border-green-200 shadow-sm">
                                                    FINALIZADO ✓
                                                </span>
                                            )}
                                        </div>

                                        {/* Datos de Establecimiento si corresponde */}
                                        {isEstablecimiento ? (
                                            <div className="bg-indigo-50/70 p-2.5 rounded-lg border border-indigo-100 mb-2 text-[11px] flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <strong className="text-indigo-950 font-bold block">
                                                        RBD {mov.rbd}: {mov.establecimiento || 'Establecimiento'}
                                                    </strong>
                                                </div>
                                                <div className="bg-white px-2.5 py-1 rounded-md border border-indigo-200 font-bold text-indigo-900 text-xs shadow-sm">
                                                    Cantidad: {mov.cantidadRbd ?? 0}
                                                </div>
                                            </div>
                                        ) : (
                                            /* Datos de Bodega si existen */
                                            (mov.numeroDocumento || mov.codigoProducto || mov.loteInterno || mov.ubicacion || mov.cantidadRecepcionada > 0 || mov.stockBodega > 0 || mov.cantidadDespachada > 0 || mov.cantidadMermada > 0) && (
                                                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-2 text-[11px]">
                                                    {mov.numeroDocumento && (
                                                        <div>
                                                            <span className="text-gray-400 block text-[9px] uppercase font-bold">N° Doc/Guía</span>
                                                            <span className="font-mono text-gray-800 font-semibold">{mov.numeroDocumento}</span>
                                                        </div>
                                                    )}
                                                    {mov.codigoProducto && (
                                                        <div>
                                                            <span className="text-gray-400 block text-[9px] uppercase font-bold">Cód. Producto</span>
                                                            <span className="font-mono text-gray-800">{mov.codigoProducto}</span>
                                                        </div>
                                                    )}
                                                    {mov.loteInterno && (
                                                        <div>
                                                            <span className="text-gray-400 block text-[9px] uppercase font-bold">Lote Interno</span>
                                                            <span className="font-mono text-gray-800">{mov.loteInterno}</span>
                                                        </div>
                                                    )}
                                                    {mov.ubicacion && (
                                                        <div>
                                                            <span className="text-gray-400 block text-[9px] uppercase font-bold">Ubicación</span>
                                                            <span className="text-gray-800">{mov.ubicacion}</span>
                                                        </div>
                                                    )}
                                                    <div className="col-span-2 grid grid-cols-4 gap-1 pt-1 border-t border-slate-200/60 font-semibold">
                                                        <div>
                                                            <span className="text-gray-400 block text-[9px] font-normal">Recep.</span>
                                                            <span>{mov.cantidadRecepcionada || 0}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400 block text-[9px] font-normal">Stock</span>
                                                            <span className="text-sky-700">{mov.stockBodega || 0}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400 block text-[9px] font-normal">Desp.</span>
                                                            <span>{mov.cantidadDespachada || 0}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400 block text-[9px] font-normal">Merma</span>
                                                            <span className="text-red-600">{mov.cantidadMermada || 0}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        )}

                                        <p className="text-gray-700 whitespace-pre-wrap">{mov.comentario}</p>
                                        
                                        {archivos.length > 0 && (
                                            <div className="mt-2.5 flex flex-wrap gap-2">
                                                {archivos.map((path: string, idx: number) => {
                                                    const isImg = path.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                                                    return (
                                                        <a 
                                                            key={idx} 
                                                            href={path} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 hover:bg-sky-50 text-sky-700 rounded-lg border border-gray-100 hover:border-sky-200 transition-all text-[10px] font-bold shadow-sm"
                                                        >
                                                            {isImg ? '🖼️' : '📄'} Adjunto {archivos.length > 1 ? idx + 1 : ''}
                                                        </a>
                                                    )
                                                })}
                                            </div>
                                        )}
                                        
                                        <div className="text-[10px] text-gray-400 mt-2 flex justify-between items-center">
                                            <span>Por: {mov.usuarioRegistro}</span>
                                        </div>
                                    </div>
                                )
                            })}
                            {alerta.movimientos.length === 0 && (
                                <div className="text-xs text-gray-500 italic">No hay movimientos registrados.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Lateral Derecho: Formulario "Registrar Novedad" con nuevos campos */}
                <div className="w-full md:w-1/2 p-5 sm:p-6 flex flex-col relative overflow-y-auto">
                    <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors font-bold z-10">✕</button>
                    
                    <div className="mb-4 flex justify-between items-end pr-8">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Registrar Novedad</h3>
                            <p className="text-xs text-gray-500">Agrega un movimiento para tu sucursal</p>
                        </div>
                        {alerta.estado === 'ABIERTA' && (
                            <div className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
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
                        <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-3.5 mb-4">
                            {/* Selector de Sucursal */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Sucursal a reportar</label>
                                <select 
                                    value={selectedSucursalId}
                                    onChange={(e) => setSelectedSucursalId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                                >
                                    {misEstados.map((se: any) => (
                                        <option key={se.sucursalId} value={se.sucursalId}>
                                            {se.sucursal.nombre} {se.estado === 'FINALIZADO' ? '(Finalizado)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* RECUADRO ROJO (IMAGEN 2): Radio buttons Bodega vs Establecimiento */}
                            <div className="bg-slate-100/80 p-3 rounded-2xl border-2 border-red-300">
                                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
                                    Destino del Registro <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-gray-800">
                                        <input 
                                            type="radio" 
                                            name="tipoDestino" 
                                            value="BODEGA" 
                                            checked={tipoDestino === 'BODEGA'} 
                                            onChange={() => setTipoDestino('BODEGA')}
                                            className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                                        />
                                        <span>🏢 Bodega</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-gray-800">
                                        <input 
                                            type="radio" 
                                            name="tipoDestino" 
                                            value="ESTABLECIMIENTO" 
                                            checked={tipoDestino === 'ESTABLECIMIENTO'} 
                                            onChange={() => setTipoDestino('ESTABLECIMIENTO')}
                                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span>🏫 Establecimiento</span>
                                    </label>
                                </div>
                            </div>

                            {/* RECUADRO AMARILLO (IMAGEN 2): DETALLE OPERATIVO DE BODEGA */}
                            {tipoDestino === 'BODEGA' ? (
                                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3 animate-in fade-in duration-200">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                                        Detalle Operativo del Producto en Bodega
                                    </span>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-700 mb-1">N° OC / Guía de Despacho</label>
                                            <input 
                                                name="numeroDocumento"
                                                maxLength={60}
                                                placeholder="Ej. OC-9842 / GD-1203"
                                                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-700 mb-1">Código del Producto</label>
                                            <input 
                                                name="codigoProducto"
                                                maxLength={60}
                                                placeholder="Ej. PROD-1029"
                                                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none text-xs"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-700 mb-1">Lote Interno</label>
                                            <input 
                                                name="loteInterno"
                                                maxLength={60}
                                                placeholder="Ej. LOTE-INT-01"
                                                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none text-xs uppercase"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-700 mb-1">Ubicación en Bodega</label>
                                            <input 
                                                name="ubicacion"
                                                maxLength={80}
                                                placeholder="Ej. Rack A-3 / Pasillo 2"
                                                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none text-xs"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200">
                                        <div>
                                            <label className="block text-[10px] font-semibold text-gray-600 mb-1">Cant. Recepcionada</label>
                                            <input 
                                                type="number"
                                                step="any"
                                                name="cantidadRecepcionada"
                                                placeholder="0"
                                                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none text-xs text-right"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-gray-600 mb-1">Stock en Bodega</label>
                                            <input 
                                                type="number"
                                                step="any"
                                                name="stockBodega"
                                                placeholder="0"
                                                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none text-xs text-right font-bold text-sky-900"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-gray-600 mb-1">Cant. Despachada</label>
                                            <input 
                                                type="number"
                                                step="any"
                                                name="cantidadDespachada"
                                                placeholder="0"
                                                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none text-xs text-right"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-gray-600 mb-1">Cant. Mermada</label>
                                            <input 
                                                type="number"
                                                step="any"
                                                name="cantidadMermada"
                                                placeholder="0"
                                                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none text-xs text-right text-red-600"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* VISTA CUANDO SE SELECCIONA ESTABLECIMIENTO: BUSCADOR RBD Y CANTIDAD */
                                <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200 space-y-3 animate-in fade-in duration-200">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900 block flex items-center gap-1.5">
                                        <span>🏫</span> Registro en Establecimiento / Colegio
                                    </span>

                                    <div className="relative">
                                        <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center justify-between">
                                            <span>Establecimiento (RBD o Nombre) <span className="text-red-500">*</span></span>
                                            {selectedRbd && (
                                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                                                    RBD {selectedRbd}
                                                </span>
                                            )}
                                        </label>
                                        <div className="relative">
                                            <input 
                                                type="text"
                                                value={busquedaColegio}
                                                onChange={e => {
                                                    const val = e.target.value
                                                    setBusquedaColegio(val)
                                                    setIsColegioDropdownOpen(true)
                                                    if (!val) {
                                                        setSelectedRbd(null)
                                                        setSelectedEstablecimientoNombre('')
                                                    }
                                                }}
                                                onFocus={() => setIsColegioDropdownOpen(true)}
                                                placeholder="Escribe RBD o nombre del establecimiento..."
                                                className="w-full pl-3 pr-8 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-gray-900 bg-white"
                                            />
                                            {(busquedaColegio || selectedRbd) && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedRbd(null)
                                                        setSelectedEstablecimientoNombre('')
                                                        setBusquedaColegio('')
                                                        setIsColegioDropdownOpen(false)
                                                    }}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold p-0.5"
                                                    title="Limpiar establecimiento"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                        <input type="hidden" name="rbd" value={selectedRbd || ''} />
                                        <input type="hidden" name="establecimiento" value={selectedEstablecimientoNombre || ''} />

                                        {isColegioDropdownOpen && colegiosFiltrados.length > 0 && (
                                            <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-100 text-xs">
                                                {colegiosFiltrados.map((c: any) => (
                                                    <div 
                                                        key={c.rbd}
                                                        onClick={() => {
                                                            setSelectedRbd(c.rbd)
                                                            setSelectedEstablecimientoNombre(c.establecimiento)
                                                            setBusquedaColegio(`RBD ${c.rbd} - ${c.establecimiento}`)
                                                            setIsColegioDropdownOpen(false)
                                                        }}
                                                        className="p-2 hover:bg-indigo-50 cursor-pointer text-gray-800 flex justify-between items-center"
                                                    >
                                                        <div className="truncate pr-2">
                                                            <span className="font-semibold">{c.establecimiento}</span>
                                                            {c.comuna && <span className="text-[10px] text-gray-400 ml-1.5">({c.comuna})</span>}
                                                        </div>
                                                        <strong className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap">
                                                            RBD {c.rbd}
                                                        </strong>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                                            Cantidad <span className="text-red-500">*</span>
                                        </label>
                                        <input 
                                            type="number"
                                            step="any"
                                            min="0"
                                            name="cantidadRbd"
                                            value={cantidadRbd}
                                            onChange={e => setCantidadRbd(e.target.value)}
                                            placeholder="Ingrese cantidad en el establecimiento..."
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-gray-900 bg-white"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Comentario */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Comentario <span className="text-red-500">*</span></label>
                                <textarea 
                                    name="comentario" 
                                    required 
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all outline-none resize-none text-xs"
                                    placeholder="Ej. Se verificó producto apartado y rotulado..."
                                />
                            </div>

                            {/* Adjuntar Archivos */}
                            <div className="bg-sky-50/50 p-3 rounded-xl border border-dashed border-sky-200">
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Adjuntar Archivos (Opcional)</label>
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
                                    className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-sky-100 file:text-sky-700 hover:file:bg-sky-200 transition-all cursor-pointer"
                                />
                                {files.length > 0 && (
                                    <ul className="mt-1.5 space-y-0.5">
                                        {files.map((f, i) => (
                                            <li key={i} className="text-[11px] text-sky-700">📄 {f.name}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="pt-2 border-t border-gray-100">
                                <label className="flex items-center gap-2.5 mb-3 cursor-pointer">
                                    <input type="checkbox" name="finalizar" value="true" className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500" />
                                    <span className="text-xs font-bold text-gray-700 select-none">Tarea finalizada (No se requerirán más acciones)</span>
                                </label>

                                <button 
                                    type="submit" 
                                    disabled={loading}
                                    className="w-full py-3 rounded-xl bg-gray-900 hover:bg-black text-white font-bold shadow-md transition-all disabled:opacity-50 text-sm"
                                >
                                    {loading ? 'Guardando...' : 'Guardar Novedad'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Sección de Cierre para Perfil Calidad */}
                    {alerta.estado === 'ABIERTA' && isCalidad && (
                        <div className="mt-auto pt-4 border-t-2 border-dashed border-gray-100">
                            {(() => {
                                const validSucursalesParaCierre = alerta.sucursalesEstado.filter((s:any) => s.sucursal?.nombre !== 'CASA MATRIZ')
                                const todasFinalizadas = validSucursalesParaCierre.length > 0 && validSucursalesParaCierre.every((s: any) => s.estado === 'FINALIZADO')
                                
                                if (!todasFinalizadas) {
                                    return (
                                        <div>
                                            <button 
                                                disabled={true}
                                                className="w-full py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 bg-gray-200 text-gray-500 cursor-not-allowed text-xs"
                                                title="Debe esperar a que todas las bodegas finalicen."
                                            >
                                                <span>🏁</span> Realizar Cierre Final del Caso
                                            </button>
                                            <p className="text-center text-[10px] text-gray-500 mt-1 font-medium">
                                                * El cierre se habilitará cuando todas las bodegas finalicen sus registros.
                                            </p>
                                        </div>
                                    )
                                }

                                return !isClosingModal ? (
                                    <button 
                                        onClick={() => setIsClosingModal(true)}
                                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 text-xs"
                                    >
                                        <span>🏁</span> Realizar Cierre Final del Caso
                                    </button>
                                ) : (
                                <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 space-y-3 animate-in slide-in-from-bottom-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-bold text-emerald-900 text-xs">Finalizar Alerta de Calidad</h4>
                                        <button onClick={() => setIsClosingModal(false)} className="text-emerald-700 hover:text-emerald-900 font-bold text-[10px] uppercase">Cancelar</button>
                                    </div>
                                    <textarea 
                                        className="w-full px-3 py-2 rounded-xl border border-emerald-200 focus:ring-2 focus:ring-emerald-500 outline-none text-xs min-h-[80px]"
                                        placeholder="Escribe aquí la conclusión final del retiro y cierre del caso..."
                                        value={conclusion}
                                        onChange={(e) => setConclusion(e.target.value)}
                                        required
                                    />
                                    <button 
                                        onClick={handleCerrarAlerta}
                                        disabled={loading}
                                        className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-md transition-all disabled:opacity-50 text-xs"
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

            {/* LIGHTBOX / ZOOM DE IMAGEN */}
            {activeImageZoom && (
                <div 
                    className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out"
                    onClick={() => setActiveImageZoom(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
                        <button 
                            className="absolute -top-10 right-0 text-white text-2xl font-bold bg-white/20 hover:bg-white/40 w-8 h-8 rounded-full flex items-center justify-center"
                            onClick={() => setActiveImageZoom(null)}
                        >
                            ✕
                        </button>
                        <img 
                            src={activeImageZoom} 
                            alt="Imagen ampliada" 
                            className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain border-2 border-white/20"
                        />
                        <div className="text-white/80 text-xs mt-2 bg-black/50 px-3 py-1 rounded-full">
                            Haz clic fuera de la imagen o en la X para cerrar
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
