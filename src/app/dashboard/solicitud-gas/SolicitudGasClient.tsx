
'use client'

import { useState, useEffect, useRef } from 'react'
import { searchColegiosGas, saveSolicitudGas, getConsumoLimitForRBD } from './actions'
import { useRouter } from 'next/navigation'

export default function SolicitudGasClient({ userName }: { userName: string }) {
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState('')
    const [colegio, setColegio] = useState<any>(null)
    const [results, setResults] = useState<any[]>([])
    const [showDropdown, setShowDropdown] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)

    // Form states
    const [distribuidor, setDistribuidor] = useState('Abastible')
    const [distribuidorOtro, setDistribuidorOtro] = useState('')
    const [tipoGas, setTipoGas] = useState<'Bombona' | 'Cilindro'>('Bombona')
    const [litrosBombona, setLitrosBombona] = useState('')
    const [pesoCilindro, setPesoCilindro] = useState('11 Kilos')
    const [cantidadCilindros, setCantidadCilindros] = useState('')
    const [observacion, setObservacion] = useState('')
    
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState({ text: '', type: '' })
    const [consumoStatus, setConsumoStatus] = useState<{
        state: 'liberado' | 'controlado' | 'bloqueado' | 'loading' | null,
        message?: string,
        remaining?: number,
        limit?: number,
        litrosMax?: number,
        consumedLiters?: number
    }>({ state: null })

    const systemDate = new Date().toLocaleDateString()

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length >= 2 && !colegio) {
                setIsSearching(true)
                const res = await searchColegiosGas(searchTerm)
                if (res.colegios) {
                    setResults(res.colegios)
                    setShowDropdown(true)
                }
                setIsSearching(false)
            } else {
                setShowDropdown(false)
            }
        }, 300)
        return () => clearTimeout(delayDebounceFn)
    }, [searchTerm, colegio])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelectColegio = async (col: any) => {
        setColegio(col)
        setSearchTerm(`${col.colRBD} - ${col.nombreEstablecimiento}`)
        setShowDropdown(false)
        
        // Fetch consumption limits
        setConsumoStatus({ state: 'loading' })
        const res = await getConsumoLimitForRBD(col.colRBD)
        if (res.error) {
            setConsumoStatus({ state: null })
        } else {
            setConsumoStatus({
                state: res.state as any,
                message: res.message,
                remaining: res.remaining,
                limit: res.limit,
                litrosMax: res.litrosMax,
                consumedLiters: res.consumedLiters
            })
            
            if (res.state === 'bloqueado') {
                setMessage({ text: res.message || 'Sin permiso para este mes', type: 'error' })
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!colegio) {
            setMessage({ text: 'Debe seleccionar un establecimiento', type: 'error' })
            return
        }

        setLoading(true)
        setMessage({ text: '', type: '' })

        const res = await saveSolicitudGas({
            ut: colegio.colut,
            rbd: colegio.colRBD,
            distribuidor,
            distribuidorOtro,
            tipoGas,
            litrosBombona: tipoGas === 'Bombona' ? parseFloat(litrosBombona) : undefined,
            pesoCilindro: tipoGas === 'Cilindro' ? pesoCilindro : undefined,
            cantidadCilindros: tipoGas === 'Cilindro' ? parseInt(cantidadCilindros) : undefined,
            observacion
        })

        if (res.success) {
            if (res.emailWarning) {
                setMessage({ text: `✅ Solicitud guardada con éxito. ⚠️ AVISO: ${res.emailWarning}`, type: 'success' })
            } else {
                setMessage({ text: '✅ Solicitud guardada con éxito', type: 'success' })
            }
            // Reset form
            setColegio(null)
            setSearchTerm('')
            setObservacion('')
            setLitrosBombona('')
            setCantidadCilindros('')
        } else {
            setMessage({ text: `❌ ${res.error}`, type: 'error' })
        }
        setLoading(false)
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-bl-full -z-10 opacity-60" />
                
                <h2 className="text-2xl font-black text-gray-900 mb-2 flex items-center gap-3">
                    <span className="w-10 h-10 bg-sky-500 text-white rounded-xl flex items-center justify-center text-xl shadow-lg shadow-sky-200">🔥</span>
                    Solicitud de Gas
                </h2>
                <p className="text-gray-500 mb-8 border-b border-gray-100 pb-4">Complete el formulario para realizar el pedido de suministro.</p>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Colegio Search */}
                    <div className="md:col-span-2 relative" ref={searchRef}>
                        <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Establecimiento / RBD</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value)
                                    if (colegio) setColegio(null)
                                }}
                                required
                                placeholder="Escriba RBD o Nombre del Colegio..."
                                className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 bg-gray-50 transition-all font-bold text-gray-800 placeholder:text-gray-400 placeholder:font-normal"
                            />
                            {isSearching && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <span className="animate-spin h-5 w-5 border-2 border-sky-500 border-t-transparent rounded-full block"></span>
                                </div>
                            )}
                        </div>

                        {showDropdown && results.length > 0 && (
                            <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-60 overflow-y-auto overflow-x-hidden divide-y divide-gray-50">
                                {results.map((r) => (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => handleSelectColegio(r)}
                                        className="w-full text-left px-5 py-4 hover:bg-sky-50 transition-colors flex justify-between items-center group"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800 group-hover:text-sky-700">{r.colRBD} - {r.nombreEstablecimiento}</span>
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">UT: {r.colut} • {r.comuna}</span>
                                        </div>
                                        <span className="text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity">➜</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        
                        {colegio && (
                            <div className="mt-3 flex flex-col gap-2 animate-in zoom-in-95">
                                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl border border-green-100">
                                    <span className="text-sm font-bold">✓ Seleccionado:</span>
                                    <span className="text-sm font-medium">UT {colegio.colut}</span>
                                </div>
                                
                                {consumoStatus.state === 'loading' && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-400 rounded-xl border border-gray-100 italic text-xs">
                                        <span className="animate-spin h-3 w-3 border border-gray-400 border-t-transparent rounded-full"></span>
                                        Verificando límites de consumo...
                                    </div>
                                )}

                                {consumoStatus.state === 'liberado' && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 text-xs font-bold">
                                        <span>ℹ️</span> CONSUMO LIBERADO (Sin restricciones para este RBD)
                                    </div>
                                )}

                                {consumoStatus.state === 'controlado' && (
                                    <div className="flex flex-col gap-1 px-4 py-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-100">
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                            <span>🛡️</span> CONSUMO CONTROLADO
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] font-medium">
                                            <span>Solicitudes: <strong className="text-amber-900">{consumoStatus.limit! - consumoStatus.remaining!} / {consumoStatus.limit}</strong></span>
                                            <span>Lts. Solicitados: <strong className="text-amber-900">{consumoStatus.consumedLiters?.toFixed(2)} / {consumoStatus.litrosMax} Lts</strong></span>
                                        </div>
                                    </div>
                                )}

                                {consumoStatus.state === 'bloqueado' && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-xl border border-red-100 text-xs font-bold animate-pulse">
                                        <span>🚫</span> BLOQUEADO: {consumoStatus.message}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Distributor */}
                    <div>
                        <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Distribuidor</label>
                        <select
                            value={distribuidor}
                            onChange={(e) => setDistribuidor(e.target.value)}
                            className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 bg-gray-50 font-bold text-gray-800 appearance-none cursor-pointer"
                        >
                            <option value="Abastible">Abastible</option>
                            <option value="Gasco">Gasco</option>
                            <option value="Lipigas">Lipigas</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>

                    {/* Distributor Otro */}
                    {distribuidor === 'Otro' && (
                        <div className="animate-in slide-in-from-right-2">
                            <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Nombre del Distribuidor</label>
                            <input
                                type="text"
                                value={distribuidorOtro}
                                onChange={(e) => setDistribuidorOtro(e.target.value)}
                                required
                                placeholder="Especifique distribuidor..."
                                className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 bg-white font-bold text-gray-800"
                            />
                        </div>
                    )}

                    {/* Gas Type */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-black text-black mb-4 uppercase tracking-widest">Tipo de Suministro</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setTipoGas('Bombona')}
                                className={`flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border-2 transition-all font-bold ${tipoGas === 'Bombona' ? 'bg-sky-500 border-sky-500 text-white shadow-lg shadow-sky-200' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200'}`}
                            >
                                <span className="text-xl">🧴</span> Bombona
                            </button>
                            <button
                                type="button"
                                onClick={() => setTipoGas('Cilindro')}
                                className={`flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border-2 transition-all font-bold ${tipoGas === 'Cilindro' ? 'bg-sky-500 border-sky-500 text-white shadow-lg shadow-sky-200' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200'}`}
                            >
                                <span className="text-xl">🛡️</span> Cilindro
                            </button>
                        </div>
                    </div>

                    {/* Conditional Inputs */}
                    {tipoGas === 'Bombona' ? (
                        <div className="md:col-span-2 animate-in fade-in duration-300">
                            <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Cantidad de Litros</label>
                            <input
                                type="number"
                                value={litrosBombona}
                                onChange={(e) => setLitrosBombona(e.target.value)}
                                required
                                placeholder="Ej: 500"
                                className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 bg-white font-bold text-gray-800 text-center text-2xl"
                            />
                        </div>
                    ) : (
                        <>
                            <div className="animate-in slide-in-from-left-2">
                                <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Peso del Cilindro</label>
                                <select
                                    value={pesoCilindro}
                                    onChange={(e) => setPesoCilindro(e.target.value)}
                                    className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 bg-white font-bold text-gray-800"
                                >
                                    <option value="5 Kilos">5 Kilos</option>
                                    <option value="11 Kilos">11 Kilos</option>
                                    <option value="15 Kilos">15 Kilos</option>
                                    <option value="45 Kilos">45 Kilos</option>
                                </select>
                            </div>
                            <div className="animate-in slide-in-from-right-2">
                                <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Cantidad de Cilindros</label>
                                <input
                                    type="number"
                                    value={cantidadCilindros}
                                    onChange={(e) => setCantidadCilindros(e.target.value)}
                                    required
                                    placeholder="Ej: 2"
                                    className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 bg-white font-bold text-gray-800 text-center text-2xl"
                                />
                            </div>
                        </>
                    )}

                    {/* Observation */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Observación (Opcional)</label>
                        <textarea
                            value={observacion}
                            onChange={(e) => setObservacion(e.target.value.substring(0, 500))}
                            placeholder="Detalles adicionales de la solicitud..."
                            rows={3}
                            className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 bg-gray-50 transition-all font-medium text-gray-700"
                        />
                        <div className="text-right">
                            <span className={`text-[10px] font-black uppercase ${observacion.length > 450 ? 'text-red-500' : 'text-gray-400'}`}>
                                {observacion.length} / 500
                            </span>
                        </div>
                    </div>

                    {/* Metadata Display */}
                    <div className="md:col-span-2 grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                        <div className="bg-gray-50 p-4 rounded-2xl">
                            <span className="block text-[10px] font-black text-black uppercase tracking-widest mb-1">Solicitante</span>
                            <span className="text-sm font-bold text-gray-700">{userName}</span>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl">
                            <span className="block text-[10px] font-black text-black uppercase tracking-widest mb-1">Fecha Sistema</span>
                            <span className="text-sm font-bold text-gray-700">{systemDate}</span>
                        </div>
                    </div>

                    {/* Feedback Message */}
                    {message.text && (
                        <div className={`md:col-span-2 p-4 rounded-2xl text-center text-sm font-bold border animate-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                            {message.text}
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="md:col-span-2 pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white font-black py-4 rounded-2xl shadow-xl shadow-sky-200 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:pointer-events-none text-lg uppercase tracking-wider"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                                    Procesando...
                                </span>
                            ) : 'Guardar Solicitud de Gas'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
