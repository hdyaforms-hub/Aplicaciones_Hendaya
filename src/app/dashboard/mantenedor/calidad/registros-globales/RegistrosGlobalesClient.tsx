'use client'

import React, { useState } from 'react'
import { 
    Tag, Plus, Search, Edit3, Trash2, Power, 
    CheckCircle2, XCircle, AlertCircle, RefreshCw, Layers, DollarSign, Calculator,
    ShieldAlert, Users, Check, FileText, Calendar, Paperclip, Filter
} from 'lucide-react'
import { 
    MotivoC8, ValorContratoItem, UsuarioPrivilegioReclamo,
    guardarMotivoC8Action, toggleActivoMotivoC8Action, eliminarMotivoC8Action,
    guardarValorContratoAction, toggleActivoValorContratoAction, eliminarValorContratoAction,
    guardarPrivilegioUsuarioReclamoAction
} from './actions'

interface Props {
    initialMotivos: MotivoC8[]
    initialValoresContrato: ValorContratoItem[]
    initialUsuariosReclamos: UsuarioPrivilegioReclamo[]
    rolesDisponibles: { id: string; nombre: string }[]
    licitaciones: { id: string; label: string }[]
    canManage: boolean
    userName: string
}

export default function RegistrosGlobalesClient({
    initialMotivos,
    initialValoresContrato,
    initialUsuariosReclamos,
    rolesDisponibles,
    licitaciones,
    canManage,
    userName
}: Props) {
    const [activeTab, setActiveTab] = useState<'motivos_c8' | 'valor_contrato' | 'reclamos_proveedores'>('motivos_c8')
    const [motivos, setMotivos] = useState<MotivoC8[]>(initialMotivos)
    const [valoresContrato, setValoresContrato] = useState<ValorContratoItem[]>(initialValoresContrato)
    const [usuariosReclamos, setUsuariosReclamos] = useState<UsuarioPrivilegioReclamo[]>(initialUsuariosReclamos)
    const [search, setSearch] = useState('')
    const [filterLicitacion, setFilterLicitacion] = useState<string>('TODAS')
    const [filterRol, setFilterRol] = useState<string>('TODOS')
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

    // Modal state Motivos C8
    const [modalMotivoOpen, setModalMotivoOpen] = useState(false)
    const [editingMotivo, setEditingMotivo] = useState<MotivoC8 | null>(null)
    const [codigoForm, setCodigoForm] = useState('')
    const [nombreForm, setNombreForm] = useState('')
    const [descripcionForm, setDescripcionForm] = useState('')
    const [motivoLicitacionForm, setMotivoLicitacionForm] = useState<string>('TODAS')
    const [activoForm, setActivoForm] = useState(true)

    // Modal state Valor Contrato
    const [modalContratoOpen, setModalContratoOpen] = useState(false)
    const [editingContrato, setEditingContrato] = useState<ValorContratoItem | null>(null)
    const [contratoLicitacion, setContratoLicitacion] = useState('')
    const [contratoAnio, setContratoAnio] = useState<number>(new Date().getFullYear())
    const [contratoMonto, setContratoMonto] = useState<number>(0)
    const [contratoDescripcion, setContratoDescripcion] = useState('')
    const [contratoActivo, setContratoActivo] = useState(true)

    const [saving, setSaving] = useState(false)

    // Filtrados
    const motivosFiltrados = motivos.filter(m => {
        if (filterLicitacion !== 'TODAS' && m.licitacion !== 'TODAS' && m.licitacion !== filterLicitacion) {
            return false
        }
        const term = search.toLowerCase()
        return (
            m.codigo.toLowerCase().includes(term) ||
            m.nombre.toLowerCase().includes(term) ||
            (m.descripcion || '').toLowerCase().includes(term) ||
            (m.licitacion || '').toLowerCase().includes(term)
        )
    })

    const contratosFiltrados = valoresContrato.filter(c => {
        if (filterLicitacion !== 'TODAS' && c.licitacion !== filterLicitacion) {
            return false
        }
        const term = search.toLowerCase()
        return (
            c.licitacion.toLowerCase().includes(term) ||
            String(c.anio).includes(term) ||
            (c.descripcion || '').toLowerCase().includes(term)
        )
    })

    const usuariosReclamosFiltrados = usuariosReclamos.filter(u => {
        if (filterRol !== 'TODOS' && u.rolId !== filterRol) {
            return false
        }
        const term = search.toLowerCase()
        return (
            u.nombre.toLowerCase().includes(term) ||
            u.username.toLowerCase().includes(term) ||
            (u.email || '').toLowerCase().includes(term) ||
            u.rolNombre.toLowerCase().includes(term)
        )
    })

    const handleTogglePrivilegioUsuario = async (
        userId: string,
        campo: 'puedeEditar' | 'puedeFechasSeguimiento' | 'puedeAdjuntarRespuesta'
    ) => {
        if (!canManage) {
            setErrorMsg('No tienes privilegios para modificar los permisos de usuarios.')
            return
        }

        const usuarioTarget = usuariosReclamos.find(u => u.userId === userId)
        if (!usuarioTarget) return

        const nuevoValor = !usuarioTarget[campo]
        const nuevoEstado = {
            userId,
            puedeEditar: campo === 'puedeEditar' ? nuevoValor : usuarioTarget.puedeEditar,
            puedeFechasSeguimiento: campo === 'puedeFechasSeguimiento' ? nuevoValor : usuarioTarget.puedeFechasSeguimiento,
            puedeAdjuntarRespuesta: campo === 'puedeAdjuntarRespuesta' ? nuevoValor : usuarioTarget.puedeAdjuntarRespuesta,
        }

        // Optimistic UI update
        setUsuariosReclamos(prev => prev.map(u => {
            if (u.userId === userId) {
                return {
                    ...u,
                    [campo]: nuevoValor
                }
            }
            return u
        }))

        setUpdatingUserId(userId)
        try {
            const res = await guardarPrivilegioUsuarioReclamoAction(nuevoEstado)
            if (!res.success) {
                // Revert
                setUsuariosReclamos(prev => prev.map(u => {
                    if (u.userId === userId) {
                        return {
                            ...u,
                            [campo]: !nuevoValor
                        }
                    }
                    return u
                }))
                setErrorMsg(res.error || 'Error al actualizar privilegio del usuario.')
            } else {
                setSuccessMsg(`Privilegio de ${usuarioTarget.nombre} actualizado correctamente.`)
                setTimeout(() => setSuccessMsg(null), 3500)
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error inesperado al guardar privilegios.')
        } finally {
            setUpdatingUserId(null)
        }
    }

    // Handlers Motivos C8
    const handleOpenNewMotivo = () => {
        setEditingMotivo(null)
        setCodigoForm('')
        setNombreForm('')
        setDescripcionForm('')
        setMotivoLicitacionForm(filterLicitacion !== 'TODAS' ? filterLicitacion : 'TODAS')
        setActivoForm(true)
        setErrorMsg(null)
        setModalMotivoOpen(true)
    }

    const handleOpenEditMotivo = (item: MotivoC8) => {
        setEditingMotivo(item)
        setCodigoForm(item.codigo)
        setNombreForm(item.nombre)
        setDescripcionForm(item.descripcion || '')
        setMotivoLicitacionForm(item.licitacion || 'TODAS')
        setActivoForm(item.activo)
        setErrorMsg(null)
        setModalMotivoOpen(true)
    }

    const handleSaveMotivo = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!codigoForm.trim() || !nombreForm.trim()) {
            setErrorMsg('Código y Nombre son obligatorios')
            return
        }

        setSaving(true)
        setErrorMsg(null)
        try {
            const res = await guardarMotivoC8Action({
                id: editingMotivo?.id,
                codigo: codigoForm,
                nombre: nombreForm,
                descripcion: descripcionForm,
                licitacion: motivoLicitacionForm,
                activo: activoForm
            })

            if (res.success) {
                setSuccessMsg(editingMotivo ? 'Motivo C8 actualizado exitosamente' : 'Motivo C8 creado exitosamente')
                setTimeout(() => setSuccessMsg(null), 3500)
                setModalMotivoOpen(false)

                if (editingMotivo) {
                    setMotivos(prev => prev.map(m => m.id === editingMotivo.id ? {
                        ...m,
                        codigo: codigoForm.toUpperCase(),
                        nombre: nombreForm,
                        descripcion: descripcionForm || null,
                        licitacion: motivoLicitacionForm,
                        activo: activoForm,
                        updatedAt: new Date().toISOString()
                    } : m))
                } else if (res.id) {
                    const newItem: MotivoC8 = {
                        id: res.id,
                        codigo: codigoForm.toUpperCase(),
                        nombre: nombreForm,
                        descripcion: descripcionForm || null,
                        licitacion: motivoLicitacionForm,
                        activo: activoForm,
                        creadoPor: userName,
                        actualizadoPor: null,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                    setMotivos(prev => [...prev, newItem].sort((a, b) => a.codigo.localeCompare(b.codigo)))
                }
            } else {
                setErrorMsg(res.error || 'Error al guardar')
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error inesperado')
        } finally {
            setSaving(false)
        }
    }

    const handleToggleMotivo = async (item: MotivoC8) => {
        const nuevoEstado = !item.activo
        try {
            setLoading(true)
            const res = await toggleActivoMotivoC8Action(item.id, nuevoEstado)
            if (res.success) {
                setMotivos(prev => prev.map(m => m.id === item.id ? { ...m, activo: nuevoEstado } : m))
                setSuccessMsg(`Motivo ${nuevoEstado ? 'activado' : 'desactivado'} con éxito`)
                setTimeout(() => setSuccessMsg(null), 3000)
            } else {
                setErrorMsg(res.error || 'No se pudo cambiar el estado')
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error al cambiar estado')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteMotivo = async (item: MotivoC8) => {
        if (!confirm(`¿Está seguro de eliminar el motivo "${item.codigo} - ${item.nombre}"?`)) return

        try {
            setLoading(true)
            const res = await eliminarMotivoC8Action(item.id)
            if (res.success) {
                setMotivos(prev => prev.filter(m => m.id !== item.id))
                setSuccessMsg('Motivo C8 eliminado correctamente')
                setTimeout(() => setSuccessMsg(null), 3000)
            } else {
                setErrorMsg(res.error || 'Error al eliminar')
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error al eliminar')
        } finally {
            setLoading(false)
        }
    }

    // Handlers Valor Anual Contrato
    const handleOpenNewContrato = () => {
        setEditingContrato(null)
        setContratoLicitacion(filterLicitacion !== 'TODAS' ? filterLicitacion : (licitaciones[0]?.id || ''))
        setContratoAnio(new Date().getFullYear())
        setContratoMonto(0)
        setContratoDescripcion('')
        setContratoActivo(true)
        setErrorMsg(null)
        setModalContratoOpen(true)
    }

    const handleOpenEditContrato = (item: ValorContratoItem) => {
        setEditingContrato(item)
        setContratoLicitacion(item.licitacion)
        setContratoAnio(item.anio)
        setContratoMonto(item.montoAnualPesos)
        setContratoDescripcion(item.descripcion || '')
        setContratoActivo(item.activo)
        setErrorMsg(null)
        setModalContratoOpen(true)
    }

    const handleSaveContrato = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!contratoLicitacion || !contratoAnio || contratoMonto <= 0) {
            setErrorMsg('Licitación, Año y Monto Anual válido son obligatorios')
            return
        }

        setSaving(true)
        setErrorMsg(null)
        try {
            const res = await guardarValorContratoAction({
                id: editingContrato?.id,
                licitacion: contratoLicitacion,
                anio: Number(contratoAnio),
                montoAnualPesos: Number(contratoMonto),
                descripcion: contratoDescripcion,
                activo: contratoActivo
            })

            if (res.success) {
                setSuccessMsg(editingContrato ? 'Valor de contrato actualizado exitosamente' : 'Valor de contrato registrado exitosamente')
                setTimeout(() => setSuccessMsg(null), 3500)
                setModalContratoOpen(false)

                if (editingContrato) {
                    setValoresContrato(prev => prev.map(c => c.id === editingContrato.id ? {
                        ...c,
                        licitacion: contratoLicitacion,
                        anio: Number(contratoAnio),
                        montoAnualPesos: Number(contratoMonto),
                        descripcion: contratoDescripcion || null,
                        activo: contratoActivo,
                        updatedAt: new Date().toISOString()
                    } : c))
                } else if (res.id) {
                    const newItem: ValorContratoItem = {
                        id: res.id,
                        licitacion: contratoLicitacion,
                        anio: Number(contratoAnio),
                        montoAnualPesos: Number(contratoMonto),
                        descripcion: contratoDescripcion || null,
                        activo: contratoActivo,
                        creadoPor: userName,
                        actualizadoPor: null,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                    setValoresContrato(prev => [newItem, ...prev])
                }
            } else {
                setErrorMsg(res.error || 'Error al guardar')
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error inesperado')
        } finally {
            setSaving(false)
        }
    }

    const handleToggleContrato = async (item: ValorContratoItem) => {
        const nuevoEstado = !item.activo
        try {
            setLoading(true)
            const res = await toggleActivoValorContratoAction(item.id, nuevoEstado)
            if (res.success) {
                setValoresContrato(prev => prev.map(c => c.id === item.id ? { ...c, activo: nuevoEstado } : c))
                setSuccessMsg(`Registro ${nuevoEstado ? 'activado' : 'desactivado'} con éxito`)
                setTimeout(() => setSuccessMsg(null), 3000)
            } else {
                setErrorMsg(res.error || 'No se pudo cambiar estado')
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error al cambiar estado')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteContrato = async (item: ValorContratoItem) => {
        if (!confirm(`¿Está seguro de eliminar el valor de contrato de Licitación ${item.licitacion} Año ${item.anio}?`)) return

        try {
            setLoading(true)
            const res = await eliminarValorContratoAction(item.id)
            if (res.success) {
                setValoresContrato(prev => prev.filter(c => c.id !== item.id))
                setSuccessMsg('Registro eliminado correctamente')
                setTimeout(() => setSuccessMsg(null), 3000)
            } else {
                setErrorMsg(res.error || 'Error al eliminar')
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error al eliminar')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header del módulo con paleta corporativa Hendaya */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-cyan-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-cyan-600" />
                            Mantenedor · Calidad
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                        Registros Globales
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Catálogos maestros, motivos C8 y parámetros de cálculo contractual del área de Calidad.
                    </p>
                </div>
                {canManage && (
                    <button
                        onClick={activeTab === 'motivos_c8' ? handleOpenNewMotivo : handleOpenNewContrato}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-700 hover:bg-cyan-800 text-white transition-all shadow-md shadow-cyan-700/20 flex items-center gap-2 self-start sm:self-auto"
                    >
                        <Plus className="w-4 h-4" />
                        {activeTab === 'motivos_c8' ? 'Nuevo Motivo C8' : 'Nuevo Valor Contrato'}
                    </button>
                )}
            </div>

            {/* Mensajes de Alerta */}
            {errorMsg && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                    <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">✕</button>
                </div>
            )}

            {successMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{successMsg}</span>
                    </div>
                    <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 text-xs font-bold">✕</button>
                </div>
            )}

            {/* Selector de Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => {
                        setActiveTab('motivos_c8')
                        setSearch('')
                    }}
                    className={`flex items-center gap-2 px-6 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 rounded-t-xl ${
                        activeTab === 'motivos_c8'
                            ? 'border-cyan-600 text-cyan-700 bg-cyan-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                    <Tag className="w-4 h-4" />
                    Motivos C8
                    <span className="ml-1.5 px-2 py-0.5 text-xs bg-cyan-100 text-cyan-800 rounded-full font-bold">
                        {motivos.length}
                    </span>
                </button>

                <button
                    onClick={() => {
                        setActiveTab('valor_contrato')
                        setSearch('')
                    }}
                    className={`flex items-center gap-2 px-6 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 rounded-t-xl ${
                        activeTab === 'valor_contrato'
                            ? 'border-cyan-600 text-cyan-700 bg-cyan-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                    <DollarSign className="w-4 h-4" />
                    Valor Anual del Contrato
                    <span className="ml-1.5 px-2 py-0.5 text-xs bg-cyan-100 text-cyan-800 rounded-full font-bold">
                        {valoresContrato.length}
                    </span>
                </button>

                <button
                    onClick={() => {
                        setActiveTab('reclamos_proveedores')
                        setSearch('')
                    }}
                    className={`flex items-center gap-2 px-6 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 rounded-t-xl ${
                        activeTab === 'reclamos_proveedores'
                            ? 'border-cyan-600 text-cyan-700 bg-cyan-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                    <ShieldAlert className="w-4 h-4" />
                    Reclamo a Proveedores
                    <span className="ml-1.5 px-2 py-0.5 text-xs bg-cyan-100 text-cyan-800 rounded-full font-bold">
                        {usuariosReclamos.length}
                    </span>
                </button>
            </div>

            {/* TAB 1: Motivos C8 */}
            {activeTab === 'motivos_c8' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                            <div className="relative w-full sm:w-72">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar por código, nombre o descripción..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all font-medium"
                                />
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Licitación:</span>
                                <select
                                    value={filterLicitacion}
                                    onChange={e => setFilterLicitacion(e.target.value)}
                                    className="w-full sm:w-60 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
                                >
                                    <option value="TODAS">-- Todas las Licitaciones --</option>
                                    {licitaciones.map(l => (
                                        <option key={l.id} value={l.id}>{l.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="text-xs text-slate-500">
                            Mostrando <span className="font-bold text-slate-800">{motivosFiltrados.length}</span> de <span className="font-bold text-slate-800">{motivos.length}</span> motivos
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs text-slate-700">
                            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200 font-bold">
                                <tr>
                                    <th className="py-3 px-4">Código</th>
                                    <th className="py-3 px-4">Nombre del Motivo</th>
                                    <th className="py-3 px-4">Licitación</th>
                                    <th className="py-3 px-4">Descripción</th>
                                    <th className="py-3 px-4 text-center">Estado</th>
                                    {canManage && <th className="py-3 px-4 text-right">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {motivosFiltrados.length === 0 ? (
                                    <tr>
                                        <td colSpan={canManage ? 6 : 5} className="py-8 text-center text-slate-400 text-xs">
                                            No se encontraron motivos C8 coincidentes.
                                        </td>
                                    </tr>
                                ) : (
                                    motivosFiltrados.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-4 font-mono font-bold text-cyan-700">
                                                {item.codigo}
                                            </td>
                                            <td className="py-3 px-4 font-semibold text-slate-900">
                                                {item.nombre}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                                    item.licitacion === 'TODAS'
                                                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                                                        : 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                                }`}>
                                                    {item.licitacion === 'TODAS' 
                                                        ? 'Todas (Global)' 
                                                        : (licitaciones.find(l => l.id === item.licitacion)?.label || `Licitación ${item.licitacion}`)}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-slate-500 text-xs max-w-xs truncate">
                                                {item.descripcion || <span className="text-slate-400 italic">Sin descripción</span>}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {item.activo ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                        Activo
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                        <XCircle className="w-3 h-3 text-rose-600" />
                                                        Inactivo
                                                    </span>
                                                )}
                                            </td>
                                            {canManage && (
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => handleToggleMotivo(item)}
                                                            disabled={loading}
                                                            title={item.activo ? 'Desactivar motivo' : 'Activar motivo'}
                                                            className={`p-1.5 rounded-lg border transition-colors ${
                                                                item.activo 
                                                                    ? 'border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50' 
                                                                    : 'border-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                                                            }`}
                                                        >
                                                            <Power className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenEditMotivo(item)}
                                                            title="Editar motivo"
                                                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 transition-colors"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteMotivo(item)}
                                                            disabled={loading}
                                                            title="Eliminar motivo"
                                                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2: Valor Anual del Contrato */}
            {activeTab === 'valor_contrato' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                            <div className="relative w-full sm:w-72">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar por licitación o año..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all font-medium"
                                />
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Licitación:</span>
                                <select
                                    value={filterLicitacion}
                                    onChange={e => setFilterLicitacion(e.target.value)}
                                    className="w-full sm:w-60 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
                                >
                                    <option value="TODAS">-- Todas las Licitaciones --</option>
                                    {licitaciones.map(l => (
                                        <option key={l.id} value={l.id}>{l.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="text-xs text-slate-500">
                            Mostrando <span className="font-bold text-slate-800">{contratosFiltrados.length}</span> de <span className="font-bold text-slate-800">{valoresContrato.length}</span> registros
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs text-slate-700">
                            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200 font-bold">
                                <tr>
                                    <th className="py-3 px-4">Licitación</th>
                                    <th className="py-3 px-4">Año</th>
                                    <th className="py-3 px-4 text-right">Valor Anual del Contrato ($)</th>
                                    <th className="py-3 px-4 text-right">1% Multa ETA ($)</th>
                                    <th className="py-3 px-4">Descripción / Referencia</th>
                                    <th className="py-3 px-4 text-center">Estado</th>
                                    {canManage && <th className="py-3 px-4 text-right">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {contratosFiltrados.length === 0 ? (
                                    <tr>
                                        <td colSpan={canManage ? 7 : 6} className="py-8 text-center text-slate-400 text-xs">
                                            No se han registrado valores anuales de contrato.
                                        </td>
                                    </tr>
                                ) : (
                                    contratosFiltrados.map(item => {
                                        const unPorciento = Math.round(item.montoAnualPesos * 0.01)
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-3 px-4 font-mono font-bold text-cyan-700">
                                                    Licitación {item.licitacion}
                                                </td>
                                                <td className="py-3 px-4 font-bold text-slate-900">
                                                    {item.anio}
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                                                    ${item.montoAnualPesos.toLocaleString('es-CL')}
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                                                    ${unPorciento.toLocaleString('es-CL')}
                                                </td>
                                                <td className="py-3 px-4 text-slate-500 text-xs max-w-xs truncate">
                                                    {item.descripcion || <span className="text-slate-400 italic">Sin observaciones</span>}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {item.activo ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                            Activo
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                            <XCircle className="w-3 h-3 text-rose-600" />
                                                            Inactivo
                                                        </span>
                                                    )}
                                                </td>
                                                {canManage && (
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                onClick={() => handleToggleContrato(item)}
                                                                disabled={loading}
                                                                title={item.activo ? 'Desactivar' : 'Activar'}
                                                                className={`p-1.5 rounded-lg border transition-colors ${
                                                                    item.activo 
                                                                        ? 'border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50' 
                                                                        : 'border-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                                                                }`}
                                                            >
                                                                <Power className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenEditContrato(item)}
                                                                title="Editar valor de contrato"
                                                                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 transition-colors"
                                                            >
                                                                <Edit3 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteContrato(item)}
                                                                disabled={loading}
                                                                title="Eliminar valor de contrato"
                                                                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: Reclamos a Proveedores (Matriz de Usuarios y Privilegios Especiales) */}
            {activeTab === 'reclamos_proveedores' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                            {/* Buscador de usuario */}
                            <div className="relative w-full sm:w-80">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre, usuario o email..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all font-medium"
                                />
                            </div>

                            {/* Filtro por Rol */}
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <span className="text-xs font-bold text-slate-500 whitespace-nowrap flex items-center gap-1">
                                    <Filter className="w-3.5 h-3.5 text-cyan-700" />
                                    Rol:
                                </span>
                                <select
                                    value={filterRol}
                                    onChange={e => setFilterRol(e.target.value)}
                                    className="w-full sm:w-60 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
                                >
                                    <option value="TODOS">-- Todos los Roles --</option>
                                    {rolesDisponibles.map(r => (
                                        <option key={r.id} value={r.id}>{r.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="text-xs text-slate-500 font-medium">
                            Mostrando <strong className="text-slate-800">{usuariosReclamosFiltrados.length}</strong> usuarios
                        </div>
                    </div>

                    {/* Banner Explicativo */}
                    <div className="p-3.5 bg-gradient-to-r from-cyan-50/70 to-sky-50/70 border border-cyan-200/80 rounded-xl flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 text-cyan-700 shrink-0 mt-0.5" />
                        <div className="text-xs text-slate-700 space-y-1 leading-relaxed">
                            <p className="font-bold text-cyan-950">
                                Privilegios Especiales para el Módulo de Reclamos a Proveedores
                            </p>
                            <p>
                                Por defecto, los usuarios solo pueden ingresar un reclamo nuevo (Paso 1) y no pueden editar ni eliminar. 
                                Activa las casillas a continuación para otorgar facultades adicionales por usuario:
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] font-semibold text-slate-600">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> <strong>Editar:</strong> Modificar antecedentes y producto del reclamo.</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-600"></span> <strong>Fechas Seguimiento:</strong> Modificar Fecha Envío a Proveedor (Compras) y Fecha Recepción Respuesta.</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-600"></span> <strong>Adjuntar Respuesta:</strong> Cargar el archivo de respaldo cuando se recepcione la respuesta.</span>
                            </div>
                        </div>
                    </div>

                    {/* Tabla de Usuarios */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                        <table className="w-full text-left text-xs text-slate-600">
                            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="py-3 px-4">Usuario / Colaborador</th>
                                    <th className="py-3 px-4">Perfil / Rol</th>
                                    <th className="py-3 px-4 text-center">
                                        <div className="inline-flex flex-col items-center">
                                            <span>Editar Reclamos</span>
                                            <span className="text-[9px] font-normal text-slate-400 lowercase">(paso 1 a 3)</span>
                                        </div>
                                    </th>
                                    <th className="py-3 px-4 text-center">
                                        <div className="inline-flex flex-col items-center">
                                            <span>Fechas Seguimiento</span>
                                            <span className="text-[9px] font-normal text-slate-400 lowercase">(envío / respuesta)</span>
                                        </div>
                                    </th>
                                    <th className="py-3 px-4 text-center">
                                        <div className="inline-flex flex-col items-center">
                                            <span>Adjuntar Respuesta</span>
                                            <span className="text-[9px] font-normal text-slate-400 lowercase">(documento resp.)</span>
                                        </div>
                                    </th>
                                    <th className="py-3 px-4 text-right">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {usuariosReclamosFiltrados.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                                            No se encontraron usuarios con los filtros seleccionados
                                        </td>
                                    </tr>
                                ) : (
                                    usuariosReclamosFiltrados.map(user => {
                                        const isUpdating = updatingUserId === user.userId
                                        const hasAnyPriv = user.puedeEditar || user.puedeFechasSeguimiento || user.puedeAdjuntarRespuesta

                                        return (
                                            <tr key={user.userId} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="font-bold text-slate-900">{user.nombre}</div>
                                                    <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                                                        <span>@{user.username}</span>
                                                        {user.email && <span className="text-slate-400">• {user.email}</span>}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                        {user.rolNombre}
                                                    </span>
                                                </td>
                                                
                                                {/* Switch: Editar Reclamos */}
                                                <td className="py-3 px-4 text-center">
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={user.puedeEditar}
                                                            disabled={!canManage || isUpdating}
                                                            onChange={() => handleTogglePrivilegioUsuario(user.userId, 'puedeEditar')}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600 disabled:opacity-50"></div>
                                                    </label>
                                                </td>

                                                {/* Switch: Fecha Envío y Recepción */}
                                                <td className="py-3 px-4 text-center">
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={user.puedeFechasSeguimiento}
                                                            disabled={!canManage || isUpdating}
                                                            onChange={() => handleTogglePrivilegioUsuario(user.userId, 'puedeFechasSeguimiento')}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-700 disabled:opacity-50"></div>
                                                    </label>
                                                </td>

                                                {/* Switch: Adjuntar Respuesta */}
                                                <td className="py-3 px-4 text-center">
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={user.puedeAdjuntarRespuesta}
                                                            disabled={!canManage || isUpdating}
                                                            onChange={() => handleTogglePrivilegioUsuario(user.userId, 'puedeAdjuntarRespuesta')}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 disabled:opacity-50"></div>
                                                    </label>
                                                </td>

                                                {/* Resumen Estado */}
                                                <td className="py-3 px-4 text-right">
                                                    {isUpdating ? (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-700">
                                                            <RefreshCw className="w-3 h-3 animate-spin" /> Guardando...
                                                        </span>
                                                    ) : hasAnyPriv ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-50 text-cyan-800 border border-cyan-200">
                                                            <Check className="w-3 h-3 text-cyan-700" />
                                                            Con Permisos
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400 font-semibold italic">
                                                            Estándar (Paso 1)
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal para Crear / Editar Motivo C8 */}
            {modalMotivoOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <Tag className="w-4 h-4 text-cyan-600" />
                                {editingMotivo ? 'Editar Motivo C8' : 'Nuevo Motivo C8'}
                            </h3>
                            <button
                                onClick={() => setModalMotivoOpen(false)}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveMotivo} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Código del Motivo *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: C8-EXTRANEO"
                                    value={codigoForm}
                                    onChange={e => setCodigoForm(e.target.value.toUpperCase())}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white uppercase font-bold"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Nombre / Glosa del Motivo *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Presencia de Cuerpo Extraño"
                                    value={nombreForm}
                                    onChange={e => setNombreForm(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Licitación Asociada *
                                </label>
                                <select
                                    required
                                    value={motivoLicitacionForm}
                                    onChange={e => setMotivoLicitacionForm(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
                                >
                                    <option value="TODAS">Todas las Licitaciones (Global)</option>
                                    {licitaciones.map(l => (
                                        <option key={l.id} value={l.id}>{l.label}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Indica si este motivo C8 aplica a todas las licitaciones o únicamente a una licitación específica.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Descripción / Alcance
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Detalles sobre cuándo aplica este motivo..."
                                    value={descripcionForm}
                                    onChange={e => setDescripcionForm(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white resize-none"
                                />
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={activoForm}
                                        onChange={e => setActivoForm(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                                </label>
                                <span className="text-xs font-semibold text-slate-700">
                                    {activoForm ? 'Motivo Activo' : 'Motivo Inactivo'}
                                </span>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setModalMotivoOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-cyan-700/20 disabled:opacity-50"
                                >
                                    {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    {editingMotivo ? 'Actualizar Motivo' : 'Crear Motivo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal para Crear / Editar Valor Anual del Contrato */}
            {modalContratoOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-cyan-600" />
                                {editingContrato ? 'Editar Valor Anual del Contrato' : 'Nuevo Valor Anual del Contrato'}
                            </h3>
                            <button
                                onClick={() => setModalContratoOpen(false)}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveContrato} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Licitación *
                                </label>
                                <select
                                    required
                                    value={contratoLicitacion}
                                    onChange={e => setContratoLicitacion(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">Seleccione Licitación</option>
                                    {licitaciones.map(l => (
                                        <option key={l.id} value={l.id}>{l.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Año de Vigencia *
                                </label>
                                <input
                                    type="number"
                                    required
                                    value={contratoAnio}
                                    onChange={e => setContratoAnio(Number(e.target.value))}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Monto Anual del Contrato ($ Pesos) *
                                </label>
                                <input
                                    type="number"
                                    required
                                    placeholder="Ej: 1500000000"
                                    value={contratoMonto || ''}
                                    onChange={e => setContratoMonto(Number(e.target.value))}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                                <div className="mt-1 flex items-center justify-between text-[11px] text-cyan-800 font-bold">
                                    <span>Formato: ${Number(contratoMonto || 0).toLocaleString('es-CL')}</span>
                                    <span>1% ETA: ${Math.round(Number(contratoMonto || 0) * 0.01).toLocaleString('es-CL')}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Descripción / Observación
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Detalles sobre el contrato, bases técnicas o adendas..."
                                    value={contratoDescripcion}
                                    onChange={e => setContratoDescripcion(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none font-medium"
                                />
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={contratoActivo}
                                        onChange={e => setContratoActivo(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                                </label>
                                <span className="text-xs font-semibold text-slate-700">
                                    {contratoActivo ? 'Registro Activo' : 'Registro Inactivo'}
                                </span>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setModalContratoOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-cyan-700/20 disabled:opacity-50"
                                >
                                    {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    {editingContrato ? 'Actualizar Contrato' : 'Guardar Contrato'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
