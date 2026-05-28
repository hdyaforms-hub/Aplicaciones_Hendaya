'use client'

import { useState } from 'react'
import { crearColegioManual, ColegioData } from './actions'

export default function CrearColegioModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState<ColegioData>({
        colut: 0,
        colRBD: 0,
        colRBDDV: '',
        insid: '',
        institucion: 'JUNAEB',
        sucursal: '',
        nombreEstablecimiento: '',
        direccionEstablecimiento: '',
        comuna: ''
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        const res = await crearColegioManual(formData)
        setIsLoading(false)

        if (res.success) {
            alert("Colegio creado exitosamente")
            setIsOpen(false)
            setFormData({
                colut: 0,
                colRBD: 0,
                colRBDDV: '',
                insid: '',
                institucion: 'JUNAEB',
                sucursal: '',
                nombreEstablecimiento: '',
                direccionEstablecimiento: '',
                comuna: ''
            })
        } else {
            alert(res.error || "Error al crear el colegio")
        }
    }

    return (
        <>
            <button 
                onClick={() => setIsOpen(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
                <span>➕</span> Nuevo Colegio
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col slide-in-from-bottom-4 animate-in duration-300">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <span>🏫</span> Crear Nuevo Colegio
                            </h3>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <form id="crear-colegio-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">RBD</label>
                                    <input required type="number" name="colRBD" value={formData.colRBD || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">RBD-DV</label>
                                    <input required type="text" name="colRBDDV" value={formData.colRBDDV} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">UT</label>
                                    <input required type="number" name="colut" value={formData.colut || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">INSID</label>
                                    <input required type="text" name="insid" value={formData.insid} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Institución</label>
                                    <select name="institucion" value={formData.institucion} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500">
                                        <option value="JUNAEB">JUNAEB</option>
                                        <option value="JUNJI">JUNJI</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Sucursal</label>
                                    <input required type="text" name="sucursal" value={formData.sucursal} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre Establecimiento</label>
                                    <input required type="text" name="nombreEstablecimiento" value={formData.nombreEstablecimiento} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Dirección</label>
                                    <input required type="text" name="direccionEstablecimiento" value={formData.direccionEstablecimiento} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Comuna</label>
                                    <input required type="text" name="comuna" value={formData.comuna} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </form>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button 
                                type="button"
                                onClick={() => setIsOpen(false)}
                                disabled={isLoading}
                                className="px-5 py-2 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit"
                                form="crear-colegio-form"
                                disabled={isLoading}
                                className="px-5 py-2 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md flex items-center gap-2"
                            >
                                {isLoading ? <span className="animate-spin">⏳</span> : '💾'}
                                {isLoading ? 'Guardando...' : 'Guardar Colegio'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
