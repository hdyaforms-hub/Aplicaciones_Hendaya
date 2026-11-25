'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { 
    FileText, Plus, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, 
    Building2, School, ShieldAlert, DollarSign, Download, 
    Upload, RefreshCw, AlertCircle, CheckCircle2, XCircle, Trash2, Edit3, 
    Layers, CheckSquare, Square, Eye, Paperclip, ExternalLink
} from 'lucide-react'
import { 
    ActaC8Item, FiltrosData, 
    guardarActaC8Action, eliminarActaC8Action, 
    obtenerValorUtmAction, importarActasC8MasivoAction,
    subirDocumentoAprobacionC8Action
} from './actions'

interface Props {
    initialActas: ActaC8Item[]
    filtrosData: FiltrosData
    canManage: boolean
    canImport: boolean
    isAdmin: boolean
    userName: string
}

const MESES_NOMBRES = [
    { num: 1, nombre: 'Enero' },
    { num: 2, nombre: 'Febrero' },
    { num: 3, nombre: 'Marzo' },
    { num: 4, nombre: 'Abril' },
    { num: 5, nombre: 'Mayo' },
    { num: 6, nombre: 'Junio' },
    { num: 7, nombre: 'Julio' },
    { num: 8, nombre: 'Agosto' },
    { num: 9, nombre: 'Septiembre' },
    { num: 10, nombre: 'Octubre' },
    { num: 11, nombre: 'Noviembre' },
    { num: 12, nombre: 'Diciembre' },
]

export default function ActasC8Client({
    initialActas,
    filtrosData,
    canManage,
    canImport,
    isAdmin,
    userName
}: Props) {
    const [activeTab, setActiveTab] = useState<'c8'>('c8')
    const [actas, setActas] = useState<ActaC8Item[]>(initialActas)
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)

    // Filtros
    const [filtroLicitacion, setFiltroLicitacion] = useState('')
    const [filtroSucursal, setFiltroSucursal] = useState('')
    const [filtroRbd, setFiltroRbd] = useState<number | ''>('')
    const [busquedaRbdTexto, setBusquedaRbdTexto] = useState('')
    const [filtroAnio, setFiltroAnio] = useState<number | ''>('')
    const [filtroMes, setFiltroMes] = useState<number | ''>('')
    const [filtroTextoGlobal, setFiltroTextoGlobal] = useState('')

    // Autocomplete dropdown
    const [rbdDropdownOpen, setRbdDropdownOpen] = useState(false)
    const rbdDropdownRef = useRef<HTMLDivElement>(null)

    // Ordenamiento por cabeceras
    type SortKey = 'fechaNotificacion' | 'folio' | 'rbd' | 'establecimiento' | 'sucursal' | 'licitacion' | 'multaEstimadaUtm' | 'calculoPesosUtm' | 'calidadOInocuidad'
    const [sortKey, setSortKey] = useState<SortKey>('fechaNotificacion')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

    // Modal Formulario Registro / Edición
    const [modalFormOpen, setModalFormOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<ActaC8Item | null>(null)
    const [saving, setSaving] = useState(false)

    // Form fields
    const [formFolio, setFormFolio] = useState('')
    const [formLicitacion, setFormLicitacion] = useState('')
    const [formFechaNotif, setFormFechaNotif] = useState('')
    const [formHoraNotif, setFormHoraNotif] = useState('')
    const [formFechaHallazgo, setFormFechaHallazgo] = useState('')
    const [formSucursal, setFormSucursal] = useState('')
    const [formRbd, setFormRbd] = useState<number | ''>('')
    const [formEstablecimiento, setFormEstablecimiento] = useState('')
    const [formPrepProducto, setFormPrepProducto] = useState('')
    const [formHallazgo, setFormHallazgo] = useState('')
    const [formMotivoGenericoId, setFormMotivoGenericoId] = useState('')
    const [formMotivoGenericoTexto, setFormMotivoGenericoTexto] = useState('')
    const [formProveedor, setFormProveedor] = useState('')
    const [formInstitucion, setFormInstitucion] = useState('JUNAEB')
    const [formFechaTrazabilidad, setFormFechaTrazabilidad] = useState('')
    const [formHoraTrazabilidad, setFormHoraTrazabilidad] = useState('')
    const [formFechaRespuestaCausa, setFormFechaRespuestaCausa] = useState('')
    const [formHoraRespuestaCausa, setFormHoraRespuestaCausa] = useState('')
    const [formEnviaReclamo, setFormEnviaReclamo] = useState(false)

    // Campos de Multa y Tipo
    const [formTipoMulta, setFormTipoMulta] = useState<'Tipo 1' | 'Tipo 2' | 'Tipo 3' | 'ETA'>('Tipo 1')
    const [formMultaUtm, setFormMultaUtm] = useState<number>(200)
    const [formAprobadoInstitucion, setFormAprobadoInstitucion] = useState(false)

    // Datos de Aprobación por Institución
    const [formAprobadorCorreo, setFormAprobadorCorreo] = useState('')
    const [formAprobadorNombre, setFormAprobadorNombre] = useState('')
    const [formAprobadorFecha, setFormAprobadorFecha] = useState('')
    const [formAprobadorDocUrl, setFormAprobadorDocUrl] = useState('')
    const [formAprobadorDocNombre, setFormAprobadorDocNombre] = useState('')
    const [uploadingDoc, setUploadingDoc] = useState(false)

    // Modal secundario de Aprobación por Institución
    const [modalAprobacionOpen, setModalAprobacionOpen] = useState(false)

    // Modal de Vista Previa de Documento Adjunto
    const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null)
    const [previewDocNombre, setPreviewDocNombre] = useState<string>('')

    const [formRespaldo1, setFormRespaldo1] = useState('')
    const [formRespaldo2, setFormRespaldo2] = useState('')
    const [formRespaldo3, setFormRespaldo3] = useState('')
    const [formRespaldo4, setFormRespaldo4] = useState('')
    const [formObservacion, setFormObservacion] = useState('')

    // Campos dinámicos / calculados
    const [calcMes, setCalcMes] = useState<number>(0)
    const [calcAnio, setCalcAnio] = useState<number>(0)
    const [calcValorUtm, setCalcValorUtm] = useState<number>(0)
    const [formAplicaC8, setFormAplicaC8] = useState(true)
    const [formCalidadOInocuidad, setFormCalidadOInocuidad] = useState('Calidad')
    const [formEficacia, setFormEficacia] = useState('')
    const [formRespuestaInstitucion, setFormRespuestaInstitucion] = useState('')

    // Form smart rbd autocomplete
    const [formRbdSearch, setFormRbdSearch] = useState('')
    const [formRbdDropdownOpen, setFormRbdDropdownOpen] = useState(false)

    // Modal Carga Masiva Excel
    const [modalImportOpen, setModalImportOpen] = useState(false)
    const [importing, setImporting] = useState(false)
    const [importErrors, setImportErrors] = useState<string[]>([])
    const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const docInputRef = useRef<HTMLInputElement>(null)

    // Cerrar dropdown al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (rbdDropdownRef.current && !rbdDropdownRef.current.contains(event.target as Node)) {
                setRbdDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Recalcular mes, año y monto UTM reactivamente al cambiar formFechaNotif
    useEffect(() => {
        if (!formFechaNotif) {
            setCalcMes(0)
            setCalcAnio(0)
            setCalcValorUtm(0)
            return
        }

        const d = new Date(formFechaNotif)
        if (!isNaN(d.getTime())) {
            const anio = d.getUTCFullYear()
            const mes = d.getUTCMonth() + 1
            setCalcAnio(anio)
            setCalcMes(mes)

            obtenerValorUtmAction(anio, mes).then(val => {
                setCalcValorUtm(val)
            }).catch(() => setCalcValorUtm(0))
        }
    }, [formFechaNotif])

    // Valor anual del contrato según licitación y año actual
    const valorContratoAnual = useMemo(() => {
        if (!formLicitacion || !calcAnio) return 0
        const found = filtrosData.valoresContrato?.find(c => 
            (c.licitacion === formLicitacion || c.licitacion === `Licitación ${formLicitacion}`) && 
            c.anio === calcAnio
        )
        return found ? found.montoAnualPesos : 0
    }, [formLicitacion, calcAnio, filtrosData.valoresContrato])

    // Cálculo automático de Multa UTM y Total en Pesos según Tipo y Check Aprobado por Institución
    const { computedUtm, computedPesos } = useMemo(() => {
        if (formTipoMulta === 'Tipo 1') {
            // Tipo 1: base 200 UTM. Si aprobado por institución -> 50% = 100 UTM
            const utm = formAprobadoInstitucion ? 100 : 200
            const pesos = Math.round(utm * calcValorUtm)
            return { computedUtm: utm, computedPesos: pesos }
        } else if (formTipoMulta === 'Tipo 2') {
            // Tipo 2: base 100 UTM. Si aprobado por institución -> 50% = 50 UTM
            const utm = formAprobadoInstitucion ? 50 : 100
            const pesos = Math.round(utm * calcValorUtm)
            return { computedUtm: utm, computedPesos: pesos }
        } else if (formTipoMulta === 'Tipo 3') {
            // Tipo 3: base 0 UTM
            return { computedUtm: 0, computedPesos: 0 }
        } else if (formTipoMulta === 'ETA') {
            // ETA: si aprobadoInstitucion = true -> 1% del valor anual del contrato. Si false -> 0
            if (formAprobadoInstitucion) {
                const pesos = Math.round(valorContratoAnual * 0.01)
                const utm = calcValorUtm > 0 ? Number((pesos / calcValorUtm).toFixed(2)) : 0
                return { computedUtm: utm, computedPesos: pesos }
            } else {
                return { computedUtm: 0, computedPesos: 0 }
            }
        }
        return { computedUtm: formMultaUtm, computedPesos: Math.round(formMultaUtm * calcValorUtm) }
    }, [formTipoMulta, formAprobadoInstitucion, valorContratoAnual, calcValorUtm, formMultaUtm])

    // Sincronizar computedUtm con formMultaUtm
    useEffect(() => {
        setFormMultaUtm(computedUtm)
    }, [computedUtm])

    // Manejo de cambio en checkbox "Aprobado por Institución"
    const handleToggleAprobadoInstitucion = (checked: boolean) => {
        setFormAprobadoInstitucion(checked)
        if (checked) {
            // Si no tiene fecha, precargar la fecha actual
            if (!formAprobadorFecha) {
                setFormAprobadorFecha(new Date().toISOString().split('T')[0])
            }
            // Abrir popup de aprobación por institución
            setModalAprobacionOpen(true)
        }
    }

    // Subir documento de aprobación
    const handleUploadDocAprobacion = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadingDoc(true)
        setErrorMsg(null)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await subirDocumentoAprobacionC8Action(formData)
            if (res.success && res.url) {
                setFormAprobadorDocUrl(res.url)
                setFormAprobadorDocNombre(res.nombreOriginal || file.name)
                setSuccessMsg('Documento adjuntado correctamente')
                setTimeout(() => setSuccessMsg(null), 3000)
            } else {
                setErrorMsg(res.error || 'Error al subir documento')
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error al subir archivo')
        } finally {
            setUploadingDoc(false)
            if (docInputRef.current) docInputRef.current.value = ''
        }
    }

    // Sucursales filtradas por licitación en filtros
    const sucursalesFiltradas = useMemo(() => {
        if (!filtroLicitacion) return filtrosData.sucursales
        const licIdNum = Number(filtroLicitacion)
        const utsMatching = filtrosData.uts.filter(u => u.licId === licIdNum)
        const sucursalesAllowed = new Set(utsMatching.map(u => u.sucursal))
        return filtrosData.sucursales.filter(s => sucursalesAllowed.has(s))
    }, [filtroLicitacion, filtrosData.sucursales, filtrosData.uts])

    // Colegios filtrados por licitación y sucursal en barra de filtros
    const colegiosFiltrados = useMemo(() => {
        let list = filtrosData.colegios

        if (filtroLicitacion) {
            const licIdNum = Number(filtroLicitacion)
            const utsForLic = new Set(filtrosData.uts.filter(u => u.licId === licIdNum).map(u => u.codUT))
            list = list.filter(c => utsForLic.has(c.ut))
        }

        if (filtroSucursal) {
            list = list.filter(c => c.sucursal.toLowerCase() === filtroSucursal.toLowerCase())
        }

        if (busquedaRbdTexto.trim()) {
            const term = busquedaRbdTexto.toLowerCase().trim()
            list = list.filter(c => 
                String(c.rbd).includes(term) || 
                c.nombre.toLowerCase().includes(term)
            )
        }

        return list
    }, [filtroLicitacion, filtroSucursal, busquedaRbdTexto, filtrosData.colegios, filtrosData.uts])

    // Sucursales disponibles en el formulario según licitación seleccionada
    const formSucursalesDisponibles = useMemo(() => {
        if (!formLicitacion) return filtrosData.sucursales
        const licIdNum = Number(formLicitacion)
        const utsMatching = filtrosData.uts.filter(u => u.licId === licIdNum)
        const sucursalesAllowed = new Set(utsMatching.map(u => u.sucursal))
        return filtrosData.sucursales.filter(s => sucursalesAllowed.has(s))
    }, [formLicitacion, filtrosData.sucursales, filtrosData.uts])

    // Colegios disponibles en el formulario según licitación y sucursal
    const formColegiosDisponibles = useMemo(() => {
        let list = filtrosData.colegios

        if (formLicitacion) {
            const licIdNum = Number(formLicitacion)
            const utsForLic = new Set(filtrosData.uts.filter(u => u.licId === licIdNum).map(u => u.codUT))
            list = list.filter(c => utsForLic.has(c.ut))
        }

        if (formSucursal) {
            list = list.filter(c => c.sucursal.toLowerCase() === formSucursal.toLowerCase())
        }

        if (formRbdSearch.trim()) {
            const term = formRbdSearch.toLowerCase().trim()
            list = list.filter(c => 
                String(c.rbd).includes(term) || 
                c.nombre.toLowerCase().includes(term)
            )
        }

        return list
    }, [formLicitacion, formSucursal, formRbdSearch, filtrosData.colegios, filtrosData.uts])

    // Filtrado de la tabla principal
    const actasFiltradas = useMemo(() => {
        return actas.filter(item => {
            if (filtroLicitacion && item.licitacion !== filtroLicitacion) return false
            if (filtroSucursal && item.sucursal.toLowerCase() !== filtroSucursal.toLowerCase()) return false
            if (filtroRbd !== '' && item.rbd !== Number(filtroRbd)) return false
            if (filtroAnio !== '' && item.anioNotificacion !== Number(filtroAnio)) return false
            if (filtroMes !== '' && item.mesNotificacion !== Number(filtroMes)) return false

            if (filtroTextoGlobal.trim()) {
                const term = filtroTextoGlobal.toLowerCase().trim()
                const matches = (
                    (item.folio || '').toLowerCase().includes(term) ||
                    item.establecimiento.toLowerCase().includes(term) ||
                    item.hallazgo.toLowerCase().includes(term) ||
                    (item.preparacionProducto || '').toLowerCase().includes(term) ||
                    (item.motivoGenericoTexto || '').toLowerCase().includes(term) ||
                    (item.proveedor || '').toLowerCase().includes(term) ||
                    (item.tipoMulta || '').toLowerCase().includes(term) ||
                    String(item.rbd).includes(term)
                )
                if (!matches) return false
            }

            return true
        })
    }, [actas, filtroLicitacion, filtroSucursal, filtroRbd, filtroAnio, filtroMes, filtroTextoGlobal])

    // Ordenamiento por cabeceras
    const actasOrdenadas = useMemo(() => {
        return [...actasFiltradas].sort((a, b) => {
            let valA: any = a[sortKey]
            let valB: any = b[sortKey]

            if (valA === null || valA === undefined) valA = ''
            if (valB === null || valB === undefined) valB = ''

            if (typeof valA === 'string') {
                return sortDirection === 'asc' 
                    ? valA.localeCompare(valB) 
                    : valB.localeCompare(valA)
            } else {
                return sortDirection === 'asc' ? valA - valB : valB - valA
            }
        })
    }, [actasFiltradas, sortKey, sortDirection])

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortKey(key)
            setSortDirection('asc')
        }
    }

    const handleOpenCreate = () => {
        setEditingItem(null)
        setFormFolio('')
        setFormLicitacion(filtrosData.licitaciones[0]?.id || '')
        const hoy = new Date().toISOString().split('T')[0]
        setFormFechaNotif(hoy)
        setFormHoraNotif('10:00')
        setFormFechaHallazgo(hoy)
        setFormSucursal(filtrosData.sucursales[0] || '')
        setFormRbd('')
        setFormEstablecimiento('')
        setFormRbdSearch('')
        setFormPrepProducto('')
        setFormHallazgo('')
        setFormMotivoGenericoId(filtrosData.motivosC8[0]?.id || '')
        setFormMotivoGenericoTexto(filtrosData.motivosC8[0]?.nombre || '')
        setFormProveedor('')
        setFormInstitucion('JUNAEB')
        setFormFechaTrazabilidad('')
        setFormHoraTrazabilidad('')
        setFormFechaRespuestaCausa('')
        setFormHoraRespuestaCausa('')
        setFormEnviaReclamo(false)

        setFormTipoMulta('Tipo 1')
        setFormMultaUtm(200)
        setFormAprobadoInstitucion(false)
        setFormAprobadorCorreo('')
        setFormAprobadorNombre('')
        setFormAprobadorFecha('')
        setFormAprobadorDocUrl('')
        setFormAprobadorDocNombre('')

        setFormRespaldo1('')
        setFormRespaldo2('')
        setFormRespaldo3('')
        setFormRespaldo4('')
        setFormObservacion('')
        setFormAplicaC8(true)
        setFormCalidadOInocuidad('Calidad')
        setFormEficacia('')
        setFormRespuestaInstitucion('')
        setErrorMsg(null)
        setModalFormOpen(true)
    }

    const handleOpenEdit = (item: ActaC8Item) => {
        setEditingItem(item)
        setFormFolio(item.folio || '')
        setFormLicitacion(item.licitacion)
        setFormFechaNotif(item.fechaNotificacion ? item.fechaNotificacion.split('T')[0] : '')
        setFormHoraNotif(item.horaNotificacion || '')
        setFormFechaHallazgo(item.fechaHallazgo ? item.fechaHallazgo.split('T')[0] : '')
        setFormSucursal(item.sucursal)
        setFormRbd(item.rbd)
        setFormEstablecimiento(item.establecimiento)
        setFormRbdSearch(`${item.rbd} - ${item.establecimiento}`)
        setFormPrepProducto(item.preparacionProducto || '')
        setFormHallazgo(item.hallazgo)
        setFormMotivoGenericoId(item.motivoGenericoId || '')
        setFormMotivoGenericoTexto(item.motivoGenericoTexto || '')
        setFormProveedor(item.proveedor || '')
        setFormInstitucion(item.institucion)
        setFormFechaTrazabilidad(item.fechaTrazabilidad ? item.fechaTrazabilidad.split('T')[0] : '')
        setFormHoraTrazabilidad(item.horaTrazabilidad || '')
        setFormFechaRespuestaCausa(item.fechaRespuestaCausa ? item.fechaRespuestaCausa.split('T')[0] : '')
        setFormHoraRespuestaCausa(item.horaRespuestaCausa || '')
        setFormEnviaReclamo(item.enviaReclamoProveedor)

        const tipoValido = (item.tipoMulta === 'Tipo 2' || item.tipoMulta === 'Tipo 3' || item.tipoMulta === 'ETA') 
            ? item.tipoMulta 
            : 'Tipo 1'
        setFormTipoMulta(tipoValido)
        setFormMultaUtm(item.multaEstimadaUtm)
        setFormAprobadoInstitucion(item.aprobadoInstitucion)
        setFormAprobadorCorreo(item.aprobadorCorreo || '')
        setFormAprobadorNombre(item.aprobadorNombre || '')
        setFormAprobadorFecha(item.aprobadorFecha ? item.aprobadorFecha.split('T')[0] : '')
        setFormAprobadorDocUrl(item.aprobadorDocUrl || '')
        setFormAprobadorDocNombre(item.aprobadorDocNombre || '')

        setFormRespaldo1(item.respaldoAccion1 || '')
        setFormRespaldo2(item.respaldoAccion2 || '')
        setFormRespaldo3(item.respaldoAccion3 || '')
        setFormRespaldo4(item.respaldoAccion4 || '')
        setFormObservacion(item.observacion || '')
        setFormAplicaC8(item.aplicaC8)
        setFormCalidadOInocuidad(item.calidadOInocuidad)
        setFormEficacia(item.eficacia || '')
        setFormRespuestaInstitucion(item.respuestaInstitucion || '')
        setErrorMsg(null)
        setModalFormOpen(true)
    }

    const handleSelectColegioForm = (col: { rbd: number; nombre: string; sucursal: string; institucion: string }) => {
        setFormRbd(col.rbd)
        setFormEstablecimiento(col.nombre)
        setFormRbdSearch(`${col.rbd} - ${col.nombre}`)
        if (col.sucursal) setFormSucursal(col.sucursal)
        if (col.institucion) setFormInstitucion(col.institucion)
        setFormRbdDropdownOpen(false)
    }

    const handleSaveForm = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formRbd || !formEstablecimiento) {
            setErrorMsg('Debe seleccionar un Establecimiento / RBD válido')
            return
        }
        if (!formFechaNotif) {
            setErrorMsg('La Fecha de Notificación es obligatoria')
            return
        }
        if (!formHallazgo.trim()) {
            setErrorMsg('El Hallazgo es obligatorio')
            return
        }

        setSaving(true)
        setErrorMsg(null)
        try {
            const motivoObj = filtrosData.motivosC8.find(m => m.id === formMotivoGenericoId)
            const motivoTextoFinal = motivoObj?.nombre || formMotivoGenericoTexto || null

            const res = await guardarActaC8Action({
                id: editingItem?.id,
                folio: formFolio,
                licitacion: formLicitacion,
                fechaNotificacion: formFechaNotif,
                horaNotificacion: formHoraNotif,
                fechaHallazgo: formFechaHallazgo || formFechaNotif,
                sucursal: formSucursal,
                rbd: Number(formRbd),
                establecimiento: formEstablecimiento,
                preparacionProducto: formPrepProducto,
                hallazgo: formHallazgo,
                motivoGenericoId: formMotivoGenericoId || undefined,
                motivoGenericoTexto: motivoTextoFinal || undefined,
                proveedor: formProveedor,
                institucion: formInstitucion,
                fechaTrazabilidad: formFechaTrazabilidad || undefined,
                horaTrazabilidad: formHoraTrazabilidad || undefined,
                fechaRespuestaCausa: formFechaRespuestaCausa || undefined,
                horaRespuestaCausa: formHoraRespuestaCausa || undefined,
                enviaReclamoProveedor: formEnviaReclamo,
                tipoMulta: formTipoMulta,
                multaEstimadaUtm: computedUtm,
                aprobadoInstitucion: formAprobadoInstitucion,
                aprobadorCorreo: formAprobadorCorreo,
                aprobadorNombre: formAprobadorNombre,
                aprobadorFecha: formAprobadorFecha || undefined,
                aprobadorDocUrl: formAprobadorDocUrl,
                aprobadorDocNombre: formAprobadorDocNombre,
                valorAnualContrato: valorContratoAnual,
                calculoPesosUtm: computedPesos,
                respaldoAccion1: formRespaldo1,
                respaldoAccion2: formRespaldo2,
                respaldoAccion3: formRespaldo3,
                respaldoAccion4: formRespaldo4,
                observacion: formObservacion,
                aplicaC8: formAplicaC8,
                calidadOInocuidad: formCalidadOInocuidad,
                eficacia: formEficacia,
                respuestaInstitucion: formRespuestaInstitucion
            })

            if (res.success) {
                setSuccessMsg(editingItem ? 'Acta C8 actualizada con éxito' : 'Acta C8 registrada exitosamente')
                setTimeout(() => setSuccessMsg(null), 3500)
                setModalFormOpen(false)

                const d = new Date(formFechaNotif)
                const mes = d.getUTCMonth() + 1
                const anio = d.getUTCFullYear()
                const valorUtm = calcValorUtm

                if (editingItem) {
                    setActas(prev => prev.map(a => a.id === editingItem.id ? {
                        ...a,
                        folio: formFolio || null,
                        licitacion: formLicitacion,
                        fechaNotificacion: formFechaNotif,
                        horaNotificacion: formHoraNotif || null,
                        fechaHallazgo: formFechaHallazgo || formFechaNotif,
                        sucursal: formSucursal,
                        rbd: Number(formRbd),
                        establecimiento: formEstablecimiento,
                        preparacionProducto: formPrepProducto || null,
                        hallazgo: formHallazgo,
                        motivoGenericoId: formMotivoGenericoId || null,
                        motivoGenericoTexto: motivoTextoFinal,
                        proveedor: formProveedor || null,
                        institucion: formInstitucion,
                        fechaTrazabilidad: formFechaTrazabilidad || null,
                        horaTrazabilidad: formHoraTrazabilidad || null,
                        fechaRespuestaCausa: formFechaRespuestaCausa || null,
                        horaRespuestaCausa: formHoraRespuestaCausa || null,
                        enviaReclamoProveedor: formEnviaReclamo,
                        tipoMulta: formTipoMulta,
                        multaEstimadaUtm: computedUtm,
                        aprobadoInstitucion: formAprobadoInstitucion,
                        aprobadorCorreo: formAprobadorCorreo || null,
                        aprobadorNombre: formAprobadorNombre || null,
                        aprobadorFecha: formAprobadorFecha || null,
                        aprobadorDocUrl: formAprobadorDocUrl || null,
                        aprobadorDocNombre: formAprobadorDocNombre || null,
                        valorAnualContrato: valorContratoAnual,
                        respaldoAccion1: formRespaldo1 || null,
                        respaldoAccion2: formRespaldo2 || null,
                        respaldoAccion3: formRespaldo3 || null,
                        respaldoAccion4: formRespaldo4 || null,
                        observacion: formObservacion || null,
                        mesNotificacion: mes,
                        anioNotificacion: anio,
                        montoUtmPesos: valorUtm,
                        calculoPesosUtm: computedPesos,
                        aplicaC8: formAplicaC8,
                        calidadOInocuidad: formCalidadOInocuidad,
                        eficacia: formEficacia || null,
                        respuestaInstitucion: formRespuestaInstitucion || null,
                        updatedAt: new Date().toISOString()
                    } : a))
                } else if (res.id) {
                    const newItem: ActaC8Item = {
                        id: res.id,
                        folio: formFolio || null,
                        licitacion: formLicitacion,
                        fechaNotificacion: formFechaNotif,
                        horaNotificacion: formHoraNotif || null,
                        fechaHallazgo: formFechaHallazgo || formFechaNotif,
                        sucursal: formSucursal,
                        rbd: Number(formRbd),
                        establecimiento: formEstablecimiento,
                        preparacionProducto: formPrepProducto || null,
                        hallazgo: formHallazgo,
                        motivoGenericoId: formMotivoGenericoId || null,
                        motivoGenericoTexto: motivoTextoFinal,
                        proveedor: formProveedor || null,
                        institucion: formInstitucion,
                        fechaTrazabilidad: formFechaTrazabilidad || null,
                        horaTrazabilidad: formHoraTrazabilidad || null,
                        fechaRespuestaCausa: formFechaRespuestaCausa || null,
                        horaRespuestaCausa: formHoraRespuestaCausa || null,
                        enviaReclamoProveedor: formEnviaReclamo,
                        tipoMulta: formTipoMulta,
                        multaEstimadaUtm: computedUtm,
                        aprobadoInstitucion: formAprobadoInstitucion,
                        aprobadorCorreo: formAprobadorCorreo || null,
                        aprobadorNombre: formAprobadorNombre || null,
                        aprobadorFecha: formAprobadorFecha || null,
                        aprobadorDocUrl: formAprobadorDocUrl || null,
                        aprobadorDocNombre: formAprobadorDocNombre || null,
                        valorAnualContrato: valorContratoAnual,
                        respaldoAccion1: formRespaldo1 || null,
                        respaldoAccion2: formRespaldo2 || null,
                        respaldoAccion3: formRespaldo3 || null,
                        respaldoAccion4: formRespaldo4 || null,
                        observacion: formObservacion || null,
                        mesNotificacion: mes,
                        anioNotificacion: anio,
                        montoUtmPesos: valorUtm,
                        calculoPesosUtm: computedPesos,
                        aplicaC8: formAplicaC8,
                        calidadOInocuidad: formCalidadOInocuidad,
                        eficacia: formEficacia || null,
                        respuestaInstitucion: formRespuestaInstitucion || null,
                        creadoPor: userName,
                        actualizadoPor: null,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                    setActas(prev => [newItem, ...prev])
                }
            } else {
                setErrorMsg(res.error || 'Error al guardar Acta C8')
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error inesperado al guardar')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (item: ActaC8Item) => {
        if (!confirm(`¿Está seguro de eliminar el Acta C8 ${item.folio ? `(Folio ${item.folio})` : ''} de RBD ${item.rbd} (${item.establecimiento})?`)) return

        try {
            setLoading(true)
            const res = await eliminarActaC8Action(item.id)
            if (res.success) {
                setActas(prev => prev.filter(a => a.id !== item.id))
                setSuccessMsg('Acta C8 eliminada correctamente')
                setTimeout(() => setSuccessMsg(null), 3000)
            } else {
                setErrorMsg(res.error || 'Error al eliminar')
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error al eliminar')
        } finally {
            setLoading(false)
        }
    }

    // Descarga de Plantilla Oficial Excel
    const handleDownloadTemplate = () => {
        const headers = [
            'Folio', 'Licitacion', 'Fecha Notificacion', 'Hora Notificacion', 'Fecha Hallazgo',
            'Sucursal', 'RBD', 'Establecimiento', 'Preparacion Producto', 'Hallazgo',
            'Motivo Generico', 'Proveedor', 'Institucion', 'Fecha Trazabilidad',
            'Hora Trazabilidad', 'Fecha Respuesta Causa', 'Hora Respuesta Causa',
            'Se envia reclamo a proveedor', 'Tipo Multa', 'Multa Estimada UTM', 'Aprobado Institucion',
            'Respaldo Accion 1', 'Respaldo Accion 2', 'Respaldo Accion 3', 'Respaldo Accion 4',
            'Observacion', 'Aplica C8', 'Calidad o Inocuidad', 'Eficacia', 'Respuesta Institucion'
        ]

        const exampleRow = [
            'LEV-2026-001', '1012', '2026-05-15', '14:30', '2026-05-14',
            'METRO', 1012, 'ESCUELA BASICA ESPAÑA', 'Almuerzo / Guiso de Lentejas', 'Presencia de cuerpo extraño en ración',
            'Presencia de Cuerpo Extraño', 'DISTRIBUIDORA ALIMENTOS SA', 'JUNAEB', '2026-05-16',
            '09:00', '2026-05-17', '11:00',
            'SI', 'Tipo 1', 200, 'NO',
            'Informe de laboratorio lote 2026-05',
            'Capacitación manipulación higiénica', 'Cambio de malla tamizadora', 'Auditoría en bodega', 'Hallazgo subsanado',
            'SI', 'Calidad', 'Eficaz en 48 hrs', 'Respuesta remitida a JUNAEB vía oficio'
        ]

        const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Plantilla_Actas_C8')
        XLSX.writeFile(wb, 'Plantilla_Oficial_Actas_C8.xlsx')
    }

    // Exportar la vista actual a Excel
    const handleExportCurrentView = () => {
        if (actasOrdenadas.length === 0) {
            alert('No hay registros para exportar.')
            return
        }

        const dataToExport = actasOrdenadas.map(a => ({
            'ID': a.id,
            'Folio': a.folio || '',
            'Licitación': a.licitacion,
            'Fecha Notificación': a.fechaNotificacion ? a.fechaNotificacion.split('T')[0] : '',
            'Hora Notificación': a.horaNotificacion || '',
            'Fecha Hallazgo': a.fechaHallazgo ? a.fechaHallazgo.split('T')[0] : '',
            'Sucursal': a.sucursal,
            'RBD': a.rbd,
            'Establecimiento': a.establecimiento,
            'Preparación / Producto': a.preparacionProducto || '',
            'Hallazgo': a.hallazgo,
            'Motivo Genérico': a.motivoGenericoTexto || '',
            'Proveedor': a.proveedor || '',
            'Institución': a.institucion,
            'Tipo Multa': a.tipoMulta || 'Tipo 1',
            'Aprobado Institución': a.aprobadoInstitucion ? 'SI' : 'NO',
            'Aprobador Nombre': a.aprobadorNombre || '',
            'Aprobador Correo': a.aprobadorCorreo || '',
            'Aprobador Fecha': a.aprobadorFecha ? a.aprobadorFecha.split('T')[0] : '',
            'Reclamo Proveedor': a.enviaReclamoProveedor ? 'SI' : 'NO',
            'Multa Estimada UTM': a.multaEstimadaUtm,
            'Monto UTM ($)': a.montoUtmPesos,
            'Cálculo Total ($)': a.calculoPesosUtm,
            'Mes': a.mesNotificacion,
            'Año': a.anioNotificacion,
            'Aplica C8': a.aplicaC8 ? 'SI' : 'NO',
            'Calidad o Inocuidad': a.calidadOInocuidad,
            'Eficacia': a.eficacia || '',
            'Respuesta Institución': a.respuestaInstitucion || '',
            'Observación': a.observacion || '',
            'Registrado Por': a.creadoPor
        }))

        const ws = XLSX.utils.json_to_sheet(dataToExport)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Actas_C8')
        XLSX.writeFile(wb, `Actas_C8_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    // Procesar archivo Excel en Carga Masiva
    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setImporting(true)
        setImportErrors([])
        setImportSuccessCount(null)

        try {
            const data = await file.arrayBuffer()
            const workbook = XLSX.read(data, { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const rows: any[] = XLSX.utils.sheet_to_json(worksheet)

            if (!rows || rows.length === 0) {
                setImportErrors(['El archivo no contiene filas con datos válidos'])
                setImporting(false)
                return
            }

            const res = await importarActasC8MasivoAction(rows)
            if (res.success) {
                setImportSuccessCount(res.insertados || 0)
                if (res.errores && res.errores.length > 0) {
                    setImportErrors(res.errores)
                }
                setSuccessMsg(`Se importaron ${res.insertados} actas C8 exitosamente`)
                setTimeout(() => setSuccessMsg(null), 4000)

                window.location.reload()
            } else {
                setImportErrors([res.error || 'Error al procesar la carga masiva'])
            }
        } catch (err: any) {
            setImportErrors([err.message || 'Error al leer el archivo Excel'])
        } finally {
            setImporting(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    return (
        <div className="space-y-6">
            {/* Header Corporativo Hendaya */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-cyan-700 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-cyan-600" />
                            Áreas · Calidad
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                        Actas C8
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Control, trazabilidad y cuantificación de multas e infracciones de calidad e inocuidad.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Botón solo visible para Administradores: Carga Masiva */}
                    {isAdmin && (
                        <button
                            onClick={() => {
                                setImportErrors([])
                                setImportSuccessCount(null)
                                setModalImportOpen(true)
                            }}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-all shadow-sm"
                        >
                            <Upload className="w-4 h-4 text-cyan-700" />
                            Carga Masiva Excel
                        </button>
                    )}

                    <button
                        onClick={handleDownloadTemplate}
                        title="Descargar plantilla oficial Excel"
                        className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-all shadow-sm"
                    >
                        <Download className="w-4 h-4 text-slate-500" />
                        Plantilla
                    </button>

                    <button
                        onClick={handleExportCurrentView}
                        title="Exportar vista actual filtrada a Excel"
                        className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition-all shadow-sm"
                    >
                        <Download className="w-4 h-4 text-emerald-600" />
                        Exportar
                    </button>

                    {canManage && (
                        <button
                            onClick={handleOpenCreate}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-cyan-700/20"
                        >
                            <Plus className="w-4 h-4" />
                            Nueva Acta C8
                        </button>
                    )}
                </div>
            </div>

            {/* Mensajes de Alerta */}
            {errorMsg && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                    <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">✕</button>
                </div>
            )}

            {successMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{successMsg}</span>
                    </div>
                    <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 text-xs font-bold">✕</button>
                </div>
            )}

            {/* Selector de Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('c8')}
                    className={`flex items-center gap-2 px-6 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 rounded-t-xl ${
                        activeTab === 'c8'
                            ? 'border-cyan-600 text-cyan-700 bg-cyan-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                    <Layers className="w-4 h-4" />
                    C8
                    <span className="ml-1.5 px-2 py-0.5 text-xs bg-cyan-100 text-cyan-800 rounded-full font-bold">
                        {actasOrdenadas.length}
                    </span>
                </button>
            </div>

            {/* Barra de Filtros */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                        <Filter className="w-4 h-4 text-cyan-600" />
                        Filtros de Búsqueda
                    </div>
                    {(filtroLicitacion || filtroSucursal || filtroRbd !== '' || filtroAnio !== '' || filtroMes !== '' || filtroTextoGlobal || busquedaRbdTexto) && (
                        <button
                            onClick={() => {
                                setFiltroLicitacion('')
                                setFiltroSucursal('')
                                setFiltroRbd('')
                                setBusquedaRbdTexto('')
                                setFiltroAnio('')
                                setFiltroMes('')
                                setFiltroTextoGlobal('')
                            }}
                            className="text-xs text-cyan-700 hover:text-cyan-900 font-bold hover:underline"
                        >
                            Limpiar Filtros
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
                    {/* Filtro Licitación */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                            Licitación
                        </label>
                        <select
                            value={filtroLicitacion}
                            onChange={e => {
                                setFiltroLicitacion(e.target.value)
                                setFiltroSucursal('')
                                setFiltroRbd('')
                                setBusquedaRbdTexto('')
                            }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
                        >
                            <option value="">Todas las Licitaciones</option>
                            {filtrosData.licitaciones.map(l => (
                                <option key={l.id} value={l.id}>{l.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Sucursal */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                            Sucursal
                        </label>
                        <select
                            value={filtroSucursal}
                            onChange={e => {
                                setFiltroSucursal(e.target.value)
                                setFiltroRbd('')
                                setBusquedaRbdTexto('')
                            }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
                        >
                            <option value="">Todas las Sucursales</option>
                            {sucursalesFiltradas.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* Buscador inteligente de RBD / Establecimiento */}
                    <div className="relative lg:col-span-2" ref={rbdDropdownRef}>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                            Establecimiento / RBD
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Escribe RBD o nombre de colegio..."
                                value={busquedaRbdTexto}
                                onFocus={() => setRbdDropdownOpen(true)}
                                onChange={e => {
                                    setBusquedaRbdTexto(e.target.value)
                                    setRbdDropdownOpen(true)
                                    if (!e.target.value) setFiltroRbd('')
                                }}
                                className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white font-medium"
                            />
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            {busquedaRbdTexto && (
                                <button
                                    onClick={() => {
                                        setBusquedaRbdTexto('')
                                        setFiltroRbd('')
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {rbdDropdownOpen && colegiosFiltrados.length > 0 && (
                            <div className="absolute z-40 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
                                {colegiosFiltrados.slice(0, 50).map(col => (
                                    <button
                                        key={col.rbd}
                                        type="button"
                                        onClick={() => {
                                            setFiltroRbd(col.rbd)
                                            setBusquedaRbdTexto(`${col.rbd} - ${col.nombre}`)
                                            setRbdDropdownOpen(false)
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors flex items-center justify-between"
                                    >
                                        <div className="truncate">
                                            <span className="font-mono font-bold text-cyan-700 mr-2">{col.rbd}</span>
                                            <span className="text-slate-800 font-medium">{col.nombre}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 ml-2 shrink-0">{col.sucursal}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Filtro Año Notificación */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                            Año Notif.
                        </label>
                        <select
                            value={filtroAnio}
                            onChange={e => setFiltroAnio(e.target.value ? Number(e.target.value) : '')}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
                        >
                            <option value="">Todos</option>
                            {filtrosData.aniosDisponibles.map(a => (
                                <option key={a} value={a}>{a}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Mes Notificación */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                            Mes Notif.
                        </label>
                        <select
                            value={filtroMes}
                            onChange={e => setFiltroMes(e.target.value ? Number(e.target.value) : '')}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
                        >
                            <option value="">Todos los meses</option>
                            {MESES_NOMBRES.map(m => (
                                <option key={m.num} value={m.num}>{m.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Búsqueda rápida por texto libre (incluye Folio) */}
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:w-96">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por folio, establecimiento, hallazgo, motivo..."
                            value={filtroTextoGlobal}
                            onChange={e => setFiltroTextoGlobal(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white font-medium"
                        />
                    </div>
                    <div className="text-xs text-slate-500">
                        Resultados: <span className="font-bold text-slate-800">{actasOrdenadas.length}</span> actas
                    </div>
                </div>
            </div>

            {/* Tabla de Actas C8 con Columna Folio */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-700 border-b border-slate-200 font-bold select-none">
                            <tr>
                                <th 
                                    onClick={() => handleSort('folio')}
                                    className="py-3.5 px-3 cursor-pointer hover:text-cyan-700 transition-colors whitespace-nowrap"
                                >
                                    <div className="flex items-center gap-1.5">
                                        Folio
                                        {sortKey === 'folio' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />
                                        ) : <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('fechaNotificacion')}
                                    className="py-3.5 px-4 cursor-pointer hover:text-cyan-700 transition-colors whitespace-nowrap"
                                >
                                    <div className="flex items-center gap-1.5">
                                        Fecha Notif.
                                        {sortKey === 'fechaNotificacion' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />
                                        ) : <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('licitacion')}
                                    className="py-3.5 px-3 cursor-pointer hover:text-cyan-700 transition-colors whitespace-nowrap"
                                >
                                    <div className="flex items-center gap-1.5">
                                        Licitación
                                        {sortKey === 'licitacion' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />
                                        ) : <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('sucursal')}
                                    className="py-3.5 px-3 cursor-pointer hover:text-cyan-700 transition-colors whitespace-nowrap"
                                >
                                    <div className="flex items-center gap-1.5">
                                        Sucursal
                                        {sortKey === 'sucursal' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />
                                        ) : <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('rbd')}
                                    className="py-3.5 px-3 cursor-pointer hover:text-cyan-700 transition-colors whitespace-nowrap"
                                >
                                    <div className="flex items-center gap-1.5">
                                        RBD
                                        {sortKey === 'rbd' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />
                                        ) : <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('establecimiento')}
                                    className="py-3.5 px-4 cursor-pointer hover:text-cyan-700 transition-colors min-w-[170px]"
                                >
                                    <div className="flex items-center gap-1.5">
                                        Establecimiento
                                        {sortKey === 'establecimiento' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />
                                        ) : <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />}
                                    </div>
                                </th>
                                <th className="py-3.5 px-4 min-w-[180px]">Hallazgo / Producto</th>
                                <th className="py-3.5 px-3 whitespace-nowrap">Tipo Multa</th>
                                <th 
                                    onClick={() => handleSort('calidadOInocuidad')}
                                    className="py-3.5 px-3 cursor-pointer hover:text-cyan-700 transition-colors text-center whitespace-nowrap"
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        Tipo
                                        {sortKey === 'calidadOInocuidad' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />
                                        ) : <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('multaEstimadaUtm')}
                                    className="py-3.5 px-3 cursor-pointer hover:text-cyan-700 transition-colors text-right whitespace-nowrap"
                                >
                                    <div className="flex items-center justify-end gap-1.5">
                                        Multa UTM
                                        {sortKey === 'multaEstimadaUtm' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />
                                        ) : <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('calculoPesosUtm')}
                                    className="py-3.5 px-4 cursor-pointer hover:text-cyan-700 transition-colors text-right whitespace-nowrap"
                                >
                                    <div className="flex items-center justify-end gap-1.5">
                                        Total ($)
                                        {sortKey === 'calculoPesosUtm' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />
                                        ) : <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />}
                                    </div>
                                </th>
                                {canManage && <th className="py-3.5 px-4 text-right">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {actasOrdenadas.length === 0 ? (
                                <tr>
                                    <td colSpan={canManage ? 12 : 11} className="py-12 text-center text-slate-400 text-xs">
                                        No se encontraron actas C8 coincidentes con los criterios seleccionados.
                                    </td>
                                </tr>
                            ) : (
                                actasOrdenadas.map(a => (
                                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                            {a.folio ? (
                                                <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                                                    {a.folio}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 italic">S/F</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <div className="font-mono text-slate-900 font-semibold">
                                                {a.fechaNotificacion ? a.fechaNotificacion.split('T')[0] : 'S/F'}
                                            </div>
                                            {a.horaNotificacion && (
                                                <div className="text-[10px] text-slate-400">{a.horaNotificacion}</div>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 font-mono font-bold text-cyan-700 whitespace-nowrap">
                                            {a.licitacion}
                                        </td>
                                        <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                                            {a.sucursal}
                                        </td>
                                        <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                            {a.rbd}
                                        </td>
                                        <td className="py-3 px-4 font-semibold text-slate-900 max-w-[200px] truncate" title={a.establecimiento}>
                                            {a.establecimiento}
                                            <div className="text-[10px] text-slate-400 font-normal">{a.institucion}</div>
                                        </td>
                                        <td className="py-3 px-4 max-w-[220px]">
                                            <div className="text-slate-800 truncate font-medium" title={a.hallazgo}>
                                                {a.hallazgo}
                                            </div>
                                            {a.preparacionProducto && (
                                                <div className="text-[10px] text-slate-500 truncate" title={a.preparacionProducto}>
                                                    Prod: {a.preparacionProducto}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-xs whitespace-nowrap">
                                            <div className="font-bold text-slate-800">
                                                {a.tipoMulta || 'Tipo 1'}
                                            </div>
                                            {a.aprobadoInstitucion && (
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 mt-0.5">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                    <span>Aprobado</span>
                                                    {a.aprobadorDocUrl && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setPreviewDocUrl(a.aprobadorDocUrl)
                                                                setPreviewDocNombre(a.aprobadorDocNombre || 'Respaldo Aprobación')
                                                            }}
                                                            className="text-cyan-700 hover:text-cyan-900 ml-0.5"
                                                            title="Ver documento adjunto"
                                                        >
                                                            <Paperclip className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center whitespace-nowrap">
                                            {a.calidadOInocuidad === 'Inocuidad' ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                    Inocuidad
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                                                    Calidad
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-700 whitespace-nowrap">
                                            {a.multaEstimadaUtm} UTM
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                                            ${a.calculoPesosUtm.toLocaleString('es-CL')}
                                        </td>
                                        {canManage && (
                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenEdit(a)}
                                                        title="Editar Acta C8"
                                                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 transition-colors"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(a)}
                                                        disabled={loading}
                                                        title="Eliminar Acta C8"
                                                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Formulario: Crear / Editar Acta C8 */}
            {modalFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in overflow-y-auto">
                    <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl my-auto">
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                    <ShieldAlert className="w-5 h-5 text-cyan-600" />
                                    {editingItem ? 'Editar Acta C8' : 'Nueva Acta C8'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Registro del levantamiento de la institución y cálculo de multa C8.
                                </p>
                            </div>
                            <button
                                onClick={() => setModalFormOpen(false)}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveForm} className="p-6 overflow-y-auto space-y-5">
                            {/* Bloque 1: Folio, Ubicación y Notificación */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                <h4 className="text-xs font-bold text-cyan-700 uppercase tracking-wider">
                                    1. Registro del Levantamiento (Folio), Ubicación y Fechas
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                    {/* Folio */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                            Folio Institución
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ej: FOLIO-2026-01"
                                            value={formFolio}
                                            onChange={e => setFormFolio(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-0.5">Registro levantamiento</p>
                                    </div>

                                    {/* Licitación */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Licitación *
                                        </label>
                                        <select
                                            required
                                            value={formLicitacion}
                                            onChange={e => {
                                                setFormLicitacion(e.target.value)
                                                setFormSucursal('')
                                                setFormRbd('')
                                                setFormEstablecimiento('')
                                                setFormRbdSearch('')
                                            }}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        >
                                            <option value="">Seleccione licitación</option>
                                            {filtrosData.licitaciones.map(l => (
                                                <option key={l.id} value={l.id}>{l.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Sucursal */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Sucursal *
                                        </label>
                                        <select
                                            required
                                            value={formSucursal}
                                            onChange={e => {
                                                setFormSucursal(e.target.value)
                                                setFormRbd('')
                                                setFormEstablecimiento('')
                                                setFormRbdSearch('')
                                            }}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        >
                                            <option value="">Seleccione sucursal</option>
                                            {formSucursalesDisponibles.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Fecha Notificación */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Fecha Notificación *
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={formFechaNotif}
                                            onChange={e => setFormFechaNotif(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>

                                    {/* Hora Notificación */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Hora Notificación
                                        </label>
                                        <input
                                            type="time"
                                            value={formHoraNotif}
                                            onChange={e => setFormHoraNotif(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {/* Fecha Hallazgo */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Fecha Hallazgo *
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={formFechaHallazgo}
                                            onChange={e => setFormFechaHallazgo(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>

                                    {/* Buscador inteligente de Colegio / RBD */}
                                    <div className="relative sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Establecimiento / RBD (Filtrado por perfil) *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Busca por RBD o Nombre de Establecimiento..."
                                            value={formRbdSearch}
                                            onFocus={() => setFormRbdDropdownOpen(true)}
                                            onChange={e => {
                                                setFormRbdSearch(e.target.value)
                                                setFormRbdDropdownOpen(true)
                                                if (!e.target.value) {
                                                    setFormRbd('')
                                                    setFormEstablecimiento('')
                                                }
                                            }}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                        {formRbdDropdownOpen && formColegiosDisponibles.length > 0 && (
                                            <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
                                                {formColegiosDisponibles.slice(0, 40).map(col => (
                                                    <button
                                                        key={col.rbd}
                                                        type="button"
                                                        onClick={() => handleSelectColegioForm(col)}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors flex items-center justify-between"
                                                    >
                                                        <div className="truncate">
                                                            <span className="font-mono font-bold text-cyan-700 mr-2">{col.rbd}</span>
                                                            <span className="text-slate-800 font-medium">{col.nombre}</span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 ml-2 shrink-0">{col.sucursal}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Bloque 2: Detalle del Hallazgo y Motivo */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                <h4 className="text-xs font-bold text-cyan-700 uppercase tracking-wider">
                                    2. Detalle del Hallazgo, Preparación y Motivo Genérico
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Preparación / Producto (Glosa larga)
                                        </label>
                                        <textarea
                                            rows={2}
                                            placeholder="Ej: Guiso de vacuno con arroz, postre fruta fresca..."
                                            value={formPrepProducto}
                                            onChange={e => setFormPrepProducto(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none font-medium"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Hallazgo (Glosa larga) *
                                        </label>
                                        <textarea
                                            rows={2}
                                            required
                                            placeholder="Detalle exacto de la no conformidad constatada en el acta..."
                                            value={formHallazgo}
                                            onChange={e => setFormHallazgo(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Motivo Genérico C8 *
                                        </label>
                                        <select
                                            value={formMotivoGenericoId}
                                            onChange={e => {
                                                const id = e.target.value
                                                setFormMotivoGenericoId(id)
                                                const found = filtrosData.motivosC8.find(m => m.id === id)
                                                if (found) setFormMotivoGenericoTexto(found.nombre)
                                            }}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        >
                                            <option value="">Seleccione motivo C8</option>
                                            {filtrosData.motivosC8.map(m => (
                                                <option key={m.id} value={m.id}>{m.codigo} - {m.nombre}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Proveedor (Glosa)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Nombre proveedor / distribuidor..."
                                            value={formProveedor}
                                            onChange={e => setFormProveedor(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Institución *
                                        </label>
                                        <select
                                            value={formInstitucion}
                                            onChange={e => setFormInstitucion(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        >
                                            {filtrosData.instituciones.map(inst => (
                                                <option key={inst} value={inst}>{inst}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Bloque 3: Trazabilidad, Mitigación y Reclamo */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                <h4 className="text-xs font-bold text-cyan-700 uppercase tracking-wider">
                                    3. Trazabilidad y Análisis de Causa
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Fecha Trazabilidad
                                        </label>
                                        <input
                                            type="date"
                                            value={formFechaTrazabilidad}
                                            onChange={e => setFormFechaTrazabilidad(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Hora Trazabilidad
                                        </label>
                                        <input
                                            type="time"
                                            value={formHoraTrazabilidad}
                                            onChange={e => setFormHoraTrazabilidad(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Fecha Resp. Causa
                                        </label>
                                        <input
                                            type="date"
                                            value={formFechaRespuestaCausa}
                                            onChange={e => setFormFechaRespuestaCausa(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Hora Resp. Causa
                                        </label>
                                        <input
                                            type="time"
                                            value={formHoraRespuestaCausa}
                                            onChange={e => setFormHoraRespuestaCausa(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 pt-1">
                                    <span className="text-xs font-bold text-slate-700">
                                        ¿Se envía reclamo a proveedor?
                                    </span>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                                            <input
                                                type="radio"
                                                name="reclamoProveedor"
                                                checked={formEnviaReclamo === true}
                                                onChange={() => setFormEnviaReclamo(true)}
                                                className="text-cyan-600 focus:ring-cyan-500"
                                            />
                                            Sí
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                                            <input
                                                type="radio"
                                                name="reclamoProveedor"
                                                checked={formEnviaReclamo === false}
                                                onChange={() => setFormEnviaReclamo(false)}
                                                className="text-cyan-600 focus:ring-cyan-500"
                                            />
                                            No
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Bloque 4: Multa Estimada, Tipos y Aprobación Institución */}
                            <div className="bg-cyan-50/50 p-4 rounded-xl border border-cyan-200 space-y-4">
                                <h4 className="text-xs font-bold text-cyan-800 uppercase tracking-wider flex items-center justify-between">
                                    <span>4. Multa Estimada y Cálculo Automático de UTM</span>
                                    <span className="text-xs font-semibold text-slate-500">
                                        Mes: {calcMes || '-'} · Año: {calcAnio || '-'}
                                    </span>
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Selector de Tipo de Multa */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                            Tipo de Multa *
                                        </label>
                                        <select
                                            value={formTipoMulta}
                                            onChange={e => setFormTipoMulta(e.target.value as any)}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        >
                                            <option value="Tipo 1">Tipo 1 (200 UTM)</option>
                                            <option value="Tipo 2">Tipo 2 (100 UTM)</option>
                                            <option value="Tipo 3">Tipo 3 (0 UTM)</option>
                                            <option value="ETA">ETA (1% Valor Contrato)</option>
                                        </select>
                                    </div>

                                    {/* Multa Estimada UTM */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                            Multa Estimada UTM *
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            required
                                            value={formMultaUtm}
                                            onChange={e => setFormMultaUtm(Number(e.target.value))}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                        {/* Botones de montos rápidos actualizados: 200, 100, 50, 0 UTM */}
                                        <div className="flex items-center gap-1.5 mt-2">
                                            <span className="text-[10px] text-slate-500 font-semibold">Rápido:</span>
                                            {[200, 100, 50, 0].map(val => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormMultaUtm(val)
                                                        if (val === 200) setFormTipoMulta('Tipo 1')
                                                        else if (val === 100) setFormTipoMulta('Tipo 2')
                                                        else if (val === 0) setFormTipoMulta('Tipo 3')
                                                    }}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                                                        formMultaUtm === val 
                                                            ? 'bg-cyan-700 text-white' 
                                                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {val} UTM
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Monto $ UTM Histórico */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                            Valor UTM Mes/Año ($)
                                        </label>
                                        <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-cyan-800 font-mono font-bold">
                                            ${calcValorUtm.toLocaleString('es-CL')}
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1">Obtenido de la tabla UTM oficial.</p>
                                    </div>

                                    {/* Cálculo peso * UTM */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                            Cálculo Total Pesos ($)
                                        </label>
                                        <div className="px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs text-emerald-700 font-mono font-bold">
                                            ${computedPesos.toLocaleString('es-CL')}
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            {formTipoMulta === 'ETA' 
                                                ? (formAprobadoInstitucion ? '1% del valor anual del contrato' : '0 (sin aprobación institución)') 
                                                : `${formMultaUtm} UTM × $${calcValorUtm.toLocaleString('es-CL')}`}
                                        </p>
                                    </div>
                                </div>

                                {/* Checkbox Aprobado por Institución */}
                                <div className="p-3 bg-white rounded-xl border border-cyan-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formAprobadoInstitucion}
                                                onChange={e => handleToggleAprobadoInstitucion(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                        </label>
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                Aprobado por Institución
                                                {formAprobadoInstitucion && (
                                                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                        Rebaja 50% aplicada
                                                    </span>
                                                )}
                                            </span>
                                            <p className="text-[11px] text-slate-500">
                                                Rebaja al 50% el valor del tipo (o calcula el 1% del contrato anual si es ETA).
                                            </p>
                                        </div>
                                    </div>

                                    {formAprobadoInstitucion && (
                                        <div className="flex items-center gap-2">
                                            {formAprobadorDocUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPreviewDocUrl(formAprobadorDocUrl)
                                                        setPreviewDocNombre(formAprobadorDocNombre || 'Respaldo Aprobación')
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-50 text-cyan-800 text-xs font-bold hover:bg-cyan-100 border border-cyan-200"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    Ver Adjunto
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setModalAprobacionOpen(true)}
                                                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 border border-slate-300"
                                            >
                                                Ver / Editar Datos Aprobación
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-cyan-100">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                                            ¿Aplica C8?
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                                                <input
                                                    type="radio"
                                                    name="aplicaC8"
                                                    checked={formAplicaC8 === true}
                                                    onChange={() => setFormAplicaC8(true)}
                                                    className="text-cyan-600"
                                                />
                                                Sí
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                                                <input
                                                    type="radio"
                                                    name="aplicaC8"
                                                    checked={formAplicaC8 === false}
                                                    onChange={() => setFormAplicaC8(false)}
                                                    className="text-cyan-600"
                                                />
                                                No
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                            Calidad o Inocuidad
                                        </label>
                                        <select
                                            value={formCalidadOInocuidad}
                                            onChange={e => setFormCalidadOInocuidad(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        >
                                            <option value="Calidad">Calidad</option>
                                            <option value="Inocuidad">Inocuidad</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                            Eficacia (Glosa corta)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Eficaz, En proceso, No eficaz..."
                                            value={formEficacia}
                                            onChange={e => setFormEficacia(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        Respuesta Institución (Glosa larga)
                                    </label>
                                    <textarea
                                        rows={2}
                                        placeholder="Comentarios u oficio de resolución emitido por la institución..."
                                        value={formRespuestaInstitucion}
                                        onChange={e => setFormRespuestaInstitucion(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none font-medium"
                                    />
                                </div>
                            </div>

                            {/* Bloque 5: Respaldos de Acciones Correctivas y Observaciones */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                <h4 className="text-xs font-bold text-cyan-700 uppercase tracking-wider">
                                    5. Respaldos Acciones Correctivas (Glosas largas)
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Respaldo Acción Correctiva 1
                                        </label>
                                        <textarea
                                            rows={2}
                                            placeholder="Detalle o referencia del respaldo 1..."
                                            value={formRespaldo1}
                                            onChange={e => setFormRespaldo1(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none font-medium"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Respaldo Acción Correctiva 2
                                        </label>
                                        <textarea
                                            rows={2}
                                            placeholder="Detalle o referencia del respaldo 2..."
                                            value={formRespaldo2}
                                            onChange={e => setFormRespaldo2(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none font-medium"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Respaldo Acción Correctiva 3
                                        </label>
                                        <textarea
                                            rows={2}
                                            placeholder="Detalle o referencia del respaldo 3..."
                                            value={formRespaldo3}
                                            onChange={e => setFormRespaldo3(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none font-medium"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                            Respaldo Acción Correctiva 4
                                        </label>
                                        <textarea
                                            rows={2}
                                            placeholder="Detalle o referencia del respaldo 4..."
                                            value={formRespaldo4}
                                            onChange={e => setFormRespaldo4(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none font-medium"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                        Observación General (Glosa larga)
                                    </label>
                                    <textarea
                                        rows={2}
                                        placeholder="Observaciones adicionales, estado del descargo o consideraciones especiales..."
                                        value={formObservacion}
                                        onChange={e => setFormObservacion(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none font-medium"
                                    />
                                </div>
                            </div>

                            {/* Acciones del formulario */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setModalFormOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-cyan-700/20 disabled:opacity-50"
                                >
                                    {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    {editingItem ? 'Guardar Cambios' : 'Registrar Acta C8'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Popup Aprobación por Institución (se abre al marcar el check) */}
            {modalAprobacionOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                    Aprobación por Institución
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Ingresa los datos de la persona de la institución que aprobó la rebaja.
                                </p>
                            </div>
                            <button
                                onClick={() => setModalAprobacionOpen(false)}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Correo de quien Aprobó *
                                </label>
                                <input
                                    type="email"
                                    required
                                    placeholder="ejemplo@junaeb.cl"
                                    value={formAprobadorCorreo}
                                    onChange={e => setFormAprobadorCorreo(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Nombre de quien Aprobó *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Nombre y apellido del funcionario..."
                                    value={formAprobadorNombre}
                                    onChange={e => setFormAprobadorNombre(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Fecha de Aprobación *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formAprobadorFecha}
                                    onChange={e => setFormAprobadorFecha(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Adjuntar Documento de Respaldo
                                </label>
                                <input
                                    ref={docInputRef}
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                    onChange={handleUploadDocAprobacion}
                                    className="hidden"
                                    id="aprobadorFileInput"
                                />
                                <div className="flex items-center gap-3">
                                    <label
                                        htmlFor="aprobadorFileInput"
                                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
                                    >
                                        {uploadingDoc ? <RefreshCw className="w-4 h-4 animate-spin text-cyan-600" /> : <Paperclip className="w-4 h-4 text-cyan-600" />}
                                        {uploadingDoc ? 'Subiendo...' : 'Seleccionar Archivo'}
                                    </label>
                                    {formAprobadorDocUrl ? (
                                        <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold truncate max-w-[220px]">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            <span className="truncate">{formAprobadorDocNombre || 'Archivo adjunto'}</span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-400">Sin archivo adjunto</span>
                                    )}
                                </div>
                            </div>

                            {formAprobadorDocUrl && (
                                <div className="p-3 bg-cyan-50/60 border border-cyan-200 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-800 truncate">
                                        <Paperclip className="w-4 h-4 text-cyan-600 shrink-0" />
                                        <span className="truncate">{formAprobadorDocNombre || 'Documento adjunto'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPreviewDocUrl(formAprobadorDocUrl)
                                                setPreviewDocNombre(formAprobadorDocNombre || 'Respaldo Aprobación')
                                            }}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-cyan-300 hover:bg-cyan-50 text-cyan-800 text-xs font-bold rounded-lg shadow-sm"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            Ver
                                        </button>
                                        <a
                                            href={formAprobadorDocUrl}
                                            download={formAprobadorDocNombre || 'aprobacion_institucion'}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg shadow-sm"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            Descargar
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => setModalAprobacionOpen(false)}
                                className="px-5 py-2 bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-xl shadow-md shadow-cyan-700/20"
                            >
                                Confirmar y Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Vista Previa de Documento Adjunto */}
            {previewDocUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                            <div className="flex items-center gap-2 truncate">
                                <Paperclip className="w-4 h-4 text-cyan-600" />
                                <h3 className="text-sm font-bold text-slate-800 truncate">
                                    {previewDocNombre || 'Documento de Aprobación'}
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={previewDocUrl}
                                    download={previewDocNombre || 'documento'}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 shadow-sm"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Descargar
                                </a>
                                <button
                                    onClick={() => setPreviewDocUrl(null)}
                                    className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 bg-slate-100 p-2 overflow-auto flex items-center justify-center">
                            {previewDocUrl.toLowerCase().endsWith('.pdf') ? (
                                <iframe
                                    src={previewDocUrl}
                                    className="w-full h-full rounded-xl border border-slate-200 bg-white"
                                    title="Vista Previa PDF"
                                />
                            ) : (
                                <img
                                    src={previewDocUrl}
                                    alt="Vista Previa"
                                    className="max-w-full max-h-full object-contain rounded-xl shadow-md"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Carga Masiva Excel */}
            {modalImportOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                    <Upload className="w-5 h-5 text-cyan-600" />
                                    Carga Masiva de Actas C8 (Excel)
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Módulo exclusivo para Administradores.
                                </p>
                            </div>
                            <button
                                onClick={() => setModalImportOpen(false)}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="border-2 border-dashed border-slate-300 hover:border-cyan-600 rounded-2xl p-6 text-center transition-colors bg-slate-50/50">
                                <Upload className="w-10 h-10 text-cyan-600 mx-auto mb-2 opacity-80" />
                                <p className="text-xs font-bold text-slate-800">
                                    Selecciona o arrastra el archivo Excel (.xlsx)
                                </p>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Asegúrate de respetar los encabezados de la plantilla oficial.
                                </p>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={handleFileImport}
                                    disabled={importing}
                                    className="hidden"
                                    id="excelUploadInput"
                                />

                                <div className="mt-4 flex items-center justify-center gap-3">
                                    <label
                                        htmlFor="excelUploadInput"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-md shadow-cyan-700/20"
                                    >
                                        {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                        {importing ? 'Procesando...' : 'Examinar Archivo'}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleDownloadTemplate}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors shadow-sm"
                                    >
                                        <Download className="w-3.5 h-3.5 text-slate-500" />
                                        Bajar Plantilla
                                    </button>
                                </div>
                            </div>

                            {importSuccessCount !== null && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>Se procesaron e insertaron <strong>{importSuccessCount}</strong> registros exitosamente.</span>
                                </div>
                            )}

                            {importErrors.length > 0 && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5 max-h-40 overflow-y-auto">
                                    <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                        <span>Errores detectados ({importErrors.length}):</span>
                                    </div>
                                    <ul className="list-disc list-inside text-[11px] text-rose-700 space-y-1 font-medium">
                                        {importErrors.map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end p-4 border-t border-slate-100 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => setModalImportOpen(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
