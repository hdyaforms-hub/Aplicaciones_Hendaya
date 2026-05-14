'use client'

import { useState, useEffect } from 'react'

export default function UploadModal({ isOpen, onClose, onUploadSuccess }: { isOpen: boolean, onClose: () => void, onUploadSuccess: () => void }) {
    const [files, setFiles] = useState<File[]>([])
    const [loading, setLoading] = useState(false)
    const [currentFile, setCurrentFile] = useState('')
    const [progress, setProgress] = useState({ total: 0, current: 0 })
    const [error, setError] = useState('')
    const [omittedFiles, setOmittedFiles] = useState<{name: string, reason: string}[]>([])
    const [successCount, setSuccessCount] = useState(0)

    useEffect(() => {
        if (isOpen) {
            setFiles([])
            setError('')
            setOmittedFiles([])
            setSuccessCount(0)
            setLoading(false)
            setProgress({ total: 0, current: 0 })
            setCurrentFile('')
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files))
            setError('')
            setOmittedFiles([])
            setSuccessCount(0)
        }
    }

    const handleUpload = async () => {
        if (files.length === 0) {
            setError('Por favor selecciona al menos un archivo PDF')
            return
        }

        setLoading(true)
        setError('')
        setOmittedFiles([])
        setSuccessCount(0)
        setProgress({ total: files.length, current: 0 })

        let success = 0;
        const omitted: {name: string, reason: string}[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setCurrentFile(file.name);
            setProgress(prev => ({ ...prev, current: i + 1 }));

            const formData = new FormData()
            formData.append('file', file)

            try {
                const res = await fetch('/api/elementos-esenciales/upload', {
                    method: 'POST',
                    body: formData
                })

                const data = await res.json()
                if (!res.ok) {
                    // Si el error es por formato o validación (lo que devuelve el script de python o el backend)
                    if (data.error && (
                        data.error.includes('formato') || 
                        data.error.includes('no admitido') || 
                        data.error.includes('no es un acta válida') ||
                        data.error.includes('no es del tipo') ||
                        data.error.includes('ya existe')
                    )) {
                        omitted.push({ name: file.name, reason: data.error });
                    } else {
                        throw new Error(data.error || `Error desconocido`)
                    }
                } else {
                    success++;
                }
            } catch (err: any) {
                console.error(err);
                omitted.push({ name: file.name, reason: err.message });
            }
        }

        setSuccessCount(success);
        setOmittedFiles(omitted);
        setLoading(false)
        
        if (success > 0) {
            onUploadSuccess()
        }

        if (omitted.length === 0 && success > 0) {
            onClose()
            setFiles([])
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Carga Masiva de Actas</h3>
                        <p className="text-sm text-gray-500 mt-1">Sube múltiples archivos para procesarlos automáticamente.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {successCount > 0 && (
                        <div className="p-3 bg-green-50 text-green-700 rounded-xl text-sm border border-green-100 font-bold flex items-center gap-2">
                            ✅ Se cargaron {successCount} archivos exitosamente.
                        </div>
                    )}

                    {omittedFiles.length > 0 && (
                        <div className="space-y-2">
                            <div className="p-3 bg-orange-50 text-orange-700 rounded-xl text-sm border border-orange-100 font-bold flex items-center gap-2">
                                ⚠️ {omittedFiles.length} archivos fueron omitidos (Formato inválido o error).
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Detalle de archivos omitidos:</p>
                                {omittedFiles.map((f, i) => (
                                    <div key={i} className="flex justify-between gap-4 text-xs">
                                        <span className="font-bold text-gray-700 truncate" title={f.name}>{f.name}</span>
                                        <span className="text-gray-500 shrink-0 italic">{f.reason}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    {!loading && successCount === 0 && omittedFiles.length === 0 && (
                        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center hover:bg-gray-50 transition-colors cursor-pointer group" onClick={() => document.getElementById('pdf-upload')?.click()}>
                            <input
                                type="file"
                                accept=".pdf"
                                multiple
                                onChange={handleFileChange}
                                className="hidden"
                                id="pdf-upload"
                            />
                            <div className="flex flex-col items-center justify-center gap-3">
                                <span className="text-5xl group-hover:scale-110 transition-transform">📚</span>
                                <div className="space-y-1">
                                    <span className="block text-base font-bold text-gray-700">
                                        {files.length > 0 ? `${files.length} archivos seleccionados` : 'Seleccionar archivos PDF'}
                                    </span>
                                    <span className="text-xs text-gray-400 font-medium">Puedes arrastrar y soltar archivos aquí</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {files.length > 0 && !loading && successCount === 0 && omittedFiles.length === 0 && (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Archivos a procesar ({files.length})</p>
                                <button onClick={() => setFiles([])} className="text-[10px] font-black text-red-500 uppercase hover:underline">Limpiar todo</button>
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 border border-gray-100 rounded-xl p-2 bg-gray-50/50">
                                {files.map((f, i) => (
                                    <div key={i} className="flex justify-between items-center bg-white p-2.5 rounded-lg shadow-sm border border-gray-100 text-xs">
                                        <div className="flex items-center gap-2 truncate">
                                            <span className="text-base">📄</span>
                                            <span className="truncate font-bold text-gray-700" title={f.name}>{f.name}</span>
                                        </div>
                                        <button 
                                            onClick={() => setFiles(files.filter((_, index) => index !== i))}
                                            className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                                            title="Eliminar archivo"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {loading && (
                        <div className="py-8 space-y-6">
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative w-16 h-16">
                                    <div className="absolute inset-0 border-4 border-cyan-100 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-cyan-600 rounded-full border-t-transparent animate-spin"></div>
                                </div>
                                <div className="text-center">
                                    <p className="font-black text-gray-800 tracking-tight">Procesando Documentos</p>
                                    <p className="text-xs text-gray-500 font-medium mt-1">Archivo {progress.current} de {progress.total}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                                    <span className="truncate max-w-[300px]">Actual: {currentFile}</span>
                                    <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-100">
                                    <div
                                        className="bg-gradient-to-r from-cyan-600 to-blue-600 h-3 rounded-full transition-all duration-300"
                                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-all active:scale-95"
                    >
                        {successCount > 0 || omittedFiles.length > 0 ? 'Cerrar' : 'Cancelar'}
                    </button>
                    {files.length > 0 && successCount === 0 && omittedFiles.length === 0 && (
                        <button
                            onClick={handleUpload}
                            disabled={loading}
                            className="px-5 py-2.5 text-sm font-black text-white bg-cyan-600 rounded-xl shadow-lg shadow-cyan-600/20 hover:bg-cyan-700 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
                        >
                            {loading ? 'Procesando...' : '🚀 Iniciar Carga'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

