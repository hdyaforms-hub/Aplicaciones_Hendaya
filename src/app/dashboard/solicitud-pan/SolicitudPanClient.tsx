'use client'

import { useState, useRef, useEffect } from 'react'
import { searchColegiosSolicitud, saveSolicitudPan, FormDataSolicitud } from './actions'

type ColegioResult = {
    id: string
    colut: number
    colRBD: number
    nombreEstablecimiento: string
    comuna: string
}

export default function SolicitudPanClient({ userName }: { userName: string }) {
    const [searchTerm, setSearchTerm] = useState('')
    const [colegios, setColegios] = useState<ColegioResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [selectedColegio, setSelectedColegio] = useState<ColegioResult | null>(null)
    const [showDropdown, setShowDropdown] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)

    const [formData, setFormData] = useState<Omit<FormDataSolicitud, 'rbd'>>({
        solicitud: '',
        cantidad: 0,
        fechaGestacion: '',
        servicio: '',
        motivo: ''
    })

    const [servicioOtros, setServicioOtros] = useState('')
    const [loadingSave, setLoadingSave] = useState(false)
    const [motivoError, setMotivoError] = useState('')

    // System date display formatted
    const today = new Date().toLocaleDateString('es-CL', {
        day: '2-digit', month: 'long', year: 'numeric'
    })

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
                    const result = await searchColegiosSolicitud(searchTerm)
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target

        if (name === 'motivo') {
            if (value.length > 500) {
                setMotivoError('El motivo no puede superar los 500 caracteres.')
                return;
            } else {
                setMotivoError('')
            }
        }

        if (name === 'cantidad') {
            const num = parseInt(value, 10)
            setFormData(prev => ({ ...prev, cantidad: isNaN(num) ? 0 : num }))
        } else if (name === 'servicioOtros') {
            if (value.length <= 20) {
                setServicioOtros(value)
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!selectedColegio) {
            alert('Debe buscar y seleccionar un establecimiento válido antes de guardar.')
            return
        }

        if (!formData.solicitud) {
            alert('Debe seleccionar el tipo de Solicitud (Aumento o Suspensión).')
            return
        }

        if (!formData.fechaGestacion) {
            alert('Debe seleccionar la Fecha de Gestación.')
            return
        }

        if (formData.cantidad <= 0) {
            alert('La cantidad debe ser un número mayor a cero.')
            return
        }

        let servicioFinal = formData.servicio
        if (servicioFinal === 'Otros') {
            if (!servicioOtros.trim()) {
                alert('Debe especificar el servicio requerido.')
                return
            }
            servicioFinal = servicioOtros.trim()
        } else if (!servicioFinal) {
            alert('Debe seleccionar un Servicio.')
            return
        }

        if (!formData.motivo.trim()) {
            alert('Debe ingresar un Motivo para la solicitud.')
            return
        }

        setLoadingSave(true)

        try {
            const payload: FormDataSolicitud = {
                rbd: selectedColegio.colRBD,
                solicitud: formData.solicitud,
                cantidad: formData.cantidad,
                fechaGestacion: formData.fechaGestacion,
                servicio: servicioFinal,
                motivo: formData.motivo.trim()
            }

            const result = await saveSolicitudPan(payload)

            if (result.success) {
                if (result.emailWarning) {
                    alert(`${result.message}\n\n⚠️ AVISO: ${result.emailWarning}`)
                } else {
                    alert(result.message)
                }
                
                // Reiniciar formulario pero mantener colegio
                setFormData({
                    solicitud: '',
                    cantidad: 0,
                    fechaGestacion: '',
                    servicio: '',
                    motivo: ''
                })
                setServicioOtros('')
            } else {
                alert(result.error)
            }
        } catch (error) {
            alert('Error inesperado al intentar guardar.')
        } finally {
            setLoadingSave(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="w-full mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Cabecera Datos Sistémicos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div className="md:col-span-2 relative z-20" ref={searchRef}>
                    <label className="block font-semibold text-gray-700 mb-2">
                        Buscador Establecimiento (RBD o Nombre) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-400">🔍</span>
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value)
                                if (selectedColegio) {
                                  setSelectedColegio(null)
                                }
                            }}
                            placeholder="Ingrese RBD o nombre del colegio..."
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-lg shadow-inner"
                        />
                        {isSearching && (
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <span className="animate-spin text-sky-500">↻</span>
                            </div>
                        )}
                        {/* Selected info pill over input */}
                        {selectedColegio && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">
                                ✅ Colegio Seleccionado
                            </div>
                        )}
                    </div>

                    {showDropdown && colegios.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto">
                            {colegios.map((col) => (
                                <button
                                    key={col.id}
                                    type="button"
                                    onClick={() => handleSelectColegio(col)}
                                    className="w-full text-left px-5 py-3 hover:bg-sky-50 focus:bg-sky-50 border-b border-gray-50 last:border-0 transition-colors"
                                >
                                    <div className="font-bold text-gray-800">
                                        <span className="text-sky-600 bg-sky-50 px-2 rounded-md font-mono text-sm mr-2">{col.colRBD}</span>
                                        {col.nombreEstablecimiento}
                                    </div>
                                    <div className="flex gap-4 mt-1 text-xs text-gray-500 font-medium">
                                        <span>📍 Comuna: {col.comuna}</span>
                                        <span>🔑 UT: {col.colut}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    {showDropdown && colegios.length === 0 && !isSearching && searchTerm.length >= 2 && (
                        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-100 p-4 text-center text-gray-500">
                            No se encontraron establecimientos autorizados.
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block font-medium text-gray-600 mb-2">Unidad Territorial</label>
                        <div className="w-full px-4 py-3 border border-gray-100 bg-gray-50/70 text-gray-700 font-bold rounded-xl flex items-center justify-center">
                            {selectedColegio ? selectedColegio.colut : '--'}
                        </div>
                    </div>
                    <div>
                        <label className="block font-medium text-gray-600 mb-2">Fecha del Sistema</label>
                        <div className="w-full px-4 py-3 border border-gray-100 bg-gray-50/70 text-gray-700 font-bold rounded-xl text-center">
                            {today}
                        </div>
                    </div>
                </div>
            </div>

            {/* Formulario Principal */}
            <div className="bg-slate-50 p-6 md:p-8 rounded-2xl border border-slate-200 shadow-inner grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                
                {/* Primera Columna */}
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Solicitud <span className="text-red-500">*</span></label>
                        <select 
                            name="solicitud" 
                            required 
                            value={formData.solicitud} 
                            onChange={handleChange} 
                            disabled={!selectedColegio}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white text-gray-900 font-medium appearance-none shadow-sm disabled:opacity-50 disabled:bg-gray-100"
                        >
                            <option value="" disabled>-- Seleccione Tipo --</option>
                            <option value="Aumento">📈 Aumento</option>
                            <option value="Suspensión">🛑 Suspensión</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Cantidad <span className="text-red-500">*</span></label>
                        <input 
                            name="cantidad" 
                            type="number"
                            min={1}
                            required 
                            value={formData.cantidad || ''} 
                            onChange={handleChange} 
                            disabled={!selectedColegio}
                            placeholder="Ej: 50"
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white text-gray-900 font-bold shadow-sm disabled:opacity-50 disabled:bg-gray-100"
                        />
                    </div>
                </div>

                {/* Segunda Columna */}
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha de Gestación <span className="text-red-500">*</span></label>
                        <input 
                            name="fechaGestacion" 
                            type="date"
                            required 
                            value={formData.fechaGestacion} 
                            onChange={handleChange} 
                            disabled={!selectedColegio}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white text-gray-900 font-medium shadow-sm disabled:opacity-50 disabled:bg-gray-100 uppercase"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Servicio Solicitado <span className="text-red-500">*</span></label>
                        <div className="flex gap-2">
                            <select 
                                name="servicio" 
                                required 
                                value={formData.servicio} 
                                onChange={handleChange} 
                                disabled={!selectedColegio}
                                className={`px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white text-gray-900 font-medium appearance-none shadow-sm disabled:opacity-50 disabled:bg-gray-100 transition-all ${formData.servicio === 'Otros' ? 'w-1/2' : 'w-full'}`}
                            >
                                <option value="" disabled>-- Seleccione Servicio --</option>
                                <option value="Desayuno">☕ Desayuno</option>
                                <option value="Almuerzo">🍛 Almuerzo</option>
                                <option value="Once">🥪 Once</option>
                                <option value="Colación">🍎 Colación</option>
                                <option value="Otros">✍️ Otros (Especificar)</option>
                            </select>

                            {formData.servicio === 'Otros' && (
                                <input
                                    name="servicioOtros"
                                    type="text"
                                    required
                                    maxLength={20}
                                    value={servicioOtros}
                                    onChange={handleChange}
                                    placeholder="Valor (Max 20 req)"
                                    className="w-1/2 animate-in slide-in-from-right-2 duration-200 px-4 py-3 rounded-xl border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50 text-gray-900 font-medium shadow-sm"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Filas Completas */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 shadow-sm flex items-center justify-between">
                        <span>Motivo de la Solicitud <span className="text-red-500">*</span></span>
                        <span className={`text-xs ${formData.motivo.length > 480 ? 'text-red-500 font-bold' : 'text-gray-400 font-medium'}`}>
                            {formData.motivo.length} / 500
                        </span>
                    </label>
                    <textarea 
                        name="motivo" 
                        required 
                        rows={4}
                        maxLength={500}
                        value={formData.motivo} 
                        onChange={handleChange} 
                        disabled={!selectedColegio}
                        placeholder="Redacte brevemente el motivo de su aumento o suspensión..."
                        className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 bg-white text-gray-900 font-medium disabled:opacity-50 disabled:bg-gray-100 transition-colors shadow-sm ${motivoError ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-sky-500'}`}
                        style={{ resize: 'vertical' }}
                    />
                    {motivoError && <p className="text-red-500 text-xs font-bold mt-1">{motivoError}</p>}
                </div>
            </div>

            {/* Boton Guardar */}
            <div className="flex justify-end pt-4 border-t border-gray-100">
                <button 
                    type="submit" 
                    disabled={!selectedColegio || loadingSave}
                    className="flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-sky-500/30 hover:shadow-sky-500/50 transition-all transform active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed disabled:shadow-none min-w-[200px] justify-center"
                >
                    {loadingSave ? (
                        <>
                            <span className="animate-spin text-2xl leading-none">↻</span>
                            <span>Guardando y Notificando...</span>
                        </>
                    ) : (
                        <>
                            <span className="text-2xl leading-none">💾</span>
                            <span>Registrar Solicitud</span>
                        </>
                    )}
                </button>
            </div>
        </form>
    )
}
