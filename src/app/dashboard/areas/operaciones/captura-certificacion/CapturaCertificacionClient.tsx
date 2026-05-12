'use client'

import { useState, useEffect } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { getOpcionesCaptura, getColegioName, getDetalleCertificacion, saveCapturaCertificacion, searchColegios } from './actions'

interface DetalleCertificacion {
    numeroMinuta: string
    nombrePreparacion: string
    nombreProducto: string
    grsRac: number
    grsTotal: number
}

export default function CapturaCertificacionClient() {
    const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])
    const [searchInput, setSearchInput] = useState('')
    const [selectedRbd, setSelectedRbd] = useState<number | null>(null)
    const [colegioName, setColegioName] = useState('')
    
    const debouncedSearch = useDebounce(searchInput, 400)
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [showDropdown, setShowDropdown] = useState(false)
    
    // Opciones cargadas desde la BD para el RBD seleccionado en la fecha seleccionada
    const [serviciosDisponibles, setServiciosDisponibles] = useState<string[]>([])
    const [programasDisponibles, setProgramasDisponibles] = useState<string[]>([])
    const [areasDisponibles, setAreasDisponibles] = useState<{id: string, nombre: string}[]>([])
    const [racionesBase, setRacionesBase] = useState<any[]>([])

    // Filtros seleccionados
    const [selectedServicio, setSelectedServicio] = useState('')
    const [selectedPrograma, setSelectedPrograma] = useState('')
    const [selectedArea, setSelectedArea] = useState('')
    
    // Raciones a preparar
    const [racionesPreparar, setRacionesPreparar] = useState<number | ''>('')
    
    // Estado de la tabla
    const [detalle, setDetalle] = useState<DetalleCertificacion[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [successMsg, setSuccessMsg] = useState('')

    // Buscar colegios cuando el usuario escribe
    useEffect(() => {
        if (!debouncedSearch || debouncedSearch.length < 2) {
            setSearchResults([])
            setShowDropdown(false)
            return
        }
        
        // Si el texto es igual al colegio seleccionado, no buscamos
        if (selectedRbd && searchInput.includes(selectedRbd.toString())) {
            return
        }

        const doSearch = async () => {
            const results = await searchColegios(debouncedSearch)
            setSearchResults(results)
            setShowDropdown(true)
        }
        doSearch()
    }, [debouncedSearch, selectedRbd, searchInput])

    // Cargar opciones cuando hay un RBD confirmado
    useEffect(() => {
        if (!selectedRbd) {
            setServiciosDisponibles([])
            setProgramasDisponibles([])
            setSelectedServicio('')
            setSelectedPrograma('')
            setSelectedArea('')
            setRacionesPreparar('')
            setDetalle([])
            setError('')
            setSuccessMsg('')
            return
        }

        const fetchInfo = async () => {
            const name = await getColegioName(selectedRbd)
            setColegioName(name)

            const opciones = await getOpcionesCaptura(selectedRbd, fecha)
            if (opciones.error) {
                setError(opciones.error)
                setServiciosDisponibles([])
                setProgramasDisponibles([])
            } else if (opciones.success) {
                setError('')
                setServiciosDisponibles(opciones.servicios || [])
                setProgramasDisponibles(opciones.programas || [])
                setAreasDisponibles(opciones.areas || [])
                setRacionesBase(opciones.racionesData || [])
            }
        }

        fetchInfo()
    }, [selectedRbd, fecha])

    // Actualizar Raciones a Preparar automáticamente cuando se selecciona un servicio, programa y área
    useEffect(() => {
        if (selectedServicio && selectedPrograma && selectedArea && racionesBase.length > 0) {
            const racion = racionesBase.find(r => 
                r.servicio === selectedServicio && 
                r.programa === selectedPrograma &&
                r.numeroArea.trim() === selectedArea.trim()
            )
            if (racion) {
                setRacionesPreparar(racion.cantidad)
            } else {
                setRacionesPreparar('')
            }
        } else {
            setRacionesPreparar('')
        }
    }, [selectedServicio, selectedPrograma, selectedArea, racionesBase])

    const handleCalcular = async () => {
        setError('')
        setSuccessMsg('')
        setDetalle([])

        if (!selectedRbd || !fecha || !selectedServicio || !selectedPrograma || !selectedArea || !racionesPreparar) {
            setError('Por favor complete todos los campos antes de calcular.')
            return
        }

        setLoading(true)
        const result = await getDetalleCertificacion(
            selectedRbd, 
            fecha, 
            selectedServicio, 
            selectedPrograma, 
            selectedArea,
            Number(racionesPreparar)
        )

        if (result.error) {
            setError(result.error)
        } else if (result.success && result.detalle) {
            setDetalle(result.detalle)
        }
        setLoading(false)
    }

    const handleGuardar = async () => {
        if (detalle.length === 0) {
            setError('No hay datos para guardar.')
            return
        }

        setLoading(true)
        const headerData = {
            rbd: selectedRbd,
            fecha,
            servicio: selectedServicio,
            programa: selectedPrograma,
            area: selectedArea,
            racionesPreparar: Number(racionesPreparar)
        }

        const result = await saveCapturaCertificacion(headerData, detalle)
        
        if (result.error) {
            setError(result.error)
        } else if (result.success) {
            setSuccessMsg('Información registrada correctamente en la BD.')
            // Opcional: limpiar la tabla
        }
        setLoading(false)
    }

    return (
        <div className="flex flex-col xl:flex-row gap-6">
            {/* Panel de Filtros */}
            <div className="w-full xl:w-1/3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-5 h-fit">
                <h3 className="text-lg font-black text-gray-800 tracking-tight border-b border-gray-100 pb-3">Parámetros</h3>
                
                {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100">{error}</div>}
                {successMsg && <div className="p-3 bg-green-50 text-green-600 rounded-xl text-xs font-bold border border-green-100">{successMsg}</div>}

                <div className="relative">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">RBD o Nombre del Colegio</label>
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => {
                            setSearchInput(e.target.value)
                            if (selectedRbd) setSelectedRbd(null)
                        }}
                        placeholder="Ej: 399 o Gaspar Cabrales..."
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-bold transition-all shadow-inner"
                        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                        onFocus={() => {
                            if (searchResults.length > 0) setShowDropdown(true)
                        }}
                    />
                    
                    {showDropdown && searchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto">
                            {searchResults.map((col) => (
                                <div
                                    key={col.colRBD}
                                    className="px-4 py-3 hover:bg-cyan-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors"
                                    onMouseDown={(e) => {
                                        e.preventDefault() // Prevenir onBlur
                                        setSelectedRbd(col.colRBD)
                                        setSearchInput(`${col.colRBD} - ${col.nombreEstablecimiento}`)
                                        setColegioName(col.nombreEstablecimiento)
                                        setShowDropdown(false)
                                    }}
                                >
                                    <span className="font-black text-cyan-600 text-xs mr-2">RBD: {col.colRBD}</span>
                                    <span className="font-bold text-gray-700 text-xs">{col.nombreEstablecimiento}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nombre</label>
                    <div className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-100 text-gray-600 font-bold min-h-[46px] flex items-center">
                        {colegioName || '-'}
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Fecha</label>
                    <input
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-bold transition-all shadow-inner"
                    />
                </div>

                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Servicio</label>
                    <select
                        value={selectedServicio}
                        onChange={(e) => setSelectedServicio(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-bold transition-all shadow-inner disabled:opacity-50"
                        disabled={serviciosDisponibles.length === 0}
                    >
                        <option value="">Seleccione...</option>
                        {serviciosDisponibles.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Programa</label>
                    <select
                        value={selectedPrograma}
                        onChange={(e) => setSelectedPrograma(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-bold transition-all shadow-inner disabled:opacity-50"
                        disabled={programasDisponibles.length === 0}
                    >
                        <option value="">Seleccione...</option>
                        {programasDisponibles.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Área</label>
                    <select
                        value={selectedArea}
                        onChange={(e) => setSelectedArea(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-bold transition-all shadow-inner disabled:opacity-50"
                        disabled={areasDisponibles.length === 0}
                    >
                        <option value="">Seleccione...</option>
                        {areasDisponibles.map(a => (
                            <option key={a.id} value={a.id}>{a.nombre}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1 text-green-600">Raciones a Preparar</label>
                    <input
                        type="number"
                        value={racionesPreparar}
                        onChange={(e) => setRacionesPreparar(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Cantidad"
                        className="w-full px-4 py-3 rounded-xl border-2 border-green-200 focus:ring-2 focus:ring-green-500 bg-green-50 text-green-900 font-black transition-all shadow-inner"
                    />
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={handleCalcular}
                        disabled={loading || !selectedServicio || !selectedPrograma || !selectedArea || !racionesPreparar}
                        className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-black py-3 px-4 rounded-xl shadow-lg shadow-cyan-200 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2"
                    >
                        {loading ? 'Calculando...' : '🧮 Calcular'}
                    </button>
                    {detalle.length > 0 && (
                        <button
                            onClick={handleGuardar}
                            disabled={loading}
                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-black py-3 px-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            💾 Guardar
                        </button>
                    )}
                </div>
            </div>

            {/* Panel de Resultados */}
            <div className="w-full xl:w-2/3 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="bg-slate-50 border-b border-gray-100 p-6">
                    <h3 className="text-lg font-black text-gray-800 tracking-tight flex items-center gap-2">
                        <span>📦</span> Productos y Gramajes
                    </h3>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-500 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">N° Minuta</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Preparación</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Producto</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-right">Grs Rac</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-right text-cyan-600">Grs Tot</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-gray-700">
                            {detalle.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-6xl mb-6 grayscale opacity-50">📊</span>
                                            <p className="text-slate-400 font-black text-lg tracking-tight">Sin información a mostrar</p>
                                            <p className="text-slate-300 text-xs mt-1 font-bold">Complete los parámetros y presione Calcular.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                detalle.map((d, i) => (
                                    <tr key={i} className="hover:bg-cyan-50/40 transition-colors">
                                        <td className="px-6 py-4 font-black text-gray-500 text-xs">{d.numeroMinuta}</td>
                                        <td className="px-6 py-4 font-bold text-gray-700 text-xs truncate max-w-[200px]" title={d.nombrePreparacion}>
                                            {d.nombrePreparacion}
                                        </td>
                                        <td className="px-6 py-4 font-black text-gray-900 text-xs truncate max-w-[200px]" title={d.nombreProducto}>
                                            {d.nombreProducto}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-gray-600 text-xs">
                                            {Number(d.grsRac).toLocaleString('es-CL')}
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-cyan-700 text-sm bg-cyan-50/30">
                                            {Number(d.grsTotal).toLocaleString('es-CL')}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                {detalle.length > 0 && (
                    <div className="px-6 py-4 bg-slate-50/50 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500">Total Productos: {detalle.length}</span>
                        <div className="text-xs font-black text-slate-800 flex items-center gap-2">
                            <span>Suma Total Grs:</span>
                            <span className="bg-slate-200 px-3 py-1 rounded-lg">
                                {detalle.reduce((acc, d) => acc + Number(d.grsTotal), 0).toLocaleString('es-CL')}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
