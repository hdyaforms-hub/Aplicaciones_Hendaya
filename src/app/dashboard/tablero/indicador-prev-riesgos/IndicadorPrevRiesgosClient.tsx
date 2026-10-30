'use client'

import React, { useState, useTransition } from 'react'
import {
    IndicadoresPrevRiesgosDashboardData,
    ZonaReporteItem,
    getIndicadorPrevRiesgosData
} from './actions'

interface Props {
    initialData: IndicadoresPrevRiesgosDashboardData
    currentUser: {
        username: string
        name?: string | null
        roleName?: string | null
    }
}

const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sept', 'Oct', 'Nov', 'Dic']

const SUCURSAL_NAME_MAP: Record<string, string> = {
    'Metropolitana': 'CD METRO',
    'Copiapó': 'CD COPIAPO',
    'Copiapo': 'CD COPIAPO',
    'Vallenar': 'CD VALLENAR',
    'Coyhaique': 'CD COYHAIQUE'
}

export default function IndicadorPrevRiesgosClient({ initialData, currentUser }: Props) {
    const [data, setData] = useState<IndicadoresPrevRiesgosDashboardData>(initialData)
    const [selectedPeriodoId, setSelectedPeriodoId] = useState<string>(initialData.periodosDisponibles[0]?.id || '')
    const [selectedZonaIndex, setSelectedZonaIndex] = useState<number>(0)
    const [isPending, startTransition] = useTransition()

    // Cambiar período de carga
    const handlePeriodoChange = (cargaId: string) => {
        setSelectedPeriodoId(cargaId)
        startTransition(async () => {
            try {
                const fresh = await getIndicadorPrevRiesgosData(cargaId)
                setData(fresh)
                setSelectedZonaIndex(0)
            } catch (err) {
                console.error('Error cargando período de indicadores:', err)
            }
        })
    }

    const currentZona: ZonaReporteItem | undefined = data.zonas[selectedZonaIndex] || data.zonas[0]

    // Años para comparativas (ej. 2024, 2025, 2026)
    const anioActual = data.anio
    const anioAnt1 = anioActual - 1
    const anioAnt2 = anioActual - 2
    const years3 = [anioAnt2, anioAnt1, anioActual]

    // Formateador numérico
    const fmt = (n: number | null | undefined, dec = 2) => {
        if (n === null || n === undefined || isNaN(n)) return '—'
        return n.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 lg:p-8 space-y-8">
            {/* ENCABEZADO EJECUTIVO HENDAYA */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center text-3xl shadow-sm shrink-0">
                        🛡️
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                                Indicadores Prevención de Riesgos
                            </h1>
                            <span className="text-[11px] font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-300">
                                HENDAYA
                            </span>
                            <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                                Tableros y Avances
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-slate-500 mt-1">
                            Panel oficial de tasas de siniestralidad, accidentabilidad por sucursal, ranking y cotización DS N°67.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
                    {/* Badge de seguridad / perfil */}
                    {data.permisos.isRestrictedByRbd ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                            <span>🔒</span>
                            <span>Restringido a tu perfil ({data.permisos.sucursalesAutorizadas.length} sucursales)</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                            <span>🌐</span>
                            <span>Acceso Global (Todas las Sucursales)</span>
                        </div>
                    )}

                    {/* Selector de período si hay varios cargados */}
                    {data.periodosDisponibles.length > 1 && (
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                            <span className="text-slate-500 font-semibold">Período:</span>
                            <select
                                value={selectedPeriodoId}
                                onChange={(e) => handlePeriodoChange(e.target.value)}
                                disabled={isPending}
                                className="bg-transparent font-bold text-slate-800 focus:outline-none"
                            >
                                {data.periodosDisponibles.map(p => (
                                    <option key={p.id} value={p.id}>{p.periodo}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <a
                        href="/dashboard/areas/prevencion-riesgos/carga-masiva"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-sm"
                    >
                        <span>📥</span>
                        <span>Cargar Excel</span>
                    </a>
                </div>
            </div>

            {/* BARRA INFORMATIVA DE PERÍODO Y FUENTE */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                        <span>📅</span>
                        <span>Período Vigente:</span>
                        <span className="text-sky-700 font-black">{data.periodo}</span>
                    </span>
                    {data.hasData && (
                        <>
                            <span className="text-slate-300">•</span>
                            <span>Corte de datos a: <strong>{MESES_LABEL[data.mes - 1] || `Mes ${data.mes}`} {data.anio}</strong></span>
                        </>
                    )}
                </div>
                <div className="text-[11px] text-slate-400">
                    Fuente: <strong className="text-slate-600">{data.fuente}</strong>
                </div>
            </div>

            {!data.hasData ? (
                <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center shadow-sm space-y-5 max-w-2xl mx-auto my-12">
                    <div className="w-20 h-20 rounded-3xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center text-4xl mx-auto shadow-sm">
                        📊
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-extrabold text-slate-800">
                            No hay datos de indicadores cargados
                        </h2>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">
                            Actualmente no existen planillas de indicadores en la base de datos o el registro de carga fue eliminado. Para visualizar las tasas, el análisis por sucursal y la proyección DS 67, cargue el archivo Excel.
                        </p>
                    </div>
                    <div>
                        <a
                            href="/dashboard/areas/prevencion-riesgos/carga-masiva"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-200 transition-all"
                        >
                            <span>📤</span>
                            <span>Ir a Carga Masiva de Excel</span>
                        </a>
                    </div>
                </div>
            ) : (
                <>
            {/* SECCIÓN 1: INDICADORES NACIONALES (4 KPIS) */}
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🇨🇱</span>
                        <h2 className="text-lg font-extrabold text-slate-900">
                            Indicadores Nacionales
                        </h2>
                    </div>
                    <span className="text-xs text-slate-500">
                        Evaluación acumulada nacional vs metas anuales
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {data.nacional.map((item) => {
                        const isUnderMeta = item.current !== null && item.current <= item.meta
                        const hasCurrent = item.current !== null
                        const maxVal = Math.max(item.meta * 1.3, ...item.values.map(v => v || 0))

                        return (
                            <div
                                key={item.id}
                                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                                                {item.label}
                                            </span>
                                            <span className="text-[10px] text-slate-400 mt-0.5 block" title={item.desc}>
                                                Meta: &lt;= {item.meta} {item.unit}
                                            </span>
                                        </div>

                                        {hasCurrent && (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${
                                                isUnderMeta
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                            }`}>
                                                {isUnderMeta ? '✓ Bajo meta' : '⚠️ Sobre meta'}
                                            </span>
                                        )}
                                    </div>

                                    {/* VALOR ACTUAL EN GRANDE */}
                                    <div className="mt-3 flex items-baseline gap-2">
                                        <span className={`text-3xl font-black tracking-tight ${
                                            !hasCurrent ? 'text-slate-400' : isUnderMeta ? 'text-emerald-700' : 'text-rose-700'
                                        }`}>
                                            {fmt(item.current, item.decimals ?? 2)}
                                        </span>
                                        {item.unit && (
                                            <span className="text-xs text-slate-500 font-semibold">{item.unit}</span>
                                        )}
                                    </div>

                                    {/* MESES SOBRE LA META */}
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        {item.overMonths === 0 ? (
                                            <span className="text-emerald-700 font-bold">0 de {item.totalMonths} meses sobre la meta</span>
                                        ) : (
                                            <span><strong className="text-rose-700">{item.overMonths}</strong> de {item.totalMonths} meses sobre la meta</span>
                                        )}
                                    </p>
                                </div>

                                {/* MINI GRÁFICO DE BARRAS MENSUAL (SVG) */}
                                <div className="mt-4 pt-3 border-t border-slate-100">
                                    <div className="flex items-center justify-between text-[9px] text-slate-400 mb-1">
                                        <span>Evolución mensual</span>
                                        <span className="font-semibold">Meta ({item.meta})</span>
                                    </div>
                                    <div className="h-16 flex items-end gap-1 relative bg-slate-50/60 rounded-lg p-1.5 border border-slate-100">
                                        {/* Línea horizontal de meta */}
                                        <div
                                            className="absolute left-0 right-0 border-b border-dashed border-sky-400 pointer-events-none z-10"
                                            style={{
                                                bottom: `${Math.min(95, Math.max(5, (item.meta / maxVal) * 100))}%`
                                            }}
                                            title={`Meta: ${item.meta}`}
                                        />

                                        {/* Barras de cada mes */}
                                        {item.values.map((val, mIdx) => {
                                            if (val === null) {
                                                return (
                                                    <div key={mIdx} className="flex-1 h-full flex flex-col justify-end items-center">
                                                        <div className="w-full bg-slate-200/50 rounded-t h-[2px]"></div>
                                                    </div>
                                                )
                                            }
                                            const hPercent = Math.min(100, Math.max(8, (val / maxVal) * 100))
                                            const over = val > item.meta
                                            return (
                                                <div
                                                    key={mIdx}
                                                    className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                                                >
                                                    <div
                                                        className={`w-full rounded-t transition-all group-hover:opacity-80 ${
                                                            over ? 'bg-rose-500' : 'bg-emerald-500'
                                                        }`}
                                                        style={{ height: `${hPercent}%` }}
                                                    />
                                                    {/* Tooltip simple */}
                                                    <div className="absolute -top-7 bg-slate-900 text-white text-[9px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 whitespace-nowrap">
                                                        {MESES_LABEL[mIdx]}: {fmt(val, item.decimals ?? 2)}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <div className="flex justify-between text-[8px] text-slate-400 font-mono mt-1 px-0.5">
                                        <span>Ene</span>
                                        <span>{MESES_LABEL[item.values.length - 1] || 'Sep'}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* SECCIÓN 2: REPORTABILIDAD POR SUCURSAL / ZONA */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🏢</span>
                            <h2 className="text-lg font-extrabold text-slate-900">
                                Reportabilidad por Sucursal (Zonas)
                            </h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Accidentabilidad, días perdidos y comparación histórica trianual ({years3.join(' · ')}).
                        </p>
                    </div>

                    {/* SELECTOR DE SUCURSAL / ZONA */}
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl flex-wrap">
                        {data.zonas.map((z, idx) => {
                            const sucursalNombre = z.sucursalSistema || SUCURSAL_NAME_MAP[z.name] || z.name
                            return (
                                <button
                                    key={z.name}
                                    type="button"
                                    onClick={() => setSelectedZonaIndex(idx)}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        selectedZonaIndex === idx
                                            ? 'bg-sky-600 text-white shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                    }`}
                                >
                                    {sucursalNombre}
                                </button>
                            )
                        })}

                        {/* TAB TODOS HENDAYA */}
                        <button
                            type="button"
                            onClick={() => setSelectedZonaIndex(data.zonas.length)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                                selectedZonaIndex === data.zonas.length
                                    ? 'bg-sky-600 text-white shadow-sm'
                                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                        >
                            <span>🏢</span>
                            <span>Todos Hendaya</span>
                        </button>
                    </div>
                </div>

                {(() => {
                    const isTotalHendaya = selectedZonaIndex === data.zonas.length
                    const activeZona = isTotalHendaya ? null : (data.zonas[selectedZonaIndex] || data.zonas[0])

                    if (!isTotalHendaya && !activeZona) return null

                    const zoneDisplayName = isTotalHendaya
                        ? 'Todos Hendaya'
                        : (activeZona?.sucursalSistema || SUCURSAL_NAME_MAP[activeZona?.name || ''] || activeZona?.name || '')

                    const accSource = isTotalHendaya ? data.totales.accidentes : (activeZona?.accMensual || {})
                    const diasSource = isTotalHendaya ? data.totales.dias : (activeZona?.diasMensual || {})

                    const accCurrent = (accSource[anioActual] || []).slice(0, data.mes).reduce((s: number, v) => s + (v || 0), 0)
                    const accPrior = (accSource[anioAnt1] || []).slice(0, data.mes).reduce((s: number, v) => s + (v || 0), 0)
                    const diffAcc = accCurrent - accPrior
                    const pctAcc = accPrior > 0 ? (diffAcc / accPrior) * 100 : 0

                    const diasCurrent = (diasSource[anioActual] || []).slice(0, data.mes).reduce((s: number, v) => s + (v || 0), 0)
                    const diasPrior = (diasSource[anioAnt1] || []).slice(0, data.mes).reduce((s: number, v) => s + (v || 0), 0)
                    const diffDias = diasCurrent - diasPrior
                    const pctDias = diasPrior > 0 ? (diffDias / diasPrior) * 100 : 0

                    return (
                    <div className="space-y-6">
                        {/* CIERRE COMPARATIVO AÑO ACTUAL VS AÑO ANTERIOR */}
                        <div className="space-y-2">
                            <span className="text-[11px] font-black tracking-wider text-slate-500 uppercase block">
                                Cierre a Ene–{MESES_LABEL[data.mes - 1]} {anioActual} vs. Ene–{MESES_LABEL[data.mes - 1]} {anioAnt1} ({zoneDisplayName})
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* ACCIDENTES ACUMULADOS */}
                                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                        Accidentes Acumulados (Ene–{MESES_LABEL[data.mes - 1]})
                                    </span>
                                    <div className="flex items-baseline gap-3 flex-wrap">
                                        <span className="text-3xl font-black text-slate-900">
                                            {accCurrent}
                                        </span>
                                        {diffAcc !== 0 ? (
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                diffAcc < 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                            }`}>
                                                <span>{diffAcc < 0 ? '↓' : '↑'}</span>
                                                <span>{Math.abs(diffAcc)} {diffAcc < 0 ? 'menos' : 'más'} ({pctAcc > 0 ? '+' : ''}{fmt(pctAcc, 1)}%)</span>
                                            </span>
                                        ) : (
                                            <span className="text-xs font-bold text-slate-500">= Igual al período anterior</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 pt-1 border-t border-slate-200/60">
                                        {anioAnt1} (mismo período): <strong className="text-slate-800">{accPrior}</strong>
                                    </p>
                                </div>

                                {/* DÍAS PERDIDOS ACUMULADOS */}
                                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                        Días Perdidos Acumulados (Ene–{MESES_LABEL[data.mes - 1]})
                                    </span>
                                    <div className="flex items-baseline gap-3 flex-wrap">
                                        <span className="text-3xl font-black text-slate-900">
                                            {diasCurrent.toLocaleString('es-CL')}
                                        </span>
                                        {diffDias !== 0 ? (
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                diffDias < 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                            }`}>
                                                <span>{diffDias < 0 ? '↓' : '↑'}</span>
                                                <span>{Math.abs(diffDias)} {diffDias < 0 ? 'menos' : 'más'} ({pctDias > 0 ? '+' : ''}{fmt(pctDias, 1)}%)</span>
                                            </span>
                                        ) : (
                                            <span className="text-xs font-bold text-slate-500">= Igual al período anterior</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 pt-1 border-t border-slate-200/60">
                                        {anioAnt1} (mismo período): <strong className="text-slate-800">{diasPrior.toLocaleString('es-CL')}</strong>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* TARJETAS COMPARATIVAS TRIANUALES (ACCIDENTES Y DÍAS PERDIDOS) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* COMPARATIVA ACCIDENTES */}
                            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold text-slate-700 uppercase">
                                        Accidentes de Trabajo — {zoneDisplayName}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                        Acumulado Ene–{MESES_LABEL[data.mes - 1]}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {years3.map((y) => {
                                        const vals = (accSource[y] || []).slice(0, data.mes)
                                        const total = vals.reduce((s: number, v) => s + (v || 0), 0)
                                        const isCurrent = y === anioActual
                                        return (
                                            <div
                                                key={y}
                                                className={`p-3 rounded-xl border text-center ${
                                                    isCurrent
                                                        ? 'bg-white border-sky-300 ring-2 ring-sky-400/30'
                                                        : 'bg-white/80 border-slate-200'
                                                }`}
                                            >
                                                <span className="block text-[10px] font-bold text-slate-500">{y}</span>
                                                <span className={`text-xl font-black ${isCurrent ? 'text-sky-800' : 'text-slate-800'}`}>
                                                    {total}
                                                </span>
                                                <span className="block text-[9px] text-slate-400">accidentes</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* COMPARATIVA DÍAS PERDIDOS */}
                            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold text-slate-700 uppercase">
                                        Días Perdidos — {zoneDisplayName}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                        Acumulado Ene–{MESES_LABEL[data.mes - 1]}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {years3.map((y) => {
                                        const vals = (diasSource[y] || []).slice(0, data.mes)
                                        const total = vals.reduce((s: number, v) => s + (v || 0), 0)
                                        const isCurrent = y === anioActual
                                        return (
                                            <div
                                                key={y}
                                                className={`p-3 rounded-xl border text-center ${
                                                    isCurrent
                                                        ? 'bg-white border-amber-300 ring-2 ring-amber-400/30'
                                                        : 'bg-white/80 border-slate-200'
                                                }`}
                                            >
                                                <span className="block text-[10px] font-bold text-slate-500">{y}</span>
                                                <span className={`text-xl font-black ${isCurrent ? 'text-amber-800' : 'text-slate-800'}`}>
                                                    {total.toLocaleString('es-CL')}
                                                </span>
                                                <span className="block text-[9px] text-slate-400">días perdidos</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* GRÁFICOS ANALÍTICOS */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* GRÁFICO A: N° ACCIDENTES MENSUAL (3 AÑOS) */}
                            <div className="border border-slate-200 rounded-2xl p-5 space-y-3 bg-white">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-extrabold text-slate-800 uppercase">
                                        N° Accidentes Mensual ({years3.join(' vs ')})
                                    </h3>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-600">
                                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-300"></span> {years3[0]}</span>
                                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-sky-300"></span> {years3[1]}</span>
                                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-sky-600"></span> {years3[2]}</span>
                                    </div>
                                </div>
                                <div className="h-44 flex items-end gap-1.5 bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    {MESES_LABEL.map((mesNom, mIdx) => {
                                        const v0 = (accSource[years3[0]] || [])[mIdx] || 0
                                        const v1 = (accSource[years3[1]] || [])[mIdx] || 0
                                        const v2 = (accSource[years3[2]] || [])[mIdx]
                                        const maxGroup = Math.max(10, ...years3.flatMap(y => (accSource[y] || []).map(v => v || 0)))
                                        return (
                                            <div key={mIdx} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                                                <div className="w-full flex items-end justify-center gap-0.5 h-full">
                                                    <div className="w-1/3 bg-slate-300 rounded-t transition-all" style={{ height: `${Math.min(100, Math.max(v0 > 0 ? 8 : 2, (v0 / maxGroup) * 100))}%` }} title={`${years3[0]}: ${v0}`} />
                                                    <div className="w-1/3 bg-sky-300 rounded-t transition-all" style={{ height: `${Math.min(100, Math.max(v1 > 0 ? 8 : 2, (v1 / maxGroup) * 100))}%` }} title={`${years3[1]}: ${v1}`} />
                                                    <div className="w-1/3 bg-sky-600 rounded-t transition-all" style={{ height: `${v2 !== null ? Math.min(100, Math.max(v2 > 0 ? 8 : 2, (v2 / maxGroup) * 100)) : 0}%` }} title={`${years3[2]}: ${v2 ?? '—'}`} />
                                                </div>
                                                <span className="text-[9px] font-mono text-slate-500 mt-1">{mesNom}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* GRÁFICO B: N° DÍAS PERDIDOS MENSUAL (3 AÑOS) */}
                            <div className="border border-slate-200 rounded-2xl p-5 space-y-3 bg-white">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-extrabold text-slate-800 uppercase">
                                        N° Días Perdidos Mensual ({years3.join(' vs ')})
                                    </h3>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-600">
                                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-300"></span> {years3[0]}</span>
                                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-300"></span> {years3[1]}</span>
                                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-600"></span> {years3[2]}</span>
                                    </div>
                                </div>
                                <div className="h-44 flex items-end gap-1.5 bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    {MESES_LABEL.map((mesNom, mIdx) => {
                                        const v0 = (diasSource[years3[0]] || [])[mIdx] || 0
                                        const v1 = (diasSource[years3[1]] || [])[mIdx] || 0
                                        const v2 = (diasSource[years3[2]] || [])[mIdx]
                                        const maxGroup = Math.max(50, ...years3.flatMap(y => (diasSource[y] || []).map(v => v || 0)))
                                        return (
                                            <div key={mIdx} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                                                <div className="w-full flex items-end justify-center gap-0.5 h-full">
                                                    <div className="w-1/3 bg-slate-300 rounded-t transition-all" style={{ height: `${Math.min(100, Math.max(v0 > 0 ? 8 : 2, (v0 / maxGroup) * 100))}%` }} title={`${years3[0]}: ${v0}`} />
                                                    <div className="w-1/3 bg-amber-300 rounded-t transition-all" style={{ height: `${Math.min(100, Math.max(v1 > 0 ? 8 : 2, (v1 / maxGroup) * 100))}%` }} title={`${years3[1]}: ${v1}`} />
                                                    <div className="w-1/3 bg-amber-600 rounded-t transition-all" style={{ height: `${v2 !== null ? Math.min(100, Math.max(v2 > 0 ? 8 : 2, (v2 / maxGroup) * 100)) : 0}%` }} title={`${years3[2]}: ${v2 ?? '—'}`} />
                                                </div>
                                                <span className="text-[9px] font-mono text-slate-500 mt-1">{mesNom}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* GRÁFICOS DE ACCIDENTABILIDAD (SOLO CUANDO NO ES TOTAL HENDAYA) */}
                            {!isTotalHendaya && activeZona && (
                                <>
                                    {/* GRÁFICO C: ACCIDENTABILIDAD MENSUAL VS META (1%) */}
                                    <div className="border border-slate-200 rounded-2xl p-5 space-y-3 bg-white">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-extrabold text-slate-800 uppercase">
                                                Tasa de Accidentabilidad Mensual vs Meta
                                            </h3>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                                                Meta: &lt;= {activeZona.accVsMeta.meta}%
                                            </span>
                                        </div>

                                        <div className="h-44 flex items-end gap-2 relative bg-slate-50 rounded-xl p-3 border border-slate-100">
                                            <div
                                                className="absolute left-0 right-0 border-b-2 border-dashed border-rose-400 pointer-events-none z-10"
                                                style={{ bottom: '45%' }}
                                                title={`Meta: ${activeZona.accVsMeta.meta}%`}
                                            />

                                            {activeZona.accVsMeta.values.map((v, idx) => {
                                                const val = v || 0
                                                const maxM = Math.max(2.2, ...activeZona.accVsMeta.values.map(x => x || 0))
                                                const hPct = Math.min(100, Math.max(6, (val / maxM) * 100))
                                                const over = val > activeZona.accVsMeta.meta
                                                return (
                                                    <div key={idx} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                                                        <div
                                                            className={`w-full rounded-t transition-all ${
                                                                over ? 'bg-rose-500' : 'bg-sky-500'
                                                            }`}
                                                            style={{ height: `${hPct}%` }}
                                                        />
                                                        <span className="text-[9px] font-mono text-slate-500 mt-1">
                                                            {MESES_LABEL[idx]}
                                                        </span>
                                                        <div className="absolute -top-7 bg-slate-900 text-white text-[9px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 whitespace-nowrap">
                                                            {MESES_LABEL[idx]}: {fmt(val, 2)}%
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* GRÁFICO D: ACCIDENTABILIDAD ANUAL HISTÓRICA */}
                                    <div className="border border-slate-200 rounded-2xl p-5 space-y-3 bg-white">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-extrabold text-slate-800 uppercase">
                                                Accidentabilidad Anual vs Meta Histórica
                                            </h3>
                                            <span className="text-[10px] text-slate-400">
                                                Evolución multianual
                                            </span>
                                        </div>

                                        <div className="h-44 flex items-end gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100 justify-around">
                                            {activeZona.accAnualVsMeta.categories.map((cat, idx) => {
                                                const act = activeZona.accAnualVsMeta.actual[idx]
                                                const met = activeZona.accAnualVsMeta.meta[idx]
                                                const maxAnual = Math.max(5, ...activeZona.accAnualVsMeta.actual.map(x => x || 0))
                                                const hAct = act !== null ? Math.min(100, Math.max(8, (act / maxAnual) * 100)) : 0
                                                const hMet = met !== null ? Math.min(100, Math.max(8, (met / maxAnual) * 100)) : 0
                                                const over = act !== null && met !== null && act > met

                                                return (
                                                    <div key={idx} className="flex flex-col items-center gap-1.5 flex-1 max-w-[80px]">
                                                        <div className="h-28 w-full flex items-end justify-center gap-1">
                                                            <div
                                                                className={`w-1/2 rounded-t transition-all ${over ? 'bg-rose-500' : 'bg-sky-600'}`}
                                                                style={{ height: `${hAct}%` }}
                                                                title={`Real ${cat}: ${fmt(act, 2)}%`}
                                                            />
                                                            <div
                                                                className="w-1/2 bg-slate-300 rounded-t transition-all"
                                                                style={{ height: `${hMet}%` }}
                                                                title={`Meta ${cat}: ${fmt(met, 2)}%`}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-700">{cat}</span>
                                                        <span className="text-[9px] font-mono text-slate-500">{fmt(act, 2)}%</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    )
                })()}
            </div>

            {/* SECCIÓN 3: RANKING DE ACCIDENTABILIDAD POR SUCURSAL */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">📊</span>
                        <h2 className="text-lg font-extrabold text-slate-900">
                            Tasa de Accidentabilidad Acumulada por Sucursal
                        </h2>
                    </div>
                    <span className="text-xs text-slate-500">
                        Comparación porcentual acumulada al período {data.periodo}
                    </span>
                </div>

                <div className="space-y-3 max-w-3xl">
                    {data.ranking.map((item, idx) => {
                        const maxRank = Math.max(...data.ranking.map(r => r.value), 3)
                        const widthPct = Math.min(100, Math.max(10, (item.value / maxRank) * 100))
                        const isHigh = item.value >= 1.5
                        return (
                            <div key={item.name} className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 text-slate-400">#{idx + 1}</span>
                                        <span>{SUCURSAL_NAME_MAP[item.name] || item.name}</span>
                                    </div>
                                    <span className={`font-mono font-black ${isHigh ? 'text-rose-700' : 'text-sky-700'}`}>
                                        {fmt(item.value, 2)}%
                                    </span>
                                </div>
                                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            isHigh ? 'bg-rose-500' : 'bg-sky-500'
                                        }`}
                                        style={{ width: `${widthPct}%` }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* SECCIÓN 4: COMUNAS Y JEFATURAS (SUPERVISORES) CON MÁS ACCIDENTES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* TOP 10 COMUNAS */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                <span>🏙️</span>
                                <span>Top 10 Comunas</span>
                            </h2>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Comunas con mayor ocurrencia de accidentes de trabajo.
                            </p>
                        </div>
                        <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            {data.top10.comunas.length} comunas
                        </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="py-2.5 px-3">#</th>
                                    <th className="py-2.5 px-3">Comuna</th>
                                    <th className="py-2.5 px-3">Sucursal</th>
                                    <th className="py-2.5 px-3 text-right text-rose-700">Accidentes</th>
                                    <th className="py-2.5 px-3 text-right text-amber-700">Días Perdidos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {data.top10.comunas.map((c, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-2 px-3 font-bold text-slate-400">{i + 1}</td>
                                        <td className="py-2 px-3 font-bold text-slate-900">{c.name}</td>
                                        <td className="py-2 px-3 text-slate-700 font-semibold">{SUCURSAL_NAME_MAP[c.zona] || c.zona}</td>
                                        <td className="py-2 px-3 text-right font-black text-rose-700">{c.acc}</td>
                                        <td className="py-2 px-3 text-right font-semibold text-amber-800">{c.dias}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* TOP 10 JEFATURAS / SUPERVISORES */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                <span>👷</span>
                                <span>Top 10 Supervisores / Jefaturas</span>
                            </h2>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Supervisores del sistema cruzados por asignación de colegios.
                            </p>
                        </div>
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            {data.top10.jefaturas.length} supervisores
                        </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="py-2.5 px-3">#</th>
                                    <th className="py-2.5 px-3">Supervisor / Jefatura</th>
                                    <th className="py-2.5 px-3">Sucursal</th>
                                    <th className="py-2.5 px-3 text-right text-rose-700">Accidentes</th>
                                    <th className="py-2.5 px-3 text-right text-amber-700">Días Perdidos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {data.top10.jefaturas.map((j, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-2 px-3 font-bold text-slate-400">{i + 1}</td>
                                        <td className="py-2 px-3 font-bold text-slate-900">
                                            <div className="flex items-center gap-1.5">
                                                <span>{j.name}</span>
                                                {j.supervisorId && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800" title={`Supervisor registrado en sistema con ${j.totalRbds ?? 0} RBDs`}>
                                                        ✓ Sistema
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-2 px-3 text-slate-700 font-semibold">{SUCURSAL_NAME_MAP[j.zona] || j.zona}</td>
                                        <td className="py-2 px-3 text-right font-black text-rose-700">{j.acc}</td>
                                        <td className="py-2 px-3 text-right font-semibold text-amber-800">{j.dias}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 5: COTIZACIÓN Y METAS HENDAYA — DS N°67 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl">📜</span>
                            <h2 className="text-lg font-extrabold text-slate-900">
                                Cotización y Metas Hendaya — DS N°67
                            </h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Evaluación de siniestralidad total y tramo de cotización adicional sobre el seguro laboral.
                        </p>
                    </div>
                </div>

                {/* 4 TARJETAS EJECUTIVAS DS67 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* TARJETA 1: COTIZACIÓN ACTUAL */}
                    <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/50">
                        <span className="block text-[11px] font-bold text-sky-800 uppercase">Cotización Total Actual</span>
                        <span className="text-2xl font-black text-sky-950 mt-1 block">{data.ds67.cotizacionActual}</span>
                        <span className="text-[10px] text-sky-700 mt-1 block">{data.ds67.cotizacionCap}</span>
                    </div>

                    {/* TARJETA 2: TSIT */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                        <span className="block text-[11px] font-bold text-slate-700 uppercase">TSIT (Tasa Siniestralidad Total)</span>
                        <span className="text-2xl font-black text-slate-900 mt-1 block">{data.ds67.tsit}</span>
                        <span className="text-[10px] text-slate-500 mt-1 block">{data.ds67.tsitCap}</span>
                    </div>

                    {/* TARJETA 3: HOLGURA DISPONIBLE */}
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
                        <span className="block text-[11px] font-bold text-amber-800 uppercase">Holgura Disponible</span>
                        <span className="text-2xl font-black text-amber-950 mt-1 block">{data.ds67.holgura} días</span>
                        <span className="text-[10px] text-amber-700 mt-1 block">{data.ds67.holguraCap}</span>
                    </div>

                    {/* TARJETA 4: COSTO ESTIMADO */}
                    <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50">
                        <span className="block text-[11px] font-bold text-purple-800 uppercase">Costo Cotización</span>
                        <span className="text-2xl font-black text-purple-950 mt-1 block">{data.ds67.costo}</span>
                        <span className="text-[10px] text-purple-700 mt-1 block">{data.ds67.costoCap}</span>
                    </div>
                </div>

                {/* TABLA DE TRAMOS DS67 */}
                <div className="space-y-3">
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Tabla de Tramos de Siniestralidad (DS N°67)
                    </h3>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-72">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                                <tr>
                                    <th className="py-2.5 px-4">Rango TST (Días / Siniestralidad)</th>
                                    <th className="py-2.5 px-4 text-center">Tasa Adicional</th>
                                    <th className="py-2.5 px-4 text-center">Cotización Total</th>
                                    <th className="py-2.5 px-4 text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {data.ds67.tramos.map((t, idx) => (
                                    <tr
                                        key={idx}
                                        className={`transition-colors ${
                                            t.current
                                                ? 'bg-sky-50 font-bold text-sky-950 border-l-4 border-l-sky-600'
                                                : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                    >
                                        <td className="py-2.5 px-4 font-mono font-medium">{t.r}</td>
                                        <td className="py-2.5 px-4 text-center font-mono">{t.d}</td>
                                        <td className="py-2.5 px-4 text-center font-mono font-bold">{t.p}</td>
                                        <td className="py-2.5 px-4 text-center">
                                            {t.current ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-600 text-white shadow-xs">
                                                    ★ Tramo Actual
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-[11px]">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
                </>
            )}
        </div>
    )
}

