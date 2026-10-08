'use client'

import { useState, useMemo } from 'react'
import { 
    updateGlobalConfigAction, 
    updateSucursalSalaReunionesAction, 
    updateSucursalSalaCompartidaAction,
    SucursalGlobalConfigItem 
} from './actions'
import { GlobalConfigData } from '@/lib/global-config'

export default function GlobalConfigClient({
    initialConfig,
    initialSucursales = []
}: {
    initialConfig: GlobalConfigData
    initialSucursales?: SucursalGlobalConfigItem[]
}) {
    const [timeoutMinutes, setTimeoutMinutes] = useState<number>(initialConfig.sessionTimeoutMin || 30)
    const [loading, setLoading] = useState(false)
    const [successMessage, setSuccessMessage] = useState('')
    const [errorMessage, setErrorMessage] = useState('')

    // Estado para gestión de sucursales con sala de reuniones
    const [sucursalesList, setSucursalesList] = useState<SucursalGlobalConfigItem[]>(initialSucursales)
    const [searchSucursal, setSearchSucursal] = useState('')
    const [savingSucursalId, setSavingSucursalId] = useState<string | null>(null)

    const presets = [
        { label: '15 min (Alta seguridad)', value: 15 },
        { label: '30 min (Recomendado)', value: 30 },
        { label: '60 min (1 hora)', value: 60 },
        { label: '120 min (2 horas)', value: 120 },
        { label: '240 min (4 horas)', value: 240 },
        { label: '480 min (8 horas)', value: 480 },
    ]

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setSuccessMessage('')
        setErrorMessage('')

        const formData = new FormData()
        formData.append('sessionTimeoutMin', timeoutMinutes.toString())

        const res = await updateGlobalConfigAction(formData)

        if (res?.error) {
            setErrorMessage(res.error)
        } else if (res?.success) {
            setSuccessMessage('Configuración global actualizada y aplicada exitosamente.')
            setTimeout(() => setSuccessMessage(''), 5000)
        }
        setLoading(false)
    }

    const filteredSucursales = useMemo(() => {
        if (!searchSucursal.trim()) return sucursalesList
        const q = searchSucursal.toLowerCase().trim()
        return sucursalesList.filter(s =>
            s.nombre.toLowerCase().includes(q) ||
            (s.comuna && s.comuna.toLowerCase().includes(q)) ||
            (s.region && s.region.toLowerCase().includes(q)) ||
            (s.salaCompartidaNombre && s.salaCompartidaNombre.toLowerCase().includes(q))
        )
    }, [sucursalesList, searchSucursal])

    const totalConSala = useMemo(() => sucursalesList.filter(s => s.tieneSalaReuniones || s.salaCompartidaId).length, [sucursalesList])
    const totalSinSala = useMemo(() => sucursalesList.filter(s => !s.tieneSalaReuniones && !s.salaCompartidaId).length, [sucursalesList])
    const totalCompartidas = useMemo(() => sucursalesList.filter(s => s.salaCompartidaId).length, [sucursalesList])

    const handleToggleSalaReuniones = async (sucursal: SucursalGlobalConfigItem, nuevoValor: boolean) => {
        if (sucursal.tieneSalaReuniones === nuevoValor || savingSucursalId) return
        setSavingSucursalId(sucursal.id)
        setErrorMessage('')
        setSuccessMessage('')

        // Actualización optimista
        setSucursalesList(prev => prev.map(s => s.id === sucursal.id ? { ...s, tieneSalaReuniones: nuevoValor } : s))

        const res = await updateSucursalSalaReunionesAction(sucursal.id, nuevoValor)
        setSavingSucursalId(null)

        if (res?.error) {
            // Revertir ante error
            setSucursalesList(prev => prev.map(s => s.id === sucursal.id ? { ...s, tieneSalaReuniones: !nuevoValor } : s))
            setErrorMessage(res.error)
        } else if (res?.success) {
            setSuccessMessage(`Sucursal "${sucursal.nombre}": opción "¿Sucursal cuenta con sala de reuniones?" actualizada a "${nuevoValor ? 'Sí' : 'No'}". ${nuevoValor ? 'Ahora saldrá en la lista desplegable del módulo Sala de reuniones.' : 'Ya no saldrá en la lista desplegable.'}`)
            setTimeout(() => setSuccessMessage(''), 6000)
        }
    }

    const handleCambioSalaCompartida = async (sucursal: SucursalGlobalConfigItem, targetId: string) => {
        if (savingSucursalId) return
        const newTargetId = targetId || null
        if (sucursal.salaCompartidaId === newTargetId) return

        setSavingSucursalId(sucursal.id)
        setErrorMessage('')
        setSuccessMessage('')

        const targetBranch = sucursalesList.find(s => s.id === newTargetId)

        // Actualización optimista
        setSucursalesList(prev => prev.map(s => {
            if (s.id === sucursal.id) {
                return {
                    ...s,
                    salaCompartidaId: newTargetId,
                    salaCompartidaNombre: targetBranch ? targetBranch.nombre : null,
                    // Si se asocia a una sala compartida, queda habilitada para que sus usuarios puedan reservar
                    tieneSalaReuniones: newTargetId ? true : s.tieneSalaReuniones
                }
            }
            return s
        }))

        const res = await updateSucursalSalaCompartidaAction(sucursal.id, newTargetId)
        setSavingSucursalId(null)

        if (res?.error) {
            // Revertir ante error
            setSucursalesList(prev => prev.map(s => s.id === sucursal.id ? {
                ...s,
                salaCompartidaId: sucursal.salaCompartidaId,
                salaCompartidaNombre: sucursal.salaCompartidaNombre,
                tieneSalaReuniones: sucursal.tieneSalaReuniones
            } : s))
            setErrorMessage(res.error)
        } else if (res?.success) {
            setSuccessMessage(res.mensaje || 'Configuración de sala compartida actualizada exitosamente.')
            setTimeout(() => setSuccessMessage(''), 6000)
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Cabecera Principal */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-sky-500 text-white flex items-center justify-center text-xl shadow-md shadow-cyan-500/20">
                            ⚙️
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                Configuración Global
                            </h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Parámetros generales, políticas de seguridad y comportamiento del sistema.
                            </p>
                        </div>
                    </div>
                </div>

                {initialConfig.updatedAt && (
                    <div className="text-right text-[11px] text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
                        <span>Última modificación: </span>
                        <span className="font-semibold text-slate-600">
                            {new Date(initialConfig.updatedAt).toLocaleString()}
                        </span>
                        {initialConfig.updatedBy && (
                            <span className="text-slate-500"> por @{initialConfig.updatedBy}</span>
                        )}
                    </div>
                )}
            </div>

            {/* Mensajes de Feedback */}
            {successMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-3 shadow-sm animate-in slide-in-from-top-2">
                    <span className="text-lg">✅</span>
                    <span className="flex-1">{successMessage}</span>
                    <button 
                        onClick={() => setSuccessMessage('')}
                        className="text-emerald-600 hover:text-emerald-900 text-sm font-bold"
                    >
                        ✕
                    </button>
                </div>
            )}

            {errorMessage && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-3 shadow-sm animate-in slide-in-from-top-2">
                    <span className="text-lg">⚠️</span>
                    <span className="flex-1">{errorMessage}</span>
                    <button 
                        onClick={() => setErrorMessage('')}
                        className="text-rose-600 hover:text-rose-900 text-sm font-bold"
                    >
                        ✕
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* SECCIÓN: Sesión y Seguridad */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">⏱️</span>
                            <div>
                                <h2 className="text-base font-bold text-slate-900">
                                    Sesión y Cierre Automático por Inactividad
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Configura el tiempo máximo que un usuario puede permanecer sin interactuar antes de que su sesión expire automáticamente.
                                </p>
                            </div>
                        </div>
                        <span className="px-3 py-1 text-[11px] font-bold rounded-full bg-cyan-100/70 text-cyan-800 border border-cyan-200">
                            Seguridad
                        </span>
                    </div>

                    <div className="p-6 md:p-8 space-y-6">
                        <div className="max-w-xl space-y-4">
                            <label className="block text-xs font-bold text-slate-700">
                                Tiempo de duración de la sesión (en minutos) *
                            </label>

                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <input
                                        type="number"
                                        min={1}
                                        max={1440}
                                        required
                                        value={timeoutMinutes}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value, 10)
                                            setTimeoutMinutes(isNaN(val) ? 0 : val)
                                        }}
                                        className="w-full pl-4 pr-16 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50/50 focus:bg-white text-slate-900 font-extrabold text-base transition-all shadow-inner"
                                        placeholder="Ej: 30"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">
                                        minutos
                                    </span>
                                </div>

                                <div className="flex gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setTimeoutMinutes(prev => Math.max(1, prev - 5))}
                                        className="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-lg transition-colors"
                                        title="Restar 5 minutos"
                                    >
                                        -5
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTimeoutMinutes(prev => Math.min(1440, prev + 5))}
                                        className="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-lg transition-colors"
                                        title="Sumar 5 minutos"
                                    >
                                        +5
                                    </button>
                                </div>
                            </div>

                            {/* Presets Rápidos */}
                            <div className="pt-2">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    Valores predefinidos rápidos
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {presets.map(p => (
                                        <button
                                            key={p.value}
                                            type="button"
                                            onClick={() => setTimeoutMinutes(p.value)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                                timeoutMinutes === p.value
                                                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/30'
                                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                            }`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Caja informativa de funcionamiento */}
                        <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-5 text-xs text-sky-950 space-y-2">
                            <div className="font-bold flex items-center gap-2 text-sky-900 text-sm">
                                <span>ℹ️</span> ¿Cómo funciona el cierre automático de sesión?
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                                <li>
                                    El sistema detecta automáticamente la actividad en tiempo real (movimiento del mouse, pulsación de teclas, clics o toques táctiles).
                                </li>
                                <li>
                                    Al quedar <strong>60 segundos</strong> para que expire la sesión, se mostrará una ventana emergente de advertencia permitiéndole al usuario extender su tiempo.
                                </li>
                                <li>
                                    Si transcurren <strong>{timeoutMinutes || 0} minutos</strong> sin ninguna actividad, la sesión se cerrará de forma automática y segura, registrándose en el módulo de <strong>Auditoría</strong>.
                                </li>
                            </ul>
                        </div>
                        <div className="flex justify-end pt-3 border-t border-slate-100">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2.5 rounded-2xl text-white bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 shadow-md shadow-cyan-500/25 font-bold text-xs transition-all active:scale-98 disabled:opacity-70 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Guardando duración...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>💾</span>
                                        <span>Guardar Tiempo de Sesión</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            {/* SECCIÓN 2: SALAS DE REUNIONES POR SUCURSAL */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">🏢</span>
                        <div>
                            <h2 className="text-base font-bold text-slate-900">
                                Disponibilidad de Sala de Reuniones por Sucursal
                            </h2>
                            <p className="text-xs text-slate-500">
                                Configura si cada sucursal cuenta con sala de reuniones. Si se asigna &quot;Sí&quot;, aparecerá en la lista desplegable de &quot;Sala de reuniones&quot;; si es &quot;No&quot;, no saldrá.
                            </p>
                        </div>
                    </div>
                    <span className="px-3 py-1 text-[11px] font-bold rounded-full bg-emerald-100/70 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
                        Espacios Colaborativos
                    </span>
                </div>

                <div className="p-6 md:p-8 space-y-6">
                    {/* Resumen de Contadores y Buscador */}
                    <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 mr-1">Resumen:</span>
                            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 shadow-xs">
                                Total: {sucursalesList.length}
                            </span>
                            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Con Sala (&quot;Sí&quot;): {totalConSala}
                            </span>
                            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 shadow-xs flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                Sin Sala (&quot;No&quot;): {totalSinSala}
                            </span>
                            {totalCompartidas > 0 && (
                                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 shadow-xs flex items-center gap-1.5">
                                    <span>🔗</span>
                                    Salas Fusionadas/Compartidas: {totalCompartidas}
                                </span>
                            )}
                        </div>

                        {/* Buscador */}
                        <div className="relative min-w-[240px]">
                            <input
                                type="text"
                                value={searchSucursal}
                                onChange={(e) => setSearchSucursal(e.target.value)}
                                placeholder="Buscar sucursal o sala compartida..."
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium text-slate-800 placeholder-slate-400 shadow-xs"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                🔍
                            </span>
                            {searchSucursal && (
                                <button
                                    onClick={() => setSearchSucursal('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tabla de Sucursales con opciones requeridas */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 shadow-xs">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                    <th className="py-3 px-4">Sucursal</th>
                                    <th className="py-3 px-4 hidden sm:table-cell">Ubicación</th>
                                    <th className="py-3 px-4 text-center font-extrabold text-cyan-900 bg-cyan-50/50">
                                        Sucursal cuenta con sala
                                    </th>
                                    <th className="py-3 px-4 font-extrabold text-indigo-900 bg-indigo-50/40 min-w-[260px]">
                                        Comparte sala con otra sucursal (Fusión)
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {filteredSucursales.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                                            No se encontraron sucursales registradas con ese criterio.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSucursales.map((suc) => {
                                        const isSaving = savingSucursalId === suc.id
                                        const tieneCompartida = Boolean(suc.salaCompartidaId)
                                        return (
                                            <tr key={suc.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-3.5 px-4">
                                                    <div className="font-bold text-slate-900 flex items-center gap-2">
                                                        <span>🏢</span>
                                                        <span>{suc.nombre}</span>
                                                    </div>
                                                    {suc.sucursalesQueCompartenConEsta && suc.sucursalesQueCompartenConEsta.length > 0 && (
                                                        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-md w-fit border border-indigo-100">
                                                            <span>👥</span>
                                                            <span>Sede anfitriona para: <b>{suc.sucursalesQueCompartenConEsta.join(', ')}</b></span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-4 hidden sm:table-cell text-slate-500">
                                                    {suc.comuna || suc.region ? (
                                                        <span>{suc.comuna}{suc.comuna && suc.region ? `, ` : ''}{suc.region}</span>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Sin ubicación</span>
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-4 text-center bg-cyan-50/10">
                                                    <div className="inline-flex items-center justify-center gap-3">
                                                        {/* Checkbox directo */}
                                                        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none" title="Marcar check para habilitar sala de reuniones">
                                                            <input
                                                                type="checkbox"
                                                                checked={suc.tieneSalaReuniones}
                                                                onChange={(e) => handleToggleSalaReuniones(suc, e.target.checked)}
                                                                disabled={isSaving}
                                                                className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer disabled:opacity-50"
                                                            />
                                                            <span className={`text-[11px] font-bold ${suc.tieneSalaReuniones ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                                {suc.tieneSalaReuniones ? 'Sí' : 'No'}
                                                            </span>
                                                        </label>

                                                        {/* Lista desplegable (Si / No) */}
                                                        <div className="relative inline-block">
                                                            <select
                                                                value={suc.tieneSalaReuniones ? 'SI' : 'NO'}
                                                                onChange={(e) => handleToggleSalaReuniones(suc, e.target.value === 'SI')}
                                                                disabled={isSaving}
                                                                className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                                                                    suc.tieneSalaReuniones
                                                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-extrabold'
                                                                        : 'bg-white border-slate-300 text-slate-700'
                                                                } ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
                                                                title="Seleccionar Si o No para la sucursal"
                                                            >
                                                                <option value="SI">Sí</option>
                                                                <option value="NO">No</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 bg-indigo-50/15">
                                                    <div className="space-y-1.5">
                                                        <div className="relative">
                                                            <select
                                                                value={suc.salaCompartidaId || ''}
                                                                onChange={(e) => handleCambioSalaCompartida(suc, e.target.value)}
                                                                disabled={isSaving}
                                                                className={`w-full max-w-xs px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                                                    tieneCompartida
                                                                        ? 'bg-cyan-50/80 border-cyan-300 text-cyan-950 font-extrabold'
                                                                        : 'bg-white border-slate-200 text-slate-700'
                                                                } ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
                                                                title="Selecciona la sucursal cuya sala física se compartirá temporalmente"
                                                            >
                                                                <option value="">Ninguna (Sala propia / independiente)</option>
                                                                {sucursalesList
                                                                    .filter(other => other.id !== suc.id)
                                                                    .map(other => (
                                                                        <option key={other.id} value={other.id}>
                                                                            Comparte sala con {other.nombre}
                                                                        </option>
                                                                    ))}
                                                            </select>
                                                        </div>

                                                        {tieneCompartida && (
                                                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-800 bg-cyan-100/60 px-2.5 py-1 rounded-lg border border-cyan-200/80 w-fit">
                                                                <span>🔗</span>
                                                                <span>Asume la misma sala de: <b>{suc.salaCompartidaNombre || 'Sucursal vinculada'}</b></span>
                                                            </div>
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

                    {/* Aviso informativo corporativo */}
                    <div className="p-4 bg-cyan-50/60 border border-cyan-200/70 rounded-2xl text-xs text-cyan-950 flex items-start gap-3">
                        <span className="text-lg mt-0.5">ℹ️</span>
                        <div className="space-y-1.5">
                            <span className="font-bold block text-cyan-900 text-sm">Reglas de Salas de Reuniones y Fusión Temporal de Sucursales:</span>
                            <ul className="list-disc list-inside space-y-1 text-[11px] text-cyan-900 leading-relaxed pl-0.5">
                                <li>
                                    <strong>Habilitación en listado:</strong> Las sucursales con <strong>&quot;Sí&quot;</strong> (o que compartan sala con otra) aparecerán en la lista desplegable de sucursales en el módulo de <strong>Sala de reuniones</strong>.
                                </li>
                                <li>
                                    <strong>Acceso seguro por perfil:</strong> Cada usuario sigue viendo únicamente las sucursales asignadas a su perfil (por ejemplo, los colaboradores de <em>Casa Matriz</em> no necesitan tener acceso al perfil ni a otros módulos de <em>CD Metro</em>).
                                </li>
                                <li>
                                    <strong>Fusión de Salas Compartidas (Ej: Casa Matriz y CD Metro / Copiapó y Vallenar):</strong> Al asociar una sucursal con otra en la columna <em>&quot;Comparte sala con otra sucursal&quot;</em>, ambas sucursales comparten la misma agenda y disponibilidad física en tiempo real para evitar reservas duplicadas.
                                </li>
                                <li>
                                    <strong>Reversión rápida sin tocar usuarios:</strong> Cuando termine el periodo temporal y vuelvan a la normalidad, simplemente cambia la opción de vuelta a <em>&quot;Ninguna (Sala propia / independiente)&quot;</em> y se desasocian instantáneamente sin tener que modificar los permisos de ningún usuario.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
