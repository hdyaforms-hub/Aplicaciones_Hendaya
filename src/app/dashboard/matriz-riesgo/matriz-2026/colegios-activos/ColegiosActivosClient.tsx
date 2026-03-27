'use client'

import { useState } from 'react'
import { toggleColegioMatrizStatus } from '../../actions'
import { useRouter } from 'next/navigation'
import { saveMatrizSemesterConfig } from './actions'
import { format } from 'date-fns'

export default function ColegiosActivosClient({ initialColegios, initialSemesterConfig }: { initialColegios: any[], initialSemesterConfig: any }) {
    const [colegios, setColegios] = useState(initialColegios)
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)
    const [semesterDate, setSemesterDate] = useState(initialSemesterConfig?.fechaFin1 ? format(new Date(initialSemesterConfig.fechaFin1), 'yyyy-MM-dd') : '')
    const [savingDate, setSavingDate] = useState(false)
    const router = useRouter()

    const handleToggle = async (id: string, currentStatus: boolean) => {
        setLoadingId(id)
        const newStatus = !currentStatus
        const res = await toggleColegioMatrizStatus(id, newStatus)
        setLoadingId(null)

        if (res.success) {
            setColegios(prev => prev.map(c => c.id === id ? { ...c, isActive: newStatus } : c))
            router.refresh()
        } else {
            alert(res.error || "Error al actualizar estado")
        }
    }

    const handleSaveSemesterDate = async () => {
        if (!semesterDate) return
        setSavingDate(true)
        const res = await saveMatrizSemesterConfig({ anio: 2026, fechaFin1: semesterDate })
        setSavingDate(false)
        if (res.success) {
            router.refresh()
        } else {
            alert(res.error)
        }
    }

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc'
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    const filteredColegios = colegios.filter(c => 
        c.nombreEstablecimiento.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.colRBD.toString().includes(searchTerm)
    )

    const sortedColegios = [...filteredColegios].sort((a, b) => {
        if (!sortConfig) {
            // Orden por defecto: UT (asc) y luego RBD (asc)
            if (a.colut !== b.colut) return a.colut - b.colut
            return a.colRBD - b.colRBD
        }

        const { key, direction } = sortConfig
        let valA = a[key]
        let valB = b[key]

        // Manejo de nulos/undefined
        if (valA === null) valA = ''
        if (valB === null) valB = ''

        if (valA < valB) return direction === 'asc' ? -1 : 1
        if (valA > valB) return direction === 'asc' ? 1 : -1
        return 0
    })

    const SortIcon = ({ column }: { column: string }) => {
        if (sortConfig?.key !== column) return <span className="text-gray-300 ml-1">⇅</span>
        return <span className="text-cyan-600 ml-1">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <span>🏫</span> Colegios Activos para Matriz
                    </h2>
                    <p className="text-gray-500 mt-1">Habilite o deshabilite los colegios que participan en la Matriz de Riesgo 2026</p>
                    <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-cyan-50 p-4 rounded-2xl border border-cyan-100">
                        <div>
                            <p className="text-xs font-bold text-cyan-700 uppercase tracking-wider">Fecha término 1er Semestre (Matriz 2026)</p>
                            <div className="flex items-center gap-2 mt-1">
                                <input 
                                    type="date"
                                    className="bg-white border border-cyan-200 rounded-lg p-2 text-sm text-black font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                                    value={semesterDate}
                                    onChange={(e) => setSemesterDate(e.target.value)}
                                />
                                <button 
                                    onClick={handleSaveSemesterDate}
                                    disabled={savingDate || !semesterDate}
                                    className="bg-cyan-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-cyan-700 transition-colors disabled:opacity-50"
                                >
                                    {savingDate ? '...' : 'Actualizar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="w-full sm:w-64">
                    <input 
                        type="text"
                        placeholder="Buscar por RBD o nombre..."
                        className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-black font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-600 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => requestSort('isActive')}>
                                    Estado <SortIcon column="isActive" />
                                </th>
                                <th className="px-6 py-4 font-semibold cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => requestSort('colRBD')}>
                                    RBD <SortIcon column="colRBD" />
                                </th>
                                <th className="px-6 py-4 font-semibold cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => requestSort('nombreEstablecimiento')}>
                                    Nombre Establecimiento <SortIcon column="nombreEstablecimiento" />
                                </th>
                                <th className="px-6 py-4 font-semibold cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => requestSort('institucion')}>
                                    Institución <SortIcon column="institucion" />
                                </th>
                                <th className="px-6 py-4 font-semibold cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => requestSort('sucursal')}>
                                    Sucursal <SortIcon column="sucursal" />
                                </th>
                                <th className="px-6 py-4 font-semibold cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => requestSort('colut')}>
                                    UT <SortIcon column="colut" />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {sortedColegios.map((col) => (
                                <tr key={col.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggle(col.id, col.isActive)}
                                            disabled={loadingId === col.id}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${col.isActive ? 'bg-cyan-600' : 'bg-gray-200'}`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${col.isActive ? 'translate-x-6' : 'translate-x-1'}`}
                                            />
                                        </button>
                                        <span className={`ml-3 text-xs font-bold ${col.isActive ? 'text-cyan-700' : 'text-gray-400'}`}>
                                            {col.isActive ? 'ACTIVO' : 'INACTIVO'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-900">{col.colRBD}</td>
                                    <td className="px-6 py-4 font-medium text-slate-700">{col.nombreEstablecimiento}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                            {col.institucion}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">{col.sucursal}</td>
                                    <td className="px-6 py-4 font-bold text-gray-600">{col.colut}</td>
                                </tr>
                            ))}
                            {sortedColegios.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                        No se encontraron colegios.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
