'use client'

import React, { useState, useEffect } from 'react'
import {
    getParametrosLicitacion,
    guardarParametrosLicitacion,
    restablecerParametrosDefecto,
    getHorariosServicio,
    guardarHorariosServicio,
    cargarHorariosSugeridos,
    getEstratosExcluidos,
    guardarEstratoExcluido,
    toggleEstratoExcluido,
    eliminarEstratoExcluido,
    cargarEstratosSugeridos
} from './actions'
import {
    ModuloSistemaConfig,
    SubModuloReglasC5,
    SUBMODULOS_C5_DEFAULT,
    HorarioServicioItem
} from './types'

interface LicitacionOption {
    licId: number
    licitacionHomologada: string | null
    estado: number | null
}

interface Props {
    licitaciones: LicitacionOption[]
}

export default function ConfiguracionMultasClient({ licitaciones }: Props) {
    const [selectedLicId, setSelectedLicId] = useState<number>(licitaciones[0]?.licId || 0)
    const [activeTab, setActiveTab] = useState<'modulos' | 'horarios' | 'estratos' | 'parametros' | 'aql' | 'causas'>('modulos')

    // Estado de parámetros
    const [loading, setLoading] = useState<boolean>(false)
    const [saving, setSaving] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    // Form data Parámetros
    const [modulos, setModulos] = useState<ModuloSistemaConfig[]>([])
    const [ratioH, setRatioH] = useState<number>(70)
    const [tempRefriMin, setTempRefriMin] = useState<number>(0.0)
    const [tempRefriMax, setTempRefriMax] = useState<number>(5.0)
    const [tempCongelacionMax, setTempCongelacionMax] = useState<number>(-18.0)
    const [tolLeve, setTolLeve] = useState<number>(10.0)
    const [tolMod, setTolMod] = useState<number>(5.0)
    const [tolGrave, setTolGrave] = useState<number>(0.0)
    const [plazoCorreccion, setPlazoCorreccion] = useState<number>(5)
    const [tablaAql, setTablaAql] = useState<any[]>([])
    const [causas, setCausas] = useState<any[]>([])
    const [lastUpdated, setLastUpdated] = useState<string | null>(null)
    const [usuarioModif, setUsuarioModif] = useState<string | null>(null)

    // Form data C2.1 Horarios por Servicio
    const [horarios, setHorarios] = useState<HorarioServicioItem[]>([])
    const [savingHorarios, setSavingHorarios] = useState(false)

    // Form data C2.2 Estratos Excluidos
    const [estratos, setEstratos] = useState<any[]>([])
    const [nuevoEstrato, setNuevoEstrato] = useState('')
    const [descEstrato, setDescEstrato] = useState('')
    const [savingEstrato, setSavingEstrato] = useState(false)

    // Cargar datos al seleccionar licitación
    useEffect(() => {
        if (!selectedLicId) return
        loadLicitacionConfig(selectedLicId)
        loadHorarios(selectedLicId)
        loadEstratos(selectedLicId)
    }, [selectedLicId])

    const loadLicitacionConfig = async (licId: number) => {
        setLoading(true)
        setError(null)
        try {
            const res = await getParametrosLicitacion(licId)
            if (res.error) {
                setError(res.error)
            } else if (res.parametros) {
                const p = res.parametros
                setModulos(p.modulos || [])
                setRatioH(p.ratioManipuladorasH)
                setTempRefriMin(p.tempRefriMin)
                setTempRefriMax(p.tempRefriMax)
                setTempCongelacionMax(p.tempCongelacionMax)
                setTolLeve(p.toleranciaFLeve)
                setTolMod(p.toleranciaFModerado)
                setTolGrave(p.toleranciaFGrave)
                setPlazoCorreccion(p.plazoCorreccionDias)
                setTablaAql(p.tablaAql || [])
                setCausas(p.causasNoImputables || [])
                setLastUpdated(p.updatedAt ? new Date(p.updatedAt).toLocaleString('es-CL') : null)
                setUsuarioModif(p.usuarioModif || null)
            }
        } catch (err: any) {
            setError(err.message || 'Error al cargar la configuración de la licitación.')
        } finally {
            setLoading(false)
        }
    }

    const loadHorarios = async (licId: number) => {
        try {
            const res = await getHorariosServicio(licId)
            if (res.horarios) {
                setHorarios(res.horarios)
            }
        } catch (err) {
            console.error('Error cargando horarios:', err)
        }
    }

    const loadEstratos = async (licId: number) => {
        try {
            const res = await getEstratosExcluidos(licId)
            if (res.estratos) {
                setEstratos(res.estratos)
            }
        } catch (err) {
            console.error('Error cargando estratos:', err)
        }
    }

    const handleToggleModulo = (codigo: string) => {
        setModulos(prev =>
            prev.map(m => (m.codigo === codigo ? { ...m, activo: !m.activo } : m))
        )
    }

    const handleToggleSubmoduloC5 = (subKey: keyof SubModuloReglasC5) => {
        setModulos(prev =>
            prev.map(m => {
                if (m.codigo !== 'C5') return m
                const currentSub = m.submodulos || { ...SUBMODULOS_C5_DEFAULT }
                return {
                    ...m,
                    submodulos: {
                        ...currentSub,
                        [subKey]: !currentSub[subKey]
                    }
                }
            })
        )
    }

    const handleSave = async () => {
        if (!selectedLicId) return
        setSaving(true)
        setError(null)
        setSuccessMessage(null)
        try {
            const res = await guardarParametrosLicitacion({
                licId: selectedLicId,
                modulos,
                ratioManipuladorasH: Number(ratioH),
                tempRefriMin: Number(tempRefriMin),
                tempRefriMax: Number(tempRefriMax),
                tempCongelacionMax: Number(tempCongelacionMax),
                toleranciaFLeve: Number(tolLeve),
                toleranciaFModerado: Number(tolMod),
                toleranciaFGrave: Number(tolGrave),
                plazoCorreccionDias: Number(plazoCorreccion),
                tablaAql,
                causasNoImputables: causas
            })
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage('¡Configuración guardada exitosamente y sincronizada con el motor de multas!')
                loadLicitacionConfig(selectedLicId)
            }
        } catch (err: any) {
            setError(err.message || 'Error al guardar la configuración.')
        } finally {
            setSaving(false)
        }
    }

    const handleReset = async () => {
        if (!selectedLicId) return
        if (!confirm('¿Estás seguro de restablecer todos los parámetros a los valores por defecto oficiales de la IT?')) {
            return
        }
        setSaving(true)
        setError(null)
        setSuccessMessage(null)
        try {
            const res = await restablecerParametrosDefecto(selectedLicId)
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage('Parámetros restablecidos a los valores por defecto.')
                loadLicitacionConfig(selectedLicId)
            }
        } catch (err: any) {
            setError(err.message || 'Error al restablecer configuración.')
        } finally {
            setSaving(false)
        }
    }

    // Handlers C2.1 Horarios
    const handleUpdateHorario = (index: number, field: keyof HorarioServicioItem, val: any) => {
        const next = [...horarios]
        next[index] = { ...next[index], [field]: val }
        setHorarios(next)
    }

    const handleSaveHorarios = async () => {
        if (!selectedLicId) return
        setSavingHorarios(true)
        setError(null)
        setSuccessMessage(null)
        try {
            const res = await guardarHorariosServicio(selectedLicId, horarios)
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage('¡Horarios por servicio guardados exitosamente!')
                loadHorarios(selectedLicId)
            }
        } catch (err: any) {
            setError(err.message || 'Error al guardar horarios.')
        } finally {
            setSavingHorarios(false)
        }
    }

    const handleCargarHorariosSugeridos = async () => {
        if (!selectedLicId) return
        setSavingHorarios(true)
        setError(null)
        setSuccessMessage(null)
        try {
            const res = await cargarHorariosSugeridos(selectedLicId)
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage('¡Horarios sugeridos oficiales cargados exitosamente!')
                loadHorarios(selectedLicId)
            }
        } catch (err: any) {
            setError(err.message || 'Error al cargar horarios sugeridos.')
        } finally {
            setSavingHorarios(false)
        }
    }

    // Handlers C2.2 Estratos
    const handleAddEstrato = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedLicId || !nuevoEstrato.trim()) return
        setSavingEstrato(true)
        setError(null)
        try {
            const res = await guardarEstratoExcluido(selectedLicId, nuevoEstrato, descEstrato)
            if (res.error) {
                setError(res.error)
            } else {
                setNuevoEstrato('')
                setDescEstrato('')
                setSuccessMessage(`Estrato ${nuevoEstrato} agregado exitosamente.`)
                loadEstratos(selectedLicId)
            }
        } catch (err: any) {
            setError(err.message || 'Error al agregar estrato.')
        } finally {
            setSavingEstrato(false)
        }
    }

    const handleToggleEstrato = async (id: string, activoActual: boolean) => {
        try {
            const res = await toggleEstratoExcluido(id, !activoActual)
            if (res.error) {
                setError(res.error)
            } else {
                loadEstratos(selectedLicId)
            }
        } catch (err: any) {
            setError(err.message || 'Error al modificar estrato.')
        }
    }

    const handleDeleteEstrato = async (id: string, estrato: string) => {
        if (!confirm(`¿Estás seguro de eliminar el estrato ${estrato}?`)) return
        try {
            const res = await eliminarEstratoExcluido(id)
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage(`Estrato ${estrato} eliminado.`)
                loadEstratos(selectedLicId)
            }
        } catch (err: any) {
            setError(err.message || 'Error al eliminar estrato.')
        }
    }

    const handleCargarEstratosSugeridos = async () => {
        if (!selectedLicId) return
        setSavingEstrato(true)
        setError(null)
        try {
            const res = await cargarEstratosSugeridos(selectedLicId)
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage('Estratos sugeridos (206, 208, 209) cargados exitosamente.')
                loadEstratos(selectedLicId)
            }
        } catch (err: any) {
            setError(err.message || 'Error al cargar estratos sugeridos.')
        } finally {
            setSavingEstrato(false)
        }
    }

    // Handlers para tabla AQL
    const handleUpdateAqlRow = (index: number, field: string, val: any) => {
        const next = [...tablaAql]
        next[index] = { ...next[index], [field]: val }
        setTablaAql(next)
    }

    // Handlers para Causas
    const handleAddCausa = () => {
        setCausas(prev => [
            ...prev,
            { terminoClave: '', descripcion: '', imputable: false }
        ])
    }

    const handleUpdateCausa = (index: number, field: string, val: any) => {
        const next = [...causas]
        next[index] = { ...next[index], [field]: val }
        setCausas(next)
    }

    const handleRemoveCausa = (index: number) => {
        setCausas(prev => prev.filter((_, i) => i !== index))
    }

    const currentLic = licitaciones.find(l => l.licId === selectedLicId)

    return (
        <div className="space-y-6">
            {/* Header / Selector Licitación */}
            <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">⚙️</span>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">
                                Hub de Configuración y Parametrización de Multas
                            </h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Control modular (C1 - C11), horarios por servicio, estratos excluidos, tolerancias técnicas y tabla AQL por licitación autorizada.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="text-xs font-bold text-slate-600">Licitación:</label>
                        <select
                            value={selectedLicId}
                            onChange={e => setSelectedLicId(Number(e.target.value))}
                            className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        >
                            {licitaciones.map(l => (
                                <option key={l.licId} value={l.licId}>
                                    {l.licitacionHomologada || `Licitación ${l.licId}`} (ID: {l.licId})
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            <span>💾</span>
                            <span>{saving ? 'Guardando...' : 'Guardar Parámetros'}</span>
                        </button>
                    </div>
                </div>

                {/* Subinfo */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-4">
                        <span>Licitación Activa: <strong className="text-cyan-700 font-bold">{currentLic?.licitacionHomologada || selectedLicId}</strong></span>
                        {lastUpdated && (
                            <span>Última actualización: <strong>{lastUpdated}</strong> {usuarioModif ? `por ${usuarioModif}` : ''}</span>
                        )}
                    </div>
                    <button
                        onClick={handleReset}
                        disabled={saving || loading}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold transition-colors flex items-center gap-1"
                        title="Restablece los parámetros de esta licitación a los valores normativos de la IT"
                    >
                        <span>🔄</span>
                        <span>Restablecer Valores Oficiales</span>
                    </button>
                </div>

                {/* Feedback Messages */}
                {error && (
                    <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 animate-fadeIn">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}
                {successMessage && (
                    <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2 animate-fadeIn">
                        <span>✅</span>
                        <span>{successMessage}</span>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('modulos')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'modulos'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>🧩</span>
                    <span>Módulos de Multas (C1 - C11)</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-500 text-white text-[10px]">
                        {modulos.filter(m => m.activo).length}/{modulos.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('horarios')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'horarios'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>⏰</span>
                    <span>Horarios por Servicio (C2.1)</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-500 text-white text-[10px]">
                        {horarios.filter(h => h.activo).length}/{horarios.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('estratos')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'estratos'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>🚫</span>
                    <span>Estratos Excluidos (C2.2)</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-500 text-white text-[10px]">
                        {estratos.filter(e => e.activo).length}/{estratos.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('parametros')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'parametros'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>📐</span>
                    <span>Parámetros Técnicos (F, H, K y Plazos)</span>
                </button>

                <button
                    onClick={() => setActiveTab('aql')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'aql'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>⚖️</span>
                    <span>Tabla de Muestreo AQL (Aspecto G)</span>
                </button>

                <button
                    onClick={() => setActiveTab('causas')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'causas'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>🛡️</span>
                    <span>Causales No Imputables (Tabla N°1)</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                        {causas.length}
                    </span>
                </button>
            </div>

            {/* TAB 1: MODULOS C1 A C11 */}
            {activeTab === 'modulos' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div>
                            <h3 className="text-sm font-black text-slate-800">
                                Arquitectura de Módulos Configurables
                            </h3>
                            <p className="text-xs text-slate-500">
                                Enciende o apaga la activación de subcomponentes para esta licitación específica.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {modulos.map(m => (
                            <div
                                key={m.codigo}
                                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                                    m.activo
                                        ? 'bg-gradient-to-br from-cyan-50/40 to-sky-50/20 border-cyan-200 shadow-sm'
                                        : 'bg-slate-50/60 border-slate-200 opacity-75'
                                }`}
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[11px] font-black">
                                                {m.codigo}
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                m.fase === 'Operativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                                            }`}>
                                                {m.fase}
                                            </span>
                                        </div>

                                        {/* Toggle Switch */}
                                        <button
                                            type="button"
                                            onClick={() => handleToggleModulo(m.codigo)}
                                            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                m.activo ? 'bg-cyan-600' : 'bg-slate-300'
                                            }`}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                                    m.activo ? 'translate-x-5' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    <h4 className="text-xs font-bold text-slate-800 mt-2.5">
                                        {m.nombre}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                        {m.descripcion}
                                    </p>
                                </div>

                                {/* Acciones rápidas para C2: Horarios y Estratos */}
                                {m.codigo === 'C2' && (
                                    <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('horarios')}
                                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[10px] font-bold transition-all shadow-sm flex items-center gap-1"
                                        >
                                            <span>⏰</span>
                                            <span>Configurar Horarios</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('estratos')}
                                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[10px] font-bold transition-all shadow-sm flex items-center gap-1"
                                        >
                                            <span>🚫</span>
                                            <span>Estratos Excluidos</span>
                                        </button>
                                    </div>
                                )}

                                {/* Sub-reglas granulares para el Módulo C5 */}
                                {m.codigo === 'C5' && m.activo && (
                                    <div className="mt-3 pt-3 border-t border-cyan-200/60 space-y-2">
                                        <div className="text-[10px] font-black uppercase tracking-wider text-cyan-900 flex items-center justify-between">
                                            <span>Sub-reglas Técnicas:</span>
                                            <span className="text-[9px] text-cyan-600 font-normal">Individuales</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {[
                                                { key: 'aqlPesaje', label: 'Control AQL 6,5 (G)' },
                                                { key: 'personalManipulador', label: 'Personal H (1:70)' },
                                                { key: 'temperaturas', label: 'Rangos Térmicos (K)' },
                                                { key: 'calidadFrutasVerduras', label: 'Tolerancias Anexo 2 (F)' },
                                                { key: 'causasNoImputables', label: 'Causales No Imputables (Tabla N°1)' },
                                                { key: 'subsanabilidad', label: 'Subsanabilidad (B, E, J, L)' }
                                            ].map(sub => {
                                                const isSubActive = m.submodulos ? m.submodulos[sub.key as keyof SubModuloReglasC5] !== false : true
                                                return (
                                                    <label key={sub.key} className="flex items-center justify-between text-[11px] font-semibold text-slate-700 cursor-pointer hover:text-cyan-900">
                                                        <span>{sub.label}</span>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSubActive}
                                                            onChange={() => handleToggleSubmoduloC5(sub.key as keyof SubModuloReglasC5)}
                                                            className="rounded text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5 border-slate-300"
                                                        />
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 2: HORARIOS POR SERVICIO (C2.1) */}
            {activeTab === 'horarios' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-cyan-900 text-white text-[11px] font-black">C2.1</span>
                                <h3 className="text-sm font-black text-slate-800">
                                    Catálogo de Horarios por Servicio Oficiales
                                </h3>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Establece la ventana horaria oficial para cada servicio de la licitación. Permite detectar supervisiones fuera de horario.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleCargarHorariosSugeridos}
                                disabled={savingHorarios}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                            >
                                <span>📋</span>
                                <span>Cargar Horarios Sugeridos</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveHorarios}
                                disabled={savingHorarios}
                                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all flex items-center gap-1"
                            >
                                <span>💾</span>
                                <span>{savingHorarios ? 'Guardando...' : 'Guardar Horarios'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="p-3">Servicio</th>
                                    <th className="p-3 text-center">Hora Inicio (HH:MM)</th>
                                    <th className="p-3 text-center">Hora Fin (HH:MM)</th>
                                    <th className="p-3 text-center">Tolerancia (Min)</th>
                                    <th className="p-3 text-center">Habilitado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {horarios.map((h, idx) => (
                                    <tr key={h.servicioCodigo} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-3 font-semibold text-slate-800 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-md bg-cyan-100 text-cyan-800 text-[11px] font-black flex items-center justify-center shrink-0">
                                                {h.servicioCodigo}
                                            </span>
                                            <span>{h.servicioNombre}</span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="time"
                                                value={h.horaInicio}
                                                onChange={e => handleUpdateHorario(idx, 'horaInicio', e.target.value)}
                                                className="px-2.5 py-1 text-center bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="time"
                                                value={h.horaFin}
                                                onChange={e => handleUpdateHorario(idx, 'horaFin', e.target.value)}
                                                className="px-2.5 py-1 text-center bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                max="120"
                                                value={h.toleranciaMinutos}
                                                onChange={e => handleUpdateHorario(idx, 'toleranciaMinutos', Number(e.target.value))}
                                                className="w-16 px-2 py-1 text-center bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateHorario(idx, 'activo', !h.activo)}
                                                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                    h.activo ? 'bg-cyan-600' : 'bg-slate-300'
                                                }`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                                        h.activo ? 'translate-x-5' : 'translate-x-0'
                                                    }`}
                                                />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: ESTRATOS EXCLUIDOS (C2.2) */}
            {activeTab === 'estratos' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-amber-900 text-white text-[11px] font-black">C2.2</span>
                                <h3 className="text-sm font-black text-slate-800">
                                    Estratos Excluidos de Raciones (PMPA)
                                </h3>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Estratos que no se suman a las raciones evaluadas según norma JUNAEB (ej. 206, 208, 209). Solo se aplican si el módulo C2 está activo.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleCargarEstratosSugeridos}
                            disabled={savingEstrato}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 self-start sm:self-auto"
                        >
                            <span>📋</span>
                            <span>Cargar Sugeridos JUNAEB (206, 208, 209)</span>
                        </button>
                    </div>

                    {/* Formulario rápido para agregar estrato */}
                    <form onSubmit={handleAddEstrato} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-end gap-3">
                        <div className="w-full md:w-40">
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Código Estrato</label>
                            <input
                                type="text"
                                placeholder="Ej: 206"
                                value={nuevoEstrato}
                                onChange={e => setNuevoEstrato(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                        <div className="w-full md:flex-1">
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Descripción / Motivo Exclusión</label>
                            <input
                                type="text"
                                placeholder="Motivo oficial o alcance de la exclusión..."
                                value={descEstrato}
                                onChange={e => setDescEstrato(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={savingEstrato || !nuevoEstrato.trim()}
                            className="w-full md:w-auto px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1 disabled:opacity-50 shrink-0"
                        >
                            <span>➕</span>
                            <span>Agregar Estrato</span>
                        </button>
                    </form>

                    {/* Tabla de estratos registrados */}
                    <div className="space-y-2">
                        {estratos.length === 0 ? (
                            <p className="text-xs text-slate-400 italic text-center py-4">
                                No hay estratos excluidos configurados para esta licitación. Haz clic en &quot;Cargar Sugeridos JUNAEB&quot; para precargar 206, 208 y 209.
                            </p>
                        ) : (
                            estratos.map(est => (
                                <div
                                    key={est.id}
                                    className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 hover:border-slate-300 transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 font-black text-xs">
                                            {est.estrato}
                                        </span>
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">
                                                {est.descripcion || 'Sin descripción'}
                                            </p>
                                            <span className="text-[10px] text-slate-400">
                                                {est.activo ? '🟢 Activo en cálculo' : '⚪ Inactivo'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleEstrato(est.id, est.activo)}
                                            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                est.activo ? 'bg-cyan-600' : 'bg-slate-300'
                                            }`}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                                    est.activo ? 'translate-x-5' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleDeleteEstrato(est.id, est.estrato)}
                                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-xs transition-colors"
                                            title="Eliminar estrato"
                                        >
                                            <span>🗑️</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB 4: PARAMETROS TECNICOS */}
            {activeTab === 'parametros' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div>
                        <h3 className="text-sm font-black text-slate-800">
                            Umbrales Técnicos y Fórmulas
                        </h3>
                        <p className="text-xs text-slate-500">
                            Ajusta los valores de ratio, rangos térmicos y tolerancias que alimentan el motor de cálculo y alertas.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Aspecto H */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-cyan-700 text-white text-[11px] font-black">Aspecto H</span>
                                <h4 className="text-xs font-bold text-slate-800">Dotación Manipuladoras</h4>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Raciones por cada manipuladora requerida a nivel de establecimiento educacional.
                            </p>
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-bold text-slate-600">Ratio (1:N):</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="500"
                                    value={ratioH}
                                    onChange={e => setRatioH(Number(e.target.value))}
                                    className="w-24 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                />
                                <span className="text-xs text-slate-500">raciones / manipuladora</span>
                            </div>
                        </div>

                        {/* Plazos de Subsanabilidad */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-emerald-700 text-white text-[11px] font-black">Plazos IT</span>
                                <h4 className="text-xs font-bold text-slate-800">Periodo de Corrección Subsanable</h4>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Días hábiles para subsanar aspectos con periodo de corrección (B, E, J, L según Anexo 3).
                            </p>
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-bold text-slate-600">Plazo:</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={plazoCorreccion}
                                    onChange={e => setPlazoCorreccion(Number(e.target.value))}
                                    className="w-24 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                />
                                <span className="text-xs text-slate-500">días hábiles</span>
                            </div>
                        </div>

                        {/* Aspecto K - Temperaturas */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-sky-700 text-white text-[11px] font-black">Aspecto K</span>
                                <h4 className="text-xs font-bold text-slate-800">Rangos Térmicos Reglamentarios</h4>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Límites máximos y mínimos para equipos de frío en visitas de supervisión.
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Refri Mín (°C)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={tempRefriMin}
                                        onChange={e => setTempRefriMin(Number(e.target.value))}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Refri Máx (°C)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={tempRefriMax}
                                        onChange={e => setTempRefriMax(Number(e.target.value))}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Congelación Máx (°C)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={tempCongelacionMax}
                                        onChange={e => setTempCongelacionMax(Number(e.target.value))}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Aspecto F - Tolerancias Frutas y Verduras */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-amber-700 text-white text-[11px] font-black">Aspecto F</span>
                                <h4 className="text-xs font-bold text-slate-800">Tolerancias de Calidad (Anexo 2)</h4>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Porcentajes máximos admisibles de defectos en frutas y hortalizas.
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Leves Máx (%)</label>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        max="100"
                                        value={tolLeve}
                                        onChange={e => setTolLeve(Number(e.target.value))}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Moderados Máx (%)</label>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        max="100"
                                        value={tolMod}
                                        onChange={e => setTolMod(Number(e.target.value))}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Graves Máx (%)</label>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        max="100"
                                        value={tolGrave}
                                        onChange={e => setTolGrave(Number(e.target.value))}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: TABLA AQL */}
            {activeTab === 'aql' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div>
                            <h3 className="text-sm font-black text-slate-800">
                                Tabla de Muestreo Militar Estándar AQL 6,5 (Aspecto G)
                            </h3>
                            <p className="text-xs text-slate-500">
                                Determina la cantidad mínima obligatoria de bandejas a pesar según raciones del nivel supervisado. (Max: &quot;Sin tope&quot; para la última fila).
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="p-3">Rango de Raciones</th>
                                    <th className="p-3 text-center">Raciones Mín</th>
                                    <th className="p-3 text-center">Raciones Máx</th>
                                    <th className="p-3 text-center">Muestra Exigida (Bandejas)</th>
                                    <th className="p-3 text-center">Aceptación (Ac)</th>
                                    <th className="p-3 text-center">Rechazo (Re)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {tablaAql.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-3 font-semibold text-slate-700">
                                            {row.rangoTexto || `${row.min} a ${row.max === Infinity || row.max === null || row.max === undefined ? 'más' : row.max} raciones`}
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="number"
                                                value={row.min}
                                                onChange={e => handleUpdateAqlRow(idx, 'min', Number(e.target.value))}
                                                className="w-16 px-2 py-1 text-center bg-white border border-slate-200 rounded text-xs font-bold"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="text"
                                                value={row.max === Infinity || row.max === null || row.max === undefined ? 'Sin tope' : row.max}
                                                onChange={e => {
                                                    const v = e.target.value.trim()
                                                    if (v === '' || v.toLowerCase() === 'sin tope' || v === '∞' || Number(v) >= 999999) {
                                                        handleUpdateAqlRow(idx, 'max', Infinity)
                                                    } else {
                                                        handleUpdateAqlRow(idx, 'max', Number(v))
                                                    }
                                                }}
                                                className="w-20 px-2 py-1 text-center bg-white border border-slate-200 rounded text-xs font-bold"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="number"
                                                value={row.muestra}
                                                onChange={e => handleUpdateAqlRow(idx, 'muestra', Number(e.target.value))}
                                                className="w-16 px-2 py-1 text-center bg-cyan-50 border border-cyan-200 text-cyan-800 rounded text-xs font-black"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="number"
                                                value={row.ac}
                                                onChange={e => handleUpdateAqlRow(idx, 'ac', Number(e.target.value))}
                                                className="w-14 px-2 py-1 text-center bg-white border border-slate-200 rounded text-xs font-bold"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="number"
                                                value={row.re}
                                                onChange={e => handleUpdateAqlRow(idx, 're', Number(e.target.value))}
                                                className="w-14 px-2 py-1 text-center bg-white border border-slate-200 rounded text-xs font-bold"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 6: CAUSAS NO IMPUTABLES */}
            {activeTab === 'causas' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div>
                            <h3 className="text-sm font-black text-slate-800">
                                Términos Clave de Causales No Imputables (Tabla N°1 IT)
                            </h3>
                            <p className="text-xs text-slate-500">
                                El motor analizará las observaciones del acta buscando estos términos con coincidencia exacta de límites de palabra.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleAddCausa}
                            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                        >
                            <span>➕</span>
                            <span>Agregar Término</span>
                        </button>
                    </div>

                    <div className="space-y-3">
                        {causas.map((c, idx) => (
                            <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                                <div className="w-full md:w-1/3">
                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Término Clave (Búsqueda RegExp)</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: corte de agua, toma del establecimiento..."
                                        value={c.terminoClave || ''}
                                        onChange={e => handleUpdateCausa(idx, 'terminoClave', e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                                <div className="w-full md:flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Descripción Legal / Causal</label>
                                    <input
                                        type="text"
                                        placeholder="Descripción oficial de la causa..."
                                        value={c.descripcion || ''}
                                        onChange={e => handleUpdateCausa(idx, 'descripcion', e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-3 md:pt-0 self-end md:self-center">
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveCausa(idx)}
                                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-xs transition-colors"
                                        title="Eliminar causal"
                                    >
                                        <span>🗑️</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
