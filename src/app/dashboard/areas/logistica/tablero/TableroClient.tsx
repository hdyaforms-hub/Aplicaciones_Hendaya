'use client'

import React, { useState, useEffect, useTransition } from 'react'
import {
    Truck,
    Warehouse,
    Calendar,
    Search,
    RefreshCw,
    Plus,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    LogOut,
    ArrowRightLeft,
    ChevronLeft,
    ChevronRight,
    MapPin,
    Package,
    Timer,
    Check,
    Send
} from 'lucide-react'
import { getAndenes } from '@/actions/logistica/andenes'
import {
    getRutas,
    getRutaDetalle,
    crearRuta,
    asignarAnden,
    reasignarAnden,
    marcarLlegadaPorton,
    completarDespacho,
    notificarChoferManual,
    importarRutasMasivas
} from '@/actions/logistica/rutas'

interface Props {
    initialBodegas: any[]
    initialAndenes: any[]
    initialRutas: any[]
    initialFecha: string
    catalogos: {
        choferes: any[]
        camiones: any[]
        clientes: any[]
        transportistas: any[]
    }
}

export default function TableroClient({
    initialBodegas,
    initialAndenes,
    initialRutas,
    initialFecha,
    catalogos
}: Props) {
    const [isPending, startTransition] = useTransition()
    const [bodegaId, setBodegaId] = useState(initialBodegas[0]?.id || '')
    const [fecha, setFecha] = useState(initialFecha)
    const [searchTerm, setSearchTerm] = useState('')

    const [andenes, setAndenes] = useState<any[]>(initialAndenes)
    const [rutas, setRutas] = useState<any[]>(initialRutas)

    const [autoRefresh, setAutoRefresh] = useState(true)
    const [refreshInterval] = useState(30)
    const [countdown, setCountdown] = useState(30)
    const [now, setNow] = useState(Date.now())

    // Modales
    const [modalNuevaRuta, setModalNuevaRuta] = useState(false)
    const [modalAsignar, setModalAsignar] = useState<any | null>(null)
    const [modalReasignar, setModalReasignar] = useState<any | null>(null)
    const [modalDespachar, setModalDespachar] = useState<any | null>(null)
    const [modalCargaMasiva, setModalCargaMasiva] = useState(false)
    const [modalTimeline, setModalTimeline] = useState<any | null>(null)

    const [actionLoading, setActionLoading] = useState(false)
    const [toast, setToast] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

    // Tick cada segundo para cronómetros y countdown
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now())
            if (autoRefresh) {
                setCountdown(prev => {
                    if (prev <= 1) {
                        refrescarDatosSilencioso()
                        return refreshInterval
                    }
                    return prev - 1
                })
            }
        }, 1000)
        return () => clearInterval(interval)
    }, [autoRefresh, refreshInterval, bodegaId, fecha])

    const refrescarDatosSilencioso = async () => {
        if (!bodegaId) return
        try {
            const [resAndenes, resRutas] = await Promise.all([
                getAndenes(bodegaId),
                getRutas({ bodegaId, fechaRuta: fecha })
            ])
            if (resAndenes.andenes) setAndenes(resAndenes.andenes)
            if (resRutas.rutas) setRutas(resRutas.rutas)
        } catch (err) {
            console.error('Error auto-refrescando tablero:', err)
        }
    }

    const refrescarDatosManual = () => {
        startTransition(async () => {
            await refrescarDatosSilencioso()
            setCountdown(refreshInterval)
            setToast({ tipo: 'ok', texto: 'Datos actualizados correctamente.' })
            setTimeout(() => setToast(null), 3000)
        })
    }

    const cambiarDia = (diasDelta: number) => {
        const current = new Date(fecha + 'T12:00:00')
        current.setDate(current.getDate() + diasDelta)
        const nuevaFecha = current.toISOString().slice(0, 10)
        setFecha(nuevaFecha)
        startTransition(async () => {
            const res = await getRutas({ bodegaId, fechaRuta: nuevaFecha })
            if (res.rutas) setRutas(res.rutas)
        })
    }

    const handleConfirmarAsignacion = async (andenId: string) => {
        if (!modalAsignar) return
        setActionLoading(true)
        try {
            const res = await asignarAnden(modalAsignar.id, andenId)
            if (res.success) {
                setToast({ tipo: 'ok', texto: `Ruta asignada al andén exitosamente.` })
                setModalAsignar(null)
                refrescarDatosSilencioso()
            } else {
                setToast({ tipo: 'error', texto: res.error || 'No se pudo asignar el andén.' })
            }
        } finally {
            setActionLoading(false)
        }
    }

    const handleConfirmarReasignacion = async (nuevoAndenId: string, motivo: string) => {
        if (!modalReasignar) return
        setActionLoading(true)
        try {
            const res = await reasignarAnden(modalReasignar.id, nuevoAndenId, motivo)
            if (res.success) {
                setToast({ tipo: 'ok', texto: 'Ruta reasignada exitosamente.' })
                setModalReasignar(null)
                refrescarDatosSilencioso()
            } else {
                setToast({ tipo: 'error', texto: res.error || 'Error reasignando andén.' })
            }
        } finally {
            setActionLoading(false)
        }
    }

    const handleConfirmarDespacho = async (selloSalida: string, observaciones: string) => {
        if (!modalDespachar) return
        setActionLoading(true)
        try {
            const res = await completarDespacho(modalDespachar.id, { selloSalida, observaciones })
            if (res.success) {
                setToast({ tipo: 'ok', texto: `Ruta despachada y andén liberado con éxito.` })
                setModalDespachar(null)
                refrescarDatosSilencioso()
            } else {
                setToast({ tipo: 'error', texto: res.error || 'Error completando despacho.' })
            }
        } finally {
            setActionLoading(false)
        }
    }

    const handleMarcarPorton = async (rutaId: string) => {
        const res = await marcarLlegadaPorton(rutaId)
        if (res.success) {
            setToast({ tipo: 'ok', texto: 'Camión registrado en Portón.' })
            refrescarDatosSilencioso()
        } else {
            setToast({ tipo: 'error', texto: res.error || 'Error al marcar portón.' })
        }
    }

    const handleNotificarTelegram = async (rutaId: string) => {
        const res = await notificarChoferManual(rutaId)
        if (res.success) {
            setToast({ tipo: 'ok', texto: 'Instrucción enviada al chofer por Telegram.' })
            refrescarDatosSilencioso()
        } else {
            setToast({ tipo: 'error', texto: res.error || 'Error al enviar notificación.' })
        }
    }

    const handleVerTimeline = async (ruta: any) => {
        const res = await getRutaDetalle(ruta.id)
        if (res.ruta) {
            setModalTimeline(res.ruta)
        } else {
            setModalTimeline(ruta)
        }
    }

    // Filtros
    const rutasFiltradas = rutas.filter(r => {
        if (!searchTerm.trim()) return true
        const term = searchTerm.toLowerCase()
        return (
            r.numeroRuta?.toLowerCase().includes(term) ||
            r.camion?.patente?.toLowerCase().includes(term) ||
            r.chofer?.nombre?.toLowerCase().includes(term) ||
            r.cliente?.razonSocial?.toLowerCase().includes(term)
        )
    })

    // Columnas del tablero
    const colProgramadas = rutasFiltradas.filter(r => r.estado === 'PROGRAMADA')
    const colNotificadas = rutasFiltradas.filter(r => r.estado === 'NOTIFICADA')
    const colPorton = rutasFiltradas.filter(r => r.estado === 'EN_PORTON')
    const colEnAnden = rutasFiltradas.filter(r => r.estado === 'EN_ANDEN' || r.estado === 'EN_PROCESO')
    const colDespachadas = rutasFiltradas.filter(r => r.estado === 'DESPACHADA')

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            {/* CABECERA ESTÁNDAR HENDAYA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-50 to-sky-50 rounded-bl-full -z-10 opacity-70" />
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-cyan-100 text-cyan-700 rounded-xl text-xl">🚛</span>
                        Tablero de Despacho en Vivo
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm font-medium">
                        Monitoreo en tiempo real de andenes de carga, turnos y flujo operacional de camiones.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setModalCargaMasiva(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition shadow-xs"
                    >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        Importar Excel
                    </button>
                    <button
                        type="button"
                        onClick={() => setModalNuevaRuta(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition"
                    >
                        <Plus className="w-4 h-4 text-cyan-400" />
                        Nueva Ruta
                    </button>
                </div>
            </div>

            {/* BARRA DE FILTROS Y CONTROLES OPERATIVOS */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Selector de Bodega */}
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                        <Warehouse className="w-4 h-4 text-gray-500" />
                        <span className="text-xs font-bold text-gray-600">Bodega:</span>
                        <select
                            value={bodegaId}
                            onChange={e => {
                                setBodegaId(e.target.value)
                                refrescarDatosSilencioso()
                            }}
                            className="bg-transparent text-xs font-bold text-gray-900 focus:outline-none cursor-pointer"
                        >
                            {initialBodegas.map(b => (
                                <option key={b.id} value={b.id}>
                                    {b.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Selector de Fecha */}
                    <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
                        <button
                            type="button"
                            onClick={() => cambiarDia(-1)}
                            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition"
                            title="Día anterior"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-mono font-bold px-2 text-gray-800 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-cyan-600" />
                            {fecha}
                        </span>
                        <button
                            type="button"
                            onClick={() => cambiarDia(1)}
                            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition"
                            title="Día siguiente"
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setFecha(initialFecha)
                                cambiarDia(0)
                            }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-cyan-100 text-cyan-700 hover:bg-cyan-200 transition"
                        >
                            Hoy
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Buscador */}
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar patente, chofer, ruta..."
                            className="pl-9 pr-3 py-1.5 text-xs font-medium rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all w-48 sm:w-60"
                        />
                    </div>

                    {/* Auto-refresco */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                        <button
                            type="button"
                            onClick={refrescarDatosManual}
                            disabled={isPending}
                            className="p-1 rounded-lg hover:bg-gray-200 text-cyan-700 transition"
                            title="Refrescar ahora"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
                        </button>
                        <span className="font-mono text-[11px] font-medium text-gray-500">
                            {autoRefresh ? `${countdown}s` : 'Pausa'}
                        </span>
                        <button
                            type="button"
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition ${
                                autoRefresh
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    : 'bg-gray-200 text-gray-600'
                            }`}
                        >
                            {autoRefresh ? 'LIVE' : 'OFF'}
                        </button>
                    </div>
                </div>
            </div>

            {/* TOAST FLOTANTE */}
            {toast && (
                <div
                    className={`p-4 rounded-xl text-xs flex items-center justify-between shadow-sm border transition ${
                        toast.tipo === 'ok'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {toast.tipo === 'ok' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                        <span className="font-bold">{toast.texto}</span>
                    </div>
                    <button onClick={() => setToast(null)} className="text-xs font-bold px-2 py-0.5 rounded hover:bg-white/50">
                        ✕
                    </button>
                </div>
            )}

            {/* SECCIÓN 1: DOCK GRID (CUADRÍCULA DE ANDENES EN VIVO) */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
                        <Warehouse className="w-4 h-4 text-cyan-600" />
                        Muelles y Andenes de Carga ({andenes.length})
                    </h2>
                    <div className="flex items-center gap-4 text-xs font-semibold text-gray-600">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
                            Disponible ({andenes.filter(a => a.estadoOperativo === 'DISPONIBLE').length})
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 ring-2 ring-sky-100" />
                            Ocupado ({andenes.filter(a => a.estadoOperativo === 'OCUPADO').length})
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-100" />
                            Bloqueado ({andenes.filter(a => a.estadoOperativo === 'BLOQUEADO' || a.estadoOperativo === 'MANTENCION').length})
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {andenes.map(anden => {
                        const isDisp = anden.estadoOperativo === 'DISPONIBLE'
                        const isOcup = anden.estadoOperativo === 'OCUPADO'
                        const ruta = anden.rutaActiva

                        let minutosEnAnden = 0
                        if (ruta?.horaEntradaAnden) {
                            const diffMs = now - new Date(ruta.horaEntradaAnden).getTime()
                            minutosEnAnden = Math.max(0, Math.floor(diffMs / 60000))
                        }
                        const alertaDemora = minutosEnAnden >= 45

                        return (
                            <div
                                key={anden.id}
                                className={`rounded-2xl p-4 border transition-all flex flex-col justify-between space-y-3 ${
                                    isDisp
                                        ? 'bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-300'
                                        : isOcup
                                        ? alertaDemora
                                            ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                                            : 'bg-sky-50/40 border-sky-200 hover:border-sky-300'
                                        : 'bg-gray-100 border-gray-200 opacity-80'
                                }`}
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-900 shadow-2xs">
                                            {anden.codigo}
                                        </span>
                                        <span
                                            className={`text-[10px] font-black tracking-wide px-2.5 py-0.5 rounded-full border ${
                                                isDisp
                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                    : isOcup
                                                    ? alertaDemora
                                                        ? 'bg-amber-200 text-amber-900 border-amber-300 animate-pulse'
                                                        : 'bg-sky-100 text-sky-800 border-sky-200'
                                                    : 'bg-gray-200 text-gray-700 border-gray-300'
                                            }`}
                                        >
                                            {isOcup ? (alertaDemora ? 'DEMORA' : 'CARGANDO') : anden.estadoOperativo}
                                        </span>
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-gray-900 text-sm">{anden.nombre}</h3>
                                        <p className="text-[11px] font-medium text-gray-500">{anden.tipoCarga}</p>
                                    </div>

                                    {/* DETALLES DE CAMIÓN OCUPANTE */}
                                    {isOcup && ruta && (
                                        <div className="p-3 rounded-xl bg-white border border-gray-200 space-y-1.5 text-xs shadow-2xs">
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono font-black text-sm text-cyan-700">
                                                    {ruta.camionPatente}
                                                </span>
                                                <span className="font-mono text-[10px] text-gray-500 font-bold">
                                                    {ruta.numeroRuta}
                                                </span>
                                            </div>
                                            <p className="text-gray-800 font-semibold truncate">
                                                {ruta.choferNombre}
                                            </p>
                                            <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1.5 border-t border-gray-100">
                                                <span className="flex items-center gap-1 font-medium">
                                                    <Package className="w-3.5 h-3.5 text-gray-400" />
                                                    {ruta.totalBultos || 0} bultos
                                                </span>
                                                <span
                                                    className={`flex items-center gap-1 font-mono font-bold ${
                                                        alertaDemora ? 'text-amber-600' : 'text-gray-700'
                                                    }`}
                                                >
                                                    <Timer className="w-3.5 h-3.5 text-gray-400" />
                                                    {minutosEnAnden} min
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* ACCIONES DE ANDÉN */}
                                <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between gap-2">
                                    {isDisp && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (colPorton.length > 0) {
                                                    setModalAsignar(colPorton[0])
                                                } else if (colProgramadas.length > 0) {
                                                    setModalAsignar(colProgramadas[0])
                                                } else {
                                                    setToast({ tipo: 'error', texto: 'No hay camiones en espera para asignar.' })
                                                }
                                            }}
                                            className="w-full py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-2xs flex items-center justify-center gap-1"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Asignar Camión
                                        </button>
                                    )}

                                    {isOcup && ruta && (
                                        <div className="w-full flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setModalDespachar(ruta)}
                                                className="flex-1 py-1.5 text-xs font-bold rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white transition flex items-center justify-center gap-1 shadow-2xs"
                                            >
                                                <LogOut className="w-3.5 h-3.5" />
                                                Despachar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setModalReasignar(ruta)}
                                                title="Reasignar a otro andén"
                                                className="p-1.5 text-xs rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition"
                                            >
                                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}

                                    {!isDisp && !isOcup && (
                                        <span className="text-[11px] text-gray-400 italic">Mantenimiento</span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* SECCIÓN 2: COLUMNAS DE FLUJO KANBAN */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
                        <Truck className="w-4 h-4 text-cyan-600" />
                        Flujo Operativo de Rutas ({rutasFiltradas.length})
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {/* COLUMNA 1: PROGRAMADAS */}
                    <div className="bg-gray-100/70 rounded-2xl p-3 border border-gray-200 flex flex-col space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                            <span className="text-xs font-bold text-gray-700">1. Programadas</span>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                                {colProgramadas.length}
                            </span>
                        </div>

                        <div className="space-y-2.5 overflow-y-auto max-h-[550px] pr-1">
                            {colProgramadas.map(r => (
                                <TarjetaRuta
                                    key={r.id}
                                    ruta={r}
                                    onVerTimeline={() => handleVerTimeline(r)}
                                    acciones={
                                        <div className="space-y-1.5 pt-2 border-t border-gray-100">
                                            <button
                                                type="button"
                                                onClick={() => handleNotificarTelegram(r.id)}
                                                className="w-full py-1 text-[11px] font-bold rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border border-cyan-200 flex items-center justify-center gap-1 transition"
                                            >
                                                <Send className="w-3 h-3" />
                                                Notificar Telegram
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleMarcarPorton(r.id)}
                                                className="w-full py-1 text-[11px] font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                                            >
                                                Llegó al Portón
                                            </button>
                                        </div>
                                    }
                                />
                            ))}
                            {colProgramadas.length === 0 && <EmptyCol text="Sin rutas programadas" />}
                        </div>
                    </div>

                    {/* COLUMNA 2: NOTIFICADAS */}
                    <div className="bg-sky-50/40 rounded-2xl p-3 border border-sky-200/80 flex flex-col space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-sky-200">
                            <span className="text-xs font-bold text-sky-800">2. En Camino (Notificadas)</span>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                                {colNotificadas.length}
                            </span>
                        </div>

                        <div className="space-y-2.5 overflow-y-auto max-h-[550px] pr-1">
                            {colNotificadas.map(r => (
                                <TarjetaRuta
                                    key={r.id}
                                    ruta={r}
                                    onVerTimeline={() => handleVerTimeline(r)}
                                    acciones={
                                        <div className="pt-2 border-t border-gray-100">
                                            <button
                                                type="button"
                                                onClick={() => handleMarcarPorton(r.id)}
                                                className="w-full py-1 text-[11px] font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center gap-1 shadow-2xs transition"
                                            >
                                                <Check className="w-3 h-3" />
                                                Llegó al Portón
                                            </button>
                                        </div>
                                    }
                                />
                            ))}
                            {colNotificadas.length === 0 && <EmptyCol text="Sin choferes notificados" />}
                        </div>
                    </div>

                    {/* COLUMNA 3: EN PORTÓN */}
                    <div className="bg-amber-50/40 rounded-2xl p-3 border border-amber-200/80 flex flex-col space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                            <span className="text-xs font-bold text-amber-900">3. En Portón (Espera)</span>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                                {colPorton.length}
                            </span>
                        </div>

                        <div className="space-y-2.5 overflow-y-auto max-h-[550px] pr-1">
                            {colPorton.map(r => (
                                <TarjetaRuta
                                    key={r.id}
                                    ruta={r}
                                    badgeCustom={
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                            En Recinto
                                        </span>
                                    }
                                    onVerTimeline={() => handleVerTimeline(r)}
                                    acciones={
                                        <div className="pt-2 border-t border-gray-100">
                                            <button
                                                type="button"
                                                onClick={() => setModalAsignar(r)}
                                                className="w-full py-1 text-[11px] font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-1 shadow-2xs transition"
                                            >
                                                <Warehouse className="w-3 h-3" />
                                                Asignar Andén
                                            </button>
                                        </div>
                                    }
                                />
                            ))}
                            {colPorton.length === 0 && <EmptyCol text="Sin camiones en portón" />}
                        </div>
                    </div>

                    {/* COLUMNA 4: EN ANDÉN */}
                    <div className="bg-emerald-50/40 rounded-2xl p-3 border border-emerald-200/80 flex flex-col space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                            <span className="text-xs font-bold text-emerald-900">4. En Andén / Carga</span>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                                {colEnAnden.length}
                            </span>
                        </div>

                        <div className="space-y-2.5 overflow-y-auto max-h-[550px] pr-1">
                            {colEnAnden.map(r => (
                                <TarjetaRuta
                                    key={r.id}
                                    ruta={r}
                                    badgeCustom={
                                        <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-200">
                                            {r.anden?.codigo || 'Andén'}
                                        </span>
                                    }
                                    onVerTimeline={() => handleVerTimeline(r)}
                                    acciones={
                                        <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
                                            <button
                                                type="button"
                                                onClick={() => setModalDespachar(r)}
                                                className="flex-1 py-1 text-[11px] font-bold rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white shadow-2xs transition"
                                            >
                                                Despachar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setModalReasignar(r)}
                                                className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition"
                                                title="Reasignar Andén"
                                            >
                                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    }
                                />
                            ))}
                            {colEnAnden.length === 0 && <EmptyCol text="Sin camiones cargando" />}
                        </div>
                    </div>

                    {/* COLUMNA 5: DESPACHADAS HOY */}
                    <div className="bg-gray-50 rounded-2xl p-3 border border-gray-200 flex flex-col space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                            <span className="text-xs font-bold text-gray-700">5. Despachadas Hoy</span>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                                {colDespachadas.length}
                            </span>
                        </div>

                        <div className="space-y-2.5 overflow-y-auto max-h-[550px] pr-1">
                            {colDespachadas.map(r => (
                                <TarjetaRuta
                                    key={r.id}
                                    ruta={r}
                                    badgeCustom={
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                                            Despachada
                                        </span>
                                    }
                                    onVerTimeline={() => handleVerTimeline(r)}
                                    acciones={
                                        r.selloSalida ? (
                                            <div className="text-[10px] text-gray-500 font-mono pt-1">
                                                Sello: {r.selloSalida}
                                            </div>
                                        ) : null
                                    }
                                />
                            ))}
                            {colDespachadas.length === 0 && <EmptyCol text="Sin despachos hoy" />}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL 1: NUEVA RUTA */}
            {modalNuevaRuta && (
                <ModalNuevaRuta
                    bodegaId={bodegaId}
                    fechaDefecto={fecha}
                    andenesDisponibles={andenes.filter(a => a.estadoOperativo === 'DISPONIBLE')}
                    catalogos={catalogos}
                    onClose={() => setModalNuevaRuta(false)}
                    onSuccess={nuevaRuta => {
                        setRutas(prev => [nuevaRuta, ...prev])
                        setToast({ tipo: 'ok', texto: `Ruta ${nuevaRuta.numeroRuta} creada exitosamente.` })
                        setModalNuevaRuta(false)
                        refrescarDatosSilencioso()
                    }}
                />
            )}

            {/* MODAL 2: ASIGNAR ANDÉN */}
            {modalAsignar && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white border border-gray-200 rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-4 shadow-2xl animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <Warehouse className="w-5 h-5 text-cyan-600" />
                                Asignar Andén a Ruta {modalAsignar.numeroRuta}
                            </h3>
                            <button onClick={() => setModalAsignar(null)} className="font-bold text-gray-400 hover:text-gray-600 p-1">
                                ✕
                            </button>
                        </div>

                        <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-1">
                            <p>
                                <span className="text-gray-500 font-medium">Patente:</span>{' '}
                                <strong className="font-mono text-cyan-700">{modalAsignar.camion?.patente}</strong>
                            </p>
                            <p>
                                <span className="text-gray-500 font-medium">Chofer:</span> {modalAsignar.chofer?.nombre}
                            </p>
                            <p>
                                <span className="text-gray-500 font-medium">Cliente:</span>{' '}
                                {modalAsignar.cliente?.razonSocial || 'General'}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-700">
                                Seleccione Andén Disponible:
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {andenes
                                    .filter(a => a.estadoOperativo === 'DISPONIBLE')
                                    .map(a => (
                                        <button
                                            key={a.id}
                                            type="button"
                                            disabled={actionLoading}
                                            onClick={() => handleConfirmarAsignacion(a.id)}
                                            className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-left transition shadow-2xs"
                                        >
                                            <span className="font-mono font-bold text-sm block">{a.codigo}</span>
                                            <span className="text-[11px] font-medium block text-emerald-700">{a.nombre}</span>
                                        </button>
                                    ))}
                            </div>
                            {andenes.filter(a => a.estadoOperativo === 'DISPONIBLE').length === 0 && (
                                <p className="text-xs text-rose-700 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                                    No hay andenes disponibles en este momento. Debe liberar o esperar que termine una carga.
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setModalAsignar(null)}
                                className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: REASIGNAR ANDÉN */}
            {modalReasignar && (
                <ModalReasignarAnden
                    ruta={modalReasignar}
                    andenesDisponibles={andenes.filter(a => a.estadoOperativo === 'DISPONIBLE')}
                    onClose={() => setModalReasignar(null)}
                    onConfirm={handleConfirmarReasignacion}
                />
            )}

            {/* MODAL 4: COMPLETAR DESPACHO */}
            {modalDespachar && (
                <ModalCompletarDespacho
                    ruta={modalDespachar}
                    onClose={() => setModalDespachar(null)}
                    onConfirm={handleConfirmarDespacho}
                />
            )}

            {/* MODAL 5: CARGA MASIVA EXCEL */}
            {modalCargaMasiva && (
                <ModalCargaMasivaExcel
                    bodegaId={bodegaId}
                    onClose={() => setModalCargaMasiva(false)}
                    onSuccess={(creadas) => {
                        setToast({ tipo: 'ok', texto: `Se importaron ${creadas} rutas exitosamente.` })
                        setModalCargaMasiva(false)
                        refrescarDatosSilencioso()
                    }}
                />
            )}

            {/* MODAL 6: TIMELINE & DETALLE DE RUTA */}
            {modalTimeline && (
                <ModalTimelineRuta ruta={modalTimeline} onClose={() => setModalTimeline(null)} />
            )}
        </div>
    )
}

/** Componente de Tarjeta individual de Ruta en Kanban */
function TarjetaRuta({
    ruta,
    badgeCustom,
    acciones,
    onVerTimeline
}: {
    ruta: any
    badgeCustom?: React.ReactNode
    acciones?: React.ReactNode
    onVerTimeline: () => void
}) {
    return (
        <div className="bg-white rounded-xl p-3.5 border border-gray-200 shadow-2xs space-y-2.5 hover:shadow-md hover:border-cyan-400 transition-all">
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={onVerTimeline}
                    className="font-mono text-xs font-black text-cyan-700 hover:underline"
                >
                    {ruta.numeroRuta}
                </button>
                {badgeCustom || (
                    <span className="text-[10px] font-mono font-medium text-gray-500">{ruta.horaProgramada}</span>
                )}
            </div>

            <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">
                        {ruta.camion?.patente}
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium">{ruta.camion?.tipoVehiculo}</span>
                </div>
                <p className="text-gray-800 font-semibold truncate">{ruta.chofer?.nombre}</p>
                {ruta.cliente && (
                    <p className="text-[11px] text-gray-500 truncate flex items-center gap-1 font-medium">
                        <MapPin className="w-3 h-3 shrink-0 text-gray-400" />
                        {ruta.cliente.razonSocial}
                    </p>
                )}
            </div>

            {acciones}
        </div>
    )
}

function EmptyCol({ text }: { text: string }) {
    return (
        <div className="py-8 text-center text-xs font-medium text-gray-400 border border-dashed border-gray-200 rounded-xl">
            {text}
        </div>
    )
}

/** Subcomponente Modal Nueva Ruta */
function ModalNuevaRuta({
    bodegaId,
    fechaDefecto,
    andenesDisponibles,
    catalogos,
    onClose,
    onSuccess
}: {
    bodegaId: string
    fechaDefecto: string
    andenesDisponibles: any[]
    catalogos: any
    onClose: () => void
    onSuccess: (ruta: any) => void
}) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        const form = new FormData(e.currentTarget)

        try {
            const res = await crearRuta({
                bodegaId,
                choferId: form.get('choferId') as string,
                camionId: form.get('camionId') as string,
                clienteId: (form.get('clienteId') as string) || undefined,
                andenId: (form.get('andenId') as string) || undefined,
                fechaRuta: form.get('fechaRuta') as string,
                horaProgramada: form.get('horaProgramada') as string,
                totalBultos: parseInt(form.get('totalBultos') as string, 10) || 0,
                totalKilos: parseFloat(form.get('totalKilos') as string) || undefined,
                observaciones: (form.get('observaciones') as string) || undefined
            })

            if (res.success) {
                onSuccess(res.ruta)
            } else {
                setError(res.error || 'Error al crear la ruta.')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white border border-gray-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-2xl animate-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                        <Truck className="w-5 h-5 text-cyan-600" />
                        Programar Nueva Ruta de Despacho
                    </h3>
                    <button onClick={onClose} className="font-bold text-gray-400 hover:text-gray-600 p-1">
                        ✕
                    </button>
                </div>

                {error && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Fecha de Ruta</label>
                            <input
                                name="fechaRuta"
                                type="date"
                                required
                                defaultValue={fechaDefecto}
                                className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-mono font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Hora Programada</label>
                            <input
                                name="horaProgramada"
                                type="time"
                                required
                                defaultValue="08:30"
                                className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-mono font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Chofer</label>
                            <select
                                name="choferId"
                                required
                                className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                            >
                                <option value="">Seleccione Chofer...</option>
                                {catalogos.choferes.map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                        {c.nombre} ({c.rut})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Camión (Patente)</label>
                            <select
                                name="camionId"
                                required
                                className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-mono font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                            >
                                <option value="">Seleccione Patente...</option>
                                {catalogos.camiones.map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                        {c.patente} - {c.tipoVehiculo}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Cliente / Destino</label>
                        <select
                            name="clienteId"
                            className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        >
                            <option value="">Destino General / Múltiples Clientes</option>
                            {catalogos.clientes.map((c: any) => (
                                <option key={c.id} value={c.id}>
                                    {c.razonSocial} ({c.comuna || 'Sin Comuna'})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Andén (Opcional)</label>
                            <select
                                name="andenId"
                                className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                            >
                                <option value="">Sin Asignar</option>
                                {andenesDisponibles.map((a: any) => (
                                    <option key={a.id} value={a.id}>
                                        {a.codigo} - {a.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Total Bultos</label>
                            <input
                                name="totalBultos"
                                type="number"
                                defaultValue="0"
                                className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Kilos Estimados</label>
                            <input
                                name="totalKilos"
                                type="number"
                                step="0.1"
                                placeholder="ej: 1200"
                                className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Observaciones</label>
                        <textarea
                            name="observaciones"
                            rows={2}
                            placeholder="Notas operativas para el despachador..."
                            className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition"
                        >
                            {loading ? 'Creando...' : 'Crear y Programar Ruta'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

/** Subcomponente Modal Reasignar Andén */
function ModalReasignarAnden({
    ruta,
    andenesDisponibles,
    onClose,
    onConfirm
}: {
    ruta: any
    andenesDisponibles: any[]
    onClose: () => void
    onConfirm: (nuevoAndenId: string, motivo: string) => Promise<void>
}) {
    const [nuevoAndenId, setNuevoAndenId] = useState(andenesDisponibles[0]?.id || '')
    const [motivo, setMotivo] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!nuevoAndenId || !motivo.trim()) return
        setLoading(true)
        try {
            await onConfirm(nuevoAndenId, motivo)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white border border-gray-200 rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-4 shadow-2xl animate-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                        Reasignar Muelle / Andén
                    </h3>
                    <button onClick={onClose} className="font-bold text-gray-400 hover:text-gray-600 p-1">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Seleccione Nuevo Andén:</label>
                        <select
                            value={nuevoAndenId}
                            onChange={e => setNuevoAndenId(e.target.value)}
                            required
                            className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-medium text-gray-900 focus:bg-white"
                        >
                            {andenesDisponibles.map(a => (
                                <option key={a.id} value={a.id}>
                                    {a.codigo} - {a.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Motivo de Reasignación (Auditoría):</label>
                        <textarea
                            value={motivo}
                            onChange={e => setMotivo(e.target.value)}
                            required
                            placeholder="ej: Desperfecto mecánico en portón de andén anterior..."
                            rows={3}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-medium text-gray-900 focus:bg-white"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !nuevoAndenId || !motivo.trim()}
                            className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition shadow-sm"
                        >
                            {loading ? 'Reasignando...' : 'Confirmar Reasignación'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

/** Subcomponente Modal Completar Despacho */
function ModalCompletarDespacho({
    ruta,
    onClose,
    onConfirm
}: {
    ruta: any
    onClose: () => void
    onConfirm: (selloSalida: string, observaciones: string) => Promise<void>
}) {
    const [sello, setSello] = useState('')
    const [obs, setObs] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await onConfirm(sello, obs)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white border border-gray-200 rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-4 shadow-2xl animate-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <LogOut className="w-4 h-4 text-cyan-600" />
                        Completar Despacho y Liberar Andén
                    </h3>
                    <button onClick={onClose} className="font-bold text-gray-400 hover:text-gray-600 p-1">
                        ✕
                    </button>
                </div>

                <div className="p-3.5 rounded-xl bg-cyan-50 border border-cyan-200 text-xs space-y-1 text-cyan-900">
                    <p>
                        <strong>Ruta:</strong> {ruta.numeroRuta} | <strong>Patente:</strong> {ruta.camion?.patente || ruta.camionPatente}
                    </p>
                    <p className="text-cyan-800/80">
                        Al completar el despacho, el andén quedará automáticamente disponible para el siguiente camión.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">N° Sello de Salida (Opcional)</label>
                        <input
                            type="text"
                            value={sello}
                            onChange={e => setSello(e.target.value)}
                            placeholder="ej: SL-987654"
                            className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-mono uppercase text-gray-900 focus:bg-white"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Observaciones de Cierre</label>
                        <textarea
                            value={obs}
                            onChange={e => setObs(e.target.value)}
                            rows={2}
                            placeholder="Notas sobre el estado de la carga o sellado..."
                            className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-medium text-gray-900 focus:bg-white"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-xs font-bold rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white transition shadow-sm"
                        >
                            {loading ? 'Completando...' : 'Finalizar Despacho'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

/** Subcomponente Modal Carga Masiva Excel */
function ModalCargaMasivaExcel({
    bodegaId,
    onClose,
    onSuccess
}: {
    bodegaId: string
    onClose: () => void
    onSuccess: (total: number) => void
}) {
    const [loading, setLoading] = useState(false)
    const [rawText, setRawText] = useState('')
    const [error, setError] = useState<string | null>(null)

    const procesarCarga = async () => {
        if (!rawText.trim()) return
        setLoading(true)
        setError(null)

        try {
            const lineas = rawText.split('\n').filter(l => l.trim().length > 0)
            const filas = []

            for (let i = 0; i < lineas.length; i++) {
                if (i === 0 && (lineas[i].toLowerCase().includes('rut') || lineas[i].toLowerCase().includes('patente'))) {
                    continue
                }

                const cols = lineas[i].split('\t').map(c => c.trim())
                if (cols.length >= 4) {
                    filas.push({
                        rutChofer: cols[0],
                        nombreChofer: cols[1] || undefined,
                        patenteCamion: cols[2],
                        tipoVehiculo: cols[3] || 'RAMPLA',
                        fechaRuta: cols[4] || new Date().toISOString().slice(0, 10),
                        horaProgramada: cols[5] || '08:00',
                        clienteNombre: cols[6] || undefined,
                        totalBultos: cols[7] ? parseInt(cols[7], 10) : 0
                    })
                }
            }

            if (filas.length === 0) {
                setError('No se detectaron filas válidas. Copie las columnas: RUT, Nombre, Patente, Tipo, Fecha, Hora, Cliente, Bultos.')
                return
            }

            const res = await importarRutasMasivas(bodegaId, filas)
            if (res.success) {
                onSuccess(res.creadas || 0)
            } else {
                setError(res.error || 'Error al procesar la importación.')
            }
        } catch (err: any) {
            setError(err?.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white border border-gray-200 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-4 shadow-2xl animate-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        Importación Rápida desde Excel
                    </h3>
                    <button onClick={onClose} className="font-bold text-gray-400 hover:text-gray-600 p-1">
                        ✕
                    </button>
                </div>

                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs space-y-1">
                    <p className="font-bold text-gray-800">Formato de Columnas (Pegar directo desde Excel):</p>
                    <p className="font-mono text-[11px] text-gray-600">
                        [RUT Chofer] | [Nombre Chofer] | [Patente] | [Tipo Vehículo] | [Fecha YYYY-MM-DD] | [Hora HH:MM] | [Cliente] | [Bultos]
                    </p>
                </div>

                {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">{error}</div>}

                <div>
                    <textarea
                        value={rawText}
                        onChange={e => setRawText(e.target.value)}
                        placeholder="Pegue aquí las filas copiadas desde su hoja de cálculo..."
                        rows={8}
                        className="w-full p-3.5 text-xs font-mono rounded-2xl bg-gray-50 border border-gray-200 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700">
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={loading || !rawText.trim()}
                        onClick={procesarCarga}
                        className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
                    >
                        {loading ? 'Importando...' : 'Procesar e Importar'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/** Subcomponente Modal Timeline de Ruta */
function ModalTimelineRuta({ ruta, onClose }: { ruta: any; onClose: () => void }) {
    const eventos = ruta.eventos || []

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white border border-gray-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-2xl animate-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                        <span className="text-xs font-mono text-cyan-700 font-bold">{ruta.numeroRuta}</span>
                        <h3 className="font-bold text-gray-900 text-base">
                            Trazabilidad y Línea de Tiempo
                        </h3>
                    </div>
                    <button onClick={onClose} className="font-bold text-gray-400 hover:text-gray-600 p-1">
                        ✕
                    </button>
                </div>

                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs space-y-1">
                    <div className="flex justify-between">
                        <span>
                            <strong className="text-gray-700">Chofer:</strong> {ruta.chofer?.nombre}
                        </span>
                        <span className="font-mono font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">{ruta.camion?.patente}</span>
                    </div>
                    <p className="text-gray-500">
                        <strong>Token Chofer:</strong> <span className="font-mono">{ruta.tokenRuta}</span>
                    </p>
                </div>

                {/* TIMELINE LIST */}
                <div className="relative pl-6 space-y-4 max-h-72 overflow-y-auto before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-cyan-200">
                    {eventos.map((ev: any, idx: number) => (
                        <div key={ev.id || idx} className="relative space-y-1">
                            <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-cyan-600 ring-4 ring-white" />
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-gray-900">
                                    {ev.estadoNuevo}
                                </span>
                                <span className="text-[10px] font-mono text-gray-400 font-medium">
                                    {new Date(ev.createdAt).toLocaleTimeString('es-CL')}
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-600">{ev.notas || 'Cambio registrado en bitácora.'}</p>
                            <span className="text-[10px] text-cyan-700 font-mono font-semibold">
                                Origen: {ev.origenCambio}
                            </span>
                        </div>
                    ))}
                    {eventos.length === 0 && (
                        <p className="text-xs text-gray-400 italic">No hay eventos registrados.</p>
                    )}
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-100">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    )
}
