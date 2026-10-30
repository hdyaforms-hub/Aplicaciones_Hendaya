'use client'

import React, { useState, useTransition, useRef } from 'react'
import {
    cargarExcelIndicadoresAction,
    eliminarCargaIndicadoresAction,
    CargaIndicadoresHistorialItem,
    CargaIndicadoresResponse
} from './actions'
import { Trash2 } from 'lucide-react'

interface Props {
    initialHistorial: CargaIndicadoresHistorialItem[]
    currentUser: {
        username: string
        name?: string | null
        roleName?: string | null
    }
}

export default function CargaMasivaClient({ initialHistorial, currentUser }: Props) {
    const [activeTab, setActiveTab] = useState<'indicadores' | 'futuro'>('indicadores')
    const [historial, setHistorial] = useState<CargaIndicadoresHistorialItem[]>(initialHistorial)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isPending, startTransition] = useTransition()
    const [uploadResult, setUploadResult] = useState<CargaIndicadoresResponse | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [dragOver, setDragOver] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleEliminarCarga = async (item: CargaIndicadoresHistorialItem) => {
        const confirmar = window.confirm(
            `¿Estás seguro de que deseas eliminar la carga masiva del período "${item.periodo}" (Archivo: ${item.fileName})?\n\n` +
            `Esta acción eliminará el registro de la base de datos y permitirá volver a cargar una nueva versión del archivo.`
        )
        if (!confirmar) return

        setDeletingId(item.id)
        try {
            const res = await eliminarCargaIndicadoresAction(item.id)
            if (res.success) {
                setHistorial(prev => prev.filter(h => h.id !== item.id))
                // Si la alerta actual correspondía a este período, la cerramos
                if (uploadResult?.resumen?.periodo === item.periodo) {
                    setUploadResult(null)
                }
            } else {
                alert(`Error al eliminar carga: ${res.error || 'Ocurrió un error inesperado'}`)
            }
        } catch (e: any) {
            console.error('Error eliminando carga:', e)
            alert('Error inesperado al intentar eliminar el registro.')
        } finally {
            setDeletingId(null)
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0])
            setUploadResult(null)
        }
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0]
            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                setSelectedFile(file)
                setUploadResult(null)
            } else {
                alert('Por favor selecciona un archivo con extensión .xlsx o .xls')
            }
        }
    }

    const handleSubmitUpload = () => {
        if (!selectedFile) return
        setUploadResult(null)

        const formData = new FormData()
        formData.append('file', selectedFile)

        startTransition(async () => {
            const res = await cargarExcelIndicadoresAction(formData)
            setUploadResult(res)
            if (res.success && res.resumen) {
                // Agregar al historial local
                const newItem: CargaIndicadoresHistorialItem = {
                    id: res.resumen.cargaId || Math.random().toString(),
                    anio: res.resumen.anio,
                    mes: res.resumen.mes,
                    periodo: res.resumen.periodo,
                    fileName: selectedFile.name,
                    cargadoPor: currentUser.name || currentUser.username,
                    createdAt: new Date().toISOString()
                }
                setHistorial(prev => [newItem, ...prev])
                setSelectedFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
            }
        })
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 lg:p-8 space-y-6">
            {/* ENCABEZADO CORPORATIVO HENDAYA */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center text-3xl shadow-sm shrink-0">
                        📤
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                                Carga Masiva
                            </h1>
                            <span className="text-[11px] font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-300">
                                HENDAYA
                            </span>
                            <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                                Prev. de Riesgos
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-slate-500 mt-1">
                            Centro de importación masiva de planillas de Prevención de Riesgos e indicadores de siniestralidad.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <a
                        href="/dashboard/tablero/indicador-prev-riesgos"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition-all shadow-sm"
                    >
                        <span>📈</span>
                        <span>Ver Tablero de Indicadores</span>
                    </a>
                </div>
            </div>

            {/* BARRA DE PESTAÑAS (TABS) */}
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center border-b border-slate-200 px-6 pt-3 bg-slate-50/70 gap-2 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab('indicadores')}
                        className={`pb-3 px-4 text-xs font-extrabold transition-all border-b-2 flex items-center gap-2 shrink-0 ${
                            activeTab === 'indicadores'
                                ? 'border-sky-600 text-sky-700 bg-white rounded-t-lg border-t border-l border-r border-slate-200 -mb-[1px]'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <span>📊</span>
                        <span>Indicadores de Prevención (Excel)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('futuro')}
                        className={`pb-3 px-4 text-xs font-medium transition-all border-b-2 flex items-center gap-2 shrink-0 ${
                            activeTab === 'futuro'
                                ? 'border-sky-600 text-sky-700 bg-white rounded-t-lg border-t border-l border-r border-slate-200 -mb-[1px]'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <span>📁</span>
                        <span>Otras Cargas Masivas</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-200 text-slate-600 font-bold">
                            Próximamente
                        </span>
                    </button>
                </div>

                {/* CONTENIDO DEL TAB ACTIVO */}
                <div className="p-6 space-y-6">
                    {activeTab === 'indicadores' ? (
                        <div className="space-y-6">
                            {/* CAJA DE CARGA / DROPZONE */}
                            <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-6 md:p-8 space-y-5">
                                <div className="max-w-2xl mx-auto text-center space-y-2">
                                    <h2 className="text-base md:text-lg font-bold text-slate-900">
                                        Importar libro «Indicadores Panel - Datos.xlsx»
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Sube la planilla mensual oficial de Prevención de Riesgos. El sistema leerá automáticamente la hoja <strong>«Panel»</strong>, sincronizará las tasas nacionales, los accidentes de las 4 sucursales, el Top 10 de comunas y supervisores, y la cotización DS 67.
                                    </p>
                                </div>

                                <div
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all max-w-2xl mx-auto ${
                                        dragOver
                                            ? 'border-sky-500 bg-sky-50/60 scale-[1.01]'
                                            : selectedFile
                                            ? 'border-emerald-400 bg-emerald-50/40'
                                            : 'border-slate-300 hover:border-sky-400 hover:bg-slate-50 bg-white'
                                    }`}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />

                                    <div className="space-y-3">
                                        <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 mx-auto flex items-center justify-center text-2xl font-bold">
                                            {selectedFile ? '📄' : '📁'}
                                        </div>

                                        {selectedFile ? (
                                            <div>
                                                <p className="text-sm font-black text-slate-900">
                                                    {selectedFile.name}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {(selectedFile.size / 1024).toFixed(1)} KB • Listo para procesar
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                                                    className="text-xs text-rose-600 hover:text-rose-700 font-bold underline mt-2"
                                                >
                                                    Cambiar archivo
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-xs md:text-sm font-bold text-slate-700">
                                                    Haz clic para seleccionar o arrastra aquí tu archivo Excel
                                                </p>
                                                <p className="text-[11px] text-slate-400 mt-1">
                                                    Formatos compatibles: .xlsx o .xls (Hoja requerida: Panel)
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="text-center">
                                    <button
                                        type="button"
                                        onClick={handleSubmitUpload}
                                        disabled={!selectedFile || isPending}
                                        className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                            isPending
                                                ? 'bg-slate-400 text-white cursor-not-allowed'
                                                : !selectedFile
                                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-200 ring-2 ring-sky-400/40'
                                        }`}
                                    >
                                        {isPending ? (
                                            <span className="flex items-center gap-2">
                                                <span className="animate-spin">🔄</span>
                                                <span>Procesando e Importando Datos...</span>
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <span>🚀</span>
                                                <span>Cargar y Actualizar Panel de Indicadores</span>
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* RESULTADO DE LA CARGA / ALERTAS */}
                            {uploadResult && (
                                <div className={`p-5 rounded-2xl border ${
                                    uploadResult.success
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                                        : 'bg-rose-50 border-rose-200 text-rose-950'
                                }`}>
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">{uploadResult.success ? '✅' : '❌'}</span>
                                        <div className="space-y-2 flex-1">
                                            <h3 className="font-extrabold text-sm">
                                                {uploadResult.success
                                                    ? `Carga completada con éxito: ${uploadResult.resumen?.periodo}`
                                                    : 'Error al procesar la planilla'}
                                            </h3>

                                            {uploadResult.error && (
                                                <p className="text-xs text-rose-800 font-medium">
                                                    {uploadResult.error}
                                                </p>
                                            )}

                                            {uploadResult.resumen && (
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                                                    <div className="p-3 bg-white/80 rounded-xl border border-emerald-200/80 text-center">
                                                        <span className="block text-[10px] text-slate-500 font-bold uppercase">Período</span>
                                                        <span className="text-xs font-black text-slate-900">{uploadResult.resumen.periodo}</span>
                                                    </div>
                                                    <div className="p-3 bg-white/80 rounded-xl border border-emerald-200/80 text-center">
                                                        <span className="block text-[10px] text-slate-500 font-bold uppercase">Total Accidentes</span>
                                                        <span className="text-xs font-black text-rose-700">{uploadResult.resumen.totalAccidentes}</span>
                                                    </div>
                                                    <div className="p-3 bg-white/80 rounded-xl border border-emerald-200/80 text-center">
                                                        <span className="block text-[10px] text-slate-500 font-bold uppercase">Días Perdidos</span>
                                                        <span className="text-xs font-black text-amber-700">{uploadResult.resumen.totalDiasPerdidos}</span>
                                                    </div>
                                                    <div className="p-3 bg-white/80 rounded-xl border border-emerald-200/80 text-center">
                                                        <span className="block text-[10px] text-slate-500 font-bold uppercase">TSIT DS67</span>
                                                        <span className="text-xs font-black text-sky-800">{uploadResult.resumen.tsit || '—'}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {uploadResult.avisos && uploadResult.avisos.length > 0 && (
                                                <div className="pt-2">
                                                    <p className="text-xs font-bold text-amber-900">Observaciones detectadas:</p>
                                                    <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5 mt-1">
                                                        {uploadResult.avisos.map((av, idx) => (
                                                            <li key={idx}>{av}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* HISTORIAL DE CARGAS REALIZADAS */}
                            <div className="space-y-3">
                                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                                    <span>🕒</span>
                                    <span>Historial de Importaciones Recientes</span>
                                </h3>

                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                                            <tr>
                                                <th className="py-3 px-4">Fecha de Carga</th>
                                                <th className="py-3 px-4">Período de Datos</th>
                                                <th className="py-3 px-4">Archivo</th>
                                                <th className="py-3 px-4">Usuario Responsable</th>
                                                <th className="py-3 px-4 text-center">Estado</th>
                                                <th className="py-3 px-4 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {historial.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="py-8 text-center text-slate-400">
                                                        Aún no se han registrado cargas masivas de indicadores.
                                                    </td>
                                                </tr>
                                            ) : (
                                                historial.map(item => (
                                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="py-3 px-4 font-medium text-slate-600">
                                                            {new Date(item.createdAt).toLocaleString('es-CL')}
                                                        </td>
                                                        <td className="py-3 px-4 font-bold text-sky-800">
                                                            {item.periodo}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-700 font-mono text-[11px]">
                                                            {item.fileName}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-800 font-semibold">
                                                            {item.cargadoPor}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                ✓ Procesado
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEliminarCarga(item)}
                                                                disabled={deletingId === item.id}
                                                                title={`Eliminar carga ${item.periodo}`}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50 hover:shadow-sm"
                                                            >
                                                                {deletingId === item.id ? (
                                                                    <span className="animate-spin text-xs">⏳</span>
                                                                ) : (
                                                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                                                )}
                                                                <span>Eliminar</span>
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
                    ) : (
                        /* TAB FUTURO */
                        <div className="py-16 text-center space-y-3">
                            <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center text-3xl mx-auto">
                                🗃️
                            </div>
                            <h3 className="text-base font-bold text-slate-800">
                                Nuevos Módulos de Carga Masiva
                            </h3>
                            <p className="text-xs text-slate-500 max-w-md mx-auto">
                                Esta pantalla está diseñada arquitectónicamente para integrar futuras cargas masivas del área de Prevención de Riesgos en diferentes pestañas especializadas.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

