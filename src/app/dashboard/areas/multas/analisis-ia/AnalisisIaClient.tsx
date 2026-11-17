'use client'

import React, { useState, useTransition } from 'react'
import {
    ConfigIaDTO,
    LogConsumoIaDTO,
    analizarFolioIaAction,
    extraerPesajeIaAction,
    guardarConfigIaAction
} from './actions'
import { AnalisisIaResultado, ExtraccionPesajeResultado } from '@/lib/multas/ia-service'
import {
    Sparkles,
    Scale,
    FileSpreadsheet,
    FileText,
    Copy,
    Check,
    AlertCircle,
    CheckCircle2,
    UploadCloud,
    Settings,
    History,
    RefreshCw,
    Shield,
    DollarSign,
    Zap,
    Cpu,
    Lock,
    Eye,
    TrendingUp
} from 'lucide-react'

interface Props {
    initialConfig?: ConfigIaDTO
    initialLogs: LogConsumoIaDTO[]
    foliosDisponibles: { folio: string; rbd: number; licitacion: string | null; monto: number }[]
    canManageConfig: boolean
    userName: string
}

export default function AnalisisIaClient({
    initialConfig,
    initialLogs,
    foliosDisponibles,
    canManageConfig,
    userName
}: Props) {
    const [activeTab, setActiveTab] = useState<'DEFENSA' | 'PESAJE' | 'CONFIGURACION'>('DEFENSA')
    const [config, setConfig] = useState<ConfigIaDTO | undefined>(initialConfig)
    const [logs, setLogs] = useState<LogConsumoIaDTO[]>(initialLogs)
    const [isPending, startTransition] = useTransition()

    // Feedback
    const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
    const [copied, setCopied] = useState(false)

    // Pestaña 1: Análisis por Folio
    const [selectedFolio, setSelectedFolio] = useState(foliosDisponibles[0]?.folio || '')
    const [manualFolio, setManualFolio] = useState('')
    const [resultadoAnalisis, setResultadoAnalisis] = useState<AnalisisIaResultado | null>(null)

    // Pestaña 2: Visión Planilla Pesaje
    const [pesajeFile, setPesajeFile] = useState<File | null>(null)
    const [pesajePreview, setPesajePreview] = useState<string | null>(null)
    const [resultadoPesaje, setResultadoPesaje] = useState<ExtraccionPesajeResultado | null>(null)

    // Pestaña 3: Configuración IA
    const [formProveedor, setFormProveedor] = useState(config?.proveedor || 'GOOGLE_GEMINI')
    const [formModelo, setFormModelo] = useState(config?.modelo || 'gemini-1.5-flash')
    const [formApiKey, setFormApiKey] = useState('')
    const [formLimite, setFormLimite] = useState(String(config?.limiteGastoMensualUsd || 50))
    const [formTemperatura, setFormTemperatura] = useState(String(config?.temperatura || 0.2))

    // Ejecutar Análisis de Defensa
    const handleAnalizarFolio = () => {
        const folioToAnalyze = manualFolio.trim() || selectedFolio
        if (!folioToAnalyze) {
            setFeedback({ tipo: 'error', texto: 'Selecciona o ingresa un número de folio para analizar.' })
            return
        }

        startTransition(async () => {
            setFeedback(null)
            const res = await analizarFolioIaAction(folioToAnalyze)
            if (res.success && res.data) {
                setResultadoAnalisis(res.data)
                setFeedback({
                    tipo: 'success',
                    texto: `Análisis completado ${res.data.usandoFallbackLocal ? '(Modo Heurístico Local Hendaya)' : '(Google Gemini API)'}`
                })
            } else {
                setFeedback({ tipo: 'error', texto: res.error || 'Error al ejecutar análisis con IA.' })
            }
        })
    }

    // Copiar descargo propuesto
    const handleCopiarDescargo = async () => {
        if (!resultadoAnalisis?.descargoPropuesto) return
        try {
            await navigator.clipboard.writeText(resultadoAnalisis.descargoPropuesto)
            setCopied(true)
            setTimeout(() => setCopied(false), 2500)
        } catch (e) {
            console.error('Error al copiar:', e)
        }
    }

    // Cargar imagen de pesaje
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null
        setPesajeFile(file)
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setPesajePreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        } else {
            setPesajePreview(null)
        }
    }

    // Ejecutar Extracción de Pesaje con Visión
    const handleExtraerPesaje = () => {
        if (!pesajeFile) {
            setFeedback({ tipo: 'error', texto: 'Selecciona una imagen o fotografía de la planilla de pesaje.' })
            return
        }

        startTransition(async () => {
            setFeedback(null)
            const fd = new FormData()
            fd.append('file', pesajeFile)
            const res = await extraerPesajeIaAction(fd)
            if (res.success && res.data) {
                setResultadoPesaje(res.data)
                setFeedback({
                    tipo: 'success',
                    texto: `Valores extraídos con éxito ${res.data.usandoFallbackLocal ? '(Fallback Asistido)' : '(Visión Multimodal)'}`
                })
            } else {
                setFeedback({ tipo: 'error', texto: res.error || 'Error al extraer pesaje de la imagen.' })
            }
        })
    }

    // Guardar Configuración de IA
    const handleGuardarConfig = () => {
        startTransition(async () => {
            const res = await guardarConfigIaAction({
                proveedor: formProveedor,
                modelo: formModelo,
                apiKeyNueva: formApiKey.trim() || undefined,
                limiteGastoMensualUsd: parseFloat(formLimite) || 50,
                temperatura: parseFloat(formTemperatura) || 0.2
            })

            if (res.success) {
                setFeedback({ tipo: 'success', texto: 'Configuración de Inteligencia Artificial guardada con éxito.' })
                setFormApiKey('')
                // Actualizar estado local
                if (config) {
                    setConfig({
                        ...config,
                        proveedor: formProveedor,
                        modelo: formModelo,
                        limiteGastoMensualUsd: parseFloat(formLimite) || 50,
                        temperatura: parseFloat(formTemperatura) || 0.2,
                        hasApiKey: Boolean(formApiKey.trim() || config.hasApiKey)
                    })
                }
            } else {
                setFeedback({ tipo: 'error', texto: res.error || 'Error al guardar configuración.' })
            }
        })
    }

    return (
        <div className="space-y-6">
            {/* Feedback Toast */}
            {feedback && (
                <div
                    className={`p-4 rounded-2xl flex items-center justify-between shadow-sm border transition-all ${
                        feedback.tipo === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        {feedback.tipo === 'success' ? (
                            <Check className="w-5 h-5 text-emerald-600" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-rose-600" />
                        )}
                        <span className="text-xs font-semibold">{feedback.texto}</span>
                    </div>
                    <button
                        onClick={() => setFeedback(null)}
                        className="text-xs opacity-75 hover:opacity-100 font-bold underline ml-4 cursor-pointer"
                    >
                        Cerrar
                    </button>
                </div>
            )}

            {/* BARRA DE PESTAÑAS (Estándar Claro Hendaya) */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                    onClick={() => setActiveTab('DEFENSA')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        activeTab === 'DEFENSA'
                            ? 'bg-cyan-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <Sparkles className="w-4 h-4" />
                    <span>Asistente Legal por Folio</span>
                </button>

                <button
                    onClick={() => setActiveTab('PESAJE')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        activeTab === 'PESAJE'
                            ? 'bg-cyan-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <Scale className="w-4 h-4" />
                    <span>Lector de Planillas de Pesaje (Visión)</span>
                </button>

                {canManageConfig && (
                    <button
                        onClick={() => setActiveTab('CONFIGURACION')}
                        className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                            activeTab === 'CONFIGURACION'
                                ? 'bg-cyan-600 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <Settings className="w-4 h-4" />
                        <span>Configuración y Control de Costos</span>
                    </button>
                )}
            </div>

            {/* PESTAÑA 1: ASISTENTE LEGAL POR FOLIO */}
            {activeTab === 'DEFENSA' && (
                <div className="space-y-6">
                    {/* Selector de Folio y Disparo */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-cyan-600" />
                                    Generador de Defensas y Descargos Asistido por IA
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Cruza automáticamente el acta, las 19 reglas del motor normativo y los precedentes de la biblioteca C8.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                                    config?.hasApiKey
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}>
                                    <Cpu className="w-3 h-3" />
                                    {config?.hasApiKey ? `Online: ${config.modelo}` : 'Motor Heurístico Local Hendaya'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Seleccionar Folio Fiscalizado
                                </label>
                                <select
                                    value={selectedFolio}
                                    onChange={e => {
                                        setSelectedFolio(e.target.value)
                                        setManualFolio('')
                                    }}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-cyan-600 focus:bg-white cursor-pointer"
                                >
                                    {foliosDisponibles.map(f => (
                                        <option key={f.folio} value={f.folio}>
                                            Folio #{f.folio} (RBD {f.rbd} - {f.monto.toFixed(1)} UTM)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    O Escribir Otro Folio
                                </label>
                                <input
                                    type="text"
                                    value={manualFolio}
                                    onChange={e => setManualFolio(e.target.value)}
                                    placeholder="Ej: 1045920"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-cyan-600 focus:bg-white"
                                />
                            </div>

                            <div className="flex items-end">
                                <button
                                    onClick={handleAnalizarFolio}
                                    disabled={isPending}
                                    className="w-full px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-60"
                                >
                                    {isPending ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Analizando Caso...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            <span>Generar Defensa con IA</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Resultados del Análisis */}
                    {resultadoAnalisis && (
                        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
                            {/* Encabezado del resultado */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-base font-extrabold text-slate-900">Propuesta de Defensa Técnica y Jurídica</h4>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                            resultadoAnalisis.probabilidadExito === 'ALTA'
                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                : resultadoAnalisis.probabilidadExito === 'MEDIA'
                                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                : 'bg-rose-50 text-rose-800 border-rose-200'
                                        }`}>
                                            Probabilidad de Rebaja: {resultadoAnalisis.probabilidadExito}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">{resultadoAnalisis.resumenEjecutivo}</p>
                                </div>

                                <button
                                    onClick={handleCopiarDescargo}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer shrink-0 ${
                                        copied
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200'
                                    }`}
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-3.5 h-3.5" />
                                            <span>¡Copiado al Portapapeles!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5 text-cyan-700" />
                                            <span>Copiar Descargo Completo</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Vicios detectados */}
                            <div>
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                                    Vicios de Procedimiento y Defensas Detectadas ({resultadoAnalisis.viciosProcedimiento.length})
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {resultadoAnalisis.viciosProcedimiento.map((v, i) => (
                                        <div key={i} className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl flex items-start gap-2.5 text-xs text-slate-700">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                            <span>{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Fundamento Normativo */}
                            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-700">
                                <strong className="text-slate-900 block mb-0.5">Base Jurídica Aplicable:</strong>
                                <span>{resultadoAnalisis.fundamentoNormativo}</span>
                            </div>

                            {/* Redacción Completa del Descargo */}
                            <div>
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                                    Borrador Formal para Ingreso en Oficina de Partes
                                </span>
                                <pre className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl text-xs text-slate-800 font-sans whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto">
                                    {resultadoAnalisis.descargoPropuesto}
                                </pre>
                            </div>

                            {/* Indicador de telemetría */}
                            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100">
                                <span>Tiempo de procesamiento: {resultadoAnalisis.tiempoMs}ms</span>
                                <span>
                                    {resultadoAnalisis.usandoFallbackLocal ? 'Procesado con Inteligencia Heurística Interna' : `Tokens consumidos: ${resultadoAnalisis.tokensConsumidos} · Costo: $${resultadoAnalisis.costoUsd.toFixed(5)} USD`}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* PESTAÑA 2: LECTOR DE PLANILLA DE PESAJE (VISIÓN) */}
            {activeTab === 'PESAJE' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                    <Scale className="w-5 h-5 text-cyan-600" />
                                    Digitalización Multimodal de Planillas de Pesaje (Gramaje - C3.1)
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Sube una foto o escaneo de la planilla de pesaje de JUNAEB para extraer el nivel supervisado y el conteo de bandejas con visión artificial.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Área de subida */}
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Imagen / Fotografía de la Planilla
                                </label>
                                <div className="border-2 border-dashed border-slate-300 rounded-3xl p-6 text-center space-y-3 bg-slate-50/50 hover:border-cyan-500 transition-colors">
                                    <UploadCloud className="w-10 h-10 text-slate-400 mx-auto" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">Selecciona o arrastra la foto del acta de pesaje</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">Formatos JPG, PNG, WEBP o PDF</p>
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={handleFileChange}
                                        className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-cyan-50 file:text-cyan-800 file:text-xs file:font-bold hover:file:bg-cyan-100 cursor-pointer"
                                    />
                                </div>

                                {pesajeFile && (
                                    <button
                                        onClick={handleExtraerPesaje}
                                        disabled={isPending}
                                        className="w-full px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-60"
                                    >
                                        {isPending ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                <span>Leyendo Planilla con Visión IA...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="w-4 h-4" />
                                                <span>Analizar con Visión Computacional</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Previsualización y Resultados */}
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Resultados Extraídos
                                </label>

                                {resultadoPesaje ? (
                                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                                            <span className="text-xs font-bold text-slate-800">Valores Sugeridos por IA</span>
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                                {resultadoPesaje.nivelConfianza}% Confianza
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2.5 text-center">
                                            <div className="bg-white p-3 rounded-2xl border border-slate-200">
                                                <span className="text-[10px] font-bold text-slate-400 block uppercase">Nivel</span>
                                                <span className="text-xl font-black text-cyan-700">
                                                    {resultadoPesaje.nivelSugerido === 'T' ? 'Transición (T)' : resultadoPesaje.nivelSugerido === 'M' ? 'Media (M)' : 'Básica (B)'}
                                                </span>
                                            </div>

                                            <div className="bg-white p-3 rounded-2xl border border-slate-200">
                                                <span className="text-[10px] font-bold text-slate-400 block uppercase">Bandejas Pesadas</span>
                                                <span className="text-xl font-black text-slate-900">{resultadoPesaje.bandejasEvaluadas}</span>
                                            </div>

                                            <div className="bg-white p-3 rounded-2xl border border-slate-200">
                                                <span className="text-[10px] font-bold text-slate-400 block uppercase">Rechazadas Re</span>
                                                <span className="text-xl font-black text-rose-700">{resultadoPesaje.bandejasRechazadas}</span>
                                            </div>
                                        </div>

                                        <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-600">
                                            <strong className="text-slate-800">Observación manuscrita detectada:</strong> {resultadoPesaje.observacionesDetectadas}
                                        </div>

                                        <p className="text-[11px] text-slate-500">
                                            * Estos datos son una propuesta de precarga para confirmar e incorporar al motor normativo AQL en el módulo C3.1.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center text-slate-400 h-48 flex flex-col items-center justify-center">
                                        <Scale className="w-8 h-8 text-slate-300 mb-2" />
                                        <p className="text-xs">Sube una fotografía para ver aquí los datos extraídos de la planilla de pesaje.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PESTAÑA 3: CONFIGURACIÓN Y CONTROL DE COSTOS */}
            {activeTab === 'CONFIGURACION' && canManageConfig && (
                <div className="space-y-6">
                    {/* Tarjetas de presupuesto */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shrink-0">
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Límite Mensual</p>
                                <h4 className="text-2xl font-black text-slate-900 mt-0.5">
                                    ${config?.limiteGastoMensualUsd.toFixed(2)} <span className="text-xs font-normal">USD</span>
                                </h4>
                            </div>
                        </div>

                        <div className="bg-white border border-emerald-200 bg-emerald-50/20 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider">Gasto Acumulado Mes</p>
                                <h4 className="text-2xl font-black text-emerald-700 mt-0.5">
                                    ${config?.gastoAcumuladoMesUsd.toFixed(4)} <span className="text-xs font-normal">USD</span>
                                </h4>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                                <Shield className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Seguridad de Clave</p>
                                <h4 className="text-sm font-bold text-slate-900 mt-1">Cifrado AES-256</h4>
                                <span className="text-[10px] text-slate-400">Protección en base de datos</span>
                            </div>
                        </div>
                    </div>

                    {/* Formulario de Configuración */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-cyan-600" />
                                Parámetros de Proveedor y Modelo de IA
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div>
                                <label className="text-slate-600 font-bold uppercase tracking-wider text-[10px] block mb-1">
                                    Proveedor de Inteligencia Artificial
                                </label>
                                <select
                                    value={formProveedor}
                                    onChange={e => setFormProveedor(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:bg-white focus:border-cyan-600"
                                >
                                    <option value="GOOGLE_GEMINI">Google Gemini API (Recomendado)</option>
                                    <option value="OPENAI">OpenAI Compatible</option>
                                    <option value="ANTHROPIC">Anthropic Claude Compatible</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-slate-600 font-bold uppercase tracking-wider text-[10px] block mb-1">
                                    Modelo Principal
                                </label>
                                <select
                                    value={formModelo}
                                    onChange={e => setFormModelo(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:bg-white focus:border-cyan-600"
                                >
                                    <option value="gemini-1.5-flash">gemini-1.5-flash (Ultra rápido y económico)</option>
                                    <option value="gemini-1.5-pro">gemini-1.5-pro (Máxima capacidad jurídica)</option>
                                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-slate-600 font-bold uppercase tracking-wider text-[10px] block mb-1">
                                    Actualizar API Key (Se almacena cifrada)
                                </label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="password"
                                        value={formApiKey}
                                        onChange={e => setFormApiKey(e.target.value)}
                                        placeholder={config?.apiKeyMasked || 'Ingresa clave de API...'}
                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:bg-white focus:border-cyan-600 font-mono"
                                    />
                                </div>
                                <span className="text-[10px] text-slate-400 mt-0.5 block">
                                    Estado actual: {config?.apiKeyMasked}
                                </span>
                            </div>

                            <div>
                                <label className="text-slate-600 font-bold uppercase tracking-wider text-[10px] block mb-1">
                                    Tope Mensual de Seguridad (USD)
                                </label>
                                <input
                                    type="number"
                                    step="5"
                                    value={formLimite}
                                    onChange={e => setFormLimite(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:bg-white focus:border-cyan-600"
                                />
                                <span className="text-[10px] text-slate-400 mt-0.5 block">
                                    Al alcanzar este monto, el sistema bloquea llamadas de pago y activa el modo heurístico local.
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-end pt-3 border-t border-slate-100">
                            <button
                                onClick={handleGuardarConfig}
                                disabled={isPending}
                                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-60"
                            >
                                <Check className="w-4 h-4" />
                                <span>Guardar Configuración de IA</span>
                            </button>
                        </div>
                    </div>

                    {/* Tabla de Consumos Recientes */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <History className="w-4 h-4 text-cyan-600" />
                                Historial de Solicitudes y Consumo Reciente
                            </h4>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[11px]">
                                <thead>
                                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                        <th className="py-2.5 px-3">Fecha</th>
                                        <th className="py-2.5 px-3">Operación</th>
                                        <th className="py-2.5 px-3">Folio</th>
                                        <th className="py-2.5 px-3">Usuario</th>
                                        <th className="py-2.5 px-3">Modelo</th>
                                        <th className="py-2.5 px-3 text-right">Tokens</th>
                                        <th className="py-2.5 px-3 text-right">Costo Estimado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-8 text-center text-slate-400">
                                                Aún no hay registros de consumo de IA.
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-2 px-3 font-mono text-[10px]">{log.createdAt.split('T')[0]}</td>
                                                <td className="py-2 px-3 font-semibold text-slate-800">{log.tipoOperacion}</td>
                                                <td className="py-2 px-3 font-mono text-cyan-700 font-bold">{log.folio || '-'}</td>
                                                <td className="py-2 px-3">{log.usuario}</td>
                                                <td className="py-2 px-3 font-mono text-[10px] text-slate-500">{log.modeloUsado}</td>
                                                <td className="py-2 px-3 text-right font-mono">{log.tokensPrompt + log.tokensRespuesta}</td>
                                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">${log.costoEstimadoUsd.toFixed(5)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
