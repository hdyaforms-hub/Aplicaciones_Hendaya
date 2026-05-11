'use client'

import { useState, useRef } from 'react'
import * as xlsx from 'xlsx'
import { uploadPreparacionesData, checkPreparacionesExists, PreparacionData } from './actions'
import { useRouter } from 'next/navigation'

export default function UploadModalPreparaciones() {
    const [isOpen, setIsOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [confirmOverwrite, setConfirmOverwrite] = useState(false)
    const [parsedData, setParsedData] = useState<PreparacionData[]>([])
    const router = useRouter()

    const fileInputRef = useRef<HTMLInputElement>(null)

    const expectedColumns = [
        'licitacion', 
        'numeropreparacion', 
        'nombrepreparacion', 
        'numeroprograma', 
        'programa', 
        'numerococina', 
        'cocina', 
        'codigoproducto', 
        'nombreproducto', 
        'codigosubservicio', 
        'nombresubservicio', 
        'cantpreparacion', 
        'porcentaje_perdida'
    ]

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError('')
        setSuccess('')
        setConfirmOverwrite(false)
        if (e.target.files && e.target.files.length > 0) {
            const selectedMatch = e.target.files[0]
            if (
                selectedMatch.name.endsWith('.xlsx') ||
                selectedMatch.name.endsWith('.xls')
            ) {
                setFile(selectedMatch)
            } else {
                setError('Solo se permiten archivos Excel (.xlsx, .xls)')
                setFile(null)
            }
        }
    }

    const validateAndParseExcel = async () => {
        if (!file) return

        setLoading(true)
        setError('')

        try {
            const data = await file.arrayBuffer()
            const workbook = xlsx.read(data, { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]

            const rawObjects = xlsx.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[]

            if (rawObjects.length === 0) {
                setError('El archivo no contiene datos.')
                setLoading(false)
                return
            }

            const normalizedData = rawObjects.map(row => {
                const newRow: Record<string, any> = {}
                for (const key in row) {
                    // Normalizar: minúsculas, trim y quitar acentos para mejor coincidencia
                    const normalizedKey = key.toString()
                        .toLowerCase()
                        .trim()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                    
                    newRow[normalizedKey] = row[key]
                }
                return newRow
            })

            const headers = Object.keys(normalizedData[0])
            const missingCols = expectedColumns.filter(c => !headers.includes(c))

            if (missingCols.length > 0) {
                setError(`Faltan columnas obligatorias: ${missingCols.join(', ')}.`)
                setLoading(false)
                return
            }

            const formattedData: PreparacionData[] = normalizedData.map(row => {
                return {
                    licitacion: String(row['licitacion'] || '').substring(0, 10),
                    numeroPreparacion: Number(row['numeropreparacion']) || 0,
                    nombrePreparacion: String(row['nombrepreparacion'] || '').substring(0, 100),
                    numeroPrograma: String(row['numeroprograma'] || '').substring(0, 7),
                    programa: String(row['programa'] || '').substring(0, 150),
                    numeroCocina: Number(row['numerococina']) || 0,
                    cocina: String(row['cocina'] || '').substring(0, 150),
                    codigoProducto: String(row['codigoproducto'] || '').substring(0, 20),
                    nombreProducto: String(row['nombreproducto'] || '').substring(0, 101),
                    codigoSubServicio: String(row['codigosubservicio'] || '').substring(0, 10),
                    nombreSubServicio: String(row['nombresubservicio'] || '').substring(0, 100),
                    cantPreparacion: Number(row['cantpreparacion']) || 0,
                    porcentajePerdida: Number(row['porcentaje_perdida']) || 0,
                }
            })

            const cleanData = formattedData.filter(d => d.licitacion && d.numeroPreparacion > 0 && d.codigoProducto)

            if (cleanData.length === 0) {
                setError('El archivo no contiene preparaciones válidas.')
                setLoading(false)
                return
            }

            setParsedData(cleanData)

            const validation = await checkPreparacionesExists(cleanData)

            if (validation.error) {
                setError(validation.error)
            } else if (validation.exists) {
                setConfirmOverwrite(true)
            } else {
                await executeUpload(cleanData, false)
            }
        } catch (err: any) {
            console.error(err)
            setError(`Error al procesar: ${err.message || 'Error desconocido'}. Verifique el formato del archivo.`)
        }

        setLoading(false)
    }

    const executeUpload = async (data: PreparacionData[], overwrite: boolean) => {
        setLoading(true)
        setError('')
        const result = await uploadPreparacionesData(data, overwrite)
        if (result.error) {
            setError(result.error)
        } else {
            setSuccess(`Se cargaron ${result.count} registros de preparaciones exitosamente.`)
            setFile(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
            router.refresh()
            setTimeout(() => {
                setIsOpen(false)
                setSuccess('')
            }, 2500)
        }
        setLoading(false)
    }

    const handleDownloadTemplate = () => {
        const worksheet = xlsx.utils.json_to_sheet([])
        xlsx.utils.sheet_add_aoa(worksheet, [
            ['Licitacion', 'NumeroPreparacion', 'NombrePreparacion', 'NumeroPrograma', 'Programa', 'NumeroCocina', 'Cocina', 'CodigoProducto', 'NombreProducto', 'CodigoSubServicio', 'NombreSubServicio', 'CantPreparacion', 'Porcentaje_Perdida']
        ], { origin: 'A1' })
        const workbook = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Plantilla_Preparaciones')
        xlsx.writeFile(workbook, 'Formato_Carga_Masiva_Preparaciones.xlsx')
    }

    if (!isOpen) {
        return (
            <div className="flex gap-2">
                <button
                    onClick={() => setIsOpen(true)}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white rounded-xl shadow-md shadow-cyan-500/30 transition-all font-medium flex items-center gap-2"
                >
                    <span>+</span> Carga Masiva Preparaciones
                </button>
                <button
                    onClick={handleDownloadTemplate}
                    type="button"
                    className="px-4 py-2 bg-white border-2 border-cyan-100 text-cyan-600 hover:bg-cyan-50 rounded-xl transition-all font-bold flex items-center gap-2 shadow-sm"
                    title="Descargar plantilla Excel vacía"
                >
                    <span>📥</span> Formato Excel
                </button>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                >
                    ✕
                </button>

                <h3 className="text-xl font-bold text-gray-900 mb-6 tracking-tight flex items-center gap-2">
                    🍳 Carga Masiva Preparaciones
                </h3>

                <div className="space-y-5">
                    {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>}
                    {success && <div className="p-3 bg-green-50 text-green-600 rounded-xl text-sm border border-green-100 font-medium">{success}</div>}

                    {!confirmOverwrite ? (
                        <>
                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-cyan-500 transition-colors bg-gray-50">
                                <label className="cursor-pointer block">
                                    <span className="text-3xl mb-2 block">📊</span>
                                    <span className="block text-sm font-medium text-gray-700 mb-1">
                                        Selecciona un archivo Excel
                                    </span>
                                    <span className="block text-xs text-gray-500 mb-4">
                                        Formatos soportados: .xlsx, .xls
                                    </span>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                    />
                                    <span className="inline-block px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors">
                                        Explorar Archivos
                                    </span>
                                </label>
                                {file && (
                                    <div className="mt-4 p-2 bg-cyan-50 text-cyan-800 rounded-lg text-sm font-medium break-all border border-cyan-100">
                                        Archivo seleccionado:<br /> {file.name}
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 w-full rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-medium transition-colors">
                                    Cancelar
                                </button>
                                <button type="button" onClick={validateAndParseExcel} disabled={loading || !file} className="px-5 py-2.5 w-full rounded-xl text-white bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 shadow-md shadow-cyan-500/20 font-medium transition-all disabled:opacity-70 disabled:pointer-events-none">
                                    {loading ? 'Procesando...' : 'Cargar y Validar'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-2xl animate-in slide-in-from-bottom-4">
                            <h4 className="text-lg font-bold text-yellow-800 flex items-center gap-2 mb-2">
                                ⚠️ Preparaciones Existentes
                            </h4>
                            <p className="text-sm text-yellow-700 mb-6">
                                Hemos detectado que ya existen preparaciones registradas para esta licitación y número en sistema.
                                <br /><br />
                                <strong>¿Desea actualizar y sobrescribir dichos registros con la información del Excel?</strong>
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setConfirmOverwrite(false)
                                        setFile(null)
                                        setParsedData([])
                                        if (fileInputRef.current) fileInputRef.current.value = ''
                                    }}
                                    className="px-4 py-2.5 w-full rounded-xl text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 font-medium transition-colors text-sm"
                                >
                                    No, cancelar
                                </button>
                                <button
                                    onClick={() => executeUpload(parsedData, true)}
                                    disabled={loading}
                                    className="px-4 py-2.5 w-full rounded-xl text-white bg-yellow-600 hover:bg-yellow-700 font-medium transition-colors text-sm disabled:opacity-70 disabled:pointer-events-none flex justify-center items-center"
                                >
                                    {loading ? 'Sobrescribiendo...' : 'Sí, actualizar preparaciones'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
