'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useDebounce } from '@/hooks/use-debounce'

export default function PreparacionesSearch({ 
    initialNombre, 
    initialLicitacion 
}: { 
    initialNombre: string, 
    initialLicitacion: string 
}) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [nombre, setNombre] = useState(initialNombre)
    const [licitacion, setLicitacion] = useState(initialLicitacion)

    const debouncedNombre = useDebounce(nombre, 400)
    const debouncedLicitacion = useDebounce(licitacion, 400)

    const createQueryString = useCallback(
        (params: Record<string, string | null>, resetPage: boolean = false) => {
            const newSearchParams = new URLSearchParams(searchParams.toString())
            
            for (const [key, value] of Object.entries(params)) {
                if (value === null || value === '') {
                    newSearchParams.delete(key)
                } else {
                    newSearchParams.set(key, value)
                }
            }
            
            if (resetPage) {
                newSearchParams.set('page', '1')
            }
            
            return newSearchParams.toString()
        },
        [searchParams]
    )

    const prevSearchRef = useRef({ debouncedNombre, debouncedLicitacion })

    useEffect(() => {
        const searchChanged = 
            prevSearchRef.current.debouncedNombre !== debouncedNombre ||
            prevSearchRef.current.debouncedLicitacion !== debouncedLicitacion

        const query = createQueryString({
            nombre: debouncedNombre,
            codigo: debouncedLicitacion
        }, searchChanged)

        prevSearchRef.current = { debouncedNombre, debouncedLicitacion }
        router.push(`${pathname}?${query}`, { scroll: false })
    }, [debouncedNombre, debouncedLicitacion, pathname, router, createQueryString])

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Nombre de Preparación (Inteligente)</label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    <input
                        type="text"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Escribe para buscar... (ej: cazue)"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-bold placeholder:text-gray-300 transition-all shadow-inner"
                    />
                </div>
                {nombre && (
                    <button 
                        onClick={() => setNombre('')}
                        className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 font-bold bg-gray-200 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                    >
                        ✕
                    </button>
                )}
            </div>

            <div className="flex-1 relative">
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Licitación / Código</label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">📑</span>
                    <input
                        type="text"
                        value={licitacion}
                        onChange={(e) => setLicitacion(e.target.value)}
                        placeholder="Filtrar por código..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-bold placeholder:text-gray-300 transition-all shadow-inner"
                    />
                </div>
                {licitacion && (
                    <button 
                        onClick={() => setLicitacion('')}
                        className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 font-bold bg-gray-200 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                    >
                        ✕
                    </button>
                )}
            </div>

            <div className="flex items-end">
                <button 
                    onClick={() => { setNombre(''); setLicitacion(''); }}
                    className="px-6 py-3 rounded-xl text-slate-500 bg-slate-50 hover:bg-slate-100 font-black text-xs uppercase tracking-wider transition-all border border-slate-100 flex items-center gap-2"
                >
                    🧹 Limpiar
                </button>
            </div>
        </div>
    )
}
