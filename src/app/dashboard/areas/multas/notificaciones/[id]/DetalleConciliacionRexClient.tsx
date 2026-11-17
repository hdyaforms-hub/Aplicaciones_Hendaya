'use client'

import React, { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import {
    NotificacionRexCabDTO,
    NotificacionRexItemDTO,
    ResumenEstadisticoConciliacion,
    conciliarNotificacionRexAction,
    updateClasificacionItemAction,
    getNotificacionDetalleAction
} from '../actions'
import {
    ArrowLeft,
    FileSpreadsheet,
    RefreshCw,
    Download,
    CheckCircle2,
    AlertTriangle,
    ShieldAlert,
    Copy,
    EyeOff,
    Check,
    Search,
    Filter,
    Edit3,
    X,
    FileText,
    ArrowUpDown,
    HelpCircle,
    Info
} from 'lucide-react'

interface Props {
    cabecera: NotificacionRexCabDTO
    initialItems: NotificacionRexItemDTO[]
    initialResumen: ResumenEstadisticoConciliacion
    canManage: boolean
}

export default function DetalleConciliacionRexClient({ cabecera: initialCabecera, initialItems, initialResumen, canManage }: Props) {
    const [cabecera, setCabecera] = useState<NotificacionRexCabDTO>(initialCabecera)
    const [items, setItems] = useState<NotificacionRexItemDTO[]>(initialItems)
    const [resumen, setResumen] = useState<ResumenEstadisticoConciliacion>(initialResumen)
    const [isPending, startTransition] = useTransition()

    // Filtros
    const [search, setSearch] = useState('')
    const [filtroEstado, setFiltroEstado] = useState('TODOS')
    const [filtroAspecto, setFiltroAspecto] = useState('TODOS')
    const [filtroClasificacion, setFiltroClasificacion] = useState('TODOS')

    // Modal de Clasificación
    const [modalItem, setModalItem] = useState<NotificacionRexItemDTO | null>(null)
    const [clasifError, setClasifError] = useState<'ERROR_JUNAEB' | 'ERROR_INTERNO' | 'EN_REVISION' | 'ACEPTADO'>('ERROR_JUNAEB')
    const [motivoClasif, setMotivoClasif] = useState('')
    const [clasifSaving, setClasifSaving] = useState(false)
    const [clasifFeedback, setClasifFeedback] = useState<string | null>(null)

    // Recargar datos
    const reloadData = () => {
        startTransition(async () => {
            const res = await getNotificacionDetalleAction(cabecera.id)
            if (res.success && res.cabecera && res.items && res.resumen) {
                setCabecera(res.cabecera)
                setItems(res.items)
                setResumen(res.resumen)
            }
        })
    }

    // Ejecutar Conciliación Automática
    const handleEjecutarConciliacion = () => {
        startTransition(async () => {
            const res = await conciliarNotificacionRexAction(cabecera.id)
            if (res.success) {
                reloadData()
            } else {
                alert(res.error || 'Ocurrió un error al ejecutar la conciliación.')
            }
        })
    }

    // Abrir modal de clasificación
    const handleOpenClasifModal = (item: NotificacionRexItemDTO) => {
        setModalItem(item)
        setClasifError(item.clasificacionError || 'ERROR_JUNAEB')
        setMotivoClasif(item.motivoClasificacion || '')
        setClasifFeedback(null)
    }

    // Guardar clasificación
    const handleSaveClasificacion = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!modalItem) return
        setClasifSaving(true)
        setClasifFeedback(null)

        const res = await updateClasificacionItemAction({
            itemId: modalItem.id,
            clasificacionError: clasifError,
            motivoClasificacion: motivoClasif
        })

        setClasifSaving(false)
        if (res.success) {
            setClasifFeedback('Clasificación guardada exitosamente.')
            reloadData()
            setTimeout(() => {
                setModalItem(null)
                setClasifFeedback(null)
            }, 1000)
        } else {
            setClasifFeedback(res.error || 'Error al guardar la clasificación.')
        }
    }

    // Exportar a Excel (Anexo 1 Conciliado Oficial Hendaya)
    const handleExportExcel = () => {
        try {
            const headers = [
                'Folio Acta',
                'RBD',
                'Establecimiento',
                'Sucursal',
                'Fecha Supervisión',
                'Aspecto',
                'Infracción / Detalle',
                'Monto Notificado JUNAEB (UTM)',
                'Monto Calculado Hendaya (UTM)',
                'Diferencia (UTM)',
                'Estado Conciliación',
                'Clasificación',
                'Motivo Justificación',
                'Resolución Anterior (Si Duplicado)',
                'Clasificado Por',
                'Fecha Clasificación'
            ]

            const rows = filteredItems.map(i => [
                `"${i.folio}"`,
                i.rbd || '',
                `"${(i.establecimiento || '').replace(/"/g, '""')}"`,
                `"${(i.sucursal || '').replace(/"/g, '""')}"`,
                `"${i.fechaSupervision || ''}"`,
                `"${i.aspecto}"`,
                `"${(i.infraccionDetalle || '').replace(/"/g, '""')}"`,
                i.montoNotificado.toFixed(3),
                i.montoCalculado.toFixed(3),
                i.diferenciaMonto.toFixed(3),
                `"${i.estadoConciliacion}"`,
                `"${i.clasificacionError || ''}"`,
                `"${(i.motivoClasificacion || '').replace(/"/g, '""')}"`,
                `"${i.resolucionAnterior || ''}"`,
                `"${i.clasificadoPor || ''}"`,
                `"${i.clasificadoEn || ''}"`
            ])

            const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n')
            const encodedUri = encodeURI(csvContent)
            const link = document.createElement('a')
            link.setAttribute('href', encodedUri)
            link.setAttribute('download', `anexo1_conciliado_${cabecera.numeroResolucion.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } catch (err: any) {
            console.error('Error al exportar Anexo 1:', err)
            alert('Ocurrió un error al exportar el Anexo 1 a Excel.')
        }
    }

    // Filtrar items
    const filteredItems = useMemo(() => {
        return items.filter(i => {
            if (filtroEstado !== 'TODOS' && i.estadoConciliacion !== filtroEstado) return false
            if (filtroAspecto !== 'TODOS' && i.aspecto.toUpperCase() !== filtroAspecto.toUpperCase()) return false
            if (filtroClasificacion !== 'TODOS') {
                if (filtroClasificacion === 'PENDIENTES' && i.clasificacionError) return false
                if (filtroClasificacion !== 'PENDIENTES' && i.clasificacionError !== filtroClasificacion) return false
            }
            if (search.trim()) {
                const term = search.trim().toLowerCase()
                const matchFolio = i.folio.toLowerCase().includes(term)
                const matchRbd = String(i.rbd || '').includes(term)
                const matchEstab = (i.establecimiento || '').toLowerCase().includes(term)
                const matchInf = (i.infraccionDetalle || '').toLowerCase().includes(term)
                const matchMotivo = (i.motivoClasificacion || '').toLowerCase().includes(term)
                if (!matchFolio && !matchRbd && !matchEstab && !matchInf && !matchMotivo) return false
            }
            return true
        })
    }, [items, filtroEstado, filtroAspecto, filtroClasificacion, search])

    const aspectosDisponibles = Array.from(new Set(items.map(i => i.aspecto.toUpperCase()))).sort()

    return (
        <div className="space-y-6 max-w-[1700px] mx-auto p-2 sm:p-4">
            {/* CABECERA CORPORATIVA OFICIAL HENDAYA */}
            <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-700/60 overflow-hidden">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Link
                                href="/dashboard/areas/multas/notificaciones"
                                className="text-cyan-400 hover:text-cyan-300 text-xs font-bold flex items-center gap-1 transition"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Volver a Notificaciones</span>
                            </Link>
                            <span className="text-slate-500 text-xs">•</span>
                            <span className="font-mono text-cyan-400 font-extrabold tracking-widest text-xs uppercase px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60">
                                CONCILIACIÓN REX
                            </span>
                            <span className="text-slate-400 text-xs font-semibold">
                                {cabecera.licitacionNombre || (cabecera.licitacionId ? `Licitación #${cabecera.licitacionId}` : '')}
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                            <span>{cabecera.numeroResolucion}</span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium">
                                Período: {cabecera.periodoMes}/{cabecera.periodoAnio}
                            </span>
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                            Cruce fila por fila entre la resolución oficial de JUNAEB y el cálculo interno de Hendaya. Clasifica los errores para generar la contrapropuesta del Anexo 1.
                        </p>
                    </div>

                    {/* Botones de Cabecera */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            type="button"
                            onClick={reloadData}
                            disabled={isPending}
                            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-sm disabled:opacity-60 cursor-pointer"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-cyan-400' : 'text-slate-300'}`} />
                            <span>Actualizar</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleExportExcel}
                            className="px-3.5 py-2.5 bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-sm cursor-pointer"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Exportar Anexo 1</span>
                        </button>

                        {canManage && (
                            <button
                                type="button"
                                onClick={handleEjecutarConciliacion}
                                disabled={isPending}
                                className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-md disabled:opacity-60 cursor-pointer"
                            >
                                <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
                                <span>{isPending ? 'Conciliando...' : 'Re-ejecutar Conciliación'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 5 TARJETAS DE CONCILIACIÓN */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
                {/* 1. Coinciden */}
                <div
                    onClick={() => setFiltroEstado(filtroEstado === 'COINCIDE' ? 'TODOS' : 'COINCIDE')}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                        filtroEstado === 'COINCIDE' ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300' : 'bg-white border-slate-200 hover:border-emerald-300'
                    }`}
                >
                    <span className="text-[10.5px] font-bold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
                        <span>Coinciden</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </span>
                    <p className="text-2xl font-black text-emerald-700 mt-2">{resumen.coinciden}</p>
                    <span className="text-[10px] text-emerald-600 mt-1">Montos idénticos a JUNAEB</span>
                </div>

                {/* 2. Diferencia de Monto */}
                <div
                    onClick={() => setFiltroEstado(filtroEstado === 'DIFERENCIA_MONTO' ? 'TODOS' : 'DIFERENCIA_MONTO')}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                        filtroEstado === 'DIFERENCIA_MONTO' ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300' : 'bg-white border-slate-200 hover:border-amber-300'
                    }`}
                >
                    <span className="text-[10.5px] font-bold text-amber-700 uppercase tracking-wider flex items-center justify-between">
                        <span>Diferencia Monto</span>
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </span>
                    <p className="text-2xl font-black text-amber-700 mt-2">{resumen.diferenciasMonto}</p>
                    <span className="text-[10px] text-amber-600 mt-1">Divergencia en la fórmula</span>
                </div>

                {/* 3. Solo JUNAEB */}
                <div
                    onClick={() => setFiltroEstado(filtroEstado === 'SOLO_JUNAEB' ? 'TODOS' : 'SOLO_JUNAEB')}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                        filtroEstado === 'SOLO_JUNAEB' ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-300' : 'bg-white border-slate-200 hover:border-rose-300'
                    }`}
                >
                    <span className="text-[10.5px] font-bold text-rose-700 uppercase tracking-wider flex items-center justify-between">
                        <span>Solo JUNAEB</span>
                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                    </span>
                    <p className="text-2xl font-black text-rose-700 mt-2">{resumen.soloJunaeb}</p>
                    <span className="text-[10px] text-rose-600 mt-1">Imputadas sin acta / conforme</span>
                </div>

                {/* 4. No Incluidos */}
                <div
                    onClick={() => setFiltroEstado(filtroEstado === 'NO_INCLUIDO' ? 'TODOS' : 'NO_INCLUIDO')}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                        filtroEstado === 'NO_INCLUIDO' ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-300' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                >
                    <span className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                        <span>No Incluidos</span>
                        <EyeOff className="w-4 h-4 text-slate-500" />
                    </span>
                    <p className="text-2xl font-black text-slate-700 mt-2">{resumen.noIncluidos}</p>
                    <span className="text-[10px] text-slate-500 mt-1">Omitidos en REX por JUNAEB</span>
                </div>

                {/* 5. Folios Repetidos */}
                <div
                    onClick={() => setFiltroEstado(filtroEstado === 'FOLIO_REPETIDO' ? 'TODOS' : 'FOLIO_REPETIDO')}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                        filtroEstado === 'FOLIO_REPETIDO' ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-300' : 'bg-white border-slate-200 hover:border-purple-300'
                    }`}
                >
                    <span className="text-[10.5px] font-bold text-purple-700 uppercase tracking-wider flex items-center justify-between">
                        <span>Duplicados</span>
                        <Copy className="w-4 h-4 text-purple-600" />
                    </span>
                    <p className="text-2xl font-black text-purple-700 mt-2">{resumen.foliosRepetidos}</p>
                    <span className="text-[10px] text-purple-600 mt-1">Ya cobrados en REX previas</span>
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
                        placeholder="Buscar por folio, RBD, colegio, motivo..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
                    {/* Filtro Estado */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <span>Estado:</span>
                        <select
                            value={filtroEstado}
                            onChange={e => setFiltroEstado(e.target.value)}
                            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        >
                            <option value="TODOS">Todos ({items.length})</option>
                            <option value="COINCIDE">Coinciden ({resumen.coinciden})</option>
                            <option value="DIFERENCIA_MONTO">Diferencia Monto ({resumen.diferenciasMonto})</option>
                            <option value="SOLO_JUNAEB">Solo JUNAEB ({resumen.soloJunaeb})</option>
                            <option value="NO_INCLUIDO">No Incluidos ({resumen.noIncluidos})</option>
                            <option value="FOLIO_REPETIDO">Duplicados ({resumen.foliosRepetidos})</option>
                        </select>
                    </div>

                    {/* Filtro Aspecto */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <span>Aspecto:</span>
                        <select
                            value={filtroAspecto}
                            onChange={e => setFiltroAspecto(e.target.value)}
                            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        >
                            <option value="TODOS">Todos</option>
                            {aspectosDisponibles.map(a => (
                                <option key={a} value={a}>Aspecto {a}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Clasificación */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <span>Clasificación:</span>
                        <select
                            value={filtroClasificacion}
                            onChange={e => setFiltroClasificacion(e.target.value)}
                            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        >
                            <option value="TODOS">Todas</option>
                            <option value="ERROR_JUNAEB">Error JUNAEB</option>
                            <option value="ERROR_INTERNO">Error Interno</option>
                            <option value="EN_REVISION">En Revisión</option>
                            <option value="ACEPTADO">Aceptado</option>
                            <option value="PENDIENTES">Sin Clasificar</option>
                        </select>
                    </div>

                    {/* Limpiar Filtros */}
                    {(filtroEstado !== 'TODOS' || filtroAspecto !== 'TODOS' || filtroClasificacion !== 'TODOS' || search) && (
                        <button
                            type="button"
                            onClick={() => {
                                setFiltroEstado('TODOS')
                                setFiltroAspecto('TODOS')
                                setFiltroClasificacion('TODOS')
                                setSearch('')
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1"
                            title="Limpiar filtros"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>Limpiar</span>
                        </button>
                    )}
                </div>
            </div>

            {/* TABLA DE CONCILIACIÓN FILA POR FILA */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-slate-800">
                        Mostrando <strong className="text-cyan-700">{filteredItems.length}</strong> de <strong className="text-slate-900">{items.length}</strong> infracciones
                    </span>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>Total Hendaya: <strong className="font-mono text-emerald-700">{filteredItems.reduce((acc, i) => acc + i.montoCalculado, 0).toFixed(2)} UTM</strong></span>
                        <span>•</span>
                        <span>Total JUNAEB: <strong className="font-mono text-rose-700">{filteredItems.reduce((acc, i) => acc + i.montoNotificado, 0).toFixed(2)} UTM</strong></span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                        <thead>
                            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                <th className="py-3 px-3">Folio Acta</th>
                                <th className="py-3 px-3">RBD / Establecimiento</th>
                                <th className="py-3 px-2 text-center">Aspecto</th>
                                <th className="py-3 px-3">Infracción Consignada</th>
                                <th className="py-3 px-3 text-right">JUNAEB (UTM)</th>
                                <th className="py-3 px-3 text-right">Hendaya (UTM)</th>
                                <th className="py-3 px-3 text-right">Diferencia</th>
                                <th className="py-3 px-3 text-center">Estado Conciliación</th>
                                <th className="py-3 px-3">Clasificación / Motivo</th>
                                {canManage && <th className="py-3 px-3 text-center">Acción</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={canManage ? 10 : 9} className="py-12 text-center text-slate-400">
                                        <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                        <p className="font-bold text-slate-700">No se encontraron items con los filtros aplicados</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map(item => {
                                    // Badge Estado Conciliación
                                    let badgeEstadoClass = 'bg-slate-100 text-slate-700 border-slate-200'
                                    let badgeEstadoText: string = item.estadoConciliacion
                                    if (item.estadoConciliacion === 'COINCIDE') {
                                        badgeEstadoClass = 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
                                        badgeEstadoText = '✓ Coincide'
                                    } else if (item.estadoConciliacion === 'DIFERENCIA_MONTO') {
                                        badgeEstadoClass = 'bg-amber-50 text-amber-800 border-amber-200 font-bold'
                                        badgeEstadoText = '⚠️ Diferencia'
                                    } else if (item.estadoConciliacion === 'SOLO_JUNAEB') {
                                        badgeEstadoClass = 'bg-rose-50 text-rose-800 border-rose-200 font-bold'
                                        badgeEstadoText = '✕ Solo JUNAEB'
                                    } else if (item.estadoConciliacion === 'NO_INCLUIDO') {
                                        badgeEstadoClass = 'bg-slate-100 text-slate-700 border-slate-300 font-bold'
                                        badgeEstadoText = '👁️ Omitido REX'
                                    } else if (item.estadoConciliacion === 'FOLIO_REPETIDO') {
                                        badgeEstadoClass = 'bg-purple-50 text-purple-800 border-purple-200 font-bold'
                                        badgeEstadoText = '🔁 Duplicado'
                                    }

                                    // Badge Clasificación
                                    let badgeClasifClass = 'bg-slate-50 text-slate-500 border-slate-200'
                                    if (item.clasificacionError === 'ERROR_JUNAEB') badgeClasifClass = 'bg-cyan-50 text-cyan-800 border-cyan-200 font-bold'
                                    else if (item.clasificacionError === 'ERROR_INTERNO') badgeClasifClass = 'bg-rose-50 text-rose-800 border-rose-200 font-bold'
                                    else if (item.clasificacionError === 'EN_REVISION') badgeClasifClass = 'bg-amber-50 text-amber-800 border-amber-200 font-bold'
                                    else if (item.clasificacionError === 'ACEPTADO') badgeClasifClass = 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                            {/* Folio */}
                                            <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-900">
                                                {item.folio}
                                            </td>

                                            {/* RBD / Establecimiento */}
                                            <td className="py-2.5 px-3">
                                                <div className="font-bold text-slate-800">
                                                    {item.rbd ? `RBD ${item.rbd}` : '-'}
                                                </div>
                                                {item.establecimiento && (
                                                    <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={item.establecimiento}>
                                                        {item.establecimiento}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Aspecto */}
                                            <td className="py-2.5 px-2 text-center whitespace-nowrap">
                                                <span className="inline-block w-6 h-6 rounded-lg bg-cyan-950/80 text-cyan-300 font-mono font-extrabold text-xs leading-6 border border-cyan-800/60">
                                                    {item.aspecto}
                                                </span>
                                            </td>

                                            {/* Infracción */}
                                            <td className="py-2.5 px-3">
                                                <div className="text-[10.5px] text-slate-700 max-w-[220px] line-clamp-2" title={item.infraccionDetalle || ''}>
                                                    {item.infraccionDetalle || '-'}
                                                </div>
                                                {item.resolucionAnterior && (
                                                    <div className="text-[9.5px] text-purple-700 font-semibold mt-0.5">
                                                        Ya imputado en: {item.resolucionAnterior}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Monto JUNAEB */}
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                                                {item.montoNotificado.toFixed(3)}
                                            </td>

                                            {/* Monto Hendaya */}
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                                                {item.montoCalculado.toFixed(3)}
                                            </td>

                                            {/* Diferencia */}
                                            <td className="py-2.5 px-3 text-right font-mono font-black whitespace-nowrap">
                                                <span className={item.diferenciaMonto > 0 ? 'text-cyan-800' : item.diferenciaMonto < 0 ? 'text-amber-700' : 'text-slate-400'}>
                                                    {item.diferenciaMonto > 0 ? `+${item.diferenciaMonto.toFixed(3)}` : item.diferenciaMonto.toFixed(3)}
                                                </span>
                                            </td>

                                            {/* Estado Conciliación */}
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border ${badgeEstadoClass}`}>
                                                    {badgeEstadoText}
                                                </span>
                                            </td>

                                            {/* Clasificación / Motivo */}
                                            <td className="py-2.5 px-3">
                                                {item.clasificacionError ? (
                                                    <div>
                                                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] border ${badgeClasifClass}`}>
                                                            {item.clasificacionError.replace('_', ' ')}
                                                        </span>
                                                        <div className="text-[10px] text-slate-600 truncate max-w-[180px] mt-0.5" title={item.motivoClasificacion || ''}>
                                                            {item.motivoClasificacion}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic">Sin clasificar</span>
                                                )}
                                            </td>

                                            {/* Acción */}
                                            {canManage && (
                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenClasifModal(item)}
                                                        className="p-1.5 bg-slate-100 hover:bg-cyan-50 text-slate-600 hover:text-cyan-700 rounded-lg transition"
                                                        title="Clasificar discrepancia / justificar"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DE CLASIFICACIÓN DE DISCREPANCIA */}
            {modalItem && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div>
                                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                                    <span>Clasificar Discrepancia</span>
                                    <span className="font-mono text-cyan-700 text-xs">Folio #{modalItem.folio}</span>
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Aspecto {modalItem.aspecto} · {modalItem.rbd ? `RBD ${modalItem.rbd}` : ''} {modalItem.establecimiento || ''}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalItem(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Comparación de montos */}
                        <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                            <div>
                                <span className="text-[10px] text-slate-500 font-bold block uppercase">Notificado</span>
                                <span className="text-sm font-mono font-bold text-rose-700">{modalItem.montoNotificado.toFixed(3)} UTM</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-500 font-bold block uppercase">Calculado</span>
                                <span className="text-sm font-mono font-bold text-emerald-700">{modalItem.montoCalculado.toFixed(3)} UTM</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-500 font-bold block uppercase">Diferencia</span>
                                <span className="text-sm font-mono font-black text-cyan-800">
                                    {modalItem.diferenciaMonto > 0 ? `+${modalItem.diferenciaMonto.toFixed(3)}` : modalItem.diferenciaMonto.toFixed(3)} UTM
                                </span>
                            </div>
                        </div>

                        <form onSubmit={handleSaveClasificacion} className="space-y-4">
                            {/* Tipo de Clasificación */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Tipo de Discrepancia *
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { val: 'ERROR_JUNAEB', label: 'Error JUNAEB', desc: 'Fórmula mal aplicada o cobro indebido' },
                                        { val: 'ERROR_INTERNO', label: 'Error Interno', desc: 'Dato mal extraído o corregible' },
                                        { val: 'EN_REVISION', label: 'En Revisión', desc: 'Requiere antecedentes o pesaje' },
                                        { val: 'ACEPTADO', label: 'Aceptado JUNAEB', desc: 'Monto ratificado sin objeción' }
                                    ].map(opt => (
                                        <button
                                            key={opt.val}
                                            type="button"
                                            onClick={() => setClasifError(opt.val as any)}
                                            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                                                clasifError === opt.val
                                                    ? 'bg-cyan-50 border-cyan-500 ring-2 ring-cyan-200'
                                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="font-bold text-xs text-slate-800">{opt.label}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{opt.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Motivo Justificación */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Motivo y Fundamento Legal de la Defensa *
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    value={motivoClasif}
                                    onChange={e => setMotivoClasif(e.target.value)}
                                    placeholder="Indica el motivo técnico o legal (ej: Se utilizó muestra insuficiente según AQL, o JUNAEB aplicó mal el porcentaje de descuento según bases)..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                />
                                <span className="text-[10px] text-slate-400">Este motivo se incorporará al escrito formal de descargos.</span>
                            </div>

                            {/* Feedback */}
                            {clasifFeedback && (
                                <div className="p-3 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-semibold flex items-center gap-2">
                                    <Info className="w-4 h-4 text-cyan-600 shrink-0" />
                                    <span>{clasifFeedback}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setModalItem(null)}
                                    disabled={clasifSaving}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={clasifSaving || motivoClasif.trim().length < 5}
                                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                                >
                                    {clasifSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />}
                                    <span>{clasifSaving ? 'Guardando...' : 'Guardar Clasificación'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
