'use client'

import React, { useState, useTransition, useRef } from 'react'
import {
    procesarArchivoExcelSubidoAction,
    procesarDesdeRutaServidorAction,
    getHistorialCargasAction,
    eliminarCargaMasivaAction,
    ResultadoProcesamiento
} from './actions'
import {
    UploadCloud,
    FileSpreadsheet,
    Server,
    Laptop,
    CheckCircle2,
    RefreshCw,
    ShieldCheck,
    History,
    ArrowRight,
    FileText,
    AlertCircle,
    Trash2
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
    const [successMsg, setSuccessMsg] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleEliminarCarga = async (cargaId: string, archivoNombre: string) => {
        if (!confirm(`¿Estás seguro de eliminar la carga "${archivoNombre}" y TODOS sus registros asociados de asistencia? Esta acción corregirá la base de datos eliminando los registros cargados.`)) {
            return
        }

        setErrorMsg(null)
        setSuccessMsg(null)

        startTransition(async () => {
            const res = await eliminarCargaMasivaAction(cargaId)
            if (res.success) {
                setCargas(prev => prev.filter(c => c.id !== cargaId))
                setSuccessMsg(`Carga "${archivoNombre}" eliminada correctamente (${res.eliminados || 0} registros removidos).`)
                setTimeout(() => setSuccessMsg(null), 4000)
            } else {
                setErrorMsg(res.error || 'No se pudo eliminar la carga')
            }
        })
    }

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
        <div className="space-y-6 max-w-7xl mx-auto p-6">
            {/* Header Estándar Claro */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <div className="flex items-center gap-2 text-cyan-600 font-semibold text-xs tracking-wider uppercase mb-1">
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Áreas · Recursos Humanos</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        Carga Masiva de Asistencia
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Importa planillas Excel de ausencias y asistencia. Valida si la planilla ya existe, previene duplicados, extrae el RBD del establecimiento y encripta datos personales sensibles en la base de datos.
                    </p>
                </div>
                <Link
                    href="/dashboard/areas/personal/asistencia"
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-slate-900/10 text-sm"
                >
                    <span>Ir a Módulo Asistencia</span>
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Aviso de Seguridad / Criptografía */}
            <div className="flex items-start gap-3 p-4 bg-sky-50 border border-sky-100 rounded-xl text-sky-900 text-xs shadow-sm">
                <ShieldCheck className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
                <div>
                    <span className="font-semibold text-cyan-900">Protección de Datos Personales Activa: </span>
                    Los campos confidenciales (<code className="bg-sky-100 px-1 py-0.5 rounded text-cyan-800 font-mono">Rut</code>, <code className="bg-sky-100 px-1 py-0.5 rounded text-cyan-800 font-mono">Apellidos</code>, <code className="bg-sky-100 px-1 py-0.5 rounded text-cyan-800 font-mono">Nombre</code>) son cifrados con AES-256-GCM antes de guardarse en la base de datos y solo se descifran en memoria para usuarios autorizados.
                </div>
            </div>

            {/* Selector de Origen del Excel */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-6">
                <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block mb-3">
                        ¿De dónde rescatas la planilla Excel?
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => { setSelectedOrigin('local'); setErrorMsg(null); }}
                            className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                                selectedOrigin === 'local'
                                    ? 'bg-cyan-50/60 border-cyan-500 ring-2 ring-cyan-500/20 text-gray-900'
                                    : 'bg-gray-50/60 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        >
                            <div className={`p-2.5 rounded-xl ${selectedOrigin === 'local' ? 'bg-cyan-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                                <Laptop className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="font-bold block text-sm text-gray-900">Cargar desde mi computador</span>
                                <span className="text-xs text-gray-500 mt-1 block">
                                    Sube el archivo Excel (.xlsx) arrastrándolo o seleccionándolo desde tu explorador de archivos.
                                </span>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setSelectedOrigin('server'); setErrorMsg(null); }}
                            className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                                selectedOrigin === 'server'
                                    ? 'bg-cyan-50/60 border-cyan-500 ring-2 ring-cyan-500/20 text-gray-900'
                                    : 'bg-gray-50/60 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        >
                            <div className={`p-2.5 rounded-xl ${selectedOrigin === 'server' ? 'bg-cyan-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                                <Server className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="font-bold block text-sm text-gray-900">Rescatar desde ruta del servidor</span>
                                <span className="text-xs text-gray-500 mt-1 block">
                                    Carga un archivo existente en el disco del servidor (carpeta compartida o documentos).
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
                                    ? 'border-cyan-500 bg-cyan-50/50 scale-[1.01]'
                                    : selectedFile
                                    ? 'border-emerald-500 bg-emerald-50/40'
                                    : 'border-gray-300 hover:border-cyan-400 bg-gray-50/60'
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
                                <div className="flex flex-col items-center gap-2 text-emerald-700">
                                    <FileSpreadsheet className="w-12 h-12 text-emerald-600" />
                                    <span className="font-bold text-base text-gray-900">{selectedFile.name}</span>
                                    <span className="text-xs text-gray-500">
                                        {(selectedFile.size / 1024).toFixed(1)} KB · Clic para seleccionar otro archivo
                                    </span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <UploadCloud className="w-12 h-12 text-gray-400" />
                                    <span className="font-semibold text-sm text-gray-800">
                                        Arrastra tu archivo Excel aquí o haz clic para explorar
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        Formatos soportados: .xlsx, .xls (Columnas: Apellidos, Nombre, Rut, Fecha, Grupo, Cargo, Permiso Parcial)
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Vista para Origen Servidor */}
                {selectedOrigin === 'server' && (
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-gray-700 uppercase block">
                            Ruta completa del archivo en el servidor:
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={serverPath}
                                onChange={e => setServerPath(e.target.value)}
                                placeholder="D:\Programas\AplicacionWebDoctos\Personal\..."
                                className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            />
                            <button
                                type="button"
                                onClick={() => setServerPath(DEFAULT_SERVER_PATH)}
                                className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-xs text-cyan-700 rounded-xl border border-gray-200 font-medium whitespace-nowrap transition-colors"
                            >
                                Ruta Sugerida
                            </button>
                        </div>
                        <span className="text-xs text-gray-500 block">
                            El servidor leerá directamente el archivo desde el almacenamiento local sin requerir re-subida.
                        </span>
                    </div>
                )}

                {/* Mensaje de Error */}
                {errorMsg && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
                        <span className="font-medium">{errorMsg}</span>
                    </div>
                )}

                {/* Mensaje de Éxito */}
                {successMsg && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-3 animate-in fade-in">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                        <span className="font-semibold">{successMsg}</span>
                    </div>
                )}

                {/* Botón de Ejecución */}
                <div className="pt-2 flex justify-end">
                    <button
                        onClick={ejecutarCarga}
                        disabled={isPending || (selectedOrigin === 'local' && !selectedFile) || (selectedOrigin === 'server' && !serverPath.trim())}
                        className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl shadow-md shadow-cyan-600/20 transition-all text-sm"
                    >
                        {isPending ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Procesando planilla y validando datos...</span>
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
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Resultado del Procesamiento</h3>
                                <p className="text-xs text-gray-500">
                                    Planilla procesada con éxito. Clave única de validación: (RUT + Fecha + RBD).
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/dashboard/areas/personal/asistencia"
                            className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Ver en Asistencia
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <span className="text-xs text-gray-500 uppercase font-semibold">Total Filas</span>
                            <p className="text-xl font-bold text-gray-900 mt-1">{lastResult.totalFilas}</p>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                            <span className="text-xs text-emerald-700 uppercase font-semibold">Nuevos Registrados</span>
                            <p className="text-xl font-bold text-emerald-700 mt-1">{lastResult.nuevos}</p>
                        </div>
                        <div className="bg-sky-50 p-3 rounded-xl border border-sky-100">
                            <span className="text-xs text-sky-700 uppercase font-semibold">Actualizados</span>
                            <p className="text-xl font-bold text-sky-700 mt-1">{lastResult.actualizados}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <span className="text-xs text-gray-500 uppercase font-semibold">Sin Cambios</span>
                            <p className="text-xl font-bold text-gray-700 mt-1">{lastResult.sinCambios}</p>
                        </div>
                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                            <span className="text-xs text-amber-700 uppercase font-semibold">Omitidos / Error</span>
                            <p className="text-xl font-bold text-amber-700 mt-1">{lastResult.errores}</p>
                        </div>
                    </div>

                    {lastResult.detallesErrores && lastResult.detallesErrores.length > 0 && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                            <span className="font-semibold block mb-1">Detalles de advertencias en filas:</span>
                            <ul className="list-disc list-inside space-y-0.5 text-amber-700 font-mono">
                                {lastResult.detallesErrores.map((err, idx) => (
                                    <li key={idx}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Historial de Cargas */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-cyan-600" />
                        <h3 className="text-base font-bold text-gray-900">Historial de Cargas de Asistencia</h3>
                    </div>
                    <button
                        onClick={refreshHistorial}
                        className="text-xs text-gray-500 hover:text-cyan-600 flex items-center gap-1 transition-colors font-medium"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Actualizar</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-700">
                        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3.5">ID</th>
                                <th className="px-6 py-3.5">Archivo / Origen</th>
                                <th className="px-6 py-3.5 text-center">Total</th>
                                <th className="px-6 py-3.5 text-center">Nuevos</th>
                                <th className="px-6 py-3.5 text-center">Actualizados</th>
                                <th className="px-6 py-3.5">Subido Por</th>
                                <th className="px-6 py-3.5">Fecha y Hora</th>
                                <th className="px-6 py-3.5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {cargas.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-10 text-gray-400">
                                        Aún no se han realizado cargas masivas de asistencia.
                                    </td>
                                </tr>
                            ) : (
                                cargas.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-400">
                                            #{c.id.substring(0, 8)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                                                <span className="font-semibold text-gray-900">{c.archivoNombre}</span>
                                            </div>
                                            {c.rutaOrigen && (
                                                <span className="text-[11px] text-gray-400 block truncate max-w-xs font-mono">
                                                    {c.rutaOrigen}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-bold text-gray-900">
                                            {c.totalRegistros}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                +{c.nuevosRegistros}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                                                ~{c.actualizadosRegistros}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-700">
                                            {c.subidoPorNombre}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                            {new Date(c.createdAt).toLocaleString('es-CL')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button
                                                onClick={() => handleEliminarCarga(c.id, c.archivoNombre)}
                                                disabled={isPending}
                                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                                                title="Eliminar carga y registros asociados"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
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
