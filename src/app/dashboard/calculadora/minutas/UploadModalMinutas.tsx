'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { uploadMinutasData, checkMinutasExists } from './actions'

export default function UploadModalMinutas() {
    const [isOpen, setIsOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [showOverwritePrompt, setShowOverwritePrompt] = useState(false)
    const [existenceMessage, setExistenceMessage] = useState<string | null>(null)
    const [pendingData, setPendingData] = useState<any[] | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const expectedHeaders = [
        'NumeroMinuta', 'Licitacion', 'NumeroPrograma', 'Programa', 
        'NumeroCocina', 'Cocina', 'Dia', 'Mes', 'Año', 
        'NumeroPreparacion', 'sucid', 'CodigoServicio', 'NombreServicio', 
        'CodigoEnlace', 'NombreEnlace'
    ]

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            setError(null)
            setSuccess(null)
        }
    }

    const processFile = async (overwrite: boolean = false) => {
        if (!file) return

        setLoading(true)
        setError(null)

        try {
            const data = await file.arrayBuffer()
            const workbook = XLSX.read(data)
            const worksheet = workbook.Sheets[workbook.SheetNames[0]]
            const jsonData = XLSX.utils.sheet_to_json(worksheet)

            if (jsonData.length === 0) {
                setError('El archivo está vacío.')
                setLoading(false)
                return
            }

            // Validar cabeceras
            const headers = Object.keys(jsonData[0] as object)
            const missingHeaders = expectedHeaders.filter(h => !headers.includes(h))
            
            if (missingHeaders.length > 0) {
                setError(`Formato incorrecto. Faltan las columnas: ${missingHeaders.join(', ')}`)
                setLoading(false)
                return
            }

            // Si no es un overwrite explícito, verificamos si ya existen datos
            if (!overwrite) {
                const check = await checkMinutasExists(jsonData as any[])
                if (check.exists) {
                    setExistenceMessage(check.message || 'Ya existen registros en la base de datos.')
                    setPendingData(jsonData)
                    setShowOverwritePrompt(true)
                    setLoading(false)
                    return
                }
            }

            const result = await uploadMinutasData(jsonData as any[], overwrite)

            if (result.success) {
                setSuccess(`¡Carga exitosa! Se procesaron ${result.count} registros.`)
                setFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
            } else {
                setError(result.error || 'Error desconocido al subir los datos.')
            }
        } catch (err: any) {
            console.error(err)
            setError('Error al procesar el archivo. Verifique el formato.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="px-6 py-2.5 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 font-bold transition-all flex items-center gap-2"
            >
                📥 Carga Masiva Minutas
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-slate-800">Cargar Minutas</h3>
                            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl">✕</button>
                        </div>

                        <p className="text-slate-500 text-sm mb-6 font-medium leading-relaxed">
                            Selecciona el archivo Excel (.xlsx o .xls) con el formato oficial de Minutas.
                        </p>

                        <div className="space-y-4">
                            <div className="relative group">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={handleFileChange}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 transition-all cursor-pointer border-2 border-dashed border-slate-200 p-4 rounded-2xl group-hover:border-emerald-400"
                                />
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold flex items-start gap-2">
                                    <span>⚠️</span> {error}
                                </div>
                            )}

                            {success && (
                                <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs font-bold flex items-start gap-2">
                                    <span>✅</span> {success}
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="px-6 py-3 w-full rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold transition-colors"
                                >
                                    Cerrar
                                </button>
                                <button
                                    onClick={() => processFile(false)}
                                    disabled={!file || loading}
                                    className="px-6 py-3 w-full rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-black shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Procesando...' : 'Subir Archivo'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showOverwritePrompt && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl border border-orange-100">
                        <div className="text-orange-500 text-4xl mb-4">⚠️</div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">Datos Existentes</h3>
                        <p className="text-slate-500 text-sm mb-6 font-medium leading-relaxed">
                            {existenceMessage || 'Ya existen registros para esta minuta y licitación.'}
                            <br /><br />
                            ¿Deseas reemplazarlos con la nueva información?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowOverwritePrompt(false); setPendingData(null); }}
                                className="px-6 py-2.5 w-full rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => { setShowOverwritePrompt(false); processFile(true); }}
                                className="px-6 py-2.5 w-full rounded-xl text-white bg-orange-500 hover:bg-orange-600 font-black transition-all shadow-lg shadow-orange-500/20"
                            >
                                Sobrescribir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
