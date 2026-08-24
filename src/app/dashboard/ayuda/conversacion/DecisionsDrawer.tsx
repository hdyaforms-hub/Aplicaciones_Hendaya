'use client'

import React, { useState, useEffect } from 'react'
import { getProjectDecisions } from './actions'
import jsPDF from 'jspdf'

export interface DecisionItem {
    id: string
    conversationId: string
    senderUsername: string
    senderName?: string | null
    content: string
    decisionSummary?: string | null
    createdAt: string
}

interface DecisionsDrawerProps {
    projectId: string
    projectTitle: string
    isOpen: boolean
    onClose: () => void
}

export default function DecisionsDrawer({
    projectId,
    projectTitle,
    isOpen,
    onClose
}: DecisionsDrawerProps) {
    const [decisions, setDecisions] = useState<DecisionItem[]>([])
    const [loading, setLoading] = useState(false)

    const fetchDecisions = async () => {
        setLoading(true)
        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
            const fetchPromise = getProjectDecisions(projectId || undefined)
            const res: any = await Promise.race([fetchPromise, timeoutPromise]).catch(() => ({ decisions: [] }))

            if (res && res.decisions) {
                setDecisions(res.decisions)
            } else {
                setDecisions([])
            }
        } catch (e) {
            setDecisions([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen) {
            fetchDecisions()
        }
    }, [isOpen, projectId])

    // Exportación oficial a PDF con identidad HENDAYA
    const handleExportPdf = () => {
        const doc = new jsPDF()
        const pageWidth = doc.internal.pageSize.getWidth()

        // Encabezado Corporativo HENDAYA
        doc.setFillColor(15, 23, 42) // Slate-900
        doc.rect(0, 0, pageWidth, 35, 'F')

        doc.setTextColor(6, 182, 212) // Cyan-500
        doc.setFontSize(20)
        doc.setFont('helvetica', 'bold')
        doc.text('HENDAYA', 14, 18)

        doc.setTextColor(255, 255, 255)
        doc.setFontSize(12)
        doc.setFont('helvetica', 'normal')
        doc.text('| Acta Rápida de Decisiones y Acuerdos', 52, 18)

        doc.setFontSize(9)
        doc.setTextColor(203, 213, 225)
        doc.text(`Proyecto: ${projectTitle}`, 14, 28)
        doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-CL')}`, pageWidth - 60, 28)

        // Cuerpo del Acta
        let yPos = 48
        doc.setTextColor(15, 23, 42)
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Registro Cronológico de Acuerdos', 14, yPos)
        yPos += 8

        if (decisions.length === 0) {
            doc.setFontSize(10)
            doc.setFont('helvetica', 'italic')
            doc.setTextColor(100, 116, 139)
            doc.text('No hay decisiones ni acuerdos registrados aún para este proyecto.', 14, yPos + 6)
        } else {
            decisions.forEach((d, idx) => {
                if (yPos > 260) {
                    doc.addPage()
                    yPos = 20
                }

                // Caja del acuerdo
                doc.setDrawColor(226, 232, 240)
                doc.setFillColor(248, 250, 252)
                doc.roundedRect(14, yPos, pageWidth - 28, 28, 3, 3, 'FD')

                doc.setFontSize(10)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(15, 23, 42)
                const title = d.decisionSummary || d.content.slice(0, 80)
                doc.text(`${idx + 1}. ${title}`, 18, yPos + 8)

                doc.setFontSize(8)
                doc.setFont('helvetica', 'normal')
                doc.setTextColor(100, 116, 139)
                doc.text(
                    `Acordado por: @${d.senderUsername} (${d.senderName || d.senderUsername}) • Fecha: ${new Date(d.createdAt).toLocaleString('es-CL')}`,
                    18,
                    yPos + 15
                )

                doc.setFontSize(8)
                doc.setTextColor(51, 65, 85)
                const lines = doc.splitTextToSize(`Detalle: ${d.content}`, pageWidth - 36)
                doc.text(lines.slice(0, 2), 18, yPos + 22)

                yPos += 34
            })
        }

        // Pie de página oficial
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text('Documento generado automáticamente por la Plataforma de Colaboración Hendaya.', 14, 288)

        doc.save(`Acta_Decisiones_${projectTitle.replace(/\s+/g, '_')}.pdf`)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            />

            {/* Panel Lateral */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
                    {/* Header */}
                    <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">⚖️</span>
                            <div>
                                <h3 className="font-black text-sm uppercase tracking-wider text-white">
                                    Acta Rápida de Decisiones
                                </h3>
                                <p className="text-xs text-cyan-200 truncate max-w-[220px]">
                                    {projectTitle}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Lista de Decisiones */}
                    <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50">
                        {loading ? (
                            <div className="text-center py-12 text-slate-400 text-xs">
                                <div className="w-6 h-6 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                Consultando acuerdos...
                            </div>
                        ) : decisions.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <span className="text-4xl block mb-2">📜</span>
                                <h4 className="font-bold text-slate-700 text-sm">No hay decisiones fijadas</h4>
                                <p className="text-xs max-w-xs mx-auto mt-1">
                                    Marca mensajes importantes del chat como "Decisión" para consolidar el acta oficial del proyecto sin burocracia adicional.
                                </p>
                            </div>
                        ) : (
                            decisions.map((dec, idx) => (
                                <div
                                    key={dec.id}
                                    className="p-4 bg-white rounded-2xl border border-purple-200/80 shadow-xs space-y-2 relative overflow-hidden"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                                            Acuerdo #{decisions.length - idx}
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            {new Date(dec.createdAt).toLocaleDateString('es-CL', {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>

                                    {dec.decisionSummary ? (
                                        <h5 className="font-black text-slate-900 text-xs">{dec.decisionSummary}</h5>
                                    ) : null}

                                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap select-text">
                                        {dec.content}
                                    </p>

                                    <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                                        <span>✍️ @{dec.senderUsername} ({dec.senderName || dec.senderUsername})</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer con Exportación PDF */}
                    <div className="p-5 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500 font-bold">
                            {decisions.length} decisiones
                        </span>

                        <button
                            onClick={handleExportPdf}
                            disabled={decisions.length === 0}
                            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-black shadow-md shadow-purple-600/20 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                            <span>📄</span>
                            <span>Descargar Acta PDF</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
