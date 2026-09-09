'use client'

import React, { useState } from 'react'
import {
    Search,
    Download,
    CheckCircle2,
    Calendar,
    Warehouse,
    Truck,
    Package,
    Clock,
    AlertTriangle
} from 'lucide-react'
import {
    getRutas,
    getRutaDetalle,
    cancelarRuta,
    forzarEstadoRuta
} from '@/actions/logistica/rutas'

interface Props {
    initialRutas: any[]
    initialBodegas: any[]
    canForzarEstado: boolean
    canCancelar: boolean
}

export default function RutasClient({
    initialRutas,
    initialBodegas,
    canForzarEstado,
    canCancelar
}: Props) {
    const [rutas, setRutas] = useState<any[]>(initialRutas)
    const [bodegaId, setBodegaId] = useState<string>('ALL')
    const [estado, setEstado] = useState<string>('ALL')
    const [fechaDesde, setFechaDesde] = useState<string>('')
    const [fechaHasta, setFechaHasta] = useState<string>('')
    const [search, setSearch] = useState<string>('')
    const [loading, setLoading] = useState(false)

    const [modalTimeline, setModalTimeline] = useState<any | null>(null)
    const [modalCancelar, setModalCancelar] = useState<any | null>(null)
    const [modalForzar, setModalForzar] = useState<any | null>(null)
    const [toast, setToast] = useState<string | null>(null)

    const aplicarFiltros = async () => {
        setLoading(true)
        try {
            const res = await getRutas({
                bodegaId: bodegaId === 'ALL' ? undefined : bodegaId,
                estado: estado === 'ALL' ? undefined : estado,
                fechaDesde: fechaDesde || undefined,
                fechaHasta: fechaHasta || undefined,
                search: search.trim() || undefined
            })
            if (res.rutas) {
                setRutas(res.rutas)
            }
        } finally {
            setLoading(false)
        }
    }

    const handleExportarExcel = () => {
        const headers = [
            'N° Ruta',
            'Fecha',
            'Hora Programada',
            'Estado',
            'Bodega',
            'Andén',
            'Patente Camión',
            'Tipo Camión',
            'Chofer Nombre',
            'Chofer RUT',
            'Chofer Teléfono',
            'Cliente',
            'Total Bultos',
            'Total Kilos',
            'Hora Portón',
            'Hora Entrada Andén',
            'Hora Despacho',
            'Sello Salida'
        ]

        const rows = rutas.map(r => [
            r.numeroRuta,
            r.fechaRuta,
            r.horaProgramada,
            r.estado,
            r.bodega?.nombre || '',
            r.anden?.codigo || '',
            r.camion?.patente || '',
            r.camion?.tipoVehiculo || '',
            r.chofer?.nombre || '',
            r.chofer?.rut || '',
            r.chofer?.telefono || '',
            r.cliente?.razonSocial || '',
            r.totalBultos || 0,
            r.totalKilos || '',
            r.horaLlegadaPorton ? new Date(r.horaLlegadaPorton).toLocaleTimeString('es-CL') : '',
            r.horaEntradaAnden ? new Date(r.horaEntradaAnden).toLocaleTimeString('es-CL') : '',
            r.horaDespacho ? new Date(r.horaDespacho).toLocaleTimeString('es-CL') : '',
            r.selloSalida || ''
        ])

        const csvContent =
            'data:text/csv;charset=utf-8,\uFEFF' +
            [headers.join(';'), ...rows.map(e => e.map(val => `"${val ?? ''}"`).join(';'))].join('\n')

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement('a')
        link.setAttribute('href', encodedUri)
        link.setAttribute('download', `hendaya_rutas_logistica_${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const abrirTimeline = async (ruta: any) => {
        const res = await getRutaDetalle(ruta.id)
        if (res.ruta) {
            setModalTimeline(res.ruta)
        } else {
            setModalTimeline(ruta)
        }
    }

    const handleConfirmarCancelar = async (motivo: string) => {
        if (!modalCancelar || !motivo.trim()) return
        const res = await cancelarRuta(modalCancelar.id, motivo)
        if (res.success) {
            setRutas(prev => prev.map(r => (r.id === modalCancelar.id ? { ...r, estado: 'CANCELADA' } : r)))
            setToast('Ruta cancelada exitosamente.')
            setModalCancelar(null)
            setTimeout(() => setToast(null), 3000)
        }
    }

    const handleConfirmarForzar = async (nuevoEstado: string, justificacion: string) => {
        if (!modalForzar || !justificacion.trim()) return
        const res = await forzarEstadoRuta(modalForzar.id, nuevoEstado, justificacion)
        if (res.success) {
            setRutas(prev => prev.map(r => (r.id === modalForzar.id ? { ...r, estado: nuevoEstado } : r)))
            setToast(`Ruta forzada a estado ${nuevoEstado}.`)
            setModalForzar(null)
            setTimeout(() => setToast(null), 3000)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            {/* CABECERA ESTÁNDAR HENDAYA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-50 to-sky-50 rounded-bl-full -z-10 opacity-70" />
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-cyan-100 text-cyan-700 rounded-xl text-xl">📋</span>
                        Historial de Rutas de Despacho
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm font-medium">
                        Consulte el registro histórico completo, tiempos de permanencia, sellos y trazabilidad paso a paso.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleExportarExcel}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        Exportar a Excel (.csv)
                    </button>
                </div>
            </div>

            {toast && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2 font-bold shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {toast}
                </div>
            )}

            {/* BARRA DE FILTROS */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Bodega / CD:</label>
                        <select
                            value={bodegaId}
                            onChange={e => setBodegaId(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-gray-50 border border-gray-200 text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        >
                            <option value="ALL">Todas las Bodegas</option>
                            {initialBodegas.map(b => (
                                <option key={b.id} value={b.id}>
                                    {b.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Estado:</label>
                        <select
                            value={estado}
                            onChange={e => setEstado(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-gray-50 border border-gray-200 text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        >
                            <option value="ALL">Todos los Estados</option>
                            <option value="PROGRAMADA">Programada</option>
                            <option value="NOTIFICADA">Notificada</option>
                            <option value="EN_PORTON">En Portón</option>
                            <option value="EN_ANDEN">En Andén</option>
                            <option value="DESPACHADA">Despachada</option>
                            <option value="CANCELADA">Cancelada</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Fecha Desde:</label>
                        <input
                            type="date"
                            value={fechaDesde}
                            onChange={e => setFechaDesde(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-gray-50 border border-gray-200 font-mono text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Fecha Hasta:</label>
                        <input
                            type="date"
                            value={fechaHasta}
                            onChange={e => setFechaHasta(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-gray-50 border border-gray-200 font-mono text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        />
                    </div>

                    <div className="flex items-end gap-2">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Búsqueda:</label>
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="N° Ruta, Patente..."
                                className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-gray-50 border border-gray-200 text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={aplicarFiltros}
                            disabled={loading}
                            className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shrink-0 shadow-sm transition"
                        >
                            {loading ? '...' : 'Filtrar'}
                        </button>
                    </div>
                </div>
            </div>

            {/* TABLA DE RESULTADOS */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50/80 text-gray-500 uppercase tracking-wider font-bold border-b border-gray-200">
                            <tr>
                                <th className="py-3.5 px-4">N° Ruta</th>
                                <th className="py-3.5 px-4">Fecha / Hora</th>
                                <th className="py-3.5 px-4">Estado</th>
                                <th className="py-3.5 px-4">Andén</th>
                                <th className="py-3.5 px-4">Camión / Patente</th>
                                <th className="py-3.5 px-4">Chofer</th>
                                <th className="py-3.5 px-4">Cliente / Destino</th>
                                <th className="py-3.5 px-4">Bultos</th>
                                <th className="py-3.5 px-4">Sello</th>
                                <th className="py-3.5 px-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rutas.map(r => {
                                const isDesp = r.estado === 'DESPACHADA'
                                const isCanc = r.estado === 'CANCELADA'
                                const isOcup = r.estado === 'EN_ANDEN'
                                const isPorton = r.estado === 'EN_PORTON'

                                return (
                                    <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                                        <td className="py-3.5 px-4 font-mono font-black text-cyan-700">
                                            {r.numeroRuta}
                                        </td>
                                        <td className="py-3.5 px-4 font-mono text-gray-700">
                                            {r.fechaRuta} <span className="text-gray-400 font-normal">({r.horaProgramada})</span>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span
                                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                                    isDesp
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : isCanc
                                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                        : isOcup
                                                        ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                                        : isPorton
                                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                        : 'bg-gray-100 text-gray-700 border-gray-200'
                                                }`}
                                            >
                                                {r.estado}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 font-mono">
                                            {r.anden?.codigo ? (
                                                <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                                    {r.anden.codigo}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className="font-mono font-bold text-gray-900">{r.camion?.patente}</span>
                                            <span className="text-[10px] text-gray-500 block">{r.camion?.tipoVehiculo}</span>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className="font-semibold text-gray-800">
                                                {r.chofer?.nombre}
                                            </span>
                                            <span className="text-[10px] text-gray-400 block font-mono">
                                                {r.chofer?.telefono}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-gray-600 font-medium">
                                            {r.cliente?.razonSocial || '-'}
                                        </td>
                                        <td className="py-3.5 px-4 font-mono font-semibold text-gray-800">{r.totalBultos || 0}</td>
                                        <td className="py-3.5 px-4 font-mono text-[11px] text-gray-700">{r.selloSalida || '-'}</td>
                                        <td className="py-3.5 px-4 text-right space-x-1.5">
                                            <button
                                                type="button"
                                                onClick={() => abrirTimeline(r)}
                                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-gray-100 hover:bg-gray-200 text-cyan-700 transition"
                                            >
                                                Timeline
                                            </button>
                                            {canForzarEstado && (
                                                <button
                                                    type="button"
                                                    onClick={() => setModalForzar(r)}
                                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition"
                                                    title="Forzar Estado"
                                                >
                                                    Forzar
                                                </button>
                                            )}
                                            {canCancelar && r.estado !== 'CANCELADA' && r.estado !== 'DESPACHADA' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setModalCancelar(r)}
                                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
                                                >
                                                    Cancelar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                            {rutas.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-gray-400 text-xs font-medium">
                                        No se encontraron rutas con los filtros seleccionados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Timeline */}
            {modalTimeline && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white border border-gray-200 rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-4 shadow-2xl animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <div>
                                <span className="font-mono text-xs text-cyan-700 font-bold">{modalTimeline.numeroRuta}</span>
                                <h3 className="font-bold text-gray-900 text-base">
                                    Línea de Tiempo Operativa
                                </h3>
                            </div>
                            <button onClick={() => setModalTimeline(null)} className="font-bold text-gray-400 hover:text-gray-600 p-1">
                                ✕
                            </button>
                        </div>

                        <div className="relative pl-6 space-y-4 max-h-72 overflow-y-auto before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-cyan-200">
                            {(modalTimeline.eventos || []).map((ev: any, idx: number) => (
                                <div key={ev.id || idx} className="relative space-y-1">
                                    <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-cyan-600 ring-4 ring-white" />
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-gray-900">
                                            {ev.estadoNuevo}
                                        </span>
                                        <span className="text-[10px] font-mono text-gray-400 font-medium">
                                            {new Date(ev.createdAt).toLocaleString('es-CL')}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-600">{ev.notas || 'Bitácora registrada.'}</p>
                                    <span className="text-[10px] text-cyan-700 font-mono font-semibold">
                                        Origen: {ev.origenCambio}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-2 border-t border-gray-100">
                            <button onClick={() => setModalTimeline(null)} className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Cancelar */}
            {modalCancelar && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white border border-gray-200 rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-4 shadow-2xl animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <h3 className="font-bold text-gray-900 text-base">
                                Cancelar Ruta {modalCancelar.numeroRuta}
                            </h3>
                            <button onClick={() => setModalCancelar(null)} className="font-bold text-gray-400 hover:text-gray-600 p-1">
                                ✕
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            Esta acción cancelará la orden de despacho y liberará el andén si estaba asignado.
                        </p>
                        <form
                            onSubmit={e => {
                                e.preventDefault()
                                const form = new FormData(e.currentTarget)
                                handleConfirmarCancelar(form.get('motivo') as string)
                            }}
                            className="space-y-3"
                        >
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Motivo de Cancelación:</label>
                                <textarea
                                    name="motivo"
                                    required
                                    rows={3}
                                    placeholder="Indique la causa operativa de la cancelación..."
                                    className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 font-medium focus:bg-white"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setModalCancelar(null)}
                                    className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700"
                                >
                                    Volver
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition"
                                >
                                    Confirmar Cancelación
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Forzar Estado */}
            {modalForzar && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white border border-gray-200 rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-4 shadow-2xl animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <h3 className="font-bold text-gray-900 text-base">
                                Cambio Forzado de Estado (Excepcional)
                            </h3>
                            <button onClick={() => setModalForzar(null)} className="font-bold text-gray-400 hover:text-gray-600 p-1">
                                ✕
                            </button>
                        </div>
                        <form
                            onSubmit={e => {
                                e.preventDefault()
                                const form = new FormData(e.currentTarget)
                                handleConfirmarForzar(form.get('estado') as string, form.get('justificacion') as string)
                            }}
                            className="space-y-3"
                        >
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Nuevo Estado:</label>
                                <select
                                    name="estado"
                                    defaultValue={modalForzar.estado}
                                    className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 font-semibold focus:bg-white"
                                >
                                    <option value="PROGRAMADA">PROGRAMADA</option>
                                    <option value="NOTIFICADA">NOTIFICADA</option>
                                    <option value="EN_PORTON">EN_PORTON</option>
                                    <option value="EN_ANDEN">EN_ANDEN</option>
                                    <option value="DESPACHADA">DESPACHADA</option>
                                    <option value="CANCELADA">CANCELADA</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Justificación (Quedará en Auditoría):</label>
                                <textarea
                                    name="justificacion"
                                    required
                                    rows={3}
                                    placeholder="Explique el motivo del cambio manual..."
                                    className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 font-medium focus:bg-white"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                                <button type="button" onClick={() => setModalForzar(null)} className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700">
                                    Cancelar
                                </button>
                                <button type="submit" className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition">
                                    Forzar Estado
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
