'use client'

import React, { useState, useTransition, useRef } from 'react'
import {
    procesarArchivoExcelSubidoAction,
    procesarDesdeRutaServidorAction,
    getHistorialCargasAction,
    ResultadoProcesamiento
} from './actions'
import {
    UploadCloud,
    FileSpreadsheet,
    Server,
    Laptop,
    CheckCircle2,
    AlertTriangle,
    RefreshCw,
    ShieldCheck,
    History,
    ArrowRight,
    FileText,
    AlertCircle
} from 'lucide-react'
import Link from 'next/link'

interface Carga {
    id: string
    archivoNombre: string
    rutaOrigen: string | null
    totalRegistros: number
    nuevosRegistros: number
    actualizadosRegistros: number
    subidoPorNombre: string
    createdAt: Date | string
}

const DEFAULT_SERVER_PATH = 'D:\\Programas\\AplicacionWebDoctos\\Personal\\Ausencias202610081450_0c8cccbb-aefb-4107-aaee-5c0bcd24bf42.xlsx'

export default function CargaMasivaClient({ initialCargas }: { initialCargas: Carga[] }) {
    const [cargas, setCargas] = useState<Carga[]>(initialCargas)
    const [selectedOrigin, setSelectedOrigin] = useState<'local' | 'server'>('local')
    const [serverPath, setServerPath] = useState(DEFAULT_SERVER_PATH)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [lastResult, setLastResult] = useState<ResultadoProcesamiento | null>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = (file: File) => {
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            setErrorMsg('El archivo debe ser una planilla Excel (.xlsx o .xls)')
            return
        }
        setSelectedFile(file)
        setErrorMsg(null)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0])
        }
    }

    const ejecutarCarga = async () => {
        setErrorMsg(null)
        setLastResult(null)

        if (selectedOrigin === 'local') {
            if (!selectedFile) {
                setErrorMsg('Por favor selecciona un archivo Excel para continuar')
                return
            }

            startTransition(async () => {
                try {
                    const reader = new FileReader()
                    reader.onload = async () => {
                        const base64Data = (reader.result as string).split(',')[1]
                        const res = await procesarArchivoExcelSubidoAction({
                            base64Data,
                            nombreArchivo: selectedFile.name
                        })
                        setLastResult(res)
                        if (res.success) {
                            refreshHistorial()
                            setSelectedFile(null)
                        } else {
                            setErrorMsg(res.error || 'Error al procesar la planilla')
                        }
                    }
                    reader.readAsDataURL(selectedFile)
                } catch (err: any) {
                    setErrorMsg(err.message || 'Error al leer el archivo local')
                }
            })
        } else {
            if (!serverPath.trim()) {
                setErrorMsg('Por favor especifica la ruta completa del archivo en el servidor')
                return
            }

            startTransition(async () => {
                const res = await procesarDesdeRutaServidorAction(serverPath)
                setLastResult(res)
                if (res.success) {
                    refreshHistorial()
                } else {
                    setErrorMsg(res.error || 'Error al procesar archivo desde el servidor')
                }
            })
        }
    }

    const refreshHistorial = async () => {
        const res = await getHistorialCargasAction()
        if (res.success && res.data) {
            setCargas(res.data as any)
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 p-6 rounded-2xl shadow-xl border border-sky-800/40 text-white">
                <div>
                    <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs tracking-wider uppercase mb-1">
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Áreas · Personal</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                        Carga Masiva de Asistencia
                    </h1>
                    <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                        Importa planillas Excel de ausencias y asistencia. El sistema valida si el registro ya existe, actualiza diferencias, extrae el RBD del establecimiento y encripta datos personales sensibles en la base de datos.
                    </p>
                </div>
                <Link
                    href="/dashboard/areas/personal/asistencia"
                    className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 text-sky-400 border border-sky-500/30 font-medium px-4 py-2.5 rounded-xl transition-all hover:scale-[1.02] text-sm"
                >
                    <span>Ir a Módulo Asistencia</span>
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Aviso de Seguridad / Criptografía */}
            <div className="flex items-start gap-3 p-4 bg-sky-950/40 border border-sky-800/50 rounded-xl text-sky-300 text-xs">
                <ShieldCheck className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
                <div>
                    <span className="font-semibold text-sky-200">Protección de Datos Personales Activa: </span>
                    Los campos confidenciales (<code className="bg-sky-900/50 px-1 py-0.5 rounded text-sky-300">Rut</code>, <code className="bg-sky-900/50 px-1 py-0.5 rounded text-sky-300">Apellidos</code>, <code className="bg-sky-900/50 px-1 py-0.5 rounded text-sky-300">Nombre</code>) son cifrados con AES-256-GCM antes de guardarse en la base de datos y solo se descifran en memoria para usuarios autorizados.
                </div>
            </div>

            {/* Selector de Origen del Excel */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl p-6 space-y-6">
                <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
                        ¿De dónde rescatas la planilla Excel?
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => { setSelectedOrigin('local'); setErrorMsg(null); }}
                            className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                                selectedOrigin === 'local'
                                    ? 'bg-sky-500/10 border-sky-500 ring-1 ring-sky-500 text-white'
                                    : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                            }`}
                        >
                            <div className={`p-2.5 rounded-xl ${selectedOrigin === 'local' ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                <Laptop className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="font-semibold block text-white text-sm">Cargar desde mi computador</span>
                                <span className="text-xs text-slate-400 mt-1 block">
                                    Sube el archivo Excel (.xlsx) arrastrándolo o seleccionándolo desde tu explorador de archivos.
                                </span>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setSelectedOrigin('server'); setErrorMsg(null); }}
                            className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                                selectedOrigin === 'server'
                                    ? 'bg-sky-500/10 border-sky-500 ring-1 ring-sky-500 text-white'
                                    : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                            }`}
                        >
                            <div className={`p-2.5 rounded-xl ${selectedOrigin === 'server' ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                <Server className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="font-semibold block text-white text-sm">Rescatar desde ruta del servidor</span>
                                <span className="text-xs text-slate-400 mt-1 block">
                                    Carga un archivo existente en el disco del servidor (ej. carpeta compartida o documentos).
                                </span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Vista para Origen Local */}
                {selectedOrigin === 'local' && (
                    <div className="space-y-4">
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                                isDragging
                                    ? 'border-sky-400 bg-sky-500/10 scale-[1.01]'
                                    : selectedFile
                                    ? 'border-emerald-500/50 bg-emerald-500/5'
                                    : 'border-slate-700 hover:border-slate-500 bg-slate-800/30'
                            }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={e => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        handleFileSelect(e.target.files[0])
                                    }
                                }}
                                className="hidden"
                            />
                            {selectedFile ? (
                                <div className="flex flex-col items-center gap-2 text-emerald-400">
                                    <FileSpreadsheet className="w-12 h-12" />
                                    <span className="font-semibold text-base text-white">{selectedFile.name}</span>
                                    <span className="text-xs text-slate-400">
                                        {(selectedFile.size / 1024).toFixed(1)} KB · Clic para seleccionar otro archivo
                                    </span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <UploadCloud className="w-12 h-12 text-slate-400" />
                                    <span className="font-semibold text-sm text-white">
                                        Arrastra tu archivo Excel aquí o haz clic para explorar
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        Formatos soportados: .xlsx, .xls (Estructura: Apellidos, Nombre, Rut, Fecha, Grupo, Cargo, Permiso Parcial)
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Vista para Origen Servidor */}
                {selectedOrigin === 'server' && (
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-slate-300 uppercase block">
                            Ruta completa del archivo en el servidor:
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={serverPath}
                                onChange={e => setServerPath(e.target.value)}
                                placeholder="D:\Programas\AplicacionWebDoctos\Personal\..."
                                className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                            <button
                                type="button"
                                onClick={() => setServerPath(DEFAULT_SERVER_PATH)}
                                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-sky-400 rounded-xl border border-slate-700 font-medium whitespace-nowrap"
                            >
                                Ruta Sugerida
                            </button>
                        </div>
                        <span className="text-xs text-slate-500 block">
                            El servidor leerá directamente el archivo desde el almacenamiento local sin requerir re-subida.
                        </span>
                    </div>
                )}

                {/* Mensaje de Error */}
                {errorMsg && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {/* Botón de Ejecución */}
                <div className="pt-2 flex justify-end">
                    <button
                        onClick={ejecutarCarga}
                        disabled={isPending || (selectedOrigin === 'local' && !selectedFile) || (selectedOrigin === 'server' && !serverPath.trim())}
                        className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-sky-500/25 transition-all text-sm"
                    >
                        {isPending ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Procesando planilla y encriptando datos...</span>
                            </>
                        ) : (
                            <>
                                <UploadCloud className="w-4 h-4" />
                                <span>Procesar y Cargar Asistencia</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Resultado de la Última Carga */}
            {lastResult && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-6 space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Resultado del Procesamiento</h3>
                                <p className="text-xs text-slate-400">
                                    Planilla procesada con éxito. Clave única de validación: (RUT + Fecha + RBD).
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/dashboard/areas/personal/asistencia"
                            className="text-xs bg-sky-500 hover:bg-sky-400 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Ver en Asistencia
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                            <span className="text-xs text-slate-400 uppercase font-semibold">Total Filas</span>
                            <p className="text-xl font-bold text-white mt-1">{lastResult.totalFilas}</p>
                        </div>
                        <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-500/30">
                            <span className="text-xs text-emerald-400 uppercase font-semibold">Nuevos Registrados</span>
                            <p className="text-xl font-bold text-emerald-300 mt-1">{lastResult.nuevos}</p>
                        </div>
                        <div className="bg-sky-950/30 p-3 rounded-xl border border-sky-500/30">
                            <span className="text-xs text-sky-400 uppercase font-semibold">Actualizados</span>
                            <p className="text-xl font-bold text-sky-300 mt-1">{lastResult.actualizados}</p>
                        </div>
                        <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                            <span className="text-xs text-slate-400 uppercase font-semibold">Sin Cambios</span>
                            <p className="text-xl font-bold text-slate-300 mt-1">{lastResult.sinCambios}</p>
                        </div>
                        <div className="bg-amber-950/30 p-3 rounded-xl border border-amber-500/30">
                            <span className="text-xs text-amber-400 uppercase font-semibold">Omitidos / Error</span>
                            <p className="text-xl font-bold text-amber-300 mt-1">{lastResult.errores}</p>
                        </div>
                    </div>

                    {lastResult.detallesErrores && lastResult.detallesErrores.length > 0 && (
                        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                            <span className="font-semibold block mb-1">Detalles de advertencias en filas:</span>
                            <ul className="list-disc list-inside space-y-0.5 text-amber-400/90 font-mono">
                                {lastResult.detallesErrores.map((err, idx) => (
                                    <li key={idx}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Historial de Cargas */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-sky-400" />
                        <h3 className="text-base font-bold text-white">Historial de Cargas de Asistencia</h3>
                    </div>
                    <button
                        onClick={refreshHistorial}
                        className="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1 transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Actualizar</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-800/50 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-3.5">ID</th>
                                <th className="px-6 py-3.5">Archivo / Origen</th>
                                <th className="px-6 py-3.5 text-center">Total</th>
                                <th className="px-6 py-3.5 text-center">Nuevos</th>
                                <th className="px-6 py-3.5 text-center">Actualizados</th>
                                <th className="px-6 py-3.5">Subido Por</th>
                                <th className="px-6 py-3.5">Fecha y Hora</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {cargas.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-10 text-slate-500">
                                        Aún no se han realizado cargas masivas de asistencia.
                                    </td>
                                </tr>
                            ) : (
                                cargas.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-400">
                                            #{c.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-sky-400 flex-shrink-0" />
                                                <span className="font-medium text-white">{c.archivoNombre}</span>
                                            </div>
                                            {c.rutaOrigen && (
                                                <span className="text-[11px] text-slate-500 block truncate max-w-xs font-mono">
                                                    {c.rutaOrigen}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-bold text-white">
                                            {c.totalRegistros}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                +{c.nuevosRegistros}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                                ~{c.actualizadosRegistros}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-300">
                                            {c.subidoPorNombre}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                                            {new Date(c.createdAt).toLocaleString('es-CL')}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
