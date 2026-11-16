'use client'

import React, { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import {
    getHallazgosLicitacionAction,
    getResumenMetricasNCAction,
    updateEstadoHallazgoAction,
    evaluarHallazgosLicitacionMasivoAction,
    getLicitacionesDisponibles
} from '@/app/dashboard/areas/multas/calculos/actions'
import { CATALOGO_REGLAS } from '@/lib/multas/reglas/definiciones'
import CalculoModal from '@/app/dashboard/areas/multas/calculos/CalculoModal'

export default function AnalisisNCClient() {
    // Licitaciones
    const [licitaciones, setLicitaciones] = useState<{ value: string; label: string }[]>([])
    const [selectedLicId, setSelectedLicId] = useState<string>('ALL')

    // Fechas
    const [mes, setMes] = useState<string>('ALL')
    const [anho, setAnho] = useState<number>(new Date().getFullYear())

    // Filtros de Hallazgos
    const [reglaFiltro, setReglaFiltro] = useState<string>('ALL')
    const [estadoFiltro, setEstadoFiltro] = useState<string>('ALL')
    const [severidadFiltro, setSeveridadFiltro] = useState<string>('ALL')
    const [tipoFiltro, setTipoFiltro] = useState<string>('ALL')
    const [aspectoFiltro, setAspectoFiltro] = useState<string>('ALL')
    const [searchTerm, setSearchTerm] = useState<string>('')

    // Paginación
    const [pagina, setPagina] = useState<number>(1)
    const limit = 50

    // Modo de vista: 'lista' | 'aspecto'
    const [vistaModo, setVistaModo] = useState<'lista' | 'aspecto'>('lista')
    const [aspectoSeleccionado, setAspectoSeleccionado] = useState<string>('G')

    // Datos y estados de carga
    const [items, setItems] = useState<any[]>([])
    const [totalItems, setTotalItems] = useState<number>(0)
    const [metricas, setMetricas] = useState<any>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [evaluandoMasivo, setEvaluandoMasivo] = useState<boolean>(false)
    const [evaluacionRes, setEvaluacionRes] = useState<string | null>(null)

    // Modal de cálculo
    const [selectedFolioModal, setSelectedFolioModal] = useState<string | null>(null)

    // Modal de Descarte
    const [descarteModal, setDescarteModal] = useState<{
        isOpen: boolean
        hallazgoId: number | null
        folio: string
        nota: string
    } | null>(null)

    // Cargar licitaciones al iniciar
    useEffect(() => {
        const loadLics = async () => {
            try {
                const res = await getLicitacionesDisponibles()
                if (res.data) {
                    setLicitaciones(res.data)
                }
            } catch (e) {
                console.error('Error cargando licitaciones:', e)
            }
        }
        loadLics()
    }, [])

    // Cargar métricas y hallazgos cuando cambian los filtros
    const fetchDatos = async () => {
        setLoading(true)
        try {
            const licNum = selectedLicId !== 'ALL' ? parseInt(selectedLicId, 10) : null
            const mesNum = mes !== 'ALL' ? parseInt(mes, 10) : null

            const [resItems, resMetricas] = await Promise.all([
                getHallazgosLicitacionAction({
                    licId: licNum,
                    mes: mesNum,
                    anho,
                    reglaId: reglaFiltro,
                    estado: estadoFiltro,
                    severidad: severidadFiltro,
                    tipo: tipoFiltro,
                    aspecto: vistaModo === 'aspecto' ? aspectoSeleccionado : aspectoFiltro,
                    search: searchTerm,
                    limit,
                    offset: (pagina - 1) * limit
                }),
                getResumenMetricasNCAction(licNum)
            ])

            if (resItems.data) {
                setItems(resItems.data.items || [])
                setTotalItems(resItems.data.total || 0)
            }
            if (resMetricas.data) {
                setMetricas(resMetricas.data)
            }
        } catch (e) {
            console.error('Error al consultar hallazgos NC:', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDatos()
    }, [selectedLicId, mes, anho, reglaFiltro, estadoFiltro, severidadFiltro, tipoFiltro, aspectoFiltro, searchTerm, pagina, vistaModo, aspectoSeleccionado])

    const handleActualizarEstado = async (id: number, estado: 'PENDIENTE' | 'ACEPTADO' | 'DESCARTADO', nota?: string) => {
        try {
            const res = await updateEstadoHallazgoAction({ id, estado, nota })
            if (res.ok) {
                if (descarteModal?.isOpen) setDescarteModal(null)
                await fetchDatos()
            } else {
                alert(res.mensaje || 'Error al actualizar estado del hallazgo.')
            }
        } catch (e) {
            alert('Error de conexión al actualizar hallazgo.')
        }
    }

    const handleEvaluacionMasiva = async () => {
        if (selectedLicId === 'ALL') {
            alert('Debe seleccionar una licitación específica para ejecutar la evaluación masiva.')
            return
        }
        const confirm = window.confirm(`¿Desea ejecutar la evaluación de las 23 reglas normativas para la licitación seleccionada? Se preservarán intactos todos los hallazgos ya descartados o aceptados.`)
        if (!confirm) return

        setEvaluandoMasivo(true)
        setEvaluacionRes(null)
        try {
            const licNum = parseInt(selectedLicId, 10)
            const mesNum = mes !== 'ALL' ? parseInt(mes, 10) : undefined
            const res = await evaluarHallazgosLicitacionMasivoAction(licNum, mesNum, anho)
            if (res.ok) {
                setEvaluacionRes(`✓ Evaluación completada: ${res.foliosEvaluados} folios auditados (${res.totalHallazgos} hallazgos normativos sincronizados).`)
                await fetchDatos()
            } else {
                alert(res.error || 'Error al ejecutar evaluación masiva.')
            }
        } catch (e: any) {
            alert('Error al ejecutar evaluación masiva: ' + (e.message || ''))
        } finally {
            setEvaluandoMasivo(false)
        }
    }

    const handleExportarExcel = () => {
        if (!items || items.length === 0) {
            alert('No hay hallazgos disponibles para exportar.')
            return
        }

        const dataExcel = items.map(h => ({
            'Folio': h.folio,
            'Licitación': h.licitacionId || '-',
            'Aspecto': h.aspecto,
            'Código Regla': h.reglaId,
            'Severidad': h.severidad.toUpperCase(),
            'Tipo': h.tipo === 'mal_imputado' ? 'Mal Imputado' : h.tipo === 'descargo' ? 'Descargo' : 'Verificar',
            'Título': h.titulo,
            'Detalle': h.detalle,
            'Evidencia': h.evidencia || '',
            'Sugerencia': h.sugerencia || '',
            'Estado': h.estado,
            'Nota Justificación': h.nota || '',
            'Autor / Auditor': h.descartadoPor || h.aceptadoPor || h.autor || 'Sistema',
            'Fecha Registro': h.updatedAt ? new Date(h.updatedAt).toLocaleString('es-CL') : ''
        }))

        const ws = XLSX.utils.json_to_sheet(dataExcel)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Hallazgos_NC_C5')
        XLSX.writeFile(wb, `Hallazgos_NC_C5_Lic${selectedLicId}_${new Date().toISOString().slice(0, 10)}.xlsx`)
    }

    const aspectosList = ['GENERAL', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M']

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            {/* Header Corporativo HENDAYA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black tracking-widest text-cyan-700 uppercase">
                            HENDAYA · ÁREAS
                        </span>
                        <span className="text-slate-300">/</span>
                        <span className="px-2 py-0.5 rounded bg-cyan-900 text-white text-[11px] font-black">
                            C5
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
                        <span>⚖️</span>
                        <span>Análisis de No Conformidades (NC)</span>
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Auditoría determinística de las 23 reglas de la IT JUNAEB (IT-DAE-SUP026): vicios procedimentales, cruces interaspectos y sugerencias de descargo.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={handleExportarExcel}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                        <span>📥</span>
                        <span>Exportar Excel</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleEvaluacionMasiva}
                        disabled={evaluandoMasivo || selectedLicId === 'ALL'}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                        <span>⚡</span>
                        <span>{evaluandoMasivo ? 'Evaluando...' : 'Reevaluar Licitación'}</span>
                    </button>
                </div>
            </div>

            {evaluacionRes && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-semibold flex items-center justify-between">
                    <span>{evaluacionRes}</span>
                    <button type="button" onClick={() => setEvaluacionRes(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">✕</button>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Hallazgos</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{metricas?.total || 0}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Detectados en actas</p>
                </div>

                <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 shadow-2xs">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Pendientes</p>
                    <p className="text-2xl font-black text-amber-950 mt-1">{metricas?.pendientes || 0}</p>
                    <p className="text-[10px] text-amber-700 mt-0.5">Requieren revisión</p>
                </div>

                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 shadow-2xs">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Aceptados</p>
                    <p className="text-2xl font-black text-emerald-950 mt-1">{metricas?.aceptados || 0}</p>
                    <p className="text-[10px] text-emerald-700 mt-0.5">Sustento para descargo</p>
                </div>

                <div className="p-4 bg-slate-100/70 rounded-2xl border border-slate-200 shadow-2xs">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Descartados</p>
                    <p className="text-2xl font-black text-slate-800 mt-1">{metricas?.descartados || 0}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Con justificación guardada</p>
                </div>

                <div className="p-4 bg-rose-50/60 rounded-2xl border border-rose-200 shadow-2xs">
                    <p className="text-[10px] font-black uppercase tracking-wider text-rose-800">Mal Imputados</p>
                    <p className="text-2xl font-black text-rose-950 mt-1">{metricas?.porTipo?.mal_imputado || 0}</p>
                    <p className="text-[10px] text-rose-700 mt-0.5">Severidad Alta (vicios)</p>
                </div>
            </div>

            {/* Selector de Modo de Vista */}
            <div className="flex items-center justify-between gap-4 bg-white p-2.5 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setVistaModo('lista')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            vistaModo === 'lista'
                                ? 'bg-cyan-900 text-white shadow-xs'
                                : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <span>📋</span>
                        <span>Listado Consolidado</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setVistaModo('aspecto')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            vistaModo === 'aspecto'
                                ? 'bg-cyan-900 text-white shadow-xs'
                                : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <span>🔤</span>
                        <span>Revisión Matricial por Aspecto (A - M)</span>
                    </button>
                </div>

                <div className="text-xs text-slate-500 font-mono">
                    Mostrando {items.length} de {totalItems} registros
                </div>
            </div>

            {/* Píldoras de Aspectos (Solo en modo aspecto) */}
            {vistaModo === 'aspecto' && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {aspectosList.map(letra => (
                        <button
                            key={letra}
                            type="button"
                            onClick={() => {
                                setAspectoSeleccionado(letra)
                                setPagina(1)
                            }}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                                aspectoSeleccionado === letra
                                    ? 'bg-cyan-700 text-white shadow-sm ring-2 ring-cyan-500/20'
                                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            Aspecto {letra}
                        </button>
                    ))}
                </div>
            )}

            {/* Barra de Filtros */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {/* Licitación */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Licitación</label>
                        <select
                            value={selectedLicId}
                            onChange={(e) => {
                                setSelectedLicId(e.target.value)
                                setPagina(1)
                            }}
                            className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-cyan-500"
                        >
                            <option value="ALL">Todas las Licitaciones</option>
                            {licitaciones.map(l => (
                                <option key={l.value} value={l.value}>{l.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Mes */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Mes</label>
                        <select
                            value={mes}
                            onChange={(e) => {
                                setMes(e.target.value)
                                setPagina(1)
                            }}
                            className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-cyan-500"
                        >
                            <option value="ALL">Todos los meses</option>
                            {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, idx) => (
                                <option key={m} value={idx + 1}>{m}</option>
                            ))}
                        </select>
                    </div>

                    {/* Estado */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Estado</label>
                        <select
                            value={estadoFiltro}
                            onChange={(e) => {
                                setEstadoFiltro(e.target.value)
                                setPagina(1)
                            }}
                            className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-cyan-500"
                        >
                            <option value="ALL">Todos los estados</option>
                            <option value="PENDIENTE">⏳ Pendientes</option>
                            <option value="ACEPTADO">✅ Aceptados</option>
                            <option value="DESCARTADO">❌ Descartados</option>
                        </select>
                    </div>

                    {/* Severidad */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Severidad</label>
                        <select
                            value={severidadFiltro}
                            onChange={(e) => {
                                setSeveridadFiltro(e.target.value)
                                setPagina(1)
                            }}
                            className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-cyan-500"
                        >
                            <option value="ALL">Todas las severidades</option>
                            <option value="alta">🔴 Alta (Mal Imputado)</option>
                            <option value="media">🟡 Media (Descargo)</option>
                            <option value="info">ℹ️ Info (Verificar)</option>
                        </select>
                    </div>

                    {/* Regla */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Regla IT</label>
                        <select
                            value={reglaFiltro}
                            onChange={(e) => {
                                setReglaFiltro(e.target.value)
                                setPagina(1)
                            }}
                            className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-cyan-500"
                        >
                            <option value="ALL">Todas las reglas (23)</option>
                            {CATALOGO_REGLAS.map(r => (
                                <option key={r.id} value={r.id}>{r.id} - {r.nombre.slice(0, 25)}...</option>
                            ))}
                        </select>
                    </div>

                    {/* Búsqueda */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Buscar Folio / Texto</label>
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value)
                                setPagina(1)
                            }}
                            className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-cyan-500"
                        />
                    </div>
                </div>
            </div>

            {/* Contenido Principal (Tabla de Hallazgos) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-20 text-center text-slate-400 text-xs">
                        <div className="w-7 h-7 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Cargando hallazgos normativos...
                    </div>
                ) : items.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 text-xs">
                        No se encontraron hallazgos con los filtros seleccionados.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                <tr>
                                    <th className="p-3.5">Folio</th>
                                    <th className="p-3.5">Asp.</th>
                                    <th className="p-3.5">Regla / Norma</th>
                                    <th className="p-3.5">Severidad / Tipo</th>
                                    <th className="p-3.5">Hallazgo y Detalle</th>
                                    <th className="p-3.5">Estado</th>
                                    <th className="p-3.5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.map(h => (
                                    <tr key={h.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-3.5">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedFolioModal(h.folio)}
                                                className="font-mono font-bold text-cyan-800 hover:text-cyan-950 underline cursor-pointer"
                                            >
                                                {h.folio}
                                            </button>
                                        </td>
                                        <td className="p-3.5">
                                            <span className="font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                                                {h.aspecto}
                                            </span>
                                        </td>
                                        <td className="p-3.5">
                                            <div className="space-y-0.5">
                                                <span className="font-mono text-[10px] font-black px-1.5 py-0.2 rounded bg-cyan-900 text-cyan-50">
                                                    {h.reglaId}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3.5">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className={`text-[9px] px-2 py-0.2 rounded-full font-bold ${
                                                    h.severidad === 'alta'
                                                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                        : h.severidad === 'media'
                                                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                            : 'bg-sky-100 text-sky-800 border border-sky-200'
                                                }`}>
                                                    {h.severidad.toUpperCase()}
                                                </span>
                                                <span className={`text-[9px] px-2 py-0.2 rounded-full font-bold ${
                                                    h.tipo === 'mal_imputado'
                                                        ? 'bg-red-50 text-red-700'
                                                        : h.tipo === 'descargo'
                                                            ? 'bg-emerald-50 text-emerald-800'
                                                            : 'bg-indigo-50 text-indigo-800'
                                                }`}>
                                                    {h.tipo === 'mal_imputado' ? 'Mal Imputado' : h.tipo === 'descargo' ? 'Descargo' : 'Verificar'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3.5 max-w-md">
                                            <div className="space-y-1">
                                                <p className="font-bold text-slate-900 text-xs">{h.titulo}</p>
                                                <p className="text-[11px] text-slate-600 line-clamp-2">{h.detalle}</p>
                                                {h.nota && (
                                                    <p className="text-[10px] text-slate-500 italic bg-slate-100 p-1.5 rounded border border-slate-200">
                                                        <b>Nota:</b> {h.nota} ({h.descartadoPor || h.aceptadoPor || 'Usuario'})
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3.5">
                                            <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider ${
                                                h.estado === 'PENDIENTE'
                                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                                    : h.estado === 'ACEPTADO'
                                                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                                        : 'bg-slate-200 text-slate-700 border border-slate-300'
                                            }`}>
                                                {h.estado}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {h.estado === 'PENDIENTE' && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            title="Aceptar como argumento de descargo"
                                                            onClick={() => handleActualizarEstado(h.id, 'ACEPTADO')}
                                                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all cursor-pointer"
                                                        >
                                                            ✓ Aceptar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            title="Descartar hallazgo con justificación"
                                                            onClick={() => setDescarteModal({ isOpen: true, hallazgoId: h.id, folio: h.folio, nota: '' })}
                                                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
                                                        >
                                                            ✕ Descartar
                                                        </button>
                                                    </>
                                                )}

                                                {h.estado === 'ACEPTADO' && (
                                                    <button
                                                        type="button"
                                                        title="Volver a estado pendiente"
                                                        onClick={() => handleActualizarEstado(h.id, 'PENDIENTE')}
                                                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer"
                                                    >
                                                        Reabrir
                                                    </button>
                                                )}

                                                {h.estado === 'DESCARTADO' && (
                                                    <button
                                                        type="button"
                                                        title="Reactivar hallazgo descartado"
                                                        onClick={() => handleActualizarEstado(h.id, 'PENDIENTE')}
                                                        className="px-2 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-bold transition-all cursor-pointer"
                                                    >
                                                        Reactivar
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Barra de Paginación */}
                {totalItems > limit && (
                    <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                        <span>Página {pagina} de {Math.ceil(totalItems / limit)}</span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={pagina <= 1}
                                onClick={() => setPagina(p => Math.max(1, p - 1))}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg font-bold cursor-pointer"
                            >
                                Anterior
                            </button>
                            <button
                                type="button"
                                disabled={pagina >= Math.ceil(totalItems / limit)}
                                onClick={() => setPagina(p => p + 1)}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg font-bold cursor-pointer"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Descarte */}
            {descarteModal?.isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                            <span className="text-xl">✍️</span>
                            <h4 className="text-sm font-black text-slate-900">
                                Descartar Hallazgo · Folio {descarteModal.folio}
                            </h4>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                            Indique el motivo técnico o legal para descartar este hallazgo (ej: <i>"Supervisor acreditó instrumento propio calibrado"</i>). Una vez descartado con nota, <b>no reaparecerá al recalcular</b>.
                        </p>

                        <textarea
                            rows={3}
                            placeholder="Ingrese justificación obligatoria..."
                            value={descarteModal.nota}
                            onChange={(e) => setDescarteModal({ ...descarteModal, nota: e.target.value })}
                            className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-cyan-500 text-slate-800 placeholder-slate-400"
                        />

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setDescarteModal(null)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!descarteModal.nota.trim() || descarteModal.nota.trim().length < 4) {
                                        alert('Debe ingresar un motivo de al menos 4 caracteres.')
                                        return
                                    }
                                    if (descarteModal.hallazgoId) {
                                        handleActualizarEstado(descarteModal.hallazgoId, 'DESCARTADO', descarteModal.nota.trim())
                                    }
                                }}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                            >
                                Confirmar Descarte
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Cálculo de Folio */}
            {selectedFolioModal && (
                <CalculoModal
                    folio={selectedFolioModal}
                    isOpen={!!selectedFolioModal}
                    onClose={() => setSelectedFolioModal(null)}
                    onCalculated={() => {
                        setSelectedFolioModal(null)
                        fetchDatos()
                    }}
                />
            )}
        </div>
    )
}
