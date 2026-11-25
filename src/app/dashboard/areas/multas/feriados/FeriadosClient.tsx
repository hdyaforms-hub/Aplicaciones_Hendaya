'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import {
    FeriadoDTO,
    guardarFeriadoAction,
    toggleActivoFeriadoAction,
    eliminarFeriadoAction,
    restablecerFeriadosAnioAction
} from './actions'

interface Props {
    initialFeriados: FeriadoDTO[]
    canEdit: boolean
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function FeriadosClient({ initialFeriados, canEdit }: Props) {
    const [feriados, setFeriados] = useState<FeriadoDTO[]>(initialFeriados)
    const currentYear = new Date().getFullYear()
    const [selectedAnio, setSelectedAnio] = useState<number>(currentYear)
    const [busqueda, setBusqueda] = useState('')
    const [isPending, startTransition] = useTransition()
    const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

    // Modal state
    const [modalOpen, setModalOpen] = useState(false)
    const [editingFeriado, setEditingFeriado] = useState<FeriadoDTO | null>(null)
    const [formData, setFormData] = useState<{
        fecha: string
        descripcion: string
        tipo: 'LEGAL' | 'IRREGULAR' | 'ELECCION' | 'REGIONAL'
        activo: boolean
    }>({
        fecha: `${currentYear}-01-01`,
        descripcion: '',
        tipo: 'LEGAL',
        activo: true
    })

    // Lista de años disponibles
    const aniosDisponibles = [2024, 2025, 2026, 2027, 2028, 2029, 2030]

    // Filtrar feriados
    const feriadosFiltrados = feriados.filter(f => {
        if (selectedAnio !== 0 && f.anio !== selectedAnio) return false
        if (!busqueda.trim()) return true
        const term = busqueda.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const desc = f.descripcion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        return desc.includes(term) || f.fecha.includes(term) || f.tipo.toLowerCase().includes(term)
    })

    // Métricas del año
    const feriadosDelAnio = feriados.filter(f => f.anio === selectedAnio)
    const totalAnio = feriadosDelAnio.length
    const activosAnio = feriadosDelAnio.filter(f => f.activo).length
    const enDiasHabiles = feriadosDelAnio.filter(f => {
        if (!f.activo) return false
        const [y, m, d] = f.fecha.split('-').map(Number)
        const day = new Date(y, m - 1, d).getDay()
        return day >= 1 && day <= 5
    }).length

    const formatFechaLegible = (fechaStr: string) => {
        const [y, m, d] = fechaStr.split('-').map(Number)
        const date = new Date(y, m - 1, d)
        const diaSemana = DIAS_SEMANA[date.getDay()]
        const mesNombre = MESES[m - 1]
        const esHabil = date.getDay() >= 1 && date.getDay() <= 5
        return {
            diaSemana,
            texto: `${diaSemana} ${d} de ${mesNombre}`,
            esHabil
        }
    }

    const handleOpenCrear = () => {
        setEditingFeriado(null)
        setFormData({
            fecha: `${selectedAnio}-01-01`,
            descripcion: '',
            tipo: 'LEGAL',
            activo: true
        })
        setModalOpen(true)
    }

    const handleOpenEditar = (f: FeriadoDTO) => {
        setEditingFeriado(f)
        setFormData({
            fecha: f.fecha,
            descripcion: f.descripcion,
            tipo: f.tipo,
            activo: f.activo
        })
        setModalOpen(true)
    }

    const handleSubmitModal = (e: React.FormEvent) => {
        e.preventDefault()
        setMensaje(null)

        startTransition(async () => {
            const res = await guardarFeriadoAction({
                id: editingFeriado?.id,
                fecha: formData.fecha,
                descripcion: formData.descripcion,
                tipo: formData.tipo,
                activo: formData.activo
            })

            if (!res.success) {
                setMensaje({ tipo: 'error', texto: res.error || 'Error al guardar feriado' })
            } else {
                setMensaje({ tipo: 'ok', texto: 'Feriado guardado correctamente en la base de datos.' })
                setModalOpen(false)
                // Actualizar estado local
                const anioNum = parseInt(formData.fecha.split('-')[0], 10)
                setFeriados(prev => {
                    const idTarget = editingFeriado?.id || `feriado_${formData.fecha}`
                    const existingIdx = prev.findIndex(item => item.id === idTarget || item.fecha === formData.fecha)
                    const updatedItem: FeriadoDTO = {
                        id: idTarget,
                        fecha: formData.fecha,
                        descripcion: formData.descripcion,
                        anio: anioNum,
                        tipo: formData.tipo,
                        activo: formData.activo
                    }
                    if (existingIdx >= 0) {
                        const copy = [...prev]
                        copy[existingIdx] = updatedItem
                        return copy.sort((a, b) => a.fecha.localeCompare(b.fecha))
                    } else {
                        return [...prev, updatedItem].sort((a, b) => a.fecha.localeCompare(b.fecha))
                    }
                })
            }
        })
    }

    const handleToggleActivo = (id: string, currentActivo: boolean) => {
        startTransition(async () => {
            const res = await toggleActivoFeriadoAction(id, !currentActivo)
            if (res.success) {
                setFeriados(prev => prev.map(f => f.id === id ? { ...f, activo: !currentActivo } : f))
            } else {
                alert(res.error || 'Error al cambiar estado')
            }
        })
    }

    const handleEliminar = (id: string, descripcion: string) => {
        if (!confirm(`¿Eliminar el feriado "${descripcion}"? Los plazos volverán a considerar este día como hábil salvo que exista por fórmula.`)) return

        startTransition(async () => {
            const res = await eliminarFeriadoAction(id)
            if (res.success) {
                setFeriados(prev => prev.filter(f => f.id !== id))
            } else {
                alert(res.error || 'Error al eliminar')
            }
        })
    }

    const handleRestablecerAnio = () => {
        if (!confirm(`¿Restablecer los feriados oficiales para el año ${selectedAnio} según el calendario legal chileno? Se reinsertarán los feriados faltantes.`)) return

        startTransition(async () => {
            const res = await restablecerFeriadosAnioAction(selectedAnio)
            if (res.success) {
                setMensaje({ tipo: 'ok', texto: `Se restablecieron los feriados oficiales del año ${selectedAnio}.` })
                window.location.reload()
            } else {
                alert(res.error || 'Error al restablecer')
            }
        })
    }

    return (
        <div className="space-y-6">
            {/* Header / Hub Breadcrumbs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <Link
                            href="/dashboard/areas/multas/tablero"
                            className="text-xs font-bold text-cyan-700 hover:text-cyan-800 transition-colors"
                        >
                            Multas
                        </Link>
                        <span className="text-xs text-slate-400">/</span>
                        <Link
                            href="/dashboard/areas/multas/ciclo-legal"
                            className="text-xs font-semibold text-slate-600 hover:text-cyan-700 transition-colors"
                        >
                            Ciclo Legal
                        </Link>
                        <span className="text-xs text-slate-400">/</span>
                        <span className="text-xs font-semibold text-slate-800">Calendario de Feriados</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
                        <span className="text-cyan-600">📅</span> Calendario de Feriados Legales y Administrativos
                    </h1>
                    <p className="text-xs text-slate-600 mt-1 max-w-3xl">
                        Tabla oficial de feriados en base de datos. Controla los días hábiles para el cómputo de plazos legales de descargos, recursos jerárquicos y planes de acción de JUNAEB.
                    </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    {canEdit && (
                        <>
                            <button
                                onClick={handleRestablecerAnio}
                                disabled={isPending}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all shadow-sm flex items-center gap-1.5"
                                title="Recargar feriados legales base para este año"
                            >
                                <span>🔄</span> Restablecer {selectedAnio}
                            </button>
                            <button
                                onClick={handleOpenCrear}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-700 hover:bg-cyan-800 text-white transition-all shadow-md shadow-cyan-700/20 flex items-center gap-1.5"
                            >
                                <span>➕</span> Agregar Feriado
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Mensajes de éxito / error */}
            {mensaje && (
                <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
                    mensaje.tipo === 'ok'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                    <span>{mensaje.texto}</span>
                    <button onClick={() => setMensaje(null)} className="text-slate-400 hover:text-slate-700 font-bold ml-2">✕</button>
                </div>
            )}

            {/* Selector de Año y Tarjetas de Resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Año de Consulta</span>
                    <div className="flex items-center gap-2 mt-2">
                        <select
                            value={selectedAnio}
                            onChange={(e) => setSelectedAnio(Number(e.target.value))}
                            className="w-full font-black text-lg text-cyan-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                        >
                            {aniosDisponibles.map(a => (
                                <option key={a} value={a}>Año {a}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Total Registrados</span>
                    <div className="text-2xl font-black text-slate-900 mt-1">
                        {totalAnio} <span className="text-xs font-normal text-slate-500">feriados</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                        En base de datos para {selectedAnio}
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Feriados Hábiles (L-V)</span>
                    <div className="text-2xl font-black text-amber-600 mt-1">
                        {enDiasHabiles} <span className="text-xs font-normal text-slate-500">días inhábiles</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                        Excluidos del cómputo legal
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Estado en Memoria</span>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs font-bold text-emerald-700">Caché Activo y Sincronizado</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                        Auto-invalidación al editar
                    </div>
                </div>
            </div>

            {/* Barra de Filtro y Búsqueda */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                <div className="relative w-full sm:w-80">
                    <input
                        type="text"
                        placeholder="Buscar feriado por nombre, fecha o tipo..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600 w-full sm:w-auto justify-end">
                    <span>Mostrando <strong>{feriadosFiltrados.length}</strong> feriados</span>
                </div>
            </div>

            {/* Tabla de Feriados */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] text-slate-600 font-bold uppercase">
                                <th className="py-3 px-4">Fecha</th>
                                <th className="py-3 px-4">Día</th>
                                <th className="py-3 px-4">Descripción</th>
                                <th className="py-3 px-3">Tipo</th>
                                <th className="py-3 px-3 text-center">Incide en Plazos (L-V)</th>
                                <th className="py-3 px-3 text-center">Estado</th>
                                {canEdit && <th className="py-3 px-4 text-right">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {feriadosFiltrados.map((f) => {
                                const info = formatFechaLegible(f.fecha)
                                return (
                                    <tr key={f.id} className={`hover:bg-slate-50/70 transition-colors ${!f.activo ? 'opacity-50 bg-slate-50/30' : ''}`}>
                                        <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                                            {f.fecha}
                                        </td>
                                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                                            {info.diaSemana}
                                        </td>
                                        <td className="py-3 px-4 font-semibold text-slate-800">
                                            {f.descripcion}
                                        </td>
                                        <td className="py-3 px-3 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                                f.tipo === 'LEGAL'
                                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                    : f.tipo === 'ELECCION'
                                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                                    : f.tipo === 'IRREGULAR'
                                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            }`}>
                                                {f.tipo === 'LEGAL' ? '📜 Legal' : f.tipo === 'ELECCION' ? '🗳️ Elección' : f.tipo === 'IRREGULAR' ? '⭐ Ley Especial' : '🗺️ Regional'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            {info.esHabil ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                                    <span>⚠️</span> Día Hábil
                                                </span>
                                            ) : (
                                                <span className="text-[11px] text-slate-400">
                                                    Fin de semana
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            {canEdit ? (
                                                <button
                                                    onClick={() => handleToggleActivo(f.id, f.activo)}
                                                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                                                        f.activo
                                                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                                    }`}
                                                    title={f.activo ? 'Clic para desactivar' : 'Clic para activar'}
                                                >
                                                    {f.activo ? '✓ Activo' : '✕ Inactivo'}
                                                </button>
                                            ) : (
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    f.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                                }`}>
                                                    {f.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            )}
                                        </td>
                                        {canEdit && (
                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                                                <button
                                                    onClick={() => handleOpenEditar(f)}
                                                    className="px-2.5 py-1 text-slate-600 hover:text-cyan-800 hover:bg-cyan-50 rounded-lg font-bold text-xs mr-1 transition-colors"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleEliminar(f.id, f.descripcion)}
                                                    className="px-2.5 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg font-bold text-xs transition-colors"
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                            {feriadosFiltrados.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-center py-8 text-slate-400 font-medium italic">
                                        No se encontraron feriados para el año {selectedAnio} o filtro aplicado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Crear / Editar Feriado */}
            {modalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="bg-gradient-to-r from-cyan-700 to-cyan-800 p-5 text-white flex justify-between items-center">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <span>📅</span> {editingFeriado ? 'Editar Feriado' : 'Agregar Nuevo Feriado'}
                            </h3>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmitModal} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Fecha del Feriado <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.fecha}
                                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-500 outline-none text-xs font-semibold text-slate-900"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Descripción / Motivo <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    maxLength={150}
                                    placeholder="Ej. Elecciones Presidenciales / Día de Ley Especial"
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-500 outline-none text-xs text-slate-900"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Tipo de Feriado <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={formData.tipo}
                                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-500 outline-none text-xs font-medium text-slate-900 bg-white"
                                >
                                    <option value="LEGAL">Legal Oficial (Feriado Nacional Ordinario)</option>
                                    <option value="IRREGULAR">Ley Especial / Excepcional (Ej. 16 de Septiembre)</option>
                                    <option value="ELECCION">Elección / Plebiscito (Inhábiles)</option>
                                    <option value="REGIONAL">Regional / Comunal</option>
                                </select>
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.activo}
                                        onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                                        className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
                                    />
                                    <span className="text-xs font-bold text-slate-700">Feriado Activo (se descuenta de plazos hábiles)</span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-700 hover:bg-cyan-800 text-white transition-all shadow-md shadow-cyan-700/20 disabled:opacity-50"
                                >
                                    {isPending ? 'Guardando...' : 'Guardar Feriado'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
