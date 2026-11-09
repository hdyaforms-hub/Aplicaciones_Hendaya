'use client'

import React from 'react'
import {
    ComparativaAbiertosCerradosData,
    ComparativaFiltros
} from './actions'

interface Props {
    comparativaData: ComparativaAbiertosCerradosData | null
    isCompLoading: boolean
    compModuloFilter: 'TODOS' | 'AUSENTISMO' | 'HORAS_EXTRAS' | 'ATRASOS' | 'ADELANTOS'
    setCompModuloFilter: (val: 'TODOS' | 'AUSENTISMO' | 'HORAS_EXTRAS' | 'ATRASOS' | 'ADELANTOS') => void
    compEstadoFilter: 'TODOS' | 'ABIERTO' | 'CERRADO'
    setCompEstadoFilter: (val: 'TODOS' | 'ABIERTO' | 'CERRADO') => void
    compSucursalFilter: string
    setCompSucursalFilter: (val: string) => void
    compUsuarioFilter: string
    setCompUsuarioFilter: (val: string) => void
    compSearchQuery: string
    setCompSearchQuery: (val: string) => void
    compCurrentPage: number
    setCompCurrentPage: (val: number) => void
    compPageSize: number
    setCompPageSize: (val: number) => void
    compSortBy: string
    setCompSortBy: (val: string) => void
    compSortOrder: 'asc' | 'desc'
    setCompSortOrder: (val: 'asc' | 'desc') => void
    fetchComparativaData: (overrides?: Partial<ComparativaFiltros>) => void
    handleCompSort: (column: string) => void
    handleExportCsv: () => void
}

export default function ComparativaAbiertosCerradosTab({
    comparativaData,
    isCompLoading,
    compModuloFilter,
    setCompModuloFilter,
    compEstadoFilter,
    setCompEstadoFilter,
    compSucursalFilter,
    setCompSucursalFilter,
    compUsuarioFilter,
    setCompUsuarioFilter,
    compSearchQuery,
    setCompSearchQuery,
    compCurrentPage,
    setCompCurrentPage,
    compPageSize,
    setCompPageSize,
    compSortBy,
    setCompSortBy,
    compSortOrder,
    setCompSortOrder,
    fetchComparativaData,
    handleCompSort,
    handleExportCsv
}: Props) {
    return (
        <div className="space-y-6">
            {/* 1. TARJETAS EJECUTIVAS KPIS GLOBALES (5 TARJETAS) */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-3.5">
                {/* Total Universo */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                        <span>Universo Total</span>
                        <span className="p-1 bg-slate-100 rounded-lg text-slate-700">📑</span>
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
                        {comparativaData?.kpis.totalGeneral || 0}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                        Registros en los 4 módulos
                    </div>
                </div>

                {/* Total Archivos Cargados */}
                <div className="bg-white border border-cyan-200 rounded-2xl p-4 shadow-sm hover:border-cyan-300 transition">
                    <div className="flex items-center justify-between text-cyan-800 text-xs font-bold">
                        <span>Archivos Cargados</span>
                        <span className="p-1 bg-cyan-50 rounded-lg text-cyan-700">📂</span>
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-cyan-800">
                        {comparativaData?.kpis.totalArchivosCargados || comparativaData?.archivosCargados?.length || 0}
                    </div>
                    <div className="text-[11px] text-cyan-700/80 mt-0.5 font-medium flex items-center justify-between">
                        <span>Planillas masivas procesadas</span>
                    </div>
                </div>

                {/* Total Abiertos (Prioridad de Gestión) */}
                <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm hover:border-amber-300 transition">
                    <div className="flex items-center justify-between text-amber-700 text-xs font-bold">
                        <span>Registros Abiertos</span>
                        <span className="p-1 bg-amber-50 rounded-lg text-amber-700">⚠️</span>
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-700">
                        {comparativaData?.kpis.totalAbiertos || 0}
                    </div>
                    <div className="text-[11px] text-amber-600 mt-0.5 font-medium flex items-center justify-between">
                        <span>Pendientes de cierre</span>
                        <span className="font-mono font-bold">{comparativaData?.kpis.porcentajeAbiertoGlobal || 0}%</span>
                    </div>
                </div>

                {/* Total Cerrados */}
                <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm hover:border-emerald-300 transition">
                    <div className="flex items-center justify-between text-emerald-700 text-xs font-bold">
                        <span>Registros Cerrados</span>
                        <span className="p-1 bg-emerald-50 rounded-lg text-emerald-700">✅</span>
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-700">
                        {comparativaData?.kpis.totalCerrados || 0}
                    </div>
                    <div className="text-[11px] text-emerald-600 mt-0.5 font-medium flex items-center justify-between">
                        <span>Ciclo operacional concluido</span>
                        <span className="font-mono font-bold">{comparativaData?.kpis.porcentajeCerradoGlobal || 0}%</span>
                    </div>
                </div>

                {/* Ratio / Efectividad Global */}
                <div className="col-span-2 sm:col-span-1 bg-white border border-cyan-200 rounded-2xl p-4 shadow-sm hover:border-cyan-300 transition">
                    <div className="flex items-center justify-between text-cyan-800 text-xs font-bold">
                        <span>Efectividad Global</span>
                        <span className="p-1 bg-cyan-50 rounded-lg text-cyan-700">📊</span>
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-cyan-800">
                        {comparativaData?.kpis.porcentajeCerradoGlobal || 0}%
                    </div>
                    {/* Barra visual bicolor */}
                    <div className="mt-2 w-full bg-amber-100 rounded-full h-2 overflow-hidden flex" title={`${comparativaData?.kpis.porcentajeCerradoGlobal || 0}% Cerrados / ${comparativaData?.kpis.porcentajeAbiertoGlobal || 0}% Abiertos`}>
                        <div
                            className="bg-emerald-500 h-full transition-all duration-500"
                            style={{ width: `${comparativaData?.kpis.porcentajeCerradoGlobal || 0}%` }}
                        />
                        <div
                            className="bg-amber-400 h-full transition-all duration-500"
                            style={{ width: `${comparativaData?.kpis.porcentajeAbiertoGlobal || 0}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* 2. MÓDULOS EN ORDEN ESTRICTO: 1° AUSENTISMO, 2° HORAS EXTRAS, 3° ATRASOS, 4° ADELANTOS */}
            <div>
                <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                        <span>📁</span>
                        <span>Comparativa por Tipo de Archivo / Módulo (Orden Oficial)</span>
                    </h3>
                    <span className="text-[11px] text-slate-400">
                        Haga clic en una tarjeta para enfocar la tabla en ese módulo
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {(comparativaData?.modulos || []).map((mod, idx) => {
                        const isSelected = compModuloFilter === mod.tipo
                        return (
                            <div
                                key={mod.tipo}
                                onClick={() => {
                                    const nextModulo = isSelected ? 'TODOS' : mod.tipo
                                    setCompModuloFilter(nextModulo)
                                    setCompCurrentPage(1)
                                    fetchComparativaData({ modulo: nextModulo, page: 1 })
                                }}
                                className={`cursor-pointer bg-white border rounded-2xl p-4 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] ${
                                    isSelected
                                        ? 'border-sky-600 ring-2 ring-sky-500/20 bg-sky-50/40'
                                        : 'border-slate-200 hover:border-sky-300'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-mono font-bold text-slate-600">
                                            {idx + 1}
                                        </span>
                                        <span className="p-1 bg-slate-100 rounded-lg text-sm">{mod.icono}</span>
                                        <span>{mod.nombre}</span>
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 font-mono">
                                        {mod.porcentajeCerrados}% Cerrado
                                    </span>
                                </div>

                                {/* Barra comparativa bicolor */}
                                <div className="mt-3 w-full bg-amber-100 rounded-full h-2 overflow-hidden flex">
                                    <div
                                        className="bg-emerald-500 h-full transition-all duration-500"
                                        style={{ width: `${mod.porcentajeCerrados}%` }}
                                        title={`Cerrados: ${mod.totalCerrados} (${mod.porcentajeCerrados}%)`}
                                    />
                                    <div
                                        className="bg-amber-400 h-full transition-all duration-500"
                                        style={{ width: `${mod.porcentajeAbiertos}%` }}
                                        title={`Abiertos: ${mod.totalAbiertos} (${mod.porcentajeAbiertos}%)`}
                                    />
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                                    <div className="bg-amber-50/60 p-2 rounded-xl text-center border border-amber-200/50">
                                        <span className="text-[10px] text-amber-700 font-bold block uppercase tracking-wider">Abiertos</span>
                                        <span className="text-base font-extrabold text-amber-800 font-mono">{mod.totalAbiertos}</span>
                                    </div>
                                    <div className="bg-emerald-50/60 p-2 rounded-xl text-center border border-emerald-200/50">
                                        <span className="text-[10px] text-emerald-700 font-bold block uppercase tracking-wider">Cerrados</span>
                                        <span className="text-base font-extrabold text-emerald-800 font-mono">{mod.totalCerrados}</span>
                                    </div>
                                </div>

                                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                                    <span>Total: <strong className="text-slate-800">{mod.totalRegistros}</strong></span>
                                    <span className="font-mono font-bold text-sky-700">{mod.modificadosCount} modif.</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* SECCIÓN 3: HISTORIAL DE ARCHIVOS CARGADOS Y SU COMPORTAMIENTO EN EL TIEMPO */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                            <span>📁</span>
                            <span>Historial de Archivos Cargados y Comportamiento en el Tiempo</span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-cyan-100 text-cyan-800 font-mono">
                                {comparativaData?.archivosCargados?.length || 0} Archivos Procesados
                            </span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Línea de tiempo de planillas masivas procesadas en Ausentismo, Horas Extras, Atrasos y Adelantos, reflejando su evolución y estado de cierre.
                        </p>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                        Orden cronológico: cargas más recientes en cabecera
                    </span>
                </div>

                {(comparativaData?.archivosCargados || []).length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs font-semibold">
                        No se registran archivos masivos cargados en el sistema.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                    <th className="py-3 px-3 text-center">#</th>
                                    <th className="py-3 px-3">Módulo</th>
                                    <th className="py-3 px-3">Archivo Planilla</th>
                                    <th className="py-3 px-3">Fecha y Hora de Carga</th>
                                    <th className="py-3 px-3">Cargado Por</th>
                                    <th className="py-3 px-3 text-center">Total Registros</th>
                                    <th className="py-3 px-3">Comportamiento (Abiertos vs Cerrados)</th>
                                    <th className="py-3 px-3 text-center">Estado del Archivo</th>
                                    <th className="py-3 px-3 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {(comparativaData?.archivosCargados || []).map((arch, aIdx) => {
                                    let badgeMod = 'bg-rose-50 text-rose-700 border-rose-200'
                                    let iconMod = '🏥'
                                    if (arch.modulo === 'HORAS_EXTRAS') {
                                        badgeMod = 'bg-sky-50 text-sky-700 border-sky-200'
                                        iconMod = '⏱️'
                                    } else if (arch.modulo === 'ATRASOS') {
                                        badgeMod = 'bg-amber-50 text-amber-700 border-amber-200'
                                        iconMod = '⏳'
                                    } else if (arch.modulo === 'ADELANTOS') {
                                        badgeMod = 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                        iconMod = '🚪'
                                    }

                                    const isCerrado = arch.estadoArchivo === 'CERRADO'
                                    const isEnGestion = arch.estadoArchivo === 'EN_GESTION'

                                    return (
                                        <tr key={arch.id} className="hover:bg-sky-50/30 transition-colors">
                                            <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-400">
                                                {aIdx + 1}
                                            </td>
                                            <td className="py-3 px-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${badgeMod}`}>
                                                    <span>{iconMod}</span>
                                                    <span>{arch.moduloLabel}</span>
                                                </span>
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base text-emerald-600">📊</span>
                                                    <div>
                                                        <span className="font-extrabold text-slate-900 block leading-tight">
                                                            {arch.nombreArchivo}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                            ID: {arch.id.slice(0, 8)}...
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-800">
                                                <div className="font-bold">
                                                    {new Date(arch.fechaCarga).toLocaleDateString('es-CL')}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    {new Date(arch.fechaCarga).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} hrs
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 whitespace-nowrap">
                                                <span className="font-bold text-slate-800 flex items-center gap-1">
                                                    <span>👤</span>
                                                    <span>{arch.cargadoPor}</span>
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-center font-mono font-extrabold text-slate-900 text-xs">
                                                {arch.totalRegistros}
                                            </td>
                                            <td className="py-3 px-3 min-w-[200px]">
                                                <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                                                    <span className="text-emerald-700 font-bold">
                                                        ✓ {arch.cerrados} ({arch.porcentajeCerrado}%)
                                                    </span>
                                                    <span className="text-amber-700 font-bold">
                                                        ⏳ {arch.abiertos} ({arch.porcentajeAbierto}%)
                                                    </span>
                                                </div>
                                                {/* Barra de progreso */}
                                                <div className="w-full bg-amber-200 h-2 rounded-full overflow-hidden flex">
                                                    <div
                                                        className="bg-emerald-500 h-full transition-all duration-500"
                                                        style={{ width: `${arch.porcentajeCerrado}%` }}
                                                        title={`Cerrados: ${arch.cerrados}`}
                                                    />
                                                    <div
                                                        className="bg-amber-400 h-full transition-all duration-500"
                                                        style={{ width: `${arch.porcentajeAbierto}%` }}
                                                        title={`Abiertos: ${arch.abiertos}`}
                                                    />
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-center whitespace-nowrap">
                                                {isCerrado ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                        <span>✓</span>
                                                        <span>CERRADO (100%)</span>
                                                    </span>
                                                ) : isEnGestion ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-sky-100 text-sky-800 border border-sky-300">
                                                        <span>⚡</span>
                                                        <span>EN GESTIÓN ({arch.porcentajeCerrado}%)</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                                                        <span>⏳</span>
                                                        <span>ABIERTO (0%)</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 text-right whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCompModuloFilter(arch.modulo)
                                                        setCompCurrentPage(1)
                                                        fetchComparativaData({ modulo: arch.modulo, page: 1 })
                                                    }}
                                                    className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[11px] font-bold transition flex items-center gap-1 ml-auto"
                                                    title="Filtrar registros de este módulo en la matriz inferior"
                                                >
                                                    <span>🔍</span>
                                                    <span>Ver Registros</span>
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 4. DOS PANELES DE COMPORTAMIENTO: POR ZONA Y POR USUARIO MODIFICADOR */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* PANEL 4.A: COMPORTAMIENTO POR ZONA / SUCURSAL */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                                <span>🏢</span>
                                <span>Comportamiento por Zona / Sucursal</span>
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Distribución de registros abiertos y cerrados por centro de distribución
                            </p>
                        </div>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                            {comparativaData?.sucursales?.length || 0} Zonas
                        </span>
                    </div>

                    <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                        {(comparativaData?.sucursales || []).map((suc) => {
                            const isFilterActive = compSucursalFilter === suc.sucursal
                            return (
                                <div
                                    key={suc.sucursal}
                                    onClick={() => {
                                        const nextSuc = isFilterActive ? 'TODAS' : suc.sucursal
                                        setCompSucursalFilter(nextSuc)
                                        setCompCurrentPage(1)
                                        fetchComparativaData({ sucursal: nextSuc, page: 1 })
                                    }}
                                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                                        isFilterActive
                                            ? 'border-sky-500 bg-sky-50/50 shadow-sm ring-1 ring-sky-500/30'
                                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                                    }`}
                                >
                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="font-extrabold text-slate-900">{suc.sucursal}</span>
                                            <span className="text-[11px] font-mono text-slate-500">
                                                ({suc.totalRegistros} total)
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 font-mono font-bold text-xs">
                                            <span className="text-emerald-700">✓ {suc.totalCerrados} ({suc.porcentajeCerrados}%)</span>
                                            <span className="text-amber-700">⏳ {suc.totalAbiertos} ({suc.porcentajeAbiertos}%)</span>
                                        </div>
                                    </div>

                                    {/* Barra bicolor */}
                                    <div className="w-full bg-amber-100 rounded-full h-2 overflow-hidden flex">
                                        <div
                                            className="bg-emerald-500 h-full transition-all duration-500"
                                            style={{ width: `${suc.porcentajeCerrados}%` }}
                                        />
                                        <div
                                            className="bg-amber-400 h-full transition-all duration-500"
                                            style={{ width: `${suc.porcentajeAbiertos}%` }}
                                        />
                                    </div>

                                    {/* Desglose por módulos */}
                                    <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-[10px] font-mono text-center">
                                        <div className="bg-slate-50 p-1 rounded-lg border border-slate-100">
                                            <span className="text-slate-400 block">🏥 Ausent.</span>
                                            <span className="font-bold text-slate-700">{suc.ausentismo.cerrados}/{suc.ausentismo.cerrados + suc.ausentismo.abiertos}</span>
                                        </div>
                                        <div className="bg-slate-50 p-1 rounded-lg border border-slate-100">
                                            <span className="text-slate-400 block">⏱️ Extras</span>
                                            <span className="font-bold text-slate-700">{suc.horasExtras.cerrados}/{suc.horasExtras.cerrados + suc.horasExtras.abiertos}</span>
                                        </div>
                                        <div className="bg-slate-50 p-1 rounded-lg border border-slate-100">
                                            <span className="text-slate-400 block">⏳ Atrasos</span>
                                            <span className="font-bold text-slate-700">{suc.atrasos.cerrados}/{suc.atrasos.cerrados + suc.atrasos.abiertos}</span>
                                        </div>
                                        <div className="bg-slate-50 p-1 rounded-lg border border-slate-100">
                                            <span className="text-slate-400 block">🏃 Adel.</span>
                                            <span className="font-bold text-slate-700">{suc.adelantos.cerrados}/{suc.adelantos.cerrados + suc.adelantos.abiertos}</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* PANEL 4.B: TRAZABILIDAD POR USUARIO MODIFICADOR */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                                <span>👤</span>
                                <span>Usuarios Modificadores y Cierre</span>
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Supervisores, jefes y administradores que han gestionado o cerrado registros
                            </p>
                        </div>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                            {comparativaData?.usuariosModificadores?.length || 0} Usuarios
                        </span>
                    </div>

                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                        {(comparativaData?.usuariosModificadores || []).length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-xs">
                                No se registran intervenciones manuales aún.
                            </div>
                        ) : (
                            (comparativaData?.usuariosModificadores || []).map((u) => {
                                const isFilterActive = compUsuarioFilter === u.usuario
                                return (
                                    <div
                                        key={u.usuario}
                                        onClick={() => {
                                            const nextUser = isFilterActive ? 'TODOS' : u.usuario
                                            setCompUsuarioFilter(nextUser)
                                            setCompCurrentPage(1)
                                            fetchComparativaData({ usuarioModificador: nextUser, page: 1 })
                                        }}
                                        className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                                            isFilterActive
                                                ? 'border-sky-500 bg-sky-50/50 shadow-sm ring-1 ring-sky-500/30'
                                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-xs font-bold text-slate-900 block">{u.usuario}</span>
                                                <span className="text-[10px] text-slate-500 font-medium">{u.rol}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-mono font-bold text-slate-800 block">
                                                    {u.totalModificaciones} modif.
                                                </span>
                                                <span className="text-[10px] font-mono font-bold text-emerald-700">
                                                    {u.totalCerrados} cerrados
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-1.5">
                                            <div className="flex gap-1 flex-wrap">
                                                {u.modulosIntervenidos.map((m) => (
                                                    <span key={m} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                                                        {m}
                                                    </span>
                                                ))}
                                            </div>
                                            {u.ultimaModificacion && (
                                                <span className="font-mono">
                                                    {new Date(u.ultimaModificacion).toLocaleDateString('es-CL')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* 5. FILTROS DINÁMICOS DE LA MATRIZ */}
            <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-base">🔎</span>
                        <span className="text-xs font-extrabold text-slate-800">
                            Filtros Dinámicos de Comparativa
                        </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => {
                                setCompModuloFilter('TODOS')
                                setCompEstadoFilter('TODOS')
                                setCompSucursalFilter('TODAS')
                                setCompUsuarioFilter('TODOS')
                                setCompSearchQuery('')
                                setCompSortBy('default')
                                setCompSortOrder('asc')
                                setCompCurrentPage(1)
                                fetchComparativaData({
                                    modulo: 'TODOS',
                                    estado: 'TODOS',
                                    sucursal: 'TODAS',
                                    usuarioModificador: 'TODOS',
                                    search: '',
                                    sortBy: 'default',
                                    sortOrder: 'asc',
                                    page: 1
                                })
                            }}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold transition flex items-center gap-1.5"
                        >
                            <span>🧹</span>
                            <span>Limpiar Filtros</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleExportCsv}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                        >
                            <span>📥</span>
                            <span>Exportar Vista CSV</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-1">
                    {/* Filtro Módulo */}
                    <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Módulo</label>
                        <select
                            value={compModuloFilter}
                            onChange={(e) => {
                                const v = e.target.value as any
                                setCompModuloFilter(v)
                                setCompCurrentPage(1)
                                fetchComparativaData({ modulo: v, page: 1 })
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="TODOS">Todos los Módulos</option>
                            <option value="AUSENTISMO">1. Ausentismo</option>
                            <option value="HORAS_EXTRAS">2. Horas Extras</option>
                            <option value="ATRASOS">3. Atrasos</option>
                            <option value="ADELANTOS">4. Adelantos</option>
                        </select>
                    </div>

                    {/* Filtro Estado */}
                    <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Estado</label>
                        <select
                            value={compEstadoFilter}
                            onChange={(e) => {
                                const v = e.target.value as any
                                setCompEstadoFilter(v)
                                setCompCurrentPage(1)
                                fetchComparativaData({ estado: v, page: 1 })
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="TODOS">Todos los Estados</option>
                            <option value="ABIERTO">⏳ Solo Abiertos</option>
                            <option value="CERRADO">✅ Solo Cerrados</option>
                        </select>
                    </div>

                    {/* Filtro Sucursal */}
                    <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Zona / Sucursal</label>
                        <select
                            value={compSucursalFilter}
                            onChange={(e) => {
                                const v = e.target.value
                                setCompSucursalFilter(v)
                                setCompCurrentPage(1)
                                fetchComparativaData({ sucursal: v, page: 1 })
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="TODAS">Todas las Zonas</option>
                            {(comparativaData?.sucursalesDisponibles || []).map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Usuario Modificador */}
                    <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Modificado / Cerrado Por</label>
                        <select
                            value={compUsuarioFilter}
                            onChange={(e) => {
                                const v = e.target.value
                                setCompUsuarioFilter(v)
                                setCompCurrentPage(1)
                                fetchComparativaData({ usuarioModificador: v, page: 1 })
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="TODOS">Todos los Usuarios</option>
                            {(comparativaData?.usuariosDisponibles || []).map((u) => (
                                <option key={u} value={u}>{u}</option>
                            ))}
                        </select>
                    </div>

                    {/* Búsqueda por Texto */}
                    <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Búsqueda Rápida</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Colaborador, RUT, RBD..."
                                value={compSearchQuery}
                                onChange={(e) => {
                                    const q = e.target.value
                                    setCompSearchQuery(q)
                                    setCompCurrentPage(1)
                                    fetchComparativaData({ search: q, page: 1 })
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
                                🔍
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 6. TABLA MATRIZ COMPARATIVA DE REGISTROS */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                <div className="p-4 px-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                                <span>📋</span>
                                <span>Matriz Comparativa de Registros</span>
                                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-sky-100 text-sky-800 font-mono">
                                    Página {comparativaData?.page || 1} de {comparativaData?.totalPages || 1}
                                </span>
                            </h4>
                            {compSortBy !== 'default' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCompSortBy('default')
                                        setCompSortOrder('asc')
                                        setCompCurrentPage(1)
                                        fetchComparativaData({ sortBy: 'default', sortOrder: 'asc', page: 1 })
                                    }}
                                    className="px-2.5 py-0.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[11px] font-bold transition flex items-center gap-1 shadow-xs"
                                    title="Restablecer regla inicial: Abiertos primero, luego Cerrados de más reciente a más antiguo"
                                >
                                    <span>↺</span>
                                    <span>Restablecer orden inicial</span>
                                </button>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            {compSortBy === 'default' ? (
                                <>Regla de ordenamiento activa: <strong className="text-amber-700">Registros Abiertos en cabecera</strong>, seguidos sucesivamente de <strong className="text-emerald-700">Cerrados de más reciente a más antiguo</strong>.</>
                            ) : (
                                <>Ordenando por columna: <strong className="text-cyan-800 font-bold uppercase">{compSortBy}</strong> ({compSortOrder === 'asc' ? 'Ascendente ▲' : 'Descendente ▼'}). Haz clic en la cabecera para invertir o en &quot;Restablecer orden inicial&quot;.</>
                            )}
                        </p>
                    </div>

                    {/* Selector de registros por página: 5, 10, 20, 50, 100 */}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Mostrar:</span>
                        <select
                            value={compPageSize}
                            onChange={(e) => {
                                const sz = Number(e.target.value)
                                setCompPageSize(sz)
                                setCompCurrentPage(1)
                                fetchComparativaData({ pageSize: sz, page: 1 })
                            }}
                            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-sm cursor-pointer"
                        >
                            <option value={5}>5 por página</option>
                            <option value={10}>10 por página (Por defecto)</option>
                            <option value={20}>20 por página</option>
                            <option value={50}>50 por página</option>
                            <option value={100}>100 por página</option>
                        </select>
                    </div>
                </div>

                {isCompLoading ? (
                    <div className="py-20 text-center text-slate-400">
                        <div className="animate-spin text-3xl mb-3">🌀</div>
                        <span className="text-xs font-semibold">Cargando registros comparativos...</span>
                    </div>
                ) : (comparativaData?.registros || []).length === 0 ? (
                    <div className="py-20 text-center text-slate-400">
                        <div className="text-4xl mb-2">📭</div>
                        <p className="text-sm font-bold text-slate-600">No se encontraron registros</p>
                        <p className="text-xs text-slate-400 mt-1">Intente ajustar los filtros seleccionados o limpie la búsqueda.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider select-none">
                                    <th className="py-3 px-3 text-center">#</th>
                                    <th
                                        onClick={() => handleCompSort('estado')}
                                        className={`py-3 px-3 cursor-pointer group transition-colors hover:bg-slate-200/70 ${compSortBy === 'estado' ? 'bg-cyan-50 text-cyan-900 font-extrabold' : ''}`}
                                        title="Ordenar por Estado (Ascendente / Descendente)"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Estado</span>
                                            <span className={compSortBy === 'estado' ? 'text-cyan-700 font-extrabold text-xs' : 'text-slate-300 group-hover:text-slate-500 text-[11px]'}>
                                                {compSortBy === 'estado' ? (compSortOrder === 'asc' ? '▲' : '▼') : '↕'}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleCompSort('modulo')}
                                        className={`py-3 px-3 cursor-pointer group transition-colors hover:bg-slate-200/70 ${compSortBy === 'modulo' ? 'bg-cyan-50 text-cyan-900 font-extrabold' : ''}`}
                                        title="Ordenar por Módulo (Ascendente / Descendente)"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Módulo</span>
                                            <span className={compSortBy === 'modulo' ? 'text-cyan-700 font-extrabold text-xs' : 'text-slate-300 group-hover:text-slate-500 text-[11px]'}>
                                                {compSortBy === 'modulo' ? (compSortOrder === 'asc' ? '▲' : '▼') : '↕'}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleCompSort('fecha')}
                                        className={`py-3 px-3 cursor-pointer group transition-colors hover:bg-slate-200/70 ${compSortBy === 'fecha' ? 'bg-cyan-50 text-cyan-900 font-extrabold' : ''}`}
                                        title="Ordenar por Fecha (Ascendente / Descendente)"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Fecha</span>
                                            <span className={compSortBy === 'fecha' ? 'text-cyan-700 font-extrabold text-xs' : 'text-slate-300 group-hover:text-slate-500 text-[11px]'}>
                                                {compSortBy === 'fecha' ? (compSortOrder === 'asc' ? '▲' : '▼') : '↕'}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleCompSort('sucursal')}
                                        className={`py-3 px-3 cursor-pointer group transition-colors hover:bg-slate-200/70 ${compSortBy === 'sucursal' ? 'bg-cyan-50 text-cyan-900 font-extrabold' : ''}`}
                                        title="Ordenar por Zona / Sucursal (Ascendente / Descendente)"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Zona / Sucursal</span>
                                            <span className={compSortBy === 'sucursal' ? 'text-cyan-700 font-extrabold text-xs' : 'text-slate-300 group-hover:text-slate-500 text-[11px]'}>
                                                {compSortBy === 'sucursal' ? (compSortOrder === 'asc' ? '▲' : '▼') : '↕'}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleCompSort('establecimiento')}
                                        className={`py-3 px-3 cursor-pointer group transition-colors hover:bg-slate-200/70 ${compSortBy === 'establecimiento' ? 'bg-cyan-50 text-cyan-900 font-extrabold' : ''}`}
                                        title="Ordenar por RBD / Establecimiento (Ascendente / Descendente)"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>RBD / Establecimiento</span>
                                            <span className={compSortBy === 'establecimiento' ? 'text-cyan-700 font-extrabold text-xs' : 'text-slate-300 group-hover:text-slate-500 text-[11px]'}>
                                                {compSortBy === 'establecimiento' ? (compSortOrder === 'asc' ? '▲' : '▼') : '↕'}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleCompSort('colaborador')}
                                        className={`py-3 px-3 cursor-pointer group transition-colors hover:bg-slate-200/70 ${compSortBy === 'colaborador' ? 'bg-cyan-50 text-cyan-900 font-extrabold' : ''}`}
                                        title="Ordenar por Colaborador (Ascendente / Descendente)"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Colaborador</span>
                                            <span className={compSortBy === 'colaborador' ? 'text-cyan-700 font-extrabold text-xs' : 'text-slate-300 group-hover:text-slate-500 text-[11px]'}>
                                                {compSortBy === 'colaborador' ? (compSortOrder === 'asc' ? '▲' : '▼') : '↕'}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleCompSort('gestionDetalle')}
                                        className={`py-3 px-3 cursor-pointer group transition-colors hover:bg-slate-200/70 ${compSortBy === 'gestionDetalle' ? 'bg-cyan-50 text-cyan-900 font-extrabold' : ''}`}
                                        title="Ordenar por Detalle Gestión (Ascendente / Descendente)"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Detalle Gestión</span>
                                            <span className={compSortBy === 'gestionDetalle' ? 'text-cyan-700 font-extrabold text-xs' : 'text-slate-300 group-hover:text-slate-500 text-[11px]'}>
                                                {compSortBy === 'gestionDetalle' ? (compSortOrder === 'asc' ? '▲' : '▼') : '↕'}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleCompSort('usuarioModificador')}
                                        className={`py-3 px-3 cursor-pointer group transition-colors hover:bg-slate-200/70 ${compSortBy === 'usuarioModificador' ? 'bg-cyan-50 text-cyan-900 font-extrabold' : ''}`}
                                        title="Ordenar por Usuario Modificador / Cierre (Ascendente / Descendente)"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Modificado / Cerrado Por</span>
                                            <span className={compSortBy === 'usuarioModificador' ? 'text-cyan-700 font-extrabold text-xs' : 'text-slate-300 group-hover:text-slate-500 text-[11px]'}>
                                                {compSortBy === 'usuarioModificador' ? (compSortOrder === 'asc' ? '▲' : '▼') : '↕'}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleCompSort('trazabilidad')}
                                        className={`py-3 px-3 text-right cursor-pointer group transition-colors hover:bg-slate-200/70 ${compSortBy === 'trazabilidad' ? 'bg-cyan-50 text-cyan-900 font-extrabold' : ''}`}
                                        title="Ordenar por Fecha de Cierre o Modificación (Ascendente / Descendente)"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Trazabilidad Fecha</span>
                                            <span className={compSortBy === 'trazabilidad' ? 'text-cyan-700 font-extrabold text-xs' : 'text-slate-300 group-hover:text-slate-500 text-[11px]'}>
                                                {compSortBy === 'trazabilidad' ? (compSortOrder === 'asc' ? '▲' : '▼') : '↕'}
                                            </span>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {(comparativaData?.registros || []).map((reg, idx) => {
                                    const isAbierto = reg.estado === 'ABIERTO'
                                    const num = ((comparativaData?.page || 1) - 1) * (comparativaData?.pageSize || compPageSize) + idx + 1

                                    let moduloBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200'
                                    let moduloIcon = '📋'
                                    if (reg.modulo === 'AUSENTISMO') {
                                        moduloBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200'
                                        moduloIcon = '🏥'
                                    } else if (reg.modulo === 'HORAS_EXTRAS') {
                                        moduloBadgeClass = 'bg-sky-50 text-sky-700 border-sky-200'
                                        moduloIcon = '⏱️'
                                    } else if (reg.modulo === 'ATRASOS') {
                                        moduloBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200'
                                        moduloIcon = '⏳'
                                    } else if (reg.modulo === 'ADELANTOS') {
                                        moduloBadgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                        moduloIcon = '🚪'
                                    }

                                    return (
                                        <tr
                                            key={`${reg.modulo}-${reg.id}`}
                                            className={`hover:bg-sky-50/40 transition-colors ${
                                                isAbierto ? 'bg-amber-50/20' : 'bg-white'
                                            }`}
                                        >
                                            {/* Correlativo */}
                                            <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-400">
                                                {num}
                                            </td>

                                            {/* Estado */}
                                            <td className="py-3 px-3 whitespace-nowrap">
                                                {isAbierto ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 shadow-sm animate-pulse">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                        <span>ABIERTO</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                        <span>CERRADO</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* Módulo */}
                                            <td className="py-3 px-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${moduloBadgeClass}`}>
                                                    <span>{moduloIcon}</span>
                                                    <span>{reg.moduloLabel}</span>
                                                </span>
                                            </td>

                                            {/* Fecha */}
                                            <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-800 font-semibold">
                                                {reg.fecha ? new Date(reg.fecha).toLocaleDateString('es-CL') : '-'}
                                            </td>

                                            {/* Sucursal / Zona */}
                                            <td className="py-3 px-3 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
                                                    <span>📍</span>
                                                    <span>{reg.sucursal}</span>
                                                </span>
                                            </td>

                                            {/* RBD / Establecimiento */}
                                            <td className="py-3 px-3">
                                                <div className="font-bold text-slate-900 leading-tight">
                                                    {reg.establecimiento}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                                                    <span>RBD: <strong className="text-cyan-700">{reg.rbd}</strong></span>
                                                    {reg.comuna && <span>• {reg.comuna}</span>}
                                                </div>
                                            </td>

                                            {/* Colaborador */}
                                            <td className="py-3 px-3">
                                                <div className="font-extrabold text-slate-900 leading-tight">
                                                    {reg.colaborador}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                    RUT: {reg.rut} {reg.cargo && `• ${reg.cargo}`}
                                                </div>
                                            </td>

                                            {/* Detalle Gestión */}
                                            <td className="py-3 px-3 max-w-xs">
                                                <div className="text-slate-800 font-medium truncate" title={reg.gestionDetalle}>
                                                    {reg.gestionDetalle || '-'}
                                                </div>
                                                {reg.aplicaOpciones && (
                                                    <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">
                                                        {reg.aplicaOpciones}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Modificado / Cerrado Por */}
                                            <td className="py-3 px-3 whitespace-nowrap">
                                                {reg.usuarioModificador ? (
                                                    <div>
                                                        <span className="font-bold text-slate-900 flex items-center gap-1">
                                                            <span>👤</span>
                                                            <span>{reg.usuarioModificador}</span>
                                                        </span>
                                                        {reg.usuarioModificadorRol && (
                                                            <span className="text-[10px] text-cyan-700 font-semibold block">
                                                                {reg.usuarioModificadorRol}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : reg.cerradoPor ? (
                                                    <div>
                                                        <span className="font-bold text-emerald-800 flex items-center gap-1">
                                                            <span>🔒</span>
                                                            <span>{reg.cerradoPor}</span>
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic text-[11px]">Sin intervención</span>
                                                )}
                                            </td>

                                            {/* Trazabilidad Fecha */}
                                            <td className="py-3 px-3 text-right whitespace-nowrap text-[11px] font-mono text-slate-500">
                                                {reg.cerradoAt ? (
                                                    <div>
                                                        <span className="text-emerald-700 font-bold">Cierre:</span> {new Date(reg.cerradoAt).toLocaleDateString('es-CL')}
                                                    </div>
                                                ) : reg.updatedAt ? (
                                                    <div>
                                                        <span className="text-slate-600">Actualizado:</span> {new Date(reg.updatedAt).toLocaleDateString('es-CL')}
                                                    </div>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Paginador con botones Anterior y Siguiente */}
                <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/50">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span>
                            Página <strong className="text-slate-800">{comparativaData?.page || 1}</strong> de <strong className="text-slate-800">{comparativaData?.totalPages || 1}</strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>
                            Total: <strong className="text-slate-800 font-mono">{comparativaData?.totalRegistros || 0}</strong> registros
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-500">
                            (Mostrando {comparativaData?.registros?.length || 0} de {compPageSize} por página)
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            disabled={(comparativaData?.page || 1) <= 1 || isCompLoading}
                            onClick={() => {
                                const prev = Math.max(1, (comparativaData?.page || 1) - 1)
                                setCompCurrentPage(prev)
                                fetchComparativaData({ page: prev })
                            }}
                            className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold text-slate-700 shadow-xs flex items-center gap-1.5"
                        >
                            <span>←</span>
                            <span>Anterior</span>
                        </button>
                        <div className="px-3 py-1 rounded-xl bg-slate-100 font-mono font-bold text-slate-800 text-xs border border-slate-200">
                            {comparativaData?.page || 1} / {comparativaData?.totalPages || 1}
                        </div>
                        <button
                            type="button"
                            disabled={(comparativaData?.page || 1) >= (comparativaData?.totalPages || 1) || isCompLoading}
                            onClick={() => {
                                const next = Math.min(comparativaData?.totalPages || 1, (comparativaData?.page || 1) + 1)
                                setCompCurrentPage(next)
                                fetchComparativaData({ page: next })
                            }}
                            className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold text-slate-700 shadow-xs flex items-center gap-1.5"
                        >
                            <span>Siguiente</span>
                            <span>→</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

