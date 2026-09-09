'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'

export type FilterMetadata = {
    licitaciones: { licId: number; licitacionHomologada: string | null }[]
    sucursales: { id: string; nombre: string }[]
    colegiosList: {
        colRBD: number
        nombreEstablecimiento: string
        sucursal: string
        colut: number
        comuna: string
        institucion: string
    }[]
    uts: { codUT: number; licId: number; sucursalId: string | null }[]
    supervisores: {
        id: string
        nombre: string
        apellido: string
        rbdsAuditar: { rbd: number }[]
        jefeOperacion?: {
            jefeZonal?: {
                sucursales: { sucursal: { nombre: string } | null }[]
                licitaciones: { licitacionId: number }[]
            } | null
        } | null
        jefeZonal?: {
            sucursales: { sucursal: { nombre: string } | null }[]
            licitaciones: { licitacionId: number }[]
        } | null
    }[]
}

export type WidgetsFiltersState = {
    licitacion: string
    ano: string
    mes: string
    sucursal: string
    rbd: number | null
    supervisor: string
}

const MONTH_NAMES = [
    { value: '1', name: 'Enero' },
    { value: '2', name: 'Febrero' },
    { value: '3', name: 'Marzo' },
    { value: '4', name: 'Abril' },
    { value: '5', name: 'Mayo' },
    { value: '6', name: 'Junio' },
    { value: '7', name: 'Julio' },
    { value: '8', name: 'Agosto' },
    { value: '9', name: 'Septiembre' },
    { value: '10', name: 'Octubre' },
    { value: '11', name: 'Noviembre' },
    { value: '12', name: 'Diciembre' }
]

const YEARS = ['2026', '2025', '2024']

interface Props {
    filters: WidgetsFiltersState
    onFiltersChange: (newFilters: WidgetsFiltersState) => void
    metadata: FilterMetadata
    isLoading?: boolean
}

export default function WidgetsFilterBar({
    filters,
    onFiltersChange,
    metadata,
    isLoading = false
}: Props) {
    const { licitaciones, sucursales, colegiosList, uts, supervisores } = metadata

    // Estado local para autocompletado de RBD
    const [rbdSearchInput, setRbdSearchInput] = useState('')
    const [isRbdDropdownOpen, setIsRbdDropdownOpen] = useState(false)
    const rbdContainerRef = useRef<HTMLDivElement>(null)

    // Sincronizar input cuando cambie el RBD seleccionado desde afuera
    useEffect(() => {
        if (filters.rbd) {
            const found = colegiosList.find(c => c.colRBD === filters.rbd)
            if (found) {
                setRbdSearchInput(`${found.colRBD} - ${found.nombreEstablecimiento}`)
            } else {
                setRbdSearchInput(`RBD ${filters.rbd}`)
            }
        } else {
            setRbdSearchInput('')
        }
    }, [filters.rbd, colegiosList])

    // Cierre de dropdown de autocompletado al hacer clic fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (rbdContainerRef.current && !rbdContainerRef.current.contains(event.target as Node)) {
                setIsRbdDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Mapa rápido de UT -> licId
    const utToLicMap = useMemo(() => {
        const map = new Map<number, number>()
        uts.forEach(u => map.set(u.codUT, u.licId))
        return map
    }, [uts])

    // Mapa rápido de sucursalId -> sucursalNombre
    const sucursalIdToNameMap = useMemo(() => {
        const map = new Map<string, string>()
        sucursales.forEach(s => map.set(s.id, s.nombre))
        return map
    }, [sucursales])

    // -------------------------------------------------------------
    // CASCADA BIDIRECCIONAL: FILTRADO DE OPCIONES DISPONIBLES
    // -------------------------------------------------------------

    // 1. Colegios filtrados según los demás filtros activos
    const candidateColegios = useMemo(() => {
        return colegiosList.filter(col => {
            // Filtro por Licitación
            if (filters.licitacion) {
                const licId = utToLicMap.get(col.colut)
                if (licId === undefined || licId.toString() !== filters.licitacion) {
                    return false
                }
            }

            // Filtro por Sucursal
            if (filters.sucursal) {
                if (col.sucursal !== filters.sucursal) {
                    return false
                }
            }

            // Filtro por Supervisor
            if (filters.supervisor) {
                const sup = supervisores.find(s => 
                    s.id === filters.supervisor || 
                    `${s.nombre} ${s.apellido}` === filters.supervisor
                )
                if (sup) {
                    const auditsThis = sup.rbdsAuditar.some(r => r.rbd === col.colRBD)
                    if (!auditsThis) return false
                }
            }

            return true
        })
    }, [colegiosList, filters.licitacion, filters.sucursal, filters.supervisor, utToLicMap, supervisores])

    // 2. Licitaciones disponibles según Sucursal, RBD o Supervisor
    const availableLicitaciones = useMemo(() => {
        if (!filters.sucursal && !filters.supervisor && !filters.rbd) {
            return licitaciones
        }

        const validLicIds = new Set<number>()

        candidateColegios.forEach(c => {
            const licId = utToLicMap.get(c.colut)
            if (licId !== undefined) validLicIds.add(licId)
        })

        // Si no hay colegios en el filtro pero hay UTs
        if (filters.sucursal) {
            const sucObj = sucursales.find(s => s.nombre === filters.sucursal)
            if (sucObj) {
                uts.forEach(u => {
                    if (u.sucursalId === sucObj.id) validLicIds.add(u.licId)
                })
            }
        }

        return licitaciones.filter(l => validLicIds.has(l.licId))
    }, [licitaciones, candidateColegios, filters.sucursal, filters.supervisor, filters.rbd, sucursales, uts, utToLicMap])

    // 3. Sucursales disponibles según Licitación, RBD o Supervisor
    const availableSucursales = useMemo(() => {
        if (!filters.licitacion && !filters.supervisor && !filters.rbd) {
            return sucursales
        }

        const validSucNames = new Set<string>()

        candidateColegios.forEach(c => {
            if (c.sucursal) validSucNames.add(c.sucursal)
        })

        // Complementar con UTs si hay licitación
        if (filters.licitacion) {
            const licNum = parseInt(filters.licitacion, 10)
            uts.forEach(u => {
                if (u.licId === licNum && u.sucursalId) {
                    const name = sucursalIdToNameMap.get(u.sucursalId)
                    if (name) validSucNames.add(name)
                }
            })
        }

        return sucursales.filter(s => validSucNames.has(s.nombre))
    }, [sucursales, candidateColegios, filters.licitacion, filters.supervisor, filters.rbd, uts, sucursalIdToNameMap])

    // 4. Supervisores disponibles según Licitación, Sucursal o RBD
    const availableSupervisores = useMemo(() => {
        if (!filters.licitacion && !filters.sucursal && !filters.rbd) {
            return supervisores
        }

        const validRbdSet = new Set<number>(candidateColegios.map(c => c.colRBD))

        return supervisores.filter(sup => {
            // Si hay un RBD seleccionado específicamente
            if (filters.rbd) {
                return sup.rbdsAuditar.some(r => r.rbd === filters.rbd)
            }

            // Comprobar si audita alguno de los colegios candidatos
            const auditsCandidate = sup.rbdsAuditar.some(r => validRbdSet.has(r.rbd))
            if (auditsCandidate) return true

            // Comprobar asociación zonal por sucursal
            if (filters.sucursal) {
                const zonalSucs = [
                    ...(sup.jefeOperacion?.jefeZonal?.sucursales || []),
                    ...(sup.jefeZonal?.sucursales || [])
                ].map(s => s.sucursal?.nombre)

                if (zonalSucs.includes(filters.sucursal)) return true
            }

            return false
        })
    }, [supervisores, candidateColegios, filters.licitacion, filters.sucursal, filters.rbd])

    // 5. Sugerencias del autocompletado inteligente de RBD
    const rbdSuggestions = useMemo(() => {
        if (!rbdSearchInput.trim()) {
            return candidateColegios.slice(0, 10)
        }

        const query = rbdSearchInput.toLowerCase().trim()
        return candidateColegios.filter(c => 
            c.colRBD.toString().includes(query) ||
            c.nombreEstablecimiento.toLowerCase().includes(query) ||
            (c.comuna && c.comuna.toLowerCase().includes(query))
        ).slice(0, 15)
    }, [candidateColegios, rbdSearchInput])

    // -------------------------------------------------------------
    // MANEJADORES DE CAMBIO CON REGLAS DE CONVERSACIÓN
    // -------------------------------------------------------------

    const handleLicitacionChange = (newLic: string) => {
        const nextFilters: WidgetsFiltersState = {
            ...filters,
            licitacion: newLic
        }

        // Si la sucursal actual deja de ser válida para esta licitación, resetearla
        if (filters.sucursal && newLic) {
            const licNum = parseInt(newLic, 10)
            const utsForLic = uts.filter(u => u.licId === licNum)
            const sucIdsForLic = new Set(utsForLic.map(u => u.sucursalId).filter(Boolean))
            const sucNamesForLic = new Set(Array.from(sucIdsForLic).map(id => sucursalIdToNameMap.get(id as string)).filter(Boolean))
            
            // También revisar colegios
            colegiosList.forEach(c => {
                if (utToLicMap.get(c.colut) === licNum && c.sucursal) {
                    sucNamesForLic.add(c.sucursal)
                }
            })

            if (!sucNamesForLic.has(filters.sucursal)) {
                nextFilters.sucursal = ''
            }
        }

        // Si el RBD actual no corresponde a la nueva licitación, resetearlo
        if (filters.rbd && newLic) {
            const col = colegiosList.find(c => c.colRBD === filters.rbd)
            if (col && utToLicMap.get(col.colut)?.toString() !== newLic) {
                nextFilters.rbd = null
            }
        }

        // Si el supervisor actual no tiene presencia en la nueva licitación, resetearlo
        if (filters.supervisor && newLic) {
            const sup = supervisores.find(s => s.id === filters.supervisor || `${s.nombre} ${s.apellido}` === filters.supervisor)
            if (sup) {
                const licNum = parseInt(newLic, 10)
                const hasRbdInLic = sup.rbdsAuditar.some(r => {
                    const c = colegiosList.find(col => col.colRBD === r.rbd)
                    return c && utToLicMap.get(c.colut) === licNum
                })
                if (!hasRbdInLic) {
                    nextFilters.supervisor = ''
                }
            }
        }

        onFiltersChange(nextFilters)
    }

    const handleSucursalChange = (newSuc: string) => {
        const nextFilters: WidgetsFiltersState = {
            ...filters,
            sucursal: newSuc
        }

        // Si el RBD actual no es de esta sucursal, resetearlo
        if (filters.rbd && newSuc) {
            const col = colegiosList.find(c => c.colRBD === filters.rbd)
            if (col && col.sucursal !== newSuc) {
                nextFilters.rbd = null
            }
        }

        // Si el supervisor actual no audita en esta sucursal, resetearlo
        if (filters.supervisor && newSuc) {
            const sup = supervisores.find(s => s.id === filters.supervisor || `${s.nombre} ${s.apellido}` === filters.supervisor)
            if (sup) {
                const hasRbdInSuc = sup.rbdsAuditar.some(r => {
                    const c = colegiosList.find(col => col.colRBD === r.rbd)
                    return c && c.sucursal === newSuc
                })
                if (!hasRbdInSuc) {
                    nextFilters.supervisor = ''
                }
            }
        }

        onFiltersChange(nextFilters)
    }

    const handleSupervisorChange = (newSup: string) => {
        const nextFilters: WidgetsFiltersState = {
            ...filters,
            supervisor: newSup
        }

        // Si hay un RBD seleccionado que no es auditado por el nuevo supervisor, resetearlo
        if (filters.rbd && newSup) {
            const sup = supervisores.find(s => s.id === newSup || `${s.nombre} ${s.apellido}` === newSup)
            if (sup && !sup.rbdsAuditar.some(r => r.rbd === filters.rbd)) {
                nextFilters.rbd = null
            }
        }

        onFiltersChange(nextFilters)
    }

    const handleRbdSelect = (rbdNum: number) => {
        const colegio = colegiosList.find(c => c.colRBD === rbdNum)
        const nextFilters: WidgetsFiltersState = {
            ...filters,
            rbd: rbdNum
        }

        if (colegio) {
            // Auto-asociar sucursal si no estaba seleccionada
            if (!filters.sucursal && colegio.sucursal) {
                nextFilters.sucursal = colegio.sucursal
            }

            // Auto-asociar licitación si no estaba seleccionada
            const licId = utToLicMap.get(colegio.colut)
            if (!filters.licitacion && licId !== undefined) {
                nextFilters.licitacion = licId.toString()
            }
        }

        setRbdSearchInput(colegio ? `${colegio.colRBD} - ${colegio.nombreEstablecimiento}` : `RBD ${rbdNum}`)
        setIsRbdDropdownOpen(false)
        onFiltersChange(nextFilters)
    }

    const handleClearRbd = () => {
        setRbdSearchInput('')
        setIsRbdDropdownOpen(false)
        onFiltersChange({
            ...filters,
            rbd: null
        })
    }

    const handleClearAllFilters = () => {
        setRbdSearchInput('')
        setIsRbdDropdownOpen(false)
        onFiltersChange({
            licitacion: '',
            ano: '2026',
            mes: '',
            sucursal: '',
            rbd: null,
            supervisor: ''
        })
    }

    const activeFiltersCount = [
        filters.licitacion,
        filters.ano && filters.ano !== '2026',
        filters.mes,
        filters.sucursal,
        filters.rbd !== null,
        filters.supervisor
    ].filter(Boolean).length

    return (
        <div className="bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl shadow-xl border border-slate-800/90 space-y-4 animate-in fade-in duration-200 text-slate-100">
            {/* Cabecera del Panel de Filtros */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white flex items-center justify-center text-sm font-bold shadow-xs">
                        🎯
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-white tracking-tight">
                                Criterios de Selección Estándar
                            </h3>
                            {activeFiltersCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro activo' : 'filtros activos'}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                            Filtros en cascada bidireccional que conversan entre sí en tiempo real
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                    {isLoading && (
                        <span className="flex items-center gap-1.5 text-xs text-cyan-300 font-bold bg-cyan-500/10 px-2.5 py-1 rounded-xl border border-cyan-500/30 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                            Actualizando datos...
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={handleClearAllFilters}
                        disabled={activeFiltersCount === 0 && filters.ano === '2026'}
                        className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl border border-transparent hover:border-slate-700 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                        <span>🔄</span> Limpiar Filtros
                    </button>
                </div>
            </div>

            {/* Grilla de Controles de Selección */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. Licitación */}
                <div>
                    <label className="block text-[11px] font-black text-slate-200 uppercase tracking-wider mb-1.5 ml-0.5">
                        Licitación
                    </label>
                    <div className="relative">
                        <select
                            value={filters.licitacion}
                            onChange={(e) => handleLicitacionChange(e.target.value)}
                            className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 shadow-xs transition-all font-bold text-slate-900 text-xs truncate cursor-pointer"
                        >
                            <option value="" className="bg-white text-slate-700 font-semibold">Todas las licitaciones</option>
                            {availableLicitaciones.map((l) => (
                                <option key={l.licId} value={l.licId.toString()} className="bg-white text-slate-900 font-bold">
                                    Lic. {l.licitacionHomologada || l.licId}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center text-slate-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* 2. Año */}
                <div>
                    <label className="block text-[11px] font-black text-slate-200 uppercase tracking-wider mb-1.5 ml-0.5">
                        Año
                    </label>
                    <div className="relative">
                        <select
                            value={filters.ano}
                            onChange={(e) => onFiltersChange({ ...filters, ano: e.target.value })}
                            className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 shadow-xs transition-all font-bold text-slate-900 text-xs truncate cursor-pointer"
                        >
                            <option value="" className="bg-white text-slate-700 font-semibold">Todos los años</option>
                            {YEARS.map((y) => (
                                <option key={y} value={y} className="bg-white text-slate-900 font-bold">{y}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center text-slate-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* 3. Mes */}
                <div>
                    <label className="block text-[11px] font-black text-slate-200 uppercase tracking-wider mb-1.5 ml-0.5">
                        Mes
                    </label>
                    <div className="relative">
                        <select
                            value={filters.mes}
                            onChange={(e) => onFiltersChange({ ...filters, mes: e.target.value })}
                            className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 shadow-xs transition-all font-bold text-slate-900 text-xs truncate cursor-pointer"
                        >
                            <option value="" className="bg-white text-slate-700 font-semibold">Todos los meses</option>
                            {MONTH_NAMES.map((m) => (
                                <option key={m.value} value={m.value} className="bg-white text-slate-900 font-bold">{m.name}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center text-slate-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* 4. Sucursal */}
                <div>
                    <label className="block text-[11px] font-black text-slate-200 uppercase tracking-wider mb-1.5 ml-0.5">
                        Sucursal
                    </label>
                    <div className="relative">
                        <select
                            value={filters.sucursal}
                            onChange={(e) => handleSucursalChange(e.target.value)}
                            className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 shadow-xs transition-all font-bold text-slate-900 text-xs truncate cursor-pointer"
                        >
                            <option value="" className="bg-white text-slate-700 font-semibold">Todas las sucursales</option>
                            {availableSucursales.map((s) => (
                                <option key={s.id} value={s.nombre} className="bg-white text-slate-900 font-bold">{s.nombre}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center text-slate-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* 5. RBD Inteligente (Autocompletativo con búsqueda por número o nombre) */}
                <div className="relative" ref={rbdContainerRef}>
                    <label className="block text-[11px] font-black text-slate-200 uppercase tracking-wider mb-1.5 ml-0.5">
                        RBD / Establecimiento
                    </label>
                    <div className="relative">
                        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar RBD o colegio..."
                            value={rbdSearchInput}
                            onChange={(e) => {
                                setRbdSearchInput(e.target.value)
                                setIsRbdDropdownOpen(true)
                                if (!e.target.value) {
                                    onFiltersChange({ ...filters, rbd: null })
                                }
                            }}
                            onFocus={() => setIsRbdDropdownOpen(true)}
                            className="w-full pl-8 pr-7 py-2.5 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 shadow-xs transition-all font-bold text-slate-900 placeholder-slate-400 text-xs truncate"
                        />

                        {filters.rbd !== null && (
                            <button
                                type="button"
                                onClick={handleClearRbd}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs transition-colors cursor-pointer"
                                title="Limpiar RBD"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Menú de Autocompletado */}
                    {isRbdDropdownOpen && (
                        <div className="absolute z-50 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-white border-2 border-slate-200 rounded-xl shadow-2xl divide-y divide-slate-100 text-xs animate-in fade-in-50 zoom-in-95 duration-100">
                            {rbdSuggestions.map((item) => (
                                <div
                                    key={item.colRBD}
                                    onClick={() => handleRbdSelect(item.colRBD)}
                                    className="p-3 hover:bg-cyan-50 cursor-pointer transition-colors flex items-center justify-between gap-2"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-black text-slate-900 truncate">
                                            {item.nombreEstablecimiento}
                                        </p>
                                        <p className="text-[10px] text-slate-500 truncate font-semibold">
                                            {item.sucursal} {item.comuna ? `· ${item.comuna}` : ''}
                                        </p>
                                    </div>
                                    <span className="bg-cyan-100 text-cyan-800 border border-cyan-300 text-[10px] font-black px-1.5 py-0.5 rounded shrink-0">
                                        RBD {item.colRBD}
                                    </span>
                                </div>
                            ))}

                            {rbdSuggestions.length === 0 && (
                                <div className="p-4 text-center text-slate-500 text-xs italic font-medium">
                                    No se encontraron colegios con &quot;{rbdSearchInput}&quot;
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 6. Supervisor */}
                <div>
                    <label className="block text-[11px] font-black text-slate-200 uppercase tracking-wider mb-1.5 ml-0.5">
                        Supervisor
                    </label>
                    <div className="relative">
                        <select
                            value={filters.supervisor}
                            onChange={(e) => handleSupervisorChange(e.target.value)}
                            className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 shadow-xs transition-all font-bold text-slate-900 text-xs truncate cursor-pointer"
                        >
                            <option value="" className="bg-white text-slate-700 font-semibold">Todos los supervisores</option>
                            {availableSupervisores.map((sup) => (
                                <option key={sup.id} value={`${sup.nombre} ${sup.apellido}`} className="bg-white text-slate-900 font-bold">
                                    {sup.nombre} {sup.apellido}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center text-slate-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
