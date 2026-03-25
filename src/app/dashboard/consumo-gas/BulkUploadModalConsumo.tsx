'use client'

import { useState, useRef } from 'react'
import * as xlsx from 'xlsx'
import { bulkUploadConsumoGas } from './actions'

export default function BulkUploadModalConsumo({ onUploadSuccess }: { onUploadSuccess: () => void }) {
    const [isOpen, setIsOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    
    const fileInputRef = useRef<HTMLInputElement>(null)

    const expectedColumns = ['rbd', 'litros', 'cantidad', 'meses']

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError('')
        setSuccess('')
        if (e.target.files && e.target.files.length > 0) {
            const selectedMatch = e.target.files[0]
            if (selectedMatch.name.endsWith('.xlsx') || selectedMatch.name.endsWith('.xls')) {
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
            const dataBuffer = await file.arrayBuffer()
            const workbook = xlsx.read(dataBuffer, { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]

            const rawObjects = xlsx.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[]

            if (rawObjects.length === 0) {
                setError('El archivo no contiene datos.')
                setLoading(false)
                return
            }

            // Normalizar cabeceras
            const normalizedData = rawObjects.map(row => {
                const newRow: Record<string, any> = {}
                for (const key in row) {
                    newRow[key.toString().toLowerCase().trim()] = row[key]
                }
                return newRow
            })

            const headers = Object.keys(normalizedData[0])
            const missingCols = expectedColumns.filter(c => !headers.includes(c))

            if (missingCols.length > 0) {
                setError(`Faltan columnas obligatorias: ${missingCols.join(', ')}. Estructura esperada: ${expectedColumns.join(', ')}`)
                setLoading(false)
                return
            }

            // Mapeo y limpieza
            const formattedData = normalizedData.map(row => ({
                rbd: Number(row['rbd']) || 0,
                litros: parseFloat(row['litros']) || 0,
                cantidad: parseInt(row['cantidad']) || 0,
                meses: String(row['meses'] || '').trim()
            })).filter(d => d.rbd > 0)

            if (formattedData.length === 0) {
                setError('No se encontraron datos válidos (RBD debe ser numérico).')
                setLoading(false)
                return
            }

            const result = await bulkUploadConsumoGas(formattedData)
            if (result.error) {
                setError(result.error)
            } else {
                setSuccess(`Se procesaron ${result.count} registros exitosamente.`)
                setFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
                onUploadSuccess()
                setTimeout(() => {
                    setIsOpen(false)
                    setSuccess('')
                }, 2000)
            }
        } catch (err) {
            console.error(err)
            setError('Error procesando el archivo Excel.')
        }

        setLoading(false)
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl shadow-md shadow-orange-500/30 transition-all font-medium flex items-center gap-2"
            >
                <span>📊</span> Carga Masiva Consumo
            </button>
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
                    🔥 Carga Masiva Consumo Gas
                </h3>

                <div className="space-y-5">
                    {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>}
                    {success && <div className="p-3 bg-green-50 text-green-600 rounded-xl text-sm border border-green-100 font-medium">{success}</div>}

                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-orange-500 transition-colors bg-gray-50">
                        <label className="cursor-pointer block">
                            <span className="text-3xl mb-2 block">📄</span>
                            <span className="block text-sm font-medium text-gray-700 mb-1">
                                Selecciona el archivo de Consumo
                            </span>
                            <span className="block text-xs text-gray-500 mb-4">
                                Columnas: RBD, Litros, Cantidad, Meses
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
                            <div className="mt-4 p-2 bg-orange-50 text-orange-800 rounded-lg text-sm font-medium break-all border border-orange-100">
                                {file.name}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 w-full rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-medium transition-colors">
                            Cancelar
                        </button>
                        <button type="button" onClick={validateAndParseExcel} disabled={loading || !file} className="px-5 py-2.5 w-full rounded-xl text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 shadow-md shadow-orange-500/20 font-medium transition-all disabled:opacity-70 disabled:pointer-events-none">
                            {loading ? 'Procesando...' : 'Subir Excel'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
