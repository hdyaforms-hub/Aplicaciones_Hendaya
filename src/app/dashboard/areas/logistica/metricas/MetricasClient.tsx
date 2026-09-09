'use client'

import React, { useState } from 'react'
import {
    TrendingUp,
    Clock,
    Truck,
    Warehouse,
    CheckCircle2,
    Calendar,
    BarChart3
} from 'lucide-react'
import { getMetricasDespacho } from '@/actions/logistica/metricas'

interface Props {
    initialBodegas: any[]
    initialMetricas: any
    initialFecha: string
}

export default function MetricasClient({
    initialBodegas,
    initialMetricas,
    initialFecha
}: Props) {
    const [bodegaId, setBodegaId] = useState('ALL')
    const [fecha, setFecha] = useState(initialFecha)
    const [kpis, setKpis] = useState(initialMetricas?.kpis || {})
    const [rotacion, setRotacion] = useState(initialMetricas?.rotacionAndenes || [])
    const [distribucion, setDistribucion] = useState(initialMetricas?.distribucionHoraria || [])
    const [loading, setLoading] = useState(false)

    const actualizarMetricas = async (nuevaBodega: string, nuevaFecha: string) => {
        setLoading(true)
        try {
            const res = await getMetricasDespacho(
                nuevaBodega === 'ALL' ? undefined : nuevaBodega,
                nuevaFecha
            )
            if (res.kpis) {
                setKpis(res.kpis)
                setRotacion(res.rotacionAndenes || [])
                setDistribucion(res.distribucionHoraria || [])
            }
        } finally {
            setLoading(false)
        }
    }

    const maxDespachosHora = Math.max(...distribucion.map((d: any) => d.total || 0), 1)

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            {/* CABECERA ESTÁNDAR HENDAYA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-50 to-sky-50 rounded-bl-full -z-10 opacity-70" />
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-cyan-100 text-cyan-700 rounded-xl text-xl">📊</span>
                        Métricas de Despacho y Rotación
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm font-medium">
                        Indicadores clave de rendimiento (KPIs), tiempos de ciclo en muelle y cumplimiento operacional.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                        <Warehouse className="w-4 h-4 text-gray-500" />
                        <span className="text-xs font-bold text-gray-600">Bodega:</span>
                        <select
                            value={bodegaId}
                            onChange={e => {
                                setBodegaId(e.target.value)
                                actualizarMetricas(e.target.value, fecha)
                            }}
                            className="bg-transparent text-xs font-bold text-gray-900 focus:outline-none cursor-pointer"
                        >
                            <option value="ALL">Todas las Bodegas</option>
                            {initialBodegas.map(b => (
                                <option key={b.id} value={b.id}>
                                    {b.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                        <Calendar className="w-4 h-4 text-cyan-600" />
                        <input
                            type="date"
                            value={fecha}
                            onChange={e => {
                                setFecha(e.target.value)
                                actualizarMetricas(bodegaId, e.target.value)
                            }}
                            className="bg-transparent text-xs font-mono font-bold text-gray-900 focus:outline-none cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* TARJETAS KPI */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Despachos Completados</span>
                        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black font-mono text-gray-900">
                            {kpis.despachadas || 0}
                        </span>
                        <span className="text-xs font-medium text-gray-400">/ {kpis.totalHoy || 0} programadas</span>
                    </div>
                    <p className="text-[11px] text-gray-500 font-medium">
                        {kpis.enProceso || 0} en muelle | {kpis.enPorton || 0} en portón
                    </p>
                </div>

                {/* KPI 2 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Permanencia en Andén</span>
                        <div className="p-2 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-100">
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black font-mono text-cyan-700">
                            {kpis.promPermanenciaAnden || 0}
                        </span>
                        <span className="text-xs font-bold text-gray-500">minutos prom.</span>
                    </div>
                    <p className="text-[11px] text-gray-500 font-medium">Objetivo estándar: ≤ 45 min</p>
                </div>

                {/* KPI 3 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Espera en Portón</span>
                        <div className="p-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-100">
                            <Truck className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black font-mono text-gray-900">
                            {kpis.promEsperaPorton || 0}
                        </span>
                        <span className="text-xs font-bold text-gray-500">minutos prom.</span>
                    </div>
                    <p className="text-[11px] text-gray-500 font-medium">Desde ingreso físico hasta muelle</p>
                </div>

                {/* KPI 4 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Tasa de Cumplimiento</span>
                        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black font-mono text-emerald-700">
                            {kpis.tasaCumplimiento || 100}%
                        </span>
                    </div>
                    <p className="text-[11px] text-gray-500 font-medium">
                        {kpis.demorasAndenCount || 0} cargas con demora reportada
                    </p>
                </div>
            </div>

            {/* GRÁFICOS Y DISTRIBUCIONES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico 1: Rotación de Andenes */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2 uppercase tracking-wider">
                            <Warehouse className="w-4 h-4 text-cyan-600" />
                            Rotación de Camiones por Andén
                        </h3>
                    </div>

                    <div className="space-y-3.5 pt-2">
                        {rotacion.map((a: any) => {
                            const total = a.total || 0
                            const porcentaje = kpis.despachadas > 0 ? Math.round((total / kpis.despachadas) * 100) : 0

                            return (
                                <div key={a.codigo} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-gray-800">
                                            {a.nombre} <span className="font-mono text-gray-400">({a.codigo})</span>
                                        </span>
                                        <span className="font-mono font-bold text-cyan-700">
                                            {total} camiones ({porcentaje}%)
                                        </span>
                                    </div>
                                    <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
                                        <div
                                            className="h-full bg-cyan-600 rounded-full transition-all duration-500"
                                            style={{ width: `${Math.max(porcentaje, 4)}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                        {rotacion.length === 0 && (
                            <p className="text-xs text-gray-400 py-8 text-center font-medium">No hay datos de rotación para este periodo.</p>
                        )}
                    </div>
                </div>

                {/* Gráfico 2: Distribución Horaria de Salidas */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2 uppercase tracking-wider">
                            <BarChart3 className="w-4 h-4 text-cyan-600" />
                            Curva Horaria de Despachos (06:00 - 20:00)
                        </h3>
                    </div>

                    <div className="flex items-end gap-1.5 h-48 pt-6 pb-2">
                        {distribucion.map((d: any) => {
                            const alturaPct = maxDespachosHora > 0 ? Math.round((d.total / maxDespachosHora) * 100) : 0
                            return (
                                <div key={d.hora} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                                    <span className="text-[10px] font-mono font-bold text-gray-600 group-hover:text-cyan-700 transition">
                                        {d.total > 0 ? d.total : ''}
                                    </span>
                                    <div
                                        className={`w-full rounded-t-lg transition-all duration-500 ${
                                            d.total > 0
                                                ? 'bg-cyan-600 group-hover:bg-cyan-500 shadow-xs'
                                                : 'bg-gray-100'
                                        }`}
                                        style={{ height: `${Math.max(alturaPct, 5)}%` }}
                                    />
                                    <span className="text-[10px] font-mono text-gray-400 font-semibold transform -rotate-45 origin-top-left mt-2">
                                        {d.hora.slice(0, 2)}h
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
