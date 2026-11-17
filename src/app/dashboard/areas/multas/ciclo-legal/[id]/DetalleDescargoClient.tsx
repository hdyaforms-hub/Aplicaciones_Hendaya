'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import {
    DescargoFormalDTO,
    DescargoFolioDTO,
    ResuelveDTO,
    RecursoAdminDTO,
    ProcesoJudicialDTO,
    registrarResuelveAction,
    registrarRecursoAdminAction,
    registrarProcesoJudicialAction,
    getDescargoFormalDetalleAction
} from '../actions'
import {
    ArrowLeft,
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
    Gavel,
    TrendingUp,
    Plus
} from 'lucide-react'

interface Props {
    descargo: DescargoFormalDTO
    initialFolios: DescargoFolioDTO[]
    initialResuelves: ResuelveDTO[]
    initialRecursos: RecursoAdminDTO[]
    initialProcesos: ProcesoJudicialDTO[]
    canManage: boolean
}

export default function DetalleDescargoClient({
    descargo: initialDescargo,
    initialFolios,
    initialResuelves,
    initialRecursos,
    initialProcesos,
    canManage
}: Props) {
    const [descargo, setDescargo] = useState<DescargoFormalDTO>(initialDescargo)
    const [folios, setFolios] = useState<DescargoFolioDTO[]>(initialFolios)
    const [resuelves, setResuelves] = useState<ResuelveDTO[]>(initialResuelves)
    const [recursos, setRecursos] = useState<RecursoAdminDTO[]>(initialRecursos)
    const [procesos, setProcesos] = useState<ProcesoJudicialDTO[]>(initialProcesos)
    const [activeTab, setActiveTab] = useState<'FOLIOS' | 'RESUELVES' | 'RECURSOS' | 'JUDICIAL'>('FOLIOS')
    const [isPending, startTransition] = useTransition()

    // Modal Resuelve
    const [isResuelveModalOpen, setIsResuelveModalOpen] = useState(false)
    const [numRexResuelve, setNumRexResuelve] = useState('')
    const [fechaResuelve, setFechaResuelve] = useState(new Date().toISOString().split('T')[0])
    const [fechaNotifResuelve, setFechaNotifResuelve] = useState('')
    const [dictamen, setDictamen] = useState<'ACOGIDO_TOTAL' | 'ACOGIDO_PARCIAL' | 'RECHAZADO'>('ACOGIDO_PARCIAL')
    const [montoRatificado, setMontoRatificado] = useState(0)
    const [montoRebajado, setMontoRebajado] = useState(0)
    const [fundamentoResuelve, setFundamentoResuelve] = useState('')
    const [feedbackResuelve, setFeedbackResuelve] = useState<string | null>(null)

    // Modal Recurso Admin
    const [isRecursoModalOpen, setIsRecursoModalOpen] = useState(false)
    const [tipoRecurso, setTipoRecurso] = useState<'REPOSICION' | 'JERARQUICO'>('REPOSICION')
    const [codigoRecurso, setCodigoRecurso] = useState('')
    const [fechaRecurso, setFechaRecurso] = useState(new Date().toISOString().split('T')[0])
    const [autoridadRecurso, setAutoridadRecurso] = useState('Director Regional JUNAEB')
    const [fundamentosRecurso, setFundamentosRecurso] = useState('')
    const [abogadoRecurso, setAbogadoRecurso] = useState('')
    const [feedbackRecurso, setFeedbackRecurso] = useState<string | null>(null)

    // Modal Proceso Judicial
    const [isJudicialModalOpen, setIsJudicialModalOpen] = useState(false)
    const [tribunal, setTribunal] = useState('1° Juzgado Civil de Santiago')
    const [rolCausa, setRolCausa] = useState('')
    const [caratulado, setCaratulado] = useState('')
    const [fechaJudicial, setFechaJudicial] = useState(new Date().toISOString().split('T')[0])
    const [estadoProcesal, setEstadoProcesal] = useState('DEMANDA')
    const [abogadoJudicial, setAbogadoJudicial] = useState('')
    const [notasJudicial, setNotasJudicial] = useState('')
    const [feedbackJudicial, setFeedbackJudicial] = useState<string | null>(null)

    // Recargar datos
    const reloadData = () => {
        startTransition(async () => {
            const res = await getDescargoFormalDetalleAction(descargo.id)
            if (res.success && res.descargo) {
                setDescargo(res.descargo)
                setFolios(res.folios || [])
                setResuelves(res.resuelves || [])
                setRecursos(res.recursos || [])
                setProcesos(res.procesosJudiciales || [])
            }
        })
    }

    // Submit Resuelve
    const handleSaveResuelve = async (e: React.FormEvent) => {
        e.preventDefault()
        setFeedbackResuelve(null)
        const res = await registrarResuelveAction({
            descargoId: descargo.id,
            numeroResolucion: numRexResuelve,
            fechaResolucion: fechaResuelve,
            fechaNotificacion: fechaNotifResuelve || undefined,
            dictamen,
            montoRatificadoUtm: montoRatificado,
            montoRebajadoUtm: montoRebajado,
            fundamentoResuelve
        })
        if (res.success) {
            setFeedbackResuelve('Resuelve registrado exitosamente.')
            reloadData()
            setTimeout(() => {
                setIsResuelveModalOpen(false)
                setFeedbackResuelve(null)
            }, 1000)
        } else {
            setFeedbackResuelve(res.error || 'Error al registrar resuelve.')
        }
    }

    // Submit Recurso Admin
    const handleSaveRecurso = async (e: React.FormEvent) => {
        e.preventDefault()
        setFeedbackRecurso(null)
        const res = await registrarRecursoAdminAction({
            descargoId: descargo.id,
            tipoRecurso,
            codigoPresentacion: codigoRecurso,
            fechaPresentacion: fechaRecurso,
            autoridadDestino: autoridadRecurso,
            fundamentosRecurso,
            abogado: abogadoRecurso
        })
        if (res.success) {
            setFeedbackRecurso('Recurso administrativo registrado exitosamente.')
            reloadData()
            setTimeout(() => {
                setIsRecursoModalOpen(false)
                setFeedbackRecurso(null)
            }, 1000)
        } else {
            setFeedbackRecurso(res.error || 'Error al registrar recurso.')
        }
    }

    // Submit Proceso Judicial
    const handleSaveJudicial = async (e: React.FormEvent) => {
        e.preventDefault()
        setFeedbackJudicial(null)
        const res = await registrarProcesoJudicialAction({
            descargoId: descargo.id,
            tribunal,
            rolCausa,
            caratulado,
            fechaIngreso: fechaJudicial,
            estadoProcesal,
            abogadoExterno: abogadoJudicial,
            notas: notasJudicial
        })
        if (res.success) {
            setFeedbackJudicial('Proceso judicial registrado exitosamente.')
            reloadData()
            setTimeout(() => {
                setIsJudicialModalOpen(false)
                setFeedbackJudicial(null)
            }, 1000)
        } else {
            setFeedbackJudicial(res.error || 'Error al registrar proceso judicial.')
        }
    }

    return (
        <div className="space-y-6 max-w-[1700px] mx-auto p-2 sm:p-4">
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
                                DESCARGO FORMAL
                            </span>
                            <span className="text-slate-400 text-xs font-semibold">
                                {descargo.numeroResolucion}
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                            <span>{descargo.codigoIngreso}</span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium">
                                Estado: {descargo.estado.replace('_', ' ')}
                            </span>
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                            Fecha Ingreso: <strong>{descargo.fechaIngreso}</strong> · Plazo Legal: <strong>{descargo.diasPlazoLegal} días</strong> ({descargo.diasRestantes !== null ? `${descargo.diasRestantes} días restantes` : '-'}) · Abogado: <strong>{descargo.abogadoResponsable || 'No asignado'}</strong>
                        </p>
                    </div>

                    {/* Botones de Cabecera */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <Link
                            href={`/dashboard/areas/multas/ciclo-legal/expediente?folio=${folios[0]?.folio || ''}`}
                            className="px-3.5 py-2.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-sm"
                        >
                            <History className="w-4 h-4 text-cyan-400" />
                            <span>Ver Timeline</span>
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
                    </div>
                </div>
            </div>

            {/* TARJETAS RESUMEN ECONÓMICO DEL DESCARGO */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Folios Impugnados</span>
                    <p className="text-2xl font-black text-slate-900 mt-2">{folios.length}</p>
                    <span className="text-[10px] text-slate-400 mt-0.5">Actas incluidas</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-indigo-200 bg-indigo-50/20 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Monto Impugnado</span>
                    <p className="text-2xl font-black text-indigo-700 mt-2">{descargo.montoImpugnadoUtm.toFixed(2)} <span className="text-xs font-normal">UTM</span></p>
                    <span className="text-[10px] text-indigo-600 mt-0.5">Monto controvertido</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Monto Rebajado</span>
                    <p className="text-2xl font-black text-emerald-700 mt-2">{descargo.montoRebajadoUtm.toFixed(2)} <span className="text-xs font-normal">UTM</span></p>
                    <span className="text-[10px] text-emerald-600 mt-0.5">Ahorro conseguido</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-cyan-200 bg-cyan-50/30 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider">Tasa de Éxito</span>
                    <p className="text-2xl font-black text-cyan-800 mt-2">{descargo.porcentajeExito}%</p>
                    <span className="text-[10px] text-cyan-700 mt-0.5">Efectividad de defensa</span>
                </div>
            </div>

            {/* SELECTOR DE PESTAÑAS */}
            <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => setActiveTab('FOLIOS')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        activeTab === 'FOLIOS' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Folios Impugnados ({folios.length})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('RESUELVES')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        activeTab === 'RESUELVES' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Resuelves JUNAEB ({resuelves.length})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('RECURSOS')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        activeTab === 'RECURSOS' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <Scale className="w-4 h-4" />
                    <span>Recursos Administrativos ({recursos.length})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('JUDICIAL')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        activeTab === 'JUDICIAL' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <Gavel className="w-4 h-4" />
                    <span>Proceso Judicial ({procesos.length})</span>
                </button>
            </div>

            {/* CONTENIDO DE PESTAÑAS */}

            {/* PESTAÑA 1: FOLIOS IMPUGNADOS */}
            {activeTab === 'FOLIOS' && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                            Nómina de Actas y Folios en Controversia
                        </h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px]">
                            <thead>
                                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="py-3 px-3">Folio Acta</th>
                                    <th className="py-3 px-3">RBD</th>
                                    <th className="py-3 px-2 text-center">Aspecto</th>
                                    <th className="py-3 px-3">Fundamento Principal del Descargo</th>
                                    <th className="py-3 px-3 text-right">Notificado (UTM)</th>
                                    <th className="py-3 px-3 text-right">Impugnado (UTM)</th>
                                    <th className="py-3 px-3 text-right">Rebajado (UTM)</th>
                                    <th className="py-3 px-3 text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {folios.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-slate-400">
                                            No hay folios registrados en este descargo.
                                        </td>
                                    </tr>
                                ) : (
                                    folios.map(f => (
                                        <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{f.folio}</td>
                                            <td className="py-2.5 px-3 font-bold text-slate-700">{f.rbd ? `RBD ${f.rbd}` : '-'}</td>
                                            <td className="py-2.5 px-2 text-center">
                                                <span className="inline-block w-5 h-5 rounded bg-cyan-950 text-cyan-300 font-mono text-[10px] leading-5 font-bold">
                                                    {f.aspecto}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 max-w-[280px] truncate" title={f.argumentoPrincipal || ''}>
                                                {f.argumentoPrincipal || '-'}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">{f.montoNotificadoUtm.toFixed(2)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">{f.montoImpugnadoUtm.toFixed(2)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{f.montoRebajadoUtm.toFixed(2)}</td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                    {f.estado}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PESTAÑA 2: RESUELVES JUNAEB */}
            {activeTab === 'RESUELVES' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                            Resoluciones de Término / Fallos Emitidos por JUNAEB
                        </h3>
                        {canManage && (
                            <button
                                type="button"
                                onClick={() => setIsResuelveModalOpen(true)}
                                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Registrar Resuelve</span>
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {resuelves.length === 0 ? (
                            <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                <p className="font-bold text-slate-700">Aún no se ha registrado un Resuelve para este descargo</p>
                                <p className="text-xs text-slate-400 mt-0.5">Cuando JUNAEB notifique la resolución de respuesta, regístrala aquí para computar la rebaja.</p>
                            </div>
                        ) : (
                            resuelves.map(r => (
                                <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <div>
                                            <div className="font-extrabold text-sm text-slate-900">{r.numeroResolucion}</div>
                                            <div className="text-[10px] text-slate-400">Fecha REX: {r.fechaResolucion} · Notificado: {r.fechaNotificacion || '-'}</div>
                                        </div>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                            r.dictamen === 'ACOGIDO_TOTAL' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                            r.dictamen === 'ACOGIDO_PARCIAL' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                            'bg-rose-50 text-rose-800 border-rose-200'
                                        }`}>
                                            {r.dictamen.replace('_', ' ')}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-center p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-bold block uppercase">Ratificado</span>
                                            <span className="text-xs font-mono font-bold text-rose-700">{r.montoRatificadoUtm.toFixed(2)} UTM</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-bold block uppercase">Rebajado</span>
                                            <span className="text-xs font-mono font-bold text-emerald-700">{r.montoRebajadoUtm.toFixed(2)} UTM</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-bold block uppercase">% Éxito</span>
                                            <span className="text-xs font-mono font-black text-cyan-800">{r.porcentajeRebaja}%</span>
                                        </div>
                                    </div>

                                    {r.fundamentoResuelve && (
                                        <div className="text-xs text-slate-600 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 text-[11px] leading-relaxed">
                                            {r.fundamentoResuelve}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* PESTAÑA 3: RECURSOS ADMINISTRATIVOS */}
            {activeTab === 'RECURSOS' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                            Recursos Administrativos en Segunda Instancia
                        </h3>
                        {canManage && (
                            <button
                                type="button"
                                onClick={() => setIsRecursoModalOpen(true)}
                                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Interponer Recurso</span>
                            </button>
                        )}
                    </div>

                    <div className="space-y-3">
                        {recursos.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                                <Scale className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                <p className="font-bold text-slate-700">No se registran recursos administrativos interpuestos</p>
                            </div>
                        ) : (
                            recursos.map(rc => (
                                <div key={rc.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-cyan-800 font-bold text-xs uppercase px-2 py-0.5 rounded bg-cyan-50 border border-cyan-200">
                                                {rc.tipoRecurso}
                                            </span>
                                            <span className="font-extrabold text-sm text-slate-900">{rc.codigoPresentacion}</span>
                                            <span className="text-xs text-slate-400">• Fecha: {rc.fechaPresentacion}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 mt-1 max-w-xl">{rc.fundamentosRecurso || 'Sin fundamentos registrados.'}</p>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                        {rc.estado}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* PESTAÑA 4: PROCESO JUDICIAL */}
            {activeTab === 'JUDICIAL' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                            Causas Judiciales en Tribunales de Justicia
                        </h3>
                        {canManage && (
                            <button
                                type="button"
                                onClick={() => setIsJudicialModalOpen(true)}
                                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Registrar Causa Judicial</span>
                            </button>
                        )}
                    </div>

                    <div className="space-y-3">
                        {procesos.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                                <Gavel className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                <p className="font-bold text-slate-700">No hay procesos judiciales registrados para este descargo</p>
                            </div>
                        ) : (
                            procesos.map(pj => (
                                <div key={pj.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-extrabold text-sm text-slate-900">{pj.tribunal}</span>
                                            <span className="font-mono text-cyan-800 font-bold text-xs bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                                                Rol: {pj.rolCausa}
                                            </span>
                                        </div>
                                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                                            {pj.estadoProcesal}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600">{pj.caratulado || pj.notas || 'Sin notas del proceso.'}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* MODAL: REGISTRAR RESUELVE */}
            {isResuelveModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="font-extrabold text-base text-slate-900">Registrar Dictamen de Resuelve JUNAEB</h3>
                            <button type="button" onClick={() => setIsResuelveModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveResuelve} className="space-y-3 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 uppercase mb-1">N° Resolución de Respuesta (Resuelve) *</label>
                                <input
                                    type="text"
                                    required
                                    value={numRexResuelve}
                                    onChange={e => setNumRexResuelve(e.target.value)}
                                    placeholder="Ej: REX Resuelve N° 2104/2025"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 uppercase mb-1">Fecha Resolución *</label>
                                    <input
                                        type="date"
                                        required
                                        value={fechaResuelve}
                                        onChange={e => setFechaResuelve(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 uppercase mb-1">Dictamen *</label>
                                    <select
                                        value={dictamen}
                                        onChange={e => setDictamen(e.target.value as any)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                                    >
                                        <option value="ACOGIDO_PARCIAL">Acogido Parcialmente</option>
                                        <option value="ACOGIDO_TOTAL">Acogido Totalmente (100% Rebaja)</option>
                                        <option value="RECHAZADO">Rechazado (Mantiene Multa)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 uppercase mb-1">Monto Ratificado (UTM)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={montoRatificado}
                                        onChange={e => setMontoRatificado(parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 uppercase mb-1">Monto Rebajado / Descontado (UTM)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={montoRebajado}
                                        onChange={e => setMontoRebajado(parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 uppercase mb-1">Fundamentos del Resuelve</label>
                                <textarea
                                    rows={2}
                                    value={fundamentoResuelve}
                                    onChange={e => setFundamentoResuelve(e.target.value)}
                                    placeholder="Criterios expuestos por la autoridad en la resolución de término..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                                />
                            </div>

                            {feedbackResuelve && (
                                <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 font-semibold">
                                    {feedbackResuelve}
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button type="button" onClick={() => setIsResuelveModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl font-bold">
                                    Cancelar
                                </button>
                                <button type="submit" className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold">
                                    Guardar Resuelve
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: INTERPONER RECURSO */}
            {isRecursoModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="font-extrabold text-base text-slate-900">Interponer Recurso Administrativo</h3>
                            <button type="button" onClick={() => setIsRecursoModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveRecurso} className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 uppercase mb-1">Tipo de Recurso *</label>
                                    <select
                                        value={tipoRecurso}
                                        onChange={e => setTipoRecurso(e.target.value as any)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                                    >
                                        <option value="REPOSICION">Recurso de Reposición</option>
                                        <option value="JERARQUICO">Recurso Jerárquico</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 uppercase mb-1">Código Presentación *</label>
                                    <input
                                        type="text"
                                        required
                                        value={codigoRecurso}
                                        onChange={e => setCodigoRecurso(e.target.value)}
                                        placeholder="Ej: REC-2025-014"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 uppercase mb-1">Fecha Presentación *</label>
                                    <input
                                        type="date"
                                        required
                                        value={fechaRecurso}
                                        onChange={e => setFechaRecurso(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 uppercase mb-1">Autoridad Destino</label>
                                    <input
                                        type="text"
                                        value={autoridadRecurso}
                                        onChange={e => setAutoridadRecurso(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 uppercase mb-1">Fundamentos del Recurso</label>
                                <textarea
                                    rows={2}
                                    value={fundamentosRecurso}
                                    onChange={e => setFundamentosRecurso(e.target.value)}
                                    placeholder="Agravios y argumentos jurídicos de la impugnación..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                                />
                            </div>

                            {feedbackRecurso && (
                                <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 font-semibold">
                                    {feedbackRecurso}
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button type="button" onClick={() => setIsRecursoModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl font-bold">
                                    Cancelar
                                </button>
                                <button type="submit" className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold">
                                    Registrar Recurso
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: REGISTRAR CAUSA JUDICIAL */}
            {isJudicialModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="font-extrabold text-base text-slate-900">Registrar Causa en Tribunales</h3>
                            <button type="button" onClick={() => setIsJudicialModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveJudicial} className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 uppercase mb-1">Tribunal *</label>
                                    <input
                                        type="text"
                                        required
                                        value={tribunal}
                                        onChange={e => setTribunal(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 uppercase mb-1">Rol / Causa *</label>
                                    <input
                                        type="text"
                                        required
                                        value={rolCausa}
                                        onChange={e => setRolCausa(e.target.value)}
                                        placeholder="Ej: C-14522-2025"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 uppercase mb-1">Fecha Ingreso *</label>
                                    <input
                                        type="date"
                                        required
                                        value={fechaJudicial}
                                        onChange={e => setFechaJudicial(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 uppercase mb-1">Estado Procesal</label>
                                    <input
                                        type="text"
                                        value={estadoProcesal}
                                        onChange={e => setEstadoProcesal(e.target.value)}
                                        placeholder="Ej: DEMANDA, PRUEBA, APELACION"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 uppercase mb-1">Caratulado / Notas</label>
                                <textarea
                                    rows={2}
                                    value={caratulado}
                                    onChange={e => setCaratulado(e.target.value)}
                                    placeholder="Carátula de la causa judicial o notas de seguimiento..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                                />
                            </div>

                            {feedbackJudicial && (
                                <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 font-semibold">
                                    {feedbackJudicial}
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button type="button" onClick={() => setIsJudicialModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl font-bold">
                                    Cancelar
                                </button>
                                <button type="submit" className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold">
                                    Guardar Causa
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
