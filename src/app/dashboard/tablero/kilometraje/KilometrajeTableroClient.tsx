'use client'

import { useState } from 'react'

interface KilometrajeTableroClientProps {
    supervisores: any[]
    sucursales: any[]
    colegios: any[]
    distanciasCache: any[]
    consumoActual: { cantidad: number; tope: number; mes: number; anio: number }
    userPermissions: string[]
}

export default function KilometrajeTableroClient({
    supervisores,
    sucursales,
    colegios,
    distanciasCache,
    consumoActual,
    userPermissions
}: KilometrajeTableroClientProps) {
    const [selectedSupervisorForDetails, setSelectedSupervisorForDetails] = useState<any | null>(null)
    const [modalPage, setModalPage] = useState(1)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedSucursal, setSelectedSucursal] = useState('todos')

    // 1. Calculate KPIs (dynamic based on selected branch filter)
    let globalTotalKm = 0
    const computedRbdPairs = new Set<string>()
    let totalAssignedSchools = 0
    let calculatedCount = 0
    let errorCount = 0

    supervisores.forEach(s => {
        const zonal = s.jefeOperacion?.jefeZonal || s.jefeZonal
        const supervisorSucursales = zonal?.sucursales || []
        const matchSuc = selectedSucursal === 'todos' || supervisorSucursales.some((su: any) => su.sucursal.nombre === selectedSucursal)
        if (!matchSuc) return

        const firstSucursal = zonal?.sucursales?.[0]?.sucursal?.nombre || null

        s.rbdsAuditar.forEach((r: any) => {
            const school = colegios.find(col => col.colRBD === r.rbd)
            const sucursalName = school ? school.sucursal : firstSucursal
            if (!sucursalName) return

            // Ensure the specific school matches the selected sucursal if filtered
            if (selectedSucursal !== 'todos' && sucursalName !== selectedSucursal) return

            const key = `${sucursalName}-${r.rbd}`
            if (!computedRbdPairs.has(key)) {
                computedRbdPairs.add(key)
                totalAssignedSchools++

                const cache = distanciasCache.find(c => c.sucursal === sucursalName && c.rbd === r.rbd)
                if (cache) {
                    if (cache.distanciaKm === -1) {
                        errorCount++
                    } else {
                        calculatedCount++
                        globalTotalKm += cache.distanciaKm
                    }
                }
            }
        })
    })

    // 2. Breakdown by Sucursal
    const sucursalStats = sucursales.map(suc => {
        const sucursalName = suc.nombre
        let numSupervisores = 0
        let numSchools = 0
        let sucursalKm = 0

        // Find supervisores in this sucursal
        supervisores.forEach(s => {
            const zonal = s.jefeOperacion?.jefeZonal || s.jefeZonal
            const sucs = zonal?.sucursales || []
            const isAssigned = sucs.some((su: any) => su.sucursal.nombre === sucursalName)

            if (isAssigned) {
                numSupervisores++
                s.rbdsAuditar.forEach((r: any) => {
                    const school = colegios.find(col => col.colRBD === r.rbd)
                    const assignedSuc = school ? school.sucursal : sucursalName
                    if (assignedSuc === sucursalName) {
                        numSchools++
                        const cache = distanciasCache.find(c => c.sucursal === sucursalName && c.rbd === r.rbd)
                        if (cache && cache.distanciaKm > 0) {
                            sucursalKm += cache.distanciaKm
                        }
                    }
                })
            }
        })

        return {
            id: suc.id,
            nombre: sucursalName,
            supervisores: numSupervisores,
            schools: numSchools,
            totalKm: sucursalKm
        }
    }).sort((a, b) => b.totalKm - a.totalKm)

    const maxSucursalKm = Math.max(...sucursalStats.map(s => s.totalKm), 1)

    // 3. Filter and map supervisors with total mileage
    const filteredSupervisores = supervisores.filter(s => {
        const matchName = `${s.nombre} ${s.apellido}`.toLowerCase().includes(searchQuery.toLowerCase())
        const matchEmail = s.correo.toLowerCase().includes(searchQuery.toLowerCase())
        
        const zonal = s.jefeOperacion?.jefeZonal || s.jefeZonal
        const supervisorSucursales = zonal?.sucursales || []
        const matchSucursal = selectedSucursal === 'todos' || supervisorSucursales.some((su: any) => su.sucursal.nombre === selectedSucursal)

        return (matchName || matchEmail) && matchSucursal
    })

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    const nextMonthName = monthNames[new Date().getMonth() === 11 ? 0 : new Date().getMonth() + 1]

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-gradient-to-br from-cyan-50 to-sky-50 rounded-full blur-3xl opacity-50" />
                <div className="relative z-10">
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <span>📈</span> Tablero de Kilometraje y Rutas
                    </h2>
                    <p className="text-gray-500 mt-2 text-md font-medium">
                        Panel de consulta y visualización de rutas, distancias y tiempos de viaje de supervisores.
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-2xl border border-gray-100 relative z-10">
                    <span className="text-2xl">🚗</span>
                    <div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Modo</p>
                        <p className="text-sm font-black text-cyan-600 uppercase tracking-tight">Solo Consulta</p>
                    </div>
                </div>
            </div>

            {/* Global Filters Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-col gap-1">
                    <h3 className="text-md font-extrabold text-gray-900 flex items-center gap-2">
                        <span>🔍</span> Filtros y Parámetros
                    </h3>
                    <p className="text-xs text-gray-400 font-semibold">
                        Filtra los KPIs, sucursales, supervisores y tramos detallados
                    </p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
                    {/* Branch (Sucursal) Selector */}
                    <div className="relative flex-1 sm:w-64">
                        <span className="absolute left-3 top-3 text-gray-400 text-xs">🏢</span>
                        <select
                            title="Filtrar por Sucursal"
                            value={selectedSucursal}
                            onChange={(e) => setSelectedSucursal(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none bg-white font-extrabold text-gray-700 cursor-pointer shadow-sm transition-all"
                        >
                            <option value="todos">Todas las Sucursales</option>
                            {sucursales.map(suc => (
                                <option key={suc.id} value={suc.nombre}>{suc.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {/* Supervisor Search Input */}
                    <div className="relative flex-1 sm:w-64">
                        <span className="absolute left-3.5 top-3.5 text-gray-400 text-xs">👤</span>
                        <input
                            title="Buscar Supervisor"
                            type="text"
                            placeholder="Buscar supervisor por nombre..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none shadow-sm transition-all text-gray-700 font-bold"
                        />
                    </div>

                    {/* Clear/Reset Button */}
                    {(selectedSucursal !== 'todos' || searchQuery !== '') && (
                        <button
                            type="button"
                            onClick={() => { setSelectedSucursal('todos'); setSearchQuery(''); }}
                            className="px-4 py-2 text-xs rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1 border border-slate-200/50"
                        >
                            🧹 Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Global Acumulado */}
                <div className="bg-slate-900 text-white p-7 rounded-2xl shadow-sm border border-slate-800 flex items-center justify-between group hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                    <div className="relative z-10 space-y-1">
                        <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                            {selectedSucursal === 'todos' ? 'Kilometraje Acumulado Total' : `Recorrido Acumulado: ${selectedSucursal}`}
                        </p>
                        <h3 className="text-4xl font-black italic tracking-tight">{globalTotalKm.toFixed(1)} Km</h3>
                        <p className="text-xs text-slate-400 font-medium">Suma de rutas geocodificadas activas</p>
                    </div>
                    <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center text-3xl backdrop-blur-sm relative z-10">
                        🗺️
                    </div>
                </div>

                {/* Cobertura de cálculo */}
                <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                    <div className="relative z-10 space-y-2 flex-1 mr-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cobertura de Rutas</p>
                        <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                            {calculatedCount} <span className="text-sm font-semibold text-gray-400">/ {totalAssignedSchools} RBDs</span>
                        </h3>
                        {/* Progress Bar */}
                        <div className="space-y-1">
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div 
                                    className="bg-cyan-500 h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${totalAssignedSchools > 0 ? (calculatedCount / totalAssignedSchools) * 100 : 0}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-gray-400">
                                <span>{totalAssignedSchools > 0 ? Math.round((calculatedCount / totalAssignedSchools) * 100) : 0}% trazado</span>
                                {errorCount > 0 && <span className="text-amber-500 font-black">⚠️ {errorCount} con error</span>}
                            </div>
                        </div>
                    </div>
                    <div className="w-14 h-14 bg-slate-50 text-slate-700 rounded-xl flex items-center justify-center text-3xl shadow-inner group-hover:rotate-6 transition-transform relative z-10">
                        🎯
                    </div>
                </div>

                {/* Quota Gauge (Read-Only) */}
                <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                    <div className="relative z-10 space-y-2 flex-1 mr-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Consumo mensual de API</p>
                        <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                            {consumoActual.cantidad.toLocaleString()} <span className="text-sm font-semibold text-gray-400">/ {consumoActual.tope.toLocaleString()}</span>
                        </h3>
                        {/* Progress Bar */}
                        <div className="space-y-1">
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div 
                                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min((consumoActual.cantidad / consumoActual.tope) * 100, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-gray-400">
                                <span>{Math.round((consumoActual.cantidad / consumoActual.tope) * 100)}% de la cuota gratis</span>
                                <span>Renovación: 01 de {nextMonthName}</span>
                            </div>
                        </div>
                    </div>
                    <div className="w-14 h-14 bg-slate-50 text-slate-700 rounded-xl flex items-center justify-center text-3xl shadow-inner group-hover:rotate-6 transition-transform relative z-10">
                        🛡️
                    </div>
                </div>
            </div>

            {/* Split Section: Sucursal Totals & Supervisor Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Sucursales Progress List */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-fit">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span>🏢</span> Recorridos por Zona (Sucursal)
                        </h3>
                        <p className="text-xs text-gray-400 font-semibold mt-1">Filtra haciendo clic en cualquier sucursal</p>
                    </div>

                    <div className="space-y-3">
                        {sucursalStats.map(suc => {
                            const percentage = (suc.totalKm / maxSucursalKm) * 100
                            const isSelected = selectedSucursal === suc.nombre
                            return (
                                <div 
                                    key={suc.id} 
                                    onClick={() => setSelectedSucursal(isSelected ? 'todos' : suc.nombre)}
                                    className={`space-y-2 group p-3 rounded-2xl transition-all border cursor-pointer select-none ${
                                        isSelected 
                                            ? 'bg-cyan-50/70 border-cyan-100 shadow-sm' 
                                            : 'border-transparent hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-0.5">
                                            <h4 className="text-sm font-bold text-gray-900 group-hover:text-cyan-600 transition-colors">{suc.nombre}</h4>
                                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                                                👥 {suc.supervisores} {suc.supervisores === 1 ? 'Supervisor' : 'Supervisores'} • 🏫 {suc.schools} RBDs
                                            </p>
                                        </div>
                                        <span className={`text-xs font-black italic px-2 py-0.5 rounded border transition-colors ${
                                            isSelected ? 'bg-cyan-200 text-cyan-800 border-cyan-300' : 'bg-slate-50 text-slate-800 border-slate-100'
                                        }`}>
                                            {suc.totalKm.toFixed(1)} Km
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/50">
                                        <div 
                                            className={`h-2 rounded-full transition-all duration-500 ${
                                                isSelected ? 'bg-gradient-to-r from-cyan-500 to-sky-500 shadow-md shadow-cyan-500/20' : 'bg-cyan-500'
                                            }`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                        {sucursalStats.length === 0 && (
                            <p className="text-xs text-gray-400 italic text-center py-6">No hay sucursales registradas actualmente</p>
                        )}
                    </div>
                </div>

                {/* Right: Supervisors List Table (Read-Only) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <span>🛡️</span> Detalle de Kilómetros de Supervisores
                            </h3>
                            <p className="text-xs text-gray-400 font-semibold mt-1">Haz clic en "👁️ Ver detalle" para examinar rutas tramo a tramo</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-gray-100 rounded-2xl shadow-inner">
                        <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-gray-100 text-slate-600 font-bold uppercase tracking-wider">
                                    <th className="px-5 py-3">Nombre Completo</th>
                                    <th className="px-5 py-3">Asociado Con</th>
                                    <th className="px-5 py-3">Sucursales</th>
                                    <th className="px-5 py-3 text-center">RBDs</th>
                                    <th className="px-5 py-3 text-center">Recorrido Total (Km)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-slate-700">
                                {filteredSupervisores.map(s => {
                                    const hasOp = !!s.jefeOperacion
                                    const dependencyName = hasOp 
                                        ? `👔 Jefe Op: ${s.jefeOperacion.nombre} ${s.jefeOperacion.apellido}`
                                        : `💼 Jefe Zonal: ${s.jefeZonal?.nombre} ${s.jefeZonal?.apellido}`
                                    
                                    const zonal = s.jefeOperacion?.jefeZonal || s.jefeZonal
                                    const supervisorSucursales = zonal?.sucursales || []

                                    // Calculate total mileage for supervisor
                                    let totalKm = 0
                                    let hasPending = false
                                    let hasError = false

                                    s.rbdsAuditar.forEach((r: any) => {
                                        const school = colegios.find(col => col.colRBD === r.rbd)
                                        const schoolSucursal = school ? school.sucursal : (supervisorSucursales?.[0]?.sucursal?.nombre || null)
                                        
                                        // Filter by selected sucursal if active
                                        if (selectedSucursal !== 'todos' && schoolSucursal !== selectedSucursal) return

                                        if (schoolSucursal) {
                                            const cache = distanciasCache.find(c => c.sucursal === schoolSucursal && c.rbd === r.rbd)
                                            if (cache) {
                                                if (cache.distanciaKm === -1) {
                                                    hasError = true
                                                } else {
                                                    totalKm += cache.distanciaKm
                                                }
                                            } else {
                                                hasPending = true
                                            }
                                        } else {
                                            hasError = true
                                        }
                                    })

                                    return (
                                        <tr key={s.id} className="hover:bg-cyan-50/20 transition-colors">
                                            <td className="px-5 py-3.5 font-bold text-gray-900">{s.nombre} {s.apellido}</td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${hasOp ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                                    {dependencyName}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex flex-wrap gap-1">
                                                    {supervisorSucursales.map((su: any) => (
                                                        <span key={su.sucursalId} className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-100">
                                                            {su.sucursal.nombre}
                                                        </span>
                                                    ))}
                                                    {supervisorSucursales.length === 0 && (
                                                        <span className="text-[10px] text-gray-400 italic">Ninguna</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-center font-bold text-slate-700">{s.rbdsAuditar.length}</td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex flex-col items-center gap-1 justify-center">
                                                    <span className="font-bold text-gray-900">{totalKm > 0 ? `${totalKm.toFixed(1)} Km` : hasPending ? 'Pendiente' : '0.0 Km'}</span>
                                                    {s.rbdsAuditar.length > 0 && (
                                                        <button 
                                                            onClick={() => { setSelectedSupervisorForDetails(s); setModalPage(1); }}
                                                            className="text-[10px] text-cyan-600 hover:text-cyan-800 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                                                        >
                                                            👁️ Ver detalle
                                                        </button>
                                                    )}
                                                    {hasError && <span className="text-[9px] text-amber-500 font-bold">⚠️ Error direc.</span>}
                                                    {hasPending && !hasError && <span className="text-[9px] text-gray-400">🔍 Sin calcular</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {filteredSupervisores.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-5 py-10 text-center text-gray-400 italic">No se encontraron supervisores vinculados</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* MODAL DETALLE DE KILOMETRAJE */}
            {selectedSupervisorForDetails && (() => {
                const s = selectedSupervisorForDetails
                const zonal = s.jefeOperacion?.jefeZonal || s.jefeZonal
                const supervisorSucursales = zonal?.sucursales || []
                
                // Filter schools/RBDs to audit by selected sucursal in details view
                const filteredRbds = s.rbdsAuditar.filter((r: any) => {
                    const school = colegios.find(col => col.colRBD === r.rbd)
                    const schoolSucursal = school ? school.sucursal : (supervisorSucursales?.[0]?.sucursal?.nombre || null)
                    return selectedSucursal === 'todos' || schoolSucursal === selectedSucursal
                })
                
                const itemsPerModalPage = 6
                const totalModalItems = filteredRbds.length
                const totalModalPages = Math.ceil(totalModalItems / itemsPerModalPage) || 1
                const pagedModalRbds = filteredRbds.slice((modalPage - 1) * itemsPerModalPage, modalPage * itemsPerModalPage)
                
                return (
                    <div 
                        onClick={() => setSelectedSupervisorForDetails(null)}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
                    >
                        <div 
                            className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="bg-slate-900 px-8 py-5 text-white flex justify-between items-center relative overflow-hidden">
                                <div className="absolute -right-20 -top-20 w-48 h-48 bg-gradient-to-br from-cyan-500/20 to-sky-500/20 rounded-full blur-2xl opacity-50" />
                                <div className="relative z-10 space-y-1">
                                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/30 w-fit block">
                                        🛡️ Supervisor
                                    </span>
                                    <h3 className="text-xl font-extrabold tracking-tight">
                                        Detalle de Recorridos: {s.nombre} {s.apellido}
                                    </h3>
                                    <p className="text-slate-400 text-[11px] font-medium leading-tight">
                                        Breakdown de distancias y tiempos desde sucursal origen a RBDs asignados
                                    </p>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => setSelectedSupervisorForDetails(null)}
                                    className="bg-white/10 hover:bg-white/20 text-white rounded-full w-8 h-8 flex items-center justify-center transition-all outline-none border border-white/5 cursor-pointer relative z-20"
                                    title="Cerrar modal"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-8 overflow-y-auto space-y-6">
                                {/* Sucursales Information */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-gray-100">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">🏢 Sucursales Vinculadas</h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {supervisorSucursales.map((su: any) => (
                                                <div key={su.sucursalId} className="bg-white border border-gray-200/80 rounded-xl px-3 py-1.5 shadow-sm text-xs font-bold text-slate-800 flex flex-col gap-0.5">
                                                    <span className="text-cyan-600 font-extrabold">{su.sucursal.nombre}</span>
                                                    <span className="text-[10px] text-gray-400 font-medium italic">{su.sucursal.direccion || 'Sin dirección registrada'}</span>
                                                </div>
                                            ))}
                                            {supervisorSucursales.length === 0 && (
                                                <span className="text-xs text-gray-400 italic">Ninguna sucursal vinculada</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-gray-100 flex flex-col justify-center">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">🚗 Resumen Flota</h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {s.camionetas.map((c: any) => (
                                                <span key={c.vehiculoId} className="inline-flex font-mono font-black tracking-wider px-2.5 py-1.5 rounded-xl text-xs bg-white text-slate-800 border border-gray-200 shadow-sm">
                                                    🚙 {c.vehiculo.patente}
                                                </span>
                                            ))}
                                            {s.camionetas.length === 0 && (
                                                <span className="text-xs text-gray-400 italic">Sin vehículos asignados</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Point-to-Point Details Table */}
                                <div className="border border-gray-100 rounded-2xl overflow-x-auto shadow-sm">
                                    <table className="w-full min-w-[800px] text-left border-collapse whitespace-nowrap text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-gray-100 text-slate-600 text-xs font-black uppercase tracking-wider">
                                                <th className="px-6 py-4">Punto A (Origen)</th>
                                                <th className="px-6 py-4">Punto B (RBD - Destino)</th>
                                                <th className="px-6 py-4 text-center">Distancia (Km)</th>
                                                <th className="px-6 py-4 text-center">Tiempo Estimado</th>
                                                <th className="px-6 py-4 text-center">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-slate-700">
                                            {pagedModalRbds.map((r: any, idx: number) => {
                                                const school = colegios.find(col => col.colRBD === r.rbd)
                                                const schoolSucursal = school ? school.sucursal : (supervisorSucursales?.[0]?.sucursal?.nombre || null)
                                                const sucursalObj = sucursales.find(su => su.nombre === schoolSucursal)
                                                
                                                const cache = schoolSucursal ? distanciasCache.find(c => c.sucursal === schoolSucursal && c.rbd === r.rbd) : null
                                                
                                                let distStr = 'Pendiente'
                                                let durStr = 'Pendiente'
                                                let statusBadge = (
                                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                                        🔍 Pendiente
                                                    </span>
                                                )
                                                
                                                if (cache) {
                                                    if (cache.distanciaKm === -1) {
                                                        distStr = '--'
                                                        durStr = '--'
                                                        statusBadge = (
                                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                                                                ⚠️ Dirección Inválida
                                                            </span>
                                                        )
                                                    } else {
                                                        distStr = `${cache.distanciaKm.toFixed(1)} Km`
                                                        durStr = `${cache.duracionMin} min`
                                                        statusBadge = (
                                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                                🚗 Calculado
                                                            </span>
                                                        )
                                                    }
                                                }

                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-gray-900">{schoolSucursal || 'Sin sucursal'}</span>
                                                                <span className="text-[10px] text-gray-400 font-medium italic max-w-[220px] truncate" title={sucursalObj?.direccion || ''}>
                                                                    📍 {sucursalObj?.direccion || 'Sin dirección registrada'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-gray-900">{school?.nombreEstablecimiento || `RBD ${r.rbd}`}</span>
                                                                <span className="text-[10px] text-gray-400 font-medium italic max-w-[260px] truncate" title={`${school?.direccionEstablecimiento || ''}, ${school?.comuna || ''}`}>
                                                                    🏫 {school?.direccionEstablecimiento || 'Sin dirección'}, {school?.comuna || ''}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 font-mono font-bold text-center text-slate-800">
                                                            {distStr}
                                                        </td>
                                                        <td className="px-6 py-4 font-mono font-bold text-center text-slate-800">
                                                            {durStr}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {statusBadge}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                            {totalModalItems === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                                                        {selectedSucursal === 'todos' 
                                                            ? 'No hay colegios (RBDs) asignados a este supervisor actualmente.'
                                                            : `No hay colegios (RBDs) asignados a este supervisor en la sucursal ${selectedSucursal}.`
                                                        }
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Controls inside Modal */}
                                {totalModalPages > 1 && (
                                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50 px-6 py-3 rounded-2xl border border-gray-100 text-xs mt-4">
                                        <span className="text-gray-500 font-medium">
                                            Mostrando tramos <strong className="text-slate-800">{(modalPage - 1) * itemsPerModalPage + 1}</strong> al <strong className="text-slate-800">{Math.min(modalPage * itemsPerModalPage, totalModalItems)}</strong> de <strong className="text-slate-800">{totalModalItems}</strong>
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                disabled={modalPage === 1}
                                                onClick={() => setModalPage(prev => prev - 1)}
                                                className="px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white font-bold transition-all cursor-pointer"
                                            >
                                                ◀ Anterior
                                            </button>
                                            <span className="px-3 py-1.5 text-gray-500 font-bold">
                                                Pág. {modalPage} de {totalModalPages}
                                            </span>
                                            <button
                                                type="button"
                                                disabled={modalPage === totalModalPages}
                                                onClick={() => setModalPage(prev => prev + 1)}
                                                className="px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white font-bold transition-all cursor-pointer"
                                            >
                                                Siguiente ▶
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="bg-slate-50 px-8 py-5 border-t border-gray-100 flex justify-end">
                                <button 
                                    onClick={() => setSelectedSupervisorForDetails(null)}
                                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-slate-905/10"
                                >
                                    Cerrar Detalle
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
