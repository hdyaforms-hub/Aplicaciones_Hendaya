'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
    ArgumentoBibliotecaDTO,
    crearArgumentoAction,
    editarArgumentoAction,
    eliminarArgumentoAction,
    incrementarUsoArgumentoAction,
    importarArgumentosExcelAction
} from './actions'
import {
    BookOpen,
    Search,
    Filter,
    Plus,
    Copy,
    Check,
    FileSpreadsheet,
    Download,
    Upload,
    Scale,
    TrendingUp,
    BookmarkCheck,
    FileText,
    Tag,
    Trash2,
    Edit3,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Sparkles,
    ShieldCheck
} from 'lucide-react'
import * as XLSX from 'xlsx'

const ASPECTOS_DISPONIBLES = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'O', 'P', 'GENERAL'
]

const RESULTADOS_DISPONIBLES = [
    { value: 'TODOS', label: 'Todos los resultados' },
    { value: 'PLANTILLA_OFICIAL', label: 'Plantilla Oficial' },
    { value: 'ACEPTADO', label: 'Aceptado por JUNAEB' },
    { value: 'PARCIAL', label: 'Aceptado Parcialmente' },
    { value: 'RECHAZADO', label: 'Rechazado' }
]

interface Props {
    argumentosIniciales: ArgumentoBibliotecaDTO[]
    canManage: boolean
    userName: string
}

export default function BibliotecaArgumentosClient({
    argumentosIniciales,
    canManage,
    userName
}: Props) {
    const [argumentos, setArgumentos] = useState<ArgumentoBibliotecaDTO[]>(argumentosIniciales)
    const [isPending, startTransition] = useTransition()

    // Filtros
    const [search, setSearch] = useState('')
    const [selectedAspecto, setSelectedAspecto] = useState('TODOS')
    const [selectedResultado, setSelectedResultado] = useState('TODOS')
    const [selectedTipo, setSelectedTipo] = useState<'TODOS' | 'PLANTILLAS' | 'PRECEDENTES'>('TODOS')

    // Feedback
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [mensajeFeedback, setMensajeFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
    const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})

    // Modales
    const [modalCrearOpen, setModalCrearOpen] = useState(false)
    const [modalEditarOpen, setModalEditarOpen] = useState(false)
    const [modalImportarOpen, setModalImportarOpen] = useState(false)
    const [argumentoSeleccionado, setArgumentoSeleccionado] = useState<ArgumentoBibliotecaDTO | null>(null)

    // Form states
    const [formAspecto, setFormAspecto] = useState('G')
    const [formReglaId, setFormReglaId] = useState('')
    const [formTitulo, setFormTitulo] = useState('')
    const [formTexto, setFormTexto] = useState('')
    const [formFundamento, setFormFundamento] = useState('')
    const [formFolio, setFormFolio] = useState('')
    const [formRex, setFormRex] = useState('')
    const [formResultado, setFormResultado] = useState<'ACEPTADO' | 'PARCIAL' | 'RECHAZADO' | 'PLANTILLA_OFICIAL'>('ACEPTADO')
    const [formMontoUtm, setFormMontoUtm] = useState('0')
    const [formEtiquetas, setFormEtiquetas] = useState('')
    const [formEsPlantilla, setFormEsPlantilla] = useState(false)
    const [importFile, setImportFile] = useState<File | null>(null)

    // Estadísticas
    const stats = useMemo(() => {
        const total = argumentos.length
        const plantillas = argumentos.filter(a => a.esPlantillaOficial).length
        const aceptados = argumentos.filter(a => a.resultadoHistorico === 'ACEPTADO' || a.resultadoHistorico === 'PLANTILLA_OFICIAL').length
        const utmRebajada = argumentos.reduce((acc, curr) => acc + (curr.montoRebajadoUtm || 0), 0)
        const usosTotales = argumentos.reduce((acc, curr) => acc + (curr.vecesUtilizado || 0), 0)

        return {
            total,
            plantillas,
            tasaExito: total > 0 ? Math.round((aceptados / total) * 100) : 0,
            utmRebajada: utmRebajada.toFixed(1),
            usosTotales
        }
    }, [argumentos])

    // Filtrado interactivo
    const argumentosFiltrados = useMemo(() => {
        return argumentos.filter(item => {
            if (selectedAspecto !== 'TODOS' && item.aspecto !== selectedAspecto) return false
            if (selectedResultado !== 'TODOS' && item.resultadoHistorico !== selectedResultado) return false
            if (selectedTipo === 'PLANTILLAS' && !item.esPlantillaOficial) return false
            if (selectedTipo === 'PRECEDENTES' && item.esPlantillaOficial) return false

            if (search.trim()) {
                const s = search.toLowerCase()
                const matchTitulo = item.titulo.toLowerCase().includes(s)
                const matchTexto = item.argumentoTexto.toLowerCase().includes(s)
                const matchFundamento = (item.fundamentoLegal || '').toLowerCase().includes(s)
                const matchTags = (item.etiquetas || '').toLowerCase().includes(s)
                const matchFolio = (item.folioEjemplo || '').toLowerCase().includes(s)
                const matchRex = (item.numeroRexPrecedente || '').toLowerCase().includes(s)
                if (!matchTitulo && !matchTexto && !matchFundamento && !matchTags && !matchFolio && !matchRex) {
                    return false
                }
            }

            return true
        })
    }, [argumentos, selectedAspecto, selectedResultado, selectedTipo, search])

    const handleCopiar = async (arg: ArgumentoBibliotecaDTO) => {
        try {
            let textoACopiar = `${arg.titulo}\n\n${arg.argumentoTexto}`
            if (arg.fundamentoLegal) {
                textoACopiar += `\n\nFundamento Legal / Normativo: ${arg.fundamentoLegal}`
            }
            if (arg.numeroRexPrecedente) {
                textoACopiar += `\nPrecedente REX: ${arg.numeroRexPrecedente}`
            }

            await navigator.clipboard.writeText(textoACopiar)
            setCopiedId(arg.id)
            setTimeout(() => setCopiedId(null), 2500)

            // Registrar incremento de uso de forma no bloqueante
            incrementarUsoArgumentoAction(arg.id).then(res => {
                if (res.success && res.nuevoTotal !== undefined) {
                    setArgumentos(prev =>
                        prev.map(a => (a.id === arg.id ? { ...a, vecesUtilizado: res.nuevoTotal! } : a))
                    )
                }
            })
        } catch (err) {
            console.error('Error al copiar al portapapeles:', err)
        }
    }

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }))
    }

    const resetForm = () => {
        setFormAspecto('G')
        setFormReglaId('')
        setFormTitulo('')
        setFormTexto('')
        setFormFundamento('')
        setFormFolio('')
        setFormRex('')
        setFormResultado('ACEPTADO')
        setFormMontoUtm('0')
        setFormEtiquetas('')
        setFormEsPlantilla(false)
        setArgumentoSeleccionado(null)
    }

    const openCrearModal = () => {
        resetForm()
        setModalCrearOpen(true)
    }

    const openEditarModal = (arg: ArgumentoBibliotecaDTO) => {
        setArgumentoSeleccionado(arg)
        setFormAspecto(arg.aspecto)
        setFormReglaId(arg.reglaId || '')
        setFormTitulo(arg.titulo)
        setFormTexto(arg.argumentoTexto)
        setFormFundamento(arg.fundamentoLegal || '')
        setFormFolio(arg.folioEjemplo || '')
        setFormRex(arg.numeroRexPrecedente || '')
        setFormResultado(arg.resultadoHistorico)
        setFormMontoUtm(String(arg.montoRebajadoUtm || 0))
        setFormEtiquetas(arg.etiquetas || '')
        setFormEsPlantilla(arg.esPlantillaOficial)
        setModalEditarOpen(true)
    }

    const handleCrear = () => {
        if (!formTitulo.trim() || !formTexto.trim()) {
            setMensajeFeedback({ tipo: 'error', texto: 'Título y texto del argumento son obligatorios' })
            return
        }

        startTransition(async () => {
            const res = await crearArgumentoAction({
                aspecto: formAspecto,
                reglaId: formReglaId.trim() || undefined,
                titulo: formTitulo.trim(),
                argumentoTexto: formTexto.trim(),
                fundamentoLegal: formFundamento.trim() || undefined,
                folioEjemplo: formFolio.trim() || undefined,
                numeroRexPrecedente: formRex.trim() || undefined,
                resultadoHistorico: formResultado,
                montoRebajadoUtm: parseFloat(formMontoUtm) || 0,
                etiquetas: formEtiquetas.trim() || undefined,
                esPlantillaOficial: formEsPlantilla
            })

            if (res.success && res.data) {
                setArgumentos(prev => [res.data!, ...prev])
                setModalCrearOpen(false)
                resetForm()
                setMensajeFeedback({ tipo: 'success', texto: 'Argumento agregado exitosamente a la biblioteca.' })
            } else {
                setMensajeFeedback({ tipo: 'error', texto: res.error || 'Error al guardar argumento' })
            }
        })
    }

    const handleEditar = () => {
        if (!argumentoSeleccionado) return

        startTransition(async () => {
            const res = await editarArgumentoAction(argumentoSeleccionado.id, {
                aspecto: formAspecto,
                reglaId: formReglaId.trim() || null,
                titulo: formTitulo.trim(),
                argumentoTexto: formTexto.trim(),
                fundamentoLegal: formFundamento.trim() || null,
                folioEjemplo: formFolio.trim() || null,
                numeroRexPrecedente: formRex.trim() || null,
                resultadoHistorico: formResultado,
                montoRebajadoUtm: parseFloat(formMontoUtm) || 0,
                etiquetas: formEtiquetas.trim() || null,
                esPlantillaOficial: formEsPlantilla
            })

            if (res.success) {
                setArgumentos(prev =>
                    prev.map(a =>
                        a.id === argumentoSeleccionado.id
                            ? {
                                  ...a,
                                  aspecto: formAspecto,
                                  reglaId: formReglaId.trim() || null,
                                  titulo: formTitulo.trim(),
                                  argumentoTexto: formTexto.trim(),
                                  fundamentoLegal: formFundamento.trim() || null,
                                  folioEjemplo: formFolio.trim() || null,
                                  numeroRexPrecedente: formRex.trim() || null,
                                  resultadoHistorico: formResultado,
                                  montoRebajadoUtm: parseFloat(formMontoUtm) || 0,
                                  etiquetas: formEtiquetas.trim() || null,
                                  esPlantillaOficial: formEsPlantilla
                              }
                            : a
                    )
                )
                setModalEditarOpen(false)
                resetForm()
                setMensajeFeedback({ tipo: 'success', texto: 'Argumento actualizado con éxito.' })
            } else {
                setMensajeFeedback({ tipo: 'error', texto: res.error || 'Error al actualizar argumento' })
            }
        })
    }

    const handleEliminar = (id: string, titulo: string) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar de la biblioteca el argumento:\n"${titulo}"?`)) {
            return
        }

        startTransition(async () => {
            const res = await eliminarArgumentoAction(id)
            if (res.success) {
                setArgumentos(prev => prev.filter(a => a.id !== id))
                setMensajeFeedback({ tipo: 'success', texto: 'Argumento eliminado de la biblioteca.' })
            } else {
                setMensajeFeedback({ tipo: 'error', texto: res.error || 'Error al eliminar' })
            }
        })
    }

    const handleImportarExcel = () => {
        if (!importFile) {
            setMensajeFeedback({ tipo: 'error', texto: 'Selecciona un archivo Excel (.xlsx)' })
            return
        }

        startTransition(async () => {
            const fd = new FormData()
            fd.append('file', importFile)
            const res = await importarArgumentosExcelAction(fd)

            if (res.success) {
                setModalImportarOpen(false)
                setImportFile(null)
                setMensajeFeedback({
                    tipo: 'success',
                    texto: `Se importaron ${res.importados} argumentos correctamente.`
                })
                // Recargar ventana tras breve espera
                setTimeout(() => window.location.reload(), 1500)
            } else {
                setMensajeFeedback({ tipo: 'error', texto: res.error || 'Error al importar archivo' })
            }
        })
    }

    const descargarPlantillaExcel = () => {
        const plantilla = [
            {
                'Aspecto': 'G',
                'Regla': 'G-MUESTRA-1',
                'Titulo': 'Muestra insuficiente en pesaje AQL',
                'Argumento': 'El fiscalizador controló menos bandejas que las requeridas por la tabla de muestreo normativo...',
                'Fundamento Legal': 'Instrucción de Trabajo EE, Anexo NCh 44',
                'Folio Ejemplo': '1048592',
                'Numero REX': 'REX 1420/2025',
                'Resultado': 'ACEPTADO',
                'Monto Rebajado UTM': 12.5,
                'Etiquetas': 'gramaje, pesaje, aql',
                'Es Plantilla': 'SI'
            }
        ]

        const ws = XLSX.utils.json_to_sheet(plantilla)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Descargos')
        XLSX.writeFile(wb, 'plantilla_biblioteca_argumentos_hendaya.xlsx')
    }

    return (
        <div className="space-y-6">
            {/* Notificación de feedback */}
            {mensajeFeedback && (
                <div
                    className={`p-4 rounded-xl flex items-center justify-between shadow-md transition-all ${
                        mensajeFeedback.tipo === 'success'
                            ? 'bg-emerald-900/30 border border-emerald-500/40 text-emerald-300'
                            : 'bg-rose-900/30 border border-rose-500/40 text-rose-300'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {mensajeFeedback.tipo === 'success' ? (
                            <Check className="w-5 h-5 text-emerald-400" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-rose-400" />
                        )}
                        <span>{mensajeFeedback.texto}</span>
                    </div>
                    <button
                        onClick={() => setMensajeFeedback(null)}
                        className="text-xs opacity-75 hover:opacity-100 underline ml-4"
                    >
                        Cerrar
                    </button>
                </div>
            )}

            {/* Encabezado y Estadísticas Clave */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-medium">Total Argumentos</p>
                        <h4 className="text-2xl font-bold text-white">{stats.total}</h4>
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-medium">Plantillas Oficiales</p>
                        <h4 className="text-2xl font-bold text-indigo-300">{stats.plantillas}</h4>
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Scale className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-medium">Tasa de Aceptación</p>
                        <h4 className="text-2xl font-bold text-emerald-400">{stats.tasaExito}%</h4>
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-medium">UTM Rebajadas Hist.</p>
                        <h4 className="text-2xl font-bold text-amber-300">{stats.utmRebajada}</h4>
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                        <BookmarkCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-medium">Reutilizaciones</p>
                        <h4 className="text-2xl font-bold text-purple-300">{stats.usosTotales}</h4>
                    </div>
                </div>
            </div>

            {/* Barra de Acciones y Filtros */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Buscador */}
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por título, texto, norma legal, REX, etiqueta o folio..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                    </div>

                    {/* Botones de acción principal */}
                    <div className="flex items-center gap-2">
                        {canManage && (
                            <>
                                <button
                                    onClick={() => setModalImportarOpen(true)}
                                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-2 border border-slate-700 transition-colors shadow-sm"
                                    title="Importar catálogo desde Excel"
                                >
                                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>Importar Excel</span>
                                </button>
                                <button
                                    onClick={openCrearModal}
                                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-cyan-950/40 transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Nuevo Argumento</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Filtros secundarios */}
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-800/60">
                    <div>
                        <label className="text-[11px] font-medium text-slate-400 block mb-1">Aspecto / Multa</label>
                        <select
                            value={selectedAspecto}
                            onChange={e => setSelectedAspecto(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-950/60 border border-slate-700/60 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                        >
                            <option value="TODOS">Todos los Aspectos</option>
                            {ASPECTOS_DISPONIBLES.map(asp => (
                                <option key={asp} value={asp}>
                                    Aspecto {asp}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[11px] font-medium text-slate-400 block mb-1">Tipo de Entrada</label>
                        <select
                            value={selectedTipo}
                            onChange={e => setSelectedTipo(e.target.value as any)}
                            className="w-full px-3 py-1.5 bg-slate-950/60 border border-slate-700/60 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                        >
                            <option value="TODOS">Todas las Entradas</option>
                            <option value="PLANTILLAS">Solo Plantillas Oficiales</option>
                            <option value="PRECEDENTES">Solo Precedentes Reales</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[11px] font-medium text-slate-400 block mb-1">Resultado Precedente</label>
                        <select
                            value={selectedResultado}
                            onChange={e => setSelectedResultado(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-950/60 border border-slate-700/60 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                        >
                            {RESULTADOS_DISPONIBLES.map(r => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-end">
                        <span className="text-xs text-slate-400 py-1.5">
                            Mostrando <strong className="text-cyan-400">{argumentosFiltrados.length}</strong> de {argumentos.length} argumentos
                        </span>
                    </div>
                </div>
            </div>

            {/* Listado de Tarjetas de Argumentos */}
            {argumentosFiltrados.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                    <BookOpen className="w-12 h-12 text-slate-600 mx-auto" />
                    <h3 className="text-base font-semibold text-slate-300">No se encontraron argumentos con los filtros aplicados</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Intenta ajustar la búsqueda, cambiar el filtro de aspecto o agrega un nuevo precedente o plantilla jurídica oficial.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {argumentosFiltrados.map(arg => {
                        const isExpanded = !!expandedIds[arg.id]
                        const isCopied = copiedId === arg.id

                        let badgeResultado = (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                {arg.resultadoHistorico}
                            </span>
                        )
                        if (arg.esPlantillaOficial) {
                            badgeResultado = (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-indigo-400" />
                                    Plantilla Oficial
                                </span>
                            )
                        } else if (arg.resultadoHistorico === 'ACEPTADO') {
                            badgeResultado = (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    Aceptado
                                </span>
                            )
                        } else if (arg.resultadoHistorico === 'PARCIAL') {
                            badgeResultado = (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/60">
                                    Parcial
                                </span>
                            )
                        } else if (arg.resultadoHistorico === 'RECHAZADO') {
                            badgeResultado = (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-700/60">
                                    Rechazado
                                </span>
                            )
                        }

                        return (
                            <div
                                key={arg.id}
                                className="bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all hover:shadow-lg hover:shadow-cyan-950/20"
                            >
                                <div className="space-y-3">
                                    {/* Encabezado de la Tarjeta */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-700/50">
                                                Aspecto {arg.aspecto}
                                            </span>
                                            {arg.reglaId && (
                                                <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                                                    {arg.reglaId}
                                                </span>
                                            )}
                                            {badgeResultado}
                                        </div>

                                        {arg.montoRebajadoUtm > 0 && (
                                            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-800/40">
                                                Rebajó {arg.montoRebajadoUtm} UTM
                                            </span>
                                        )}
                                    </div>

                                    {/* Título */}
                                    <h4 className="text-sm font-bold text-slate-100 leading-snug">{arg.titulo}</h4>

                                    {/* Texto del Argumento */}
                                    <div className="relative">
                                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-950/50 p-3 rounded-xl border border-slate-800/70 font-sans">
                                            {isExpanded
                                                ? arg.argumentoTexto
                                                : arg.argumentoTexto.length > 220
                                                ? `${arg.argumentoTexto.slice(0, 220)}...`
                                                : arg.argumentoTexto}
                                        </p>
                                        {arg.argumentoTexto.length > 220 && (
                                            <button
                                                onClick={() => toggleExpand(arg.id)}
                                                className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-1.5"
                                            >
                                                {isExpanded ? (
                                                    <>
                                                        <ChevronUp className="w-3.5 h-3.5" /> Ver menos
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronDown className="w-3.5 h-3.5" /> Ver argumento completo
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Fundamento Legal */}
                                    {arg.fundamentoLegal && (
                                        <div className="text-[11px] text-slate-400 flex items-start gap-1.5 bg-slate-900/90 p-2 rounded-lg border border-slate-800/60">
                                            <Scale className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                                            <span>
                                                <strong className="text-slate-300">Base Normativa:</strong>{' '}
                                                {arg.fundamentoLegal}
                                            </span>
                                        </div>
                                    )}

                                    {/* Precedente Folio / REX */}
                                    {(arg.folioEjemplo || arg.numeroRexPrecedente) && (
                                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                                            {arg.folioEjemplo && (
                                                <span>
                                                    Folio ref: <strong className="text-slate-300">#{arg.folioEjemplo}</strong>
                                                </span>
                                            )}
                                            {arg.numeroRexPrecedente && (
                                                <span>
                                                    Resolución: <strong className="text-slate-300">{arg.numeroRexPrecedente}</strong>
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Etiquetas */}
                                    {arg.etiquetas && (
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {arg.etiquetas.split(',').map((tag, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2 py-0.5 rounded-md text-[10px] bg-slate-800/80 text-slate-400 border border-slate-700/50 flex items-center gap-1"
                                                >
                                                    <Tag className="w-2.5 h-2.5 text-slate-500" />
                                                    {tag.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Pie de la Tarjeta y Acciones */}
                                <div className="pt-3 border-t border-slate-800/70 flex items-center justify-between text-xs text-slate-400">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[11px] text-slate-500">
                                            Usado <strong className="text-slate-300">{arg.vecesUtilizado}</strong> veces
                                        </span>
                                        <span className="text-[11px] text-slate-500">
                                            Por: {arg.autor}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        {/* Botón Copiar */}
                                        <button
                                            onClick={() => handleCopiar(arg)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                                isCopied
                                                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                                                    : 'bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-300 border border-cyan-800/50'
                                            }`}
                                            title="Copiar texto del argumento al portapapeles"
                                        >
                                            {isCopied ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5" />
                                                    <span>¡Copiado!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3.5 h-3.5" />
                                                    <span>Copiar</span>
                                                </>
                                            )}
                                        </button>

                                        {canManage && (
                                            <>
                                                <button
                                                    onClick={() => openEditarModal(arg)}
                                                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                                                    title="Editar este argumento"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleEliminar(arg.id, arg.titulo)}
                                                    className="p-1.5 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                                                    title="Eliminar este argumento"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Modal: Crear / Editar Argumento */}
            {(modalCrearOpen || modalEditarOpen) && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-cyan-400" />
                                {modalCrearOpen ? 'Nuevo Argumento / Precedente' : 'Editar Argumento'}
                            </h3>
                            <button
                                onClick={() => {
                                    setModalCrearOpen(false)
                                    setModalEditarOpen(false)
                                    resetForm()
                                }}
                                className="text-slate-400 hover:text-white text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-slate-400 font-medium block mb-1">Aspecto Sancionado *</label>
                                    <select
                                        value={formAspecto}
                                        onChange={e => setFormAspecto(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                                    >
                                        {ASPECTOS_DISPONIBLES.map(asp => (
                                            <option key={asp} value={asp}>
                                                Aspecto {asp}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-slate-400 font-medium block mb-1">Regla NC / Criterio (opcional)</label>
                                    <input
                                        type="text"
                                        value={formReglaId}
                                        onChange={e => setFormReglaId(e.target.value)}
                                        placeholder="Ej: G-MUESTRA-1, B-DOT-2, etc."
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-slate-400 font-medium block mb-1">Título del Argumento *</label>
                                <input
                                    type="text"
                                    value={formTitulo}
                                    onChange={e => setFormTitulo(e.target.value)}
                                    placeholder="Ej: Muestra insuficiente según tabla de muestreo AQL"
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                                />
                            </div>

                            <div>
                                <label className="text-slate-400 font-medium block mb-1">Texto Redactado del Descargo *</label>
                                <textarea
                                    rows={5}
                                    value={formTexto}
                                    onChange={e => setFormTexto(e.target.value)}
                                    placeholder="Redacta la argumentación jurídica y fáctica formal lista para incorporar al descargo..."
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 leading-relaxed font-sans"
                                />
                            </div>

                            <div>
                                <label className="text-slate-400 font-medium block mb-1">Fundamento Legal / Normativo</label>
                                <input
                                    type="text"
                                    value={formFundamento}
                                    onChange={e => setFormFundamento(e.target.value)}
                                    placeholder="Ej: Instrucción de Trabajo Elementos Esenciales JUNAEB, Anexo 3 NCh 44"
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-slate-400 font-medium block mb-1">Folio Ejemplo</label>
                                    <input
                                        type="text"
                                        value={formFolio}
                                        onChange={e => setFormFolio(e.target.value)}
                                        placeholder="Ej: 1045920"
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                                    />
                                </div>

                                <div>
                                    <label className="text-slate-400 font-medium block mb-1">N° REX Precedente</label>
                                    <input
                                        type="text"
                                        value={formRex}
                                        onChange={e => setFormRex(e.target.value)}
                                        placeholder="Ej: REX 1420/2025"
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                                    />
                                </div>

                                <div>
                                    <label className="text-slate-400 font-medium block mb-1">Rebaja Histórica (UTM)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formMontoUtm}
                                        onChange={e => setFormMontoUtm(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-slate-400 font-medium block mb-1">Resultado Precedente</label>
                                    <select
                                        value={formResultado}
                                        onChange={e => setFormResultado(e.target.value as any)}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                                    >
                                        <option value="ACEPTADO">Aceptado por JUNAEB</option>
                                        <option value="PARCIAL">Aceptado Parcialmente</option>
                                        <option value="RECHAZADO">Rechazado</option>
                                        <option value="PLANTILLA_OFICIAL">Plantilla Oficial</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-slate-400 font-medium block mb-1">Etiquetas (separadas por coma)</label>
                                    <input
                                        type="text"
                                        value={formEtiquetas}
                                        onChange={e => setFormEtiquetas(e.target.value)}
                                        placeholder="pesaje, balanza, aql, fuerza mayor"
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formEsPlantilla}
                                        onChange={e => setFormEsPlantilla(e.target.checked)}
                                        className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                                    />
                                    <span className="text-slate-300 font-medium">
                                        Marcar como Plantilla Jurídica Oficial Hendaya
                                    </span>
                                </label>
                                <p className="text-[11px] text-slate-500 ml-6">
                                    Las plantillas oficiales se destacan prioritariamente y se sugieren automáticamente al redactar descargos.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                            <button
                                onClick={() => {
                                    setModalCrearOpen(false)
                                    setModalEditarOpen(false)
                                    resetForm()
                                }}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={modalCrearOpen ? handleCrear : handleEditar}
                                disabled={isPending}
                                className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-950/40 disabled:opacity-50"
                            >
                                {isPending ? 'Guardando...' : modalCrearOpen ? 'Crear Argumento' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Importar desde Excel */}
            {modalImportarOpen && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                                Importar Argumentos desde Excel
                            </h3>
                            <button
                                onClick={() => setModalImportarOpen(false)}
                                className="text-slate-400 hover:text-white text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            <p className="text-slate-300 leading-relaxed">
                                Sube una planilla Excel (.xlsx) con los argumentos y precedentes. El sistema leerá automáticamente la hoja <strong>Descargos</strong> o la primera hoja.
                            </p>

                            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-slate-200">¿No tienes el formato?</p>
                                    <p className="text-[11px] text-slate-400">Descarga la plantilla oficial con encabezados preconfigurados.</p>
                                </div>
                                <button
                                    onClick={descargarPlantillaExcel}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Plantilla
                                </button>
                            </div>

                            <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center space-y-2 hover:border-cyan-500 transition-colors">
                                <Upload className="w-8 h-8 text-slate-500 mx-auto" />
                                <p className="text-slate-300 font-medium">Selecciona el archivo Excel</p>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={e => setImportFile(e.target.files?.[0] || null)}
                                    className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-cyan-900/50 file:text-cyan-300 file:text-xs file:font-semibold hover:file:bg-cyan-800/50"
                                />
                                {importFile && (
                                    <p className="text-[11px] text-cyan-400 font-semibold mt-2">
                                        Archivo: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                            <button
                                onClick={() => setModalImportarOpen(false)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleImportarExcel}
                                disabled={isPending || !importFile}
                                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/40 disabled:opacity-50"
                            >
                                {isPending ? 'Importando...' : 'Iniciar Importación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
