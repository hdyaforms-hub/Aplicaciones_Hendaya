'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'

interface FirmaSuaveCanvasProps {
    value?: string
    onChange: (dataUrl: string) => void
    height?: number
    label?: string
}

interface Point {
    x: number
    y: number
}

export default function FirmaSuaveCanvas({
    value = '',
    onChange,
    height = 150,
    label
}: FirmaSuaveCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasDrawn, setHasDrawn] = useState(false)
    const lastPointRef = useRef<Point | null>(null)
    const lastMidPointRef = useRef<Point | null>(null)

    // Configurar contexto de dibujo con suavizado
    const setupContext = useCallback((canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return null

        ctx.strokeStyle = '#0f172a' // Tinta azul/negro oscuro profesional
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        return ctx
    }, [])

    // Inicializar dimensiones con soporte Retina / High DPI y ResizeObserver
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const resize = () => {
            const rect = canvas.getBoundingClientRect()
            if (rect.width === 0) return
            const dpr = window.devicePixelRatio || 1

            canvas.width = rect.width * dpr
            canvas.height = height * dpr

            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.scale(dpr, dpr)
                setupContext(canvas)
            }
        }

        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(canvas)

        return () => ro.disconnect()
    }, [height, setupContext])

    // Limpiar el lienzo
    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
        lastPointRef.current = null
        lastMidPointRef.current = null
        setHasDrawn(false)
        onChange('')
    }, [onChange])

    const getCoords = (e: MouseEvent | TouchEvent): Point => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }

        const rect = canvas.getBoundingClientRect()
        let clientX = 0
        let clientY = 0

        if ('touches' in e && e.touches.length > 0) {
            clientX = e.touches[0].clientX
            clientY = e.touches[0].clientY
        } else if ('clientX' in e) {
            clientX = e.clientX
            clientY = e.clientY
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        }
    }

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault()
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = setupContext(canvas)
        if (!ctx) return

        const pt = getCoords(e.nativeEvent)
        lastPointRef.current = pt
        lastMidPointRef.current = pt

        // Dibujar un punto suave al hacer clic inicial
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, ctx.lineWidth / 2, 0, Math.PI * 2)
        ctx.fillStyle = ctx.strokeStyle
        ctx.fill()

        setIsDrawing(true)
        setHasDrawn(true)
    }

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return
        e.preventDefault()

        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const currentPt = getCoords(e.nativeEvent)
        const lastPt = lastPointRef.current || currentPt
        const lastMid = lastMidPointRef.current || lastPt

        // Calcular nuevo punto medio para una curva perfectamente redondeada (Spline Bézier)
        const midPoint: Point = {
            x: (lastPt.x + currentPt.x) / 2,
            y: (lastPt.y + currentPt.y) / 2
        }

        ctx.beginPath()
        ctx.moveTo(lastMid.x, lastMid.y)
        ctx.quadraticCurveTo(lastPt.x, lastPt.y, midPoint.x, midPoint.y)
        ctx.stroke()

        lastPointRef.current = currentPt
        lastMidPointRef.current = midPoint
    }

    const stopDrawing = () => {
        if (!isDrawing) return
        setIsDrawing(false)

        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        const lastPt = lastPointRef.current
        const lastMid = lastMidPointRef.current

        if (ctx && lastPt && lastMid) {
            ctx.beginPath()
            ctx.moveTo(lastMid.x, lastMid.y)
            ctx.lineTo(lastPt.x, lastPt.y)
            ctx.stroke()
        }

        lastPointRef.current = null
        lastMidPointRef.current = null

        const dataUrl = canvas.toDataURL('image/png')
        onChange(dataUrl)
    }

    return (
        <div className="space-y-1.5 w-full">
            {label && (
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-700">
                    <span>{label}</span>
                    {hasDrawn && (
                        <button
                            type="button"
                            onClick={clearCanvas}
                            className="text-rose-500 hover:text-rose-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                            <span>🧹</span> Limpiar Firma
                        </button>
                    )}
                </div>
            )}

            <div className="relative w-full rounded-2xl border border-slate-300 bg-white hover:border-cyan-500 transition-all shadow-inner overflow-hidden">
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{ height: `${height}px`, width: '100%' }}
                    className="block touch-none cursor-crosshair"
                />

                {!hasDrawn && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400 text-xs gap-1 opacity-70">
                        <span className="text-xl">✍️</span>
                        <span>Dibuja aquí con el mouse, lápiz óptico o tu dedo</span>
                    </div>
                )}
            </div>
        </div>
    )
}
