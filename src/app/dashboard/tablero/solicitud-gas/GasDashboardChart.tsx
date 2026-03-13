
'use client'

import React from 'react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    Cell, PieChart, Pie, ComposedChart, Line
} from 'recharts'

export default function GasDashboardChart({
    chartData,
    resumeStats,
    distributorData,
    typeData,
    topSchools = []
}: {
    chartData: any[]
    resumeStats: { totalLiters: number, totalSolicitudes: number, avgLiters: number, growth: number }
    distributorData: { name: string, value: number }[]
    typeData: { name: string, value: number }[]
    topSchools?: { name: string, total: number }[]
}) {
    const COLORS = ['#0EA5E9', '#8B5CF6', '#F59E0B', '#10B981', '#64748B']

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Total Litros</p>
                        <h3 className="text-3xl font-black text-gray-900">{resumeStats.totalLiters.toLocaleString()}</h3>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">Consumo calculado</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">
                        🔥
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Total Solicitudes</p>
                        <h3 className="text-3xl font-black text-gray-900">{resumeStats.totalSolicitudes.toLocaleString()}</h3>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">Pedidos realizados</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">
                        📋
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Crecimiento Mensual</p>
                        <h3 className={`text-3xl font-black ${resumeStats.growth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {resumeStats.growth > 0 ? '+' : ''}{resumeStats.growth.toFixed(1)}%
                        </h3>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">Vs mes anterior</p>
                    </div>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform ${resumeStats.growth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {resumeStats.growth >= 0 ? '📈' : '📉'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Liters Trend */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <span>📈</span> Avance Mensual: Consumo de Gas (Litros)
                    </h3>
                    <div className="w-full h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 11}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 11}} />
                                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="litros" fill="#0EA5E9" radius={[6, 6, 0, 0]} barSize={40} />
                                <Line type="monotone" dataKey="solicitudes" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pie Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-600 uppercase tracking-widest text-center">Distribuidores</h3>
                        <div className="w-full h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={distributorData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {distributorData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                            {distributorData.map((d, i) => (
                                <div key={d.name} className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></span>
                                    <span className="text-[10px] font-medium text-gray-500">{d.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-600 uppercase tracking-widest text-center">Tipo de Gas</h3>
                        <div className="w-full h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={typeData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {typeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                            {typeData.map((d, i) => (
                                <div key={d.name} className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[(i + 2) % COLORS.length]}}></span>
                                    <span className="text-[10px] font-medium text-gray-500">{d.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Schools List */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2 uppercase tracking-tight">
                    <span className="text-amber-500">🏆</span> Top 5 Establecimientos (Mayor Consumo)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {topSchools.map((s, i) => (
                        <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative overflow-hidden group hover:bg-white hover:border-sky-200 transition-all">
                            <span className="absolute -right-2 -bottom-2 text-4xl font-black text-gray-100 group-hover:text-sky-50 transition-colors">#{i+1}</span>
                            <p className="text-[10px] font-black text-sky-600 uppercase mb-1">Ránking #{i+1}</p>
                            <p className="font-bold text-gray-800 truncate mb-1">{s.name}</p>
                            <p className="text-xl font-black text-gray-900">{s.total.toLocaleString()} <span className="text-xs font-bold text-gray-400">Lts</span></p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
