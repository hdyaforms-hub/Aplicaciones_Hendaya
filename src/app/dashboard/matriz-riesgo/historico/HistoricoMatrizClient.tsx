'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getHistoricoData, getRbdHistoryTimeline, logHistoricoExportAudit, HistoricoFilters } from './actions'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

type EvaluationItem = {
    id: string
    rbd: number
    nombreColegio: string
    sucursal: string
    fechaIngreso: string
    supervisorNombre: string
    supervisorCorreo: string
    usuario: string
    estado: string
    latIngreso?: number | null
    lngIngreso?: number | null
    latCierre?: number | null
    lngCierre?: number | null
    cabecera: {
        id: string
        titulo: string
        anio: number
        estado: boolean
    }
    semester: number
    problemsCount: number
    solvedCount: number
    pctSolucion: number
    problems: any[]
}

type Props = {
    initialYears: number[]
    initialSucursales: string[]
    initialSupervisors: { id: string, username: string, name: string }[]
    isAdmin: boolean
}

export default function HistoricoMatrizClient({
    initialYears,
    initialSucursales,
    initialSupervisors,
    isAdmin
}: Props) {
    // Filtros
    const [year, setYear] = useState<number | 'all'>('all')
    const [semester, setSemester] = useState<1 | 2 | 'all'>('all')
    const [sucursal, setSucursal] = useState<string>('all')
    const [supervisor, setSupervisor] = useState<string>('all')
    const [vigencia, setVigencia] = useState<'all' | 'vigente' | 'no_vigente'>('all')
    const [estado, setEstado] = useState<'all' | 'pendiente' | 'por supervisar' | 'cerrado'>('all')
    const [search, setSearch] = useState('')

    // Data y UI State
    const [loading, setLoading] = useState(true)
    const [evaluaciones, setEvaluaciones] = useState<EvaluationItem[]>([])
    const [kpis, setKpis] = useState({
        totalEvaluaciones: 0,
        totalHallazgos: 0,
        totalSolucionados: 0,
        pctMitigacionGlobal: 0,
        totalCerradas: 0,
        totalPendientes: 0
    })
    const [error, setError] = useState<string | null>(null)

    // Modal de Detalle
    const [detailModalItem, setDetailModalItem] = useState<EvaluationItem | null>(null)

    // Modal de Trazabilidad / Timeline por RBD
    const [timelineModalRbd, setTimelineModalRbd] = useState<number | null>(null)
    const [timelineData, setTimelineData] = useState<any | null>(null)
    const [loadingTimeline, setLoadingTimeline] = useState(false)

    // Modal de Visualizador de Fotos
    const [photoViewer, setPhotoViewer] = useState<{ url: string, title: string } | null>(null)

    // Exporting state
    const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)

    // Paginación
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 12

    // Cargar datos principales
    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const filters: HistoricoFilters = {
                year,
                semester,
                sucursal,
                supervisor,
                vigencia,
                estado,
                search: search.trim()
            }
            const res = await getHistoricoData(filters)
            if (res.error) {
                setError(res.error)
                setEvaluaciones([])
            } else {
                setEvaluaciones(res.evaluaciones || [])
                if (res.kpis) setKpis(res.kpis)
            }
        } catch (e: any) {
            setError('Error al consultar el histórico de matrices.')
        } finally {
            setLoading(false)
        }
    }, [year, semester, sucursal, supervisor, vigencia, estado, search])

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData()
        }, 200)
        return () => clearTimeout(timer)
    }, [fetchData])

    // Resetear a pág 1 cuando cambian filtros
    useEffect(() => {
        setCurrentPage(1)
    }, [year, semester, sucursal, supervisor, vigencia, estado, search])

    // Paginación de resultados
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return evaluaciones.slice(start, start + itemsPerPage)
    }, [evaluaciones, currentPage])

    const totalPages = Math.ceil(evaluaciones.length / itemsPerPage) || 1

    // Cargar Timeline de un RBD
    const handleOpenTimeline = async (rbd: number) => {
        setTimelineModalRbd(rbd)
        setLoadingTimeline(true)
        setTimelineData(null)
        try {
            const data = await getRbdHistoryTimeline(rbd)
            if (data.error) {
                alert(data.error)
                setTimelineModalRbd(null)
            } else {
                setTimelineData(data)
            }
        } catch (e) {
            alert('Error al obtener la trazabilidad del establecimiento.')
            setTimelineModalRbd(null)
        } finally {
            setLoadingTimeline(false)
        }
    }

    // Exportar a Excel
    const handleExportExcel = async () => {
        if (evaluaciones.length === 0) return alert('No hay datos para exportar.')
        setExporting('excel')
        try {
            const rows = evaluaciones.map(e => ({
                'ID Evaluación': e.id,
                'RBD': e.rbd,
                'Establecimiento': e.nombreColegio,
                'Sucursal': e.sucursal,
                'Fecha Ingreso': format(new Date(e.fechaIngreso), 'dd/MM/yyyy HH:mm'),
                'Año': e.cabecera.anio,
                'Semestre': `${e.semester}° Semestre`,
                'Plantilla': e.cabecera.titulo,
                'Vigencia Plantilla': e.cabecera.estado ? 'Vigente' : 'No Vigente',
                'Supervisor': e.supervisorNombre,
                'Estado': e.estado.toUpperCase(),
                'Total Hallazgos': e.problemsCount,
                'Hallazgos Mitigados': e.solvedCount,
                '% Mitigación': `${e.pctSolucion}%`,
                'Lat. Ingreso': e.latIngreso || '',
                'Lng. Ingreso': e.lngIngreso || '',
                'Lat. Cierre': e.latCierre || '',
                'Lng. Cierre': e.lngCierre || ''
            }))

            const ws = XLSX.utils.json_to_sheet(rows)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Histórico Matrices')
            XLSX.writeFile(wb, `Historico_Matrices_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`)

            await logHistoricoExportAudit('EXCEL', evaluaciones.length)
        } catch (e) {
            console.error('Error al exportar Excel:', e)
            alert('Error al generar archivo Excel.')
        } finally {
            setExporting(null)
        }
    }

    // Exportar a PDF
    const handleExportPDF = async () => {
        if (evaluaciones.length === 0) return alert('No hay datos para exportar.')
        setExporting('pdf')
        try {
            const doc = new jsPDF('landscape')
            
            // Encabezado Corporativo Oficial HENDAYA (tipográfico, sin logos externos)
            doc.setFillColor(15, 23, 42) // Slate 900
            doc.rect(0, 0, 297, 22, 'F')

            doc.setTextColor(6, 182, 212) // Cyan
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(16)
            doc.text('HENDAYA', 14, 14)

            doc.setTextColor(255, 255, 255)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(11)
            doc.text('|  Reporte Histórico y Trazabilidad de Matrices de Riesgo', 46, 14)

            doc.setFontSize(8)
            doc.setTextColor(148, 163, 184)
            doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 235, 14)

            // Resumen de Filtros aplicados
            doc.setTextColor(51, 65, 85)
            doc.setFontSize(9)
            doc.setFont('helvetica', 'bold')
            doc.text(`Total Registros: ${evaluaciones.length}  |  Hallazgos: ${kpis.totalHallazgos}  |  Mitigados: ${kpis.totalSolucionados} (${kpis.pctMitigacionGlobal}%)`, 14, 30)

            const tableData = evaluaciones.map(e => [
                e.rbd,
                e.nombreColegio,
                e.sucursal,
                format(new Date(e.fechaIngreso), 'dd/MM/yyyy'),
                `${e.semester}° Sem (${e.cabecera.anio})`,
                e.cabecera.estado ? e.cabecera.titulo : `[NO VIGENTE] ${e.cabecera.titulo}`,
                e.supervisorNombre,
                e.estado.toUpperCase(),
                `${e.solvedCount}/${e.problemsCount} (${e.pctSolucion}%)`
            ])

            autoTable(doc, {
                head: [['RBD', 'Establecimiento', 'Sucursal', 'Fecha', 'Semestre', 'Plantilla', 'Supervisor', 'Estado', 'Mitigación']],
                body: tableData,
                startY: 35,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: 14, right: 14 }
            })

            doc.save(`Historico_Matrices_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`)
            await logHistoricoExportAudit('PDF', evaluaciones.length)
        } catch (e) {
            console.error('Error al exportar PDF:', e)
            alert('Error al generar reporte PDF.')
        } finally {
            setExporting(null)
        }
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header del Módulo */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="p-2.5 bg-cyan-50 text-cyan-700 rounded-2xl text-xl font-bold">📜</span>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Histórico de Matrices</h1>
                    </div>
                    <p className="text-slate-500 text-sm mt-1">
                        Consulta la historia completa de auditorías, trazabilidad cronológica por colegio y evolución de mitigaciones.
                    </p>
                </div>

                {/* Botones de Exportación */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={handleExportExcel}
                        disabled={exporting !== null || loading}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                        <span>📊</span> {exporting === 'excel' ? 'Exportando...' : 'Exportar Excel'}
                    </button>
                    <button
                        onClick={handleExportPDF}
                        disabled={exporting !== null || loading}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                        <span>📑</span> {exporting === 'pdf' ? 'Generando PDF...' : 'Exportar PDF'}
                    </button>
                </div>
            </div>

            {/* KPIs Consolidados */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Evaluaciones</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{kpis.totalEvaluaciones}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">En el periodo filtrado</p>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100">
                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Hallazgos Totales</p>
                    <p className="text-2xl font-black text-amber-600 mt-1">{kpis.totalHallazgos}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Desviaciones encontradas</p>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100">
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Mitigaciones</p>
                    <p className="text-2xl font-black text-emerald-600 mt-1">{kpis.totalSolucionados}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Hallazgos resueltos</p>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100">
                    <p className="text-[11px] font-bold text-cyan-600 uppercase tracking-wider">% Mitigación Global</p>
                    <p className="text-2xl font-black text-cyan-700 mt-1">{kpis.pctMitigacionGlobal}%</p>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div 
                            className={`h-full transition-all duration-500 ${kpis.pctMitigacionGlobal === 100 ? 'bg-emerald-500' : 'bg-cyan-500'}`} 
                            style={{ width: `${kpis.pctMitigacionGlobal}%` }}
                        />
                    </div>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100 col-span-2 lg:col-span-1">
                    <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Estado de Cierre</p>
                    <div className="flex items-center gap-3 mt-1">
                        <div>
                            <span className="text-xs font-bold text-emerald-600">✅ {kpis.totalCerradas}</span>
                            <span className="text-[10px] text-slate-400 ml-1">Cerradas</span>
                        </div>
                        <div>
                            <span className="text-xs font-bold text-orange-600">⏳ {kpis.totalPendientes}</span>
                            <span className="text-[10px] text-slate-400 ml-1">Pendientes</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Barra de Filtros Multicriterio */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Búsqueda */}
                    <div className="lg:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Buscar Establecimiento o Supervisor</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Escribe RBD, nombre de colegio, plantilla..."
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900"
                            />
                            <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Año */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Año</label>
                        <select
                            value={year}
                            onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="all">📅 Todos los Años</option>
                            {initialYears.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Semestre */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Semestre</label>
                        <select
                            value={semester}
                            onChange={(e) => setSemester(e.target.value === 'all' ? 'all' : Number(e.target.value) as 1 | 2)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="all">🌓 Ambos Semestres</option>
                            <option value="1">1° Semestre</option>
                            <option value="2">2° Semestre</option>
                        </select>
                    </div>

                    {/* Sucursal */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Sucursal</label>
                        <select
                            value={sucursal}
                            onChange={(e) => setSucursal(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="all">🏢 Todas las Sucursales</option>
                            {initialSucursales.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* Supervisor */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Supervisor</label>
                        <select
                            value={supervisor}
                            onChange={(e) => setSupervisor(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="all">👤 Todos los Supervisores</option>
                            {initialSupervisors.map(sup => (
                                <option key={sup.id} value={sup.username}>{sup.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Estado */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Estado de Cierre</label>
                        <select
                            value={estado}
                            onChange={(e) => setEstado(e.target.value as any)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="all">⚡ Todos los Estados</option>
                            <option value="pendiente">⏳ Pendiente</option>
                            <option value="por supervisar">🔍 Por Supervisar</option>
                            <option value="cerrado">🔒 Cerrado</option>
                        </select>
                    </div>

                    {/* Vigencia de Plantilla */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Vigencia de Plantilla</label>
                        <select
                            value={vigencia}
                            onChange={(e) => setVigencia(e.target.value as any)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="all">📋 Todas (Vigentes y No Vigentes)</option>
                            <option value="vigente">✅ Solo Plantillas Vigentes</option>
                            <option value="no_vigente">⛔ Solo Plantillas No Vigentes</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 font-bold text-xs text-center">
                    {error}
                </div>
            )}

            {/* Listado de Evaluaciones Históricas */}
            {loading ? (
                <div className="p-16 text-center bg-white rounded-3xl shadow-sm border border-gray-100">
                    <div className="inline-block animate-spin text-3xl mb-3">⏳</div>
                    <p className="text-sm font-bold text-slate-600">Cargando registros históricos...</p>
                </div>
            ) : evaluaciones.length === 0 ? (
                <div className="p-16 text-center bg-white rounded-3xl shadow-sm border border-gray-100">
                    <div className="text-4xl mb-2">🔍</div>
                    <p className="text-base font-extrabold text-slate-800">No se encontraron matrices con los filtros seleccionados.</p>
                    <p className="text-xs text-slate-400 mt-1">Prueba cambiando el año, semestre o quitando términos de búsqueda.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {paginatedItems.map((ev) => {
                            const isNonVigente = ev.cabecera.estado === false
                            const isFinal = ev.estado === 'por supervisar' || ev.estado === 'cerrado'

                            return (
                                <div
                                    key={ev.id}
                                    className={`bg-white rounded-3xl p-5 shadow-sm border transition-all hover:shadow-md flex flex-col justify-between ${
                                        isNonVigente ? 'border-rose-200/80 bg-rose-50/10' : 'border-gray-100'
                                    }`}
                                >
                                    <div>
                                        {/* Header de la tarjeta */}
                                        <div className="flex justify-between items-start gap-2">
                                            <div>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-[10px] font-black text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded-lg border border-cyan-200">
                                                        RBD {ev.rbd}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                                                        {ev.semester}° Sem {ev.cabecera.anio}
                                                    </span>
                                                    {isNonVigente && (
                                                        <span className="text-[9px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-lg border border-rose-200 uppercase tracking-wide">
                                                            ⛔ No Vigente
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="font-extrabold text-slate-900 text-sm mt-2 line-clamp-1" title={ev.nombreColegio}>
                                                    {ev.nombreColegio}
                                                </h3>
                                                <p className="text-[11px] text-slate-400 font-bold mt-0.5">{ev.sucursal}</p>
                                            </div>

                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black shrink-0 ${
                                                isFinal ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-orange-100 text-orange-800 border border-orange-200'
                                            }`}>
                                                {ev.estado.toUpperCase()}
                                            </span>
                                        </div>

                                        {/* Info plantilla & supervisor */}
                                        <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] space-y-1">
                                            <p className="text-slate-600 font-medium truncate" title={ev.cabecera.titulo}>
                                                <span className="font-bold text-slate-700">Plantilla:</span> {ev.cabecera.titulo}
                                            </p>
                                            <p className="text-slate-600 font-medium truncate">
                                                <span className="font-bold text-slate-700">Auditor:</span> {ev.supervisorNombre}
                                            </p>
                                            <p className="text-slate-400 text-[10px]">
                                                📅 {format(new Date(ev.fechaIngreso), 'dd/MM/yyyy HH:mm', { locale: es })}
                                            </p>
                                        </div>

                                        {/* Barra de Mitigación */}
                                        <div className="mt-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                            <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                                                <span className="text-slate-600 flex items-center gap-1 text-[11px]">
                                                    <span>⚠️</span> {ev.problemsCount} Hallazgos
                                                </span>
                                                <span className="text-emerald-700 flex items-center gap-1 text-[11px]">
                                                    <span>✅</span> {ev.solvedCount} Resueltos ({ev.pctSolucion}%)
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full transition-all duration-500 ${ev.pctSolucion === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                                                    style={{ width: `${ev.pctSolucion}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Botones de acción */}
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setDetailModalItem(ev)}
                                            className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5"
                                        >
                                            <span>🔍</span> Ver Hallazgos ({ev.problemsCount})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenTimeline(ev.rbd)}
                                            title="Ver línea de tiempo histórica de este colegio"
                                            className="px-3 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                                        >
                                            <span>⏳</span> Línea de Tiempo
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Paginación */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 pt-6">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                                ← Anterior
                            </button>
                            <span className="text-xs font-bold text-slate-600 px-3">
                                Página {currentPage} de {totalPages} ({evaluaciones.length} registros)
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                                Siguiente →
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Modal 1: Detalle de Hallazgos y Mitigación de la Evaluación */}
            {detailModalItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
                        {/* Header Modal */}
                        <div className="p-6 bg-slate-900 text-white flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-lg text-xs font-bold border border-cyan-400/30">
                                        RBD {detailModalItem.rbd}
                                    </span>
                                    <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg text-xs font-bold">
                                        {detailModalItem.semester}° Semestre {detailModalItem.cabecera.anio}
                                    </span>
                                </div>
                                <h2 className="text-xl font-black mt-1.5">{detailModalItem.nombreColegio}</h2>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {detailModalItem.sucursal}  •  Auditor: {detailModalItem.supervisorNombre}  •  Fecha: {format(new Date(detailModalItem.fechaIngreso), 'dd/MM/yyyy HH:mm')}
                                </p>
                            </div>
                            <button
                                onClick={() => setDetailModalItem(null)}
                                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all font-bold text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body Modal */}
                        <div className="p-6 overflow-y-auto space-y-4 flex-1">
                            {/* Alerta de No Vigente si aplica */}
                            {detailModalItem.cabecera.estado === false && (
                                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
                                    <span className="text-xl shrink-0 mt-0.5">⛔</span>
                                    <div>
                                        <p className="font-extrabold text-xs text-rose-950">Plantilla de Matriz No Vigente</p>
                                        <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed font-medium">
                                            Esta evaluación corresponde a la versión <b>"{detailModalItem.cabecera.titulo}"</b> que actualmente se encuentra <b>Desactivada / No Vigente</b> en el sistema.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Info de Geolocalización */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                                <div>
                                    <p className="font-bold text-slate-500 uppercase tracking-tight text-[10px]">📍 Geolocalización Ingreso</p>
                                    <p className="text-slate-800 font-semibold mt-0.5">
                                        {detailModalItem.latIngreso && detailModalItem.lngIngreso 
                                            ? `Lat: ${detailModalItem.latIngreso.toFixed(6)}, Lng: ${detailModalItem.lngIngreso.toFixed(6)}`
                                            : 'No registrada'}
                                    </p>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-500 uppercase tracking-tight text-[10px]">📍 Geolocalización Cierre</p>
                                    <p className="text-emerald-700 font-semibold mt-0.5">
                                        {detailModalItem.latCierre && detailModalItem.lngCierre 
                                            ? `Lat: ${detailModalItem.latCierre.toFixed(6)}, Lng: ${detailModalItem.lngCierre.toFixed(6)}`
                                            : 'Pendiente de Cierre'}
                                    </p>
                                </div>
                            </div>

                            {/* Lista de Hallazgos */}
                            <h3 className="font-extrabold text-sm text-slate-800 pt-2 flex items-center justify-between">
                                <span>Detalle de Desviaciones Encontradas ({detailModalItem.problems.length})</span>
                                <span className="text-xs font-bold text-slate-500">
                                    Resueltos: {detailModalItem.solvedCount} de {detailModalItem.problems.length}
                                </span>
                            </h3>

                            {detailModalItem.problems.length === 0 ? (
                                <div className="p-8 text-center bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-bold">
                                    ✨ Excelente: No se detectaron hallazgos negativos en esta evaluación.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {detailModalItem.problems.map((prob: any, idx: number) => {
                                        return (
                                            <div
                                                key={prob.preguntaId || idx}
                                                className={`p-4 rounded-2xl border transition-all ${
                                                    prob.isSolved ? 'bg-emerald-50/40 border-emerald-200' : 'bg-amber-50/40 border-amber-200'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-[9px] font-black px-2 py-0.5 bg-slate-200 text-slate-800 rounded">
                                                                {prob.seccion?.replace('_', ' ')}
                                                            </span>
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded ${
                                                                prob.nivelRiesgo === 3 ? 'bg-rose-100 text-rose-800' : prob.nivelRiesgo === 2 ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                                            }`}>
                                                                Riesgo Nivel {prob.nivelRiesgo} (G:{prob.gravedad} × P:{prob.probabilidad})
                                                            </span>
                                                        </div>
                                                        <p className="font-extrabold text-slate-900 text-xs mt-1">
                                                            {prob.preguntaNombre}
                                                        </p>
                                                        <p className="text-[11px] text-rose-700 font-bold">
                                                            Respuesta ingresada: {prob.respuestaValor}
                                                        </p>
                                                    </div>

                                                    <span className={`px-2 py-1 rounded-xl text-[10px] font-black shrink-0 ${
                                                        prob.isSolved ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                                                    }`}>
                                                        {prob.isSolved ? '✅ Mitigado' : '⏳ Pendiente'}
                                                    </span>
                                                </div>

                                                {/* Fotos originales */}
                                                {prob.originalPhotos && prob.originalPhotos.length > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-slate-200/60">
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1">📸 Evidencia de la Falla:</p>
                                                        <div className="flex gap-2 flex-wrap">
                                                            {prob.originalPhotos.map((url: string, pIdx: number) => (
                                                                <button
                                                                    key={pIdx}
                                                                    type="button"
                                                                    onClick={() => setPhotoViewer({ url, title: `Evidencia Falla: ${prob.preguntaNombre}` })}
                                                                    className="w-14 h-14 rounded-xl border border-slate-300 overflow-hidden bg-slate-100 hover:opacity-80 transition-all cursor-pointer"
                                                                >
                                                                    <img src={url} alt="Evidencia Falla" className="w-full h-full object-cover" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Mitigación / Solución */}
                                                {prob.isSolved && (
                                                    <div className="mt-3 p-3 bg-white/80 rounded-xl border border-emerald-200 text-xs">
                                                        <p className="font-bold text-emerald-800 text-[11px] flex items-center gap-1">
                                                            <span>✅</span> Solucionado el {format(new Date(prob.fechaSolucion), 'dd/MM/yyyy')} por {prob.usuarioMitigacion || 'Supervisor'}
                                                        </p>
                                                        {prob.mitPhotos && prob.mitPhotos.length > 0 && (
                                                            <div className="mt-2">
                                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1">📸 Evidencia de Solución:</p>
                                                                <div className="flex gap-2 flex-wrap">
                                                                    {prob.mitPhotos.map((url: string, pIdx: number) => (
                                                                        <button
                                                                            key={pIdx}
                                                                            type="button"
                                                                            onClick={() => setPhotoViewer({ url, title: `Evidencia Solución: ${prob.preguntaNombre}` })}
                                                                            className="w-14 h-14 rounded-xl border border-emerald-300 overflow-hidden bg-slate-100 hover:opacity-80 transition-all cursor-pointer"
                                                                        >
                                                                            <img src={url} alt="Evidencia Solución" className="w-full h-full object-cover" />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer Modal */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setDetailModalItem(null)}
                                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all"
                            >
                                Cerrar Detalle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal 2: Línea de Tiempo Histórica por RBD (Trazabilidad) */}
            {timelineModalRbd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
                        {/* Header Modal */}
                        <div className="p-6 bg-slate-900 text-white flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-cyan-500 text-slate-950 px-2.5 py-0.5 rounded-lg text-xs font-black">
                                        RBD {timelineModalRbd}
                                    </span>
                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                                        Línea de Tiempo y Trazabilidad Histórica
                                    </span>
                                </div>
                                <h2 className="text-xl font-black mt-1.5">{timelineData?.nombreEstablecimiento || `RBD ${timelineModalRbd}`}</h2>
                                <p className="text-xs text-slate-400 mt-0.5">{timelineData?.sucursal}</p>
                            </div>
                            <button
                                onClick={() => setTimelineModalRbd(null)}
                                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all font-bold text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body Modal */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            {loadingTimeline ? (
                                <div className="p-16 text-center">
                                    <div className="inline-block animate-spin text-3xl mb-2">⏳</div>
                                    <p className="text-xs font-bold text-slate-500">Cargando línea de tiempo del colegio...</p>
                                </div>
                            ) : !timelineData || timelineData.timeline?.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm font-medium">
                                    No hay registros de evaluaciones previas para este establecimiento.
                                </div>
                            ) : (
                                <>
                                    {/* Resumen de Hallazgos Recurrentes */}
                                    {timelineData.recurringFindings?.length > 0 && (
                                        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4">
                                            <h4 className="text-xs font-black text-amber-950 uppercase tracking-tight flex items-center gap-1.5">
                                                <span>🔁</span> Desviaciones Recurrentes en este Establecimiento
                                            </h4>
                                            <p className="text-[11px] text-amber-800 mt-0.5">
                                                Preguntas que han presentado no conformidades en más de una evaluación:
                                            </p>
                                            <div className="mt-3 space-y-2">
                                                {timelineData.recurringFindings.slice(0, 5).map((rec: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-amber-200 text-xs">
                                                        <span className="font-bold text-slate-800 line-clamp-1 flex-1 pr-2">{rec.name}</span>
                                                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-lg font-black text-[10px] shrink-0">
                                                            {rec.count} veces detectado ({rec.solvedCount} mitigados)
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Timeline Cronológico */}
                                    <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                                        {timelineData.timeline.map((item: any, idx: number) => {
                                            const isNonVigente = item.plantillaVigente === false
                                            return (
                                                <div key={item.id || idx} className="relative">
                                                    {/* Punto en el timeline */}
                                                    <div className={`absolute -left-6 top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-xs ${
                                                        item.pctSolucion === 100 ? 'bg-emerald-500' : 'bg-cyan-500'
                                                    }`} />

                                                    <div className={`p-4 rounded-2xl border transition-all ${
                                                        isNonVigente ? 'bg-rose-50/20 border-rose-200' : 'bg-white border-slate-200 shadow-xs'
                                                    }`}>
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div>
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="text-xs font-black text-slate-900">
                                                                        {item.semester}° Semestre {item.year}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-bold">
                                                                        • {format(new Date(item.fechaIngreso), 'dd/MM/yyyy HH:mm')}
                                                                    </span>
                                                                    {isNonVigente && (
                                                                        <span className="text-[9px] font-black text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded border border-rose-200 uppercase">
                                                                            ⛔ No Vigente
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[11px] text-slate-600 mt-1">
                                                                    <span className="font-bold">Plantilla:</span> {item.plantillaTitulo} | <span className="font-bold">Auditor:</span> {item.supervisorNombre}
                                                                </p>
                                                            </div>

                                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${
                                                                item.estado === 'cerrado' || item.estado === 'por supervisar' 
                                                                    ? 'bg-emerald-100 text-emerald-800' 
                                                                    : 'bg-orange-100 text-orange-800'
                                                            }`}>
                                                                {item.estado.toUpperCase()}
                                                            </span>
                                                        </div>

                                                        {/* Hallazgos y porcentaje */}
                                                        <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                                                            <span className="text-slate-600 font-bold text-[11px]">
                                                                ⚠️ {item.totalHallazgos} Hallazgos ({item.totalMitigados} mitigados)
                                                            </span>
                                                            <span className="text-cyan-700 font-black text-[11px]">
                                                                {item.pctSolucion}% Cumplimiento
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer Modal */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setTimelineModalRbd(null)}
                                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all"
                            >
                                Cerrar Trazabilidad
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal 3: Visor de Fotos Ampliadas */}
            {photoViewer && (
                <div 
                    onClick={() => setPhotoViewer(null)}
                    className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
                >
                    <div className="bg-slate-900 p-4 rounded-3xl max-w-2xl w-full border border-slate-700" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center text-white mb-3">
                            <p className="text-xs font-bold truncate">{photoViewer.title}</p>
                            <button onClick={() => setPhotoViewer(null)} className="text-slate-400 hover:text-white text-lg font-bold">✕</button>
                        </div>
                        <div className="rounded-2xl overflow-hidden bg-black max-h-[70vh] flex items-center justify-center">
                            <img src={photoViewer.url} alt={photoViewer.title} className="max-h-full max-w-full object-contain" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
