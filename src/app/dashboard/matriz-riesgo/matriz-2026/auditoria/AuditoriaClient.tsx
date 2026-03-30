'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'

export default function AuditoriaClient({
    matrices,
    colegios,
    mitigaciones,
    riskConfigs,
    SECCIONES,
    PREGUNTAS,
    FIELD_MAPPING,
    PROBLEM_VALUES
}: {
    matrices: any[],
    colegios: any[],
    mitigaciones: any[],
    riskConfigs: any[],
    SECCIONES: any[],
    PREGUNTAS: any[],
    FIELD_MAPPING: Record<string, string>,
    PROBLEM_VALUES: string[]
}) {
    const [selectedMatriz, setSelectedMatriz] = useState<any | null>(null)
    const [selectedMedia, setSelectedMedia] = useState<string | null>(null)

    // Enriquecer matrices con nombre de colegio y conteo de hallazgos
    const enrichedMatrices = useMemo(() => {
        return matrices.map(m => {
            const colegio = colegios.find(c => c.colRBD === m.rbd)
            
            let totalPreguntas = 0
            let hallazgos = 0
            
            PREGUNTAS.forEach(p => {
                const fieldName = FIELD_MAPPING[p.id]
                if (fieldName && m[fieldName]) {
                    totalPreguntas++
                    if (PROBLEM_VALUES.includes(m[fieldName])) {
                        hallazgos++
                    }
                }
            })

            const cumplimiento = totalPreguntas > 0 ? ((totalPreguntas - hallazgos) / totalPreguntas) * 100 : 0

            return {
                ...m,
                colegioNombre: colegio?.nombreEstablecimiento || 'Desconocido',
                ut: colegio?.colut || 'S/I',
                hallazgos,
                totalPreguntas,
                cumplimiento
            }
        })
    }, [matrices, colegios, PREGUNTAS, FIELD_MAPPING, PROBLEM_VALUES])

    // Función para extraer fotos originales de la matriz por sección
    const getOriginalPhotos = (matriz: any, seccionId: string) => {
        try {
            const adjKey = `adjuntos_${seccionId}`
            if (matriz[adjKey]) {
                const parsed = JSON.parse(matriz[adjKey])
                return Array.isArray(parsed) ? parsed : []
            }
        } catch (e) {
            return []
        }
        return []
    }

    const handleExportExcel = async () => {
        if (!selectedMatriz) return

        const XLSX = await import('xlsx')

        // Fetch UT if possible from enriched matrices
        const enriched = enrichedMatrices.find(e => e.id === selectedMatriz.id)

        const row: any = {
            'UT': enriched?.ut || 'S/I',
            'RBD': selectedMatriz.rbd,
            'Nombre_establecimiento': selectedMatriz.colegioNombre,
            'Fecha': format(new Date(selectedMatriz.createdAt), 'dd/MM/yyyy')
        }

        PREGUNTAS.forEach(p => {
            const fieldName = FIELD_MAPPING[p.id]
            row[p.text] = selectedMatriz[fieldName] || 'Sin Respuesta'
        })

        // Ultimas 4 columnas de foto
        row['Foto Patio'] = getOriginalPhotos(selectedMatriz, 'patio').length > 0 ? 'si' : 'no'
        row['Foto Bodega'] = getOriginalPhotos(selectedMatriz, 'bodega').length > 0 ? 'si' : 'no'
        row['Foto Cocina'] = getOriginalPhotos(selectedMatriz, 'cocina').length > 0 ? 'si' : 'no'
        row['Foto Baño'] = getOriginalPhotos(selectedMatriz, 'bano').length > 0 ? 'si' : 'no'

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet([row])
        XLSX.utils.book_append_sheet(wb, ws, "Auditoria")
        XLSX.writeFile(wb, `Auditoria_RBD_${selectedMatriz.rbd}.xlsx`)
    }

    const handleExportPDF = async () => {
        if (!selectedMatriz) return
        
        const { default: jsPDF } = await import('jspdf')
        const { default: autoTable } = await import('jspdf-autotable')

        const doc = new jsPDF()
        
        doc.setFontSize(16)
        doc.text(`Auditoría - ${selectedMatriz.colegioNombre} (RBD: ${selectedMatriz.rbd})`, 14, 20)
        doc.setFontSize(10)
        doc.text(`Fecha Evaluación: ${format(new Date(selectedMatriz.createdAt), 'dd/MM/yyyy')}`, 14, 28)
        
        let currentY = 35

        SECCIONES.forEach(sec => {
            const preguntasSeccion = PREGUNTAS.filter(p => p.seccion === sec.id)
            const fotos = getOriginalPhotos(selectedMatriz, sec.id)
            
            const tableData = preguntasSeccion.map(p => {
                const fieldName = FIELD_MAPPING[p.id]
                return [p.text, selectedMatriz[fieldName] || 'Sin Respuesta']
            })
            
            tableData.push([`¿Existen fotos de evidencia para ${sec.nombre}?`, fotos.length > 0 ? 'Sí' : 'No'])

            autoTable(doc, {
                startY: currentY,
                head: [[sec.nombre, 'Respuesta / Estado']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [14, 116, 144] }, // bg-cyan-700 approx
                styles: { fontSize: 8 },
                columnStyles: {
                    0: { cellWidth: 130 },
                    1: { cellWidth: 50 }
                }
            })
            currentY = (doc as any).lastAutoTable.finalY + 10
            
            if (currentY > 270) {
                doc.addPage()
                currentY = 20
            }
        })

        doc.save(`Auditoria_RBD_${selectedMatriz.rbd}.pdf`)
    }

    const handleExportAllExcel = async () => {
        if (enrichedMatrices.length === 0) return

        const XLSX = await import('xlsx')

        const rows = enrichedMatrices.map(m => {
            const row: any = {
                'UT': m.ut,
                'RBD': m.rbd,
                'Nombre_establecimiento': m.colegioNombre,
                'Fecha': format(new Date(m.createdAt), 'dd/MM/yyyy')
            }

            PREGUNTAS.forEach(p => {
                const fieldName = FIELD_MAPPING[p.id]
                row[p.text] = m[fieldName] || 'Sin Respuesta'
            })

            row['Foto Patio'] = getOriginalPhotos(m, 'patio').length > 0 ? 'si' : 'no'
            row['Foto Bodega'] = getOriginalPhotos(m, 'bodega').length > 0 ? 'si' : 'no'
            row['Foto Cocina'] = getOriginalPhotos(m, 'cocina').length > 0 ? 'si' : 'no'
            row['Foto Baño'] = getOriginalPhotos(m, 'bano').length > 0 ? 'si' : 'no'

            return row
        })

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, "Consolidado")
        XLSX.writeFile(wb, `Auditoria_Consolidado_2026.xlsx`)
    }

    if (selectedMatriz) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md p-6 rounded-3xl shadow-md border border-slate-200 mb-8 mt-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <button 
                            onClick={() => setSelectedMatriz(null)}
                            className="bg-slate-800 text-white hover:bg-slate-700 hover:scale-105 transition-all shadow-md px-6 py-3 rounded-full text-sm font-black flex items-center gap-2 mb-3"
                        >
                            <span className="text-lg">←</span> VOLVER A LA LISTA
                        </button>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">
                            {selectedMatriz.colegioNombre} <span className="text-slate-400 font-medium text-xl block sm:inline">| RBD: {selectedMatriz.rbd}</span>
                        </h2>
                        <p className="text-xs font-black text-slate-500 mt-2 uppercase tracking-widest bg-slate-100 inline-block px-3 py-1 rounded-full">
                            Evaluado el {format(new Date(selectedMatriz.createdAt), 'dd/MM/yyyy')}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                        <div className={`text-4xl font-black bg-slate-50 px-6 py-2 rounded-2xl border ${selectedMatriz.hallazgos > 0 ? 'text-red-500 border-red-100' : 'text-emerald-500 border-emerald-100'}`}>
                            {selectedMatriz.hallazgos} <span className="text-lg text-slate-400 font-medium tracking-normal">Hallazgos</span>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button 
                                onClick={handleExportExcel}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 transition-colors px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm"
                            >
                                <span>📊</span> Excel
                            </button>
                            <button 
                                onClick={handleExportPDF}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-50 text-red-700 hover:bg-red-600 hover:text-white border border-red-200 transition-colors px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm"
                            >
                                <span>📄</span> PDF
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-12">
                    {SECCIONES.map(sec => {
                        const preguntasSeccion = PREGUNTAS.filter(p => p.seccion === sec.id)
                        const fotosOriginales = getOriginalPhotos(selectedMatriz, sec.id)

                        return (
                            <div key={sec.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                                <div className={`px-8 py-5 flex justify-between items-center ${sec.color}`}>
                                    <h3 className={`text-lg font-black uppercase tracking-widest ${sec.textColor}`}>
                                        {sec.nombre}
                                    </h3>
                                    {fotosOriginales.length > 0 && (
                                        <div className="flex gap-2">
                                            {fotosOriginales.map((foto, i) => (
                                                <div 
                                                    key={i}
                                                    onClick={() => setSelectedMedia(foto)}
                                                    className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 cursor-pointer overflow-hidden ring-2 ring-white/50 transition-all shadow-sm"
                                                    title="Evidencia Original de Terreno"
                                                >
                                                    <img src={foto} alt="Evidencia" className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {preguntasSeccion.map(p => {
                                        const fieldName = FIELD_MAPPING[p.id]
                                        const responseValue = selectedMatriz[fieldName] || 'Sin Respuesta'
                                        const isProblem = PROBLEM_VALUES.includes(responseValue)
                                        const mitigacion = mitigaciones.find(mit => mit.matrizId === selectedMatriz.id && mit.preguntaId === p.id)
                                        
                                        const isSolved = isProblem && mitigacion?.fechaSolucion
                                        
                                        let mitigacionAdjuntos: string[] = []
                                        try {
                                            if (mitigacion?.adjuntos) {
                                                mitigacionAdjuntos = JSON.parse(mitigacion.adjuntos)
                                            }
                                        } catch(e) {}

                                        return (
                                            <div key={p.id} className="p-8 hover:bg-slate-50/50 transition-colors flex flex-col lg:flex-row gap-6">
                                                <div className="flex-1">
                                                    <p className="text-slate-800 font-bold text-base leading-relaxed">{p.text}</p>
                                                    <div className="mt-2 text-sm text-slate-500 font-medium">
                                                        Respuesta: <span className="text-slate-700 italic border-b border-slate-200 pb-0.5">{responseValue}</span>
                                                    </div>
                                                </div>
                                                <div className="lg:w-1/3 shrink-0 flex items-center justify-end">
                                                    {!isProblem ? (
                                                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                                                            <span className="text-xl">✅</span>
                                                            <span className="font-bold text-sm">Cumple</span>
                                                        </div>
                                                    ) : (
                                                        <div className="w-full">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estado de Mitigación</span>
                                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${isSolved ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                                    {isSolved ? 'Solucionado' : 'Pendiente'}
                                                                </span>
                                                            </div>
                                                            {/* Barra de progreso visual con interactividad */}
                                                            <div 
                                                                className={`h-6 rounded-full overflow-hidden flex bg-slate-100 shadow-inner ${isSolved && mitigacionAdjuntos.length > 0 ? 'cursor-pointer hover:ring-2 hover:ring-cyan-400 group relative' : ''}`}
                                                                onClick={() => {
                                                                    if (isSolved && mitigacionAdjuntos.length > 0) {
                                                                        // Mostrar la primera evidencia como modal
                                                                        setSelectedMedia(mitigacionAdjuntos[0])
                                                                    }
                                                                }}
                                                            >
                                                                <div 
                                                                    className={`h-full transition-all duration-1000 flex items-center justify-center ${isSolved ? 'w-full bg-gradient-to-r from-cyan-400 to-sky-500' : 'w-[10%] bg-gradient-to-r from-red-400 to-rose-500'}`}
                                                                >
                                                                    {isSolved && (
                                                                        <span className="text-[10px] font-black text-white drop-shadow-sm">100%</span>
                                                                    )}
                                                                </div>
                                                                {isSolved && mitigacionAdjuntos.length > 0 && (
                                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 text-white text-[10px] font-black tracking-widest uppercase">
                                                                        Ver Solución 🔍
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {isSolved && mitigacion?.fechaSolucion && (
                                                                <p className="text-[10px] text-slate-400 font-medium mt-1.5 text-right">
                                                                    El {format(new Date(mitigacion.fechaSolucion), 'dd/MM/yyyy')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Modal para ver imagen o documento */}
                {selectedMedia && (
                    <div 
                        className="fixed inset-0 z-[100] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity"
                        onClick={() => setSelectedMedia(null)}
                    >
                        <div className="relative w-full max-w-6xl max-h-[95vh] flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
                            <button 
                                className="absolute -top-12 right-0 w-10 h-10 bg-white/10 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-2xl font-bold transition-colors z-10"
                                onClick={() => setSelectedMedia(null)}
                            >
                                &times;
                            </button>
                            {selectedMedia.toLowerCase().endsWith('.pdf') ? (
                                <iframe 
                                    src={selectedMedia} 
                                    className="w-full h-[85vh] rounded-2xl shadow-2xl bg-white"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <img 
                                    src={selectedMedia} 
                                    alt="Evidencia" 
                                    className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl ring-1 ring-white/10"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="animate-in fade-in duration-500 space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-slate-500 font-bold px-4">Mostrando <span className="text-slate-800">{enrichedMatrices.length}</span> evaluaciones</p>
                {enrichedMatrices.length > 0 && (
                    <button 
                        onClick={handleExportAllExcel}
                        className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 transition-colors px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider shadow-sm"
                    >
                        <span>📊</span> Descargar información para sostenedor
                    </button>
                )}
            </div>

            {enrichedMatrices.length === 0 ? (
                <div className="bg-white p-20 rounded-[3rem] shadow-sm border border-slate-100 text-center">
                    <span className="text-6xl block mb-4">📭</span>
                    <h3 className="text-2xl font-black text-slate-800">No hay matrices evaluadas</h3>
                    <p className="text-slate-500 font-medium">No se han ingresado evaluaciones para el año 2026 aún.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {enrichedMatrices.map(m => (
                        <div 
                            key={m.id}
                            onClick={() => setSelectedMatriz(m)}
                            className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-lg hover:border-cyan-200 transition-all cursor-pointer group flex flex-col"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 group-hover:text-cyan-600 transition-colors leading-tight">
                                        {m.colegioNombre}
                                    </h3>
                                    <p className="text-slate-400 text-sm font-bold mt-1 tracking-widest">RBD {m.rbd}</p>
                                </div>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2 ${m.hallazgos > 0 ? 'bg-red-50 text-red-500 border-red-100 group-hover:bg-red-500 group-hover:text-white group-hover:border-red-500' : 'bg-emerald-50 text-emerald-500 border-emerald-100 group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500'} transition-colors`}>
                                    <span className="font-black text-lg">{m.hallazgos}</span>
                                </div>
                            </div>
                            
                            <div className="flex-1"></div>

                            <div className="mt-6 pt-6 border-t border-slate-100">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-500">Cumplimiento Global</span>
                                    <span className="text-xs font-black text-slate-800">{m.cumplimiento.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2">
                                    <div 
                                        className="bg-slate-800 h-2 rounded-full transition-all duration-1000" 
                                        style={{ width: `${m.cumplimiento}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between items-center mt-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    <span>{format(new Date(m.createdAt), 'dd MMMM yyyy')}</span>
                                    <span className="text-cyan-500 group-hover:translate-x-1 transition-transform inline-block">Ver Detalle →</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
