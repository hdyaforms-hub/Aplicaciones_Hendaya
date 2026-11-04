'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
    AdmHextraRegistroDTO,
    CargaHextraDTO,
    FiltrosMetadatosHextraDTO,
    cambiarEstadoPeriodoCargaHextraAction,
    eliminarCargaHextraAdminAction,
    getAdmHorasExtrasAction,
    getHistorialCargasHextraAction,
    registrarAuditoriaExportacionHextraAction,
    toggleAplicaAdmHorasExtrasAction,
    justificarMasivoHorasExtrasAction
} from './actions'
import {
    Clock,
    Search,
    Calendar,
    Download,
    Loader2,
    Building2,
    RefreshCw,
    X,
    Check,
    Filter,
    Info,
    CheckCircle2,
    AlertCircle,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Lock,
    Unlock,
    FileSpreadsheet,
    ShieldCheck,
    FolderArchive,
    History,
    CheckSquare,
    Square,
    UserCheck,
    School,
    MapPin,
    Trash2
} from 'lucide-react'
import * as xlsx from 'xlsx'
import { formatHorasMinutos, formatHorasMinutosTexto, parseMinutosHhee } from '@/lib/personal-time-format'

interface EstablecimientoOption {
    rbd: number
    establecimiento: string
}

interface AdmHorasExtrasClientProps {
    initialRegistrosData: {
        data: AdmHextraRegistroDTO[]
        total: number
        page: number
        pageSize: number
        sucursales: string[]
        supervisores: string[]
        establecimientos: EstablecimientoOption[]
    }
    initialCargas: CargaHextraDTO[]
    userRbds: number[]
    isAdmin: boolean
    puedeGestionarPeriodos?: boolean
    metadatosFiltros?: FiltrosMetadatosHextraDTO
}

function resolverUsuarioGestion(modificadoPor?: string | null, cargadoPor?: string | null): string {
    const mod = (modificadoPor || '').trim()
    if (mod && mod !== 'Usuario' && mod !== 'Usuario Sistema' && !mod.toLowerCase().includes('por defecto')) {
        return mod
    }
    const carg = (cargadoPor || '').trim()
    if (carg && carg !== 'Usuario' && carg !== 'Usuario Sistema') {
        return carg
    }
    return mod || carg || 'Administrador'
}

export default function AdmHorasExtrasClient({
    initialRegistrosData,
    initialCargas,
    userRbds,
    isAdmin,
    puedeGestionarPeriodos = false,
    metadatosFiltros
}: AdmHorasExtrasClientProps) {
    const [tabActivo, setTabActivo] = useState<'cargas' | 'registros'>('cargas')

    const [cargas, setCargas] = useState<CargaHextraDTO[]>(initialCargas)
    const [registros, setRegistros] = useState<AdmHextraRegistroDTO[]>(initialRegistrosData.data)
    const [totalRegistros, setTotalRegistros] = useState(initialRegistrosData.total)
    const [isPending, startTransition] = useTransition()

    // Filtros Tab Registros
    const [filtroRbd, setFiltroRbd] = useState<number | null>(null)
    const [busquedaRbdNombre, setBusquedaRbdNombre] = useState('')
    const [isRbdDropdownOpen, setIsRbdDropdownOpen] = useState(false)
    const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'ABIERTO' | 'CERRADO'>('TODOS')
    const [filtroCargaId, setFiltroCargaId] = useState<string>('TODOS')
    const [filtroAplica, setFiltroAplica] = useState<'TODOS' | 'APLICA' | 'NO_APLICA'>('TODOS')
    const [filtroSucursal, setFiltroSucursal] = useState('TODAS')
    const [filtroSupervisor, setFiltroSupervisor] = useState('TODOS')
    const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
    const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
    const [busquedaTexto, setBusquedaTexto] = useState('')

    // Nuevos Filtros: Rol, Usuario (según rol), Institución y Comuna
    const [filtroRol, setFiltroRol] = useState<string>('TODOS')
    const [filtroUsuarioId, setFiltroUsuarioId] = useState<string>('TODOS')
    const [filtroInstitucion, setFiltroInstitucion] = useState<string>('TODAS')
    const [filtroComuna, setFiltroComuna] = useState<string>('TODAS')

    // Selección múltiple y Justificación Masiva
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [modalMasivoOpen, setModalMasivoOpen] = useState(false)
    const [aplicaMasivo, setAplicaMasivo] = useState(true)
    const [observacionMasiva, setObservacionMasiva] = useState('')
    const [procesandoMasivo, setProcesandoMasivo] = useState(false)

    // Metadatos
    const rolesDisponibles = useMemo(() => metadatosFiltros?.roles || [], [metadatosFiltros])
    const usuariosDisponibles = useMemo(() => metadatosFiltros?.usuarios || [], [metadatosFiltros])
    const institucionesDisponibles = useMemo(() => metadatosFiltros?.instituciones || [], [metadatosFiltros])
    const comunasDisponibles = useMemo(() => metadatosFiltros?.comunas || [], [metadatosFiltros])

    const usuariosFiltradosPorRol = useMemo(() => {
        if (filtroRol === 'TODOS') return usuariosDisponibles
        return usuariosDisponibles.filter(u => u.roleId === filtroRol)
    }, [usuariosDisponibles, filtroRol])

    // Selección de casos abiertos
    const registrosAbiertosPagina = useMemo(() => {
        return registros.filter(r => r.estado === 'ABIERTO')
    }, [registros])

    const isAllVisibleSelected = registrosAbiertosPagina.length > 0 && registrosAbiertosPagina.every(r => selectedIds.has(r.id))

    const handleSelectAllVisible = () => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (isAllVisibleSelected) {
                registrosAbiertosPagina.forEach(r => next.delete(r.id))
            } else {
                registrosAbiertosPagina.forEach(r => next.add(r.id))
            }
            return next
        })
    }

    const handleToggleSelectOne = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handleClearSelection = () => {
        setSelectedIds(new Set())
    }

    const handleEjecutarJustificacionMasiva = async () => {
        if (selectedIds.size === 0) return
        setProcesandoMasivo(true)
        try {
            const res = await justificarMasivoHorasExtrasAction(
                Array.from(selectedIds),
                aplicaMasivo,
                observacionMasiva
            )
            if (res.success) {
                setRegistros(prev =>
                    prev.map(r => {
                        if (selectedIds.has(r.id)) {
                            return {
                                ...r,
                                aplica: aplicaMasivo,
                                aplicaModificadoPor: 'Tú (Masivo)',
                                aplicaModificadoAt: new Date().toISOString(),
                                aplicaObservacion: observacionMasiva || r.aplicaObservacion
                            }
                        }
                        return r
                    })
                )
                setMensajeFeedback({
                    tipo: 'success',
                    texto: `Se tipificaron exitosamente ${res.actualizados} casos seleccionados (${aplicaMasivo ? 'APLICA' : 'NO APLICA'}).`
                })
                setSelectedIds(new Set())
                setModalMasivoOpen(false)
                setObservacionMasiva('')
                setTimeout(() => setMensajeFeedback(null), 4000)
            } else {
                setMensajeFeedback({ tipo: 'error', texto: res.error || 'Error al procesar justificación masiva' })
            }
        } catch (err: any) {
            setMensajeFeedback({ tipo: 'error', texto: err?.message || 'Error inesperado' })
        } finally {
            setProcesandoMasivo(false)
        }
    }

    // Paginación y Ordenamiento Tab Registros (10 por página)
    const [paginaActual, setPaginaActual] = useState(1)
    const pageSize = 10
    type SortField = 'fecha' | 'rbd' | 'establecimiento' | 'nombreCompleto' | 'supervisor' | 'sucursal' | 'hhee' | 'atraso' | 'aplica' | 'estado'
    const [sortField, setSortField] = useState<SortField>('fecha')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

    const handleSort = (field: SortField) => {
        const newDirection = sortField === field ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'
        setSortField(field)
        setSortDirection(newDirection)
        recargarDatos(1, field, newDirection)
    }

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
        return sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
    }

    // Paginación y Ordenamiento Tab Cargas (10 por página)
    const [paginaCargas, setPaginaCargas] = useState(1)
    const porPaginaCargas = 10
    type SortFieldCargas = 'nombreArchivo' | 'fechaCarga' | 'cargadoPor' | 'totalRegistros' | 'estado'
    const [sortFieldCargas, setSortFieldCargas] = useState<SortFieldCargas>('fechaCarga')
    const [sortDirectionCargas, setSortDirectionCargas] = useState<'asc' | 'desc'>('desc')

    const handleSortCargas = (field: SortFieldCargas) => {
        if (sortFieldCargas === field) {
            setSortDirectionCargas(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortFieldCargas(field)
            setSortDirectionCargas('asc')
        }
        setPaginaCargas(1)
    }

    const renderSortIconCargas = (field: SortFieldCargas) => {
        if (sortFieldCargas !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
        return sortDirectionCargas === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
    }

    const cargasOrdenadas = useMemo(() => {
        return [...cargas].sort((a, b) => {
            let valA: any = a[sortFieldCargas] || ''
            let valB: any = b[sortFieldCargas] || ''
            if (typeof valA === 'string') valA = valA.toLowerCase()
            if (typeof valB === 'string') valB = valB.toLowerCase()

            if (valA < valB) return sortDirectionCargas === 'asc' ? -1 : 1
            if (valA > valB) return sortDirectionCargas === 'asc' ? 1 : -1
            return 0
        })
    }, [cargas, sortFieldCargas, sortDirectionCargas])

    const totalPaginasCargas = Math.ceil(cargasOrdenadas.length / porPaginaCargas) || 1
    const cargasPaginadas = useMemo(() => {
        const start = (paginaCargas - 1) * porPaginaCargas
        return cargasOrdenadas.slice(start, start + porPaginaCargas)
    }, [cargasOrdenadas, paginaCargas, porPaginaCargas])

    // Feedback
    const [guardadoStatus, setGuardadoStatus] = useState<{ [id: string]: boolean }>({})
    const [mensajeFeedback, setMensajeFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

    // Modal para Abrir / Cerrar Período
    const [modalPeriodo, setModalPeriodo] = useState<{
        isOpen: boolean
        carga: CargaHextraDTO | null
        accion: 'CERRAR' | 'ABRIR'
    }>({
        isOpen: false,
        carga: null,
        accion: 'CERRAR'
    })
    const [procesandoPeriodo, setProcesandoPeriodo] = useState(false)

    // Modal de confirmación para Eliminar Carga / Planilla
    const [modalDeleteCarga, setModalDeleteCarga] = useState<{
        isOpen: boolean
        carga: CargaHextraDTO | null
    }>({
        isOpen: false,
        carga: null
    })
    const [procesandoDeleteCarga, setProcesandoDeleteCarga] = useState(false)

    // Autocompletado de Establecimientos
    const establecimientosSugeridos = useMemo(() => {
        if (!busquedaRbdNombre.trim()) return initialRegistrosData.establecimientos.slice(0, 15)
        const term = busquedaRbdNombre.toLowerCase()
        return initialRegistrosData.establecimientos.filter(e =>
            e.rbd.toString().includes(term) ||
            e.establecimiento.toLowerCase().includes(term)
        ).slice(0, 15)
    }, [initialRegistrosData.establecimientos, busquedaRbdNombre])

    // Cargar / Refrescar datos
    const recargarDatos = (
        pagina: number = paginaActual,
        sortBy: SortField = sortField,
        sortDir: 'asc' | 'desc' = sortDirection,
        customFilters?: {
            rol?: string
            usuarioId?: string
            institucion?: string
            comuna?: string
            rbd?: number | null
            cargaId?: string
            estado?: 'TODOS' | 'ABIERTO' | 'CERRADO'
            aplica?: 'TODOS' | 'APLICA' | 'NO_APLICA'
            sucursal?: string
            supervisor?: string
            fechaDesde?: string
            fechaHasta?: string
            search?: string
        }
    ) => {
        const rolActual = customFilters?.rol !== undefined ? customFilters.rol : filtroRol
        const usuarioIdActual = customFilters?.usuarioId !== undefined ? customFilters.usuarioId : filtroUsuarioId
        const institucionActual = customFilters?.institucion !== undefined ? customFilters.institucion : filtroInstitucion
        const comunaActual = customFilters?.comuna !== undefined ? customFilters.comuna : filtroComuna
        const rbdActual = customFilters?.rbd !== undefined ? customFilters.rbd : filtroRbd
        const cargaIdActual = customFilters?.cargaId !== undefined ? customFilters.cargaId : filtroCargaId
        const estadoActual = customFilters?.estado !== undefined ? customFilters.estado : filtroEstado
        const aplicaActual = customFilters?.aplica !== undefined ? customFilters.aplica : filtroAplica
        const sucursalActual = customFilters?.sucursal !== undefined ? customFilters.sucursal : filtroSucursal
        const supervisorActual = customFilters?.supervisor !== undefined ? customFilters.supervisor : filtroSupervisor
        const fechaDesdeActual = customFilters?.fechaDesde !== undefined ? customFilters.fechaDesde : filtroFechaDesde
        const fechaHastaActual = customFilters?.fechaHasta !== undefined ? customFilters.fechaHasta : filtroFechaHasta
        const searchActual = customFilters?.search !== undefined ? customFilters.search : busquedaTexto

        let rbdsFilter: number[] | undefined = undefined
        let rutHashesFilter: string[] | undefined = undefined

        if (usuarioIdActual !== 'TODOS') {
            const u = usuariosDisponibles.find(x => x.id === usuarioIdActual)
            if (u) {
                if (u.hasVisualizacion && u.rutHashes && u.rutHashes.length > 0) {
                    rutHashesFilter = u.rutHashes
                }
                if (u.rbds && u.rbds.length > 0) {
                    rbdsFilter = u.rbds
                }
                if ((!u.rutHashes || u.rutHashes.length === 0) && (!u.rbds || u.rbds.length === 0)) {
                    rbdsFilter = [-999999]
                }
            } else {
                rbdsFilter = [-999999]
            }
        } else if (rolActual !== 'TODOS') {
            const uList = usuariosDisponibles.filter(x => x.roleId === rolActual)
            const roleHashes = Array.from(new Set(uList.flatMap(x => x.rutHashes || [])))
            const roleRbds = Array.from(new Set(uList.flatMap(x => x.rbds || [])))

            if (roleHashes.length > 0) rutHashesFilter = roleHashes
            if (roleRbds.length > 0) rbdsFilter = roleRbds

            if (roleHashes.length === 0 && roleRbds.length === 0) {
                rbdsFilter = [-999999]
            }
        }

        startTransition(async () => {
            const [resReg, resCargas] = await Promise.all([
                getAdmHorasExtrasAction({
                    rbd: rbdActual || undefined,
                    rbds: rbdsFilter,
                    rutHashes: rutHashesFilter,
                    institucion: institucionActual !== 'TODAS' ? institucionActual : undefined,
                    comuna: comunaActual !== 'TODAS' ? comunaActual : undefined,
                    sucursal: sucursalActual,
                    supervisor: supervisorActual,
                    fechaDesde: fechaDesdeActual || undefined,
                    fechaHasta: fechaHastaActual || undefined,
                    aplica: aplicaActual,
                    estado: estadoActual,
                    cargaId: cargaIdActual !== 'TODOS' ? cargaIdActual : undefined,
                    search: searchActual || undefined,
                    page: pagina,
                    pageSize,
                    sortBy,
                    sortDir
                }),
                getHistorialCargasHextraAction()
            ])

            if (resReg.success) {
                setRegistros(resReg.data)
                setTotalRegistros(resReg.total)
                setPaginaActual(pagina)
            }
            if (resCargas.success) {
                setCargas(resCargas.data)
            }
            setMensajeFeedback({ tipo: 'success', texto: 'Datos actualizados correctamente.' })
            setTimeout(() => setMensajeFeedback(null), 3000)
        })
    }

    // Toggle Aplica / No Aplica en Administración
    const handleToggleAplica = async (registroId: string, valorActual: boolean, estadoPeriodo: string) => {
        if (estadoPeriodo === 'CERRADO') {
            setMensajeFeedback({
                tipo: 'error',
                texto: 'El período se encuentra CERRADO. No es posible modificar registros cerrados.'
            })
            setTimeout(() => setMensajeFeedback(null), 4000)
            return
        }

        const nuevoValor = !valorActual

        // Optimistic update
        setRegistros(prev =>
            prev.map(r =>
                r.id === registroId
                    ? {
                        ...r,
                        aplica: nuevoValor,
                        aplicaModificadoPor: 'Tú',
                        aplicaModificadoAt: new Date().toISOString()
                    }
                    : r
            )
        )

        const res = await toggleAplicaAdmHorasExtrasAction(registroId, nuevoValor)
        if (res.success) {
            setGuardadoStatus(prev => ({ ...prev, [registroId]: true }))
            setTimeout(() => {
                setGuardadoStatus(prev => ({ ...prev, [registroId]: false }))
            }, 2000)
        } else {
            recargarDatos()
            setMensajeFeedback({ tipo: 'error', texto: res.error || 'No se pudo actualizar el estado de la hora extra' })
            setTimeout(() => setMensajeFeedback(null), 4000)
        }
    }

    // Control de apertura de modal con verificación de facultades
    const abrirModalPeriodo = (carga: CargaHextraDTO, accion: 'CERRAR' | 'ABRIR') => {
        if (!puedeGestionarPeriodos) {
            setMensajeFeedback({
                tipo: 'error',
                texto: 'Acceso Denegado: No tienes autorización para cerrar o abrir períodos en los módulos de Recursos Humanos. Esta facultad se habilita en "Adm. de cuenta".'
            })
            setTimeout(() => setMensajeFeedback(null), 5000)
            return
        }
        setModalPeriodo({ isOpen: true, carga, accion })
    }

    // Ejecutar Apertura / Cierre de Período
    const ejecutarCambioPeriodo = async () => {
        if (!modalPeriodo.carga) return
        setProcesandoPeriodo(true)

        const res = await cambiarEstadoPeriodoCargaHextraAction(
            modalPeriodo.carga.id,
            modalPeriodo.accion === 'CERRAR' ? 'CERRADO' : 'ABIERTO'
        )

        setProcesandoPeriodo(false)
        setModalPeriodo({ isOpen: false, carga: null, accion: 'CERRAR' })

        if (res.success) {
            setMensajeFeedback({
                tipo: 'success',
                texto: res.message || 'Estado del período actualizado con éxito.'
            })
            recargarDatos(1)
            setTimeout(() => setMensajeFeedback(null), 4000)
        } else {
            setMensajeFeedback({
                tipo: 'error',
                texto: res.error || 'Ocurrió un error al cambiar el estado del período.'
            })
            setTimeout(() => setMensajeFeedback(null), 4000)
        }
    }

    // Ejecutar Eliminación de Carga / Planilla completa
    const handleConfirmarEliminarCarga = async () => {
        if (!modalDeleteCarga.carga) return
        setProcesandoDeleteCarga(true)

        const cargaId = modalDeleteCarga.carga.id
        const nombreArchivo = modalDeleteCarga.carga.nombreArchivo
        const res = await eliminarCargaHextraAdminAction(cargaId)

        setProcesandoDeleteCarga(false)
        setModalDeleteCarga({ isOpen: false, carga: null })

        if (res.success) {
            setMensajeFeedback({
                tipo: 'success',
                texto: `Planilla "${nombreArchivo}" eliminada correctamente (${res.eliminados || 0} registros removidos).`
            })
            setCargas(prev => prev.filter(c => c.id !== cargaId))
            setRegistros(prev => prev.filter(r => r.cargaId !== cargaId))
            setTimeout(() => setMensajeFeedback(null), 5000)
        } else {
            setMensajeFeedback({
                tipo: 'error',
                texto: res.error || 'Error al eliminar la planilla'
            })
            setTimeout(() => setMensajeFeedback(null), 5000)
        }
    }

    // Exportar a Excel (Con Auditoría)
    const exportarExcel = async () => {
        if (registros.length === 0) {
            alert('No hay registros para exportar con los filtros seleccionados.')
            return
        }

        const datosExport = registros.map(r => ({
            'Fecha': r.fecha,
            'RBD': r.rbd || '',
            'Establecimiento': r.establecimiento || '',
            'Institución': r.institucion || '',
            'Comuna': r.comuna || '',
            'Sucursal': r.sucursal,
            'Supervisor': r.supervisor || '',
            'RUT': r.rut,
            'Colaborador': r.nombreCompleto,
            'Cargo': r.cargo || '',
            'Entró': r.entro || '',
            'Salió': r.salio || '',
            'Turno': r.turno || '',
            'HHEE': formatHorasMinutos(r.hhee),
            'Atraso': r.atraso > 0 ? formatHorasMinutos(r.atraso) : '00:00 hrs',
            '¿Aplica HHEE?': r.aplica ? 'SÍ (Aplica)' : 'NO (No Aplica)',
            'Modificado Por': r.aplicaModificadoPor || 'Por Defecto (No Aplica)',
            'Fecha Modificación': r.aplicaModificadoAt ? new Date(r.aplicaModificadoAt).toLocaleString('es-CL') : '',
            'Estado Período': r.estado,
            'Planilla Origen': r.cargaNombreArchivo || '',
            'Usuario que Ingresó o Modificó': resolverUsuarioGestion(r.aplicaModificadoPor, r.cargadoPor)
        }))

        const ws = xlsx.utils.json_to_sheet(datosExport)
        const wb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(wb, ws, 'Adm_Hrs_Extras')
        const nombreArchivo = `Adm_Hrs_Extras_Reporte_${new Date().toISOString().slice(0, 10)}.xlsx`
        xlsx.writeFile(wb, nombreArchivo)

        // Registrar auditoría
        await registrarAuditoriaExportacionHextraAction(
            registros.length,
            `Filtros: [Estado: ${filtroEstado}, Aplica: ${filtroAplica}, Sucursal: ${filtroSucursal}, Carga: ${filtroCargaId}]`
        )
    }

    // Exportar una carga específica a Excel directamente desde la tabla de períodos (sin entrar a los registros)
    const [cargasExportando, setCargasExportando] = useState<Set<string>>(new Set())

    const exportarExcelCarga = async (carga: CargaHextraDTO) => {
        try {
            setCargasExportando(prev => new Set(prev).add(carga.id))

            let regsParaExport = registros.filter(r => r.cargaId === carga.id)
            if (regsParaExport.length === 0 || regsParaExport.length < carga.totalRegistros) {
                const res = await getAdmHorasExtrasAction({
                    cargaId: carga.id,
                    estado: 'TODOS',
                    page: 1,
                    pageSize: 50000
                })
                if (res.success && res.data) {
                    regsParaExport = res.allMatchingData || res.data
                }
            }

            if (regsParaExport.length === 0) {
                alert('No se encontraron registros para exportar en esta planilla.')
                return
            }

            const datosExport = regsParaExport.map(r => ({
                'Fecha': r.fecha,
                'RBD': r.rbd || '',
                'Establecimiento': r.establecimiento || '',
                'Institución': r.institucion || '',
                'Comuna': r.comuna || '',
                'Sucursal': r.sucursal,
                'Supervisor': r.supervisor || '',
                'RUT': r.rut,
                'Colaborador': r.nombreCompleto,
                'Cargo': r.cargo || '',
                'Entró': r.entro || '',
                'Salió': r.salio || '',
                'Turno': r.turno || '',
                'HHEE': formatHorasMinutos(r.hhee),
                'Atraso': r.atraso > 0 ? formatHorasMinutos(r.atraso) : '00:00 hrs',
                '¿Aplica HHEE?': r.aplica ? 'SÍ (Aplica)' : 'NO (No Aplica)',
                'Modificado Por': r.aplicaModificadoPor || 'Por Defecto (No Aplica)',
                'Fecha Modificación': r.aplicaModificadoAt ? new Date(r.aplicaModificadoAt).toLocaleString('es-CL') : '',
                'Estado Período': r.estado,
                'Planilla Origen': r.cargaNombreArchivo || carga.nombreArchivo || '',
                'Usuario que Ingresó o Modificó': resolverUsuarioGestion(r.aplicaModificadoPor, r.cargadoPor || carga.cargadoPor)
            }))

            const ws = xlsx.utils.json_to_sheet(datosExport)
            const wb = xlsx.utils.book_new()
            xlsx.utils.book_append_sheet(wb, ws, 'Hrs_Extras')
            const baseNombre = carga.nombreArchivo.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
            const nombreArchivo = `HrsExtras_${baseNombre}_${carga.estado}_${new Date().toISOString().slice(0, 10)}.xlsx`
            xlsx.writeFile(wb, nombreArchivo)

            // Registrar auditoría
            await registrarAuditoriaExportacionHextraAction(
                regsParaExport.length,
                `Exportación directa desde planilla: ${carga.nombreArchivo} (ID: ${carga.id}, Estado: ${carga.estado})`
            )
        } catch (err: any) {
            console.error('Error al exportar carga de horas extras a Excel:', err)
            alert('Ocurrió un error al exportar la planilla a Excel.')
        } finally {
            setCargasExportando(prev => {
                const next = new Set(prev)
                next.delete(carga.id)
                return next
            })
        }
    }

    // Salto rápido a registros de una carga
    const irARegistrosDeCarga = (cargaId: string) => {
        setFiltroCargaId(cargaId)
        setTabActivo('registros')
        setTimeout(() => recargarDatos(1), 50)
    }

    // Métricas
    const totalAplica = useMemo(() => registros.filter(r => r.aplica).length, [registros])
    const totalNoAplica = useMemo(() => registros.filter(r => !r.aplica).length, [registros])
    const totalMinutosHhee = useMemo(() => registros.reduce((acc, r) => acc + (r.aplica ? parseMinutosHhee(r.hhee) : 0), 0), [registros])
    const totalPaginas = Math.ceil(totalRegistros / pageSize) || 1

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
            {/* Header Corporativo Hendaya */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <div className="flex items-center gap-2 text-cyan-600 font-semibold text-xs tracking-wider uppercase mb-1">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Áreas · Recursos Humanos · Administración</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        Adm. de Hrs Extras
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Control administrativo de horas extras, cierre y apertura de períodos por planilla Excel, auditoría de aprobación y exportación consolidada.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => recargarDatos(1)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-xl border border-gray-200 text-xs font-semibold transition-colors shadow-sm"
                        title="Recargar datos"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-cyan-600' : 'text-gray-500'}`} />
                        <span>Refrescar</span>
                    </button>
                    {tabActivo === 'registros' && (
                        <button
                            onClick={exportarExcel}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                            title="Exportar a Excel con registro de auditoría"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Exportar Excel</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Notificación de feedback */}
            {mensajeFeedback && (
                <div
                    className={`flex items-center gap-2 p-4 rounded-xl text-xs font-medium border shadow-sm transition-all ${
                        mensajeFeedback.tipo === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    {mensajeFeedback.tipo === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    )}
                    <span>{mensajeFeedback.texto}</span>
                </div>
            )}

            {/* Aviso de RBDs restringidos por perfil */}
            {!isAdmin && userRbds.length > 0 && (
                <div className="flex items-center gap-2 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs shadow-sm">
                    <Info className="w-4 h-4 flex-shrink-0 text-amber-600" />
                    <span>
                        Acceso restringido por perfil: Solo puedes visualizar y gestionar los <strong>{userRbds.length}</strong> establecimientos (RBDs) asociados a tu cuenta.
                    </span>
                </div>
            )}

            {/* Barra de Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                <button
                    onClick={() => setTabActivo('cargas')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
                        tabActivo === 'cargas'
                            ? 'bg-cyan-600 text-white shadow-sm'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                >
                    <FolderArchive className="w-4 h-4" />
                    <span>Historial de Documentos Cargados</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tabActivo === 'cargas' ? 'bg-cyan-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {cargas.length}
                    </span>
                </button>
                <button
                    onClick={() => setTabActivo('registros')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
                        tabActivo === 'registros'
                            ? 'bg-cyan-600 text-white shadow-sm'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                >
                    <History className="w-4 h-4" />
                    <span>Historial y Gestión de Registros</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tabActivo === 'registros' ? 'bg-cyan-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {totalRegistros}
                    </span>
                </button>
            </div>

            {/* ======================================================== */}
            {/* TAB 1: HISTORIAL DE DOCUMENTOS CARGADOS (PLANILLAS)     */}
            {/* ======================================================== */}
            {tabActivo === 'cargas' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500 font-medium">Total Planillas Horas Extras</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{cargas.length}</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600">
                                <FileSpreadsheet className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs text-emerald-600 font-medium">Períodos Abiertos</p>
                                <p className="text-2xl font-bold text-emerald-700 mt-1">
                                    {cargas.filter(c => c.estado === 'ABIERTO').length}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <Unlock className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs text-rose-600 font-medium">Períodos Cerrados</p>
                                <p className="text-2xl font-bold text-rose-700 mt-1">
                                    {cargas.filter(c => c.estado === 'CERRADO').length}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                                <Lock className="w-5 h-5" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-gray-900 text-sm">Planillas Excel de Horas Extras Cargadas</h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Al cerrar un período, todos sus puntos quedan congelados y dejan de mostrarse en el módulo operativo de Asistencia.
                                </p>
                            </div>
                        </div>

                        {cargas.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 text-xs">
                                No hay planillas Excel de horas extras registradas en el sistema.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-gray-100 text-gray-600 uppercase text-[10px] tracking-wider font-semibold">
                                        <tr>
                                            <th 
                                                onClick={() => handleSortCargas('nombreArchivo')}
                                                className="py-3 px-4 cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por Archivo"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortFieldCargas === 'nombreArchivo' ? 'text-cyan-800 font-bold' : ''}>Archivo</span>
                                                    {renderSortIconCargas('nombreArchivo')}
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSortCargas('fechaCarga')}
                                                className="py-3 px-4 cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por Fecha Carga"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortFieldCargas === 'fechaCarga' ? 'text-cyan-800 font-bold' : ''}>Fecha Carga</span>
                                                    {renderSortIconCargas('fechaCarga')}
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSortCargas('cargadoPor')}
                                                className="py-3 px-4 cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por Cargado Por"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortFieldCargas === 'cargadoPor' ? 'text-cyan-800 font-bold' : ''}>Cargado Por</span>
                                                    {renderSortIconCargas('cargadoPor')}
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSortCargas('totalRegistros')}
                                                className="py-3 px-4 text-center cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por Registros"
                                            >
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span className={sortFieldCargas === 'totalRegistros' ? 'text-cyan-800 font-bold' : ''}>Registros</span>
                                                    {renderSortIconCargas('totalRegistros')}
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSortCargas('estado')}
                                                className="py-3 px-4 text-center cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por Estado"
                                            >
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span className={sortFieldCargas === 'estado' ? 'text-cyan-800 font-bold' : ''}>Estado Período</span>
                                                    {renderSortIconCargas('estado')}
                                                </div>
                                            </th>
                                            <th className="py-3 px-4">Detalle Cierre</th>
                                            <th className="py-3 px-4 text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-gray-700">
                                        {cargasPaginadas.map(c => {
                                            const esCerrado = c.estado === 'CERRADO'
                                            return (
                                                <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                                                    <td className="py-3 px-4 font-semibold text-gray-900">
                                                        <div className="flex items-center gap-2">
                                                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                                            <span className="truncate max-w-xs" title={c.nombreArchivo}>
                                                                {c.nombreArchivo}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-gray-500">
                                                        {c.fechaCarga ? new Date(c.fechaCarga).toLocaleString('es-CL') : '-'}
                                                    </td>
                                                    <td className="py-3 px-4 font-medium text-gray-700">
                                                        {c.cargadoPor}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                                                            {c.totalRegistros} filas
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        {esCerrado ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                                <Lock className="w-3 h-3 text-rose-600" />
                                                                <span>CERRADO</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                <Unlock className="w-3 h-3 text-emerald-600" />
                                                                <span>ABIERTO</span>
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-gray-500 text-[11px]">
                                                        {esCerrado ? (
                                                            <div>
                                                                <p className="font-semibold text-gray-700">Por: {c.cerradoPor || 'Admin'}</p>
                                                                <p className="text-[10px] text-gray-400">
                                                                    {c.cerradoAt ? new Date(c.cerradoAt).toLocaleString('es-CL') : ''}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 italic">En revisión activa</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => irARegistrosDeCarga(c.id)}
                                                                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-[11px] transition-colors"
                                                                title="Ver registros vinculados a esta planilla"
                                                            >
                                                                Ver registros
                                                            </button>

                                                            <button
                                                                onClick={() => exportarExcelCarga(c)}
                                                                disabled={cargasExportando.has(c.id)}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold rounded-lg text-[11px] transition-colors disabled:opacity-50"
                                                                title="Exportar esta planilla directamente a Excel (abierta o cerrada)"
                                                            >
                                                                {cargasExportando.has(c.id) ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                                                                ) : (
                                                                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                                                                )}
                                                                <span>Exportar Excel</span>
                                                            </button>

                                                            {esCerrado ? (
                                                                <button
                                                                    onClick={() => abrirModalPeriodo(c, 'ABRIR')}
                                                                    className={`flex items-center gap-1 px-2.5 py-1.5 font-semibold rounded-lg text-[11px] transition-colors ${
                                                                        !puedeGestionarPeriodos
                                                                            ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                                                                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                                    }`}
                                                                    title={!puedeGestionarPeriodos ? 'No tienes autorización para abrir períodos (Requiere check en Adm. de cuenta)' : 'Reabrir período para permitir modificaciones'}
                                                                >
                                                                    <Unlock className="w-3 h-3" />
                                                                    <span>Abrir</span>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => abrirModalPeriodo(c, 'CERRAR')}
                                                                    className={`flex items-center gap-1 px-2.5 py-1.5 font-semibold rounded-lg text-[11px] transition-colors ${
                                                                        !puedeGestionarPeriodos
                                                                            ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                                                                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                                                    }`}
                                                                    title={!puedeGestionarPeriodos ? 'No tienes autorización para cerrar períodos (Requiere check en Adm. de cuenta)' : 'Cerrar período y congelar registros cargados'}
                                                                >
                                                                    <Lock className="w-3 h-3" />
                                                                    <span>Cerrar período</span>
                                                                </button>
                                                            )}

                                                            {(isAdmin || puedeGestionarPeriodos) && (
                                                                <button
                                                                    onClick={() => setModalDeleteCarga({ isOpen: true, carga: c })}
                                                                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                    title="Eliminar planilla y sus registros"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Paginación Cargas */}
                        {cargasOrdenadas.length > porPaginaCargas && (
                            <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50">
                                <span>
                                    Mostrando {((paginaCargas - 1) * porPaginaCargas) + 1} - {Math.min(paginaCargas * porPaginaCargas, cargasOrdenadas.length)} de {cargasOrdenadas.length} planillas
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={paginaCargas === 1}
                                        onClick={() => setPaginaCargas(p => Math.max(p - 1, 1))}
                                        className="px-3 py-1.5 bg-white hover:bg-gray-50 disabled:opacity-40 rounded-lg text-gray-700 border border-gray-200 font-semibold shadow-2xs"
                                    >
                                        Anterior
                                    </button>
                                    <span className="font-semibold text-gray-700">
                                        Página {paginaCargas} de {totalPaginasCargas}
                                    </span>
                                    <button
                                        disabled={paginaCargas >= totalPaginasCargas}
                                        onClick={() => setPaginaCargas(p => Math.min(p + 1, totalPaginasCargas))}
                                        className="px-3 py-1.5 bg-white hover:bg-gray-50 disabled:opacity-40 rounded-lg text-gray-700 border border-gray-200 font-semibold shadow-2xs"
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* TAB 2: HISTORIAL Y GESTIÓN DE REGISTROS                 */}
            {/* ======================================================== */}
            {tabActivo === 'registros' && (
                <div className="space-y-4">
                    {/* Tarjetas de Métricas */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Registros</span>
                            <p className="text-xl font-bold text-gray-900 mt-0.5">{totalRegistros}</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Aplica HHEE</span>
                            <p className="text-xl font-bold text-emerald-700 mt-0.5">{totalAplica}</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">No Aplica HHEE</span>
                            <p className="text-xl font-bold text-amber-700 mt-0.5">{totalNoAplica}</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-cyan-600 uppercase tracking-wider">Horas HHEE Aprobadas</span>
                            <p className="text-xl font-bold text-cyan-700 mt-0.5">
                                {Math.floor(totalMinutosHhee / 60)}h {totalMinutosHhee % 60}m
                            </p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Períodos Cerrados</span>
                            <p className="text-xl font-bold text-rose-700 mt-0.5">
                                {registros.filter(r => r.estado === 'CERRADO').length}
                            </p>
                        </div>
                    </div>

                    {/* Barra de Filtros */}
                    <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                                <Filter className="w-3.5 h-3.5 text-cyan-600" />
                                <span>Filtros de Búsqueda Avanzada</span>
                            </div>
                            {(busquedaRbdNombre || filtroRbd || filtroEstado !== 'TODOS' || filtroCargaId !== 'TODOS' || filtroAplica !== 'TODOS' || filtroSucursal !== 'TODAS' || filtroSupervisor !== 'TODOS' || filtroFechaDesde || filtroFechaHasta || busquedaTexto || filtroRol !== 'TODOS' || filtroUsuarioId !== 'TODOS' || filtroInstitucion !== 'TODAS' || filtroComuna !== 'TODAS') && (
                                <button
                                    onClick={() => {
                                        setBusquedaRbdNombre('')
                                        setFiltroRbd(null)
                                        setFiltroEstado('TODOS')
                                        setFiltroCargaId('TODOS')
                                        setFiltroAplica('TODOS')
                                        setFiltroSucursal('TODAS')
                                        setFiltroSupervisor('TODOS')
                                        setFiltroFechaDesde('')
                                        setFiltroFechaHasta('')
                                        setBusquedaTexto('')
                                        setFiltroRol('TODOS')
                                        setFiltroUsuarioId('TODOS')
                                        setFiltroInstitucion('TODAS')
                                        setFiltroComuna('TODAS')
                                        setTimeout(() => recargarDatos(1, sortField, sortDirection, {
                                            rol: 'TODOS',
                                            usuarioId: 'TODOS',
                                            institucion: 'TODAS',
                                            comuna: 'TODAS',
                                            rbd: null,
                                            cargaId: 'TODOS',
                                            estado: 'TODOS',
                                            aplica: 'TODOS',
                                            sucursal: 'TODAS',
                                            supervisor: 'TODOS',
                                            fechaDesde: '',
                                            fechaHasta: '',
                                            search: ''
                                        }), 50)
                                    }}
                                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                    <span>Limpiar Filtros</span>
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
                            {/* Filtro por Rol */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-cyan-600" />
                                    <span>Rol de Usuario</span>
                                </label>
                                <select
                                    value={filtroRol}
                                    onChange={e => {
                                        const val = e.target.value
                                        setFiltroRol(val)
                                        setFiltroUsuarioId('TODOS')
                                        setTimeout(() => recargarDatos(1, sortField, sortDirection, { rol: val, usuarioId: 'TODOS' }), 50)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                                >
                                    <option value="TODOS">Todos los Roles</option>
                                    {rolesDisponibles.map(r => (
                                        <option key={r.id} value={r.id}>
                                            {r.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro por Usuario según Rol */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                                    <UserCheck className="w-3 h-3 text-cyan-600" />
                                    <span>Usuario {filtroRol !== 'TODOS' ? '(del rol)' : ''}</span>
                                </label>
                                <select
                                    value={filtroUsuarioId}
                                    onChange={e => {
                                        const val = e.target.value
                                        setFiltroUsuarioId(val)
                                        setTimeout(() => recargarDatos(1, sortField, sortDirection, { usuarioId: val }), 50)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white truncate"
                                >
                                    <option value="TODOS">Todos los Usuarios</option>
                                    {usuariosFiltradosPorRol.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.name || u.username} ({u.hasVisualizacion && u.totalTrabajadores ? `${u.totalTrabajadores} trab. / ` : ''}{u.rbds.length} RBDs)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro por Institución */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                                    <School className="w-3 h-3 text-cyan-600" />
                                    <span>Institución</span>
                                </label>
                                <select
                                    value={filtroInstitucion}
                                    onChange={e => {
                                        const val = e.target.value
                                        setFiltroInstitucion(val)
                                        setTimeout(() => recargarDatos(1, sortField, sortDirection, { institucion: val }), 50)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                                >
                                    <option value="TODAS">Todas las Instituciones</option>
                                    {institucionesDisponibles.map(inst => (
                                        <option key={inst} value={inst}>
                                            {inst}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro por Comuna */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-cyan-600" />
                                    <span>Comuna</span>
                                </label>
                                <select
                                    value={filtroComuna}
                                    onChange={e => {
                                        const val = e.target.value
                                        setFiltroComuna(val)
                                        setTimeout(() => recargarDatos(1, sortField, sortDirection, { comuna: val }), 50)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                                >
                                    <option value="TODAS">Todas las Comunas</option>
                                    {comunasDisponibles.map(com => (
                                        <option key={com} value={com}>
                                            {com}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {/* Autocompletado RBD / Establecimiento */}
                            <div className="relative">
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">RBD / Establecimiento</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Buscar por RBD o colegio..."
                                        value={busquedaRbdNombre}
                                        onChange={e => {
                                            setBusquedaRbdNombre(e.target.value)
                                            setFiltroRbd(null)
                                            setIsRbdDropdownOpen(true)
                                        }}
                                        onFocus={() => setIsRbdDropdownOpen(true)}
                                        className="w-full pl-8 pr-7 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                                    />
                                    <Building2 className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                                    {busquedaRbdNombre && (
                                        <button
                                            onClick={() => {
                                                setBusquedaRbdNombre('')
                                                setFiltroRbd(null)
                                            }}
                                            className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                                {isRbdDropdownOpen && establecimientosSugeridos.length > 0 && (
                                    <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                        {establecimientosSugeridos.map(item => (
                                            <button
                                                key={item.rbd}
                                                type="button"
                                                onClick={() => {
                                                    setFiltroRbd(item.rbd)
                                                    setBusquedaRbdNombre(`${item.rbd} - ${item.establecimiento}`)
                                                    setIsRbdDropdownOpen(false)
                                                }}
                                                className="w-full text-left px-3 py-2 hover:bg-cyan-50 text-xs border-b border-gray-50 flex items-center justify-between text-gray-700"
                                            >
                                                <span className="font-medium truncate">{item.establecimiento}</span>
                                                <span className="text-[10px] font-bold text-cyan-600 bg-cyan-100 px-1.5 py-0.5 rounded ml-2">
                                                    RBD {item.rbd}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Filtro Estado del Período */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Estado Período</label>
                                <select
                                    value={filtroEstado}
                                    onChange={e => setFiltroEstado(e.target.value as any)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                                >
                                    <option value="TODOS">Todos los Estados</option>
                                    <option value="ABIERTO">Abiertos (Modificables)</option>
                                    <option value="CERRADO">Cerrados (Bloqueados)</option>
                                </select>
                            </div>

                            {/* Filtro Planilla / Carga */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Planilla Origen</label>
                                <select
                                    value={filtroCargaId}
                                    onChange={e => setFiltroCargaId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white truncate"
                                >
                                    <option value="TODOS">Todas las planillas</option>
                                    {cargas.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.nombreArchivo} ({c.estado})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro Aplica / No Aplica */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">¿Aplica Hr Extra?</label>
                                <select
                                    value={filtroAplica}
                                    onChange={e => setFiltroAplica(e.target.value as any)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                                >
                                    <option value="TODOS">Todos</option>
                                    <option value="APLICA">Solo Aplica</option>
                                    <option value="NO_APLICA">Solo No Aplica</option>
                                </select>
                            </div>

                            {/* Sucursal */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Sucursal / Sede</label>
                                <select
                                    value={filtroSucursal}
                                    onChange={e => setFiltroSucursal(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                                >
                                    <option value="TODAS">Todas las Sucursales</option>
                                    {initialRegistrosData.sucursales.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Supervisor */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Supervisor</label>
                                <select
                                    value={filtroSupervisor}
                                    onChange={e => setFiltroSupervisor(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                                >
                                    <option value="TODOS">Todos los Supervisores</option>
                                    {initialRegistrosData.supervisores.map(sup => (
                                        <option key={sup} value={sup}>{sup}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Fecha Desde */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Fecha Desde</label>
                                <input
                                    type="date"
                                    value={filtroFechaDesde}
                                    onChange={e => setFiltroFechaDesde(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                                />
                            </div>

                            {/* Fecha Hasta */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Fecha Hasta</label>
                                <input
                                    type="date"
                                    value={filtroFechaHasta}
                                    onChange={e => setFiltroFechaHasta(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                                />
                            </div>

                            {/* Búsqueda general */}
                            <div className="md:col-span-4">
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Buscar por RUT, Nombre o Cargo</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Escribe para buscar..."
                                        value={busquedaTexto}
                                        onChange={e => setBusquedaTexto(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') recargarDatos(1) }}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                                    />
                                    <button
                                        onClick={() => recargarDatos(1)}
                                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                                    >
                                        Filtrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Barra de Selección Masiva */}
                    {selectedIds.size > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-cyan-50 border border-cyan-200 rounded-2xl text-xs shadow-sm animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-2 text-cyan-900 font-semibold">
                                <CheckSquare className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                                <span>
                                    {selectedIds.size} {selectedIds.size === 1 ? 'caso abierto seleccionado' : 'casos abiertos seleccionados'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleClearSelection}
                                    className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl font-medium transition-colors"
                                >
                                    Deseleccionar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setModalMasivoOpen(true)}
                                    className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold shadow-sm flex items-center gap-1.5 transition-colors"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Justificar en Forma Masiva ({selectedIds.size})</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tabla de Registros */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        {registros.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 text-xs">
                                No se encontraron registros de horas extras que coincidan con los filtros aplicados.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-gray-100 text-gray-600 uppercase text-[10px] tracking-wider font-semibold">
                                        <tr>
                                            <th className="py-3 px-3 text-center w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={isAllVisibleSelected}
                                                    onChange={handleSelectAllVisible}
                                                    className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                                    title="Seleccionar todos los casos abiertos de esta página"
                                                />
                                            </th>
                                            <th 
                                                onClick={() => handleSort('fecha')}
                                                className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por Fecha"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortField === 'fecha' ? 'text-cyan-800 font-bold' : ''}>Fecha</span>
                                                    {renderSortIcon('fecha')}
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSort('rbd')}
                                                className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por RBD / Establecimiento"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortField === 'rbd' ? 'text-cyan-800 font-bold' : ''}>RBD / Establecimiento</span>
                                                    {renderSortIcon('rbd')}
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSort('nombreCompleto')}
                                                className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por Colaborador"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortField === 'nombreCompleto' ? 'text-cyan-800 font-bold' : ''}>Colaborador</span>
                                                    {renderSortIcon('nombreCompleto')}
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSort('supervisor')}
                                                className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por Supervisor / Sucursal"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortField === 'supervisor' ? 'text-cyan-800 font-bold' : ''}>Supervisor / Sucursal</span>
                                                    {renderSortIcon('supervisor')}
                                                </div>
                                            </th>
                                            <th className="py-3 px-3 text-center">Horario</th>
                                            <th 
                                                onClick={() => handleSort('hhee')}
                                                className="py-3 px-3 text-center cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por Horas Extras"
                                            >
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span className={sortField === 'hhee' ? 'text-cyan-800 font-bold' : ''}>Horas Extras</span>
                                                    {renderSortIcon('hhee')}
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSort('estado')}
                                                className="py-3 px-3 text-center cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por Estado Período"
                                            >
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span className={sortField === 'estado' ? 'text-cyan-800 font-bold' : ''}>Estado Período</span>
                                                    {renderSortIcon('estado')}
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSort('aplica')}
                                                className="py-3 px-3 text-center cursor-pointer select-none group hover:bg-gray-200 transition-colors"
                                                title="Ordenar por ¿Aplica Hr Extra?"
                                            >
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span className={sortField === 'aplica' ? 'text-cyan-800 font-bold' : ''}>¿Aplica Hr Extra?</span>
                                                    {renderSortIcon('aplica')}
                                                </div>
                                            </th>
                                            <th className="py-3 px-3">Trazabilidad</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-gray-700">
                                        {registros.map(r => {
                                            const esCerrado = r.estado === 'CERRADO'
                                            return (
                                                <tr key={r.id} className={`transition-colors ${selectedIds.has(r.id) ? 'bg-cyan-50/60' : 'hover:bg-gray-50/80'}`}>
                                                    {/* Checkbox Selección */}
                                                    <td className="py-3 px-3 text-center">
                                                        {esCerrado ? (
                                                            <span title="Período CERRADO (Bloqueado)">
                                                                <Lock className="w-3.5 h-3.5 text-gray-300 mx-auto" />
                                                            </span>
                                                        ) : (
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIds.has(r.id)}
                                                                onChange={() => handleToggleSelectOne(r.id)}
                                                                className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                                            />
                                                        )}
                                                    </td>

                                                    {/* Fecha */}
                                                    <td className="py-3 px-3 font-semibold text-gray-900 whitespace-nowrap">
                                                        {r.fecha}
                                                    </td>

                                                    {/* RBD / Establecimiento */}
                                                    <td className="py-3 px-3">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="font-bold text-gray-900">{r.establecimiento}</span>
                                                                {r.institucion && (
                                                                    <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                                        {r.institucion}
                                                                    </span>
                                                                )}
                                                                {r.comuna && (
                                                                    <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
                                                                        <MapPin className="w-2.5 h-2.5" />
                                                                        {r.comuna}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {r.rbd && (
                                                                <span className="text-[10px] font-semibold text-cyan-600">RBD: {r.rbd}</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Colaborador */}
                                                    <td className="py-3 px-3">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-gray-900">{r.nombreCompleto}</span>
                                                            <span className="text-[11px] text-gray-500 font-mono">{r.rut}</span>
                                                            {r.cargo && (
                                                                <span className="text-[10px] text-gray-400 truncate max-w-xs">{r.cargo}</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Supervisor y Sucursal */}
                                                    <td className="py-3 px-3">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-gray-700">{r.supervisor || 'Sin Supervisor'}</span>
                                                            <span className="text-[10px] text-gray-400">{r.sucursal}</span>
                                                        </div>
                                                    </td>

                                                    {/* Horario */}
                                                    <td className="py-3 px-3 text-center">
                                                        <div className="flex flex-col text-[11px]">
                                                            <span className="font-semibold text-gray-800">{r.entro || '--'} - {r.salio || '--'}</span>
                                                            {r.turno && (
                                                                <span className="text-[10px] text-gray-400">{r.turno}</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Horas Extras */}
                                                    <td className="py-3 px-3 text-center whitespace-nowrap">
                                                        <div className="flex flex-col items-center justify-center">
                                                            <span className="font-bold text-cyan-800 text-xs font-mono">
                                                                {formatHorasMinutos(r.hhee)}
                                                            </span>
                                                            {r.hhee > 0 && (
                                                                <span className="text-[10px] text-cyan-600 font-medium">
                                                                    {formatHorasMinutosTexto(r.hhee)}
                                                                </span>
                                                            )}
                                                            {r.atraso > 0 && (
                                                                <span className="text-[10px] text-rose-500 font-medium mt-0.5">
                                                                    Atraso: {formatHorasMinutos(r.atraso)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Estado Período */}
                                                    <td className="py-3 px-3 text-center whitespace-nowrap">
                                                        {esCerrado ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                                <Lock className="w-3 h-3 text-rose-600" />
                                                                <span>CERRADO</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                <Unlock className="w-3 h-3 text-emerald-600" />
                                                                <span>ABIERTO</span>
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Botón Aplica / No Aplica */}
                                                    <td className="py-3 px-3 text-center whitespace-nowrap">
                                                        {esCerrado ? (
                                                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-400 text-xs font-semibold">
                                                                <Lock className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                                                                <span>{r.aplica ? 'Aplica (Bloqueado)' : 'No Aplica (Bloqueado)'}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="inline-flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleToggleAplica(r.id, r.aplica, r.estado)}
                                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm ${
                                                                        r.aplica
                                                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                                            : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300'
                                                                    }`}
                                                                    title="Haz clic para alternar entre Aplica y No Aplica"
                                                                >
                                                                    {r.aplica ? (
                                                                        <>
                                                                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                                            <span>Aplica</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <X className="w-3.5 h-3.5 stroke-[3]" />
                                                                            <span>No Aplica</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                                {guardadoStatus[r.id] && (
                                                                    <span className="text-[10px] font-bold text-emerald-600 animate-pulse">
                                                                        ✓ Guardado
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Trazabilidad */}
                                                    <td className="py-3 px-3 text-[11px] text-gray-500">
                                                        <div className="flex flex-col">
                                                            {r.aplicaModificadoPor ? (
                                                                <>
                                                                    <span className="font-semibold text-gray-700">Por: {r.aplicaModificadoPor}</span>
                                                                    <span className="text-[10px] text-gray-400">
                                                                        {r.aplicaModificadoAt ? new Date(r.aplicaModificadoAt).toLocaleString('es-CL') : ''}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <span className="text-gray-400 italic">Por defecto (No Aplica)</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Paginación */}
                        {totalRegistros > pageSize && (
                            <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                                <span>
                                    Mostrando {((paginaActual - 1) * pageSize) + 1} - {Math.min(paginaActual * pageSize, totalRegistros)} de {totalRegistros} registros
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        disabled={paginaActual === 1 || isPending}
                                        onClick={() => recargarDatos(paginaActual - 1)}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-semibold"
                                    >
                                        Anterior
                                    </button>
                                    <span className="px-3 py-1.5 font-bold text-gray-800">
                                        {paginaActual} / {totalPaginas}
                                    </span>
                                    <button
                                        disabled={paginaActual === totalPaginas || isPending}
                                        onClick={() => recargarDatos(paginaActual + 1)}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-semibold"
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de confirmación para Eliminar Carga / Planilla */}
            {modalDeleteCarga.isOpen && modalDeleteCarga.carga && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-rose-50 text-rose-600">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-base">¿Eliminar Planilla Completa?</h3>
                                <p className="text-xs text-gray-500 truncate max-w-xs">{modalDeleteCarga.carga.nombreArchivo}</p>
                            </div>
                        </div>

                        <div className="text-xs text-gray-600 bg-rose-50/60 border border-rose-100 p-3.5 rounded-2xl space-y-1.5">
                            <p className="font-semibold text-rose-900">
                                Esta acción es irreversible
                            </p>
                            <p>
                                Se eliminarán <strong>{modalDeleteCarga.carga.totalRegistros} registros</strong> asociados a esta planilla en el historial de horas extras.
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setModalDeleteCarga({ isOpen: false, carga: null })}
                                disabled={procesandoDeleteCarga}
                                className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-semibold"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmarEliminarCarga}
                                disabled={procesandoDeleteCarga}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                            >
                                {procesandoDeleteCarga ? 'Eliminando...' : 'Sí, Eliminar Planilla'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación para Abrir / Cerrar Período */}
            {modalPeriodo.isOpen && modalPeriodo.carga && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                modalPeriodo.accion === 'CERRAR' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                                {modalPeriodo.accion === 'CERRAR' ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-base">
                                    {modalPeriodo.accion === 'CERRAR' ? '¿Cerrar período de horas extras?' : '¿Reabrir período de horas extras?'}
                                </h3>
                                <p className="text-xs text-gray-500">
                                    Planilla: <strong>{modalPeriodo.carga.nombreArchivo}</strong>
                                </p>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs text-gray-600 space-y-2">
                            {modalPeriodo.accion === 'CERRAR' ? (
                                <>
                                    <p>
                                        Al cerrar este período, los <strong>{modalPeriodo.carga.totalRegistros}</strong> registros de esta planilla quedarán <strong>bloqueados</strong>.
                                    </p>
                                    <p className="text-rose-700 font-medium">
                                        ⚠️ Esta información dejará de mostrarse en el módulo operativo de Asistencia y los usuarios ya no podrán alterar la condición "Aplica / No aplica".
                                    </p>
                                </>
                            ) : (
                                <p>
                                    Al reabrir este período, los <strong>{modalPeriodo.carga.totalRegistros}</strong> registros volverán a estar disponibles y podrán modificarse nuevamente en Asistencia.
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                disabled={procesandoPeriodo}
                                onClick={() => setModalPeriodo({ isOpen: false, carga: null, accion: 'CERRAR' })}
                                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={procesandoPeriodo}
                                onClick={ejecutarCambioPeriodo}
                                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-colors flex items-center gap-1.5 ${
                                    modalPeriodo.accion === 'CERRAR'
                                        ? 'bg-rose-600 hover:bg-rose-700'
                                        : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                            >
                                {procesandoPeriodo && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                <span>
                                    {modalPeriodo.accion === 'CERRAR' ? 'Sí, Cerrar Período' : 'Sí, Reabrir Período'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Justificación Masiva */}
            {modalMasivoOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center flex-shrink-0">
                                <CheckSquare className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-base">Justificación Masiva de Horas Extras</h3>
                                <p className="text-xs text-gray-500">
                                    Se aplicará la resolución a <strong>{selectedIds.size}</strong> casos seleccionados.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">¿Aplica Horas Extras? *</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAplicaMasivo(true)}
                                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                                            aplicaMasivo
                                                ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                        <span>SÍ (Aplica)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAplicaMasivo(false)}
                                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                                            !aplicaMasivo
                                                ? 'bg-rose-50 border-rose-500 text-rose-800'
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        <X className="w-3.5 h-3.5 text-rose-600 stroke-[3]" />
                                        <span>NO (No Aplica)</span>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Observación Masiva (Opcional)</label>
                                <textarea
                                    rows={2}
                                    value={observacionMasiva}
                                    onChange={e => setObservacionMasiva(e.target.value)}
                                    placeholder="Detalle o motivo de la justificación masiva..."
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                                />
                            </div>

                            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                <span>Solo se actualizarán los casos pertenecientes a períodos ABIERTOS. Esta acción quedará registrada en el módulo de auditoría.</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                disabled={procesandoMasivo}
                                onClick={() => {
                                    setModalMasivoOpen(false)
                                    setObservacionMasiva('')
                                }}
                                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={procesandoMasivo}
                                onClick={handleEjecutarJustificacionMasiva}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-colors flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
                            >
                                {procesandoMasivo && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                <span>Aplicar a {selectedIds.size} casos</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
