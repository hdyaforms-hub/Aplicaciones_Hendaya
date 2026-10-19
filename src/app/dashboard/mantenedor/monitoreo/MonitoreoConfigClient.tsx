'use client'

import React, { useState, useTransition } from 'react'
import { MonitoreoDataResponse, saveMonitoreoConfig } from './actions'

interface Props {
    initialData: MonitoreoDataResponse
}

const PERIODICIDADES = [
    { value: '1_DIA', label: '1 Día', desc: 'Diario (1 día)' },
    { value: '15_DIAS', label: '15 Días', desc: 'Quincenal (15 días)' },
    { value: '1_MES', label: '1 Mes', desc: 'Mensual (30 días)' },
    { value: 'BIMESTRAL', label: 'Bimestral', desc: 'Bimestral (60 días)' },
    { value: 'TRIMESTRAL', label: 'Trimestral', desc: '90 días' },
    { value: 'SEMESTRAL', label: 'Semestre', desc: 'Semestral (180 días)' },
    { value: '1_ANIO', label: '1 Año', desc: 'Anual (365 días)' }
] as const

type PeriodicidadType = typeof PERIODICIDADES[number]['value']

export default function MonitoreoConfigClient({ initialData }: Props) {
    const [isPending, startTransition] = useTransition()
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Roles seleccionados
    const [selectedRoles, setSelectedRoles] = useState<string[]>(initialData.configuredRoles || [])

    // Configuración de Matrices: Record<plantillaId, { periodicidad, activo }>
    const [matricesConfig, setMatricesConfig] = useState<Record<string, { periodicidad: PeriodicidadType; activo: boolean }>>(() => {
        const map: Record<string, { periodicidad: PeriodicidadType; activo: boolean }> = {}
        for (const m of initialData.matrices) {
            const saved = initialData.itemsConfig[`MATRIZ_${m.id}`]
            map[m.id] = {
                periodicidad: (saved?.periodicidad as PeriodicidadType) || '1_MES',
                activo: saved ? saved.activo : true
            }
        }
        return map
    })

    // Configuración de Actas: Record<plantillaId, { periodicidad, activo }>
    const [actasConfig, setActasConfig] = useState<Record<string, { periodicidad: PeriodicidadType; activo: boolean }>>(() => {
        const map: Record<string, { periodicidad: PeriodicidadType; activo: boolean }> = {}
        for (const a of initialData.actas) {
            const saved = initialData.itemsConfig[`ACTA_${a.id}`]
            map[a.id] = {
                periodicidad: (saved?.periodicidad as PeriodicidadType) || '1_MES',
                activo: saved ? saved.activo : true
            }
        }
        return map
    })

    // Filtros de búsqueda
    const [searchMatriz, setSearchMatriz] = useState('')
    const [searchActa, setSearchActa] = useState('')

    // Manejador de roles
    const toggleRole = (roleId: string) => {
        setSelectedRoles(prev => 
            prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
        )
    }

    const selectAllRoles = () => {
        setSelectedRoles(initialData.roles.map(r => r.id))
    }

    const clearRoles = () => {
        setSelectedRoles([])
    }

    // Actualizar configuración de Matriz
    const updateMatrizPeriodicidad = (id: string, periodicidad: PeriodicidadType) => {
        setMatricesConfig(prev => ({
            ...prev,
            [id]: { ...(prev[id] || { activo: true }), periodicidad }
        }))
    }

    const toggleMatrizActivo = (id: string) => {
        setMatricesConfig(prev => ({
            ...prev,
            [id]: { ...(prev[id] || { periodicidad: '1_MES' }), activo: !prev[id]?.activo }
        }))
    }

    // Actualizar configuración de Acta
    const updateActaPeriodicidad = (id: string, periodicidad: PeriodicidadType) => {
        setActasConfig(prev => ({
            ...prev,
            [id]: { ...(prev[id] || { activo: true }), periodicidad }
        }))
    }

    const toggleActaActivo = (id: string) => {
        setActasConfig(prev => ({
            ...prev,
            [id]: { ...(prev[id] || { periodicidad: '1_MES' }), activo: !prev[id]?.activo }
        }))
    }

    // Guardar cambios
    const handleSave = () => {
        setStatusMessage(null)
        startTransition(async () => {
            const items: any[] = []

            // Empaquetar matrices
            for (const m of initialData.matrices) {
                const conf = matricesConfig[m.id] || { periodicidad: '1_MES', activo: true }
                items.push({
                    tipo: 'MATRIZ',
                    plantillaId: m.id,
                    nombre: m.titulo,
                    periodicidad: conf.periodicidad,
                    activo: conf.activo
                })
            }

            // Empaquetar actas
            for (const a of initialData.actas) {
                const conf = actasConfig[a.id] || { periodicidad: '1_MES', activo: true }
                items.push({
                    tipo: 'ACTA',
                    plantillaId: a.id,
                    nombre: a.nombre,
                    periodicidad: conf.periodicidad,
                    activo: conf.activo
                })
            }

            const res = await saveMonitoreoConfig({
                rolesAsignados: selectedRoles,
                items
            })

            if (res.success) {
                setStatusMessage({
                    type: 'success',
                    text: '¡Configuración de monitoreo guardada exitosamente!'
                })
                setTimeout(() => setStatusMessage(null), 4000)
            } else {
                setStatusMessage({
                    type: 'error',
                    text: res.error || 'Ocurrió un error al guardar.'
                })
            }
        })
    }

    // Filtrar listas
    const filteredMatrices = initialData.matrices.filter(m => 
        m.titulo.toLowerCase().includes(searchMatriz.toLowerCase()) ||
        (m.licitacionNombre && m.licitacionNombre.toLowerCase().includes(searchMatriz.toLowerCase()))
    )

    const filteredActas = initialData.actas.filter(a => 
        a.nombre.toLowerCase().includes(searchActa.toLowerCase()) ||
        (a.licitacionNombre && a.licitacionNombre.toLowerCase().includes(searchActa.toLowerCase())) ||
        (a.codigo && a.codigo.toLowerCase().includes(searchActa.toLowerCase()))
    )

    return (
        <div className="min-h-screen bg-slate-50/70 text-slate-800 p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Header Ejecutivo Oficial Hendaya */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 md:p-8 rounded-3xl text-white shadow-xl border border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-black tracking-wider text-sky-400 bg-sky-950/80 px-3 py-1 rounded-xl border border-sky-500/30 shadow-inner">
                            HENDAYA
                        </span>
                        <span className="text-xs uppercase font-bold text-sky-300 tracking-widest bg-sky-900/60 px-2.5 py-1 rounded-lg">
                            Mantenedor Corporativo
                        </span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                        <span>⚙️</span> Configuración de Monitoreo
                    </h1>
                    <p className="text-slate-300 text-sm mt-1 max-w-2xl">
                        Establece las frecuencias periódicas de evaluación para las Matrices de Riesgo y Actas de Supervisión vigentes, y selecciona los roles auditados para el seguimiento en terreno.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white font-bold rounded-xl shadow-md shadow-sky-600/20 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none text-sm"
                    >
                        {isPending ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                Guardando...
                            </>
                        ) : (
                            <>
                                <span>💾</span>
                                Guardar Configuración
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Mensajes de Estado Toast */}
            {statusMessage && (
                <div
                    className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm transition-all ${
                        statusMessage.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-lg">{statusMessage.type === 'success' ? '✅' : '⚠️'}</span>
                        <p className="text-sm font-bold">{statusMessage.text}</p>
                    </div>
                    <button
                        onClick={() => setStatusMessage(null)}
                        className="text-xs font-semibold hover:underline opacity-80"
                    >
                        Cerrar
                    </button>
                </div>
            )}

            {/* SECCIÓN 1: MATRICES DE RIESGOS VIGENTES */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <span className="p-2.5 bg-sky-50 text-sky-700 rounded-xl text-xl border border-sky-200 shadow-sm">🛡️</span>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">1. Matrices de Riesgos (Vigentes)</h2>
                            <p className="text-xs text-slate-500">Asigna la frecuencia con que debe responderse cada matriz activa.</p>
                        </div>
                    </div>
                    <div className="w-full sm:w-72">
                        <input
                            type="text"
                            placeholder="Buscar matriz por título o licitación..."
                            value={searchMatriz}
                            onChange={(e) => setSearchMatriz(e.target.value)}
                            className="w-full px-3.5 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-sky-500 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none shadow-sm transition"
                        />
                    </div>
                </div>

                {filteredMatrices.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                        No se encontraron matrices de riesgo vigentes.
                    </div>
                ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                        <table className="w-full text-left text-sm">
                            <thead className="text-xs uppercase bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="py-3.5 px-4">Estado</th>
                                    <th className="py-3.5 px-4">Matriz de Riesgo</th>
                                    <th className="py-3.5 px-4">Licitación / Año</th>
                                    <th className="py-3.5 px-4 text-center">Frecuencia de Evaluación</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredMatrices.map((m) => {
                                    const conf = matricesConfig[m.id] || { periodicidad: '1_MES', activo: true }
                                    return (
                                        <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="py-3.5 px-4 w-16">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleMatrizActivo(m.id)}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                                        conf.activo ? 'bg-sky-600' : 'bg-slate-300'
                                                    }`}
                                                    title={conf.activo ? 'Monitoreo activo' : 'Excluido del monitoreo'}
                                                >
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                                            conf.activo ? 'translate-x-6' : 'translate-x-1'
                                                        }`}
                                                    />
                                                </button>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="font-bold text-slate-900">{m.titulo}</div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <span className="text-xs text-emerald-600 font-medium inline-flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        Vigente
                                                    </span>
                                                    {m.rolesPerfiles && m.rolesPerfiles.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1 items-center">
                                                            <span className="text-[10px] text-slate-400 font-semibold">Roles:</span>
                                                            {m.rolesPerfiles.map((r, i) => (
                                                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-semibold">
                                                                    {r}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            • Todos los roles
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 text-xs text-slate-600">
                                                <div className="font-semibold text-slate-800">{m.licitacionNombre}</div>
                                                <div className="text-slate-500">Año {m.anio}</div>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                {/* Selector interactivo tipo barra de tiempo */}
                                                <div className="flex flex-wrap items-center justify-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                                                    {PERIODICIDADES.map((p) => {
                                                        const isSelected = conf.periodicidad === p.value
                                                        return (
                                                            <button
                                                                key={p.value}
                                                                type="button"
                                                                disabled={!conf.activo}
                                                                onClick={() => updateMatrizPeriodicidad(m.id, p.value)}
                                                                className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                                                                    !conf.activo
                                                                        ? 'opacity-30 cursor-not-allowed text-slate-400'
                                                                        : isSelected
                                                                        ? 'bg-sky-600 text-white font-bold shadow-sm'
                                                                        : 'text-slate-600 hover:text-slate-900 hover:bg-white font-medium'
                                                                }`}
                                                                title={p.desc}
                                                            >
                                                                {p.label}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* SECCIÓN 2: ACTAS DE SUPERVISIÓN VIGENTES */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <span className="p-2.5 bg-sky-50 text-sky-700 rounded-xl text-xl border border-sky-200 shadow-sm">📜</span>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">2. Actas de Supervisión (Vigentes)</h2>
                            <p className="text-xs text-slate-500">Asigna la frecuencia con que debe aplicarse cada acta activa según sus roles designados.</p>
                        </div>
                    </div>
                    <div className="w-full sm:w-72">
                        <input
                            type="text"
                            placeholder="Buscar acta por nombre, código..."
                            value={searchActa}
                            onChange={(e) => setSearchActa(e.target.value)}
                            className="w-full px-3.5 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-sky-500 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none shadow-sm transition"
                        />
                    </div>
                </div>

                {filteredActas.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                        No se encontraron actas de supervisión vigentes.
                    </div>
                ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                        <table className="w-full text-left text-sm">
                            <thead className="text-xs uppercase bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="py-3.5 px-4">Estado</th>
                                    <th className="py-3.5 px-4">Acta de Supervisión</th>
                                    <th className="py-3.5 px-4">Licitación / Versión</th>
                                    <th className="py-3.5 px-4 text-center">Frecuencia de Evaluación</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredActas.map((a) => {
                                    const conf = actasConfig[a.id] || { periodicidad: '1_MES', activo: true }
                                    return (
                                        <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="py-3.5 px-4 w-16">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleActaActivo(a.id)}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                                        conf.activo ? 'bg-sky-600' : 'bg-slate-300'
                                                    }`}
                                                    title={conf.activo ? 'Monitoreo activo' : 'Excluido del monitoreo'}
                                                >
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                                            conf.activo ? 'translate-x-6' : 'translate-x-1'
                                                        }`}
                                                    />
                                                </button>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="font-bold text-slate-900">{a.nombre}</div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <span className="text-xs text-emerald-600 font-medium inline-flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        Vigente {a.anio}
                                                    </span>
                                                    {a.rolesPerfiles && a.rolesPerfiles.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 items-center">
                                                            <span className="text-[10px] text-slate-400 font-semibold">Roles:</span>
                                                            {a.rolesPerfiles.map((r, i) => (
                                                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-semibold">
                                                                    {r}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 text-xs text-slate-600">
                                                <div className="font-semibold text-slate-800">{a.licitacionNombre}</div>
                                                <div className="text-slate-500 font-mono">
                                                    {a.codigo ? `Cód: ${a.codigo}` : ''} {a.version ? `v${a.version}` : ''}
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="flex flex-wrap items-center justify-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                                                    {PERIODICIDADES.map((p) => {
                                                        const isSelected = conf.periodicidad === p.value
                                                        return (
                                                            <button
                                                                key={p.value}
                                                                type="button"
                                                                disabled={!conf.activo}
                                                                onClick={() => updateActaPeriodicidad(a.id, p.value)}
                                                                className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                                                                    !conf.activo
                                                                        ? 'opacity-30 cursor-not-allowed text-slate-400'
                                                                        : isSelected
                                                                        ? 'bg-sky-600 text-white font-bold shadow-sm'
                                                                        : 'text-slate-600 hover:text-slate-900 hover:bg-white font-medium'
                                                                }`}
                                                                title={p.desc}
                                                            >
                                                                {p.label}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* SECCIÓN 3: ROLES A MONITOREAR */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <span className="p-2.5 bg-sky-50 text-sky-700 rounded-xl text-xl border border-sky-200 shadow-sm">👥</span>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">3. Roles Asignados a Monitoreo</h2>
                            <p className="text-xs text-slate-500">Marca los roles cuyos colaboradores serán supervisados en el Tablero de Avances.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <button
                            type="button"
                            onClick={selectAllRoles}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-sky-700 font-bold rounded-lg transition"
                        >
                            Seleccionar Todos
                        </button>
                        <button
                            type="button"
                            onClick={clearRoles}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-lg transition"
                        >
                            Limpiar
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-2">
                    {initialData.roles.map((role) => {
                        const isChecked = selectedRoles.includes(role.id)
                        return (
                            <div
                                key={role.id}
                                onClick={() => toggleRole(role.id)}
                                className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-start gap-3 select-none ${
                                    isChecked
                                        ? 'bg-sky-50/80 border-sky-400 ring-2 ring-sky-400/20 shadow-sm text-sky-950 font-bold'
                                        : 'bg-slate-50/60 border-slate-200 hover:border-sky-300 opacity-80 hover:opacity-100'
                                }`}
                            >
                                <div className="pt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}}
                                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                        <h3 className={`text-sm truncate ${isChecked ? 'text-sky-950 font-bold' : 'text-slate-800 font-semibold'}`}>
                                            {role.name}
                                        </h3>
                                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-mono font-bold shrink-0">
                                            {role.activeUsersCount} {role.activeUsersCount === 1 ? 'usr' : 'usrs'}
                                        </span>
                                    </div>
                                    {role.description && (
                                        <p className="text-xs text-slate-500 line-clamp-2 mt-1 font-normal">
                                            {role.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Footer flotante o resumen */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-3xl shadow-md">
                <div className="text-xs text-slate-600">
                    <span className="text-sky-700 font-extrabold text-sm">{selectedRoles.length}</span> roles seleccionados para monitoreo continuo.
                </div>
                <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white font-bold rounded-xl shadow-md shadow-sky-600/20 active:scale-95 transition-all disabled:opacity-50 text-sm"
                >
                    {isPending ? 'Guardando configuración...' : '💾 Guardar Todo'}
                </button>
            </div>
        </div>
    )
}
