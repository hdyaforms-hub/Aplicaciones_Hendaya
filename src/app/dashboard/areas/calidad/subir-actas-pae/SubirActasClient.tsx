'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { getPaeRecords, deletePaeRecord, getSchoolDetailsByRBD, createManualPaeRecord } from './actions'
import { Prisma } from '@/generated/client'
import * as XLSX from 'xlsx'

type PaeRecord = Prisma.Cab_LeePdfEstandarPaeGetPayload<{
    include: { detalles: true }
}>

export default function SubirActasClient() {
    const [records, setRecords] = useState<PaeRecord[]>([])
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [averageCompliance, setAverageCompliance] = useState<number | null>(null)
    const [utCounts, setUtCounts] = useState<Record<string, number>>({})
    
    // Filters
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [licitacion, setLicitacion] = useState<number | null>(null)
    const [mes, setMes] = useState<number | null>(null)
    const [anio, setAnio] = useState<number | null>(new Date().getFullYear())
    const [orderBy, setOrderBy] = useState('Fecha_Supervision')
    const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc')

    const [isLoading, setIsLoading] = useState(true)

    // Upload Modal State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [filesToUpload, setFilesToUpload] = useState<File[]>([])
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<{ processed: number, total: number }>({ processed: 0, total: 0 })
    const [uploadErrors, setUploadErrors] = useState<{ filename: string, error: string, folio?: string }[]>([])

    // Manual Entry Modal State
    const [isManualModalOpen, setIsManualModalOpen] = useState(false)
    const [manualForm, setManualForm] = useState({
        RBD: '',
        Nombre_Num_establecimiento: '',
        Comuna: '',
        Licitacion: '',
        Folio: '',
        Fecha_Supervision: '',
        Porcentaje_cumplimiento_final: '',
        Observaciones: ''
    })
    const [isSubmittingManual, setIsSubmittingManual] = useState(false)
    const [manualError, setManualError] = useState('')
    
    // Details Modal
    const [selectedRecord, setSelectedRecord] = useState<PaeRecord | null>(null)

    const fetchRecords = useCallback(async () => {
        setIsLoading(true)
        try {
            const result = await getPaeRecords({
                page,
                pageSize: 10,
                search,
                licitacion,
                mes,
                anio,
                orderBy,
                orderDir
            })
            setRecords(result.data)
            setTotal(result.total)
            setTotalPages(result.totalPages)
            setAverageCompliance(result.averageCompliance)
            setUtCounts(result.utCounts || {})
        } catch (error) {
            console.error('Error fetching records', error)
        } finally {
            setIsLoading(false)
        }
    }, [page, search, licitacion, mes, anio, orderBy, orderDir])

    useEffect(() => {
        fetchRecords()
    }, [fetchRecords])

    const handleSort = (column: string) => {
        if (orderBy === column) {
            setOrderDir(orderDir === 'asc' ? 'desc' : 'asc')
        } else {
            setOrderBy(column)
            setOrderDir('asc')
        }
    }

    const handleFileUpload = async (overrideFolio?: string) => {
        if (filesToUpload.length === 0 && !overrideFolio) return
        
        setUploading(true)
        setUploadErrors([])
        
        let files = filesToUpload
        
        if (overrideFolio) {
            // Find the file associated with the duplicate folio (assuming we kept it or it's single file)
            // Simplified logic: retry all remaining files with override=true. 
            // In a real scenario, we might want to override only the specific one.
        }

        setUploadProgress({ processed: 0, total: files.length })

        const formData = new FormData()
        files.forEach(f => formData.append('files', f))
        if (overrideFolio) formData.append('override', 'true')

        try {
            const res = await fetch('/api/areas/calidad/subir-actas-pae', {
                method: 'POST',
                body: formData
            })
            const data = await res.json()

            if (data.success) {
                const errors = data.results.filter((r: any) => !r.success)
                if (errors.length > 0) {
                    setUploadErrors(errors)
                    // Remove successful files from queue
                    const successfulFilenames = data.results.filter((r:any) => r.success).map((r:any)=>r.filename)
                    setFilesToUpload(prev => prev.filter(f => !successfulFilenames.includes(f.name)))
                } else {
                    setIsUploadModalOpen(false)
                    setFilesToUpload([])
                }
                fetchRecords()
            } else {
                setUploadErrors([{ filename: 'General', error: data.error }])
            }
        } catch (e: any) {
            setUploadErrors([{ filename: 'Red', error: e.message }])
        } finally {
            setUploading(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFilesToUpload(Array.from(e.target.files))
            setUploadErrors([])
        }
    }

    const handleRbdChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setManualForm(prev => ({ ...prev, RBD: val }));
        
        if (val && !isNaN(Number(val))) {
            const res = await getSchoolDetailsByRBD(Number(val));
            if (res.success && res.data) {
                setManualForm(prev => ({
                    ...prev,
                    Nombre_Num_establecimiento: res.data.nombreEstablecimiento || '',
                    Comuna: res.data.comuna || '',
                    Licitacion: res.data.licitacion ? res.data.licitacion.toString() : prev.Licitacion
                }));
            }
        }
    }

    const handleManualSubmit = async () => {
        setIsSubmittingManual(true);
        setManualError('');
        try {
            const res = await createManualPaeRecord(manualForm);
            if (res.success) {
                setIsManualModalOpen(false);
                fetchRecords();
                setManualForm({
                    RBD: '',
                    Nombre_Num_establecimiento: '',
                    Comuna: '',
                    Licitacion: '',
                    Folio: '',
                    Fecha_Supervision: '',
                    Porcentaje_cumplimiento_final: '',
                    Observaciones: ''
                });
            } else {
                setManualError(res.error || 'Error al guardar el registro manual');
            }
        } catch (error: any) {
            setManualError(error.message);
        } finally {
            setIsSubmittingManual(false);
        }
    }

    const exportToExcel = () => {
        const data = records.map(r => ({
            Folio: r.Folio,
            Licitación: r.Licitacion,
            RBD: r.RBD,
            Establecimiento: r.Nombre_Num_establecimiento,
            Comuna: r.Comuna,
            Región: r.Region,
            Fecha_Supervisión: r.Fecha_Supervision ? new Date(r.Fecha_Supervision).toLocaleDateString('es-CL') : '',
            Cumplimiento: r.Porcentaje_cumplimiento_final ? `${r.Porcentaje_cumplimiento_final}%` : ''
        }))
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Actas")
        XLSX.writeFile(wb, "Actas_Estandar_PAE.xlsx")
    }

    const currentMonths = [
        { val: 1, label: 'Enero' }, { val: 2, label: 'Febrero' }, { val: 3, label: 'Marzo' },
        { val: 4, label: 'Abril' }, { val: 5, label: 'Mayo' }, { val: 6, label: 'Junio' },
        { val: 7, label: 'Julio' }, { val: 8, label: 'Agosto' }, { val: 9, label: 'Septiembre' },
        { val: 10, label: 'Octubre' }, { val: 11, label: 'Noviembre' }, { val: 12, label: 'Diciembre' }
    ]

    const SortIcon = ({ column }: { column: string }) => {
        const isActive = orderBy === column
        return (
            <span className={`inline-flex items-center ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-black transition-all ${
                isActive 
                    ? 'bg-cyan-100 text-cyan-800 border border-cyan-300 shadow-2xs' 
                    : 'text-slate-300 group-hover:text-slate-600 opacity-60 group-hover:opacity-100'
            }`}>
                {isActive ? (orderDir === 'asc' ? '▲ Asc' : '▼ Desc') : '↕'}
            </span>
        )
    }

    // Single card stats logic (if one RBD is heavily filtered)
    const singleRecord = records.length === 1 ? records[0] : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>📄</span> Actas Estándar PAE
                    </h2>
                    <p className="text-gray-500 mt-1">Carga y gestión de actas PDF del Estándar PAE.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsManualModalOpen(true)}
                        className="px-4 py-2 bg-indigo-50 text-indigo-700 font-semibold rounded-xl border border-indigo-200 hover:bg-indigo-100 transition-colors flex items-center gap-2"
                    >
                        <span>📝</span> Nuevo Registro
                    </button>
                    <button 
                        onClick={exportToExcel}
                        className="px-4 py-2 bg-green-50 text-green-700 font-semibold rounded-xl border border-green-200 hover:bg-green-100 transition-colors flex items-center gap-2"
                    >
                        <span>📊</span> Exportar Excel
                    </button>
                    <button 
                        onClick={() => setIsUploadModalOpen(true)}
                        className="px-4 py-2 bg-cyan-600 text-white font-semibold rounded-xl hover:bg-cyan-700 transition-colors shadow-sm flex items-center gap-2"
                    >
                        <span>📤</span> Subir PDF
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[250px]">
                    <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">🔍</span>
                        <input 
                            type="text" 
                            placeholder="Buscar por RBD o nombre..." 
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                </div>
                <select 
                    className="py-2 px-4 rounded-xl border border-gray-200 outline-none focus:border-cyan-500"
                    value={licitacion || ''}
                    onChange={e => { setLicitacion(e.target.value ? Number(e.target.value) : null); setPage(1); }}
                >
                    <option value="">Todas las licitaciones</option>
                    <option value="1">Licitación 1</option>
                    <option value="2">Licitación 2</option>
                    <option value="3">Licitación 3</option>
                    {/* These should be dynamically loaded in a real app */}
                </select>
                <select 
                    className="py-2 px-4 rounded-xl border border-gray-200 outline-none focus:border-cyan-500"
                    value={mes || ''}
                    onChange={e => { setMes(e.target.value ? Number(e.target.value) : null); setPage(1); }}
                >
                    <option value="">Todos los meses</option>
                    {currentMonths.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                </select>
                <select 
                    className="py-2 px-4 rounded-xl border border-gray-200 outline-none focus:border-cyan-500"
                    value={anio || ''}
                    onChange={e => { setAnio(e.target.value ? Number(e.target.value) : null); setPage(1); }}
                >
                    <option value="">Todos los años</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                </select>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Detalle del Establecimiento */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    {singleRecord ? (
                        <div className="space-y-2">
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Detalle del Establecimiento</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <span className="text-gray-500 font-medium">RBD:</span> <span className="font-bold text-cyan-700">{singleRecord.RBD}</span>
                                <span className="text-gray-500 font-medium">Fecha:</span> <span className="font-semibold text-gray-900">{singleRecord.Fecha_Supervision ? new Date(singleRecord.Fecha_Supervision).toLocaleDateString('es-CL') : ''}</span>
                                <span className="text-gray-500 font-medium col-span-2">Establecimiento:</span>
                                <span className="font-bold text-gray-900 col-span-2 text-xs leading-snug">{singleRecord.Nombre_Num_establecimiento}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 py-2">
                            <p className="mb-2 text-3xl">🏫</p>
                            <p className="text-xs font-semibold text-slate-500">Detalle Establecimiento</p>
                            <p className="text-[11px] text-slate-400 mt-1">Filtre por un RBD específico para ver sus datos</p>
                        </div>
                    )}
                </div>

                {/* 2. Nueva Cerámica: Cantidad de Registros Cargados */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-2 right-2 p-4 opacity-5 text-7xl select-none">📋</div>
                    <div>
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Actas Cargadas</p>
                            <span className="p-1.5 bg-cyan-50 text-cyan-600 rounded-xl text-xs font-black">
                                {Object.keys(utCounts).length} UTs
                            </span>
                        </div>
                        <p className="text-4xl font-black text-slate-900 mt-2">
                            {total}
                        </p>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                            {total === 1 ? 'Registro cargado' : 'Registros cargados'} en el sistema
                        </p>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Filtros aplicados</span>
                        <span className="font-bold text-slate-600">{records.length} visibles (Pág. {page})</span>
                    </div>
                </div>

                {/* 3. Promedio % Cumplimiento Final */}
                <div className="bg-gradient-to-br from-cyan-500 to-sky-600 p-6 rounded-2xl shadow-sm text-white flex flex-col justify-center items-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl">📊</div>
                    <p className="text-cyan-100 font-semibold uppercase tracking-wider text-xs mb-1 z-10">Promedio % Cumplimiento</p>
                    <p className="text-4xl sm:text-5xl font-black z-10">
                        {averageCompliance !== null ? `${averageCompliance.toFixed(2)}%` : '---'}
                    </p>
                    <p className="text-cyan-100 text-[11px] mt-1.5 z-10">Basado en {total} actas auditadas</p>
                </div>
            </div>

            {/* UT Summary - Ordenado por UT */}
            {Object.keys(utCounts).length > 0 && (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-sm">
                    <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
                        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                            <span>🏢</span> Registros por UT ({Object.keys(utCounts).length} UTs)
                        </h3>
                        <span className="text-[11px] text-slate-400 font-medium">Ordenado por N° de UT</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
                        {Object.entries(utCounts)
                            .sort((a, b) => Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0], undefined, { numeric: true }))
                            .map(([ut, count]) => (
                                <div key={ut} className="flex justify-between items-center bg-slate-50 hover:bg-cyan-50/50 transition-all px-3 py-2 rounded-xl border border-slate-100">
                                    <span className="font-bold text-slate-700 text-xs">UT {ut}</span>
                                    <span className="text-cyan-700 font-black bg-cyan-100/70 px-2 py-0.5 rounded-lg text-xs">
                                        {count}
                                    </span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-100 text-xs text-gray-500 font-bold uppercase tracking-wider">
                                <th className="px-6 py-4 cursor-pointer group hover:bg-cyan-50/50 hover:text-cyan-900 transition-colors" onClick={() => handleSort('Folio')}>
                                    Folio <SortIcon column="Folio" />
                                </th>
                                <th className="px-6 py-4 cursor-pointer group hover:bg-cyan-50/50 hover:text-cyan-900 transition-colors" onClick={() => handleSort('NombreArchivoPdf')}>
                                    Origen / Tipo <SortIcon column="NombreArchivoPdf" />
                                </th>
                                <th className="px-6 py-4 cursor-pointer group hover:bg-cyan-50/50 hover:text-cyan-900 transition-colors" onClick={() => handleSort('RBD')}>
                                    RBD <SortIcon column="RBD" />
                                </th>
                                <th className="px-6 py-4 cursor-pointer group hover:bg-cyan-50/50 hover:text-cyan-900 transition-colors" onClick={() => handleSort('Nombre_Num_establecimiento')}>
                                    Establecimiento <SortIcon column="Nombre_Num_establecimiento" />
                                </th>
                                <th className="px-6 py-4 cursor-pointer group hover:bg-cyan-50/50 hover:text-cyan-900 transition-colors" onClick={() => handleSort('Licitacion')}>
                                    Licitación <SortIcon column="Licitacion" />
                                </th>
                                <th className="px-6 py-4 cursor-pointer group hover:bg-cyan-50/50 hover:text-cyan-900 transition-colors" onClick={() => handleSort('Fecha_Supervision')}>
                                    Fecha <SortIcon column="Fecha_Supervision" />
                                </th>
                                <th className="px-6 py-4 cursor-pointer group hover:bg-cyan-50/50 hover:text-cyan-900 transition-colors" onClick={() => handleSort('Porcentaje_cumplimiento_final')}>
                                    % Cumplimiento <SortIcon column="Porcentaje_cumplimiento_final" />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                        <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent text-cyan-600 rounded-full mb-2"></div>
                                        <p className="font-bold text-xs">Cargando datos...</p>
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                        <p className="font-bold text-sm">No se encontraron actas con los filtros aplicados.</p>
                                    </td>
                                </tr>
                            ) : (
                                records.map((record) => {
                                    const isManual = record.NombreArchivoPdf === 'Ingreso Manual'
                                    return (
                                        <tr key={record.id} className="hover:bg-cyan-50/50 transition-colors cursor-pointer group" onClick={() => setSelectedRecord(record)}>
                                            <td className="px-6 py-4 font-black text-cyan-700 group-hover:text-cyan-800">
                                                {record.Folio}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isManual ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                        <span>✍️</span> Manual
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-sky-50 text-sky-700 border border-sky-200" title={record.NombreArchivoPdf}>
                                                        <span>📄</span> PDF
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-gray-900">
                                                {record.RBD}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 text-xs font-semibold max-w-[220px] truncate" title={record.Nombre_Num_establecimiento || ''}>
                                                {record.Nombre_Num_establecimiento}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 text-xs font-bold">
                                                {record.Licitacion ? `Lic. ${record.Licitacion}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 text-xs font-medium">
                                                {record.Fecha_Supervision ? new Date(record.Fecha_Supervision).toLocaleDateString('es-CL') : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
                                                        <div 
                                                            className={`h-full rounded-full transition-all ${record.Porcentaje_cumplimiento_final && record.Porcentaje_cumplimiento_final >= 90 ? 'bg-emerald-500' : record.Porcentaje_cumplimiento_final && record.Porcentaje_cumplimiento_final >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                            style={{ width: `${record.Porcentaje_cumplimiento_final || 0}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="font-extrabold text-gray-800 text-xs w-12 text-right">
                                                        {record.Porcentaje_cumplimiento_final !== null && record.Porcentaje_cumplimiento_final !== undefined ? `${record.Porcentaje_cumplimiento_final}%` : '-'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination */}
                {!isLoading && totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-sm text-gray-500">Mostrando página {page} de {totalPages}</span>
                        <div className="flex gap-2">
                            <button 
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                            >
                                Anterior
                            </button>
                            <button 
                                disabled={page === totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <span>📤</span> Subir Actas PDF
                            </h3>
                            <button onClick={() => setIsUploadModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="border-2 border-dashed border-cyan-200 rounded-xl p-8 text-center hover:bg-cyan-50/50 transition-colors relative cursor-pointer group">
                                <input 
                                    type="file" 
                                    multiple 
                                    accept=".pdf"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    disabled={uploading}
                                />
                                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">📄</div>
                                <p className="text-gray-700 font-medium">Haga clic o arrastre archivos PDF aquí</p>
                                <p className="text-xs text-gray-500 mt-1">Se extraerán los datos y tablas automáticamente usando pdfplumber</p>
                            </div>
                            
                            {filesToUpload.length > 0 && (
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 max-h-40 overflow-y-auto text-sm text-gray-600">
                                    <p className="font-semibold text-gray-800 mb-2">{filesToUpload.length} archivos seleccionados:</p>
                                    <ul className="list-disc pl-5 space-y-1">
                                        {filesToUpload.map((f, i) => <li key={i} className="truncate">{f.name}</li>)}
                                    </ul>
                                </div>
                            )}

                            {uploadErrors.length > 0 && (
                                <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-sm">
                                    <p className="font-bold text-red-800 mb-2">Errores al procesar:</p>
                                    <ul className="space-y-2">
                                        {uploadErrors.map((e, i) => (
                                            <li key={i} className="text-red-700">
                                                <strong>{e.filename}:</strong> {e.error === 'DUPLICATE_FOLIO' ? 'El folio ya existe en la base de datos.' : e.error}
                                                {e.error === 'DUPLICATE_FOLIO' && (
                                                    <button 
                                                        onClick={() => handleFileUpload('true')}
                                                        className="ml-2 px-2 py-1 bg-red-100 text-red-800 font-semibold rounded hover:bg-red-200 text-xs"
                                                    >
                                                        Reemplazar
                                                    </button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button 
                                onClick={() => setIsUploadModalOpen(false)}
                                className="px-4 py-2 font-medium text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                                disabled={uploading}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => handleFileUpload()}
                                disabled={filesToUpload.length === 0 || uploading}
                                className="px-6 py-2 font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {uploading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Procesando...
                                    </>
                                ) : 'Comenzar Carga'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Record Detail Modal */}
            {selectedRecord && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-6xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">
                                    Detalle de Acta - Folio {selectedRecord.Folio}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">{selectedRecord.NombreArchivoPdf}</p>
                            </div>
                            <button onClick={() => setSelectedRecord(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Establecimiento</p>
                                    <p className="font-medium text-gray-900">{selectedRecord.Nombre_Num_establecimiento}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Res. Sanitaria</p>
                                    <p className="font-medium text-gray-900">{selectedRecord.Res_Sanitaria_N}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Licitación</p>
                                    <p className="font-medium text-gray-900">{selectedRecord.Licitacion}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Comuna</p>
                                    <p className="font-medium text-gray-900">{selectedRecord.Comuna}</p>
                                </div>
                            </div>

                            <h4 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Aspectos Estándar PAE</h4>
                            
                            {selectedRecord.detalles && selectedRecord.detalles.length > 0 ? (
                                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-100 text-gray-600">
                                            <tr>
                                                <th className="p-3 font-semibold">Infraestructura</th>
                                                <th className="p-3 font-semibold">Calificación</th>
                                                <th className="p-3 font-semibold">Descripción</th>
                                                <th className="p-3 font-semibold">C. Inocuidad</th>
                                                <th className="p-3 font-semibold">Tipo NC</th>
                                                <th className="p-3 font-semibold">Otros Comentarios</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {selectedRecord.detalles.map((d, i) => (
                                                <tr key={i} className="hover:bg-gray-50">
                                                    <td className="p-3 font-medium text-gray-800 min-w-[200px]">{d.Infraestructura}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                                                            d.Calificacion?.toUpperCase() === 'C' ? 'bg-green-100 text-green-700' :
                                                            d.Calificacion?.toUpperCase() === 'NC' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {d.Calificacion}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-gray-600 max-w-[300px]">{d.Descripcion}</td>
                                                    <td className="p-3 text-center">{d.Comprometiendo_Inocuidad}</td>
                                                    <td className="p-3 text-center text-red-600 font-bold">{d.Tipo_NC}</td>
                                                    <td className="p-3 text-gray-600 text-xs max-w-[200px]">{d.Otros_Comentarios}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-gray-500 italic">No hay detalles extraídos para este acta.</p>
                            )}

                            {selectedRecord.Observaciones && (
                                <div className="mt-8">
                                    <h4 className="text-lg font-bold text-gray-800 mb-2">Observaciones a los incumplimientos</h4>
                                    <div className="bg-yellow-50 text-yellow-900 p-4 rounded-xl text-sm border border-yellow-200 whitespace-pre-wrap">
                                        {selectedRecord.Observaciones}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Entry Modal */}
            {isManualModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <span>📝</span> Ingreso Manual de Acta
                            </h3>
                            <button onClick={() => setIsManualModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4">
                            {manualError && (
                                <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-sm font-medium">
                                    {manualError}
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600 uppercase">RBD</label>
                                    <input 
                                        type="number" 
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all"
                                        value={manualForm.RBD}
                                        onChange={handleRbdChange}
                                        placeholder="Ej: 1302"
                                    />
                                    <p className="text-xs text-cyan-600 italic">Ingresa el RBD para autocompletar</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600 uppercase">Folio</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all"
                                        value={manualForm.Folio}
                                        onChange={(e) => setManualForm({...manualForm, Folio: e.target.value})}
                                        placeholder="Ej: 123456"
                                    />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs font-semibold text-gray-600 uppercase">Establecimiento</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all"
                                        value={manualForm.Nombre_Num_establecimiento}
                                        onChange={(e) => setManualForm({...manualForm, Nombre_Num_establecimiento: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600 uppercase">Comuna</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all"
                                        value={manualForm.Comuna}
                                        onChange={(e) => setManualForm({...manualForm, Comuna: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600 uppercase">Licitación</label>
                                    <input 
                                        type="number" 
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all"
                                        value={manualForm.Licitacion}
                                        onChange={(e) => setManualForm({...manualForm, Licitacion: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600 uppercase">Fecha Supervisión</label>
                                    <input 
                                        type="date" 
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all"
                                        value={manualForm.Fecha_Supervision}
                                        onChange={(e) => setManualForm({...manualForm, Fecha_Supervision: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600 uppercase">% Cumplimiento</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all"
                                        value={manualForm.Porcentaje_cumplimiento_final}
                                        onChange={(e) => setManualForm({...manualForm, Porcentaje_cumplimiento_final: e.target.value})}
                                        placeholder="Ej: 85.5"
                                    />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs font-semibold text-gray-600 uppercase">Observaciones</label>
                                    <textarea 
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all min-h-[100px]"
                                        value={manualForm.Observaciones}
                                        onChange={(e) => setManualForm({...manualForm, Observaciones: e.target.value})}
                                        placeholder="Observaciones de la supervisión..."
                                    ></textarea>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button 
                                onClick={() => setIsManualModalOpen(false)}
                                className="px-4 py-2 font-medium text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                                disabled={isSubmittingManual}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleManualSubmit}
                                disabled={isSubmittingManual || !manualForm.Folio}
                                className="px-6 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSubmittingManual ? 'Guardando...' : 'Guardar Acta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
