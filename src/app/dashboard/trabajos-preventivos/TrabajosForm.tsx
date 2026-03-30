'use client'

import { useState, useRef, useEffect } from 'react'
import { searchColegiosTrabajos, saveTrabajoAction } from './actions'

type ColegioResult = {
    id: string
    colut: number
    colRBD: number
    nombreEstablecimiento: string
    comuna: string
}

export default function TrabajosForm({ userName }: { userName: string }) {
    const [searchTerm, setSearchTerm] = useState('')
    const [colegios, setColegios] = useState<ColegioResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [selectedColegio, setSelectedColegio] = useState<ColegioResult | null>(null)
    const [showDropdown, setShowDropdown] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)

    const [folioOT, setFolioOT] = useState('')
    const [tipoTrabajo, setTipoTrabajo] = useState('')
    const [fechaTrabajo, setFechaTrabajo] = useState('')
    const [montoMateriales, setMontoMateriales] = useState('')
    const [montoManoObra, setMontoManoObra] = useState('')
    const [observacion, setObservacion] = useState('')
    
    const [docFile, setDocFile] = useState<File | null>(null)
    const [boletasFiles, setBoletasFiles] = useState<File[]>([])
    
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length >= 2 && !selectedColegio) {
                setIsSearching(true)
                try {
                    const result = await searchColegiosTrabajos(searchTerm)
                    if (result.colegios) {
                        setColegios(result.colegios as ColegioResult[])
                        setShowDropdown(true)
                    }
                } finally {
                    setIsSearching(false)
                }
            } else {
                if (searchTerm.length < 2) setColegios([])
                setShowDropdown(false)
            }
        }, 500)
        return () => clearTimeout(delayDebounceFn)
    }, [searchTerm, selectedColegio])

    const handleSelectColegio = (colegio: ColegioResult) => {
        setSelectedColegio(colegio)
        setSearchTerm(`${colegio.colRBD} - ${colegio.nombreEstablecimiento}`)
        setShowDropdown(false)
    }

    const validateFile = (file: File) => {
        const maxSize = 100 * 1024 * 1024 // 100MB
        if (file.size > maxSize) {
            alert(`El archivo ${file.name} supera los 100MB.`)
            return false
        }
        return true
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!selectedColegio) return alert('Seleccione un colegio')
        if (!folioOT) return alert('Folio OT es obligatorio')
        if (!tipoTrabajo) return alert('Tipo de trabajo es obligatorio')
        if (!fechaTrabajo) return alert('Fecha es obligatoria')
        if (!docFile) return alert('Debe subir el documento asociado')

        setLoading(true)

        try {
            const formData = new FormData()
            formData.append('rbd', selectedColegio.colRBD.toString())
            formData.append('folioOT', folioOT)
            formData.append('tipoTrabajo', tipoTrabajo)
            formData.append('fechaTrabajo', fechaTrabajo)
            formData.append('montoMateriales', montoMateriales)
            formData.append('montoManoObra', montoManoObra)
            formData.append('observacion', observacion)
            formData.append('documentoAsociado', docFile)
            boletasFiles.forEach(f => formData.append('boletasFacturas', f))

            const result = await saveTrabajoAction(formData)

            if (result.success) {
                alert(`Registro guardado con éxito.${result.emailWarning ? '\n⚠️ Advertencia de Correo: ' + result.emailWarning : ''}`)
                window.location.reload()
            } else {
                alert(result.error)
            }
        } catch (e) {
            alert('Error al procesar el formulario')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="bg-slate-900 p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 className="text-3xl font-black tracking-tight">Registro de Trabajos</h2>
                            <p className="text-slate-400 font-medium">Preventivos y Correctivos - Sintonía 2026</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                <span className="opacity-60 text-lg">📁</span>
                                Módulo Aplicaciones
                            </div>
                            <div className="bg-cyan-500/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-cyan-500/20 text-[10px] font-black uppercase tracking-widest text-cyan-300 flex items-center gap-2">
                                <span className="text-lg">👤</span>
                                Usuario: <span className="text-white">{userName}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 md:p-12 space-y-10">
                    {/* Barra de Información Sistémica (Solo si hay colegio seleccionado) */}
                    {selectedColegio && (
                        <div className="bg-slate-900 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-500 border border-slate-800 shadow-xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-cyan-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/20">🏫</div>
                                <div>
                                    <h4 className="text-white font-black text-lg leading-tight">{selectedColegio.nombreEstablecimiento}</h4>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Establecimiento Seleccionado</p>
                                </div>
                            </div>
                            <div className="flex gap-8">
                                <div className="text-center">
                                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">RBD</p>
                                    <p className="text-white font-mono text-xl font-black">{selectedColegio.colRBD}</p>
                                </div>
                                <div className="text-center border-l border-slate-800 pl-8">
                                    <p className="text-cyan-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">UT (Asociada)</p>
                                    <p className="text-white font-mono text-xl font-black">{selectedColegio.colut}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Búsqueda de Colegio */}
                    <div className="relative" ref={searchRef}>
                        <label className="block text-sm font-black text-slate-700 mb-3 uppercase tracking-wider">
                            Buscador de Establecimiento <span className="text-cyan-500">*</span>
                        </label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-cyan-500">
                                <span className="text-xl">🏫</span>
                            </div>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value)
                                    if (selectedColegio) setSelectedColegio(null)
                                }}
                                placeholder="Escriba RBD o Nombre..."
                                className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent focus:border-cyan-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-800 placeholder:text-slate-400 shadow-sm"
                            />
                            {isSearching && (
                                <div className="absolute inset-y-0 right-0 pr-5 flex items-center">
                                    <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </div>

                        {showDropdown && colegios.length > 0 && (
                            <div className="absolute z-50 w-full mt-3 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-72 overflow-y-auto animate-in zoom-in-95 duration-200">
                                {colegios.map((col) => (
                                    <button
                                        key={col.id}
                                        type="button"
                                        onClick={() => handleSelectColegio(col)}
                                        className="w-full text-left px-6 py-4 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors flex items-center justify-between group"
                                    >
                                        <div>
                                            <div className="font-black text-slate-800 group-hover:text-cyan-600 transition-colors">{col.nombreEstablecimiento}</div>
                                            <div className="text-xs font-bold text-slate-400 mt-1 flex gap-3">
                                                <span>RBD: {col.colRBD}</span>
                                                <span>UT: {col.colut}</span>
                                                <span>COMUNA: {col.comuna}</span>
                                            </div>
                                        </div>
                                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">➡️</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* OT y Tipo */}
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest">Folio (OT) <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    required
                                    value={folioOT}
                                    onChange={e => setFolioOT(e.target.value)}
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-300 rounded-2xl outline-none font-black text-slate-800 transition-all"
                                    placeholder="Ej: 12345"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest">Tipo de Trabajo <span className="text-red-500">*</span></label>
                                <select 
                                    required
                                    value={tipoTrabajo}
                                    onChange={e => setTipoTrabajo(e.target.value)}
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-300 rounded-2xl outline-none font-black text-slate-800 transition-all cursor-pointer"
                                >
                                    <option value="">Seleccione...</option>
                                    <option value="Preventivo">🛠️ Preventivo</option>
                                    <option value="Correctivo">🆘 Correctivo</option>
                                    <option value="Mixta">🔄 Mixta</option>
                                </select>
                            </div>
                        </div>

                        {/* Fecha y Montos */}
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest">Fecha Realizado <span className="text-red-500">*</span></label>
                                <input 
                                    type="date" 
                                    required
                                    value={fechaTrabajo}
                                    onChange={e => setFechaTrabajo(e.target.value)}
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-300 rounded-2xl outline-none font-black text-slate-800 transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Monto Materiales</label>
                                    <input 
                                        type="number" 
                                        value={montoMateriales}
                                        onChange={e => setMontoMateriales(e.target.value)}
                                        className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-300 rounded-2xl outline-none font-black text-slate-800 transition-all"
                                        placeholder="$"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Monto M.O.</label>
                                    <input 
                                        type="number" 
                                        value={montoManoObra}
                                        onChange={e => setMontoManoObra(e.target.value)}
                                        className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-300 rounded-2xl outline-none font-black text-slate-800 transition-all"
                                        placeholder="$"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Archivo Principal */}
                        <div>
                            <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest">Subir Docto. Orden de trabajo <span className="text-red-500">*</span></label>
                            <div className={`relative border-2 border-dashed ${docFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'} rounded-3xl p-8 flex flex-col items-center justify-center transition-all group hover:border-cyan-400`}>
                                <input 
                                    type="file" 
                                    accept=".pdf,image/*"
                                    required
                                    onChange={e => {
                                        const file = e.target.files?.[0]
                                        if (file && validateFile(file)) setDocFile(file)
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <span className="text-3xl mb-2">{docFile ? '📄' : '📤'}</span>
                                <span className={`text-xs font-black uppercase tracking-wider text-center ${docFile ? 'text-emerald-700' : 'text-slate-400'}`}>
                                    {docFile ? docFile.name.substring(0, 20) + '...' : 'Subir Orden de Trabajo'}
                                </span>
                                <span className="text-[10px] text-slate-400 mt-1 font-bold">PDF o Imagen (100MB)</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest">Boletas / Facturas (Máx 5)</label>
                            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 flex flex-wrap gap-3">
                                <label className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center text-xl cursor-pointer hover:bg-white hover:border-cyan-500 transition-all">
                                    ➕
                                    <input 
                                        type="file" 
                                        multiple 
                                        accept=".pdf,image/*"
                                        className="hidden" 
                                        onChange={e => {
                                            const files = Array.from(e.target.files || [])
                                            const valid = files.filter(validateFile)
                                            setBoletasFiles(prev => [...prev, ...valid].slice(0, 5))
                                        }}
                                    />
                                </label>
                                {boletasFiles.map((f, i) => (
                                    <div key={i} className="relative w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center text-[10px] font-black p-2 text-center break-all overflow-hidden">
                                        {f.name.substring(0, 10)}
                                        <button 
                                            type="button"
                                            onClick={() => setBoletasFiles(prev => prev.filter((_, idx) => idx !== i))}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 border-white shadow-sm"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Observación</label>
                                <span className={`text-[10px] font-black ${observacion.length > 450 ? 'text-red-500' : 'text-slate-400'}`}>{observacion.length} / 500</span>
                            </div>
                            <textarea 
                                maxLength={500}
                                value={observacion}
                                onChange={e => setObservacion(e.target.value)}
                                rows={4}
                                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-300 rounded-3xl outline-none font-bold text-slate-800 transition-all resize-none"
                                placeholder="Escriba detalles relevantes del trabajo..."
                            />
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-100 flex justify-end">
                        <button 
                            type="submit"
                            disabled={loading || !selectedColegio}
                            className={`px-12 py-5 rounded-[2rem] font-black text-white uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center gap-4 ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-slate-300 hover:shadow-slate-400'}`}
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    PROCESANDO...
                                </>
                            ) : (
                                <>
                                    <span>💾</span>
                                    GUARDAR REGISTRO
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </form>
    )
}
