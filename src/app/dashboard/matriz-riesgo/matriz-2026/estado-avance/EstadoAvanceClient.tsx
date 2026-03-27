'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

export default function EstadoAvanceClient({ initialReport }: { initialReport: any[] }) {
    const [report] = useState(initialReport)

    const sem1 = report.filter(r => r.semestre === 1)
    const sem2 = report.filter(r => r.semestre === 2)

    const formatPct = (val: number) => `${Math.round(val)}%`

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-4 border border-gray-100 shadow-2xl rounded-2xl">
                    <p className="font-black text-slate-900 mb-2">UT {label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-xs font-bold py-0.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                            <span className="text-slate-500">{entry.name}:</span>
                            <span className="text-slate-900 ml-auto">{entry.value}</span>
                        </div>
                    ))}
                </div>
            )
        }
        return null
    }

    const TableSection = ({ title, data, colorClass }: { title: string, data: any[], colorClass: string }) => (
        <div className="space-y-8 mb-16">
            <h2 className={`text-2xl font-black ${colorClass} uppercase tracking-tighter flex items-center gap-2`}>
                <span className="w-2 h-8 bg-current rounded-full"></span>
                {title}
            </h2>
            
            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                            <tr className="bg-slate-900 text-white font-black uppercase tracking-widest">
                                <th colSpan={1} className="px-6 py-4 border-r border-slate-800 text-center">UT</th>
                                <th colSpan={5} className="px-6 py-4 border-r border-slate-800 text-center bg-blue-900 bg-opacity-50">Auditoría</th>
                                <th colSpan={7} className="px-6 py-4 text-center bg-orange-900 bg-opacity-30 text-orange-100">Status Estándar Pae & Mitigación</th>
                            </tr>
                            <tr className="bg-slate-50 text-slate-500 font-bold border-b border-gray-200">
                                <th className="px-4 py-3 border-r border-gray-300 w-16">UT</th>
                                <th className="px-3 py-3 border-r border-gray-200 text-center bg-blue-50">Cant. Auditoría</th>
                                <th className="px-3 py-3 border-r border-gray-200 text-center bg-blue-50">RBD Adjudicados</th>
                                <th className="px-3 py-3 border-r border-gray-200 text-center bg-blue-50">Sin Auditar</th>
                                <th className="px-3 py-3 border-r border-gray-200 text-center bg-blue-50">Repetidas</th>
                                <th className="px-3 py-3 border-r border-gray-300 text-center bg-blue-100 text-blue-900">% Cumpl.</th>
                                <th className="px-3 py-3 border-r border-gray-200 text-center bg-orange-50">Con Registros</th>
                                <th className="px-3 py-3 border-r border-gray-200 text-center bg-orange-50">Sin Prob.</th>
                                <th className="px-3 py-3 border-r border-gray-200 text-center bg-orange-50">Por Soluc.</th>
                                <th className="px-3 py-3 border-r border-gray-200 text-center bg-orange-100 text-orange-900">Cumpl. Acta</th>
                                <th className="px-3 py-3 border-r border-gray-200 text-center bg-red-50 text-red-900">Levantados</th>
                                <th className="px-3 py-3 border-r border-gray-200 text-center bg-red-50 text-red-900">Solucionados</th>
                                <th className="px-3 py-3 text-center bg-red-600 text-white">% Cumpl. Items</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors font-medium text-slate-700">
                                    <td className="px-4 py-3 border-r border-gray-300 font-black text-slate-900">{row.ut}</td>
                                    <td className="px-3 py-3 border-r border-gray-100 text-center">{row.cantAuditadas}</td>
                                    <td className="px-3 py-3 border-r border-gray-100 text-center">{row.adjCount}</td>
                                    <td className="px-3 py-3 border-r border-gray-100 text-center text-red-500">{row.sinAuditar}</td>
                                    <td className="px-3 py-3 border-r border-gray-100 text-center">{row.repetidos}</td>
                                    <td className="px-3 py-3 border-r border-gray-300 text-center bg-blue-50 font-black text-blue-700">{formatPct(row.cumplimientoAudit)}</td>
                                    <td className="px-3 py-3 border-r border-gray-100 text-center">{row.actasConRegistros}</td>
                                    <td className="px-3 py-3 border-r border-gray-100 text-center text-emerald-600">{row.actasSinProblemas}</td>
                                    <td className="px-3 py-3 border-r border-gray-100 text-center text-orange-600">{row.actasPorSolucionar}</td>
                                    <td className="px-3 py-3 border-r border-gray-200 text-center bg-orange-50 font-black text-orange-700">{formatPct(row.cumplimientoActa)}</td>
                                    <td className="px-3 py-3 border-r border-gray-100 text-center font-bold">{row.totalItemsLevantados}</td>
                                    <td className="px-3 py-3 border-r border-gray-100 text-center text-emerald-600">{row.totalItemsSolucionados}</td>
                                    <td className={`px-3 py-3 text-center font-black ${row.cumplimientoItems < 50 ? 'bg-red-500 text-white' : row.cumplimientoItems < 100 ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                        {formatPct(row.cumplimientoItems)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Auditoría */}
                <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 h-[400px] flex flex-col">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter mb-6 flex items-center justify-between">
                        AUDITORIA
                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px]">UT / SEMESTRE</span>
                    </h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="ut" tick={{ fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 20 }} />
                            <Bar name="Auditorías (Sumas dup.)" dataKey="cantAuditadas" fill="#ed7d31" radius={[4, 4, 0, 0]} />
                            <Bar name="RBD Adjudicadas" dataKey="adjCount" fill="#a5a5a5" radius={[4, 4, 0, 0]} />
                            <Bar name="Auditorías (Sin dup.)" dataKey={(r:any) => r.cantAuditadas - r.repetidos} fill="#ffc000" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Estatus Actas */}
                <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 h-[400px] flex flex-col">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter mb-6">ESTATUS DE ACTAS / ESTANDAR PAE & MITIGACIÓN</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="ut" tick={{ fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 20 }} />
                            <Bar name="Total Levantadas" dataKey="cantAuditadas" fill="#5b9bd5" radius={[4, 4, 0, 0]} />
                            <Bar name="Con Registros" dataKey="actasConRegistros" fill="#ed7d31" radius={[4, 4, 0, 0]} />
                            <Bar name="Sin Problemas" dataKey="actasSinProblemas" fill="#a5a5a5" radius={[4, 4, 0, 0]} />
                            <Bar name="Por Solucionar" dataKey="actasPorSolucionar" fill="#ffc000" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Estatus Items */}
                <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 h-[400px] flex flex-col">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter mb-6">ESTATUS DE ITEMS / ESTANDAR PAE & MITIGACIÓN</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="ut" tick={{ fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 20 }} />
                            <Bar name="Total Levantados" dataKey="totalItemsLevantados" fill="#4472c4" radius={[4, 4, 0, 0]} />
                            <Bar name="Total Solucionados" dataKey="totalItemsSolucionados" fill="#70ad47" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )

    return (
        <div className="space-y-12 pb-20">
            {sem1.length > 0 && <TableSection title="Primer Semestre 2026" data={sem1} colorClass="text-blue-600" />}
            {sem2.length > 0 && <TableSection title="Segundo Semestre 2026" data={sem2} colorClass="text-emerald-600" />}

            {report.length === 0 && (
                <div className="p-20 text-center flex flex-col items-center">
                    <span className="text-6xl mb-4">📊</span>
                    <h3 className="text-xl font-black text-slate-900">Sin datos disponibles</h3>
                    <p className="text-slate-500 max-w-xs mt-2">Aún no hay evaluaciones registradas para el periodo actual.</p>
                </div>
            )}
        </div>
    )
}
