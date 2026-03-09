'use client'

import { useState } from 'react'
import { searchColegios } from './actions'

type ColegioResult = {
    id: string
    colut: number
    colRBD: number
    colRBDDV: string
    nombreEstablecimiento: string
    comuna: string
}

export default function ColegioSearchModal({
    isOpen,
    onClose,
    onSelect
}: {
    isOpen: boolean
    onClose: () => void
    onSelect: (colegio: ColegioResult) => void
}) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<ColegioResult[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    if (!isOpen) return null

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!query.trim()) return

        setLoading(true)
        setError('')
        setResults([])

        const res = await searchColegios(query)
        if (res.error) {
            setError(res.error)
        } else if (res.colegios) {
            setResults(res.colegios)
            if (res.colegios.length === 0) {
                setError('No se encontraron colegios con ese criterio de búsqueda.')
            }
        }
        setLoading(false)
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl relative animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                >
                    ✕
                </button>

                <h3 className="text-xl font-bold text-gray-900 mb-6 tracking-tight flex items-center gap-2 shrink-0">
                    🔍 Buscar Colegio
                </h3>

                <form onSubmit={handleSearch} className="flex gap-3 mb-6 shrink-0">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar por RBD o Nombre de Establecimiento..."
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="px-6 py-2.5 rounded-xl text-white bg-slate-800 hover:bg-slate-900 shadow-md font-medium transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Buscando...' : 'Buscar'}
                    </button>
                </form>

                {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 mb-4 shrink-0">{error}</div>}

                <div className="flex-1 overflow-y-auto min-h-0 border border-gray-100 rounded-xl">
                    {results.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {results.map((col) => (
                                <div
                                    key={col.id}
                                    className="p-4 hover:bg-cyan-50 cursor-pointer transition-colors flex items-center justify-between group"
                                    onClick={() => onSelect(col)}
                                >
                                    <div>
                                        <div className="font-bold text-gray-900 group-hover:text-cyan-700">
                                            RBD: {col.colRBD}-{col.colRBDDV}
                                        </div>
                                        <div className="text-sm font-medium text-gray-700 mt-1">
                                            {col.nombreEstablecimiento}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            Comuna: {col.comuna}
                                        </div>
                                    </div>
                                    <button className="px-4 py-2 bg-white border border-cyan-200 text-cyan-700 rounded-lg text-sm font-medium group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                                        Seleccionar
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        !loading && !error && (
                            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                                Ingresa un término de búsqueda para ver los resultados.
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    )
}
