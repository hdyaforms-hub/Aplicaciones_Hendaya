'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { saveActaResponse, sendActaPdfEmail } from '../actions'
import { generateActaPDF } from '../actaPdfUtil'

type Props = {
    initialActa: any
    plantilla: any
}

/**
 * Componente interactivo de Firma Digital con Canvas HTML5 (soporte mouse y táctil con dedo)
 * y dos campos adicionales de datos (Nombre y Apellidos, RUT).
 */
function SignaturePad({
    showExtraFields = false,
    field,
    value,
    disabled,
    onChange
}: {
    showExtraFields?: boolean
    field: any
    value: any
    disabled: boolean
    onChange: (val: any) => void
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasDrawn, setHasDrawn] = useState(false)

    // Normalizar objeto de respuesta
    const dataObj = typeof value === 'object' && value !== null 
        ? value 
        : { firma: typeof value === 'string' ? value : '', dato1: '', dato2: '' }

    // Cargar firma inicial si ya existe
    useEffect(() => {
        if (dataObj.firma && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d')
            if (ctx) {
                const img = new Image()
                img.onload = () => {
                    ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
                    ctx.drawImage(img, 0, 0)
                    setHasDrawn(true)
                }
                img.src = dataObj.firma
            }
        }
    }, [])

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 }
        const rect = canvasRef.current.getBoundingClientRect()
        const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX
        const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY
        return {
            x: (clientX - rect.left) * (canvasRef.current.width / rect.width),
            y: (clientY - rect.top) * (canvasRef.current.height / rect.height)
        }
    }

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (disabled) return
        setIsDrawing(true)
        setHasDrawn(true)
        const ctx = canvasRef.current?.getContext('2d')
        if (ctx) {
            const pos = getPos(e)
            ctx.beginPath()
            ctx.moveTo(pos.x, pos.y)
            ctx.lineWidth = 2.5
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.strokeStyle = '#0f172a'
        }
    }

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || disabled) return
        const ctx = canvasRef.current?.getContext('2d')
        if (ctx) {
            const pos = getPos(e)
            ctx.lineTo(pos.x, pos.y)
            ctx.stroke()
        }
    }

    const stopDrawing = () => {
        if (!isDrawing) return
        setIsDrawing(false)
        if (canvasRef.current) {
            const firmaUrl = canvasRef.current.toDataURL('image/png')
            if (showExtraFields) {
                onChange({ ...dataObj, firma: firmaUrl })
            } else {
                onChange(firmaUrl)
            }
        }
    }

    const clearFirma = () => {
        if (disabled) return
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d')
            if (ctx) {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
            }
        }
        setHasDrawn(false)
        if (showExtraFields) {
            onChange({ ...dataObj, firma: '' })
        } else {
            onChange('')
        }
    }

    return (
        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span>✍️</span> {field.label || 'Firma Digital'} {field.required && <span className="text-rose-500">*</span>}
                </label>
                {!disabled && (
                    <button
                        type="button"
                        onClick={clearFirma}
                        className="px-3 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg text-[10px] font-black uppercase transition-colors cursor-pointer"
                    >
                        🗑️ Limpiar Firma
                    </button>
                )}
            </div>

            {/* Recuadro Canvas de Firma (dibujo con dedo/mouse) */}
            <div className="relative border-2 border-dashed border-slate-300 hover:border-cyan-500 transition-colors bg-slate-50/50 rounded-2xl overflow-hidden h-44 cursor-crosshair touch-none">
                <canvas
                    ref={canvasRef}
                    width={600}
                    height={176}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-full"
                />
                {!hasDrawn && !dataObj.firma && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 text-xs font-bold gap-1">
                        <span>🖊️ Dibuje su firma aquí con el dedo o mouse</span>
                    </div>
                )}
            </div>

            {/* Campos de Nombre y RUT (solo si showExtraFields es true) */}
            {showExtraFields && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            {field.dato1Label || 'Nombre y Apellidos'}
                        </label>
                        <input
                            type="text"
                            disabled={disabled}
                            value={dataObj.dato1 || ''}
                            onChange={(e) => onChange({ ...dataObj, dato1: e.target.value })}
                            placeholder="Ej: Juan Pérez"
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 text-xs font-bold text-slate-800 outline-none disabled:bg-gray-50"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            {field.dato2Label || 'RUT'}
                        </label>
                        <input
                            type="text"
                            disabled={disabled}
                            value={dataObj.dato2 || ''}
                            onChange={(e) => {
                                const val = e.target.value
                                const isRutField = !field.dato2Label || field.dato2Label.toUpperCase().includes('RUT')
                                onChange({ ...dataObj, dato2: isRutField ? formatRut(val) : val })
                            }}
                            maxLength={12}
                            placeholder="Ej: 12.345.678-9"
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 text-xs font-bold text-slate-800 outline-none disabled:bg-gray-50"
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

function formatRut(rawRut: string): string {
    const clean = rawRut.replace(/[^0-9kK]/g, '').toUpperCase()
    if (!clean) return ''
    if (clean.length === 1) return clean

    const body = clean.slice(0, -1)
    const dv = clean.slice(-1)

    const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return `${formattedBody}-${dv}`
}

export function computeTotalizerValue(
    campo: any,
    campos: any[],
    respuestasData: Record<string, any>
): { rawValue: number; formatted: string } {
    const targetIds = campo.targetFields && campo.targetFields.length > 0
        ? campo.targetFields
        : null

    let values: number[] = []
    let totalObtained = 0
    let totalMaxPossible = 0

    const processNumValue = (v: any, options?: any[]) => {
        let numVal = NaN
        let maxVal = 0

        if (options && options.length > 0) {
            let selectedOpt: any = null
            if (typeof v === 'object' && v !== null) {
                selectedOpt = options.find((o: any) =>
                    String(o.value) === String(v.value) || String(o.label) === String(v.label) || String(o.label) === String(v.value)
                ) || v
            } else if (v !== undefined && v !== null && String(v).trim() !== '') {
                const strV = String(v).trim()
                selectedOpt = options.find((o: any) =>
                    String(o.value).toLowerCase() === strV.toLowerCase() || String(o.label).toLowerCase() === strV.toLowerCase()
                )
                if (!selectedOpt) numVal = parseFloat(strV)
            }

            if (selectedOpt) {
                numVal = parseFloat(selectedOpt.value !== undefined ? selectedOpt.value : selectedOpt.label)
            }

            maxVal = options.reduce((max: number, opt: any) => {
                const nv = parseFloat(opt.value)
                return !isNaN(nv) ? Math.max(max, nv) : max
            }, 0)
        } else {
            numVal = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''))
            maxVal = numVal
        }

        if (!isNaN(numVal)) {
            values.push(numVal)
            totalObtained += numVal
            totalMaxPossible += maxVal
        }
    }

    // 1. Procesar campos independientes
    campos.forEach((c: any) => {
        if ((c.type === 'numeric_special' || c.type === 'number') && (!targetIds || targetIds.includes(c.id))) {
            const v = respuestasData[c.id]
            const opts = c.type === 'numeric_special'
                ? (c.numericOptions && c.numericOptions.length > 0 ? c.numericOptions : parseNumericSpecialColOptions([]))
                : undefined
            processNumValue(v, opts)
        } else if (c.type === 'audit_item' && (!targetIds || targetIds.includes(c.id))) {
            // 2. Procesar columnas de Requisito de Acta
            const rowCols = c.auditColumns && c.auditColumns.length > 0
                ? c.auditColumns
                : [
                    { key: 'col_req', label: 'REQUISITO', type: 'text' },
                    { key: 'col_est', label: 'ESTADO', type: 'select' },
                    { key: 'col_obs', label: 'OBSERVACIÓN', type: 'text' },
                    { key: 'col_acc', label: 'ACCIÓN CORRECTIVA', type: 'text' }
                ]

            const itemVal = respuestasData[c.id] || {}

            rowCols.forEach((col: any, ci: number) => {
                const colLabel = (col.label || '').toLowerCase()
                const isSummaryCol = col.type === 'totalizer' || col.type === 'number' ||
                    colLabel.includes('promedio') || colLabel.includes('estándar') ||
                    colLabel.includes('estandar') || colLabel.includes('cumplimiento')

                if (col.type === 'number_special' && col.includeInTotalizer !== false && !isSummaryCol) {
                    let v = itemVal[col.key]
                    if (v === undefined && ci === 1) {
                        v = typeof itemVal === 'object' ? itemVal.estado : itemVal
                    }
                    const opts = parseNumericSpecialColOptions(col.options)
                    processNumValue(v, opts)
                }
            })
        }
    })

    if (values.length === 0) {
        return { rawValue: 0, formatted: campo.operation === 'percentage' ? '0.00%' : '0.00' }
    }

    const op = campo.operation || 'percentage'
    let result = 0

    if (op === 'percentage') {
        result = totalMaxPossible > 0 ? (totalObtained / totalMaxPossible) * 100 : 0
        return { rawValue: result, formatted: `${result.toFixed(2)}%` }
    } else if (op === 'sum') {
        result = values.reduce((acc, v) => acc + v, 0)
    } else if (op === 'average') {
        result = values.length > 0 ? values.reduce((acc, v) => acc + v, 0) / values.length : 0
    } else if (op === 'subtract') {
        result = values.length > 0 ? values.reduce((acc, v, i) => i === 0 ? v : acc - v, 0) : 0
    } else if (op === 'multiply') {
        result = values.length > 0 ? values.reduce((acc, v) => acc * v, 1) : 0
    } else if (op === 'divide') {
        result = values.length > 0 ? values.reduce((acc, v, i) => i === 0 ? v : (v !== 0 ? acc / v : 0), 0) : 0
    }

    return { rawValue: result, formatted: result.toFixed(2) }
}

export function parseNumericSpecialColOptions(options?: string[]) {
    const raw = options && options.length > 0
        ? options
        : ['Cumple = 2', 'Cumple Parcial = 1', 'No cumple = 0', 'No evaluado = NE', 'No aplica = NA']
    return raw.map((optStr: string) => {
        const parts = optStr.split('=')
        if (parts.length > 1) {
            return { label: parts[0].trim(), value: parts[1].trim() }
        }
        return { label: optStr.trim(), value: optStr.trim() }
    }).filter((o: any) => o.label)
}

export function computeAuditRowTotalizer(rowCols: any[], getColValueFn: (colKey: string, colIndex: number) => any, operation?: string, totalizerCol?: any) {
    const op = operation || totalizerCol?.operation || 'sum'

    const numKey = totalizerCol?.numeratorColKey
    const denKey = totalizerCol?.denominatorColKey

    const extractColNum = (c: any, raw: any): number => {
        if (!c || c.key === totalizerCol?.key) return 0

        if (c.type === 'totalizer') {
            const subTot = computeAuditRowTotalizer(rowCols, getColValueFn, c.operation || 'sum', c)
            return parseFloat(String(subTot ?? '').replace(/[^0-9.-]/g, '')) || 0
        }

        if (c.type === 'number_special') {
            const numOpts = parseNumericSpecialColOptions(c.options)
            let selectedOpt: any = null
            if (typeof raw === 'object' && raw !== null) {
                selectedOpt = numOpts.find((o: any) =>
                    String(o.value) === String(raw.value) || String(o.label) === String(raw.label) || String(o.label) === String(raw.value)
                ) || raw
            } else if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
                const strV = String(raw).trim()
                selectedOpt = numOpts.find((o: any) =>
                    String(o.value).toLowerCase() === strV.toLowerCase() || String(o.label).toLowerCase() === strV.toLowerCase()
                )
            }
            if (selectedOpt) {
                return parseFloat(selectedOpt.value !== undefined ? selectedOpt.value : selectedOpt.label) || 0
            }
        }
        return parseFloat(String(raw ?? '').replace(/[^0-9.-]/g, '')) || 0
    }

    // Buscar columna Numerador (por clave o etiqueta "PROMEDIO"/"OBTENIDO")
    let numCol = rowCols.find((col: any) => col.key === numKey)
    if (!numCol) {
        numCol = rowCols.find((col: any) => {
            const lbl = (col.label || '').toLowerCase()
            return (lbl.includes('promedio') || lbl.includes('obtenido') || lbl.includes('puntaje')) && col.key !== totalizerCol?.key
        })
    }

    // Buscar columna Denominador (por clave o etiqueta "ESTÁNDAR"/"MANUAL"/"MÁXIMO")
    let denCol = rowCols.find((col: any) => col.key === denKey)
    if (!denCol) {
        denCol = rowCols.find((col: any) => {
            const lbl = (col.label || '').toLowerCase()
            return (lbl.includes('estándar') || lbl.includes('estandar') || lbl.includes('manual') || lbl.includes('máximo') || lbl.includes('maximo') || lbl.includes('esperado')) && col.key !== numCol?.key && col.key !== totalizerCol?.key
        })
    }

    // Solo usar la lógica de numCol/denCol si:
    // 1. Se configuraron claves explícitas (numeratorColKey/denominatorColKey), O
    // 2. La operación es 'percentage' Y se encontraron AMBAS columnas por etiqueta
    const useNumDenPath = (numKey || denKey) || (op === 'percentage' && numCol && denCol)

    if (useNumDenPath && (numCol || denCol)) {
        const numVal = extractColNum(numCol, numCol ? getColValueFn(numCol.key, 0) : 0)
        const denVal = extractColNum(denCol, denCol ? getColValueFn(denCol.key, 0) : 0)

        if (op === 'percentage') {
            if (denVal <= 0 && numVal <= 0) return '0.00%'
            let pct = denVal > 0 ? (numVal / denVal) * 100 : 0
            if (totalizerCol?.capAt100 === true && pct > 100) {
                pct = 100
            }
            return `${pct.toFixed(2)}%`
        } else if (op === 'divide') {
            const res = denVal !== 0 ? numVal / denVal : 0
            return res.toFixed(2)
        } else if (op === 'subtract') {
            const res = numVal - denVal
            return res.toFixed(2)
        } else if (op === 'multiply') {
            const res = numVal * denVal
            return res.toFixed(2)
        } else if (op === 'average') {
            const res = (numVal + denVal) / 2
            return res.toFixed(2)
        } else {
            const res = numVal + denVal
            return res % 1 === 0 ? String(res) : res.toFixed(2)
        }
    }

    // En el fallback genérico, excluir columnas de resumen (ESTÁNDAR, PROMEDIO, CUMPLIMIENTO) y totalizers
    const validCols = rowCols.filter((c: any) => {
        if (c.key === totalizerCol?.key) return false
        if (c.type === 'totalizer') return false
        if (c.includeInTotalizer === false) return false
        const lbl = (c.label || '').toLowerCase()
        if (lbl.includes('estándar') || lbl.includes('estandar') || lbl.includes('cumplimiento')) return false
        return c.type === 'number' || c.type === 'number_special'
    })
    if (validCols.length === 0) return op === 'percentage' ? '0.00%' : '0.00'

    let values: number[] = []
    let totalObtained = 0
    let totalMaxPossible = 0

    validCols.forEach((c: any) => {
        const v = getColValueFn(c.key, 0)
        let numVal = NaN
        let maxVal = 0

        if (c.type === 'number_special') {
            const numOpts = parseNumericSpecialColOptions(c.options)
            let selectedOpt: any = null

            if (typeof v === 'object' && v !== null) {
                selectedOpt = numOpts.find((o: any) =>
                    String(o.value) === String(v.value) || String(o.label) === String(v.label) || String(o.label) === String(v.value)
                ) || v
            } else if (v !== undefined && v !== null && String(v).trim() !== '') {
                const strV = String(v).trim()
                selectedOpt = numOpts.find((o: any) =>
                    String(o.value).toLowerCase() === strV.toLowerCase() || String(o.label).toLowerCase() === strV.toLowerCase()
                )
                if (!selectedOpt) {
                    numVal = parseFloat(strV)
                }
            }

            if (selectedOpt) {
                numVal = parseFloat(selectedOpt.value !== undefined ? selectedOpt.value : selectedOpt.label)
            }

            maxVal = numOpts.reduce((max: number, opt: any) => {
                const nv = parseFloat(opt.value)
                return !isNaN(nv) ? Math.max(max, nv) : max
            }, 0)
        } else {
            numVal = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''))
            maxVal = numVal
        }

        if (!isNaN(numVal)) {
            values.push(numVal)
            totalObtained += numVal
            totalMaxPossible += maxVal
        }
    })

    if (op === 'average') {
        const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
        return avg.toFixed(2)
    } else if (op === 'percentage') {
        let pct = totalMaxPossible > 0 ? (totalObtained / totalMaxPossible) * 100 : 0
        if (totalizerCol?.capAt100 === true && pct > 100) {
            pct = 100
        }
        return `${pct.toFixed(2)}%`
    } else if (op === 'subtract') {
        const sub = values.length > 0 ? values.reduce((a, b, i) => i === 0 ? b : a - b, 0) : 0
        return sub.toFixed(2)
    } else if (op === 'multiply') {
        const mult = values.length > 0 ? values.reduce((a, b) => a * b, 1) : 0
        return mult.toFixed(2)
    } else if (op === 'divide') {
        const div = values.length > 0 ? values.reduce((a, b, i) => i === 0 ? b : (b !== 0 ? a / b : 0), 0) : 0
        return div.toFixed(2)
    } else {
        const sum = values.reduce((a, b) => a + b, 0)
        return sum % 1 === 0 ? String(sum) : sum.toFixed(2)
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
   TABLA DINÁMICA REPETIBLE
   – Permite al usuario agregar y eliminar filas
   – Maneja firmas en celda, totalizadores, RUT, archivos, etc.
───────────────────────────────────────────────────────────────────────────── */
function SignaturePadInCell({
    value,
    disabled,
    onChange
}: {
    value: string
    disabled: boolean
    onChange: (v: string) => void
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasDrawn, setHasDrawn] = useState(false)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (open && value && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d')
            if (ctx) {
                const img = new Image()
                img.onload = () => { ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); ctx.drawImage(img, 0, 0); setHasDrawn(true) }
                img.src = value
            }
        }
    }, [open])

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 }
        const rect = canvasRef.current.getBoundingClientRect()
        const cx = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX
        const cy = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY
        return { x: (cx - rect.left) * (canvasRef.current.width / rect.width), y: (cy - rect.top) * (canvasRef.current.height / rect.height) }
    }

    const startD = (e: React.MouseEvent | React.TouchEvent) => {
        if (disabled) return; setIsDrawing(true); setHasDrawn(true)
        const ctx = canvasRef.current?.getContext('2d')
        if (ctx) { const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0f172a' }
    }
    const drawD = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || disabled) return
        const ctx = canvasRef.current?.getContext('2d')
        if (ctx) { const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke() }
    }
    const stopD = () => {
        if (!isDrawing) return; setIsDrawing(false)
        if (canvasRef.current) onChange(canvasRef.current.toDataURL('image/png'))
    }
    const clear = () => {
        if (disabled) return
        const ctx = canvasRef.current?.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
        setHasDrawn(false); onChange('')
    }

    return (
        <>
            <button
                type="button"
                onClick={() => !disabled && setOpen(true)}
                className={`w-full h-10 border border-dashed border-indigo-300 rounded-lg text-[10px] font-bold text-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center gap-1 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                {value ? '✅ Firmado' : '✍️ Firmar'}
            </button>
            {open && (
                <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-900">✍️ Dibujar Firma</h3>
                            <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-slate-700 text-lg font-bold cursor-pointer">✕</button>
                        </div>
                        <div className="relative border-2 border-dashed border-slate-300 hover:border-cyan-500 rounded-2xl overflow-hidden h-44 cursor-crosshair touch-none">
                            <canvas
                                ref={canvasRef} width={600} height={176}
                                onMouseDown={startD} onMouseMove={drawD} onMouseUp={stopD} onMouseLeave={stopD}
                                onTouchStart={startD} onTouchMove={drawD} onTouchEnd={stopD}
                                className="w-full h-full"
                            />
                            {!hasDrawn && !value && (
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 text-xs font-bold">🖊️ Dibuje aquí con dedo o mouse</div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={clear} className="flex-1 py-2 border border-gray-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-rose-50 cursor-pointer">🗑️ Limpiar</button>
                            <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-black cursor-pointer">✅ Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

function DynamicTableField({
    field,
    value,
    disabled,
    onChange
}: {
    field: any
    value: any
    disabled: boolean
    onChange: (v: any) => void
}) {
    const cols: any[] = field.tableColumns || []

    // value es un array de filas: [ { col_key: cellValue, ... }, ... ]
    const rows: Record<string, any>[] = Array.isArray(value) ? value : [{}]

    const computeTotalizer = (row: Record<string, any>): number => {
        return cols.reduce((sum, col) => {
            if (col.type === 'number' || col.type === 'number_special') {
                const v = row[col.key]
                const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''))
                if (!isNaN(n)) return sum + n
            }
            return sum
        }, 0)
    }

    const updateCell = (rowIndex: number, colKey: string, cellVal: any) => {
        if (disabled) return
        const updated = rows.map((r, ri) =>
            ri === rowIndex ? { ...r, [colKey]: cellVal } : r
        )
        onChange(updated)
    }

    const addRow = () => {
        if (disabled) return
        onChange([...rows, {}])
    }

    const removeRow = (ri: number) => {
        if (disabled) return
        const updated = rows.filter((_, i) => i !== ri)
        onChange(updated.length > 0 ? updated : [{}])
    }

    const [ratingHover, setRatingHover] = useState<{ row: number; col: string; star: number } | null>(null)

    return (
        <div className="w-full space-y-2">
            <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                📊 {field.label} {field.required && <span className="text-rose-500">*</span>}
            </label>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                <table className="w-full border-collapse text-xs min-w-max">
                    <thead>
                        <tr>
                            {cols.map((col: any) => (
                                <th key={col.key} className="bg-slate-800 text-cyan-300 font-black px-3 py-2.5 text-left border-r border-slate-700 whitespace-nowrap text-[11px] uppercase tracking-wide">
                                    {col.label}
                                </th>
                            ))}
                            <th className="bg-slate-700 px-3 py-2.5 text-center text-[10px] font-bold text-slate-300 whitespace-nowrap w-10">
                                Acc.
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, ri) => (
                            <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                {cols.map((col: any) => (
                                    <td key={col.key} className="border border-slate-100 px-2 py-1.5 align-top">
                                        {/* Texto Corto (una línea) */}
                                        {col.type === 'text_short' && (
                                            <input
                                                type="text"
                                                disabled={disabled}
                                                value={row[col.key] || ''}
                                                onChange={(e) => updateCell(ri, col.key, e.target.value)}
                                                className="w-full min-w-[120px] px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-cyan-400 disabled:bg-gray-50 font-medium text-slate-800"
                                                placeholder="Escribir..."
                                            />
                                        )}
                                        {/* Texto Largo (multilínea) */}
                                        {col.type === 'text' && (
                                            <textarea
                                                disabled={disabled}
                                                value={row[col.key] || ''}
                                                rows={2}
                                                onChange={(e) => updateCell(ri, col.key, e.target.value)}
                                                className="w-full min-w-[150px] px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-cyan-400 disabled:bg-gray-50 font-medium text-slate-800 resize-none"
                                                placeholder="Escribir..."
                                            />
                                        )}
                                        {/* Numérico */}
                                        {col.type === 'number' && (
                                            <input
                                                type="number"
                                                disabled={disabled}
                                                value={row[col.key] ?? ''}
                                                onChange={(e) => updateCell(ri, col.key, e.target.value)}
                                                className="w-full min-w-[80px] px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-cyan-400 disabled:bg-gray-50 font-medium text-slate-800"
                                                placeholder="0"
                                            />
                                        )}
                                        {/* Numérico Especial (0..N o NA) */}
                                        {col.type === 'number_special' && (
                                            <div className="flex gap-1 items-center min-w-[110px]">
                                                <input
                                                    type="number"
                                                    disabled={disabled}
                                                    value={row[col.key] === 'NA' ? '' : (row[col.key] ?? '')}
                                                    onChange={(e) => updateCell(ri, col.key, e.target.value)}
                                                    className="w-16 px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-cyan-400 disabled:bg-gray-50 font-medium"
                                                    placeholder="0"
                                                />
                                                <button
                                                    type="button"
                                                    disabled={disabled}
                                                    onClick={() => updateCell(ri, col.key, row[col.key] === 'NA' ? '' : 'NA')}
                                                    className={`px-1.5 py-1 rounded-md text-[10px] font-black transition-all cursor-pointer ${row[col.key] === 'NA' ? 'bg-slate-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-slate-100 hover:text-slate-700'}`}
                                                >
                                                    NA
                                                </button>
                                            </div>
                                        )}
                                        {/* RUT */}
                                        {col.type === 'rut' && (
                                            <input
                                                type="text"
                                                disabled={disabled}
                                                value={row[col.key] || ''}
                                                maxLength={12}
                                                onChange={(e) => updateCell(ri, col.key, formatRut(e.target.value))}
                                                className="w-full min-w-[110px] px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-cyan-400 disabled:bg-gray-50 font-medium text-slate-800"
                                                placeholder="12.345.678-9"
                                            />
                                        )}
                                        {/* Firma */}
                                        {col.type === 'signature' && (
                                            <SignaturePadInCell
                                                value={row[col.key] || ''}
                                                disabled={disabled}
                                                onChange={(v) => updateCell(ri, col.key, v)}
                                            />
                                        )}
                                        {/* Archivo */}
                                        {col.type === 'file' && (
                                            <label className={`flex items-center gap-1 cursor-pointer text-[10px] font-bold text-cyan-700 hover:text-cyan-900 min-w-[120px] ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
                                                📎 {row[col.key] ? row[col.key] : 'Adjuntar...'}
                                                <input type="file" accept="application/pdf,image/*" disabled={disabled} className="hidden"
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0]
                                                        if (f) updateCell(ri, col.key, f.name)
                                                    }}
                                                />
                                            </label>
                                        )}
                                        {/* Select */}
                                        {col.type === 'select' && (
                                            <select
                                                disabled={disabled}
                                                value={row[col.key] || ''}
                                                onChange={(e) => updateCell(ri, col.key, e.target.value)}
                                                className="w-full min-w-[120px] px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-cyan-400 disabled:bg-gray-50 font-medium"
                                            >
                                                <option value="">Seleccionar...</option>
                                                {(col.options || []).filter(Boolean).map((opt: string, oi: number) => (
                                                    <option key={oi} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        )}
                                        {/* Radio */}
                                        {col.type === 'radio' && (
                                            <div className="flex flex-col gap-1 min-w-[100px]">
                                                {(col.options || []).filter(Boolean).map((opt: string, oi: number) => (
                                                    <label key={oi} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer">
                                                        <input type="radio" disabled={disabled} checked={row[col.key] === opt}
                                                            onChange={() => updateCell(ri, col.key, opt)}
                                                            className="w-3.5 h-3.5 text-cyan-600" />
                                                        {opt}
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                        {/* Checkbox */}
                                        {col.type === 'checkbox' && (
                                            <div className="flex flex-col gap-1 min-w-[100px]">
                                                {(col.options || []).filter(Boolean).map((opt: string, oi: number) => {
                                                    const sel: string[] = Array.isArray(row[col.key]) ? row[col.key] : []
                                                    return (
                                                        <label key={oi} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer">
                                                            <input type="checkbox" disabled={disabled}
                                                                checked={sel.includes(opt)}
                                                                onChange={(e) => {
                                                                    const next = e.target.checked ? [...sel, opt] : sel.filter(s => s !== opt)
                                                                    updateCell(ri, col.key, next)
                                                                }}
                                                                className="w-3.5 h-3.5 text-cyan-600 rounded" />
                                                            {opt}
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        )}
                                        {/* Rating (estrellas 1–5) */}
                                        {col.type === 'rating' && (
                                            <div className="flex gap-0.5 min-w-[90px]">
                                                {[1, 2, 3, 4, 5].map((star) => {
                                                    const isHov = ratingHover?.row === ri && ratingHover?.col === col.key && ratingHover?.star >= star
                                                    const isSelected = Number(row[col.key] || 0) >= star
                                                    return (
                                                        <button
                                                            key={star}
                                                            type="button"
                                                            disabled={disabled}
                                                            onClick={() => updateCell(ri, col.key, star)}
                                                            onMouseEnter={() => setRatingHover({ row: ri, col: col.key, star })}
                                                            onMouseLeave={() => setRatingHover(null)}
                                                            className={`text-lg leading-none cursor-pointer transition-transform hover:scale-110 ${isHov || isSelected ? 'text-cyan-500' : 'text-gray-300'}`}
                                                        >★</button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                        {/* Totalizador */}
                                        {col.type === 'totalizer' && (
                                            <div className="flex items-center justify-center min-w-[60px] px-2 py-1 bg-cyan-50 rounded-lg border border-cyan-200 font-black text-cyan-800 text-xs">
                                                Σ {computeTotalizer(row)}
                                            </div>
                                        )}
                                    </td>
                                ))}
                                {/* Botón eliminar fila */}
                                <td className="border border-slate-100 px-2 py-1.5 text-center">
                                    {rows.length > 1 && !disabled && (
                                        <button
                                            type="button"
                                            onClick={() => removeRow(ri)}
                                            className="text-rose-400 hover:text-rose-600 font-black text-sm cursor-pointer transition-colors"
                                        >🗑️</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Botón + Agregar fila */}
            {!disabled && (
                <button
                    type="button"
                    onClick={addRow}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer shadow-md shadow-cyan-500/20"
                >
                    <span className="text-base font-black">+</span> Agregar Registro
                </button>
            )}
        </div>
    )
}

export default function LlenarActaClient({ initialActa, plantilla }: Props) {
    const router = useRouter()
    
    // Cabecera Institucional
    const [rbd, setRbd] = useState<number>(initialActa.rbd || 0)
    const [nombreEstablecimiento, setNombreEstablecimiento] = useState(initialActa.nombreEstablecimiento || '')
    const [direccion, setDireccion] = useState(initialActa.direccion || '')
    const [ciudad, setCiudad] = useState(initialActa.ciudad || '')
    const [institucion, setInstitucion] = useState(initialActa.institucion || '')
    const [sucursal, setSucursal] = useState(initialActa.sucursal || '')
    const [supervisorNombre, setSupervisorNombre] = useState(initialActa.supervisorNombre || '')
    const [supervisorRut, setSupervisorRut] = useState(formatRut(initialActa.supervisorRut || ''))

    // Respuestas dinámicas
    const [respuestasData, setRespuestasData] = useState<Record<string, any>>(
        initialActa.respuestasData && initialActa.respuestasData !== '{}'
            ? JSON.parse(initialActa.respuestasData) 
            : {}
    )
    const [isSaving, setIsSaving] = useState(false)
    const isFinalizado = initialActa.estado === 'Finalizado'

    // Modo de visualización responsive (Tarjetas para móvil vs Tabla completa)
    const [viewLayoutMode, setViewLayoutMode] = useState<'cards' | 'table'>('cards')

    // Estados de Modales tras Finalizar
    const [showPostFinalizeModal, setShowPostFinalizeModal] = useState(false)
    const [showEmailModal, setShowEmailModal] = useState(false)
    const [destEmail, setDestEmail] = useState('')
    const [ccEmail, setCcEmail] = useState('')
    const [isSendingEmail, setIsSendingEmail] = useState(false)
    const [emailMessage, setEmailMessage] = useState({ type: '', text: '' })

    // Campos de la plantilla
    let campos: any[] = []
    try {
        if (typeof plantilla?.campos === 'string') {
            campos = JSON.parse(plantilla.campos)
        } else if (Array.isArray(plantilla?.campos)) {
            campos = plantilla.campos
        }
    } catch (e) {
        campos = []
    }

    // Estados de Auto-guardado y Respaldo Local (Offline)
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'local_saved' | 'error'>('idle')
    const [lastSavedTime, setLastSavedTime] = useState<string | null>(null)
    const isInitialMount = useRef(true)

    // 1. Recuperar borrador local de localStorage al montar si hubo pérdida previa de señal
    useEffect(() => {
        if (isFinalizado) return
        try {
            const localKey = `acta_draft_${initialActa.id}`
            const savedDraft = localStorage.getItem(localKey)
            if (savedDraft) {
                const parsed = JSON.parse(savedDraft)
                if (parsed.respuestasData && Object.keys(parsed.respuestasData).length > 0) {
                    setRespuestasData(prev => ({ ...prev, ...parsed.respuestasData }))
                    if (parsed.supervisorRut) setSupervisorRut(parsed.supervisorRut)
                }
            }
        } catch (e) {
            console.error('Error al cargar borrador local de localStorage:', e)
        }
    }, [initialActa.id, isFinalizado])

    // 2. Efecto de Auto-guardado automático con Respaldo Local instantáneo y sincronización al Servidor (1.5s debounce)
    useEffect(() => {
        if (isFinalizado) return
        if (isInitialMount.current) {
            isInitialMount.current = false
            return
        }

        // A. Guardado instantáneo local en localStorage (Backup por corte súbito de señal)
        try {
            const localKey = `acta_draft_${initialActa.id}`
            localStorage.setItem(
                localKey,
                JSON.stringify({ respuestasData, supervisorRut, updatedAt: Date.now() })
            )
            setAutoSaveStatus('local_saved')
        } catch (e) {
            console.error('Error respaldando localmente:', e)
        }

        // B. Debounce de 1.5s para enviar auto-guardado al servidor en segundo plano
        const timer = setTimeout(async () => {
            setAutoSaveStatus('saving')
            try {
                const res = await saveActaResponse(initialActa.id, {
                    rbd,
                    nombreEstablecimiento,
                    direccion,
                    ciudad,
                    institucion,
                    sucursal,
                    supervisorNombre,
                    supervisorRut,
                    respuestasData: JSON.stringify(respuestasData),
                    estado: 'Borrador'
                })

                if (res.success) {
                    setAutoSaveStatus('saved')
                    setLastSavedTime(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
                } else {
                    setAutoSaveStatus('local_saved')
                }
            } catch (err) {
                setAutoSaveStatus('local_saved')
            }
        }, 1500)

        return () => clearTimeout(timer)
    }, [respuestasData, supervisorRut])

    const handleChange = (fieldId: string, value: any) => {
        if (isFinalizado) return
        setRespuestasData(prev => ({ ...prev, [fieldId]: value }))
    }

    // Exportar / Descargar PDF
    const handleDownloadPDF = () => {
        const doc = generateActaPDF(
            { ...initialActa, rbd, nombreEstablecimiento, direccion, ciudad, institucion, sucursal, supervisorNombre, supervisorRut },
            plantilla,
            respuestasData
        )
        const cleanName = (nombreEstablecimiento || 'Colegio').replace(/[^a-zA-Z0-9]/g, '_')
        const fechaStr = new Date().toISOString().slice(0, 10)
        doc.save(`Acta_Supervision_${cleanName}_${fechaStr}.pdf`)
    }

    const handleSave = async (estado: 'Borrador' | 'Finalizado') => {
        if (isFinalizado) return

        // Validación de Firma Digital si el formulario cuenta con este tipo de campo
        if (estado === 'Finalizado') {
            const isSignatureValue = (val: any): boolean => {
                if (!val) return false
                if (typeof val === 'string' && val.startsWith('data:image')) return true
                if (typeof val === 'object' && val.firma && typeof val.firma === 'string' && val.firma.startsWith('data:image')) return true
                return false
            }

            const missingSignatures: string[] = []

            campos.forEach((c: any) => {
                // 1. Campos de firma independientes
                if (c.type === 'signature' || c.type === 'signature_with_data') {
                    const val = respuestasData[c.id]
                    if (!isSignatureValue(val)) {
                        missingSignatures.push(c.label || 'Firma Digital')
                    }
                }
                // 2. Tablas dinámicas con columnas de firma
                else if (c.type === 'dynamic_table' && Array.isArray(c.columns)) {
                    const sigCols = c.columns.filter((col: any) => col.type === 'signature')
                    if (sigCols.length > 0) {
                        const tableRows = respuestasData[c.id]
                        if (Array.isArray(tableRows)) {
                            tableRows.forEach((row: any, rIdx: number) => {
                                sigCols.forEach((col: any) => {
                                    const val = row[col.key]
                                    if (!isSignatureValue(val)) {
                                        missingSignatures.push(`${c.label || 'Tabla'} - Fila ${rIdx + 1} (${col.label || 'Firma'})`)
                                    }
                                })
                            })
                        }
                    }
                }
            })

            if (missingSignatures.length > 0) {
                alert(`⚠️ No se puede finalizar el acta: Debes firmar en TODAS las cajas de firma requeridas (${missingSignatures.length} pendiente${missingSignatures.length > 1 ? 's' : ''}).\n\nFirmas faltantes:\n• ${missingSignatures.join('\n• ')}`)
                return
            }
        }

        setIsSaving(true)
        const res = await saveActaResponse(initialActa.id, {
            rbd,
            nombreEstablecimiento,
            direccion,
            ciudad,
            institucion,
            sucursal,
            supervisorNombre,
            supervisorRut,
            respuestasData: JSON.stringify(respuestasData),
            estado
        })

        if (res.success) {
            if (estado === 'Finalizado') {
                // Abrir Modal de consulta de correo
                setShowPostFinalizeModal(true)
            } else {
                alert('💾 Borrador de acta guardado exitosamente.')
                router.refresh()
            }
        } else {
            alert(res.error || 'Error al guardar')
        }
        setIsSaving(false)
    }

    // Nombres y fechas para el correo
    const currentMonthName = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
    const currentDateStr = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const handleSendEmailSubmit = async () => {
        if (!destEmail.trim()) {
            setEmailMessage({ type: 'error', text: 'Por favor ingresa un correo electrónico de destino.' })
            return
        }

        setIsSendingEmail(true)
        setEmailMessage({ type: '', text: '' })

        try {
            const doc = generateActaPDF(
                { ...initialActa, rbd, nombreEstablecimiento, direccion, ciudad, institucion, sucursal, supervisorNombre, supervisorRut },
                plantilla,
                respuestasData
            )

            const pdfDataUri = doc.output('datauristring')

            const res = await sendActaPdfEmail({
                to: destEmail.trim(),
                cc: ccEmail.trim(),
                colegioNombre: nombreEstablecimiento || 'Colegio',
                mesAno: currentMonthName,
                fechaRealizada: currentDateStr,
                pdfBase64: pdfDataUri
            })

            if (res.success) {
                alert(`✅ ¡Correo enviado exitosamente con el PDF del acta adjunto!`)
                setShowEmailModal(false)
                router.push('/dashboard/actas/generar-acta')
            } else {
                setEmailMessage({ type: 'error', text: res.error || 'Error al enviar el correo' })
            }
        } catch (err: any) {
            setEmailMessage({ type: 'error', text: err.message || 'Error al generar o enviar el PDF por correo' })
        } finally {
            setIsSendingEmail(false)
        }
    }

    // Agrupar campos para separar renderizado de Tabla (Excel/Imagen 2) y campos individuales
    const segments: { type: 'audit-table' | 'regular'; fields: any[] }[] = []
    let currentSegment: { type: 'audit-table' | 'regular'; fields: any[] } | null = null

    for (const f of campos) {
        const isAudit = f.type === 'audit_item' || f.type === 'group'
        if (isAudit) {
            if (!currentSegment || currentSegment.type !== 'audit-table') {
                currentSegment = { type: 'audit-table', fields: [] }
                segments.push(currentSegment)
            }
            currentSegment.fields.push(f)
        } else {
            if (!currentSegment || currentSegment.type !== 'regular') {
                currentSegment = { type: 'regular', fields: [] }
                segments.push(currentSegment)
            }
            currentSegment.fields.push(f)
        }
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300 pb-16">
            {/* Header / Titular */}
            <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2 flex-wrap">
                        <span>📝</span> Llenar Acta: {plantilla?.nombre}
                        {initialActa?.correlativo && (
                            <span className="text-xs px-2.5 py-1 bg-cyan-900/80 text-cyan-300 font-mono rounded-lg border border-cyan-700/50 font-bold">
                                N° {String(initialActa.correlativo).padStart(10, '0')}
                            </span>
                        )}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        <p className="text-sm text-slate-400 font-medium">
                            Estado Actual: <span className={`font-bold ${isFinalizado ? 'text-emerald-400' : 'text-amber-400'}`}>{initialActa.estado}</span>
                        </p>
                        {!isFinalizado && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-bold text-slate-300 shadow-inner">
                                {autoSaveStatus === 'saving' && (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                                        <span className="text-amber-300 font-extrabold text-[11px]">⏳ Guardando cambios...</span>
                                    </>
                                )}
                                {autoSaveStatus === 'saved' && (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                        <span className="text-emerald-400 font-extrabold text-[11px]">
                                            🟢 Auto-guardado {lastSavedTime ? `(${lastSavedTime})` : ''}
                                        </span>
                                    </>
                                )}
                                {autoSaveStatus === 'local_saved' && (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                                        <span className="text-cyan-300 font-extrabold text-[11px]">💾 Respaldado Localmente (Offline)</span>
                                    </>
                                )}
                                {autoSaveStatus === 'idle' && (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                        <span className="text-emerald-400 font-extrabold text-[11px]">🟢 Auto-guardado activo</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                    {!isFinalizado && (
                        <>
                            <button
                                type="button"
                                onClick={() => handleSave('Borrador')}
                                disabled={isSaving}
                                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-700/50 text-xs font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                                <span>💾</span> {isSaving ? 'Guardando...' : 'Guardar Borrador'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirm('¿Estás seguro de finalizar esta acta? Ya no podrás editarla.')) {
                                        handleSave('Finalizado')
                                    }
                                }}
                                disabled={isSaving}
                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-600/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                <span>✅</span> {isSaving ? 'Guardando...' : 'Finalizar Acta'}
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={handleDownloadPDF}
                        className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2 cursor-pointer"
                    >
                        <span>📄</span> Exportar PDF
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/actas/generar-acta')}
                        className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all cursor-pointer"
                    >
                        ⬅ Volver
                    </button>
                </div>
            </div>

            {/* Cabecera Estándar / Información Institucional */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                <h2 className="text-lg font-black text-cyan-600 border-b border-gray-100 pb-3 flex items-center gap-2">
                    <span>🏛️</span> Información Institucional
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">RBD</label>
                        <input 
                            type="number" 
                            disabled={true}
                            value={rbd || ''} 
                            readOnly
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 font-bold text-slate-700 text-sm outline-none cursor-not-allowed" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Establecimiento</label>
                        <input 
                            type="text" 
                            disabled={true}
                            value={nombreEstablecimiento} 
                            readOnly
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 font-bold text-slate-700 text-sm outline-none cursor-not-allowed" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dirección</label>
                        <input 
                            type="text" 
                            disabled={true}
                            value={direccion} 
                            readOnly
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 font-bold text-slate-700 text-sm outline-none cursor-not-allowed" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ciudad</label>
                        <input 
                            type="text" 
                            disabled={true}
                            value={ciudad} 
                            readOnly
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 font-bold text-slate-700 text-sm outline-none cursor-not-allowed" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Institución</label>
                        <input 
                            type="text" 
                            disabled={true}
                            value={institucion} 
                            readOnly
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 font-bold text-slate-700 text-sm outline-none cursor-not-allowed" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sucursal</label>
                        <input 
                            type="text" 
                            disabled={true}
                            value={sucursal} 
                            readOnly
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 font-bold text-slate-700 text-sm outline-none cursor-not-allowed" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Supervisor (Nombre)</label>
                        <input 
                            type="text" 
                            disabled={true}
                            value={supervisorNombre} 
                            readOnly
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 font-bold text-slate-700 text-sm outline-none cursor-not-allowed" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Supervisor (RUT) <span className="text-cyan-600 font-extrabold">*</span></label>
                        <input 
                            type="text" 
                            disabled={isFinalizado}
                            value={supervisorRut} 
                            onChange={e => setSupervisorRut(formatRut(e.target.value))}
                            placeholder="Ej: 12.345.678-9"
                            maxLength={12}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-cyan-300 focus:ring-2 focus:ring-cyan-500 font-bold text-slate-900 bg-white text-sm outline-none disabled:bg-gray-50" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha Creación/Llenado</label>
                        <input 
                            type="text" 
                            disabled={true}
                            value={initialActa.createdAt ? new Date(initialActa.createdAt).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} 
                            readOnly
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 font-bold text-slate-700 text-sm outline-none cursor-not-allowed" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado del Acta</label>
                        <input 
                            type="text" 
                            disabled={true}
                            value={initialActa.estado || 'Borrador'} 
                            readOnly
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 font-bold text-slate-700 text-sm outline-none cursor-not-allowed" 
                        />
                    </div>
                </div>
            </div>

            {/* Cuestionario Dinámico y Tabla de Preguntas */}
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-3">
                    <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                        <span>📋</span> Preguntas del Acta
                    </h2>
                    {/* Selector de modo de vista (Tarjetas para móvil vs Tabla Completa) */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-extrabold shadow-inner">
                        <button
                            type="button"
                            onClick={() => setViewLayoutMode('cards')}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                viewLayoutMode === 'cards'
                                    ? 'bg-cyan-600 text-white shadow-md'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>📱</span> Modo Tarjetas (Móvil)
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewLayoutMode('table')}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                viewLayoutMode === 'table'
                                    ? 'bg-cyan-600 text-white shadow-md'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>📊</span> Tabla Completa
                        </button>
                    </div>
                </div>

                {campos.length === 0 ? (
                    <div className="bg-white p-8 rounded-3xl text-center text-gray-400 shadow-sm border border-gray-100">
                        La plantilla no tiene campos definidos.
                    </div>
                ) : (
                    segments.map((seg, si) => {
                        if (seg.type === 'audit-table') {
                            let currentGroup = 'SUPERVISIÓN'
                            let groupRowCount: Record<string, number> = {}

                            seg.fields.forEach((f: any) => {
                                if (f.type === 'group') {
                                    currentGroup = f.label || 'GRUPO'
                                    groupRowCount[currentGroup] = 0
                                } else if (f.type === 'audit_item') {
                                    if (currentGroup) groupRowCount[currentGroup] = (groupRowCount[currentGroup] || 0) + 1
                                }
                            })

                            currentGroup = 'SUPERVISIÓN'
                            const renderedGroups = new Set<string>()

                            const firstAudit = seg.fields.find((f: any) => f.type === 'audit_item')
                            const auditCols = firstAudit?.auditColumns && firstAudit.auditColumns.length > 0
                                ? firstAudit.auditColumns
                                : [
                                    { key: 'col_req', label: 'REQUISITO', type: 'text' as const, options: [] as string[] },
                                    { key: 'col_est', label: 'ESTADO', type: 'select' as const, options: ['Cumple', 'No Cumple', 'No Aplica'] },
                                    { key: 'col_obs', label: 'OBSERVACIÓN', type: 'text' as const, options: [] as string[] },
                                    { key: 'col_acc', label: 'ACCIÓN CORRECTIVA', type: 'text' as const, options: [] as string[] }
                                ]

                            return (
                                <div key={si} className="space-y-4">
                                    {/* A. MODO TARJETAS (MÓVIL RESPONSIVE: Muestra Observación y Acción Correctiva 100% visibles sin scroll lateral) */}
                                    {viewLayoutMode === 'cards' && (
                                        <div className="space-y-4">
                                            {seg.fields.map((f: any) => {
                                                if (f.type === 'group') {
                                                    currentGroup = f.label || 'GRUPO'
                                                    return (
                                                        <div key={f.id} className="pt-2 pb-1 border-b-2 border-cyan-500 flex items-center gap-2">
                                                            <span className="px-3 py-1 bg-slate-900 text-cyan-300 text-xs font-black rounded-lg uppercase tracking-wider">
                                                                📁 {currentGroup}
                                                            </span>
                                                        </div>
                                                    )
                                                }
                                                if (f.type !== 'audit_item') return null

                                                const itemValue = respuestasData[f.id] || {}

                                                const getColValue = (colKey: string, colIndex: number) => {
                                                    if (itemValue && itemValue[colKey] !== undefined) return itemValue[colKey]
                                                    if (colIndex === 1) return typeof itemValue === 'object' ? itemValue.estado || 'Cumple' : (itemValue || 'Cumple')
                                                    if (colIndex === 2) return typeof itemValue === 'object' ? itemValue.observacion || '' : ''
                                                    if (colIndex === 3) return typeof itemValue === 'object' ? itemValue.accionCorrectiva || '' : ''
                                                    return ''
                                                }

                                                const updateColValue = (colKey: string, val: any) => {
                                                    handleChange(f.id, {
                                                        ...(typeof itemValue === 'object' ? itemValue : {}),
                                                        [colKey]: val
                                                    })
                                                }

                                                const rowColsDynamic = f.auditColumns && f.auditColumns.length > 0 ? f.auditColumns : auditCols
                                                const estadoBadgeCol = rowColsDynamic[1]
                                                const estadoBadgeRaw = estadoBadgeCol ? getColValue(estadoBadgeCol.key, 1) : 'Cumple'
                                                const estadoBadgeVal = typeof estadoBadgeRaw === 'object' && estadoBadgeRaw !== null
                                                    ? (estadoBadgeRaw.label || estadoBadgeRaw.value || 'Cumple')
                                                    : String(estadoBadgeRaw ?? 'Cumple')

                                                return (
                                                    <div key={f.id} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3.5 shadow-sm hover:border-cyan-200 transition-all">
                                                        {/* Header de la Tarjeta */}
                                                        <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-2.5 py-0.5 bg-slate-900 text-cyan-300 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                                    {currentGroup}
                                                                </span>
                                                            </div>
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                                estadoBadgeVal === 'Cumple'
                                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                                    : (estadoBadgeVal === 'No Cumple' || estadoBadgeVal === 'No cumple')
                                                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                            }`}>
                                                                {estadoBadgeVal}
                                                            </span>
                                                        </div>

                                                        {/* Enunciado del Requisito */}
                                                        {f.label && f.label.trim() !== '' && (
                                                            <p className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                                                                {f.label} {f.required && <span className="text-rose-500 ml-1">*</span>}
                                                            </p>
                                                        )}

                                                        {/* Controles y Campos en Modo Tarjetas */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                                            {rowColsDynamic.map((col: any, ci: number) => {
                                                                if (ci === 0 && f.label && f.label.trim() !== '') return null
                                                                const colVal = getColValue(col.key, ci)
                                                                const primitiveVal = typeof colVal === 'object' && colVal !== null
                                                                    ? (col.type === 'select' ? colVal.value : colVal.label || colVal.value || '')
                                                                    : String(colVal ?? '')

                                                                const isColNumeric = col.type === 'number' || col.type === 'number_special' || col.type === 'totalizer' || /^\d+$/.test(col.label || '')

                                                                return (
                                                                    <div key={col.key} className={isColNumeric ? 'col-span-1' : 'col-span-1 sm:col-span-2'}>
                                                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                                                            {col.label || (ci === 1 ? 'EVALUACIÓN' : 'CAMPO')}
                                                                        </label>
                                                                        {col.type === 'select' ? (
                                                                            <select
                                                                                disabled={isFinalizado}
                                                                                value={primitiveVal}
                                                                                onChange={(e) => updateColValue(col.key, e.target.value)}
                                                                                className={`w-full px-3 py-2 rounded-xl border text-xs font-black outline-none cursor-pointer ${
                                                                                    primitiveVal === 'Cumple'
                                                                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                                                                        : (primitiveVal === 'No Cumple' || primitiveVal === 'No cumple')
                                                                                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                                                                                        : 'bg-amber-50 text-amber-800 border-amber-300'
                                                                                }`}
                                                                            >
                                                                                {(col.options && col.options.length > 0 ? col.options : ['Cumple', 'No Cumple', 'N/A']).map((opt: string, j: number) => (
                                                                                    <option key={j} value={opt}>{opt}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : col.type === 'number' ? (
                                                                            <input
                                                                                type="number"
                                                                                disabled={isFinalizado}
                                                                                value={primitiveVal}
                                                                                onChange={(e) => updateColValue(col.key, e.target.value)}
                                                                                placeholder="0"
                                                                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-900 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none disabled:bg-gray-100"
                                                                            />
                                                                        ) : col.type === 'number_special' ? (() => {
                                                                            const numOpts = parseNumericSpecialColOptions(col.options)
                                                                            const selectedObj = typeof colVal === 'object' && colVal !== null ? colVal : null
                                                                            const selectedVal = selectedObj ? selectedObj.value : String(colVal ?? '')

                                                                            return (
                                                                                <select
                                                                                    disabled={isFinalizado}
                                                                                    value={selectedVal}
                                                                                    onChange={(e) => {
                                                                                        const found = numOpts.find((o: any) => o.value === e.target.value || o.label === e.target.value)
                                                                                        updateColValue(col.key, found ? { label: found.label, value: found.value } : e.target.value)
                                                                                    }}
                                                                                    className="w-full px-3 py-2 rounded-xl border text-xs font-black outline-none cursor-pointer bg-emerald-50 text-emerald-800 border-emerald-300"
                                                                                >
                                                                                    <option value="">Seleccionar opción...</option>
                                                                                    {numOpts.map((opt: any, j: number) => (
                                                                                        <option key={j} value={opt.value}>
                                                                                            {opt.label} ({opt.value})
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                            )
                                                                        })() : col.type === 'totalizer' ? (
                                                                            <div className="px-3 py-2 bg-cyan-50 rounded-xl border border-cyan-200 font-black text-cyan-800 text-xs inline-flex items-center gap-1.5">
                                                                                <span>🧮</span>
                                                                                <span>{computeAuditRowTotalizer(rowColsDynamic, (colKey) => getColValue(colKey, 0), col.operation, col)}</span>
                                                                            </div>
                                                                        ) : (
                                                                            <input
                                                                                type="text"
                                                                                disabled={isFinalizado}
                                                                                value={colVal}
                                                                                onChange={(e) => updateColValue(col.key, e.target.value)}
                                                                                placeholder={col.label + "..."}
                                                                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-900 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none disabled:bg-gray-100"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {/* B. MODO TABLA COMPLETA (EXCEL LAYOUT PARA ESCRITORIO) */}
                                    {viewLayoutMode === 'table' && (
                                        <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-md bg-white">
                                            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-[11px] font-bold text-amber-800 flex items-center justify-between">
                                                <span>📱 Tip: En pantallas pequeñas, desliza la tabla hacia la derecha para ver todas las columnas o activa el "Modo Tarjetas".</span>
                                            </div>
                                            <table className="w-full border-collapse text-xs" style={{ minWidth: '700px' }}>
                                                <thead>
                                                    <tr className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-wider border-b border-slate-800">
                                                        {seg.fields.some((f: any) => f.type === 'group') && (
                                                            <th className="px-4 py-3.5 text-center border-r border-slate-700 w-16">GRUPO</th>
                                                        )}
                                                        {auditCols.map((col: any, ci: number) => {
                                                            const isEval = col.type === 'select' || col.type === 'number_special' || col.type === 'number' || col.type === 'totalizer' || /^\d+$/.test(col.label || '') || (col.label || '').toUpperCase().includes('EVALUA') || (col.label || '').toUpperCase().includes('ESTADO')
                                                            const isObs = (col.label || '').toUpperCase().includes('OBSERV') || (col.label || '').toUpperCase().includes('ACCI')
                                                            return (
                                                                <th
                                                                    key={col.key}
                                                                    className={`px-3 py-3.5 border-r border-slate-700 whitespace-nowrap ${
                                                                        ci === 0
                                                                            ? 'text-left min-w-[220px] sm:min-w-[260px]'
                                                                            : isEval
                                                                            ? 'text-center w-36 min-w-[130px] max-w-[150px]'
                                                                            : isObs
                                                                            ? 'text-left min-w-[280px]'
                                                                            : 'text-left min-w-[160px]'
                                                                    }`}
                                                                >
                                                                    {col.label}
                                                                </th>
                                                            )
                                                        })}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 text-xs">
                                                    {seg.fields.map((f: any, fi: number) => {
                                                        if (f.type === 'group') {
                                                            currentGroup = f.label || 'GRUPO'
                                                            return null
                                                        }
                                                        if (f.type !== 'audit_item') return null

                                                        const showGroupCell = seg.fields.some((f2: any) => f2.type === 'group') && !renderedGroups.has(currentGroup)
                                                        if (showGroupCell && currentGroup) renderedGroups.add(currentGroup)

                                                        const itemValue = respuestasData[f.id] || {}

                                                        const getColValue = (colKey: string, colIndex: number) => {
                                                            if (itemValue && itemValue[colKey] !== undefined) return itemValue[colKey]
                                                            if (colIndex === 1) return typeof itemValue === 'object' ? itemValue.estado || 'Cumple' : (itemValue || 'Cumple')
                                                            if (colIndex === 2) return typeof itemValue === 'object' ? itemValue.observacion || '' : ''
                                                            if (colIndex === 3) return typeof itemValue === 'object' ? itemValue.accionCorrectiva || '' : ''
                                                            return ''
                                                        }

                                                        const updateColValue = (colKey: string, val: any) => {
                                                            handleChange(f.id, {
                                                                ...(typeof itemValue === 'object' ? itemValue : {}),
                                                                [colKey]: val
                                                            })
                                                        }

                                                        const rowColsDynamic = f.auditColumns && f.auditColumns.length > 0 ? f.auditColumns : auditCols

                                                        return (
                                                            <tr key={f.id} className={fi % 2 === 0 ? 'bg-white hover:bg-slate-50/50' : 'bg-slate-50/70 hover:bg-slate-100/50'}>
                                                                {/* Celda vertical de grupo con rowspan */}
                                                                {seg.fields.some((f2: any) => f2.type === 'group') && (
                                                                    showGroupCell ? (
                                                                        <td
                                                                            rowSpan={groupRowCount[currentGroup] || 1}
                                                                            className="border-r border-gray-200 border-b border-gray-200 bg-slate-950 text-center align-middle p-0"
                                                                        >
                                                                            <div className="flex items-center justify-center h-full py-4 px-2">
                                                                                <span
                                                                                    className="text-cyan-300 font-black text-[10px] uppercase tracking-widest"
                                                                                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}
                                                                                >
                                                                                    {currentGroup}
                                                                                </span>
                                                                            </div>
                                                                        </td>
                                                                    ) : <td className="hidden" />
                                                                )}
                                                                {rowColsDynamic.map((col: any, ci: number) => {
                                                                    if (ci === 0) {
                                                                        const colVal = getColValue(col.key, ci)
                                                                        const hasStaticLabel = f.label && f.label.trim() !== ''
                                                                        return (
                                                                            <td key={col.key} className="p-3 border-r border-gray-200 align-middle font-semibold text-slate-800 min-w-[220px] sm:min-w-[260px]">
                                                                                {hasStaticLabel ? (
                                                                                    <div>
                                                                                        {f.label}
                                                                                        {f.required && <span className="text-rose-500 ml-1">*</span>}
                                                                                    </div>
                                                                                ) : (
                                                                                    col.type === 'select' ? (
                                                                                        <select
                                                                                            disabled={isFinalizado}
                                                                                            value={colVal}
                                                                                            onChange={(e) => updateColValue(col.key, e.target.value)}
                                                                                            className="w-full px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-slate-800 bg-white outline-none cursor-pointer focus:ring-2 focus:ring-cyan-500"
                                                                                        >
                                                                                            {(col.options && col.options.length > 0 ? col.options : ['Opción 1']).map((opt: string, j: number) => (
                                                                                                <option key={j} value={opt}>{opt}</option>
                                                                                            ))}
                                                                                        </select>
                                                                                    ) : col.type === 'number' ? (
                                                                                        <input
                                                                                            type="number"
                                                                                            disabled={isFinalizado}
                                                                                            value={colVal}
                                                                                            onChange={(e) => updateColValue(col.key, e.target.value)}
                                                                                            placeholder={col.label + "..."}
                                                                                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-slate-800 bg-white text-center focus:ring-2 focus:ring-cyan-500 outline-none disabled:bg-gray-100"
                                                                                        />
                                                                                    ) : col.type === 'number_special' ? (() => {
                                                                                        const numOpts = parseNumericSpecialColOptions(col.options)
                                                                                        const selectedObj = typeof colVal === 'object' && colVal !== null ? colVal : null
                                                                                        const selectedVal = selectedObj ? selectedObj.value : String(colVal ?? '')
                                                                                        return (
                                                                                            <select
                                                                                                disabled={isFinalizado}
                                                                                                value={selectedVal}
                                                                                                onChange={(e) => {
                                                                                                    const found = numOpts.find((o: any) => o.value === e.target.value || o.label === e.target.value)
                                                                                                    updateColValue(col.key, found ? { label: found.label, value: found.value } : e.target.value)
                                                                                                }}
                                                                                                className="w-full px-2.5 py-1.5 rounded-xl border text-xs font-black outline-none cursor-pointer bg-emerald-50 text-emerald-800 border-emerald-300 text-center"
                                                                                            >
                                                                                                <option value="">Seleccionar...</option>
                                                                                                {numOpts.map((opt: any, j: number) => (
                                                                                                    <option key={j} value={opt.value}>
                                                                                                        {opt.label} ({opt.value})
                                                                                                    </option>
                                                                                                ))}
                                                                                            </select>
                                                                                        )
                                                                                    })() : (
                                                                                        <input
                                                                                            type="text"
                                                                                            disabled={isFinalizado}
                                                                                            value={colVal}
                                                                                            onChange={(e) => updateColValue(col.key, e.target.value)}
                                                                                            placeholder={col.label + "..."}
                                                                                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-slate-800 bg-white focus:ring-2 focus:ring-cyan-500 outline-none disabled:bg-gray-100"
                                                                                        />
                                                                                    )
                                                                                )}
                                                                            </td>
                                                                        )
                                                                    }
                                                                    const colVal = getColValue(col.key, ci)
                                                                    const primitiveVal = typeof colVal === 'object' && colVal !== null
                                                                        ? (col.type === 'select' ? colVal.value : colVal.label || colVal.value || '')
                                                                        : String(colVal ?? '')

                                                                    const isEval = col.type === 'select' || col.type === 'number_special' || col.type === 'number' || col.type === 'totalizer' || /^\d+$/.test(col.label || '') || (col.label || '').toUpperCase().includes('EVALUA') || (col.label || '').toUpperCase().includes('ESTADO')
                                                                    const isObs = (col.label || '').toUpperCase().includes('OBSERV') || (col.label || '').toUpperCase().includes('ACCI')

                                                                    return (
                                                                        <td key={col.key} className={`p-2 border-r border-gray-200 align-middle ${isEval ? 'text-center w-36 min-w-[130px]' : isObs ? 'min-w-[280px]' : ''}`}>
                                                                            {col.type === 'select' ? (
                                                                                <select
                                                                                    disabled={isFinalizado}
                                                                                    value={primitiveVal}
                                                                                    onChange={(e) => updateColValue(col.key, e.target.value)}
                                                                                    className={`w-full px-2.5 py-1.5 rounded-xl border text-xs font-extrabold outline-none cursor-pointer ${
                                                                                        primitiveVal === 'Cumple'
                                                                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                                                                            : (primitiveVal === 'No Cumple' || primitiveVal === 'No cumple')
                                                                                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                                                                                            : 'bg-amber-50 text-amber-800 border-amber-300'
                                                                                    }`}
                                                                                >
                                                                                    {(col.options && col.options.length > 0 ? col.options : ['Cumple', 'No Cumple', 'N/A']).map((opt: string, j: number) => (
                                                                                        <option key={j} value={opt}>{opt}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : col.type === 'number' ? (
                                                                                <input
                                                                                    type="number"
                                                                                    disabled={isFinalizado}
                                                                                    value={primitiveVal}
                                                                                    onChange={(e) => updateColValue(col.key, e.target.value)}
                                                                                    placeholder="0"
                                                                                    className="w-full px-1.5 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-slate-900 bg-white text-center focus:ring-2 focus:ring-cyan-500 outline-none disabled:bg-gray-100"
                                                                                />
                                                                            ) : col.type === 'number_special' ? (() => {
                                                                                const numOpts = parseNumericSpecialColOptions(col.options)
                                                                                const selectedObj = typeof colVal === 'object' && colVal !== null ? colVal : null
                                                                                const selectedVal = selectedObj ? selectedObj.value : String(colVal ?? '')

                                                                                return (
                                                                                    <select
                                                                                        disabled={isFinalizado}
                                                                                        value={selectedVal}
                                                                                        onChange={(e) => {
                                                                                            const found = numOpts.find((o: any) => o.value === e.target.value || o.label === e.target.value)
                                                                                            updateColValue(col.key, found ? { label: found.label, value: found.value } : e.target.value)
                                                                                        }}
                                                                                        className="w-full px-1 py-1.5 rounded-xl border text-xs font-black outline-none cursor-pointer bg-emerald-50 text-emerald-800 border-emerald-300 text-center"
                                                                                    >
                                                                                        <option value="">Sel...</option>
                                                                                        {numOpts.map((opt: any, j: number) => (
                                                                                            <option key={j} value={opt.value}>
                                                                                                {opt.label} ({opt.value})
                                                                                            </option>
                                                                                        ))}
                                                                                    </select>
                                                                                )
                                                                            })() : col.type === 'totalizer' ? (
                                                                                <div className="flex items-center justify-center w-full px-1.5 py-1.5 bg-cyan-50 rounded-lg border border-cyan-200 font-black text-cyan-800 text-xs text-center">
                                                                                    {computeAuditRowTotalizer(rowColsDynamic, (colKey) => getColValue(colKey, 0), col.operation, col)}
                                                                                </div>
                                                                            ) : (
                                                                                <input
                                                                                    type="text"
                                                                                    disabled={isFinalizado}
                                                                                    value={primitiveVal}
                                                                                    onChange={(e) => updateColValue(col.key, e.target.value)}
                                                                                    placeholder={col.label + "..."}
                                                                                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-slate-800 bg-white focus:ring-2 focus:ring-cyan-500 outline-none disabled:bg-gray-100"
                                                                                />
                                                                            )}
                                                                        </td>
                                                                    )
                                                                })}
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )
                        }

                        // Renderizado de campos regulares
                        return (
                            <div key={si} className="flex flex-wrap gap-4">
                                {seg.fields.map((campo: any, index: number) => {
                                    const isRequired = campo.required
                                    const value = respuestasData[campo.id] || ''

                                    if (campo.type === 'section') {
                                        return (
                                            <div key={campo.id} className="w-full border-b-2 border-cyan-500 pb-2 pt-4">
                                                <h3 className="text-lg font-black text-cyan-900 uppercase tracking-tight">{campo.label}</h3>
                                            </div>
                                        )
                                    }

                                    if (campo.type === 'separator') {
                                        return <div key={campo.id} className="w-full py-4"></div>
                                    }

                                    if (campo.type === 'signature' || campo.type === 'signature_with_data') {
                                        return (
                                            <div key={campo.id} className="w-full">
                                                <SignaturePad
                                                    showExtraFields={campo.type === 'signature_with_data'}
                                                    field={campo}
                                                    value={value}
                                                    disabled={isFinalizado}
                                                    onChange={(val) => handleChange(campo.id, val)}
                                                />
                                            </div>
                                        )
                                    }

                                    if (campo.type === 'dynamic_table') {
                                        return (
                                            <div key={campo.id} className="w-full">
                                                <DynamicTableField
                                                    field={campo}
                                                    value={respuestasData[campo.id]}
                                                    disabled={isFinalizado}
                                                    onChange={(val) => handleChange(campo.id, val)}
                                                />
                                            </div>
                                        )
                                    }

                                    let widthClass = 'w-full'
                                    if (campo.layoutWidth === '50%') widthClass = 'w-full sm:w-[calc(50%-0.5rem)]'
                                    else if (campo.layoutWidth === '33%') widthClass = 'w-full sm:w-[calc(33.333%-0.75rem)]'
                                    else if (campo.layoutWidth === '25%') widthClass = 'w-full sm:w-[calc(25%-0.75rem)]'

                                    return (
                                        <div key={campo.id} className={`space-y-2 p-5 bg-white rounded-3xl border border-gray-100 shadow-sm ${widthClass}`}>
                                            <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                                                {campo.hideNumber ? '' : (campo.label?.match(/^\d+\./) ? '' : `${index + 1}. `)}{campo.label} {isRequired && <span className="text-rose-500">*</span>}
                                            </label>
                                            
                                            {campo.type === 'text' && (
                                                <input 
                                                    type="text"
                                                    disabled={isFinalizado}
                                                    value={value}
                                                    onChange={e => handleChange(campo.id, e.target.value)}
                                                    placeholder="Escriba aquí..."
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 text-sm outline-none disabled:bg-gray-100 font-medium text-slate-800"
                                                />
                                            )}

                                            {campo.type === 'textarea' && (
                                                <textarea 
                                                    disabled={isFinalizado}
                                                    value={value}
                                                    onChange={e => handleChange(campo.id, e.target.value)}
                                                    placeholder="Escriba detalles..."
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 text-sm outline-none min-h-[100px] disabled:bg-gray-100 font-medium text-slate-800 resize-none"
                                                />
                                            )}

                                            {campo.type === 'date' && (
                                                <input 
                                                    type="date"
                                                    disabled={isFinalizado}
                                                    value={value}
                                                    onChange={e => handleChange(campo.id, e.target.value)}
                                                    className="px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 text-sm outline-none disabled:bg-gray-100 font-medium text-slate-800"
                                                />
                                            )}

                                            {campo.type === 'time' && (
                                                <input 
                                                    type="time"
                                                    disabled={isFinalizado}
                                                    value={value}
                                                    onChange={e => handleChange(campo.id, e.target.value)}
                                                    className="px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 text-sm outline-none disabled:bg-gray-100 font-medium text-slate-800"
                                                />
                                            )}

                                            {campo.type === 'select' && (
                                                <select
                                                    disabled={isFinalizado}
                                                    value={value}
                                                    onChange={e => handleChange(campo.id, e.target.value)}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 text-sm outline-none disabled:bg-gray-100 font-medium text-slate-800 cursor-pointer"
                                                >
                                                    <option value="">Seleccionar opción...</option>
                                                    {(campo.options || ['Opción 1', 'Opción 2']).map((opt: string, i: number) => (
                                                        <option key={i} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            )}

                                            {campo.type === 'radio' && (
                                                <div className="space-y-2 pt-1">
                                                    {(campo.options || ['Opción 1', 'Opción 2']).map((opt: string, i: number) => (
                                                        <label key={i} className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700">
                                                            <input
                                                                type="radio"
                                                                disabled={isFinalizado}
                                                                name={campo.id}
                                                                value={opt}
                                                                checked={value === opt}
                                                                onChange={e => handleChange(campo.id, e.target.value)}
                                                                className="w-4 h-4 text-cyan-600 focus:ring-cyan-500"
                                                            />
                                                            <span>{opt}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}

                                            {(campo.type === 'checkbox' || campo.type === 'multiselect') && (
                                                <div className="space-y-2 pt-1">
                                                    {(campo.options || ['Opción 1']).map((opt: string, i: number) => {
                                                        const currentArray: string[] = Array.isArray(value) ? value : []
                                                        const isChecked = currentArray.includes(opt)
                                                        return (
                                                            <label key={i} className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700">
                                                                <input
                                                                    type="checkbox"
                                                                    disabled={isFinalizado}
                                                                    checked={isChecked}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            handleChange(campo.id, [...currentArray, opt])
                                                                        } else {
                                                                            handleChange(campo.id, currentArray.filter(item => item !== opt))
                                                                        }
                                                                    }}
                                                                    className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
                                                                />
                                                                <span>{opt}</span>
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            )}

                                            {campo.type === 'numeric_special' && (() => {
                                                const numOpts = campo.numericOptions && campo.numericOptions.length > 0
                                                    ? campo.numericOptions
                                                    : [
                                                        { label: 'Cumple', value: '2' },
                                                        { label: 'Cumple Parcial', value: '1' },
                                                        { label: 'No cumple', value: '0' },
                                                        { label: 'No evaluado', value: 'NE' },
                                                        { label: 'No aplica', value: 'NA' }
                                                    ]

                                                const selectedObj = typeof value === 'object' && value !== null ? value : null
                                                const selectedVal = selectedObj ? selectedObj.value : String(value ?? '')

                                                return (
                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                        {numOpts.map((opt: any, i: number) => {
                                                            const isSelected = selectedVal === String(opt.value) || selectedVal === opt.label || (selectedObj && selectedObj.label === opt.label)
                                                            return (
                                                                <button
                                                                    key={i}
                                                                    type="button"
                                                                    disabled={isFinalizado}
                                                                    onClick={() => handleChange(campo.id, { label: opt.label, value: opt.value })}
                                                                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-2 ${
                                                                        isSelected
                                                                            ? 'bg-cyan-600 text-white border-cyan-600 shadow-md shadow-cyan-500/20 scale-[1.02]'
                                                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                                                    }`}
                                                                >
                                                                    <span>{opt.label}</span>
                                                                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                                                                        isSelected ? 'bg-cyan-800 text-cyan-100' : 'bg-slate-200 text-slate-700'
                                                                    }`}>
                                                                        {opt.value}
                                                                    </span>
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                )
                                            })()}

                                            {campo.type === 'totalizer' && (() => {
                                                const calc = computeTotalizerValue(campo, campos, respuestasData)
                                                return (
                                                    <div className="p-4 bg-gradient-to-r from-slate-900 to-cyan-950 text-white rounded-2xl shadow-lg border border-cyan-500/30 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-2xl p-2 bg-cyan-500/20 text-cyan-300 rounded-xl">🧮</span>
                                                            <div>
                                                                <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wider">
                                                                    {campo.operation === 'percentage' ? '% de Cumplimiento' : campo.operation === 'sum' ? 'Total Suma' : campo.operation === 'average' ? 'Promedio Evaluado' : campo.operation === 'subtract' ? 'Resta' : campo.operation === 'multiply' ? 'Multiplicación' : 'División'}
                                                                </h4>
                                                                <p className="text-[10px] text-slate-300 font-medium">Cálculo dinámico en tiempo real</p>
                                                            </div>
                                                        </div>
                                                        <div className="px-5 py-2.5 bg-cyan-500 text-slate-950 font-black text-lg rounded-xl shadow-md tracking-tight">
                                                            {calc.formatted}
                                                        </div>
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })
                )}
            </div>

            {/* Acciones de Guardado */}
            {!isFinalizado && (
                <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4 pb-12">
                    <button
                        onClick={() => handleSave('Borrador')}
                        disabled={isSaving}
                        className="px-6 py-3.5 bg-white border-2 border-cyan-600 text-cyan-600 font-bold rounded-2xl shadow-sm hover:bg-cyan-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {isSaving ? '⏳ Guardando...' : '💾 Guardar Borrador'}
                    </button>
                    <button
                        onClick={() => {
                            if (confirm('¿Estás seguro de finalizar esta acta? Ya no podrás editarla.')) {
                                handleSave('Finalizado')
                            }
                        }}
                        disabled={isSaving}
                        className="px-6 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-cyan-500/20 hover:from-cyan-500 hover:to-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {isSaving ? '⏳ Guardando...' : '✅ Finalizar Acta'}
                    </button>
                </div>
            )}

            {/* MODAL 1: CONSULTA DE ENVÍO POR CORREO TRAS FINALIZAR */}
            {showPostFinalizeModal && (
                <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-6 animate-in zoom-in-95 duration-200 text-center">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto shadow-inner">
                            ✅
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-slate-900">¡Acta Finalizada con Éxito!</h3>
                            <p className="text-xs text-gray-500 font-medium">
                                ¿Deseas enviar el acta por correo electrónico con el documento adjunto en PDF?
                            </p>
                        </div>

                        <div className="flex items-center justify-center gap-4 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPostFinalizeModal(false)
                                    router.push('/dashboard/actas/generar-acta')
                                }}
                                className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                ✕ No
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPostFinalizeModal(false)
                                    setShowEmailModal(true)
                                }}
                                className="w-1/2 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-cyan-500/25 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>📧</span> Sí, Enviar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: FORMULARIO DE ENVÍO DE CORREO CON PDF ADJUNTO */}
            {showEmailModal && (
                <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100 space-y-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl p-2 bg-cyan-50 text-cyan-600 rounded-2xl">📧</span>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Enviar Acta por Correo</h3>
                                    <p className="text-xs text-gray-500">Se adjuntará el informe en formato PDF</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowEmailModal(false)
                                    router.push('/dashboard/actas/generar-acta')
                                }}
                                className="text-gray-400 hover:text-slate-700 text-lg font-bold p-1 rounded-lg"
                            >
                                ✕
                            </button>
                        </div>

                        {emailMessage.text && (
                            <div className={`p-3.5 rounded-xl text-xs font-bold border flex items-center gap-2 ${
                                emailMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                                <span>{emailMessage.type === 'error' ? '⚠️' : '✅'}</span>
                                <span>{emailMessage.text}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                    Correo del Destinatario <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={destEmail}
                                    onChange={(e) => setDestEmail(e.target.value)}
                                    placeholder="ejemplo@correo.com, destino2@correo.com"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-cyan-500 font-bold text-slate-900 text-sm outline-none bg-slate-50"
                                />
                                <p className="text-[11px] text-slate-500">
                                    💡 Para enviar a varios destinatarios, puedes separarlos usando coma (<code>,</code>) o punto y coma (<code>;</code>).
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Con Copia (CC)
                                    </label>
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Opcional</span>
                                </div>
                                <input
                                    type="text"
                                    value={ccEmail}
                                    onChange={(e) => setCcEmail(e.target.value)}
                                    placeholder="copia1@correo.com; copia2@correo.com"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-cyan-500 font-bold text-slate-900 text-sm outline-none bg-slate-50"
                                />
                                <p className="text-[11px] text-slate-500">
                                    💡 Puedes agregar varias personas en CC separadas por coma (<code>,</code>) o punto y coma (<code>;</code>).
                                </p>
                            </div>

                            {/* Vista Previa del Asunto y Cuerpo */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-2 text-xs">
                                <div>
                                    <span className="font-extrabold text-slate-500 block uppercase text-[10px]">Asunto:</span>
                                    <span className="font-bold text-slate-900">
                                        Envio de Acta, colegio {nombreEstablecimiento || 'Colegio'} del mes {currentMonthName}
                                    </span>
                                </div>
                                <div className="border-t border-gray-200 pt-2">
                                    <span className="font-extrabold text-slate-500 block uppercase text-[10px]">Cuerpo del Correo:</span>
                                    <p className="text-slate-700 font-medium whitespace-pre-line mt-1">
                                        {`Se adjunta acta realizada ${currentDateStr} al colegio ${nombreEstablecimiento || 'Colegio'}\n\nAtte.\nSistema de gestion Hendaya`}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowEmailModal(false)
                                    router.push('/dashboard/actas/generar-acta')
                                }}
                                className="px-4 py-2.5 rounded-xl border border-gray-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSendEmailSubmit}
                                disabled={isSendingEmail}
                                className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {isSendingEmail ? '⏳ Enviando Correo...' : '📧 Confirmar y Enviar Correo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
