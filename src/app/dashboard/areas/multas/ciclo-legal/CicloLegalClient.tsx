'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import {
    DescargoFormalDTO,
    ResumenKpiCicloLegal,
    crearDescargoFormalAction,
    getDescargosFormalesListAction
} from './actions'
import {
    Scale,
    FileSpreadsheet,
    Calendar,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Shield,
    UploadCloud,
    RefreshCw,
    Search,
    Filter,
    ChevronRight,
    ExternalLink,
    X,
    FileText,
    History,
    TrendingUp
} from 'lucide-react'

interface Props {
    initialList: DescargoFormalDTO[]
    initialResumen: ResumenKpiCicloLegal
    notificaciones: Array<{ id: string; numeroResolucion: string; periodo: string; totalItems: number; montoTotalNotificado: number }>
    canManage: boolean
}

export default function CicloLegalClient({ initialList, initialResumen, notificaciones, canManage }: Props) {
    const [list, setList] = useState<DescargoFormalDTO[]>(initialList)
    const [resumen, setResumen] = useState<ResumenKpiCicloLegal>(initialResumen)
    const [isPending, startTransition] = useTransition()
    const [search, setSearch] = useState('')
    const [filtroEstado, setFiltroEstado] = useState('TODOS')

    // Modal de Nuevo Descargo
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedNotifId, setSelectedNotifId] = useState('')
    const [codigoIngreso, setCodigoIngreso] = useState('')
    const [fechaIngreso, setFechaIngreso] = useState(new Date().toISOString().split('T')[0])
    const [diasPlazoLegal, setDiasPlazoLegal] = useState(30)
    const [abogado, setAbogado] = useState('')
    const [montoPesos, setMontoPesos] = useState('')
    const [resumenArgumentos, setResumenArgumentos] = useState('')
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

    const reloadData = () => {
        startTransition(async () => {
            const res = await getDescargosFormalesListAction()
            if (res.success && res.data && res.resumen) {
                setList(res.data)
                setResumen(res.resumen)
            }
        })
    }

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setUploadError(null)
        setUploadSuccess(null)

        const formData = new FormData()
        formData.append('notificacionId', selectedNotifId)
        formData.append('codigoIngreso', codigoIngreso)
        formData.append('fechaIngreso', fechaIngreso)
        formData.append('diasPlazoLegal', String(diasPlazoLegal))
        formData.append('abogadoResponsable', abogado)
        formData.append('montoImpugnadoPesos', montoPesos)
        formData.append('resumenArgumentos', resumenArgumentos)

        startTransition(async () => {
            const res = await crearDescargoFormalAction(formData)
            if (res.success) {
                setUploadSuccess('Descargo formal registrado exitosamente.')
                setCodigoIngreso('')
                setSelectedNotifId('')
                setResumenArgumentos('')
                reloadData()
                setTimeout(() => {
                    setIsModalOpen(false)
                    setUploadSuccess(null)
                }, 1200)
            } else {
                setUploadError(res.error || 'Ocurrió un error al registrar el descargo.')
            }
        })
    }

    const filteredList = list.filter(d => {
        if (filtroEstado !== 'TODOS' && d.estado !== filtroEstado) return false
        if (search.trim()) {
            const term = search.trim().toLowerCase()
            const matchCod = d.codigoIngreso.toLowerCase().includes(term)
            const matchRex = d.numeroResolucion.toLowerCase().includes(term)
            const matchLic = (d.licitacionNombre || '').toLowerCase().includes(term)
            const matchAbo = (d.abogadoResponsable || '').toLowerCase().includes(term)
            if (!matchCod && !matchRex && !matchLic && !matchAbo) return false
        }
        return true
    })

    return (
        <div className="space-y-6 max-w-[1700px] mx-auto p-2 sm:p-4">
            {/* CABECERA CORPORATIVA OFICIAL HENDAYA */}
            <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-700/60 overflow-hidden">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="font-mono text-cyan-400 font-extrabold tracking-widest text-xs uppercase px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60">
                                HENDAYA · FISCALIZACIÓN Y LITIGIOS JUNAEB
                            </span>
                            <span className="text-slate-400 text-xs font-semibold">
                                Módulo C7: Ciclo Legal y Expedientes Digitales
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                            <span>Ciclo Legal de Multas y Descargos</span>
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                            Control formal de descargos ante oficina de partes de JUNAEB, plazos de respuesta, fallos (Resuelve), recursos de reposición y demandas judiciales.
                        </p>
                    </div>

                    {/* Botones de Cabecera */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <Link
                            href="/dashboard/areas/multas/feriados"
                            className="px-3 py-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm"
                            title="Configurar calendario de feriados oficiales y leyes especiales"
                        >
                            <span>📅</span>
                            <span>Feriados</span>
                        </Link>

                        <Link
                            href="/dashboard/areas/multas/ciclo-legal/expediente"
                            className="px-3.5 py-2.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-sm"
                            title="Consultar expediente digital unificado por folio o resolución"
                        >
                            <History className="w-4 h-4 text-cyan-400" />
                            <span>Expediente Digital</span>
                        </Link>

                        <button
                            type="button"
                            onClick={reloadData}
                            disabled={isPending}
                            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-sm disabled:opacity-60 cursor-pointer"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-cyan-400' : 'text-slate-300'}`} />
                            <span>Actualizar</span>
                        </button>

                        {canManage && (
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-md cursor-pointer"
                            >
                                <Scale className="w-4 h-4" />
                                <span>Nuevo Descargo Formal</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 6 TARJETAS DE KPIS JURÍDICOS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Descargos</span>
                        <FileText className="w-4 h-4 text-cyan-600" />
                    </span>
                    <p className="text-2xl font-black text-slate-900 mt-2">{resumen.totalDescargos}</p>
                    <span className="text-[10px] text-slate-400 mt-0.5">Ingresados formalmente</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>En Trámite</span>
                        <Clock className="w-4 h-4 text-sky-600" />
                    </span>
                    <p className="text-2xl font-black text-sky-700 mt-2">{resumen.enTramite}</p>
                    <span className="text-[10px] text-sky-600/80 mt-0.5">Esperando dictamen</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center justify-between">
                        <span>Plazos Críticos</span>
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </span>
                    <p className="text-2xl font-black text-amber-800 mt-2">{resumen.proximosVencer + resumen.plazosVencidos}</p>
                    <span className="text-[10px] text-amber-700 mt-0.5">{resumen.plazosVencidos} vencidos / {resumen.proximosVencer} próx.</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Impugnado</span>
                        <Scale className="w-4 h-4 text-indigo-600" />
                    </span>
                    <p className="text-2xl font-black text-indigo-700 mt-2">{resumen.montoTotalImpugnadoUtm.toFixed(2)} <span className="text-xs font-normal">UTM</span></p>
                    <span className="text-[10px] text-indigo-600/80 mt-0.5">Monto en controversia</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
                        <span>Rebajado / Éxito</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </span>
                    <p className="text-2xl font-black text-emerald-700 mt-2">{resumen.montoTotalRebajadoUtm.toFixed(2)} <span className="text-xs font-normal">UTM</span></p>
                    <span className="text-[10px] text-emerald-600 mt-0.5">Ahorro obtenido</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-cyan-200 bg-cyan-50/30 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider flex items-center justify-between">
                        <span>Efectividad Legal</span>
                        <TrendingUp className="w-4 h-4 text-cyan-600" />
                    </span>
                    <p className="text-2xl font-black text-cyan-800 mt-2">{resumen.tasaExitoGlobal}%</p>
                    <span className="text-[10px] text-cyan-700 mt-0.5">Tasa de recupero</span>
                </div>
            </div>

            {/* BARRA DE FILTROS */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por código de ingreso, REX o abogado..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <span>Estado:</span>
                        <select
                            value={filtroEstado}
                            onChange={e => setFiltroEstado(e.target.value)}
                            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        >
                            <option value="TODOS">Todos ({list.length})</option>
                            <option value="PRESENTADO">Presentado</option>
                            <option value="EN_EVALUACION">En Evaluación</option>
                            <option value="RESPONDIDO_PARCIAL">Respondido Parcial</option>
                            <option value="CERRADO">Cerrado / Concluido</option>
                        </select>
                    </div>

                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>Limpiar</span>
                        </button>
                    )}
                </div>
            </div>

            {/* TABLA DE DESCARGOS FORMALES */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-slate-800">
                        Mostrando <strong className="text-cyan-700">{filteredList.length}</strong> descargos formales registrados
                    </span>
                    {isPending && <span className="text-xs text-cyan-600 animate-pulse font-medium">Actualizando...</span>}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11.5px]">
                        <thead>
                            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                <th className="py-3 px-4">Código Ingreso (Of. Partes)</th>
                                <th className="py-3 px-3">Resolución REX</th>
                                <th className="py-3 px-3">Fecha Ingreso</th>
                                <th className="py-3 px-3 text-center">Plazo Respuesta</th>
                                <th className="py-3 px-3 text-center">Folios</th>
                                <th className="py-3 px-3 text-right">Impugnado (UTM)</th>
                                <th className="py-3 px-3 text-right">Rebajado (UTM)</th>
                                <th className="py-3 px-3 text-center">Éxito (%)</th>
                                <th className="py-3 px-3 text-center">Estado</th>
                                <th className="py-3 px-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {filteredList.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-slate-400">
                                        <Scale className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                        <p className="font-bold text-slate-700">No se encontraron descargos formales registrados</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Registra una presentación formal de descargos asociándola a una REX notificada.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredList.map(d => {
                                    // Semáforo de plazo de respuesta
                                    let semaforoClass = 'bg-slate-100 text-slate-700'
                                    let semaforoText = '-'
                                    if (d.diasRestantes !== null) {
                                        if (d.diasRestantes < 0) {
                                            semaforoClass = 'bg-rose-100 text-rose-800 font-bold'
                                            semaforoText = `Vencido (${Math.abs(d.diasRestantes)}d)`
                                        } else if (d.diasRestantes <= 5) {
                                            semaforoClass = 'bg-amber-100 text-amber-900 font-bold animate-pulse'
                                            semaforoText = `${d.diasRestantes} días rest.`
                                        } else {
                                            semaforoClass = 'bg-emerald-50 text-emerald-800 font-medium'
                                            semaforoText = `${d.diasRestantes} días rest.`
                                        }
                                    }

                                    // Estado del descargo
                                    let badgeEstadoClass = 'bg-slate-100 text-slate-700 border-slate-200'
                                    if (d.estado === 'PRESENTADO') badgeEstadoClass = 'bg-sky-50 text-sky-800 border-sky-200 font-bold'
                                    else if (d.estado === 'EN_EVALUACION') badgeEstadoClass = 'bg-indigo-50 text-indigo-800 border-indigo-200 font-bold'
                                    else if (d.estado === 'RESPONDIDO_PARCIAL') badgeEstadoClass = 'bg-amber-50 text-amber-800 border-amber-200 font-bold'
                                    else if (d.estado === 'CERRADO') badgeEstadoClass = 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'

                                    return (
                                        <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="font-extrabold text-slate-900 text-xs">
                                                    {d.codigoIngreso}
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    Abogado: {d.abogadoResponsable || 'No asignado'}
                                                </div>
                                            </td>

                                            <td className="py-3 px-3">
                                                <div className="font-bold text-cyan-800">{d.numeroResolucion}</div>
                                                <div className="text-[10px] text-slate-400">
                                                    Período: {d.periodoMes}/{d.periodoAnio}
                                                </div>
                                            </td>

                                            <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                                                {d.fechaIngreso}
                                            </td>

                                            <td className="py-3 px-3 text-center whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${semaforoClass}`}>
                                                    {semaforoText}
                                                </span>
                                            </td>

                                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                                                {d.totalFolios}
                                            </td>

                                            <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700 whitespace-nowrap">
                                                {d.montoImpugnadoUtm.toFixed(2)}
                                            </td>

                                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                                                {d.montoRebajadoUtm.toFixed(2)}
                                            </td>

                                            <td className="py-3 px-3 text-center font-mono font-bold text-cyan-800 whitespace-nowrap">
                                                {d.porcentajeExito}%
                                            </td>

                                            <td className="py-3 px-3 text-center whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border ${badgeEstadoClass}`}>
                                                    {d.estado.replace('_', ' ')}
                                                </span>
                                            </td>

                                            <td className="py-3 px-4 text-center whitespace-nowrap">
                                                <Link
                                                    href={`/dashboard/areas/multas/ciclo-legal/${d.id}`}
                                                    className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1"
                                                >
                                                    <span>Ficha</span>
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </Link>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DE NUEVO DESCARGO FORMAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-cyan-100 text-cyan-800 rounded-xl">
                                    <Scale className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-base text-slate-900">Registrar Descargo Formal</h3>
                                    <p className="text-xs text-slate-500">Presentación de escrito de descargos ante JUNAEB</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsModalOpen(false)
                                    setUploadError(null)
                                    setUploadSuccess(null)
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSubmit} className="space-y-4">
                            {/* Resolución REX Asociada */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Resolución REX Notificada *
                                </label>
                                <select
                                    required
                                    value={selectedNotifId}
                                    onChange={e => setSelectedNotifId(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                >
                                    <option value="">Selecciona la REX a impugnar...</option>
                                    {notificaciones.map(n => (
                                        <option key={n.id} value={n.id}>
                                            {n.numeroResolucion} ({n.periodo}) — {n.totalItems} items, {n.montoTotalNotificado} UTM
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Código de Ingreso y Fecha */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        Código Ingreso Of. Partes *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={codigoIngreso}
                                        onChange={e => setCodigoIngreso(e.target.value)}
                                        placeholder="Ej: ING-2025-0842"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        Fecha Presentación *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={fechaIngreso}
                                        onChange={e => setFechaIngreso(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>
                            </div>

                            {/* Plazo Legal y Abogado Responsable */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        Plazo Legal (Días) *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min={5}
                                        max={180}
                                        value={diasPlazoLegal}
                                        onChange={e => setDiasPlazoLegal(parseInt(e.target.value, 10))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        Abogado / Responsable
                                    </label>
                                    <input
                                        type="text"
                                        value={abogado}
                                        onChange={e => setAbogado(e.target.value)}
                                        placeholder="Nombre del abogado a cargo..."
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>
                            </div>

                            {/* Resumen de Argumentos */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Resumen de Fundamentos de la Defensa
                                </label>
                                <textarea
                                    rows={2}
                                    value={resumenArgumentos}
                                    onChange={e => setResumenArgumentos(e.target.value)}
                                    placeholder="Síntesis de los principales argumentos técnicos y jurídicos expuestos en el escrito..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                />
                            </div>

                            {/* Feedback */}
                            {uploadError && (
                                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                    <span>{uploadError}</span>
                                </div>
                            )}

                            {uploadSuccess && (
                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>{uploadSuccess}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={isPending}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!selectedNotifId || !codigoIngreso || isPending}
                                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                                >
                                    {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />}
                                    <span>{isPending ? 'Registrando...' : 'Registrar Descargo'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
