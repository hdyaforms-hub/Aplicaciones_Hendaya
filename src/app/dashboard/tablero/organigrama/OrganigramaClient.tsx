'use client'

import { useState } from 'react'

interface OrganigramaClientProps {
    sucursales: any[]
    initialZonales: any[]
    initialJefesOperacion: any[]
    initialSupervisores: any[]
    colegios: any[]
}

export default function OrganigramaClient({
    sucursales,
    initialZonales,
    initialJefesOperacion,
    initialSupervisores,
    colegios
}: OrganigramaClientProps) {
    const [selectedSucId, setSelectedSucId] = useState(sucursales[0]?.id || '')
    const [hoveredSuperId, setHoveredSuperId] = useState<string | null>(null)
    const [selectedSupervisor, setSelectedSupervisor] = useState<any | null>(null)
    const [rbdSearchTerm, setRbdSearchTerm] = useState('')
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

    const selectedSucursal = sucursales.find(s => s.id === selectedSucId)

    // 1. Get Jefes Zonales associated with selected sucursal (Vigentes only, guaranteed by server actions)
    const activeZonales = initialZonales.filter(z => 
        z.sucursales.some((s: any) => s.sucursalId === selectedSucId)
    )

    // 2. Get Jefes de Operación associated with active Zonales (Vigentes only)
    const getJefesOpForZonal = (zonalId: string) => {
        return initialJefesOperacion.filter(o => o.jefeZonalId === zonalId)
    }

    // 3. Get Supervisores under Jefe de Operación (Vigentes only)
    const getSupervisoresForJefeOp = (jefeOpId: string) => {
        return initialSupervisores.filter(s => s.jefeOperacionId === jefeOpId)
    }

    // 4. Get direct Supervisores under Jefe Zonal (Vigentes only)
    const getDirectSupervisoresForZonal = (zonalId: string) => {
        return initialSupervisores.filter(s => s.jefeZonalId === zonalId && !s.jefeOperacionId)
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        setTooltipPos({
            x: Math.min(e.clientX + 15, window.innerWidth - 340),
            y: Math.min(e.clientY + 15, window.innerHeight - 440)
        })
    }

    const getRbdName = (rbd: number) => {
        const col = colegios.find(c => c.colRBD === rbd)
        return col ? col.nombreEstablecimiento : 'Establecimiento no identificado'
    }

    const hasAnyPersonnel = activeZonales.length > 0

    const modalFilteredRbds = selectedSupervisor?.rbdsAuditar?.filter((r: any) => {
        if (!rbdSearchTerm.trim()) return true
        const term = rbdSearchTerm.toLowerCase().trim()
        const name = getRbdName(r.rbd).toLowerCase()
        return r.rbd.toString().includes(term) || name.includes(term)
    }) || []

    return (
        <div className="space-y-6 relative pb-16">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-cyan-50 to-sky-50 rounded-bl-full -z-10 opacity-70" />
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>📈</span> Organigrama por Zonas
                    </h2>
                    <p className="text-gray-500 mt-1">
                        Estructura jerárquica operativa activa de la sucursal seleccionada
                    </p>
                </div>

                {/* Sucursal filter selector */}
                <div className="w-full sm:w-72 space-y-1">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Sucursal</label>
                    <select
                        title="Seleccionar sucursal"
                        value={selectedSucId}
                        onChange={(e) => setSelectedSucId(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-white font-semibold text-slate-800 outline-none transition-all shadow-sm cursor-pointer"
                    >
                        <option value="">Selecciona Sucursal...</option>
                        {sucursales.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.nombre}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Visual organization chart */}
            {hasAnyPersonnel ? (
                <div className="space-y-12">
                    {activeZonales.map((zonal) => {
                        const directSupervisores = getDirectSupervisoresForZonal(zonal.id)
                        const jefesOp = getJefesOpForZonal(zonal.id)
                        const hasJefesOp = jefesOp.length > 0
                        const hasDirectSups = directSupervisores.length > 0

                        return (
                            <div key={zonal.id} className="bg-white/40 backdrop-blur-sm p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-8 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-500 to-sky-600" />
                                
                                {/* 1. JEFE ZONAL CARD */}
                                <div className="flex justify-center">
                                    <div className="bg-gradient-to-br from-cyan-600 to-sky-600 text-white p-5 rounded-2xl shadow-xl w-full max-w-sm relative group overflow-hidden border border-cyan-400/20">
                                        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500" />
                                        
                                        <div className="flex items-start gap-4">
                                            <span className="text-3xl p-2.5 bg-white/15 rounded-xl backdrop-blur-sm">👑</span>
                                            <div className="space-y-1 min-w-0">
                                                <div className="text-[10px] uppercase font-black tracking-widest text-cyan-200">Jefe Zonal</div>
                                                <h3 className="text-lg font-extrabold truncate">{zonal.nombre} {zonal.apellido}</h3>
                                                <p className="text-xs text-cyan-100 truncate">{zonal.correo}</p>
                                                <div className="flex flex-wrap gap-1 pt-1.5">
                                                    {zonal.licitaciones.map((l: any) => (
                                                        <span key={l.licitacionId} className="px-1.5 py-0.5 bg-white/20 text-[9px] font-bold rounded tracking-wide">
                                                            Lic. {l.licitacionId}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Connecting lines and Jefes de Operación */}
                                {(hasJefesOp || hasDirectSups) && (
                                    <div className="space-y-12">
                                        
                                        {/* Connector to Jefes de Operaciones */}
                                        {hasJefesOp && (
                                            <div className="space-y-6">
                                                {/* Connecting line */}
                                                <div className="flex justify-center -my-8">
                                                    <div className="w-0.5 h-10 bg-gradient-to-b from-cyan-300 to-slate-200" />
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-4">
                                                    {jefesOp.map((op) => {
                                                        const supervisores = getSupervisoresForJefeOp(op.id)
                                                        const hasSups = supervisores.length > 0

                                                        return (
                                                            <div key={op.id} className="space-y-6 flex flex-col items-center">
                                                                {/* 2. JEFE DE OPERACION CARD */}
                                                                <div className="bg-white p-5 rounded-2xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all shadow-sm w-full max-w-xs group relative overflow-hidden">
                                                                    <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500" />
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-2xl p-2 bg-indigo-50 text-indigo-600 rounded-xl">👔</span>
                                                                        <div className="min-w-0">
                                                                            <div className="text-[9px] uppercase font-black tracking-wider text-slate-400">Jefe de Operación</div>
                                                                            <h4 className="font-bold text-gray-900 truncate">{op.nombre} {op.apellido}</h4>
                                                                            <p className="text-xs text-gray-500 truncate">{op.correo}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Connector line down to supervisors */}
                                                                {hasSups && (
                                                                    <div className="w-0.5 h-6 bg-slate-200" />
                                                                )}

                                                                {/* 3. SUPERVISORES UNDER JEFE DE OPERACION */}
                                                                {hasSups && (
                                                                    <div className="w-full space-y-3 max-w-xs">
                                                                        {supervisores.map((sup) => {
                                                                            const isHovered = hoveredSuperId === sup.id
                                                                            return (
                                                                                <div
                                                                                    key={sup.id}
                                                                                    onClick={() => setSelectedSupervisor(sup)}
                                                                                    onMouseEnter={() => setHoveredSuperId(sup.id)}
                                                                                    onMouseLeave={() => setHoveredSuperId(null)}
                                                                                    onMouseMove={handleMouseMove}
                                                                                    className={`p-4 rounded-xl border transition-all cursor-pointer relative group ${
                                                                                        isHovered 
                                                                                            ? 'bg-cyan-50/70 border-cyan-400 shadow-md scale-[1.02]' 
                                                                                            : 'bg-white border-gray-100 hover:border-cyan-200 shadow-sm'
                                                                                    }`}
                                                                                    title="Haz clic para ver el detalle completo de RBDs y camionetas"
                                                                                >
                                                                                    <div className="flex justify-between items-start gap-2">
                                                                                        <div className="min-w-0">
                                                                                            <span className="text-xs font-black text-cyan-600 tracking-wider uppercase block">Supervisor</span>
                                                                                            <h5 className="font-bold text-gray-900 truncate">{sup.nombre} {sup.apellido}</h5>
                                                                                            <span className="text-[10px] text-gray-400 truncate block">{sup.correo}</span>
                                                                                        </div>
                                                                                        <span className="text-lg group-hover:scale-110 transition-transform">👥</span>
                                                                                    </div>
                                                                                    
                                                                                    <div className="flex gap-2 mt-2 pt-2 border-t border-gray-50 text-[10px] font-semibold text-slate-500">
                                                                                        <span className="bg-slate-50 px-2 py-0.5 rounded border border-gray-100">
                                                                                            🚗 {sup.camionetas.length} Camionetas
                                                                                        </span>
                                                                                        <span className="bg-slate-50 px-2 py-0.5 rounded border border-gray-100">
                                                                                            🏫 {sup.rbdsAuditar.length} RBDs
                                                                                        </span>
                                                                                    </div>

                                                                                    <div className="mt-2 text-[9px] font-bold text-cyan-600 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                        <span>🔍 Clic para abrir detalle</span>
                                                                                    </div>
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Direct dependency: Supervisors without Jefe de Operaciones */}
                                        {hasDirectSups && (
                                            <div className="border-t border-dashed border-gray-100 pt-8 space-y-6">
                                                <div className="flex justify-center">
                                                    <span className="px-4 py-1.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
                                                        Supervisores en Dependencia Directa
                                                    </span>
                                                </div>
                                                
                                                <div className="flex justify-center -my-6">
                                                    <div className="w-0.5 h-6 bg-amber-200" />
                                                </div>

                                                <div className="flex flex-wrap justify-center gap-6 pt-4">
                                                    {directSupervisores.map((sup) => {
                                                        const isHovered = hoveredSuperId === sup.id
                                                        return (
                                                            <div
                                                                key={sup.id}
                                                                onClick={() => setSelectedSupervisor(sup)}
                                                                onMouseEnter={() => setHoveredSuperId(sup.id)}
                                                                onMouseLeave={() => setHoveredSuperId(null)}
                                                                onMouseMove={handleMouseMove}
                                                                className={`p-5 rounded-2xl border transition-all cursor-pointer w-full max-w-xs relative group ${
                                                                    isHovered 
                                                                        ? 'bg-amber-50/60 border-amber-400 shadow-md scale-[1.02]' 
                                                                        : 'bg-white border-gray-200 hover:border-amber-300 shadow-sm'
                                                                }`}
                                                                title="Haz clic para ver el detalle completo de RBDs y camionetas"
                                                            >
                                                                <div className="absolute top-0 right-0 w-2 h-full bg-amber-500 rounded-r-2xl" />
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <div className="min-w-0">
                                                                        <span className="text-[10px] font-black text-amber-600 tracking-wider uppercase block">Supervisor Directo</span>
                                                                        <h5 className="font-bold text-gray-900 truncate">{sup.nombre} {sup.apellido}</h5>
                                                                        <span className="text-xs text-gray-500 truncate block">{sup.correo}</span>
                                                                    </div>
                                                                    <span className="text-xl p-1.5 bg-amber-50 rounded-xl text-amber-600">👤</span>
                                                                </div>
                                                                
                                                                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50 text-[10px] font-semibold text-slate-500">
                                                                    <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-gray-100">
                                                                        🚗 {sup.camionetas.length} Camionetas
                                                                    </span>
                                                                    <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-gray-100">
                                                                        🏫 {sup.rbdsAuditar.length} RBDs
                                                                    </span>
                                                                </div>

                                                                <div className="mt-2 text-[9px] font-bold text-amber-700 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <span>🔍 Clic para abrir detalle</span>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ) : (
                /* Elegant empty state */
                <div className="bg-white py-16 px-6 rounded-2xl border border-gray-100 shadow-sm text-center max-w-xl mx-auto space-y-4">
                    <span className="text-5xl block animate-bounce">🤷‍♂️</span>
                    <h3 className="text-xl font-bold text-gray-800">Estructura Vacía</h3>
                    <p className="text-gray-500 text-sm">
                        No se ha encontrado personal operativo vigente asociado a la sucursal <strong className="text-cyan-600">{selectedSucursal?.nombre || ''}</strong> actualmente.
                    </p>
                    <p className="text-xs text-gray-400 italic">
                        Puedes configurar y asignar Jefe Zonal, Jefe de Operaciones y Supervisores en el mantenedor de personal.
                    </p>
                </div>
            )}

            {/* FLOATING HOVER POPUP TOOLTIP (Hover over Supervisor) */}
            {hoveredSuperId && !selectedSupervisor && (
                (() => {
                    const sup = initialSupervisores.find(s => s.id === hoveredSuperId)
                    if (!sup) return null

                    return (
                        <div
                            style={{
                                position: 'fixed',
                                left: `${tooltipPos.x}px`,
                                top: `${tooltipPos.y}px`,
                                zIndex: 9999
                            }}
                            className="w-80 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700/60 space-y-3 max-h-[380px] overflow-y-auto pointer-events-auto transition-opacity duration-200"
                            onMouseEnter={() => setHoveredSuperId(sup.id)}
                            onMouseLeave={() => setHoveredSuperId(null)}
                        >
                            {/* Supervisor header */}
                            <div className="border-b border-slate-800 pb-2 flex justify-between items-start">
                                <div>
                                    <h4 className="font-extrabold text-sm text-cyan-400">{sup.nombre} {sup.apellido}</h4>
                                    <span className="text-[10px] text-slate-400 font-medium block">Información de Dependencia</span>
                                </div>
                                <span className="text-[9px] font-bold bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
                                    Haz clic para interactuar
                                </span>
                            </div>

                            {/* Camionetas list */}
                            <div className="space-y-1">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <span>🚗</span> Camionetas Asignadas ({sup.camionetas.length})
                                </h5>
                                {sup.camionetas.length > 0 ? (
                                    <div className="space-y-1 max-h-20 overflow-y-auto pr-1 scrollbar-thin">
                                        {sup.camionetas.map((c: any) => (
                                            <div key={c.vehiculoId} className="flex justify-between items-center bg-slate-800/50 px-2.5 py-1 rounded text-xs border border-slate-800">
                                                <span className="font-mono font-bold tracking-wider text-cyan-200">{c.vehiculo.patente}</span>
                                                <span className="text-[10px] text-slate-400">({c.vehiculo.tipoVehiculo.nombre})</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-slate-500 italic px-1">Sin camionetas asignadas.</div>
                                )}
                            </div>

                            {/* RBDs list */}
                            <div className="space-y-1">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <span>🏫</span> RBDs a Auditar ({sup.rbdsAuditar.length})
                                </h5>
                                {sup.rbdsAuditar.length > 0 ? (
                                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                                        {sup.rbdsAuditar.map((r: any) => (
                                            <div key={r.rbd} className="bg-slate-800/40 p-2 rounded text-xs border border-slate-800 space-y-0.5">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-cyan-300">RBD {r.rbd}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-300 truncate font-medium" title={getRbdName(r.rbd)}>
                                                    {getRbdName(r.rbd)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-slate-500 italic px-1">Sin RBDs asignados.</div>
                                )}
                            </div>
                        </div>
                    )
                })()
            )}

            {/* INTERACTIVE DETAIL MODAL */}
            {selectedSupervisor && (
                <div
                    className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => { setSelectedSupervisor(null); setRbdSearchTerm('') }}
                >
                    <div
                        className="bg-slate-900 text-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-700/60 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-6 bg-slate-950/80 border-b border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-xl">
                                    👤
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-lg text-white">
                                        {selectedSupervisor.nombre} {selectedSupervisor.apellido}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium">
                                        {selectedSupervisor.correo} • <span className="text-cyan-400 font-bold uppercase tracking-wider">Supervisor</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setSelectedSupervisor(null); setRbdSearchTerm('') }}
                                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                                title="Cerrar ventana"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            {/* Camionetas */}
                            <div className="space-y-2.5">
                                <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <span>🚗</span> Camionetas Asignadas ({selectedSupervisor.camionetas.length})
                                </h5>
                                {selectedSupervisor.camionetas.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {selectedSupervisor.camionetas.map((c: any) => (
                                            <div key={c.vehiculoId} className="flex justify-between items-center bg-slate-800/60 px-3.5 py-2.5 rounded-xl border border-slate-700/50">
                                                <span className="font-mono font-bold tracking-wider text-cyan-300 text-sm">{c.vehiculo.patente}</span>
                                                <span className="text-xs text-slate-400">({c.vehiculo.tipoVehiculo.nombre})</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-500 italic bg-slate-800/30 p-3 rounded-xl border border-slate-800">
                                        Sin camionetas asignadas.
                                    </div>
                                )}
                            </div>

                            {/* RBDs A AUDITAR */}
                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <span>🏫</span> RBDs a Auditar ({selectedSupervisor.rbdsAuditar.length})
                                    </h5>

                                    {/* Search Filter */}
                                    {selectedSupervisor.rbdsAuditar.length > 3 && (
                                        <div className="relative w-full sm:w-52">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                                            <input
                                                type="text"
                                                placeholder="Buscar por RBD o nombre..."
                                                value={rbdSearchTerm}
                                                onChange={(e) => setRbdSearchTerm(e.target.value)}
                                                className="w-full pl-8 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-colors"
                                            />
                                        </div>
                                    )}
                                </div>

                                {selectedSupervisor.rbdsAuditar.length > 0 ? (
                                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                        {modalFilteredRbds.map((r: any) => (
                                            <div key={r.rbd} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between gap-3 hover:bg-slate-800 transition-colors">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 font-mono font-bold text-xs rounded-lg shrink-0 border border-cyan-500/30">
                                                        RBD {r.rbd}
                                                    </span>
                                                    <span className="text-xs text-slate-200 font-medium truncate">
                                                        {getRbdName(r.rbd)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {modalFilteredRbds.length === 0 && (
                                            <div className="text-xs text-slate-400 text-center py-6 italic bg-slate-800/20 rounded-xl">
                                                No se encontraron RBDs que coincidan con la búsqueda.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-500 italic bg-slate-800/30 p-3 rounded-xl border border-slate-800">
                                        Sin RBDs asignados.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end">
                            <button
                                type="button"
                                onClick={() => { setSelectedSupervisor(null); setRbdSearchTerm('') }}
                                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
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
