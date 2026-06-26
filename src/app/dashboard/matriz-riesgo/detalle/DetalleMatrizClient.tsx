'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getUtsPorLicitacion, searchColegios, getRespuestasPaginadas, deleteRespuesta, getAllRespuestasExport } from './actions'

type Licitacion = {
    licId: number
    licitacionHomologada: string | null
}

export default function DetalleMatrizClient({ licitaciones, isAdmin }: { licitaciones: Licitacion[], isAdmin: boolean }) {
    const [licId, setLicId] = useState<string>('')
    const [uts, setUts] = useState<any[]>([])
    const [utId, setUtId] = useState<string>('')
    
    // Autocomplete
    const [searchTerm, setSearchTerm] = useState('')
    const [colegiosResults, setColegiosResults] = useState<any[]>([])
    const [showDropdown, setShowDropdown] = useState(false)
    const [selectedRbd, setSelectedRbd] = useState<number | null>(null)
    const [globalError, setGlobalError] = useState<string | null>(null)

    const router = useRouter()
    const searchParams = useSearchParams()
    
    const currentYear = new Date().getFullYear()
    const selectedYear = searchParams.get('year') ? parseInt(searchParams.get('year')!) : currentYear
    const availableYears = Array.from({ length: Math.max(5, currentYear + 5 - 2024 + 1) }, (_, i) => 2024 + i)

    // Table Data
    const [respuestas, setRespuestas] = useState<any[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(false)
    const [page, setPage] = useState(1)
    const limit = 10

    const [sortField, setSortField] = useState('fechaIngreso')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

    const loadData = async () => {
        setLoading(true)
        setGlobalError(null)
        const filters = {
            licId: licId ? Number(licId) : undefined,
            ut: utId ? Number(utId) : undefined,
            rbd: selectedRbd || undefined
        }
        const sort = { field: sortField, order: sortOrder }
        
        const res = await getRespuestasPaginadas(page, limit, filters, sort, selectedYear)
        if (res.error) {
            setGlobalError(res.error)
            setRespuestas([])
            setTotal(0)
        } else if (res.respuestas) {
            setRespuestas(res.respuestas)
            setTotal(res.total || 0)
        }
        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [page, sortField, sortOrder, licId, utId, selectedRbd, selectedYear])

    // Load UTs when Licitacion changes
    useEffect(() => {
        setUtId('')
        setSelectedRbd(null)
        setSearchTerm('')
        if (licId) {
            getUtsPorLicitacion(Number(licId)).then(res => {
                if (res.uts) setUts(res.uts)
            })
        } else {
            setUts([])
        }
    }, [licId])

    // Custom debounce since lodash might not be installed
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null)
    const handleSearch = useCallback(
        async (query: string) => {
            if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
            debounceTimeout.current = setTimeout(async () => {
                if (query.length >= 3) {
                    const res = await searchColegios(query)
                    if (res.colegios) {
                        setColegiosResults(res.colegios)
                        setShowDropdown(true)
                    }
                } else {
                    setColegiosResults([])
                    setShowDropdown(false)
                }
            }, 300)
        },
        []
    )

    const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setSearchTerm(val)
        if (val === '') setSelectedRbd(null)
        handleSearch(val)
    }

    const selectColegio = (col: any) => {
        setSearchTerm(`${col.colRBD} - ${col.nombreEstablecimiento}`)
        setSelectedRbd(col.colRBD)
        setShowDropdown(false)
        setPage(1)
    }

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
        setPage(1)
    }

    const SortIcon = ({ field }: { field: string }) => {
        if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>
        return <span className="text-cyan-500 ml-1 font-bold">{sortOrder === 'asc' ? '↑' : '↓'}</span>
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que desea eliminar esta respuesta?')) return
        const res = await deleteRespuesta(id)
        if (res.success) {
            alert('Respuesta eliminada correctamente.')
            loadData()
        } else {
            alert(res.error || 'Error al eliminar.')
        }
    }

    const handleExport = async () => {
        setLoading(true)
        const res = await getAllRespuestasExport(selectedYear)
        setLoading(false)
        if (res.error) {
            alert(res.error)
            return
        }
        if (res.data) {
            // Simple CSV Export
            const headers = Object.keys(res.data[0]).join(';')
            const rows = res.data.map((row: any) => Object.values(row).map(v => `"${v}"`).join(';'))
            const csv = [headers, ...rows].join('\n')
            
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `Detalle_Matriz_${new Date().toISOString().split('T')[0]}.csv`
            a.click()
            URL.revokeObjectURL(url)
        }
    }

    const totalPages = Math.ceil(total / limit)

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-col md:flex-row gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-800">Detalle Matriz</h1>
                    <p className="text-sm text-slate-500 mt-1">Consulta y gestión de respuestas a matrices de riesgo.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <p className="text-xs font-bold text-slate-500 uppercase">Año:</p>
                        <select 
                            value={selectedYear}
                            onChange={(e) => router.push(`?year=${e.target.value}`)}
                            className="p-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-cyan-500 font-medium outline-none text-sm"
                        >
                            {availableYears.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={handleExport}
                            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-500/20 hover:shadow-lg transition-all"
                        >
                            ⬇️ Exportar Datos
                        </button>
                    )}
                </div>
            </div>

            {globalError && (
                <div className="p-8 bg-red-50 text-red-700 rounded-3xl border border-red-100 font-bold text-center">
                    {globalError}
                </div>
            )}

            {!globalError && (
            <>
            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <span>🔍</span> Filtros de Búsqueda
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Licitación</label>
                        <select 
                            className="w-full p-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-cyan-500"
                            value={licId} 
                            onChange={e => { setLicId(e.target.value); setPage(1) }}
                        >
                            <option value="">Todas</option>
                            {licitaciones.map(l => (
                                <option key={l.licId} value={l.licId}>{l.licId} - {l.licitacionHomologada}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">UT</label>
                        <select 
                            className="w-full p-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                            value={utId} 
                            onChange={e => { setUtId(e.target.value); setPage(1) }}
                            disabled={!licId}
                        >
                            <option value="">Todas</option>
                            {uts.map(u => (
                                <option key={u.codUT} value={u.codUT}>{u.codUT}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Establecimiento (RBD/Nombre)</label>
                        <input
                            type="text"
                            placeholder="Mín. 3 caracteres..."
                            value={searchTerm}
                            onChange={onSearchChange}
                            onFocus={() => { if (colegiosResults.length > 0) setShowDropdown(true) }}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                            className="w-full p-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                        {showDropdown && (
                            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl mt-1 max-h-60 overflow-y-auto shadow-lg">
                                {colegiosResults.length === 0 ? (
                                    <li className="p-3 text-sm text-gray-500">No se encontraron resultados</li>
                                ) : (
                                    colegiosResults.map((col) => (
                                        <li
                                            key={col.colRBD}
                                            onClick={() => selectColegio(col)}
                                            className="p-3 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 border-b border-gray-100 last:border-0"
                                        >
                                            <span className="font-bold text-cyan-600 mr-2">{col.colRBD}</span>
                                            {col.nombreEstablecimiento}
                                        </li>
                                    ))
                                )}
                            </ul>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-gray-200 text-slate-500 font-bold uppercase tracking-wider text-xs">
                            <tr>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('id')}>
                                    ID <SortIcon field="id" />
                                </th>
                                <th className="px-6 py-4">Matriz</th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('licId')}>
                                    Lic <SortIcon field="licId" />
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('ut')}>
                                    UT <SortIcon field="ut" />
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('rbd')}>
                                    RBD <SortIcon field="rbd" />
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('establecimiento')}>
                                    Establecimiento <SortIcon field="establecimiento" />
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('fechaIngreso')}>
                                    Fecha <SortIcon field="fechaIngreso" />
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('supervisorNombre')}>
                                    Supervisor <SortIcon field="supervisorNombre" />
                                </th>
                                <th className="px-6 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500 font-medium">Cargando datos...</td>
                                </tr>
                            ) : respuestas.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500 font-medium">No se encontraron respuestas.</td>
                                </tr>
                            ) : (
                                respuestas.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-4 text-xs font-mono text-slate-400" title={r.id}>
                                            {r.id.substring(0, 8)}...
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-700">
                                            {r.cabecera?.titulo} <span className="text-xs text-slate-400 font-normal ml-1">({r.cabecera?.anio})</span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">{r.licId}</td>
                                        <td className="px-6 py-4 text-slate-600">{r.ut}</td>
                                        <td className="px-6 py-4 font-bold text-cyan-600">{r.rbd}</td>
                                        <td className="px-6 py-4 text-slate-700 truncate max-w-xs">{r.establecimiento}</td>
                                        <td className="px-6 py-4 text-slate-500 text-xs">
                                            {new Date(r.fechaIngreso).toLocaleDateString()}
                                        </td>
                                         <td className="px-6 py-4 text-slate-600 max-w-[180px]" title={r.supervisorNombre}>
                                             <div className="font-semibold text-slate-700 truncate">{r.supervisorNombre}</div>
                                             {r.supervisorNombreOriginal && (
                                                 <div className="text-[10px] text-slate-400 italic leading-tight truncate" title={`Creado originalmente por: ${r.supervisorNombreOriginal}`}>
                                                     Orig: {r.supervisorNombreOriginal}
                                                 </div>
                                             )}
                                         </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <Link 
                                                    href={`/dashboard/matriz-riesgo/detalle/${r.id}?mode=view`}
                                                    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors inline-block" title="Ver detalle">
                                                    👁️
                                                </Link>
                                                {isAdmin && (
                                                    <>
                                                        <Link 
                                                            href={`/dashboard/matriz-riesgo/detalle/${r.id}?mode=edit`}
                                                            className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors inline-block" title="Modificar">
                                                            ✏️
                                                        </Link>
                                                        <button 
                                                            onClick={() => handleDelete(r.id)}
                                                            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Eliminar">
                                                            🗑️
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-100 bg-slate-50/50 flex items-center justify-between">
                        <span className="text-sm text-slate-500 font-medium">
                            Página <span className="font-bold text-slate-700">{page}</span> de <span className="font-bold text-slate-700">{totalPages}</span>
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-slate-600 disabled:opacity-50 hover:bg-slate-50"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-slate-600 disabled:opacity-50 hover:bg-slate-50"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>
            </>
            )}
        </div>
    )
}
