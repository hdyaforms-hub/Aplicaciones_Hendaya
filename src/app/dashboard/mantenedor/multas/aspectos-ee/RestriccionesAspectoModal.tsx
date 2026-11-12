'use client'

import { useState, useEffect } from 'react'
import {
    getRestriccionesAspecto,
    saveRestriccionAspecto,
    toggleRestriccionAspecto,
    deleteRestriccionAspecto
} from './actions'

interface RestriccionesAspectoModalProps {
    isOpen: boolean
    onClose: () => void
    aspecto: {
        id: string
        licId: number
        letra: string
        descripcion?: string | null
        licitacion?: {
            licId: number
            nombre?: string | null
            numero?: string | null
        }
    } | null
    onUpdated?: () => void
}

interface RestriccionItem {
    id: string
    licId: number
    letra: string
    tipo: string
    anho: number | null
    fechaDesde: Date | string | null
    fechaHasta: Date | string | null
    accion: string
    valorFijo: number | null
    descripcion: string | null
    activo: boolean
    creadoPor: string | null
    createdAt: Date | string
}

export default function RestriccionesAspectoModal({
    isOpen,
    onClose,
    aspecto,
    onUpdated
}: RestriccionesAspectoModalProps) {
    const [restricciones, setRestricciones] = useState<RestriccionItem[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Form mode
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)

    // Form fields
    const [formData, setFormData] = useState({
        tipo: 'ANHO',
        anho: 2024,
        fechaDesde: '',
        fechaHasta: '',
        accion: 'VALOR_CERO',
        valorFijo: 0,
        descripcion: '',
        activo: true
    })

    const loadRestricciones = async () => {
        if (!aspecto) return
        setLoading(true)
        setError('')
        try {
            const res = await getRestriccionesAspecto(aspecto.licId, aspecto.letra)
            if (res.error) {
                setError(res.error)
            } else if (res.restricciones) {
                setRestricciones(res.restricciones as any)
            }
        } catch (e: any) {
            setError(e?.message || 'Error al cargar restricciones')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen && aspecto) {
            setIsFormOpen(false)
            setEditingId(null)
            setError('')
            setSuccess('')
            loadRestricciones()
        }
    }, [isOpen, aspecto])

    if (!isOpen || !aspecto) return null

    const handleOpenCreate = () => {
        setEditingId(null)
        setFormData({
            tipo: 'ANHO',
            anho: 2024,
            fechaDesde: '',
            fechaHasta: '',
            accion: 'VALOR_CERO',
            valorFijo: 0,
            descripcion: aspecto.letra.toUpperCase() === 'M'
                ? 'Documentos del año 2024 tienen valor de cálculo $0'
                : '',
            activo: true
        })
        setIsFormOpen(true)
        setError('')
        setSuccess('')
    }

    const handleOpenEdit = (item: RestriccionItem) => {
        setEditingId(item.id)
        setFormData({
            tipo: item.tipo || 'ANHO',
            anho: item.anho || 2024,
            fechaDesde: item.fechaDesde ? new Date(item.fechaDesde).toISOString().split('T')[0] : '',
            fechaHasta: item.fechaHasta ? new Date(item.fechaHasta).toISOString().split('T')[0] : '',
            accion: item.accion || 'VALOR_CERO',
            valorFijo: item.valorFijo || 0,
            descripcion: item.descripcion || '',
            activo: item.activo
        })
        setIsFormOpen(true)
        setError('')
        setSuccess('')
    }

    const handleCancelForm = () => {
        setIsFormOpen(false)
        setEditingId(null)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError('')
        setSuccess('')

        const res = await saveRestriccionAspecto({
            id: editingId || undefined,
            licId: Number(aspecto.licId),
            letra: String(aspecto.letra),
            tipo: formData.tipo,
            anho: formData.tipo === 'ANHO' ? Number(formData.anho) : null,
            fechaDesde: formData.tipo === 'RANGO_FECHAS' && formData.fechaDesde ? formData.fechaDesde : null,
            fechaHasta: formData.tipo === 'RANGO_FECHAS' && formData.fechaHasta ? formData.fechaHasta : null,
            accion: formData.accion,
            valorFijo: formData.accion === 'VALOR_FIJO' ? Number(formData.valorFijo) : 0,
            descripcion: formData.descripcion,
            activo: Boolean(formData.activo)
        })

        if (res.error) {
            setError(res.error)
        } else {
            setSuccess(editingId ? 'Restricción actualizada exitosamente.' : 'Restricción creada exitosamente.')
            setIsFormOpen(false)
            setEditingId(null)
            await loadRestricciones()
            if (onUpdated) onUpdated()
        }
        setSaving(false)
    }

    const handleToggleActive = async (item: RestriccionItem) => {
        const nuevoEstado = !item.activo
        const res = await toggleRestriccionAspecto(item.id, nuevoEstado)
        if (res.error) {
            setError(res.error)
        } else {
            setRestricciones(prev => prev.map(r => r.id === item.id ? { ...r, activo: nuevoEstado } : r))
            if (onUpdated) onUpdated()
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta restricción?')) return
        setSaving(true)
        const res = await deleteRestriccionAspecto(id)
        if (res.error) {
            setError(res.error)
        } else {
            setSuccess('Restricción eliminada.')
            await loadRestricciones()
            if (onUpdated) onUpdated()
        }
        setSaving(false)
    }

    const licNombre = aspecto.licitacion?.nombre || aspecto.licitacion?.numero || `Lic. #${aspecto.licId}`

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden text-gray-900 animate-in fade-in zoom-in-95 duration-200">
                {/* Header Estándar */}
                <div className="px-6 py-5 border-b border-gray-100 bg-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600 text-lg shadow-sm">
                            🛡️
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-gray-900">Restricciones de Cálculo EE</h3>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                                    Aspecto {aspecto.letra}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {licNombre} {aspecto.descripcion ? `• ${aspecto.descripcion}` : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
                        title="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                {/* Sub-banner informativo estándar */}
                <div className="px-6 py-3 bg-cyan-50/70 border-b border-cyan-100 flex items-start gap-2.5 text-xs text-cyan-900">
                    <span className="text-cyan-600 font-bold">ℹ️</span>
                    <span>
                        Las restricciones permiten fijar el valor de cálculo en <strong>$0 (Exento)</strong> o un monto fijo cuando el documento de supervisión cumpla una condición específica (por ejemplo, documentos del año 2024 para el aspecto M).
                    </span>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white">
                    {/* Feedback Alerts */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                            <span>✅</span>
                            <span>{success}</span>
                        </div>
                    )}

                    {/* Action Bar (Top) */}
                    {!isFormOpen && (
                        <div className="flex items-center justify-between pb-2">
                            <div>
                                <h4 className="text-sm font-bold text-gray-800">Reglas Activas y Configuradas</h4>
                                <p className="text-xs text-gray-500">Total: {restricciones.length} regla(s)</p>
                            </div>
                            <button
                                onClick={handleOpenCreate}
                                className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all flex items-center gap-1.5"
                            >
                                <span>➕</span>
                                <span>Nueva Restricción</span>
                            </button>
                        </div>
                    )}

                    {/* Form Section */}
                    {isFormOpen && (
                        <form onSubmit={handleSubmit} className="bg-gray-50/90 border border-gray-200 rounded-2xl p-5 space-y-4 animate-fadeIn">
                            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                                <h4 className="text-sm font-bold text-cyan-800 flex items-center gap-2">
                                    <span>⚙️</span>
                                    <span>{editingId ? 'Editar Restricción' : 'Nueva Restricción de Aspecto'}</span>
                                </h4>
                                <span className="text-xs font-semibold text-gray-500">Aspecto {aspecto.letra}</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Tipo de Condición */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Condición de Aplicación
                                    </label>
                                    <select
                                        value={formData.tipo}
                                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 shadow-sm"
                                    >
                                        <option value="ANHO">Por Año del Documento de Supervisión</option>
                                        <option value="RANGO_FECHAS">Por Rango de Fechas de Supervisión</option>
                                    </select>
                                </div>

                                {/* Condición Value: Año o Rango */}
                                {formData.tipo === 'ANHO' ? (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">
                                            Año a Eximir / Restringir
                                        </label>
                                        <select
                                            value={formData.anho}
                                            onChange={(e) => setFormData({ ...formData, anho: Number(e.target.value) })}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 font-bold focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 shadow-sm"
                                        >
                                            <option value="2023">2023</option>
                                            <option value="2024">2024 (Requerido Aspecto M)</option>
                                            <option value="2025">2025</option>
                                            <option value="2026">2026</option>
                                            <option value="2027">2027</option>
                                        </select>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Fecha Desde</label>
                                            <input
                                                type="date"
                                                value={formData.fechaDesde}
                                                onChange={(e) => setFormData({ ...formData, fechaDesde: e.target.value })}
                                                className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 shadow-sm"
                                                required={formData.tipo === 'RANGO_FECHAS'}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Fecha Hasta</label>
                                            <input
                                                type="date"
                                                value={formData.fechaHasta}
                                                onChange={(e) => setFormData({ ...formData, fechaHasta: e.target.value })}
                                                className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 shadow-sm"
                                                required={formData.tipo === 'RANGO_FECHAS'}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Acción */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Acción en el Cálculo
                                    </label>
                                    <select
                                        value={formData.accion}
                                        onChange={(e) => setFormData({ ...formData, accion: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 shadow-sm"
                                    >
                                        <option value="VALOR_CERO">Valor del Cálculo = $0 (Exento)</option>
                                        <option value="VALOR_FIJO">Monto Fijo Personalizado ($)</option>
                                    </select>
                                </div>

                                {/* Monto fijo si aplica */}
                                {formData.accion === 'VALOR_FIJO' ? (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">
                                            Monto Fijo a Asignar ($)
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.valorFijo}
                                            onChange={(e) => setFormData({ ...formData, valorFijo: Number(e.target.value) })}
                                            min="0"
                                            step="1"
                                            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 shadow-sm"
                                            required
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center pt-5">
                                        <span className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl flex items-center gap-1.5 font-medium">
                                            <span>✨</span>
                                            <span>El monto de la multa para este aspecto será exactamente $0.</span>
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Descripción / Motivo */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Motivo o Justificación Normativa (Opcional)
                                </label>
                                <textarea
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                    rows={2}
                                    placeholder="Ej: Instrucción de trabajo y resolución técnica establecen exención de multas para el año 2024..."
                                    className="w-full bg-white border border-gray-300 rounded-xl p-3 text-xs text-gray-800 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 shadow-sm resize-none"
                                />
                            </div>

                            {/* Switch Activo */}
                            <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.activo}
                                        onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                                </label>
                                <span className="text-xs font-medium text-gray-700">
                                    {formData.activo ? 'Restricción Activa (se aplicará en los cálculos)' : 'Restricción Inactiva (deshabilitada)'}
                                </span>
                            </div>

                            {/* Form Buttons */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={handleCancelForm}
                                    disabled={saving}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all flex items-center gap-1.5"
                                >
                                    {saving ? 'Guardando...' : editingId ? 'Actualizar Regla' : 'Guardar Regla'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* List of Restrictions */}
                    {loading ? (
                        <div className="py-12 text-center text-xs text-gray-400">
                            <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            Cargando restricciones...
                        </div>
                    ) : restricciones.length === 0 ? (
                        <div className="py-12 px-4 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                            <div className="text-3xl mb-2">🛡️</div>
                            <h5 className="text-sm font-bold text-gray-800">Sin restricciones configuradas</h5>
                            <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                                Este aspecto se calcula normalmente aplicando su fórmula en todas las actas de supervisión. Presiona &quot;Nueva Restricción&quot; para agregar una regla especial (por ejemplo, año 2024 = $0).
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {restricciones.map((r) => {
                                const is2024Zero = r.tipo === 'ANHO' && r.anho === 2024 && r.accion === 'VALOR_CERO'
                                return (
                                    <div
                                        key={r.id}
                                        className={`p-4 rounded-xl border transition-all ${
                                            r.activo
                                                ? 'bg-white border-gray-200 hover:border-cyan-300 shadow-sm'
                                                : 'bg-gray-50/70 border-gray-200 opacity-60'
                                        }`}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {r.tipo === 'ANHO' ? (
                                                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
                                                            📅 Año {r.anho}
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                                            📆 {r.fechaDesde ? new Date(r.fechaDesde).toLocaleDateString() : ''} al {r.fechaHasta ? new Date(r.fechaHasta).toLocaleDateString() : ''}
                                                        </span>
                                                    )}

                                                    {r.accion === 'VALOR_CERO' ? (
                                                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                            💰 Monto Cálculo: $0 (Exento)
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                            💵 Monto Fijo: ${r.valorFijo?.toLocaleString('es-CL')}
                                                        </span>
                                                    )}

                                                    {r.activo ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                            ACTIVA
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                                            INACTIVA
                                                        </span>
                                                    )}

                                                    {is2024Zero && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                                                            ★ Regla Solicitada
                                                        </span>
                                                    )}
                                                </div>

                                                {r.descripcion && (
                                                    <p className="text-xs text-gray-600 italic pt-1">
                                                        &quot;{r.descripcion}&quot;
                                                    </p>
                                                )}

                                                <p className="text-[11px] text-gray-400">
                                                    Creado: {new Date(r.createdAt).toLocaleDateString()} {r.creadoPor ? `por ${r.creadoPor}` : ''}
                                                </p>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-2 self-end sm:self-center">
                                                <button
                                                    onClick={() => handleToggleActive(r)}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border ${
                                                        r.activo
                                                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                                    }`}
                                                    title={r.activo ? 'Desactivar esta regla' : 'Activar esta regla'}
                                                >
                                                    {r.activo ? 'Desactivar' : 'Activar'}
                                                </button>
                                                <button
                                                    onClick={() => handleOpenEdit(r)}
                                                    className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold transition-colors"
                                                    title="Editar configuración"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(r.id)}
                                                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-colors"
                                                    title="Eliminar regla"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Estándar */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                        Los cambios impactan en tiempo real el cálculo de multas de este aspecto.
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    )
}
