'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useRouter } from 'next/navigation'
import {
    checkMinutasPeriodsExists,
    clearMinutasPeriods,
    uploadMinutasChunk,
    finishMinutasUpload,
    PeriodoMinuta
} from './actions'

interface ProgressState {
    currentChunk: number
    totalChunks: number
    percent: number
    processedRecords: number
    totalRecords: number
    statusText: string
}

export default function UploadModalMinutas() {
    const [isOpen, setIsOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [showOverwritePrompt, setShowOverwritePrompt] = useState(false)
    const [existenceMessage, setExistenceMessage] = useState<string | null>(null)
    const [progress, setProgress] = useState<ProgressState | null>(null)

    // Almacenamos los datos analizados y los períodos en refs para no saturar el estado de React con 65.000 objetos
    const cleanDataRef = useRef<any[]>([])
    const periodsRef = useRef<PeriodoMinuta[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    const normalizeKey = (key: string) => {
        return key
            .toString()
            .toLowerCase()
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        setError(null)
        setSuccess(null)
        setProgress(null)
        setShowOverwritePrompt(false)
        cleanDataRef.current = []
        periodsRef.current = []

        if (selectedFile) {
            if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
                setFile(selectedFile)
            } else {
                setError('Solo se permiten archivos Excel (.xlsx, .xls)')
                setFile(null)
            }
        }
    }

    const handleStartUpload = async () => {
        if (!file) return

        setLoading(true)
        setError(null)
        setSuccess(null)
        setProgress({
            currentChunk: 0,
            totalChunks: 1,
            percent: 0,
            processedRecords: 0,
            totalRecords: 0,
            statusText: 'Leyendo y optimizando archivo Excel...'
        })

        try {
            // Dar tiempo a la UI para renderizar el spinner antes de procesar el buffer
            await new Promise(r => setTimeout(r, 20))

            const arrayBuffer = await file.arrayBuffer()
            
            // Opciones de lectura ultraligera: sin fórmulas ni HTML, modo denso para ahorrar 80% de RAM
            const workbook = XLSX.read(arrayBuffer, {
                type: 'array',
                cellFormula: false,
                cellHTML: false,
                cellText: false,
                dense: true
            })

            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const rawObjects = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[]

            if (rawObjects.length === 0) {
                setError('El archivo Excel está vacío o no contiene filas de datos.')
                setLoading(false)
                setProgress(null)
                return
            }

            // Normalizar columnas y mapear a claves estándar
            const cleanData: any[] = []
            for (let i = 0; i < rawObjects.length; i++) {
                const row = rawObjects[i]
                const newRow: Record<string, any> = {}
                for (const key in row) {
                    let normKey = normalizeKey(key)
                    if (normKey === 'ano' || normKey === 'año') normKey = 'anio'
                    newRow[normKey] = row[key]
                }

                const lic = String(newRow['licitacion'] || '').trim().substring(0, 10)
                const numMin = String(newRow['numerominuta'] || '').trim().substring(0, 50)
                const anio = Number(newRow['anio']) || 0
                const mes = Number(newRow['mes']) || 0

                if (lic && numMin && anio > 0 && mes > 0) {
                    cleanData.push({
                        numeroMinuta: numMin,
                        licitacion: lic,
                        numeroPrograma: String(newRow['numeroprograma'] || '').trim().substring(0, 7),
                        programa: String(newRow['programa'] || '').trim().substring(0, 150),
                        numeroCocina: Number(newRow['numerococina']) || 0,
                        cocina: String(newRow['cocina'] || '').trim().substring(0, 150),
                        dia: Number(newRow['dia']) || 0,
                        mes,
                        anio,
                        numeroPreparacion: String(newRow['numeropreparacion'] || '0').trim(),
                        sucid: String(newRow['sucid'] || '').trim().substring(0, 15),
                        codigoServicio: String(newRow['codigoservicio'] || '').trim().substring(0, 10),
                        nombreServicio: String(newRow['nombreservicio'] || '').trim().substring(0, 100),
                        codigoEnlace: Number(newRow['codigoenlace']) || 0,
                        nombreEnlace: String(newRow['nombreenlace'] || '').trim().substring(0, 150),
                    })
                }
            }

            if (cleanData.length === 0) {
                setError('No se encontraron registros válidos. Verifique que el archivo incluya las columnas: NumeroMinuta, Licitacion, Mes y Año.')
                setLoading(false)
                setProgress(null)
                return
            }

            // Extraer períodos únicos presentes en el archivo (generalmente 1 período)
            const periodMap = new Map<string, PeriodoMinuta>()
            for (const item of cleanData) {
                const key = `${item.licitacion}___${item.anio}___${item.mes}`
                if (!periodMap.has(key)) {
                    periodMap.set(key, { licitacion: item.licitacion, anio: item.anio, mes: item.mes })
                }
            }
            const periods = Array.from(periodMap.values())

            // Guardar en referencias para evitar clones pesados en el estado de React
            cleanDataRef.current = cleanData
            periodsRef.current = periods

            // Verificación ultraligera en el servidor (envía solo los períodos únicos, no los 65.000 registros)
            setProgress({
                currentChunk: 0,
                totalChunks: 1,
                percent: 10,
                processedRecords: 0,
                totalRecords: cleanData.length,
                statusText: 'Verificando períodos en la base de datos...'
            })

            const check = await checkMinutasPeriodsExists(periods)

            if (check.error) {
                setError(check.error)
                setLoading(false)
                setProgress(null)
                return
            }

            if (check.exists) {
                setExistenceMessage(check.message || 'Ya existen registros en la base de datos para este período.')
                setShowOverwritePrompt(true)
                setLoading(false)
                setProgress(null)
                return
            }

            // Si no existe conflicto, procedemos con la subida en lotes
            await executeChunkedUpload(false)

        } catch (err: any) {
            console.error('Error al procesar archivo de minutas:', err)
            setError(`Error al procesar el archivo: ${err.message || 'Verifique el formato del Excel.'}`)
            setLoading(false)
            setProgress(null)
        }
    }

    const executeChunkedUpload = async (overwrite: boolean) => {
        setLoading(true)
        setShowOverwritePrompt(false)
        setError(null)

        const allRecords = cleanDataRef.current
        const periods = periodsRef.current
        const total = allRecords.length
        const CHUNK_SIZE = 2500
        const totalChunks = Math.ceil(total / CHUNK_SIZE)

        try {
            if (overwrite && periods.length > 0) {
                setProgress({
                    currentChunk: 0,
                    totalChunks,
                    percent: 0,
                    processedRecords: 0,
                    totalRecords: total,
                    statusText: 'Limpiando registros del período a reemplazar...'
                })
                const clearRes = await clearMinutasPeriods(periods)
                if (clearRes.error) {
                    throw new Error(clearRes.error)
                }
            }

            let insertedTotal = 0

            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE
                const end = Math.min(start + CHUNK_SIZE, total)
                const chunk = allRecords.slice(start, end)
                const percent = Math.round(((i + 1) / totalChunks) * 100)

                setProgress({
                    currentChunk: i + 1,
                    totalChunks,
                    percent,
                    processedRecords: end,
                    totalRecords: total,
                    statusText: `Guardando lote ${i + 1} de ${totalChunks} (${end.toLocaleString('es-CL')} / ${total.toLocaleString('es-CL')} registros)...`
                })

                const res = await uploadMinutasChunk(chunk)
                if (res.error) {
                    throw new Error(`Error en el lote ${i + 1} de ${totalChunks}: ${res.error}`)
                }

                insertedTotal += (res.count || chunk.length)

                // Ceder 10ms al navegador para permitir que la barra de progreso se actualice fluidamente
                await new Promise(r => setTimeout(r, 10))
            }

            // Finalizar y revalidar caché
            setProgress({
                currentChunk: totalChunks,
                totalChunks,
                percent: 100,
                processedRecords: total,
                totalRecords: total,
                statusText: 'Actualizando vista del sistema...'
            })

            await finishMinutasUpload()

            setSuccess(`¡Carga exitosa! Se procesaron ${insertedTotal.toLocaleString('es-CL')} registros de minutas correctamente.`)
            setFile(null)
            cleanDataRef.current = []
            periodsRef.current = []
            if (fileInputRef.current) fileInputRef.current.value = ''
            router.refresh()

            setTimeout(() => {
                setIsOpen(false)
                setSuccess(null)
                setProgress(null)
            }, 2500)

        } catch (uploadErr: any) {
            console.error('Error durante la carga por lotes:', uploadErr)
            setError(uploadErr.message || 'Ocurrió un error al cargar los lotes en la base de datos.')
        } finally {
            setLoading(false)
        }
    }

    const handleDownloadTemplate = () => {
        const worksheet = XLSX.utils.json_to_sheet([])
        XLSX.utils.sheet_add_aoa(worksheet, [
            [
                'NumeroMinuta', 'Licitacion', 'NumeroPrograma', 'Programa', 
                'NumeroCocina', 'Cocina', 'Dia', 'Mes', 'Año', 
                'NumeroPreparacion', 'sucid', 'CodigoServicio', 'NombreServicio', 
                'CodigoEnlace', 'NombreEnlace'
            ]
        ], { origin: 'A1' })
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla_Minutas')
        XLSX.writeFile(workbook, 'Formato_Carga_Masiva_Minutas.xlsx')
    }

    return (
        <>
            <div className="flex gap-2">
                <button
                    onClick={() => {
                        setIsOpen(true)
                        setError(null)
                        setSuccess(null)
                        setProgress(null)
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-md shadow-emerald-500/20 font-medium transition-all flex items-center gap-2"
                >
                    <span>+</span> Carga Masiva Minutas
                </button>
                <button
                    onClick={handleDownloadTemplate}
                    type="button"
                    className="px-4 py-2 bg-white border-2 border-emerald-100 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all font-bold flex items-center gap-2 shadow-xs"
                    title="Descargar plantilla Excel vacía para Minutas"
                >
                    <span>📥</span> Formato Excel
                </button>
            </div>

            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl relative animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={() => {
                                if (!loading) {
                                    setIsOpen(false)
                                    setProgress(null)
                                    setError(null)
                                }
                            }}
                            disabled={loading}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors disabled:opacity-40"
                        >
                            ✕
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0 border border-emerald-100">
                                📋
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">
                                    Carga Masiva de Minutas
                                </h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    Soporta archivos de gran volumen (&gt;60.000 filas) con inserción por lotes
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {error && (
                                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold leading-relaxed flex items-start gap-2 animate-in fade-in">
                                    <span className="text-base leading-none">⚠️</span>
                                    <div className="flex-1 whitespace-pre-line">{error}</div>
                                </div>
                            )}

                            {success && (
                                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-start gap-2 animate-in fade-in">
                                    <span className="text-base leading-none">✅</span>
                                    <div>{success}</div>
                                </div>
                            )}

                            {!showOverwritePrompt ? (
                                <>
                                    <div className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-2xl p-6 text-center bg-slate-50/70 transition-colors">
                                        <label className={`block ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                            <span className="text-4xl mb-2 block">📊</span>
                                            <span className="block text-sm font-bold text-slate-700 mb-1">
                                                Selecciona el archivo Excel de Minutas
                                            </span>
                                            <span className="block text-xs text-slate-400 mb-4 font-medium">
                                                Formatos compatibles: .xlsx, .xls
                                            </span>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".xlsx, .xls"
                                                disabled={loading}
                                                onChange={handleFileChange}
                                                className="hidden"
                                            />
                                            <span className="inline-block px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black shadow-xs hover:bg-slate-100 transition-colors">
                                                Explorar Archivo
                                            </span>
                                        </label>

                                        {file && (
                                            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold break-all text-left flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span>📎</span>
                                                    <span>{file.name}</span>
                                                </div>
                                                <span className="text-[10px] text-emerald-600 font-mono shrink-0">
                                                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Barra de progreso en tiempo real */}
                                    {progress && (
                                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2.5 animate-in fade-in">
                                            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                                                <span>{progress.statusText}</span>
                                                <span className="text-emerald-600 font-black font-mono">
                                                    {progress.percent}%
                                                </span>
                                            </div>

                                            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
                                                <div
                                                    className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 h-3 rounded-full transition-all duration-200 ease-out"
                                                    style={{ width: `${progress.percent}%` }}
                                                />
                                            </div>

                                            {progress.totalRecords > 0 && (
                                                <div className="flex justify-between text-[11px] text-slate-500 font-medium font-mono">
                                                    <span>Lote {progress.currentChunk} de {progress.totalChunks}</span>
                                                    <span>{progress.processedRecords.toLocaleString('es-CL')} / {progress.totalRecords.toLocaleString('es-CL')} filas</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="pt-2 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsOpen(false)
                                                setProgress(null)
                                                setError(null)
                                            }}
                                            disabled={loading}
                                            className="px-5 py-2.5 w-full rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold transition-colors disabled:opacity-50 text-sm"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleStartUpload}
                                            disabled={loading || !file}
                                            className="px-5 py-2.5 w-full rounded-xl text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/20 font-black transition-all disabled:opacity-50 disabled:pointer-events-none text-sm flex items-center justify-center gap-2"
                                        >
                                            {loading ? (
                                                <>
                                                    <span className="animate-spin text-base">⏳</span>
                                                    <span>Procesando...</span>
                                                </>
                                            ) : (
                                                <span>Subir e Importar</span>
                                            )}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                /* Diálogo de advertencia cuando el período ya existe */
                                <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl animate-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-2 mb-2 text-amber-800">
                                        <span className="text-2xl">⚠️</span>
                                        <h4 className="text-base font-black">
                                            Período Existente en Minutas
                                        </h4>
                                    </div>

                                    <p className="text-xs text-amber-800 leading-relaxed mb-5 whitespace-pre-line">
                                        {existenceMessage || 'Ya existen registros en la base de datos para esta licitación y período.'}
                                        {'\n\n'}
                                        <strong>¿Deseas reemplazar y actualizar únicamente los registros del período que contiene este Excel?</strong>
                                        {'\n'}(Los demás meses y licitaciones se mantendrán intactos).
                                    </p>

                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowOverwritePrompt(false)
                                                setLoading(false)
                                                cleanDataRef.current = []
                                                periodsRef.current = []
                                            }}
                                            className="px-4 py-2.5 w-full rounded-xl text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 font-bold transition-colors text-xs"
                                        >
                                            No, cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => executeChunkedUpload(true)}
                                            className="px-4 py-2.5 w-full rounded-xl text-white bg-amber-600 hover:bg-amber-700 font-black transition-all shadow-md shadow-amber-600/20 text-xs"
                                        >
                                            Sí, sobrescribir período
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
