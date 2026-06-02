'use client'

import { useState, useEffect, useRef } from 'react'
import { createManipuladora, searchRBDs } from './actions'

type SucursalVar = { id: string, nombre: string }

export default function CreateManipuladoraForm({
    sucursales,
}: {
    sucursales: SucursalVar[]
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    
    // RBD search
    const [rbdSearch, setRbdSearch] = useState('')
    const [rbdResults, setRbdResults] = useState<any[]>([])
    const [selectedRbds, setSelectedRbds] = useState<number[]>([])
    const [selectedSucursales, setSelectedSucursales] = useState<string[]>([])
    const searchRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        if (!isOpen) return
        if (rbdSearch.length >= 2 && selectedSucursales.length > 0) {
            if (searchRef.current) clearTimeout(searchRef.current)
            searchRef.current = setTimeout(async () => {
                const results = await searchRBDs(rbdSearch, selectedSucursales)
                setRbdResults(results)
            }, 300)
        } else {
            setRbdResults([])
        }
    }, [rbdSearch, selectedSucursales, isOpen])

    const toggleRbd = (rbd: number) => {
        setSelectedRbds(prev => 
            prev.includes(rbd) ? prev.filter(r => r !== rbd) : [...prev, rbd]
        )
        setRbdSearch('')
        setRbdResults([])
    }

    const toggleSucursal = (id: string) => {
        setSelectedSucursales(prev => 
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        )
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        const formData = new FormData(e.currentTarget)
        
        // Append all selected rbds
        selectedRbds.forEach(rbd => {
            formData.append('rbds', String(rbd))
        })

        // Append selected sucursales
        selectedSucursales.forEach(suc => {
            formData.append('sucursales', suc)
        })

        const result = await createManipuladora(formData)

        if (result?.error) {
            setError(result.error)
        } else if (result?.success) {
            setIsOpen(false)
            setSelectedRbds([])
            setSelectedSucursales([])
        }
        setLoading(false)
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
                ➕ Nueva Manipuladora
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                        >
                            ✕
                        </button>

                        <h3 className="text-xl font-bold text-gray-900 mb-6 tracking-tight">Nueva Manipuladora</h3>

                        <form onSubmit={handleSubmit} className="space-y-4 text-left">
                            {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Usuario *</label>
                                <input name="username" type="text" required className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                                <input name="name" type="text" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico (Opcional)</label>
                                <input name="email" type="email" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                                <input name="password" type="password" required className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900" />
                                <p className="text-xs text-sky-600 mt-1">Se requerirá cambio de contraseña en el primer inicio de sesión.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="isActive" value="true" defaultChecked className="w-4 h-4 text-cyan-600 focus:ring-cyan-500 border-gray-300" />
                                        <span className="text-sm text-gray-700">Vigente</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="isActive" value="false" className="w-4 h-4 text-cyan-600 focus:ring-cyan-500 border-gray-300" />
                                        <span className="text-sm text-gray-700">No Vigente</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Sucursales Permitidas *</label>
                                <div className="max-h-32 overflow-y-auto w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 flex flex-wrap gap-2">
                                    {sucursales.map(s => (
                                        <label key={s.id} className="flex items-center gap-2 cursor-pointer select-none bg-white px-2 py-1 rounded border border-gray-200 text-sm">
                                            <input type="checkbox" checked={selectedSucursales.includes(s.id)} onChange={() => toggleSucursal(s.id)} className="w-4 h-4 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500" />
                                            <span className="text-gray-700">{s.nombre}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Establecimientos Asignados (RBD)</label>
                                
                                <div className="mb-2 relative">
                                    <input 
                                        type="text" 
                                        value={rbdSearch}
                                        onChange={(e) => setRbdSearch(e.target.value)}
                                        placeholder="Buscar por RBD o Nombre de Establecimiento..." 
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                                        disabled={selectedSucursales.length === 0}
                                    />
                                    {selectedSucursales.length === 0 && <p className="text-xs text-orange-500 mt-1">Selecciona al menos una sucursal primero para buscar establecimientos.</p>}
                                    
                                    {rbdResults.length > 0 && (
                                        <div className="absolute z-20 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 max-h-48 overflow-y-auto">
                                            {rbdResults.map(colegio => (
                                                <div 
                                                    key={colegio.colRBD} 
                                                    onClick={() => toggleRbd(colegio.colRBD)}
                                                    className="px-4 py-2 hover:bg-cyan-50 cursor-pointer flex justify-between items-center text-sm"
                                                >
                                                    <div>
                                                        <span className="font-semibold text-gray-900">{colegio.colRBD}</span> - {colegio.nombreEstablecimiento}
                                                        <div className="text-xs text-gray-500">{colegio.sucursal} - {colegio.comuna}</div>
                                                    </div>
                                                    {selectedRbds.includes(colegio.colRBD) && (
                                                        <span className="text-cyan-600">✓ Añadido</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="max-h-32 overflow-y-auto w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 flex flex-wrap gap-2">
                                    {selectedRbds.map(rbd => (
                                        <div key={rbd} className="flex items-center gap-1 bg-cyan-100 text-cyan-800 px-2 py-1 rounded-md text-sm font-medium">
                                            RBD: {rbd}
                                            <button type="button" onClick={() => toggleRbd(rbd)} className="ml-1 text-cyan-600 hover:text-cyan-900 font-bold">×</button>
                                        </div>
                                    ))}
                                    {selectedRbds.length === 0 && (
                                        <span className="text-sm text-gray-500">No hay establecimientos asignados.</span>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 w-full rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-medium transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={loading} className="px-5 py-2.5 w-full rounded-xl text-white bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 shadow-md shadow-cyan-500/20 font-medium transition-all disabled:opacity-70 disabled:pointer-events-none">
                                    {loading ? 'Creando...' : 'Crear Manipuladora'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}
