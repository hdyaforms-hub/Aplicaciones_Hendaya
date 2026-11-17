'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import {
    HitoTimelineDTO,
    getExpedienteTimelineAction
} from '../actions'
import {
    ArrowLeft,
    History,
    Search,
    RefreshCw,
    Scale,
    Gavel,
    FileText,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    Clock,
    FileSpreadsheet,
    Building2,
    UserCheck,
    ChevronRight,
    ExternalLink
} from 'lucide-react'

interface Props {
    initialHitos: HitoTimelineDTO[]
    initialIdentificador: string
    queryFolio: string
    queryRex: string
}

export default function ExpedienteTimelineClient({
    initialHitos,
    initialIdentificador,
    queryFolio,
    queryRex
}: Props) {
    const [hitos, setHitos] = useState<HitoTimelineDTO[]>(initialHitos)
    const [identificador, setIdentificador] = useState(initialIdentificador)
    const [folioInput, setFolioInput] = useState(queryFolio)
    const [rexInput, setRexInput] = useState(queryRex)
    const [isPending, startTransition] = useTransition()
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (!folioInput.trim() && !rexInput.trim()) {
            setErrorMsg('Ingresa un número de folio o un número de resolución REX.')
            return
        }
        setErrorMsg(null)

        startTransition(async () => {
            const res = await getExpedienteTimelineAction({
                folio: folioInput.trim() || undefined,
                numeroResolucion: rexInput.trim() || undefined
            })
            if (res.success && res.hitos) {
                setHitos(res.hitos)
                setIdentificador(res.identificador || '')
            } else {
                setErrorMsg(res.error || 'No se encontraron antecedentes para la búsqueda.')
            }
        })
    }

    return (
        <div className="space-y-6 max-w-[1500px] mx-auto p-2 sm:p-4">
            {/* CABECERA CORPORATIVA OFICIAL HENDAYA */}
            <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-700/60 overflow-hidden">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Link
                                href="/dashboard/areas/multas/ciclo-legal"
                                className="text-cyan-400 hover:text-cyan-300 text-xs font-bold flex items-center gap-1 transition"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Volver a Ciclo Legal</span>
                            </Link>
                            <span className="text-slate-500 text-xs">•</span>
                            <span className="font-mono text-cyan-400 font-extrabold tracking-widest text-xs uppercase px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60">
                                EXPEDIENTE DIGITAL
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                            <span>Línea de Tiempo del Expediente</span>
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                            Historial cronológico completo de un caso: desde la visita inspectiva en terreno hasta el fallo definitivo de JUNAEB o tribunales.
                        </p>
                    </div>

                    {/* Buscador Rápido en Cabecera */}
                    <form onSubmit={handleSearch} className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                            <input
                                type="text"
                                value={folioInput}
                                onChange={e => setFolioInput(e.target.value)}
                                placeholder="N° Folio (ej: 12345)..."
                                className="pl-8 pr-3 py-2 bg-slate-900/90 border border-slate-700 text-white rounded-xl text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 w-44"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isPending}
                            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
                        >
                            <History className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
                            <span>{isPending ? 'Buscando...' : 'Buscar Expediente'}</span>
                        </button>
                    </form>
                </div>
            </div>

            {errorMsg && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* EXPEDIENTE TIMELINE */}
            {identificador && (
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-cyan-950/80 border border-cyan-800/60 text-white">
                    <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs text-slate-300">Expediente consultado:</span>
                        <strong className="text-sm font-mono text-cyan-300">{identificador}</strong>
                    </div>
                    <span className="text-xs text-slate-400 font-mono font-bold">
                        {hitos.length} hitos registrados
                    </span>
                </div>
            )}

            {hitos.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 max-w-xl mx-auto space-y-3">
                    <History className="w-12 h-12 mx-auto text-slate-300" />
                    <h3 className="font-bold text-slate-700 text-base">Búsqueda de Expediente Digital</h3>
                    <p className="text-xs text-slate-400">
                        Ingresa un número de folio o resolución para consultar la línea de tiempo cronológica con todas sus actas, notificaciones, descargos y dictámenes.
                    </p>
                </div>
            ) : (
                <div className="relative pl-6 sm:pl-10 space-y-8 before:absolute before:left-3 sm:before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                    {hitos.map((hito, idx) => {
                        let icon = <CheckCircle2 className="w-4 h-4" />
                        let dotColor = 'bg-slate-500'
                        let cardBorder = 'border-slate-200'

                        if (hito.tipo === 'SUPERVISION') {
                            icon = <Building2 className="w-4 h-4 text-emerald-600" />
                            dotColor = 'bg-emerald-500 ring-4 ring-emerald-100'
                            cardBorder = 'border-emerald-200/80 hover:border-emerald-400'
                        } else if (hito.tipo === 'NOTIFICACION_REX') {
                            icon = <AlertTriangle className="w-4 h-4 text-rose-600" />
                            dotColor = 'bg-rose-500 ring-4 ring-rose-100'
                            cardBorder = 'border-rose-200/80 hover:border-rose-400'
                        } else if (hito.tipo === 'DESCARGO_FORMAL') {
                            icon = <Scale className="w-4 h-4 text-indigo-600" />
                            dotColor = 'bg-indigo-500 ring-4 ring-indigo-100'
                            cardBorder = 'border-indigo-200/80 hover:border-indigo-400'
                        } else if (hito.tipo === 'RESUELVE') {
                            icon = <Gavel className="w-4 h-4 text-cyan-600" />
                            dotColor = 'bg-cyan-500 ring-4 ring-cyan-100'
                            cardBorder = 'border-cyan-200/80 hover:border-cyan-400'
                        } else if (hito.tipo === 'RECURSO_ADMIN') {
                            icon = <FileText className="w-4 h-4 text-amber-600" />
                            dotColor = 'bg-amber-500 ring-4 ring-amber-100'
                            cardBorder = 'border-amber-200/80 hover:border-amber-400'
                        } else if (hito.tipo === 'PROCESO_JUDICIAL') {
                            icon = <Gavel className="w-4 h-4 text-purple-600" />
                            dotColor = 'bg-purple-500 ring-4 ring-purple-100'
                            cardBorder = 'border-purple-200/80 hover:border-purple-400'
                        }

                        return (
                            <div key={hito.id} className="relative group">
                                {/* Punto en el Timeline */}
                                <div className={`absolute -left-6 sm:-left-10 top-3.5 w-6 h-6 rounded-full ${dotColor} flex items-center justify-center text-white text-[10px] font-bold shadow-sm transition-transform group-hover:scale-110`}>
                                    {idx + 1}
                                </div>

                                {/* Tarjeta del Hito */}
                                <div className={`bg-white rounded-2xl border ${cardBorder} p-5 shadow-sm transition-all hover:shadow-md space-y-3`}>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                                                {icon}
                                            </div>
                                            <div>
                                                <h4 className="font-extrabold text-sm text-slate-900">{hito.titulo}</h4>
                                                <p className="text-xs text-slate-500">{hito.subtitulo}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-start sm:self-auto">
                                            {hito.detallesBadge && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                                    {hito.detallesBadge}
                                                </span>
                                            )}
                                            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-200">
                                                📅 {hito.fecha}
                                            </span>
                                        </div>
                                    </div>

                                    {hito.descripcion && (
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            {hito.descripcion}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100/60 text-xs text-slate-500 flex-wrap gap-2">
                                        <div>
                                            {hito.montoUtm !== null && (
                                                <span>Monto: <strong className="font-mono text-cyan-800 font-bold">{hito.montoUtm.toFixed(2)} UTM</strong></span>
                                            )}
                                            {hito.montoPesos !== null && (
                                                <span className="ml-2 font-mono text-slate-600 font-bold">(${hito.montoPesos.toLocaleString('es-CL')})</span>
                                            )}
                                        </div>

                                        {hito.responsable && (
                                            <div className="text-[11px] text-slate-400">
                                                Registrado por: <strong>{hito.responsable}</strong>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
