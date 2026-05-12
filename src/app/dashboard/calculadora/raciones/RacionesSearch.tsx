'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/use-debounce'
import { useEffect } from 'react'

export default function RacionesSearch({ 
    initialLicitacion = '',
    initialRbd = '',
    initialUt = '',
    initialMes = '',
    initialAnio = ''
}: { 
    initialLicitacion?: string,
    initialRbd?: string,
    initialUt?: string,
    initialMes?: string,
    initialAnio?: string
}) {
    const [licitacionQuery, setLicitacionQuery] = useState(initialLicitacion)
    const [rbdQuery, setRbdQuery] = useState(initialRbd)
    const [utQuery, setUtQuery] = useState(initialUt)
    const [mesQuery, setMesQuery] = useState(initialMes)
    const [anioQuery, setAnioQuery] = useState(initialAnio)

    const router = useRouter()
    
    const debouncedLicitacion = useDebounce(licitacionQuery, 500)
    const debouncedRbd = useDebounce(rbdQuery, 500)
    const debouncedUt = useDebounce(utQuery, 500)
    const debouncedMes = useDebounce(mesQuery, 500)
    const debouncedAnio = useDebounce(anioQuery, 500)

    const prevSearchRef = useRef({ debouncedLicitacion, debouncedRbd, debouncedUt, debouncedMes, debouncedAnio })

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        
        // Check if any search filter changed
        const searchChanged = 
            prevSearchRef.current.debouncedLicitacion !== debouncedLicitacion ||
            prevSearchRef.current.debouncedRbd !== debouncedRbd ||
            prevSearchRef.current.debouncedUt !== debouncedUt ||
            prevSearchRef.current.debouncedMes !== debouncedMes ||
            prevSearchRef.current.debouncedAnio !== debouncedAnio

        if (debouncedLicitacion) params.set('licitacion', debouncedLicitacion)
        else params.delete('licitacion')
        
        if (debouncedRbd) params.set('rbd', debouncedRbd)
        else params.delete('rbd')
        
        if (debouncedUt) params.set('ut', debouncedUt)
        else params.delete('ut')
        
        if (debouncedMes) params.set('mes', debouncedMes)
        else params.delete('mes')
        
        if (debouncedAnio) params.set('anio', debouncedAnio)
        else params.delete('anio')

        // Only reset to page 1 if the search filters changed
        if (searchChanged) {
            params.set('page', '1')
        }
        
        // Update ref
        prevSearchRef.current = { debouncedLicitacion, debouncedRbd, debouncedUt, debouncedMes, debouncedAnio }
        
        router.push(`/dashboard/calculadora/raciones?${params.toString()}`)
    }, [debouncedLicitacion, debouncedRbd, debouncedUt, debouncedMes, debouncedAnio, router])

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400">📄</span>
                </div>
                <input
                    type="text"
                    value={licitacionQuery}
                    onChange={(e) => setLicitacionQuery(e.target.value)}
                    placeholder="Licitación..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 bg-white font-medium text-sm transition-all shadow-sm"
                />
            </div>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400">🏫</span>
                </div>
                <input
                    type="text"
                    value={rbdQuery}
                    onChange={(e) => setRbdQuery(e.target.value)}
                    placeholder="RBD o Colegio..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 bg-white font-medium text-sm transition-all shadow-sm"
                />
            </div>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400">🏢</span>
                </div>
                <input
                    type="text"
                    value={utQuery}
                    onChange={(e) => setUtQuery(e.target.value)}
                    placeholder="UT..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 bg-white font-medium text-sm transition-all shadow-sm"
                />
            </div>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400">📅</span>
                </div>
                <select
                    value={mesQuery}
                    onChange={(e) => setMesQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 bg-white font-medium text-sm transition-all shadow-sm appearance-none"
                >
                    <option value="">Todos los Meses</option>
                    <option value="1">Enero</option>
                    <option value="2">Febrero</option>
                    <option value="3">Marzo</option>
                    <option value="4">Abril</option>
                    <option value="5">Mayo</option>
                    <option value="6">Junio</option>
                    <option value="7">Julio</option>
                    <option value="8">Agosto</option>
                    <option value="9">Septiembre</option>
                    <option value="10">Octubre</option>
                    <option value="11">Noviembre</option>
                    <option value="12">Diciembre</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-400 text-xs">▼</span>
                </div>
            </div>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400">🗓️</span>
                </div>
                <input
                    type="text"
                    value={anioQuery}
                    onChange={(e) => setAnioQuery(e.target.value)}
                    placeholder="Año..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 bg-white font-medium text-sm transition-all shadow-sm"
                />
            </div>
        </div>
    )
}
