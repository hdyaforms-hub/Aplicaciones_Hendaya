'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import {
    MetricasConsolidadasDTO,
    getMetricasTableroConsolidadoAction
} from './actions'
import {
    TrendingUp,
    Scale,
    FileSpreadsheet,
    FileText,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Download,
    RefreshCw,
    Building2,
    Sparkles,
    ShieldCheck,
    Layers,
    BookOpen,
    Wrench,
    ExternalLink,
    PieChart,
    BarChart3
} from 'lucide-react'

interface Props {
    initialMetricas?: MetricasConsolidadasDTO
    licitacionesDisponibles: string[]
    userName: string
    canExport?: boolean
}

export default function TableroConsolidadoClient({
    initialMetricas,
    licitacionesDisponibles,
    userName,
    canExport = false
}: Props) {
    const [metricas, setMetricas] = useState<MetricasConsolidadasDTO | undefined>(initialMetricas)
    const [isPending, startTransition] = useTransition()

    // Filtros
    const [filtroAnio, setFiltroAnio] = useState<string>('TODOS')
    const [filtroLicitacion, setFiltroLicitacion] = useState<string>('TODAS')

    const reloadData = () => {
        startTransition(async () => {
            const res = await getMetricasTableroConsolidadoAction({
                anio: filtroAnio !== 'TODOS' ? Number(filtroAnio) : undefined,
                licitacion: filtroLicitacion !== 'TODAS' ? filtroLicitacion : undefined
            })
            if (res.success && res.data) {
                setMetricas(res.data)
            }
        })
    }

    if (!metricas) {
        return (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-600 mb-2" />
                <p>Cargando indicadores consolidados...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* BARRA DE ACCIÓN Y FILTROS EJECUTIVOS (Modo Claro) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Año Fiscal
                        </label>
                        <select
                            value={filtroAnio}
                            onChange={e => {
                                setFiltroAnio(e.target.value)
                            }}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:border-cyan-600 cursor-pointer"
                        >
                            <option value="TODOS">Todos los Años</option>
                            <option value="2026">Año 2026</option>
                            <option value="2025">Año 2025</option>
                            <option value="2024">Año 2024</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Licitación / Contrato
                        </label>
                        <select
                            value={filtroLicitacion}
                            onChange={e => {
                                setFiltroLicitacion(e.target.value)
                            }}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:border-cyan-600 cursor-pointer max-w-[240px]"
                        >
                            <option value="TODAS">Todas las Licitaciones</option>
                            {licitacionesDisponibles.map(lic => (
                                <option key={lic} value={lic}>
                                    {lic}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={reloadData}
                            disabled={isPending}
                            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-cyan-600' : 'text-slate-500'}`} />
                            <span>Aplicar</span>
                        </button>
                    </div>
                </div>

                {/* Botón de Exportación Maestra Excel */}
                {canExport && (
                    <div className="flex items-center gap-2">
                        <a
                            href="/dashboard/areas/multas/tablero/exportar"
                            target="_blank"
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition cursor-pointer"
                            title="Descargar planilla Excel consolidada completa por folio y aspecto"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Exportar Reporte Maestro (.xlsx)</span>
                        </a>
                    </div>
                )}
            </div>

            {/* 5 TARJETAS DE KPIS FINANCIEROS Y DE LITIGIO (Modo Claro) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {/* 1. Notificado Total */}
                <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Calculado Total (CLP)</span>
                        <Scale className="w-4 h-4 text-slate-500" />
                    </span>
                    <p className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                        ${Math.round(metricas.montoTotalCalculadoPesos || 0).toLocaleString('es-CL')}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                        {metricas.totalActasCalculadas} actas ({(metricas.montoTotalCalculadoUtm ?? metricas.montoTotalNotificadoUtm ?? 0).toFixed(1)} UTM calculada)
                    </span>
                </div>

                {/* 2. Impugnado */}
                <div className="bg-white border border-indigo-200 bg-indigo-50/20 rounded-3xl p-4 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider flex items-center justify-between">
                        <span>Impugnado en Descargos</span>
                        <FileText className="w-4 h-4 text-indigo-600" />
                    </span>
                    <p className="text-2xl font-black text-indigo-700 mt-2">
                        {metricas.montoTotalImpugnadoUtm.toFixed(1)} <span className="text-xs font-normal">UTM</span>
                    </p>
                    <span className="text-[10px] text-indigo-600 mt-0.5">{metricas.totalDescargosPresentados} descargos formales (C7)</span>
                </div>

                {/* 3. Ahorro Obtenido (Rebajado) */}
                <div className="bg-white border border-emerald-200 bg-emerald-50/25 rounded-3xl p-4 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
                        <span>Ahorro / Rebaja Obtenida</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </span>
                    <p className="text-2xl font-black text-emerald-700 mt-2">
                        {metricas.montoTotalRebajadoUtm.toFixed(1)} <span className="text-xs font-normal">UTM</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                            {metricas.tasaExitoLegalPct}% Éxito
                        </span>
                        <span className="text-[10px] text-emerald-600">en resuelves emitidos</span>
                    </div>
                </div>

                {/* 4. Subsanación en Terreno (Planes C9) */}
                <div className="bg-white border border-sky-200 bg-sky-50/20 rounded-3xl p-4 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider flex items-center justify-between">
                        <span>Cumplimiento Operativo</span>
                        <Wrench className="w-4 h-4 text-sky-600" />
                    </span>
                    <p className="text-2xl font-black text-sky-700 mt-2">
                        {metricas.planesAccionCerradosPct}%
                    </p>
                    <span className="text-[10px] text-sky-600 mt-0.5">{metricas.totalPlanesAccion} planes de acción gestionados</span>
                </div>

                {/* 5. Conciliación REX (C6) */}
                <div className="bg-white border border-cyan-200 bg-cyan-50/20 rounded-3xl p-4 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider flex items-center justify-between">
                        <span>Conciliación REX</span>
                        <Layers className="w-4 h-4 text-cyan-600" />
                    </span>
                    <p className="text-2xl font-black text-cyan-800 mt-2">
                        {metricas.conciliacionJunaeb.coincide} <span className="text-xs font-normal text-slate-500">/ {metricas.conciliacionJunaeb.totalItemsRex}</span>
                    </p>
                    <span className="text-[10px] text-cyan-700 mt-0.5">{metricas.conciliacionJunaeb.diferencias} discrepancias identificadas</span>
                </div>
            </div>

            {/* SECCIÓN 2: DISTRIBUCIÓN POR ASPECTO Y SEMÁFORO DE SUCURSALES (Modo Claro) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Ranking de Aspectos Sancionados */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-cyan-600" />
                            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                                Concentración de Multas por Aspecto Fiscalizado
                            </h3>
                        </div>
                        <span className="text-xs font-bold text-slate-500">Total en UTM</span>
                    </div>

                    <div className="space-y-3">
                        {metricas.distribucionAspectos.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6">No hay multas registradas en los filtros seleccionados.</p>
                        ) : (
                            metricas.distribucionAspectos.slice(0, 7).map(item => {
                                const maxUtm = metricas.distribucionAspectos[0]?.totalUtm || 1
                                const pct = Math.round((item.totalUtm / maxUtm) * 100)

                                return (
                                    <div key={item.aspecto} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs font-bold">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-block px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200 font-black text-[11px]">
                                                    Aspecto {item.aspecto}
                                                </span>
                                                <span className="text-slate-600 font-normal text-[11px]">
                                                    ({item.cantidadFolios} actas afectadas)
                                                </span>
                                            </div>
                                            <span className="font-mono text-slate-900">{item.totalUtm} UTM</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="bg-cyan-600 h-2 rounded-full transition-all duration-500"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* 2. Semáforo de Gestión y Cumplimiento por Sucursal (C9) */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-cyan-600" />
                            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                                Cumplimiento de Planes Correctivos por Sucursal
                            </h3>
                        </div>
                        <span className="text-xs font-bold text-slate-500">% Subsanado</span>
                    </div>

                    <div className="space-y-3">
                        {metricas.avancePorSucursal.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6">No hay planes de acción por sucursal registrados.</p>
                        ) : (
                            metricas.avancePorSucursal.map(suc => (
                                <div key={suc.sucursal} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-slate-900">{suc.sucursal}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-slate-500">
                                                {suc.planesCerrados} de {suc.totalPlanes} cerrados
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                                suc.porcentajeCumplimiento >= 80
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : suc.porcentajeCumplimiento >= 50
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-rose-100 text-rose-800'
                                            }`}>
                                                {suc.porcentajeCumplimiento}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className={`h-1.5 rounded-full transition-all duration-500 ${
                                                suc.porcentajeCumplimiento >= 80
                                                    ? 'bg-emerald-500'
                                                    : suc.porcentajeCumplimiento >= 50
                                                    ? 'bg-amber-500'
                                                    : 'bg-rose-500'
                                            }`}
                                            style={{ width: `${suc.porcentajeCumplimiento}%` }}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* SECCIÓN 3: ACCESOS DIRECTOS A LOS SUBMÓDULOS DE FISCALIZACIÓN */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-600" />
                    Módulos Especializados del Ecosistema de Fiscalización JUNAEB
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <Link
                        href="/dashboard/areas/multas/notificaciones"
                        className="p-4 rounded-2xl bg-slate-50 hover:bg-cyan-50/50 border border-slate-200 hover:border-cyan-200 transition group space-y-1 block"
                    >
                        <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block">Módulo C6</span>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-cyan-700">Notificaciones REX</h4>
                        <p className="text-[11px] text-slate-500">Conciliación automática y Anexo 1</p>
                    </Link>

                    <Link
                        href="/dashboard/areas/multas/ciclo-legal"
                        className="p-4 rounded-2xl bg-slate-50 hover:bg-cyan-50/50 border border-slate-200 hover:border-cyan-200 transition group space-y-1 block"
                    >
                        <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block">Módulo C7</span>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-cyan-700">Ciclo Legal y Resuelves</h4>
                        <p className="text-[11px] text-slate-500">Descargos, plazos y expedientes</p>
                    </Link>

                    <Link
                        href="/dashboard/areas/multas/biblioteca"
                        className="p-4 rounded-2xl bg-slate-50 hover:bg-cyan-50/50 border border-slate-200 hover:border-cyan-200 transition group space-y-1 block"
                    >
                        <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block">Módulo C8</span>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-cyan-700">Biblioteca de Precedentes</h4>
                        <p className="text-[11px] text-slate-500">Plantillas y descargos aceptados</p>
                    </Link>

                    <Link
                        href="/dashboard/areas/multas/soluciones"
                        className="p-4 rounded-2xl bg-slate-50 hover:bg-cyan-50/50 border border-slate-200 hover:border-cyan-200 transition group space-y-1 block"
                    >
                        <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block">Módulo C9</span>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-cyan-700">Soluciones en Terreno</h4>
                        <p className="text-[11px] text-slate-500">Planes de acción por sucursal</p>
                    </Link>

                    <Link
                        href="/dashboard/areas/multas/analisis-ia"
                        className="p-4 rounded-2xl bg-slate-50 hover:bg-cyan-50/50 border border-slate-200 hover:border-cyan-200 transition group space-y-1 block"
                    >
                        <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block">Módulo C10</span>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-cyan-700">Asistente y Visión IA</h4>
                        <p className="text-[11px] text-slate-500">Defensas y lectura de pesaje</p>
                    </Link>
                </div>
            </div>
        </div>
    )
}
