'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

interface FilterProps {
    filters: any
    sucursales: string[]
    uts: number[]
    rbds: any[]
}

export default function ColegiosFilterForm({ filters, sucursales, uts, rbds }: FilterProps) {
    const router = useRouter()
    const [search, setSearch] = useState(filters.rbd 
        ? `[${filters.rbd}] ` + (rbds.find((r: any) => r.colRBD === filters.rbd)?.nombreEstablecimiento || '')
        : '')
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleChangeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const form = e.target.form
        if (!form) return
        
        const formData = new FormData(form)
        const params = new URLSearchParams()
        
        // Preserve RBD if not changing sucursal or UT
        if (e.target.name !== 'sucursal' && e.target.name !== 'ut' && filters.rbd) {
            params.set('rbd', filters.rbd.toString())
        }

        formData.forEach((value, key) => {
            if (value && key !== 'rbdSearch') params.set(key, value.toString())
        })
        
        if (e.target.name === 'sucursal') {
            params.delete('ut')
            params.delete('rbd')
            setSearch('')
        }
        if (e.target.name === 'ut') {
            params.delete('rbd')
            setSearch('')
        }

        router.push(`/dashboard/mantenedor/operaciones/colegios?${params.toString()}`)
    }

    const handleSelectRbd = (rbd: any) => {
        const value = `[${rbd.colRBD}] ${rbd.nombreEstablecimiento}`
        setSearch(value)
        setIsOpen(false)
        
        const params = new URLSearchParams(window.location.search)
        params.set('rbd', rbd.colRBD.toString())
        router.push(`/dashboard/mantenedor/operaciones/colegios?${params.toString()}`)
    }

    const filteredRbds = search === '' 
        ? rbds 
        : rbds.filter((r: any) => 
            r.colRBD.toString().includes(search) || 
            r.nombreEstablecimiento.toLowerCase().includes(search.toLowerCase())
          )

    return (
        <form className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3">
                <label className="block text-xs font-black text-gray-500 uppercase mb-1 tracking-widest">Sucursal</label>
                <select
                    name="sucursal"
                    defaultValue={filters.sucursal || ''}
                    onChange={handleChangeSelect}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-black text-sm appearance-none cursor-pointer hover:bg-gray-100 transition-colors"
                >
                    <option value="">Todas las sucursales</option>
                    {sucursales.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>

            <div className="md:col-span-2">
                <label className="block text-xs font-black text-gray-500 uppercase mb-1 tracking-widest">UT</label>
                <select
                    name="ut"
                    defaultValue={filters.ut || ''}
                    onChange={handleChangeSelect}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-black text-sm appearance-none cursor-pointer hover:bg-gray-100 transition-colors"
                >
                    <option value="">Todas las UT</option>
                    {uts.map(u => (
                        <option key={u} value={u}>UT {u}</option>
                    ))}
                </select>
            </div>

            <div className="md:col-span-5 relative" ref={containerRef}>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1 tracking-widest">RBD / Establecimiento</label>
                <input
                    name="rbdSearch"
                    type="text"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value)
                        setIsOpen(true)
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Escriba RBD o Nombre..."
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-black text-sm transition-all"
                />
                {isOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto animate-in fade-in slide-in-from-top-2">
                        {filteredRbds.length > 0 ? (
                            filteredRbds.map((r: any) => (
                                <div 
                                    key={r.colRBD}
                                    onClick={() => handleSelectRbd(r)}
                                    className="px-4 py-2 hover:bg-cyan-50 cursor-pointer border-b border-gray-50 last:border-0 text-sm flex gap-2 items-center"
                                >
                                    <span className="font-mono font-bold bg-gray-100 px-1.5 py-0.5 rounded text-xs text-gray-600 w-16 text-center">{r.colRBD}</span>
                                    <span className="font-semibold text-gray-800 truncate">{r.nombreEstablecimiento}</span>
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center font-medium">
                                No se encontraron colegios
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="md:col-span-2 flex items-end">
                <a href="/dashboard/mantenedor/operaciones/colegios" className="w-full py-2 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-sm font-black uppercase tracking-widest text-center transition-colors shadow-sm cursor-pointer">
                    Limpiar
                </a>
            </div>
        </form>
    )
}
