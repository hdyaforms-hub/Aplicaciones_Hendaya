'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
    AdmAsistenciaRegistroDTO,
    CargaHistorialDTO,
    asignarCriterioAdminAction,
    asignarCriterioMasivoAction,
    cambiarEstadoPeriodoCargaAction,
    eliminarCargaAusentismoAdminAction,
    getAdmAusentismoRegistrosAction,
    getHistorialCargasAction,
    registrarAuditoriaExportacionAction,
    FiltrosMetadatosDTO
} from './actions'
import {
    Users,
    Search,
    Calendar,
    Download,
    Loader2,
    Building2,
    RefreshCw,
    X,
    Check,
    SlidersHorizontal,
    Info,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Lock,
    Unlock,
    FileSpreadsheet,
    ShieldCheck,
    FolderArchive,
    History,
    AlertCircle,
    CheckCircle2,
    ChevronRight,
    Filter,
    Eye,
    Paperclip,
    CheckSquare,
    Square,
    UserCheck,
    School,
    MapPin,
    Trash2
} from 'lucide-react'
import * as xlsx from 'xlsx'
import DocumentoPreviewModal, { DocumentoPreviewData } from '@/components/DocumentoPreviewModal'

interface CriterioItem {
    id: string
    nombre: string
    color: string | null
    activo: boolean
}

interface EstablecimientoItem {
    rbd: number
    establecimiento: string
}

interface AdmAusentismoClientProps {
    initialRegistros: AdmAsistenciaRegistroDTO[]
    initialCargas: CargaHistorialDTO[]
    criterios: CriterioItem[]
    establecimientos: EstablecimientoItem[]
    userRbds: number[]
    isAdmin: boolean
    puedeGestionarPeriodos?: boolean
    metadatosFiltros?: FiltrosMetadatosDTO
}

function resolverUsuarioGestion(actualizadoPor?: string | null, creadoPor?: string | null): string {
    const act = (actualizadoPor || '').trim()
    if (act && act !== 'Usuario' && act !== 'Usuario Sistema' && act !== 'Por Defecto') {
        return act
    }
    const cre = (creadoPor || '').trim()
    if (cre && cre !== 'Usuario' && cre !== 'Usuario Sistema') {
        return cre
    }
    return act || cre || 'Administrador'
}

export default function AdmAusentismoClient({
    initialRegistros,
    initialCargas,
    criterios,
    establecimientos,
    userRbds,
    isAdmin,
    puedeGestionarPeriodos = false,
    metadatosFiltros
}: AdmAusentismoClientProps) {
    // Pestañas activas: 'cargas' (Historial Documentos) | 'registros' (Historial de Registros)
    const [tabActivo, setTabActivo] = useState<'cargas' | 'registros'>('cargas')

    // Estado del modal de vista previa de documentos
    const [previewDoc, setPreviewDoc] = useState<DocumentoPreviewData | null>(null)

    const [registros, setRegistros] = useState<AdmAsistenciaRegistroDTO[]>(initialRegistros)
    const [cargas, setCargas] = useState<CargaHistorialDTO[]>(initialCargas)
    const [isPending, startTransition] = useTransition()

    // Filtros Tab Registros
    const [busquedaRbdNombre, setBusquedaRbdNombre] = useState('')
    const [filtroRbdSeleccionado, setFiltroRbdSeleccionado] = useState<number | null>(null)
    const [filtroFecha, setFiltroFecha] = useState('')
    const [busquedaTexto, setBusquedaTexto] = useState('')
    const [filtroSucursal, setFiltroSucursal] = useState<string>('TODAS')
    const [filtroCriterio, setFiltroCriterio] = useState<string>('TODOS')
    const [filtroEstado, setFiltroEstado] = useState<string>('TODOS')
    const [filtroCargaId, setFiltroCargaId] = useState<string>('TODOS')

    // Nuevos filtros: Rol, Usuario (según rol), Institución y Comuna
    const [filtroRol, setFiltroRol] = useState<string>('TODOS')
    const [filtroUsuarioId, setFiltroUsuarioId] = useState<string>('TODOS')
    const [filtroInstitucion, setFiltroInstitucion] = useState<string>('TODAS')
    const [filtroComuna, setFiltroComuna] = useState<string>('TODAS')

    // Selección múltiple y Justificación Masiva
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [modalMasivoOpen, setModalMasivoOpen] = useState(false)
    const [criterioMasivoSeleccionado, setCriterioMasivoSeleccionado] = useState<string>('')
    const [observacionMasiva, setObservacionMasiva] = useState<string>('')
    const [procesandoMasivo, setProcesandoMasivo] = useState(false)

    // Control autocompletado RBD
    const [isRbdDropdownOpen, setIsRbdDropdownOpen] = useState(false)

    // Estado de retroalimentación de guardado
    const [guardadoStatus, setGuardadoStatus] = useState<{ [id: string]: boolean }>({})
    const [mensajeFeedback, setMensajeFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

    // Modal de confirmación para Cerrar / Abrir Período
    const [modalPeriodo, setModalPeriodo] = useState<{
        isOpen: boolean
        carga: CargaHistorialDTO | null
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
        carga: CargaHistorialDTO | null
    }>({
        isOpen: false,
        carga: null
    })
    const [procesandoDeleteCarga, setProcesandoDeleteCarga] = useState(false)

    // Paginación Tab Registros
    const [paginaActual, setPaginaActual] = useState(1)
    const porPagina = 10

    // Ordenamiento Tab Registros
    type SortField = 'fecha' | 'rbd' | 'establecimiento' | 'supervisorNombre' | 'rut' | 'nombreCompleto' | 'criterioNombre' | 'estado'
    const [sortField, setSortField] = useState<SortField>('fecha')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
        setPaginaActual(1)
    }

    // Paginación y ordenamiento Tab Cargas (10 por página)
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

    const renderSortIconCargas = (field: SortFieldCargas) => {
        if (sortFieldCargas !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
        return sortDirectionCargas === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
    }

    const renderSortIconRegistros = (field: SortField) => {
        if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />
        return sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
    }

    // Metadatos de roles, usuarios, instituciones y comunas
    const rolesDisponibles = useMemo(() => metadatosFiltros?.roles || [], [metadatosFiltros])
    const usuariosDisponibles = useMemo(() => metadatosFiltros?.usuarios || [], [metadatosFiltros])
    const institucionesDisponibles = useMemo(() => metadatosFiltros?.instituciones || [], [metadatosFiltros])
    const comunasDisponibles = useMemo(() => metadatosFiltros?.comunas || [], [metadatosFiltros])
    const sucursalesDisponibles = useMemo(() => {
        const fromMeta = metadatosFiltros?.sucursales || []
        const fromRegs = registros.map(r => r.sucursal).filter(Boolean) as string[]
        return Array.from(new Set([...fromMeta, ...fromRegs])).sort()
    }, [metadatosFiltros, registros])

    const usuariosFiltradosPorRol = useMemo(() => {
        if (filtroRol === 'TODOS') return usuariosDisponibles
        return usuariosDisponibles.filter(u => u.roleId === filtroRol)
    }, [usuariosDisponibles, filtroRol])

    // Criterios
    const criteriosActivos = useMemo(() => criterios.filter(c => c.activo), [criterios])
    const criteriosMap = useMemo(() => new Map<string, CriterioItem>(criterios.map(c => [c.id, c])), [criterios])

    // Autocompletado Establecimientos
    const establecimientosSugeridos = useMemo(() => {
        if (!busquedaRbdNombre.trim()) return establecimientos.slice(0, 15)
        const term = busquedaRbdNombre.toLowerCase()
        return establecimientos.filter(e =>
            e.rbd.toString().includes(term) ||
            e.establecimiento.toLowerCase().includes(term)
        ).slice(0, 15)
    }, [establecimientos, busquedaRbdNombre])

    // Helper para normalizar RUTs para comparación estricta (sin puntos, sin guion, sin espacios)
    const normalizeRut = (val: string) => (val || '').replace(/\./g, '').replace(/-/g, '').replace(/\s+/g, '').toUpperCase().trim()

    // Pre-cálculo de Trabajadores autorizados (por Configuración de Visualización) y RBDs permitidos
    const usuarioSeleccionado = useMemo(() => {
        if (filtroUsuarioId === 'TODOS') return null
        return usuariosDisponibles.find(x => x.id === filtroUsuarioId) || null
    }, [filtroUsuarioId, usuariosDisponibles])

    const userRutsSet = useMemo(() => {
        if (!usuarioSeleccionado) return null
        if (usuarioSeleccionado.hasVisualizacion && usuarioSeleccionado.ruts?.length) {
            return new Set(usuarioSeleccionado.ruts.map(r => normalizeRut(r)))
        }
        return null
    }, [usuarioSeleccionado])

    const userRbdsSet = useMemo(() => {
        if (!usuarioSeleccionado) return null
        const rbds = usuarioSeleccionado.rbds || []
        return rbds.length > 0 ? new Set(rbds) : null
    }, [usuarioSeleccionado])

    const roleRutsSet = useMemo(() => {
        if (filtroRol === 'TODOS' || filtroUsuarioId !== 'TODOS') return null
        const uList = usuariosDisponibles.filter(x => x.roleId === filtroRol)
        const allRuts = uList.flatMap(u => (u.ruts || []).map(r => normalizeRut(r)))
        return allRuts.length > 0 ? new Set(allRuts) : null
    }, [filtroRol, filtroUsuarioId, usuariosDisponibles])

    const roleRbdsSet = useMemo(() => {
        if (filtroRol === 'TODOS' || filtroUsuarioId !== 'TODOS') return null
        const uList = usuariosDisponibles.filter(x => x.roleId === filtroRol)
        const allRbds = uList.flatMap(u => u.rbds || [])
        return allRbds.length > 0 ? new Set(allRbds) : null
    }, [filtroRol, filtroUsuarioId, usuariosDisponibles])

    // Filtrado de Registros en memoria
    const registrosFiltrados = useMemo(() => {
        return registros.filter(r => {
            // Filtro RBD
            if (filtroRbdSeleccionado !== null && r.rbd !== filtroRbdSeleccionado) {
                return false
            } else if (!filtroRbdSeleccionado && busquedaRbdNombre.trim()) {
                const term = busquedaRbdNombre.toLowerCase()
                const matchRbd = r.rbd.toString().includes(term)
                const matchEst = r.establecimiento.toLowerCase().includes(term)
                if (!matchRbd && !matchEst) return false
            }

            // Filtro Rol / Usuario:
            const rutLimpio = normalizeRut(r.rut)
            if (filtroUsuarioId !== 'TODOS') {
                if (userRutsSet !== null && userRbdsSet !== null) {
                    if (!userRutsSet.has(rutLimpio) && !userRbdsSet.has(r.rbd)) return false
                } else if (userRutsSet !== null) {
                    if (!userRutsSet.has(rutLimpio)) return false
                } else if (userRbdsSet !== null) {
                    if (!userRbdsSet.has(r.rbd)) return false
                } else {
                    return false
                }
            } else if (filtroRol !== 'TODOS') {
                if (roleRutsSet !== null && roleRbdsSet !== null) {
                    if (!roleRutsSet.has(rutLimpio) && !roleRbdsSet.has(r.rbd)) return false
                } else if (roleRutsSet !== null) {
                    if (!roleRutsSet.has(rutLimpio)) return false
                } else if (roleRbdsSet !== null) {
                    if (!roleRbdsSet.has(r.rbd)) return false
                } else {
                    return false
                }
            }

            // Filtro Institución (Colegio)
            if (filtroInstitucion !== 'TODAS') {
                if ((r.institucion || '').trim().toUpperCase() !== filtroInstitucion.trim().toUpperCase()) {
                    return false
                }
            }

            // Filtro Comuna
            if (filtroComuna !== 'TODAS') {
                if ((r.comuna || '').trim().toUpperCase() !== filtroComuna.trim().toUpperCase()) {
                    return false
                }
            }

            // Filtro Sucursal
            if (filtroSucursal !== 'TODAS') {
                if ((r.sucursal || '').trim().toUpperCase() !== filtroSucursal.trim().toUpperCase()) {
                    return false
                }
            }

            // Filtro Fecha
            if (filtroFecha && r.fecha !== filtroFecha) {
                return false
            }

            // Filtro por RUT o Colaborador
            if (busquedaTexto.trim()) {
                const term = busquedaTexto.toLowerCase().trim()
                const termClean = term.replace(/[^0-9kK]/g, '')
                const matchRut = r.rut.toLowerCase().includes(term) || (termClean.length >= 2 && r.rut.replace(/[^0-9kK]/g, '').toLowerCase().includes(termClean))
                const matchNombre = r.nombreCompleto.toLowerCase().includes(term)
                if (!matchRut && !matchNombre) {
                    return false
                }
            }

            // Filtro Criterio
            if (filtroCriterio !== 'TODOS') {
                if (filtroCriterio === 'SIN_CRITERIO') {
                    if (r.criterioId !== null) return false
                } else if (r.criterioId !== filtroCriterio) {
                    return false
                }
            }

            // Filtro Estado (ABIERTO / CERRADO)
            if (filtroEstado !== 'TODOS' && r.estado !== filtroEstado) {
                return false
            }

            // Filtro CargaId
            if (filtroCargaId !== 'TODOS' && r.cargaId !== filtroCargaId) {
                return false
            }

            return true
        })
    }, [
        registros, filtroRbdSeleccionado, busquedaRbdNombre, filtroFecha, busquedaTexto, filtroSucursal,
        filtroCriterio, filtroEstado, filtroCargaId, filtroRol, filtroUsuarioId, filtroInstitucion,
        filtroComuna, userRutsSet, userRbdsSet, roleRutsSet, roleRbdsSet
    ])

    // Ordenamiento de registros
    const registrosOrdenados = useMemo(() => {
        return [...registrosFiltrados].sort((a, b) => {
            let valA: any = a[sortField] || ''
            let valB: any = b[sortField] || ''
            if (typeof valA === 'string') valA = valA.toLowerCase()
            if (typeof valB === 'string') valB = valB.toLowerCase()

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1
            return 0
        })
    }, [registrosFiltrados, sortField, sortDirection])

    // Paginación
    const totalPaginas = Math.ceil(registrosOrdenados.length / porPagina) || 1
    const registrosPaginados = useMemo(() => {
        const start = (paginaActual - 1) * porPagina
        return registrosOrdenados.slice(start, start + porPagina)
    }, [registrosOrdenados, paginaActual, porPagina])

    // Lógica de Selección y Justificación Masiva
    const registrosAbiertosPagina = useMemo(() => {
        return registrosPaginados.filter(r => r.estado === 'ABIERTO')
    }, [registrosPaginados])

    const registrosAbiertosFiltrados = useMemo(() => {
        return registrosFiltrados.filter(r => r.estado === 'ABIERTO')
    }, [registrosFiltrados])

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

    const handleSelectAllFiltered = () => {
        setSelectedIds(new Set(registrosAbiertosFiltrados.map(r => r.id)))
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
        if (!criterioMasivoSeleccionado) {
            setMensajeFeedback({ tipo: 'error', texto: 'Debes seleccionar un criterio de ausencia para justificar.' })
            return
        }

        setProcesandoMasivo(true)
        try {
            const idsArray = Array.from(selectedIds)
            const res = await asignarCriterioMasivoAction(idsArray, criterioMasivoSeleccionado, observacionMasiva)
            if (res.success) {
                const critObj = criteriosMap.get(criterioMasivoSeleccionado)
                setRegistros(prev =>
                    prev.map(r => {
                        if (selectedIds.has(r.id)) {
                            return {
                                ...r,
                                criterioId: criterioMasivoSeleccionado,
                                criterioNombre: critObj ? critObj.nombre : r.criterioNombre,
                                criterioColor: critObj?.color || r.criterioColor,
                                numActualizaciones: (r.numActualizaciones || 0) + 1
                            }
                        }
                        return r
                    })
                )
                setMensajeFeedback({
                    tipo: 'success',
                    texto: `Se justificaron exitosamente ${res.actualizados} registros seleccionados.`
                })
                setSelectedIds(new Set())
                setModalMasivoOpen(false)
                setCriterioMasivoSeleccionado('')
                setObservacionMasiva('')
                setTimeout(() => setMensajeFeedback(null), 4000)
            } else {
                setMensajeFeedback({ tipo: 'error', texto: res.error || 'Error al aplicar justificación masiva.' })
            }
        } catch (error: any) {
            setMensajeFeedback({ tipo: 'error', texto: error?.message || 'Error inesperado al justificar masivamente.' })
        } finally {
            setProcesandoMasivo(false)
        }
    }

    // Recargar Datos
    const recargarDatos = async () => {
        startTransition(async () => {
            const [resReg, resCargas] = await Promise.all([
                getAdmAusentismoRegistrosAction(),
                getHistorialCargasAction()
            ])
            if (resReg.success && resReg.data) setRegistros(resReg.data)
            if (resCargas.success && resCargas.data) setCargas(resCargas.data)
            setMensajeFeedback({ tipo: 'success', texto: 'Datos actualizados correctamente.' })
            setTimeout(() => setMensajeFeedback(null), 3000)
        })
    }

    // Manejar cambio de criterio (Solo permitido si el período está abierto)
    const handleCriterioChange = async (registroId: string, nuevoCriterioId: string) => {
        const criterioVal = nuevoCriterioId === '' ? null : nuevoCriterioId
        const criterioObj = criterioVal ? criteriosMap.get(criterioVal) : null

        // Optimistic update
        setRegistros(prev =>
            prev.map(r =>
                r.id === registroId
                    ? {
                        ...r,
                        criterioId: criterioVal,
                        criterioNombre: criterioObj ? criterioObj.nombre : null,
                        criterioColor: criterioObj?.color || null
                    }
                    : r
            )
        )

        const res = await asignarCriterioAdminAction(registroId, criterioVal)
        if (res.success && res.data) {
            setGuardadoStatus(prev => ({ ...prev, [registroId]: true }))
            setTimeout(() => {
                setGuardadoStatus(prev => ({ ...prev, [registroId]: false }))
            }, 2500)
        } else {
            // Revertir en caso de error
            recargarDatos()
            setMensajeFeedback({ tipo: 'error', texto: res.error || 'No se pudo actualizar el criterio.' })
            setTimeout(() => setMensajeFeedback(null), 4000)
        }
    }

    // Control de apertura de modal con verificación de facultades
    const abrirModalPeriodo = (carga: CargaHistorialDTO, accion: 'CERRAR' | 'ABRIR') => {
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

        const res = await cambiarEstadoPeriodoCargaAction(
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
            recargarDatos()
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
        const res = await eliminarCargaAusentismoAdminAction(cargaId)

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
        if (registrosFiltrados.length === 0) {
            alert('No hay registros para exportar con los filtros seleccionados.')
            return
        }

        const datosExport = registrosFiltrados.map(r => ({
            'Fecha': r.fecha,
            'RBD': r.rbd,
            'Establecimiento': r.establecimiento,
            'Institución': r.institucion || '',
            'Comuna': r.comuna || '',
            'Sucursal': r.sucursal || '',
            'Supervisor': r.supervisorNombre,
            'RUT': r.rut,
            'Colaborador': r.nombreCompleto,
            'Cargo': r.cargo || '',
            'Estado Período': r.estado,
            'Planilla Origen': r.cargaNombreArchivo || 'Sin Carga',
            'Criterio Ausencia': r.criterioNombre || 'SIN CRITERIO',
            'Documento Respaldo': r.documentoNombre || (r.documentoUrl ? 'Sí' : 'No'),
            'Cargado Por': r.creadoPor,
            'Fecha Carga': r.fechaCreacion ? new Date(r.fechaCreacion).toLocaleString('es-CL') : '',
            'Actualizado Por': r.actualizadoPor || '',
            'Fecha Actualización': r.fechaActualizacion ? new Date(r.fechaActualizacion).toLocaleString('es-CL') : '',
            'Num Actualizaciones': r.numActualizaciones,
            'Usuario que Ingresó o Modificó': resolverUsuarioGestion(r.actualizadoPor, r.creadoPor)
        }))

        const ws = xlsx.utils.json_to_sheet(datosExport)
        const wb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(wb, ws, 'Adm_Ausentismo')
        const nombreArchivo = `Adm_Ausentismo_Reporte_${new Date().toISOString().slice(0, 10)}.xlsx`
        xlsx.writeFile(wb, nombreArchivo)

        // Registrar acción en auditoría
        await registrarAuditoriaExportacionAction(
            registrosFiltrados.length,
            `Filtros aplicados: [Estado: ${filtroEstado}, Criterio: ${filtroCriterio}, Carga: ${filtroCargaId}]`
        )
    }

    // Exportar una carga específica a Excel directamente desde la tabla de períodos (sin entrar a los registros)
    const [cargasExportando, setCargasExportando] = useState<Set<string>>(new Set())

    const exportarExcelCarga = async (carga: CargaHistorialDTO) => {
        try {
            setCargasExportando(prev => new Set(prev).add(carga.id))

            let regsParaExport = registros.filter(r => r.cargaId === carga.id)
            if (regsParaExport.length === 0 || regsParaExport.length < carga.totalRegistros) {
                const res = await getAdmAusentismoRegistrosAction({ cargaId: carga.id, estado: 'TODOS' })
                if (res.success && res.data) {
                    regsParaExport = res.data
                }
            }

            if (regsParaExport.length === 0) {
                alert('No se encontraron registros para exportar en esta planilla.')
                return
            }

            const datosExport = regsParaExport.map(r => ({
                'Fecha': r.fecha,
                'RBD': r.rbd,
                'Establecimiento': r.establecimiento,
                'Institución': r.institucion || '',
                'Comuna': r.comuna || '',
                'Supervisor': r.supervisorNombre,
                'RUT': r.rut,
                'Colaborador': r.nombreCompleto,
                'Cargo': r.cargo || '',
                'Estado Período': r.estado,
                'Planilla Origen': r.cargaNombreArchivo || carga.nombreArchivo || 'Sin Carga',
                'Criterio Ausencia': r.criterioNombre || 'SIN CRITERIO',
                'Documento Respaldo': r.documentoNombre || (r.documentoUrl ? 'Sí' : 'No'),
                'Cargado Por': r.creadoPor || carga.cargadoPor,
                'Fecha Carga': r.fechaCreacion ? new Date(r.fechaCreacion).toLocaleString('es-CL') : (carga.fechaCarga ? new Date(carga.fechaCarga).toLocaleString('es-CL') : ''),
                'Actualizado Por': r.actualizadoPor || '',
                'Fecha Actualización': r.fechaActualizacion ? new Date(r.fechaActualizacion).toLocaleString('es-CL') : '',
                'Num Actualizaciones': r.numActualizaciones,
                'Usuario que Ingresó o Modificó': resolverUsuarioGestion(r.actualizadoPor, r.creadoPor || carga.cargadoPor)
            }))

            const ws = xlsx.utils.json_to_sheet(datosExport)
            const wb = xlsx.utils.book_new()
            xlsx.utils.book_append_sheet(wb, ws, 'Ausentismo')
            const baseNombre = carga.nombreArchivo.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
            const nombreArchivo = `Ausentismo_${baseNombre}_${carga.estado}_${new Date().toISOString().slice(0, 10)}.xlsx`
            xlsx.writeFile(wb, nombreArchivo)

            // Registrar acción en auditoría
            await registrarAuditoriaExportacionAction(
                regsParaExport.length,
                `Exportación directa desde planilla: ${carga.nombreArchivo} (ID: ${carga.id}, Estado: ${carga.estado})`
            )
        } catch (err: any) {
            console.error('Error al exportar carga a Excel:', err)
            alert('Ocurrió un error al exportar la planilla a Excel.')
        } finally {
            setCargasExportando(prev => {
                const next = new Set(prev)
                next.delete(carga.id)
                return next
            })
        }
    }

    // Filtro rápido hacia registros de una carga específica
    const irARegistrosDeCarga = (cargaId: string) => {
        setFiltroCargaId(cargaId)
        setTabActivo('registros')
        setPaginaActual(1)
    }

    // Métricas
    const totalReg = registros.length
    const totalAbiertos = registros.filter(r => r.estado === 'ABIERTO').length
    const totalCerrados = registros.filter(r => r.estado === 'CERRADO').length
    const totalConCriterio = registros.filter(r => r.criterioId !== null).length
    const totalSinCriterio = registros.filter(r => r.criterioId === null).length

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
                        Adm. Ausentismo
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Control administrativo de períodos de ausentismo, cierre/reapertura de planillas Excel, auditoría de supervisión y descarga consolidada de datos.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={recargarDatos}
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

            {/* Banner de restricción por RBD si aplica */}
            {!isAdmin && userRbds.length > 0 && (
                <div className="flex items-center gap-2 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs shadow-sm">
                    <Info className="w-4 h-4 flex-shrink-0 text-amber-600" />
                    <span>
                        Acceso restringido por perfil: Solo tienes autorización para visualizar los <strong>{userRbds.length}</strong> establecimientos (RBDs) asociados a tu cuenta.
                    </span>
                </div>
            )}

            {/* Barra de Pestañas (Tabs) */}
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
                    <span>Historial y Gestión de Supervisores</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tabActivo === 'registros' ? 'bg-cyan-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {registrosFiltrados.length}
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
                                <p className="text-xs text-gray-500 font-medium">Total Planillas Cargadas</p>
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
                                <h3 className="font-bold text-gray-900 text-sm">Documentos Excel de Ausentismo Cargados</h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Al cerrar un período, todos sus puntos quedan congelados y dejan de mostrarse en el módulo de Ausentismo general.
                                </p>
                            </div>
                        </div>

                        {cargas.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 text-xs">
                                No hay planillas Excel registradas en el sistema.
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
                                                            <span className="text-gray-400 italic">En edición activa</span>
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
            {/* TAB 2: HISTORIAL Y GESTIÓN DE REGISTROS / SUPERVISORES   */}
            {/* ======================================================== */}
            {tabActivo === 'registros' && (
                <div className="space-y-4">
                    {/* Tarjetas de Resumen */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Registros</span>
                            <p className="text-xl font-bold text-gray-900 mt-0.5">{registrosFiltrados.length}</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">En Período Abierto</span>
                            <p className="text-xl font-bold text-emerald-700 mt-0.5">
                                {registrosFiltrados.filter(r => r.estado === 'ABIERTO').length}
                            </p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">En Período Cerrado</span>
                            <p className="text-xl font-bold text-rose-700 mt-0.5">
                                {registrosFiltrados.filter(r => r.estado === 'CERRADO').length}
                            </p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-cyan-600 uppercase tracking-wider">Con Criterio</span>
                            <p className="text-xl font-bold text-cyan-700 mt-0.5">
                                {registrosFiltrados.filter(r => r.criterioId !== null).length}
                            </p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Sin Criterio</span>
                            <p className="text-xl font-bold text-amber-700 mt-0.5">
                                {registrosFiltrados.filter(r => r.criterioId === null).length}
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
                            {(busquedaRbdNombre || filtroRbdSeleccionado || filtroFecha || busquedaTexto || filtroSucursal !== 'TODAS' || filtroCriterio !== 'TODOS' || filtroEstado !== 'TODOS' || filtroCargaId !== 'TODOS' || filtroRol !== 'TODOS' || filtroUsuarioId !== 'TODOS' || filtroInstitucion !== 'TODAS' || filtroComuna !== 'TODAS') && (
                                <button
                                    onClick={() => {
                                        setBusquedaRbdNombre('')
                                        setFiltroRbdSeleccionado(null)
                                        setFiltroFecha('')
                                        setBusquedaTexto('')
                                        setFiltroSucursal('TODAS')
                                        setFiltroCriterio('TODOS')
                                        setFiltroEstado('TODOS')
                                        setFiltroCargaId('TODOS')
                                        setFiltroRol('TODOS')
                                        setFiltroUsuarioId('TODOS')
                                        setFiltroInstitucion('TODAS')
                                        setFiltroComuna('TODAS')
                                        setPaginaActual(1)
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
                                        setFiltroRol(e.target.value)
                                        setFiltroUsuarioId('TODOS')
                                        setPaginaActual(1)
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
                                        setFiltroUsuarioId(e.target.value)
                                        setPaginaActual(1)
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

                            {/* Filtro por Institución (Colegio) */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                                    <School className="w-3 h-3 text-cyan-600" />
                                    <span>Institución</span>
                                </label>
                                <select
                                    value={filtroInstitucion}
                                    onChange={e => {
                                        setFiltroInstitucion(e.target.value)
                                        setPaginaActual(1)
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
                                        setFiltroComuna(e.target.value)
                                        setPaginaActual(1)
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

                            {/* Filtro por Sucursal */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                                    <Building2 className="w-3 h-3 text-cyan-600" />
                                    <span>Sucursal</span>
                                </label>
                                <select
                                    value={filtroSucursal}
                                    onChange={e => {
                                        setFiltroSucursal(e.target.value)
                                        setPaginaActual(1)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                                >
                                    <option value="TODAS">Todas las Sucursales</option>
                                    {sucursalesDisponibles.map(suc => (
                                        <option key={suc} value={suc}>
                                            {suc}
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
                                            setFiltroRbdSeleccionado(null)
                                            setIsRbdDropdownOpen(true)
                                            setPaginaActual(1)
                                        }}
                                        onFocus={() => setIsRbdDropdownOpen(true)}
                                        className="w-full pl-8 pr-7 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                                    />
                                    <Building2 className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                                    {busquedaRbdNombre && (
                                        <button
                                            onClick={() => {
                                                setBusquedaRbdNombre('')
                                                setFiltroRbdSeleccionado(null)
                                                setPaginaActual(1)
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
                                                    setFiltroRbdSeleccionado(item.rbd)
                                                    setBusquedaRbdNombre(`${item.rbd} - ${item.establecimiento}`)
                                                    setIsRbdDropdownOpen(false)
                                                    setPaginaActual(1)
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
                                    onChange={e => {
                                        setFiltroEstado(e.target.value)
                                        setPaginaActual(1)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                                >
                                    <option value="TODOS">Todos los Estados</option>
                                    <option value="ABIERTO">Abiertos (Modificables)</option>
                                    <option value="CERRADO">Cerrados (Bloqueados)</option>
                                </select>
                            </div>

                            {/* Filtro Planilla / Carga */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Documento / Planilla</label>
                                <select
                                    value={filtroCargaId}
                                    onChange={e => {
                                        setFiltroCargaId(e.target.value)
                                        setPaginaActual(1)
                                    }}
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

                            {/* Filtro Criterio */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Criterio Ausencia</label>
                                <select
                                    value={filtroCriterio}
                                    onChange={e => {
                                        setFiltroCriterio(e.target.value)
                                        setPaginaActual(1)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white"
                                >
                                    <option value="TODOS">Todos los Criterios</option>
                                    <option value="SIN_CRITERIO">Sin Criterio Asignado</option>
                                    {criteriosActivos.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro Fecha */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Fecha</label>
                                <input
                                    type="date"
                                    value={filtroFecha}
                                    onChange={e => {
                                        setFiltroFecha(e.target.value)
                                        setPaginaActual(1)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                                />
                            </div>

                            {/* Buscar por RUT o Colaborador */}
                            <div className="md:col-span-3">
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                                    <Search className="w-3 h-3 text-cyan-600" />
                                    <span>Buscar por RUT o Colaborador</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Buscar por RUT o colaborador..."
                                        value={busquedaTexto}
                                        onChange={e => {
                                            setBusquedaTexto(e.target.value)
                                            setPaginaActual(1)
                                        }}
                                        className="w-full pl-8 pr-7 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs"
                                    />
                                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                                    {busquedaTexto && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setBusquedaTexto('')
                                                setPaginaActual(1)
                                            }}
                                            className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Barra de Selección Masiva Flotante/Destacada */}
                    {selectedIds.size > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-cyan-50 border border-cyan-200 rounded-2xl text-xs shadow-sm animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-2 text-cyan-900 font-semibold">
                                <CheckSquare className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                                <span>
                                    {selectedIds.size} {selectedIds.size === 1 ? 'caso abierto seleccionado' : 'casos abiertos seleccionados'}
                                </span>
                                {registrosAbiertosFiltrados.length > selectedIds.size && (
                                    <button
                                        type="button"
                                        onClick={handleSelectAllFiltered}
                                        className="ml-2 text-cyan-700 underline hover:text-cyan-900 font-bold"
                                    >
                                        Seleccionar todos ({registrosAbiertosFiltrados.length} abiertos con estos filtros)
                                    </button>
                                )}
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
                        {registrosPaginados.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 text-xs">
                                No se encontraron registros de ausentismo que coincidan con los filtros aplicados.
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
                                                    title="Seleccionar todos los casos abiertos de esta página"
                                                    className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                                />
                                            </th>
                                            <th 
                                                className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors" 
                                                onClick={() => handleSort('fecha')}
                                                title="Ordenar por Fecha"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortField === 'fecha' ? 'text-cyan-800 font-bold' : ''}>Fecha</span>
                                                    {renderSortIconRegistros('fecha')}
                                                </div>
                                            </th>
                                            <th 
                                                className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors" 
                                                onClick={() => handleSort('rbd')}
                                                title="Ordenar por RBD / Establecimiento"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortField === 'rbd' ? 'text-cyan-800 font-bold' : ''}>RBD / Establecimiento</span>
                                                    {renderSortIconRegistros('rbd')}
                                                </div>
                                            </th>
                                            <th 
                                                className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors" 
                                                onClick={() => handleSort('supervisorNombre')}
                                                title="Ordenar por Supervisor"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortField === 'supervisorNombre' ? 'text-cyan-800 font-bold' : ''}>Supervisor</span>
                                                    {renderSortIconRegistros('supervisorNombre')}
                                                </div>
                                            </th>
                                            <th 
                                                className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors" 
                                                onClick={() => handleSort('nombreCompleto')}
                                                title="Ordenar por Colaborador"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortField === 'nombreCompleto' ? 'text-cyan-800 font-bold' : ''}>Colaborador</span>
                                                    {renderSortIconRegistros('nombreCompleto')}
                                                </div>
                                            </th>
                                            <th 
                                                className="py-3 px-3 text-center cursor-pointer select-none group hover:bg-gray-200 transition-colors" 
                                                onClick={() => handleSort('estado')}
                                                title="Ordenar por Estado"
                                            >
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span className={sortField === 'estado' ? 'text-cyan-800 font-bold' : ''}>Estado</span>
                                                    {renderSortIconRegistros('estado')}
                                                </div>
                                            </th>
                                            <th 
                                                className="py-3 px-3 cursor-pointer select-none group hover:bg-gray-200 transition-colors" 
                                                onClick={() => handleSort('criterioNombre')}
                                                title="Ordenar por Criterio Ausencia"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={sortField === 'criterioNombre' ? 'text-cyan-800 font-bold' : ''}>Criterio Ausencia</span>
                                                    {renderSortIconRegistros('criterioNombre')}
                                                </div>
                                            </th>
                                            <th className="py-3 px-3 text-center">Respaldo / Adjunto</th>
                                            <th className="py-3 px-3">Trazabilidad / Auditoría</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-gray-700">
                                        {registrosPaginados.map(r => {
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
                                                                {r.sucursal && (
                                                                    <span className="text-[9px] font-semibold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200 flex items-center gap-0.5">
                                                                        <Building2 className="w-2.5 h-2.5" />
                                                                        {r.sucursal}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] font-semibold text-cyan-600">RBD: {r.rbd}</span>
                                                        </div>
                                                    </td>

                                                    {/* Supervisor */}
                                                    <td className="py-3 px-3 text-gray-600 font-medium whitespace-nowrap">
                                                        {r.supervisorNombre}
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

                                                    {/* Estado del Período */}
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

                                                    {/* Selector de Criterio */}
                                                    <td className="py-3 px-3 min-w-[210px]">
                                                        {esCerrado ? (
                                                            <div className="flex items-center gap-1.5 text-gray-400 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200">
                                                                <Lock className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                                                                <span className="text-[11px] font-semibold truncate text-gray-700">
                                                                    {r.criterioNombre || 'SIN CRITERIO'}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="relative">
                                                                <select
                                                                    value={r.criterioId || ''}
                                                                    onChange={e => handleCriterioChange(r.id, e.target.value)}
                                                                    className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                                                                    style={{
                                                                        color: r.criterioColor || '#1e293b'
                                                                    }}
                                                                >
                                                                    <option value="">-- Sin Criterio Asignado --</option>
                                                                    {criteriosActivos.map(crit => (
                                                                        <option key={crit.id} value={crit.id}>
                                                                            {crit.nombre}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                {guardadoStatus[r.id] && (
                                                                    <span className="absolute -top-2 -right-1 text-[9px] bg-emerald-500 text-white font-bold px-1.5 py-0.2 rounded-full shadow-sm animate-pulse">
                                                                        Guardado
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Documento Respaldo */}
                                                    <td className="py-3 px-3 text-center whitespace-nowrap">
                                                        {r.documentoUrl ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewDoc({
                                                                    url: r.documentoUrl!,
                                                                    nombre: r.documentoNombre || 'Documento_Respaldo',
                                                                    colaborador: r.nombreCompleto,
                                                                    rut: r.rut,
                                                                    rbd: r.rbd,
                                                                    establecimiento: r.establecimiento,
                                                                    fecha: r.fecha,
                                                                    criterio: r.criterioNombre,
                                                                    criterioColor: r.criterioColor,
                                                                    subidoPor: r.documentoSubidoPor,
                                                                    subidoAt: r.documentoSubidoAt
                                                                })}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 transition-all shadow-2xs hover:scale-[1.02] cursor-pointer"
                                                                title={`Vista previa: ${r.documentoNombre || 'Ver Respaldo'}`}
                                                            >
                                                                <Eye className="w-3.5 h-3.5 text-cyan-600" />
                                                                <span className="truncate max-w-[120px]">{r.documentoNombre || 'Ver Respaldo'}</span>
                                                            </button>
                                                        ) : (
                                                            <span className="text-[11px] text-gray-400 font-medium italic">Sin adjunto</span>
                                                        )}
                                                    </td>

                                                    {/* Trazabilidad */}
                                                    <td className="py-3 px-3 text-[11px] text-gray-500">
                                                        <div className="flex flex-col">
                                                            {r.actualizadoPor ? (
                                                                <>
                                                                    <span className="font-semibold text-gray-700">
                                                                        Actualizado: {r.actualizadoPor}
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-400">
                                                                        {r.fechaActualizacion ? new Date(r.fechaActualizacion).toLocaleString('es-CL') : ''} ({r.numActualizaciones} cambios)
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <span className="text-gray-400 italic">Cargado por: {r.creadoPor}</span>
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
                        {registrosOrdenados.length > porPagina && (
                            <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                                <span>
                                    Mostrando {((paginaActual - 1) * porPagina) + 1} - {Math.min(paginaActual * porPagina, registrosOrdenados.length)} de {registrosOrdenados.length} registros
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        disabled={paginaActual === 1}
                                        onClick={() => setPaginaActual(p => Math.max(p - 1, 1))}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                                    >
                                        Anterior
                                    </button>
                                    <span className="px-3 py-1.5 font-bold text-gray-800">
                                        {paginaActual} / {totalPaginas}
                                    </span>
                                    <button
                                        disabled={paginaActual === totalPaginas}
                                        onClick={() => setPaginaActual(p => Math.min(p + 1, totalPaginas))}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
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
                                Se eliminarán <strong>{modalDeleteCarga.carga.totalRegistros} registros</strong> asociados a esta planilla en el historial de ausentismo.
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
                                    {modalPeriodo.accion === 'CERRAR' ? '¿Cerrar período de ausentismo?' : '¿Reabrir período de ausentismo?'}
                                </h3>
                                <p className="text-xs text-gray-500">
                                    Documento: <strong>{modalPeriodo.carga.nombreArchivo}</strong>
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
                                        ⚠️ Esta información dejará de mostrarse en el módulo regular de Ausentismo y los supervisores ya no podrán alterar los criterios.
                                    </p>
                                </>
                            ) : (
                                <p>
                                    Al reabrir este período, los <strong>{modalPeriodo.carga.totalRegistros}</strong> registros volverán a estar disponibles y podrán tipificarse nuevamente por los supervisores.
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
                                <h3 className="font-bold text-gray-900 text-base">Justificación Masiva de Ausentismo</h3>
                                <p className="text-xs text-gray-500">
                                    Se aplicará el criterio a <strong>{selectedIds.size}</strong> casos seleccionados.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Criterio de Ausencia *</label>
                                <select
                                    value={criterioMasivoSeleccionado}
                                    onChange={e => setCriterioMasivoSeleccionado(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs bg-white font-semibold"
                                >
                                    <option value="">-- Selecciona el criterio a aplicar --</option>
                                    {criteriosActivos.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Observación Masiva (Opcional)</label>
                                <textarea
                                    rows={2}
                                    value={observacionMasiva}
                                    onChange={e => setObservacionMasiva(e.target.value)}
                                    placeholder="Motivo o detalle de la justificación masiva..."
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
                                    setCriterioMasivoSeleccionado('')
                                    setObservacionMasiva('')
                                }}
                                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={procesandoMasivo || !criterioMasivoSeleccionado}
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

            {/* Modal de Vista Previa de Documento Adjunto */}
            <DocumentoPreviewModal
                documento={previewDoc}
                onClose={() => setPreviewDoc(null)}
            />
        </div>
    )
}
