'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
    TableroFirmasPendientesResponse,
    SupervisorOficialInfo,
    getFirmasPendientesTableroData
} from '../firmas-pendientes/actions'
import {
    FileText,
    Download,
    Search,
    X,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Check
} from 'lucide-react'

interface Props {
    initialData: TableroFirmasPendientesResponse
}

export default function SupervisionFirmasClient({ initialData }: Props) {
    const [data, setData] = useState<TableroFirmasPendientesResponse>(initialData)
    const [isPending, startTransition] = useTransition()

    // Filtros de estado
    const [filtroSucursal, setFiltroSucursal] = useState('TODAS')
    const [filtroSupervisor, setFiltroSupervisor] = useState('TODOS')
    const [filtroTipoDoc, setFiltroTipoDoc] = useState('TODOS')
    const [filtroTramo, setFiltroTramo] = useState('TODOS')
    const [filtroEstadoFirma, setFiltroEstadoFirma] = useState('TODOS')
    const [search, setSearch] = useState('')
    const [filtroRbd, setFiltroRbd] = useState<number | null>(null)

    // Paginación y ordenamiento
    const [page, setPage] = useState(data.page || 1)
    const [pageSize, setPageSize] = useState(data.pageSize || 15)
    const [sortBy, setSortBy] = useState<string>('diasAtraso')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [isExportingExcel, setIsExportingExcel] = useState(false)

    // Filtrar lista oficial de supervisores según la sucursal seleccionada
    const supervisoresFiltrados = useMemo(() => {
        const oficiales: SupervisorOficialInfo[] = data.supervisoresOficiales && data.supervisoresOficiales.length > 0
            ? data.supervisoresOficiales
            : (data.supervisoresDisponibles || []).map(s => ({ nombre: s, sucursales: [] }))

        if (filtroSucursal === 'TODAS') {
            return oficiales
        }
        return oficiales.filter(s => s.sucursales.length === 0 || s.sucursales.includes(filtroSucursal))
    }, [data.supervisoresOficiales, data.supervisoresDisponibles, filtroSucursal])

    // Función de recarga de datos con filtros
    const fetchData = (
        newPage = page,
        newPageSize = pageSize,
        newSortBy = sortBy,
        newSortOrder = sortOrder,
        overrideFilters?: { sucursal?: string; supervisor?: string; rbd?: number | null }
    ) => {
        const sucursalToUse = overrideFilters?.sucursal !== undefined ? overrideFilters.sucursal : filtroSucursal
        const supervisorToUse = overrideFilters?.supervisor !== undefined ? overrideFilters.supervisor : filtroSupervisor
        const rbdToUse = overrideFilters?.rbd !== undefined ? overrideFilters.rbd : filtroRbd

        startTransition(async () => {
            const res = await getFirmasPendientesTableroData({
                sucursal: sucursalToUse,
                supervisor: supervisorToUse,
                rbd: rbdToUse || undefined,
                tipoDocumento: filtroTipoDoc,
                tramoAntiguedad: filtroTramo,
                estadoFirma: filtroEstadoFirma,
                search: search.trim() || undefined,
                page: newPage,
                pageSize: newPageSize,
                sortBy: newSortBy,
                sortOrder: newSortOrder
            })
            if (res.success) {
                setData(res)
                setPage(newPage)
            } else if (res.error) {
                alert(res.error)
            }
        })
    }

    // Cambio de sucursal
    const handleSelectSucursal = (nuevaSucursal: string) => {
        setFiltroSucursal(nuevaSucursal)
        setFiltroSupervisor('TODOS')
        setFiltroRbd(null)
        fetchData(1, pageSize, sortBy, sortOrder, { sucursal: nuevaSucursal, supervisor: 'TODOS', rbd: null })
    }

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        fetchData(1, pageSize, sortBy, sortOrder)
    }

    const handleClearFilters = () => {
        setFiltroSucursal('TODAS')
        setFiltroSupervisor('TODOS')
        setFiltroTipoDoc('TODOS')
        setFiltroTramo('TODOS')
        setFiltroEstadoFirma('TODOS')
        setSearch('')
        setFiltroRbd(null)
        startTransition(async () => {
            const res = await getFirmasPendientesTableroData({
                page: 1,
                pageSize,
                sortBy: 'diasAtraso',
                sortOrder: 'desc'
            })
            if (res.success) {
                setData(res)
                setPage(1)
            }
        })
    }

    const handleSort = (field: string) => {
        const newOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc'
        setSortBy(field)
        setSortOrder(newOrder)
        fetchData(page, pageSize, field, newOrder)
    }

    // Exportación a formato CSV compatible con Excel con BOM UTF-8 (Exporta todo el universo filtrado)
    const handleExportExcel = async () => {
        try {
            setIsExportingExcel(true)
            const res = await getFirmasPendientesTableroData({
                sucursal: filtroSucursal,
                supervisor: filtroSupervisor,
                rbd: filtroRbd || undefined,
                tipoDocumento: filtroTipoDoc,
                tramoAntiguedad: filtroTramo,
                estadoFirma: filtroEstadoFirma,
                search: search.trim() || undefined,
                page: 1,
                pageSize: 50000,
                sortBy,
                sortOrder
            })

            const regsParaExport = (res.success && res.registros && res.registros.length > 0) ? res.registros : data.registros
            if (!regsParaExport || regsParaExport.length === 0) {
                alert('No hay registros para exportar con los filtros seleccionados.')
                return
            }

            const headers = [
                'Días Atraso',
                'RUT Colaborador',
                'Nombre Colaborador',
                'Cargo',
                'Sucursal',
                'RBD',
                'Establecimiento',
                'Supervisor',
                'Tipo Documento',
                'Detalle Documento',
                'Estado Firma',
                'Fecha Emisión',
                'Fecha Inicio Firma',
                'Nombre Apoderado 1',
                'Fecha Firma Apoderado 1'
            ]

            const rows = regsParaExport.map(r => [
                r.diasAtraso,
                `"${r.empleadoRut}"`,
                `"${(r.empleadoNombre || '').replace(/"/g, '""')}"`,
                `"${(r.cargo || '').replace(/"/g, '""')}"`,
                `"${r.sucursal}"`,
                r.rbd || '',
                `"${(r.establecimiento || '').replace(/"/g, '""')}"`,
                `"${(r.supervisorNombre || '').replace(/"/g, '""')}"`,
                `"${(r.tipoDocumento || '').replace(/"/g, '""')}"`,
                `"${(r.detalle || '').replace(/"/g, '""')}"`,
                `"${(r.documentoFirmado || '').replace(/"/g, '""')}"`,
                `"${r.fechaEmision || ''}"`,
                `"${r.fechaInicioFirma || ''}"`,
                `"${(r.nombreApoderado1 || '').replace(/"/g, '""')}"`,
                `"${r.fechaFirmaApoderado1 || ''}"`
            ])

            const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n')
            const encodedUri = encodeURI(csvContent)
            const link = document.createElement('a')
            link.setAttribute('href', encodedUri)
            link.setAttribute('download', `supervision_firmas_pendientes_${new Date().toISOString().slice(0, 10)}.csv`)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } catch (err: any) {
            console.error('Error al exportar firmas:', err)
            alert('Ocurrió un error al exportar las firmas a Excel.')
        } finally {
            setIsExportingExcel(false)
        }
    }

    const { ultimaCarga } = data

    return (
        <div className="space-y-6 max-w-[1700px] mx-auto p-2 sm:p-4">
            {/* CABECERA CORPORATIVA OFICIAL HENDAYA */}
            <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-700/60 overflow-hidden">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="font-mono text-cyan-400 font-extrabold tracking-widest text-xs uppercase px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60">
                                HENDAYA · RECURSOS HUMANOS
                            </span>
                            <span className="text-slate-400 text-xs font-semibold">
                                Control de Documentos con Firma Pendiente
                            </span>
                            {data.isRestrictedByRbd && (
                                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                                    Perfil Restringido: {data.authorizedRbdsCount} colegios autorizados
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                            <span>Supervisión de Firmas Pendientes</span>
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                            Supervisión y control detallado de contratos, anexos, liquidaciones y comunicados pendientes de firma. Monitorea el estado y mora por colaborador, supervisor y establecimiento educacional.
                        </p>
                    </div>

                    {/* Botones de Cabecera */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Refrescar */}
                        <button
                            type="button"
                            onClick={() => fetchData()}
                            disabled={isPending}
                            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-sm disabled:opacity-60 cursor-pointer"
                            title="Refrescar datos del tablero"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-cyan-400' : 'text-slate-300'}`} />
                            <span>Actualizar</span>
                        </button>

                        {/* Exportar Excel */}
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={isExportingExcel || isPending}
                            className="px-3.5 py-2.5 bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-sm disabled:opacity-60 cursor-pointer"
                            title="Exportar selección a formato Excel (CSV UTF-8)"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>{isExportingExcel ? 'Exportando...' : 'Exportar Excel'}</span>
                        </button>
                    </div>
                </div>

                {/* Banner de información de última carga */}
                {ultimaCarga && (
                    <div className="mt-5 pt-4 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-300 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-cyan-500/20 text-cyan-400">📂</span>
                            <span>Última planilla procesada: <strong>{ultimaCarga.nombreArchivo}</strong></span>
                            <span>•</span>
                            <span>Fecha: <strong>{ultimaCarga.fechaCarga}</strong></span>
                            <span>•</span>
                            <span>Cargado por: <strong>{ultimaCarga.cargadoPor}</strong></span>
                        </div>
                        <div className="text-cyan-400 font-mono font-bold">
                            Total Registros: {ultimaCarga.totalRegistros.toLocaleString('es-CL')} | {ultimaCarga.totalEmpleados.toLocaleString('es-CL')} colaboradores únicos
                        </div>
                    </div>
                )}
            </div>

            {/* BARRA DE FILTROS MULTIFACÉTICOS */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
                    {/* Búsqueda por texto */}
                    <div className="lg:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Búsqueda General
                        </label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="RUT, Colaborador, Supervisor..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                            />
                        </div>
                    </div>

                    {/* Filtro Sucursal */}
                    <div className="lg:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Sucursal
                        </label>
                        <select
                            value={filtroSucursal}
                            onChange={e => handleSelectSucursal(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                        >
                            <option value="TODAS">Todas las Sucursales</option>
                            {data.sucursalesDisponibles.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Supervisor */}
                    <div className="lg:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                            <span>Supervisor</span>
                            {filtroSucursal !== 'TODAS' && (
                                <span className="text-[10px] text-cyan-600 font-semibold">({filtroSucursal})</span>
                            )}
                        </label>
                        <select
                            value={filtroSupervisor}
                            onChange={e => setFiltroSupervisor(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 truncate"
                        >
                            <option value="TODOS">Todos los Supervisores</option>
                            {supervisoresFiltrados.map(sup => (
                                <option key={sup.nombre} value={sup.nombre}>
                                    {sup.nombre} {sup.sucursales && sup.sucursales.length > 0 ? `(${sup.sucursales.join(', ')})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Tipo Documento */}
                    <div className="lg:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Tipo Documento
                        </label>
                        <select
                            value={filtroTipoDoc}
                            onChange={e => setFiltroTipoDoc(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 truncate"
                        >
                            <option value="TODOS">Todos los Tipos</option>
                            {data.tiposDocumentoDisponibles.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Antigüedad */}
                    <div className="lg:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Días de Atraso
                        </label>
                        <select
                            value={filtroTramo}
                            onChange={e => setFiltroTramo(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                        >
                            <option value="TODOS">Cualquier Antigüedad</option>
                            <option value="0-30">0 a 30 días</option>
                            <option value="31-60">31 a 60 días</option>
                            <option value="61-90">61 a 90 días</option>
                            <option value="91-180">91 a 180 días</option>
                            <option value="181-365">181 a 365 días</option>
                            <option value=">365">Más de 1 año</option>
                        </select>
                    </div>

                    {/* Botones Filtrar y Limpiar */}
                    <div className="lg:col-span-1 flex items-center gap-1.5">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                            Filtrar
                        </button>
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            disabled={isPending}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                            title="Limpiar todos los filtros"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </form>
            </div>

            {/* TABLA PRINCIPAL DE REGISTROS DE FIRMAS PENDIENTES */}
            <div id="tabla-firmas-detalle" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-6">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">
                            Mostrando <strong className="text-cyan-700">{data.registros.length}</strong> de <strong className="text-slate-900">{data.totalRegistros.toLocaleString('es-CL')}</strong> documentos
                        </span>
                        {isPending && <span className="text-xs text-cyan-600 animate-pulse font-medium">Actualizando...</span>}
                    </div>

                    {/* Selector de tamaño de página */}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Filas por página:</span>
                        {[5, 10, 15, 25, 50].map(sz => (
                            <button
                                key={sz}
                                type="button"
                                onClick={() => {
                                    setPageSize(sz)
                                    fetchData(1, sz, sortBy, sortOrder)
                                }}
                                className={`px-2 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                                    pageSize === sz ? 'bg-cyan-100 text-cyan-800 font-extrabold ring-1 ring-cyan-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {sz}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                        <thead>
                            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10.5px]">
                                <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('diasAtraso')}>
                                    <div className="flex items-center gap-1">
                                        <span>Mora</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('empleadoNombre')}>
                                    <div className="flex items-center gap-1">
                                        <span>Colaborador</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('rbd')}>
                                    <div className="flex items-center gap-1">
                                        <span>RBD / Establecimiento</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('sucursal')}>
                                    <div className="flex items-center gap-1">
                                        <span>Sucursal</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('supervisorNombre')}>
                                    <div className="flex items-center gap-1">
                                        <span>Supervisor</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('tipoDocumento')}>
                                    <div className="flex items-center gap-1">
                                        <span>Documento</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th className="py-3 px-3 text-center">Estado Firma</th>
                                <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('fechaEmision')}>
                                    <div className="flex items-center gap-1">
                                        <span>Emisión / Inicio</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th className="py-3 px-3">Apoderado Hendaya</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {data.registros.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-slate-400">
                                        <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                        <p className="font-bold text-slate-700">No se encontraron documentos con firma pendiente</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Prueba cambiando o limpiando los filtros aplicados.</p>
                                    </td>
                                </tr>
                            ) : (
                                data.registros.map(r => {
                                    // Badge de mora semafórico
                                    let badgeMoraClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    if (r.diasAtraso > 365) badgeMoraClass = 'bg-pink-100 text-pink-900 border-pink-300 font-black'
                                    else if (r.diasAtraso > 180) badgeMoraClass = 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold'
                                    else if (r.diasAtraso > 90) badgeMoraClass = 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
                                    else if (r.diasAtraso > 60) badgeMoraClass = 'bg-orange-50 text-orange-700 border-orange-200 font-bold'
                                    else if (r.diasAtraso > 30) badgeMoraClass = 'bg-amber-50 text-amber-700 border-amber-200'

                                    const isFirmadoApoderado = r.documentoFirmado.toLowerCase().includes('si / no')

                                    return (
                                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                                            {/* Días Mora */}
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${badgeMoraClass}`}>
                                                    {r.diasAtraso} días
                                                </span>
                                            </td>

                                            {/* Colaborador */}
                                            <td className="py-2.5 px-3">
                                                <div className="font-extrabold text-slate-900 truncate max-w-[170px]" title={r.empleadoNombre}>
                                                    {r.empleadoNombre}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="font-mono text-[10px] text-cyan-800 font-semibold">{r.empleadoRut}</span>
                                                    {r.cargo && <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={r.cargo}>• {r.cargo}</span>}
                                                </div>
                                            </td>

                                            {/* RBD / Establecimiento */}
                                            <td className="py-2.5 px-3">
                                                <div className="font-bold text-slate-800">
                                                    {r.rbd > 0 ? `RBD ${r.rbd}` : '-'}
                                                </div>
                                                <div className="text-[10px] text-slate-500 truncate max-w-[170px]" title={r.establecimiento}>
                                                    {r.establecimiento}
                                                </div>
                                            </td>

                                            {/* Sucursal */}
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <span className="text-xs font-semibold text-slate-700">{r.sucursal}</span>
                                            </td>

                                            {/* Supervisor */}
                                            <td className="py-2.5 px-3">
                                                <div className="font-semibold text-slate-900 truncate max-w-[160px]" title={r.supervisorNombre}>
                                                    {r.supervisorNombre || <span className="text-slate-400 italic">Sin supervisor</span>}
                                                </div>
                                            </td>

                                            {/* Documento y Detalle */}
                                            <td className="py-2.5 px-3">
                                                <div className="font-bold text-slate-900 truncate max-w-[180px]" title={r.tipoDocumento}>
                                                    {r.tipoDocumento}
                                                </div>
                                                {r.detalle && (
                                                    <div className="text-[10px] text-slate-500 truncate max-w-[180px]" title={r.detalle}>
                                                        {r.detalle}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Estado Firma */}
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                {isFirmadoApoderado ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                                                        <Check className="w-3 h-3 text-sky-600" />
                                                        <span>Esperando Empleado</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                        <span>Sin firmas</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* Emisión e Inicio */}
                                            <td className="py-2.5 px-3 text-[10.5px] whitespace-nowrap text-slate-600">
                                                <div>Emi: {r.fechaEmision || '-'}</div>
                                                {r.fechaInicioFirma && <div className="text-[10px] text-slate-400">Ini: {r.fechaInicioFirma}</div>}
                                            </td>

                                            {/* Apoderado 1 */}
                                            <td className="py-2.5 px-3">
                                                <div className="font-medium text-slate-800 truncate max-w-[150px]" title={r.nombreApoderado1}>
                                                    {r.nombreApoderado1 || '-'}
                                                </div>
                                                {r.fechaFirmaApoderado1 && (
                                                    <div className="text-[10px] text-emerald-700 font-semibold">
                                                        ✓ {r.fechaFirmaApoderado1}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINACIÓN */}
                <div className="p-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3 text-xs text-slate-600">
                    <div>
                        Página <strong className="text-slate-900">{data.page}</strong> de <strong className="text-slate-900">{data.totalPages}</strong>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => fetchData(page - 1)}
                            disabled={page <= 1 || isPending}
                            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4 text-slate-600" />
                        </button>
                        <span className="font-bold text-slate-800 px-2">{page}</span>
                        <button
                            type="button"
                            onClick={() => fetchData(page + 1)}
                            disabled={page >= data.totalPages || isPending}
                            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
