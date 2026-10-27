'use client'

import React, { useState, useMemo } from 'react'
import {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ReferenceLine
} from 'recharts'
import { ComparativaOscilacionData, TendenciasFilterParams } from './actions'

const SERVICIOS_COLORES: Record<string, string> = {
    'DESAYUNO': '#D97706',        // Ámbar 600
    'ALMUERZO': '#059669',        // Esmeralda 600
    'TERCER SERVICIO': '#0EA5E9', // Cyan Hendaya
    'ONCE': '#0284C7',            // Sky 600
    'COLACIÓN': '#7C3AED',        // Violeta 600
    'COLACION': '#7C3AED',        // Violeta 600
    'CENA': '#4F46E5',            // Índigo 600
    'OTROS': '#64748B'            // Slate 500
}

const ANOS_COLORES: Record<number, string> = {
    2024: '#0284C7', // Sky 600
    2025: '#059669', // Emerald 600
    2026: '#D97706', // Ámbar 600
    2027: '#7C3AED', // Violeta 600
    2028: '#E11D48'  // Rose 600
}

const PROGRAMAS_COLORES = [
    '#0284C7', '#059669', '#D97706', '#7C3AED', '#DB2777', '#4F46E5', '#0D9488', '#EA580C', '#64748B'
]

const RBDS_COLORES = [
    '#0284C7', '#059669', '#D97706', '#7C3AED', '#DB2777', '#4F46E5'
]

type Props = {
    comparativa: ComparativaOscilacionData
    filtros: TendenciasFilterParams
    onFilterChange: (key: keyof TendenciasFilterParams, value: any) => void
    isPending?: boolean
}

type DimensionType = 'SERVICIOS' | 'ANOS' | 'PROGRAMAS' | 'RBDS'
type TipoGraficoType = 'LINEAS' | 'BARRAS' | 'AREAS'

export default function GraficoComparativoOscilacion({
    comparativa,
    filtros,
    onFilterChange,
    isPending
}: Props) {
    const [dimension, setDimension] = useState<DimensionType>('SERVICIOS')
    const [tipoGrafico, setTipoGrafico] = useState<TipoGraficoType>('LINEAS')
    const [mostrarPromedio, setMostrarPromedio] = useState<boolean>(true)
    const [mostrarMatriz, setMostrarMatriz] = useState<boolean>(false)
    const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())

    // Toggle de visibilidad para series individuales
    const toggleSeries = (key: string) => {
        setHiddenSeries(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const resetHiddenSeries = () => setHiddenSeries(new Set())

    // Configuración dinámica según dimensión
    const { chartData, xAxisKey, seriesList, averageVal, totalRacionesDim }: {
        chartData: Record<string, any>[]
        xAxisKey: string
        seriesList: { key: string; name: string; color: string; dashed?: boolean }[]
        averageVal: number
        totalRacionesDim: number
    } = useMemo(() => {
        if (dimension === 'ANOS') {
            const chartData: Record<string, any>[] = comparativa.interanual || []
            const seriesList = comparativa.anosDisponibles.map((yr, idx) => ({
                key: `ano_${yr}`,
                name: `Año ${yr}`,
                color: ANOS_COLORES[yr] || PROGRAMAS_COLORES[idx % PROGRAMAS_COLORES.length],
                dashed: false
            }))

            let total = 0
            let countNonZero = 0
            chartData.forEach(row => {
                comparativa.anosDisponibles.forEach(yr => {
                    const v = Number(row[`ano_${yr}`]) || 0
                    total += v
                    if (v > 0) countNonZero++
                })
            })
            const avg = countNonZero > 0 ? Math.round(total / countNonZero) : 0

            return {
                chartData,
                xAxisKey: 'mesAbr',
                seriesList,
                averageVal: avg,
                totalRacionesDim: total
            }
        }

        if (dimension === 'PROGRAMAS') {
            const chartData: Record<string, any>[] = comparativa.porPrograma || []
            const seriesList = comparativa.topProgramas.map((prog, idx) => ({
                key: prog,
                name: prog,
                color: PROGRAMAS_COLORES[idx % PROGRAMAS_COLORES.length],
                dashed: false
            }))

            let total = 0
            chartData.forEach(row => { total += (Number(row.total) || 0) })
            const avg = chartData.length > 0 ? Math.round(total / chartData.length) : 0

            return {
                chartData,
                xAxisKey: 'label',
                seriesList,
                averageVal: avg,
                totalRacionesDim: total
            }
        }

        if (dimension === 'RBDS') {
            const chartData: Record<string, any>[] = comparativa.porRbd || []
            const seriesList = comparativa.rbdsComparados.map((rbdItem, idx) => ({
                key: rbdItem.key,
                name: rbdItem.label,
                color: rbdItem.key === 'promedio_colegios' ? '#64748B' : RBDS_COLORES[idx % RBDS_COLORES.length],
                dashed: rbdItem.key === 'promedio_colegios'
            }))

            let total = 0
            chartData.forEach(row => { total += (Number(row.total) || 0) })
            const avg = chartData.length > 0 ? Math.round(total / chartData.length) : 0

            return {
                chartData,
                xAxisKey: 'label',
                seriesList,
                averageVal: avg,
                totalRacionesDim: total
            }
        }

        // Por defecto: SERVICIOS
        const chartData: Record<string, any>[] = comparativa.porServicio || []
        const serviciosKeys = [
            { key: 'desayuno', name: 'Desayuno', sKey: 'DESAYUNO' },
            { key: 'almuerzo', name: 'Almuerzo', sKey: 'ALMUERZO' },
            { key: 'tercerServicio', name: 'Tercer Serv.', sKey: 'TERCER SERVICIO' },
            { key: 'once', name: 'Once', sKey: 'ONCE' },
            { key: 'colacion', name: 'Colación', sKey: 'COLACIÓN' },
            { key: 'cena', name: 'Cena', sKey: 'CENA' }
        ]

        const seriesList = serviciosKeys.map(s => ({
            key: s.key,
            name: s.name,
            color: SERVICIOS_COLORES[s.sKey] || '#64748B',
            dashed: false
        }))

        let total = 0
        chartData.forEach(row => { total += (Number(row.total) || 0) })
        const avg = chartData.length > 0 ? Math.round(total / chartData.length) : 0

        return {
            chartData,
            xAxisKey: 'label',
            seriesList,
            averageVal: avg,
            totalRacionesDim: total
        }
    }, [dimension, comparativa])

    // Métricas dinámicas calculadas sobre la dimensión activa
    const metricas = useMemo(() => {
        if (!chartData || chartData.length === 0) {
            return {
                pico: null,
                valle: null,
                amplitud: 0,
                amplitudPct: 0,
                promedio: 0
            }
        }

        // Obtener totales o sumas visibles por punto
        const visibleSeries = seriesList.filter(s => !hiddenSeries.has(s.key))
        const totalsPerPoint = chartData.map(row => {
            let pointTotal = 0
            visibleSeries.forEach(s => {
                pointTotal += Number(row[s.key]) || 0
            })
            return {
                label: String(row[xAxisKey] || row.label || row.mesNombre || ''),
                total: pointTotal
            }
        })

        const nonZero = totalsPerPoint.filter(p => p.total > 0)
        if (nonZero.length === 0) {
            return {
                pico: null,
                valle: null,
                amplitud: 0,
                amplitudPct: 0,
                promedio: 0
            }
        }

        const sortedDesc = [...nonZero].sort((a, b) => b.total - a.total)
        const sortedAsc = [...nonZero].sort((a, b) => a.total - b.total)

        const pico = sortedDesc[0]
        const valle = sortedAsc[0]
        const amplitud = pico.total - valle.total
        const amplitudPct = pico.total > 0 ? Math.round((amplitud / pico.total) * 1000) / 10 : 0
        const totalSum = totalsPerPoint.reduce((acc, p) => acc + p.total, 0)
        const promedio = Math.round(totalSum / totalsPerPoint.length)

        return {
            pico,
            valle,
            amplitud,
            amplitudPct,
            promedio
        }
    }, [chartData, seriesList, hiddenSeries, xAxisKey])

    // Tooltip enriquecido
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null

        const totalPeriodo = payload.reduce((sum: number, p: any) => sum + (Number(p.value) || 0), 0)

        return (
            <div className="bg-slate-900/95 text-white border border-slate-700 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md text-xs min-w-[220px] max-w-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="font-bold text-slate-200 border-b border-slate-700/80 pb-2 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                        <span>🗓️</span> {label}
                    </span>
                    <span className="text-sky-400 font-extrabold font-mono">
                        {totalPeriodo.toLocaleString('es-CL')} rac
                    </span>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {payload.map((entry: any, index: number) => {
                        const val = Number(entry.value) || 0
                        const pct = totalPeriodo > 0 ? Math.round((val / totalPeriodo) * 1000) / 10 : 0
                        return (
                            <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-[11px]">
                                <div className="flex items-center gap-2 truncate">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-slate-300 truncate font-medium">{entry.name}:</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-bold text-white font-mono">{val.toLocaleString('es-CL')}</span>
                                    {totalPeriodo > 0 && (
                                        <span className="text-[10px] text-slate-400 font-mono">({pct}%)</span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-5">
            {/* ENCABEZADO Y CONTROLES DEL GRÁFICO */}
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center text-base font-bold shadow-sm">
                            📊
                        </span>
                        <h2 className="text-base md:text-lg font-extrabold text-slate-900 tracking-tight">
                            Gráfico Comparativo de Oscilación PMPA
                        </h2>
                        <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[11px] font-bold">
                            Multi-Dimensional
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Análisis comparativo de curvas de oscilación entre Años, Meses, Establecimientos (RBD), Programas y Servicios alimentarios.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto justify-start xl:justify-end">
                    {/* SELECTOR DE DIMENSIÓN */}
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
                        <button
                            type="button"
                            onClick={() => { setDimension('SERVICIOS'); resetHiddenSeries() }}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                dimension === 'SERVICIOS'
                                    ? 'bg-white text-sky-700 font-bold shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            🍽️ Servicios
                        </button>
                        <button
                            type="button"
                            onClick={() => { setDimension('ANOS'); resetHiddenSeries() }}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                dimension === 'ANOS'
                                    ? 'bg-white text-sky-700 font-bold shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            📅 Años (Interanual)
                        </button>
                        <button
                            type="button"
                            onClick={() => { setDimension('PROGRAMAS'); resetHiddenSeries() }}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                dimension === 'PROGRAMAS'
                                    ? 'bg-white text-sky-700 font-bold shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            🍱 Programas
                        </button>
                        <button
                            type="button"
                            onClick={() => { setDimension('RBDS'); resetHiddenSeries() }}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                dimension === 'RBDS'
                                    ? 'bg-white text-sky-700 font-bold shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            🏫 Colegios (RBD)
                        </button>
                    </div>

                    {/* SELECTOR DE TIPO DE GRÁFICO */}
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
                        <button
                            type="button"
                            onClick={() => setTipoGrafico('LINEAS')}
                            title="Líneas de Oscilación y Tendencia Suave"
                            className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                                tipoGrafico === 'LINEAS'
                                    ? 'bg-white text-slate-900 font-bold shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>📈</span> Líneas
                        </button>
                        <button
                            type="button"
                            onClick={() => setTipoGrafico('BARRAS')}
                            title="Barras Comparativas Agrupadas"
                            className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                                tipoGrafico === 'BARRAS'
                                    ? 'bg-white text-slate-900 font-bold shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>📊</span> Barras
                        </button>
                        <button
                            type="button"
                            onClick={() => setTipoGrafico('AREAS')}
                            title="Áreas Apiladas / Amplitud"
                            className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                                tipoGrafico === 'AREAS'
                                    ? 'bg-white text-slate-900 font-bold shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>📉</span> Áreas
                        </button>
                    </div>

                    {/* BOTÓN MATRIZ DE DATOS */}
                    <button
                        type="button"
                        onClick={() => setMostrarMatriz(!mostrarMatriz)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                            mostrarMatriz
                                ? 'bg-sky-50 text-sky-800 border-sky-300 font-bold'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                        title="Ver matriz numérica de oscilación"
                    >
                        <span>📋</span>
                        <span>{mostrarMatriz ? 'Ocultar Matriz' : 'Ver Matriz'}</span>
                    </button>
                </div>
            </div>

            {/* TARJETAS KPI DE OSCILACIÓN */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. AMPLITUD DE OSCILACIÓN */}
                <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Amplitud Oscilación
                    </span>
                    <div className="mt-1">
                        <div className="text-xl font-black text-slate-900">
                            {metricas.amplitud.toLocaleString('es-CL')} <span className="text-xs font-semibold text-slate-500">rac</span>
                        </div>
                        <div className="text-[11px] font-bold text-sky-700 mt-0.5">
                            Variación: {metricas.amplitudPct}% entre extremos
                        </div>
                    </div>
                </div>

                {/* 2. PICO MÁXIMO */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                        <span>⭐</span> Mes Pico Máximo
                    </span>
                    <div className="mt-1">
                        <div className="text-lg font-black text-amber-950 truncate" title={metricas.pico?.label || ''}>
                            {metricas.pico?.label || 'S/D'}
                        </div>
                        <div className="text-[11px] font-bold text-amber-800 mt-0.5">
                            {metricas.pico ? `${metricas.pico.total.toLocaleString('es-CL')} raciones` : '-'}
                        </div>
                    </div>
                </div>

                {/* 3. VALLE MÍNIMO */}
                <div className="bg-rose-50/60 border border-rose-200/80 rounded-xl p-3.5 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
                        <span>🔻</span> Mes Valle Mínimo
                    </span>
                    <div className="mt-1">
                        <div className="text-lg font-black text-rose-950 truncate" title={metricas.valle?.label || ''}>
                            {metricas.valle?.label || 'S/D'}
                        </div>
                        <div className="text-[11px] font-bold text-rose-700 mt-0.5">
                            {metricas.valle ? `${metricas.valle.total.toLocaleString('es-CL')} raciones` : '-'}
                        </div>
                    </div>
                </div>

                {/* 4. PROMEDIO Y ESTABILIDAD */}
                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3.5 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                        <span>🎯</span> Promedio del Período
                    </span>
                    <div className="mt-1">
                        <div className="text-xl font-black text-emerald-950">
                            {metricas.promedio.toLocaleString('es-CL')} <span className="text-xs font-semibold text-emerald-800">rac/mes</span>
                        </div>
                        <div className="text-[11px] font-bold text-emerald-700 mt-0.5">
                            {metricas.amplitudPct < 15 ? '🟢 Oscilación Baja (Estable)' : metricas.amplitudPct <= 35 ? '🟡 Oscilación Moderada' : '🔴 Alta Oscilación'}
                        </div>
                    </div>
                </div>
            </div>

            {/* BARRA DE SERIES INTERACTIVAS (LEYENDA CON FILTRO) */}
            <div className="flex items-center justify-between gap-3 flex-wrap pt-1 text-xs font-medium">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-500 mr-1">
                        Series comparadas (click para alternar):
                    </span>
                    {seriesList.map(s => {
                        const isHidden = hiddenSeries.has(s.key)
                        return (
                            <button
                                key={s.key}
                                type="button"
                                onClick={() => toggleSeries(s.key)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all ${
                                    isHidden
                                        ? 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-60'
                                        : 'bg-white text-slate-800 border-slate-200 shadow-sm hover:border-slate-300'
                                }`}
                                title={isHidden ? `Mostrar ${s.name}` : `Ocultar ${s.name}`}
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: s.color }}
                                />
                                <span className="font-semibold">{s.name}</span>
                            </button>
                        )
                    })}
                </div>

                {/* SWITCH PROMEDIO */}
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={mostrarPromedio}
                        onChange={(e) => setMostrarPromedio(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Línea Promedio</span>
                </label>
            </div>

            {/* ÁREA DE VISUALIZACIÓN RECHARTS */}
            <div className="w-full h-80 sm:h-96 pt-2">
                {chartData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
                        <span>📊 No hay datos disponibles para la dimensión y filtros seleccionados</span>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        {tipoGrafico === 'LINEAS' ? (
                            <LineChart data={chartData as any} margin={{ top: 15, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                <XAxis
                                    dataKey={xAxisKey}
                                    tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                                    axisLine={{ stroke: '#E2E8F0' }}
                                    tickLine={{ stroke: '#E2E8F0' }}
                                />
                                <YAxis
                                    tickFormatter={(v) => Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : `${v}`}
                                    tick={{ fill: '#64748B', fontSize: 11 }}
                                    axisLine={{ stroke: '#E2E8F0' }}
                                    tickLine={{ stroke: '#E2E8F0' }}
                                    width={45}
                                />
                                <RechartsTooltip content={<CustomTooltip />} />
                                {mostrarPromedio && averageVal > 0 && (
                                    <ReferenceLine
                                        y={averageVal}
                                        stroke="#64748B"
                                        strokeDasharray="4 4"
                                        label={{
                                            value: `Media: ${averageVal.toLocaleString('es-CL')}`,
                                            fill: '#475569',
                                            fontSize: 10,
                                            fontWeight: 'bold',
                                            position: 'insideTopRight'
                                        }}
                                    />
                                )}
                                {seriesList.map(s => {
                                    if (hiddenSeries.has(s.key)) return null
                                    return (
                                        <Line
                                            key={s.key}
                                            type="monotone"
                                            dataKey={s.key}
                                            name={s.name}
                                            stroke={s.color}
                                            strokeWidth={2.5}
                                            strokeDasharray={s.dashed ? '5 5' : undefined}
                                            dot={{ r: 3.5, fill: s.color, strokeWidth: 1.5, stroke: '#FFFFFF' }}
                                            activeDot={{ r: 6, fill: s.color, strokeWidth: 2, stroke: '#FFFFFF' }}
                                        />
                                    )
                                })}
                            </LineChart>
                        ) : tipoGrafico === 'BARRAS' ? (
                            <BarChart data={chartData as any} margin={{ top: 15, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                <XAxis
                                    dataKey={xAxisKey}
                                    tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                                    axisLine={{ stroke: '#E2E8F0' }}
                                    tickLine={{ stroke: '#E2E8F0' }}
                                />
                                <YAxis
                                    tickFormatter={(v) => Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : `${v}`}
                                    tick={{ fill: '#64748B', fontSize: 11 }}
                                    axisLine={{ stroke: '#E2E8F0' }}
                                    tickLine={{ stroke: '#E2E8F0' }}
                                    width={45}
                                />
                                <RechartsTooltip content={<CustomTooltip />} />
                                {mostrarPromedio && averageVal > 0 && (
                                    <ReferenceLine
                                        y={averageVal}
                                        stroke="#64748B"
                                        strokeDasharray="4 4"
                                        label={{
                                            value: `Media: ${averageVal.toLocaleString('es-CL')}`,
                                            fill: '#475569',
                                            fontSize: 10,
                                            fontWeight: 'bold',
                                            position: 'insideTopRight'
                                        }}
                                    />
                                )}
                                {seriesList.map(s => {
                                    if (hiddenSeries.has(s.key)) return null
                                    return (
                                        <Bar
                                            key={s.key}
                                            dataKey={s.key}
                                            name={s.name}
                                            fill={s.color}
                                            radius={[4, 4, 0, 0]}
                                        />
                                    )
                                })}
                            </BarChart>
                        ) : (
                            <AreaChart data={chartData as any} margin={{ top: 15, right: 20, left: 10, bottom: 5 }}>
                                <defs>
                                    {seriesList.map(s => (
                                        <linearGradient key={`grad-${s.key}`} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={s.color} stopOpacity={0.6} />
                                            <stop offset="95%" stopColor={s.color} stopOpacity={0.05} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                <XAxis
                                    dataKey={xAxisKey}
                                    tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                                    axisLine={{ stroke: '#E2E8F0' }}
                                    tickLine={{ stroke: '#E2E8F0' }}
                                />
                                <YAxis
                                    tickFormatter={(v) => Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : `${v}`}
                                    tick={{ fill: '#64748B', fontSize: 11 }}
                                    axisLine={{ stroke: '#E2E8F0' }}
                                    tickLine={{ stroke: '#E2E8F0' }}
                                    width={45}
                                />
                                <RechartsTooltip content={<CustomTooltip />} />
                                {seriesList.map(s => {
                                    if (hiddenSeries.has(s.key)) return null
                                    return (
                                        <Area
                                            key={s.key}
                                            type="monotone"
                                            dataKey={s.key}
                                            name={s.name}
                                            stroke={s.color}
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill={`url(#grad-${s.key})`}
                                        />
                                    )
                                })}
                            </AreaChart>
                        )}
                    </ResponsiveContainer>
                )}
            </div>

            {/* MATRIZ NUMÉRICA DE OSCILACIÓN (DESPLEGABLE) */}
            {mostrarMatriz && chartData.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span>📋</span> Matriz Numérica de Oscilación ({dimension})
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                            Raciones exactas registradas por período
                        </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="py-2.5 px-3">Período / Mes</th>
                                    {seriesList.map(s => (
                                        <th key={s.key} className="py-2.5 px-3 text-right">
                                            <span className="inline-flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                                <span>{s.name}</span>
                                            </span>
                                        </th>
                                    ))}
                                    <th className="py-2.5 px-3 text-right font-black text-slate-900">Total Período</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {chartData.map((row: Record<string, any>, idx) => {
                                    const label = String(row[xAxisKey] || row.label || row.mesNombre || '')
                                    const totalRow = seriesList.reduce((acc, s) => acc + (Number(row[s.key]) || 0), 0)
                                    const isPeak = metricas.pico && metricas.pico.label === label

                                    return (
                                        <tr key={idx} className={`hover:bg-slate-50 transition-colors ${isPeak ? 'bg-amber-50/50 font-semibold' : ''}`}>
                                            <td className="py-2 px-3 font-bold text-slate-800 flex items-center gap-1.5">
                                                {isPeak && <span>⭐</span>}
                                                <span>{label}</span>
                                            </td>
                                            {seriesList.map(s => {
                                                const val = Number(row[s.key]) || 0
                                                return (
                                                    <td key={s.key} className="py-2 px-3 text-right font-mono text-slate-700">
                                                        {val > 0 ? val.toLocaleString('es-CL') : '-'}
                                                    </td>
                                                )
                                            })}
                                            <td className="py-2 px-3 text-right font-black text-sky-800 font-mono">
                                                {totalRow.toLocaleString('es-CL')}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
