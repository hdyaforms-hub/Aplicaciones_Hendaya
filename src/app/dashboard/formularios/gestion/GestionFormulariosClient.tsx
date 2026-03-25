'use client'

import Link from 'next/link'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import { deleteForm, getFormSubmissionsExport, toggleFormStatus } from '../actions'

export default function GestionFormulariosClient({ forms }: { forms: any[] }) {
    const [searchTerm, setSearchTerm] = useState('')
    const [isDeleting, setIsDeleting] = useState<string | null>(null)
    const [isExporting, setIsExporting] = useState<string | null>(null)

    const filteredForms = forms.filter(f => 
        f.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const handleExport = async (formId: string) => {
        setIsExporting(formId)
        try {
            const res = await getFormSubmissionsExport(formId)
            if (!res.success) {
                alert(res.error)
                return
            }

            const { title, fields, submissions } = res

            if (submissions.length === 0) {
                alert('No hay respuestas para exportar')
                return
            }

            const exportData = submissions.map(s => {
                const row: any = {
                    'ID Respuesta': s.id,
                    'Usuario': s.submittedBy,
                    'Fecha Envío': new Date(s.submittedAt).toLocaleString()
                }
                
                fields.forEach(f => {
                    if (f.type !== 'section') {
                        let value = s.data[f.id]
                        if (Array.isArray(value)) value = value.join(', ')
                        // Use field label as column name
                        row[f.label] = value
                    }
                })
                return row
            })

            const worksheet = XLSX.utils.json_to_sheet(exportData)
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Respuestas')
            
            // Clean filename
            const fileName = `Respuestas_${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.xlsx`
            XLSX.writeFile(workbook, fileName)
        } catch (error) {
            console.error('Export error:', error)
            alert('Error al exportar a Excel')
        } finally {
            setIsExporting(null)
        }
    }

    const handleToggleStatus = async (id: string, active: boolean) => {
        const res = await toggleFormStatus(id, active)
        if (!res.success) {
            alert(res.error)
        }
    }

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar el formulario "${title}"? Esta acción no se puede deshacer.`)) return
        
        setIsDeleting(id)
        const res = await deleteForm(id)
        if (res.success) {
            alert('Formulario eliminado con éxito')
            window.location.reload()
        } else {
            alert(res.error)
            setIsDeleting(null)
        }
    }

    return (
        <div className="max-w-7xl mx-auto pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-800">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <span className="text-4xl text-cyan-400">🛡️</span> Gestión de Formularios
                    </h2>
                    <p className="text-slate-400 mt-1 font-medium">Panel de administración global de herramientas dinámicas</p>
                </div>

                <div className="w-full md:w-96 relative">
                    <input
                        type="text"
                        placeholder="Buscar formulario para gestionar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-black focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all font-black shadow-sm"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-30">🔍</span>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="text-left px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Información del Formulario</th>
                                <th className="text-left px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
                                <th className="text-left px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Creado Por</th>
                                <th className="text-left px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                                <th className="text-right px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Acciones Administrativas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredForms.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-bold uppercase tracking-widest">No se encontraron formularios</td>
                                </tr>
                            ) : (
                                filteredForms.map((form) => (
                                    <tr key={form.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-xl">📄</div>
                                                <div>
                                                    <div className="font-bold text-gray-900 uppercase tracking-tight">{form.title}</div>
                                                    <div className="text-xs text-gray-500 italic line-clamp-1">{form.description || 'Sin descripción'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <button 
                                                onClick={() => handleToggleStatus(form.id, !form.isActive)}
                                                className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all shadow-sm ${
                                                    form.isActive 
                                                        ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200' 
                                                        : 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200'
                                                }`}
                                                title={form.isActive ? 'Desactivar Formulario' : 'Activar Formulario'}
                                            >
                                                <span className="mr-1.5">{form.isActive ? '●' : '○'}</span>
                                                {form.isActive ? 'Activo' : 'Inactivo'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="text-sm font-medium text-gray-700">{form.name || form.createdBy}</div>
                                        </td>
                                        <td className="px-6 py-5 text-sm text-gray-500 font-medium">
                                            {new Date(form.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex justify-end gap-2">
                                                <Link 
                                                    href={`/dashboard/formularios/editar/${form.id}`}
                                                    className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                                                    title="Editar Estructura"
                                                >
                                                    <span className="text-sm font-black italic px-2">Editar</span>
                                                </Link>
                                                <Link 
                                                    href={`/dashboard/formularios/privilegios/${form.id}`}
                                                    className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                                                    title="Gestionar Privilegios"
                                                >
                                                    <span className="text-sm font-black italic px-2">Privilegios</span>
                                                </Link>
                                                <Link 
                                                    href={`/dashboard/formularios/calendario/${form.id}`}
                                                    className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors"
                                                    title="Programar Calendario"
                                                >
                                                    <span className="text-sm font-black italic px-2">Reloj</span>
                                                </Link>
                                                <button 
                                                    onClick={() => handleExport(form.id)}
                                                    disabled={isExporting === form.id}
                                                    className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                                                    title="Exportar Respuestas a Excel"
                                                >
                                                    <span className="text-sm font-black italic px-2">
                                                        {isExporting === form.id ? '...' : 'Excel 📊'}
                                                    </span>
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(form.id, form.title)}
                                                    disabled={isDeleting === form.id}
                                                    className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors disabled:opacity-50"
                                                    title="Eliminar Formulario"
                                                >
                                                    <span className="text-sm font-black italic px-2">
                                                        {isDeleting === form.id ? '...' : 'Eliminar'}
                                                    </span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
