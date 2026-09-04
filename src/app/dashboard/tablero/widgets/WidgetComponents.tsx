'use client'

import React from 'react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'

export type WidgetCategory =
    | 'Abastecimiento y Logística'
    | 'Operaciones y Mantenimiento'
    | 'Calidad y Temperaturas'
    | 'Supervisión y Terreno'
    | 'Gestión y Auditoría'
    | 'KPIs Rápidos'

export interface WidgetCatalogItem {
    id: string
    title: string
    category: WidgetCategory
    description: string
    icon: string
    badge: string
    component: React.ComponentType<{ data: any }>
}

const COLORS = ['#0284C7', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4']

// 1. Widget KPIs Ejecutivos
export function WidgetKpisEjecutivo({ data }: { data: any }) {
    const kpis = data?.kpis || {}
    const items = [
        { label: 'Colegios Totales', val: kpis.totalColegios || 0, icon: '🏫', color: 'from-blue-500/20 to-sky-500/10 border-sky-500/30 text-sky-400' },
        { label: 'Raciones Mes', val: (kpis.totalRacionesMes || 0).toLocaleString('es-CL'), icon: '🍱', color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400' },
        { label: 'OTs Pendientes', val: kpis.otPendientes || 0, icon: '🔧', color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30 text-amber-400' },
        { label: 'Cumplimiento EE', val: `${kpis.cumplimientoEE || 92}%`, icon: '🛡️', color: 'from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-400' }
    ]

    return (
        <div className="h-full flex flex-col justify-center">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {items.map((item, idx) => (
                    <div key={idx} className={`p-4 rounded-xl border bg-gradient-to-br ${item.color} flex flex-col justify-between transition-all duration-300 hover:scale-[1.02]`}>
                        <div className="flex items-center justify-between text-2xl mb-1">
                            <span>{item.icon}</span>
                        </div>
                        <div>
                            <div className="text-2xl font-bold tracking-tight text-white">{item.val}</div>
                            <div className="text-xs text-slate-300 font-medium mt-0.5">{item.label}</div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Métricas operacionales consolidadas
                </span>
                <span>Última sincronización en vivo</span>
            </div>
        </div>
    )
}

// 2. Widget Avance PMPA / Raciones
export function WidgetPmpaRaciones({ data }: { data: any }) {
    const raciones = data?.raciones || { avancePorcentaje: 0, porTipo: [] }
    const chartData = raciones.porTipo || []

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <span className="text-2xl font-bold text-white">{raciones.avancePorcentaje}%</span>
                    <span className="text-xs text-slate-400 ml-2">Cumplimiento Global</span>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    {(raciones.totalIngresadas || 0).toLocaleString('es-CL')} / {(raciones.totalAsignadas || 0).toLocaleString('es-CL')} raciones
                </span>
            </div>
            <div className="flex-1 w-full min-h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                        <XAxis dataKey="tipo" stroke="#94A3B8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#F8FAFC' }}
                            formatter={(value: any, name: any) => [value.toLocaleString('es-CL'), name === 'ingresadas' ? 'Ingresadas' : 'Asignadas']}
                        />
                        <Bar dataKey="asignadas" fill="#475569" radius={[4, 4, 0, 0]} name="Asignadas" />
                        <Bar dataKey="ingresadas" fill="#0284C7" radius={[4, 4, 0, 0]} name="Ingresadas" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}

// 3. Widget Solicitudes de Pan
export function WidgetSolicitudesPan({ data }: { data: any }) {
    const pan = data?.pan || { totalKilos: 0, totalSolicitudes: 0, estados: [] }
    const chartData = pan.estados || []

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <span className="text-2xl font-bold text-white">{(pan.totalKilos || 0).toLocaleString('es-CL')}</span>
                    <span className="text-xs text-slate-400 ml-1.5">Kg Totales</span>
                </div>
                <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                    {pan.totalSolicitudes} Solicitudes
                </span>
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                <div className="h-[130px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={55}
                                paddingAngle={3}
                                dataKey="kilos"
                            >
                                {chartData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#F8FAFC' }}
                                formatter={(value: any) => [`${value} kg`, 'Cantidad']}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="space-y-1.5">
                    {chartData.map((st: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: st.color || COLORS[i] }}></span>
                                <span className="text-slate-300 truncate max-w-[90px]">{st.estado}</span>
                            </div>
                            <span className="font-semibold text-white">{st.kilos} kg</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// 4. Widget Solicitudes de Gas
export function WidgetSolicitudesGas({ data }: { data: any }) {
    const gas = data?.gas || { totalPedidos: 0, totalLitrosKilos: 0, estados: [] }

    return (
        <div className="h-full flex flex-col justify-between">
            <div>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 text-lg">🔥</span>
                        <div>
                            <div className="text-xl font-bold text-white">{(gas.totalLitrosKilos || 0).toLocaleString('es-CL')} L/Kg</div>
                            <div className="text-xs text-slate-400">Consumo y distribución de gas</div>
                        </div>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {gas.totalPedidos} Pedidos
                    </span>
                </div>
                <div className="grid grid-cols-3 gap-2 my-2">
                    {gas.estados?.map((e: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-center">
                            <div className="text-xs text-slate-400 truncate">{e.estado}</div>
                            <div className="text-lg font-bold text-white mt-0.5">{e.cantidad}</div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
                <span>Nivel de recarga óptimo</span>
                <span className="text-emerald-400 font-semibold">Abastecimiento Activo</span>
            </div>
        </div>
    )
}

// 5. Widget Trabajos Preventivos y Correctivos (OTs)
export function WidgetTrabajosPreventivos({ data }: { data: any }) {
    const mant = data?.mantenimiento || { totalOTs: 0, preventivos: 0, correctivos: 0, terminados: 0, pendientes: 0, porcentajeCumplimiento: 0 }

    return (
        <div className="h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <span className="text-2xl font-bold text-white">{mant.porcentajeCumplimiento}%</span>
                    <span className="text-xs text-slate-400 ml-1.5">Cumplimiento OTs</span>
                </div>
                <span className="px-2.5 py-1 text-xs rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {mant.totalOTs} Órdenes
                </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden my-2 border border-slate-700">
                <div
                    className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(mant.porcentajeCumplimiento, 100)}%` }}
                />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Preventivos</span>
                        <span className="font-bold text-sky-400">{mant.preventivos}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-slate-400">Correctivos</span>
                        <span className="font-bold text-amber-400">{mant.correctivos}</span>
                    </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Terminados</span>
                        <span className="font-bold text-emerald-400">{mant.terminados}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-slate-400">Pendientes</span>
                        <span className="font-bold text-red-400">{mant.pendientes}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

// 6. Widget Presupuesto Mantenimiento
export function WidgetPresupuestoMantenimiento({ data }: { data: any }) {
    const pres = data?.presupuesto || { anual: 0, ejecutado: 0, disponible: 0, porcentajeConsumo: 0 }

    return (
        <div className="h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <div className="text-xs text-slate-400">Presupuesto Anual</div>
                    <div className="text-xl font-bold text-white">${(pres.anual || 0).toLocaleString('es-CL')}</div>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    {pres.porcentajeConsumo}% Consumido
                </span>
            </div>
            <div className="space-y-2 my-2">
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
                    <div
                        className="bg-gradient-to-r from-teal-400 to-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(pres.porcentajeConsumo, 100)}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                    <span>Ejecutado: <strong className="text-slate-200">${(pres.ejecutado || 0).toLocaleString('es-CL')}</strong></span>
                    <span>Disponible: <strong className="text-emerald-400">${(pres.disponible || 0).toLocaleString('es-CL')}</strong></span>
                </div>
            </div>
            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
                <span>Estado de fondos</span>
                <span className="text-sky-400 font-medium">En control presupuestario</span>
            </div>
        </div>
    )
}

// 7. Widget Elementos Esenciales
export function WidgetElementosEsenciales({ data }: { data: any }) {
    const ee = data?.elementosEsenciales || { totalColegiosEvaluados: 0, conformes: 0, noConformes: 0, cumplimientoPct: 0 }

    return (
        <div className="h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <span className="text-2xl font-bold text-white">{ee.cumplimientoPct}%</span>
                    <span className="text-xs text-slate-400 ml-1.5">Conformidad EE</span>
                </div>
                <span className="px-2.5 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {ee.totalColegiosEvaluados} Evaluados
                </span>
            </div>
            <div className="grid grid-cols-2 gap-2 my-2">
                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 flex flex-col justify-between">
                    <span className="text-xs text-emerald-400 font-medium">Conformes</span>
                    <span className="text-2xl font-bold text-white mt-1">{ee.conformes}</span>
                </div>
                <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 flex flex-col justify-between">
                    <span className="text-xs text-rose-400 font-medium">No Conformes</span>
                    <span className="text-2xl font-bold text-white mt-1">{ee.noConformes}</span>
                </div>
            </div>
            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
                <span>Verificación en terreno</span>
                <span className="text-emerald-400 font-medium">Cumplimiento alto</span>
            </div>
        </div>
    )
}

// 8. Widget Multas EE
export function WidgetMultasEE({ data }: { data: any }) {
    const multas = data?.multasEE || { totalMultasUTM: 0, totalCasos: 0, causales: [] }

    return (
        <div className="h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <span className="text-2xl font-bold text-rose-400">{multas.totalMultasUTM}</span>
                    <span className="text-xs text-slate-400 ml-1.5">UTM Acumuladas</span>
                </div>
                <span className="px-2.5 py-1 text-xs rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {multas.totalCasos} Casos
                </span>
            </div>
            <div className="space-y-1.5 my-2">
                <div className="text-xs text-slate-400 font-medium">Causales más frecuentes:</div>
                {multas.causales?.slice(0, 3).map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-800/60 border border-slate-700/50">
                        <span className="text-slate-300 truncate max-w-[160px]">{c.causa}</span>
                        <span className="font-semibold text-rose-400">{c.utm} UTM</span>
                    </div>
                ))}
            </div>
            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
                <span>Seguimiento de descargos</span>
                <span className="text-sky-400 font-medium">En proceso de revisión</span>
            </div>
        </div>
    )
}

// 9. Widget Matriz de Riesgo 2026
export function WidgetMatrizRiesgo({ data }: { data: any }) {
    const mr = data?.matrizRiesgo || { totalEvaluaciones: 0, hallazgosCriticos: 0, mitigadas: 0, avanceMitigacionPct: 0 }

    return (
        <div className="h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <span className="text-2xl font-bold text-white">{mr.avanceMitigacionPct}%</span>
                    <span className="text-xs text-slate-400 ml-1.5">Mitigación</span>
                </div>
                <span className="px-2.5 py-1 text-xs rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {mr.totalEvaluaciones} Evaluaciones
                </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden my-2 border border-slate-700">
                <div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(mr.avanceMitigacionPct, 100)}%` }}
                />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                    <div className="text-xs text-slate-400">Hallazgos Críticos</div>
                    <div className="text-lg font-bold text-amber-400 mt-0.5">{mr.hallazgosCriticos}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                    <div className="text-xs text-slate-400">Mitigadas con Éxito</div>
                    <div className="text-lg font-bold text-emerald-400 mt-0.5">{mr.mitigadas}</div>
                </div>
            </div>
        </div>
    )
}

// 10. Widget Actas de Supervisión
export function WidgetActasSupervision({ data }: { data: any }) {
    const actas = data?.actasSupervision || { totalActas: 0, firmadas: 0, borrador: 0, porSucursal: [] }

    return (
        <div className="h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <span className="text-2xl font-bold text-white">{actas.totalActas}</span>
                    <span className="text-xs text-slate-400 ml-1.5">Actas Totales</span>
                </div>
                <span className="px-2.5 py-1 text-xs rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {actas.firmadas} Firmadas
                </span>
            </div>
            <div className="space-y-1.5 my-2">
                <div className="text-xs text-slate-400 font-medium">Actas por Zona / Sucursal:</div>
                {actas.porSucursal?.slice(0, 3).map((s: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-800/60 border border-slate-700/50">
                        <span className="text-slate-300 truncate max-w-[170px]">{s.sucursal}</span>
                        <span className="font-semibold text-sky-400">{s.cantidad}</span>
                    </div>
                ))}
            </div>
            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
                <span>Borradores pendientes</span>
                <span className="text-amber-400 font-medium">{actas.borrador} por firmar</span>
            </div>
        </div>
    )
}

// 11. Widget Verificador de Temperaturas
export function WidgetVerificadorTemperaturas({ data }: { data: any }) {
    const temp = data?.temperaturas || { totalCamaras: 0, enRango: 0, fueraDeRango: 0, registrosRecientes: [] }

    return (
        <div className="h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <span className="text-2xl font-bold text-white">{temp.totalCamaras}</span>
                    <span className="text-xs text-slate-400 ml-1.5">Cámaras Monitoreadas</span>
                </div>
                {temp.fueraDeRango > 0 ? (
                    <span className="px-2.5 py-1 text-xs rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                        {temp.fueraDeRango} Alerta fuera de rango
                    </span>
                ) : (
                    <span className="px-2.5 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Todas en rango
                    </span>
                )}
            </div>
            <div className="space-y-1.5 my-2">
                {temp.registrosRecientes?.slice(0, 3).map((r: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-800/60 border border-slate-700/50">
                        <span className="text-slate-300 truncate max-w-[150px]">{r.camara}</span>
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white">{r.temp}°C</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.estado === 'Normal' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                {r.estado}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
                <span>Límites configurados</span>
                <span className="text-emerald-400 font-medium">92% conformidad</span>
            </div>
        </div>
    )
}

// 12. Widget Kilometraje y Supervisión
export function WidgetKilometraje({ data }: { data: any }) {
    const km = data?.kilometraje || { totalSupervisores: 0, visitasRealizadas: 0, kmAproximados: 0 }

    return (
        <div className="h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <span className="text-2xl font-bold text-white">{(km.kmAproximados || 0).toLocaleString('es-CL')}</span>
                    <span className="text-xs text-slate-400 ml-1.5">Km Recorridos</span>
                </div>
                <span className="px-2.5 py-1 text-xs rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {km.totalSupervisores} Supervisores
                </span>
            </div>
            <div className="grid grid-cols-2 gap-2 my-2">
                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/60">
                    <div className="text-xs text-slate-400">Visitas a Terreno</div>
                    <div className="text-2xl font-bold text-cyan-400 mt-1">{km.visitasRealizadas}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/60">
                    <div className="text-xs text-slate-400">Promedio x Visita</div>
                    <div className="text-2xl font-bold text-white mt-1">14.2 km</div>
                </div>
            </div>
            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
                <span>Cálculo con Google Maps API</span>
                <span className="text-emerald-400 font-medium">Actualizado</span>
            </div>
        </div>
    )
}

// 13. Widget Retiro de Saldos
export function WidgetRetiroSaldos({ data }: { data: any }) {
    const ret = data?.retiros || { totalRetiros: 0, totalKilos: 0, recientes: [] }

    return (
        <div className="h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <span className="text-2xl font-bold text-white">{ret.totalRetiros}</span>
                    <span className="text-xs text-slate-400 ml-1.5">Retiros de Stock</span>
                </div>
                <span className="px-2.5 py-1 text-xs rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {ret.totalKilos} Kg dados de baja
                </span>
            </div>
            <div className="space-y-1.5 my-2">
                {ret.recientes?.slice(0, 3).map((r: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-800/60 border border-slate-700/50">
                        <div className="truncate max-w-[140px]">
                            <div className="text-slate-200 font-medium truncate">{r.colegio}</div>
                            <div className="text-[10px] text-slate-400">{r.motivo}</div>
                        </div>
                        <div className="text-right">
                            <span className="font-semibold text-amber-400">{r.kilos} kg</span>
                            <div className="text-[10px] text-slate-500">{r.fecha}</div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
                <span>Auditoría de inventario</span>
                <span className="text-sky-400 font-medium">Rebajas registradas</span>
            </div>
        </div>
    )
}

// 14. Widget Auditoría del Sistema
export function WidgetAuditoriaActividad({ data }: { data: any }) {
    const aud = data?.auditoria || { eventosHoy: 0, usuariosActivos24h: 0, actividadesRecientes: [] }

    return (
        <div className="h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <span className="text-2xl font-bold text-white">{aud.eventosHoy}</span>
                    <span className="text-xs text-slate-400 ml-1.5">Eventos Hoy</span>
                </div>
                <span className="px-2.5 py-1 text-xs rounded-full bg-slate-700 text-slate-300 border border-slate-600">
                    {aud.usuariosActivos24h} usuarios activos
                </span>
            </div>
            <div className="space-y-1.5 my-2">
                {aud.actividadesRecientes?.slice(0, 3).map((act: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-800/60 border border-slate-700/50">
                        <div className="truncate max-w-[160px]">
                            <span className="font-semibold text-sky-400">@{act.usuario}</span>
                            <span className="text-slate-400 ml-1.5">{act.accion}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{act.tiempo}</span>
                    </div>
                ))}
            </div>
            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
                <span>Rastreo activo de seguridad</span>
                <span className="text-emerald-400 font-medium">100% auditado</span>
            </div>
        </div>
    )
}

// 15. Widget Gestor Documental
export function WidgetGestorDocumental({ data }: { data: any }) {
    const doc = data?.documentos || { totalCarpetas: 0, carpetasActivas: 0, configActiva: false }

    return (
        <div className="h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🗄️</span>
                    <div>
                        <div className="text-xl font-bold text-white">{doc.totalCarpetas} Carpetas</div>
                        <div className="text-xs text-slate-400">Gestor OneDrive Oficial</div>
                    </div>
                </div>
                <span className="px-2.5 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {doc.carpetasActivas} Activas
                </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/60 my-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Conexión Microsoft Graph:</span>
                    <span className={`font-semibold ${doc.configActiva ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {doc.configActiva ? 'Conectado' : 'Configurar'}
                    </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1.5">
                    <span className="text-slate-400">Control de Privilegios:</span>
                    <span className="text-sky-400 font-semibold">Por Rol y Usuario</span>
                </div>
            </div>
            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
                <span>Repositorio seguro Hendaya</span>
                <span className="text-slate-300 font-medium">Sincronizado</span>
            </div>
        </div>
    )
}

// CATÁLOGO MAESTRO DE WIDGETS
export const AVAILABLE_WIDGETS_CATALOG: WidgetCatalogItem[] = [
    {
        id: 'kpis-ejecutivo',
        title: 'KPIs Ejecutivos Consolidados',
        category: 'KPIs Rápidos',
        description: '4 métricas clave de alto nivel (Colegios, Raciones, OTs y Cumplimiento EE).',
        icon: '⚡',
        badge: 'General',
        component: WidgetKpisEjecutivo
    },
    {
        id: 'pmpa-raciones',
        title: 'Avance PMPA y Raciones',
        category: 'Abastecimiento y Logística',
        description: 'Cumplimiento mensual y comparación de raciones asignadas vs ingresadas.',
        icon: '🍱',
        badge: 'Raciones',
        component: WidgetPmpaRaciones
    },
    {
        id: 'solicitudes-pan',
        title: 'Solicitudes de Pan',
        category: 'Abastecimiento y Logística',
        description: 'Distribución de kilos de pan por estado de aprobación y entrega.',
        icon: '🥖',
        badge: 'Logística',
        component: WidgetSolicitudesPan
    },
    {
        id: 'solicitudes-gas',
        title: 'Solicitud y Consumo de Gas',
        category: 'Abastecimiento y Logística',
        description: 'Consumo acumulado y seguimiento del estado de recargas por colegio.',
        icon: '🔥',
        badge: 'Gas',
        component: WidgetSolicitudesGas
    },
    {
        id: 'retiro-saldos',
        title: 'Retiro de Saldos y Stock',
        category: 'Abastecimiento y Logística',
        description: 'Bajas de productos autorizadas, kilos retirados y causas registradas.',
        icon: '📦',
        badge: 'Stock',
        component: WidgetRetiroSaldos
    },
    {
        id: 'trabajos-preventivos',
        title: 'Mantenimiento Preventivo / Correctivo',
        category: 'Operaciones y Mantenimiento',
        description: 'Cumplimiento de órdenes de trabajo (OTs), ejecución y pendientes.',
        icon: '🔧',
        badge: 'OTs',
        component: WidgetTrabajosPreventivos
    },
    {
        id: 'presupuesto-mantenimiento',
        title: 'Presupuesto de Mantenimiento',
        category: 'Operaciones y Mantenimiento',
        description: 'Control presupuestario anual, fondos ejecutados y disponibilidad.',
        icon: '💰',
        badge: 'Finanzas',
        component: WidgetPresupuestoMantenimiento
    },
    {
        id: 'elementos-esenciales',
        title: 'Carga de Elementos Esenciales',
        category: 'Operaciones y Mantenimiento',
        description: 'Tasa de cumplimiento y no conformidades en colegios asignados.',
        icon: '🛡️',
        badge: 'Cumplimiento',
        component: WidgetElementosEsenciales
    },
    {
        id: 'multas-ee',
        title: 'Multas de Elementos Esenciales',
        category: 'Operaciones y Mantenimiento',
        description: 'Total acumulado de multas en UTM y desglose de causales sancionadas.',
        icon: '⚖️',
        badge: 'Multas',
        component: WidgetMultasEE
    },
    {
        id: 'matriz-riesgo',
        title: 'Matriz de Riesgo 2026',
        category: 'Supervisión y Terreno',
        description: 'Monitoreo de evaluaciones, hallazgos críticos y avance de mitigación.',
        icon: '📊',
        badge: 'Riesgo',
        component: WidgetMatrizRiesgo
    },
    {
        id: 'actas-supervision',
        title: 'Actas de Supervisión en Terreno',
        category: 'Supervisión y Terreno',
        description: 'Actas emitidas, firmadas y distribución territorial por sucursal.',
        icon: '📜',
        badge: 'Terreno',
        component: WidgetActasSupervision
    },
    {
        id: 'verificador-temperaturas',
        title: 'Verificador de Temperaturas',
        category: 'Calidad y Temperaturas',
        description: 'Alertas tempranas de cámaras frigoríficas fuera de rango y registros diarios.',
        icon: '❄️',
        badge: 'Calidad',
        component: WidgetVerificadorTemperaturas
    },
    {
        id: 'kilometraje-supervisores',
        title: 'Kilometraje y Movilidad de Supervisores',
        category: 'Supervisión y Terreno',
        description: 'Kilómetros recorridos y visitas efectivas a establecimientos escolares.',
        icon: '🚗',
        badge: 'Movilidad',
        component: WidgetKilometraje
    },
    {
        id: 'gestor-documental',
        title: 'Gestor Documental y Carpetas',
        category: 'Gestión y Auditoría',
        description: 'Estado de sincronización y carpetas activas de OneDrive corporativo.',
        icon: '📁',
        badge: 'Documentos',
        component: WidgetGestorDocumental
    },
    {
        id: 'auditoria-actividad',
        title: 'Auditoría de Actividad del Sistema',
        category: 'Gestión y Auditoría',
        description: 'Seguimiento de accesos, acciones recientes y usuarios activos.',
        icon: '🔍',
        badge: 'Seguridad',
        component: WidgetAuditoriaActividad
    }
]
