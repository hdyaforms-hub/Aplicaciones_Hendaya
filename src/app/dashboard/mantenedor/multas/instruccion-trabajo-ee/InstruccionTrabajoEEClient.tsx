'use client'

import React, { useState, useEffect, useMemo, useTransition } from 'react'
import {
    LicitacionOption,
    getInstruccionTrabajoPorLicitacion,
    procesarYCargarInstruccionTrabajoEE,
    actualizarAspectoDetalle
} from './actions'
import {
    FileText,
    UploadCloud,
    CheckCircle2,
    AlertTriangle,
    ShieldAlert,
    Clock,
    Scale,
    Apple,
    Layers,
    FileSpreadsheet,
    Edit3,
    Search,
    ChevronDown,
    ChevronRight,
    RefreshCw,
    X,
    Save
} from 'lucide-react'

interface Props {
    licitaciones: LicitacionOption[]
    currentUserName: string
}

export default function InstruccionTrabajoEEClient({ licitaciones, currentUserName }: Props) {
    const [selectedLicId, setSelectedLicId] = useState<number>(
        licitaciones.length > 0 ? licitaciones[0].licId : 0
    )
    const [itData, setItData] = useState<any | null>(null)
    const [loadingIT, setLoadingIT] = useState(false)
    const [selectedTab, setSelectedTab] = useState<'aspectos' | 'reglas' | 'anexos'>('aspectos')

    // Upload & validation state
    const [dragActive, setDragActive] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    // Aspect filter & search
    const [aspectFilter, setAspectFilter] = useState<'all' | 'si' | 'no'>('all')
    const [aspectSearch, setAspectSearch] = useState('')

    // Detail/Edit modal
    const [editingAspect, setEditingAspect] = useState<any | null>(null)
    const [editForm, setEditForm] = useState({
        aspecto: '',
        formaEvaluar: '',
        medioVerificacion: '',
        consideracionesEspecificas: '',
        pautaSolucionAnexo3: ''
    })
    const [isSavingEdit, startTransitionEdit] = useTransition()

    // Cargar datos de la IT al cambiar la licitación seleccionada
    useEffect(() => {
        if (!selectedLicId) return
        const loadIT = async () => {
            setLoadingIT(true)
            setValidationError(null)
            try {
                const res = await getInstruccionTrabajoPorLicitacion(selectedLicId)
                if (res.success) {
                    setItData(res.data)
                }
            } catch (err) {
                console.error('Error cargando IT:', err)
            } finally {
                setLoadingIT(false)
            }
        }
        loadIT()
    }, [selectedLicId])

    const selectedLic = useMemo(() => {
        return licitaciones.find(l => l.licId === selectedLicId) || null
    }, [licitaciones, selectedLicId])

    // Manejo de carga de archivos (PDF)
    const handleFileUpload = async (file: File) => {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            setValidationError('El archivo seleccionado debe ser un documento PDF (.pdf)')
            return
        }

        setUploading(true)
        setValidationError(null)
        setSuccessMessage(null)

        const formData = new FormData()
        formData.append('licId', String(selectedLicId))
        formData.append('file', file)

        try {
            const res = await procesarYCargarInstruccionTrabajoEE(formData)
            if (res.success) {
                setSuccessMessage(
                    `¡Instrucción de Trabajo cargada y validada exitosamente para la licitación ${selectedLic?.licitacionHomologada || selectedLicId}!`
                )
                // Recargar datos
                const itRes = await getInstruccionTrabajoPorLicitacion(selectedLicId)
                if (itRes.success) setItData(itRes.data)
            } else {
                setValidationError(
                    res.error || 'El archivo PDF no corresponde a la licitación seleccionada.'
                )
            }
        } catch (error: any) {
            setValidationError(error.message || 'Error al procesar el archivo PDF')
        } finally {
            setUploading(false)
        }
    }

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0])
        }
    }

    const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0])
        }
    }

    // Aspectos filtrados
    const filteredAspects = useMemo(() => {
        if (!itData?.detalles) return []
        return itData.detalles.filter((asp: any) => {
            const matchesSearch =
                asp.letra.toLowerCase().includes(aspectSearch.toLowerCase()) ||
                asp.aspecto.toLowerCase().includes(aspectSearch.toLowerCase()) ||
                asp.formaEvaluar.toLowerCase().includes(aspectSearch.toLowerCase()) ||
                asp.medioVerificacion.toLowerCase().includes(aspectSearch.toLowerCase())

            if (!matchesSearch) return false

            if (aspectFilter === 'si') return asp.tienePeriodoCorreccion || asp.periodoCorreccion === 'SI'
            if (aspectFilter === 'no') return !asp.tienePeriodoCorreccion && asp.periodoCorreccion !== 'SI'

            return true
        })
    }, [itData, aspectFilter, aspectSearch])

    // Apertura modal edición
    const handleOpenEdit = (asp: any) => {
        setEditingAspect(asp)
        setEditForm({
            aspecto: asp.aspecto || '',
            formaEvaluar: asp.formaEvaluar || '',
            medioVerificacion: asp.medioVerificacion || '',
            consideracionesEspecificas: asp.consideracionesEspecificas || '',
            pautaSolucionAnexo3: asp.pautaSolucionAnexo3 || ''
        })
    }

    const handleSaveEdit = () => {
        if (!editingAspect) return
        startTransitionEdit(async () => {
            const res = await actualizarAspectoDetalle(editingAspect.id, editForm)
            if (res.success) {
                // Actualizar estado local
                setItData((prev: any) => ({
                    ...prev,
                    detalles: prev.detalles.map((d: any) =>
                        d.id === editingAspect.id ? { ...d, ...editForm } : d
                    )
                }))
                setEditingAspect(null)
            } else {
                alert(res.error || 'Error al guardar los cambios')
            }
        })
    }

    return (
        <div className="space-y-6">
            {/* Cabecera Corporativa HENDAYA */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 p-6 rounded-2xl border border-cyan-800/40 shadow-xl relative overflow-hidden text-white">
                <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-black tracking-widest text-cyan-400 uppercase bg-cyan-950/80 px-2.5 py-1 rounded-md border border-cyan-800/60">
                                MANTENEDOR &bull; MULTAS
                            </span>
                            <span className="text-xs text-slate-400">Instrucción de Trabajo EE</span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1">
                            Instrucción de Trabajo: Elementos Esenciales
                        </h1>
                        <p className="text-sm text-slate-300 mt-1 max-w-3xl">
                            Carga y validación automatizada del documento oficial de JUNAEB por licitación. Extrae y estructura los{' '}
                            <span className="text-cyan-400 font-semibold">13 Aspectos a Controlar (A a la M)</span> con sus 4 columnas oficiales,
                            plazos de corrección (5 días hábiles), modalidades especiales y anexos técnicos.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="bg-slate-800/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-700/60">
                            <div className="text-[10px] uppercase font-bold text-slate-400">Usuario Conectado</div>
                            <div className="text-xs font-semibold text-white">{currentUserName}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Barra de Selección de Licitación */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex-1 max-w-md">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Licitación a Evaluar:
                    </label>
                    <div className="relative">
                        <select
                            value={selectedLicId}
                            onChange={e => setSelectedLicId(Number(e.target.value))}
                            className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all cursor-pointer"
                        >
                            {licitaciones.map(lic => (
                                <option key={lic.licId} value={lic.licId}>
                                    Licitación {lic.licitacionHomologada || lic.licId} (ID: {lic.licId}) {lic.tieneIT ? '— [IT Cargada]' : '— [Sin IT]'}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {itData ? (
                        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200/80 px-4 py-2 rounded-xl text-xs text-emerald-800">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                            <div>
                                <div className="font-bold">IT Vigente: Revisión {itData.numeroRevision || '03'}</div>
                                <div className="text-[11px] text-emerald-700">
                                    Fecha: {itData.fechaRevision || '10-02-2026'} &bull; {itData.detalles?.length || 13} Aspectos configurados
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-xs text-amber-800">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Esta licitación aún no tiene una Instrucción de Trabajo configurada.</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Zona de Carga y Validación del PDF */}
            <div
                onDragEnter={() => setDragActive(true)}
                onDragOver={e => {
                    e.preventDefault()
                    setDragActive(true)
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                className={`p-6 rounded-2xl border-2 border-dashed transition-all relative overflow-hidden ${
                    dragActive
                        ? 'border-cyan-500 bg-cyan-50/50 scale-[1.005]'
                        : 'border-slate-200 bg-white hover:border-cyan-300'
                }`}
            >
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 border border-cyan-100">
                            {uploading ? (
                                <RefreshCw className="w-7 h-7 animate-spin" />
                            ) : (
                                <UploadCloud className="w-7 h-7" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-base">
                                {itData ? 'Actualizar o Revalidar Documento PDF' : 'Cargar Instrucción de Trabajo (PDF)'}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
                                Arrastra o selecciona el archivo PDF de la Instrucción de Trabajo de Elementos Esenciales (ej.{' '}
                                <code className="bg-slate-100 px-1 py-0.5 rounded text-cyan-700 font-mono">
                                    IT-ELEMENTOS-ESENCIALES-LIC. 5323.pdf
                                </code>
                                ). El sistema validará estrictamente que el código interno del documento coincida con la licitación seleccionada.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <label className="cursor-pointer px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            <span>{uploading ? 'Validando PDF...' : 'Seleccionar PDF'}</span>
                            <input
                                type="file"
                                accept=".pdf"
                                disabled={uploading}
                                onChange={onFileSelect}
                                className="hidden"
                            />
                        </label>
                    </div>
                </div>

                {/* Mensaje de Validación de Error */}
                {validationError && (
                    <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3 animate-in fade-in">
                        <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                            <div className="font-bold text-rose-900">Validación Rechazada</div>
                            <div className="mt-0.5 leading-relaxed">{validationError}</div>
                        </div>
                    </div>
                )}

                {/* Mensaje de Éxito */}
                {successMessage && (
                    <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3 animate-in fade-in">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span className="font-medium">{successMessage}</span>
                    </div>
                )}
            </div>

            {/* Pestañas Principales */}
            {itData && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                        <button
                            onClick={() => setSelectedTab('aspectos')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                selectedTab === 'aspectos'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <Layers className="w-4 h-4" />
                            <span>Aspectos a Controlar (Punto 5.3 c)</span>
                            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-500 text-white text-[10px]">
                                {itData.detalles?.length || 13}
                            </span>
                        </button>

                        <button
                            onClick={() => setSelectedTab('reglas')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                selectedTab === 'reglas'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <Clock className="w-4 h-4" />
                            <span>Reglas, Plazos y Modalidades</span>
                        </button>

                        <button
                            onClick={() => setSelectedTab('anexos')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                selectedTab === 'anexos'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <Scale className="w-4 h-4" />
                            <span>Anexos Técnicos (AQL / F&V / Pauta N°3)</span>
                        </button>
                    </div>

                    {/* TAB 1: Aspectos a Controlar (4 Columnas Oficiales) */}
                    {selectedTab === 'aspectos' && (
                        <div className="space-y-4">
                            {/* Filtros de Aspectos */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                                <div className="relative flex-1 max-w-md">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por letra, aspecto o medio de verificación..."
                                        value={aspectSearch}
                                        onChange={e => setAspectSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-slate-700"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setAspectFilter('all')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                            aspectFilter === 'all'
                                                ? 'bg-slate-900 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Todos (13)
                                    </button>
                                    <button
                                        onClick={() => setAspectFilter('si')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                            aspectFilter === 'si'
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                        }`}
                                    >
                                        Con Periodo Corrección [SI] (B, E, J, L)
                                    </button>
                                    <button
                                        onClick={() => setAspectFilter('no')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                            aspectFilter === 'no'
                                                ? 'bg-slate-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Sin Periodo [NO] (9)
                                    </button>
                                </div>
                            </div>

                            {/* Tabla de 4 Columnas con Letra Clave Destacada */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs text-slate-700">
                                        <thead className="bg-slate-900 text-white uppercase text-[11px] font-bold tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3.5 w-16 text-center">Letra</th>
                                                <th className="px-6 py-3.5 w-1/4">Aspecto a Controlar</th>
                                                <th className="px-6 py-3.5 w-1/4">Forma de Evaluar</th>
                                                <th className="px-4 py-3.5 w-32 text-center">Periodo Corrección</th>
                                                <th className="px-6 py-3.5 w-1/4">Medio de Verificación</th>
                                                <th className="px-4 py-3.5 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredAspects.map((asp: any) => {
                                                const hasCorrection =
                                                    asp.tienePeriodoCorreccion || asp.periodoCorreccion === 'SI'

                                                return (
                                                    <tr
                                                        key={asp.id || asp.letra}
                                                        className={`hover:bg-cyan-50/20 transition-colors ${
                                                            hasCorrection ? 'bg-emerald-50/15' : ''
                                                        }`}
                                                    >
                                                        {/* Letra Clave */}
                                                        <td className="px-4 py-4 text-center align-top">
                                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-600 to-sky-700 text-white font-black text-base flex items-center justify-center shadow-md shadow-cyan-600/20 mx-auto">
                                                                {asp.letra}
                                                            </div>
                                                        </td>

                                                        {/* Columna 1: Aspecto */}
                                                        <td className="px-6 py-4 align-top leading-relaxed font-semibold text-slate-900">
                                                            {asp.aspecto}
                                                            {asp.consideracionesEspecificas && (
                                                                <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200/70 font-normal">
                                                                    <span className="font-bold text-slate-700">
                                                                        Consideración 5.4:{' '}
                                                                    </span>
                                                                    {asp.consideracionesEspecificas}
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* Columna 2: Forma de Evaluar */}
                                                        <td className="px-6 py-4 align-top leading-relaxed text-slate-600">
                                                            {asp.formaEvaluar}
                                                        </td>

                                                        {/* Columna 3: Periodo de Corrección */}
                                                        <td className="px-4 py-4 align-top text-center">
                                                            {hasCorrection ? (
                                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> SI
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                                    NO
                                                                </span>
                                                            )}
                                                            <div className="text-[10px] text-slate-400 mt-1">
                                                                {hasCorrection ? '5 días hábiles' : 'No subsanable'}
                                                            </div>
                                                        </td>

                                                        {/* Columna 4: Medio de Verificación */}
                                                        <td className="px-6 py-4 align-top leading-relaxed text-slate-600">
                                                            <div>{asp.medioVerificacion}</div>
                                                            {asp.pautaSolucionAnexo3 && (
                                                                <div className="mt-2 text-[11px] text-emerald-800 bg-emerald-50/80 p-2 rounded-lg border border-emerald-200">
                                                                    <span className="font-bold">Solución (Anexo 3): </span>
                                                                    {asp.pautaSolucionAnexo3}
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* Acciones */}
                                                        <td className="px-4 py-4 align-top text-center">
                                                            <button
                                                                onClick={() => handleOpenEdit(asp)}
                                                                className="p-2 text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors"
                                                                title="Editar o ampliar consideraciones del aspecto"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: Reglas, Plazos y Modalidades */}
                    {selectedTab === 'reglas' && (
                        <div className="space-y-6">
                            {/* Plazos Clave */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0 border border-cyan-100">
                                        <Clock className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">Plazos de Notificación</h4>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                            Notificación oficial al prestador vía sistema o correo institucional dentro de{' '}
                                            <strong className="text-slate-800">24 horas</strong> corridas desde la visita de supervisión (hasta{' '}
                                            <strong className="text-slate-800">72 horas</strong> para zonas rurales o de difícil conectividad).
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">Plazo de Corrección de Incumplimientos</h4>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                            Para los aspectos con periodo de corrección = <strong className="text-emerald-700">SI</strong> (Letras B, E, J, L), el prestador dispone de un plazo fatal de{' '}
                                            <strong className="text-emerald-700">5 días hábiles</strong> para ingresar los medios de verificación del Anexo N°3.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Modalidades Especiales */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <h4 className="font-bold text-slate-800 text-sm mb-3">Aspectos Aplicables por Modalidad de Servicio</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                        <div className="font-bold text-xs text-slate-800 mb-1">Residencia Familiar (SPE)</div>
                                        <div className="text-xs text-slate-500 mb-3">Aspectos evaluados en hogares tutores</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['A', 'B', 'C', 'F', 'G', 'J', 'K', 'M'].map(l => (
                                                <span key={l} className="w-7 h-7 rounded-lg bg-cyan-600 text-white font-bold text-xs flex items-center justify-center">
                                                    {l}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                        <div className="font-bold text-xs text-slate-800 mb-1">Control de Canastas</div>
                                        <div className="text-xs text-slate-500 mb-3">Entrega de alimentos no perecibles</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['A', 'C', 'D', 'E', 'F', 'K'].map(l => (
                                                <span key={l} className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                                                    {l}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                        <div className="font-bold text-xs text-slate-800 mb-1">Alimentación de Contingencia</div>
                                        <div className="text-xs text-slate-500 mb-3">Situaciones de emergencia escolar</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['A', 'C', 'D', 'F', 'G', 'K'].map(l => (
                                                <span key={l} className="w-7 h-7 rounded-lg bg-amber-600 text-white font-bold text-xs flex items-center justify-center">
                                                    {l}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tabla N°1: Causas Imputables vs No Imputables */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-xs text-slate-700 uppercase tracking-wider">
                                    Tabla N°1: Causas Imputables vs. No Imputables al Prestador
                                </div>
                                <div className="p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="text-xs font-bold text-rose-700 uppercase">Causas Imputables (Se aplica Multa)</div>
                                            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                                                <li>Falta de materias primas o insumos por retraso del proveedor de la empresa.</li>
                                                <li>Inasistencia del personal manipulador sin reemplazo oportuno.</li>
                                                <li>Falta de gas por descuido en la recarga del estanque o cilindros.</li>
                                                <li>Termómetros o balanzas inoperativas, rotas o descalibradas sin batería.</li>
                                            </ul>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="text-xs font-bold text-emerald-700 uppercase">Causas No Imputables (Descargo Aceptable)</div>
                                            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                                                <li>Corte general de suministro de agua potable o electricidad en la comuna acreditado por la sanitaria/eléctrica.</li>
                                                <li>Suspensión de clases imprevista o toma del establecimiento declarada formalmente por la Dirección.</li>
                                                <li>Fuerza mayor o catástrofe climática decretada por la autoridad competente.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: Anexos Técnicos */}
                    {selectedTab === 'anexos' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Anexo N°1: Pesaje AQL */}
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold">
                                            <Scale className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm">Anexo N°1: Pesaje de Bandejas</h4>
                                            <div className="text-xs text-slate-500">Muestreo AQL 6,5 y Tolerancia del 5%</div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Las bandejas se evalúan conforme a la norma militar estándar AQL 6,5 nivel de inspección general I.
                                        Se permite una tolerancia máxima de <strong>5% bajo el gramaje neto</strong> fijado en la Ficha de Estandarización de Preparaciones (FEP).
                                    </p>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Hasta 50 raciones:</span>
                                            <span className="font-bold text-slate-800">3 bandejas de muestra</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">51 a 150 raciones:</span>
                                            <span className="font-bold text-slate-800">5 bandejas de muestra</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">151 a 500 raciones:</span>
                                            <span className="font-bold text-slate-800">8 bandejas de muestra</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">501 a 1.200 raciones:</span>
                                            <span className="font-bold text-slate-800">13 bandejas de muestra</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Anexo N°2: Frutas y Verduras */}
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                                            <Apple className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm">Anexo N°2: Frutas y Verduras</h4>
                                            <div className="text-xs text-slate-500">Tolerancia de defectos en recepción</div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Tolerancias para defectos en frutas y hortalizas frescas según tabla de inspección visual de JUNAEB. Defectos graves (pudrición, hongos, infestación) tienen <strong>tolerancia 0%</strong>.
                                    </p>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Defectos Leves (manchas superficiales):</span>
                                            <span className="font-bold text-slate-800">Hasta 10% de la muestra</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Defectos Moderados (golpes menores):</span>
                                            <span className="font-bold text-slate-800">Hasta 5% de la muestra</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Defectos Graves (descomposición):</span>
                                            <span className="font-bold text-rose-600">0% (Rechazo Inmediato)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Anexo N°3: Pauta de Solución de Incumplimientos */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                <h4 className="font-bold text-slate-800 text-sm">
                                    Anexo N°3: Pauta Oficial para la Solución de Incumplimientos Subsanables
                                </h4>
                                <p className="text-xs text-slate-500">
                                    Medios de verificación estrictamente exigidos para dar por subsanados los hallazgos en los aspectos con Periodo de Corrección = <strong>SI</strong>:
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                                        <div className="font-bold text-cyan-800">Aspecto B: Manual de Recetas</div>
                                        <p className="text-slate-600">
                                            Acta formal firmada por la dirección del colegio o fotografía fechada y georreferenciada demostrando la presencia física o digital del manual en la cocina.
                                        </p>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                                        <div className="font-bold text-cyan-800">Aspecto E: Materias Primas en TPMPAP</div>
                                        <p className="text-slate-600">
                                            Comprobante de ingreso de homologación a JUNAEB o guía de despacho acreditando el retiro y reemplazo del producto por una marca autorizada.
                                        </p>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                                        <div className="font-bold text-cyan-800">Aspecto J: Termómetro y Balanza</div>
                                        <p className="text-slate-600">
                                            Factura/guía de despacho de reposición de equipo operativo y fotografía del equipo en funcionamiento con pilas en la cocina escolar.
                                        </p>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                                        <div className="font-bold text-cyan-800">Aspecto L: EPP y Uniformes</div>
                                        <p className="text-slate-600">
                                            Guía de entrega de vestimenta firmada por la manipuladora y fotografía con el uniforme reglamentario completo en el establecimiento.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Edición de Aspecto */}
            {editingAspect && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in zoom-in-95">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                                    {editingAspect.letra}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base">
                                        Ajustar Aspecto {editingAspect.letra}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Licitación {selectedLic?.licitacionHomologada || selectedLicId}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingAspect(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Descripción del Aspecto (Columna 1):
                                </label>
                                <textarea
                                    rows={2}
                                    value={editForm.aspecto}
                                    onChange={e => setEditForm({ ...editForm, aspecto: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Forma de Evaluar (Columna 2):
                                </label>
                                <textarea
                                    rows={3}
                                    value={editForm.formaEvaluar}
                                    onChange={e => setEditForm({ ...editForm, formaEvaluar: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Medio de Verificación (Columna 4):
                                </label>
                                <textarea
                                    rows={2}
                                    value={editForm.medioVerificacion}
                                    onChange={e => setEditForm({ ...editForm, medioVerificacion: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Consideraciones Específicas (Punto 5.4):
                                </label>
                                <textarea
                                    rows={2}
                                    value={editForm.consideracionesEspecificas}
                                    onChange={e =>
                                        setEditForm({ ...editForm, consideracionesEspecificas: e.target.value })
                                    }
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                />
                            </div>

                            {editingAspect.tienePeriodoCorreccion && (
                                <div>
                                    <label className="block font-bold text-emerald-800 mb-1">
                                        Pauta de Solución (Anexo N°3):
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={editForm.pautaSolucionAnexo3}
                                        onChange={e =>
                                            setEditForm({ ...editForm, pautaSolucionAnexo3: e.target.value })
                                        }
                                        className="w-full p-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-emerald-950"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setEditingAspect(null)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={isSavingEdit}
                                onClick={handleSaveEdit}
                                className="px-4 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl shadow-md shadow-cyan-600/20 flex items-center gap-1.5"
                            >
                                <Save className="w-3.5 h-3.5" />
                                <span>{isSavingEdit ? 'Guardando...' : 'Guardar Ajustes'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

