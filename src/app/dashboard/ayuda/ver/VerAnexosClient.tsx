'use client'

import { useState } from 'react'

interface Anexo {
    id: string
    sucursal: string
    cargo: string
    correo: string
    telefono1: string
    telefono2?: string
    telefono3?: string
    telefono4?: string
    nombre: string
    cumpleano?: string
    contacto?: string
    nota?: string
}

interface VerAnexosClientProps {
    initialAnexos: Anexo[]
    sucursales: string[]
    initialFilters: { sucursal: string, nombre: string }
}

export default function VerAnexosClient({ initialAnexos, sucursales, initialFilters }: VerAnexosClientProps) {
    const [filters, setFilters] = useState(initialFilters)
    
    const filteredAnexos = initialAnexos.filter(a => {
        const matchSucursal = !filters.sucursal || a.sucursal === filters.sucursal
        const matchNombre = !filters.nombre || a.nombre.toLowerCase().includes(filters.nombre.toLowerCase())
        return matchSucursal && matchNombre
    })

    const formatWhatsApp = (num: string) => {
        // Formato Chile: +569XXXXXXXX
        let cleaned = num.replace(/\D/g, '')
        if (cleaned.length === 9) cleaned = '56' + cleaned
        if (cleaned.length === 8) cleaned = '569' + cleaned
        return cleaned
    }

    return (
        <div className="space-y-6">
            {/* Filtros */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
                    <select
                        value={filters.sucursal}
                        onChange={(e) => setFilters(prev => ({ ...prev, sucursal: e.target.value }))}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                    >
                        <option value="">Todas</option>
                        {sucursales.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                    <input
                        type="text"
                        placeholder="Buscar por nombre..."
                        value={filters.nombre}
                        onChange={(e) => setFilters(prev => ({ ...prev, nombre: e.target.value }))}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 placeholder-gray-400"
                    />
                </div>
            </div>

            {/* Lista de Tarjetas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAnexos.map(anexo => (
                    <div key={anexo.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{anexo.nombre}</h3>
                                    <p className="text-sm text-cyan-600 font-medium">{anexo.cargo}</p>
                                </div>
                                <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider">
                                    {anexo.sucursal}
                                </span>
                            </div>

                            <div className="space-y-2 text-sm text-gray-600 mb-6">
                                <p className="flex items-center gap-2">
                                    <span>📧</span> {anexo.correo}
                                </p>
                                <p className="flex items-center gap-2 font-medium text-gray-800">
                                    <span>📞</span> {anexo.telefono1}
                                    {anexo.telefono2 && <span className="text-gray-400 font-normal">| {anexo.telefono2}</span>}
                                </p>
                                {anexo.nota && (
                                    <p className="mt-2 text-xs italic bg-amber-50 p-2 rounded-lg border border-amber-100 text-amber-800">
                                        Nota: {anexo.nota}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Botones de acción móvil */}
                        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-50">
                            <a
                                href={`tel:${anexo.telefono1}`}
                                className="flex flex-col items-center justify-center p-3 rounded-xl bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition-colors"
                            >
                                <span className="text-xl">📞</span>
                                <span className="text-[10px] font-bold mt-1 uppercase">Llamar</span>
                            </a>
                            <a
                                href={`https://wa.me/${formatWhatsApp(anexo.telefono1)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center justify-center p-3 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                            >
                                <span className="text-xl">💬</span>
                                <span className="text-[10px] font-bold mt-1 uppercase">WhatsApp</span>
                            </a>
                            <a
                                href={`sms:${anexo.telefono1}`}
                                className="flex flex-col items-center justify-center p-3 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                            >
                                <span className="text-xl">✉️</span>
                                <span className="text-[10px] font-bold mt-1 uppercase">Mensaje</span>
                            </a>
                        </div>
                    </div>
                ))}

                {filteredAnexos.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <span className="text-4xl block mb-2">🔍</span>
                        <p className="text-gray-500 font-medium">No se encontraron anexos con estos criterios.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
