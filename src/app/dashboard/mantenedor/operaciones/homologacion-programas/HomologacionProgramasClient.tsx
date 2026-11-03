'use client'

import React, { useState, useMemo, useTransition } from 'react'
import {
    ProgramasHomologacionItemDTO,
    getProgramasHomologacionAction,
    guardarHomologacionAction,
    guardarHomologacionesMasivasAction
} from './actions'
import {
    Building2,
    Search,
    RefreshCw,
    Save,
    CheckCircle2,
    AlertCircle,
    Info,
    Sparkles,
    Check,
    Filter,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    FileSpreadsheet,
    Layers,
    Tag
} from 'lucide-react'

interface Props {
    initialItems: ProgramasHomologacionItemDTO[]
    isRestricted: boolean
    allowedRbdsCount: number
    resumen: {
        totalItems: number
        totalHomologados: number
        totalPendientes: number
    }
}

export default function HomologacionProgramasClient({
    initialItems,
    isRestricted,
    allowedRbdsCount,
    resumen: initialResumen
}: Props) {
    const [items, setItems] = useState<ProgramasHomologacionItemDTO[]>(initialItems)
    const [editedCodes, setEditedCodes] = useState<Record<string, string>>({})
    const [savingRowKey, setSavingRowKey] = useState<string | null>(null)
    const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({})
    const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
    const [isPending, startTransition] = useTransition()

    // Filtros y Búsqueda
    const [search, setSearch] = useState('')
    const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'HOMOLOGADOS' | 'PENDIENTES'>('TODOS')
    const [pagina, setPagina] = useState(1)
    const [pageSize, setPageSize] = useState(15)

    const getRowKey = (item: { programaPmpa: string; servicioPmpa: string }) =>
        `${item.programaPmpa.trim().toUpperCase()}:::${(item.servicioPmpa || '').trim().toUpperCase()}`

    // Resumen reactivo considerando ediciones pendientes
    const resumen = useMemo(() => {
        let homologados = 0
        for (const item of items) {
            const key = getRowKey(item)
            const valorActual = editedCodes[key] !== undefined ? editedCodes[key] : item.codigoHomologado
            if (valorActual && valorActual.trim().length > 0) {
                homologados++
            }
        }
        return {
            totalItems: items.length,
            totalHomologados: homologados,
            totalPendientes: Math.max(0, items.length - homologados)
        }
    }, [items, editedCodes])

    // Filtrado de items
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const key = getRowKey(item)
            const codHomologado = (editedCodes[key] !== undefined ? editedCodes[key] : item.codigoHomologado).trim()
            const isHomologado = codHomologado.length > 0

            if (filtroEstado === 'HOMOLOGADOS' && !isHomologado) return false
            if (filtroEstado === 'PENDIENTES' && isHomologado) return false

            if (!search.trim()) return true
            const term = search.toLowerCase()
            return (
                item.programaPmpa.toLowerCase().includes(term) ||
                (item.servicioPmpa && item.servicioPmpa.toLowerCase().includes(term)) ||
                codHomologado.toLowerCase().includes(term)
            )
        })
    }, [items, editedCodes, search, filtroEstado])

    const totalPages = Math.ceil(filteredItems.length / pageSize) || 1
    const paginatedItems = useMemo(() => {
        const start = (pagina - 1) * pageSize
        return filteredItems.slice(start, start + pageSize)
    }, [filteredItems, pagina, pageSize])

    const totalModificados = Object.keys(editedCodes).length

    const handleInputChange = (item: ProgramasHomologacionItemDTO, nuevoValor: string) => {
        const key = getRowKey(item)
        if (nuevoValor === item.codigoHomologado) {
            setEditedCodes(prev => {
                const next = { ...prev }
                delete next[key]
                return next
            })
        } else {
            setEditedCodes(prev => ({ ...prev, [key]: nuevoValor }))
        }
    }

    const handleSaveRow = async (item: ProgramasHomologacionItemDTO) => {
        const key = getRowKey(item)
        const nuevoCodigo = (editedCodes[key] !== undefined ? editedCodes[key] : item.codigoHomologado).trim()

        setSavingRowKey(key)
        try {
            const res = await guardarHomologacionAction({
                programaPmpa: item.programaPmpa,
                servicioPmpa: item.servicioPmpa,
                codigoHomologado: nuevoCodigo
            })

            if (res.success) {
                setItems(prev =>
                    prev.map(it =>
                        getRowKey(it) === key
                            ? {
                                  ...it,
                                  id: res.id || it.id,
                                  codigoHomologado: nuevoCodigo,
                                  actualizadoPor: 'Tú',
                                  actualizadoAt: new Date().toISOString()
                              }
                            : it
                    )
                )
                setEditedCodes(prev => {
                    const next = { ...prev }
                    delete next[key]
                    return next
                })
                setSavedStatus(prev => ({ ...prev, [key]: true }))
                setTimeout(() => {
                    setSavedStatus(prev => {
                        const copy = { ...prev }
                        delete copy[key]
                        return copy
                    })
                }, 2500)
            } else {
                setFeedback({ tipo: 'error', texto: res.error || 'Error al guardar la homologación' })
            }
        } catch (err: any) {
            setFeedback({ tipo: 'error', texto: err?.message || 'Error de comunicación' })
        } finally {
            setSavingRowKey(null)
        }
    }

    const handleSaveAll = async () => {
        const entriesToSave = Object.entries(editedCodes).map(([key, val]) => {
            const [prog, serv] = key.split(':::')
            return {
                programaPmpa: prog,
                servicioPmpa: serv,
                codigoHomologado: val.trim()
            }
        })

        if (entriesToSave.length === 0) return

        startTransition(async () => {
            const res = await guardarHomologacionesMasivasAction(entriesToSave)
            if (res.success) {
                setItems(prev =>
                    prev.map(it => {
                        const key = getRowKey(it)
                        if (editedCodes[key] !== undefined) {
                            return {
                                ...it,
                                codigoHomologado: editedCodes[key].trim(),
                                actualizadoPor: 'Tú',
                                actualizadoAt: new Date().toISOString()
                            }
                        }
                        return it
                    })
                )
                setEditedCodes({})
                setFeedback({
                    tipo: 'success',
                    texto: `Se guardaron ${res.guardadosCount} homologaciones correctamente.`
                })
                setTimeout(() => setFeedback(null), 4000)
            } else {
                setFeedback({ tipo: 'error', texto: res.error || 'Error al guardar cambios masivos' })
            }
        })
    }

    const handleRefresh = () => {
        startTransition(async () => {
            const res = await getProgramasHomologacionAction()
            if (res.success) {
                setItems(res.data)
                setEditedCodes({})
                setFeedback({ tipo: 'success', texto: 'Datos actualizados desde el PMPA.' })
                setTimeout(() => setFeedback(null), 2500)
            } else {
                setFeedback({ tipo: 'error', texto: res.error || 'Error al refrescar datos' })
            }
        })
    }

    const formatServicioLabel = (servicio: string) => {
        if (!servicio) return 'General'
        const s = servicio.toUpperCase()
        if (s === 'D' || s === 'DP') return 'Desayuno (D)'
        if (s === 'A' || s === 'AP') return 'Almuerzo (A)'
        if (s === 'O' || s === 'OP') return 'Once (O)'
        if (s === 'CO' || s === 'CP') return 'Colación (CO)'
        if (s === 'C') return 'Cena (C)'
        if (s === 'T') return 'Tercer Servicio (T)'
        return servicio
    }

    const pctAvance = resumen.totalItems > 0 ? Math.round((resumen.totalHomologados / resumen.totalItems) * 100) : 0

    return (
        <div className="space-y-6">
            {/* Header Corporativo Hendaya */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-xs border border-slate-200/90">
                <div>
                    <div className="flex items-center gap-2 text-cyan-700 font-bold text-xs tracking-wider uppercase mb-1">
                        <Tag className="w-4 h-4" />
                        <span>Mantenedor · Operaciones</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        Homologación de Programas
                        <span className="text-xs px-2.5 py-1 bg-cyan-50 text-cyan-800 border border-cyan-200 rounded-full font-bold">
                            PMPA
                        </span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
                        Estandarización y equivalencia de programas y servicios presentes en las cargas masivas del PMPA para el módulo de Auditoría de Raciones.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {totalModificados > 0 && (
                        <button
                            type="button"
                            onClick={handleSaveAll}
                            disabled={isPending}
                            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-cyan-600/20"
                        >
                            <Save className="w-4 h-4" />
                            <span>Guardar ({totalModificados} pendientes)</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold transition-colors shadow-xs"
                        title="Refrescar datos desde PMPA"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-cyan-600' : 'text-slate-500'}`} />
                        <span>Refrescar</span>
                    </button>
                </div>
            </div>

            {/* Aviso de restricción de RBDs */}
            {isRestricted && (
                <div className="flex items-center gap-2.5 p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl text-amber-800 text-xs shadow-xs">
                    <Info className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                        Acceso filtrado por perfil: Visualizando programas y servicios correspondientes a tus <strong>{allowedRbdsCount}</strong> colegios autorizados.
                    </span>
                </div>
            )}

            {/* Alerta de Feedback */}
            {feedback && (
                <div
                    className={`p-3.5 rounded-2xl border flex items-center gap-2.5 text-xs font-semibold ${
                        feedback.tipo === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    {feedback.tipo === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{feedback.texto}</span>
                </div>
            )}

            {/* Tarjetas de Métricas / KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        Total Programas / Servicios PMPA
                    </span>
                    <p className="text-2xl font-black text-slate-900 mt-1">{resumen.totalItems.toLocaleString('es-CL')}</p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Combinaciones únicas detectadas</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                            Programas Homologados
                        </span>
                        <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {pctAvance}%
                        </span>
                    </div>
                    <p className="text-2xl font-black text-emerald-800 mt-1">{resumen.totalHomologados.toLocaleString('es-CL')}</p>
                    <div className="w-full bg-emerald-50 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${pctAvance}%` }} />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-xs">
                    <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                        Pendientes de Homologar
                    </span>
                    <p className="text-2xl font-black text-amber-800 mt-1">{resumen.totalPendientes.toLocaleString('es-CL')}</p>
                    <span className="text-[10px] text-amber-600 font-medium mt-0.5 block">
                        {resumen.totalPendientes === 0 ? '✓ Todos los programas homologados' : 'Requieren código estándar'}
                    </span>
                </div>
            </div>

            {/* Barra de Búsqueda y Filtros */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-96">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => {
                            setSearch(e.target.value)
                            setPagina(1)
                        }}
                        placeholder="Buscar por programa, servicio o código..."
                        className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
                        <button
                            type="button"
                            onClick={() => {
                                setFiltroEstado('TODOS')
                                setPagina(1)
                            }}
                            className={`px-3 py-1 rounded-lg font-bold transition-all ${
                                filtroEstado === 'TODOS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Todos ({items.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setFiltroEstado('HOMOLOGADOS')
                                setPagina(1)
                            }}
                            className={`px-3 py-1 rounded-lg font-bold transition-all ${
                                filtroEstado === 'HOMOLOGADOS' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Homologados ({resumen.totalHomologados})
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setFiltroEstado('PENDIENTES')
                                setPagina(1)
                            }}
                            className={`px-3 py-1 rounded-lg font-bold transition-all ${
                                filtroEstado === 'PENDIENTES' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Pendientes ({resumen.totalPendientes})
                        </button>
                    </div>
                </div>
            </div>

            {/* TABLA DE 2 COLUMNAS PRINCIPALES */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                                <th className="py-3 px-4 w-1/2">
                                    <div className="flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-cyan-600" />
                                        <span>Columna 1: Programa y Servicio PMPA</span>
                                    </div>
                                </th>
                                <th className="py-3 px-4 w-1/2">
                                    <div className="flex items-center gap-2">
                                        <Tag className="w-4 h-4 text-cyan-600" />
                                        <span>Columna 2: Código Homologado (Estandarizado)</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {paginatedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={2} className="py-12 text-center text-slate-400">
                                        <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                        <p className="font-bold text-slate-700">No se encontraron registros de programas</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            No hay registros que coincidan con la búsqueda o no existen cargas de PMPA aún.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedItems.map(item => {
                                    const key = getRowKey(item)
                                    const currentValue = editedCodes[key] !== undefined ? editedCodes[key] : item.codigoHomologado
                                    const isRowModified = editedCodes[key] !== undefined
                                    const isRowSaving = savingRowKey === key
                                    const isRowSaved = savedStatus[key]

                                    return (
                                        <tr key={key} className="hover:bg-slate-50/70 transition-colors">
                                            {/* COLUMNA 1: Programa y Servicio PMPA */}
                                            <td className="py-3 px-4 align-middle">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 flex items-center justify-center font-black text-xs shrink-0">
                                                        {item.programaPmpa.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-slate-900 text-sm tracking-tight">
                                                            {item.programaPmpa}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                                Servicio: {formatServicioLabel(item.servicioPmpa)}
                                                            </span>
                                                            <span className="text-[10.5px] text-slate-400">
                                                                • {item.totalRegistros.toLocaleString('es-CL')} registros en {item.totalRbds} colegios
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* COLUMNA 2: Código Homologado */}
                                            <td className="py-3 px-4 align-middle">
                                                <div className="flex items-center gap-2">
                                                    <div className="relative flex-1">
                                                        <input
                                                            type="text"
                                                            value={currentValue}
                                                            onChange={e => handleInputChange(item, e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault()
                                                                    handleSaveRow(item)
                                                                }
                                                            }}
                                                            placeholder="Escriba el código que homologa este programa..."
                                                            className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none transition-all ${
                                                                isRowModified
                                                                    ? 'bg-amber-50/80 border-2 border-amber-300 ring-2 ring-amber-400/10'
                                                                    : currentValue
                                                                    ? 'bg-white border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10'
                                                                    : 'bg-white border border-dashed border-slate-300 focus:border-cyan-500'
                                                            }`}
                                                        />
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleSaveRow(item)}
                                                        disabled={isRowSaving}
                                                        className={`p-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center justify-center ${
                                                            isRowModified
                                                                ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs'
                                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                                        }`}
                                                        title="Guardar código homologado (o presiona Enter)"
                                                    >
                                                        {isRowSaving ? (
                                                            <RefreshCw className="w-4 h-4 animate-spin text-cyan-600" />
                                                        ) : (
                                                            <Save className="w-4 h-4" />
                                                        )}
                                                    </button>

                                                    {isRowSaved && (
                                                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 animate-pulse shrink-0">
                                                            <Check className="w-3.5 h-3.5" />
                                                            <span>Guardado</span>
                                                        </span>
                                                    )}

                                                    {item.actualizadoPor && !isRowSaved && (
                                                        <span
                                                            className="text-[10px] text-slate-400 hidden lg:inline shrink-0"
                                                            title={`Modificado por ${item.actualizadoPor} el ${
                                                                item.actualizadoAt ? new Date(item.actualizadoAt).toLocaleDateString() : ''
                                                            }`}
                                                        >
                                                            ({item.actualizadoPor})
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación Inferior */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-500">
                    <div>
                        Mostrando del <strong className="text-slate-800">{filteredItems.length > 0 ? (pagina - 1) * pageSize + 1 : 0}</strong> al{' '}
                        <strong className="text-slate-800">{Math.min(pagina * pageSize, filteredItems.length)}</strong> de{' '}
                        <strong className="text-slate-800">{filteredItems.length.toLocaleString('es-CL')}</strong> programas
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setPagina(p => Math.max(1, p - 1))}
                            disabled={pagina <= 1}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 text-slate-600" />
                        </button>
                        <span className="px-3 py-1 font-bold text-slate-700">
                            Página {pagina} de {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setPagina(p => Math.min(totalPages, p + 1))}
                            disabled={pagina >= totalPages}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

