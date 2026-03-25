'use client'

import { useState, useEffect, useRef } from 'react'
import { searchColegios, checkPmpaDisponibilidad, getPmpaAssignmentsAndLastRecord, saveIngRacion } from './actions'

type ColegioResult = {
    id: string
    colut: number
    colRBD: number
    colRBDDV: string
    nombreEstablecimiento: string
    comuna: string
}

export default function IngresoRacionesClient() {
    const [geoStatus, setGeoStatus] = useState<'Obteniendo...' | 'Permitida' | 'Denegada' | 'No Soportada'>('Obteniendo...')
    const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null)

    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [selectedColegio, setSelectedColegio] = useState<ColegioResult | null>(null)

    const [fechaTraba, setFechaTrabajo] = useState('')
    const [pmpaStatus, setPmpaStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle')
    const [pmpaError, setPmpaError] = useState('')

    const [programas, setProgramas] = useState<string[]>([])
    const [estratos, setEstratos] = useState<string[]>([])

    const [selectedPrograma, setSelectedPrograma] = useState('')
    const [selectedEstrato, setSelectedEstrato] = useState('')

    // Table Data States
    const [desayunoIng, setDesayunoIng] = useState<number | ''>('')
    const [almuerzoIng, setAlmuerzoIng] = useState<number | ''>('')
    const [onceIng, setOnceIng] = useState<number | ''>('')
    const [colacionIng, setColacionIng] = useState<number | ''>('')
    const [cenaIng, setCenaIng] = useState<number | ''>('')
    const [observacion, setObservacion] = useState('')

    const [asignados, setAsignados] = useState({
        desayunoAsig: 0,
        almuerzoAsig: 0,
        onceAsig: 0,
        colacionAsig: 0,
        cenaAsig: 0
    })
    const [asignadosLoading, setAsignadosLoading] = useState(false)
    const [ultimaFecha, setUltimaFecha] = useState<string | null>(null)

    const [isSaving, setIsSaving] = useState(false)
    const [saveMessage, setSaveMessage] = useState({ type: '', text: '' })

    // Search States
    const [searchTerm, setSearchTerm] = useState('')
    const [results, setResults] = useState<ColegioResult[]>([])
    const [showDropdown, setShowDropdown] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)

    // Calculations
    const totalIng = (Number(desayunoIng) || 0) + (Number(almuerzoIng) || 0) + (Number(onceIng) || 0) + (Number(colacionIng) || 0) + (Number(cenaIng) || 0)
    const totalAsig = asignados.desayunoAsig + asignados.almuerzoAsig + asignados.onceAsig + asignados.colacionAsig + asignados.cenaAsig
    const tasaPreparacion = totalAsig > 0 ? (totalIng / totalAsig) : 0

    // 1. Obtener Geolocalización al cargar
    useEffect(() => {
        if (!navigator.geolocation) {
            setGeoStatus('No Soportada')
            return
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const crd = pos.coords
                setLocation({ lat: crd.latitude, lng: crd.longitude })
                setGeoStatus('Permitida')
            },
            (err) => {
                console.warn(`ERROR(${err.code}): ${err.message}`)
                setGeoStatus('Denegada')
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        )
    }, [])

    // Debounced Search Effect
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length >= 2 && !selectedColegio) {
                setIsSearching(true)
                const res = await searchColegios(searchTerm)
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
    }, [searchTerm, selectedColegio])

    // Click Outside Effect
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Handler al seleccionar colegio
    const handleSelectColegio = (col: ColegioResult) => {
        setSelectedColegio(col)
        setSearchTerm(`${col.colRBD} - ${col.nombreEstablecimiento}`)
        setShowDropdown(false)
        resetPmpaState()
    }

    const resetPmpaState = () => {
        setFechaTrabajo('')
        setPmpaStatus('idle')
        setPmpaError('')
        setProgramas([])
        setEstratos([])
        setSelectedPrograma('')
        setSelectedEstrato('')
        setSaveMessage({ type: '', text: '' })
    }

    // Handler al cambiar fecha
    const handleFechaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const dateStr = e.target.value
        setFechaTrabajo(dateStr)
        setSaveMessage({ type: '', text: '' })

        if (!dateStr || !selectedColegio) return

        const date = new Date(dateStr)
        const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000)

        const year = utcDate.getFullYear()
        const month = utcDate.getMonth() + 1

        setPmpaStatus('loading')
        setPmpaError('')
        setProgramas([])
        setEstratos([])
        setSelectedPrograma('')
        setSelectedEstrato('')

        const result = await checkPmpaDisponibilidad(selectedColegio.colRBD, year, month)

        if (result.error) {
            setPmpaStatus('error')
            setPmpaError(result.error)
        } else if (result.programas && result.estratos) {
            setPmpaStatus('success')
            setProgramas(result.programas)
            setEstratos(result.estratos)
        }
    }

    // Effect to fetch Asignados once Dropdowns are selected
    useEffect(() => {
        const fetchAsignados = async () => {
            if (selectedPrograma && selectedEstrato && selectedColegio && fechaTraba) {
                setAsignadosLoading(true)
                const date = new Date(fechaTraba)
                const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000)
                const year = utcDate.getFullYear()
                const month = utcDate.getMonth() + 1

                const res = await getPmpaAssignmentsAndLastRecord(selectedColegio.colRBD, year, month, selectedPrograma, selectedEstrato)
                if (res.error) {
                    setPmpaError(res.error)
                    setPmpaStatus('error')
                } else if (res.asignados) {
                    setAsignados(res.asignados)
                    setUltimaFecha(res.ultimaFecha)
                }
                setAsignadosLoading(false)
            } else {
                setAsignados({ desayunoAsig: 0, almuerzoAsig: 0, onceAsig: 0, colacionAsig: 0, cenaAsig: 0 })
                setUltimaFecha(null)
            }
        }
        fetchAsignados()
    }, [selectedPrograma, selectedEstrato, selectedColegio, fechaTraba])

    const handleSave = async () => {
        if (!selectedColegio || !fechaTraba || !selectedPrograma || !selectedEstrato) return

        setIsSaving(true)
        setSaveMessage({ type: '', text: '' })

        const date = new Date(fechaTraba)
        const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000)

        const payload = {
            ubicacion: location ? `${location.lat},${location.lng}` : 'Sin ubicación',
            fechaIngreso: fechaTraba,
            rbd: selectedColegio.colRBD,
            nombreEstablecimiento: selectedColegio.nombreEstablecimiento,
            ano: utcDate.getFullYear(),
            mes: utcDate.getMonth() + 1,
            programa: selectedPrograma,
            estrato: selectedEstrato,
            desayunoIng: Number(desayunoIng) || 0,
            almuerzoIng: Number(almuerzoIng) || 0,
            onceIng: Number(onceIng) || 0,
            colacionIng: Number(colacionIng) || 0,
            cenaIng: Number(cenaIng) || 0,
            totalIng,
            desayunoAsig: asignados.desayunoAsig,
            almuerzoAsig: asignados.almuerzoAsig,
            onceAsig: asignados.onceAsig,
            colacionAsig: asignados.colacionAsig,
            cenaAsig: asignados.cenaAsig,
            totalAsig,
            tasaPreparacion: Number(tasaPreparacion.toFixed(4)),
            observacion: observacion || ''
        }

        const res = await saveIngRacion(payload)

        if (res.error) {
            setSaveMessage({ type: 'error', text: res.error })
        } else {
            setSaveMessage({ type: 'success', text: 'Registro guardado exitosamente.' })
            setDesayunoIng('')
            setAlmuerzoIng('')
            setOnceIng('')
            setColacionIng('')
            setCenaIng('')
            setObservacion('')
            setUltimaFecha(new Date().toISOString())
        }

        setIsSaving(false)
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-6 w-full max-w-4xl mx-auto">
            {/* Header / StatusBar */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold tracking-tight text-gray-800 flex items-center gap-2">
                    🍽️ Auditoría de Raciones
                </h2>
                <div className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 
                    ${geoStatus === 'Permitida' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                >
                    📍 Geolocalización: {geoStatus}
                    {location && <span className="text-[10px] bg-green-100 px-2 py-0.5 rounded-full">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>}
                </div>
            </div>

            {/* Selector de Colegio (Inline Search) */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 relative" ref={searchRef}>
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-9xl">🏫</div>

                <h3 className="text-xs font-black text-black mb-4 uppercase tracking-widest relative z-10">1. Establecimiento a Auditar</h3>

                <div className="relative z-20">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value)
                            if (selectedColegio) setSelectedColegio(null)
                        }}
                        placeholder="Escriba RBD o Nombre del Colegio..."
                        className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 bg-white transition-all font-bold text-gray-800 placeholder:text-gray-400 placeholder:font-normal"
                    />
                    {isSearching && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <span className="animate-spin h-5 w-5 border-2 border-cyan-500 border-t-transparent rounded-full block"></span>
                        </div>
                    )}

                    {showDropdown && results.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-60 overflow-y-auto overflow-x-hidden divide-y divide-gray-50">
                            {results.map((r) => (
                                <button
                                    key={r.id}
                                    type="button"
                                    onClick={() => handleSelectColegio(r)}
                                    className="w-full text-left px-5 py-4 hover:bg-cyan-50 transition-colors flex justify-between items-center group"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-800 group-hover:text-cyan-700">{r.colRBD} - {r.nombreEstablecimiento}</span>
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{r.comuna}</span>
                                    </div>
                                    <span className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">➜</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {selectedColegio && (
                    <div className="mt-4 animate-in zoom-in-95 relative z-10">
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-black text-cyan-700">{selectedColegio.colRBD}-{selectedColegio.colRBDDV}</span>
                                    <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-md text-[10px] font-black uppercase tracking-wider border border-green-100 italic">Seleccionado</span>
                                </div>
                                <div className="font-bold text-gray-800 mt-1 text-lg leading-tight">{selectedColegio.nombreEstablecimiento}</div>
                                <div className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest flex items-center gap-1">
                                    <span>📍</span> {selectedColegio.comuna} • UT {selectedColegio.colut}
                                </div>
                            </div>
                            
                            <button
                                onClick={() => {
                                    setSelectedColegio(null)
                                    setSearchTerm('')
                                    resetPmpaState()
                                }}
                                className="text-xs font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest flex items-center gap-1 transition-colors"
                            >
                                ✕ Limpiar selección
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Fecha y Filtros PMPA */}
            {selectedColegio && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 relative animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-sm font-black text-black mb-5 uppercase tracking-widest relative z-10">2. Datos de la Auditoría</h3>

                    {ultimaFecha && (
                        <div className="mb-6 p-4 bg-cyan-50 border border-cyan-200 text-cyan-800 rounded-xl text-sm font-medium flex gap-3 animate-in fade-in">
                            <span className="text-xl">📅</span>
                            <div>
                                <span className="block font-bold">Registro Previo Detectado:</span>
                                Última fecha registrada para esta configuración es: {new Date(ultimaFecha).toLocaleDateString()} a las {new Date(ultimaFecha).toLocaleTimeString()}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-black text-black mb-2 uppercase tracking-wide">Fecha a Trabajar</label>
                            <input
                                type="date"
                                value={fechaTraba}
                                onChange={handleFechaChange}
                                className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-900 font-medium font-sans shadow-sm"
                            />
                        </div>

                        <div className="md:col-span-2 space-y-4">
                            {pmpaStatus === 'loading' && (
                                <div className="h-full flex items-center gap-3 text-cyan-700 font-medium">
                                    <span className="animate-spin text-xl">⏳</span> Verificando disponibilidad PMPA...
                                </div>
                            )}

                            {pmpaStatus === 'error' && (
                                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium flex gap-3 h-full animate-in fade-in">
                                    <span className="text-xl">⚠️</span>
                                    <p className="leading-snug">{pmpaError}</p>
                                </div>
                            )}

                            {pmpaStatus === 'success' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in">
                                    <div>
                                        <label className="block text-sm font-black text-black mb-2 uppercase tracking-wide">Programa</label>
                                        <select
                                            value={selectedPrograma}
                                            onChange={(e) => setSelectedPrograma(e.target.value)}
                                            className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-900 font-medium shadow-sm appearance-none"
                                            style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                                        >
                                            <option value="">-- Seleccionar --</option>
                                            {programas.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-900 mb-2">Estrato</label>
                                        <select
                                            value={selectedEstrato}
                                            onChange={(e) => setSelectedEstrato(e.target.value)}
                                            className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-900 font-medium shadow-sm appearance-none"
                                            style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                                        >
                                            <option value="">-- Seleccionar --</option>
                                            {estratos.map(e => <option key={e} value={e}>{e}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Placeholders before date is selected */}
                            {pmpaStatus === 'idle' && fechaTraba === '' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-50 pointer-events-none">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-900 mb-2">Programa</label>
                                        <select className="w-full px-4 py-3 bg-gray-100 rounded-xl border border-gray-200 text-gray-500 font-medium appearance-none">
                                            <option>Seleccione Fecha...</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-black mb-2 uppercase tracking-wide">Estrato</label>
                                        <select className="w-full px-4 py-3 bg-gray-100 rounded-xl border border-gray-200 text-gray-500 font-medium appearance-none">
                                            <option>Seleccione Fecha...</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Formulario Ingreso Raciones (Solo visible si todo fue seleccionado) */}
            {selectedPrograma && selectedEstrato && pmpaStatus === 'success' && !asignadosLoading && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-slate-800 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="text-white font-bold tracking-wider">3. Ingreso de Raciones</h3>
                        <span className="text-cyan-400 text-sm font-medium">Llene los valores consumidos</span>
                    </div>

                    <div className="p-6 overflow-x-auto">
                        <table className="w-full text-left text-sm mb-6 relative">
                            <thead className="text-gray-900 border-b border-gray-200 bg-gray-50/50">
                                <tr>
                                    <th className="px-4 py-3 font-semibold w-1/3">Servicio</th>
                                    <th className="px-4 py-3 font-semibold text-center w-1/3">Ingresado (Consumo Real)</th>
                                    <th className="px-4 py-3 font-semibold text-center border-l border-gray-200 w-1/3 text-gray-400">Asignado (PMPA)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                                <tr>
                                    <td className="px-4 py-4 flex items-center gap-2"><span>☕</span> Desayuno</td>
                                    <td className="px-4 py-2">
                                        <input type="number" value={desayunoIng} onChange={e => setDesayunoIng(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full text-center px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none" min="0" />
                                    </td>
                                    <td className="px-4 py-2 border-l border-gray-200 text-center text-gray-500 bg-gray-50/50">{asignados.desayunoAsig}</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-4 flex items-center gap-2"><span>🍲</span> Almuerzo</td>
                                    <td className="px-4 py-2">
                                        <input type="number" value={almuerzoIng} onChange={e => setAlmuerzoIng(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full text-center px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none" min="0" />
                                    </td>
                                    <td className="px-4 py-2 border-l border-gray-200 text-center text-gray-500 bg-gray-50/50">{asignados.almuerzoAsig}</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-4 flex items-center gap-2"><span>🥪</span> Once</td>
                                    <td className="px-4 py-2">
                                        <input type="number" value={onceIng} onChange={e => setOnceIng(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full text-center px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none" min="0" />
                                    </td>
                                    <td className="px-4 py-2 border-l border-gray-200 text-center text-gray-500 bg-gray-50/50">{asignados.onceAsig}</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-4 flex items-center gap-2"><span>🍎</span> Colación</td>
                                    <td className="px-4 py-2">
                                        <input type="number" value={colacionIng} onChange={e => setColacionIng(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full text-center px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none" min="0" />
                                    </td>
                                    <td className="px-4 py-2 border-l border-gray-200 text-center text-gray-500 bg-gray-50/50">{asignados.colacionAsig}</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-4 flex items-center gap-2"><span>🌙</span> Cena</td>
                                    <td className="px-4 py-2">
                                        <input type="number" value={cenaIng} onChange={e => setCenaIng(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full text-center px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none" min="0" />
                                    </td>
                                    <td className="px-4 py-2 border-l border-gray-200 text-center text-gray-500 bg-gray-50/50">{asignados.cenaAsig}</td>
                                </tr>

                                {/* Resultados y Resumenes */}
                                <tr className="bg-slate-50 border-t-2 border-gray-200">
                                    <td className="px-4 py-4 font-black text-gray-900 border-r border-gray-200">TOTALES</td>
                                    <td className="px-4 py-4 text-center font-black text-cyan-700 text-lg border-r border-gray-200">
                                        {totalIng}
                                    </td>
                                    <td className="px-4 py-4 text-center font-bold text-gray-600 border-r border-gray-200">
                                        {totalAsig}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                            <div className="bg-cyan-50 border border-cyan-200 p-5 rounded-xl flex items-center justify-between shadow-sm">
                                <div>
                                    <span className="block text-cyan-800 font-bold uppercase text-xs tracking-wider mb-1">Tasa de Preparación RBD</span>
                                    <span className="text-cyan-900 text-3xl font-black">{(tasaPreparacion * 100).toFixed(2)}%</span>
                                </div>
                                <div className="text-4xl text-cyan-400 opacity-50">📈</div>
                            </div>

                            <div className="flex flex-col">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Observación (Opcional)</label>
                                <textarea
                                    className="w-full flex-1 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-900 text-sm resize-none"
                                    placeholder="Ingrese hasta 500 caracteres detallando notas adicionales sobre la auditoría..."
                                    value={observacion}
                                    onChange={e => setObservacion(e.target.value)}
                                    maxLength={500}
                                />
                                <div className="text-right text-[10px] text-gray-400 mt-1">{observacion.length}/500</div>
                            </div>
                        </div>

                        {saveMessage.text && (
                            <div className={`mb-6 p-4 rounded-xl text-sm font-medium flex gap-3 ${saveMessage.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                                <span>{saveMessage.type === 'error' ? '⚠️' : '✅'}</span>
                                <p>{saveMessage.text}</p>
                            </div>
                        )}

                        <div className="flex justify-end pt-4 border-t border-gray-100">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-8 py-3.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white rounded-xl shadow-md font-bold uppercase tracking-wider text-sm transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSaving ? 'Guardando...' : '💾 Confirmar y Guardar Reporte'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
