'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import {
    analizarEstructuraExcel,
    refrescarVistaPrevia,
    resolverColumnasMultioja,
    validarColumnasSeleccionadas,
    cargarMapaPrevioAction,
    ejecutarAnonimizacionAction
} from '@/actions/colaboradores/anonimizador'
import { TIPOS } from '@/lib/anonimizador/engine'

interface Props {
    user: any
}

export default function AnonimizadorClient({ user }: Props) {
    const [isPending, startTransition] = useTransition()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const mapaInputRef = useRef<HTMLInputElement>(null)

    // Estados para Drag and Drop
    const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false)
    const [isDraggingMapa, setIsDraggingMapa] = useState<boolean>(false)

    // Prevenir comportamiento predeterminado del navegador de abrir archivos al arrastrar sobre la ventana
    useEffect(() => {
        const preventDefaults = (e: DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
        }
        window.addEventListener('dragover', preventDefaults)
        window.addEventListener('drop', preventDefaults)
        return () => {
            window.removeEventListener('dragover', preventDefaults)
            window.removeEventListener('drop', preventDefaults)
        }
    }, [])

    // Estado principal del flujo
    const [paso, setPaso] = useState<number>(1)
    const [file, setFile] = useState<File | null>(null)
    const [nombreArchivo, setNombreArchivo] = useState<string>('')
    const [hojas, setHojas] = useState<string[]>([])
    const [estructura, setEstructura] = useState<Record<string, any>>({})
    const [hojaBase, setHojaBase] = useState<string>('')
    const [filaEnc, setFilaEnc] = useState<number>(1)
    const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] }>({ headers: [], rows: [] })

    // Selección de columnas
    const [decisiones, setDecisiones] = useState<Record<number, { anonimizar: boolean; tipo: string }>>({})
    const [soloDetectadas, setSoloDetectadas] = useState<boolean>(true)
    const [formatoRut, setFormatoRut] = useState<'imitar' | 'uniforme'>('imitar')

    // Múltiples hojas
    const [resoluciones, setResoluciones] = useState<Record<string, any[]>>({})

    // Mapa previo
    const [mapaPrevioEntradas, setMapaPrevioEntradas] = useState<any[] | null>(null)
    const [mapaPrevioInfo, setMapaPrevioInfo] = useState<string | null>(null)

    // Diagnósticos
    const [diagnosticos, setDiagnosticos] = useState<any[]>([])
    const [hayAlertas, setHayAlertas] = useState<boolean>(false)
    const [confirmarAlertas, setConfirmarAlertas] = useState<boolean>(false)

    // Resultados
    const [resultado, setResultado] = useState<any>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // -----------------------------------------------------------------------
    // Paso 1: Manejador de Carga de Archivo
    // -----------------------------------------------------------------------
    const handleFileSelect = (selectedFile: File) => {
        setErrorMsg(null)
        setFile(selectedFile)

        const formData = new FormData()
        formData.append('file', selectedFile)

        startTransition(async () => {
            const res = await analizarEstructuraExcel(formData)
            if (!res.success) {
                setErrorMsg(res.error || 'Error al leer el archivo.')
                return
            }

            setNombreArchivo(res.nombreArchivo || selectedFile.name)
            setHojas(res.hojas || [])
            setEstructura(res.estructura || {})
            const primeraHoja = res.hojas?.[0] || ''
            setHojaBase(primeraHoja)
            setFilaEnc(res.estructura?.[primeraHoja]?.filaEncabezado || 1)
            setPreview(res.preview || { headers: [], rows: [] })
            setDecisiones(res.decisionesIniciales || {})
            setPaso(2)
        })
    }

    // -----------------------------------------------------------------------
    // Paso 2: Cambio de Hoja Base o Fila de Encabezado
    // -----------------------------------------------------------------------
    const handleRefrescarEncabezados = (nuevaHoja: string, nuevaFila: number) => {
        if (!file) return
        setHojaBase(nuevaHoja)
        setFilaEnc(nuevaFila)

        const formData = new FormData()
        formData.append('file', file)
        formData.append('hoja', nuevaHoja)
        formData.append('filaEnc', nuevaFila.toString())

        startTransition(async () => {
            const res = await refrescarVistaPrevia(formData)
            if (res.success && res.preview) {
                setPreview(res.preview)
            }
        })
    }

    // -----------------------------------------------------------------------
    // Avanzar a Selección de Columnas (Paso 3)
    // -----------------------------------------------------------------------
    const irAPasoColumnas = () => {
        setErrorMsg(null)
        setPaso(3)
    }

    // -----------------------------------------------------------------------
    // Toggle y Configuración de Columna
    // -----------------------------------------------------------------------
    const toggleColumna = (col: number) => {
        setDecisiones(prev => ({
            ...prev,
            [col]: {
                ...prev[col],
                anonimizar: !prev[col]?.anonimizar
            }
        }))
    }

    const cambiarTipoColumna = (col: number, tipo: string) => {
        setDecisiones(prev => ({
            ...prev,
            [col]: {
                ...prev[col],
                tipo
            }
        }))
    }

    // -----------------------------------------------------------------------
    // Avanzar a Resolución Multioja o Mapa (Paso 4 ó 5)
    // -----------------------------------------------------------------------
    const irAPasoResolucion = () => {
        setErrorMsg(null)
        const seleccionadas = Object.entries(decisiones)
            .filter(([_, d]) => d.anonimizar)
            .reduce((acc, [col, d]) => ({ ...acc, [col]: d.tipo }), {})

        if (Object.keys(seleccionadas).length === 0) {
            setErrorMsg('Selecciona al menos una columna para anonimizar.')
            return
        }

        if (hojas.length > 1) {
            // Resolver columnas entre hojas
            const formData = new FormData()
            formData.append('file', file!)
            formData.append('hojaBase', hojaBase)
            formData.append('seleccion', JSON.stringify(seleccionadas))
            const filasEncMap = Object.fromEntries(hojas.map(h => [h, estructura[h]?.filaEncabezado || 1]))
            filasEncMap[hojaBase] = filaEnc
            formData.append('filasEnc', JSON.stringify(filasEncMap))

            startTransition(async () => {
                const res = await resolverColumnasMultioja(formData)
                if (res.success && res.resoluciones) {
                    setResoluciones(res.resoluciones)
                    setPaso(4)
                } else {
                    setPaso(5)
                }
            })
        } else {
            setPaso(5)
        }
    }

    // -----------------------------------------------------------------------
    // Carga de Mapa Previo
    // -----------------------------------------------------------------------
    const handleCargarMapaPrevio = (e: React.ChangeEvent<HTMLInputElement>) => {
        const mapaFile = e.target.files?.[0]
        if (!mapaFile) return

        const formData = new FormData()
        formData.append('file', mapaFile)

        startTransition(async () => {
            const res = await cargarMapaPrevioAction(formData)
            if (res.success && res.entradas) {
                setMapaPrevioEntradas(res.entradas)
                setMapaPrevioInfo(`Mapa cargado: ${res.totalCargadas} equivalencias activas de "${mapaFile.name}"`)
            } else {
                setErrorMsg(res.error || 'No se pudo cargar el mapa previo.')
            }
        })
    }

    // -----------------------------------------------------------------------
    // Avanzar a Diagnóstico y Validación (Paso 6)
    // -----------------------------------------------------------------------
    const irAValidacion = () => {
        setErrorMsg(null)
        const seleccionadas = Object.entries(decisiones)
            .filter(([_, d]) => d.anonimizar)
            .reduce((acc, [col, d]) => ({ ...acc, [col]: d.tipo }), {})

        const formData = new FormData()
        formData.append('file', file!)
        formData.append('hojaBase', hojaBase)
        formData.append('filaEncBase', filaEnc.toString())
        formData.append('seleccion', JSON.stringify(seleccionadas))
        formData.append('resoluciones', JSON.stringify(resoluciones))

        startTransition(async () => {
            const res = await validarColumnasSeleccionadas(formData)
            if (res.success) {
                setDiagnosticos(res.diagnosticos || [])
                setHayAlertas(Boolean(res.hayAlertas))
                setConfirmarAlertas(!res.hayAlertas)
                setPaso(6)
            } else {
                setErrorMsg(res.error || 'Error al validar contenido.')
            }
        })
    }

    // -----------------------------------------------------------------------
    // Ejecutar Anonimización y Descarga (Paso 7)
    // -----------------------------------------------------------------------
    const ejecutarProceso = () => {
        setErrorMsg(null)
        if (!confirmarAlertas && hayAlertas) {
            setErrorMsg('Debes confirmar las alertas detectadas para proceder con la anonimización.')
            return
        }

        const seleccionadas = Object.entries(decisiones)
            .filter(([_, d]) => d.anonimizar)
            .reduce((acc, [col, d]) => ({ ...acc, [col]: d.tipo }), {})

        const formData = new FormData()
        formData.append('file', file!)
        formData.append('hojaBase', hojaBase)
        formData.append('filaEncBase', filaEnc.toString())
        formData.append('seleccion', JSON.stringify(seleccionadas))
        formData.append('resoluciones', JSON.stringify(resoluciones))
        formData.append('formatoRut', formatoRut)
        if (mapaPrevioEntradas) {
            formData.append('mapaPrevio', JSON.stringify(mapaPrevioEntradas))
        }

        startTransition(async () => {
            const res = await ejecutarAnonimizacionAction(formData)
            if (res.success) {
                setResultado(res)
                setPaso(7)
            } else {
                setErrorMsg(res.error || 'Fallo al anonimizar la planilla.')
            }
        })
    }

    // -----------------------------------------------------------------------
    // Descarga de Archivos
    // -----------------------------------------------------------------------
    const descargarBase64 = (base64Data: string, filename: string) => {
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const reiniciarProceso = () => {
        setPaso(1)
        setFile(null)
        setNombreArchivo('')
        setHojas([])
        setEstructura({})
        setHojaBase('')
        setFilaEnc(1)
        setPreview({ headers: [], rows: [] })
        setDecisiones({})
        setSoloDetectadas(true)
        setFormatoRut('imitar')
        setResoluciones({})
        setMapaPrevioEntradas(null)
        setMapaPrevioInfo(null)
        setDiagnosticos([])
        setHayAlertas(false)
        setConfirmarAlertas(false)
        setResultado(null)
        setErrorMsg(null)
        setIsDraggingFile(false)
        setIsDraggingMapa(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        if (mapaInputRef.current) mapaInputRef.current.value = ''
    }

    // Columnas visibles en el paso 3
    const columnasActuales = estructura[hojaBase]?.columnas || []
    const columnasFiltradas = soloDetectadas
        ? columnasActuales.filter((c: any) => decisiones[c.col]?.anonimizar || c.ejemplo)
        : columnasActuales

    const totalSeleccionadas = Object.values(decisiones).filter(d => d.anonimizar).length

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16">
            {/* Cabecera Oficial Hendaya */}
            <div className="relative overflow-hidden bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200/60">
                            <span>🛡️</span> Colaboradores • Seguridad y Privacidad de Datos
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 flex items-center gap-3">
                            Anonimizador de Planillas
                        </h1>
                        <p className="text-gray-500 text-sm max-w-2xl leading-relaxed">
                            Reemplaza datos confidenciales de nóminas, colegios y colaboradores por información sintética consistente, con verificación de RUT chileno (módulo 11) y preservación estricta de formatos.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {paso > 1 && (
                            <button
                                type="button"
                                onClick={reiniciarProceso}
                                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-gray-200 hover:border-rose-300 text-gray-700 hover:text-rose-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all"
                                title="Reiniciar y limpiar todo el proceso"
                            >
                                <span>🧹</span> Limpiar / Nuevo
                            </button>
                        )}
                        <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5">
                            <span>📊</span> .xlsx / .xlsm
                        </span>
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1.5">
                            <span>🔒</span> 100% Confidencial
                        </span>
                    </div>
                </div>

                {/* Stepper Visual */}
                <div className="relative z-10 mt-8 pt-6 border-t border-gray-100">
                    <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 text-center text-xs font-semibold">
                        {[
                            { num: 1, label: '1. Archivo' },
                            { num: 2, label: '2. Encabezados' },
                            { num: 3, label: '3. Columnas' },
                            { num: 4, label: '4. Hojas' },
                            { num: 5, label: '5. Mapa' },
                            { num: 6, label: '6. Diagnóstico' },
                            { num: 7, label: '7. Descargas' },
                        ].map(s => {
                            const isCurrent = paso === s.num
                            const isPassed = paso > s.num
                            return (
                                <div
                                    key={s.num}
                                    className={`p-2.5 rounded-xl transition-all ${
                                        isCurrent
                                            ? 'bg-slate-900 text-white font-black shadow-sm ring-2 ring-cyan-500/20'
                                            : isPassed
                                            ? 'bg-cyan-50 text-cyan-800 border border-cyan-200/70 font-bold'
                                            : 'bg-gray-50 text-gray-400 border border-gray-100'
                                    }`}
                                >
                                    <span>{s.label}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Mensajes de Error */}
            {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 animate-in fade-in-50">
                    <span className="text-xl">⚠️</span>
                    <div className="flex-1 text-sm font-medium">
                        <strong className="block font-bold mb-0.5">Atención:</strong>
                        {errorMsg}
                    </div>
                    <button
                        type="button"
                        onClick={() => setErrorMsg(null)}
                        className="text-red-400 hover:text-red-700 font-bold"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* ===============================================================
                PASO 1: Carga de Archivo
            =============================================================== */}
            {paso === 1 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 sm:p-12 text-center space-y-6">
                    <div className="max-w-xl mx-auto space-y-4">
                        <div className="w-20 h-20 mx-auto rounded-3xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-4xl shadow-sm">
                            📁
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-gray-900">
                            Cargar Planilla Original
                        </h2>
                        <p className="text-sm text-gray-500">
                            Selecciona o arrastra tu archivo Excel con nóminas de personal, asistencia, remuneraciones o contratos.
                        </p>
                    </div>

                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsDraggingFile(true)
                        }}
                        onDragEnter={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsDraggingFile(true)
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsDraggingFile(false)
                        }}
                        onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsDraggingFile(false)
                            const f = e.dataTransfer.files?.[0]
                            if (f) {
                                if (!f.name.match(/\.(xlsx|xlsm)$/i)) {
                                    setErrorMsg('Por favor arrastra o selecciona un archivo Excel válido (.xlsx o .xlsm).')
                                    return
                                }
                                handleFileSelect(f)
                            }
                        }}
                        className={`max-w-xl mx-auto border-2 border-dashed rounded-3xl p-8 sm:p-12 transition-all cursor-pointer space-y-3 group ${
                            isDraggingFile
                                ? 'border-cyan-500 bg-cyan-100/70 ring-4 ring-cyan-300/50 scale-[1.02]'
                                : 'border-gray-300 hover:border-cyan-500 bg-gray-50 hover:bg-cyan-50/40'
                        }`}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".xlsx, .xlsm"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) handleFileSelect(f)
                            }}
                        />
                        <span className={`text-5xl block transition-transform ${isDraggingFile ? 'scale-125' : 'group-hover:scale-110'}`}>
                            {isDraggingFile ? '📥' : '📄'}
                        </span>
                        <div className="space-y-1">
                            <p className="font-bold text-gray-800 text-base">
                                {isDraggingFile ? '¡Suelta tu archivo Excel aquí!' : 'Haz clic aquí o arrastra tu archivo .xlsx'}
                            </p>
                            <p className="text-xs text-gray-400">
                                Formatos admitidos: Excel (.xlsx, .xlsm) de cualquier tamaño
                            </p>
                        </div>
                        {isPending && (
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold shadow-md">
                                <span className="animate-spin text-sm">⏳</span> Analizando estructura de la planilla...
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ===============================================================
                PASO 2: Encabezados y Vista Previa
            =============================================================== */}
            {paso === 2 && (
                <div className="space-y-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-100">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <span>🔍</span> Detección de Hojas y Encabezados
                            </h2>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Archivo cargado: <strong className="text-gray-800">{nombreArchivo}</strong> ({hojas.length} {hojas.length === 1 ? 'hoja' : 'hojas'}).
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={reiniciarProceso}
                            className="text-xs font-bold text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-red-50 px-3 py-2 rounded-xl border border-gray-200 transition-colors"
                        >
                            ✕ Cargar otro archivo
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-200">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                                    Hoja Base de Configuración:
                                </label>
                                <select
                                    value={hojaBase}
                                    onChange={(e) => handleRefrescarEncabezados(e.target.value, estructura[e.target.value]?.filaEncabezado || 1)}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-cyan-500"
                                >
                                    {hojas.map(h => (
                                        <option key={h} value={h}>
                                            {h} ({estructura[h]?.nFilasDatos || 0} filas)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                                    Fila de Encabezado Detectada:
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min={1}
                                        max={estructura[hojaBase]?.totalFilas || 100}
                                        value={filaEnc}
                                        onChange={(e) => handleRefrescarEncabezados(hojaBase, parseInt(e.target.value, 10) || 1)}
                                        className="w-24 bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm font-black text-center text-gray-800"
                                    />
                                    <span className="text-xs text-gray-500">
                                        (Modifícala si los títulos no coinciden)
                                    </span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-200/80 space-y-2 text-xs text-gray-600">
                                <div className="flex justify-between">
                                    <span>Columnas totales:</span>
                                    <strong className="text-gray-900">{estructura[hojaBase]?.columnas?.length || 0}</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span>Filas de datos:</span>
                                    <strong className="text-gray-900">{estructura[hojaBase]?.nFilasDatos || 0}</strong>
                                </div>
                            </div>
                        </div>

                        {/* Tabla de Vista Previa */}
                        <div className="md:col-span-2 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Vista previa de las primeras columnas ({hojaBase})
                                </span>
                                <span className="text-[11px] text-cyan-700 font-semibold bg-cyan-50 px-2 py-0.5 rounded-md">
                                    Muestra de 6 filas
                                </span>
                            </div>

                            <div className="overflow-x-auto border border-gray-200 rounded-2xl max-h-72">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-100 text-gray-700 font-bold sticky top-0">
                                        <tr>
                                            {preview.headers.map((h, i) => (
                                                <th key={i} className="px-3 py-2.5 whitespace-nowrap border-b border-r border-gray-200">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {preview.rows.map((row, rIdx) => (
                                            <tr key={rIdx} className="hover:bg-gray-50">
                                                {row.map((cell, cIdx) => (
                                                    <td key={cIdx} className="px-3 py-2 whitespace-nowrap text-gray-600 border-r border-gray-100">
                                                        {cell || <span className="text-gray-300 italic">-</span>}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setPaso(1)}
                            className="px-5 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl"
                        >
                            ← Volver
                        </button>
                        <button
                            type="button"
                            onClick={irAPasoColumnas}
                            className="px-6 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md flex items-center gap-2"
                        >
                            <span>Configurar Columnas</span> →
                        </button>
                    </div>
                </div>
            )}

            {/* ===============================================================
                PASO 3: Selección de Columnas y Tipos
            =============================================================== */}
            {paso === 3 && (
                <div className="space-y-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-100">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <span>📋</span> Columnas a Anonimizar
                            </h2>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Revisa y marca las columnas con datos personales. Selecciona el tipo adecuado para cada una.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="inline-flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer select-none bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                                <input
                                    type="checkbox"
                                    checked={soloDetectadas}
                                    onChange={(e) => setSoloDetectadas(e.target.checked)}
                                    className="rounded text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                                />
                                <span>Mostrar solo datos personales detectados</span>
                            </label>
                        </div>
                    </div>

                    {/* Selector de Formato de RUT */}
                    {Object.values(decisiones).some(d => d.anonimizar && d.tipo === 'rut') && (
                        <div className="p-4 rounded-2xl bg-cyan-50/70 border border-cyan-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-0.5">
                                <span className="text-xs font-black text-cyan-900 flex items-center gap-1.5">
                                    <span>🆔</span> Formato para los RUTs Sintéticos:
                                </span>
                                <p className="text-[11px] text-cyan-700">
                                    Los RUT se generarán en rango 30M+ con dígito verificador válido (módulo 11).
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormatoRut('imitar')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        formatoRut === 'imitar'
                                            ? 'bg-cyan-700 text-white shadow-xs'
                                            : 'bg-white text-cyan-800 border border-cyan-200'
                                    }`}
                                >
                                    Imitar formato de cada celda
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormatoRut('uniforme')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        formatoRut === 'uniforme'
                                            ? 'bg-cyan-700 text-white shadow-xs'
                                            : 'bg-white text-cyan-800 border border-cyan-200'
                                    }`}
                                >
                                    Uniformar (XX.XXX.XXX-X)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tabla de Columnas */}
                    <div className="overflow-x-auto border border-gray-200 rounded-2xl max-h-[460px]">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-100 text-gray-700 font-bold sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 w-16 text-center">Anonimizar</th>
                                    <th className="px-4 py-3 w-16 text-center">Col</th>
                                    <th className="px-4 py-3">Encabezado</th>
                                    <th className="px-4 py-3 w-56">Tipo de Dato</th>
                                    <th className="px-4 py-3">Ejemplo Actual en Archivo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {columnasFiltradas.map((col: any) => {
                                    const dec = decisiones[col.col] || { anonimizar: false, tipo: 'texto' }
                                    return (
                                        <tr
                                            key={col.col}
                                            onClick={() => toggleColumna(col.col)}
                                            className={`cursor-pointer transition-colors ${
                                                dec.anonimizar ? 'bg-cyan-50/40 hover:bg-cyan-50/70' : 'hover:bg-gray-50'
                                            }`}
                                        >
                                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={dec.anonimizar}
                                                    onChange={() => toggleColumna(col.col)}
                                                    className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center font-mono font-bold text-gray-500">
                                                {col.letra}
                                            </td>
                                            <td className="px-4 py-3 font-bold text-gray-900">
                                                {col.nombre}
                                            </td>
                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <select
                                                    value={dec.tipo}
                                                    disabled={!dec.anonimizar}
                                                    onChange={(e) => cambiarTipoColumna(col.col, e.target.value)}
                                                    className={`w-full text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-all ${
                                                        dec.anonimizar
                                                            ? 'bg-white border-cyan-300 text-cyan-900 font-bold'
                                                            : 'bg-gray-100 border-gray-200 text-gray-400'
                                                    }`}
                                                >
                                                    {Object.entries(TIPOS).map(([key, label]) => (
                                                        <option key={key} value={key}>
                                                            {label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-gray-500 text-[11px] truncate max-w-xs">
                                                {col.ejemplo || <span className="text-gray-300 italic">(vacío)</span>}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-6 border-t border-gray-100">
                        <div className="text-xs text-gray-500 font-medium">
                            <strong className="text-cyan-700 font-bold text-sm">{totalSeleccionadas}</strong> columnas seleccionadas para anonimizar.
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setPaso(2)}
                                className="px-5 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl"
                            >
                                ← Volver
                            </button>
                            <button
                                type="button"
                                disabled={totalSeleccionadas === 0}
                                onClick={irAPasoResolucion}
                                className={`px-6 py-2.5 text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 ${
                                    totalSeleccionadas > 0
                                        ? 'bg-slate-900 hover:bg-slate-800 text-white'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                                <span>Continuar</span> →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===============================================================
                PASO 4: Emparejamiento Multioja (si hay > 1 hoja)
            =============================================================== */}
            {paso === 4 && (
                <div className="space-y-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
                    <div className="pb-6 border-b border-gray-100">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <span>📑</span> Emparejamiento en Otras Hojas
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Las columnas elegidas se buscaron por nombre de encabezado en las demás hojas del libro.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {Object.entries(resoluciones).map(([hoja, lista]) => (
                            <div key={hoja} className="border border-gray-200 rounded-2xl overflow-hidden">
                                <div className="bg-gray-50 px-4 py-3 font-black text-xs text-gray-800 border-b border-gray-200 flex items-center justify-between">
                                    <span>Hoja: {hoja}</span>
                                    <span className="text-[11px] text-gray-500 font-semibold">{lista.length} columnas vinculadas</span>
                                </div>

                                <div className="divide-y divide-gray-100">
                                    {lista.map((res: any, idx: number) => {
                                        const estadoBadges: Record<string, { label: string; color: string }> = {
                                            igual: { label: 'Misma posición', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                                            corrida: { label: 'Columna corrida', color: 'bg-sky-50 text-sky-700 border-sky-200' },
                                            repetida: { label: 'Nombre repetido', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                                            ambigua: { label: 'Ambigua', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                                            ausente: { label: 'No encontrada', color: 'bg-gray-100 text-gray-500 border-gray-200' },
                                        }
                                        const b = estadoBadges[res.estado] || { label: res.estado, color: 'bg-gray-100 text-gray-700' }

                                        return (
                                            <div key={idx} className="p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                                                <div className="space-y-0.5">
                                                    <span className="font-bold text-gray-900">{res.encabezado}</span>
                                                    <span className="text-[11px] text-gray-400 ml-2">({TIPOS[res.tipo] || res.tipo})</span>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${b.color}`}>
                                                        {b.label}
                                                    </span>
                                                    <span className="font-mono text-gray-600 font-bold">
                                                        {res.colDestino ? `Columna ${res.colDestino}` : 'Saltar'}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setPaso(3)}
                            className="px-5 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl"
                        >
                            ← Volver
                        </button>
                        <button
                            type="button"
                            onClick={() => setPaso(5)}
                            className="px-6 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md flex items-center gap-2"
                        >
                            <span>Siguiente (Mapa Previo)</span> →
                        </button>
                    </div>
                </div>
            )}

            {/* ===============================================================
                PASO 5: Mapa Previo (Opcional)
            =============================================================== */}
            {paso === 5 && (
                <div className="space-y-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
                    <div className="pb-6 border-b border-gray-100">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <span>🔑</span> Mapa de Equivalencias Previo (Opcional)
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Si procesas un mes nuevo o una versión posterior, puedes cargar el mapa anterior para que los colaboradores reciban exactamente las mismas identidades ficticias.
                        </p>
                    </div>

                    <div
                        onClick={() => mapaInputRef.current?.click()}
                        onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsDraggingMapa(true)
                        }}
                        onDragEnter={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsDraggingMapa(true)
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsDraggingMapa(false)
                        }}
                        onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsDraggingMapa(false)
                            const f = e.dataTransfer.files?.[0]
                            if (f) {
                                if (!f.name.match(/\.(xlsx|xlsm)$/i)) {
                                    setErrorMsg('El mapa debe ser un archivo Excel (.xlsx).')
                                    return
                                }
                                const formData = new FormData()
                                formData.append('file', f)
                                startTransition(async () => {
                                    const res = await cargarMapaPrevioAction(formData)
                                    if (res.success && res.entradas) {
                                        setMapaPrevioEntradas(res.entradas)
                                        setMapaPrevioInfo(`Mapa cargado: ${res.totalCargadas} equivalencias activas de "${f.name}"`)
                                    } else {
                                        setErrorMsg(res.error || 'No se pudo cargar el mapa previo.')
                                    }
                                })
                            }
                        }}
                        className={`p-6 rounded-2xl border-2 border-dashed text-center space-y-4 max-w-lg mx-auto cursor-pointer transition-all ${
                            isDraggingMapa
                                ? 'border-cyan-500 bg-cyan-100/60 ring-4 ring-cyan-300/40 scale-[1.02]'
                                : 'border-gray-200 bg-gray-50/60 hover:bg-cyan-50/30 hover:border-cyan-300'
                        }`}
                    >
                        <span className={`text-4xl block transition-transform ${isDraggingMapa ? 'scale-125' : ''}`}>🗺️</span>
                        <div>
                            <p className="text-sm font-bold text-gray-800">
                                {isDraggingMapa ? '¡Suelta tu archivo de mapa aquí!' : '¿Tienes el archivo MAPA de una corrida previa?'}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Haz clic o arrastra el archivo Excel generado anteriormente (ej: `NÓMINA MAPA 2026.xlsx`)
                            </p>
                        </div>

                        <input
                            type="file"
                            ref={mapaInputRef}
                            accept=".xlsx"
                            className="hidden"
                            onChange={handleCargarMapaPrevio}
                        />

                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                mapaInputRef.current?.click()
                            }}
                            className="px-4 py-2 bg-white hover:bg-cyan-50 border border-gray-300 hover:border-cyan-300 text-gray-700 hover:text-cyan-700 font-bold text-xs rounded-xl shadow-2xs transition-all"
                        >
                            📂 Seleccionar Archivo de Mapa
                        </button>

                        {mapaPrevioInfo && (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center justify-center gap-2">
                                <span>✅</span> {mapaPrevioInfo}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setPaso(hojas.length > 1 ? 4 : 3)}
                            className="px-5 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl"
                        >
                            ← Volver
                        </button>
                        <button
                            type="button"
                            onClick={irAValidacion}
                            className="px-6 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md flex items-center gap-2"
                        >
                            <span>Revisar y Validar</span> →
                        </button>
                    </div>
                </div>
            )}

            {/* ===============================================================
                PASO 6: Diagnóstico de Contenido y Alertas
            =============================================================== */}
            {paso === 6 && (
                <div className="space-y-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
                    <div className="pb-6 border-b border-gray-100">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <span>🛡️</span> Diagnóstico de Calidad del Contenido
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Se contrasta el contenido real de cada columna con el tipo de dato asignado para prevenir errores de columnas corridas.
                        </p>
                    </div>

                    {hayAlertas && (
                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-2">
                            <strong className="block font-bold text-sm">⚠️ Atención requerida en algunas columnas:</strong>
                            <p>
                                Se detectaron discordancias entre los datos encontrados y el tipo seleccionado (por ejemplo, RUTs con dígito verificador inválido o correos sin arroba). Revisa la tabla de abajo antes de continuar.
                            </p>
                            <label className="flex items-center gap-2 font-bold cursor-pointer pt-1">
                                <input
                                    type="checkbox"
                                    checked={confirmarAlertas}
                                    onChange={(e) => setConfirmarAlertas(e.target.checked)}
                                    className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                                />
                                <span>He revisado las advertencias y confirmo que deseo anonimizar así</span>
                            </label>
                        </div>
                    )}

                    {/* Tabla de Diagnósticos */}
                    <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-100 text-gray-700 font-bold">
                                <tr>
                                    <th className="px-4 py-3">Hoja</th>
                                    <th className="px-4 py-3 w-16 text-center">Col</th>
                                    <th className="px-4 py-3">Encabezado</th>
                                    <th className="px-4 py-3">Tipo Asignado</th>
                                    <th className="px-4 py-3 text-center">Estado</th>
                                    <th className="px-4 py-3">Detalle del Diagnóstico</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {diagnosticos.map((d, i) => {
                                    const severidadInfo = {
                                        ok: { label: 'Correcto', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '✅' },
                                        nota: { label: 'Revisar', color: 'bg-sky-50 text-sky-700 border-sky-200', icon: 'ℹ️' },
                                        alerta: { label: 'Atención', color: 'bg-amber-50 text-amber-800 border-amber-200 font-black', icon: '⚠️' }
                                    }[d.severidad as 'ok' | 'nota' | 'alerta']

                                    return (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-bold text-gray-900">{d.hoja}</td>
                                            <td className="px-4 py-3 font-mono font-bold text-gray-500 text-center">{d.colLetra}</td>
                                            <td className="px-4 py-3 font-bold text-gray-800">{d.nombre}</td>
                                            <td className="px-4 py-3 text-gray-600">{d.tipo}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] border ${severidadInfo.color}`}>
                                                    <span>{severidadInfo.icon}</span>
                                                    <span>{severidadInfo.label}</span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 text-[11px]">
                                                {d.mensaje || `Todos los ${d.revisados} valores analizados cumplen con el formato esperado.`}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setPaso(5)}
                            className="px-5 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl"
                        >
                            ← Volver
                        </button>
                        <button
                            type="button"
                            disabled={!confirmarAlertas && hayAlertas}
                            onClick={ejecutarProceso}
                            className={`px-8 py-3 text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 ${
                                confirmarAlertas || !hayAlertas
                                    ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-cyan-500/20'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            {isPending ? (
                                <>
                                    <span className="animate-spin">⏳</span> Anonimizando libro...
                                </>
                            ) : (
                                <>
                                    <span>⚡ Ejecutar Anonimización</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* ===============================================================
                PASO 7: Resultados, Métricas y Descargas
            =============================================================== */}
            {paso === 7 && resultado && (
                <div className="space-y-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 animate-in fade-in-50">
                    <div className="pb-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-2">
                                <span>🎉</span> Anonimización Completada Exitosamente
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black text-gray-900">
                                Planilla y Mapa de Equivalencias Listos
                            </h2>
                            <p className="text-sm text-gray-500 mt-0.5">
                                La estructura, fórmulas, estilos y anchos originales se han conservado intactos.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={reiniciarProceso}
                                className="px-4 py-2 text-xs font-bold text-gray-700 hover:text-rose-700 bg-gray-100 hover:bg-rose-50 border border-gray-200 hover:border-rose-200 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                                title="Limpiar todos los datos y reiniciar el formulario"
                            >
                                <span>🧹</span> Limpiar
                            </button>
                            <button
                                type="button"
                                onClick={reiniciarProceso}
                                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                                title="Cargar una nueva planilla"
                            >
                                <span>➕</span> Nuevo Proceso
                            </button>
                        </div>
                    </div>

                    {/* Tarjetas KPI Resumen */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-5 rounded-2xl bg-cyan-50/60 border border-cyan-200/80">
                            <span className="text-xs font-bold text-cyan-800 uppercase tracking-wider block">
                                Celdas Reemplazadas
                            </span>
                            <div className="text-3xl font-black text-cyan-900 mt-2">
                                {resultado.resumen?.celdas?.toLocaleString('es-CL')}
                            </div>
                            <span className="text-[11px] text-cyan-700 mt-1 block">
                                Datos personales sustituidos
                            </span>
                        </div>

                        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                                Valores Únicos en Mapa
                            </span>
                            <div className="text-3xl font-black text-slate-900 mt-2">
                                {resultado.metricasMapa?.total?.toLocaleString('es-CL')}
                            </div>
                            <span className="text-[11px] text-slate-500 mt-1 block">
                                Diccionario de identidades sintéticas
                            </span>
                        </div>

                        <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
                            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                                Nuevas Equivalencias
                            </span>
                            <div className="text-3xl font-black text-emerald-900 mt-2">
                                {resultado.metricasMapa?.nuevos?.toLocaleString('es-CL')}
                            </div>
                            <span className="text-[11px] text-emerald-700 mt-1 block">
                                Generadas en esta corrida
                            </span>
                        </div>
                    </div>

                    {/* Botones de Descarga */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <button
                            type="button"
                            onClick={() => descargarBase64(resultado.archivoAnonimizadoBase64, resultado.nombreSalida)}
                            className="p-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-between shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 transition-all group"
                        >
                            <div className="text-left space-y-1">
                                <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                                    <span>📥</span> Descarga Principal
                                </span>
                                <p className="text-base font-black truncate max-w-xs sm:max-w-sm">
                                    {resultado.nombreSalida}
                                </p>
                                <span className="text-[11px] text-slate-400 block">
                                    Planilla con celdas anonimizadas para compartir
                                </span>
                            </div>
                            <span className="text-2xl group-hover:scale-110 transition-transform">⬇️</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => descargarBase64(resultado.mapaBase64, resultado.nombreMapa)}
                            className="p-5 rounded-2xl bg-white hover:bg-cyan-50/50 border-2 border-cyan-200 hover:border-cyan-300 text-cyan-950 flex items-center justify-between shadow-sm transition-all group"
                        >
                            <div className="text-left space-y-1">
                                <span className="text-xs font-bold text-cyan-700 flex items-center gap-1.5">
                                    <span>🔑</span> Diccionario Confidencial
                                </span>
                                <p className="text-base font-black truncate max-w-xs sm:max-w-sm">
                                    {resultado.nombreMapa}
                                </p>
                                <span className="text-[11px] text-cyan-600 block">
                                    Mapa de equivalencias (Permite revertir los datos)
                                </span>
                            </div>
                            <span className="text-2xl group-hover:scale-110 transition-transform">🗺️</span>
                        </button>
                    </div>

                    {/* Alerta de Seguridad del Mapa */}
                    <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-3">
                        <span className="text-2xl">🔒</span>
                        <div className="space-y-0.5">
                            <strong className="font-bold text-sm block">Recomendación de Seguridad Estricta:</strong>
                            <p>
                                El mapa de equivalencias permite revertir la anonimización y vincular las identidades reales con las ficticias. Almacénalo en un repositorio seguro y <strong>nunca lo envíes ni lo compartas en conjunto con la planilla anonimizada</strong>.
                            </p>
                        </div>
                    </div>

                    {/* Detalle por Hoja y Columna */}
                    <div className="space-y-2 pt-4 border-t border-gray-100">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Detalle de Celdas Reemplazadas por Columna
                        </h3>
                        <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-100 text-gray-700 font-bold">
                                    <tr>
                                        <th className="px-4 py-3">Hoja</th>
                                        <th className="px-4 py-3 text-center w-20">Columna</th>
                                        <th className="px-4 py-3">Tipo</th>
                                        <th className="px-4 py-3 text-right">Celdas Reemplazadas</th>
                                        <th className="px-4 py-3 text-right">Valores Distintos</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {resultado.resumen?.detalle?.map((d: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-2.5 font-bold text-gray-900">{d.hoja}</td>
                                            <td className="px-4 py-2.5 font-mono font-bold text-center text-gray-500">{d.columna}</td>
                                            <td className="px-4 py-2.5 text-gray-700 font-semibold">{d.tipo}</td>
                                            <td className="px-4 py-2.5 text-right font-mono font-bold text-cyan-700">
                                                {d.celdas.toLocaleString('es-CL')}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-mono text-gray-600">
                                                {d.distintos.toLocaleString('es-CL')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Barra de acción final: Limpiar / Nuevo Proceso */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-gray-100 bg-gray-50/70 p-5 rounded-2xl border border-gray-200">
                        <div className="space-y-0.5 text-center sm:text-left">
                            <p className="text-sm font-bold text-gray-800">
                                ¿Deseas procesar otro archivo o reiniciar el anonimizador?
                            </p>
                            <p className="text-xs text-gray-500">
                                Puedes limpiar la memoria y cargar una nueva planilla cuando lo desees.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={reiniciarProceso}
                                className="px-5 py-2.5 text-xs font-bold text-gray-700 hover:text-rose-700 bg-white hover:bg-rose-50 border border-gray-300 hover:border-rose-300 rounded-xl transition-all shadow-2xs flex items-center gap-2"
                            >
                                <span>🧹</span> Limpiar Datos
                            </button>
                            <button
                                type="button"
                                onClick={reiniciarProceso}
                                className="px-6 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition-all flex items-center gap-2"
                            >
                                <span>➕</span> Comenzar Nuevo Proceso
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
