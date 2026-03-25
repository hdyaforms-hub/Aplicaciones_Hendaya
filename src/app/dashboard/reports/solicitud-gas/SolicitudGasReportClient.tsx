
'use client'

import { useState, useEffect, useRef } from 'react'
import { getGasReport, searchColegiosGasReport } from './actions'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export default function SolicitudGasReportClient() {
    const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split('T')[0])
    const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0])
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
                const res = await searchColegiosGasReport(searchTerm)
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
        const res = await getGasReport({
            fechaDesde: fechaDesde || undefined,
            fechaHasta: fechaHasta || undefined,
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
        doc.text('Reporte de Solicitudes de Gas', 14, 22)
        doc.setFontSize(11)
        doc.setTextColor(100)
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 30)

        const headers = [['Fecha', 'Sucursal', 'RBD', 'Establecimiento', 'Distribuidor', 'Tipo', 'Detalle', 'Lts', 'Solicitante']]

        const data = registros.map(r => [
            new Date(r.fechaSolicitud).toLocaleDateString(),
            r.sucursal,
            r.rbd,
            r.nombreEstablecimiento.length > 20 ? r.nombreEstablecimiento.substring(0, 20) + '...' : r.nombreEstablecimiento,
            r.distribuidor,
            r.tipoGas,
            r.tipoGas === 'Cilindro' ? `${r.cantidad} x ${r.cilindro}` : '-',
            r.cantidadLitro.toFixed(2),
            r.nombreSolicitante
        ])

        autoTable(doc, {
            startY: 35,
            head: headers,
            body: data as string[][],
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [14, 165, 233] } 
        })

        doc.save(`Reporte_Gas_${fechaDesde || 'inicio'}_a_${fechaHasta || 'fin'}.pdf`)
    }

    const downloadExcel = () => {
        const headers = ['Fecha', 'Sucursal', 'UT', 'RBD', 'Establecimiento', 'Distribuidor', 'Tipo Gas', 'Cilindro', 'Cantidad', 'Litros Totales', 'Solicitante', 'Observacion']
        const data = registros.map(r => [
            new Date(r.fechaSolicitud).toLocaleDateString(),
            r.sucursal,
            r.ut,
            r.rbd,
            r.nombreEstablecimiento,
            r.distribuidor,
            r.tipoGas,
            r.cilindro || '-',
            r.cantidad || '-',
            r.cantidadLitro,
            r.nombreSolicitante,
            r.observacion || ''
        ])

        const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Gas")
        XLSX.writeFile(wb, `Reporte_Gas_${fechaDesde || 'inicio'}_a_${fechaHasta || 'fin'}.xlsx`)
    }

    const selectColegio = (col: any) => {
        setSelectedRbd(col.colRBD)
        setSearchTerm(`${col.colRBD} - ${col.nombreEstablecimiento}`)
        setShowDropdown(false)
    }

    const clearFilters = () => {
        const today = new Date().toISOString().split('T')[0]
        setFechaDesde(today)
        setFechaHasta(today)
        setSearchTerm('')
        setSelectedRbd(null)
        setSelectedSucursal('')
        setError('')
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-6 w-full max-w-6xl mx-auto animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold tracking-tight text-gray-800 flex items-center gap-2">
                    🔥 Informe de Solicitudes de Gas
                </h2>
                <div className="flex items-center gap-3">
                    <button onClick={downloadExcel} disabled={registros.length === 0} className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-md font-bold text-sm transition-all disabled:opacity-50 flex items-center gap-2">📗 Excel</button>
                    <button onClick={downloadPDF} disabled={registros.length === 0} className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-md font-bold text-sm transition-all disabled:opacity-50 flex items-center gap-2">⬇️ PDF</button>
                </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Desde</label>
                        <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold text-gray-900 shadow-sm" />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Hasta</label>
                        <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold text-gray-900 shadow-sm" />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Sucursal</label>
                        <select value={selectedSucursal} onChange={(e) => setSelectedSucursal(e.target.value)} className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold text-gray-900 shadow-sm appearance-none">
                            <option value="">-- Todas --</option>
                            {userSucursales.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="md:col-span-4 relative" ref={searchRef}>
                        <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Buscar Establecimiento / RBD</label>
                        <div className="relative">
                            <input type="text" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); if (selectedRbd) setSelectedRbd(null); }} placeholder="RBD o Nombre..." className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold text-gray-900 shadow-sm" />
                            {isSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><span className="animate-spin text-sky-500 block">↻</span></div>}
                        </div>
                        {showDropdown && colegiosResults.length > 0 && (
                            <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 max-h-60 overflow-y-auto divide-y divide-gray-50">
                                {colegiosResults.map((col) => (
                                    <button key={col.id} type="button" onClick={() => selectColegio(col)} className="w-full text-left px-4 py-3 hover:bg-sky-50 transition-colors flex flex-col">
                                        <span className="font-bold text-gray-800 text-sm">{col.colRBD} - {col.nombreEstablecimiento}</span>
                                        <span className="text-[10px] text-gray-500 uppercase font-medium">{col.comuna}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="md:col-span-2 flex gap-2">
                        <button onClick={handleFilter} disabled={loading} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow-md font-bold transition-all disabled:opacity-50">{loading ? '...' : '🔍'}</button>
                        <button onClick={clearFilters} className="px-4 py-2.5 bg-white border border-slate-300 text-slate-600 rounded-xl shadow-sm font-bold transition-all hover:bg-slate-50">🗑️</button>
                    </div>
                </div>
            </div>

            <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm bg-white min-h-[300px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="text-black bg-slate-50/50 border-b border-gray-100">
                            <tr>
                                <th className="px-5 py-4 font-bold uppercase text-[10px] tracking-wider">Fecha</th>
                                <th className="px-5 py-4 font-bold uppercase text-[10px] tracking-wider">Sucursal</th>
                                <th className="px-5 py-4 font-bold uppercase text-[10px] tracking-wider">Establecimiento / RBD</th>
                                <th className="px-5 py-4 font-bold uppercase text-[10px] tracking-wider">Distribuidor</th>
                                <th className="px-5 py-4 font-bold uppercase text-[10px] tracking-wider text-center">Tipo</th>
                                <th className="px-5 py-4 font-bold uppercase text-[10px] tracking-wider text-center">Detalle</th>
                                <th className="px-5 py-4 font-bold uppercase text-[10px] tracking-wider text-center">Litros</th>
                                <th className="px-5 py-4 font-bold uppercase text-[10px] tracking-wider">Solicitante</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-medium text-gray-700">
                            {registros.length === 0 && !loading ? (
                                <tr><td colSpan={8} className="px-5 py-20 text-center text-gray-400"><p>No se encontraron registros.</p></td></tr>
                            ) : (
                                registros.map((r) => (
                                    <tr key={r.id} className="hover:bg-sky-50/30 transition-colors">
                                        <td className="px-5 py-4 text-xs font-mono text-gray-400">{new Date(r.fechaSolicitud).toLocaleDateString()}</td>
                                        <td className="px-5 py-4"><span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{r.sucursal}</span></td>
                                        <td className="px-5 py-4 flex flex-col"><span className="font-bold text-gray-900">{r.nombreEstablecimiento}</span><span className="text-[10px] text-sky-600 font-bold">RBD: {r.rbd}</span></td>
                                        <td className="px-5 py-4 font-bold text-gray-600">{r.distribuidor}</td>
                                        <td className="px-5 py-4 text-center"><span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter bg-amber-100 text-amber-700">{r.tipoGas}</span></td>
                                        <td className="px-5 py-4 text-center text-xs">{r.tipoGas === 'Cilindro' ? `${r.cantidad} x ${r.cilindro}` : '-'}</td>
                                        <td className="px-5 py-4 text-center font-black text-gray-900">{r.cantidadLitro.toFixed(2)}</td>
                                        <td className="px-5 py-4 text-xs">{r.nombreSolicitante}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
