'use client'

import React, { useState, useMemo, useTransition } from 'react'
import {
    ReclamoProveedorItem,
    ReclamosDataResponse,
    LicitacionOption,
    ArchivoEvidencia,
    obtenerReclamosDataAction,
    obtenerSucursalesDeLicitacionAction,
    crearReclamoProveedorAction,
    actualizarReclamoProveedorAction,
    eliminarReclamoProveedorAction
} from './actions'
import {
    Plus,
    Search,
    Filter,
    Calendar,
    Building2,
    ShieldAlert,
    AlertTriangle,
    FileText,
    Paperclip,
    Eye,
    Edit2,
    Trash2,
    X,
    CheckCircle2,
    Clock,
    RefreshCw,
    Download,
    ExternalLink,
    ChevronUp,
    ChevronDown,
    FileCheck2,
    AlertCircle,
    Info,
    Layers,
    FileImage,
    FileVideo,
    Send
} from 'lucide-react'

interface Props {
    initialData: ReclamosDataResponse
    usuarioActual: string
}

type SortField =
    | 'numeroReclamo'
    | 'licitacionNombre'
    | 'zonal'
    | 'fechaDesviacion'
    | 'producto'
    | 'proveedor'
    | 'tipoReclamo'
    | 'estado'

export default function ReclamosProveedoresClient({ initialData, usuarioActual }: Props) {
    const [items, setItems] = useState<ReclamoProveedorItem[]>(initialData.items)
    const [licitaciones] = useState<LicitacionOption[]>(initialData.licitaciones)
    const [siguienteNumero, setSiguienteNumero] = useState<string>(initialData.siguienteNumeroReclamo)
    const [puedeGestionar] = useState(initialData.puedeGestionar)
    const [privilegiosUsuario] = useState(initialData.privilegiosUsuario || {
        puedeEditar: false,
        puedeFechasSeguimiento: false,
        puedeAdjuntarRespuesta: false
    })
    const [isPending, startTransition] = useTransition()

    // Tab activo (actualmente "Reclamos", preparado para futuras pestañas)
    const [tabActivo, setTabActivo] = useState<'reclamos'>('reclamos')

    // Filtros
    const [filtroLicitacion, setFiltroLicitacion] = useState<string>('TODAS')
    const [filtroAnio, setFiltroAnio] = useState<string>(String(new Date().getFullYear()))
    const [filtroMes, setFiltroMes] = useState<string>('TODOS')
    const [busqueda, setBusqueda] = useState<string>('')

    // Ordenamiento
    const [sortField, setSortField] = useState<SortField>('numeroReclamo')
    const [sortAsc, setSortAsc] = useState<boolean>(false)

    // Modal Formulario (Crear / Editar)
    const [modalOpen, setModalOpen] = useState(false)
    const [modoEdicion, setModoEdicion] = useState(false)
    const [reclamoEditandoId, setReclamoEditandoId] = useState<string | null>(null)

    // Campos del Formulario
    const [formLicitacionId, setFormLicitacionId] = useState<string>('')
    const [formNumeroReclamo, setFormNumeroReclamo] = useState<string>('')
    const [formZonal, setFormZonal] = useState<string>('')
    const [formOrigenReclamo, setFormOrigenReclamo] = useState<'RECLAMO_ZONAL' | 'RECLAMO_CLIENTE' | 'RECLAMO_CLIENTE_C8'>('RECLAMO_ZONAL')
    const [formFechaDesviacion, setFormFechaDesviacion] = useState<string>('')
    const [formLugar, setFormLugar] = useState<string>('')
    const [formTipoReclamo, setFormTipoReclamo] = useState<'CALIDAD' | 'INOCUIDAD'>('CALIDAD')

    // Panel Producto
    const [formProducto, setFormProducto] = useState<string>('')
    const [formProveedor, setFormProveedor] = useState<string>('')
    const [formMarca, setFormMarca] = useState<string>('')
    const [formFechaElaboracion, setFormFechaElaboracion] = useState<string>('')
    const [formFechaVencimiento, setFormFechaVencimiento] = useState<string>('')
    const [formLote, setFormLote] = useState<string>('')
    const [formFormato, setFormFormato] = useState<string>('')
    const [formCantidad, setFormCantidad] = useState<string>('')
    const [formFormatoCantidad, setFormFormatoCantidad] = useState<'Kilo' | 'Unidad' | 'Otro'>('Kilo')

    // Panel Descripción y Evidencias
    const [formObservacion, setFormObservacion] = useState<string>('')
    const [archivosNuevos, setArchivosNuevos] = useState<File[]>([])
    const [evidenciasExistentes, setEvidenciasExistentes] = useState<ArchivoEvidencia[]>([])

    // Panel Seguimiento
    const [formFechaRecepcionReclamo, setFormFechaRecepcionReclamo] = useState<string>('')
    const [formFechaEnvioProveedor, setFormFechaEnvioProveedor] = useState<string>('')
    const [formFechaRecepcionRespuesta, setFormFechaRecepcionRespuesta] = useState<string>('')
    const [archivoRespuestaNuevo, setArchivoRespuestaNuevo] = useState<File | null>(null)
    const [archivoRespuestaExistente, setArchivoRespuestaExistente] = useState<ArchivoEvidencia | null>(null)

    // Popup Paso 2: Selección Destino de Compras
    const [modalDestinoComprasOpen, setModalDestinoComprasOpen] = useState(false)
    const [destinoComprasSeleccionado, setDestinoComprasSeleccionado] = useState<'MATRIZ' | 'SUCURSAL'>('MATRIZ')
    const [fechaEnvioOriginal, setFechaEnvioOriginal] = useState<string>('')

    const [guardando, setGuardando] = useState(false)
    const [errorModal, setErrorModal] = useState<string | null>(null)

    // Modal Ver Detalle
    const [reclamoVer, setReclamoVer] = useState<ReclamoProveedorItem | null>(null)

    // Modal Confirmar Eliminar
    const [reclamoAEliminar, setReclamoAEliminar] = useState<ReclamoProveedorItem | null>(null)
    const [eliminando, setEliminando] = useState(false)

    // Sucursales disponibles para la licitación seleccionada en el formulario
    const sucursalesLicitacion = useMemo(() => {
        if (!formLicitacionId) return []
        const lic = licitaciones.find(l => l.id === formLicitacionId)
        return lic ? lic.sucursales : []
    }, [formLicitacionId, licitaciones])

    // Años disponibles para filtrar
    const aniosDisponibles = useMemo(() => {
        const setAnios = new Set<number>()
        const anioActual = new Date().getFullYear()
        setAnios.add(anioActual)
        setAnios.add(anioActual - 1)
        items.forEach(i => {
            if (i.anio) setAnios.add(i.anio)
        })
        return Array.from(setAnios).sort((a, b) => b - a)
    }, [items])

    // Lista de meses
    const MESES = [
        { valor: '1', nombre: 'Enero' },
        { valor: '2', nombre: 'Febrero' },
        { valor: '3', nombre: 'Marzo' },
        { valor: '4', nombre: 'Abril' },
        { valor: '5', nombre: 'Mayo' },
        { valor: '6', nombre: 'Junio' },
        { valor: '7', nombre: 'Julio' },
        { valor: '8', nombre: 'Agosto' },
        { valor: '9', nombre: 'Septiembre' },
        { valor: '10', nombre: 'Octubre' },
        { valor: '11', nombre: 'Noviembre' },
        { valor: '12', nombre: 'Diciembre' }
    ]

    // Manejar apertura de Modal Crear
    const handleAbrirCrear = () => {
        setErrorModal(null)
        setModoEdicion(false)
        setReclamoEditandoId(null)

        const defaultLic = licitaciones[0]?.id || ''
        setFormLicitacionId(defaultLic)
        setFormNumeroReclamo(siguienteNumero)

        const licObj = licitaciones.find(l => l.id === defaultLic)
        setFormZonal(licObj?.sucursales[0] || '')

        setFormOrigenReclamo('RECLAMO_ZONAL')
        setFormFechaDesviacion(new Date().toISOString().slice(0, 10))
        setFormLugar('')
        setFormTipoReclamo('CALIDAD')

        setFormProducto('')
        setFormProveedor('')
        setFormMarca('')
        setFormFechaElaboracion('')
        setFormFechaVencimiento('')
        setFormLote('')
        setFormFormato('')
        setFormCantidad('')
        setFormFormatoCantidad('Kilo')

        setFormObservacion('')
        setArchivosNuevos([])
        setEvidenciasExistentes([])

        setFormFechaRecepcionReclamo(new Date().toISOString().slice(0, 10))
        setFormFechaEnvioProveedor('')
        setFormFechaRecepcionRespuesta('')
        setFechaEnvioOriginal('')
        setArchivoRespuestaNuevo(null)
        setArchivoRespuestaExistente(null)

        setModalOpen(true)
    }

    // Manejar apertura de Modal Editar
    const handleAbrirEditar = (item: ReclamoProveedorItem) => {
        setErrorModal(null)
        setModoEdicion(true)
        setReclamoEditandoId(item.id)

        setFormLicitacionId(item.licitacionId)
        setFormNumeroReclamo(item.numeroReclamo)
        setFormZonal(item.zonal)
        setFormOrigenReclamo(item.origenReclamo)
        setFormFechaDesviacion(item.fechaDesviacion)
        setFormLugar(item.lugar)
        setFormTipoReclamo(item.tipoReclamo)

        setFormProducto(item.producto)
        setFormProveedor(item.proveedor)
        setFormMarca(item.marca || '')
        setFormFechaElaboracion(item.fechaElaboracion || '')
        setFormFechaVencimiento(item.fechaVencimiento || '')
        setFormLote(item.lote || '')
        setFormFormato(item.formato || '')
        setFormCantidad(item.cantidad !== null && item.cantidad !== undefined ? String(item.cantidad) : '')
        setFormFormatoCantidad((item.formatoCantidad as any) || 'Kilo')

        setFormObservacion(item.observacion || '')
        setArchivosNuevos([])
        setEvidenciasExistentes(item.evidencias || [])

        setFormFechaRecepcionReclamo(item.fechaRecepcionReclamo || '')
        setFormFechaEnvioProveedor(item.fechaEnvioProveedor || '')
        setFormFechaRecepcionRespuesta(item.fechaRecepcionRespuesta || '')
        setFechaEnvioOriginal(item.fechaEnvioProveedor || '')
        setArchivoRespuestaNuevo(null)
        setArchivoRespuestaExistente(item.archivoRespuesta || null)

        setModalOpen(true)
    }

    // Al cambiar la licitación en el formulario, ajustar zonal si no pertenece
    const handleLicitacionChange = (licId: string) => {
        setFormLicitacionId(licId)
        const lic = licitaciones.find(l => l.id === licId)
        if (lic && lic.sucursales.length > 0) {
            if (!lic.sucursales.includes(formZonal)) {
                setFormZonal(lic.sucursales[0])
            }
        } else {
            setFormZonal('')
        }
    }

    // Manejar adjuntar archivos
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files || [])
        if (!selected.length) return

        const totalArchivos = evidenciasExistentes.length + archivosNuevos.length + selected.length
        if (totalArchivos > 6) {
            setErrorModal('Solo se permite un máximo de 6 archivos de evidencia en total.')
            return
        }

        setErrorModal(null)
        setArchivosNuevos(prev => [...prev, ...selected])
        e.target.value = ''
    }

    const handleQuitarArchivoNuevo = (index: number) => {
        setArchivosNuevos(prev => prev.filter((_, i) => i !== index))
    }

    const handleQuitarEvidenciaExistente = (index: number) => {
        setEvidenciasExistentes(prev => prev.filter((_, i) => i !== index))
    }

    // Guardar (Crear o Editar)
    const handleGuardar = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorModal(null)

        if (!formLicitacionId) {
            setErrorModal('Debes seleccionar una licitación.')
            return
        }
        if (!formZonal) {
            setErrorModal('Debes seleccionar la sucursal/zonal.')
            return
        }
        if (!formFechaDesviacion) {
            setErrorModal('Debes ingresar la fecha de ocurrencia de la desviación.')
            return
        }
        if (!formLugar.trim()) {
            setErrorModal('Debes ingresar el lugar de la desviación.')
            return
        }
        if (!formProducto.trim()) {
            setErrorModal('Debes ingresar el nombre del producto.')
            return
        }
        if (!formProveedor.trim()) {
            setErrorModal('Debes ingresar el proveedor del producto.')
            return
        }

        // Si estamos en modo edición, y se está ingresando o modificando Fecha Envío a Proveedor (Etapa 2),
        // desplegamos el modal de selección de destino de Compras (Matriz o Sucursal)
        const esNuevoEnvioPaso2 = modoEdicion && formFechaEnvioProveedor && !fechaEnvioOriginal
        if (esNuevoEnvioPaso2) {
            setModalDestinoComprasOpen(true)
            return
        }

        await ejecutarGuardado()
    }

    const ejecutarGuardado = async (destinoComprasOverride?: 'MATRIZ' | 'SUCURSAL') => {
        const licObj = licitaciones.find(l => l.id === formLicitacionId)
        const licitacionNombre = licObj?.nombre || `Licitación ${formLicitacionId}`

        setGuardando(true)
        try {
            const formData = new FormData()
            if (modoEdicion && reclamoEditandoId) {
                formData.append('id', reclamoEditandoId)
            }
            formData.append('licitacionId', formLicitacionId)
            formData.append('licitacionNombre', licitacionNombre)
            formData.append('zonal', formZonal)
            formData.append('origenReclamo', formOrigenReclamo)
            formData.append('fechaDesviacion', formFechaDesviacion)
            formData.append('lugar', formLugar.trim())
            formData.append('tipoReclamo', formTipoReclamo)

            formData.append('producto', formProducto.trim())
            formData.append('proveedor', formProveedor.trim())
            formData.append('marca', formMarca.trim())
            formData.append('fechaElaboracion', formFechaElaboracion)
            formData.append('fechaVencimiento', formFechaVencimiento)
            formData.append('lote', formLote.trim())
            formData.append('formato', formFormato.trim())
            formData.append('cantidad', formCantidad)
            formData.append('formatoCantidad', formFormatoCantidad)

            formData.append('observacion', formObservacion.trim())
            formData.append('evidenciasExistentes', JSON.stringify(evidenciasExistentes))

            formData.append('fechaRecepcionReclamo', formFechaRecepcionReclamo)
            formData.append('fechaEnvioProveedor', formFechaEnvioProveedor)
            formData.append('fechaRecepcionRespuesta', formFechaRecepcionRespuesta)

            const destinoFinal = destinoComprasOverride || destinoComprasSeleccionado
            formData.append('destinoCompras', destinoFinal)

            if (archivoRespuestaNuevo) {
                formData.append('archivoRespuesta', archivoRespuestaNuevo)
            }

            archivosNuevos.forEach(f => {
                formData.append('archivos', f)
            })

            if (modoEdicion) {
                const res = await actualizarReclamoProveedorAction(formData)
                if (res.success) {
                    await recargarDatos()
                    setModalOpen(false)
                    setModalDestinoComprasOpen(false)
                } else {
                    setErrorModal(res.error || 'Error al actualizar reclamo.')
                }
            } else {
                const res = await crearReclamoProveedorAction(formData)
                if (res.success) {
                    await recargarDatos()
                    setModalOpen(false)
                } else {
                    setErrorModal(res.error || 'Error al crear reclamo.')
                }
            }
        } catch (err: any) {
            setErrorModal(err.message || 'Error inesperado al guardar.')
        } finally {
            setGuardando(false)
        }
    }

    // Eliminar Reclamo
    const handleEliminar = async () => {
        if (!reclamoAEliminar) return
        setEliminando(true)
        try {
            const res = await eliminarReclamoProveedorAction(reclamoAEliminar.id)
            if (res.success) {
                setItems(prev => prev.filter(i => i.id !== reclamoAEliminar.id))
                setReclamoAEliminar(null)
            } else {
                alert(res.error || 'No fue posible eliminar el registro.')
            }
        } catch (err: any) {
            alert(err.message || 'Error al eliminar.')
        } finally {
            setEliminando(false)
        }
    }

    // Recargar datos desde el servidor
    const recargarDatos = async () => {
        const res = await obtenerReclamosDataAction({
            licitacionId: filtroLicitacion,
            anio: filtroAnio === 'TODOS' ? undefined : Number(filtroAnio),
            mes: filtroMes === 'TODOS' ? undefined : Number(filtroMes),
            busqueda
        })
        if (res.success) {
            setItems(res.items)
            setSiguienteNumero(res.siguienteNumeroReclamo)
        }
    }

    // Alternar orden al hacer clic en cabecera
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortAsc(!sortAsc)
        } else {
            setSortField(field)
            setSortAsc(true)
        }
    }

    // Filtrar y ordenar en memoria para respuesta instantánea
    const itemsFiltrados = useMemo(() => {
        return items
            .filter(item => {
                if (filtroLicitacion !== 'TODAS' && item.licitacionId !== filtroLicitacion) {
                    return false
                }
                if (filtroAnio !== 'TODOS') {
                    const anioNum = Number(filtroAnio)
                    const itemAnio = item.fechaDesviacion ? new Date(item.fechaDesviacion).getFullYear() : item.anio
                    if (itemAnio !== anioNum) return false
                }
                if (filtroMes !== 'TODOS') {
                    const mesNum = Number(filtroMes)
                    const itemMes = item.fechaDesviacion ? new Date(item.fechaDesviacion).getMonth() + 1 : 0
                    if (itemMes !== mesNum) return false
                }
                if (busqueda.trim()) {
                    const q = busqueda.toLowerCase().trim()
                    const match =
                        item.numeroReclamo.toLowerCase().includes(q) ||
                        item.producto.toLowerCase().includes(q) ||
                        item.proveedor.toLowerCase().includes(q) ||
                        (item.lote && item.lote.toLowerCase().includes(q)) ||
                        (item.marca && item.marca.toLowerCase().includes(q)) ||
                        item.zonal.toLowerCase().includes(q) ||
                        item.licitacionNombre.toLowerCase().includes(q)
                    if (!match) return false
                }
                return true
            })
            .sort((a, b) => {
                let comp = 0
                if (sortField === 'numeroReclamo') {
                    comp = (a.anio - b.anio) || (a.correlativo - b.correlativo)
                } else if (sortField === 'fechaDesviacion') {
                    comp = new Date(a.fechaDesviacion).getTime() - new Date(b.fechaDesviacion).getTime()
                } else if (sortField === 'producto') {
                    comp = a.producto.localeCompare(b.producto)
                } else if (sortField === 'proveedor') {
                    comp = a.proveedor.localeCompare(b.proveedor)
                } else if (sortField === 'licitacionNombre') {
                    comp = a.licitacionNombre.localeCompare(b.licitacionNombre)
                } else if (sortField === 'zonal') {
                    comp = a.zonal.localeCompare(b.zonal)
                } else if (sortField === 'tipoReclamo') {
                    comp = a.tipoReclamo.localeCompare(b.tipoReclamo)
                } else if (sortField === 'estado') {
                    comp = a.estado.localeCompare(b.estado)
                }
                return sortAsc ? comp : -comp
            })
    }, [items, filtroLicitacion, filtroAnio, filtroMes, busqueda, sortField, sortAsc])

    const formatearFecha = (fechaStr?: string | null) => {
        if (!fechaStr) return '-'
        try {
            const [y, m, d] = fechaStr.split('-')
            if (y && m && d) return `${d}/${m}/${y}`
            const date = new Date(fechaStr)
            return date.toLocaleDateString('es-CL')
        } catch {
            return fechaStr
        }
    }

    return (
        <div className="space-y-6">
            {/* Header del Módulo */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 tracking-wider uppercase mb-1">
                        <ShieldAlert className="w-4 h-4 text-cyan-600" />
                        <span>Área • Calidad e Inocuidad</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reclamos a Proveedores</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Registro, control y seguimiento de no conformidades por calidad e inocuidad en materias primas y productos de proveedores.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {puedeGestionar && (
                        <button
                            onClick={handleAbrirCrear}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white font-semibold text-sm shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Plus className="w-4 h-4" />
                            <span>+ Nuevo Reclamo</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Navegación por Tabs (Actualmente 'Reclamos', extensible para futuros tabs) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <button
                        onClick={() => setTabActivo('reclamos')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                            tabActivo === 'reclamos'
                                ? 'bg-cyan-50 text-cyan-800 border border-cyan-200 shadow-2xs'
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <Layers className="w-4 h-4 text-cyan-600" />
                        <span>Reclamos</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-cyan-200/70 text-cyan-900">
                            {itemsFiltrados.length}
                        </span>
                    </button>
                </div>

                {/* TAB 1: RECLAMOS */}
                {tabActivo === 'reclamos' && (
                    <div className="p-4 space-y-4">
                        {/* Barra de Filtros y Búsqueda */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                            {/* Filtro Licitación */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                    Licitación
                                </label>
                                <select
                                    value={filtroLicitacion}
                                    onChange={e => setFiltroLicitacion(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="TODAS">Todas las Licitaciones</option>
                                    {licitaciones.map(l => (
                                        <option key={l.id} value={l.id}>
                                            {l.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro Año Desviación */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                    Año Ocurrencia
                                </label>
                                <select
                                    value={filtroAnio}
                                    onChange={e => setFiltroAnio(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="TODOS">Todos los Años</option>
                                    {aniosDisponibles.map(a => (
                                        <option key={a} value={String(a)}>
                                            Año {a}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro Mes Desviación */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                    Mes Ocurrencia
                                </label>
                                <select
                                    value={filtroMes}
                                    onChange={e => setFiltroMes(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="TODOS">Todos los Meses</option>
                                    {MESES.map(m => (
                                        <option key={m.valor} value={m.valor}>
                                            {m.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Buscador en tiempo real */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                    Buscar Reclamo
                                </label>
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        value={busqueda}
                                        onChange={e => setBusqueda(e.target.value)}
                                        placeholder="N°, producto, proveedor, lote..."
                                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Tabla de Reclamos con Cabeceras Cliqueables */}
                        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-100/80 text-slate-700 uppercase font-bold text-[11px] border-b border-slate-200 select-none">
                                    <tr>
                                        {/* N° Reclamo */}
                                        <th
                                            onClick={() => handleSort('numeroReclamo')}
                                            className="px-3.5 py-3 cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>N° Reclamo</span>
                                                {sortField === 'numeroReclamo' && (
                                                    sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-cyan-700" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-700" />
                                                )}
                                            </div>
                                        </th>

                                        {/* Licitación & Zonal */}
                                        <th
                                            onClick={() => handleSort('licitacionNombre')}
                                            className="px-3.5 py-3 cursor-pointer hover:bg-slate-200/60 transition-colors"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>Licitación / Zonal</span>
                                                {sortField === 'licitacionNombre' && (
                                                    sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-cyan-700" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-700" />
                                                )}
                                            </div>
                                        </th>

                                        {/* Fecha Desviación */}
                                        <th
                                            onClick={() => handleSort('fechaDesviacion')}
                                            className="px-3.5 py-3 cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>Fecha Ocurrencia</span>
                                                {sortField === 'fechaDesviacion' && (
                                                    sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-cyan-700" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-700" />
                                                )}
                                            </div>
                                        </th>

                                        {/* Origen / Tipo */}
                                        <th
                                            onClick={() => handleSort('tipoReclamo')}
                                            className="px-3.5 py-3 cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>Tipo / Origen</span>
                                                {sortField === 'tipoReclamo' && (
                                                    sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-cyan-700" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-700" />
                                                )}
                                            </div>
                                        </th>

                                        {/* Producto / Proveedor */}
                                        <th
                                            onClick={() => handleSort('producto')}
                                            className="px-3.5 py-3 cursor-pointer hover:bg-slate-200/60 transition-colors"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>Producto / Proveedor</span>
                                                {sortField === 'producto' && (
                                                    sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-cyan-700" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-700" />
                                                )}
                                            </div>
                                        </th>

                                        {/* Lote & Cantidad */}
                                        <th className="px-3.5 py-3 whitespace-nowrap">Lote / Cantidad</th>

                                        {/* Estado / Seguimiento */}
                                        <th
                                            onClick={() => handleSort('estado')}
                                            className="px-3.5 py-3 cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>Seguimiento</span>
                                                {sortField === 'estado' && (
                                                    sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-cyan-700" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-700" />
                                                )}
                                            </div>
                                        </th>

                                        {/* Evidencias */}
                                        <th className="px-3.5 py-3 text-center whitespace-nowrap">Evidencias</th>

                                        {/* Acciones */}
                                        <th className="px-3.5 py-3 text-right whitespace-nowrap">Acciones</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-200 bg-white">
                                    {itemsFiltrados.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <FileText className="w-8 h-8 text-slate-300" />
                                                    <p className="text-sm font-semibold text-slate-600">No se encontraron reclamos a proveedores</p>
                                                    <p className="text-xs text-slate-400">
                                                        {busqueda ? 'No hay registros que coincidan con la búsqueda actual.' : 'Comienza registrando un nuevo reclamo con el botón superior.'}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        itemsFiltrados.map(item => {
                                            const totalEvidencias = item.evidencias?.length || 0

                                            return (
                                                <tr key={item.id} className="hover:bg-cyan-50/20 transition-colors">
                                                    {/* N° Reclamo */}
                                                    <td className="px-3.5 py-3 whitespace-nowrap">
                                                        <span className="font-extrabold text-cyan-900 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 font-mono text-[11px]">
                                                            {item.numeroReclamo}
                                                        </span>
                                                    </td>

                                                    {/* Licitación & Zonal */}
                                                    <td className="px-3.5 py-3 max-w-[200px]">
                                                        <div className="font-bold text-slate-900 truncate" title={item.licitacionNombre}>
                                                            {item.licitacionNombre}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                                                            <Building2 className="w-3 h-3 text-amber-600 shrink-0" />
                                                            <span className="truncate">{item.zonal}</span>
                                                        </div>
                                                    </td>

                                                    {/* Fecha Desviación */}
                                                    <td className="px-3.5 py-3 whitespace-nowrap">
                                                        <div className="font-semibold text-slate-800 flex items-center gap-1">
                                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                            <span>{formatearFecha(item.fechaDesviacion)}</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 truncate max-w-[130px]" title={item.lugar}>
                                                            📍 {item.lugar}
                                                        </div>
                                                    </td>

                                                    {/* Origen / Tipo */}
                                                    <td className="px-3.5 py-3 whitespace-nowrap">
                                                        <div className="flex flex-col gap-1 items-start">
                                                            <span
                                                                className={`px-2 py-0.2 rounded-full text-[10px] font-extrabold uppercase border ${
                                                                    item.tipoReclamo === 'INOCUIDAD'
                                                                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                                                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                                                }`}
                                                            >
                                                                ● {item.tipoReclamo}
                                                            </span>
                                                            <span className="text-[10px] text-slate-600 font-medium">
                                                                {item.origenReclamo === 'RECLAMO_CLIENTE_C8'
                                                                    ? '📋 Cliente C8'
                                                                    : item.origenReclamo === 'RECLAMO_CLIENTE'
                                                                    ? '👤 Cliente'
                                                                    : '🏢 Zonal'}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Producto / Proveedor */}
                                                    <td className="px-3.5 py-3 max-w-[220px]">
                                                        <div className="font-bold text-slate-900 truncate" title={item.producto}>
                                                            {item.producto}
                                                        </div>
                                                        <div className="text-[11px] text-slate-600 truncate mt-0.5" title={item.proveedor}>
                                                            Prov: <strong>{item.proveedor}</strong>
                                                        </div>
                                                        {item.marca && (
                                                            <div className="text-[10px] text-slate-400 truncate">
                                                                Marca: {item.marca}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Lote & Cantidad */}
                                                    <td className="px-3.5 py-3 whitespace-nowrap">
                                                        <div className="text-slate-800 font-medium">
                                                            {item.cantidad !== null ? `${item.cantidad} ${item.formatoCantidad || ''}` : '-'}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-mono">
                                                            Lote: {item.lote || 'S/I'}
                                                        </div>
                                                    </td>

                                                    {/* Seguimiento / Estado */}
                                                    <td className="px-3.5 py-3 whitespace-nowrap">
                                                        <span
                                                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                                                                item.estado === 'RESPONDIDO'
                                                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                                    : item.estado === 'ENVIADO_PROVEEDOR'
                                                                    ? 'bg-sky-50 text-sky-800 border-sky-200'
                                                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                                            }`}
                                                        >
                                                            {item.estado === 'RESPONDIDO'
                                                                ? 'Respondido'
                                                                : item.estado === 'ENVIADO_PROVEEDOR'
                                                                ? 'Enviado Prov.'
                                                                : 'Abierto'}
                                                        </span>
                                                        {item.fechaEnvioProveedor && (
                                                            <div className="text-[10px] text-slate-400 mt-1">
                                                                Env: {formatearFecha(item.fechaEnvioProveedor)}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Evidencias */}
                                                    <td className="px-3.5 py-3 text-center whitespace-nowrap">
                                                        {totalEvidencias > 0 ? (
                                                            <button
                                                                onClick={() => setReclamoVer(item)}
                                                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors"
                                                                title="Ver archivos adjuntos"
                                                            >
                                                                <Paperclip className="w-3 h-3 text-cyan-700" />
                                                                <span>{totalEvidencias}</span>
                                                            </button>
                                                        ) : (
                                                            <span className="text-slate-300 text-[11px]">-</span>
                                                        )}
                                                    </td>

                                                    {/* Acciones */}
                                                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                onClick={() => setReclamoVer(item)}
                                                                title="Ver Ficha Completa"
                                                                className="p-1 rounded text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 transition-colors"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>

                                                            {/* Acciones: Editar si tiene puedeEditar o puedeFechasSeguimiento o es Admin */}
                                                            {(puedeGestionar || privilegiosUsuario.puedeEditar || privilegiosUsuario.puedeFechasSeguimiento) && (
                                                                <button
                                                                    onClick={() => handleAbrirEditar(item)}
                                                                    title="Editar Reclamo / Seguimiento"
                                                                    className="p-1 rounded text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                            )}

                                                            {puedeGestionar && (
                                                                <button
                                                                    onClick={() => setReclamoAEliminar(item)}
                                                                    title="Eliminar Reclamo"
                                                                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
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
                    </div>
                )}
            </div>

            {/* MODAL FORMULARIO: NUEVO / EDITAR RECLAMO (4 PANELES) */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp">
                        {/* Cabecera del Modal */}
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-cyan-100 rounded-lg text-cyan-800">
                                    <ShieldAlert className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                                        {modoEdicion ? `Editar Reclamo N° ${formNumeroReclamo}` : 'Ingreso de Reclamo a Proveedor'}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Completa los antecedentes del producto observado y su trazabilidad.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Formulario con Scroll Interno */}
                        <form onSubmit={handleGuardar} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                                {errorModal && (
                                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <span>{errorModal}</span>
                                    </div>
                                )}

                                {/* Encabezado Superior: Licitación y N° Reclamo */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                            Licitación <span className="text-rose-500">*</span>
                                        </label>
                                        <select
                                            value={formLicitacionId}
                                            onChange={e => handleLicitacionChange(e.target.value)}
                                            required
                                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        >
                                            {licitaciones.map(l => (
                                                <option key={l.id} value={l.id}>
                                                    {l.nombre}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                            N° Reclamo
                                        </label>
                                        <input
                                            type="text"
                                            readOnly
                                            value={formNumeroReclamo}
                                            className="w-full px-3 py-1.5 text-xs bg-slate-100 border border-slate-300 rounded-lg text-cyan-900 font-extrabold font-mono select-none"
                                        />
                                        <span className="text-[10px] text-slate-400">Autonumérico correlativo anual</span>
                                    </div>
                                </div>

                                {/* PANEL 1: ANTECEDENTES DE RECLAMO */}
                                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-3">
                                    <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5 border-b border-amber-200/80 pb-1.5">
                                        <Building2 className="w-4 h-4 text-amber-700" />
                                        <span>ANTECEDENTES DE RECLAMO</span>
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        {/* Zonal */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                                Zonal (Sucursal de la Licitación) <span className="text-rose-500">*</span>
                                            </label>
                                            <select
                                                value={formZonal}
                                                onChange={e => setFormZonal(e.target.value)}
                                                required
                                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            >
                                                {sucursalesLicitacion.length === 0 ? (
                                                    <option value="">Sin sucursales asociadas</option>
                                                ) : (
                                                    sucursalesLicitacion.map(suc => (
                                                        <option key={suc} value={suc}>
                                                            🏢 {suc}
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        </div>

                                        {/* Origen: Reclamo Zonal / Reclamo Cliente / Reclamo cliente por C8 */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                                Origen del Reclamo <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="flex flex-wrap items-center gap-4 pt-1">
                                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="origenReclamo"
                                                        value="RECLAMO_ZONAL"
                                                        checked={formOrigenReclamo === 'RECLAMO_ZONAL'}
                                                        onChange={() => setFormOrigenReclamo('RECLAMO_ZONAL')}
                                                        className="text-cyan-700 focus:ring-cyan-500"
                                                    />
                                                    <span>Reclamo Zonal</span>
                                                </label>
                                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="origenReclamo"
                                                        value="RECLAMO_CLIENTE"
                                                        checked={formOrigenReclamo === 'RECLAMO_CLIENTE'}
                                                        onChange={() => setFormOrigenReclamo('RECLAMO_CLIENTE')}
                                                        className="text-cyan-700 focus:ring-cyan-500"
                                                    />
                                                    <span>Reclamo Cliente</span>
                                                </label>
                                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="origenReclamo"
                                                        value="RECLAMO_CLIENTE_C8"
                                                        checked={formOrigenReclamo === 'RECLAMO_CLIENTE_C8'}
                                                        onChange={() => setFormOrigenReclamo('RECLAMO_CLIENTE_C8')}
                                                        className="text-cyan-700 focus:ring-cyan-500"
                                                    />
                                                    <span>Reclamo cliente por C8</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Fecha ocurrencia de desviación */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                                Fecha ocurrencia de desviación <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                value={formFechaDesviacion}
                                                onChange={e => setFormFechaDesviacion(e.target.value)}
                                                required
                                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            />
                                        </div>

                                        {/* Lugar */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                                Lugar <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formLugar}
                                                onChange={e => setFormLugar(e.target.value)}
                                                placeholder="Ej: Casino Escuela D-12 / Bodega Central..."
                                                required
                                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            />
                                        </div>

                                        {/* Reclamo de Calidad / Reclamo de Inocuidad */}
                                        <div className="sm:col-span-2">
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                                Tipo de Reclamo <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="flex items-center gap-6 pt-1">
                                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="tipoReclamo"
                                                        value="CALIDAD"
                                                        checked={formTipoReclamo === 'CALIDAD'}
                                                        onChange={() => setFormTipoReclamo('CALIDAD')}
                                                        className="text-amber-600 focus:ring-amber-500"
                                                    />
                                                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[11px]">
                                                        Reclamo de Calidad
                                                    </span>
                                                </label>
                                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="tipoReclamo"
                                                        value="INOCUIDAD"
                                                        checked={formTipoReclamo === 'INOCUIDAD'}
                                                        onChange={() => setFormTipoReclamo('INOCUIDAD')}
                                                        className="text-rose-600 focus:ring-rose-500"
                                                    />
                                                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-bold text-[11px]">
                                                        Reclamo de Inocuidad
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* PANEL 2: PRODUCTO */}
                                <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/30 space-y-3">
                                    <h4 className="text-xs font-black text-sky-950 uppercase tracking-wider flex items-center gap-1.5 border-b border-sky-200/80 pb-1.5">
                                        <Layers className="w-4 h-4 text-sky-700" />
                                        <span>PRODUCTO</span>
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                        {/* PRODUCTO */}
                                        <div className="sm:col-span-2">
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                                PRODUCTO <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formProducto}
                                                onChange={e => setFormProducto(e.target.value)}
                                                placeholder="Ej: Manzanas rojas / Leche fluida descremada..."
                                                required
                                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                            />
                                        </div>

                                        {/* Proveedor */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                                Proveedor <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formProveedor}
                                                onChange={e => setFormProveedor(e.target.value)}
                                                placeholder="Ej: Soprole S.A. / Agrícola El Monte..."
                                                required
                                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                            />
                                        </div>

                                        {/* Marca */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                                Marca
                                            </label>
                                            <input
                                                type="text"
                                                value={formMarca}
                                                onChange={e => setFormMarca(e.target.value)}
                                                placeholder="Ej: Loncoleche / Nestlé..."
                                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                            />
                                        </div>

                                        {/* Fecha Elaboración */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                                Fecha Elaboración
                                            </label>
                                            <input
                                                type="date"
                                                value={formFechaElaboracion}
                                                onChange={e => setFormFechaElaboracion(e.target.value)}
                                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                            />
                                        </div>

                                        {/* Fecha Vencimiento */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                                Fecha Vencimiento
                                            </label>
                                            <input
                                                type="date"
                                                value={formFechaVencimiento}
                                                onChange={e => setFormFechaVencimiento(e.target.value)}
                                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                            />
                                        </div>

                                        {/* Lote */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                                Lote
                                            </label>
                                            <input
                                                type="text"
                                                value={formLote}
                                                onChange={e => setFormLote(e.target.value)}
                                                placeholder="Ej: L24-0988A..."
                                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                                            />
                                        </div>

                                        {/* Formato */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                                Formato
                                            </label>
                                            <input
                                                type="text"
                                                value={formFormato}
                                                onChange={e => setFormFormato(e.target.value)}
                                                placeholder="Ej: Bolsa x 1 Kg / Caja 12 un..."
                                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                            />
                                        </div>

                                        {/* Cantidad y Formato Cantidad */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                                Cantidad / Formato Cant
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={formCantidad}
                                                    onChange={e => setFormCantidad(e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                />
                                                <select
                                                    value={formFormatoCantidad}
                                                    onChange={e => setFormFormatoCantidad(e.target.value as any)}
                                                    className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                >
                                                    <option value="Kilo">Kilo</option>
                                                    <option value="Unidad">Unidad</option>
                                                    <option value="Otro">Otro</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* PANEL 3: DESCRIPCION DE LA DESVIACION */}
                                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/20 space-y-3">
                                    <h4 className="text-xs font-black text-rose-950 uppercase tracking-wider flex items-center gap-1.5 border-b border-rose-200/80 pb-1.5">
                                        <AlertTriangle className="w-4 h-4 text-rose-700" />
                                        <span>DESCRIPCION DE LA DESVIACION</span>
                                    </h4>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                            Observación / Detalle de la Desviación
                                        </label>
                                        <textarea
                                            value={formObservacion}
                                            onChange={e => setFormObservacion(e.target.value)}
                                            placeholder="Detalla minuciosamente el defecto observado, aspecto físico, olor, rotulado, sello alterado o presencia de elementos extraños..."
                                            rows={3}
                                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        />
                                    </div>

                                    {/* Adjuntar evidencia (máximo 6 archivos) */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase">
                                                Adjuntar Evidencia (Imágenes, Documentos, Videos)
                                            </label>
                                            <span className="text-[10px] text-slate-500 font-semibold">
                                                Máximo 6 archivos (Actuales: {evidenciasExistentes.length + archivosNuevos.length}/6)
                                            </span>
                                        </div>

                                        {/* Lista de archivos ya cargados / existentes */}
                                        {(evidenciasExistentes.length > 0 || archivosNuevos.length > 0) && (
                                            <div className="flex flex-wrap gap-2 mb-2 p-2 bg-white rounded-lg border border-slate-200">
                                                {evidenciasExistentes.map((ev, idx) => (
                                                    <div
                                                        key={`existente-${idx}`}
                                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-md text-xs text-slate-800"
                                                    >
                                                        <Paperclip className="w-3 h-3 text-cyan-700" />
                                                        <span className="truncate max-w-[150px]" title={ev.nombre}>
                                                            {ev.nombre}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleQuitarEvidenciaExistente(idx)}
                                                            className="text-slate-400 hover:text-rose-600 p-0.5 ml-1"
                                                            title="Quitar archivo"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}

                                                {archivosNuevos.map((f, idx) => (
                                                    <div
                                                        key={`nuevo-${idx}`}
                                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50 border border-cyan-300 rounded-md text-xs text-cyan-900 font-medium"
                                                    >
                                                        <Paperclip className="w-3 h-3 text-cyan-700" />
                                                        <span className="truncate max-w-[150px]" title={f.name}>
                                                            {f.name}
                                                        </span>
                                                        <span className="text-[10px] text-cyan-700 font-semibold">
                                                            ({(f.size / 1024).toFixed(0)} KB)
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleQuitarArchivoNuevo(idx)}
                                                            className="text-cyan-700 hover:text-rose-600 p-0.5 ml-1"
                                                            title="Quitar archivo"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Botón de Carga */}
                                        {evidenciasExistentes.length + archivosNuevos.length < 6 && (
                                            <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors text-slate-600">
                                                <Paperclip className="w-4 h-4 text-cyan-600" />
                                                <span className="text-xs font-medium">
                                                    Haz clic para seleccionar imágenes, videos o documentos (hasta {6 - (evidenciasExistentes.length + archivosNuevos.length)} más)
                                                </span>
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                                                    onChange={handleFileChange}
                                                    className="hidden"
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                {/* PANEL 4: SEGUIMIENTO */}
                                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/25 space-y-3">
                                    <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5 border-b border-emerald-200/80 pb-1.5">
                                        <Clock className="w-4 h-4 text-emerald-700" />
                                        <span>SEGUIMIENTO</span>
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                        {/* FECHA RECEPCION RECLAMO */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                                Fecha Recepción Reclamo
                                            </label>
                                            <input
                                                type="date"
                                                value={formFechaRecepcionReclamo}
                                                onChange={e => setFormFechaRecepcionReclamo(e.target.value)}
                                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                        </div>

                                        {/* FECHA ENVIO A PROVEEDOR */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                                                    Fecha Envío a Proveedor
                                                </label>
                                                {!puedeGestionar && !privilegiosUsuario.puedeFechasSeguimiento && (
                                                    <span className="text-[10px] text-amber-600 font-semibold">Solo lectura</span>
                                                )}
                                            </div>
                                            <input
                                                type="date"
                                                value={formFechaEnvioProveedor}
                                                disabled={modoEdicion && !puedeGestionar && !privilegiosUsuario.puedeFechasSeguimiento}
                                                onChange={e => setFormFechaEnvioProveedor(e.target.value)}
                                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                            />
                                        </div>

                                        {/* FECHA RECEPCION RESPUESTA */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                                                    Fecha Recepción Respuesta
                                                </label>
                                                {!puedeGestionar && !privilegiosUsuario.puedeFechasSeguimiento && (
                                                    <span className="text-[10px] text-amber-600 font-semibold">Solo lectura</span>
                                                )}
                                            </div>
                                            <input
                                                type="date"
                                                value={formFechaRecepcionRespuesta}
                                                disabled={modoEdicion && !puedeGestionar && !privilegiosUsuario.puedeFechasSeguimiento}
                                                onChange={e => setFormFechaRecepcionRespuesta(e.target.value)}
                                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                            />
                                        </div>
                                    </div>

                                    {/* Botón y Sección de Adjuntar Documento de Respuesta (Paso 3) */}
                                    {Boolean(formFechaRecepcionRespuesta) && (
                                        <div className="mt-3 pt-3 border-t border-emerald-200/80 animate-fadeIn">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-1.5">
                                                    <FileCheck2 className="w-4 h-4 text-emerald-700" />
                                                    <span className="text-xs font-bold text-emerald-950 uppercase">
                                                        Documento de Respuesta del Proveedor (Paso 3)
                                                    </span>
                                                </div>
                                                {!puedeGestionar && !privilegiosUsuario.puedeAdjuntarRespuesta && (
                                                    <span className="text-[10px] text-rose-600 font-semibold">
                                                        Requiere privilegio 'Adjuntar Respuesta'
                                                    </span>
                                                )}
                                            </div>

                                            {/* Archivo ya existente o recién seleccionado */}
                                            {archivoRespuestaNuevo ? (
                                                <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-900 font-medium">
                                                    <div className="flex items-center gap-2 truncate">
                                                        <Paperclip className="w-4 h-4 text-emerald-700 shrink-0" />
                                                        <span className="truncate max-w-xs font-bold">{archivoRespuestaNuevo.name}</span>
                                                        <span className="text-[11px] text-emerald-700">({(archivoRespuestaNuevo.size / 1024).toFixed(0)} KB)</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setArchivoRespuestaNuevo(null)}
                                                        className="text-emerald-700 hover:text-rose-600 p-1 rounded"
                                                        title="Quitar archivo"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : archivoRespuestaExistente ? (
                                                <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800">
                                                    <a
                                                        href={archivoRespuestaExistente.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 truncate text-cyan-800 hover:underline font-semibold"
                                                    >
                                                        <FileText className="w-4 h-4 text-cyan-700 shrink-0" />
                                                        <span className="truncate max-w-xs">{archivoRespuestaExistente.nombre}</span>
                                                        <ExternalLink className="w-3 h-3 text-slate-400" />
                                                    </a>
                                                    {(puedeGestionar || privilegiosUsuario.puedeAdjuntarRespuesta) && (
                                                        <label className="text-[11px] font-bold text-cyan-700 hover:text-cyan-900 cursor-pointer px-2 py-1 bg-cyan-50 rounded hover:bg-cyan-100 transition-colors">
                                                            Reemplazar Documento
                                                            <input
                                                                type="file"
                                                                accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                                                                onChange={e => {
                                                                    const f = e.target.files?.[0]
                                                                    if (f) setArchivoRespuestaNuevo(f)
                                                                }}
                                                                className="hidden"
                                                            />
                                                        </label>
                                                    )}
                                                </div>
                                            ) : (
                                                <label className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-xl transition-all text-xs font-semibold ${
                                                    (puedeGestionar || privilegiosUsuario.puedeAdjuntarRespuesta)
                                                        ? 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/60 cursor-pointer text-emerald-900'
                                                        : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                                                }`}>
                                                    <Paperclip className="w-4 h-4 text-emerald-700" />
                                                    <span>Adjuntar documento de respuesta del proveedor (PDF, Word, Excel, Imagen)</span>
                                                    {(puedeGestionar || privilegiosUsuario.puedeAdjuntarRespuesta) && (
                                                        <input
                                                            type="file"
                                                            accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                                                            onChange={e => {
                                                                const f = e.target.files?.[0]
                                                                if (f) setArchivoRespuestaNuevo(f)
                                                            }}
                                                            className="hidden"
                                                        />
                                                    )}
                                                </label>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer Modal Sticky */}
                            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
                                <span className="text-[11px] text-slate-500">
                                    Registrando como: <strong>{usuarioActual}</strong>
                                </span>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setModalOpen(false)}
                                        className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200/80 rounded-lg transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={guardando}
                                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs shadow-md disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        {guardando ? (
                                            <>
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                <span>Guardando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>{modoEdicion ? 'Actualizar Reclamo' : 'Guardar Reclamo'}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL FICHA COMPLETA Y EVIDENCIAS */}
            {reclamoVer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                            <div>
                                <span className="font-mono font-extrabold text-cyan-800 bg-cyan-100/70 px-2.5 py-0.5 rounded text-xs border border-cyan-200">
                                    {reclamoVer.numeroReclamo}
                                </span>
                                <h3 className="text-base font-bold text-slate-900 mt-1">
                                    {reclamoVer.producto} — {reclamoVer.proveedor}
                                </h3>
                            </div>
                            <button
                                onClick={() => setReclamoVer(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-800">
                            {/* Panel 1 */}
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-2 text-cyan-800">
                                    1. Antecedentes del Reclamo
                                </h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><strong>Licitación:</strong> {reclamoVer.licitacionNombre}</div>
                                    <div><strong>Zonal:</strong> {reclamoVer.zonal}</div>
                                    <div><strong>Origen:</strong> {reclamoVer.origenReclamo === 'RECLAMO_CLIENTE_C8' ? 'Reclamo cliente por C8' : reclamoVer.origenReclamo === 'RECLAMO_CLIENTE' ? 'Reclamo Cliente' : 'Reclamo Zonal'}</div>
                                    <div><strong>Tipo:</strong> {reclamoVer.tipoReclamo}</div>
                                    <div><strong>Fecha Ocurrencia:</strong> {formatearFecha(reclamoVer.fechaDesviacion)}</div>
                                    <div><strong>Lugar:</strong> {reclamoVer.lugar}</div>
                                </div>
                            </div>

                            {/* Panel 2 */}
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-2 text-cyan-800">
                                    2. Datos del Producto
                                </h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><strong>Producto:</strong> {reclamoVer.producto}</div>
                                    <div><strong>Proveedor:</strong> {reclamoVer.proveedor}</div>
                                    <div><strong>Marca:</strong> {reclamoVer.marca || '-'}</div>
                                    <div><strong>Lote:</strong> {reclamoVer.lote || '-'}</div>
                                    <div><strong>Formato:</strong> {reclamoVer.formato || '-'}</div>
                                    <div><strong>Cantidad:</strong> {reclamoVer.cantidad !== null ? `${reclamoVer.cantidad} ${reclamoVer.formatoCantidad || ''}` : '-'}</div>
                                    <div><strong>F. Elaboración:</strong> {formatearFecha(reclamoVer.fechaElaboracion)}</div>
                                    <div><strong>F. Vencimiento:</strong> {formatearFecha(reclamoVer.fechaVencimiento)}</div>
                                </div>
                            </div>

                            {/* Panel 3 */}
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-2 text-cyan-800">
                                    3. Descripción de la Desviación
                                </h4>
                                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                    {reclamoVer.observacion || 'Sin observación registrada.'}
                                </p>

                                <div className="mt-3 pt-3 border-t border-slate-200">
                                    <span className="font-bold text-slate-900 uppercase text-[11px] block mb-2">
                                        Evidencias Adjuntas ({reclamoVer.evidencias?.length || 0}):
                                    </span>
                                    {(!reclamoVer.evidencias || reclamoVer.evidencias.length === 0) ? (
                                        <p className="text-slate-400 italic">No se adjuntaron evidencias.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {reclamoVer.evidencias.map((ev, idx) => (
                                                <a
                                                    key={idx}
                                                    href={ev.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white hover:bg-cyan-50/50 hover:border-cyan-300 transition-colors group"
                                                >
                                                    <div className="flex items-center gap-2 truncate">
                                                        {ev.tipo?.startsWith('image/') ? (
                                                            <FileImage className="w-4 h-4 text-cyan-600 shrink-0" />
                                                        ) : ev.tipo?.startsWith('video/') ? (
                                                            <FileVideo className="w-4 h-4 text-purple-600 shrink-0" />
                                                        ) : (
                                                            <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                                                        )}
                                                        <span className="truncate text-xs font-semibold text-slate-800 group-hover:text-cyan-800">
                                                            {ev.nombre}
                                                        </span>
                                                    </div>
                                                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-700 shrink-0 ml-1" />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Panel 4 */}
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-2 text-cyan-800">
                                    4. Seguimiento
                                </h4>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">Recepción Reclamo</div>
                                        <div className="font-semibold text-slate-800 mt-0.5">{formatearFecha(reclamoVer.fechaRecepcionReclamo)}</div>
                                    </div>
                                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">Envío Proveedor</div>
                                        <div className="font-semibold text-slate-800 mt-0.5">{formatearFecha(reclamoVer.fechaEnvioProveedor)}</div>
                                    </div>
                                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">Recepción Respuesta</div>
                                        <div className="font-semibold text-slate-800 mt-0.5">{formatearFecha(reclamoVer.fechaRecepcionRespuesta)}</div>
                                    </div>
                                </div>

                                {reclamoVer.archivoRespuesta && (
                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                        <span className="font-bold text-slate-900 uppercase text-[11px] block mb-1.5 text-emerald-800">
                                            Documento de Respuesta del Proveedor:
                                        </span>
                                        <a
                                            href={reclamoVer.archivoRespuesta.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 p-2 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-semibold transition-colors"
                                        >
                                            <FileCheck2 className="w-4 h-4 text-emerald-700 shrink-0" />
                                            <span>{reclamoVer.archivoRespuesta.nombre}</span>
                                            <ExternalLink className="w-3.5 h-3.5 text-emerald-600 ml-1" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
                            <button
                                onClick={() => setReclamoVer(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/80 rounded-lg transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CONFIRMAR ELIMINACIÓN */}
            {reclamoAEliminar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center animate-scaleUp">
                        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mb-1">¿Eliminar Reclamo?</h3>
                        <p className="text-xs text-slate-500 mb-4">
                            Estás a punto de borrar el reclamo <strong>N° {reclamoAEliminar.numeroReclamo}</strong> ({reclamoAEliminar.producto}). Esta acción quedará registrada en auditoría.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={() => setReclamoAEliminar(null)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleEliminar}
                                disabled={eliminando}
                                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm disabled:opacity-50"
                            >
                                {eliminando ? 'Eliminando...' : 'Sí, Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL POPUP PASO 2: SELECCIÓN DESTINO DE COMPRAS (ETAPA 2: ENVÍO A COMPRAS) */}
            {modalDestinoComprasOpen && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-scaleUp">
                        <div className="px-6 py-4 bg-gradient-to-r from-cyan-700 to-sky-700 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Send className="w-5 h-5" />
                                <h3 className="font-bold text-sm">Etapa 2: Envío a Compras</h3>
                            </div>
                            <button
                                onClick={() => setModalDestinoComprasOpen(false)}
                                className="text-white/80 hover:text-white p-1"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-xs text-slate-700 leading-relaxed">
                                Estás registrando la <strong>Fecha Envío a Proveedor</strong> ({formFechaEnvioProveedor}). Selecciona a qué equipo de Compras deseas notificar por correo electrónico:
                            </p>

                            <div className="space-y-2.5">
                                <label
                                    onClick={() => setDestinoComprasSeleccionado('MATRIZ')}
                                    className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                                        destinoComprasSeleccionado === 'MATRIZ'
                                            ? 'border-cyan-600 bg-cyan-50/60 text-cyan-950 shadow-xs'
                                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="destinoComprasModal"
                                        checked={destinoComprasSeleccionado === 'MATRIZ'}
                                        onChange={() => setDestinoComprasSeleccionado('MATRIZ')}
                                        className="mt-0.5 text-cyan-700 focus:ring-cyan-500"
                                    />
                                    <div>
                                        <div className="text-xs font-bold flex items-center gap-1.5">
                                            🏢 Compras Matriz
                                        </div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                            Notifica a la lista de distribución de Compras en Casa Matriz.
                                        </div>
                                    </div>
                                </label>

                                <label
                                    onClick={() => setDestinoComprasSeleccionado('SUCURSAL')}
                                    className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                                        destinoComprasSeleccionado === 'SUCURSAL'
                                            ? 'border-cyan-600 bg-cyan-50/60 text-cyan-950 shadow-xs'
                                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="destinoComprasModal"
                                        checked={destinoComprasSeleccionado === 'SUCURSAL'}
                                        onChange={() => setDestinoComprasSeleccionado('SUCURSAL')}
                                        className="mt-0.5 text-cyan-700 focus:ring-cyan-500"
                                    />
                                    <div>
                                        <div className="text-xs font-bold flex items-center gap-1.5">
                                            📍 Compras Sucursal ({formZonal || 'Sucursal del Reclamo'})
                                        </div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                            Envía automáticamente a todos los correos asignados a la sucursal <strong>{formZonal}</strong> en la lista de distribución.
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setModalDestinoComprasOpen(false)}
                                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={guardando}
                                onClick={() => ejecutarGuardado(destinoComprasSeleccionado)}
                                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
                            >
                                {guardando && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                <span>Confirmar y Guardar Reclamo</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
