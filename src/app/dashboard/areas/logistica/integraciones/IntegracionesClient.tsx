'use client'

import React, { useState } from 'react'
import {
    Activity,
    CheckCircle2,
    XCircle,
    Copy,
    Check,
    Send,
    RotateCcw,
    Shield,
    ArrowUpRight,
    ArrowDownLeft,
    RefreshCw,
    Terminal
} from 'lucide-react'
import {
    guardarIntegracionConfig,
    probarConexionN8N,
    reintentarEnvioLogAction
} from '@/actions/logistica/maestros'

interface Props {
    initialConfig: any
    initialLogs: any[]
    inboundWebhookUrl?: string
}

const EVENTOS_DISPONIBLES = [
    {
        id: 'RUTA_CREADA',
        label: 'Ruta Creada',
        desc: 'Se dispara al programar una nueva ruta en el sistema.'
    },
    {
        id: 'ANDEN_ASIGNADO',
        label: 'Andén Asignado',
        desc: 'Notifica al chofer el muelle y turno para presentarse.'
    },
    {
        id: 'CHOFER_NOTIFICADO',
        label: 'Llamado a Chofer',
        desc: 'Disparo manual o automático para enviar instrucción a Telegram.'
    },
    {
        id: 'DESPACHO_COMPLETADO',
        label: 'Despacho Completado',
        desc: 'Cierre de ruta, registro de sello de salida y liberación de muelle.'
    }
]

export default function IntegracionesClient({
    initialConfig,
    initialLogs,
    inboundWebhookUrl = '/api/logistica/webhooks/entrante'
}: Props) {
    const [webhookUrl, setWebhookUrl] = useState(initialConfig?.webhookUrl || '')
    const [secretToken, setSecretToken] = useState(initialConfig?.secretToken || '')
    const [activo, setActivo] = useState<boolean>(initialConfig?.activo ?? true)
    const [eventos, setEventos] = useState<string[]>(() => {
        if (!initialConfig?.eventosSuscritos) return ['ANDEN_ASIGNADO', 'CHOFER_NOTIFICADO']
        try {
            return JSON.parse(initialConfig.eventosSuscritos)
        } catch {
            return ['ANDEN_ASIGNADO', 'CHOFER_NOTIFICADO']
        }
    })

    const [logs, setLogs] = useState<any[]>(initialLogs)
    const [filtroEstado, setFiltroEstado] = useState<string>('ALL')
    const [guardando, setGuardando] = useState(false)
    const [probando, setProbando] = useState(false)
    const [reintentandoId, setReintentandoId] = useState<string | null>(null)
    const [payloadModal, setPayloadModal] = useState<any | null>(null)

    const [copiedInbound, setCopiedInbound] = useState(false)
    const [copiedToken, setCopiedToken] = useState(false)
    const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

    const handleGuardar = async (e: React.FormEvent) => {
        e.preventDefault()
        setGuardando(true)
        setMensaje(null)
        try {
            const res = await guardarIntegracionConfig({
                webhookUrl,
                secretToken,
                activo,
                eventosSuscritos: eventos
            })

            if (res.success) {
                setMensaje({ tipo: 'ok', texto: 'Configuración guardada exitosamente.' })
            } else {
                setMensaje({ tipo: 'error', texto: res.error || 'Error al guardar.' })
            }
        } finally {
            setGuardando(false)
        }
    }

    const handleProbarConexion = async () => {
        setProbando(true)
        setMensaje(null)
        try {
            const res = await probarConexionN8N()
            if (res.success) {
                setMensaje({ tipo: 'ok', texto: `Prueba exitosa. Workflow n8n respondió correctamente.` })
            } else {
                setMensaje({ tipo: 'error', texto: `Error en la prueba: ${res.error || 'n8n no respondió'}` })
            }
        } finally {
            setProbando(false)
        }
    }

    const handleReintentar = async (logId: string) => {
        setReintentandoId(logId)
        try {
            const res = await reintentarEnvioLogAction(logId)
            if (res.success) {
                setMensaje({ tipo: 'ok', texto: 'Webhook reintentado exitosamente.' })
            } else {
                setMensaje({ tipo: 'error', texto: res.error || 'Falló el reintento del webhook.' })
            }
        } finally {
            setReintentandoId(null)
        }
    }

    const toggleEvento = (id: string) => {
        setEventos(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
    }

    const generarNuevoToken = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        let token = 'hnd_'
        for (let i = 0; i < 32; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        setSecretToken(token)
    }

    const copiarAlPortapapeles = (texto: string, setCopied: (v: boolean) => void) => {
        navigator.clipboard.writeText(texto)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
    }

    const logsFiltrados = logs.filter(l => {
        if (filtroEstado === 'ALL') return true
        return l.estado === filtroEstado
    })

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            {/* CABECERA ESTÁNDAR HENDAYA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-50 to-sky-50 rounded-bl-full -z-10 opacity-70" />
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-cyan-100 text-cyan-700 rounded-xl text-xl">⚡</span>
                        Integraciones con n8n & Telegram
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm font-medium">
                        Configuración de webhooks salientes hacia n8n y endpoint receptor para confirmaciones de choferes.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleProbarConexion}
                        disabled={probando || !webhookUrl}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 transition shadow-sm"
                    >
                        <Send className={`w-4 h-4 ${probando ? 'animate-bounce' : ''}`} />
                        {probando ? 'Probando...' : 'Probar Webhook'}
                    </button>
                </div>
            </div>

            {/* MENSAJES DE ALERTA */}
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

            {/* GRID 2 COLUMNAS: OUTBOUND & INBOUND */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Panel 1: Saliente hacia n8n */}
                <form
                    onSubmit={handleGuardar}
                    className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-5"
                >
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-100">
                                <ArrowUpRight className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-sm">
                                    Webhook Saliente (Hendaya → n8n)
                                </h3>
                                <p className="text-xs text-gray-500 font-medium">Eventos emitidos al crear rutas y asignar andenes.</p>
                            </div>
                        </div>

                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={activo}
                                onChange={e => setActivo(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                            <span className="ml-2 text-xs font-bold text-gray-700">
                                {activo ? 'Activo' : 'Inactivo'}
                            </span>
                        </label>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                Webhook URL de n8n <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="url"
                                required
                                value={webhookUrl}
                                onChange={e => setWebhookUrl(e.target.value)}
                                placeholder="https://tu-instancia-n8n.com/webhook/hendaya-despacho"
                                className="w-full px-3.5 py-2 text-xs font-mono rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-bold text-gray-700">
                                    Secret Token / Bearer (Firma HMAC SHA-256)
                                </label>
                                <button
                                    type="button"
                                    onClick={generarNuevoToken}
                                    className="text-xs text-cyan-700 hover:underline flex items-center gap-1 font-bold"
                                >
                                    <RotateCcw className="w-3 h-3" /> Regenerar
                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={secretToken}
                                    onChange={e => setSecretToken(e.target.value)}
                                    placeholder="Token secreto compartido..."
                                    className="w-full pr-10 px-3.5 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                />
                                <button
                                    type="button"
                                    onClick={() => copiarAlPortapapeles(secretToken, setCopiedToken)}
                                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                                    title="Copiar token"
                                >
                                    {copiedToken ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2">
                                Eventos Suscritos a Despachar
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {EVENTOS_DISPONIBLES.map(ev => {
                                    const checked = eventos.includes(ev.id)
                                    return (
                                        <div
                                            key={ev.id}
                                            onClick={() => toggleEvento(ev.id)}
                                            className={`p-3 rounded-xl border cursor-pointer select-none transition ${
                                                checked
                                                    ? 'bg-cyan-50/60 border-cyan-300 text-cyan-950 shadow-2xs'
                                                    : 'bg-gray-50 border-gray-200 text-gray-500 opacity-80'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => {}}
                                                    className="rounded text-cyan-600 focus:ring-cyan-500"
                                                />
                                                <span className="text-xs font-bold">{ev.label}</span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 mt-1 pl-5 font-medium">{ev.desc}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex justify-end">
                        <button
                            type="submit"
                            disabled={guardando}
                            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                        >
                            {guardando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-cyan-400" />}
                            {guardando ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                </form>

                {/* Panel 2: Entrante desde n8n / Telegram */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-5 flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
                            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                                <ArrowDownLeft className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-sm">
                                    Webhook Entrante (n8n → Hendaya)
                                </h3>
                                <p className="text-xs text-gray-500 font-medium">
                                    URL que debe invocar su workflow de n8n para confirmar la llegada del chofer al portón.
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                URL de Callback del Sistema (Copiar en n8n HTTP Request)
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={inboundWebhookUrl}
                                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-mono select-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => copiarAlPortapapeles(inboundWebhookUrl, setCopiedInbound)}
                                    className="px-3.5 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 flex items-center gap-1.5 shrink-0 transition"
                                >
                                    {copiedInbound ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                                    {copiedInbound ? 'Copiado' : 'Copiar URL'}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                Formato JSON de Petición HTTP (POST)
                            </label>
                            <div className="p-3.5 bg-slate-900 text-cyan-300 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800 space-y-1">
                                <p className="text-slate-400">// Payload que envía el Bot de Telegram a Hendaya al presionar "Llegué":</p>
                                <pre>{`{
  "tokenRuta": "43b05ba6-ca92-4ac5-af59-75f26fe03a9b",
  "accion": "LLEGADA_PORTON",
  "choferTelegramId": "123456789",
  "notas": "Chofer confirmó llegada por Telegram",
  "metadata": {
    "lat": -33.456,
    "lng": -70.658
  }
}`}</pre>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1 font-medium">
                            <p className="font-bold flex items-center gap-1.5 text-amber-950">
                                <Shield className="w-4 h-4 text-amber-600" /> Seguridad y Token Secreto
                            </p>
                            <p>
                                Hendaya valida automáticamente el token en la URL contra el secreto configurado. Cualquier petición externa con token erróneo será rechazada con HTTP 401.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Panel 3: Bitácora de Integraciones (Logs) */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-100">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-sm">
                                Historial y Bitácora de Envíos (n8n Logs)
                            </h3>
                            <p className="text-xs text-gray-500 font-medium">Últimos eventos enviados por el despachador de webhooks.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-600">Filtrar:</label>
                        <select
                            value={filtroEstado}
                            onChange={e => setFiltroEstado(e.target.value)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-50 border border-gray-200 text-gray-800"
                        >
                            <option value="ALL">Todos los Estados</option>
                            <option value="EXITO">Solo Exitosos</option>
                            <option value="ERROR">Solo Errores</option>
                            <option value="PENDIENTE">Pendientes</option>
                        </select>
                    </div>
                </div>

                {logsFiltrados.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 text-xs font-medium">
                        No hay eventos registrados en la bitácora todavía.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50/80 text-gray-500 uppercase tracking-wider font-bold border-y border-gray-200">
                                <tr>
                                    <th className="py-3 px-3.5">Fecha / Hora</th>
                                    <th className="py-3 px-3.5">Evento</th>
                                    <th className="py-3 px-3.5">Ruta</th>
                                    <th className="py-3 px-3.5">Estado</th>
                                    <th className="py-3 px-3.5">Código HTTP</th>
                                    <th className="py-3 px-3.5">Intentos</th>
                                    <th className="py-3 px-3.5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {logsFiltrados.map(log => {
                                    const isOk = log.estado === 'EXITO'
                                    return (
                                        <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="py-3 px-3.5 font-mono text-gray-700">
                                                {new Date(log.createdAt).toLocaleString('es-CL')}
                                            </td>
                                            <td className="py-3 px-3.5 font-bold text-gray-900">
                                                {log.evento}
                                            </td>
                                            <td className="py-3 px-3.5 font-mono text-cyan-700 font-bold">
                                                {log.ruta?.numeroRuta || '-'}
                                            </td>
                                            <td className="py-3 px-3.5">
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                                        isOk
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : 'bg-rose-50 text-rose-700 border-rose-200'
                                                    }`}
                                                >
                                                    {isOk ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                    {log.estado}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3.5 font-mono text-gray-700">
                                                {log.respuestaCodigo || '-'}
                                            </td>
                                            <td className="py-3 px-3.5 text-gray-700 font-medium">{log.intentos}</td>
                                            <td className="py-3 px-3.5 text-right space-x-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setPayloadModal(log)}
                                                    className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition"
                                                >
                                                    Ver Payload
                                                </button>
                                                {!isOk && (
                                                    <button
                                                        type="button"
                                                        disabled={reintentandoId === log.id}
                                                        onClick={() => handleReintentar(log.id)}
                                                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 transition"
                                                    >
                                                        {reintentandoId === log.id ? 'Reintentando...' : 'Reintentar'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL PARA VER PAYLOAD JSON */}
            {payloadModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white border border-gray-200 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-4 shadow-2xl animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                                <Terminal className="w-4 h-4 text-cyan-600" />
                                Detalle de Payload: {payloadModal.evento}
                            </h3>
                            <button
                                onClick={() => setPayloadModal(null)}
                                className="text-gray-400 hover:text-gray-600 font-bold p-1"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">Payload Enviado:</label>
                                <pre className="p-3.5 rounded-xl bg-slate-950 text-cyan-300 text-xs font-mono max-h-60 overflow-y-auto">
                                    {JSON.stringify(JSON.parse(payloadModal.payloadEnviado || '{}'), null, 2)}
                                </pre>
                            </div>

                            {payloadModal.errorDetalle && (
                                <div>
                                    <label className="text-xs font-bold text-rose-700 block mb-1">Detalle del Error:</label>
                                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono">
                                        {payloadModal.errorDetalle}
                                    </div>
                                </div>
                            )}

                            {payloadModal.respuestaCuerpo && (
                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1">Respuesta de n8n:</label>
                                    <pre className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 text-xs font-mono max-h-32 overflow-y-auto">
                                        {payloadModal.respuestaCuerpo}
                                    </pre>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-2 border-t border-gray-100">
                            <button
                                onClick={() => setPayloadModal(null)}
                                className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
