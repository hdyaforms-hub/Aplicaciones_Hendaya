'use client'

import { useState, useEffect, useRef } from 'react'
import UploadModal from './UploadModal'
import { useDebounce } from '@/hooks/use-debounce'
import { searchColegios } from '../captura-certificacion/actions'

export default function ElementosEsencialesPage() {
    const [registros, setRegistros] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [mes, setMes] = useState('')
    const [ano, setAno] = useState('')
    const [licitacion, setLicitacion] = useState('')
    const [folio, setFolio] = useState('')
    const [loading, setLoading] = useState(true)
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    
    // Autocomplete state
    const [searchInput, setSearchInput] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [showDropdown, setShowDropdown] = useState(false)
    const [selectedRbd, setSelectedRbd] = useState<number | null>(null)
    const debouncedSearch = useDebounce(searchInput, 400)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Detail Modal state
    const [selectedReg, setSelectedReg] = useState<any | null>(null)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10


    const fetchRegistros = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (selectedRbd) params.append('rbd', selectedRbd.toString())
            else if (search) params.append('search', search)
            
            if (mes) params.append('mes', mes)
            if (ano) params.append('ano', ano)
            if (licitacion) params.append('licitacion', licitacion)
            if (folio) params.append('folio', folio)

            const res = await fetch(`/api/elementos-esenciales?${params.toString()}`)
            const data = await res.json()
            if (res.ok) {
                setRegistros(data)
                setCurrentPage(1) // Reset to first page on search
            } else {
                console.error(data.error)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRegistros()
    }, [search, mes, ano, licitacion, folio, selectedRbd])

    // Autocomplete effect
    useEffect(() => {
        if (!debouncedSearch || debouncedSearch.length < 2) {
            setSearchResults([])
            setShowDropdown(false)
            return
        }

        // Si el usuario ya seleccionó algo y el texto es idéntico al nombre guardado, no buscamos
        if (selectedRbd && searchInput.includes(selectedRbd.toString())) return;

        const doSearch = async () => {
            const results = await searchColegios(debouncedSearch)
            setSearchResults(results)
            setShowDropdown(true)
        }
        doSearch()
    }, [debouncedSearch])

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const handleSelectColegio = (colegio: any) => {
        setSelectedRbd(colegio.colRBD)
        setSearchInput(`${colegio.colRBD} - ${colegio.nombreEstablecimiento}`)
        setSearch(colegio.colRBD.toString())
        setShowDropdown(false)
    }

    const clearSearch = () => {
        setSearchInput('')
        setSearch('')
        setSelectedRbd(null)
        setSearchResults([])
    }

    // Pagination Logic
    const totalPages = Math.ceil(registros.length / itemsPerPage)
    const paginatedRegistros = registros.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

    const handleExport = () => {
        const params = new URLSearchParams()
        if (search) params.append('search', search)
        if (mes) params.append('mes', mes)
        if (ano) params.append('ano', ano)
        if (licitacion) params.append('licitacion', licitacion)
        if (folio) params.append('folio', folio)

        window.location.href = `/api/elementos-esenciales/export?${params.toString()}`
    }

    const handleDelete = async (id: string) => {
        if (!id) {
            console.error('ID is undefined');
            return;
        }
        if (!window.confirm('¿Estás seguro de que deseas eliminar este registro? Esta acción también eliminará el archivo PDF asociado.')) {
            return
        }

        try {
            const res = await fetch(`/api/elementos-esenciales/${id}`, {
                method: 'DELETE',
            })

            if (res.ok) {
                setRegistros(prev => prev.filter(reg => reg.id !== id))
                setSelectedIds(prev => prev.filter(selectedId => selectedId !== id))
            } else {
                const data = await res.json()
                alert(data.error || 'Error al eliminar el registro')
            }
        } catch (error) {
            console.error('Error deleting:', error)
            alert('Ocurrió un error inesperado al intentar eliminar el registro.')
        }
    }

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        
        if (!window.confirm(`¿Estás seguro de que deseas eliminar los ${selectedIds.length} registros seleccionados? Esta acción también eliminará los archivos PDF asociados.`)) {
            return
        }

        setLoading(true);
        try {
            const res = await fetch('/api/elementos-esenciales', {
                method: 'DELETE',
                body: JSON.stringify({ ids: selectedIds }),
                headers: { 'Content-Type': 'application/json' }
            })

            const data = await res.json();
            if (res.ok) {
                setRegistros(prev => prev.filter(reg => !selectedIds.includes(reg.id)));
                setSelectedIds([]);
            } else {
                alert(data.error || 'Error al eliminar los registros');
            }
        } catch (error) {
            console.error('Error deleting selected:', error);
            alert('Ocurrió un error inesperado al intentar eliminar los registros seleccionados.');
        } finally {
            setLoading(false);
        }
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === registros.length && registros.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(registros.map(r => r.id));
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-50 to-sky-50 rounded-bl-full -z-10 opacity-70" />
                
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-cyan-100 text-cyan-600 rounded-xl">📄</span> 
                        Elementos Esenciales
                    </h2>
                    <p className="text-gray-500 mt-2 font-medium">Gestiona y consulta las actas de supervisión extraídas desde PDF.</p>
                </div>
                
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsUploadModalOpen(true)}
                        className="px-4 py-1 bg-cyan-600 text-white rounded-xl shadow-sm shadow-cyan-600/20 font-semibold hover:bg-cyan-500 transition-all flex items-center gap-2"
                    >
                        <span>⬆️</span> Subir PDF
                    </button>
                    <button 
                        onClick={handleExport}
                        className="px-4 py-1 bg-emerald-600 text-white rounded-xl shadow-sm shadow-emerald-600/20 font-semibold hover:bg-emerald-500 transition-all flex items-center gap-2"
                    >
                        <span>📊</span> Exportar a Excel
                    </button>
                    {selectedIds.length > 0 && (
                        <button 
                            onClick={handleDeleteSelected}
                            className="px-4 py-1 bg-red-600 text-white rounded-xl shadow-sm shadow-red-600/20 font-semibold hover:bg-red-500 transition-all flex items-center gap-2 animate-in slide-in-from-right-4"
                        >
                            <span>🗑️</span> Eliminar ({selectedIds.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4">
                <div className="flex-1 min-w-[300px] relative" ref={dropdownRef}>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Búsqueda Inteligente (RBD o Nombre)</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Ej: 401 o OHIGGINS..." 
                            value={searchInput}
                            onChange={(e) => {
                                setSearchInput(e.target.value)
                                if (e.target.value === '') clearSearch()
                            }}
                            onFocus={() => {
                                if (searchResults.length > 0) setShowDropdown(true)
                            }}
                            className="w-full pl-10 pr-10 py-1 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-medium"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
                        {searchInput && (
                            <button 
                                onClick={clearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {showDropdown && searchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                            {searchResults.map((c) => (
                                <button
                                    key={c.colRBD}
                                    onClick={() => handleSelectColegio(c)}
                                    className="w-full text-left px-4 py-3 hover:bg-cyan-50 transition-colors border-b border-gray-50 last:border-0"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-900">{c.nombreEstablecimiento}</span>
                                        <span className="text-xs text-cyan-600 font-mono font-bold uppercase tracking-wider">RBD: {c.colRBD}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="w-48">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Licitación</label>
                    <input 
                        type="text" 
                        placeholder="Ej: J52" 
                        value={licitacion}
                        onChange={(e) => setLicitacion(e.target.value)}
                        className="w-full px-4 py-1 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                    />
                </div>
                <div className="w-48">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Folio</label>
                    <input 
                        type="text" 
                        placeholder="Ej: 2024..." 
                        value={folio}
                        onChange={(e) => setFolio(e.target.value)}
                        className="w-full px-4 py-1 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                    />
                </div>
                <div className="w-48">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Mes</label>
                    <select 
                        value={mes}
                        onChange={(e) => setMes(e.target.value)}
                        className="w-full px-4 py-1 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-semibold"
                    >
                        <option value="">Todos los meses</option>
                        {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((nombre, i) => (
                            <option key={i} value={(i + 1).toString().padStart(2, '0')}>{nombre}</option>
                        ))}
                    </select>
                </div>
                <div className="w-32">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Año</label>
                    <input 
                        type="number" 
                        placeholder="2024" 
                        value={ano}
                        onChange={(e) => setAno(e.target.value)}
                        className="w-full px-4 py-1 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-bold text-center">
                                    <input 
                                        type="checkbox" 
                                        className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                                        checked={selectedIds.length === registros.length && registros.length > 0}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="px-6 py-4 font-bold">Licitación</th>
                                <th className="px-6 py-4 font-bold">Folio</th>
                                <th className="px-6 py-4 font-bold">Fecha Supervisión</th>
                                <th className="px-6 py-4 font-bold">RBD</th>
                                <th className="px-6 py-4 font-bold">Establecimiento</th>
                                <th className="px-6 py-4 font-bold">Archivo</th>
                                <th className="px-6 py-4 font-bold text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                        <span className="animate-pulse">Cargando registros...</span>
                                    </td>
                                </tr>
                            ) : paginatedRegistros.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <span className="text-4xl mb-2">📄</span>
                                            <p className="font-medium text-gray-500">No se encontraron registros</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedRegistros.map((reg) => {
                                    let fechaStr = reg.fechaSupervision ? new Intl.DateTimeFormat('es-CL', {
                                        day: '2-digit', month: '2-digit', year: 'numeric'
                                    }).format(new Date(reg.fechaSupervision)) : 'N/A';

                                    return (
                                        <tr key={reg.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${selectedIds.includes(reg.id) ? 'bg-cyan-50/30' : ''}`}>
                                            <td className="px-4 py-1 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-3 h-3 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                                                    checked={selectedIds.includes(reg.id)}
                                                    onChange={() => toggleSelect(reg.id)}
                                                />
                                            </td>
                                            <td className="px-4 py-1 font-medium text-gray-900">{reg.licitacion || '-'}</td>
                                            <td className="px-4 py-1">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedReg(reg)
                                                        setIsDetailModalOpen(true)
                                                    }}
                                                    className="text-cyan-600 hover:text-cyan-800 font-bold hover:underline"
                                                    title="Ver detalles del acta"
                                                >
                                                    {reg.folio || '-'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{fechaStr}</td>
                                            <td className="px-6 py-4 text-gray-600">
                                                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold font-mono">
                                                    {reg.rbd || '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate" title={reg.nombreEstablecimiento}>
                                                {reg.nombreEstablecimiento}
                                            </td>
                                            <td className="px-6 py-4">
                                                {reg.link ? (
                                                    <a href={reg.link} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:text-cyan-800 hover:underline flex items-center gap-1 font-medium">
                                                        <span>🔗</span> Ver PDF
                                                    </a>
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => handleDelete(reg.id)}
                                                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Eliminar registro y archivo"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>

                    {/* Pagination Controls */}
                    {!loading && totalPages > 1 && (
                        <div className="p-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest hidden sm:block">
                                <span className="font-bold text-gray-700">{((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, registros.length)}</span> de <span className="font-bold text-gray-700">{registros.length}</span>
                            </div>
                            <div className="flex gap-1.5 ml-auto">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                                >
                                    Anterior
                                </button>
                                <div className="flex items-center gap-1">
                                    {[...Array(totalPages)].map((_, i) => {
                                        const page = i + 1;
                                        if (totalPages > 5 && (page > 1 && page < totalPages && Math.abs(page - currentPage) > 1)) {
                                            if (page === 2 || page === totalPages - 1) return <span key={page} className="text-gray-400 text-xs">..</span>;
                                            return null;
                                        }
                                        return (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                                    currentPage === page 
                                                    ? 'bg-cyan-600 text-white shadow-md' 
                                                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <UploadModal 
                isOpen={isUploadModalOpen} 
                onClose={() => setIsUploadModalOpen(false)} 
                onUploadSuccess={() => {
                    fetchRegistros()
                }} 
            />

            {/* Detail Modal */}
            {isDetailModalOpen && selectedReg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <span>📋</span> Acta Folio: {selectedReg.folio}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Licitación: {selectedReg.licitacion} | RBD: {selectedReg.rbd} - {selectedReg.nombreEstablecimiento}
                                </p>
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-white p-2 rounded-lg shadow-sm">✕</button>
                        </div>
                        
                        <div className="p-6 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div className="p-5 bg-cyan-50/50 rounded-2xl border border-cyan-100 shadow-sm">
                                    <p className="text-[10px] font-black text-cyan-700 uppercase tracking-widest mb-3">Información General</p>
                                    <div className="space-y-2 text-sm text-gray-800">
                                        <p><span className="font-bold text-cyan-900">Región:</span> {selectedReg.region}</p>
                                        <p><span className="font-bold text-cyan-900">Comuna:</span> {selectedReg.comuna}</p>
                                        <p><span className="font-bold text-cyan-900">Servicio:</span> {selectedReg.servicio}</p>
                                    </div>
                                </div>
                                <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 shadow-sm">
                                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-3">Tiempos</p>
                                    <div className="space-y-2 text-sm text-gray-800">
                                        <p><span className="font-bold text-blue-900">Fecha:</span> {selectedReg.fechaSupervision ? new Date(selectedReg.fechaSupervision).toLocaleDateString() : 'N/A'}</p>
                                        <p><span className="font-bold text-blue-900">Hora Inicio:</span> {selectedReg.horaInicio}</p>
                                        <p><span className="font-bold text-blue-900">Hora Término:</span> {selectedReg.hora}</p>
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Detalle de Aspectos Supervisados</p>
                            <div className="border border-gray-200 rounded-2xl shadow-sm overflow-hidden bg-white">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-gray-100 text-gray-700 font-bold uppercase tracking-wider border-b border-gray-200">
                                        <tr>
                                            <th className="px-5 py-4 w-1/3">Aspecto</th>
                                            <th className="px-4 py-4 text-center">CO</th>
                                            <th className="px-4 py-4 text-center">NC</th>
                                            <th className="px-4 py-4 text-center">NA</th>
                                            <th className="px-5 py-4">Observaciones / Verificación</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {selectedReg.detalles?.map((d: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-5 py-4 font-bold text-gray-800 leading-relaxed">{d.aspecto}</td>
                                                <td className="px-4 py-4 text-center">
                                                    {d.co && <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg font-black">{d.co}</span>}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    {d.nc && <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg font-black">{d.nc}</span>}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    {d.na && <span className="px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg font-black">{d.na}</span>}
                                                </td>
                                                <td className="px-5 py-4 text-gray-700 leading-relaxed font-medium bg-gray-50/30">
                                                    {d.observacionesOMedioDeVerificacion}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {selectedReg.obsALosIncumplimiento && (
                                <div className="mt-6 p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
                                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2">Observaciones a los Incumplimientos</p>
                                    <p className="text-sm text-amber-900 italic leading-relaxed font-medium">
                                        "{selectedReg.obsALosIncumplimiento}"
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="px-5 py-1 text-sm font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-all active:scale-95"
                            >
                                Cerrar
                            </button>
                            {selectedReg.link && (
                                <a
                                    href={selectedReg.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-5 py-1 text-sm font-bold text-white bg-cyan-600 rounded-xl shadow-lg shadow-cyan-600/20 hover:bg-cyan-700 transition-all active:scale-95"
                                >
                                    Ver PDF Original
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
