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

    // Filtros de búsqueda
    const [searchTerm, setSearchTerm] = useState('')
    const [sucursalFilter, setSucursalFilter] = useState('ALL')
    const [quickTab, setQuickTab] = useState<'ALL' | 'MULTI' | 'GLOBAL'>('ALL')
    const [expandedEmailsId, setExpandedEmailsId] = useState<string | null>(null)

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
                // Coincide por sucursal fija o porque la sucursal está configurada en la lista dinámica
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

            // Buscar también en nombres de sucursales o correos zonales configurados
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
        })
    }, [listas, searchTerm, sucursalFilter, sucursalesMap])

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
                        className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-cyan-600/30 active:scale-95 flex justify-center items-center gap-2 text-sm"
                    >
                        <span>➕</span> Nueva Lista de Correo
                    </button>
                    <button 
                        onClick={() => router.refresh()} 
                        className="px-4 py-3 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center text-sm"
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

            {/* BARRA DE FILTROS, BÚSQUEDA Y ESTADÍSTICAS */}
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

                {/* MÉTRICAS RÁPIDAS */}
                <div className="flex items-center gap-3 text-xs shrink-0 self-end md:self-center">
                    <span className="px-3 py-1.5 bg-cyan-50 text-cyan-800 font-bold rounded-xl border border-cyan-100">
                        {filteredListas.length} de {listas.length} listas
                    </span>
                    <span className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200">
                        {totalDestinatarios} correos vinculados
                    </span>
                </div>
            </div>

            {/* GRID DE LISTAS */}
            {listas.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl py-16 flex flex-col items-center justify-center text-center px-4 shadow-sm">
                    <span className="text-5xl opacity-80 mb-4 block">📭</span>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No hay listas de distribución creadas</h3>
                    <p className="text-gray-500 max-w-md mb-6 text-sm">
                        Crea tu primera lista para agrupar correos electrónicos (por ejemplo &quot;Jefes Zonales&quot;, &quot;Operaciones&quot; o &quot;Comisión de Servicios&quot;).
                    </p>
                    <button 
                        onClick={handleOpenCreate} 
                        className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-sky-600 text-white font-bold rounded-xl shadow-md transition-all hover:scale-105"
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
                        className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
                    >
                        Restablecer Filtros
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredListas.map((l) => {
                        const paraEmails = parseEmails(l.para)
                        const ccEmails = parseEmails(l.cc)
                        const porSucMap = parsePorSucursal(l.porSucursal)
                        const configuredBranchIds = Object.keys(porSucMap)
                        const isMultiSucursal = configuredBranchIds.length > 0
                        const isExpanded = expandedEmailsId === l.id

                        // Calcular correos totales de la lista
                        let zonalEmailCount = 0
                        configuredBranchIds.forEach(bId => {
                            zonalEmailCount += (porSucMap[bId]?.para?.length || 0) + (porSucMap[bId]?.cc?.length || 0)
                        })

                        return (
                            <div 
                                key={l.id} 
                                className="bg-white rounded-3xl shadow-sm border border-gray-200/80 overflow-hidden flex flex-col hover:shadow-xl hover:border-cyan-300 transition-all group duration-200"
                            >
                                {/* BARRA SUPERIOR DECORATIVA CON GRADIENTE */}
                                <div className={`h-2.5 w-full bg-gradient-to-r ${
                                    isMultiSucursal 
                                        ? 'from-sky-500 via-indigo-500 to-cyan-500' 
                                        : 'from-cyan-500 via-sky-500 to-cyan-600'
                                }`} />

                                <div className="p-6 flex-1 flex flex-col justify-between gap-4">
                                    <div>
                                        {/* CABECERA DE LA TARJETA: NOMBRE Y SUCURSAL */}
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex-1">
                                                <h3 className="font-black text-lg text-gray-900 group-hover:text-cyan-900 transition-colors leading-tight">
                                                    {l.nombre}
                                                </h3>

                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {isMultiSucursal && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-sky-50 text-sky-800 text-xs font-bold rounded-lg border border-sky-200">
                                                            <span>🏢</span> Multi-Sucursal ({configuredBranchIds.length} zonas)
                                                        </span>
                                                    )}

                                                    {l.sucursal ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200">
                                                            <span>📍</span> {l.sucursal.nombre}
                                                        </span>
                                                    ) : !isMultiSucursal ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg border border-slate-200">
                                                            <span>🌐</span> Global
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {/* BOTONES DE ACCIÓN SIEMPRE VISIBLES */}
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    onClick={() => handleOpenEdit(l)}
                                                    className="p-2 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                                                    title="Editar Lista y Destinatarios"
                                                >
                                                    <span>✏️</span>
                                                    <span className="hidden sm:inline">Editar</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(l.id, l.nombre)}
                                                    disabled={deletingId === l.id}
                                                    className={`p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-xs font-bold transition-all shadow-xs flex items-center justify-center ${deletingId === l.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    title="Eliminar Lista de Distribución"
                                                >
                                                    <span>🗑️</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* DESCRIPCIÓN */}
                                        {l.descripcion ? (
                                            <p className="text-xs text-gray-600 mt-1 leading-relaxed line-clamp-2">
                                                {l.descripcion}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-gray-400 italic mt-1">Sin descripción adicional.</p>
                                        )}
                                    </div>

                                    {/* CONTADORES Y PREVISUALIZACIÓN DE CORREOS */}
                                    <div className="space-y-3 pt-2">
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-center justify-between">
                                                <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">
                                                    {isMultiSucursal ? 'Correos Zonales' : 'Destinatarios (PARA)'}
                                                </span>
                                                <span className="font-black text-cyan-800 text-base flex items-center gap-1">
                                                    <span>{isMultiSucursal ? '📍' : '📥'}</span> 
                                                    {isMultiSucursal ? zonalEmailCount : paraEmails.length}
                                                </span>
                                            </div>
                                            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-center justify-between">
                                                <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">
                                                    {isMultiSucursal ? 'Globales Fijos' : 'Copia (CC)'}
                                                </span>
                                                <span className="font-black text-slate-700 text-base flex items-center gap-1">
                                                    <span>{isMultiSucursal ? '🌐' : '👁️'}</span> 
                                                    {isMultiSucursal ? paraEmails.length + ccEmails.length : ccEmails.length}
                                                </span>
                                            </div>
                                        </div>

                                        {/* SUCURSALES CONFIGURADAS EN MODO MULTI-SUCURSAL */}
                                        {isMultiSucursal && (
                                            <div className="space-y-1.5 bg-sky-50/30 p-2.5 rounded-2xl border border-sky-100/70">
                                                <div className="flex items-center justify-between text-[11px] text-sky-900 font-bold px-1">
                                                    <span>Sucursales vinculadas ({configuredBranchIds.length}):</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedEmailsId(isExpanded ? null : l.id)}
                                                        className="text-cyan-700 hover:underline font-bold text-[10px]"
                                                    >
                                                        {isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                                                    </button>
                                                </div>

                                                <div className="flex flex-wrap gap-1">
                                                    {configuredBranchIds.map(bId => {
                                                        const sucName = sucursalesMap[bId] || 'Sucursal'
                                                        const bData = porSucMap[bId]
                                                        const bTotal = (bData?.para?.length || 0) + (bData?.cc?.length || 0)
                                                        return (
                                                            <span 
                                                                key={bId}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-sky-200 text-sky-900 rounded-md font-semibold text-[10px]"
                                                            >
                                                                <span>📍</span>
                                                                <span>{sucName}</span>
                                                                <span className="text-[9px] bg-sky-100 text-sky-800 px-1 rounded-sm font-bold">
                                                                    {bTotal}
                                                                </span>
                                                            </span>
                                                        )
                                                    })}
                                                </div>

                                                {/* VISTA EXPANDIDA CON LOS CORREOS POR SUCURSAL */}
                                                {isExpanded && (
                                                    <div className="pt-2 border-t border-sky-100 space-y-2 mt-2">
                                                        {configuredBranchIds.map(bId => {
                                                            const sucName = sucursalesMap[bId] || 'Sucursal'
                                                            const bData = porSucMap[bId]
                                                            return (
                                                                <div key={bId} className="bg-white p-2 rounded-xl border border-sky-100 text-[11px] space-y-1">
                                                                    <div className="font-bold text-gray-800 flex items-center justify-between">
                                                                        <span>📍 {sucName}</span>
                                                                    </div>
                                                                    {bData.para && bData.para.length > 0 && (
                                                                        <div className="text-[10px] text-gray-600 font-mono pl-2">
                                                                            <span className="font-bold text-gray-500 font-sans">Para: </span>
                                                                            {bData.para.join(', ')}
                                                                        </div>
                                                                    )}
                                                                    {bData.cc && bData.cc.length > 0 && (
                                                                        <div className="text-[10px] text-gray-500 font-mono pl-2">
                                                                            <span className="font-bold text-gray-400 font-sans">CC: </span>
                                                                            {bData.cc.join(', ')}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* CHIPS DE CORREOS GLOBALES DESTINATARIOS */}
                                        {paraEmails.length > 0 && (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between text-[11px] text-gray-500 font-semibold px-1">
                                                    <span>{isMultiSucursal ? 'Correos globales adicionales:' : 'Correos incluidos:'}</span>
                                                    {!isMultiSucursal && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setExpandedEmailsId(isExpanded ? null : l.id)}
                                                            className="text-cyan-700 hover:underline font-bold text-[10px]"
                                                        >
                                                            {isExpanded ? 'Ocultar' : `Ver todos (${paraEmails.length + ccEmails.length})`}
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="flex flex-wrap gap-1">
                                                    {(isExpanded || isMultiSucursal ? paraEmails : paraEmails.slice(0, 2)).map((email, i) => (
                                                        <span 
                                                            key={i} 
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 hover:bg-cyan-50 text-gray-700 hover:text-cyan-900 border border-gray-200 rounded-md font-mono text-[11px] truncate max-w-full"
                                                            title={email}
                                                        >
                                                            <span>✉️</span>
                                                            <span className="truncate">{email}</span>
                                                        </span>
                                                    ))}
                                                    {!isExpanded && !isMultiSucursal && paraEmails.length > 2 && (
                                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold rounded-md text-[10px]">
                                                            +{paraEmails.length - 2} más
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* PIE DE TARJETA CON FECHA DE ACTUALIZACIÓN */}
                                <div className="bg-slate-50/70 px-6 py-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                                    <span>Último cambio:</span>
                                    <span className="font-mono text-gray-600 font-medium">
                                        {new Date(l.updatedAt).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </span>
                                </div>
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
