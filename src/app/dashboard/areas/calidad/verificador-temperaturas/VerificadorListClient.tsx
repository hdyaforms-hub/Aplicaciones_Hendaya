'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RegistroListItem, deleteRegistro, saveGlobalCamaraConfig, firmarVerificacionJefeBodega, firmarVerificacionJefeZonal } from './actions'
import { getCalendarWeeksForMonth } from './calendarUtils'
import FirmaCanvas from './FirmaCanvas'

const MESES_NOMBRES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

interface Props {
    initialRegistros: RegistroListItem[]
    camarasCatalog: any[]
    canManage: boolean
    canConfig: boolean
    canSignJefeBodega?: boolean
    canSignJefeZonal?: boolean
    currentUser: string
}

export default function VerificadorListClient({
    initialRegistros,
    camarasCatalog,
    canManage,
    canConfig,
    canSignJefeBodega = false,
    canSignJefeZonal = false,
    currentUser
}: Props) {
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState('')
    const [isDeleting, setIsDeleting] = useState<number | null>(null)
    const [showCamarasModal, setShowCamarasModal] = useState(false)
    const [selectedRecordForSign, setSelectedRecordForSign] = useState<RegistroListItem | null>(null)
    const [isSigningWeekly, setIsSigningWeekly] = useState(false)
    const [semanalFirmaText, setSemanalFirmaText] = useState<Record<string, string>>({})
    const [auditChecked, setAuditChecked] = useState<Record<string, boolean>>({})
    const [expandedAudit, setExpandedAudit] = useState<Record<string, boolean>>({})
    const [scrolledToBottom, setScrolledToBottom] = useState<Record<string, boolean>>({})
    const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})

    const congCamara = camarasCatalog.find(c => c.tipoCamara === 'Congelado')
    const refrigCamara = camarasCatalog.find(c => c.tipoCamara === 'Refrigerado')

    const [tempCongelado, setTempCongelado] = useState(
        congCamara ? String(congCamara.temperaturaMaxima) : '-18.0'
    )
    const [tempRefrigerado, setTempRefrigerado] = useState(
        refrigCamara ? String(refrigCamara.temperaturaMaxima) : '5.0'
    )
    const [isSavingGlobalCamaras, setIsSavingGlobalCamaras] = useState(false)

    const [filterSucursal, setFilterSucursal] = useState('')
    const [filterTipoCamara, setFilterTipoCamara] = useState('')
    const [filterAnio, setFilterAnio] = useState('')
    const [filterMes, setFilterMes] = useState('')

    const handleSignJefeBodega = async (idRegistro: number, mes: number, semana: number) => {
        const key = `${idRegistro}_${mes}_${semana}_bodega`
        const firmaTexto = semanalFirmaText[key] || `Firmado por Jefe de Bodega ${currentUser}`
        setIsSigningWeekly(true)
        const res = await firmarVerificacionJefeBodega(idRegistro, mes, semana, firmaTexto)
        setIsSigningWeekly(false)

        if (res.success) {
            alert(`✅ Verificación Semanal (Jefe de Bodega) para Semana ${semana} firmada exitosamente.`)
            router.refresh()
        } else {
            alert(`⚠️ ${res.error || 'Error al guardar firma de Jefe de Bodega'}`)
        }
    }

    const handleSignJefeZonal = async (idRegistro: number, mes: number, semana: number) => {
        const key = `${idRegistro}_${mes}_${semana}_zonal`
        const firmaTexto = semanalFirmaText[key] || `Firmado por Jefe Zonal ${currentUser}`
        setIsSigningWeekly(true)
        const res = await firmarVerificacionJefeZonal(idRegistro, mes, semana, firmaTexto)
        setIsSigningWeekly(false)

        if (res.success) {
            alert(`✅ Verificación Semanal (Jefe Zonal) para Semana ${semana} firmada exitosamente.`)
            router.refresh()
        } else {
            alert(`⚠️ ${res.error || 'Error al guardar firma de Jefe Zonal'}`)
        }
    }

    // Paginación y Orden
    const [sortField, setSortField] = useState<keyof RegistroListItem>('fechaCreacion')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // Extraer opciones únicas para los filtros basados en initialRegistros
    const uniqueSucursales = Array.from(new Set(initialRegistros.map(r => r.nombreEntidad))).sort()
    const uniqueAnios = Array.from(new Set(initialRegistros.map(r => r.anio))).sort((a, b) => b - a)

    // Filtrado de la lista
    let filteredRegistros = initialRegistros.filter(r => {
        const term = searchTerm.toLowerCase()
        const matchesSearch = term === '' || 
            r.nombreEntidad.toLowerCase().includes(term) ||
            r.tipoEntidad.toLowerCase().includes(term) ||
            r.monitorResponsable.toLowerCase().includes(term) ||
            r.anio.toString().includes(term) ||
            r.tipoCamara.toLowerCase().includes(term)

        const matchesSucursal = filterSucursal === '' || r.nombreEntidad === filterSucursal
        const matchesTipo = filterTipoCamara === '' || r.tipoCamara === filterTipoCamara
        const matchesAnio = filterAnio === '' || r.anio.toString() === filterAnio
        
        // Mes activo se extrae de fechaRegistro en UTC
        const mesRegistro = r.fechaRegistro ? new Date(r.fechaRegistro).getUTCMonth() + 1 : null
        const matchesMes = filterMes === '' || (mesRegistro !== null && mesRegistro.toString() === filterMes)

        return matchesSearch && matchesSucursal && matchesTipo && matchesAnio && matchesMes
    })

    // Ordenar
    filteredRegistros = filteredRegistros.sort((a, b) => {
        const valA = a[sortField] as any
        const valB = b[sortField] as any

        if (valA === valB) return 0
        if (valA === null || valA === undefined) return 1
        if (valB === null || valB === undefined) return -1

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1
        return 0
    })

    const totalPages = Math.max(1, Math.ceil(filteredRegistros.length / itemsPerPage))
    
    // Si los filtros reducen la lista y la página actual queda fuera, ajustamos a la primera
    const safeCurrentPage = Math.min(currentPage, totalPages)
    
    const currentRegistros = filteredRegistros.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage)

    const handleSort = (field: keyof RegistroListItem) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    const SortIcon = ({ field }: { field: keyof RegistroListItem }) => {
        if (sortField !== field) return <span className="opacity-30">↕</span>
        return <span className="text-cyan-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
    }

    const ThSortable = ({ field, children, className = "" }: { field: keyof RegistroListItem, children: React.ReactNode, className?: string }) => (
        <th 
            className={`px-4 py-3.5 cursor-pointer hover:bg-slate-800 transition-colors select-none ${className}`}
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center gap-2 justify-between">
                <span>{children}</span>
                <SortIcon field={field} />
            </div>
        </th>
    )

    const handleDelete = async (idRegistro: number, nombre: string) => {
        if (!confirm(`¿Estás seguro de eliminar el registro de temperaturas para "${nombre}"? Esta acción no se puede deshacer.`)) {
            return
        }

        setIsDeleting(idRegistro)
        const res = await deleteRegistro(idRegistro)
        setIsDeleting(null)

        if (res.success) {
            alert('✅ Registro eliminado exitosamente.')
            router.refresh()
        } else {
            alert(`⚠️ ${res.error || 'Error al eliminar'}`)
        }
    }

    const handleSaveGlobalCamaras = async (e: React.FormEvent) => {
        e.preventDefault()

        const numCong = parseFloat(tempCongelado.replace(',', '.'))
        const numRef = parseFloat(tempRefrigerado.replace(',', '.'))

        if (isNaN(numCong) || isNaN(numRef)) {
            alert('Ingresa valores numéricos válidos para ambas temperaturas.')
            return
        }

        setIsSavingGlobalCamaras(true)
        const res = await saveGlobalCamaraConfig({
            tempMaxCongelado: numCong,
            tempMaxRefrigerado: numRef
        })
        setIsSavingGlobalCamaras(false)

        if (res.success) {
            alert('✅ Configuración global de cámaras guardada exitosamente. Todas las cámaras del mismo tipo asumirán estos valores.')
            setShowCamarasModal(false)
            router.refresh()
        } else {
            alert(`⚠️ Error al guardar: ${res.error}`)
        }
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300 pb-16">
            {/* Header del Módulo */}
            <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3">
                        <span className="text-3xl p-3 bg-cyan-950/80 text-cyan-400 rounded-2xl border border-cyan-800/50">
                            🌡️
                        </span>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                                Verificador de Temperaturas
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                                Control y monitoreo continuo de cámaras de refrigeración y congelación en bodegas y sucursales
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {canConfig && (
                        <button
                            type="button"
                            onClick={() => setShowCamarasModal(true)}
                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-700/50 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                        >
                            <span>⚙️</span> Configurar Cámaras
                        </button>
                    )}

                    {canManage && (
                        <Link
                            href="/dashboard/areas/calidad/verificador-temperaturas/nuevo"
                            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2"
                        >
                            <span>➕</span> Nuevo Registro
                        </Link>
                    )}
                </div>
            </div>

            {/* Barra de Búsqueda y Estadísticas */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="relative w-full sm:w-96">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 text-sm">
                            🔍
                        </span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            placeholder="Buscar por entidad, monitor, año o tipo..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 text-xs font-bold text-slate-800 outline-none bg-slate-50/50"
                        />
                    </div>

                    <div className="text-xs font-bold text-slate-500 flex items-center gap-4">
                        <span>Total Registros: <strong className="text-slate-900">{filteredRegistros.length}</strong></span>
                    </div>
                </div>

                {/* Filtros */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
                    <select
                        value={filterSucursal}
                        onChange={e => { setFilterSucursal(e.target.value); setCurrentPage(1); }}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50"
                    >
                        <option value="">Todas las Sucursales</option>
                        {uniqueSucursales.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <select
                        value={filterTipoCamara}
                        onChange={e => { setFilterTipoCamara(e.target.value); setCurrentPage(1); }}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50"
                    >
                        <option value="">Todos los Tipos</option>
                        <option value="Refrigerado">Refrigerado</option>
                        <option value="Congelado">Congelado</option>
                    </select>
                    <select
                        value={filterAnio}
                        onChange={e => { setFilterAnio(e.target.value); setCurrentPage(1); }}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50"
                    >
                        <option value="">Todos los Años</option>
                        {uniqueAnios.map(a => (
                            <option key={a} value={a.toString()}>{a}</option>
                        ))}
                    </select>
                    <select
                        value={filterMes}
                        onChange={e => { setFilterMes(e.target.value); setCurrentPage(1); }}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50"
                    >
                        <option value="">Todos los Meses</option>
                        <option value="1">Enero</option>
                        <option value="2">Febrero</option>
                        <option value="3">Marzo</option>
                        <option value="4">Abril</option>
                        <option value="5">Mayo</option>
                        <option value="6">Junio</option>
                        <option value="7">Julio</option>
                        <option value="8">Agosto</option>
                        <option value="9">Septiembre</option>
                        <option value="10">Octubre</option>
                        <option value="11">Noviembre</option>
                        <option value="12">Diciembre</option>
                    </select>
                </div>

                {/* Tabla de Registros */}
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-slate-300 font-extrabold uppercase text-[10px] tracking-wider">
                            <tr>
                                <ThSortable field="anio">Año</ThSortable>
                                <ThSortable field="fechaRegistro">Mes</ThSortable>
                                <ThSortable field="nombreEntidad">Sucursal</ThSortable>
                                <ThSortable field="tipoCamara">Tipo Cámara</ThSortable>
                                <ThSortable field="monitorResponsable">Monitor Responsable</ThSortable>
                                <ThSortable field="cumplimientoGeneral" className="text-center">% Cumplimiento</ThSortable>
                                <th className="px-4 py-3.5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white font-medium text-slate-700">
                            {filteredRegistros.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-gray-400 font-semibold">
                                        No se encontraron registros de verificador de temperaturas.
                                    </td>
                                </tr>
                            ) : (
                                currentRegistros.map((r) => {
                                    // Determinar semáforo
                                    let badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    let semaforoIcon = '🟢'
                                    if (r.cumplimientoGeneral < 80) {
                                        badgeColor = 'bg-rose-100 text-rose-800 border-rose-300'
                                        semaforoIcon = '🔴'
                                    } else if (r.cumplimientoGeneral < 95) {
                                        badgeColor = 'bg-amber-100 text-amber-800 border-amber-300'
                                        semaforoIcon = '🟡'
                                    }

                                    return (
                                        <tr key={r.idRegistro} className="hover:bg-slate-50/80 transition-all">
                                            <td className="px-4 py-3.5 font-bold text-slate-900">{r.anio}</td>
                                            <td className="px-4 py-3.5 font-bold text-slate-700 capitalize">
                                                {r.fechaRegistro ? new Date(r.fechaRegistro).toLocaleDateString('es-CL', { month: 'long', timeZone: 'UTC' }) : '---'}
                                            </td>
                                            <td className="px-4 py-3.5 font-bold text-slate-900">{r.nombreEntidad}</td>
                                            <td className="px-4 py-3.5">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                                    r.tipoCamara === 'Congelado' 
                                                        ? 'bg-purple-50 text-purple-700 border-purple-200' 
                                                        : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                                }`}>
                                                    {r.tipoCamara === 'Congelado' ? '❄️ Congelado' : '🧊 Refrigerado'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5">{r.monitorResponsable}</td>
                                            <td className="px-4 py-3.5 text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${badgeColor}`}>
                                                    <span>{semaforoIcon}</span>
                                                    <span>{r.cumplimientoGeneral}%</span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedRecordForSign(r)}
                                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-700/50 rounded-xl font-extrabold text-[11px] transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                                                        title="Verificaciones Semanales (Jefe de Bodega / Zonal)"
                                                    >
                                                        <span>📋</span> Firmas Semanales
                                                    </button>

                                                    <Link
                                                        href={`/dashboard/areas/calidad/verificador-temperaturas/editar/${r.idRegistro}`}
                                                        className="px-3 py-1.5 bg-slate-100 hover:bg-cyan-50 text-cyan-700 hover:text-cyan-900 border border-slate-200 rounded-xl font-extrabold text-[11px] transition-all"
                                                    >
                                                        ✏️ Ver / Editar
                                                    </Link>
                                                    {canManage && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(r.idRegistro, r.nombreEntidad)}
                                                            disabled={isDeleting === r.idRegistro}
                                                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-all cursor-pointer disabled:opacity-50"
                                                            title="Eliminar"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Controles de Paginación */}
                {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100 mt-2">
                        <div className="text-xs font-bold text-slate-500">
                            Mostrando página <strong className="text-slate-900">{safeCurrentPage}</strong> de <strong className="text-slate-900">{totalPages}</strong>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={safeCurrentPage === 1}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[11px] uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ← Anterior
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={safeCurrentPage === totalPages}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[11px] uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Próximo →
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal para Configuración de Cámaras (Administrador) */}
            {canConfig && showCamarasModal && (
                <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl p-2 bg-cyan-50 text-cyan-600 rounded-2xl">⚙️</span>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Configuración de Cámaras</h3>
                                    <p className="text-xs text-gray-500">Administración exclusiva de T° Máximas</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCamarasModal(false)}
                                className="text-gray-400 hover:text-slate-700 text-lg font-bold p-1 rounded-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveGlobalCamaras} className="space-y-4 text-xs">
                            <p className="text-slate-600 font-medium text-xs">
                                Configura la temperatura máxima de referencia para cada tipo de cámara. Todas las cámaras en los registros asumirán automáticamente estos valores.
                            </p>

                            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-2">
                                <label className="block font-black text-purple-950 uppercase tracking-wider text-[11px] flex items-center gap-2">
                                    <span>❄️</span> Cámara de Congelado
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-600">T° Máxima (°C):</span>
                                    <input
                                        type="text"
                                        value={tempCongelado}
                                        onChange={(e) => setTempCongelado(e.target.value)}
                                        placeholder="-18.0"
                                        className="w-full px-3 py-2 rounded-xl border border-purple-200 font-black text-purple-900 bg-white outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-cyan-50 rounded-2xl border border-cyan-100 space-y-2">
                                <label className="block font-black text-cyan-950 uppercase tracking-wider text-[11px] flex items-center gap-2">
                                    <span>🧊</span> Cámara de Refrigerado
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-600">T° Máxima (°C):</span>
                                    <input
                                        type="text"
                                        value={tempRefrigerado}
                                        onChange={(e) => setTempRefrigerado(e.target.value)}
                                        placeholder="5.0"
                                        className="w-full px-3 py-2 rounded-xl border border-cyan-200 font-black text-cyan-900 bg-white outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowCamarasModal(false)}
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingGlobalCamaras}
                                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                                >
                                    {isSavingGlobalCamaras ? '⏳ Guardando...' : '💾 Guardar Configuración'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal para Verificaciones Semanales (Jefe de Bodega / Jefe Zonal) */}
            {selectedRecordForSign && (() => {
                const mes = selectedRecordForSign.fechaRegistro
                    ? new Date(selectedRecordForSign.fechaRegistro).getUTCMonth() + 1
                    : 1
                const anio = selectedRecordForSign.anio || new Date().getFullYear()
                const mesNombre = MESES_NOMBRES[mes - 1]
                const verificacionesDiarias = selectedRecordForSign.verificacionesDiarias || []
                const verificacionesSemanales = selectedRecordForSign.verificacionesSemanales || []
                const detalles = selectedRecordForSign.detalles || []

                // Días únicos con registros de temperatura en el mes activo
                const registeredDays = Array.from(new Set(detalles.filter((d: any) => d.mes === mes).map((d: any) => d.dia))).sort((a: any, b: any) => Number(a) - Number(b))

                // Obtener las semanas calendáricas del mes (Lunes a Domingo)
                const monthWeeks = getCalendarWeeksForMonth(anio, mes)

                // Filtrar únicamente las semanas que tienen al menos 1 día con registros de temperatura
                const activeSemanas = monthWeeks.filter(w => {
                    return registeredDays.some((d: any) => Number(d) >= w.startDay && Number(d) <= w.endDay)
                })

                return (
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 space-y-6 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl p-2 bg-cyan-50 text-cyan-600 rounded-2xl">📋</span>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">
                                            Verificaciones Semanales — {selectedRecordForSign.nombreEntidad} ({mesNombre} {anio})
                                        </h3>
                                        <p className="text-xs text-gray-500 font-medium">
                                            Nivel 2 (Jefe de Bodega) y Nivel 3 (Jefe Zonal) | {selectedRecordForSign.tipoCamara}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedRecordForSign(null)}
                                    className="text-gray-400 hover:text-slate-700 text-lg font-bold p-1 rounded-lg cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-4">
                                {activeSemanas.length === 0 ? (
                                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-gray-300 space-y-2">
                                        <span className="text-3xl block">ℹ️</span>
                                        <p className="text-sm font-black text-slate-700">
                                            No existen mediciones de temperatura registradas para {mesNombre} {anio}.
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            Las verificaciones semanales se activan automáticamente cuando el monitor registra mediciones en el sistema.
                                        </p>
                                    </div>
                                ) : (
                                    activeSemanas.map(w => {
                                        const semana = w.semanaNum
                                        const startDay = w.startDay
                                        const endDay = w.endDay

                                        const semEntry = verificacionesSemanales.find((v: any) => v.mes === mes && v.semana === semana)
                                        const firmadoBodega = Boolean(semEntry?.firmadoJefeBodega)
                                        const firmadoZonal = Boolean(semEntry?.firmadoJefeZonal)

                                        const diasEnSemanaReg = registeredDays.filter((d: any) => Number(d) >= startDay && Number(d) <= endDay)
                                        const diasEnSemanaSigned = verificacionesDiarias
                                            .filter((v: any) => v.mes === mes && v.dia >= startDay && v.dia <= endDay && v.firmado)
                                            .map((v: any) => v.dia)

                                        const faltantes = diasEnSemanaReg.filter((d: any) => !diasEnSemanaSigned.includes(d))
                                        const faltanFirmasDiarias = faltantes.length > 0

                                        const keyBodega = `${selectedRecordForSign.idRegistro}_${mes}_${semana}_bodega`
                                        const keyZonal = `${selectedRecordForSign.idRegistro}_${mes}_${semana}_zonal`
                                        const weekKey = `${selectedRecordForSign.idRegistro}_${mes}_${semana}`
                                        const isAuditOpen = Boolean(expandedAudit[weekKey] ?? true)

                                        const detallesSemana = detalles
                                            .filter((d: any) => d.mes === mes && d.dia >= startDay && d.dia <= endDay)
                                            .sort((a: any, b: any) => a.dia - b.dia || a.numeroCorrelativo - b.numeroCorrelativo)

                                        return (
                                            <div key={semana} className="p-5 bg-slate-50 rounded-2xl border border-gray-200 space-y-4">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-200 pb-3">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-extrabold text-sm text-slate-900">
                                                            {w.label}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-600 bg-white px-2.5 py-0.5 rounded-md border border-gray-200">
                                                            {diasEnSemanaSigned.length}/{diasEnSemanaReg.length} firmas diarias de monitor
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setExpandedAudit(prev => ({ ...prev, [weekKey]: !isAuditOpen }))}
                                                            className="text-[11px] font-extrabold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 px-3 py-1 rounded-xl border border-cyan-200 transition-all flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <span>🔍 {isAuditOpen ? 'Ocultar Auditoría de Lecturas' : 'Ver y Auditar Lecturas de la Semana'}</span>
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {firmadoBodega ? (
                                                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                                                ✅ Bodega Firmado
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                                                                ⏳ Bodega Pendiente
                                                            </span>
                                                        )}

                                                        {firmadoZonal ? (
                                                            <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                                                                ✅ Zonal Firmado
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-slate-600 bg-slate-200 px-2.5 py-0.5 rounded-full">
                                                                ⏳ Zonal Pendiente
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Tabla y Acordeón por Día para Auditoría de Lecturas de la Semana */}
                                                {isAuditOpen && (() => {
                                                    const daysInWeek = Array.from(new Set(detallesSemana.map((d: any) => d.dia))).sort((a: any, b: any) => Number(a) - Number(b))
                                                    const isScrolled = Boolean(scrolledToBottom[weekKey])

                                                    return (
                                                        <div className="bg-white p-4 rounded-2xl border border-cyan-300 shadow-xs space-y-3 animate-in fade-in">
                                                            <div className="font-extrabold text-xs text-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 border-b border-gray-100 pb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-cyan-800 font-black">📑 Acordeón por Día — Auditoría de Lecturas ({w.label}):</span>
                                                                    <span className="text-[10px] font-extrabold px-2 py-0.5 bg-cyan-100 text-cyan-900 rounded-md border border-cyan-200">
                                                                        {detallesSemana.length} lecturas
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {!isScrolled ? (
                                                                        <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 animate-pulse">
                                                                            📜 Desplaza la lista hasta abajo para habilitar el check
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                                                            ✅ Lecturas Recorridas y Auditadas
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {detallesSemana.length === 0 ? (
                                                                <div className="text-center py-4 text-xs font-bold text-gray-400">
                                                                    Sin detalles registrados en esta semana.
                                                                </div>
                                                            ) : (
                                                                <div
                                                                    onScroll={(e) => {
                                                                        if (scrolledToBottom[weekKey]) return
                                                                        const target = e.currentTarget
                                                                        if (target.scrollHeight - target.scrollTop - target.clientHeight <= 25) {
                                                                            setScrolledToBottom(prev => ({ ...prev, [weekKey]: true }))
                                                                        }
                                                                    }}
                                                                    ref={(el) => {
                                                                        if (scrolledToBottom[weekKey]) return
                                                                        if (el && el.scrollHeight <= el.clientHeight + 15) {
                                                                            setScrolledToBottom(prev => ({ ...prev, [weekKey]: true }))
                                                                        }
                                                                    }}
                                                                    className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin border border-slate-100 rounded-xl p-2 bg-slate-50/50"
                                                                >
                                                                    {daysInWeek.map(dayNum => {
                                                                        const dayDetails = detallesSemana.filter((d: any) => d.dia === dayNum)
                                                                        const dayKey = `${weekKey}_dia_${dayNum}`
                                                                        const isDayOpen = Boolean(expandedDays[dayKey] ?? true)
                                                                        const alertCount = dayDetails.filter((d: any) => d.temperatura !== null && d.temperatura !== undefined && d.temperatura > 5.0).length

                                                                        return (
                                                                            <div key={dayNum} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setExpandedDays(prev => ({ ...prev, [dayKey]: !isDayOpen }))}
                                                                                    className="w-full px-3.5 py-2 bg-slate-100/90 hover:bg-slate-200/70 flex items-center justify-between transition-all cursor-pointer text-left border-b border-gray-100"
                                                                                >
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="font-extrabold text-xs text-slate-800">
                                                                                            📅 Día {dayNum} de {mesNombre}
                                                                                        </span>
                                                                                        <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-gray-200">
                                                                                            {dayDetails.length} lecturas
                                                                                        </span>
                                                                                        {alertCount > 0 && (
                                                                                            <span className="text-[10px] font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                                                                                ⚠️ {alertCount} fuera de rango
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <span className="text-[11px] font-black text-cyan-800">
                                                                                        {isDayOpen ? '▲ Contraer' : '▼ Expandir'}
                                                                                    </span>
                                                                                </button>

                                                                                {isDayOpen && (
                                                                                    <div className="p-3 bg-white">
                                                                                        <table className="w-full text-left text-[11px] border-collapse">
                                                                                            <thead>
                                                                                                <tr className="bg-slate-50 text-slate-600 border-b border-gray-100 font-extrabold text-[10px] uppercase">
                                                                                                    <th className="p-1.5">Producto / Evaluación</th>
                                                                                                    <th className="p-1.5">Cámara / Reefer</th>
                                                                                                    <th className="p-1.5 text-right">Temperatura (°C)</th>
                                                                                                </tr>
                                                                                            </thead>
                                                                                            <tbody className="divide-y divide-gray-100 font-medium">
                                                                                                {dayDetails.map((d: any, idx: number) => (
                                                                                                    <tr key={idx} className="hover:bg-slate-50/60">
                                                                                                        <td className="p-1.5 text-slate-800 font-semibold">{d.nombreProducto || d.tipoProducto || 'Sin especificar'}</td>
                                                                                                        <td className="p-1.5 text-slate-600">Cámara {d.numeroCamara ? d.numeroCamara.toString().padStart(2, '0') : '01'}</td>
                                                                                                        <td className="p-1.5 text-right font-black">
                                                                                                            {d.temperatura !== null && d.temperatura !== undefined ? (
                                                                                                                <span className={d.temperatura > 5.0 ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-black border border-rose-200' : 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-extrabold border border-emerald-200'}>
                                                                                                                    {d.temperatura}°C
                                                                                                                </span>
                                                                                                            ) : (
                                                                                                                <span className="text-slate-400 font-normal italic bg-slate-100 px-2 py-0.5 rounded">Sin producto / En blanco</span>
                                                                                                            )}
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                ))}
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })()}

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {/* Nivel 2 - Jefe de Bodega */}
                                                    <div className="p-4 bg-white rounded-xl border border-gray-200 space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-black text-xs text-cyan-900 uppercase">
                                                                🏢 Nivel 2: Verificación Jefe de Bodega
                                                            </span>
                                                        </div>

                                                        {firmadoBodega ? (
                                                            <div className="space-y-2 text-xs text-slate-700">
                                                                <div className="font-bold text-emerald-600">✅ Verificado por: {semEntry.usuarioJefeBodega}</div>
                                                                <div className="text-[11px] text-gray-500">📅 Fecha: {new Date(semEntry.fechaFirmaJefeBodega).toLocaleString('es-CL')}</div>
                                                                <FirmaCanvas
                                                                    value={semEntry.firmaJefeBodega || ''}
                                                                    onChange={() => {}}
                                                                    readOnly={true}
                                                                    height={85}
                                                                    label="Firma Registrada"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                {faltanFirmasDiarias ? (
                                                                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-bold space-y-1">
                                                                        <span>⚠️ Faltan verificaciones diarias de monitor para los días:</span>
                                                                        <strong className="block text-amber-950 font-black">
                                                                            {faltantes.map((d: any) => `Día ${d}`).join(', ')}
                                                                        </strong>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        {/* Checkbox de Verificación Obligatoria */}
                                                                        <label className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all ${
                                                                            !scrolledToBottom[weekKey]
                                                                                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                                                                                : 'bg-cyan-50/80 border-cyan-200 cursor-pointer hover:bg-cyan-100/50'
                                                                        }`}>
                                                                            <input
                                                                                type="checkbox"
                                                                                disabled={!scrolledToBottom[weekKey]}
                                                                                checked={Boolean(auditChecked[keyBodega])}
                                                                                onChange={(e) => setAuditChecked(prev => ({ ...prev, [keyBodega]: e.target.checked }))}
                                                                                className="mt-0.5 w-4 h-4 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500 cursor-pointer disabled:cursor-not-allowed"
                                                                            />
                                                                            <span className="text-xs font-extrabold text-cyan-950 leading-tight">
                                                                                He auditado y verificado todas las lecturas de temperatura registradas para esta semana.
                                                                            </span>
                                                                        </label>

                                                                        {!scrolledToBottom[weekKey] ? (
                                                                            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] font-extrabold flex items-center gap-1.5">
                                                                                <span>📜</span>
                                                                                <span>Debes desplazar la auditoría de lecturas (cuadro azul) hasta el final para habilitar el check.</span>
                                                                            </div>
                                                                        ) : !auditChecked[keyBodega] ? (
                                                                            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] font-extrabold">
                                                                                ⚠️ Audita las lecturas de la semana y marca la casilla superior para habilitar la firma digital.
                                                                            </div>
                                                                        ) : null}

                                                                        <FirmaCanvas
                                                                            value={semanalFirmaText[keyBodega] || ''}
                                                                            onChange={(val) => setSemanalFirmaText(prev => ({ ...prev, [keyBodega]: val }))}
                                                                            readOnly={!auditChecked[keyBodega]}
                                                                            height={100}
                                                                            label="Dibuja tu firma digital (Jefe de Bodega)"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleSignJefeBodega(selectedRecordForSign.idRegistro, mes, semana)}
                                                                            disabled={isSigningWeekly || !canSignJefeBodega || !semanalFirmaText[keyBodega] || !auditChecked[keyBodega]}
                                                                            className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        >
                                                                            {isSigningWeekly ? '⏳ Guardando...' : '🖊️ Firmar como Jefe de Bodega'}
                                                                        </button>
                                                                        {!canSignJefeBodega && (
                                                                            <span className="text-[10px] text-rose-500 font-bold block">
                                                                                ⚠️ Requiere rol de Jefe de Bodega o Administrador
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Nivel 3 - Jefe Zonal */}
                                                    <div className="p-4 bg-white rounded-xl border border-gray-200 space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-black text-xs text-purple-900 uppercase">
                                                                🗺️ Nivel 3: Verificación Jefe Zonal
                                                            </span>
                                                        </div>

                                                        {firmadoZonal ? (
                                                            <div className="space-y-2 text-xs text-slate-700">
                                                                <div className="font-bold text-purple-600">✅ Verificado por: {semEntry.usuarioJefeZonal}</div>
                                                                <div className="text-[11px] text-gray-500">📅 Fecha: {new Date(semEntry.fechaFirmaJefeZonal).toLocaleString('es-CL')}</div>
                                                                <FirmaCanvas
                                                                    value={semEntry.firmaJefeZonal || ''}
                                                                    onChange={() => {}}
                                                                    readOnly={true}
                                                                    height={85}
                                                                    label="Firma Registrada"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                {!firmadoBodega ? (
                                                                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-extrabold">
                                                                        ⚠️ Requiere primero la firma del Jefe de Bodega (Nivel 2) para esta semana.
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        {/* Checkbox de Verificación Obligatoria */}
                                                                        <label className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all ${
                                                                            !scrolledToBottom[weekKey]
                                                                                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                                                                                : 'bg-purple-50/80 border-purple-200 cursor-pointer hover:bg-purple-100/50'
                                                                        }`}>
                                                                            <input
                                                                                type="checkbox"
                                                                                disabled={!scrolledToBottom[weekKey]}
                                                                                checked={Boolean(auditChecked[keyZonal])}
                                                                                onChange={(e) => setAuditChecked(prev => ({ ...prev, [keyZonal]: e.target.checked }))}
                                                                                className="mt-0.5 w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer disabled:cursor-not-allowed"
                                                                            />
                                                                            <span className="text-xs font-extrabold text-purple-950 leading-tight">
                                                                                He auditado y verificado todas las lecturas de temperatura registradas para esta semana.
                                                                            </span>
                                                                        </label>

                                                                        {!scrolledToBottom[weekKey] ? (
                                                                            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] font-extrabold flex items-center gap-1.5">
                                                                                <span>📜</span>
                                                                                <span>Debes desplazar la auditoría de lecturas (cuadro azul) hasta el final para habilitar el check.</span>
                                                                            </div>
                                                                        ) : !auditChecked[keyZonal] ? (
                                                                            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] font-extrabold">
                                                                                ⚠️ Audita las lecturas de la semana y marca la casilla superior para habilitar la firma digital.
                                                                            </div>
                                                                        ) : null}

                                                                        <FirmaCanvas
                                                                            value={semanalFirmaText[keyZonal] || ''}
                                                                            onChange={(val) => setSemanalFirmaText(prev => ({ ...prev, [keyZonal]: val }))}
                                                                            readOnly={!auditChecked[keyZonal]}
                                                                            height={100}
                                                                            label="Dibuja tu firma digital (Jefe Zonal)"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleSignJefeZonal(selectedRecordForSign.idRegistro, mes, semana)}
                                                                            disabled={isSigningWeekly || !canSignJefeZonal || !semanalFirmaText[keyZonal] || !auditChecked[keyZonal]}
                                                                            className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        >
                                                                            {isSigningWeekly ? '⏳ Guardando...' : '🖊️ Firmar como Jefe Zonal'}
                                                                        </button>
                                                                        {!canSignJefeZonal && (
                                                                            <span className="text-[10px] text-rose-500 font-bold block">
                                                                                ⚠️ Requiere rol de Jefe Zonal o Administrador
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>

                            <div className="flex justify-end pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setSelectedRecordForSign(null)}
                                    className="px-5 py-2.5 bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
