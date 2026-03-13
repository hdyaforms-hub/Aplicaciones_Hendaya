
'use client'

import { useState, useEffect, useRef } from 'react'
import { getRetiroReport, searchColegiosRetiroReport } from './actions'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export default function RetiroReportClient() {
    const [fecha, setFecha] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedRbd, setSelectedRbd] = useState<number | null>(null)
    const [selectedSucursal, setSelectedSucursal] = useState('')
    
    const [colegiosResults, setColegiosResults] = useState<any[]>([])
    const [showDropdown, setShowDropdown] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [registros, setRegistros] = useState<any[]>([])
    const [userSucursales, setUserSucursales] = useState<string[]>([])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length >= 2 && !selectedRbd) {
                setIsSearching(true)
                const res = await searchColegiosRetiroReport(searchTerm)
                if (res.colegios) {
                    setColegiosResults(res.colegios)
                    setShowDropdown(true)
                }
                setIsSearching(false)
            } else {
                setShowDropdown(false)
            }
        }, 500)
        return () => clearTimeout(delayDebounceFn)
    }, [searchTerm, selectedRbd])

    useEffect(() => {
        handleFilter()
    }, [])

    const handleFilter = async () => {
        setLoading(true)
        setError('')
        const res = await getRetiroReport({
            fecha: fecha || undefined,
            rbd: selectedRbd || undefined,
            sucursal: selectedSucursal || undefined
        })
        if (res.error) {
            setError(res.error)
            setRegistros([])
        } else {
            setRegistros(res.registros || [])
            setUserSucursales(res.userSucursales || [])
        }
        setLoading(false)
    }

    const downloadPDF = () => {
        const doc = new jsPDF('landscape')
        doc.setFontSize(18)
        doc.text('Informe de Retiro de Saldos / Rebaja de Stock', 14, 22)
        doc.setFontSize(11)
        doc.setTextColor(100)
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 30)

        // Flatten data for table (rows per detail)
        const rows: any[] = []
        registros.forEach(r => {
            r.detalles.forEach((d: any, idx: number) => {
                rows.push([
                    idx === 0 ? r.folio : '',
                    idx === 0 ? new Date(r.fecha).toLocaleDateString() : '',
                    idx === 0 ? r.tipoOperacion : '',
                    idx === 0 ? r.sucursal : '',
                    idx === 0 ? r.rbd : '',
                    idx === 0 ? (r.nombreEstablecimiento.length > 20 ? r.nombreEstablecimiento.substring(0, 20) + '...' : r.nombreEstablecimiento) : '',
                    d.codigoProducto,
                    d.nombreProducto,
                    d.cantidad,
                    idx === 0 ? r.supervisor : ''
                ])
            })
        })

        const headers = [['Folio', 'Fecha', 'Tipo', 'Sucursal', 'RBD', 'Establecimiento', 'Cód. Prod', 'Producto', 'Cant', 'Supervisor']]

        autoTable(doc, {
            startY: 35,
            head: headers,
            body: rows,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [79, 70, 229] } // Indigo 600
        })

        doc.save(`Reporte_Retiro_${new Date().toISOString().split('T')[0]}.pdf`)
    }

    const downloadExcel = () => {
        const headers = ['Folio', 'Fecha', 'Tipo Operacion', 'Sucursal', 'UT', 'RBD', 'Establecimiento', 'Supervisor', 'Nombre Autoriza', 'RUT Autoriza', 'Codigo Producto', 'Nombre Producto', 'Cantidad']
        const data: any[] = []
        
        registros.forEach(r => {
            r.detalles.forEach((d: any) => {
                data.push([
                    r.folio,
                    new Date(r.fecha).toLocaleDateString(),
                    r.tipoOperacion,
                    r.sucursal,
                    r.ut,
                    r.rbd,
                    r.nombreEstablecimiento,
                    r.supervisor,
                    r.nombreAutoriza || '-',
                    r.rutAutoriza || '-',
                    d.codigoProducto,
                    d.nombreProducto,
                    d.cantidad
                ])
            })
        })

        const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "RetiroSaldos")
        XLSX.writeFile(wb, `Reporte_Retiro_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    const selectColegio = (col: any) => {
        setSelectedRbd(col.colRBD)
        setSearchTerm(`${col.colRBD} - ${col.nombreEstablecimiento}`)
        setShowDropdown(false)
    }

    const clearFilters = () => {
        setFecha('')
        setSearchTerm('')
        setSelectedRbd(null)
        setSelectedSucursal('')
        setError('')
    }

    return (
        <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-gray-100 flex flex-col gap-8 w-full max-w-7xl mx-auto animate-in fade-in duration-700">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-6 border-b border-gray-100 pb-6">
                <div className="flex items-center gap-3">
                    <span className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">📦</span>
                    <h3 className="text-xl font-black text-black uppercase tracking-tight">Filtros de Búsqueda</h3>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={downloadExcel} 
                        disabled={registros.length === 0} 
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-xl shadow-emerald-100 font-black text-xs transition-all disabled:opacity-50 flex items-center gap-2 uppercase tracking-widest"
                    >
                        📗 Excel
                    </button>
                    <button 
                        onClick={downloadPDF} 
                        disabled={registros.length === 0} 
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-100 font-black text-xs transition-all disabled:opacity-50 flex items-center gap-2 uppercase tracking-widest"
                    >
                        ⬇️ PDF
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            <div className="bg-gray-50/50 border border-gray-100 rounded-[2rem] p-8">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                    <div className="md:col-span-3">
                        <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Fecha Específica</label>
                        <input 
                            type="date" 
                            value={fecha} 
                            onChange={(e) => setFecha(e.target.value)} 
                            className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 font-bold text-black shadow-sm"
                        />
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Sucursal</label>
                        <select 
                            value={selectedSucursal} 
                            onChange={(e) => setSelectedSucursal(e.target.value)} 
                            className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 font-bold text-black shadow-sm appearance-none"
                        >
                            <option value="">-- Todas --</option>
                            {userSucursales.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="md:col-span-4 relative" ref={searchRef}>
                        <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Establecimiento / RBD</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={searchTerm} 
                                onChange={(e) => { setSearchTerm(e.target.value); if (selectedRbd) setSelectedRbd(null); }} 
                                placeholder="Escriba RBD o Nombre..." 
                                className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 font-bold text-black shadow-sm"
                            />
                            {isSearching && <div className="absolute right-4 top-1/2 -translate-y-1/2"><span className="animate-spin text-indigo-500 block">↻</span></div>}
                        </div>
                        {showDropdown && colegiosResults.length > 0 && (
                            <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-60 overflow-y-auto divide-y divide-gray-50 overflow-hidden">
                                {colegiosResults.map((col) => (
                                    <button key={col.id} type="button" onClick={() => selectColegio(col)} className="w-full text-left px-5 py-4 hover:bg-indigo-50 transition-colors flex flex-col group">
                                        <span className="font-black text-black text-sm group-hover:text-indigo-600">{col.colRBD} - {col.nombreEstablecimiento}</span>
                                        <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{col.comuna}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="md:col-span-2 flex gap-3">
                        <button onClick={handleFilter} disabled={loading} className="flex-1 py-3.5 bg-black hover:bg-gray-800 text-white rounded-2xl shadow-xl shadow-gray-200 font-black transition-all disabled:opacity-50 text-xl">{loading ? '...' : '🔍'}</button>
                        <button onClick={clearFilters} className="px-5 py-3.5 bg-white border border-gray-200 text-gray-500 rounded-2xl shadow-sm font-black transition-all hover:bg-gray-100 hover:text-black">🗑️</button>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white border border-gray-100 rounded-[2.5rem] overflow-hidden shadow-2xl min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr className="text-black font-black uppercase text-[10px] tracking-widest">
                                <th className="px-6 py-5">Folio / Fecha</th>
                                <th className="px-6 py-5">Sucursal</th>
                                <th className="px-6 py-5">Establecimiento / RBD</th>
                                <th className="px-6 py-5">Productos Detalle</th>
                                <th className="px-6 py-5">Supervisor</th>
                                <th className="px-6 py-5 text-center">Firma</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {registros.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-32 text-center text-gray-400 italic">
                                        <div className="flex flex-col items-center gap-4">
                                            <span className="text-6xl grayscale opacity-20">🔎</span>
                                            <p className="font-bold">No se encontraron registros bajo estos criterios.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                registros.map((r) => (
                                    <tr key={r.id} className="hover:bg-indigo-50/20 transition-colors group">
                                        <td className="px-6 py-5 align-top">
                                            <span className="block font-black text-indigo-600 text-lg tracking-tighter tabular-nums leading-none mb-1">{r.folio}</span>
                                            <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase">{new Date(r.fecha).toLocaleDateString()}</span>
                                            <span className={`block mt-2 text-[9px] font-black uppercase px-2 py-1 rounded-lg w-fit ${r.tipoOperacion === 'Retiro de saldo' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {r.tipoOperacion}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 align-top">
                                            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-gray-200">{r.sucursal}</span>
                                        </td>
                                        <td className="px-6 py-5 align-top">
                                            <div className="flex flex-col max-w-[250px]">
                                                <span className="font-black text-black group-hover:text-indigo-600 transition-colors">{r.nombreEstablecimiento}</span>
                                                <span className="text-[10px] text-gray-400 font-black uppercase tracking-tighter mt-0.5">RBD: {r.rbd} • UT: {r.ut}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 align-top">
                                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                                {r.detalles.map((d: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center text-[11px] p-2 bg-gray-50 rounded-xl border border-gray-100">
                                                        <span className="font-bold text-gray-700 truncate max-w-[150px]">{d.nombreProducto}</span>
                                                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md font-black">x{d.cantidad}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 align-top">
                                            <span className="text-xs font-bold text-gray-600 truncate block max-w-[120px]">{r.supervisor}</span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            {r.firmaBase64 ? (
                                                <div className="w-20 h-10 bg-gray-50 rounded-lg border border-gray-100 p-1 flex items-center justify-center overflow-hidden hover:scale-150 hover:z-50 hover:bg-white hover:shadow-2xl transition-all cursor-zoom-in">
                                                    <img src={r.firmaBase64} alt="Firma" className="max-w-full max-h-full opacity-60 hover:opacity-100" />
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-gray-300 font-bold uppercase">Sin firma</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-center font-black animate-bounce">
                    ⚠️ {error}
                </div>
            )}

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #E2E8F0;
                    border-radius: 10px;
                }
            `}</style>
        </div>
    )
}
