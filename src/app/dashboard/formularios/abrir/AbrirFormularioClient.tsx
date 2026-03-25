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
                        <Link 
                            key={form.id} 
                            href={`/dashboard/formularios/abrir/${form.id}`}
                            className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-cyan-300 transition-all group flex flex-col h-full relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-cyan-50 to-sky-50 rounded-bl-full -z-10 opacity-50 group-hover:scale-125 transition-transform" />
                            
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-2xl group-hover:bg-cyan-500 group-hover:text-white transition-colors">📄</div>
                                    <div className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 shadow-sm">
                                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
                                            <span className="text-xs">📈</span> {form._count?.submissions || 0} Respuestas
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{form.fields.length} Campos</span>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${form.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {form.isActive ? 'ACTIVO' : 'INACTIVO'}
                                    </span>
                                </div>
                            </div>

                            <h3 className="text-xl font-black text-gray-900 mb-2 truncate group-hover:text-cyan-600 transition-colors uppercase tracking-tight">{form.title}</h3>
                            <p className="text-sm text-gray-500 mb-4 line-clamp-2 italic font-medium flex-1">
                                {form.description || 'Sin descripción adicional disponible.'}
                            </p>

                            {/* ADMIN ACTIONS */}
                            {canManage && (
                                <div className="flex gap-2 mb-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Link 
                                        href={`/dashboard/formularios/editar/${form.id}`}
                                        className="flex-1 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase text-center hover:bg-indigo-100 transition-colors"
                                    >
                                        Editar ✏️
                                    </Link>
                                    <Link 
                                        href={`/dashboard/formularios/privilegios/${form.id}`}
                                        className="flex-1 py-2 bg-purple-50 text-purple-700 rounded-xl text-[10px] font-black uppercase text-center hover:bg-purple-100 transition-colors"
                                    >
                                        Permisos 🔐
                                    </Link>
                                    <Link 
                                        href={`/dashboard/formularios/calendario/${form.id}`}
                                        className="flex-1 py-2 bg-amber-50 text-amber-700 rounded-xl text-[10px] font-black uppercase text-center hover:bg-amber-100 transition-colors"
                                    >
                                        Reloj ⏰
                                    </Link>
                                </div>
                            )}

                            <div className="pt-4 border-t border-gray-50 flex items-center justify-between mt-auto">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Creado por</span>
                                    <span className="text-xs font-bold text-gray-700">{form.createdBy}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest italic">Fecha</span>
                                    <span className="text-xs font-bold text-gray-500">{new Date(form.createdAt).toLocaleDateString('es-ES')}</span>
                                </div>
                            </div>

                            {canManage && (
                                <div className="mt-4 w-full py-2 bg-slate-900 text-white text-center rounded-xl text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                    MODO ADMINISTRADOR
                                </div>
                            )}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
