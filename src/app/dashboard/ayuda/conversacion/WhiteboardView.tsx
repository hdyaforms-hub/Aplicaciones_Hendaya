'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
    getProjectWhiteboards,
    saveWhiteboardElements,
    deleteWhiteboardElement,
    clearAllWhiteboardElements
} from './actions'
import StackedPresenceAvatars from './StackedPresenceAvatars'
import jsPDF from 'jspdf'

export interface WhiteboardElementItem {
    id: string
    type: 'rect' | 'circle' | 'note' | 'text' | 'arrow' | 'draw'
    data: {
        x: number
        y: number
        width?: number
        height?: number
        text?: string
        color?: string
        strokeColor?: string
        points?: { x: number; y: number }[]
    }
    updatedBy?: string
    updatedAt?: string
}

interface WhiteboardViewProps {
    projectId: string
    projectTitle: string
    currentUsername: string
}

const PALETTE = ['#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#64748b', '#ffffff', '#0f172a']

export default function WhiteboardView({
    projectId,
    projectTitle,
    currentUsername
}: WhiteboardViewProps) {
    const [boardId, setBoardId] = useState<string | null>(null)
    const [boardTitle, setBoardTitle] = useState<string>('Pizarra de Ideación')
    const [elements, setElements] = useState<WhiteboardElementItem[]>([])
    const [tool, setTool] = useState<'select' | 'note' | 'rect' | 'circle' | 'text' | 'arrow' | 'draw'>('note')
    const [selectedColor, setSelectedColor] = useState<string>('#f59e0b')
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
    
    // Estado de dibujo a mano alzada
    const [isDrawing, setIsDrawing] = useState(false)
    const [currentDrawPoints, setCurrentDrawPoints] = useState<{ x: number; y: number }[]>([])

    // Estado de arrastre de elementos
    const [isDraggingElement, setIsDraggingElement] = useState(false)
    const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
    const [elementStartPos, setElementStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

    const [exportingPdf, setExportingPdf] = useState(false)
    const svgRef = useRef<SVGSVGElement>(null)

    // Cargar pizarra del proyecto
    const loadBoard = useCallback(async () => {
        const res = await getProjectWhiteboards(projectId)
        if (res.success && res.boards && res.boards.length > 0) {
            const b = res.boards[0]
            setBoardId(b.id)
            setBoardTitle(b.title)
            setElements(b.elements || [])
        }
    }, [projectId])

    useEffect(() => {
        loadBoard()
        const interval = setInterval(loadBoard, 10000)
        return () => clearInterval(interval)
    }, [loadBoard])

    // Coordenadas relativas al SVG
    const getSvgCoordinates = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current) return { x: 0, y: 0 }
        const rect = svgRef.current.getBoundingClientRect()
        return {
            x: Math.round(e.clientX - rect.left),
            y: Math.round(e.clientY - rect.top)
        }
    }

    // Manejo de clic o inicio de dibujo en el lienzo
    const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
        const { x, y } = getSvgCoordinates(e)

        if (tool === 'select') {
            // Si hace clic en espacio vacío, deseleccionar
            const targetTag = (e.target as HTMLElement).tagName.toLowerCase()
            if (targetTag === 'svg' || targetTag === 'rect') {
                setSelectedElementId(null)
            }
            return
        }

        if (tool === 'draw') {
            setIsDrawing(true)
            setCurrentDrawPoints([{ x, y }])
            return
        }

        // Crear nuevo elemento según la herramienta activa
        const newId = 'el_' + Math.random().toString(36).substr(2, 9)
        let newElement: WhiteboardElementItem

        if (tool === 'note') {
            newElement = {
                id: newId,
                type: 'note',
                data: {
                    x: Math.max(10, x - 80),
                    y: Math.max(10, y - 60),
                    width: 170,
                    height: 120,
                    text: 'Nota de idea...',
                    color: selectedColor === '#0f172a' ? '#fef08a' : selectedColor
                }
            }
        } else if (tool === 'rect') {
            newElement = {
                id: newId,
                type: 'rect',
                data: {
                    x: Math.max(10, x - 70),
                    y: Math.max(10, y - 40),
                    width: 140,
                    height: 80,
                    color: selectedColor,
                    strokeColor: '#0f172a'
                }
            }
        } else if (tool === 'circle') {
            newElement = {
                id: newId,
                type: 'circle',
                data: {
                    x: Math.max(10, x - 50),
                    y: Math.max(10, y - 50),
                    width: 100,
                    height: 100,
                    color: selectedColor,
                    strokeColor: '#0f172a'
                }
            }
        } else if (tool === 'text') {
            newElement = {
                id: newId,
                type: 'text',
                data: {
                    x,
                    y,
                    text: 'Escribe tu texto...',
                    color: selectedColor === '#ffffff' ? '#0f172a' : selectedColor
                }
            }
        } else if (tool === 'arrow') {
            newElement = {
                id: newId,
                type: 'arrow',
                data: {
                    x,
                    y,
                    width: 140,
                    height: 50,
                    strokeColor: selectedColor === '#ffffff' ? '#0f172a' : selectedColor
                }
            }
        } else {
            return
        }

        const updated = [...elements, newElement]
        setElements(updated)
        setSelectedElementId(newId)
        setTool('select')

        if (boardId) {
            saveWhiteboardElements(boardId, [newElement])
        }
    }

    // Iniciar arrastre de un elemento específico
    const handleElementMouseDown = (e: React.MouseEvent, el: WhiteboardElementItem) => {
        if (tool === 'select') {
            e.stopPropagation()
            setSelectedElementId(el.id)
            setIsDraggingElement(true)
            const pt = getSvgCoordinates(e as any)
            setDragStartPos(pt)
            setElementStartPos({ x: el.data.x, y: el.data.y })
        }
    }

    // Movimiento del cursor (dibujar o arrastrar)
    const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const pt = getSvgCoordinates(e)

        if (isDrawing && tool === 'draw') {
            setCurrentDrawPoints(prev => [...prev, pt])
        } else if (isDraggingElement && selectedElementId && tool === 'select') {
            const dx = pt.x - dragStartPos.x
            const dy = pt.y - dragStartPos.y
            setElements(prev => prev.map(item => {
                if (item.id === selectedElementId) {
                    return {
                        ...item,
                        data: {
                            ...item.data,
                            x: Math.max(0, elementStartPos.x + dx),
                            y: Math.max(0, elementStartPos.y + dy)
                        }
                    }
                }
                return item
            }))
        }
    }

    // Fin de clic / soltar elemento o trazo
    const handleSvgMouseUp = () => {
        if (isDrawing && tool === 'draw' && currentDrawPoints.length > 1) {
            const newId = 'el_' + Math.random().toString(36).substr(2, 9)
            const newElement: WhiteboardElementItem = {
                id: newId,
                type: 'draw',
                data: {
                    x: currentDrawPoints[0].x,
                    y: currentDrawPoints[0].y,
                    strokeColor: selectedColor === '#ffffff' ? '#0f172a' : selectedColor,
                    points: currentDrawPoints
                }
            }
            const updated = [...elements, newElement]
            setElements(updated)
            if (boardId) {
                saveWhiteboardElements(boardId, [newElement])
            }
        }
        setIsDrawing(false)
        setCurrentDrawPoints([])

        if (isDraggingElement && selectedElementId) {
            setIsDraggingElement(false)
            const target = elements.find(el => el.id === selectedElementId)
            if (target && boardId) {
                saveWhiteboardElements(boardId, [target])
            }
        }
    }

    const handleUpdateText = (id: string, text: string) => {
        setElements(prev => prev.map(el => el.id === id ? { ...el, data: { ...el.data, text } } : el))
        const target = elements.find(el => el.id === id)
        if (target && boardId) {
            saveWhiteboardElements(boardId, [{ ...target, data: { ...target.data, text } }])
        }
    }

    const handleDeleteSelected = async () => {
        if (!selectedElementId) return
        setElements(prev => prev.filter(el => el.id !== selectedElementId))
        await deleteWhiteboardElement(selectedElementId)
        setSelectedElementId(null)
    }

    const handleClearBoard = async () => {
        if (!confirm('¿Deseas limpiar todos los elementos de la pizarra?')) return
        setElements([])
        setSelectedElementId(null)
        if (boardId) {
            await clearAllWhiteboardElements(boardId)
        }
    }

    const handleExportPdf = async () => {
        if (!svgRef.current) return
        setExportingPdf(true)
        try {
            const svgElement = svgRef.current
            const svgData = new XMLSerializer().serializeToString(svgElement)
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
            const URL = window.URL || window.webkitURL || window
            const blobURL = URL.createObjectURL(svgBlob)

            const image = new Image()
            image.onload = () => {
                const canvas = document.createElement('canvas')
                const baseWidth = svgElement.clientWidth || 1200
                const baseHeight = svgElement.clientHeight || 700
                canvas.width = baseWidth * 2
                canvas.height = baseHeight * 2
                const ctx = canvas.getContext('2d')
                if (!ctx) {
                    setExportingPdf(false)
                    return
                }

                ctx.fillStyle = '#ffffff'
                ctx.fillRect(0, 0, canvas.width, canvas.height)
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

                const imgData = canvas.toDataURL('image/png')
                const doc = new jsPDF({
                    orientation: 'landscape',
                    unit: 'mm',
                    format: 'a4'
                })

                const pageWidth = doc.internal.pageSize.getWidth()
                const pageHeight = doc.internal.pageSize.getHeight()

                // Encabezado Corporativo Oficial HENDAYA
                doc.setFillColor(15, 23, 42)
                doc.rect(0, 0, pageWidth, 22, 'F')

                doc.setTextColor(6, 182, 212)
                doc.setFontSize(16)
                doc.setFont('helvetica', 'bold')
                doc.text('HENDAYA', 14, 14)

                doc.setTextColor(255, 255, 255)
                doc.setFontSize(10)
                doc.setFont('helvetica', 'normal')
                doc.text(`| ${boardTitle} — ${projectTitle}`, 48, 14)

                doc.setFontSize(8)
                doc.setTextColor(203, 213, 225)
                doc.text(`Fecha: ${new Date().toLocaleDateString('es-CL')} • Elementos: ${elements.length}`, pageWidth - 70, 14)

                // Imagen de la Pizarra
                const margin = 8
                const imgWidth = pageWidth - margin * 2
                const imgHeight = pageHeight - 34
                doc.addImage(imgData, 'PNG', margin, 25, imgWidth, imgHeight)

                // Pie de Página
                doc.setFontSize(7)
                doc.setTextColor(148, 163, 184)
                doc.text('Documento oficial generado desde la Pizarra de Ideación y Colaboración Hendaya.', 14, pageHeight - 3)

                const filename = `Pizarra_${boardTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
                doc.save(filename)
                URL.revokeObjectURL(blobURL)
                setExportingPdf(false)
            }
            image.onerror = () => {
                setExportingPdf(false)
            }
            image.src = blobURL
        } catch (err) {
            console.error('Error al exportar PDF:', err)
            setExportingPdf(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Header & Controls Bar */}
            <div className="bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                        🎨
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">
                                {boardTitle}
                            </h2>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-200">
                                {elements.length} elementos
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">
                            Espacio visual colaborativo para lluvia de ideas, diagramas y mapeo de procesos.
                        </p>
                    </div>
                </div>

                {/* Presencia en Vivo en la Pizarra y Acciones */}
                <div className="flex items-center gap-2 flex-wrap">
                    <StackedPresenceAvatars
                        roomId={`whiteboard:${boardId || projectId}`}
                        className="px-3 py-1 bg-slate-50 rounded-2xl border border-slate-200"
                    />

                    <button
                        onClick={handleExportPdf}
                        disabled={exportingPdf}
                        className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                        title="Descargar diagrama de la pizarra en PDF oficial"
                    >
                        <span>📄</span>
                        <span>{exportingPdf ? 'Exportando...' : 'Descargar PDF'}</span>
                    </button>

                    <button
                        onClick={handleClearBoard}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all border border-rose-200 cursor-pointer"
                        title="Limpiar lienzo"
                    >
                        🗑️ Limpiar
                    </button>
                </div>
            </div>

            {/* Barra de Herramientas de Dibujo */}
            <div className="bg-slate-900 text-white p-2.5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 border border-slate-800">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                    <button
                        onClick={() => setTool('select')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${tool === 'select' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                        <span>👆</span> Seleccionar / Mover
                    </button>
                    <button
                        onClick={() => setTool('note')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${tool === 'note' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                        <span>📌</span> Post-it
                    </button>
                    <button
                        onClick={() => setTool('rect')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${tool === 'rect' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                        <span>⬜</span> Bloque
                    </button>
                    <button
                        onClick={() => setTool('circle')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${tool === 'circle' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                        <span>⚪</span> Círculo
                    </button>
                    <button
                        onClick={() => setTool('text')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${tool === 'text' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                        <span>🔤</span> Texto
                    </button>
                    <button
                        onClick={() => setTool('arrow')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${tool === 'arrow' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                        <span>➔</span> Conector
                    </button>
                    <button
                        onClick={() => setTool('draw')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${tool === 'draw' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                        <span>✏️</span> Lápiz
                    </button>
                </div>

                {/* Paleta de Colores y Borrar Selección */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-bold hidden sm:inline">Color:</span>
                    <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
                        {PALETTE.map((c) => (
                            <button
                                key={c}
                                onClick={() => setSelectedColor(c)}
                                style={{ backgroundColor: c }}
                                className={`w-5 h-5 rounded-full border border-slate-700 transition-transform cursor-pointer ${selectedColor === c ? 'ring-2 ring-cyan-400 scale-110' : 'hover:scale-105 opacity-80'}`}
                            />
                        ))}
                    </div>

                    {selectedElementId && (
                        <button
                            onClick={handleDeleteSelected}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                        >
                            Borrar Selección
                        </button>
                    )}
                </div>
            </div>

            {/* Lienzo SVG Interactivo */}
            <div className="relative bg-slate-100 rounded-3xl border-2 border-dashed border-slate-300 overflow-hidden shadow-inner h-[620px]">
                {/* Cuadrícula y Contenedor SVG */}
                <svg
                    ref={svgRef}
                    className={`w-full h-full select-none ${tool === 'draw' ? 'cursor-crosshair' : tool === 'select' ? 'cursor-default' : 'cursor-pointer'}`}
                    onMouseDown={handleSvgMouseDown}
                    onMouseMove={handleSvgMouseMove}
                    onMouseUp={handleSvgMouseUp}
                    onMouseLeave={handleSvgMouseUp}
                >
                    <defs>
                        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#cbd5e1" strokeWidth="0.75" />
                        </pattern>
                        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                            <polygon points="0 0, 8 3, 0 6" fill="#0f172a" />
                        </marker>
                    </defs>

                    {/* Fondo con patrón sin capturar eventos */}
                    <rect width="100%" height="100%" fill="url(#grid)" pointerEvents="none" />

                    {/* Elementos Renderizados */}
                    {elements.map((el) => {
                        const isSelected = selectedElementId === el.id

                        if (el.type === 'note') {
                            return (
                                <g
                                    key={el.id}
                                    onMouseDown={(e) => handleElementMouseDown(e, el)}
                                    className={tool === 'select' ? 'cursor-move' : ''}
                                >
                                    <rect
                                        x={el.data.x}
                                        y={el.data.y}
                                        width={el.data.width || 170}
                                        height={el.data.height || 120}
                                        fill={el.data.color || '#fef08a'}
                                        stroke={isSelected ? '#0284c7' : '#eab308'}
                                        strokeWidth={isSelected ? 3 : 1.5}
                                        rx={12}
                                        filter="drop-shadow(0 4px 6px rgba(0,0,0,0.08))"
                                    />
                                    <foreignObject
                                        x={el.data.x + 8}
                                        y={el.data.y + 8}
                                        width={(el.data.width || 170) - 16}
                                        height={(el.data.height || 120) - 16}
                                    >
                                        <textarea
                                            value={el.data.text || ''}
                                            onChange={(e) => handleUpdateText(el.id, e.target.value)}
                                            className="w-full h-full bg-transparent resize-none outline-none text-xs font-bold text-slate-800"
                                            placeholder="Nota de idea..."
                                        />
                                    </foreignObject>
                                </g>
                            )
                        }

                        if (el.type === 'rect') {
                            return (
                                <g
                                    key={el.id}
                                    onMouseDown={(e) => handleElementMouseDown(e, el)}
                                    className={tool === 'select' ? 'cursor-move' : ''}
                                >
                                    <rect
                                        x={el.data.x}
                                        y={el.data.y}
                                        width={el.data.width || 140}
                                        height={el.data.height || 80}
                                        fill={el.data.color || '#38bdf8'}
                                        fillOpacity="0.85"
                                        stroke={isSelected ? '#0284c7' : (el.data.strokeColor || '#0f172a')}
                                        strokeWidth={isSelected ? 3 : 2}
                                        rx={8}
                                    />
                                </g>
                            )
                        }

                        if (el.type === 'circle') {
                            return (
                                <g
                                    key={el.id}
                                    onMouseDown={(e) => handleElementMouseDown(e, el)}
                                    className={tool === 'select' ? 'cursor-move' : ''}
                                >
                                    <ellipse
                                        cx={el.data.x + (el.data.width || 100) / 2}
                                        cy={el.data.y + (el.data.height || 100) / 2}
                                        rx={(el.data.width || 100) / 2}
                                        ry={(el.data.height || 100) / 2}
                                        fill={el.data.color || '#34d399'}
                                        fillOpacity="0.85"
                                        stroke={isSelected ? '#0284c7' : (el.data.strokeColor || '#0f172a')}
                                        strokeWidth={isSelected ? 3 : 2}
                                    />
                                </g>
                            )
                        }

                        if (el.type === 'text') {
                            return (
                                <g
                                    key={el.id}
                                    onMouseDown={(e) => handleElementMouseDown(e, el)}
                                    className={tool === 'select' ? 'cursor-move' : ''}
                                >
                                    <text
                                        x={el.data.x}
                                        y={el.data.y + 16}
                                        fill={el.data.color || '#0f172a'}
                                        fontSize="15"
                                        fontWeight="bold"
                                        fontFamily="sans-serif"
                                    >
                                        {el.data.text || 'Texto'}
                                    </text>
                                </g>
                            )
                        }

                        if (el.type === 'arrow') {
                            const x2 = el.data.x + (el.data.width || 140)
                            const y2 = el.data.y + (el.data.height || 50)
                            return (
                                <g
                                    key={el.id}
                                    onMouseDown={(e) => handleElementMouseDown(e, el)}
                                    className={tool === 'select' ? 'cursor-move' : ''}
                                >
                                    <line
                                        x1={el.data.x}
                                        y1={el.data.y}
                                        x2={x2}
                                        y2={y2}
                                        stroke={el.data.strokeColor || '#0f172a'}
                                        strokeWidth={isSelected ? 4 : 3}
                                        markerEnd="url(#arrowhead)"
                                    />
                                </g>
                            )
                        }

                        if (el.type === 'draw' && el.data.points) {
                            const pathData = el.data.points.reduce(
                                (acc, pt, idx) => idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`,
                                ''
                            )
                            return (
                                <g
                                    key={el.id}
                                    onMouseDown={(e) => handleElementMouseDown(e, el)}
                                    className={tool === 'select' ? 'cursor-move' : ''}
                                >
                                    <path
                                        d={pathData}
                                        fill="none"
                                        stroke={el.data.strokeColor || '#0f172a'}
                                        strokeWidth={isSelected ? 4 : 2.5}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </g>
                            )
                        }

                        return null
                    })}

                    {/* Trazo a mano alzada en tiempo real */}
                    {isDrawing && currentDrawPoints.length > 1 && (
                        <path
                            d={currentDrawPoints.reduce(
                                (acc, pt, idx) => idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`,
                                ''
                            )}
                            fill="none"
                            stroke={selectedColor === '#ffffff' ? '#0f172a' : selectedColor}
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}
                </svg>

                {elements.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400">
                        <span className="text-5xl mb-2">🎨</span>
                        <p className="text-sm font-bold text-slate-600">Pizarra en Blanco</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Selecciona una herramienta (Post-it, Bloque, Círculo, Conector o Lápiz) y haz clic o arrastra en el lienzo para comenzar.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
