'use client'

import { useState } from 'react'
import { getCargaRaciones } from './actions'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

// Extender tipos de jspdf si es necesario (jspdf-autotable)
type CargaRacion = {
    id: string
    usuario: string
    fechaSistema: Date
    fechaIngreso: Date
    rbd: number
    nombreEstablecimiento: string
    ano: number
    mes: number
    programa: string
    estrato: string
    totalIng: number
    totalAsig: number
    tasaPreparacion: number
    observacion: string
}

export default function CargaRacionesClient() {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

    const [ano, setAno] = useState<string>(currentYear.toString())
    const [mes, setMes] = useState<string>(currentMonth.toString())
    const [rbd, setRbd] = useState<string>('')

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [registros, setRegistros] = useState<CargaRacion[]>([])

    const handleFilter = async () => {
        setLoading(true)
        setError('')
        setRegistros([])

        const filterAno = ano ? parseInt(ano) : undefined
        const filterMes = mes ? parseInt(mes) : undefined
        const filterRbd = rbd ? parseInt(rbd) : undefined

        const result: any = await getCargaRaciones(filterAno, filterMes, filterRbd)

        if (result.error) {
            setError(result.error)
        } else if (result.registros) {
            setRegistros(result.registros)
            if (result.registros.length === 0) {
                setError('No se encontraron registros para estos filtros.')
            }
        }

        setLoading(false)
    }

    const downloadPDF = () => {
        const doc = new jsPDF('landscape')

        doc.setFontSize(18)
        doc.text('Informe de Carga de Raciones', 14, 22)
        doc.setFontSize(11)
        doc.setTextColor(100)
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 30)

        const headers = [['Fecha Ingreso', 'RBD', 'Establecimiento', 'Programa', 'Estrato', 'Ingreso', 'PMPA', 'Tasa', 'Usuario']]

        const data = registros.map(r => [
            new Date(r.fechaIngreso).toLocaleDateString(),
            r.rbd,
            r.nombreEstablecimiento.length > 20 ? r.nombreEstablecimiento.substring(0, 20) + '...' : r.nombreEstablecimiento,
            r.programa,
            r.estrato,
            r.totalIng,
            r.totalAsig,
            `${(r.tasaPreparacion * 100).toFixed(2)}%`,
            r.usuario
        ])

        autoTable(doc, {
            startY: 35,
            head: headers,
            body: data as string[][],
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [8, 145, 178] } // cyan-600
        })

        doc.save(`Raciones_Reporte_${ano}_${mes}.pdf`)
    }

    const downloadExcel = () => {
        const headers = ['Fecha Ingreso', 'RBD', 'Establecimiento', 'Programa', 'Estrato', 'Ingreso', 'PMPA', 'Tasa', 'Usuario', 'Observacion']

        const data = registros.map(r => [
            new Date(r.fechaIngreso).toLocaleDateString(),
            r.rbd,
            r.nombreEstablecimiento,
            r.programa,
            r.estrato,
            r.totalIng,
            r.totalAsig,
            `${(r.tasaPreparacion * 100).toFixed(2)}%`,
            r.usuario,
            r.observacion || ''
        ])

        const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Raciones")
        XLSX.writeFile(wb, `Raciones_Reporte_${ano}_${mes}.xlsx`)
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-6 w-full max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold tracking-tight text-gray-800 flex items-center gap-2">
                    📊 Informe de Cargas del Mes
                </h2>
                <div className="flex items-center gap-3">
                    <button
                        onClick={downloadExcel}
                        disabled={registros.length === 0}
                        className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-md font-bold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        📗 Excel
                    </button>
                    <button
                        onClick={downloadPDF}
                        disabled={registros.length === 0}
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md font-bold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        ⬇️ PDF
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-100 border-2 border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-black text-gray-900 mb-2 tracking-wide">AÑO DE BÚSQUEDA</label>
                        <select
                            value={ano}
                            onChange={(e) => setAno(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white rounded-xl border-2 border-slate-300 focus:outline-none focus:border-cyan-600 font-bold text-gray-900 shadow-sm"
                        >
                            <option value="">-- Todos --</option>
                            {[...Array(5)].map((_, i) => (
                                <option key={i} value={currentYear - i}>{currentYear - i}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-black text-gray-900 mb-2 tracking-wide">MES DE BÚSQUEDA</label>
                        <select
                            value={mes}
                            onChange={(e) => setMes(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white rounded-xl border-2 border-slate-300 focus:outline-none focus:border-cyan-600 font-bold text-gray-900 shadow-sm"
                        >
                            <option value="">-- Todos --</option>
                            <option value="1">Enero</option>
                            <option value="2">Febrero</option>
                            <option value="3">Marzo</option>
                            <option value="4">Abril</option>
                            <option value="5">Mayo</option>
                            <option value="6">Junio</option>
                            <option value="7">Julio</option>
                            <option value="8">Agosto</option>
                            <option value="9">Septiembre</option>
                            <option value="10">Octubre</option>
                            <option value="11">Noviembre</option>
                            <option value="12">Diciembre</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-black text-gray-900 mb-2 tracking-wide">RBD (OPCIONAL)</label>
                        <input
                            type="number"
                            value={rbd}
                            onChange={(e) => setRbd(e.target.value)}
                            placeholder="Buscar RBD..."
                            className="w-full px-4 py-2.5 bg-white rounded-xl border-2 border-slate-300 focus:outline-none focus:border-cyan-600 font-bold text-gray-900 shadow-sm placeholder:text-gray-400 placeholder:font-medium"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleFilter}
                            disabled={loading}
                            className="w-full px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl shadow-md font-bold transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Consultando...' : '🔍 Filtrar'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-left text-sm mb-0">
                    <thead className="text-gray-600 bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 font-semibold">Fecha</th>
                            <th className="px-4 py-3 font-semibold">Usuario</th>
                            <th className="px-4 py-3 font-semibold">RBD</th>
                            <th className="px-4 py-3 font-semibold">Establecimiento</th>
                            <th className="px-4 py-3 font-semibold">Programa / Estrato</th>
                            <th className="px-4 py-3 font-semibold text-center">Ingreso</th>
                            <th className="px-4 py-3 font-semibold text-center">Asignado (PMPA)</th>
                            <th className="px-4 py-3 font-semibold text-center">Tasa %</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-gray-800 bg-white">
                        {registros.length === 0 && !loading && !error ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                                    Utilice los filtros para mostrar las cargas de raciones...
                                </td>
                            </tr>
                        ) : (
                            registros.map((r, idx) => (
                                <tr key={r.id || idx} className="hover:bg-cyan-50/50 transition-colors">
                                    <td className="px-4 py-3">{new Date(r.fechaIngreso).toLocaleDateString()}</td>
                                    <td className="px-4 py-3 text-cyan-700">{r.usuario}</td>
                                    <td className="px-4 py-3 font-bold">{r.rbd}</td>
                                    <td className="px-4 py-3 text-xs w-48 leading-tight">{r.nombreEstablecimiento}</td>
                                    <td className="px-4 py-3">
                                        <div className="bg-slate-100 text-slate-700 px-2 py-1 rounded inline-block text-xs">
                                            {r.programa} · {r.estrato}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-cyan-600">{r.totalIng}</td>
                                    <td className="px-4 py-3 text-center text-gray-500">{r.totalAsig}</td>
                                    <td className="px-4 py-3 text-center relative">
                                        {(r.tasaPreparacion * 100).toFixed(2)}%
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-between items-center text-xs text-gray-400">
                <p>Total de registros encontrados: {registros.length}</p>
            </div>
        </div>
    )
}
