
'use client'

import React from 'react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    Cell
} from 'recharts'

export default function PanDashboardChart({
    chartData,
    resumeStats,
    topSchools = [],
    userRanking = [],
    utList = []
}: {
    chartData: any[]
    resumeStats: { totalUnidades: number, totalSolicitudes: number, avgUnidades: number, growth: number }
    topSchools?: { name: string, total: number }[]
    userRanking?: { name: string, total: number }[]
    utList?: string[]
}) {
    const COLORS = ['#0EA5E9', '#8B5CF6', '#F59E0B', '#10B981', '#64748B', '#F43F5E', '#84CC16', '#06B6D4']

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Total Unidades</p>
                        <h3 className="text-3xl font-black text-gray-900">{resumeStats.totalUnidades.toLocaleString()}</h3>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">Histórico acumulado</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">
                        🍞
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
                        <p className="text-sm font-medium text-gray-500 mb-1">Promedio Unidades</p>
                        <h3 className="text-3xl font-black text-gray-900">{resumeStats.avgUnidades.toFixed(1)}</h3>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">Por solicitud</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">
                        📊
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

            {/* Main Trend Chart (Full Width) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <span>📈</span> Avance Mensual: Unidades de Pan
                </h3>
                
                <div className="w-full h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                            <XAxis 
                                dataKey="month" 
                                tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 'bold' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis 
                                tick={{ fill: '#94A3B8', fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                cursor={{ fill: '#F8FAFC' }}
                            />
                            <Legend verticalAlign="top" align="right" iconType="circle" />
                            {utList.length > 0 ? (
                                utList.map((ut, index) => (
                                    <Bar 
                                        key={ut} 
                                        dataKey={ut} 
                                        stackId="a" 
                                        fill={COLORS[index % COLORS.length]} 
                                        name={ut.replace('UT_', 'UT ')}
                                        radius={index === utList.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                                    />
                                ))
                            ) : (
                                <Bar dataKey="unidades" fill="#0EA5E9" radius={[6, 6, 0, 0]} barSize={40} />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                {/* Top Schools */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2 uppercase tracking-tight">
                        <span className="text-amber-500">🏆</span> Top 5 Establecimientos
                    </h3>
                    <div className="space-y-3">
                        {topSchools.map((s, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group hover:bg-white hover:border-sky-200 transition-all">
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">#{i+1}</span>
                                    <span className="font-bold text-gray-700 truncate max-w-[180px]">{s.name}</span>
                                </div>
                                <span className="font-black text-gray-900">{s.total.toLocaleString()} <span className="text-[10px] text-gray-400">Unid.</span></span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* User Ranking */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2 uppercase tracking-tight">
                        <span className="text-indigo-500">👤</span> Ranking por Usuario
                    </h3>
                    <div className="space-y-3">
                        {userRanking.map((u, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group hover:bg-white hover:border-indigo-200 transition-all">
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">#{i+1}</span>
                                    <span className="font-bold text-gray-700 truncate max-w-[180px]">{u.name}</span>
                                </div>
                                <span className="font-black text-gray-900">{u.total.toLocaleString()} <span className="text-[10px] text-gray-400">Unid.</span></span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
