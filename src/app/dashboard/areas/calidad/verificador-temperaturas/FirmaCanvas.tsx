'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

interface FirmaCanvasProps {
    value?: string
    onChange: (dataUrl: string) => void
    readOnly?: boolean
    height?: number
    label?: string
    darkTheme?: boolean
}

export default function FirmaCanvas({
    value = '',
    onChange,
    readOnly = false,
    height = 130,
    label,
    darkTheme = false
}: FirmaCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasDrawn, setHasDrawn] = useState(false)

    // Inicializar y limpiar el canvas
    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        setHasDrawn(false)
        onChange('')
    }, [onChange])

    // Ajustar dimensiones lógicas vs. de renderizado para evitar distorsión
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * 2
        canvas.height = height * 2

        const ctx = canvas.getContext('2d')
        if (ctx) {
            ctx.scale(2, 2)
            ctx.strokeStyle = darkTheme ? '#38bdf8' : '#0f172a'
            ctx.lineWidth = 2.5
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
        }
    }, [height, darkTheme])

    // Si ya existe valor base64 o imagen previa y está en modo lectura o reseteo
    const isImageValue = value.startsWith('data:image/')

    const getCoordinates = (e: MouseEvent | TouchEvent) => {
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
        if (readOnly) return
        e.preventDefault()
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const coords = getCoordinates(e.nativeEvent)
        ctx.beginPath()
        ctx.moveTo(coords.x, coords.y)
        setIsDrawing(true)
        setHasDrawn(true)
    }

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || readOnly) return
        e.preventDefault()

        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const coords = getCoordinates(e.nativeEvent)
        ctx.lineTo(coords.x, coords.y)
        ctx.stroke()
    }

    const stopDrawing = () => {
        if (!isDrawing || readOnly) return
        setIsDrawing(false)

        const canvas = canvasRef.current
        if (!canvas) return

        const dataUrl = canvas.toDataURL('image/png')
        onChange(dataUrl)
    }

    return (
        <div className="space-y-1.5 w-full">
            {label && (
                <div className="flex justify-between items-center text-[10px] uppercase font-extrabold tracking-wider">
                    <span className={darkTheme ? 'text-slate-300' : 'text-slate-600'}>{label}</span>
                    {!readOnly && hasDrawn && (
                        <button
                            type="button"
                            onClick={clearCanvas}
                            className="text-rose-400 hover:text-rose-600 font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                            <span>🧹</span> Limpiar
                        </button>
                    )}
                </div>
            )}

            {readOnly && isImageValue ? (
                <div className={`p-2 rounded-2xl border flex items-center justify-center ${
                    darkTheme ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={value}
                        alt="Firma Digital Registrada"
                        className="max-h-24 max-w-full object-contain filter drop-shadow"
                    />
                </div>
            ) : (
                <div className="relative w-full">
                    <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        style={{ height: `${height}px` }}
                        className={`w-full rounded-2xl border transition-all touch-none select-none ${
                            readOnly
                                ? 'bg-gray-100 border-gray-200 cursor-not-allowed'
                                : darkTheme
                                ? 'bg-slate-950 border-slate-700 hover:border-cyan-500 focus:ring-2 focus:ring-cyan-500/50 cursor-crosshair'
                                : 'bg-white border-gray-300 hover:border-cyan-500 focus:ring-2 focus:ring-cyan-500/50 cursor-crosshair shadow-inner'
                        }`}
                    />
                    {!readOnly && !hasDrawn && !isImageValue && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 font-medium text-xs gap-1.5 opacity-60">
                            <span>🖊️</span>
                            <span>Dibuja tu firma con el mouse o dedo aquí</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
