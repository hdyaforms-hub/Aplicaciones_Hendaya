'use client'

import { useState, useMemo } from 'react'
import { deleteListaCorreo } from './actions'
import ListaCorreoForm from './ListaCorreoForm'
import { useRouter } from 'next/navigation'

type ListaRecord = {
    id: string
    nombre: string
    descripcion: string | null
    para: string
    cc: string | null
    sucursalId?: string | null
    porSucursal?: string | null
    sucursal?: { id: string; nombre: string } | null
    updatedAt: Date
}

export default function ListaCorreoWrapper({ 
    listas, 
    sucursales 
}: { 
    listas: ListaRecord[]
    sucursales: { id: string; nombre: string }[] 
}) {
    const router = useRouter()
    const [selectedLista, setSelectedLista] = useState<ListaRecord | undefined>(undefined)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    // Filtros de búsqueda y estado del acordeón
    const [searchTerm, setSearchTerm] = useState('')
    const [sucursalFilter, setSucursalFilter] = useState('ALL')
    const [quickTab, setQuickTab] = useState<'ALL' | 'MULTI' | 'GLOBAL'>('ALL')
    const [expandedListIds, setExpandedListIds] = useState<Set<string>>(new Set())

    const handleOpenCreate = () => {
        setSelectedLista(undefined)
        setIsFormOpen(true)
    }

    const handleOpenEdit = (lista: ListaRecord) => {
        setSelectedLista(lista)
        setIsFormOpen(true)
    }

    const handleClose = () => {
        setIsFormOpen(false)
        setSelectedLista(undefined)
        router.refresh()
    }

    const handleDelete = async (id: string, nombre: string) => {
        if (!confirm(`¿Estás seguro que deseas ELIMINAR la lista de distribución "${nombre}"?`)) return

        setDeletingId(id)
        try {
            await deleteListaCorreo(id)
        } catch (e) {
            console.error(e)
        } finally {
            setDeletingId(null)
            router.refresh()
        }
    }

    const handleExpandAll = () => {
        setExpandedListIds(new Set(filteredListas.map(l => l.id)))
    }

    const handleCollapseAll = () => {
        setExpandedListIds(new Set())
    }

    const handleToggleExpand = (id: string) => {
        setExpandedListIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // Helper para extraer array de correos
    const parseEmails = (jsonString: string | null | undefined): string[] => {
        if (!jsonString) return []
        try {
            const arr = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString
            return Array.isArray(arr) ? arr.filter(Boolean) : []
        } catch {
            return []
        }
    }

    // Helper para extraer mapa porSucursal
    const parsePorSucursal = (jsonString: string | null | undefined): Record<string, { para: string[], cc: string[] }> => {
        if (!jsonString) return {}
        try {
            const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString
            return typeof parsed === 'object' && parsed !== null ? parsed : {}
        } catch {
            return {}
        }
    }

    // Mapa rápido id -> nombre de sucursal
    const sucursalesMap = useMemo(() => {
        const map: Record<string, string> = {}
        sucursales.forEach(s => { map[s.id] = s.nombre })
        return map
    }, [sucursales])

    const multiCount = useMemo(() => listas.filter(l => Object.keys(parsePorSucursal(l.porSucursal)).length > 0).length, [listas])
    const globalCount = useMemo(() => listas.filter(l => !l.sucursalId && Object.keys(parsePorSucursal(l.porSucursal)).length === 0).length, [listas])

    // Filtrado interactivo
    const filteredListas = useMemo(() => {
        return listas.filter(l => {
            const porSucMap = parsePorSucursal(l.porSucursal)
            const branchIds = Object.keys(porSucMap)

            // Filtrado por pestaña rápida superior
            if (quickTab === 'MULTI' && branchIds.length === 0) return false
            if (quickTab === 'GLOBAL' && (l.sucursalId || branchIds.length > 0)) return false

            // Filtrado por sucursal
            let matchesSucursal = false
            if (sucursalFilter === 'ALL') {
                matchesSucursal = true
            } else if (sucursalFilter === 'GLOBAL') {
                matchesSucursal = !l.sucursalId && branchIds.length === 0
            } else {
                matchesSucursal = l.sucursalId === sucursalFilter || branchIds.includes(sucursalFilter)
            }

            if (!matchesSucursal) return false

            if (!searchTerm.trim()) return true

            const q = searchTerm.toLowerCase().trim()
            const matchNombre = l.nombre.toLowerCase().includes(q)
            const matchDesc = (l.descripcion || '').toLowerCase().includes(q)
            const matchSuc = (l.sucursal?.nombre || '').toLowerCase().includes(q)
            const paraList = parseEmails(l.para).join(' ').toLowerCase()
            const ccList = parseEmails(l.cc).join(' ').toLowerCase()

            const branchEmails: string[] = []
            const branchNames: string[] = []
            for (const [sId, item] of Object.entries(porSucMap)) {
                if (sucursalesMap[sId]) branchNames.push(sucursalesMap[sId].toLowerCase())
                if (Array.isArray(item.para)) branchEmails.push(...item.para)
                if (Array.isArray(item.cc)) branchEmails.push(...item.cc)
            }
            const matchBranches = branchNames.some(bn => bn.includes(q))
            const matchBranchEmails = branchEmails.join(' ').toLowerCase().includes(q)

            return matchNombre || matchDesc || matchSuc || paraList.includes(q) || ccList.includes(q) || matchBranches || matchBranchEmails
        }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
    }, [listas, searchTerm, sucursalFilter, sucursalesMap, quickTab])

    // Estadísticas
    const totalDestinatarios = useMemo(() => {
        let count = 0
        listas.forEach(l => {
            count += parseEmails(l.para).length + parseEmails(l.cc).length
            const porSuc = parsePorSucursal(l.porSucursal)
            Object.values(porSuc).forEach(item => {
                count += (item.para?.length || 0) + (item.cc?.length || 0)
            })
        })
        return count
    }, [listas])

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* CABECERA PRINCIPAL ESTILIZADA HENDAYA */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 p-6 md:p-8 rounded-3xl text-white shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs font-bold rounded-full uppercase tracking-wider border border-cyan-500/30">
                            Configuración • Notificaciones
                        </span>
                        <span className="text-xs text-slate-400 font-mono">HENDAYA</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                        <span>👥</span> Listas de Distribución
                    </h1>
                    <p className="text-slate-300 text-sm mt-1 max-w-2xl leading-relaxed">
                        Crea y organiza grupos de correos con enrutamiento automático por sucursal / RBD o alcance global.
                    </p>
                </div>

                <div className="relative z-10 flex flex-wrap sm:flex-nowrap items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={handleOpenCreate}
                        className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-cyan-600/30 active:scale-95 flex justify-center items-center gap-2 text-sm cursor-pointer"
                    >
                        <span>➕</span> Nueva Lista de Correo
                    </button>
                    <button 
                        onClick={() => router.refresh()} 
                        className="px-4 py-3 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center text-sm cursor-pointer"
                        title="Actualizar listado"
                    >
                        🔄
                    </button>
                </div>
            </div>

            {/* PESTAÑAS DE VISTA RÁPIDA PRINCIPALES */}
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => setQuickTab('ALL')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
                        quickTab === 'ALL'
                            ? 'bg-slate-900 text-white shadow-md scale-[1.02]'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    <span>📋 Todas las Listas</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        quickTab === 'ALL' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                    }`}>
                        {listas.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setQuickTab('MULTI')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
                        quickTab === 'MULTI'
                            ? 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white shadow-md shadow-cyan-600/30 scale-[1.02]'
                            : 'bg-white text-cyan-900 hover:bg-cyan-50 border border-cyan-200'
                    }`}
                >
                    <span>🏢 Con Destinatarios por Sucursal</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        quickTab === 'MULTI' ? 'bg-white/20 text-white' : 'bg-cyan-100 text-cyan-800'
                    }`}>
                        {multiCount}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setQuickTab('GLOBAL')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
                        quickTab === 'GLOBAL'
                            ? 'bg-slate-900 text-white shadow-md scale-[1.02]'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    <span>🌐 Globales Tradicionales</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        quickTab === 'GLOBAL' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                    }`}>
                        {globalCount}
                    </span>
                </button>
            </div>

            {/* BARRA DE FILTROS, BÚSQUEDA, ESTADÍSTICAS Y CONTROLES DE ACORDEÓN */}
            <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex-1 w-full flex flex-col sm:flex-row items-center gap-3">
                    {/* BUSCADOR */}
                    <div className="relative flex-1 w-full">
                        <span className="absolute left-3.5 top-3 text-gray-400 text-sm">🔍</span>
                        <input
                            type="text"
                            placeholder="Buscar lista por nombre, descripción, correo o sucursal..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-medium"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* FILTRO SUCURSAL */}
                    <div className="w-full sm:w-60">
                        <select
                            value={sucursalFilter}
                            onChange={(e) => setSucursalFilter(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-800 font-medium"
                        >
                            <option value="ALL">🏢 Todas las Sucursales</option>
                            <option value="GLOBAL">🌐 Globales (Sin Sucursal)</option>
                            {sucursales.map(s => (
                                <option key={s.id} value={s.id}>📍 {s.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* MÉTRICAS RÁPIDAS Y CONTROLES DE ACORDEÓN */}
                <div className="flex flex-wrap items-center gap-3 text-xs shrink-0 self-end md:self-center">
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 bg-cyan-50 text-cyan-800 font-bold rounded-xl border border-cyan-100">
                            {filteredListas.length} de {listas.length} listas
                        </span>
                        <span className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200">
                            {totalDestinatarios} correos vinculados
                        </span>
                    </div>

                    <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
                        <button
                            type="button"
                            onClick={handleExpandAll}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                            title="Desplegar todas las listas"
                        >
                            <span>🔽</span>
                            <span className="hidden sm:inline">Expandir Todo</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleCollapseAll}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                            title="Plegar todas las listas"
                        >
                            <span>🔼</span>
                            <span className="hidden sm:inline">Colapsar Todo</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* LISTADO DE LISTAS EN FORMATO ACORDEÓN COMPACTO */}
            {listas.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl py-16 flex flex-col items-center justify-center text-center px-4 shadow-sm">
                    <span className="text-5xl opacity-80 mb-4 block">📭</span>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No hay listas de distribución creadas</h3>
                    <p className="text-gray-500 max-w-md mb-6 text-sm">
                        Crea tu primera lista para agrupar correos electrónicos (por ejemplo &quot;Jefes Zonales&quot;, &quot;Operaciones&quot; o &quot;Comisión de Servicios&quot;).
                    </p>
                    <button 
                        onClick={handleOpenCreate} 
                        className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-sky-600 text-white font-bold rounded-xl shadow-md transition-all hover:scale-105 cursor-pointer"
                    >
                        Crear tu primera Lista
                    </button>
                </div>
            ) : filteredListas.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm text-gray-500">
                    <span className="text-4xl block mb-2">🔍</span>
                    <p className="text-base font-bold text-gray-800">No se encontraron listas con el filtro aplicado</p>
                    <p className="text-xs text-gray-400 mt-1">Prueba limpiando el buscador o cambiando la sucursal seleccionada.</p>
                    <button 
                        onClick={() => { setSearchTerm(''); setSucursalFilter('ALL'); }}
                        className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                        Restablecer Filtros
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredListas.map((l) => {
                        const paraEmails = parseEmails(l.para)
                        const ccEmails = parseEmails(l.cc)
                        const porSucMap = parsePorSucursal(l.porSucursal)
                        const configuredBranchIds = Object.keys(porSucMap)
                        const isMultiSucursal = configuredBranchIds.length > 0
                        const isExpanded = expandedListIds.has(l.id)

                        // Calcular correos totales de la lista
                        let zonalEmailCount = 0
                        configuredBranchIds.forEach(bId => {
                            zonalEmailCount += (porSucMap[bId]?.para?.length || 0) + (porSucMap[bId]?.cc?.length || 0)
                        })

                        return (
                            <div 
                                key={l.id} 
                                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                                    isExpanded 
                                        ? 'border-cyan-400 shadow-md ring-1 ring-cyan-200/50' 
                                        : 'border-slate-200/90 shadow-2xs hover:shadow-sm hover:border-slate-300'
                                }`}
                            >
                                {/* CABECERA ACORDEÓN COMPACTA CLICABLE */}
                                <div 
                                    onClick={() => handleToggleExpand(l.id)}
                                    className="p-4 sm:p-5 bg-gradient-to-b from-slate-50/90 to-white flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer select-none transition-colors hover:bg-slate-50"
                                >
                                    {/* LADO IZQUIERDO: ICONO + NOMBRE + BADGES + DESCRIPCIÓN */}
                                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${
                                            isMultiSucursal ? 'from-cyan-600 to-sky-700' : 'from-slate-700 to-slate-900'
                                        } flex items-center justify-center text-xl shadow-md text-white shrink-0`}>
                                            👥
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                                                    {l.nombre}
                                                </h3>

                                                {isMultiSucursal ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-sky-50 text-sky-800 text-[10px] font-bold rounded-full border border-sky-200">
                                                        <span>🏢</span> Multi-Sucursal ({configuredBranchIds.length} zonas)
                                                    </span>
                                                ) : l.sucursal ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-full border border-indigo-200">
                                                        <span>📍</span> {l.sucursal.nombre}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full border border-slate-200">
                                                        <span>🌐</span> Global
                                                    </span>
                                                )}

                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                                                    {isMultiSucursal 
                                                        ? `${zonalEmailCount} zonales • ${paraEmails.length + ccEmails.length} fijos`
                                                        : `${paraEmails.length} PARA • ${ccEmails.length} CC`
                                                    }
                                                </span>
                                            </div>

                                            <p className={`text-xs text-slate-500 mt-0.5 leading-relaxed ${isExpanded ? '' : 'line-clamp-1'}`}>
                                                {l.descripcion || 'Sin descripción adicional.'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* LADO DERECHO: ACCIONES Y CHEVRON */}
                                    <div 
                                        onClick={(e) => e.stopPropagation()} 
                                        className="flex items-center gap-2 self-end lg:self-auto shrink-0"
                                    >
                                        <span className="text-[10px] text-slate-400 font-mono hidden xl:inline pr-2 border-r border-slate-200">
                                            {new Date(l.updatedAt).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() => handleOpenEdit(l)}
                                            className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                                            title="Editar Lista y Destinatarios"
                                        >
                                            <span>✏️</span>
                                            <span>Editar</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleDelete(l.id, l.nombre)}
                                            disabled={deletingId === l.id}
                                            className={`p-1.5 px-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition-all shadow-2xs flex items-center justify-center cursor-pointer ${
                                                deletingId === l.id ? 'opacity-50 cursor-not-allowed' : ''
                                            }`}
                                            title="Eliminar Lista"
                                        >
                                            <span>🗑️</span>
                                        </button>

                                        {/* BOTÓN CHEVRON */}
                                        <button
                                            type="button"
                                            onClick={() => handleToggleExpand(l.id)}
                                            className={`w-8 h-8 rounded-xl border transition-all flex items-center justify-center cursor-pointer ml-1 ${
                                                isExpanded 
                                                    ? 'bg-cyan-50 text-cyan-800 border-cyan-300' 
                                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                            }`}
                                            title={isExpanded ? 'Plegar detalles' : 'Desplegar correos y sucursales'}
                                        >
                                            <svg 
                                                className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                                                fill="none" 
                                                stroke="currentColor" 
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* DETALLE EXPANDIDO */}
                                {isExpanded && (
                                    <div className="p-5 sm:p-6 space-y-4 border-t border-slate-200/80 bg-slate-50/40 animate-in fade-in duration-150">
                                        {/* MÉTRICAS RÁPIDAS EN EXPANDIDO */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between">
                                                <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">
                                                    {isMultiSucursal ? 'Correos Zonales' : 'Destinatarios (PARA)'}
                                                </span>
                                                <span className="font-black text-cyan-800 text-base flex items-center gap-1">
                                                    <span>{isMultiSucursal ? '📍' : '📥'}</span> 
                                                    {isMultiSucursal ? zonalEmailCount : paraEmails.length}
                                                </span>
                                            </div>
                                            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between">
                                                <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">
                                                    {isMultiSucursal ? 'Globales Fijos' : 'Copia (CC)'}
                                                </span>
                                                <span className="font-black text-slate-700 text-base flex items-center gap-1">
                                                    <span>{isMultiSucursal ? '🌐' : '👁️'}</span> 
                                                    {isMultiSucursal ? paraEmails.length + ccEmails.length : ccEmails.length}
                                                </span>
                                            </div>
                                            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between sm:col-span-2 md:col-span-1">
                                                <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">
                                                    Última Modificación
                                                </span>
                                                <span className="font-semibold text-slate-700 text-xs font-mono">
                                                    {new Date(l.updatedAt).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* DESGLOSE POR SUCURSAL PARA LISTAS MULTI-SUCURSAL */}
                                        {isMultiSucursal && (
                                            <div className="space-y-3 bg-white p-4 rounded-2xl border border-sky-100 shadow-2xs">
                                                <div className="flex items-center justify-between text-xs text-sky-950 font-bold border-b border-sky-100 pb-2">
                                                    <span className="flex items-center gap-1.5">
                                                        <span>🏢</span> Desglose por Sucursal Vinculada ({configuredBranchIds.length} zonas):
                                                    </span>
                                                    <span className="text-[11px] text-sky-700 font-medium">
                                                        Enrutamiento automático según la sucursal del registro
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                                    {configuredBranchIds.map(bId => {
                                                        const sucName = sucursalesMap[bId] || 'Sucursal'
                                                        const bData = porSucMap[bId]
                                                        return (
                                                            <div key={bId} className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                                                                <div className="font-bold text-slate-900 flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                                                                    <span className="flex items-center gap-1">📍 {sucName}</span>
                                                                    <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-bold">
                                                                        {(bData?.para?.length || 0) + (bData?.cc?.length || 0)} correos
                                                                    </span>
                                                                </div>
                                                                {bData.para && bData.para.length > 0 && (
                                                                    <div className="text-[11px] text-slate-700 font-mono">
                                                                        <span className="font-bold text-slate-500 font-sans block text-[10px] uppercase">Para:</span>
                                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                                            {bData.para.map((e, idx) => (
                                                                                <span key={idx} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px]">
                                                                                    {e}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {bData.cc && bData.cc.length > 0 && (
                                                                    <div className="text-[11px] text-slate-600 font-mono">
                                                                        <span className="font-bold text-slate-400 font-sans block text-[10px] uppercase">CC:</span>
                                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                                            {bData.cc.map((e, idx) => (
                                                                                <span key={idx} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-500">
                                                                                    {e}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* CORREOS GLOBALES (PARA / CC) */}
                                        {(paraEmails.length > 0 || ccEmails.length > 0) && (
                                            <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                                                <span className="text-xs font-bold text-slate-800 block border-b border-slate-100 pb-2">
                                                    {isMultiSucursal ? 'Correos Globales Fijos (Reciben siempre):' : 'Destinatarios de la Lista:'}
                                                </span>

                                                <div className="space-y-2">
                                                    {paraEmails.length > 0 && (
                                                        <div>
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Destinatarios Principales (PARA):</span>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {paraEmails.map((email, i) => (
                                                                    <span 
                                                                        key={i} 
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-50/70 text-cyan-900 border border-cyan-200 rounded-lg font-mono text-[11px]"
                                                                    >
                                                                        <span>✉️</span>
                                                                        <span>{email}</span>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {ccEmails.length > 0 && (
                                                        <div>
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Copia (CC):</span>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {ccEmails.map((email, i) => (
                                                                    <span 
                                                                        key={i} 
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-mono text-[11px]"
                                                                    >
                                                                        <span>👁️</span>
                                                                        <span>{email}</span>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* MODAL FORMULARIO DE CREACIÓN/EDICIÓN */}
            {isFormOpen && (
                <ListaCorreoForm
                    lista={selectedLista}
                    sucursales={sucursales}
                    onClose={handleClose}
                />
            )}
        </div>
    )
}
