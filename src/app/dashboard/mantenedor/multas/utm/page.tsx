'use client'

import { useState, useEffect } from 'react'
import { getUtmRecords, syncUtmFromSii } from './actions'

const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

export default function UtmPage() {
    const [records, setRecords] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Filtros
    const currentYear = new Date().getFullYear()
    const [filterAnho, setFilterAnho] = useState<string>('')
    const [filterMes, setFilterMes] = useState<string>('')

    // Paginación
    const [currentPage, setCurrentPage] = useState(1)
    const PAGE_SIZE = 10
    const totalPages = Math.ceil(records.length / PAGE_SIZE)
    const paginatedRecords = records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

    const fetchData = async () => {
        setLoading(true)
        setError('')
        const res = await getUtmRecords(
            filterAnho ? parseInt(filterAnho) : undefined,
            filterMes ? parseInt(filterMes) : undefined
        )
        if (res.error) {
            setError(res.error)
        } else if (res.records) {
            setRecords(res.records)
            setCurrentPage(1) // Reset a la primera página al buscar
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [filterAnho, filterMes])

    const handleSync = async () => {
        setSyncing(true)
        setError('')
        setSuccess('')
        
        try {
            // Sincronizar dinámicamente desde 2024 hasta el año actual
            const startYear = 2024
            const yearsToSync = []
            for (let y = startYear; y <= currentYear; y++) {
                yearsToSync.push(y)
            }
            
            let totalSynced = 0
            
            for (const year of yearsToSync) {
                const res = await syncUtmFromSii(year)
                if (res.error) {
                    console.warn(`Error syncing year ${year}:`, res.error)
                } else {
                    totalSynced += res.count || 0
                }
            }
            
            setSuccess(`Sincronización completada. Se actualizaron los registros de ${yearsToSync.join(', ')}.`)
            fetchData()
        } catch (e) {
            setError('Error durante la sincronización masiva.')
        } finally {
            setSyncing(false)
        }
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0
        }).format(value)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>💰</span> Mantenedor UTM
                    </h2>
                    <p className="text-gray-500 mt-1">Gestión de valores mensuales extraídos del SII</p>
                </div>

                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-sky-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-200 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {syncing ? (
                        <>
                            <span className="animate-spin text-lg">⏳</span>
                            Sincronizando...
                        </>
                    ) : (
                        <>
                            <span className="text-lg">🔄</span>
                            Sincronizar con SII
                        </>
                    )}
                </button>
            </div>

            {/* Filtros */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Año</label>
                    <select
                        value={filterAnho}
                        onChange={(e) => setFilterAnho(e.target.value)}
                        className="w-full sm:w-40 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none text-sm font-medium"
                    >
                        <option value="">Todos los años</option>
                        {Array.from({ length: currentYear - 2023 + 1 }, (_, i) => 2024 + i).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Mes</label>
                    <select
                        value={filterMes}
                        onChange={(e) => setFilterMes(e.target.value)}
                        className="w-full sm:w-48 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none text-sm font-medium"
                    >
                        <option value="">Todos los meses</option>
                        {MONTH_NAMES.map((m, i) => (
                            <option key={i + 1} value={i + 1}>{m}</option>
                        ))}
                    </select>
                </div>

                <button 
                    onClick={() => { setFilterAnho(''); setFilterMes(''); }}
                    className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                    Limpiar Filtros
                </button>
            </div>

            {/* Mensajes */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-3 animate-in fade-in">
                    <span>⚠️</span> {error}
                </div>
            )}
            {success && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-center gap-3 animate-in fade-in">
                    <span>✅</span> {success}
                </div>
            )}

            {/* Tabla */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Año</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Mes</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Monto UTM</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">
                                        Cargando información...
                                    </td>
                                </tr>
                            ) : paginatedRecords.length > 0 ? (
                                paginatedRecords.map((r) => (
                                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-gray-900">{r.anho}</td>
                                        <td className="px-6 py-4 text-gray-600 font-medium">{MONTH_NAMES[r.mes - 1]}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-cyan-600 font-black text-lg">{formatCurrency(r.monto)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                Sincronizado
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-4xl opacity-50">📁</span>
                                            <p className="text-gray-500 font-medium">No hay registros cargados para los filtros seleccionados.</p>
                                            <p className="text-xs text-gray-400">Presiona el botón de sincronización para obtener datos del SII.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación */}
                {records.length > PAGE_SIZE && (
                    <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-sm text-gray-500 font-medium">
                            Mostrando <span className="text-gray-900 font-bold">{Math.min(records.length, (currentPage - 1) * PAGE_SIZE + 1)}</span> a <span className="text-gray-900 font-bold">{Math.min(records.length, currentPage * PAGE_SIZE)}</span> de <span className="text-gray-900 font-bold">{records.length}</span> registros
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-all shadow-sm"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-all shadow-sm"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
