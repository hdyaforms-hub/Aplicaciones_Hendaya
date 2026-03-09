'use client'

import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, ComposedChart
} from 'recharts';

export default function IndicadoresChart({
    chartData,
    resumeStats
}: {
    chartData: any[];
    resumeStats: { sumIng: number, sumAsig: number, avgTasa: number, days: number }
}) {
    return (
        <div className="space-y-6">
            {/* Resumen Numerico */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Raciones Asignadas</p>
                        <h3 className="text-3xl font-bold text-gray-900">{resumeStats.sumAsig.toLocaleString()}</h3>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center text-3xl shadow-inner">
                        📦
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Raciones Ingresadas</p>
                        <h3 className="text-3xl font-bold text-gray-900">{resumeStats.sumIng.toLocaleString()}</h3>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl shadow-inner">
                        ✅
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Tasa de Preparación Prom.</p>
                        <h3 className="text-3xl font-bold text-gray-900">{(resumeStats.avgTasa * 100).toFixed(2)}%</h3>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center text-3xl shadow-inner">
                        📈
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Días Reportados</p>
                        <h3 className="text-3xl font-bold text-gray-900">{resumeStats.days}</h3>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-3xl shadow-inner">
                        📅
                    </div>
                </div>
            </div>

            {/* Gráfico */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span>📊</span> Avance Diario: Ingresos vs Asignación PMPA
                </h3>

                {chartData.length > 0 ? (
                    <div className="w-full h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={chartData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="dateStr"
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                    axisLine={{ stroke: '#D1D5DB' }}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    yAxisId="left"
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                    dx={-10}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    domain={[0, 100]}
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                    dx={10}
                                    tickFormatter={(val) => `${val}%`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#F3F4F6' }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />

                                <Bar
                                    yAxisId="left"
                                    dataKey="asig"
                                    name="Total Asignado (PMPA)"
                                    fill="#E0F2FE"
                                    radius={[4, 4, 0, 0]}
                                />
                                <Bar
                                    yAxisId="left"
                                    dataKey="ing"
                                    name="Total Ingresado real"
                                    fill="#0EA5E9"
                                    radius={[4, 4, 0, 0]}
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="tasa"
                                    name="Tasa de Preparación Prom. (%)"
                                    stroke="#8B5CF6"
                                    strokeWidth={3}
                                    activeDot={{ r: 8 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <span className="text-5xl opacity-30 mb-4">📉</span>
                        <p className="text-gray-500 font-medium text-center max-w-sm">No existen registros de Ingreso de Raciones para los filtros o fechas seleccionadas.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
