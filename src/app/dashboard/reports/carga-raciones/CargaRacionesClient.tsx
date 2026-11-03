'use client'

import { useState, useEffect } from 'react'
import { getCargaRaciones, getCargaRacionesMetadata, CargaRacionDTO } from './actions'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export default function CargaRacionesClient() {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

    const [ano, setAno] = useState<string>(currentYear.toString())
    const [mes, setMes] = useState<string>(currentMonth.toString())
    const [institucion, setInstitucion] = useState<string>('TODAS')
    const [institucionesDisponibles, setInstitucionesDisponibles] = useState<string[]>([])
    const [rbd, setRbd] = useState<string>('')

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [registros, setRegistros] = useState<CargaRacionDTO[]>([])

    // Cargar metadatos de filtros (Instituciones autorizadas) al montar el componente
    useEffect(() => {
        getCargaRacionesMetadata().then(res => {
            if (res.success && res.instituciones) {
                setInstitucionesDisponibles(res.instituciones)
            }
        })
    }, [])

    const handleFilter = async () => {
        setLoading(true)
        setError('')
        setRegistros([])

        const filterAno = ano ? parseInt(ano) : undefined
        const filterMes = mes ? parseInt(mes) : undefined
        const filterRbd = rbd ? parseInt(rbd) : undefined
        const filterInstitucion = institucion !== 'TODAS' ? institucion : undefined

        const result: any = await getCargaRaciones(filterAno, filterMes, filterRbd, filterInstitucion)

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
        doc.text('Informe de Carga de Raciones', 14, 20)
        doc.setFontSize(10)
        doc.setTextColor(100)
        doc.text(
            `Generado el: ${new Date().toLocaleString()} | Año: ${ano || 'Todos'} | Mes: ${mes || 'Todos'} | Institución: ${institucion}`,
            14,
            27
        )

        const headers = [
            [
                'Fecha Ingreso',
                'RBD',
                'Establecimiento',
                'Institución',
                'Programa Homologado',
                'Estrato',
                'Ingreso',
                'PMPA',
                'Tasa',
                'Usuario que Ingresó'
            ]
        ]

        const data = registros.map(r => [
            new Date(r.fechaIngreso).toLocaleDateString(),
            r.rbd,
            r.nombreEstablecimiento.length > 25 ? r.nombreEstablecimiento.substring(0, 25) + '...' : r.nombreEstablecimiento,
            r.institucion || 'N/A',
            r.programaHomologado || r.programa,
            r.estrato,
            r.totalIng,
            r.totalAsig,
            `${(r.tasaPreparacion * 100).toFixed(2)}%`,
            r.usuarioNombre || r.usuario
        ])

        autoTable(doc, {
            startY: 32,
            head: headers,
            body: data as string[][],
            theme: 'grid',
            styles: { fontSize: 7.5, cellPadding: 2 },
            headStyles: { fillColor: [8, 145, 178], textColor: [255, 255, 255], fontStyle: 'bold' } // cyan-600
        })

        doc.save(`Raciones_Reporte_${ano || 'todos'}_${mes || 'todos'}.pdf`)
    }

    const downloadExcel = () => {
        const headers = [
            'Fecha Ingreso',
            'RBD',
            'Establecimiento',
            'Institución',
            'Programa Homologado',
            'Estrato',
            'Ingreso',
            'PMPA',
            'Tasa',
            'Observación',
            'Usuario que Ingresó'
        ]

        const data = registros.map(r => [
            new Date(r.fechaIngreso).toLocaleDateString(),
            r.rbd,
            r.nombreEstablecimiento,
            r.institucion || 'N/A',
            r.programaHomologado || r.programa,
            r.estrato,
            r.totalIng,
            r.totalAsig,
            `${(r.tasaPreparacion * 100).toFixed(2)}%`,
            r.observacion || '',
            r.usuarioNombre || r.usuario
        ])

        const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Raciones')
        XLSX.writeFile(wb, `Raciones_Reporte_${ano || 'todos'}_${mes || 'todos'}.xlsx`)
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-6 w-full max-w-7xl mx-auto animate-in fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-100 pb-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-gray-800 flex items-center gap-2">
                        📊 Informe de Cargas del Mes
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Filtra y exporta las raciones auditadas con programas homologados y usuarios registradores.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={downloadExcel}
                        disabled={registros.length === 0}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        📗 Descargar Excel
                    </button>
                    <button
                        onClick={downloadPDF}
                        disabled={registros.length === 0}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        ⬇️ Descargar PDF
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-100 border-2 border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                    <div>
                        <label className="block text-xs font-black text-gray-800 mb-1.5 uppercase tracking-wide">
                            AÑO DE BÚSQUEDA
                        </label>
                        <select
                            value={ano}
                            onChange={(e) => setAno(e.target.value)}
                            className="w-full px-3.5 py-2 bg-white rounded-xl border-2 border-slate-300 focus:outline-none focus:border-cyan-600 font-bold text-gray-900 shadow-sm text-sm"
                        >
                            <option value="">-- Todos --</option>
                            {[...Array(5)].map((_, i) => (
                                <option key={i} value={currentYear - i}>{currentYear - i}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-800 mb-1.5 uppercase tracking-wide">
                            MES DE BÚSQUEDA
                        </label>
                        <select
                            value={mes}
                            onChange={(e) => setMes(e.target.value)}
                            className="w-full px-3.5 py-2 bg-white rounded-xl border-2 border-slate-300 focus:outline-none focus:border-cyan-600 font-bold text-gray-900 shadow-sm text-sm"
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
                        <label className="block text-xs font-black text-gray-800 mb-1.5 uppercase tracking-wide">
                            INSTITUCIÓN
                        </label>
                        <select
                            value={institucion}
                            onChange={(e) => setInstitucion(e.target.value)}
                            className="w-full px-3.5 py-2 bg-white rounded-xl border-2 border-slate-300 focus:outline-none focus:border-cyan-600 font-bold text-gray-900 shadow-sm text-sm"
                        >
                            <option value="TODAS">-- Todas las Instituciones --</option>
                            {institucionesDisponibles.map((inst) => (
                                <option key={inst} value={inst}>{inst}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-800 mb-1.5 uppercase tracking-wide">
                            RBD (OPCIONAL)
                        </label>
                        <input
                            type="number"
                            value={rbd}
                            onChange={(e) => setRbd(e.target.value)}
                            placeholder="Buscar RBD..."
                            className="w-full px-3.5 py-2 bg-white rounded-xl border-2 border-slate-300 focus:outline-none focus:border-cyan-600 font-bold text-gray-900 shadow-sm placeholder:text-gray-400 placeholder:font-medium text-sm"
                        />
                    </div>

                    <div>
                        <button
                            onClick={handleFilter}
                            disabled={loading}
                            className="w-full px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl shadow-md font-bold transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-1.5"
                        >
                            {loading ? 'Consultando...' : '🔍 Filtrar'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-left text-xs mb-0">
                    <thead className="text-gray-700 bg-gray-50 border-b border-gray-200 uppercase tracking-wider text-[11px]">
                        <tr>
                            <th className="px-3.5 py-3 font-bold whitespace-nowrap">Fecha</th>
                            <th className="px-3 py-3 font-bold text-center whitespace-nowrap">RBD</th>
                            <th className="px-3.5 py-3 font-bold whitespace-nowrap">Establecimiento</th>
                            <th className="px-3 py-3 font-bold text-center whitespace-nowrap">Institución</th>
                            <th className="px-3.5 py-3 font-bold whitespace-nowrap">Programa Homologado</th>
                            <th className="px-3 py-3 font-bold whitespace-nowrap">Estrato</th>
                            <th className="px-3 py-3 font-bold text-center whitespace-nowrap">Ingreso</th>
                            <th className="px-3 py-3 font-bold text-center whitespace-nowrap">Asignado (PMPA)</th>
                            <th className="px-3 py-3 font-bold text-center whitespace-nowrap">Tasa %</th>
                            <th className="px-3.5 py-3 font-bold whitespace-nowrap text-right">Usuario que Ingresó</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-gray-800 bg-white">
                        {registros.length === 0 && !loading && !error ? (
                            <tr>
                                <td colSpan={10} className="px-4 py-12 text-center text-gray-400 font-normal">
                                    Utilice los filtros para mostrar las cargas de raciones...
                                </td>
                            </tr>
                        ) : (
                            registros.map((r, idx) => (
                                <tr key={r.id || idx} className="hover:bg-cyan-50/40 transition-colors">
                                    <td className="px-3.5 py-2.5 whitespace-nowrap font-medium text-gray-600">
                                        {new Date(r.fechaIngreso).toLocaleDateString()}
                                    </td>
                                    <td className="px-3 py-2.5 text-center font-bold text-gray-900 whitespace-nowrap">
                                        {r.rbd}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-xs max-w-xs leading-snug">
                                        <span className="font-semibold text-gray-800 line-clamp-1" title={r.nombreEstablecimiento}>
                                            {r.nombreEstablecimiento}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                            {r.institucion || 'JUNAEB'}
                                        </span>
                                    </td>
                                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 font-bold text-xs">
                                            <span>🏷️</span>
                                            <span>{r.programaHomologado || r.programa}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                                            {r.estrato}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center font-bold text-cyan-700 whitespace-nowrap">
                                        {r.totalIng}
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-gray-600 font-semibold whitespace-nowrap">
                                        {r.totalAsig}
                                    </td>
                                    <td className="px-3 py-2.5 text-center whitespace-nowrap font-bold text-slate-700">
                                        {(r.tasaPreparacion * 100).toFixed(2)}%
                                    </td>
                                    <td className="px-3.5 py-2.5 whitespace-nowrap text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-bold text-gray-900 text-xs">
                                                {r.usuarioNombre || r.usuario}
                                            </span>
                                            {r.usuarioNombre && r.usuarioNombre !== r.usuario && (
                                                <span className="text-[10px] text-gray-400 font-normal">
                                                    @{r.usuario}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-between items-center text-xs text-gray-500 font-medium px-1">
                <p>Total de registros encontrados: <strong className="text-gray-800">{registros.length}</strong></p>
            </div>
        </div>
    )
}
