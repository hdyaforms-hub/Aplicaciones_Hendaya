'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useDebounce } from '@/hooks/use-debounce'

const MESES = [
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
]

export default function MinutasSearch({ 
    initialNumero, 
    initialLicitacion,
    initialMes,
    initialAnio,
    initialPrograma
}: { 
    initialNumero: string, 
    initialLicitacion: string,
    initialMes: string,
    initialAnio: string,
    initialPrograma: string
}) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [numero, setNumero] = useState(initialNumero)
    const [licitacion, setLicitacion] = useState(initialLicitacion)
    const [mes, setMes] = useState(initialMes)
    const [anio, setAnio] = useState(initialAnio)
    const [programa, setPrograma] = useState(initialPrograma)

    const debouncedNumero = useDebounce(numero, 400)
    const debouncedLicitacion = useDebounce(licitacion, 400)
    const debouncedPrograma = useDebounce(programa, 400)

    const createQueryString = useCallback(
        (params: Record<string, string | null>) => {
            const newSearchParams = new URLSearchParams(searchParams.toString())
            
            for (const [key, value] of Object.entries(params)) {
                if (value === null || value === '') {
                    newSearchParams.delete(key)
                } else {
                    newSearchParams.set(key, value)
                }
            }
            
            newSearchParams.set('page', '1')
            
            return newSearchParams.toString()
        },
        [searchParams]
    )

    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString())
        const currentNumero = params.get('numero') || ''
        const currentCodigo = params.get('codigo') || ''
        const currentMes = params.get('mes') || ''
        const currentAnio = params.get('anio') || ''
        const currentPrograma = params.get('programa') || ''

        // Solo navegar si los filtros realmente han cambiado
        if (
            debouncedNumero !== currentNumero ||
            debouncedLicitacion !== currentCodigo ||
            mes !== currentMes ||
            anio !== currentAnio ||
            debouncedPrograma !== currentPrograma
        ) {
            const query = createQueryString({
                numero: debouncedNumero,
                codigo: debouncedLicitacion,
                mes: mes,
                anio: anio,
                programa: debouncedPrograma
            })
            router.push(`${pathname}?${query}`, { scroll: false })
        }
    }, [debouncedNumero, debouncedLicitacion, mes, anio, debouncedPrograma, pathname, router, createQueryString, searchParams])

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="relative">
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">N° de Minuta</label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                    <input
                        type="text"
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                        placeholder="Buscar..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900 font-bold transition-all shadow-inner text-sm"
                    />
                </div>
            </div>

            <div className="relative">
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Licitación</label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs">📑</span>
                    <input
                        type="text"
                        value={licitacion}
                        onChange={(e) => setLicitacion(e.target.value)}
                        placeholder="Código..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900 font-bold transition-all shadow-inner text-sm"
                    />
                </div>
            </div>

            <div className="relative">
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Programa</label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🏷️</span>
                    <input
                        type="text"
                        value={programa}
                        onChange={(e) => setPrograma(e.target.value)}
                        placeholder="Nombre prog..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900 font-bold transition-all shadow-inner text-sm"
                    />
                </div>
            </div>

            <div className="relative">
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Mes</label>
                <select
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900 font-bold transition-all shadow-inner text-sm appearance-none"
                >
                    <option value="">Todos</option>
                    {MESES.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                </select>
            </div>

            <div className="relative">
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Año</label>
                <input
                    type="number"
                    value={anio}
                    onChange={(e) => setAnio(e.target.value)}
                    placeholder="Ej: 2024"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900 font-bold transition-all shadow-inner text-sm"
                />
            </div>

            <div className="flex items-end">
                <button 
                    onClick={() => { setNumero(''); setLicitacion(''); setMes(''); setAnio(''); setPrograma(''); }}
                    className="w-full px-6 py-2.5 rounded-xl text-slate-500 bg-slate-50 hover:bg-slate-100 font-black text-xs uppercase tracking-wider transition-all border border-slate-100 shadow-sm"
                >
                    🧹 Limpiar
                </button>
            </div>
        </div>
    )
}
