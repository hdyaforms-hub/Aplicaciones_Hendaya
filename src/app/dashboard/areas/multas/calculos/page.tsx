'use client'

import { useState, useEffect } from 'react'
import { getFoliosIncompletos, calculateAll, getSchoolSuggestions } from './actions'
import CalculoModal from './CalculoModal'

export default function CalculosEEPage() {
    const [registros, setRegistros] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [mes, setMes] = useState('Todos los meses')
    const [ano, setAno] = useState('2024')
    const [licitacion, setLicitacion] = useState('')
    const [folio, setFolio] = useState('')
    const [estadoCalculo, setEstadoCalculo] = useState('Todos')
    const [disponibilidad, setDisponibilidad] = useState('Todos')
    const [loading, setLoading] = useState(true)
    const [calculatingAll, setCalculatingAll] = useState(false)
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // Modal state
    const [selectedFolio, setSelectedFolio] = useState<string | null>(null)

    const fetchRegistros = async () => {
        setLoading(true)
        try {
            const res = await getFoliosIncompletos({
                search, mes, ano, licitacion, folio, estadoCalculo, disponibilidad
            })
            if (res.data) {
                setRegistros(res.data)
                setCurrentPage(1) // Reset to first page when data changes
            }
        } catch (e) {
            console.error('Error fetching data', e)
        }
        setLoading(false)
    }

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchRegistros()
        }, 500)
        return () => clearTimeout(timeoutId)
    }, [search, mes, ano, licitacion, folio, estadoCalculo, disponibilidad])

    const handleCalculateAll = async () => {
        if (!confirm('¿Estás seguro de calcular todos los folios filtrados? Esto puede tardar un momento.')) return
        setCalculatingAll(true)
        const res = await calculateAll({ search, mes, ano, licitacion, folio, estadoCalculo, disponibilidad })
        if (res.error) {
            alert(res.error)
        } else {
            alert(`Cálculo masivo completado: ${res.count} folios procesados.`)
            fetchRegistros()
        }
        setCalculatingAll(false)
    }

    const totalCalculado = registros.reduce((acc, curr) => acc + (curr.montoCalculado || 0), 0)

    // Detailed breakdown by year
    const breakdown = registros.reduce((acc: any, curr) => {
        const date = curr.fechaSupervision ? new Date(curr.fechaSupervision) : null
        const year = date ? date.getFullYear() : 'S/F'
        if (!acc[year]) acc[year] = { total: 0, hasIssues: false }
        acc[year].total += (curr.montoCalculado || 0)
        if (curr.missingFormula || curr.missingPmpa) acc[year].hasIssues = true
        return acc
    }, {})

    const years = Object.keys(breakdown).sort((a, b) => b.localeCompare(a))

    // Pagination logic
    const totalPages = Math.ceil(registros.length / itemsPerPage)
    const paginatedRegistros = registros.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>🧮</span> Cálculos de Elementos Esenciales
                    </h2>
                    <p className="text-gray-500 mt-1">Calcula multas en base a elementos con estado No Conforme (NC = X).</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleCalculateAll}
                        disabled={loading || calculatingAll || registros.length === 0}
                        className="px-5 py-2.5 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {calculatingAll ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Calculando...</>
                        ) : (
                            <>🚀 Calcular Todo (Masivo)</>
                        )}
                    </button>
                <div className="flex flex-wrap items-center gap-4">
                    {years.map(y => (
                        <div key={y} className={`px-4 py-2 rounded-2xl border shadow-sm flex flex-col ${breakdown[y].hasIssues ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                            <div className="flex items-center justify-between gap-3">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${breakdown[y].hasIssues ? 'text-amber-600' : 'text-emerald-600'}`}>Año {y}</span>
                                <span>{breakdown[y].hasIssues ? '⚠️' : '✅'}</span>
                            </div>
                            <span className={`text-lg font-black ${breakdown[y].hasIssues ? 'text-amber-700' : 'text-emerald-700'}`}>
                                ${breakdown[y].total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    ))}
                    <div className="bg-slate-900 px-6 py-3 rounded-2xl shadow-xl">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total General</p>
                        <p className="text-2xl font-black text-white">${totalCalculado.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-11 gap-4">
                    <div className="lg:col-span-3 relative">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">RBD/Establecimiento</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar por RBD o Nombre..."
                                value={search}
                                onChange={async (e) => {
                                    const val = e.target.value
                                    setSearch(val)
                                    if (val.length >= 2) {
                                        const res = await getSchoolSuggestions(val)
                                        if (res.data) {
                                            setSuggestions(res.data)
                                            setShowSuggestions(true)
                                        }
                                    } else {
                                        setSuggestions([])
                                        setShowSuggestions(false)
                                    }
                                }}
                                onFocus={() => search.length >= 2 && setShowSuggestions(true)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-medium"
                            />
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                    {suggestions.map((s, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setSearch(s.colRBD.toString())
                                                setShowSuggestions(false)
                                            }}
                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-gray-50 last:border-0 transition-colors"
                                        >
                                            <p className="text-xs font-black text-gray-900 uppercase leading-tight">{s.nombreEstablecimiento}</p>
                                            <p className="text-[10px] font-bold text-cyan-600 mt-0.5">RBD: {s.colRBD}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {showSuggestions && (
                                <div className="fixed inset-0 z-40" onClick={() => setShowSuggestions(false)}></div>
                            )}
                        </div>
                    </div>
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Licitación</label>
                        <input
                            type="text"
                            placeholder="Ej: J52"
                            value={licitacion}
                            onChange={(e) => setLicitacion(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-medium"
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Mes</label>
                        <select
                            value={mes}
                            onChange={(e) => setMes(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-bold"
                        >
                            <option>Todos los meses</option>
                            <option>Enero</option>
                            <option>Febrero</option>
                            <option>Marzo</option>
                            <option>Abril</option>
                            <option>Mayo</option>
                            <option>Junio</option>
                            <option>Julio</option>
                            <option>Agosto</option>
                            <option>Septiembre</option>
                            <option>Octubre</option>
                            <option>Noviembre</option>
                            <option>Diciembre</option>
                        </select>
                    </div>
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Folio</label>
                        <input
                            type="text"
                            placeholder="Ej: F-123"
                            value={folio}
                            onChange={(e) => setFolio(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-medium"
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Año</label>
                        <input
                            type="text"
                            placeholder="2024"
                            value={ano}
                            onChange={(e) => setAno(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-medium text-center"
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Estado Cálculo</label>
                        <select
                            value={estadoCalculo}
                            onChange={(e) => setEstadoCalculo(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-bold"
                        >
                            <option value="Todos">Todos</option>
                            <option value="PENDIENTE">PENDIENTE</option>
                            <option value="CALCULADO">CALCULADO</option>
                            <option value="CALCULO_MASIVO">MASIVO</option>
                        </select>
                    </div>
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Disponibilidad</label>
                        <select
                            value={disponibilidad}
                            onChange={(e) => setDisponibilidad(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-bold"
                        >
                            <option value="Todos">Todos</option>
                            <option value="LISTO">LISTOS PARA CALCULAR</option>
                            <option value="FALTANTE">CON DATOS FALTANTES</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 font-black text-gray-400 uppercase tracking-widest text-xs">Licitación</th>
                                <th className="px-6 py-4 font-black text-gray-400 uppercase tracking-widest text-xs">Folio</th>
                                <th className="px-6 py-4 font-black text-gray-400 uppercase tracking-widest text-xs">Fecha</th>
                                <th className="px-6 py-4 font-black text-gray-400 uppercase tracking-widest text-xs">RBD</th>
                                <th className="px-6 py-4 font-black text-gray-400 uppercase tracking-widest text-xs">Establecimiento</th>
                                <th className="px-6 py-4 font-black text-gray-400 uppercase tracking-widest text-xs">Archivo</th>
                                <th className="px-6 py-4 font-black text-gray-400 uppercase tracking-widest text-xs">Estado Cálculo</th>
                                <th className="px-6 py-4 font-black text-gray-400 uppercase tracking-widest text-xs text-right">Monto</th>
                                <th className="px-6 py-4 font-black text-gray-400 uppercase tracking-widest text-xs text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-sm font-medium">Buscando folios NC...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedRegistros.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center text-gray-400 font-medium">No se encontraron folios con elementos no conformes.</td>
                                </tr>
                            ) : (
                                paginatedRegistros.map((reg, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 text-slate-700 font-medium">{reg.licitacion}</td>
                                        <td className="px-6 py-4 text-slate-800 font-bold">{reg.folio}</td>
                                        <td className="px-6 py-4 text-gray-500">{reg.fechaSupervision ? new Date(reg.fechaSupervision).toLocaleDateString() : '-'}</td>
                                        <td className="px-6 py-4 text-slate-800 font-bold">{reg.rbd}</td>
                                        <td className="px-6 py-4 text-gray-600 text-xs font-medium max-w-[200px] truncate" title={reg.nombreEstablecimiento}>
                                            {reg.nombreEstablecimiento}
                                        </td>
                                        <td className="px-6 py-4">
                                            {reg.link ? (
                                                <a href={reg.link} target="_blank" rel="noreferrer" className="text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1 transition-colors">
                                                    🔗 Ver PDF
                                                </a>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 items-start">
                                                {reg.calculoEstado === 'CALCULADO' && <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded border border-emerald-100">CALCULADO</span>}
                                                {reg.calculoEstado === 'CALCULO_MASIVO' && <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded border border-indigo-100">CÁLCULO MASIVO</span>}
                                                {reg.calculoEstado === 'PENDIENTE' && <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded border border-gray-200">PENDIENTE</span>}
                                                
                                                {reg.missingFormula && (
                                                    <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[9px] font-black rounded border border-red-100 flex items-center gap-1">
                                                        ⚠️ SIN FORMULA
                                                    </span>
                                                )}
                                                {reg.missingPmpa && (
                                                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-black rounded border border-amber-100 flex items-center gap-1">
                                                        ⚠️ SIN RACIONES
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-gray-800">
                                            ${(reg.montoCalculado || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => setSelectedFolio(reg.folio)}
                                                className="px-3 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors"
                                            >
                                                Calcular
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                        <div className="text-sm text-gray-500">
                            Mostrando <span className="font-bold text-gray-900">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-bold text-gray-900">{Math.min(currentPage * itemsPerPage, registros.length)}</span> de <span className="font-bold text-gray-900">{registros.length}</span> registros
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
                            >
                                ⬅️ Anterior
                            </button>
                            <div className="px-4 py-2 text-sm font-black text-slate-500 bg-slate-100 rounded-xl">
                                Página {currentPage} de {totalPages}
                            </div>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md shadow-slate-200 flex items-center gap-2"
                            >
                                Siguiente ➡️
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {selectedFolio && (
                <CalculoModal
                    folio={selectedFolio}
                    isOpen={!!selectedFolio}
                    onClose={() => setSelectedFolio(null)}
                    onCalculated={() => {
                        fetchRegistros()
                        setSelectedFolio(null)
                    }}
                />
            )}
        </div>
    )
}
