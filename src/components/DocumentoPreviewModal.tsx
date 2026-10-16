'use client'

import React, { useEffect, useState } from 'react'
import { ExternalLink, Download, X, FileText, Image as ImageIcon, FileSpreadsheet, AlertCircle } from 'lucide-react'

export interface DocumentoPreviewData {
    url: string
    nombre?: string | null
    titulo?: string
    colaborador?: string | null
    rut?: string | null
    rbd?: number | string | null
    establecimiento?: string | null
    fecha?: string | null
    criterio?: string | null
    criterioColor?: string | null
    subidoPor?: string | null
    subidoAt?: string | null
}

interface DocumentoPreviewModalProps {
    documento: DocumentoPreviewData | null
    onClose: () => void
}

export default function DocumentoPreviewModal({ documento, onClose }: DocumentoPreviewModalProps) {
    const [isLoading, setIsLoading] = useState(true)

    // Cerrar con tecla Escape y bloquear scroll del body
    useEffect(() => {
        if (!documento) return

        setIsLoading(true)

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        const originalOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = originalOverflow
        }
    }, [documento, onClose])

    if (!documento) return null

    const url = documento.url
    const lowerUrl = url.toLowerCase()
    const isPdf = lowerUrl.endsWith('.pdf') || lowerUrl.includes('.pdf?')
    const isImage = lowerUrl.endsWith('.png') || lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || lowerUrl.endsWith('.webp') || lowerUrl.endsWith('.gif') || lowerUrl.endsWith('.svg')
    const isOffice = lowerUrl.endsWith('.doc') || lowerUrl.endsWith('.docx') || lowerUrl.endsWith('.xls') || lowerUrl.endsWith('.xlsx') || lowerUrl.endsWith('.csv')
    const fileName = documento.nombre || url.split('/').pop() || 'Documento_Respaldo'

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden border border-slate-700/30 animate-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
            >
                {/* Cabecera del visor */}
                <div className="p-4 sm:p-5 bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 border-b border-slate-800">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center shrink-0 border border-cyan-500/30">
                            {isPdf ? (
                                <FileText className="w-5 h-5 text-cyan-400" />
                            ) : isImage ? (
                                <ImageIcon className="w-5 h-5 text-sky-400" />
                            ) : isOffice ? (
                                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                            ) : (
                                <FileText className="w-5 h-5 text-slate-400" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-sm sm:text-base text-white truncate max-w-md" title={fileName}>
                                    {fileName}
                                </h3>
                                {documento.criterio && (
                                    <span 
                                        className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                                        style={{
                                            backgroundColor: documento.criterioColor ? `${documento.criterioColor}25` : '#0891b225',
                                            color: documento.criterioColor || '#22d3ee',
                                            borderColor: documento.criterioColor ? `${documento.criterioColor}50` : '#0891b250'
                                        }}
                                    >
                                        {documento.criterio}
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap mt-0.5">
                                {documento.colaborador && (
                                    <span>
                                        <strong className="text-slate-300">{documento.colaborador}</strong>
                                        {documento.rut ? ` (${documento.rut})` : ''}
                                    </span>
                                )}
                                {documento.rbd && (
                                    <span>
                                        &bull; <strong className="text-cyan-400">RBD {documento.rbd}</strong>
                                        {documento.establecimiento ? ` - ${documento.establecimiento}` : ''}
                                    </span>
                                )}
                                {documento.fecha && (
                                    <span>
                                        &bull; Fecha: <strong className="text-slate-300">{documento.fecha}</strong>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Acciones superiores */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-slate-700 shadow-2xs"
                            title="Abrir documento en una pestaña nueva"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Pestaña Nueva</span>
                        </a>
                        <a
                            href={url}
                            download={fileName}
                            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-2xs shadow-cyan-900/30"
                            title="Descargar este archivo a tu equipo"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Descargar</span>
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 font-bold flex items-center justify-center transition-colors border border-slate-700 ml-1"
                            title="Cerrar vista previa (Esc)"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Contenedor del visor */}
                <div className="flex-1 bg-slate-950/5 relative overflow-hidden flex items-center justify-center">
                    {/* Spinner de carga inicial para IFrames e Imágenes */}
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/90 z-10">
                            <div className="w-9 h-9 border-3 border-cyan-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                            <p className="text-xs font-semibold text-slate-600">Cargando vista previa del documento...</p>
                        </div>
                    )}

                    {isPdf ? (
                        <iframe
                            src={`${url}#toolbar=1&navpanes=0`}
                            title={`Vista Previa de ${fileName}`}
                            onLoad={() => setIsLoading(false)}
                            className="w-full h-full border-0 bg-white"
                        />
                    ) : isImage ? (
                        <div className="w-full h-full p-4 flex items-center justify-center overflow-auto bg-slate-900/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={url}
                                alt={fileName}
                                onLoad={() => setIsLoading(false)}
                                className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-xl border border-gray-200 bg-white"
                            />
                        </div>
                    ) : (
                        /* Archivos Word / Excel / No renderizables en Iframe nativo */
                        <div 
                            className="p-8 text-center max-w-lg mx-auto bg-white rounded-3xl shadow-lg border border-slate-200 space-y-4"
                            ref={() => setIsLoading(false)}
                        >
                            <div className="w-16 h-16 rounded-3xl bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto text-3xl border border-cyan-100 shadow-inner">
                                {isOffice ? '📊' : '📁'}
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-slate-900">{fileName}</h4>
                                <p className="text-xs text-slate-500 mt-1">Documento de respaldo de ausentismo</p>
                            </div>
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-2.5 text-left">
                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span>
                                    Los navegadores no renderizan archivos de Office (Word/Excel) de forma directa en pantalla. Puedes descargarlo o abrirlo para visualizar su contenido completo.
                                </span>
                            </div>
                            <div className="flex items-center justify-center gap-3 pt-2">
                                <a
                                    href={url}
                                    download={fileName}
                                    className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>Descargar Archivo</span>
                                </a>
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    <span>Abrir</span>
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                {/* Pie de modal con info complementaria */}
                {(documento.subidoPor || documento.subidoAt) && (
                    <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
                        <span>
                            {documento.subidoPor ? `Adjuntado por: ${documento.subidoPor}` : 'Respaldo verificado'}
                        </span>
                        {documento.subidoAt && (
                            <span>
                                {new Date(documento.subidoAt).toLocaleString('es-CL')}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
