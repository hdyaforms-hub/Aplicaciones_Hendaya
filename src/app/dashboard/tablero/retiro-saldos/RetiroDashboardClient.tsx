
'use client'

import React, { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    Cell, PieChart, Pie, ComposedChart, Line
} from 'recharts'

export default function RetiroDashboardClient({
    initialData,
    initialFilters
}: {
    initialData: any
    initialFilters: any
}) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [filters, setFilters] = useState(initialFilters)
    const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4']

    const updateFilters = (newFilters: any) => {
        const params = new URLSearchParams(searchParams.toString())
        Object.entries(newFilters).forEach(([key, value]) => {
            if (value) params.set(key, value.toString())
            else params.delete(key)
        })
        router.push(`${pathname}?${params.toString()}`)
    }

    return (
        <div className="space-y-8 pb-12">
            {/* Filters Section */}
            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <div>
                        <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Año</label>
                        <select 
                            value={filters.year} 
                            onChange={(e) => {
                                const y = parseInt(e.target.value)
                                setFilters({...filters, year: y})
                                updateFilters({year: y})
                            }}
                            className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-gray-50 font-bold text-black appearance-none cursor-pointer"
                        >
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Mes</label>
                        <select 
                            value={filters.month || ''} 
                            onChange={(e) => {
                                const m = e.target.value ? parseInt(e.target.value) : undefined
                                setFilters({...filters, month: m})
                                updateFilters({month: m})
                            }}
                            className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-gray-50 font-bold text-black appearance-none cursor-pointer"
                        >
                            <option value="">-- Todos --</option>
                            {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                                <option key={m} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Sucursal</label>
                        <select 
                            value={filters.sucursal || ''} 
                            onChange={(e) => {
                                setFilters({...filters, sucursal: e.target.value})
                                updateFilters({sucursal: e.target.value})
                            }}
                            className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-gray-50 font-bold text-black appearance-none cursor-pointer"
                        >
                            <option value="">-- Todas --</option>
                            {initialData.userSucursales.map((s: string) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">RBD</label>
                        <input 
                            type="number" 
                            value={filters.rbd || ''} 
                            onChange={(e) => setFilters({...filters, rbd: e.target.value})}
                            onBlur={() => updateFilters({rbd: filters.rbd ? parseInt(filters.rbd.toString()) : undefined})}
                            placeholder="Ej: 1234"
                            className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-gray-50 transition-all font-bold text-black"
                        />
                    </div>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex items-center justify-between group hover:shadow-indigo-100 transition-all border-l-8 border-l-indigo-500">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Registros</p>
                        <h3 className="text-3xl font-black text-black tracking-tighter">{initialData.stats.totalRegistros.toLocaleString()}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📄</div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex items-center justify-between group hover:shadow-emerald-100 transition-all border-l-8 border-l-emerald-500">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Items</p>
                        <h3 className="text-3xl font-black text-black tracking-tighter">{initialData.stats.totalItems.toLocaleString()}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📦</div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex items-center justify-between group hover:shadow-amber-100 transition-all border-l-8 border-l-amber-500">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Promedio Items</p>
                        <h3 className="text-3xl font-black text-black tracking-tighter">{initialData.stats.avgItemsPerReg}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📊</div>
                </div>

                <div className={`bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex items-center justify-between group transition-all border-l-8 ${initialData.stats.growth >= 0 ? 'border-l-indigo-600 hover:shadow-indigo-100' : 'border-l-rose-500 hover:shadow-rose-100'}`}>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Crecimiento Mensual</p>
                        <h3 className={`text-3xl font-black tracking-tighter ${initialData.stats.growth >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                            {initialData.stats.growth > 0 ? '+' : ''}{initialData.stats.growth.toFixed(1)}%
                        </h3>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform ${initialData.stats.growth >= 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
                        {initialData.stats.growth >= 0 ? '📈' : '📉'}
                    </div>
                </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Trend Chart */}
                <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 p-8 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl -z-10 -mr-32 -mt-32" />
                    <h3 className="text-xl font-black text-black mb-8 flex items-center gap-3 uppercase tracking-tighter">
                        <span className="text-indigo-600">📊</span> Tendencia Mensual (Folios vs Items)
                    </h3>
                    <div className="w-full h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={initialData.charts.trend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#4B5563', fontSize: 12, fontWeight: 700}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9BA3AF', fontSize: 11}} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '15px' }}
                                    itemStyle={{ fontWeight: 800 }}
                                />
                                <Bar dataKey="registros" name="N° Folios" fill="#4F46E5" radius={[10, 10, 0, 0]} barSize={40} />
                                <Line type="monotone" dataKey="items" name="Total Items" stroke="#F59E0B" strokeWidth={4} dot={{ r: 6, fill: '#F59E0B', strokeWidth: 3, stroke: '#FFF' }} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Operation Types & Top Schools */}
                <div className="space-y-8">
                   <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 p-8 flex items-center gap-6">
                        <div className="flex-1">
                            <h3 className="text-lg font-black text-black mb-2 uppercase tracking-tighter">Tipo de Operación</h3>
                            <div className="space-y-4 pt-4">
                                {initialData.charts.types.map((t: any, i: number) => (
                                    <div key={t.name} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i]}} />
                                            <span className="font-bold text-gray-700">{t.name}</span>
                                        </div>
                                        <span className="px-3 py-1 bg-gray-50 rounded-lg text-sm font-black text-indigo-600">{t.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="w-[180px] h-[180px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={initialData.charts.types}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {initialData.charts.types.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                   </div>

                   <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 p-8">
                        <h3 className="text-lg font-black text-black mb-6 flex items-center gap-3 uppercase tracking-tighter">
                            <span className="text-indigo-600">🏫</span> Top 10 Establecimientos
                        </h3>
                        <div className="space-y-3">
                            {initialData.charts.schools.map((s: any, i: number) => (
                                <div key={s.nombre} className="flex items-center gap-4 group">
                                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-black ${i < 3 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{i + 1}</span>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-sm font-bold text-gray-800 truncate max-w-[200px]">{s.nombre}</span>
                                            <span className="text-xs font-black text-indigo-600">{s.count} <span className="text-[10px] text-gray-400 uppercase">Reg.</span></span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-indigo-500 rounded-full transition-all duration-1000" 
                                                style={{ width: `${(s.count / initialData.charts.schools[0].count) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                   </div>
                </div>
            </div>

            {/* Top 10 Products Section */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-black text-black uppercase tracking-tighter flex items-center gap-3">
                        <span className="text-indigo-600">🏆</span> TOP 10 Productos Más Retirados (Unidades)
                    </h3>
                </div>
                
                <div className="w-full h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={initialData.charts.products} layout="vertical" margin={{ left: 100 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                            <XAxis type="number" hide />
                            <YAxis 
                                dataKey="nombre" 
                                type="category" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fill: '#111827', fontSize: 11, fontWeight: 800}}
                                width={180}
                            />
                            <Tooltip 
                                contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)', fontWeight: 800 }}
                                cursor={{ fill: 'transparent' }}
                            />
                            <Bar 
                                dataKey="total" 
                                fill="#4F46E5" 
                                radius={[0, 10, 10, 0]} 
                                barSize={30}
                            >
                                {initialData.charts.products.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={index < 3 ? '#4F46E5' : '#818CF8'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
}
