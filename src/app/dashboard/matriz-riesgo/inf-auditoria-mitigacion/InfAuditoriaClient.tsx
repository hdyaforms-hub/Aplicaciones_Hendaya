'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { searchColegiosMatriz } from '../actions' // Reutilizar del action de matriz-riesgo
import { getFechasLevantamiento, getReporteData } from './actions'
import { ReportePDF } from './ReportePDF'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export default function InfAuditoriaClient({ licitaciones, plantillas }: { licitaciones: any[], plantillas: any[] }) {
    const [licId, setLicId] = useState<number | ''>('')
    const [plantillaId, setPlantillaId] = useState<string>('')
    const [selectedRbd, setSelectedRbd] = useState<number | ''>('')
    const [fechaId, setFechaId] = useState<string>('')

    const [fechas, setFechas] = useState<any[]>([])
    
    // Search Autocomplete state
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)

    const [reporteData, setReporteData] = useState<any>(null)
    const [loadingReporte, setLoadingReporte] = useState(false)
    const [generatingPdf, setGeneratingPdf] = useState(false)

    const pdfRef = useRef<HTMLDivElement>(null)

    const plantillasFiltradas = useMemo(() => {
        if (!licId) return []
        return plantillas.filter(p => p.licId === licId)
    }, [licId, plantillas])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSearch = async (query: string) => {
        setSearchQuery(query)
        if (query.length < 3) {
            setSearchResults([])
            setShowDropdown(false)
            return
        }
        
        setIsSearching(true)
        setShowDropdown(true)
        const res = await searchColegiosMatriz(query)
        setSearchResults(res.colegios || [])
        setIsSearching(false)
    }

    const selectColegio = (col: any) => {
        setSelectedRbd(col.colRBD)
        setSearchQuery(`${col.colRBD} - ${col.nombreEstablecimiento}`)
        setShowDropdown(false)
        setFechaId('') // reset fecha
        setReporteData(null)
    }

    // Load Fechas when Lic, Plantilla and RBD are selected
    useEffect(() => {
        const loadFechas = async () => {
            if (licId && plantillaId && selectedRbd) {
                const res = await getFechasLevantamiento(Number(licId), plantillaId, Number(selectedRbd))
                if (res.success) {
                    setFechas(res.fechas || [])
                } else {
                    setFechas([])
                }
            } else {
                setFechas([])
            }
        }
        loadFechas()
    }, [licId, plantillaId, selectedRbd])

    const handleEmitir = async () => {
        if (!fechaId) return alert('Seleccione una fecha de levantamiento.')
        
        setLoadingReporte(true)
        setReporteData(null)
        const res = await getReporteData(fechaId)
        if (res.success) {
            setReporteData(res)
        } else {
            alert(res.error || 'Error al cargar el reporte.')
        }
        setLoadingReporte(false)
    }

    const handleExportarPdf = async () => {
        if (!pdfRef.current || !reporteData) return;

        setGeneratingPdf(true);
        try {
            const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            // Si el reporte es más largo que una hoja, lo ideal sería paginarlo, pero html2canvas toma todo de corrido
            // Para mantener el diseño idéntico, lo insertamos como imagen.
            let heightLeft = pdfHeight;
            let position = 0;
            const pageHeight = pdf.internal.pageSize.getHeight();

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`Informe_Auditoria_${reporteData.respuestaCabecera.rbd}_${new Date().getTime()}.pdf`);
        } catch (error: any) {
            console.error('Error exportando PDF:', error);
            alert('Ocurrió un error al generar el PDF: ' + (error?.message || error));
        } finally {
            setGeneratingPdf(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* Filtros */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Licitación</label>
                    <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-slate-800 font-bold text-sm"
                        value={licId}
                        onChange={e => {
                            setLicId(e.target.value ? Number(e.target.value) : '')
                            setPlantillaId('')
                            setReporteData(null)
                        }}
                    >
                        <option value="">Seleccione Licitación</option>
                        {licitaciones.map(l => (
                            <option key={l.licId} value={l.licId}>{l.licitacionHomologada}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Plantilla de Matriz</label>
                    <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-slate-800 font-bold text-sm disabled:opacity-50"
                        value={plantillaId}
                        onChange={e => { setPlantillaId(e.target.value); setReporteData(null); }}
                        disabled={!licId}
                    >
                        <option value="">Seleccione Plantilla</option>
                        {plantillasFiltradas.map(p => (
                            <option key={p.id} value={p.id}>{p.titulo}</option>
                        ))}
                    </select>
                </div>
                <div className="relative" ref={searchRef}>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">RBD / Establecimiento</label>
                    <input 
                        type="text"
                        placeholder="Buscar colegio..."
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-slate-800 font-bold text-sm"
                        value={searchQuery}
                        onChange={e => {
                            handleSearch(e.target.value)
                            if (selectedRbd && !e.target.value.includes(String(selectedRbd))) {
                                setSelectedRbd('')
                                setFechaId('')
                                setReporteData(null)
                            }
                        }}
                        onFocus={() => {
                            if (searchQuery.length >= 3) setShowDropdown(true)
                        }}
                    />
                    {showDropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                            {isSearching ? (
                                <div className="p-3 text-sm text-slate-500 text-center">Buscando...</div>
                            ) : searchResults.length > 0 ? (
                                <ul className="py-1">
                                    {searchResults.map(col => (
                                        <li 
                                            key={col.id}
                                            onClick={() => selectColegio(col)}
                                            className="px-4 py-2 hover:bg-cyan-50 cursor-pointer text-sm text-slate-700"
                                        >
                                            <span className="font-bold text-cyan-800">{col.colRBD}</span> - {col.nombreEstablecimiento}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="p-3 text-sm text-slate-500 text-center">No se encontraron colegios.</div>
                            )}
                        </div>
                    )}
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha Levantamiento</label>
                    <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-slate-800 font-bold text-sm disabled:opacity-50"
                        value={fechaId}
                        onChange={e => { setFechaId(e.target.value); setReporteData(null); }}
                        disabled={!licId || !plantillaId || !selectedRbd}
                    >
                        <option value="">Seleccione Fecha</option>
                        {fechas.map(f => {
                            const d = new Date(f.fechaIngreso)
                            const label = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
                            return (
                                <option key={f.id} value={f.id}>{label}</option>
                            )
                        })}
                    </select>
                </div>
            </div>

            {/* Acciones */}
            <div className="flex justify-end gap-4">
                <button
                    onClick={handleEmitir}
                    disabled={!fechaId || loadingReporte}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-md transition-all"
                >
                    {loadingReporte ? 'Cargando...' : 'Emitir Informe'}
                </button>
                {reporteData && (
                    <button
                        onClick={handleExportarPdf}
                        disabled={generatingPdf}
                        className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-2"
                    >
                        {generatingPdf ? 'Generando PDF...' : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                Exportar a PDF
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Contenedor del Reporte Visual */}
            {reporteData && (
                <div className="bg-slate-100 p-8 rounded-3xl overflow-auto flex justify-center shadow-inner border border-slate-200">
                    <div className="shadow-2xl bg-white border border-slate-300">
                        <ReportePDF data={reporteData} divRef={pdfRef} />
                    </div>
                </div>
            )}
        </div>
    )
}
