'use client'

import React, { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import {
    ControlCargasDashboardData,
    ModuloCargaEstado,
    EstadoCarga,
    RbdCoverageResponse,
    RbdCoverageItem,
    ProgramasSinHomologarResponse,
    ProgramaSinHomologarItem,
    getControlCargasMasivasData,
    getRbdCoverageData,
    getProgramasSinHomologarData
} from './actions'
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    ExternalLink,
    Filter,
    RefreshCw,
    Shield,
    UploadCloud,
    Calendar,
    Search,
    Building2,
    Users,
    FileSpreadsheet,
    UserCheck,
    UserX,
    ShieldAlert,
    ChevronRight,
    ChevronLeft,
    ArrowRight,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
    Sparkles,
    Tag,
    Layers
} from 'lucide-react'

interface Props {
    initialData: ControlCargasDashboardData
    currentUser: {
        username: string
        name?: string | null
        roleName?: string | null
    }
}

const MESES_LABEL = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function ControlCargasClient({ initialData, currentUser }: Props) {
    const [data, setData] = useState<ControlCargasDashboardData>(initialData)
    const [selectedAnio, setSelectedAnio] = useState<number>(initialData.anioActual)
    const [selectedMes, setSelectedMes] = useState<number>(initialData.mesActual)
    const [areaFiltro, setAreaFiltro] = useState<'TODAS' | 'RRHH' | 'PREVENCION' | 'OPERACIONES'>('TODAS')
    const [estadoFiltro, setEstadoFiltro] = useState<'TODOS' | 'SOLO_PENDIENTES' | 'SOLO_CARGADOS'>('TODOS')
    const [busqueda, setBusqueda] = useState<string>('')
    const [vistaModo, setVistaModo] = useState<'AMBOS' | 'ACTUAL' | 'PROXIMO'>('AMBOS')
    const [isPending, startTransition] = useTransition()

    // Pestaña activa: Cargas Masivas vs Auditoría de RBDs vs Programas sin Homologar
    const [tabActiva, setTabActiva] = useState<'CARGAS' | 'RBDS' | 'HOMOLOGACION'>('CARGAS')

    // Estado para Programas sin Homologar
    const [programasHomologacionData, setProgramasHomologacionData] = useState<ProgramasSinHomologarResponse | undefined>(initialData.programasSinHomologar)
    const [busquedaSinHomologar, setBusquedaSinHomologar] = useState<string>('')
    const [paginaSinHomologar, setPaginaSinHomologar] = useState<number>(1)

    // Estado para Auditoría de RBDs
    const [rbdData, setRbdData] = useState<RbdCoverageResponse | undefined>(initialData.rbdCoverage)
    const [selectedRole, setSelectedRole] = useState<string>('TODOS')
    const [selectedSucursalRbd, setSelectedSucursalRbd] = useState<string>('TODAS')
    const [soloSinAsignar, setSoloSinAsignar] = useState<boolean>(false)
    const [busquedaRbd, setBusquedaRbd] = useState<string>('')
    const [isPendingRbd, startTransitionRbd] = useTransition()

    // Ordenamiento y Paginación de RBDs
    type SortField = 'rbd' | 'nombre' | 'comuna' | 'sucursal' | 'estado' | 'usuarios'
    type SortOrder = 'asc' | 'desc'
    const [sortField, setSortField] = useState<SortField>('estado')
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
    const [paginaActual, setPaginaActual] = useState<number>(1)
    const registrosPorPagina = 10

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
        setPaginaActual(1)
    }

    // Recargar datos al cambiar mes/año
    const handlePeriodoChange = (newYear: number, newMonth: number) => {
        setSelectedAnio(newYear)
        setSelectedMes(newMonth)
        startTransition(async () => {
            try {
                const fresh = await getControlCargasMasivasData({ anio: newYear, mes: newMonth })
                setData(fresh)
                if (fresh.rbdCoverage) {
                    setRbdData(fresh.rbdCoverage)
                }
                if (fresh.programasSinHomologar) {
                    setProgramasHomologacionData(fresh.programasSinHomologar)
                }
            } catch (err) {
                console.error('Error al actualizar control de cargas:', err)
            }
        })
    }

    const handleRefresh = () => {
        if (tabActiva === 'CARGAS') {
            handlePeriodoChange(selectedAnio, selectedMes)
        } else if (tabActiva === 'RBDS') {
            handleRbdFilterChange(selectedRole, selectedSucursalRbd)
        } else {
            startTransition(async () => {
                try {
                    const freshHom = await getProgramasSinHomologarData()
                    setProgramasHomologacionData(freshHom)
                } catch (err) {
                    console.error('Error refrescando programas sin homologar:', err)
                }
            })
        }
    }

    // Recargar auditoría de RBDs al cambiar rol o sucursal
    const handleRbdFilterChange = (newRoleId: string, newSucursal: string) => {
        setSelectedRole(newRoleId)
        setSelectedSucursalRbd(newSucursal)
        setPaginaActual(1)
        startTransitionRbd(async () => {
            try {
                const fresh = await getRbdCoverageData({
                    roleId: newRoleId,
                    sucursal: newSucursal
                })
                setRbdData(fresh)
            } catch (err) {
                console.error('Error al consultar cobertura de RBDs:', err)
            }
        })
    }

    // Filtrado de módulos de cargas
    const modulosFiltrados = data.modulos.filter(m => {
        if (areaFiltro !== 'TODAS' && m.area !== areaFiltro) {
            return false
        }
        if (estadoFiltro === 'SOLO_PENDIENTES') {
            const isPendiente = vistaModo === 'ACTUAL'
                ? m.mesActual.estado === 'PENDIENTE'
                : vistaModo === 'PROXIMO'
                ? m.proximoMes.estado === 'PENDIENTE'
                : (m.mesActual.estado === 'PENDIENTE' || m.proximoMes.estado === 'PENDIENTE')
            if (!isPendiente) return false
        } else if (estadoFiltro === 'SOLO_CARGADOS') {
            const isCargado = vistaModo === 'ACTUAL'
                ? m.mesActual.estado === 'CARGADO'
                : vistaModo === 'PROXIMO'
                ? m.proximoMes.estado === 'CARGADO'
                : (m.mesActual.estado === 'CARGADO' && m.proximoMes.estado === 'CARGADO')
            if (!isCargado) return false
        }
        if (busqueda.trim() !== '') {
            const term = busqueda.toLowerCase().trim()
            const matchNombre = m.nombre.toLowerCase().includes(term)
            const matchDesc = m.descripcion.toLowerCase().includes(term)
            const matchArea = m.area.toLowerCase().includes(term)
            if (!matchNombre && !matchDesc && !matchArea) return false
        }
        return true
    })

    // Filtrado de RBDs
    const rbdsFiltrados = (rbdData?.rbds || []).filter(r => {
        if (soloSinAsignar && r.asignadoRolActual) return false
        if (busquedaRbd.trim() !== '') {
            const term = busquedaRbd.toLowerCase().trim()
            const matchRbd = String(r.rbd).includes(term)
            const matchNombre = r.nombreEstablecimiento.toLowerCase().includes(term)
            const matchComuna = r.comuna.toLowerCase().includes(term)
            const matchSuc = r.sucursal.toLowerCase().includes(term)
            const matchUser = r.usuariosRolActual.some(u => 
                u.name.toLowerCase().includes(term) || u.username.toLowerCase().includes(term)
            )
            const matchOtros = r.otrosRolesAsignados.some(o => 
                o.rol.toLowerCase().includes(term) || o.usuarios.some(u => u.toLowerCase().includes(term))
            )
            if (!matchRbd && !matchNombre && !matchComuna && !matchSuc && !matchUser && !matchOtros) return false
        }
        return true
    })

    // Ordenamiento dinámico de RBDs
    const rbdsOrdenados = [...rbdsFiltrados].sort((a, b) => {
        let comparison = 0
        switch (sortField) {
            case 'rbd':
                comparison = a.rbd - b.rbd
                break
            case 'nombre':
                comparison = a.nombreEstablecimiento.localeCompare(b.nombreEstablecimiento, 'es', { sensitivity: 'base' })
                break
            case 'comuna':
                comparison = a.comuna.localeCompare(b.comuna, 'es', { sensitivity: 'base' })
                break
            case 'sucursal':
                comparison = a.sucursal.localeCompare(b.sucursal, 'es', { sensitivity: 'base' })
                break
            case 'estado':
                comparison = a.asignadoRolActual === b.asignadoRolActual ? 0 : a.asignadoRolActual ? 1 : -1
                if (comparison === 0) comparison = a.rbd - b.rbd
                break
            case 'usuarios':
                comparison = a.usuariosRolActual.length - b.usuariosRolActual.length
                break
            default:
                comparison = 0
        }
        return sortOrder === 'asc' ? comparison : -comparison
    })

    // Paginación (10 registros por hoja)
    const totalPaginas = Math.ceil(rbdsOrdenados.length / registrosPorPagina) || 1
    const paginaValida = Math.min(Math.max(1, paginaActual), totalPaginas)
    const indiceInicio = (paginaValida - 1) * registrosPorPagina
    const indiceFin = indiceInicio + registrosPorPagina
    const rbdsPaginados = rbdsOrdenados.slice(indiceInicio, indiceFin)

    // Helper de renderizado de Badge de Estado
    const renderEstadoBadge = (estado: EstadoCarga, isActual: boolean) => {
        if (estado === 'CARGADO') {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cargado</span>
                </span>
            )
        }
        if (estado === 'PARCIAL') {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Carga Parcial</span>
                </span>
            )
        }
        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
                isActual
                    ? 'bg-rose-50 text-rose-700 border border-rose-300 ring-2 ring-rose-400/20 animate-pulse'
                    : 'bg-slate-100 text-slate-600 border border-slate-300'
            }`}>
                <AlertCircle className={`w-3.5 h-3.5 ${isActual ? 'text-rose-600' : 'text-slate-500'}`} />
                <span>{isActual ? 'Pendiente (Urgente)' : 'Pendiente (Próx. Mes)'}</span>
            </span>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 lg:p-8 space-y-6">
            {/* ENCABEZADO CORPORATIVO HENDAYA */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white flex items-center justify-center text-3xl shadow-md shadow-sky-500/20 shrink-0">
                        {tabActiva === 'CARGAS' ? '📋' : tabActiva === 'RBDS' ? '🏫' : '🏷️'}
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
                                {tabActiva === 'CARGAS'
                                    ? 'Control de Cargas Masivas'
                                    : tabActiva === 'RBDS'
                                    ? 'Auditoría de RBDs sin Usuarios'
                                    : 'Programas y Servicios sin Homologar'}
                            </h1>
                            <span className="text-[11px] font-black tracking-wider px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-300">
                                HENDAYA
                            </span>
                            <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200">
                                Tableros y Avances
                            </span>
                            <span className="text-xs px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700 font-black border border-purple-200">
                                Solo Administrador
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-slate-500 mt-1">
                            {tabActiva === 'CARGAS'
                                ? `Monitoreo de cumplimiento de planillas masivas: ${data.mesActualNombre} (Mes actual) y ${data.mesProximoNombre} (Próximo mes).`
                                : tabActiva === 'RBDS'
                                ? `Detección en tiempo real de colegios sin usuarios asignados filtrado por rol y sucursal territorial.`
                                : `Detección preventiva en PMPA de programas y servicios que aún no cuentan con código homologado para auditorías.`}
                        </p>
                    </div>
                </div>

                {/* CONTROLES DERECHA */}
                <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
                    {/* Badge de seguridad */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                        <Shield className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{data.permisos.isRestrictedByRbd ? `Restringido (${data.permisos.assignedRbdsCount} RBDs)` : 'Acceso Administrador Global'}</span>
                    </div>

                    {/* Selector de Mes para Cargas */}
                    {tabActiva === 'CARGAS' && (
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-slate-500 font-bold">Mes Base:</span>
                            <select
                                value={selectedMes}
                                onChange={(e) => handlePeriodoChange(selectedAnio, parseInt(e.target.value, 10))}
                                disabled={isPending}
                                className="bg-transparent font-black text-slate-800 focus:outline-none cursor-pointer"
                            >
                                {MESES_LABEL.map((m, i) => (
                                    <option key={i + 1} value={i + 1}>{m}</option>
                                ))}
                            </select>
                            <select
                                value={selectedAnio}
                                onChange={(e) => handlePeriodoChange(parseInt(e.target.value, 10), selectedMes)}
                                disabled={isPending}
                                className="bg-transparent font-black text-slate-800 focus:outline-none cursor-pointer border-l border-slate-200 pl-2"
                            >
                                {[2024, 2025, 2026, 2027].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Botón Refrescar */}
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isPending || isPendingRbd}
                        title="Actualizar datos en tiempo real"
                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${(isPending || isPendingRbd) ? 'animate-spin text-sky-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* CONMUTADOR DE PESTAÑAS PRINCIPALES */}
            <div className="flex items-center gap-3 border-b border-slate-200/80 pb-1">
                <button
                    type="button"
                    onClick={() => setTabActiva('CARGAS')}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs sm:text-sm font-black transition-all ${
                        tabActiva === 'CARGAS'
                            ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/20'
                            : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                    }`}
                >
                    <UploadCloud className="w-4 h-4" />
                    <span>Control de Cargas Masivas</span>
                    {data.resumen.pendientesActual > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            tabActiva === 'CARGAS' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                        }`}>
                            {data.resumen.pendientesActual} urgentes
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setTabActiva('RBDS')}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs sm:text-sm font-black transition-all ${
                        tabActiva === 'RBDS'
                            ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/20'
                            : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                    }`}
                >
                    <Building2 className="w-4 h-4" />
                    <span>Auditoría de RBDs sin Usuarios</span>
                    {rbdData && rbdData.colegiosPendientes > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            tabActiva === 'RBDS' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                        }`}>
                            {rbdData.colegiosPendientes} sin asignar
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setTabActiva('HOMOLOGACION')}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs sm:text-sm font-black transition-all ${
                        tabActiva === 'HOMOLOGACION'
                            ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/20'
                            : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                    }`}
                >
                    <Tag className="w-4 h-4" />
                    <span>Programas sin Homologar</span>
                    {programasHomologacionData && programasHomologacionData.totalSinHomologar > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            tabActiva === 'HOMOLOGACION' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                        }`}>
                            {programasHomologacionData.totalSinHomologar} pendientes
                        </span>
                    )}
                </button>
            </div>

            {/* CONTENIDO PESTAÑA 1: CARGAS MASIVAS */}
            {tabActiva === 'CARGAS' && (
                <div className="space-y-6">
                    {/* SECCIÓN KPI RESUMEN CARGAS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {/* KPI 1: CUMPLIMIENTO MES ACTUAL */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                        Mes Actual: {data.mesActualNombre}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-50 text-sky-700 border border-sky-200">
                                        Operativo
                                    </span>
                                </div>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-slate-900">
                                        {data.resumen.porcentajeActual}%
                                    </span>
                                    <span className="text-xs font-bold text-slate-500">
                                        ({data.resumen.cargadosActual} de {data.resumen.totalModulos} cargados)
                                    </span>
                                </div>
                            </div>
                            <div className="mt-4 space-y-1.5">
                                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            data.resumen.porcentajeActual === 100
                                                ? 'bg-emerald-500'
                                                : data.resumen.porcentajeActual >= 50
                                                ? 'bg-sky-500'
                                                : 'bg-rose-500'
                                        }`}
                                        style={{ width: `${data.resumen.porcentajeActual}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                                    <span>0%</span>
                                    <span>Meta: 100% Cargas</span>
                                </div>
                            </div>
                        </div>

                        {/* KPI 2: PENDIENTES URGENTES */}
                        <div className={`border rounded-2xl p-5 shadow-xs flex flex-col justify-between ${
                            data.resumen.pendientesActual > 0
                                ? 'bg-rose-50/70 border-rose-200 ring-2 ring-rose-400/20'
                                : 'bg-white border-slate-200/90'
                        }`}>
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className={`text-[11px] font-black uppercase tracking-wider ${
                                        data.resumen.pendientesActual > 0 ? 'text-rose-700' : 'text-slate-500'
                                    }`}>
                                        Pendientes Urgentes ({data.mesActualNombre})
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                        data.resumen.pendientesActual > 0
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    }`}>
                                        {data.resumen.pendientesActual > 0 ? 'Alerta' : 'Al Día'}
                                    </span>
                                </div>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span className={`text-3xl font-black ${
                                        data.resumen.pendientesActual > 0 ? 'text-rose-700' : 'text-slate-900'
                                    }`}>
                                        {data.resumen.pendientesActual}
                                    </span>
                                    <span className="text-xs font-bold text-slate-500">
                                        planillas sin cargar
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-4 border-t border-slate-200/60 pt-2">
                                {data.resumen.pendientesActual > 0
                                    ? 'Requiere carga masiva inmediata para evitar vacíos en tableros.'
                                    : 'Excelente: todas las planillas del mes actual están procesadas.'}
                            </p>
                        </div>

                        {/* KPI 3: PRÓXIMO MES */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                        Próximo Mes: {data.mesProximoNombre}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                                        Anticipado
                                    </span>
                                </div>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-slate-900">
                                        {data.resumen.porcentajeProximo}%
                                    </span>
                                    <span className="text-xs font-bold text-slate-500">
                                        ({data.resumen.cargadosProximo} de {data.resumen.totalModulos} listos)
                                    </span>
                                </div>
                            </div>
                            <div className="mt-4 space-y-1.5">
                                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-purple-500 transition-all duration-500"
                                        style={{ width: `${data.resumen.porcentajeProximo}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                                    <span>Planificación preventiva</span>
                                    <span>{data.resumen.porcentajeProximo}%</span>
                                </div>
                            </div>
                        </div>

                        {/* KPI 4: PENDIENTES PRÓXIMO MES */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                        Pendientes ({data.mesProximoNombre})
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                        Planificación
                                    </span>
                                </div>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-amber-800">
                                        {data.resumen.pendientesProximo}
                                    </span>
                                    <span className="text-xs font-bold text-slate-500">
                                        cargas por adelantar
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-4 border-t border-slate-200/60 pt-2">
                                Planillas a recopilar antes del cierre de fin de mes para continuidad operativa.
                            </p>
                        </div>
                    </div>

                    {/* BARRA DE FILTROS Y MODOS DE VISTA */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                        {/* FILTROS IZQUIERDA: ÁREAS Y ESTADOS */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mr-2">
                                <Filter className="w-3.5 h-3.5" />
                                <span>Área:</span>
                            </div>
                            {(['TODAS', 'RRHH', 'PREVENCION', 'OPERACIONES'] as const).map(area => (
                                <button
                                    key={area}
                                    type="button"
                                    onClick={() => setAreaFiltro(area)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        areaFiltro === area
                                            ? 'bg-sky-600 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                                    }`}
                                >
                                    {area === 'TODAS' ? 'Todas las Áreas' : area === 'PREVENCION' ? 'Prevención Riesgos' : area}
                                </button>
                            ))}

                            <span className="text-slate-300 mx-1 hidden sm:inline">|</span>

                            <button
                                type="button"
                                onClick={() => setEstadoFiltro(estadoFiltro === 'SOLO_PENDIENTES' ? 'TODOS' : 'SOLO_PENDIENTES')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    estadoFiltro === 'SOLO_PENDIENTES'
                                        ? 'bg-rose-600 text-white shadow-xs'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                                }`}
                            >
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>Solo Pendientes</span>
                            </button>
                        </div>

                        {/* FILTROS DERECHA: BÚSQUEDA Y VISTA */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    placeholder="Buscar proceso..."
                                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                                />
                            </div>

                            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
                                <button
                                    type="button"
                                    onClick={() => setVistaModo('AMBOS')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                        vistaModo === 'AMBOS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Ambos Meses
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setVistaModo('ACTUAL')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                        vistaModo === 'ACTUAL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Solo Mes Actual
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setVistaModo('PROXIMO')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                        vistaModo === 'PROXIMO' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Solo Próximo Mes
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* TABLA DE CONTROL DE CARGAS MASIVAS */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div>
                                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                    <span>📊</span>
                                    <span>Matriz de Seguimiento de Cargas Masivas</span>
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Mostrando {modulosFiltrados.length} de {data.modulos.length} módulos monitoreados.
                                </p>
                            </div>

                            <div className="text-xs text-slate-400 font-mono">
                                Última comprobación: {new Date(data.fechaConsulta).toLocaleTimeString('es-CL')}
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                                    <tr>
                                        <th className="py-3 px-4">Proceso / Módulo Masivo</th>
                                        <th className="py-3 px-4 text-center">Área</th>
                                        {(vistaModo === 'AMBOS' || vistaModo === 'ACTUAL') && (
                                            <th className="py-3 px-4 text-center bg-sky-50/50 text-sky-900">
                                                Mes Actual ({data.mesActualNombre})
                                            </th>
                                        )}
                                        {(vistaModo === 'AMBOS' || vistaModo === 'PROXIMO') && (
                                            <th className="py-3 px-4 text-center bg-purple-50/50 text-purple-900">
                                                Próximo Mes ({data.mesProximoNombre})
                                            </th>
                                        )}
                                        <th className="py-3 px-4 text-center">Acción Directa</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {modulosFiltrados.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center text-slate-400">
                                                No se encontraron procesos masivos con los filtros aplicados.
                                            </td>
                                        </tr>
                                    ) : (
                                        modulosFiltrados.map((mod) => {
                                            const areaBadgeColor = mod.area === 'RRHH'
                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                : mod.area === 'PREVENCION'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-amber-50 text-amber-700 border-amber-200'

                                            return (
                                                <tr key={mod.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-4 px-4 max-w-sm">
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 text-base shadow-xs mt-0.5">
                                                                <FileSpreadsheet className="w-4 h-4 text-sky-700" />
                                                            </div>
                                                            <div>
                                                                <span className="font-black text-slate-900 text-sm block">
                                                                    {mod.nombre}
                                                                </span>
                                                                <span className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                                                                    {mod.descripcion}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="py-4 px-4 text-center">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${areaBadgeColor}`}>
                                                            {mod.area}
                                                        </span>
                                                    </td>

                                                    {(vistaModo === 'AMBOS' || vistaModo === 'ACTUAL') && (
                                                        <td className="py-4 px-4 text-center bg-sky-50/20">
                                                            <div className="flex flex-col items-center gap-1.5">
                                                                {renderEstadoBadge(mod.mesActual.estado, true)}
                                                                <span className="text-[11px] font-bold text-slate-700">
                                                                    {mod.mesActual.observacion}
                                                                </span>
                                                                {mod.mesActual.fechaUltimaCarga && (
                                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                                        Última: {new Date(mod.mesActual.fechaUltimaCarga).toLocaleDateString('es-CL')}
                                                                        {mod.mesActual.usuarioCarga && ` por ${mod.mesActual.usuarioCarga}`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}

                                                    {(vistaModo === 'AMBOS' || vistaModo === 'PROXIMO') && (
                                                        <td className="py-4 px-4 text-center bg-purple-50/20">
                                                            <div className="flex flex-col items-center gap-1.5">
                                                                {renderEstadoBadge(mod.proximoMes.estado, false)}
                                                                <span className="text-[11px] font-bold text-slate-700">
                                                                    {mod.proximoMes.observacion}
                                                                </span>
                                                                {mod.proximoMes.fechaUltimaCarga && (
                                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                                        Última: {new Date(mod.proximoMes.fechaUltimaCarga).toLocaleDateString('es-CL')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}

                                                    <td className="py-4 px-4 text-center">
                                                        <a
                                                            href={mod.enlaceCarga}
                                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-sm shadow-sky-200 transition-all hover:scale-105"
                                                            title={`Ir a cargar ${mod.nombre}`}
                                                        >
                                                            <UploadCloud className="w-3.5 h-3.5" />
                                                            <span>Cargar</span>
                                                            <ExternalLink className="w-3 h-3 opacity-70 ml-0.5" />
                                                        </a>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* GUÍA OPERATIVA */}
                    <div className="bg-slate-100/80 border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-sky-600 flex items-center justify-center text-2xl shadow-xs shrink-0">
                                💡
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900">
                                    Protocolo de Carga Masiva Anticipada (Hendaya)
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
                                    Para asegurar la precisión de los tableros de asistencia, minutas y cálculo de siniestralidad, se recomienda cargar las planillas de <strong>RRHH y Prevención</strong> a más tardar el <strong>día 5 de cada mes</strong>, y adelantar la planificación de <strong>Raciones PMPA y Minutas</strong> durante los últimos 5 días del mes previo.
                                </p>
                            </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                            <a
                                href="/dashboard/tablero/monitoreo-avances"
                                className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors shadow-xs"
                            >
                                Monitoreo Avances
                            </a>
                            <a
                                href="/dashboard/tablero/monitoreo-rrhh"
                                className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors shadow-xs"
                            >
                                Monitoreo RRHH
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENIDO PESTAÑA 2: AUDITORÍA DE RBDS SIN USUARIOS */}
            {tabActiva === 'RBDS' && (
                <div className="space-y-6">
                    {/* SECCIÓN 1: TARJETAS KPI DE COBERTURA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {/* KPI 1: % COBERTURA */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                        Cobertura de Colegios
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-50 text-sky-700 border border-sky-200">
                                        {rbdData?.selectedRoleName || 'Todos'}
                                    </span>
                                </div>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-slate-900">
                                        {rbdData?.porcentajeCobertura ?? 0}%
                                    </span>
                                    <span className="text-xs font-bold text-slate-500">
                                        ({rbdData?.colegiosAsignados ?? 0} de {rbdData?.totalColegios ?? 0})
                                    </span>
                                </div>
                            </div>
                            <div className="mt-4 space-y-1.5">
                                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            (rbdData?.porcentajeCobertura ?? 0) === 100
                                                ? 'bg-emerald-500'
                                                : (rbdData?.porcentajeCobertura ?? 0) >= 70
                                                ? 'bg-sky-500'
                                                : 'bg-rose-500'
                                        }`}
                                        style={{ width: `${rbdData?.porcentajeCobertura ?? 0}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                                    <span>0%</span>
                                    <span>Meta: 100% Asignación</span>
                                </div>
                            </div>
                        </div>

                        {/* KPI 2: TOTAL COLEGIOS */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                        Total Establecimientos (RBDs)
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                                        {rbdData?.selectedSucursal === 'TODAS' ? 'Nacional' : rbdData?.selectedSucursal}
                                    </span>
                                </div>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-slate-900">
                                        {rbdData?.totalColegios ?? 0}
                                    </span>
                                    <span className="text-xs font-bold text-slate-500">
                                        colegios en catálogo
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-4 border-t border-slate-200/60 pt-2">
                                Padrón activo de establecimientos bajo gestión Hendaya.
                            </p>
                        </div>

                        {/* KPI 3: COLEGIOS ASIGNADOS */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                                        RBDs con Usuario Asignado
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Cubiertos
                                    </span>
                                </div>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-emerald-700">
                                        {rbdData?.colegiosAsignados ?? 0}
                                    </span>
                                    <span className="text-xs font-bold text-slate-500">
                                        colegios con responsable
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-4 border-t border-slate-200/60 pt-2">
                                Poseen al menos un usuario activo del rol seleccionado.
                            </p>
                        </div>

                        {/* KPI 4: COLEGIOS SIN ASIGNAR (ALERTA) */}
                        <div className={`border rounded-2xl p-5 shadow-xs flex flex-col justify-between ${
                            (rbdData?.colegiosPendientes ?? 0) > 0
                                ? 'bg-rose-50/70 border-rose-200 ring-2 ring-rose-400/20'
                                : 'bg-white border-slate-200/90'
                        }`}>
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className={`text-[11px] font-black uppercase tracking-wider ${
                                        (rbdData?.colegiosPendientes ?? 0) > 0 ? 'text-rose-700' : 'text-slate-500'
                                    }`}>
                                        RBDs sin Asignar ({rbdData?.selectedRoleName || 'Rol'})
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                        (rbdData?.colegiosPendientes ?? 0) > 0
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    }`}>
                                        {(rbdData?.colegiosPendientes ?? 0) > 0 ? 'Falta Asignar' : 'Completo'}
                                    </span>
                                </div>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span className={`text-3xl font-black ${
                                        (rbdData?.colegiosPendientes ?? 0) > 0 ? 'text-rose-700' : 'text-slate-900'
                                    }`}>
                                        {rbdData?.colegiosPendientes ?? 0}
                                    </span>
                                    <span className="text-xs font-bold text-slate-500">
                                        colegios desatendidos
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-4 border-t border-slate-200/60 pt-2">
                                {(rbdData?.colegiosPendientes ?? 0) > 0
                                    ? 'Requieren vincularse en el mantenedor para auditar o cargar información.'
                                    : 'Excelente: cobertura del 100% para este rol.'}
                            </p>
                        </div>
                    </div>

                    {/* BARRA DE FILTROS DE RBDS */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                        {/* SELECTOR DE ROL Y SUCURSAL */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Selector de Rol */}
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                                <Users className="w-3.5 h-3.5 text-sky-600" />
                                <span className="text-slate-500 font-bold">Filtrar por Rol:</span>
                                <select
                                    value={selectedRole}
                                    onChange={(e) => handleRbdFilterChange(e.target.value, selectedSucursalRbd)}
                                    disabled={isPendingRbd}
                                    className="bg-transparent font-black text-slate-800 focus:outline-none cursor-pointer max-w-[220px]"
                                >
                                    <option value="TODOS">Todos los Roles (Cualquier Usuario)</option>
                                    {(rbdData?.roles || []).map(r => (
                                        <option key={r.id} value={r.id}>
                                            {r.name} ({r.totalUsuarios} usuarios)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Selector de Sucursal */}
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-slate-500 font-bold">Sucursal:</span>
                                <select
                                    value={selectedSucursalRbd}
                                    onChange={(e) => handleRbdFilterChange(selectedRole, e.target.value)}
                                    disabled={isPendingRbd}
                                    className="bg-transparent font-black text-slate-800 focus:outline-none cursor-pointer"
                                >
                                    <option value="TODAS">Todas las Sucursales</option>
                                    {(rbdData?.sucursales || []).map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Toggle Solo Sin Asignar */}
                            <button
                                type="button"
                                onClick={() => {
                                    setSoloSinAsignar(!soloSinAsignar)
                                    setPaginaActual(1)
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    soloSinAsignar
                                        ? 'bg-rose-600 text-white shadow-xs'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                                }`}
                            >
                                <UserX className="w-3.5 h-3.5" />
                                <span>Solo Colegios Sin Asignar</span>
                            </button>
                        </div>

                        {/* BUSCADOR DE RBDS */}
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1 sm:w-72">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={busquedaRbd}
                                    onChange={(e) => {
                                        setBusquedaRbd(e.target.value)
                                        setPaginaActual(1)
                                    }}
                                    placeholder="Buscar por RBD, nombre, comuna..."
                                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                                />
                            </div>

                            {/* Enlace rápido al Mantenedor de Asociar RBD */}
                            <a
                                href="/dashboard/mantenedor/actas-supervision/asociar-rbd"
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 transition-colors shrink-0 shadow-xs"
                                title="Abrir Mantenedor de Asociación de RBDs"
                            >
                                <span>Mantenedor</span>
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>

                    {/* TABLA DE AUDITORÍA DE RBDS */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div>
                                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                    <span>🏫</span>
                                    <span>Padrón de Colegios y Asignación de Roles</span>
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Evaluando rol: <strong className="text-sky-700">{rbdData?.selectedRoleName}</strong> en <strong className="text-slate-800">{rbdData?.selectedSucursal === 'TODAS' ? 'Todas las Sucursales' : rbdData?.selectedSucursal}</strong>. Total encontrados: <strong className="text-slate-900">{rbdsOrdenados.length}</strong> establecimientos.
                                </p>
                            </div>

                            <div className="text-xs text-slate-400 font-mono">
                                Colegios sin asignar: <strong className="text-rose-600">{rbdData?.colegiosPendientes ?? 0}</strong>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                                    <tr>
                                        {/* COL 1: RBD */}
                                        <th
                                            onClick={() => handleSort('rbd')}
                                            className="py-3 px-4 text-center cursor-pointer select-none hover:bg-slate-200/70 transition-colors group"
                                            title="Ordenar por código RBD"
                                        >
                                            <div className="flex items-center justify-center gap-1.5">
                                                <span>RBD</span>
                                                {sortField === 'rbd' ? (
                                                    sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-600" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
                                                ) : (
                                                    <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                )}
                                            </div>
                                        </th>

                                        {/* COL 2: ESTABLECIMIENTO */}
                                        <th
                                            onClick={() => handleSort('nombre')}
                                            className="py-3 px-4 cursor-pointer select-none hover:bg-slate-200/70 transition-colors group"
                                            title="Ordenar por nombre del colegio"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>Establecimiento Educacional</span>
                                                {sortField === 'nombre' ? (
                                                    sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-600" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
                                                ) : (
                                                    <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                )}
                                            </div>
                                        </th>

                                        {/* COL 3: COMUNA Y SUCURSAL */}
                                        <th
                                            onClick={() => handleSort('comuna')}
                                            className="py-3 px-4 cursor-pointer select-none hover:bg-slate-200/70 transition-colors group"
                                            title="Ordenar por comuna o sucursal"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>Comuna / Sucursal</span>
                                                {sortField === 'comuna' ? (
                                                    sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-600" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
                                                ) : (
                                                    <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                )}
                                            </div>
                                        </th>

                                        {/* COL 4: ESTADO */}
                                        <th
                                            onClick={() => handleSort('estado')}
                                            className="py-3 px-4 text-center cursor-pointer select-none hover:bg-slate-200/70 transition-colors group"
                                            title="Ordenar por estado de asignación"
                                        >
                                            <div className="flex items-center justify-center gap-1.5">
                                                <span>Estado Cobertura</span>
                                                {sortField === 'estado' ? (
                                                    sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-600" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
                                                ) : (
                                                    <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                )}
                                            </div>
                                        </th>

                                        {/* COL 5: USUARIOS ASIGNADOS */}
                                        <th
                                            onClick={() => handleSort('usuarios')}
                                            className="py-3 px-4 cursor-pointer select-none hover:bg-slate-200/70 transition-colors group"
                                            title="Ordenar por cantidad de usuarios asignados"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>Usuarios Asignados ({rbdData?.selectedRoleName || 'Rol'})</span>
                                                {sortField === 'usuarios' ? (
                                                    sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-600" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
                                                ) : (
                                                    <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                )}
                                            </div>
                                        </th>

                                        {/* COL 6: OTROS ROLES */}
                                        <th className="py-3 px-4">Otros Roles Asignados</th>

                                        {/* COL 7: ACCIÓN */}
                                        <th className="py-3 px-4 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {rbdsPaginados.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-slate-400">
                                                No se encontraron colegios con los filtros seleccionados.
                                            </td>
                                        </tr>
                                    ) : (
                                        rbdsPaginados.map((item) => (
                                            <tr key={item.rbd} className="hover:bg-slate-50/80 transition-colors">
                                                {/* COL 1: RBD */}
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className="font-mono font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg text-xs">
                                                        {item.rbd}
                                                    </span>
                                                </td>

                                                {/* COL 2: ESTABLECIMIENTO */}
                                                <td className="py-3.5 px-4 max-w-xs">
                                                    <span className="font-bold text-slate-900 block truncate" title={item.nombreEstablecimiento}>
                                                        {item.nombreEstablecimiento}
                                                    </span>
                                                </td>

                                                {/* COL 3: COMUNA Y SUCURSAL */}
                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    <span className="text-slate-700 font-medium block">
                                                        {item.comuna}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                        {item.sucursal}
                                                    </span>
                                                </td>

                                                {/* COL 4: ESTADO COBERTURA */}
                                                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                                    {item.asignadoRolActual ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                                            <span>Asignado</span>
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-300 animate-pulse">
                                                            <UserX className="w-3.5 h-3.5 text-rose-600" />
                                                            <span>Sin Asignar</span>
                                                        </span>
                                                    )}
                                                </td>

                                                {/* COL 5: USUARIOS DEL ROL */}
                                                <td className="py-3.5 px-4 max-w-xs">
                                                    {item.usuariosRolActual.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {item.usuariosRolActual.map(u => (
                                                                <span
                                                                    key={u.id}
                                                                    className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-bold truncate max-w-[150px]"
                                                                    title={`${u.name} (${u.username})`}
                                                                >
                                                                    {u.name || u.username}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] text-rose-500 font-bold italic">
                                                            ⚠️ Ningún usuario del rol
                                                        </span>
                                                    )}
                                                </td>

                                                {/* COL 6: OTROS ROLES ASIGNADOS */}
                                                <td className="py-3.5 px-4 max-w-xs">
                                                    {item.otrosRolesAsignados.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {item.otrosRolesAsignados.map(o => (
                                                                <span
                                                                    key={o.rol}
                                                                    className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-medium"
                                                                    title={`${o.rol}: ${o.usuarios.join(', ')}`}
                                                                >
                                                                    {o.rol} ({o.usuarios.length})
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400 italic">
                                                            Sin otros roles
                                                        </span>
                                                    )}
                                                </td>

                                                {/* COL 7: ACCIÓN DIRECTA */}
                                                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                                    <a
                                                        href="/dashboard/mantenedor/actas-supervision/asociar-rbd"
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors shadow-xs"
                                                        title={`Asociar usuario al RBD ${item.rbd}`}
                                                    >
                                                        <span>Asociar</span>
                                                        <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                                                    </a>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* CONTROLES DE PAGINACIÓN (10 REGISTROS POR HOJA) */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                            <div className="text-xs text-slate-500 font-medium">
                                Mostrando{' '}
                                <strong className="text-slate-900 font-black">
                                    {rbdsOrdenados.length === 0 ? 0 : indiceInicio + 1}
                                </strong>{' '}
                                a{' '}
                                <strong className="text-slate-900 font-black">
                                    {Math.min(indiceFin, rbdsOrdenados.length)}
                                </strong>{' '}
                                de <strong className="text-slate-900 font-black">{rbdsOrdenados.length}</strong> establecimientos (10 por hoja)
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPaginaActual(prev => Math.max(1, prev - 1))}
                                    disabled={paginaValida <= 1}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    <span>Anterior</span>
                                </button>

                                <div className="px-3.5 py-1.5 text-xs font-black text-slate-800 bg-slate-100 rounded-xl border border-slate-200">
                                    Página {paginaValida} de {totalPaginas}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setPaginaActual(prev => Math.min(totalPaginas, prev + 1))}
                                    disabled={paginaValida >= totalPaginas}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
                                >
                                    <span>Siguiente</span>
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENIDO PESTAÑA 3: PROGRAMAS Y SERVICIOS SIN HOMOLOGAR */}
            {tabActiva === 'HOMOLOGACION' && (() => {
                const itemsTotal = programasHomologacionData?.itemsSinHomologar || []
                const itemsFiltrados = itemsTotal.filter(it => {
                    if (!busquedaSinHomologar.trim()) return true
                    const term = busquedaSinHomologar.toLowerCase()
                    return (
                        it.programaPmpa.toLowerCase().includes(term) ||
                        (it.servicioPmpa && it.servicioPmpa.toLowerCase().includes(term)) ||
                        (it.institucion && it.institucion.toLowerCase().includes(term))
                    )
                })

                const regPorPagina = 10
                const totalPags = Math.ceil(itemsFiltrados.length / regPorPagina) || 1
                const pagValida = Math.min(paginaSinHomologar, totalPags)
                const inicio = (pagValida - 1) * regPorPagina
                const fin = inicio + regPorPagina
                const itemsPaginados = itemsFiltrados.slice(inicio, fin)

                const formatServLabel = (s: string) => {
                    if (!s) return 'General'
                    const u = s.toUpperCase()
                    if (u === 'D' || u === 'DP') return 'Desayuno (D)'
                    if (u === 'A' || u === 'AP') return 'Almuerzo (A)'
                    if (u === 'O' || u === 'OP') return 'Once (O)'
                    if (u === 'CO' || u === 'CP') return 'Colación (CO)'
                    if (u === 'C') return 'Cena (C)'
                    if (u === 'T') return 'Tercer Servicio (T)'
                    return s
                }

                return (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        {/* SECCIÓN RESUMEN KPI */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* TOTAL PMPA */}
                            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                                <div>
                                    <span className="text-[11px] font-black tracking-widest text-slate-500 uppercase">
                                        Total Programas / Servicios PMPA
                                    </span>
                                    <div className="text-3xl font-black text-slate-900 mt-2">
                                        {(programasHomologacionData?.totalItems ?? 0).toLocaleString('es-CL')}
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-4 border-t border-slate-100 pt-2">
                                    Combinaciones detectadas en las cargas masivas del PMPA.
                                </p>
                            </div>

                            {/* TOTAL HOMOLOGADOS */}
                            <div className="bg-white border border-emerald-200/90 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black tracking-widest text-emerald-700 uppercase">
                                            Homologados
                                        </span>
                                        <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                            {programasHomologacionData?.porcentajeHomologacion ?? 0}%
                                        </span>
                                    </div>
                                    <div className="text-3xl font-black text-emerald-800 mt-2">
                                        {(programasHomologacionData?.totalHomologados ?? 0).toLocaleString('es-CL')}
                                    </div>
                                    <div className="w-full bg-emerald-100 h-2 rounded-full mt-3 overflow-hidden">
                                        <div
                                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                            style={{ width: `${programasHomologacionData?.porcentajeHomologacion ?? 0}%` }}
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-emerald-600 font-semibold mt-4 border-t border-emerald-100 pt-2">
                                    Disponibles en el selector de auditoría de raciones.
                                </p>
                            </div>

                            {/* TOTAL SIN HOMOLOGAR */}
                            <div className={`border rounded-3xl p-6 shadow-xs flex flex-col justify-between ${
                                (programasHomologacionData?.totalSinHomologar ?? 0) > 0
                                    ? 'bg-amber-50/70 border-amber-300'
                                    : 'bg-white border-slate-200/90'
                            }`}>
                                <div>
                                    <span className="text-[11px] font-black tracking-widest text-amber-800 uppercase">
                                        Sin Homologar (Pendientes)
                                    </span>
                                    <div className="text-3xl font-black text-amber-900 mt-2">
                                        {(programasHomologacionData?.totalSinHomologar ?? 0).toLocaleString('es-CL')}
                                    </div>
                                </div>
                                <div className="mt-4 border-t border-amber-200/60 pt-2 flex items-center justify-between">
                                    <span className="text-xs text-amber-700 font-semibold">
                                        {(programasHomologacionData?.totalSinHomologar ?? 0) > 0
                                            ? 'Requieren código homologado'
                                            : '✓ Todos los programas homologados'}
                                    </span>
                                    <Link
                                        href="/dashboard/mantenedor/operaciones/homologacion-programas"
                                        className="inline-flex items-center gap-1.5 text-xs font-black text-cyan-800 bg-white hover:bg-cyan-50 border border-cyan-300 px-3 py-1.5 rounded-xl transition-all shadow-xs"
                                    >
                                        <span>Ir a Homologar</span>
                                        <ExternalLink className="w-3.5 h-3.5 text-cyan-700" />
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* LISTADO DE PROGRAMAS Y SERVICIOS SIN HOMOLOGAR */}
                        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
                            {/* Barra de Filtro y Acción Directa */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                                <div className="relative w-full sm:w-80">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                    <input
                                        type="text"
                                        value={busquedaSinHomologar}
                                        onChange={e => {
                                            setBusquedaSinHomologar(e.target.value)
                                            setPaginaSinHomologar(1)
                                        }}
                                        placeholder="Buscar por programa o servicio..."
                                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <Link
                                        href="/dashboard/mantenedor/operaciones/homologacion-programas"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-cyan-600/20"
                                    >
                                        <Tag className="w-4 h-4" />
                                        <span>Abrir Mantenedor de Homologación</span>
                                    </Link>
                                </div>
                            </div>

                            {/* TABLA DE SIN HOMOLOGAR */}
                            <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                                            <th className="py-3 px-4">Programa PMPA</th>
                                            <th className="py-3 px-4">Servicio PMPA</th>
                                            <th className="py-3 px-4 text-center">Institución</th>
                                            <th className="py-3 px-4 text-center">Registros PMPA</th>
                                            <th className="py-3 px-4 text-center">Colegios (RBDs)</th>
                                            <th className="py-3 px-4 text-center">Estado</th>
                                            <th className="py-3 px-4 text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {itemsPaginados.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-12 text-center text-slate-400">
                                                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                                                    <p className="font-bold text-slate-700">
                                                        {itemsTotal.length === 0
                                                            ? '¡Felicitaciones! Todos los programas y servicios del PMPA están homologados.'
                                                            : 'No se encontraron programas sin homologar con la búsqueda aplicada.'}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        Las auditorías de raciones pueden operar con todos los códigos estandarizados.
                                                    </p>
                                                </td>
                                            </tr>
                                        ) : (
                                            itemsPaginados.map((it, idx) => (
                                                <tr key={`${it.programaPmpa}-${it.servicioPmpa}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="py-3 px-4 font-black text-slate-900">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center font-black text-xs shrink-0">
                                                                {it.programaPmpa.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span>{it.programaPmpa}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                            {formatServLabel(it.servicioPmpa)}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        {it.institucion ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                                                {it.institucion}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                                                        {it.totalRegistros.toLocaleString('es-CL')}
                                                    </td>
                                                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                                                        {it.totalRbds.toLocaleString('es-CL')}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                                                            <AlertCircle className="w-3 h-3 text-amber-600" />
                                                            <span>Sin Homologar</span>
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <Link
                                                            href="/dashboard/mantenedor/operaciones/homologacion-programas"
                                                            className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded-lg text-xs font-bold transition-colors"
                                                        >
                                                            <span>Homologar</span>
                                                            <ArrowRight className="w-3 h-3" />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Paginación */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                                <div>
                                    Mostrando{' '}
                                    <strong className="text-slate-900 font-black">
                                        {itemsFiltrados.length === 0 ? 0 : inicio + 1}
                                    </strong>{' '}
                                    a{' '}
                                    <strong className="text-slate-900 font-black">
                                        {Math.min(fin, itemsFiltrados.length)}
                                    </strong>{' '}
                                    de <strong className="text-slate-900 font-black">{itemsFiltrados.length}</strong> programas pendientes (10 por hoja)
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPaginaSinHomologar(p => Math.max(1, p - 1))}
                                        disabled={pagValida <= 1}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        <span>Anterior</span>
                                    </button>

                                    <div className="px-3.5 py-1.5 text-xs font-black text-slate-800 bg-slate-100 rounded-xl border border-slate-200">
                                        Página {pagValida} de {totalPags}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setPaginaSinHomologar(p => Math.min(totalPags, p + 1))}
                                        disabled={pagValida >= totalPags}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
                                    >
                                        <span>Siguiente</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
