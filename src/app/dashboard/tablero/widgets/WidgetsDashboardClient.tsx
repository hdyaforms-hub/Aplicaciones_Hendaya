'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    AVAILABLE_WIDGETS_CATALOG,
    WidgetCatalogItem,
    WidgetCategory
} from './WidgetComponents'
import {
    WidgetLayoutData,
    saveUserWidgetLayoutAction,
    deleteUserWidgetLayoutAction,
    logWidgetLayoutLoadedAction,
    fetchPlatformWidgetsDataAction
} from './actions'

// Definición de tipos de esqueletos
export type LayoutSkeletonType = 'grid-2x2' | 'hero-1-3' | 'analytics-kpi' | 'grid-3x2' | 'asymmetric' | 'free'

interface SkeletonConfig {
    id: LayoutSkeletonType
    name: string
    description: string
    icon: string
    slotsCount: number
    getGridClasses: () => string
    getSlotSpanClass: (slotIndex: number) => string
}

const LAYOUT_SKELETONS: SkeletonConfig[] = [
    {
        id: 'grid-2x2',
        name: 'Cuadrícula 2x2',
        description: '4 widgets equilibrados en 2 columnas',
        icon: '⊞',
        slotsCount: 4,
        getGridClasses: () => 'grid grid-cols-1 md:grid-cols-2 gap-4',
        getSlotSpanClass: () => 'col-span-1 min-h-[300px]'
    },
    {
        id: 'hero-1-3',
        name: 'Panel Ejecutivo (1+3)',
        description: '1 widget principal ancho + 3 inferiores',
        icon: '⫿',
        slotsCount: 4,
        getGridClasses: () => 'grid grid-cols-1 md:grid-cols-3 gap-4',
        getSlotSpanClass: (idx) => idx === 0 ? 'md:col-span-3 min-h-[220px]' : 'md:col-span-1 min-h-[300px]'
    },
    {
        id: 'analytics-kpi',
        name: 'Panel Analítico',
        description: 'KPIs superiores + 2 paneles grandes',
        icon: '📊',
        slotsCount: 3,
        getGridClasses: () => 'grid grid-cols-1 md:grid-cols-2 gap-4',
        getSlotSpanClass: (idx) => idx === 0 ? 'md:col-span-2 min-h-[200px]' : 'md:col-span-1 min-h-[320px]'
    },
    {
        id: 'grid-3x2',
        name: 'Cuadrícula 3x2',
        description: '6 widgets compactos en 3 columnas',
        icon: '▦',
        slotsCount: 6,
        getGridClasses: () => 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
        getSlotSpanClass: () => 'col-span-1 min-h-[290px]'
    },
    {
        id: 'asymmetric',
        name: 'Columna Asimétrica',
        description: '1 columna lateral fija + panel central',
        icon: '◫',
        slotsCount: 3,
        getGridClasses: () => 'grid grid-cols-1 lg:grid-cols-12 gap-4',
        getSlotSpanClass: (idx) => idx === 0 ? 'lg:col-span-4 min-h-[320px]' : 'lg:col-span-8 min-h-[320px]'
    },
    {
        id: 'free',
        name: 'Cuadrícula Libre',
        description: 'Añade y distribuye ranuras a tu gusto',
        icon: '➕',
        slotsCount: 4,
        getGridClasses: () => 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
        getSlotSpanClass: () => 'col-span-1 min-h-[300px]'
    }
]

// Formatos predeterminados del sistema
const SYSTEM_PRESETS = [
    {
        id: 'sys-ejecutivo',
        name: '✨ Vista Ejecutiva Global',
        description: 'Visión de alto nivel con KPIs, raciones PMPA, mantenimiento preventivo y actas.',
        layoutType: 'hero-1-3' as LayoutSkeletonType,
        slots: ['kpis-ejecutivo', 'pmpa-raciones', 'trabajos-preventivos', 'actas-supervision']
    },
    {
        id: 'sys-logistica',
        name: '📦 Vista Logística y Abastecimiento',
        description: 'Raciones PMPA, Solicitudes de Pan, Solicitudes de Gas y Retiro de Saldos.',
        layoutType: 'grid-2x2' as LayoutSkeletonType,
        slots: ['pmpa-raciones', 'solicitudes-pan', 'solicitudes-gas', 'retiro-saldos']
    },
    {
        id: 'sys-operaciones',
        name: '🔧 Vista Operaciones y Calidad',
        description: 'Mantenimiento preventivo, presupuesto, elementos esenciales y temperaturas.',
        layoutType: 'grid-2x2' as LayoutSkeletonType,
        slots: ['trabajos-preventivos', 'presupuesto-mantenimiento', 'elementos-esenciales', 'verificador-temperaturas']
    },
    {
        id: 'sys-supervision',
        name: '🚗 Vista Supervisión en Terreno',
        description: 'Actas de supervisión, matriz de riesgo 2026, kilometraje y multas EE.',
        layoutType: 'grid-2x2' as LayoutSkeletonType,
        slots: ['actas-supervision', 'matriz-riesgo', 'kilometraje-supervisores', 'multas-ee']
    }
]

type SlotItem = {
    slotId: string
    widgetId: string | null
    colSpan?: 1 | 2 | 3
}

type Props = {
    initialLayouts: WidgetLayoutData[]
    initialData: any
    currentUser: {
        username: string
        name?: string | null
        roleName?: string | null
    }
}

export default function WidgetsDashboardClient({ initialLayouts, initialData, currentUser }: Props) {
    const [layoutsList, setLayoutsList] = useState<WidgetLayoutData[]>(initialLayouts)
    const [platformData, setPlatformData] = useState<any>(initialData)
    const [loadingData, setLoadingData] = useState(false)

    // Estado del tablero activo
    const [selectedPresetId, setSelectedPresetId] = useState<string>('sys-ejecutivo')
    const [currentSkeleton, setCurrentSkeleton] = useState<LayoutSkeletonType>('hero-1-3')
    const [slots, setSlots] = useState<SlotItem[]>([
        { slotId: 'slot-0', widgetId: 'kpis-ejecutivo' },
        { slotId: 'slot-1', widgetId: 'pmpa-raciones' },
        { slotId: 'slot-2', widgetId: 'trabajos-preventivos' },
        { slotId: 'slot-3', widgetId: 'actas-supervision' }
    ])

    // Modales
    const [catalogModalOpen, setCatalogModalOpen] = useState(false)
    const [targetSlotIndex, setTargetSlotIndex] = useState<number | null>(null)
    const [saveModalOpen, setSaveModalOpen] = useState(false)
    const [maximizedWidgetId, setMaximizedWidgetId] = useState<string | null>(null)

    // Filtros del catálogo
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL')

    // Formulario de guardado
    const [saveFormName, setSaveFormName] = useState('')
    const [saveFormDesc, setSaveFormDesc] = useState('')
    const [saveFormDefault, setSaveFormDefault] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [toastMessage, setToastMessage] = useState<string | null>(null)

    // Notificaciones Toast
    const showToast = (msg: string) => {
        setToastMessage(msg)
        setTimeout(() => setToastMessage(null), 4000)
    }

    // Recargar datos de métricas
    const refreshData = async () => {
        setLoadingData(true)
        try {
            const fresh = await fetchPlatformWidgetsDataAction()
            setPlatformData(fresh)
            showToast('Métricas actualizadas exitosamente')
        } catch (e) {
            console.error('Error refrescando datos:', e)
            showToast('Error al refrescar las métricas')
        } finally {
            setLoadingData(false)
        }
    }

    // Inicializar con formato predeterminado si existe
    useEffect(() => {
        const defaultUserLayout = layoutsList.find(l => l.isDefault)
        if (defaultUserLayout) {
            applySavedLayout(defaultUserLayout, false)
        }
    }, [])

    // Cambiar esqueleto respetando widgets existentes
    const handleSkeletonChange = (newSkeleton: LayoutSkeletonType) => {
        setCurrentSkeleton(newSkeleton)
        const skelDef = LAYOUT_SKELETONS.find(s => s.id === newSkeleton)
        const count = skelDef?.slotsCount || 4

        setSlots(prev => {
            const newSlots: SlotItem[] = []
            for (let i = 0; i < count; i++) {
                newSlots.push({
                    slotId: `slot-${i}`,
                    widgetId: prev[i]?.widgetId || null
                })
            }
            return newSlots
        })
    }

    // Aplicar un formato predeterminado del sistema
    const applySystemPreset = (presetId: string) => {
        const preset = SYSTEM_PRESETS.find(p => p.id === presetId)
        if (!preset) return

        setSelectedPresetId(preset.id)
        setCurrentSkeleton(preset.layoutType)
        setSlots(preset.slots.map((wId, idx) => ({
            slotId: `slot-${idx}`,
            widgetId: wId
        })))

        logWidgetLayoutLoadedAction(preset.name)
        showToast(`Formato cargado: ${preset.name}`)
    }

    // Aplicar un formato guardado por el usuario
    const applySavedLayout = (layout: WidgetLayoutData, notify = true) => {
        try {
            const parsedConfig = JSON.parse(layout.configJson)
            setSelectedPresetId(layout.id)
            setCurrentSkeleton(layout.layoutType as LayoutSkeletonType)
            setSlots(parsedConfig)

            logWidgetLayoutLoadedAction(layout.name)
            if (notify) showToast(`Formato cargado: ${layout.name}`)
        } catch (err) {
            console.error('Error aplicando formato guardado:', err)
            showToast('No se pudo cargar la configuración del formato')
        }
    }

    // Manejar selección en el dropdown
    const handleDropdownChange = (val: string) => {
        if (!val) return
        if (val.startsWith('sys-')) {
            applySystemPreset(val)
        } else {
            const userLayout = layoutsList.find(l => l.id === val)
            if (userLayout) applySavedLayout(userLayout)
        }
    }

    // Abrir selector de widget para un slot
    const openWidgetSelector = (slotIndex: number) => {
        setTargetSlotIndex(slotIndex)
        setCatalogModalOpen(true)
    }

    // Asignar widget a un slot
    const assignWidgetToSlot = (widgetId: string) => {
        if (targetSlotIndex === null) return
        setSlots(prev => {
            const next = [...prev]
            next[targetSlotIndex] = {
                ...next[targetSlotIndex],
                widgetId
            }
            return next
        })
        setCatalogModalOpen(false)
        setTargetSlotIndex(null)
    }

    // Quitar widget de un slot
    const removeWidgetFromSlot = (slotIndex: number) => {
        setSlots(prev => {
            const next = [...prev]
            next[slotIndex] = { ...next[slotIndex], widgetId: null }
            return next
        })
    }

    // Tablero en blanco
    const handleNewBlankDashboard = () => {
        setSelectedPresetId('custom-blank')
        setSlots(slots.map(s => ({ ...s, widgetId: null })))
        showToast('Tablero en blanco listo para configurar')
    }

    // Añadir ranura en modo libre
    const addFreeSlot = () => {
        setSlots(prev => [
            ...prev,
            { slotId: `slot-${prev.length}`, widgetId: null }
        ])
    }

    // Guardar formato
    const handleSaveLayout = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!saveFormName.trim()) {
            setSaveError('Ingresa un nombre para el formato')
            return
        }

        setIsSaving(true)
        setSaveError(null)

        const activeUserLayout = layoutsList.find(l => l.id === selectedPresetId)
        const isUpdatingExisting = activeUserLayout && activeUserLayout.username === currentUser.username

        const payload = {
            id: isUpdatingExisting ? activeUserLayout.id : undefined,
            name: saveFormName.trim(),
            description: saveFormDesc.trim() || undefined,
            layoutType: currentSkeleton,
            configJson: JSON.stringify(slots),
            isDefault: saveFormDefault
        }

        const res = await saveUserWidgetLayoutAction(payload)
        setIsSaving(false)

        if (res.success && res.layout) {
            setSaveModalOpen(false)
            setSaveFormName('')
            setSaveFormDesc('')
            showToast(`Formato "${res.layout.name}" guardado exitosamente`)

            // Actualizar lista local de layouts
            setLayoutsList(prev => {
                const filtered = prev.filter(l => l.id !== res.layout.id)
                return [res.layout, ...filtered]
            })
            setSelectedPresetId(res.layout.id)
        } else {
            setSaveError(res.error || 'Ocurrió un error al guardar')
        }
    }

    // Eliminar formato del usuario
    const handleDeleteLayout = async () => {
        const layoutToDelete = layoutsList.find(l => l.id === selectedPresetId)
        if (!layoutToDelete) return

        if (!confirm(`¿Estás seguro de eliminar el formato "${layoutToDelete.name}"?`)) return

        const res = await deleteUserWidgetLayoutAction(layoutToDelete.id)
        if (res.success) {
            showToast(`Formato "${layoutToDelete.name}" eliminado`)
            setLayoutsList(prev => prev.filter(l => l.id !== layoutToDelete.id))
            applySystemPreset('sys-ejecutivo')
        } else {
            showToast(res.error || 'Error al eliminar')
        }
    }

    // Catálogo filtrado
    const filteredWidgets = useMemo(() => {
        return AVAILABLE_WIDGETS_CATALOG.filter(w => {
            const matchesCategory = selectedCategory === 'ALL' || w.category === selectedCategory
            const matchesSearch = searchQuery === '' ||
                w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                w.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                w.badge.toLowerCase().includes(searchQuery.toLowerCase())
            return matchesCategory && matchesSearch
        })
    }, [searchQuery, selectedCategory])

    const currentSkeletonDef = LAYOUT_SKELETONS.find(s => s.id === currentSkeleton) || LAYOUT_SKELETONS[0]
    const isCustomActiveLayout = layoutsList.some(l => l.id === selectedPresetId)

    // Categorías del catálogo
    const categories: { key: string; label: string }[] = [
        { key: 'ALL', label: 'Todos los Widgets' },
        { key: 'KPIs Rápidos', label: 'KPIs Rápidos' },
        { key: 'Abastecimiento y Logística', label: 'Abastecimiento y Logística' },
        { key: 'Operaciones y Mantenimiento', label: 'Operaciones y Mantenimiento' },
        { key: 'Calidad y Temperaturas', label: 'Calidad y Temperaturas' },
        { key: 'Supervisión y Terreno', label: 'Supervisión y Terreno' },
        { key: 'Gestión y Auditoría', label: 'Gestión y Auditoría' }
    ]

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 flex flex-col gap-6">
            {/* TOAST NOTIFICACIÓN */}
            {toastMessage && (
                <div className="fixed top-5 right-5 z-50 bg-sky-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-sky-400 animate-in fade-in slide-in-from-top-4 duration-300">
                    <span className="text-xl">✨</span>
                    <span className="text-sm font-medium">{toastMessage}</span>
                </div>
            )}

            {/* HEADER DEL MÓDULO */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">🧩</span>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                                Tablero Dinámico de Widgets
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    HENDAYA
                                </span>
                            </h1>
                            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                                Diseña tu tablero a medida seleccionando esquemas de distribución y widgets con información en tiempo real.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ACCIONES SUPERIORES */}
                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    {/* SELECTOR DESPLEGABLE DE FORMATOS */}
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 focus-within:border-sky-500">
                        <span className="text-sm text-slate-400">📁 Formato:</span>
                        <select
                            value={selectedPresetId}
                            onChange={(e) => handleDropdownChange(e.target.value)}
                            className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer max-w-[200px] truncate"
                        >
                            <optgroup label="Formatos del Sistema">
                                {SYSTEM_PRESETS.map(p => (
                                    <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                                        {p.name}
                                    </option>
                                ))}
                            </optgroup>
                            {layoutsList.length > 0 && (
                                <optgroup label="Mis Formatos Guardados">
                                    {layoutsList.map(l => (
                                        <option key={l.id} value={l.id} className="bg-slate-900 text-slate-200">
                                            ⭐ {l.name} {l.isDefault ? '(Predeterminado)' : ''}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    </div>

                    {/* BOTÓN GUARDAR FORMATO */}
                    <button
                        onClick={() => {
                            const activeUserLayout = layoutsList.find(l => l.id === selectedPresetId)
                            setSaveFormName(activeUserLayout ? activeUserLayout.name : 'Mi Tablero Personalizado')
                            setSaveFormDesc(activeUserLayout?.description || '')
                            setSaveFormDefault(activeUserLayout?.isDefault || false)
                            setSaveModalOpen(true)
                        }}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-xs md:text-sm font-semibold hover:from-sky-600 hover:to-cyan-600 shadow-lg shadow-sky-500/20 transition-all duration-200 hover:scale-[1.02]"
                    >
                        <span>💾</span>
                        <span>Guardar Formato</span>
                    </button>

                    {/* BOTÓN ELIMINAR FORMATO (SI ES PERSONALIZADO) */}
                    {isCustomActiveLayout && (
                        <button
                            onClick={handleDeleteLayout}
                            title="Eliminar formato personalizado"
                            className="px-3 py-2 rounded-xl bg-red-950/40 text-red-400 border border-red-800/40 text-xs md:text-sm font-medium hover:bg-red-900/60 transition-all"
                        >
                            🗑️
                        </button>
                    )}

                    {/* BOTÓN TABLERO EN BLANCO */}
                    <button
                        onClick={handleNewBlankDashboard}
                        title="Limpiar tablero e iniciar en blanco"
                        className="px-3 py-2 rounded-xl bg-slate-800/80 text-slate-300 border border-slate-700 text-xs md:text-sm font-medium hover:bg-slate-700 transition-all"
                    >
                        ➕ En blanco
                    </button>

                    {/* BOTÓN REFRESCAR MÉTRICAS */}
                    <button
                        onClick={refreshData}
                        disabled={loadingData}
                        title="Actualizar datos de todos los widgets"
                        className="p-2 rounded-xl bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all flex items-center justify-center disabled:opacity-50"
                    >
                        <span className={`text-sm ${loadingData ? 'animate-spin' : ''}`}>🔄</span>
                    </button>
                </div>
            </div>

            {/* SELECTOR DE ESQUELETOS (LAYOUTS) */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Esqueleto de Distribución:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {LAYOUT_SKELETONS.map(skel => {
                        const isActive = currentSkeleton === skel.id
                        return (
                            <button
                                key={skel.id}
                                onClick={() => handleSkeletonChange(skel.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                                    isActive
                                        ? 'bg-sky-500/20 text-sky-300 border-sky-500 shadow-md shadow-sky-500/10'
                                        : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800 hover:text-slate-200'
                                }`}
                                title={skel.description}
                            >
                                <span className="text-base leading-none">{skel.icon}</span>
                                <span>{skel.name}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* LIENZO PRINCIPAL DEL TABLERO */}
            <div className={`w-full ${currentSkeletonDef.getGridClasses()}`}>
                {slots.map((slot, index) => {
                    const assignedDef = AVAILABLE_WIDGETS_CATALOG.find(w => w.id === slot.widgetId)
                    const spanClass = currentSkeletonDef.getSlotSpanClass(index)

                    if (!assignedDef) {
                        // SLOT VACÍO CON ESQUELETO INTERACTIVO
                        return (
                            <div
                                key={slot.slotId}
                                className={`${spanClass} rounded-2xl border-2 border-dashed border-slate-700/70 bg-slate-900/40 p-6 flex flex-col items-center justify-center text-center transition-all duration-300 hover:border-sky-500/60 hover:bg-slate-900/70 group`}
                            >
                                <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-2xl mb-3 text-slate-400 group-hover:text-sky-400 group-hover:scale-110 group-hover:border-sky-500/50 transition-all duration-300">
                                    ➕
                                </div>
                                <h3 className="text-sm font-semibold text-slate-300 group-hover:text-white">
                                    Espacio Disponible {index + 1}
                                </h3>
                                <p className="text-xs text-slate-400 max-w-[240px] mt-1 mb-4">
                                    Haz clic para asignar un widget con métricas de la plataforma Hendaya.
                                </p>
                                <button
                                    onClick={() => openWidgetSelector(index)}
                                    className="px-4 py-2 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-semibold hover:bg-sky-500 hover:text-white transition-all duration-200 shadow-md shadow-sky-500/10"
                                >
                                    + Seleccionar Widget
                                </button>
                            </div>
                        )
                    }

                    const WidgetComponent = assignedDef.component

                    return (
                        <div
                            key={slot.slotId}
                            className={`${spanClass} rounded-2xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-sm p-4 md:p-5 flex flex-col justify-between shadow-xl transition-all duration-300 hover:border-slate-700/80`}
                        >
                            {/* CABECERA DEL WIDGET */}
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-lg">{assignedDef.icon}</span>
                                    <h3 className="text-sm font-bold text-white truncate" title={assignedDef.title}>
                                        {assignedDef.title}
                                    </h3>
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 hidden sm:inline-block">
                                        {assignedDef.badge}
                                    </span>
                                </div>

                                {/* ACCIONES DEL WIDGET */}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => openWidgetSelector(index)}
                                        title="Cambiar widget por otro"
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors text-xs"
                                    >
                                        🔄
                                    </button>
                                    <button
                                        onClick={() => setMaximizedWidgetId(assignedDef.id)}
                                        title="Maximizar widget"
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors text-xs"
                                    >
                                        ⛶
                                    </button>
                                    <button
                                        onClick={() => removeWidgetFromSlot(index)}
                                        title="Quitar widget de este espacio"
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors text-xs"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* CUERPO DEL WIDGET */}
                            <div className="flex-1 w-full overflow-hidden">
                                <WidgetComponent data={platformData} />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* BOTÓN AÑADIR RANURA EN MODO LIBRE */}
            {currentSkeleton === 'free' && (
                <div className="flex justify-center pt-2 pb-6">
                    <button
                        onClick={addFreeSlot}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-dashed border-sky-500/50 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 text-sm font-semibold transition-all shadow-md shadow-sky-500/10"
                    >
                        <span>➕</span>
                        <span>Añadir otra ranura de widget</span>
                    </button>
                </div>
            )}

            {/* MODAL CATÁLOGO DE WIDGETS */}
            {catalogModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* CABECERA MODAL */}
                        <div className="p-5 md:p-6 border-b border-slate-800 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span>🧩</span> Catálogo de Widgets de la Plataforma
                                </h2>
                                <p className="text-xs text-slate-400 mt-1">
                                    Selecciona el widget que deseas colocar en la ranura {(targetSlotIndex ?? 0) + 1}.
                                </p>
                            </div>
                            <button
                                onClick={() => setCatalogModalOpen(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        {/* FILTROS Y BÚSQUEDA */}
                        <div className="p-5 border-b border-slate-800 space-y-3 bg-slate-950/40">
                            <div className="relative">
                                <span className="absolute left-3.5 top-3 text-slate-500 text-sm">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Buscar widget por nombre, módulo o descripción..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-all"
                                />
                            </div>

                            {/* PESTAÑAS DE CATEGORÍAS */}
                            <div className="flex flex-wrap gap-2 pt-1">
                                {categories.map(cat => (
                                    <button
                                        key={cat.key}
                                        onClick={() => setSelectedCategory(cat.key)}
                                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                            selectedCategory === cat.key
                                                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                                                : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                                        }`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* LISTADO DE TARJETAS DE WIDGETS */}
                        <div className="p-5 md:p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredWidgets.map(widget => (
                                <div
                                    key={widget.id}
                                    onClick={() => assignWidgetToSlot(widget.id)}
                                    className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 hover:border-sky-500/60 hover:bg-slate-900 transition-all duration-200 cursor-pointer flex flex-col justify-between group hover:shadow-lg hover:shadow-sky-500/5"
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 group-hover:scale-110 transition-transform">
                                                    {widget.icon}
                                                </span>
                                                <div>
                                                    <h4 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
                                                        {widget.title}
                                                    </h4>
                                                    <span className="text-[11px] text-slate-400">
                                                        {widget.category}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                                {widget.badge}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                                            {widget.description}
                                        </p>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Métricas en tiempo real</span>
                                        <span className="font-semibold text-sky-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                            Colocar aquí →
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL GUARDAR FORMATO */}
            {saveModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <span>💾</span> Guardar Formato de Tablero
                            </h3>
                            <button
                                onClick={() => setSaveModalOpen(false)}
                                className="text-slate-400 hover:text-white text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveLayout} className="space-y-4">
                            {saveError && (
                                <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-xs">
                                    {saveError}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    Nombre del Formato <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Monitoreo Semanal de Operaciones"
                                    value={saveFormName}
                                    onChange={(e) => setSaveFormName(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    Descripción (Opcional)
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Breve detalle del propósito de este formato..."
                                    value={saveFormDesc}
                                    onChange={(e) => setSaveFormDesc(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="isDefaultCheckbox"
                                    checked={saveFormDefault}
                                    onChange={(e) => setSaveFormDefault(e.target.checked)}
                                    className="w-4 h-4 rounded text-sky-600 bg-slate-800 border-slate-700 focus:ring-sky-500 cursor-pointer"
                                />
                                <label htmlFor="isDefaultCheckbox" className="text-xs text-slate-300 cursor-pointer">
                                    Establecer como mi formato predeterminado al ingresar
                                </label>
                            </div>

                            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSaveModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-xs font-semibold hover:from-sky-600 hover:to-cyan-600 disabled:opacity-50 shadow-md shadow-sky-500/20"
                                >
                                    {isSaving ? 'Guardando...' : 'Guardar Formato'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL WIDGET MAXIMIZADO */}
            {maximizedWidgetId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl h-[80vh] flex flex-col p-6 shadow-2xl">
                        {(() => {
                            const def = AVAILABLE_WIDGETS_CATALOG.find(w => w.id === maximizedWidgetId)
                            if (!def) return null
                            const Component = def.component
                            return (
                                <>
                                    <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-2xl">{def.icon}</span>
                                            <div>
                                                <h3 className="text-lg font-bold text-white">{def.title}</h3>
                                                <p className="text-xs text-slate-400">{def.description}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setMaximizedWidgetId(null)}
                                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xl"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <div className="flex-1 w-full overflow-y-auto">
                                        <Component data={platformData} />
                                    </div>
                                </>
                            )
                        })()}
                    </div>
                </div>
            )}
        </div>
    )
}
