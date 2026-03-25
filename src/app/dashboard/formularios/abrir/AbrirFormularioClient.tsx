'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function AbrirFormularioClient({ initialForms, canManage }: { initialForms: any[], canManage?: boolean }) {
    const [searchTerm, setSearchTerm] = useState('')

    const filteredForms = initialForms.filter(f => 
        f.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return (
        <div className="max-w-6xl mx-auto pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="text-4xl">📂</span> Abrir Formulario
                    </h2>
                    <p className="text-gray-500 mt-1 font-medium">Selecciona un formulario para completar y enviar</p>
                </div>

                <div className="w-full md:w-96 relative">
                    <input
                        type="text"
                        placeholder="Buscar formulario por nombre..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 bg-white transition-all font-medium text-gray-700 shadow-sm"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-30">🔍</span>
                </div>
            </div>

            {filteredForms.length === 0 ? (
                <div className="bg-white rounded-3xl border border-dashed border-gray-300 p-20 text-center shadow-sm">
                    <span className="text-6xl mb-4 block opacity-20">📭</span>
                    <p className="text-gray-400 font-bold uppercase tracking-widest">No se encontraron formularios disponibles</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredForms.map((form) => (
                        <div 
                            key={form.id} 
                            className="bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl hover:border-cyan-300 transition-all group flex flex-col h-full relative overflow-hidden"
                        >
                            {/* Overlay Link - Makes the whole card clickable EXCEPT for buttons */}
                            <Link 
                                href={`/dashboard/formularios/abrir/${form.id}`}
                                className="absolute inset-0 z-10"
                                aria-label={`Abrir ${form.title}`}
                            />

                            {/* Decorative background */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-50/50 to-sky-50/50 rounded-bl-full -z-0 opacity-50 group-hover:scale-150 transition-transform duration-700" />
                            
                            {/* Header Section: Icon & Status */}
                            <div className="flex justify-between items-start mb-6 relative z-20 pointer-events-none">
                                <div className="w-16 h-16 bg-cyan-500 rounded-2xl flex items-center justify-center text-3xl text-white shadow-lg shadow-cyan-200 group-hover:rotate-6 transition-transform">
                                    📄
                                </div>
                                <div className="flex flex-col items-end gap-1.5 pt-1">
                                    <span className={`text-[9px] font-black px-3 py-1 rounded-full shadow-sm tracking-tighter ${form.isActive ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                                        {form.isActive ? 'ACTIVO' : 'INACTIVO'}
                                    </span>
                                </div>
                            </div>

                            {/* Title & Description Area */}
                            <div className="mb-6 relative z-20 pointer-events-none">
                                <h3 className="text-3xl font-black text-slate-900 mb-2 leading-tight group-hover:text-cyan-600 transition-colors uppercase tracking-tight">
                                    {form.title}
                                </h3>
                                <p className="text-sm text-slate-500 line-clamp-2 italic font-medium leading-relaxed">
                                    {form.description || 'Sin descripción adicional disponible.'}
                                </p>
                            </div>

                            {/* Summary Badges Area (The decluttered stats) */}
                            <div className="flex items-center gap-3 mb-8 relative z-20 pointer-events-none">
                                <div className="bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-2">
                                    <span className="text-xl">📊</span>
                                    <div className="flex flex-col leading-none">
                                        <span className="text-xs font-black text-amber-900 uppercase tracking-tighter">
                                            {(form as any)._count?.submissions || 0}
                                        </span>
                                        <span className="text-[8px] font-bold text-amber-600 uppercase">Respuestas</span>
                                    </div>
                                </div>
                                <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2">
                                    <div className="flex flex-col leading-none">
                                        <span className="text-xs font-black text-slate-900 uppercase tracking-tighter">
                                            {form.fields.length}
                                        </span>
                                        <span className="text-[8px] font-bold text-slate-500 uppercase">Campos</span>
                                    </div>
                                </div>
                            </div>

                            {/* ESTATISTICAS POR UT (The mini graphic stays but we make sure there is room) */}
                            {(form as any).utStats && (form as any).utStats.length > 0 && (
                                <div className="mb-8 p-5 bg-slate-50 rounded-3xl border border-slate-100 relative z-20 pointer-events-none">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            📈 Distribución por UT (Top 5)
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        {(form as any).utStats.map((stat: any, idx: number) => {
                                            const total = (form as any).utStats.reduce((acc: number, curr: any) => acc + curr.count, 0)
                                            const percentage = total > 0 ? (stat.count / total) * 100 : 0
                                            return (
                                                <div key={idx} className="space-y-1.5">
                                                    <div className="flex justify-between items-center text-[10px] font-black text-slate-700 tracking-tighter uppercase">
                                                        <span>UT {stat.name}</span>
                                                        <span className="text-slate-400 font-bold bg-white px-2 py-0.5 rounded-lg border border-slate-100">{stat.count}</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-cyan-500 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(6,182,212,0.4)]" 
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ADMIN ACTIONS (They appear on hover) */}
                            {canManage && (
                                <div className="grid grid-cols-3 gap-3 mb-6 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 relative z-30">
                                    <Link 
                                        href={`/dashboard/formularios/editar/${form.id}`}
                                        className="py-3 bg-indigo-50 text-indigo-700 rounded-2xl text-[10px] font-black uppercase text-center hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100/50 shadow-sm flex flex-col items-center gap-1"
                                    >
                                        <span>EDITAR</span>
                                        <span className="text-xs">✏️</span>
                                    </Link>
                                    <Link 
                                        href={`/dashboard/formularios/privilegios/${form.id}`}
                                        className="py-3 bg-purple-50 text-purple-700 rounded-2xl text-[10px] font-black uppercase text-center hover:bg-purple-600 hover:text-white transition-all border border-purple-100/50 shadow-sm flex flex-col items-center gap-1"
                                    >
                                        <span>PERMISOS</span>
                                        <span className="text-xs">🔐</span>
                                    </Link>
                                    <Link 
                                        href={`/dashboard/formularios/calendario/${form.id}`}
                                        className="py-3 bg-amber-50 text-amber-700 rounded-2xl text-[10px] font-black uppercase text-center hover:bg-amber-600 hover:text-white transition-all border border-amber-100/50 shadow-sm flex flex-col items-center gap-1"
                                    >
                                        <span>RELOJ</span>
                                        <span className="text-xs">⏰</span>
                                    </Link>
                                </div>
                            )}

                            {/* Footer Section: Metadata */}
                            <div className="pt-6 border-t border-slate-50 flex items-center justify-between mt-auto relative z-20 pointer-events-none mb-6">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Creado por</span>
                                    <span className="text-xs font-bold text-slate-700">{form.createdBy}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic mb-0.5">Fecha</span>
                                    <span className="text-xs font-bold text-slate-500">{new Date(form.createdAt).toLocaleDateString('es-ES')}</span>
                                </div>
                            </div>

                            {/* Action Button: Footer Bar */}
                            <div className="relative z-30">
                                {canManage ? (
                                    <Link 
                                        href={`/dashboard/formularios/abrir/${form.id}`}
                                        className="w-full py-3 bg-slate-900 text-white text-center rounded-2xl text-[11px] font-black tracking-[0.2em] shadow-xl shadow-slate-200 border border-slate-800 uppercase hover:bg-slate-800 transition-colors"
                                    >
                                        MODO ADMINISTRADOR
                                    </Link>
                                ) : (
                                    <Link 
                                        href={`/dashboard/formularios/abrir/${form.id}`}
                                        className="w-full py-4 bg-cyan-500 text-white text-center rounded-2xl text-xs font-black tracking-[0.2em] shadow-lg shadow-cyan-200 hover:bg-cyan-600 transition-all uppercase flex items-center justify-center gap-2 font-black"
                                    >
                                        ABRIR FORMULARIO 📂
                                    </Link>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
