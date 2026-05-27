'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createVehiculo, updateVehiculo, deleteVehiculo, createTipoVehiculo } from './actions'

interface Vehiculo {
    id: string
    patente: string
    utId: number | null
    sucursalId: string
    tipoVehiculoId: string
    vigente: boolean
    licId: number | null
    utIds: string | null
    ut: { codUT: number; sucursalId: string | null } | null
    sucursal: { id: string; nombre: string }
    tipoVehiculo: { id: string; nombre: string }
    licitacion: { licId: number; licitacionHomologada: string | null } | null
}

interface TipoVehiculo {
    id: string
    nombre: string
}

interface UT {
    codUT: number
    sucursalId: string | null
    licId: number
    sucursal: { id: string; nombre: string } | null
    licitacion: { licId: number; licitacionHomologada: string | null } | null
}

interface Licitacion {
    licId: number
    licitacionHomologada: string | null
}

interface Sucursal {
    id: string
    nombre: string
}

interface VehiculosClientProps {
    initialVehiculos: any[]
    initialTipoVehiculos: TipoVehiculo[]
    uts: UT[]
    licitaciones: Licitacion[]
    sucursales: Sucursal[]
}

export default function VehiculosClient({
    initialVehiculos,
    initialTipoVehiculos,
    uts,
    licitaciones,
    sucursales
}: VehiculosClientProps) {
    const [vehiculos, setVehiculos] = useState<any[]>(initialVehiculos)
    const [tipoVehiculos, setTipoVehiculos] = useState<TipoVehiculo[]>(initialTipoVehiculos)
    const [isAdding, setIsAdding] = useState(false)
    const [isAddingType, setIsAddingType] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    
    // Alert feedback states
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // Form states
    const [formData, setFormData] = useState({
        patente: '',
        sucursalId: '',
        tipoVehiculoId: '',
        licId: '',
        selectedUTs: [] as number[],
        vigente: true
    })

    const [newTypeName, setNewTypeName] = useState('')

    const router = useRouter()

    const resetForm = () => {
        setFormData({
            patente: '',
            sucursalId: '',
            tipoVehiculoId: '',
            licId: '',
            selectedUTs: [] as number[],
            vigente: true
        })
        setEditingId(null)
        setIsAdding(false)
        setError(null)
    }

    const handleEdit = (v: Vehiculo) => {
        let activeUTs: number[] = []
        if (v.utIds) {
            try {
                activeUTs = JSON.parse(v.utIds)
            } catch (e) {
                console.error("Error parsing utIds", e)
            }
        } else if (v.utId) {
            activeUTs = [v.utId]
        }

        setFormData({
            patente: v.patente,
            sucursalId: v.sucursalId,
            tipoVehiculoId: v.tipoVehiculoId,
            licId: v.licId ? String(v.licId) : '',
            selectedUTs: activeUTs,
            vigente: v.vigente
        })
        setEditingId(v.id)
        setIsAdding(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        if (!formData.patente || !formData.sucursalId || !formData.tipoVehiculoId) {
            setError('La patente, tipo de vehículo y sucursal son obligatorios.')
            setLoading(false)
            return
        }

        try {
            // Determine primary utId (the first UT selected, or null if none)
            const primaryUtId = formData.selectedUTs.length > 0 ? formData.selectedUTs[0] : null
            const utIdsStr = JSON.stringify(formData.selectedUTs)

            const dataToSave = {
                patente: formData.patente,
                utId: primaryUtId,
                sucursalId: formData.sucursalId,
                tipoVehiculoId: formData.tipoVehiculoId,
                licId: formData.licId ? Number(formData.licId) : null,
                utIds: utIdsStr,
                vigente: formData.vigente
            }

            let result
            if (editingId) {
                result = await updateVehiculo(editingId, dataToSave)
            } else {
                result = await createVehiculo(dataToSave)
            }

            if (result.success) {
                setSuccess(editingId ? 'Vehículo actualizado correctamente.' : 'Vehículo creado correctamente.')
                resetForm()
                router.refresh()
                setTimeout(() => {
                    setSuccess(null)
                    window.location.reload()
                }, 1500)
            } else {
                setError(result.error || 'Ocurrió un error inesperado.')
            }
        } catch (err) {
            setError('Error de comunicación con el servidor.')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este vehículo?')) return

        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const result = await deleteVehiculo(id)
            if (result.success) {
                setSuccess('Vehículo eliminado correctamente.')
                router.refresh()
                setTimeout(() => {
                    setSuccess(null)
                    window.location.reload()
                }, 1500)
            } else {
                setError(result.error || 'No se pudo eliminar el vehículo.')
            }
        } catch (err) {
            setError('Error de comunicación con el servidor.')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateType = async (e: React.FormEvent) => {
        e.preventDefault()
        const nameClean = newTypeName.trim()
        if (!nameClean) return

        setLoading(true)
        try {
            const result = await createTipoVehiculo(nameClean)
            if (result.success && result.data) {
                setTipoVehiculos(prev => [...prev, result.data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
                setFormData(prev => ({ ...prev, tipoVehiculoId: result.data.id }))
                setIsAddingType(false)
                setNewTypeName('')
                alert('Tipo de vehículo agregado con éxito.')
            } else {
                alert(result.error || 'Error al agregar el tipo de vehículo.')
            }
        } catch (err) {
            alert('Error de conexión.')
        } finally {
            setLoading(false)
        }
    }

    const filteredVehiculos = vehiculos.filter(v => {
        const query = searchQuery.toLowerCase().trim()
        
        let utMatch = false
        if (v.utIds) {
            try {
                const parsed: number[] = JSON.parse(v.utIds)
                utMatch = parsed.some(num => String(num).includes(query))
            } catch (e) {}
        } else if (v.utId) {
            utMatch = String(v.utId).includes(query)
        }

        const licName = v.licitacion?.licitacionHomologada?.toLowerCase() || ''

        return (
            v.patente.toLowerCase().includes(query) ||
            v.tipoVehiculo.nombre.toLowerCase().includes(query) ||
            v.sucursal.nombre.toLowerCase().includes(query) ||
            licName.includes(query) ||
            utMatch
        )
    })

    // 1. Find UTs belonging to the selected sucursal
    const sucursalUTs = uts.filter(u => u.sucursalId === formData.sucursalId)

    // 2. Filter Licitaciones that are associated with the selected sucursal (via its UTs)
    const sucursalLicitaciones = licitaciones.filter(l => 
        sucursalUTs.some(u => u.licId === l.licId)
    )

    // 3. Filter UTs belonging to BOTH the selected sucursal AND the selected licitacion
    const availableUTs = uts.filter(u => 
        u.sucursalId === formData.sucursalId && 
        u.licId === Number(formData.licId)
    )

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>🚗</span> Mantenedor de Vehículos
                    </h2>
                    <p className="text-gray-500 mt-1">Administra la flota de vehículos, asignación a Licitaciones, Sucursales y UTs</p>
                </div>

                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-slate-900/10"
                    >
                        <span>➕</span> Nuevo Vehículo
                    </button>
                )}
            </div>

            {/* Success and Error Feedbacks */}
            {success && (
                <div className="p-4 bg-green-50 border border-green-100 text-green-600 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                    <span>✅</span> {success}
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                    <span>⚠️</span> {error}
                </div>
            )}

            {/* Create/Edit Form container */}
            {isAdding && (
                <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        {editingId ? '📝 Editar Vehículo' : '✨ Registrar Nuevo Vehículo'}
                    </h3>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Patente */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Patente</label>
                            <input
                                title="Patente del vehículo"
                                type="text"
                                required
                                placeholder="Ej: AB-CD-12 o AA-12-34"
                                value={formData.patente}
                                onChange={(e) => setFormData({ ...formData, patente: e.target.value.toUpperCase() })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none font-mono uppercase text-black font-semibold bg-white"
                            />
                        </div>

                        {/* Tipo de Vehículo + Dynamic button */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 flex justify-between">
                                <span>Tipo de Vehículo</span>
                                <button
                                    type="button"
                                    onClick={() => setIsAddingType(true)}
                                    className="text-xs text-cyan-600 hover:text-cyan-700 font-bold hover:underline"
                                >
                                    + Agregar Nuevo Tipo
                                </button>
                            </label>
                            <select
                                title="Tipo de vehículo"
                                required
                                value={formData.tipoVehiculoId}
                                onChange={(e) => setFormData({ ...formData, tipoVehiculoId: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none bg-white text-black font-semibold"
                            >
                                <option value="">Selecciona tipo...</option>
                                {tipoVehiculos.map(t => (
                                    <option key={t.id} value={t.id}>{t.nombre}</option>
                                ))}
                            </select>
                        </div>

                        {/* Sucursal Selector (FIRST) */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Sucursal *</label>
                            <select
                                title="Seleccione Sucursal"
                                required
                                value={formData.sucursalId}
                                onChange={(e) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        sucursalId: e.target.value,
                                        licId: '', // Reset licitacion when sucursal changes
                                        selectedUTs: [] // Reset selected UTs when sucursal changes
                                    }))
                                }}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none bg-white text-black font-semibold"
                            >
                                <option value="">Seleccione Sucursal...</option>
                                {sucursales.map(s => (
                                    <option key={s.id} value={s.id}>{s.nombre}</option>
                                ))}
                            </select>
                        </div>

                        {/* Licitación Selector (Enabled after Sucursal selection) */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Licitación (Opcional)</label>
                            <select
                                title="Seleccione Licitación"
                                value={formData.licId}
                                disabled={!formData.sucursalId}
                                onChange={(e) => {
                                    setFormData(prev => ({ 
                                        ...prev, 
                                        licId: e.target.value,
                                        selectedUTs: [] // Reset UTs when licitacion changes
                                    }))
                                }}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none bg-white text-black font-semibold disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                                {!formData.sucursalId ? (
                                    <option value="">Selecciona sucursal primero...</option>
                                ) : sucursalLicitaciones.length === 0 ? (
                                    <option value="">Sin Licitaciones / No aplica (Casa Matriz)</option>
                                ) : (
                                    <>
                                        <option value="">Sin Licitación / No aplica</option>
                                        {sucursalLicitaciones.map(l => (
                                            <option key={l.licId} value={l.licId}>{l.licitacionHomologada || `Lic ID ${l.licId}`}</option>
                                        ))}
                                    </>
                                )}
                            </select>
                        </div>

                        {/* UT Selector (Multi-selection grid cards based on Sucursal AND Licitacion) */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-semibold text-gray-700">
                                Unidades Territoriales (UT) <span className="text-xs font-normal text-gray-500">(Puedes marcar una o varias)</span>
                            </label>
                            {!formData.sucursalId ? (
                                <div className="p-3 bg-slate-50 border border-slate-100 text-slate-500 rounded-xl text-xs font-medium italic">
                                    Selecciona una sucursal para comenzar.
                                </div>
                            ) : sucursalUTs.length === 0 ? (
                                <div className="p-3 bg-amber-50/50 border border-amber-100 text-amber-800 rounded-xl text-xs font-medium italic flex items-center gap-1.5">
                                    <span>ℹ️</span> Esta sucursal (ej. Casa Matriz) no tiene Unidades Territoriales (UT) asociadas.
                                </div>
                            ) : !formData.licId ? (
                                <div className="p-3 bg-slate-50 border border-slate-100 text-slate-500 rounded-xl text-xs font-medium italic">
                                    Selecciona una licitación para listar sus Unidades Territoriales (UT).
                                </div>
                            ) : availableUTs.length === 0 ? (
                                <div className="p-3 bg-amber-50/50 border border-amber-100 text-amber-800 rounded-xl text-xs font-medium italic">
                                    No hay UTs disponibles para esta combinación de Sucursal y Licitación.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border border-gray-200 rounded-xl p-3 bg-gray-50 max-h-36 overflow-y-auto custom-scrollbar">
                                    {availableUTs.map(u => {
                                        const isChecked = formData.selectedUTs.includes(u.codUT)
                                        return (
                                            <label key={u.codUT} className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                                                isChecked 
                                                ? 'bg-cyan-50 border-cyan-300 text-cyan-900 shadow-sm font-bold' 
                                                : 'bg-white border-gray-200 hover:bg-gray-100/50 text-gray-800 font-medium'
                                            }`}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {
                                                        if (isChecked) {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                selectedUTs: prev.selectedUTs.filter(id => id !== u.codUT)
                                                            }))
                                                        } else {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                selectedUTs: [...prev.selectedUTs, u.codUT]
                                                            }))
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-gray-300 cursor-pointer"
                                                />
                                                <span className="text-xs font-semibold font-mono">UT {u.codUT}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Estado (Vigente / No vigente) */}
                        <div className="flex items-end pb-1">
                            <label className="flex items-center gap-3 cursor-pointer group bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100 w-full">
                                <input
                                    type="checkbox"
                                    checked={formData.vigente}
                                    onChange={(e) => setFormData({ ...formData, vigente: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 transition-all cursor-pointer"
                                />
                                <span className="text-sm font-bold text-gray-700 group-hover:text-gray-900 transition-colors">
                                    Vehículo Vigente / Operativo
                                </span>
                            </label>
                        </div>

                        {/* Buttons */}
                        <div className="md:col-span-3 flex justify-end gap-3 pt-2 border-t border-gray-50">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-6 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-cyan-600/20 disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? 'Guardando...' : editingId ? 'Actualizar Vehículo' : 'Registrar Vehículo'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Nested Modal to add new custom vehicle type */}
            {isAddingType && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full border border-gray-100 animate-in zoom-in-95 duration-200">
                        <h4 className="text-lg font-bold text-gray-900 mb-2">➕ Agregar Nuevo Tipo de Vehículo</h4>
                        <p className="text-sm text-gray-500 mb-4">Ingresa el nombre del nuevo tipo para guardarlo en la base de datos.</p>

                        <form onSubmit={handleCreateType} className="space-y-4">
                            <input
                                title="Nombre del tipo de vehículo"
                                type="text"
                                required
                                value={newTypeName}
                                onChange={(e) => setNewTypeName(e.target.value)}
                                placeholder="Ej: Camioneta Cabina Simple, Furgón"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-black font-semibold bg-white"
                            />
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setIsAddingType(false); setNewTypeName(''); }}
                                    className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl transition-all shadow-sm"
                                >
                                    Guardar Tipo
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* List and Grid Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Search / Filter bar */}
                <div className="p-5 border-b border-gray-50 bg-gray-50/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full sm:max-w-md">
                        <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">🔍</span>
                        <input
                            title="Buscar vehículos"
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar por patente, tipo, UT, licitación o sucursal..."
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none bg-white text-sm text-black font-semibold"
                        />
                    </div>
                    <div className="text-xs text-gray-500 font-medium">
                        Mostrando {filteredVehiculos.length} vehículos registrados
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="bg-gray-50/50 text-slate-600 border-b border-gray-100">
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Patente</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Licitación</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Sucursal</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Unidades Territoriales (UT)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Estado</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {filteredVehiculos.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center h-48">
                                        <span className="text-4xl block mb-3 text-slate-300">🚗</span>
                                        <p className="text-slate-500 font-medium">No se encontraron vehículos.</p>
                                        <p className="text-slate-400 text-sm mt-1">Modifica la búsqueda o registra un nuevo vehículo.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredVehiculos.map((v) => (
                                    <tr key={v.id} className="hover:bg-cyan-50/20 transition-colors group">
                                        {/* Patente */}
                                        <td className="px-6 py-4">
                                            <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg text-sm tracking-widest shadow-sm">
                                                {v.patente}
                                            </span>
                                        </td>
                                        
                                        {/* Tipo */}
                                        <td className="px-6 py-4 font-semibold text-slate-700">
                                            {v.tipoVehiculo.nombre}
                                        </td>

                                        {/* Licitación */}
                                        <td className="px-6 py-4 font-semibold text-slate-700">
                                            {v.licitacion?.licitacionHomologada || <span className="text-gray-400 italic text-xs">Sin Licitación</span>}
                                        </td>

                                        {/* Sucursal */}
                                        <td className="px-6 py-4 font-semibold text-cyan-700">
                                            {v.sucursal.nombre}
                                        </td>

                                        {/* UTs (Multiple badge renderer) */}
                                        <td className="px-6 py-4">
                                            {v.utIds ? (() => {
                                                try {
                                                    const parsed: number[] = JSON.parse(v.utIds)
                                                    if (parsed.length === 0) return <span className="text-gray-400 italic text-xs">Sin UT (ej. Casa Matriz)</span>
                                                    return (
                                                        <div className="flex flex-wrap gap-1">
                                                            {parsed.map(utNum => (
                                                                <span key={utNum} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                                                    UT {utNum}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )
                                                } catch (e) {
                                                    return <span className="text-red-500 text-xs">Error parsing UTs</span>
                                                }
                                            })() : v.utId ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                                    UT {v.utId}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 italic text-xs">Sin UT (ej. Casa Matriz)</span>
                                            )}
                                        </td>

                                        {/* Estado */}
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                                v.vigente 
                                                ? 'bg-green-50 text-green-700 border-green-100' 
                                                : 'bg-red-50 text-red-700 border-red-100'
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${v.vigente ? 'bg-green-500' : 'bg-red-500'}`} />
                                                {v.vigente ? 'Vigente' : 'No Vigente'}
                                            </span>
                                        </td>

                                        {/* Acciones */}
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(v)}
                                                    className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-all"
                                                    title="Editar"
                                                >
                                                    <span className="text-lg">✏️</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(v.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Eliminar"
                                                >
                                                    <span className="text-lg">🗑️</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                    height: 5px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #CBD5E1;
                    border-radius: 10px;
                }
            `}</style>
        </div>
    )
}
