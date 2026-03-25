'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { generateFormPDF } from '../pdf-util'

export default function RespuestasClient({ 
    initialSubmissions, 
    forms,
    total,
    totalPages,
    currentPage
}: { 
    initialSubmissions: any[], 
    forms: any[],
    total: number,
    totalPages: number,
    currentPage: number
}) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [formId, setFormId] = useState(searchParams.get('formId') || '')
    const [username, setUsername] = useState(searchParams.get('username') || '')

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        const params = new URLSearchParams()
        if (formId) params.set('formId', formId)
        if (username) params.set('username', username)
        params.set('page', '1')
        router.push(`/dashboard/formularios/respuestas?${params.toString()}`)
    }

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', newPage.toString())
        router.push(`/dashboard/formularios/respuestas?${params.toString()}`)
    }

    const downloadPDF = (submission: any) => {
        const doc = generateFormPDF(submission.form, submission.data)
        doc.save(`${submission.form.title.replace(/\s+/g, '_')}_${submission.submittedBy}_${new Date(submission.submittedAt).getTime()}.pdf`)
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Filtrar por Formulario</label>
                        <select 
                            value={formId}
                            onChange={(e) => setFormId(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 bg-gray-50 font-black text-black"
                        >
                            <option value="">Todos los formularios</option>
                            {forms.map(f => (
                                <option key={f.id} value={f.id}>{f.title}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Usuario / Nombre</label>
                        <input 
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Buscar por usuario..."
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 bg-gray-50 font-black text-black"
                        />
                    </div>
                    <div>
                        <button 
                            type="submit"
                            className="w-full px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-md shadow-slate-200"
                        >
                            🔍 Buscar Respuestas
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-400">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Formulario</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Usuario</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Fecha Envío</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {initialSubmissions.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-bold italic">
                                        No se encontraron respuestas con los filtros seleccionados.
                                    </td>
                                </tr>
                            ) : (
                                initialSubmissions.map(sub => (
                                    <tr key={sub.id} className="hover:bg-cyan-50/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-black text-gray-800 uppercase tracking-tight">{sub.form.title}</div>
                                            <div className="text-[10px] text-gray-400 font-bold italic">ID: {sub.id.substring(0,8)}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-black uppercase">{sub.submittedBy}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                                            {new Date(sub.submittedAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => downloadPDF(sub)}
                                                className="px-4 py-2 bg-cyan-50 text-cyan-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-cyan-600 hover:text-white transition-all shadow-sm flex items-center gap-2 ml-auto"
                                            >
                                                <span>📄</span> Generar PDF
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                            Mostrando {initialSubmissions.length} de {total} respuestas
                        </p>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-black text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-all shadow-sm"
                            >
                                Anterior
                            </button>
                            <span className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-xs font-black shadow-md shadow-cyan-100">
                                {currentPage}
                            </span>
                            <button 
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-black text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-all shadow-sm"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
