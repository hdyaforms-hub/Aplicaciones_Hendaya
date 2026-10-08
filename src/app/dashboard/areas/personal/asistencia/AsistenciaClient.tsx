'use client'

import React, { useState, useTransition, useMemo } from 'react'
import { AsistenciaRegistroDTO, asignarCriterioAction, getAsistenciaRegistrosAction } from './actions'
import {
    Users,
    Search,
    Calendar,
    Filter,
    Download,
    CheckCircle2,
    Clock,
    Building2,
    ShieldAlert,
    RefreshCw,
    X,
    Check,
    ChevronDown,
    UploadCloud,
    SlidersHorizontal,
    Info
} from 'lucide-react'
import Link from 'next/link'
import * as xlsx from 'xlsx'

interface CriterioItem {
    id: string
    nombre: string
    color: string | null
    activo: boolean
}

interface EstablecimientoItem {
    rbd: number
    establecimiento: string
}

interface AsistenciaClientProps {
    initialRegistros: AsistenciaRegistroDTO[]
    criterios: CriterioItem[]
    establecimientos: EstablecimientoItem[]
    userRbds: number[]
    isAdmin: boolean
}

export default function AsistenciaClient({
    initialRegistros,
    criterios,
    establecimientos,
    userRbds,
    isAdmin
}: AsistenciaClientProps) {
    const [registros, setRegistros] = useState<AsistenciaRegistroDTO[]>(initialRegistros)
    const [isPending, startTransition] = useTransition()

    // Filtros
    const [busquedaRbdNombre, setBusquedaRbdNombre] = useState('')
    const [filtroRbdSeleccionado, setFiltroRbdSeleccionado] = useState<number | null>(null)
    const [filtroFecha, setFiltroFecha] = useState('')
    const [filtroRut, setFiltroRut] = useState('')
    const [filtroNombre, setFiltroNombre] = useState('')
    const [filtroCriterio, setFiltroCriterio] = useState<string>('TODOS')

    // Control autocompletado inteligente
    const [isRbdDropdownOpen, setIsRbdDropdownOpen] = useState(false)

    // Estado de retroalimentación de guardado por registro ID
    const [guardadoStatus, setGuardadoStatus] = useState<{ [id: string]: boolean }>({})

    // Paginación
    const [paginaActual, setPaginaActual] = useState(1)
    const porPagina = 25

    // Opciones activas de criterios para el select
    const criteriosActivos = useMemo(() => {
        return criterios.filter(c => c.activo)
    }, [criterios])

    // Establecimientos filtrados para autocompletado inteligente
    const establecimientosSugeridos = useMemo(() => {
        if (!busquedaRbdNombre.trim()) return establecimientos.slice(0, 15)
        const term = busquedaRbdNombre.toLowerCase()
        return establecimientos.filter(e =>
            e.rbd.toString().includes(term) ||
            e.establecimiento.toLowerCase().includes(term)
        ).slice(0, 15)
    }, [establecimientos, busquedaRbdNombre])

    // Filtrado de registros en memoria
    const registrosFiltrados = useMemo(() => {
        return registros.filter(r => {
            // Filtro RBD
            if (filtroRbdSeleccionado !== null && r.rbd !== filtroRbdSeleccionado) {
                return false
            } else if (!filtroRbdSeleccionado && busquedaRbdNombre.trim()) {
                const term = busquedaRbdNombre.toLowerCase()
                const matchRbd = r.rbd.toString().includes(term)
                const matchEst = r.establecimiento.toLowerCase().includes(term)
                if (!matchRbd && !matchEst) return false
            }

            // Filtro Fecha
            if (filtroFecha && r.fecha !== filtroFecha) {
                return false
            }

            // Filtro RUT
            if (filtroRut.trim()) {
                const termRut = filtroRut.toLowerCase().replace(/[^0-9k]/g, '')
                const regRut = r.rut.toLowerCase().replace(/[^0-9k]/g, '')
                if (!regRut.includes(termRut)) return false
            }

            // Filtro Nombre
            if (filtroNombre.trim()) {
                const termNom = filtroNombre.toLowerCase()
                if (!r.nombreCompleto.toLowerCase().includes(termNom)) return false
            }

            // Filtro Criterio
            if (filtroCriterio === 'SIN_CRITERIO' && r.criterioId !== null) {
                return false
            } else if (filtroCriterio !== 'TODOS' && filtroCriterio !== 'SIN_CRITERIO') {
                if (r.criterioId !== filtroCriterio) return false
            }

            return true
        })
    }, [registros, filtroRbdSeleccionado, busquedaRbdNombre, filtroFecha, filtroRut, filtroNombre, filtroCriterio])

    // Registros de la página actual
    const registrosPaginados = useMemo(() => {
        const start = (paginaActual - 1) * porPagina
        return registrosFiltrados.slice(start, start + porPagina)
    }, [registrosFiltrados, paginaActual, porPagina])

    const totalPaginas = Math.ceil(registrosFiltrados.length / porPagina) || 1

    // Manejar cambio de Criterio de Ausencia en vivo
    const handleCriterioChange = async (registroId: string, nuevoCriterioIdStr: string) => {
        const nuevoCriterioId = nuevoCriterioIdStr ? nuevoCriterioIdStr : null
        const criterioObj = criterios.find(c => c.id === nuevoCriterioId)

        // Actualización optimista en cliente
        setRegistros(prev => prev.map(r => {
            if (r.id === registroId) {
                return {
                    ...r,
                    criterioId: nuevoCriterioId,
                    criterioNombre: criterioObj ? criterioObj.nombre : null,
                    criterioColor: criterioObj ? criterioObj.color : null,
                    numActualizaciones: r.numActualizaciones + 1
                }
            }
            return r
        }))

        startTransition(async () => {
            const res = await asignarCriterioAction(registroId, nuevoCriterioId)
            if (res.success && res.data) {
                setGuardadoStatus(prev => ({ ...prev, [registroId]: true }))
                setTimeout(() => {
                    setGuardadoStatus(prev => {
                        const copy = { ...prev }
                        delete copy[registroId]
                        return copy
                    })
                }, 2500)
            } else {
                alert(res.error || 'No se pudo guardar el criterio')
            }
        })
    }

    // Refrescar registros desde el servidor
    const recargarDatos = () => {
        startTransition(async () => {
            const res = await getAsistenciaRegistrosAction({
                rbd: filtroRbdSeleccionado || undefined,
                fechaInicio: filtroFecha || undefined,
                fechaFin: filtroFecha || undefined,
                criterioId: filtroCriterio as any
            })
            if (res.success && res.data) {
                setRegistros(res.data)
            }
        })
    }

    // Limpiar todos los filtros
    const limpiarFiltros = () => {
        setBusquedaRbdNombre('')
        setFiltroRbdSeleccionado(null)
        setFiltroFecha('')
        setFiltroRut('')
        setFiltroNombre('')
        setFiltroCriterio('TODOS')
        setPaginaActual(1)
    }

    // Exportar tabla a Excel
    const exportarExcel = () => {
        const datosExport = registrosFiltrados.map(r => ({
            'Fecha': r.fechaTexto || r.fecha,
            'RBD': r.rbd,
            'Establecimiento': r.establecimiento,
            'RUT': r.rut,
            'Colaborador': r.nombreCompleto,
            'Cargo': r.cargo || '',
            'Permiso Parcial': r.permisoParcial || '',
            'Criterio Ausencia': r.criterioNombre || 'SIN CRITERIO',
            'Cargado Por': r.creadoPor,
            'Fecha Carga': new Date(r.fechaCreacion).toLocaleString('es-CL'),
            'Actualizado Por': r.actualizadoPor || '',
            'Fecha Actualización': r.fechaActualizacion ? new Date(r.fechaActualizacion).toLocaleString('es-CL') : '',
            'Num Actualizaciones': r.numActualizaciones
        }))

        const ws = xlsx.utils.json_to_sheet(datosExport)
        const wb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(wb, ws, 'Asistencia')
        xlsx.writeFile(wb, `Reporte_Asistencia_${new Date().toISOString().slice(0, 10)}.xlsx`)
    }

    // Métricas
    const conCriterio = registrosFiltrados.filter(r => r.criterioId !== null).length
    const sinCriterio = registrosFiltrados.filter(r => r.criterioId === null).length

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 p-6 rounded-2xl shadow-xl border border-sky-800/40 text-white">
                <div>
                    <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs tracking-wider uppercase mb-1">
                        <Users className="w-4 h-4" />
                        <span>Áreas · Personal</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                        Módulo de Asistencia
                    </h1>
                    <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                        Visualización y gestión diaria de ausencias del personal. Asocia directamente los motivos de ausentismo o tipificación a cada colaborador y establecimiento.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={recargarDatos}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-xl border border-slate-700 text-xs font-medium transition-colors"
                        title="Recargar datos"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-sky-400' : ''}`} />
                        <span>Refrescar</span>
                    </button>
                    <button
                        onClick={exportarExcel}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-colors shadow-md shadow-emerald-900/30"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Exportar Excel</span>
                    </button>
                    <Link
                        href="/dashboard/areas/personal/carga-masiva"
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-medium transition-colors shadow-md shadow-sky-900/30"
                    >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Carga Masiva</span>
                    </Link>
                </div>
            </div>

            {/* Aviso de RBDs restringidos para el usuario */}
            {!isAdmin && userRbds.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    <span>
                        Acceso restringido: Solo puedes visualizar los <strong>{userRbds.length}</strong> establecimientos (RBDs) asignados a tu cuenta de usuario.
                    </span>
                </div>
            )}

            {/* Barra de KPIs / Métricas rápidas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs uppercase font-medium text-slate-400">Total Mostrados</span>
                    <p className="text-2xl font-bold text-white mt-1">{registrosFiltrados.length}</p>
                </div>
                <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs uppercase font-medium text-emerald-400">Con Criterio Asignado</span>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">{conCriterio}</p>
                </div>
                <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs uppercase font-medium text-amber-400">Pendientes (Sin Criterio)</span>
                    <p className="text-2xl font-bold text-amber-400 mt-1">{sinCriterio}</p>
                </div>
                <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs uppercase font-medium text-sky-400">Criterios Disponibles</span>
                    <p className="text-2xl font-bold text-sky-400 mt-1">{criteriosActivos.length}</p>
                </div>
            </div>

            {/* Filtros Inteligentes */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                        <SlidersHorizontal className="w-4 h-4 text-sky-400" />
                        <span>Filtros de Búsqueda Avanzada</span>
                    </div>
                    {(busquedaRbdNombre || filtroRbdSeleccionado || filtroFecha || filtroRut || filtroNombre || filtroCriterio !== 'TODOS') && (
                        <button
                            onClick={limpiarFiltros}
                            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>Limpiar filtros</span>
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Filtro 1: Búsqueda Autocompletativa RBD / Nombre Colegio */}
                    <div className="relative">
                        <label className="text-[11px] font-semibold text-slate-400 uppercase block mb-1">
                            RBD / Establecimiento
                        </label>
                        <div className="relative">
                            <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={busquedaRbdNombre}
                                onChange={e => {
                                    setBusquedaRbdNombre(e.target.value)
                                    setFiltroRbdSeleccionado(null)
                                    setIsRbdDropdownOpen(true)
                                }}
                                onFocus={() => setIsRbdDropdownOpen(true)}
                                placeholder="Escribe RBD o Colegio..."
                                className="w-full pl-9 pr-7 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                            {busquedaRbdNombre && (
                                <button
                                    onClick={() => {
                                        setBusquedaRbdNombre('')
                                        setFiltroRbdSeleccionado(null)
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Dropdown autocompletado inteligente */}
                        {isRbdDropdownOpen && (
                            <div className="absolute z-30 left-0 right-0 mt-1 bg-slate-850 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-800 animate-in fade-in">
                                <div className="p-2 bg-slate-900 text-[10px] uppercase font-bold text-slate-400 flex justify-between">
                                    <span>Establecimientos Sugeridos</span>
                                    <button
                                        onClick={() => setIsRbdDropdownOpen(false)}
                                        className="text-slate-400 hover:text-white"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                                {establecimientosSugeridos.length === 0 ? (
                                    <div className="p-3 text-xs text-slate-500 text-center">
                                        No se encontraron colegios con este término
                                    </div>
                                ) : (
                                    establecimientosSugeridos.map(item => (
                                        <button
                                            key={item.rbd}
                                            type="button"
                                            onClick={() => {
                                                setBusquedaRbdNombre(`(${item.rbd}) ${item.establecimiento}`)
                                                setFiltroRbdSeleccionado(item.rbd)
                                                setIsRbdDropdownOpen(false)
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-sky-500/20 hover:text-white flex items-center justify-between transition-colors"
                                        >
                                            <span className="truncate pr-2 font-medium">{item.establecimiento}</span>
                                            <span className="font-mono text-[11px] bg-slate-800 px-1.5 py-0.5 rounded text-sky-400 border border-slate-700">
                                                {item.rbd}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Filtro 2: Fecha */}
                    <div>
                        <label className="text-[11px] font-semibold text-slate-400 uppercase block mb-1">
                            Fecha
                        </label>
                        <div className="relative">
                            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="date"
                                value={filtroFecha}
                                onChange={e => { setFiltroFecha(e.target.value); setPaginaActual(1); }}
                                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                    </div>

                    {/* Filtro 3: RUT */}
                    <div>
                        <label className="text-[11px] font-semibold text-slate-400 uppercase block mb-1">
                            RUT
                        </label>
                        <input
                            type="text"
                            value={filtroRut}
                            onChange={e => { setFiltroRut(e.target.value); setPaginaActual(1); }}
                            placeholder="Ej: 12345678-9"
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                        />
                    </div>

                    {/* Filtro 4: Nombre */}
                    <div>
                        <label className="text-[11px] font-semibold text-slate-400 uppercase block mb-1">
                            Colaborador (Nombre / Apellidos)
                        </label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={filtroNombre}
                                onChange={e => { setFiltroNombre(e.target.value); setPaginaActual(1); }}
                                placeholder="Buscar nombre..."
                                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                    </div>

                    {/* Filtro 5: Criterios de Ausencias */}
                    <div>
                        <label className="text-[11px] font-semibold text-slate-400 uppercase block mb-1">
                            Criterios de Ausencias
                        </label>
                        <select
                            value={filtroCriterio}
                            onChange={e => { setFiltroCriterio(e.target.value); setPaginaActual(1); }}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                            <option value="TODOS">Todos los Criterios</option>
                            <option value="SIN_CRITERIO">⚠️ Sin Criterio (Pendientes)</option>
                            {criteriosActivos.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.nombre}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabla de Registros */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
                <div className="p-4 border-b border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                    <div>
                        Mostrando registros <strong>{Math.min(registrosFiltrados.length, (paginaActual - 1) * porPagina + 1)}</strong> - <strong>{Math.min(registrosFiltrados.length, paginaActual * porPagina)}</strong> de <strong>{registrosFiltrados.length}</strong>
                    </div>

                    {/* Paginación */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                            disabled={paginaActual === 1}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-300 border border-slate-700"
                        >
                            Anterior
                        </button>
                        <span className="font-medium text-slate-300">
                            Página {paginaActual} de {totalPaginas}
                        </span>
                        <button
                            onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                            disabled={paginaActual >= totalPaginas}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-300 border border-slate-700"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-800/60 font-semibold uppercase text-slate-400 border-b border-slate-800 tracking-wider">
                            <tr>
                                <th className="px-4 py-3.5 whitespace-nowrap">Fecha</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">RBD</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Establecimiento</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">RUT</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Colaborador</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Cargo</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Permiso Parcial</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Trazabilidad Carga</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[240px] text-sky-400 font-bold">
                                    Criterio de Ausencia
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {registrosPaginados.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-14 text-slate-500">
                                        No se encontraron registros de asistencia que coincidan con los filtros aplicados.
                                    </td>
                                </tr>
                            ) : (
                                registrosPaginados.map(r => {
                                    const isSaved = guardadoStatus[r.id]
                                    return (
                                        <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                                            {/* Fecha */}
                                            <td className="px-4 py-3 whitespace-nowrap font-mono font-medium text-slate-300">
                                                {r.fechaTexto || r.fecha}
                                            </td>

                                            {/* RBD */}
                                            <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-sky-400">
                                                {r.rbd}
                                            </td>

                                            {/* Establecimiento */}
                                            <td className="px-4 py-3 max-w-[200px] truncate" title={r.establecimiento}>
                                                <span className="font-semibold text-white">{r.establecimiento}</span>
                                            </td>

                                            {/* RUT (Desencriptado) */}
                                            <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-200">
                                                {r.rut}
                                            </td>

                                            {/* Nombre y Apellidos (Desencriptados) */}
                                            <td className="px-4 py-3 whitespace-nowrap font-medium text-white">
                                                {r.nombreCompleto}
                                            </td>

                                            {/* Cargo */}
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                                                {r.cargo || <span className="italic text-slate-600">-</span>}
                                            </td>

                                            {/* Permiso Parcial */}
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                                                {r.permisoParcial || <span className="italic text-slate-600">-</span>}
                                            </td>

                                            {/* Trazabilidad Carga */}
                                            <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-400">
                                                <div>
                                                    <span className="text-slate-300">Cargado: </span>
                                                    <span>{r.creadoPor}</span>
                                                </div>
                                                {r.numActualizaciones > 0 && r.actualizadoPor && (
                                                    <div className="text-sky-400/90 text-[10px] mt-0.5">
                                                        <span>Act: {r.actualizadoPor} ({r.numActualizaciones})</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Columna final: Lista desplegable Criterios de Ausencias */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={r.criterioId ?? ''}
                                                        onChange={e => handleCriterioChange(r.id, e.target.value)}
                                                        className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer ${
                                                            r.criterioId
                                                                ? 'bg-slate-800 text-white border-sky-500/50 shadow-sm'
                                                                : 'bg-amber-950/30 text-amber-300 border-amber-600/40 hover:border-amber-500'
                                                        }`}
                                                        style={{
                                                            borderLeftColor: r.criterioColor || (r.criterioId ? '#0ea5e9' : '#f59e0b'),
                                                            borderLeftWidth: '4px'
                                                        }}
                                                    >
                                                        <option value="" className="bg-slate-900 text-amber-400">
                                                            -- Seleccionar Criterio --
                                                        </option>
                                                        {criteriosActivos.map(crit => (
                                                            <option
                                                                key={crit.id}
                                                                value={crit.id}
                                                                className="bg-slate-900 text-white"
                                                            >
                                                                {crit.nombre}
                                                            </option>
                                                        ))}
                                                    </select>

                                                    {/* Micro indicador de guardado */}
                                                    {isSaved && (
                                                        <span
                                                            className="text-emerald-400 flex items-center gap-0.5 animate-in fade-in"
                                                            title="Guardado exitosamente"
                                                        >
                                                            <Check className="w-4 h-4 stroke-[3]" />
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

                {/* Footer paginación */}
                <div className="p-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span>
                        Total filtrados: <strong>{registrosFiltrados.length}</strong> registros
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                            disabled={paginaActual === 1}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-300 border border-slate-700"
                        >
                            Anterior
                        </button>
                        <span>
                            Página {paginaActual} de {totalPaginas}
                        </span>
                        <button
                            onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                            disabled={paginaActual >= totalPaginas}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-300 border border-slate-700"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
