'use client'

import React, { useState, useEffect, useRef } from 'react'
import { searchColegiosConMatriz, getUltimoReporteHojaB } from './actions'
import { ReporteHojaBPDF } from './ReporteHojaBPDF'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

export default function HojaBClient() {
    const [query, setQuery] = useState('')
    const [colegios, setColegios] = useState<any[]>([])
    const [loadingSearch, setLoadingSearch] = useState(false)
    const [selectedColegio, setSelectedColegio] = useState<any | null>(null)
    const [reporteData, setReporteData] = useState<any | null>(null)
    const [loadingReporte, setLoadingReporte] = useState(false)
    const [generatingPDF, setGeneratingPDF] = useState(false)
    const [generatingExcel, setGeneratingExcel] = useState(false)
    
    const divRef = useRef<HTMLDivElement | null>(null)

    // Debounce de búsqueda
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (query.trim().length >= 3) {
                buscarColegios(query)
            } else {
                setColegios([])
            }
        }, 300)

        return () => clearTimeout(delayDebounceFn)
    }, [query])

    async function buscarColegios(q: string) {
        setLoadingSearch(true)
        const res = await searchColegiosConMatriz(q)
        setLoadingSearch(false)
        if (res.success) {
            setColegios(res.colegios || [])
        }
    }

    async function handleSelectColegio(colegio: any) {
        setSelectedColegio(colegio)
        setQuery(`${colegio.colRBD} - ${colegio.nombreEstablecimiento}`)
        setColegios([])
        setLoadingReporte(true)
        setReporteData(null)

        const res = await getUltimoReporteHojaB(colegio.colRBD)
        setLoadingReporte(false)
        if (res.success) {
            setReporteData(res)
        } else {
            alert(res.error || 'Ocurrió un error al cargar el reporte.')
        }
    }

    const exportarExcel = async () => {
        if (!reporteData) return;
        setGeneratingExcel(true);
        
        try {
            const { respuestaCabecera } = reporteData;
            const plantilla = respuestaCabecera.cabecera;

            const formatFecha = (fecha: any) => {
                if (!fecha) return '';
                const d = new Date(fecha);
                return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
            }

            const calculateFechasTope = (fechaIngreso: Date, nivelRiesgo: number) => {
                let dias = 30;
                if (nivelRiesgo === 1) dias = 90;
                else if (nivelRiesgo === 2) dias = 60;
                
                const d = new Date(fechaIngreso);
                d.setDate(d.getDate() + dias);
                const plazo = formatFecha(d);

                const dSeguimiento = new Date(d);
                dSeguimiento.setMonth(dSeguimiento.getMonth() + 2);
                dSeguimiento.setDate(0); 
                const seguimiento = formatFecha(dSeguimiento);

                return { plazo, seguimiento };
            }

            const mapNivel = (nivel: number | null | undefined) => {
                if (nivel === 1) return 'Bajo';
                if (nivel === 2) return 'Medio';
                if (nivel === 3) return 'Alto';
                return 'No aplica';
            }

            const getTextoNivelRiesgo = (nivel: number | null | undefined) => {
                if (nivel === 1) return 'Bajo riesgo: Resolver (eliminar o mitigar) en menos de 90 días';
                if (nivel === 2) return 'Medio riesgo: Resolver (eliminar o mitigar) en menos de 60 días';
                if (nivel === 3) return 'Alto riesgo: Resolver (eliminar o mitigar) en menos de 30 días';
                return 'No aplica';
            }

            const BAD_VALUES = ['NO', 'NO_EXISTE', 'MALO_NO_CUMPLE', 'NO_HAY_REQUIERE'];
            const isFinding = (valor: string) => BAD_VALUES.includes(valor);

            const secciones = [
                { key: 'PATIO_SERVICIO', titulo: 'Patio de servicio y entorno', color: 'FFF2CC' },
                { key: 'BODEGA', titulo: 'Bodega', color: 'FCE4D6' },
                { key: 'COCINA', titulo: 'Cocina', color: 'E2EFDA' },
                { key: 'BANO', titulo: 'Baño', color: 'DDEBF7' },
                { key: 'LEVANTAMIENTO_GENERAL', titulo: 'Levantamiento General', color: 'DAE3F3' }
            ];

            const tiposExcluidos = ['OBSERVACION', 'ADJUNTAR', 'NUMERICO'];

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Matriz de Riesgo');

            // Definir las columnas
            const columns = [
                { header: 'Requisito', key: 'req', width: 50 },
                { header: 'Cumple (Si/No)', key: 'cumple', width: 15 },
                { header: 'Desviación', key: 'desv', width: 30 },
                { header: 'Impacto en inocuidad', key: 'impacto', width: 20 },
                { header: 'Probabilidad ocurrencia', key: 'prob', width: 25 },
                { header: 'Justificación', key: 'just', width: 40 },
                { header: 'Gravedad impacto', key: 'grav', width: 20 },
                { header: 'Nivel de riesgo', key: 'riesgo', width: 30 },
                { header: 'Medida de Control', key: 'medida', width: 40 },
                { header: 'Recursos Necesarios', key: 'rec', width: 40 },
                { header: 'Resultados esperados', key: 'res', width: 40 },
                { header: 'Resp. Implementación', key: 'respImpl', width: 25 },
                { header: 'Plazo implement.', key: 'plazo', width: 20 },
                { header: 'Fecha seguimiento', key: 'seg', width: 20 },
                { header: 'Resp. seguimiento', key: 'respSeg', width: 25 },
                { header: 'Evidencia cumplimiento', key: 'evCump', width: 35 },
                { header: 'Evidencia eficacia', key: 'evEfic', width: 35 }
            ];

            worksheet.columns = columns;

            // Estilos para la cabecera (Header Row)
            worksheet.getRow(1).eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // slate-800
                cell.font = { color: { argb: 'FFE2E8F0' }, bold: true, size: 11 }; // slate-200
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            });
            worksheet.getRow(1).height = 40;

            secciones.forEach(sec => {
                const preguntas = plantilla.detalles
                    .filter((d: any) => d.seccion === sec.key && !tiposExcluidos.includes(d.tipoRespuesta))
                    .sort((a: any, b: any) => a.orden - b.orden);

                if (preguntas.length > 0) {
                    // Fila de título de sección
                    const sectionRow = worksheet.addRow([sec.titulo.toUpperCase()]);
                    worksheet.mergeCells(`A${sectionRow.number}:Q${sectionRow.number}`);
                    const secCell = sectionRow.getCell(1);
                    secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${sec.color}` } };
                    secCell.font = { bold: true, size: 12, color: { argb: 'FF1E293B' } };
                    secCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                    secCell.border = { top: {style:'medium'}, bottom: {style:'medium'}, left: {style:'medium'}, right: {style:'medium'} };
                    sectionRow.height = 30;

                    preguntas.forEach((p: any) => {
                        const respuesta = respuestaCabecera.detalles.find((r: any) => r.preguntaId === p.id);
                        const valorRespuesta = respuesta?.valor || '';
                        const finding = isFinding(valorRespuesta);
                        const nivel = p.nivelRiesgo || p.gravedad || 3;
                        const { plazo, seguimiento } = finding ? calculateFechasTope(respuestaCabecera.fechaIngreso, nivel) : { plazo: '', seguimiento: '' };

                        const rowValues = [
                            p.preguntaNombre,
                            finding ? 'No' : 'Si',
                            finding ? 'No cumple condición' : 'No Aplica',
                            finding ? 'SI' : 'No Aplica',
                            finding ? mapNivel(p.probabilidad) : 'No Aplica',
                            finding ? (p.justificacion || 'No Aplica') : 'No Aplica',
                            finding ? mapNivel(p.gravedad) : 'No Aplica',
                            finding ? getTextoNivelRiesgo(nivel) : 'No Aplica',
                            finding ? (p.riesgoSignificativo || 'No Aplica') : 'No Aplica',
                            finding ? (p.recursoNecesario || 'No Aplica') : 'No Aplica',
                            finding ? (p.resultadoEsperado || 'No Aplica') : 'No Aplica',
                            finding ? (p.respImplementacion || 'No Aplica') : 'No Aplica',
                            plazo || '',
                            seguimiento || '',
                            finding ? (p.respSeguimiento || 'No Aplica') : 'No Aplica',
                            finding ? (p.evidenciaCumplimiento || 'No Aplica') : 'No Aplica',
                            finding ? (p.evidenciaEficacia || 'No Aplica') : 'No Aplica'
                        ];

                        const row = worksheet.addRow(rowValues);

                        // Estilos para la fila de datos
                        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                            cell.border = { top: {style:'thin', color:{argb:'FFE2E8F0'}}, left: {style:'thin', color:{argb:'FFE2E8F0'}}, bottom: {style:'thin', color:{argb:'FFE2E8F0'}}, right: {style:'thin', color:{argb:'FFE2E8F0'}} };
                            cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'center', wrapText: true };
                            cell.font = { color: { argb: finding && colNumber === 2 ? 'FFEF4444' : 'FF334155' } };
                            if (!finding && colNumber === 2) cell.font = { color: { argb: 'FF16A34A' }, bold: true };
                            if (finding && colNumber === 2) cell.font = { color: { argb: 'FFEF4444' }, bold: true };
                        });
                        
                        // Añadir borde grueso izquierdo del color del área a la primera celda
                        row.getCell(1).border = { ...row.getCell(1).border as any, left: { style: 'thick', color: { argb: `FF${sec.color}` } } };
                    });
                }
            });

            // Escribir el archivo
            const buffer = await workbook.xlsx.writeBuffer();
            const nombreArchivo = `HojaB_${selectedColegio?.colRBD || 'Establecimiento'}_${new Date().toISOString().split('T')[0]}.xlsx`;
            saveAs(new Blob([buffer]), nombreArchivo);

        } catch (error: any) {
            console.error('Error generando Excel:', error);
            alert('Error al generar el Excel: ' + (error?.message || error));
        } finally {
            setGeneratingExcel(false);
        }
    }

    const exportarPDF = async () => {
        if (!divRef.current || !reporteData) return;
        setGeneratingPDF(true)

        try {
            const canvas = await html2canvas(divRef.current, {
                scale: 1.0, // Reducir la escala para evitar errores de memoria en navegadores
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                windowWidth: divRef.current.scrollWidth,
                windowHeight: divRef.current.scrollHeight
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.9);
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            const nombreArchivo = `HojaB_${selectedColegio?.colRBD || 'Establecimiento'}_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(nombreArchivo);
        } catch (error: any) {
            console.error('Error generando PDF:', error);
            alert('Error al generar el PDF: ' + (error?.message || error));
        } finally {
            setGeneratingPDF(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Buscador */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <h2 className="block text-sm font-black text-slate-700 uppercase tracking-wider mb-4">Criterio de Búsqueda</h2>
                <div className="relative max-w-2xl">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        RBD / Nombre Establecimiento
                    </label>
                    <div className="relative flex gap-4">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value)
                                    if (selectedColegio) {
                                        setSelectedColegio(null)
                                        setReporteData(null)
                                    }
                                }}
                                className="w-full pl-12 pr-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:bg-white outline-none text-slate-800 font-bold text-sm transition-all shadow-inner placeholder-slate-400"
                                placeholder="Escribe al menos 3 caracteres..."
                            />
                            <svg className="absolute left-4 top-4 text-slate-400 w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    {/* Resultados del autocompletado */}
                    {colegios.length > 0 && !selectedColegio && (
                        <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-80 overflow-y-auto">
                            <ul className="py-2">
                                {colegios.map((col) => (
                                    <li
                                        key={col.colRBD}
                                        className="px-6 py-3 hover:bg-cyan-50 cursor-pointer text-sm text-slate-700 border-b border-slate-100 last:border-0 transition-colors"
                                        onClick={() => handleSelectColegio(col)}
                                    >
                                        <span className="font-black text-cyan-600 text-base">{col.colRBD}</span> <span className="text-slate-400 mx-2">|</span> <span className="font-bold">{col.nombreEstablecimiento}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {loadingSearch && (
                        <div className="absolute right-6 top-11 text-xs font-bold text-cyan-400 animate-pulse">Buscando...</div>
                    )}
                </div>
            </div>

            {/* Acciones del reporte */}
            {reporteData && (
                <div className="flex justify-end items-center gap-4">
                    <button
                        onClick={exportarExcel}
                        disabled={generatingExcel}
                        className={`px-6 py-3 rounded-xl font-bold text-white transition-all shadow-md flex items-center gap-2 
                            ${generatingExcel 
                                ? 'bg-slate-400 cursor-not-allowed' 
                                : 'bg-green-600 hover:bg-green-700 active:scale-95'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {generatingExcel ? 'Exportando...' : 'Exportar a Excel'}
                    </button>
                    <button
                        onClick={exportarPDF}
                        disabled={generatingPDF}
                        className={`px-6 py-3 rounded-xl font-bold text-white transition-all shadow-md flex items-center gap-2 
                            ${generatingPDF 
                                ? 'bg-slate-400 cursor-not-allowed' 
                                : 'bg-red-600 hover:bg-red-700 active:scale-95'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {generatingPDF ? 'Exportando...' : 'Exportar a PDF'}
                    </button>
                </div>
            )}

            {/* Loading general */}
            {loadingReporte && (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
                </div>
            )}

            {/* Vista previa PDF */}
            {reporteData && (
                <div className="bg-slate-100 p-8 rounded-3xl overflow-auto max-h-[75vh] shadow-inner border border-slate-200 custom-scrollbar">
                    <div className="inline-block min-w-full shadow-2xl bg-white border border-slate-300 rounded-2xl">
                        <ReporteHojaBPDF data={reporteData} divRef={divRef} />
                    </div>
                </div>
            )}
        </div>
    )
}
