'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
    ColaboradorDotacionItemDTO,
    ColegioOptionDTO,
    CambioRbdRegistroDTO,
    getPersonalDotacionCambioRbdAction,
    getColegiosParaCambioRbdAction,
    guardarCambioRbdAction,
    getHistorialCambiosColaboradorAction
} from './actions'

type Props = {
    initialData: ColaboradorDotacionItemDTO[]
    initialTotal: number
    initialTotalPages: number
    currentUser: {
        name: string
        role: string
    }
}

type SortField = 'rbd' | 'establecimiento' | 'sucursal' | 'supervisor' | 'cargo'
type SortDir = 'asc' | 'desc'
type TipoCambio = 'ANEXO_TRASLADO' | 'COMISION_SERVICIO'

export default function CambioRbdClient({
    initialData,
    initialTotal,
    initialTotalPages,
    currentUser
}: Props) {
    // Estado de la tabla
    const [data, setData] = useState<ColaboradorDotacionItemDTO[]>(initialData)
    const [total, setTotal] = useState<number>(initialTotal)
    const [totalPages, setTotalPages] = useState<number>(initialTotalPages)
    const [page, setPage] = useState<number>(1)
    const pageSize = 10

    // Ordenamiento
    const [sortBy, setSortBy] = useState<SortField>('rbd')
    const [sortDir, setSortDir] = useState<SortDir>('asc')

    // Búsqueda
    const [search, setSearch] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(false)

    // Notificaciones toast
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

    // Estado del modal de Cambio de RBD
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
    const [selectedColab, setSelectedColab] = useState<ColaboradorDotacionItemDTO | null>(null)
    const [colegiosCandidatos, setColegiosCandidatos] = useState<ColegioOptionDTO[]>([])
    const [loadingColegios, setLoadingColegios] = useState<boolean>(false)

    // Formulario del modal
    const [searchColegioTerm, setSearchColegioTerm] = useState<string>('')
    const [selectedRbdDestino, setSelectedRbdDestino] = useState<number | null>(null)
    const [selectedColegioObj, setSelectedColegioObj] = useState<ColegioOptionDTO | null>(null)
    const [tipoCambio, setTipoCambio] = useState<TipoCambio>('ANEXO_TRASLADO')
    const [fechaDesde, setFechaDesde] = useState<string>('')
    const [fechaHasta, setFechaHasta] = useState<string>('')
    const [observacion, setObservacion] = useState<string>('')
    const [isSaving, setIsSaving] = useState<boolean>(false)

    // Historial de cambios
    const [colabHistorial, setColabHistorial] = useState<CambioRbdRegistroDTO[]>([])
    const [loadingHistorial, setLoadingHistorial] = useState<boolean>(false)
    const [showHistorialInModal, setShowHistorialInModal] = useState<boolean>(false)

    // Modal dedicado de Historial
    const [isHistorialModalOpen, setIsHistorialModalOpen] = useState<boolean>(false)
    const [colabForHistorial, setColabForHistorial] = useState<ColaboradorDotacionItemDTO | null>(null)

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 5000)
    }

    // Cargar datos paginados
    const loadData = useCallback(async (targetPage: number, sort: SortField, dir: SortDir, searchTerm: string) => {
        setLoading(true)
        try {
            const res = await getPersonalDotacionCambioRbdAction({
                page: targetPage,
                pageSize,
                sortBy: sort,
                sortDir: dir,
                search: searchTerm
            })

            if (res.success) {
                setData(res.data)
                setTotal(res.total)
                setTotalPages(res.totalPages)
                setPage(res.page ?? targetPage)
            } else {
                showToast(res.error || 'Error al cargar registros', 'error')
            }
        } catch (err: any) {
            showToast(err?.message || 'Error de comunicación', 'error')
        } finally {
            setLoading(false)
        }
    }, [])

    const handleSort = (field: SortField) => {
        let newDir: SortDir = 'asc'
        if (sortBy === field) {
            newDir = sortDir === 'asc' ? 'desc' : 'asc'
        }
        setSortBy(field)
        setSortDir(newDir)
        loadData(page, field, newDir, search)
    }

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setPage(1)
        loadData(1, sortBy, sortDir, search)
    }

    const handlePrevPage = () => {
        if (page > 1) {
            const newP = page - 1
            setPage(newP)
            loadData(newP, sortBy, sortDir, search)
        }
    }

    const handleNextPage = () => {
        if (page < totalPages) {
            const newP = page + 1
            setPage(newP)
            loadData(newP, sortBy, sortDir, search)
        }
    }

    // Abrir modal y cargar lista de colegios candidatos
    const handleOpenModal = async (colaborador: ColaboradorDotacionItemDTO) => {
        setSelectedColab(colaborador)
        setSearchColegioTerm('')
        setSelectedRbdDestino(null)
        setSelectedColegioObj(null)
        setTipoCambio('ANEXO_TRASLADO')
        setFechaDesde(new Date().toISOString().slice(0, 10))
        setFechaHasta('')
        setObservacion('')
        setShowHistorialInModal(false)
        setColabHistorial([])
        setIsModalOpen(true)
        setLoadingColegios(true)

        // Cargar historial en segundo plano
        setLoadingHistorial(true)
        getHistorialCambiosColaboradorAction(colaborador.id, colaborador.rut)
            .then(res => {
                if (res.success && res.data) {
                    setColabHistorial(res.data)
                }
            })
            .catch(err => console.error('Error cargando historial:', err))
            .finally(() => setLoadingHistorial(false))

        try {
            const colegios = await getColegiosParaCambioRbdAction(colaborador.supervisor)
            setColegiosCandidatos(colegios)
        } catch (err) {
            console.error('Error cargando colegios:', err)
        } finally {
            setLoadingColegios(false)
        }
    }

    // Abrir modal dedicado de Historial
    const handleOpenHistorial = async (colaborador: ColaboradorDotacionItemDTO) => {
        setColabForHistorial(colaborador)
        setColabHistorial([])
        setIsHistorialModalOpen(true)
        setLoadingHistorial(true)
        try {
            const res = await getHistorialCambiosColaboradorAction(colaborador.id, colaborador.rut)
            if (res.success && res.data) {
                setColabHistorial(res.data)
            } else {
                showToast(res.error || 'No se pudo cargar el historial', 'error')
            }
        } catch (err: any) {
            showToast(err?.message || 'Error al cargar historial', 'error')
        } finally {
            setLoadingHistorial(false)
        }
    }

    // Filtrar colegios en tiempo real por RBD o nombre
    const filteredColegios = useMemo(() => {
        if (!searchColegioTerm.trim()) {
            return colegiosCandidatos.slice(0, 50)
        }
        const term = searchColegioTerm.toLowerCase().trim()
        return colegiosCandidatos
            .filter(c =>
                c.rbd.toString().includes(term) ||
                c.nombreEstablecimiento.toLowerCase().includes(term) ||
                (c.comuna && c.comuna.toLowerCase().includes(term)) ||
                (c.sucursal && c.sucursal.toLowerCase().includes(term))
            )
            .slice(0, 50)
    }, [colegiosCandidatos, searchColegioTerm])

    const handleSelectColegio = (col: ColegioOptionDTO) => {
        setSelectedRbdDestino(col.rbd)
        setSelectedColegioObj(col)
        setSearchColegioTerm(`RBD ${col.rbd} - ${col.nombreEstablecimiento}`)
    }

    // Guardar cambio de RBD
    const handleGuardarCambio = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedColab) return

        if (!selectedRbdDestino) {
            showToast('Por favor selecciona el nuevo RBD de destino', 'error')
            return
        }

        if (selectedRbdDestino === selectedColab.rbd) {
            showToast('El RBD de destino debe ser diferente al RBD actual de origen', 'error')
            return
        }

        if (!fechaDesde) {
            showToast('La fecha de inicio (Desde) es obligatoria', 'error')
            return
        }

        if (tipoCambio === 'COMISION_SERVICIO' && !fechaHasta) {
            showToast('Debe indicar la Fecha Hasta para Comisión de servicio', 'error')
            return
        }

        if (fechaHasta && fechaDesde > fechaHasta) {
            showToast('La Fecha Hasta no puede ser anterior a la Fecha Desde', 'error')
            return
        }

        setIsSaving(true)
        try {
            const res = await guardarCambioRbdAction({
                colaboradorId: selectedColab.id,
                rbdDestino: selectedRbdDestino,
                tipoCambio,
                fechaDesde,
                fechaHasta: fechaHasta || undefined,
                observacion: observacion || undefined
            })

            if (res.success) {
                showToast(
                    `Cambio de RBD registrado con éxito para ${selectedColab.nombre}. ${res.emailSent ? '📧 Alerta de correo enviada a la lista de distribución.' : ''}`
                )
                setIsModalOpen(false)
                loadData(page, sortBy, sortDir, search)
            } else {
                showToast(res.error || 'Error al registrar el cambio de RBD', 'error')
            }
        } catch (err: any) {
            showToast(err?.message || 'Error inesperado al procesar el cambio', 'error')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* TOAST FLOTANTE */}
            {toast && (
                <div
                    className={`fixed top-5 right-5 z-50 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border transition-all animate-in fade-in slide-in-from-top-4 duration-300 ${
                        toast.type === 'success'
                            ? 'bg-slate-900 border-cyan-500 text-cyan-200'
                            : 'bg-red-950 border-red-500 text-red-200'
                    }`}
                >
                    <span className="text-xl">{toast.type === 'success' ? '✅' : '⚠️'}</span>
                    <span className="text-sm font-semibold">{toast.message}</span>
                </div>
            )}

            {/* HEADER PRINCIPAL HENDAYA */}
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden border border-slate-800">
                <div className="absolute right-0 top-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs font-bold rounded-full uppercase tracking-wider border border-cyan-500/30">
                                Recursos Humanos • Asistencia
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                                HENDAYA
                            </span>
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                            <span>🔄</span> Cambio de RBD
                        </h1>
                        <p className="text-slate-300 text-sm mt-1 max-w-2xl">
                            Gestión de traslados de manipuladoras y colaboradores de la dotación por{' '}
                            <span className="text-cyan-400 font-semibold">Anexos de traslado</span> o{' '}
                            <span className="text-sky-300 font-semibold">Comisión de servicio</span>, con alerta automática vía correo y trazabilidad en auditoría.
                        </p>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 px-5 flex items-center gap-4 shrink-0 shadow-inner">
                        <div className="text-right">
                            <span className="text-xs text-slate-400 block font-medium">Manipuladoras en Dotación</span>
                            <span className="text-xl font-bold text-cyan-400">{total} registros</span>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-lg">
                            👥
                        </div>
                    </div>
                </div>
            </div>

            {/* BARRA DE FILTROS Y BÚSQUEDA */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
                <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
                    <div className="relative flex-1">
                        <span className="absolute left-3.5 top-2.5 text-gray-400 text-sm">🔍</span>
                        <input
                            type="text"
                            placeholder="Buscar por RBD, Establecimiento, RUT, Nombre de manipuladora o Supervisor..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-medium"
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all shadow-md shrink-0 flex items-center gap-1.5"
                    >
                        <span>Buscar</span>
                    </button>
                    {search && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearch('')
                                loadData(1, sortBy, sortDir, '')
                            }}
                            className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all shrink-0"
                        >
                            Limpiar
                        </button>
                    )}
                </form>

                <div className="flex items-center gap-2 shrink-0 text-xs text-gray-500">
                    <span>Orden actual:</span>
                    <span className="font-bold text-cyan-700 bg-cyan-50 px-2 py-1 rounded-lg border border-cyan-100">
                        {sortBy.toUpperCase()} ({sortDir === 'asc' ? '▲ Ascendente' : '▼ Descendente'})
                    </span>
                </div>
            </div>

            {/* TABLA PRINCIPAL (10 REGISTROS POR PÁGINA) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-700 border-collapse">
                        <thead className="bg-slate-900 text-white text-xs uppercase tracking-wider select-none">
                            <tr>
                                <th
                                    onClick={() => handleSort('rbd')}
                                    className="px-5 py-3.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors"
                                    title="Clic para ordenar por RBD / Establecimiento"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Establecimiento / RBD / Sucursal</span>
                                        <span className="text-cyan-400 font-mono">
                                            {sortBy === 'rbd' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                                        </span>
                                    </div>
                                </th>
                                <th className="px-5 py-3.5 font-bold">
                                    RUT
                                </th>
                                <th className="px-5 py-3.5 font-bold">
                                    Nombre Colaboradora
                                </th>
                                <th
                                    onClick={() => handleSort('supervisor')}
                                    className="px-5 py-3.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors"
                                    title="Clic para ordenar por Supervisor"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Supervisor</span>
                                        <span className="text-cyan-400 font-mono">
                                            {sortBy === 'supervisor' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                                        </span>
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSort('cargo')}
                                    className="px-4 py-3.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Cargo</span>
                                        <span className="text-cyan-400 font-mono">
                                            {sortBy === 'cargo' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                                        </span>
                                    </div>
                                </th>
                                <th className="px-5 py-3.5 font-bold text-center">
                                    Acción
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100 font-normal">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent mb-2"></div>
                                        <p className="text-sm font-semibold">Cargando dotación de personal...</p>
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                        <span className="text-3xl block mb-2">🔍</span>
                                        <p className="text-base font-bold text-gray-600">No se encontraron colaboradores en la dotación</p>
                                        <p className="text-xs text-gray-400 mt-1">Verifica los filtros de búsqueda o tus permisos de RBD asignados.</p>
                                    </td>
                                </tr>
                            ) : (
                                data.map((item) => {
                                    const hasMovimientos = (item.cambiosCount || 0) > 0
                                    const ultimo = item.ultimoCambio

                                    return (
                                        <tr
                                            key={item.id}
                                            className={`transition-colors group ${
                                                hasMovimientos
                                                    ? 'bg-cyan-50/30 border-l-4 border-l-cyan-500 hover:bg-cyan-50/60'
                                                    : 'hover:bg-cyan-50/40'
                                            }`}
                                        >
                                            {/* UNIFICACIÓN VISUAL ELEGANTE: RBD + Establecimiento + Sucursal */}
                                            <td className="px-5 py-3.5">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 text-xs font-mono font-black rounded-md bg-cyan-100 text-cyan-800 border border-cyan-200">
                                                            RBD {item.rbd || 'S/N'}
                                                        </span>
                                                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                                            📍 {item.sucursal}
                                                        </span>
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-900 group-hover:text-cyan-900 transition-colors">
                                                        {item.establecimiento}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* RUT */}
                                            <td className="px-5 py-3.5 font-mono text-sm font-semibold text-gray-800 whitespace-nowrap">
                                                {item.rut}
                                            </td>

                                            {/* Nombre y Badge de Traslado Activo */}
                                            <td className="px-5 py-3.5 font-bold text-gray-900">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-gray-950 font-bold">{item.nombre}</span>
                                                    {hasMovimientos && ultimo && (
                                                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                                            <span
                                                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md shadow-xs ${
                                                                    ultimo.tipoCambio === 'COMISION_SERVICIO'
                                                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                                                        : 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                                                                }`}
                                                                title={`Registrado por ${ultimo.creadoPor} el ${new Date(ultimo.createdAt).toLocaleDateString('es-CL')}`}
                                                            >
                                                                <span>{ultimo.tipoCambio === 'COMISION_SERVICIO' ? '🗓️' : '🔄'}</span>
                                                                <span>
                                                                    {ultimo.tipoCambio === 'COMISION_SERVICIO' ? 'Comisión' : 'Traslado'}: RBD {ultimo.rbdDestino} ({ultimo.establecimientoDestino})
                                                                </span>
                                                            </span>
                                                            {item.cambiosCount && item.cambiosCount > 1 && (
                                                                <span className="px-1.5 py-0.5 text-[10px] font-black rounded-md bg-slate-200 text-slate-700">
                                                                    +{item.cambiosCount - 1} prev.
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Supervisor */}
                                            <td className="px-5 py-3.5 text-sm text-gray-700">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-cyan-600">👤</span>
                                                    <span className="font-medium">{item.supervisor}</span>
                                                </div>
                                            </td>

                                            {/* Cargo */}
                                            <td className="px-4 py-3.5">
                                                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                                    {item.cargo}
                                                </span>
                                            </td>

                                            {/* Botones de Acción */}
                                            <td className="px-5 py-3.5 text-center">
                                                <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenModal(item)}
                                                        className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white rounded-xl font-bold text-xs shadow-md shadow-cyan-600/20 transition-all flex items-center justify-center gap-1 hover:scale-105 active:scale-95 whitespace-nowrap"
                                                        title="Registrar nuevo cambio de RBD"
                                                    >
                                                        <span>🔄</span>
                                                        <span>Cambiar RBD</span>
                                                    </button>
                                                    {hasMovimientos && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenHistorial(item)}
                                                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl font-bold text-xs border border-slate-200 transition-all flex items-center justify-center gap-1 shadow-xs whitespace-nowrap"
                                                            title={`Ver historial de ${item.cambiosCount} cambio(s)`}
                                                        >
                                                            <span>📜</span>
                                                            <span>Historial ({item.cambiosCount})</span>
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

                {/* CONTROLES DE PAGINACIÓN FIJOS (10 REGISTROS) */}
                <div className="p-4 px-6 border-t border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
                    <div>
                        Mostrando{' '}
                        <span className="font-bold text-gray-900">
                            {total === 0 ? 0 : (page - 1) * pageSize + 1}
                        </span>{' '}
                        a{' '}
                        <span className="font-bold text-gray-900">
                            {Math.min(page * pageSize, total)}
                        </span>{' '}
                        de <span className="font-bold text-gray-900">{total}</span> manipuladoras (Página{' '}
                        <span className="font-bold text-gray-900">{page}</span> de{' '}
                        <span className="font-bold text-gray-900">{totalPages}</span>)
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrevPage}
                            disabled={page <= 1 || loading}
                            className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl font-bold text-xs text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all flex items-center gap-1"
                        >
                            <span>◀</span>
                            <span>Anterior</span>
                        </button>

                        <span className="px-3 py-1 font-bold bg-cyan-50 border border-cyan-200 text-cyan-800 rounded-lg">
                            {page} / {totalPages}
                        </span>

                        <button
                            onClick={handleNextPage}
                            disabled={page >= totalPages || loading}
                            className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl font-bold text-xs text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all flex items-center gap-1"
                        >
                            <span>Siguiente</span>
                            <span>▶</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* POPUP / MODAL DE CAMBIO DE RBD */}
            {isModalOpen && selectedColab && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
                        {/* CABECERA DEL MODAL */}
                        <div className="p-6 bg-gradient-to-r from-slate-900 to-cyan-950 text-white flex items-center justify-between border-b border-slate-800">
                            <div>
                                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                                    Gestión de Asistencia • Recursos Humanos
                                </span>
                                <h3 className="text-xl font-black mt-0.5 flex items-center gap-2">
                                    <span>🔄</span> Cambiar RBD de Manipuladora
                                </h3>
                            </div>
                            <button
                                onClick={() => !isSaving && setIsModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 text-lg transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* CUERPO DEL MODAL */}
                        <form onSubmit={handleGuardarCambio} className="p-6 overflow-y-auto space-y-5 flex-1">
                            {/* DATOS DE LA MANIPULADORA ACTUAL */}
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                                    Colaboradora Seleccionada
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="text-slate-500 block">Nombre:</span>
                                        <span className="font-bold text-slate-900 text-sm">{selectedColab.nombre}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block">RUT:</span>
                                        <span className="font-mono font-bold text-slate-800">{selectedColab.rut}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block">Colegio Origen Actual:</span>
                                        <span className="font-semibold text-cyan-800">
                                            RBD {selectedColab.rbd} - {selectedColab.establecimiento}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block">Supervisor a cargo:</span>
                                        <span className="font-semibold text-slate-800">{selectedColab.supervisor}</span>
                                    </div>
                                </div>
                            </div>

                            {/* ALERTA PREVENTIVA SI YA TIENE MOVIMIENTOS PREVIOS */}
                            {selectedColab.cambiosCount && selectedColab.cambiosCount > 0 ? (
                                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-xs animate-in fade-in duration-200">
                                    <span className="text-2xl shrink-0">⚠️</span>
                                    <div className="text-xs space-y-1">
                                        <p className="font-bold text-amber-950 text-sm">
                                            ¡Atención! Esta colaboradora ya registra {selectedColab.cambiosCount} cambio(s) de RBD
                                        </p>
                                        {selectedColab.ultimoCambio && (
                                            <p className="text-amber-900 leading-relaxed">
                                                Último movimiento registrado: <strong className="font-black uppercase">{selectedColab.ultimoCambio.tipoCambio === 'COMISION_SERVICIO' ? 'Comisión de Servicio' : 'Anexo de Traslado'}</strong> hacia <strong>RBD {selectedColab.ultimoCambio.rbdDestino} ({selectedColab.ultimoCambio.establecimientoDestino})</strong> a partir del <strong>{selectedColab.ultimoCambio.fechaDesde}</strong>{selectedColab.ultimoCambio.fechaHasta ? ` hasta el ${selectedColab.ultimoCambio.fechaHasta}` : ''}.
                                            </p>
                                        )}
                                        <p className="text-[11px] text-amber-800/90 font-medium">
                                            Si deseas registrar un nuevo traslado, completa el nuevo RBD de destino abajo. Se conservará la trazabilidad histórica completa.
                                        </p>
                                    </div>
                                </div>
                            ) : null}

                            {/* BUSCADOR INTELIGENTE DE RBD DESTINO */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                                    <span>Nuevo RBD de Destino <span className="text-red-500">*</span></span>
                                    {selectedColegioObj && (
                                        <span className="text-[11px] font-semibold text-cyan-700">
                                            Seleccionado: RBD {selectedColegioObj.rbd}
                                        </span>
                                    )}
                                </label>

                                <div className="relative">
                                    <span className="absolute left-3.5 top-3 text-gray-400 text-sm">🏫</span>
                                    <input
                                        type="text"
                                        placeholder="Escribe el RBD o nombre del establecimiento para buscar..."
                                        value={searchColegioTerm}
                                        onChange={(e) => {
                                            setSearchColegioTerm(e.target.value)
                                            setSelectedRbdDestino(null)
                                            setSelectedColegioObj(null)
                                        }}
                                        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-semibold bg-white text-gray-900"
                                    />
                                </div>

                                {/* LISTA DESPLEGABLE DE RESULTADOS INTELIGENTES */}
                                {(!selectedRbdDestino || searchColegioTerm.length > 0) && filteredColegios.length > 0 && !selectedColegioObj && (
                                    <div className="mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg divide-y divide-gray-100 z-10">
                                        {filteredColegios.map((col) => (
                                            <button
                                                key={col.rbd}
                                                type="button"
                                                onClick={() => handleSelectColegio(col)}
                                                className="w-full text-left p-3 hover:bg-cyan-50 transition-colors flex items-center justify-between group"
                                            >
                                                <div>
                                                    <span className="font-mono font-bold text-cyan-700 mr-2">
                                                        RBD {col.rbd}
                                                    </span>
                                                    <span className="font-semibold text-gray-800 text-xs">
                                                        {col.nombreEstablecimiento}
                                                    </span>
                                                    {col.comuna && (
                                                        <span className="text-[11px] text-gray-400 ml-2">
                                                            ({col.comuna})
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                                    {col.sucursal}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {selectedColegioObj && (
                                    <div className="mt-2 p-3 bg-cyan-50 border border-cyan-200 rounded-xl flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">🎯</span>
                                            <div>
                                                <span className="font-bold text-cyan-900 block">
                                                    RBD {selectedColegioObj.rbd} - {selectedColegioObj.nombreEstablecimiento}
                                                </span>
                                                <span className="text-cyan-700">Sucursal: {selectedColegioObj.sucursal} {selectedColegioObj.comuna ? `• Comuna: ${selectedColegioObj.comuna}` : ''}</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedRbdDestino(null)
                                                setSelectedColegioObj(null)
                                                setSearchColegioTerm('')
                                            }}
                                            className="text-red-600 hover:text-red-800 font-bold text-xs"
                                        >
                                            Cambiar
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* SELECTOR DE MODALIDAD / TIPO DE TRASLADO */}
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                    Tipo de Movimiento <span className="text-red-500">*</span>
                                </label>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setTipoCambio('ANEXO_TRASLADO')}
                                        className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                                            tipoCambio === 'ANEXO_TRASLADO'
                                                ? 'bg-cyan-50/80 border-cyan-500 text-cyan-900 shadow-sm'
                                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                    >
                                        <span className="text-xl">📄</span>
                                        <div>
                                            <span className="font-bold text-sm block">Anexos de traslado</span>
                                            <span className="text-[11px] text-gray-500 mt-0.5 block">
                                                Traslado permanente de establecimiento con fecha de inicio.
                                            </span>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setTipoCambio('COMISION_SERVICIO')}
                                        className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                                            tipoCambio === 'COMISION_SERVICIO'
                                                ? 'bg-sky-50/80 border-sky-500 text-sky-900 shadow-sm'
                                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                    >
                                        <span className="text-xl">⏱️</span>
                                        <div>
                                            <span className="font-bold text-sm block">Comisión de servicio</span>
                                            <span className="text-[11px] text-gray-500 mt-0.5 block">
                                                Asignación temporal por período definido (Fecha Desde y Hasta).
                                            </span>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* CAMPOS DE FECHA CONDICIONALES */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Fecha Desde <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={fechaDesde}
                                        onChange={(e) => setFechaDesde(e.target.value)}
                                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-semibold bg-white text-gray-900"
                                    />
                                </div>

                                {tipoCambio === 'COMISION_SERVICIO' && (
                                    <div className="animate-in fade-in duration-200">
                                        <label className="block text-xs font-bold text-gray-700 mb-1">
                                            Fecha Hasta <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={fechaHasta}
                                            onChange={(e) => setFechaHasta(e.target.value)}
                                            min={fechaDesde}
                                            className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-semibold bg-white text-gray-900"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* OBSERVACIÓN OPCIONAL */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                    Observación o Motivo del Traslado
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Indica información adicional sobre el cambio de RBD (opcional)..."
                                    value={observacion}
                                    onChange={(e) => setObservacion(e.target.value)}
                                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-gray-900"
                                />
                            </div>

                            {/* HISTORIAL PREVIO COLAPSABLE DENTRO DEL FORMULARIO */}
                            {colabHistorial.length > 0 && (
                                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                                    <button
                                        type="button"
                                        onClick={() => setShowHistorialInModal(!showHistorialInModal)}
                                        className="w-full p-3.5 bg-slate-100 hover:bg-slate-200/70 text-left flex items-center justify-between text-xs font-bold text-slate-800 transition-colors"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span>📜</span>
                                            <span>Ver Historial de Cambios Anteriores ({colabHistorial.length})</span>
                                        </span>
                                        <span className="text-cyan-700 font-mono text-[11px]">
                                            {showHistorialInModal ? '▲ Ocultar' : '▼ Desplegar'}
                                        </span>
                                    </button>
                                    {showHistorialInModal && (
                                        <div className="p-3.5 space-y-2.5 max-h-56 overflow-y-auto bg-slate-50/50">
                                            {colabHistorial.map((hist) => (
                                                <div key={hist.id} className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-cyan-900">
                                                            {hist.tipoCambio === 'COMISION_SERVICIO' ? '🗓️ Comisión' : '🔄 Traslado'}: RBD {hist.rbdDestino} ({hist.establecimientoDestino})
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                            {new Date(hist.createdAt).toLocaleDateString('es-CL')}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-600">
                                                        <span>Desde: <b>{hist.fechaDesde}</b> {hist.fechaHasta ? `hasta <b>${hist.fechaHasta}</b>` : ''}</span>
                                                        <span className="ml-2 text-slate-400">• Registrado por: {hist.creadoPor}</span>
                                                    </div>
                                                    {hist.observacion && (
                                                        <p className="text-[11px] text-slate-500 italic bg-slate-50 p-1.5 rounded">
                                                            "{hist.observacion}"
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                                <span>📧</span>
                                <span>Al guardar, se enviará una notificación automática por correo a la <b>Lista de Distribución</b> configurada para Cambio de RBD.</span>
                            </div>

                            {/* BOTONES DE ACCIÓN */}
                            <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving || !selectedRbdDestino}
                                    className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-cyan-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <>
                                            <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                                            <span>Guardando y enviando alerta...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>💾</span>
                                            <span>Confirmar y Guardar Cambio</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DEDICADO DE HISTORIAL COMPLETO */}
            {isHistorialModalOpen && colabForHistorial && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        {/* CABECERA */}
                        <div className="p-5 bg-gradient-to-r from-slate-900 to-cyan-950 text-white flex items-center justify-between border-b border-slate-800">
                            <div>
                                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                                    Trazabilidad • Auditoría de Traslados
                                </span>
                                <h3 className="text-xl font-black mt-0.5 flex items-center gap-2">
                                    <span>📜</span> Historial de Movimientos de RBD
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsHistorialModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 text-lg transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* CUERPO DEL HISTORIAL */}
                        <div className="p-6 overflow-y-auto space-y-4 flex-1">
                            {/* FICHA RESUMEN DE LA COLABORADORA */}
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                                <div>
                                    <span className="text-slate-500 block">Colaboradora:</span>
                                    <span className="text-sm font-bold text-slate-900">{colabForHistorial.nombre}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">RUT:</span>
                                    <span className="font-mono font-bold text-slate-800">{colabForHistorial.rut}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Establecimiento Dotación:</span>
                                    <span className="font-semibold text-cyan-800">RBD {colabForHistorial.rbd} - {colabForHistorial.establecimiento}</span>
                                </div>
                            </div>

                            {/* LISTADO DE MOVIMIENTOS */}
                            {loadingHistorial ? (
                                <div className="py-12 text-center text-gray-500">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent mb-2"></div>
                                    <p className="text-sm font-semibold">Cargando trazabilidad de traslados...</p>
                                </div>
                            ) : colabHistorial.length === 0 ? (
                                <div className="py-12 text-center text-gray-400">
                                    <span className="text-3xl block mb-2">📋</span>
                                    <p className="text-sm font-bold text-gray-600">No registra cambios de RBD anteriores</p>
                                    <p className="text-xs text-gray-400 mt-1">Esta colaboradora se mantiene en su establecimiento de origen asignado.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-xs text-gray-500 px-1 font-semibold">
                                        <span>Total: {colabHistorial.length} movimiento(s) registrado(s)</span>
                                        <span>Orden: Más reciente primero</span>
                                    </div>

                                    {colabHistorial.map((hist) => (
                                        <div
                                            key={hist.id}
                                            className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs hover:border-cyan-200 transition-all space-y-2.5"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`px-2.5 py-0.5 rounded-md font-bold text-xs ${
                                                    hist.tipoCambio === 'COMISION_SERVICIO'
                                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                                        : 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                                                }`}>
                                                    {hist.tipoCambio === 'COMISION_SERVICIO' ? '🗓️ Comisión de Servicio' : '🔄 Anexo de Traslado'}
                                                </span>
                                                <span className="text-xs text-slate-500 font-mono">
                                                    📅 {new Date(hist.createdAt).toLocaleDateString('es-CL')} a las {new Date(hist.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>

                                            {/* ORIGEN Y DESTINO */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <div>
                                                    <span className="text-slate-400 block text-[11px] font-medium">Establecimiento Origen:</span>
                                                    <span className="font-semibold text-slate-800">
                                                        RBD {hist.rbdOrigen} • {hist.establecimientoOrigen || 'Sin nombre'}
                                                    </span>
                                                    {hist.sucursalOrigen && (
                                                        <span className="text-[10px] text-slate-500 block">({hist.sucursalOrigen})</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <span className="text-cyan-600 block text-[11px] font-bold">Establecimiento Destino:</span>
                                                    <span className="font-bold text-cyan-950">
                                                        RBD {hist.rbdDestino} • {hist.establecimientoDestino}
                                                    </span>
                                                    {hist.sucursalDestino && (
                                                        <span className="text-[10px] text-cyan-700 block">({hist.sucursalDestino})</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* VIGENCIA Y RESPONSABLE */}
                                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
                                                <div>
                                                    <span>Vigencia: </span>
                                                    <b className="text-slate-800">{hist.fechaDesde}</b>
                                                    {hist.fechaHasta ? (
                                                        <span> al <b className="text-slate-800">{hist.fechaHasta}</b></span>
                                                    ) : (
                                                        <span className="text-slate-500"> (Indefinido)</span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-slate-500">
                                                    Registrado por: <b className="text-slate-700">{hist.creadoPor}</b>
                                                </div>
                                            </div>

                                            {hist.observacion && (
                                                <div className="p-2.5 bg-slate-50 border-l-4 border-l-cyan-600 rounded-r-xl text-xs text-slate-700 italic">
                                                    "{hist.observacion}"
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* PIE DEL MODAL DE HISTORIAL */}
                        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                                Trazabilidad auditada y registrada en el sistema
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsHistorialModalOpen(false)}
                                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                            >
                                Cerrar Historial
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
