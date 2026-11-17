'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import {
    PlanAccionDTO,
    PlanAccionItemDTO,
    DiccionarioSolucionDTO,
    actualizarItemPlanAccionAction,
    cerrarPlanAccionAction,
    getPlanAccionDetalleAction
} from '../actions'
import {
    ArrowLeft,
    CheckCircle2,
    Clock,
    AlertTriangle,
    FileSpreadsheet,
    FileText,
    Wrench,
    Download,
    UploadCloud,
    RefreshCw,
    ShieldCheck,
    Check,
    AlertCircle,
    Building2,
    Calendar,
    User,
    Sparkles,
    ExternalLink
} from 'lucide-react'

interface Props {
    planInicial: PlanAccionDTO
    diccionarioSoluciones: DiccionarioSolucionDTO[]
    canManage: boolean
    userName: string
}

export default function DetallePlanClient({
    planInicial,
    diccionarioSoluciones,
    canManage,
    userName
}: Props) {
    const [plan, setPlan] = useState<PlanAccionDTO>(planInicial)
    const [isPending, startTransition] = useTransition()

    // Modales y Feedback
    const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
    const [itemEditando, setItemEditando] = useState<PlanAccionItemDTO | null>(null)
    const [formAccionTomada, setFormAccionTomada] = useState('')
    const [formEvidenciaUrl, setFormEvidenciaUrl] = useState('')
    const [formEvidenciaNombre, setFormEvidenciaNombre] = useState('')
    const [formEstadoItem, setFormEstadoItem] = useState<'PENDIENTE' | 'CORREGIDO' | 'VERIFICADO'>('CORREGIDO')

    const [isCerrarModalOpen, setIsCerrarModalOpen] = useState(false)
    const [observacionesCierre, setObservacionesCierre] = useState('')

    const reloadData = () => {
        startTransition(async () => {
            const res = await getPlanAccionDetalleAction(plan.id)
            if (res.success && res.data) {
                setPlan(res.data)
            }
        })
    }

    const openEditItemModal = (item: PlanAccionItemDTO) => {
        setItemEditando(item)
        setFormAccionTomada(item.accionTomada || '')
        setFormEvidenciaUrl(item.evidenciaUrl || '')
        setFormEvidenciaNombre(item.evidenciaNombre || '')
        setFormEstadoItem(item.estadoItem === 'VERIFICADO' ? 'VERIFICADO' : 'CORREGIDO')
    }

    const aplicarSugerenciaDiccionario = (aspecto: string) => {
        const encontrada = diccionarioSoluciones.find(d => d.aspecto.toUpperCase() === aspecto.toUpperCase())
        if (encontrada) {
            setFormAccionTomada(encontrada.accionCorrectivaTipo)
            if (!formEvidenciaNombre) {
                setFormEvidenciaNombre(encontrada.evidenciaRequerida || '')
            }
        }
    }

    const handleSaveItem = () => {
        if (!itemEditando || !formAccionTomada.trim()) {
            setFeedback({ tipo: 'error', texto: 'Debes registrar la acción correctiva ejecutada en terreno.' })
            return
        }

        startTransition(async () => {
            const res = await actualizarItemPlanAccionAction(itemEditando.id, {
                accionTomada: formAccionTomada.trim(),
                evidenciaUrl: formEvidenciaUrl.trim() || null,
                evidenciaNombre: formEvidenciaNombre.trim() || null,
                estadoItem: formEstadoItem
            })

            if (res.success) {
                setFeedback({ tipo: 'success', texto: 'Acción correctiva guardada exitosamente.' })
                setItemEditando(null)
                reloadData()
            } else {
                setFeedback({ tipo: 'error', texto: res.error || 'Error al guardar acción correctiva.' })
            }
        })
    }

    const handleCerrarPlan = () => {
        if (!observacionesCierre.trim()) {
            setFeedback({ tipo: 'error', texto: 'Ingresa las observaciones de validación o cierre formal.' })
            return
        }

        startTransition(async () => {
            const res = await cerrarPlanAccionAction(plan.id, {
                estado: 'CERRADO',
                observaciones: observacionesCierre.trim()
            })

            if (res.success) {
                setFeedback({ tipo: 'success', texto: 'Plan de acción validado y cerrado formalmente.' })
                setIsCerrarModalOpen(false)
                reloadData()
            } else {
                setFeedback({ tipo: 'error', texto: res.error || 'Error al cerrar el plan.' })
            }
        })
    }

    let badgeEstadoPlan = (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {plan.estado}
        </span>
    )
    if (plan.estado === 'PENDIENTE') {
        badgeEstadoPlan = (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                Pendiente de Inicio
            </span>
        )
    } else if (plan.estado === 'EN_PROCESO') {
        badgeEstadoPlan = (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
                En Proceso
            </span>
        )
    } else if (plan.estado === 'EVIDENCIA_SUBIDA') {
        badgeEstadoPlan = (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Evidencias Listas para Validación
            </span>
        )
    } else if (plan.estado === 'VALIDADO' || plan.estado === 'CERRADO') {
        badgeEstadoPlan = (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                Plan Cerrado y Subsanado
            </span>
        )
    }

    return (
        <div className="space-y-6">
            {/* Barra superior de navegación */}
            <div className="flex items-center justify-between">
                <Link
                    href="/dashboard/areas/multas/soluciones"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-cyan-700 transition"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Volver a la lista de planes</span>
                </Link>

                <div className="flex items-center gap-2">
                    <button
                        onClick={reloadData}
                        disabled={isPending}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-60"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-cyan-600' : 'text-slate-500'}`} />
                        <span>Actualizar</span>
                    </button>

                    <a
                        href={`/dashboard/areas/multas/soluciones/${plan.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-cyan-800 border border-cyan-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                        title="Descargar informe oficial en PDF para respaldo o entrega a JUNAEB"
                    >
                        <Download className="w-3.5 h-3.5 text-cyan-600" />
                        <span>Informe PDF</span>
                    </a>

                    {canManage && plan.estado !== 'CERRADO' && plan.estado !== 'VALIDADO' && (
                        <button
                            onClick={() => setIsCerrarModalOpen(true)}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Validar y Cerrar Plan</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Feedback Toast */}
            {feedback && (
                <div
                    className={`p-4 rounded-2xl flex items-center justify-between shadow-sm border transition-all ${
                        feedback.tipo === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        {feedback.tipo === 'success' ? (
                            <Check className="w-5 h-5 text-emerald-600" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-rose-600" />
                        )}
                        <span className="text-xs font-semibold">{feedback.texto}</span>
                    </div>
                    <button
                        onClick={() => setFeedback(null)}
                        className="text-xs opacity-75 hover:opacity-100 font-bold underline ml-4 cursor-pointer"
                    >
                        Cerrar
                    </button>
                </div>
            )}

            {/* FICHA RESUMEN DEL ACTA Y PLAN (Modo Claro) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xl text-slate-900">Acta Folio #{plan.folio}</span>
                            {badgeEstadoPlan}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            {plan.rbd ? `Establecimiento RBD ${plan.rbd}` : 'Establecimiento no asignado'} · {plan.licitacionNombre || 'Licitación estándar'}
                        </p>
                    </div>

                    <div className="flex items-center gap-6">
                        <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Avance Subsanación</span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xl font-black text-slate-900">{plan.itemsResueltos}/{plan.totalItems}</span>
                                <span className="text-xs font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-lg border border-cyan-200">
                                    {plan.porcentajeAvance}%
                                </span>
                            </div>
                        </div>

                        {plan.fechaCompromiso && (
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Fecha Compromiso</span>
                                <span className="text-xs font-mono font-bold text-slate-800 block mt-1">
                                    {plan.fechaCompromiso}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Datos complementarios */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                        <span className="text-slate-400 block text-[11px]">Sucursal Asignada</span>
                        <strong className="text-slate-800">{plan.sucursal || 'Casa Matriz / Central'}</strong>
                    </div>

                    <div>
                        <span className="text-slate-400 block text-[11px]">Responsable de Terreno</span>
                        <strong className="text-slate-800">{plan.responsableAsignado || 'Supervisor Zonal'}</strong>
                    </div>

                    <div>
                        <span className="text-slate-400 block text-[11px]">Prioridad Operativa</span>
                        <strong className="text-slate-800">{plan.prioridad}</strong>
                    </div>

                    <div>
                        <span className="text-slate-400 block text-[11px]">Fecha de Cierre</span>
                        <strong className="text-slate-800">{plan.fechaCierre || 'Pendiente'}</strong>
                    </div>
                </div>

                {plan.observacionesCierre && (
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs text-slate-700">
                        <strong className="text-slate-900">Observaciones de Validación y Cierre:</strong>{' '}
                        {plan.observacionesCierre}
                    </div>
                )}
            </div>

            {/* LISTADO DE ÍTEMS DE NO CONFORMIDADES (Modo Claro) */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Acciones Correctivas y Medidas por Aspecto Sancionado ({plan.items?.length || 0})
                    </h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {(!plan.items || plan.items.length === 0) ? (
                        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center text-slate-400">
                            <p className="font-bold text-slate-700">No hay no conformidades registradas en este plan.</p>
                        </div>
                    ) : (
                        plan.items.map(item => {
                            let badgeItem = (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    {item.estadoItem}
                                </span>
                            )
                            if (item.estadoItem === 'CORREGIDO') {
                                badgeItem = (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1">
                                        <Wrench className="w-3 h-3 text-sky-600" />
                                        Subsanado en Terreno
                                    </span>
                                )
                            } else if (item.estadoItem === 'VERIFICADO') {
                                badgeItem = (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                        <Check className="w-3 h-3 text-emerald-600" />
                                        Evidencia Verificada
                                    </span>
                                )
                            } else {
                                badgeItem = (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                        Pendiente
                                    </span>
                                )
                            }

                            return (
                                <div
                                    key={item.id}
                                    className="bg-white border border-slate-200 hover:border-cyan-300 rounded-3xl p-5 shadow-sm space-y-3 transition-all"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="px-3 py-1 rounded-xl text-xs font-black bg-cyan-50 text-cyan-800 border border-cyan-200">
                                                Aspecto {item.aspecto}
                                            </span>
                                            {badgeItem}
                                        </div>

                                        <button
                                            onClick={() => openEditItemModal(item)}
                                            className="px-3 py-1.5 bg-slate-50 hover:bg-cyan-50 text-slate-700 hover:text-cyan-800 border border-slate-200 hover:border-cyan-200 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                                        >
                                            <Wrench className="w-3.5 h-3.5 text-cyan-600" />
                                            <span>{item.accionTomada ? 'Modificar Acción' : 'Registrar Acción y Evidencia'}</span>
                                        </button>
                                    </div>

                                    {/* Hallazgo original */}
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs text-slate-700 space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                            Hallazgo Detectado en Fiscalización:
                                        </span>
                                        <p className="font-medium text-slate-800 leading-relaxed font-sans">
                                            {item.hallazgoDetectado}
                                        </p>
                                    </div>

                                    {/* Acción tomada */}
                                    {item.accionTomada ? (
                                        <div className="bg-emerald-50/40 p-3 rounded-2xl border border-emerald-200/70 text-xs space-y-1">
                                            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center justify-between">
                                                <span>Acción Correctiva Ejecutada en Terreno:</span>
                                                {item.ejecutadoPor && (
                                                    <span className="text-[10px] font-normal text-slate-500">
                                                        Por: {item.ejecutadoPor} · {item.fechaEjecucion || ''}
                                                    </span>
                                                )}
                                            </span>
                                            <p className="font-semibold text-slate-900 leading-relaxed font-sans">
                                                {item.accionTomada}
                                            </p>

                                            {item.evidenciaNombre && (
                                                <div className="pt-1.5 flex items-center gap-2 text-[11px] text-slate-600">
                                                    <UploadCloud className="w-3.5 h-3.5 text-emerald-700" />
                                                    <span><strong>Evidencia de Respaldo:</strong> {item.evidenciaNombre}</span>
                                                    {item.evidenciaUrl && (
                                                        <a
                                                            href={item.evidenciaUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-cyan-700 hover:underline flex items-center gap-0.5 ml-1"
                                                        >
                                                            <span>Ver archivo</span>
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-amber-700 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60 flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span>Pendiente de implementar y documentar la medida correctiva en casino.</span>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* MODAL: REGISTRAR / MODIFICAR ACCIÓN E ÍTEM (Modo Claro) */}
            {itemEditando && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl p-6 space-y-4 shadow-2xl text-slate-800">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                <Wrench className="w-5 h-5 text-cyan-600" />
                                Subsanar Aspecto {itemEditando.aspecto}
                            </h3>
                            <button
                                onClick={() => setItemEditando(null)}
                                className="text-slate-400 hover:text-slate-700 text-lg font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                    Hallazgo a Corregir:
                                </span>
                                <p className="text-slate-800 font-medium">{itemEditando.hallazgoDetectado}</p>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                        Acción Correctiva Implementada *
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => aplicarSugerenciaDiccionario(itemEditando.aspecto)}
                                        className="text-[11px] font-bold text-cyan-700 hover:text-cyan-800 flex items-center gap-1 cursor-pointer"
                                        title="Copiar texto estándar del Anexo 3"
                                    >
                                        <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                                        <span>Usar Pauta Oficial Anexo 3</span>
                                    </button>
                                </div>
                                <textarea
                                    rows={4}
                                    value={formAccionTomada}
                                    onChange={e => setFormAccionTomada(e.target.value)}
                                    placeholder="Describe la medida técnica/operativa ejecutada en el establecimiento..."
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 leading-relaxed font-sans focus:bg-white focus:border-cyan-600"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-slate-600 font-bold uppercase tracking-wider text-[10px] block mb-1">
                                        Nombre / Tipo de Evidencia
                                    </label>
                                    <input
                                        type="text"
                                        value={formEvidenciaNombre}
                                        onChange={e => setFormEvidenciaNombre(e.target.value)}
                                        placeholder="Ej: Foto calibración, Guía reposición, etc."
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:bg-white focus:border-cyan-600"
                                    />
                                </div>

                                <div>
                                    <label className="text-slate-600 font-bold uppercase tracking-wider text-[10px] block mb-1">
                                        Estado de la Medida
                                    </label>
                                    <select
                                        value={formEstadoItem}
                                        onChange={e => setFormEstadoItem(e.target.value as any)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:bg-white focus:border-cyan-600 cursor-pointer"
                                    >
                                        <option value="CORREGIDO">Corregido en Casino</option>
                                        <option value="VERIFICADO">Verificado con Respaldo</option>
                                        <option value="PENDIENTE">Aún Pendiente</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-slate-600 font-bold uppercase tracking-wider text-[10px] block mb-1">
                                    Enlace / URL de Evidencia (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={formEvidenciaUrl}
                                    onChange={e => setFormEvidenciaUrl(e.target.value)}
                                    placeholder="https://... o ruta del archivo de respaldo"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:bg-white focus:border-cyan-600"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => setItemEditando(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveItem}
                                disabled={isPending}
                                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer"
                            >
                                {isPending ? 'Guardando...' : 'Guardar Acción Correctiva'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: VALIDAR Y CERRAR PLAN FORMALMENTE (Modo Claro) */}
            {isCerrarModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl text-slate-800">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                Validar y Cerrar Plan de Acción
                            </h3>
                            <button
                                onClick={() => setIsCerrarModalOpen(false)}
                                className="text-slate-400 hover:text-slate-700 text-lg font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            <p className="text-slate-600 leading-relaxed">
                                Esta acción certifica que las medidas correctivas y evidencias de respaldo han sido revisadas y cumplen con los requisitos de la Instrucción de Trabajo JUNAEB.
                            </p>

                            <div>
                                <label className="text-slate-600 font-bold uppercase tracking-wider text-[10px] block mb-1">
                                    Observaciones de Cierre / Dictamen Interno *
                                </label>
                                <textarea
                                    rows={4}
                                    value={observacionesCierre}
                                    onChange={e => setObservacionesCierre(e.target.value)}
                                    placeholder="Ej: Se validaron fotografías de pesaje, balanza calibrada y reposición conforme de insumos..."
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 leading-relaxed font-sans focus:bg-white focus:border-cyan-600"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => setIsCerrarModalOpen(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCerrarPlan}
                                disabled={isPending}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer"
                            >
                                {isPending ? 'Cerrando...' : 'Confirmar Cierre del Plan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
