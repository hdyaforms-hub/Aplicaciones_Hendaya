'use client'

import React, { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import {
    PlanAccionDTO,
    ResumenPlanesDTO,
    getPlanesAccionListAction,
    generarPlanesAccionMasivosAction,
    getDiccionarioSolucionesAction,
    DiccionarioSolucionDTO
} from './actions'
import {
    CheckCircle2,
    Clock,
    AlertTriangle,
    Search,
    RefreshCw,
    FileSpreadsheet,
    FileText,
    TrendingUp,
    ChevronRight,
    Wrench,
    Sparkles,
    ShieldCheck,
    Check,
    AlertCircle,
    Building2,
    BookOpen
} from 'lucide-react'

interface Props {
    initialList: PlanAccionDTO[]
    initialResumen: ResumenPlanesDTO
    canManage: boolean
    userName: string
}

export default function SolucionesClient({
    initialList,
    initialResumen,
    canManage,
    userName
}: Props) {
    const [list, setList] = useState<PlanAccionDTO[]>(initialList)
    const [resumen, setResumen] = useState<ResumenPlanesDTO>(initialResumen)
    const [isPending, startTransition] = useTransition()

    // Filtros
    const [search, setSearch] = useState('')
    const [filtroEstado, setFiltroEstado] = useState('TODOS')
    const [filtroSucursal, setFiltroSucursal] = useState('TODAS')

    // Modales y Feedback
    const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
    const [isDiccionarioModalOpen, setIsDiccionarioModalOpen] = useState(false)
    const [diccionarioItems, setDiccionarioItems] = useState<DiccionarioSolucionDTO[]>([])
    const [loadingDicc, setLoadingDicc] = useState(false)

    // Lista de sucursales disponibles de la lista
    const sucursalesDisponibles = useMemo(() => {
        const sucs = new Set<string>()
        list.forEach(p => {
            if (p.sucursal) sucs.add(p.sucursal)
        })
        return Array.from(sucs).sort()
    }, [list])

    const reloadData = () => {
        startTransition(async () => {
            const res = await getPlanesAccionListAction()
            if (res.success && res.data) {
                setList(res.data)
                setResumen(res.resumen)
            }
        })
    }

    const handleGenerarPendientes = () => {
        if (!confirm('¿Deseas generar automáticamente los Planes de Acción para todas las actas con No Conformidades que aún no tengan plan registrado?')) {
            return
        }

        startTransition(async () => {
            const res = await generarPlanesAccionMasivosAction()
            if (res.success) {
                setFeedback({
                    tipo: 'success',
                    texto: `Se crearon ${res.creados} nuevos planes de acción (${res.existentes} ya existían).`
                })
                reloadData()
            } else {
                setFeedback({
                    tipo: 'error',
                    texto: res.error || 'Error al generar planes masivos.'
                })
            }
        })
    }

    const handleOpenDiccionario = async () => {
        setIsDiccionarioModalOpen(true)
        if (diccionarioItems.length === 0) {
            setLoadingDicc(true)
            const res = await getDiccionarioSolucionesAction()
            if (res.success) {
                setDiccionarioItems(res.data)
            }
            setLoadingDicc(false)
        }
    }

    // Filtrado
    const listFiltrada = useMemo(() => {
        return list.filter(p => {
            if (filtroEstado !== 'TODOS' && p.estado !== filtroEstado) return false
            if (filtroSucursal !== 'TODAS' && p.sucursal !== filtroSucursal) return false

            if (search.trim()) {
                const s = search.toLowerCase()
                const matchFolio = p.folio.toLowerCase().includes(s)
                const matchRbd = p.rbd ? String(p.rbd).includes(s) : false
                const matchLic = (p.licitacionNombre || '').toLowerCase().includes(s)
                const matchSuc = (p.sucursal || '').toLowerCase().includes(s)
                const matchResp = (p.responsableAsignado || '').toLowerCase().includes(s)
                if (!matchFolio && !matchRbd && !matchLic && !matchSuc && !matchResp) {
                    return false
                }
            }

            return true
        })
    }, [list, filtroEstado, filtroSucursal, search])

    return (
        <div className="space-y-6">
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

            {/* 5 TARJETAS DE KPIS OPERATIVOS (Modo Claro) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shrink-0">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Total Planes</p>
                        <h4 className="text-2xl font-black text-slate-900 mt-0.5">{resumen.totalPlanes}</h4>
                        <span className="text-[10px] text-slate-400">Actas con compromisos</span>
                    </div>
                </div>

                <div className="bg-white border border-amber-200 bg-amber-50/20 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] text-amber-800 font-bold uppercase tracking-wider">Pendientes</p>
                        <h4 className="text-2xl font-black text-amber-700 mt-0.5">{resumen.pendientes}</h4>
                        <span className="text-[10px] text-amber-600">Por iniciar en casino</span>
                    </div>
                </div>

                <div className="bg-white border border-sky-200 bg-sky-50/20 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 shrink-0">
                        <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] text-sky-800 font-bold uppercase tracking-wider">En Proceso</p>
                        <h4 className="text-2xl font-black text-sky-700 mt-0.5">{resumen.enProceso}</h4>
                        <span className="text-[10px] text-sky-600">Ejecución en terreno</span>
                    </div>
                </div>

                <div className="bg-white border border-indigo-200 bg-indigo-50/20 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] text-indigo-800 font-bold uppercase tracking-wider">Evidencia Subida</p>
                        <h4 className="text-2xl font-black text-indigo-700 mt-0.5">{resumen.evidenciaSubida}</h4>
                        <span className="text-[10px] text-indigo-600">Lista para validación</span>
                    </div>
                </div>

                <div className="bg-white border border-emerald-200 bg-emerald-50/20 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider">Cerrados / Éxito</p>
                        <h4 className="text-2xl font-black text-emerald-700 mt-0.5">{resumen.cerrados}</h4>
                        <span className="text-[10px] text-emerald-600">{resumen.efectividadGlobal}% subsanados</span>
                    </div>
                </div>
            </div>

            {/* BARRA DE ACCIONES Y FILTROS (Modo Claro) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Buscador */}
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por folio, RBD, sucursal, responsable o licitación..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-600 focus:bg-white transition-colors"
                        />
                    </div>

                    {/* Botones de acción principal */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={handleOpenDiccionario}
                            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-300 transition shadow-sm cursor-pointer"
                            title="Ver Diccionario de Soluciones Tipo Anexo 3"
                        >
                            <BookOpen className="w-3.5 h-3.5 text-cyan-600" />
                            <span>Pauta de Soluciones</span>
                        </button>

                        <button
                            type="button"
                            onClick={reloadData}
                            disabled={isPending}
                            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-300 transition shadow-sm cursor-pointer disabled:opacity-60"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-cyan-600' : 'text-slate-500'}`} />
                            <span>Actualizar</span>
                        </button>

                        {canManage && (
                            <button
                                type="button"
                                onClick={handleGenerarPendientes}
                                disabled={isPending}
                                className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-60"
                                title="Crear tareas pendientes para todas las actas con NC activas"
                            >
                                <Sparkles className="w-4 h-4" />
                                <span>Generar Planes Pendientes</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Filtros secundarios */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Estado del Plan</label>
                        <select
                            value={filtroEstado}
                            onChange={e => setFiltroEstado(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-cyan-600 focus:bg-white cursor-pointer"
                        >
                            <option value="TODOS">Todos los Estados</option>
                            <option value="PENDIENTE">Pendientes (sin iniciar)</option>
                            <option value="EN_PROCESO">En Proceso</option>
                            <option value="EVIDENCIA_SUBIDA">Evidencias Subidas</option>
                            <option value="VALIDADO">Validados</option>
                            <option value="CERRADO">Cerrados Formalmente</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Sucursal / Zona</label>
                        <select
                            value={filtroSucursal}
                            onChange={e => setFiltroSucursal(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-cyan-600 focus:bg-white cursor-pointer"
                        >
                            <option value="TODAS">Todas las Sucursales</option>
                            {sucursalesDisponibles.map(suc => (
                                <option key={suc} value={suc}>
                                    {suc}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-end">
                        <span className="text-xs text-slate-500 py-2">
                            Mostrando <strong className="text-slate-800">{listFiltrada.length}</strong> de {list.length} planes de acción
                        </span>
                    </div>
                </div>
            </div>

            {/* TABLA DE PLANES DE ACCIÓN (Modo Claro) */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                        <thead>
                            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                <th className="py-3 px-3">Folio Acta</th>
                                <th className="py-3 px-3">Establecimiento / RBD</th>
                                <th className="py-3 px-3">Sucursal / Licitación</th>
                                <th className="py-3 px-2 text-center">Prioridad</th>
                                <th className="py-3 px-3 text-center">Avance Subsanación</th>
                                <th className="py-3 px-3 text-center">Estado Plan</th>
                                <th className="py-3 px-3 text-center">Plazo Límite</th>
                                <th className="py-3 px-3 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {listFiltrada.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                        <p className="font-bold text-slate-700 text-sm">No hay planes de acción que coincidan con los filtros</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Usa el botón &quot;Generar Planes Pendientes&quot; para crear las tareas de actas con NC.</p>
                                    </td>
                                </tr>
                            ) : (
                                listFiltrada.map(p => {
                                    let badgePrioridad = (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                            {p.prioridad}
                                        </span>
                                    )
                                    if (p.prioridad === 'ALTA') {
                                        badgePrioridad = (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                                ALTA
                                            </span>
                                        )
                                    } else if (p.prioridad === 'MEDIA') {
                                        badgePrioridad = (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                MEDIA
                                            </span>
                                        )
                                    }

                                    let badgeEstado = (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                            {p.estado}
                                        </span>
                                    )
                                    if (p.estado === 'PENDIENTE') {
                                        badgeEstado = (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                Pendiente
                                            </span>
                                        )
                                    } else if (p.estado === 'EN_PROCESO') {
                                        badgeEstado = (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                                                En Proceso
                                            </span>
                                        )
                                    } else if (p.estado === 'EVIDENCIA_SUBIDA') {
                                        badgeEstado = (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1 justify-center">
                                                <ShieldCheck className="w-3 h-3 text-indigo-600" />
                                                Evidencias
                                            </span>
                                        )
                                    } else if (p.estado === 'VALIDADO' || p.estado === 'CERRADO') {
                                        badgeEstado = (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 justify-center">
                                                <Check className="w-3 h-3 text-emerald-600" />
                                                Cerrado
                                            </span>
                                        )
                                    }

                                    return (
                                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-3">
                                                <Link
                                                    href={`/dashboard/areas/multas/soluciones/${p.id}`}
                                                    className="font-mono font-bold text-cyan-700 hover:text-cyan-800 hover:underline"
                                                >
                                                    {p.folio}
                                                </Link>
                                                <div className="text-[10px] text-slate-400">Creado: {p.createdAt.split('T')[0]}</div>
                                            </td>

                                            <td className="py-3 px-3">
                                                <div className="font-bold text-slate-900">
                                                    {p.rbd ? `RBD ${p.rbd}` : 'Sin RBD'}
                                                </div>
                                                <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                                                    {p.licitacionNombre || '-'}
                                                </div>
                                            </td>

                                            <td className="py-3 px-3">
                                                <span className="font-semibold text-slate-700">{p.sucursal || 'Central'}</span>
                                            </td>

                                            <td className="py-3 px-2 text-center">{badgePrioridad}</td>

                                            <td className="py-3 px-3 text-center min-w-[130px]">
                                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-1">
                                                    <span>{p.itemsResueltos}/{p.totalItems} ítems</span>
                                                    <span>{p.porcentajeAvance}%</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-1.5 rounded-full ${
                                                            p.porcentajeAvance === 100 ? 'bg-emerald-500' : p.porcentajeAvance > 0 ? 'bg-cyan-500' : 'bg-slate-300'
                                                        }`}
                                                        style={{ width: `${p.porcentajeAvance}%` }}
                                                    />
                                                </div>
                                            </td>

                                            <td className="py-3 px-3 text-center">{badgeEstado}</td>

                                            <td className="py-3 px-3 text-center text-slate-600">
                                                {p.fechaCompromiso ? (
                                                    <span className="font-mono font-medium">{p.fechaCompromiso}</span>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>

                                            <td className="py-3 px-3 text-right">
                                                <Link
                                                    href={`/dashboard/areas/multas/soluciones/${p.id}`}
                                                    className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-xl text-xs font-bold inline-flex items-center gap-1 border border-cyan-200 transition"
                                                >
                                                    <span>Gestionar</span>
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

            {/* MODAL: DICCIONARIO DE SOLUCIONES TIPO ANEXO 3 (Modo Claro) */}
            {isDiccionarioModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl text-slate-800">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-cyan-600" />
                                    Pauta Institucional de Soluciones por Aspecto (Anexo 3)
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Catálogo de acciones correctivas estándar y evidencias requeridas para subsanar actas ante JUNAEB.
                                </p>
                            </div>
                            <button
                                onClick={() => setIsDiccionarioModalOpen(false)}
                                className="text-slate-400 hover:text-slate-700 text-lg font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {loadingDicc ? (
                            <div className="p-8 text-center text-slate-500">
                                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-600 mb-2" />
                                <span>Cargando catálogo de soluciones...</span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {diccionarioItems.map(item => (
                                    <div
                                        key={item.id}
                                        className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-cyan-100 text-cyan-800">
                                                    Aspecto {item.aspecto}
                                                </span>
                                                <span className="font-bold text-slate-900 text-xs">{item.tipoNC}</span>
                                            </div>
                                            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                                                Plazo: {item.plazoDiasEstandar} días
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-700 leading-relaxed font-sans">
                                            <strong className="text-slate-900">Acción Correctiva Estándar:</strong> {item.accionCorrectivaTipo}
                                        </p>

                                        <div className="text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-200/80">
                                            <strong className="text-slate-800">Evidencia de Respaldo Exigida:</strong> {item.evidenciaRequerida}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end pt-3 border-t border-slate-100">
                            <button
                                onClick={() => setIsDiccionarioModalOpen(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
