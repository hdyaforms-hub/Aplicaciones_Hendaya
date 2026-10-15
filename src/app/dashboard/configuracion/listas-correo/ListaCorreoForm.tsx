'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createListaCorreo, updateListaCorreo } from './actions'

type FormProps = {
    lista?: {
        id: string
        nombre: string
        descripcion: string | null
        para: string // JSON string[]
        cc: string | null // JSON string[]
        sucursalId?: string | null
        porSucursal?: string | null // JSON Record<string, { para: string[], cc: string[] }>
    }
    sucursales: { id: string; nombre: string }[]
    onClose: () => void
}

export default function ListaCorreoForm({ lista, sucursales, onClose }: FormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [activeTab, setActiveTab] = useState<'GLOBAL' | 'SUCURSALES'>('GLOBAL')
    const [sucursalSearch, setSucursalSearch] = useState('')

    // Parseando correos base/globales
    let initialPara = ''
    let initialCc = ''
    if (lista) {
        try {
            const arrPara = JSON.parse(lista.para)
            initialPara = Array.isArray(arrPara) ? arrPara.join('\n') : ''
        } catch { }
        try {
            if (lista.cc) {
                const arrCc = JSON.parse(lista.cc)
                initialCc = Array.isArray(arrCc) ? arrCc.join('\n') : ''
            }
        } catch { }
    }

    // Parseando correos por sucursal
    const initialPorSucursalState: Record<string, { paraText: string, ccText: string }> = {}
    if (lista?.porSucursal) {
        try {
            const parsed = typeof lista.porSucursal === 'string' ? JSON.parse(lista.porSucursal) : lista.porSucursal
            if (typeof parsed === 'object' && parsed !== null) {
                const map = parsed as Record<string, { para?: string[]; cc?: string[] }>
                for (const [sId, item] of Object.entries(map)) {
                    initialPorSucursalState[sId] = {
                        paraText: Array.isArray(item?.para) ? item.para.join('\n') : '',
                        ccText: Array.isArray(item?.cc) ? item.cc.join('\n') : ''
                    }
                }
            }
        } catch { }
    }

    const [formData, setFormData] = useState({
        nombre: lista?.nombre || '',
        descripcion: lista?.descripcion || '',
        paraText: initialPara,
        ccText: initialCc,
        sucursalId: lista?.sucursalId || ''
    })

    const [porSucursalData, setPorSucursalData] = useState<Record<string, { paraText: string, ccText: string }>>(initialPorSucursalState)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const handleSucursalChange = (sucursalId: string, field: 'paraText' | 'ccText', value: string) => {
        setPorSucursalData(prev => ({
            ...prev,
            [sucursalId]: {
                paraText: field === 'paraText' ? value : (prev[sucursalId]?.paraText || ''),
                ccText: field === 'ccText' ? value : (prev[sucursalId]?.ccText || '')
            }
        }))
    }

    // Extrae correos limpiándolos de comas, saltos de línea o espacios extra
    const extractEmails = (text: string) => {
        return text
            .split(/[\n,;]+/)
            .map(e => e.trim())
            .filter(e => e !== '' && e.includes('@'))
    }

    // Conteo de sucursales que tienen correos configurados
    const configuredBranchesCount = Object.values(porSucursalData).filter(
        item => extractEmails(item.paraText).length > 0 || extractEmails(item.ccText).length > 0
    ).length

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        const arrPara = extractEmails(formData.paraText)
        const arrCc = extractEmails(formData.ccText)

        // Estructurar mapa porSucursal
        const structuredPorSucursal: Record<string, { para: string[], cc: string[] }> = {}
        let totalSucursalParaEmails = 0

        for (const [sId, item] of Object.entries(porSucursalData)) {
            const sp = extractEmails(item.paraText)
            const sc = extractEmails(item.ccText)
            if (sp.length > 0 || sc.length > 0) {
                structuredPorSucursal[sId] = { para: sp, cc: sc }
                totalSucursalParaEmails += sp.length
            }
        }

        // Validación: debe haber al menos un correo destinatario (global o zonal)
        if (arrPara.length === 0 && totalSucursalParaEmails === 0) {
            setError('Debes incluir al menos un correo destinatario válido: ya sea en "Correos Globales" o en la pestaña "Por Sucursal".')
            setLoading(false)
            return
        }

        const payload = {
            nombre: formData.nombre.trim(),
            descripcion: formData.descripcion.trim(),
            para: arrPara,
            cc: arrCc,
            sucursalId: formData.sucursalId || null,
            porSucursal: Object.keys(structuredPorSucursal).length > 0 ? structuredPorSucursal : null
        }

        let result
        if (lista) {
            result = await updateListaCorreo(lista.id, payload)
        } else {
            result = await createListaCorreo(payload)
        }

        if (result.error) {
            setError(result.error)
            setLoading(false)
        } else {
            onClose()
        }
    }

    const filteredSucursales = sucursales.filter(s => 
        s.nombre.toLowerCase().includes(sucursalSearch.toLowerCase().trim())
    )

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <form 
                onSubmit={handleSubmit} 
                className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-gray-100 max-h-[92vh]"
            >
                {/* CABECERA */}
                <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-slate-50 via-cyan-50/20 to-sky-50/20">
                    <div>
                        <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                            <span>{lista ? '✏️' : '➕'}</span>
                            <span>{lista ? 'Editar Lista de Distribución' : 'Nueva Lista de Distribución'}</span>
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Configura destinatarios globales o automáticos por sucursal / RBD
                        </p>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="text-gray-400 hover:text-gray-600 font-bold text-center w-9 h-9 rounded-full hover:bg-gray-200/70 transition-colors flex items-center justify-center text-lg"
                    >
                        ✕
                    </button>
                </div>

                {/* CONTENIDO CON SCROLL */}
                <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
                    {error && (
                        <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-sm border border-red-200 font-semibold flex items-center gap-2 animate-shake">
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* DATOS PRINCIPALES DE LA LISTA */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                                Nombre de la Lista <span className="text-red-500">*</span>
                            </label>
                            <input
                                name="nombre"
                                required
                                value={formData.nombre}
                                onChange={handleChange}
                                placeholder="Ej: Jefaturas Zonales, Operaciones, Supervisores..."
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white font-semibold text-gray-900 placeholder:text-gray-400 text-sm shadow-xs"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                                Breve Descripción
                            </label>
                            <input
                                name="descripcion"
                                value={formData.descripcion}
                                onChange={handleChange}
                                placeholder="Ej: Alertas para solicitudes de insumos y gestiones zonales..."
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-gray-800 placeholder:text-gray-400 text-sm shadow-xs"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                                Restricción de Sucursal Base (Opcional)
                            </label>
                            <select
                                name="sucursalId"
                                value={formData.sucursalId}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-gray-800 text-sm shadow-xs font-medium"
                            >
                                <option value="">🌐 Global / Multi-Sucursal (Recomendado para grupos)</option>
                                {sucursales.map(s => (
                                    <option key={s.id} value={s.id}>📍 Solo para {s.nombre} (Lista fija exclusiva)</option>
                                ))}
                            </select>
                            <p className="text-[11px] text-gray-500 mt-1">
                                Si seleccionas &quot;Global / Multi-Sucursal&quot;, puedes usar la pestaña siguiente para definir quién recibe en cada sucursal.
                            </p>
                        </div>
                    </div>

                    {/* SELECTOR DE PESTAÑAS DESTACADO */}
                    <div className="bg-slate-100/90 p-1.5 rounded-2xl flex gap-2 border border-slate-200 shadow-inner">
                        <button
                            type="button"
                            onClick={() => setActiveTab('GLOBAL')}
                            className={`flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'GLOBAL'
                                    ? 'bg-white text-slate-900 shadow-md ring-1 ring-black/5 scale-[1.01]'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                        >
                            <span>🌐 Correos Fijos / Globales</span>
                            {extractEmails(formData.paraText).length > 0 && (
                                <span className="px-2 py-0.5 text-xs bg-cyan-100 text-cyan-900 rounded-full font-bold">
                                    {extractEmails(formData.paraText).length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('SUCURSALES')}
                            className={`flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'SUCURSALES'
                                    ? 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white shadow-md shadow-cyan-600/30 scale-[1.01]'
                                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                        >
                            <span>🏢 Destinatarios por Sucursal</span>
                            {configuredBranchesCount > 0 ? (
                                <span className={`px-2 py-0.5 text-xs rounded-full font-black ${
                                    activeTab === 'SUCURSALES' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                    {configuredBranchesCount} activas
                                </span>
                            ) : (
                                <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-md font-bold ${
                                    activeTab === 'SUCURSALES' ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-800'
                                }`}>
                                    ¡Nuevo!
                                </span>
                            )}
                        </button>
                    </div>

                    {/* PESTAÑA 1: DESTINATARIOS GLOBALES */}
                    {activeTab === 'GLOBAL' && (
                        <div className="space-y-4 animate-in fade-in-50 duration-150">
                            <div className="p-3 bg-cyan-50/60 rounded-xl border border-cyan-100 text-xs text-cyan-900 leading-relaxed">
                                💡 <b>¿Quiénes van aquí?</b> Correos que siempre deben recibir la notificación, 
                                sin importar en qué sucursal o colegio ocurrió el evento (ej: gerencia, auditoría o jefatura central).
                                Si esta lista es 100% zonal (por jefe de sucursal), puedes dejarlos en blanco y configurar la pestaña <b>Destinatarios por Sucursal</b>.
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                                    Correos Principales (PARA)
                                </label>
                                <textarea
                                    name="paraText"
                                    rows={3}
                                    value={formData.paraText}
                                    onChange={handleChange}
                                    placeholder="correo1@hendaya.cl&#10;correo2@hendaya.cl"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50/50 text-gray-900 text-sm font-mono placeholder:font-sans placeholder:text-gray-400"
                                    style={{ resize: 'vertical' }}
                                />
                                <div className="text-[11px] text-gray-500 mt-1">
                                    Puedes pegar múltiples correos separados por renglones, comas o punto y coma.
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                                    Correos con Copia (CC)
                                </label>
                                <textarea
                                    name="ccText"
                                    rows={2}
                                    value={formData.ccText}
                                    onChange={handleChange}
                                    placeholder="gerencia@hendaya.cl&#10;auditoria@hendaya.cl"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50/50 text-gray-900 text-sm font-mono placeholder:font-sans placeholder:text-gray-400"
                                    style={{ resize: 'vertical' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* PESTAÑA 2: DESTINATARIOS POR SUCURSAL */}
                    {activeTab === 'SUCURSALES' && (
                        <div className="space-y-4 animate-in fade-in-50 duration-150">
                            <div className="p-3.5 bg-gradient-to-r from-sky-50 to-indigo-50/50 rounded-2xl border border-sky-100 text-xs text-sky-950 leading-relaxed flex items-start gap-3">
                                <span className="text-2xl shrink-0">🎯</span>
                                <div>
                                    <p className="font-bold mb-0.5">Enrutamiento Automático por Sucursal / RBD</p>
                                    <p className="text-gray-600">
                                        Cuando una notificación se dispare (Gas, Pan, Formularios, Retiro de Saldos, etc.), 
                                        el sistema detectará la sucursal del colegio o del formulario y enviará el correo 
                                        <b> automáticamente</b> al grupo de correos configurado para esa zona.
                                    </p>
                                </div>
                            </div>

                            {/* BUSCADOR DE SUCURSALES */}
                            <div className="flex items-center justify-between gap-3">
                                <input
                                    type="text"
                                    value={sucursalSearch}
                                    onChange={(e) => setSucursalSearch(e.target.value)}
                                    placeholder="🔍 Filtrar sucursal (ej: Copiapó, Talca, Norte...)"
                                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-medium"
                                />
                                {sucursalSearch && (
                                    <button 
                                        type="button" 
                                        onClick={() => setSucursalSearch('')} 
                                        className="text-xs font-bold text-gray-500 hover:text-gray-700 shrink-0 px-2 py-1 bg-gray-100 rounded-lg"
                                    >
                                        Limpiar
                                    </button>
                                )}
                            </div>

                            {/* LISTADO DE SUCURSALES */}
                            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                                {filteredSucursales.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-2xl text-xs">
                                        No se encontró ninguna sucursal con ese nombre.
                                    </div>
                                ) : (
                                    filteredSucursales.map(suc => {
                                        const sucData = porSucursalData[suc.id] || { paraText: '', ccText: '' }
                                        const pCount = extractEmails(sucData.paraText).length
                                        const cCount = extractEmails(sucData.ccText).length
                                        const hasEmails = pCount > 0 || cCount > 0

                                        return (
                                            <div 
                                                key={suc.id} 
                                                className={`p-3.5 rounded-2xl border transition-all ${
                                                    hasEmails 
                                                        ? 'bg-sky-50/40 border-sky-300 shadow-xs' 
                                                        : 'bg-white border-gray-200/80 hover:border-gray-300'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">📍</span>
                                                        <span className="font-bold text-sm text-gray-900">{suc.nombre}</span>
                                                    </div>
                                                    {hasEmails ? (
                                                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-200 flex items-center gap-1">
                                                            <span>✓</span>
                                                            <span>{pCount} para{cCount > 0 ? `, ${cCount} cc` : ''}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-gray-400 italic">Sin correos</span>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-0.5">
                                                            Destinatarios (PARA) de {suc.nombre}
                                                        </label>
                                                        <textarea
                                                            rows={2}
                                                            value={sucData.paraText}
                                                            onChange={(e) => handleSucursalChange(suc.id, 'paraText', e.target.value)}
                                                            placeholder={`jefe.${suc.nombre.toLowerCase().replace(/[^a-z0-9]/g, '')}@hendaya.cl`}
                                                            className="w-full px-3 py-1.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-gray-900 text-xs font-mono placeholder:font-sans placeholder:text-gray-300"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-0.5">
                                                            Con Copia (CC) de {suc.nombre}
                                                        </label>
                                                        <textarea
                                                            rows={2}
                                                            value={sucData.ccText}
                                                            onChange={(e) => handleSucursalChange(suc.id, 'ccText', e.target.value)}
                                                            placeholder="asistente@hendaya.cl"
                                                            className="w-full px-3 py-1.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-gray-900 text-xs font-mono placeholder:font-sans placeholder:text-gray-300"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* PIE DEL MODAL CON BOTONES */}
                <div className="p-4 sm:p-5 border-t border-gray-100 flex justify-between items-center bg-gray-50/70">
                    <div className="text-xs text-gray-500 font-medium hidden sm:block">
                        {configuredBranchesCount > 0 
                            ? `✅ ${configuredBranchesCount} sucursales configuradas con enrutamiento zonal`
                            : '🌐 Lista en modo destinatarios globales'}
                    </div>

                    <div className="flex items-center gap-2.5 ml-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 font-bold text-sm transition-colors shadow-xs"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-7 py-2.5 rounded-xl text-white bg-gradient-to-r from-cyan-600 via-sky-600 to-cyan-700 hover:from-cyan-700 hover:to-sky-700 font-black text-sm shadow-md shadow-cyan-500/20 transition-all disabled:opacity-70 disabled:pointer-events-none flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <span className="animate-spin text-base">⏳</span>
                                    <span>Guardando...</span>
                                </>
                            ) : (
                                <>
                                    <span>💾</span>
                                    <span>Guardar Lista</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    )
}
