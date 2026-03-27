'use client'

import { useState, useRef } from 'react'
import { AnexoData, upsertAnexo, deleteAnexo, uploadAnexosBulk, getAllAnexosForExport, deleteAllAnexos } from '../actions'
import * as xlsx from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface AnexoMaintainerProps {
    initialAnexos: AnexoData[]
    sucursalesList: string[]
}

export default function AnexoMaintainer({ initialAnexos, sucursalesList }: AnexoMaintainerProps) {
    const [anexos, setAnexos] = useState<AnexoData[]>(initialAnexos)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingAnexo, setEditingAnexo] = useState<AnexoData | null>(null)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    
    // Filtros locales
    const [filterSucursal, setFilterSucursal] = useState('')
    const [filterNombre, setFilterNombre] = useState('')

    const fileInputRef = useRef<HTMLInputElement>(null)

    const filteredList = anexos.filter(a => {
        const mS = !filterSucursal || a.sucursal === filterSucursal
        const mN = !filterNombre || a.nombre.toLowerCase().includes(filterNombre.toLowerCase())
        return mS && mN
    })

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        const formData = new FormData(e.currentTarget)
        const data: AnexoData = {
            id: editingAnexo?.id,
            sucursal: formData.get('sucursal') as string,
            cargo: formData.get('cargo') as string,
            correo: formData.get('correo') as string,
            telefono1: formData.get('telefono1') as string,
            telefono2: formData.get('telefono2') as string || undefined,
            telefono3: formData.get('telefono3') as string || undefined,
            telefono4: formData.get('telefono4') as string || undefined,
            nombre: formData.get('nombre') as string,
            cumpleano: formData.get('cumpleano') as string || undefined,
            contacto: formData.get('contacto') as string || undefined,
            nota: formData.get('nota') as string || undefined,
        }

        const res = await upsertAnexo(data)
        if (res.success) {
            setMessage({ type: 'success', text: 'Anexo guardado con éxito' })
            setIsModalOpen(false)
            setEditingAnexo(null)
            // Recargar localmente (idealmente usar el refresh de la página o actualizar el estado)
            window.location.reload()
        } else {
            setMessage({ type: 'error', text: res.error || 'Error al guardar' })
        }
        setLoading(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este anexo?')) return
        setLoading(true)
        const res = await deleteAnexo(id)
        if (res.success) {
            setMessage({ type: 'success', text: 'Anexo eliminado' })
            window.location.reload()
        } else {
            setMessage({ type: 'error', text: res.error || 'Error' })
        }
        setLoading(false)
    }

    const handleExportExcel = async () => {
        const data = await getAllAnexosForExport()
        const worksheet = xlsx.utils.json_to_sheet(data)
        const workbook = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(workbook, worksheet, "Anexos")
        xlsx.writeFile(workbook, "Anexos_Hendaya.xlsx")
    }

    const handleMassDelete = async () => {
        if (!confirm('🛑 ATENCIÓN: ¿Estás seguro de que deseas ELIMINAR TODOS los anexos? Esta acción no se puede deshacer.')) return
        setLoading(true)
        const res = await deleteAllAnexos()
        if (res.success) {
            setMessage({ type: 'success', text: 'Todos los anexos han sido eliminados.' })
            window.location.reload()
        } else {
            setMessage({ type: 'error', text: res.error || 'Error' })
        }
        setLoading(false)
    }

    const handleExportPDF = async () => {
        const data = await getAllAnexosForExport()
        const doc = new jsPDF('l', 'mm', 'a4')
        
        doc.text("Directorio de Anexos - HENDAYA", 14, 15)
        
        const tableData = data.map(a => [
            a.nombre, a.sucursal, a.cargo, a.correo, a.telefono1, a.telefono2 || ''
        ])

        autoTable(doc, {
            head: [['Nombre', 'Sucursal', 'Cargo', 'Correo', 'Tel 1', 'Tel 2']],
            body: tableData,
            startY: 20
        })

        doc.save("Anexos_Hendaya.pdf")
    }

    const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        
        const reader = new FileReader()
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result
                const wb = xlsx.read(bstr, { type: 'binary' })
                const wsname = wb.SheetNames[0]
                const ws = wb.Sheets[wsname]
                const rawObjects = xlsx.utils.sheet_to_json(ws) as any[]
                
                const normalizeKey = (k: string) => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '')
                
                const data = rawObjects.map(row => {
                    const newRow: Record<string, any> = {}
                    for (const key in row) {
                        newRow[normalizeKey(key)] = row[key]
                    }
                    return newRow
                })
                
                const formatted: AnexoData[] = data.map(row => ({
                    sucursal: String(row.sucursal || ''),
                    cargo: String(row.cargo || ''),
                    correo: String(row.correo || ''),
                    telefono1: String(row.telefono1 || ''),
                    telefono2: row.telefono2 ? String(row.telefono2) : undefined,
                    telefono3: row.telefono3 ? String(row.telefono3) : undefined,
                    telefono4: row.telefono4 ? String(row.telefono4) : undefined,
                    nombre: String(row.nombre || ''),
                    cumpleano: row.cumpleano ? String(row.cumpleano) : undefined,
                    contacto: row.contacto ? String(row.contacto) : undefined,
                    nota: row.nota ? String(row.nota) : undefined,
                }))

                const res = await uploadAnexosBulk(formatted)
                if (res.success) {
                    alert(`Se cargaron ${res.count} anexos`)
                    window.location.reload()
                } else {
                    alert(res.error)
                }
            } catch (err) {
                alert('Error al leer el archivo')
            }
        }
        reader.readAsBinaryString(file)
    }

    const downloadTemplate = () => {
        const headers = [['sucursal', 'cargo', 'correo', 'telefono1', 'telefono2', 'telefono3', 'telefono4', 'nombre', 'cumpleano', 'contacto', 'nota']]
        const worksheet = xlsx.utils.aoa_to_sheet(headers)
        const workbook = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(workbook, worksheet, "Plantilla")
        xlsx.writeFile(workbook, "Plantilla_Anexos.xlsx")
    }

    return (
        <div className="space-y-6">
            {/* Header / Botones */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <span>☎️</span> Agregar Anexos
                    </h2>
                    <p className="text-gray-500 text-sm">Mantenedor de contactos y anexos internos</p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button onClick={() => { setEditingAnexo(null); setIsModalOpen(true); }} className="px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-colors font-medium flex items-center gap-2 text-sm">
                        <span>+</span> Nuevo Anexo
                    </button>
                    <label className="cursor-pointer px-4 py-2 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors font-medium flex items-center gap-2 text-sm shadow-sm shadow-cyan-100">
                        <span>📊</span> Carga Masiva
                        <input type="file" hidden onChange={handleBulkUpload} accept=".xlsx,.xls" />
                    </label>
                    <button onClick={downloadTemplate} className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-colors font-bold text-sm">
                        <span>📥</span> Plantilla
                    </button>
                    <button onClick={handleExportExcel} className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors font-bold text-sm">
                        <span>📗</span> Excel
                    </button>
                    <button onClick={handleExportPDF} className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl hover:bg-rose-100 transition-colors font-bold text-sm">
                        <span>📕</span> PDF
                    </button>
                    <button onClick={handleMassDelete} disabled={loading || anexos.length === 0} className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-bold text-sm shadow-sm disabled:opacity-50">
                        <span>🗑️</span> Vaciar Todo
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filtrar Sucursal</label>
                    <select value={filterSucursal} onChange={(e) => setFilterSucursal(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-medium focus:ring-2 focus:ring-cyan-500">
                        <option value="">Todas</option>
                        {sucursalesList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Buscar Nombre</label>
                    <input type="text" value={filterNombre} onChange={(e) => setFilterNombre(e.target.value)} placeholder="Ej: Juan Perez..." className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-medium focus:ring-2 focus:ring-cyan-500" />
                </div>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto min-h-[300px]">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-600 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-bold">Nombre</th>
                                <th className="px-6 py-4 font-bold">Sucursal</th>
                                <th className="px-6 py-4 font-bold">Cargo</th>
                                <th className="px-6 py-4 font-bold">Teléfono 1</th>
                                <th className="px-6 py-4 font-bold">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredList.map(a => (
                                <tr key={a.id} className="hover:bg-cyan-50/30 transition-colors">
                                    <td className="px-6 py-3 font-semibold text-gray-900">{a.nombre}</td>
                                    <td className="px-6 py-3 text-gray-600">{a.sucursal}</td>
                                    <td className="px-6 py-3 text-cyan-700 font-medium">{a.cargo}</td>
                                    <td className="px-6 py-3 font-mono text-gray-900 font-bold">{a.telefono1}</td>
                                    <td className="px-6 py-3 flex gap-2">
                                        <button onClick={() => { setEditingAnexo(a); setIsModalOpen(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">✏️</button>
                                        <button onClick={() => handleDelete(a.id!)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">🗑️</button>
                                    </td>
                                </tr>
                            ))}
                            {filteredList.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No hay registros</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 relative">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        
                        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                            {editingAnexo ? '✏️ Editar Anexo' : '✨ Nuevo Anexo'}
                        </h3>

                        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Completo</label>
                                <input name="nombre" defaultValue={editingAnexo?.nombre} required className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-950 font-medium focus:ring-2 focus:ring-cyan-500 bg-gray-50" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Sucursal</label>
                                <input name="sucursal" defaultValue={editingAnexo?.sucursal} required className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-950 font-medium focus:ring-2 focus:ring-cyan-500 bg-gray-50 placeholder-gray-400" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Cargo</label>
                                <input name="cargo" defaultValue={editingAnexo?.cargo} required className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-950 font-medium focus:ring-2 focus:ring-cyan-500 bg-gray-50" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-bold text-gray-700 mb-1">Correo Electrónico</label>
                                <input name="correo" type="email" defaultValue={editingAnexo?.correo} required className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-950 font-medium focus:ring-2 focus:ring-cyan-500 bg-gray-50" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Teléfono 1 (Prueba de llamada)</label>
                                <input name="telefono1" defaultValue={editingAnexo?.telefono1} required className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-950 font-medium focus:ring-2 focus:ring-cyan-500 bg-gray-50" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Teléfono 2</label>
                                <input name="telefono2" defaultValue={editingAnexo?.telefono2} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-950 font-medium focus:ring-2 focus:ring-cyan-500 bg-gray-50" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Teléfono 3</label>
                                <input name="telefono3" defaultValue={editingAnexo?.telefono3} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-950 font-medium focus:ring-2 focus:ring-cyan-500 bg-gray-50" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Teléfono 4</label>
                                <input name="telefono4" defaultValue={editingAnexo?.telefono4} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-950 font-medium focus:ring-2 focus:ring-cyan-500 bg-gray-50" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Cumpleaños</label>
                                <input name="cumpleano" defaultValue={editingAnexo?.cumpleano} placeholder="DD-MM" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-950 font-medium focus:ring-2 focus:ring-cyan-500 bg-gray-50" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Contacto Alternativo</label>
                                <input name="contacto" defaultValue={editingAnexo?.contacto} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-950 font-medium focus:ring-2 focus:ring-cyan-500 bg-gray-50" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-bold text-gray-700 mb-1">Nota</label>
                                <textarea name="nota" defaultValue={editingAnexo?.nota} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-950 font-medium focus:ring-2 focus:ring-cyan-500 bg-gray-50 resize-none"></textarea>
                            </div>
                            
                            <div className="sm:col-span-2 pt-6 flex gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 w-full rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
                                <button type="submit" disabled={loading} className="px-6 py-3 w-full rounded-2xl bg-slate-800 text-white font-bold hover:bg-slate-900 transition-all shadow-lg active:scale-95 disabled:opacity-50">
                                    {loading ? 'Guardando...' : '💾 Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {message && (
                <div className={`fixed bottom-8 right-8 p-4 rounded-2xl shadow-xl text-white font-bold animate-in slide-in-from-bottom-5 duration-300 ${message.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                    {message.text}
                </div>
            )}
        </div>
    )
}
