'use client'

import React, { useState } from 'react'
import {
    Warehouse,
    Truck,
    Users,
    Briefcase,
    Building2,
    Sliders,
    Plus,
    Edit2,
    CheckCircle2,
    XCircle,
    Trash2,
    Search,
    Phone,
    Send
} from 'lucide-react'
import {
    crearAnden,
    actualizarAnden,
    eliminarAnden,
    cambiarEstadoAnden,
    getAndenes
} from '@/actions/logistica/andenes'
import {
    guardarChofer,
    guardarCamion,
    guardarTransportista,
    guardarCliente,
    guardarParametro
} from '@/actions/logistica/maestros'

interface Props {
    initialBodegas: any[]
    initialAndenes: any[]
    initialChoferes: any[]
    initialCamiones: any[]
    initialTransportistas: any[]
    initialClientes: any[]
    initialParametros: any[]
}

type TabType = 'andenes' | 'choferes' | 'camiones' | 'transportistas' | 'clientes' | 'parametros'

export default function ConfiguracionClient({
    initialBodegas,
    initialAndenes,
    initialChoferes,
    initialCamiones,
    initialTransportistas,
    initialClientes,
    initialParametros
}: Props) {
    const [tab, setTab] = useState<TabType>('andenes')
    const [bodegaActivaId, setBodegaActivaId] = useState(initialBodegas[0]?.id || '')

    const [andenes, setAndenes] = useState(initialAndenes)
    const [choferes, setChoferes] = useState(initialChoferes)
    const [camiones, setCamiones] = useState(initialCamiones)
    const [transportistas, setTransportistas] = useState(initialTransportistas)
    const [clientes, setClientes] = useState(initialClientes)
    const [parametros, setParametros] = useState(initialParametros)

    const [search, setSearch] = useState('')
    const [modal, setModal] = useState<{ tipo: TabType; item?: any } | null>(null)
    const [guardando, setGuardando] = useState(false)
    const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

    const handleBodegaChange = async (newId: string) => {
        setBodegaActivaId(newId)
        const res = await getAndenes(newId)
        if (res.andenes) setAndenes(res.andenes)
    }

    // Handlers para Andenes
    const submitAnden = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setGuardando(true)
        const form = new FormData(e.currentTarget)
        const data = {
            bodegaId: bodegaActivaId,
            codigo: form.get('codigo') as string,
            nombre: form.get('nombre') as string,
            tipoCarga: form.get('tipoCarga') as string,
            orden: parseInt(form.get('orden') as string, 10) || 1
        }

        try {
            if (modal?.item) {
                const res = await actualizarAnden(modal.item.id, data)
                if (res.success) {
                    setAndenes(prev => prev.map(a => (a.id === modal.item.id ? res.anden : a)))
                    setMensaje({ tipo: 'ok', texto: 'Andén actualizado con éxito.' })
                    setModal(null)
                } else {
                    setMensaje({ tipo: 'error', texto: res.error || 'Error al actualizar.' })
                }
            } else {
                const res = await crearAnden(data)
                if (res.success) {
                    setAndenes(prev => [...prev, res.anden])
                    setMensaje({ tipo: 'ok', texto: 'Andén creado con éxito.' })
                    setModal(null)
                } else {
                    setMensaje({ tipo: 'error', texto: res.error || 'Error al crear andén.' })
                }
            }
        } finally {
            setGuardando(false)
        }
    }

    // Handlers para Choferes
    const submitChofer = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setGuardando(true)
        const form = new FormData(e.currentTarget)
        const data = {
            id: modal?.item?.id,
            nombre: form.get('nombre') as string,
            rut: form.get('rut') as string,
            telefono: form.get('telefono') as string,
            telegramChatId: (form.get('telegramChatId') as string) || undefined,
            transportistaId: (form.get('transportistaId') as string) || undefined
        }

        try {
            const res = await guardarChofer(data)
            if (res.success) {
                if (modal?.item?.id) {
                    setChoferes(prev => prev.map(c => (c.id === modal.item.id ? res.chofer : c)))
                } else {
                    setChoferes(prev => [res.chofer, ...prev])
                }
                setMensaje({ tipo: 'ok', texto: 'Chofer guardado con éxito.' })
                setModal(null)
            } else {
                setMensaje({ tipo: 'error', texto: res.error || 'Error al guardar chofer.' })
            }
        } finally {
            setGuardando(false)
        }
    }

    // Handlers para Camiones
    const submitCamion = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setGuardando(true)
        const form = new FormData(e.currentTarget)
        const data = {
            id: modal?.item?.id,
            patente: form.get('patente') as string,
            tipoVehiculo: form.get('tipoVehiculo') as string,
            capacidadKg: parseFloat(form.get('capacidadKg') as string) || undefined,
            capacidadM3: parseFloat(form.get('capacidadM3') as string) || undefined,
            transportistaId: (form.get('transportistaId') as string) || undefined
        }

        try {
            const res = await guardarCamion(data)
            if (res.success) {
                if (modal?.item?.id) {
                    setCamiones(prev => prev.map(c => (c.id === modal.item.id ? res.camion : c)))
                } else {
                    setCamiones(prev => [res.camion, ...prev])
                }
                setMensaje({ tipo: 'ok', texto: 'Camión guardado con éxito.' })
                setModal(null)
            } else {
                setMensaje({ tipo: 'error', texto: res.error || 'Error al guardar camión.' })
            }
        } finally {
            setGuardando(false)
        }
    }

    // Handlers para Transportistas
    const submitTransportista = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setGuardando(true)
        const form = new FormData(e.currentTarget)
        const data = {
            id: modal?.item?.id,
            rut: form.get('rut') as string,
            razonSocial: form.get('razonSocial') as string,
            contacto: (form.get('contacto') as string) || undefined,
            telefono: (form.get('telefono') as string) || undefined,
            email: (form.get('email') as string) || undefined
        }

        try {
            const res = await guardarTransportista(data)
            if (res.success) {
                if (modal?.item?.id) {
                    setTransportistas(prev => prev.map(t => (t.id === modal.item.id ? res.transportista : t)))
                } else {
                    setTransportistas(prev => [res.transportista, ...prev])
                }
                setMensaje({ tipo: 'ok', texto: 'Transportista guardado.' })
                setModal(null)
            } else {
                setMensaje({ tipo: 'error', texto: res.error || 'Error al guardar.' })
            }
        } finally {
            setGuardando(false)
        }
    }

    // Handlers para Clientes
    const submitCliente = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setGuardando(true)
        const form = new FormData(e.currentTarget)
        const data = {
            id: modal?.item?.id,
            codigo: form.get('codigo') as string,
            razonSocial: form.get('razonSocial') as string,
            direccion: (form.get('direccion') as string) || undefined,
            comuna: (form.get('comuna') as string) || undefined,
            region: (form.get('region') as string) || undefined
        }

        try {
            const res = await guardarCliente(data)
            if (res.success) {
                if (modal?.item?.id) {
                    setClientes(prev => prev.map(c => (c.id === modal.item.id ? res.cliente : c)))
                } else {
                    setClientes(prev => [res.cliente, ...prev])
                }
                setMensaje({ tipo: 'ok', texto: 'Cliente guardado.' })
                setModal(null)
            } else {
                setMensaje({ tipo: 'error', texto: res.error || 'Error al guardar cliente.' })
            }
        } finally {
            setGuardando(false)
        }
    }

    // Handlers para Parámetros
    const submitParametro = async (clave: string, valor: string) => {
        const res = await guardarParametro(clave, valor)
        if (res.success) {
            setParametros(prev => prev.map(p => (p.clave === clave ? { ...p, valor } : p)))
            setMensaje({ tipo: 'ok', texto: 'Parámetro actualizado.' })
        } else {
            setMensaje({ tipo: 'error', texto: res.error || 'Error al guardar parámetro.' })
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            {/* CABECERA ESTÁNDAR HENDAYA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-50 to-sky-50 rounded-bl-full -z-10 opacity-70" />
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-cyan-100 text-cyan-700 rounded-xl text-xl">⚙️</span>
                        Catálogos y Parámetros Logísticos
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm font-medium">
                        Gestión centralizada de infraestructura de andenes, choferes, camiones y parámetros de despacho.
                    </p>
                </div>
            </div>

            {/* MENSAJES DE ESTADO */}
            {mensaje && (
                <div
                    className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-3 border shadow-sm ${
                        mensaje.tipo === 'ok'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    {mensaje.tipo === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <XCircle className="w-4 h-4 shrink-0 text-rose-600" />}
                    <span className="flex-1">{mensaje.texto}</span>
                    <button onClick={() => setMensaje(null)} className="px-2 py-0.5 rounded hover:bg-black/5">✕</button>
                </div>
            )}

            {/* SELECTOR DE PESTAÑAS ESTILO HENDAYA */}
            <div className="flex flex-wrap items-center gap-1.5 bg-gray-100/80 p-1.5 rounded-2xl border border-gray-200">
                {[
                    { id: 'andenes', label: 'Bodegas & Andenes', icon: Warehouse },
                    { id: 'choferes', label: 'Choferes & Telegram', icon: Users },
                    { id: 'camiones', label: 'Camiones & Patentes', icon: Truck },
                    { id: 'transportistas', label: 'Transportistas', icon: Briefcase },
                    { id: 'clientes', label: 'Clientes / Destinos', icon: Building2 },
                    { id: 'parametros', label: 'Parámetros Operativos', icon: Sliders }
                ].map(t => {
                    const Icon = t.icon
                    const isSelected = tab === t.id
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                                setTab(t.id as TabType)
                                setSearch('')
                            }}
                            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
                                isSelected
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                            }`}
                        >
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-cyan-600' : 'text-gray-400'}`} />
                            {t.label}
                        </button>
                    )
                })}
            </div>

            {/* TAB 1: BODEGAS & ANDENES */}
            {tab === 'andenes' && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-3">
                            <label className="text-xs font-bold text-gray-700">Bodega / CD:</label>
                            <select
                                value={bodegaActivaId}
                                onChange={e => handleBodegaChange(e.target.value)}
                                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-gray-50 border border-gray-200 text-cyan-700 focus:bg-white"
                            >
                                {initialBodegas.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={() => setModal({ tipo: 'andenes' })}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition"
                        >
                            <Plus className="w-4 h-4 text-cyan-400" />
                            Nuevo Andén
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {andenes.map(a => {
                            const isDisp = a.estadoOperativo === 'DISPONIBLE'
                            const isOcup = a.estadoOperativo === 'OCUPADO'
                            const isBloq = a.estadoOperativo === 'BLOQUEADO' || a.estadoOperativo === 'MANTENCION'

                            return (
                                <div
                                    key={a.id}
                                    className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-cyan-300 transition-all"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-gray-100 text-gray-900 border border-gray-200">
                                                {a.codigo}
                                            </span>
                                            <span
                                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                                    isDisp
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : isOcup
                                                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                                }`}
                                            >
                                                {a.estadoOperativo}
                                            </span>
                                        </div>

                                        <h3 className="font-bold text-gray-900 text-sm">{a.nombre}</h3>
                                        <p className="text-xs text-gray-500 font-medium">Tipo: {a.tipoCarga}</p>
                                    </div>

                                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            {isDisp && (
                                                <button
                                                    type="button"
                                                    onClick={() => cambiarEstadoAnden(a.id, 'MANTENCION', 'Puesto en mantención')}
                                                    className="text-xs text-amber-600 hover:underline font-bold"
                                                >
                                                    Pausar
                                                </button>
                                            )}
                                            {isBloq && (
                                                <button
                                                    type="button"
                                                    onClick={() => cambiarEstadoAnden(a.id, 'DISPONIBLE', 'Reactivado')}
                                                    className="text-xs text-emerald-600 hover:underline font-bold"
                                                >
                                                    Habilitar
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setModal({ tipo: 'andenes', item: a })}
                                                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (confirm(`¿Eliminar o desactivar ${a.nombre}?`)) {
                                                        await eliminarAnden(a.id)
                                                        setAndenes(prev => prev.filter(x => x.id !== a.id))
                                                    }
                                                }}
                                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* TAB 2: CHOFERES */}
            {tab === 'choferes' && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="relative w-full sm:w-72">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar por nombre o RUT..."
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-800 focus:bg-white"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => setModal({ tipo: 'choferes' })}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition"
                        >
                            <Plus className="w-4 h-4 text-cyan-400" />
                            Nuevo Chofer
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50/80 text-gray-500 uppercase tracking-wider font-bold border-y border-gray-200">
                                <tr>
                                    <th className="py-3 px-3.5">Nombre</th>
                                    <th className="py-3 px-3.5">RUT</th>
                                    <th className="py-3 px-3.5">Teléfono</th>
                                    <th className="py-3 px-3.5">Telegram Chat ID</th>
                                    <th className="py-3 px-3.5">Transportista</th>
                                    <th className="py-3 px-3.5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {choferes
                                    .filter(c =>
                                        c.nombre?.toLowerCase().includes(search.toLowerCase()) ||
                                        c.rut?.toLowerCase().includes(search.toLowerCase())
                                    )
                                    .map(c => (
                                        <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="py-3 px-3.5 font-bold text-gray-900">{c.nombre}</td>
                                            <td className="py-3 px-3.5 font-mono text-gray-700">{c.rut}</td>
                                            <td className="py-3 px-3.5 font-mono text-gray-700">{c.telefono}</td>
                                            <td className="py-3 px-3.5 font-mono">
                                                {c.telegramChatId ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 font-bold border border-cyan-200 text-[10px]">
                                                        {c.telegramChatId}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 italic">No vinculado</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3.5 text-gray-600 font-medium">
                                                {c.transportista?.razonSocial || 'Independiente'}
                                            </td>
                                            <td className="py-3 px-3.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setModal({ tipo: 'choferes', item: c })}
                                                    className="p-1 rounded text-cyan-700 hover:bg-cyan-50"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: CAMIONES */}
            {tab === 'camiones' && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="relative w-full sm:w-72">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar patente..."
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-800 focus:bg-white"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => setModal({ tipo: 'camiones' })}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition"
                        >
                            <Plus className="w-4 h-4 text-cyan-400" />
                            Nuevo Camión
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50/80 text-gray-500 uppercase tracking-wider font-bold border-y border-gray-200">
                                <tr>
                                    <th className="py-3 px-3.5">Patente</th>
                                    <th className="py-3 px-3.5">Tipo</th>
                                    <th className="py-3 px-3.5">Capacidad (Kg)</th>
                                    <th className="py-3 px-3.5">Capacidad (M3)</th>
                                    <th className="py-3 px-3.5">Transportista</th>
                                    <th className="py-3 px-3.5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {camiones
                                    .filter(c => c.patente?.toLowerCase().includes(search.toLowerCase()))
                                    .map(c => (
                                        <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="py-3 px-3.5 font-mono font-black text-gray-900 bg-gray-50 rounded">
                                                {c.patente}
                                            </td>
                                            <td className="py-3 px-3.5 text-gray-700 font-medium">{c.tipoVehiculo}</td>
                                            <td className="py-3 px-3.5 font-mono text-gray-700">{c.capacidadKg ? `${c.capacidadKg} kg` : '-'}</td>
                                            <td className="py-3 px-3.5 font-mono text-gray-700">{c.capacidadM3 ? `${c.capacidadM3} m³` : '-'}</td>
                                            <td className="py-3 px-3.5 text-gray-600 font-medium">{c.transportista?.razonSocial || 'Propio'}</td>
                                            <td className="py-3 px-3.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setModal({ tipo: 'camiones', item: c })}
                                                    className="p-1 rounded text-cyan-700 hover:bg-cyan-50"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 4: TRANSPORTISTAS */}
            {tab === 'transportistas' && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 text-sm">Empresas Transportistas</h3>
                        <button
                            type="button"
                            onClick={() => setModal({ tipo: 'transportistas' })}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition"
                        >
                            <Plus className="w-4 h-4 text-cyan-400" />
                            Nuevo Transportista
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {transportistas.map(t => (
                            <div
                                key={t.id}
                                className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2 hover:border-cyan-300 transition-all"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-sm">
                                            {t.razonSocial}
                                        </h4>
                                        <p className="text-xs font-mono text-gray-500 font-medium">RUT: {t.rut}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setModal({ tipo: 'transportistas', item: t })}
                                        className="text-cyan-700 hover:text-cyan-900"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="text-xs text-gray-600 space-y-1 pt-2 border-t border-gray-200">
                                    <p>Contacto: {t.contacto || '-'}</p>
                                    <p>Tel: {t.telefono || '-'}</p>
                                    <p>Email: {t.email || '-'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 5: CLIENTES */}
            {tab === 'clientes' && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 text-sm">Clientes y Destinos</h3>
                        <button
                            type="button"
                            onClick={() => setModal({ tipo: 'clientes' })}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition"
                        >
                            <Plus className="w-4 h-4 text-cyan-400" />
                            Nuevo Cliente
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50/80 text-gray-500 uppercase tracking-wider font-bold border-y border-gray-200">
                                <tr>
                                    <th className="py-3 px-3.5">Código</th>
                                    <th className="py-3 px-3.5">Razón Social</th>
                                    <th className="py-3 px-3.5">Comuna</th>
                                    <th className="py-3 px-3.5">Región</th>
                                    <th className="py-3 px-3.5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {clientes.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                                        <td className="py-3 px-3.5 font-mono font-bold text-cyan-700">{c.codigo}</td>
                                        <td className="py-3 px-3.5 font-bold text-gray-900">{c.razonSocial}</td>
                                        <td className="py-3 px-3.5 text-gray-600 font-medium">{c.comuna || '-'}</td>
                                        <td className="py-3 px-3.5 text-gray-600 font-medium">{c.region || '-'}</td>
                                        <td className="py-3 px-3.5 text-right">
                                            <button
                                                type="button"
                                                onClick={() => setModal({ tipo: 'clientes', item: c })}
                                                className="p-1 rounded text-cyan-700 hover:bg-cyan-50"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 6: PARÁMETROS */}
            {tab === 'parametros' && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div>
                        <h3 className="font-bold text-gray-900 text-sm">
                            Parámetros Operativos de Despacho
                        </h3>
                        <p className="text-xs text-gray-500 font-medium">
                            Configure tiempos de alerta, tolerancias de permanencia y automatizaciones.
                        </p>
                    </div>

                    <div className="space-y-3">
                        {parametros.map(p => (
                            <div
                                key={p.id}
                                className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                                <div>
                                    <span className="font-mono text-xs font-bold text-cyan-700">
                                        {p.clave}
                                    </span>
                                    <p className="text-xs text-gray-500 font-medium">{p.descripcion}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        defaultValue={p.valor}
                                        onBlur={e => {
                                            if (e.target.value !== p.valor) {
                                                submitParametro(p.clave, e.target.value)
                                            }
                                        }}
                                        className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white border border-gray-200 text-center w-28 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                    <span className="text-xs text-gray-500 font-semibold">
                                        {p.clave.includes('MINUTOS') ? 'min' : ''}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MODALES DINÁMICOS DE CREACIÓN / EDICIÓN */}
            {modal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white border border-gray-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-2xl animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <h3 className="font-bold text-gray-900 capitalize text-base">
                                {modal.item ? 'Editar' : 'Nuevo'} {modal.tipo.slice(0, -1)}
                            </h3>
                            <button
                                onClick={() => setModal(null)}
                                className="text-gray-400 hover:text-gray-600 font-bold p-1"
                            >
                                ✕
                            </button>
                        </div>

                        {/* FORMULARIO ANDÉN */}
                        {modal.tipo === 'andenes' && (
                            <form onSubmit={submitAnden} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Código del Andén (ej: AND-05)</label>
                                    <input
                                        name="codigo"
                                        required
                                        defaultValue={modal.item?.codigo || ''}
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 uppercase font-mono text-gray-900 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Nombre descriptivo</label>
                                    <input
                                        name="nombre"
                                        required
                                        defaultValue={modal.item?.nombre || ''}
                                        placeholder="ej: Andén 05 - Despacho Sur"
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Tipo de Carga</label>
                                    <select
                                        name="tipoCarga"
                                        defaultValue={modal.item?.tipoCarga || 'GENERAL'}
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 font-medium focus:bg-white"
                                    >
                                        <option value="GENERAL">Carga General</option>
                                        <option value="REFRIGERADO">Refrigerado</option>
                                        <option value="CONGELADO">Congelado</option>
                                        <option value="EXCLUSIVO">Exclusivo / Express</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Orden de Visualización</label>
                                    <input
                                        name="orden"
                                        type="number"
                                        defaultValue={modal.item?.orden || 1}
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:bg-white"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setModal(null)}
                                        className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={guardando}
                                        className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition"
                                    >
                                        {guardando ? 'Guardando...' : 'Guardar Andén'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* FORMULARIO CHOFER */}
                        {modal.tipo === 'choferes' && (
                            <form onSubmit={submitChofer} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Nombre Completo</label>
                                    <input
                                        name="nombre"
                                        required
                                        defaultValue={modal.item?.nombre || ''}
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">RUT</label>
                                    <input
                                        name="rut"
                                        required
                                        defaultValue={modal.item?.rut || ''}
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-mono text-gray-900 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Teléfono (ej: +56912345678)</label>
                                    <input
                                        name="telefono"
                                        required
                                        defaultValue={modal.item?.telefono || '+569'}
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-mono text-gray-900 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Telegram Chat ID (Para bot n8n)</label>
                                    <input
                                        name="telegramChatId"
                                        defaultValue={modal.item?.telegramChatId || ''}
                                        placeholder="ej: 123456789 (obtenido al iniciar bot)"
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-mono text-gray-900 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Transportista Asociado</label>
                                    <select
                                        name="transportistaId"
                                        defaultValue={modal.item?.transportistaId || ''}
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 font-medium focus:bg-white"
                                    >
                                        <option value="">Sin transportista (Independiente)</option>
                                        {transportistas.map(t => (
                                            <option key={t.id} value={t.id}>
                                                {t.razonSocial}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setModal(null)}
                                        className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={guardando}
                                        className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition"
                                    >
                                        {guardando ? 'Guardando...' : 'Guardar Chofer'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* FORMULARIO CAMIÓN */}
                        {modal.tipo === 'camiones' && (
                            <form onSubmit={submitCamion} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Patente</label>
                                    <input
                                        name="patente"
                                        required
                                        defaultValue={modal.item?.patente || ''}
                                        placeholder="ej: ABCD12"
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-mono uppercase text-gray-900 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Tipo de Vehículo</label>
                                    <select
                                        name="tipoVehiculo"
                                        defaultValue={modal.item?.tipoVehiculo || 'RAMPLA'}
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 font-medium focus:bg-white"
                                    >
                                        <option value="RAMPLA">Rampla / Tracto</option>
                                        <option value="3/4">Camión 3/4</option>
                                        <option value="CAMION_SIMPLE">Camión Simple</option>
                                        <option value="FURGON">Furgón</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Capacidad Kg</label>
                                        <input
                                            name="capacidadKg"
                                            type="number"
                                            defaultValue={modal.item?.capacidadKg || ''}
                                            placeholder="ej: 15000"
                                            className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-mono text-gray-900 focus:bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Capacidad M3</label>
                                        <input
                                            name="capacidadM3"
                                            type="number"
                                            defaultValue={modal.item?.capacidadM3 || ''}
                                            placeholder="ej: 45"
                                            className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-mono text-gray-900 focus:bg-white"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Transportista</label>
                                    <select
                                        name="transportistaId"
                                        defaultValue={modal.item?.transportistaId || ''}
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 font-medium focus:bg-white"
                                    >
                                        <option value="">Propio / Sin Transportista</option>
                                        {transportistas.map(t => (
                                            <option key={t.id} value={t.id}>
                                                {t.razonSocial}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setModal(null)}
                                        className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={guardando}
                                        className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition"
                                    >
                                        {guardando ? 'Guardando...' : 'Guardar Camión'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* FORMULARIO TRANSPORTISTA */}
                        {modal.tipo === 'transportistas' && (
                            <form onSubmit={submitTransportista} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Razón Social</label>
                                    <input
                                        name="razonSocial"
                                        required
                                        defaultValue={modal.item?.razonSocial || ''}
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">RUT Empresa</label>
                                    <input
                                        name="rut"
                                        required
                                        defaultValue={modal.item?.rut || ''}
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-mono text-gray-900 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Contacto Operativo</label>
                                    <input
                                        name="contacto"
                                        defaultValue={modal.item?.contacto || ''}
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:bg-white"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Teléfono</label>
                                        <input
                                            name="telefono"
                                            defaultValue={modal.item?.telefono || ''}
                                            className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-mono text-gray-900 focus:bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                                        <input
                                            name="email"
                                            type="email"
                                            defaultValue={modal.item?.email || ''}
                                            className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:bg-white"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setModal(null)}
                                        className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={guardando}
                                        className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition"
                                    >
                                        {guardando ? 'Guardando...' : 'Guardar Transportista'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* FORMULARIO CLIENTE */}
                        {modal.tipo === 'clientes' && (
                            <form onSubmit={submitCliente} className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Código de Cliente</label>
                                        <input
                                            name="codigo"
                                            required
                                            defaultValue={modal.item?.codigo || ''}
                                            className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 font-mono text-gray-900 focus:bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Comuna</label>
                                        <input
                                            name="comuna"
                                            defaultValue={modal.item?.comuna || ''}
                                            className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:bg-white"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Razón Social / Destino</label>
                                    <input
                                        name="razonSocial"
                                        required
                                        defaultValue={modal.item?.razonSocial || ''}
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Dirección Completa</label>
                                    <input
                                        name="direccion"
                                        defaultValue={modal.item?.direccion || ''}
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Región</label>
                                    <input
                                        name="region"
                                        defaultValue={modal.item?.region || ''}
                                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:bg-white"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setModal(null)}
                                        className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={guardando}
                                        className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition"
                                    >
                                        {guardando ? 'Guardando...' : 'Guardar Cliente'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
