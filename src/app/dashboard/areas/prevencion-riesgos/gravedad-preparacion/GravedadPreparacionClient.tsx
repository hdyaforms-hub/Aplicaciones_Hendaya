'use client'

import React, { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
    actualizarGravedadPreparacion,
    sincronizarPreparacionesAction,
    buscarSugerenciasPreparacionAction,
    GravedadType
} from './actions'

interface Props {
    initialItems: any[]
    totalCount: number
    currentPage: number
    totalPages: number
    kpis: {
        totalGlobal: number
        asignadas: number
        sinAsignar: number
        alto: number
        medio: number
        leve: number
    }
    licitacionesList: string[]
    subServiciosList: string[]
    canManage: boolean
}

export default function GravedadPreparacionClient({
    initialItems,
    totalCount,
    currentPage,
    totalPages,
    kpis,
    licitacionesList,
    subServiciosList,
    canManage
}: Props) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Filtros
    const [licitacion, setLicitacion] = useState(searchParams.get('licitacion') || '')
    const [nombreBusqueda, setNombreBusqueda] = useState(searchParams.get('nombre') || '')
    const [subServicio, setSubServicio] = useState(searchParams.get('subservicio') || '')
    const [gravedadFiltro, setGravedadFiltro] = useState(searchParams.get('gravedad') || '')

    // Ordenamiento
    const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'numeroPreparacion')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc')

    // Sugerencias de Autocompletado inteligente
    const [sugerencias, setSugerencias] = useState<string[]>([])
    const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
    const [cargandoSugerencias, setCargandoSugerencias] = useState(false)
    const autocompletarRef = useRef<HTMLDivElement>(null)

    // Estado local optimista para items
    const [items, setItems] = useState(initialItems)
    const [localKpis, setLocalKpis] = useState(kpis)

    // Estados de transición / carga
    const [isPending, startTransition] = useTransition()
    const [syncLoading, setSyncLoading] = useState(false)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

    // Sincronizar items locales cuando cambian las props
    useEffect(() => {
        setItems(initialItems)
        setLocalKpis(kpis)
    }, [initialItems, kpis])

    // Cerrar sugerencias al hacer clic afuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (autocompletarRef.current && !autocompletarRef.current.contains(event.target as Node)) {
                setMostrarSugerencias(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Timer para autocompletado inteligente con debounce
    useEffect(() => {
        if (!nombreBusqueda || nombreBusqueda.trim().length < 2) {
            setSugerencias([])
            return
        }

        const timer = setTimeout(async () => {
            setCargandoSugerencias(true)
            try {
                const results = await buscarSugerenciasPreparacionAction(nombreBusqueda, licitacion)
                setSugerencias(results)
                setMostrarSugerencias(results.length > 0)
            } catch (err) {
                console.error(err)
            } finally {
                setCargandoSugerencias(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [nombreBusqueda, licitacion])

    // Mostrar notificaciones tipo toast auto-descartables
    const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToastMessage({ text, type })
        setTimeout(() => setToastMessage(null), 4000)
    }

    // Actualizar la URL con los parámetros
    const aplicarFiltros = (nuevosParametros: Record<string, string | number | undefined>) => {
        const params = new URLSearchParams(searchParams.toString())

        // Mezclar parámetros
        Object.entries(nuevosParametros).forEach(([key, value]) => {
            if (value === undefined || value === '' || value === 'ALL') {
                params.delete(key)
            } else {
                params.set(key, String(value))
            }
        })

        startTransition(() => {
            router.push(`${pathname}?${params.toString()}`)
        })
    }

    // Manejador de cambio de ordenamiento en columnas
    const handleSort = (columna: string) => {
        let nuevoOrden: 'asc' | 'desc' = 'asc'
        if (sortBy === columna) {
            nuevoOrden = sortOrder === 'asc' ? 'desc' : 'asc'
        }
        setSortBy(columna)
        setSortOrder(nuevoOrden)
        aplicarFiltros({ sortBy: columna, sortOrder: nuevoOrden, page: 1 })
    }

    // Limpiar todos los filtros
    const handleLimpiarFiltros = () => {
        setLicitacion('')
        setNombreBusqueda('')
        setSubServicio('')
        setGravedadFiltro('')
        setSortBy('numeroPreparacion')
        setSortOrder('asc')
        setMostrarSugerencias(false)
        router.push(pathname)
    }

    // Asignar gravedad a un item
    const handleCambiarGravedad = async (item: any, nuevaGravedad: GravedadType) => {
        if (!canManage) {
            showToast('No tienes permisos para modificar la gravedad.', 'error')
            return
        }

        if (item.gravedad === nuevaGravedad) return

        const gravedadAnterior = item.gravedad
        setUpdatingId(item.id)

        // Actualización optimista en interfaz
        setItems(prev =>
            prev.map(it => (it.id === item.id ? { ...it, gravedad: nuevaGravedad, updatedAt: new Date().toISOString() } : it))
        )

        // Actualización optimista de KPIs
        setLocalKpis(prev => {
            const copy = { ...prev }
            if (gravedadAnterior === 'SIN_ASIGNAR' && nuevaGravedad !== 'SIN_ASIGNAR') {
                copy.asignadas += 1
                copy.sinAsignar = Math.max(0, copy.sinAsignar - 1)
            } else if (gravedadAnterior !== 'SIN_ASIGNAR' && nuevaGravedad === 'SIN_ASIGNAR') {
                copy.asignadas = Math.max(0, copy.asignadas - 1)
                copy.sinAsignar += 1
            }

            if (gravedadAnterior === 'ALTO') copy.alto = Math.max(0, copy.alto - 1)
            if (gravedadAnterior === 'MEDIO') copy.medio = Math.max(0, copy.medio - 1)
            if (gravedadAnterior === 'LEVE') copy.leve = Math.max(0, copy.leve - 1)

            if (nuevaGravedad === 'ALTO') copy.alto += 1
            if (nuevaGravedad === 'MEDIO') copy.medio += 1
            if (nuevaGravedad === 'LEVE') copy.leve += 1

            return copy
        })

        try {
            const res = await actualizarGravedadPreparacion(item.id, nuevaGravedad)
            if (res.success) {
                showToast(`Gravedad actualizada a "${nuevaGravedad}" para #${item.numeroPreparacion}`, 'success')
            } else {
                showToast(res.error || 'Error al actualizar gravedad.', 'error')
                // Revertir optimismo
                setItems(initialItems)
                setLocalKpis(kpis)
            }
        } catch (err: any) {
            showToast('Error de conexión al actualizar gravedad.', 'error')
            setItems(initialItems)
            setLocalKpis(kpis)
        } finally {
            setUpdatingId(null)
        }
    }

    // Sincronizar con el mantenedor de preparaciones
    const handleSincronizar = async () => {
        if (!canManage) return
        setSyncLoading(true)
        try {
            const res = await sincronizarPreparacionesAction()
            if (res.success) {
                showToast(
                    `Sincronización completa: ${res.insertedCount} nuevas preparaciones agregadas. Total: ${res.totalActual}`,
                    'success'
                )
                startTransition(() => {
                    router.refresh()
                })
            } else {
                showToast(res.error || 'Error en la sincronización.', 'error')
            }
        } catch (err) {
            showToast('Error de conexión al sincronizar.', 'error')
        } finally {
            setSyncLoading(false)
        }
    }

    // Helpers visuales para badges de semáforo
    const getSemaforoBadge = (gravedad: string) => {
        switch (gravedad) {
            case 'ALTO':
                return {
                    bg: 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200',
                    dot: 'bg-rose-500 shadow-rose-300',
                    label: 'ALTO',
                    icon: '🔴'
                }
            case 'MEDIO':
                return {
                    bg: 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-200',
                    dot: 'bg-amber-500 shadow-amber-300',
                    label: 'MEDIO',
                    icon: '🟡'
                }
            case 'LEVE':
                return {
                    bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-200',
                    dot: 'bg-emerald-500 shadow-emerald-300',
                    label: 'LEVE',
                    icon: '🟢'
                }
            default:
                return {
                    bg: 'bg-slate-100 text-slate-600 border-slate-200',
                    dot: 'bg-slate-400',
                    label: 'SIN ASIGNAR',
                    icon: '⚪'
                }
        }
    }

    // Icono indicador de ordenamiento
    const renderSortIcon = (col: string) => {
        if (sortBy !== col) {
            return <span className="text-slate-300 ml-1 text-xs">↕</span>
        }
        return (
            <span className="text-cyan-600 ml-1 font-bold text-xs">
                {sortOrder === 'asc' ? '▲' : '▼'}
            </span>
        )
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Toast flotante */}
            {toastMessage && (
                <div
                    className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border text-sm font-bold backdrop-blur-md transition-all animate-bounce ${
                        toastMessage.type === 'success'
                            ? 'bg-emerald-50/95 border-emerald-300 text-emerald-900 shadow-emerald-900/10'
                            : toastMessage.type === 'error'
                            ? 'bg-rose-50/95 border-rose-300 text-rose-900 shadow-rose-900/10'
                            : 'bg-sky-50/95 border-sky-300 text-sky-900 shadow-sky-900/10'
                    }`}
                >
                    <span>{toastMessage.type === 'success' ? '✓' : toastMessage.type === 'error' ? '✕' : 'ℹ'}</span>
                    <span>{toastMessage.text}</span>
                </div>
            )}

            {/* Cabecera del Módulo */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
                        <span>Áreas</span>
                        <span>/</span>
                        <span className="text-cyan-600">Prev. de riesgos</span>
                        <span>/</span>
                        <span className="text-slate-700">Gravedad en Preparación</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <span className="p-2.5 bg-gradient-to-tr from-cyan-500 to-sky-400 text-white rounded-2xl shadow-md shadow-cyan-500/20 text-xl">
                            🛡️
                        </span>
                        Gravedad en Preparación
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Matriz de evaluación de severidad y criticidad alimentaria para prevención de riesgos.
                    </p>
                </div>

                {canManage && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSincronizar}
                            disabled={syncLoading}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 text-white text-sm font-bold hover:from-cyan-700 hover:to-sky-700 active:scale-95 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
                            title="Importa y actualiza nuevas preparaciones desde el Mantenedor sin alterar las gravedades ya asignadas."
                        >
                            <span className={syncLoading ? 'animate-spin' : ''}>🔄</span>
                            <span>{syncLoading ? 'Sincronizando...' : 'Sincronizar Preparaciones'}</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Tarjetas KPI de Estado y Semáforo */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Total */}
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Total</span>
                    <div className="text-2xl font-black text-slate-800 mt-1">
                        {localKpis.totalGlobal.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Preparaciones base</span>
                </div>

                {/* Asignadas */}
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-[11px] font-black text-cyan-600 uppercase tracking-wider">Clasificadas</span>
                    <div className="text-2xl font-black text-cyan-700 mt-1">
                        {localKpis.asignadas.toLocaleString()}
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                        <div
                            className="bg-cyan-500 h-full rounded-full transition-all"
                            style={{
                                width: `${Math.min(
                                    100,
                                    Math.round((localKpis.asignadas / (localKpis.totalGlobal || 1)) * 100)
                                )}%`
                            }}
                        />
                    </div>
                </div>

                {/* Pendientes */}
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Pendientes</span>
                    <div className="text-2xl font-black text-slate-700 mt-1">
                        {localKpis.sinAsignar.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Sin asignar</span>
                </div>

                {/* Alto */}
                <div className="bg-gradient-to-br from-rose-50 to-white p-4 rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-rose-700 uppercase tracking-wider">🔴 Alto</span>
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    </div>
                    <div className="text-2xl font-black text-rose-700 mt-1">
                        {localKpis.alto.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-rose-500 font-bold">Riesgo Crítico</span>
                </div>

                {/* Medio */}
                <div className="bg-gradient-to-br from-amber-50 to-white p-4 rounded-2xl border border-amber-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-amber-700 uppercase tracking-wider">🟡 Medio</span>
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-amber-700 mt-1">
                        {localKpis.medio.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-amber-600 font-bold">Riesgo Moderado</span>
                </div>

                {/* Leve */}
                <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">🟢 Leve</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    <div className="text-2xl font-black text-emerald-700 mt-1">
                        {localKpis.leve.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold">Riesgo Bajo</span>
                </div>
            </div>

            {/* Barra de Filtros Requeridos */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    {/* Filtro: Licitación */}
                    <div className="md:col-span-3">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                            📑 Licitación
                        </label>
                        <select
                            value={licitacion}
                            onChange={(e) => {
                                const val = e.target.value
                                setLicitacion(val)
                                aplicarFiltros({ licitacion: val, page: 1 })
                            }}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all shadow-inner"
                        >
                            <option value="">-- Todas las Licitaciones --</option>
                            {licitacionesList.map((lic) => (
                                <option key={lic} value={lic}>
                                    Licitación {lic}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro: Nombre de Preparación (Autocompletado Inteligente) */}
                    <div className="md:col-span-5 relative" ref={autocompletarRef}>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                            🔍 Nombre de Preparación <span className="text-cyan-600 font-bold">(Búsqueda Inteligente)</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={nombreBusqueda}
                                onChange={(e) => {
                                    setNombreBusqueda(e.target.value)
                                    setMostrarSugerencias(true)
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setMostrarSugerencias(false)
                                        aplicarFiltros({ nombre: nombreBusqueda, page: 1 })
                                    }
                                }}
                                placeholder="Escribe nombre o N° de preparación..."
                                className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-800 text-sm font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all shadow-inner"
                            />
                            {cargandoSugerencias ? (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 animate-spin">
                                    ⏳
                                </span>
                            ) : nombreBusqueda ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNombreBusqueda('')
                                        setSugerencias([])
                                        setMostrarSugerencias(false)
                                        aplicarFiltros({ nombre: '', page: 1 })
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold hover:bg-slate-300 transition-all"
                                >
                                    ✕
                                </button>
                            ) : null}
                        </div>

                        {/* Menú flotante de Autocompletado */}
                        {mostrarSugerencias && sugerencias.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100">
                                <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    Sugerencias encontradas:
                                </div>
                                {sugerencias.map((sug, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                            setNombreBusqueda(sug)
                                            setMostrarSugerencias(false)
                                            aplicarFiltros({ nombre: sug, page: 1 })
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-cyan-50 hover:text-cyan-800 font-semibold transition-colors flex items-center justify-between"
                                    >
                                        <span>{sug}</span>
                                        <span className="text-[10px] text-cyan-600 font-bold">Seleccionar ↵</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Filtro: Nombre SubServicio */}
                    <div className="md:col-span-3">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                            🍽️ SubServicio
                        </label>
                        <select
                            value={subServicio}
                            onChange={(e) => {
                                const val = e.target.value
                                setSubServicio(val)
                                aplicarFiltros({ subservicio: val, page: 1 })
                            }}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all shadow-inner"
                        >
                            <option value="">-- Todos los SubServicios --</option>
                            {subServiciosList.map((sub) => (
                                <option key={sub} value={sub}>
                                    {sub}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Botón Buscar / Limpiar */}
                    <div className="md:col-span-1 flex gap-2">
                        <button
                            type="button"
                            onClick={() => aplicarFiltros({ nombre: nombreBusqueda, page: 1 })}
                            className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-cyan-600 active:scale-95 transition-all flex items-center justify-center shadow-sm"
                            title="Buscar"
                        >
                            🔎
                        </button>
                    </div>
                </div>

                {/* Filtro por Semáforo / Píldoras de Estado */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Filtrar Gravedad:</span>
                        {[
                            { id: '', label: 'Todas', color: 'border-slate-200 text-slate-600 hover:bg-slate-100' },
                            { id: 'ALTO', label: '🔴 Alto', color: 'border-rose-200 text-rose-700 bg-rose-50/60 hover:bg-rose-100' },
                            { id: 'MEDIO', label: '🟡 Medio', color: 'border-amber-200 text-amber-700 bg-amber-50/60 hover:bg-amber-100' },
                            { id: 'LEVE', label: '🟢 Leve', color: 'border-emerald-200 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100' },
                            { id: 'SIN_ASIGNAR', label: '⚪ Sin Asignar', color: 'border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100' }
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                type="button"
                                onClick={() => {
                                    setGravedadFiltro(btn.id)
                                    aplicarFiltros({ gravedad: btn.id, page: 1 })
                                }}
                                className={`px-3 py-1 rounded-xl font-bold border transition-all ${btn.color} ${
                                    gravedadFiltro === btn.id ? 'ring-2 ring-cyan-500 scale-105 shadow-sm' : 'opacity-80'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    {(licitacion || nombreBusqueda || subServicio || gravedadFiltro) && (
                        <button
                            type="button"
                            onClick={handleLimpiarFiltros}
                            className="text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1"
                        >
                            <span>✕</span> Limpiar Filtros
                        </button>
                    )}
                </div>
            </div>

            {/* Contenedor de la Tabla Principal */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Info superior de la tabla */}
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/40">
                    <div className="text-xs font-bold text-slate-500">
                        Mostrando <span className="text-slate-900 font-black">{items.length}</span> de{' '}
                        <span className="text-slate-900 font-black">{totalCount.toLocaleString()}</span> preparaciones
                        {isPending && <span className="ml-2 text-cyan-600 animate-pulse font-bold">Cargando...</span>}
                    </div>

                    <div className="text-xs text-slate-400 font-medium">
                        Página {currentPage} de {totalPages} (10 líneas por página)
                    </div>
                </div>

                {/* Tabla Responsiva */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-100 select-none">
                            <tr>
                                {/* Licitación */}
                                <th
                                    onClick={() => handleSort('licitacion')}
                                    className="px-6 py-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Licitación</span>
                                        {renderSortIcon('licitacion')}
                                    </div>
                                </th>

                                {/* N° Preparación */}
                                <th
                                    onClick={() => handleSort('numeroPreparacion')}
                                    className="px-6 py-3.5 cursor-pointer hover:bg-slate-100 transition-colors text-center w-28"
                                >
                                    <div className="flex items-center justify-center gap-1">
                                        <span>N° Prep.</span>
                                        {renderSortIcon('numeroPreparacion')}
                                    </div>
                                </th>

                                {/* Nombre de Preparación */}
                                <th
                                    onClick={() => handleSort('nombrePreparacion')}
                                    className="px-6 py-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Nombre Preparación</span>
                                        {renderSortIcon('nombrePreparacion')}
                                    </div>
                                </th>

                                {/* SubServicio */}
                                <th
                                    onClick={() => handleSort('nombreSubServicio')}
                                    className="px-6 py-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
                                >
                                    <div className="flex items-center gap-1">
                                        <span>SubServicio</span>
                                        {renderSortIcon('nombreSubServicio')}
                                    </div>
                                </th>

                                {/* Gravedad (Semáforo) */}
                                <th
                                    onClick={() => handleSort('gravedad')}
                                    className="px-6 py-3.5 cursor-pointer hover:bg-slate-100 transition-colors text-center min-w-[200px]"
                                >
                                    <div className="flex items-center justify-center gap-1">
                                        <span>Gravedad (Semáforo)</span>
                                        {renderSortIcon('gravedad')}
                                    </div>
                                </th>

                                {/* Modificado por / Fecha */}
                                <th
                                    onClick={() => handleSort('updatedAt')}
                                    className="px-6 py-3.5 cursor-pointer hover:bg-slate-100 transition-colors text-right"
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        <span>Actualizado</span>
                                        {renderSortIcon('updatedAt')}
                                    </div>
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center text-slate-400">
                                        <div className="text-4xl mb-3">🔍</div>
                                        <div className="font-bold text-slate-700 text-base">No se encontraron preparaciones</div>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Intenta ajustar los filtros de Licitación, Nombre o SubServicio.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                items.map((item) => {
                                    const semaforo = getSemaforoBadge(item.gravedad)
                                    const isUpdating = updatingId === item.id

                                    return (
                                        <tr
                                            key={item.id}
                                            className={`hover:bg-slate-50/80 transition-colors group ${
                                                isUpdating ? 'opacity-60 bg-cyan-50/30' : ''
                                            }`}
                                        >
                                            {/* Licitación */}
                                            <td className="px-6 py-3.5 font-bold text-slate-700 whitespace-nowrap">
                                                <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono font-bold border border-slate-200">
                                                    {item.licitacion}
                                                </span>
                                            </td>

                                            {/* N° Preparación */}
                                            <td className="px-6 py-3.5 text-center font-mono font-black text-slate-900 whitespace-nowrap">
                                                #{item.numeroPreparacion}
                                            </td>

                                            {/* Nombre Preparación */}
                                            <td className="px-6 py-3.5 font-bold text-slate-800 max-w-md">
                                                <div className="leading-snug">{item.nombrePreparacion}</div>
                                            </td>

                                            {/* SubServicio */}
                                            <td className="px-6 py-3.5 whitespace-nowrap">
                                                {item.nombreSubServicio ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
                                                        {item.nombreSubServicio}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">-</span>
                                                )}
                                            </td>

                                            {/* Gravedad (Semáforo interactivo) */}
                                            <td className="px-6 py-3.5 text-center">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    {/* Badge de estado actual */}
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border transition-all ${semaforo.bg}`}
                                                    >
                                                        <span className={`w-2 h-2 rounded-full ${semaforo.dot}`} />
                                                        {semaforo.label}
                                                    </span>

                                                    {/* Botones de asignación rápida para usuario con permiso */}
                                                    {canManage && (
                                                        <div className="flex items-center justify-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 opacity-90 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCambiarGravedad(item, 'LEVE')}
                                                                title="Asignar Leve (Verde)"
                                                                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                                                                    item.gravedad === 'LEVE'
                                                                        ? 'bg-emerald-600 text-white shadow-sm font-black'
                                                                        : 'text-slate-600 hover:bg-emerald-100 hover:text-emerald-800'
                                                                }`}
                                                            >
                                                                Leve
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCambiarGravedad(item, 'MEDIO')}
                                                                title="Asignar Medio (Amarillo)"
                                                                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                                                                    item.gravedad === 'MEDIO'
                                                                        ? 'bg-amber-500 text-white shadow-sm font-black'
                                                                        : 'text-slate-600 hover:bg-amber-100 hover:text-amber-800'
                                                                }`}
                                                            >
                                                                Medio
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCambiarGravedad(item, 'ALTO')}
                                                                title="Asignar Alto (Rojo)"
                                                                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                                                                    item.gravedad === 'ALTO'
                                                                        ? 'bg-rose-600 text-white shadow-sm font-black'
                                                                        : 'text-slate-600 hover:bg-rose-100 hover:text-rose-800'
                                                                }`}
                                                            >
                                                                Alto
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Modificado por / Fecha */}
                                            <td className="px-6 py-3.5 text-right whitespace-nowrap text-xs">
                                                <div className="font-semibold text-slate-700">
                                                    {item.updatedBy || 'Sin registrar'}
                                                </div>
                                                <div className="text-[11px] text-slate-400">
                                                    {item.updatedAt
                                                        ? new Date(item.updatedAt).toLocaleDateString('es-CL', {
                                                              day: '2-digit',
                                                              month: '2-digit',
                                                              year: 'numeric',
                                                              hour: '2-digit',
                                                              minute: '2-digit'
                                                          })
                                                        : '-'}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Barra de Paginación (10 líneas por página, Atrás y Siguiente) */}
                <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                    <div className="text-xs text-slate-500 font-medium">
                        Mostrando línea {(currentPage - 1) * 10 + 1} a {Math.min(currentPage * 10, totalCount)} de{' '}
                        <span className="font-bold text-slate-800">{totalCount.toLocaleString()}</span> registros
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Botón Atrás */}
                        <button
                            type="button"
                            onClick={() => aplicarFiltros({ page: currentPage - 1 })}
                            disabled={currentPage <= 1 || isPending}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
                        >
                            <span>←</span>
                            <span>Atrás</span>
                        </button>

                        {/* Indicador de página */}
                        <span className="px-3 py-1.5 rounded-xl bg-slate-200/70 text-slate-800 font-black text-xs font-mono">
                            {currentPage} / {totalPages}
                        </span>

                        {/* Botón Siguiente */}
                        <button
                            type="button"
                            onClick={() => aplicarFiltros({ page: currentPage + 1 })}
                            disabled={currentPage >= totalPages || isPending}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
                        >
                            <span>Siguiente</span>
                            <span>→</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
