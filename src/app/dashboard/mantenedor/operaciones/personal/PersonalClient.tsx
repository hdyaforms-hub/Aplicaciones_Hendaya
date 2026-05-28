'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import {
    createJefeZonal, updateJefeZonal, deleteJefeZonal,
    createJefeOperacion, updateJefeOperacion, deleteJefeOperacion,
    createSupervisor, updateSupervisor, deleteSupervisor
} from './actions'
import {
    calculateSingleDistance,
    calculatePendingDistances,
    resetConsumoMensual,
    getDistanciasCache,
    getConsumoActual
} from './googleMapsAction'

interface PersonalClientProps {
    initialZonales: any[]
    initialJefesOperacion: any[]
    initialSupervisores: any[]
    licitaciones: any[]
    sucursales: any[]
    vehiculos: any[]
    colegios: any[]
    userPermissions: string[]
    initialDistanciasCache: any[]
    initialConsumoActual: { cantidad: number; tope: number; mes: number; anio: number }
}

export default function PersonalClient({
    initialZonales,
    initialJefesOperacion,
    initialSupervisores,
    licitaciones,
    sucursales,
    vehiculos,
    colegios,
    userPermissions,
    initialDistanciasCache,
    initialConsumoActual
}: PersonalClientProps) {
    const searchParams = useSearchParams()
    const router = useRouter()

    // Determine initial active tab based on query param
    const defaultTab = searchParams.get('tab') || 'zonales'
    const [activeTab, setActiveTab] = useState(defaultTab)

    // Sync state with URL parameter changes
    useEffect(() => {
        const tab = searchParams.get('tab')
        if (tab && (tab === 'zonales' || tab === 'jefe-operacion' || tab === 'supervisor' || tab === 'distancias')) {
            setActiveTab(tab)
        }
    }, [searchParams])

    const handleTabChange = (tabName: string) => {
        setActiveTab(tabName)
        router.push(`/dashboard/mantenedor/operaciones/personal?tab=${tabName}`)
    }

    // Main States
    // Main States
    const [distanciasCache, setDistanciasCache] = useState(initialDistanciasCache)
    const [consumoActual, setConsumoActual] = useState(initialConsumoActual)
    const [isCalculating, setIsCalculating] = useState(false)
    const [calcResult, setCalcResult] = useState<{ processed?: number; errors?: number; message?: string; limitHit?: boolean } | null>(null)

    const [isAdding, setIsAdding] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    
    // Search queries
    const [searchZonal, setSearchZonal] = useState('')
    const [searchOp, setSearchOp] = useState('')
    const [searchSuper, setSearchSuper] = useState('')
    const [showDownloadDropdown, setShowDownloadDropdown] = useState(false)
    const [selectedSupervisorForDetails, setSelectedSupervisorForDetails] = useState<any | null>(null)
    const [modalPage, setModalPage] = useState(1)

    // Sort states: { col: string, dir: 'asc' | 'desc' }
    const [sortZonal, setSortZonal] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'nombre', dir: 'asc' })
    const [sortOp, setSortOp] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'nombre', dir: 'asc' })
    const [sortSuper, setSortSuper] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'nombre', dir: 'asc' })

    // Pagination states
    const [pageZonal, setPageZonal] = useState(1)
    const [pageOp, setPageOp] = useState(1)
    const [pageSuper, setPageSuper] = useState(1)
    const itemsPerPage = 10

    // Reset pagination on search or sort changes
    useEffect(() => {
        setPageZonal(1)
    }, [searchZonal, sortZonal])

    useEffect(() => {
        setPageOp(1)
    }, [searchOp, sortOp])

    useEffect(() => {
        setPageSuper(1)
    }, [searchSuper, sortSuper])

    // Many-to-many checklists filters
    const [licFilter, setLicFilter] = useState('')
    const [sucFilter, setSucFilter] = useState('')
    const [camionetaFilter, setCamionetaFilter] = useState('')
    const [rbdFilter, setRbdFilter] = useState('')
    const [zonalVehFilter, setZonalVehFilter] = useState('')
    const [opVehFilter, setOpVehFilter] = useState('')

    // Form States
    // Zonal Form
    const [zonalForm, setZonalForm] = useState({
        nombre: '',
        apellido: '',
        correo: '',
        licitaciones: [] as number[],
        sucursales: [] as string[],
        vehiculoIds: [] as string[],
        vigente: true
    })

    // Jefe de Operacion Form
    const [opForm, setOpForm] = useState({
        nombre: '',
        apellido: '',
        correo: '',
        jefeZonalId: '',
        vehiculoIds: [] as string[],
        vigente: true
    })

    // Supervisor Form
    const [superForm, setSuperForm] = useState({
        nombre: '',
        apellido: '',
        correo: '',
        dependsDirectlyOnZonal: false,
        jefeOperacionId: '',
        jefeZonalId: '',
        camionetaIds: [] as string[],
        rbdIds: [] as number[],
        vigente: true
    })

    // Reset Forms
    const resetForms = () => {
        setIsAdding(false)
        setEditingId(null)
        setFeedback(null)
        
        setZonalForm({
            nombre: '',
            apellido: '',
            correo: '',
            licitaciones: [],
            sucursales: [],
            vehiculoIds: [],
            vigente: true
        })

        setOpForm({
            nombre: '',
            apellido: '',
            correo: '',
            jefeZonalId: '',
            vehiculoIds: [],
            vigente: true
        })

        setSuperForm({
            nombre: '',
            apellido: '',
            correo: '',
            dependsDirectlyOnZonal: false,
            jefeOperacionId: '',
            jefeZonalId: '',
            camionetaIds: [],
            rbdIds: [],
            vigente: true
        })

        setLicFilter('')
        setSucFilter('')
        setCamionetaFilter('')
        setRbdFilter('')
        setZonalVehFilter('')
        setOpVehFilter('')
    }

    // Auto-timeout feedbacks
    const triggerFeedback = (type: 'success' | 'error', message: string) => {
        setFeedback({ type, message })
        if (type === 'success') {
            resetForms()
            router.refresh()
            setTimeout(() => {
                setFeedback(null)
                window.location.reload()
            }, 1500)
        }
    }

    // Edit actions mapping
    const handleEditZonal = (z: any) => {
        setZonalForm({
            nombre: z.nombre,
            apellido: z.apellido,
            correo: z.correo,
            licitaciones: z.licitaciones.map((l: any) => l.licitacionId),
            sucursales: z.sucursales.map((s: any) => s.sucursalId),
            vehiculoIds: (z.vehiculos || []).map((v: any) => v.vehiculoId),
            vigente: z.vigente
        })
        setEditingId(z.id)
        setIsAdding(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleEditOp = (o: any) => {
        setOpForm({
            nombre: o.nombre,
            apellido: o.apellido,
            correo: o.correo,
            jefeZonalId: o.jefeZonalId,
            vehiculoIds: (o.vehiculos || []).map((v: any) => v.vehiculoId),
            vigente: o.vigente
        })
        setEditingId(o.id)
        setIsAdding(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleEditSuper = (s: any) => {
        const isDirect = !s.jefeOperacionId && !!s.jefeZonalId
        setSuperForm({
            nombre: s.nombre,
            apellido: s.apellido,
            correo: s.correo,
            dependsDirectlyOnZonal: isDirect,
            jefeOperacionId: s.jefeOperacionId || '',
            jefeZonalId: s.jefeZonalId || '',
            camionetaIds: s.camionetas.map((c: any) => c.vehiculoId),
            rbdIds: s.rbdsAuditar.map((r: any) => r.rbd),
            vigente: s.vigente
        })
        setEditingId(s.id)
        setIsAdding(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    // Submit handlers
    const handleSubmitZonal = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        if (zonalForm.licitaciones.length === 0 || zonalForm.sucursales.length === 0) {
            triggerFeedback('error', 'Debes seleccionar al menos una Licitación y una Sucursal.')
            setLoading(false)
            return
        }

        try {
            let res
            if (editingId) {
                res = await updateJefeZonal(editingId, { ...zonalForm })
            } else {
                res = await createJefeZonal({ ...zonalForm })
            }

            if (res.success) {
                triggerFeedback('success', editingId ? 'Jefe Zonal actualizado.' : 'Jefe Zonal registrado.')
            } else {
                triggerFeedback('error', res.error || 'Ocurrió un error.')
            }
        } catch (err) {
            triggerFeedback('error', 'Error al procesar la solicitud.')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmitOp = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        if (!opForm.jefeZonalId) {
            triggerFeedback('error', 'El Jefe Zonal es requerido.')
            setLoading(false)
            return
        }

        try {
            let res
            if (editingId) {
                res = await updateJefeOperacion(editingId, { ...opForm })
            } else {
                res = await createJefeOperacion({ ...opForm })
            }

            if (res.success) {
                triggerFeedback('success', editingId ? 'Jefe de Operación actualizado.' : 'Jefe de Operación registrado.')
            } else {
                triggerFeedback('error', res.error || 'Ocurrió un error.')
            }
        } catch (err) {
            triggerFeedback('error', 'Error al procesar la solicitud.')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmitSuper = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        
        const hasDep = superForm.dependsDirectlyOnZonal ? !!superForm.jefeZonalId : !!superForm.jefeOperacionId
        if (!hasDep) {
            triggerFeedback('error', 'Debes asociar al supervisor con un Jefe de Operación o un Jefe Zonal.')
            setLoading(false)
            return
        }

        try {
            const dataToSave = {
                nombre: superForm.nombre,
                apellido: superForm.apellido,
                correo: superForm.correo,
                jefeOperacionId: superForm.dependsDirectlyOnZonal ? null : superForm.jefeOperacionId,
                jefeZonalId: superForm.dependsDirectlyOnZonal ? superForm.jefeZonalId : null,
                camionetaIds: superForm.camionetaIds,
                rbdIds: superForm.rbdIds,
                vigente: superForm.vigente
            }

            let res
            if (editingId) {
                res = await updateSupervisor(editingId, dataToSave)
            } else {
                res = await createSupervisor(dataToSave)
            }

            if (res.success) {
                triggerFeedback('success', editingId ? 'Supervisor actualizado.' : 'Supervisor registrado.')
            } else {
                triggerFeedback('error', res.error || 'Ocurrió un error.')
            }
        } catch (err) {
            triggerFeedback('error', 'Error al procesar la solicitud.')
        } finally {
            setLoading(false)
        }
    }

    // Delete actions
    const handleDeleteZonal = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este Jefe Zonal?')) return
        setLoading(true)
        try {
            const res = await deleteJefeZonal(id)
            if (res.success) triggerFeedback('success', 'Jefe Zonal eliminado.')
            else triggerFeedback('error', res.error || 'Error al eliminar.')
        } catch (err) {
            triggerFeedback('error', 'Error de red.')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteOp = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este Jefe de Operación?')) return
        setLoading(true)
        try {
            const res = await deleteJefeOperacion(id)
            if (res.success) triggerFeedback('success', 'Jefe de Operación eliminado.')
            else triggerFeedback('error', res.error || 'Error al eliminar.')
        } catch (err) {
            triggerFeedback('error', 'Error de red.')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteSuper = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este Supervisor?')) return
        setLoading(true)
        try {
            const res = await deleteSupervisor(id)
            if (res.success) triggerFeedback('success', 'Supervisor eliminado.')
            else triggerFeedback('error', res.error || 'Error al eliminar.')
        } catch (err) {
            triggerFeedback('error', 'Error de red.')
        } finally {
            setLoading(false)
        }
    }

    // CASCADING UT CALCULATION FOR ZONAL SCREEN
    // Given the selected sucursales, fetch their UT names
    const getUTsForSelectedSucursales = (selectedSucIds: string[], selectedLicIds?: number[]) => {
        if (selectedSucIds.length === 0) return []
        const matchingUts: number[] = []
        sucursales
            .filter(s => selectedSucIds.includes(s.id))
            .forEach(s => {
                if (s.uts) {
                    s.uts.forEach((ut: any) => {
                        if (!selectedLicIds || selectedLicIds.length === 0 || selectedLicIds.includes(ut.licId)) {
                            matchingUts.push(ut.codUT)
                        }
                    })
                }
            })
        return [...new Set(matchingUts)].sort((a, b) => a - b)
    }

    // CASCADING SUCURSAL/RBD FILTER FOR SUPERVISOR FORM
    // Find the sucursal of the selected chief
    const getAllowedSucursalesForSupervisor = () => {
        let selectedZonal: any = null

        if (superForm.dependsDirectlyOnZonal) {
            // Depende directo del Zonal
            selectedZonal = initialZonales.find(z => z.id === superForm.jefeZonalId)
        } else {
            // Depende del Jefe de Operación
            const selectedOp = initialJefesOperacion.find(o => o.id === superForm.jefeOperacionId)
            if (selectedOp) {
                selectedZonal = initialZonales.find(z => z.id === selectedOp.jefeZonalId)
            }
        }

        if (!selectedZonal) return []
        // Return names of sucursales associated with this Zonal
        return selectedZonal.sucursales.map((s: any) => s.sucursal.nombre.toLowerCase())
    }

    const allowedSucursales = getAllowedSucursalesForSupervisor()

    // Find the sucursal IDs of the selected chief
    const getAllowedSucursalIdsForSupervisor = () => {
        let selectedZonal: any = null

        if (superForm.dependsDirectlyOnZonal) {
            // Depende directo del Zonal
            selectedZonal = initialZonales.find(z => z.id === superForm.jefeZonalId)
        } else {
            // Depende del Jefe de Operación
            const selectedOp = initialJefesOperacion.find(o => o.id === superForm.jefeOperacionId)
            if (selectedOp) {
                selectedZonal = initialZonales.find(z => z.id === selectedOp.jefeZonalId)
            }
        }

        if (!selectedZonal) return []
        // Return IDs of sucursales associated with this Zonal
        return selectedZonal.sucursales.map((s: any) => s.sucursalId)
    }

    const allowedSucursalIds = getAllowedSucursalIdsForSupervisor()

    // Filter RBD list by allowed sucursal names
    const filteredColegiosForSupervisor = colegios.filter(col => {
        if (allowedSucursales.length === 0) return false // No chief chosen yet
        return col.sucursal && allowedSucursales.includes(col.sucursal.toLowerCase())
    })

    // Filter vehicles list by allowed sucursal IDs
    const filteredVehiculosForSupervisor = vehiculos.filter(v => {
        if (allowedSucursalIds.length === 0) return false // No chief chosen yet
        return allowedSucursalIds.includes(v.sucursalId)
    })

    // ---- Sort helpers ----
    const toggleSort = (
        current: { col: string; dir: 'asc' | 'desc' },
        col: string,
        setter: (v: { col: string; dir: 'asc' | 'desc' }) => void
    ) => {
        setter(current.col === col ? { col, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
    }

    const sortIcon = (current: { col: string; dir: 'asc' | 'desc' }, col: string) => {
        if (current.col !== col) return <span className="ml-1 opacity-25 text-xs">⇅</span>
        return current.dir === 'asc'
            ? <span className="ml-1 text-cyan-500 text-xs">↑</span>
            : <span className="ml-1 text-cyan-500 text-xs">↓</span>
    }

    const sortedZonales = [...initialZonales]
        .filter(z => {
            const q = searchZonal.toLowerCase().trim()
            return z.nombre.toLowerCase().includes(q) || z.apellido.toLowerCase().includes(q) || z.correo.toLowerCase().includes(q) || z.sucursales.some((s: any) => s.sucursal.nombre.toLowerCase().includes(q))
        })
        .sort((a, b) => {
            const dir = sortZonal.dir === 'asc' ? 1 : -1
            switch (sortZonal.col) {
                case 'nombre':    return dir * (`${a.nombre} ${a.apellido}`).localeCompare(`${b.nombre} ${b.apellido}`)
                case 'correo':    return dir * a.correo.localeCompare(b.correo)
                case 'sucursal':  return dir * (a.sucursales.map((s: any) => s.sucursal.nombre).join(',').localeCompare(b.sucursales.map((s: any) => s.sucursal.nombre).join(',')))
                case 'licitacion':return dir * (a.licitaciones.length - b.licitaciones.length)
                case 'uts':       return dir * (getUTsForSelectedSucursales(a.sucursales.map((s: any) => s.sucursalId), a.licitaciones.map((l: any) => l.licitacionId)).length - getUTsForSelectedSucursales(b.sucursales.map((s: any) => s.sucursalId), b.licitaciones.map((l: any) => l.licitacionId)).length)
                case 'patentes':  return dir * ((a.vehiculos || []).length - (b.vehiculos || []).length)
                case 'estado':    return dir * (Number(b.vigente) - Number(a.vigente))
                default:          return 0
            }
        })

    const sortedJefesOp = [...initialJefesOperacion]
        .filter(o => {
            const q = searchOp.toLowerCase().trim()
            return o.nombre.toLowerCase().includes(q) || o.apellido.toLowerCase().includes(q) || o.correo.toLowerCase().includes(q) || o.jefeZonal.nombre.toLowerCase().includes(q)
        })
        .sort((a, b) => {
            const dir = sortOp.dir === 'asc' ? 1 : -1
            switch (sortOp.col) {
                case 'nombre':    return dir * (`${a.nombre} ${a.apellido}`).localeCompare(`${b.nombre} ${b.apellido}`)
                case 'correo':    return dir * a.correo.localeCompare(b.correo)
                case 'zonal':     return dir * (`${a.jefeZonal.nombre} ${a.jefeZonal.apellido}`).localeCompare(`${b.jefeZonal.nombre} ${b.jefeZonal.apellido}`)
                case 'sucursal':  return dir * (a.jefeZonal.sucursales.map((s: any) => s.sucursal.nombre).join(',').localeCompare(b.jefeZonal.sucursales.map((s: any) => s.sucursal.nombre).join(',')))
                case 'patentes':  return dir * ((a.vehiculos || []).length - (b.vehiculos || []).length)
                case 'estado':    return dir * (Number(b.vigente) - Number(a.vigente))
                default:          return 0
            }
        })

    const sortedSupervisores = [...initialSupervisores]
        .filter(s => {
            const q = searchSuper.toLowerCase().trim()
            const zonal = s.jefeOperacion?.jefeZonal || s.jefeZonal
            const hasSuc = zonal?.sucursales.some((su: any) => su.sucursal.nombre.toLowerCase().includes(q))
            return s.nombre.toLowerCase().includes(q) || s.apellido.toLowerCase().includes(q) || s.correo.toLowerCase().includes(q) || hasSuc
        })
        .sort((a, b) => {
            const dir = sortSuper.dir === 'asc' ? 1 : -1
            const zonalA = a.jefeOperacion?.jefeZonal || a.jefeZonal
            const zonalB = b.jefeOperacion?.jefeZonal || b.jefeZonal
            switch (sortSuper.col) {
                case 'nombre':    return dir * (`${a.nombre} ${a.apellido}`).localeCompare(`${b.nombre} ${b.apellido}`)
                case 'correo':    return dir * a.correo.localeCompare(b.correo)
                case 'dep':       return dir * (a.jefeOperacion ? `op:${a.jefeOperacion.nombre}` : `zonal:${a.jefeZonal?.nombre}`).localeCompare(b.jefeOperacion ? `op:${b.jefeOperacion.nombre}` : `zonal:${b.jefeZonal?.nombre}`)
                case 'sucursal':  return dir * ((zonalA?.sucursales.map((s: any) => s.sucursal.nombre).join(',') || '').localeCompare(zonalB?.sucursales.map((s: any) => s.sucursal.nombre).join(',') || ''))
                case 'camionetas':return dir * (a.camionetas.length - b.camionetas.length)
                case 'rbds':      return dir * (a.rbdsAuditar.length - b.rbdsAuditar.length)
                case 'estado':    return dir * (Number(b.vigente) - Number(a.vigente))
                default:          return 0
            }
        })

    const totalZonalPages = Math.ceil(sortedZonales.length / itemsPerPage) || 1
    const pagedZonales = sortedZonales.slice((pageZonal - 1) * itemsPerPage, pageZonal * itemsPerPage)

    const totalOpPages = Math.ceil(sortedJefesOp.length / itemsPerPage) || 1
    const pagedJefesOp = sortedJefesOp.slice((pageOp - 1) * itemsPerPage, pageOp * itemsPerPage)

    const totalSuperPages = Math.ceil(sortedSupervisores.length / itemsPerPage) || 1
    const pagedSupervisores = sortedSupervisores.slice((pageSuper - 1) * itemsPerPage, pageSuper * itemsPerPage)

    const downloadExcel = () => {
        const headers = [
            'Licitación',
            'Sucursal',
            'Jefe Zonal Nombre',
            'Jefe Zonal Correo',
            'Jefe Zonal Patentes',
            'Jefe de Operación Nombre',
            'Jefe de Operación Correo',
            'Jefe de Operación Patentes',
            'Supervisor Nombre',
            'Supervisor Correo',
            'Supervisor Patentes',
            'UT',
            'RBD',
            'Nombre del Establecimiento',
            'Dirección del Establecimiento',
            'Comuna',
            'Institución'
        ]

        const data: any[] = []

        sortedSupervisores.forEach((s) => {
            const zonalId = s.jefeZonalId || s.jefeOperacion?.jefeZonalId
            const fullZonal = zonalId ? initialZonales.find(z => z.id === zonalId) : null
            const zonalNombre = fullZonal ? `${fullZonal.nombre} ${fullZonal.apellido}` : ''
            const zonalCorreo = fullZonal ? fullZonal.correo : ''
            const zonalPatentes = fullZonal ? (fullZonal.vehiculos || []).map((v: any) => v.vehiculo.patente).join(', ') : ''

            const fullOp = s.jefeOperacionId ? initialJefesOperacion.find(o => o.id === s.jefeOperacionId) : null
            const opNombre = fullOp ? `${fullOp.nombre} ${fullOp.apellido}` : ''
            const opCorreo = fullOp ? fullOp.correo : ''
            const opPatentes = fullOp ? (fullOp.vehiculos || []).map((v: any) => v.vehiculo.patente).join(', ') : ''

            const supNombre = `${s.nombre} ${s.apellido}`
            const supCorreo = s.correo
            const supPatentes = s.camionetas.map((c: any) => c.vehiculo.patente).join(', ')

            const zonalObj = s.jefeOperacion?.jefeZonal || s.jefeZonal
            const supervisorSucursalesNames = (zonalObj?.sucursales || []).map((su: any) => su.sucursal.nombre).join(', ')

            if (s.rbdsAuditar && s.rbdsAuditar.length > 0) {
                s.rbdsAuditar.forEach((r: any) => {
                    const school = colegios.find(col => col.colRBD === r.rbd)
                    const rbdVal = r.rbd
                    const schoolNombre = school ? school.nombreEstablecimiento : ''
                    const schoolDireccion = school ? school.direccionEstablecimiento || '' : ''
                    const schoolComuna = school ? school.comuna || '' : ''
                    const schoolInstitucion = school ? school.institucion || '' : ''
                    const schoolSucursal = school ? school.sucursal : supervisorSucursalesNames

                    let licIdVal = ''
                    if (school && school.colut) {
                        let foundLicId: number | null = null
                        for (const suc of sucursales) {
                            if (suc.uts) {
                                const foundUt = suc.uts.find((ut: any) => ut.codUT === school.colut)
                                if (foundUt) {
                                    foundLicId = foundUt.licId
                                    break
                                }
                            }
                        }
                        if (foundLicId !== null) {
                            licIdVal = `Lic. ${foundLicId}`
                        } else if (fullZonal && fullZonal.licitaciones && fullZonal.licitaciones.length > 0) {
                            licIdVal = fullZonal.licitaciones.map((l: any) => `Lic. ${l.licitacionId}`).join(', ')
                        }
                    } else if (fullZonal && fullZonal.licitaciones && fullZonal.licitaciones.length > 0) {
                        licIdVal = fullZonal.licitaciones.map((l: any) => `Lic. ${l.licitacionId}`).join(', ')
                    }

                    data.push([
                        licIdVal,
                        schoolSucursal,
                        zonalNombre,
                        zonalCorreo,
                        zonalPatentes,
                        opNombre,
                        opCorreo,
                        opPatentes,
                        supNombre,
                        supCorreo,
                        supPatentes,
                        school ? school.colut : '',
                        rbdVal,
                        schoolNombre,
                        schoolDireccion,
                        schoolComuna,
                        schoolInstitucion
                    ])
                })
            } else {
                let licIdVal = ''
                if (fullZonal && fullZonal.licitaciones && fullZonal.licitaciones.length > 0) {
                    licIdVal = fullZonal.licitaciones.map((l: any) => `Lic. ${l.licitacionId}`).join(', ')
                }

                data.push([
                    licIdVal,
                    supervisorSucursalesNames,
                    zonalNombre,
                    zonalCorreo,
                    zonalPatentes,
                    opNombre,
                    opCorreo,
                    opPatentes,
                    supNombre,
                    supCorreo,
                    supPatentes,
                    '',
                    '',
                    '',
                    '',
                    '',
                    ''
                ])
            }
        })

        const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Supervisores")
        XLSX.writeFile(wb, "Reporte_Supervisores.xlsx")
    }

    const downloadPDF = () => {
        const doc = new jsPDF('landscape')
        doc.setFontSize(16)
        doc.text('Reporte Consolidado de Supervisores y Dependencias', 14, 18)
        doc.setFontSize(9)
        doc.setTextColor(100)
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 25)

        const headers = [[
            'Licitación',
            'Sucursal',
            'Jefe Zonal',
            'Jefe de Operación',
            'Supervisor',
            'UT / RBD',
            'Establecimiento (Dirección / Comuna)',
            'Institución'
        ]]

        const data: any[] = []

        sortedSupervisores.forEach((s) => {
            const zonalId = s.jefeZonalId || s.jefeOperacion?.jefeZonalId
            const fullZonal = zonalId ? initialZonales.find(z => z.id === zonalId) : null
            const zonalNombre = fullZonal ? `${fullZonal.nombre} ${fullZonal.apellido}` : ''
            const zonalCorreo = fullZonal ? fullZonal.correo : ''
            const zonalPatentes = fullZonal ? (fullZonal.vehiculos || []).map((v: any) => v.vehiculo.patente).join(', ') : ''

            const fullOp = s.jefeOperacionId ? initialJefesOperacion.find(o => o.id === s.jefeOperacionId) : null
            const opNombre = fullOp ? `${fullOp.nombre} ${fullOp.apellido}` : ''
            const opCorreo = fullOp ? fullOp.correo : ''
            const opPatentes = fullOp ? (fullOp.vehiculos || []).map((v: any) => v.vehiculo.patente).join(', ') : ''

            const supNombre = `${s.nombre} ${s.apellido}`
            const supCorreo = s.correo
            const supPatentes = s.camionetas.map((c: any) => c.vehiculo.patente).join(', ')

            const zonalObj = s.jefeOperacion?.jefeZonal || s.jefeZonal
            const supervisorSucursalesNames = (zonalObj?.sucursales || []).map((su: any) => su.sucursal.nombre).join(', ')

            const zonalCell = zonalNombre 
                ? `${zonalNombre}\n${zonalCorreo}${zonalPatentes ? `\nPat: ${zonalPatentes}` : ''}`
                : 'No Asignado'

            const opCell = opNombre
                ? `${opNombre}\n${opCorreo}${opPatentes ? `\nPat: ${opPatentes}` : ''}`
                : 'No Asignado'

            const supCell = `${supNombre}\n${supCorreo}${supPatentes ? `\nPat: ${supPatentes}` : ''}`

            if (s.rbdsAuditar && s.rbdsAuditar.length > 0) {
                s.rbdsAuditar.forEach((r: any) => {
                    const school = colegios.find(col => col.colRBD === r.rbd)
                    const rbdVal = r.rbd
                    const schoolNombre = school ? school.nombreEstablecimiento : ''
                    const schoolDireccion = school ? school.direccionEstablecimiento || '' : ''
                    const schoolComuna = school ? school.comuna || '' : ''
                    const schoolInstitucion = school ? school.institucion || '' : ''
                    const schoolSucursal = school ? school.sucursal : supervisorSucursalesNames

                    let licIdVal = ''
                    if (school && school.colut) {
                        let foundLicId: number | null = null
                        for (const suc of sucursales) {
                            if (suc.uts) {
                                const foundUt = suc.uts.find((ut: any) => ut.codUT === school.colut)
                                if (foundUt) {
                                    foundLicId = foundUt.licId
                                    break
                                }
                            }
                        }
                        if (foundLicId !== null) {
                            licIdVal = `Lic. ${foundLicId}`
                        } else if (fullZonal && fullZonal.licitaciones && fullZonal.licitaciones.length > 0) {
                            licIdVal = fullZonal.licitaciones.map((l: any) => `Lic. ${l.licitacionId}`).join(', ')
                        }
                    } else if (fullZonal && fullZonal.licitaciones && fullZonal.licitaciones.length > 0) {
                        licIdVal = fullZonal.licitaciones.map((l: any) => `Lic. ${l.licitacionId}`).join(', ')
                    }

                    const schoolCell = `${schoolNombre}${schoolDireccion ? `\nDir: ${schoolDireccion}` : ''}${schoolComuna ? `\nComuna: ${schoolComuna}` : ''}`

                    data.push([
                        licIdVal,
                        schoolSucursal,
                        zonalCell,
                        opCell,
                        supCell,
                        `UT: ${school ? school.colut : ''}\nRBD: ${rbdVal}`,
                        schoolCell,
                        schoolInstitucion
                    ])
                })
            } else {
                let licIdVal = ''
                if (fullZonal && fullZonal.licitaciones && fullZonal.licitaciones.length > 0) {
                    licIdVal = fullZonal.licitaciones.map((l: any) => `Lic. ${l.licitacionId}`).join(', ')
                }

                data.push([
                    licIdVal,
                    supervisorSucursalesNames,
                    zonalCell,
                    opCell,
                    supCell,
                    'Sin RBDs',
                    'Ninguno',
                    'Ninguna'
                ])
            }
        })

        autoTable(doc, {
            startY: 30,
            head: headers,
            body: data,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
            headStyles: { fillColor: [14, 165, 233], textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 20 },
                2: { cellWidth: 38 },
                3: { cellWidth: 38 },
                4: { cellWidth: 38 },
                5: { cellWidth: 20 },
                6: { cellWidth: 70 },
                7: { cellWidth: 25 }
            }
        })

        doc.save("Reporte_Supervisores.pdf")
    }

    const renderPagination = (currentPage: number, totalPages: number, setPage: (p: number) => void, totalItems: number) => {
        if (totalPages <= 1) return null
        const pageNumbers: any[] = []
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            if (totalPages > 7) {
                if (pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - currentPage) > 1) {
                    if (pageNum === 2 && currentPage > 3) {
                        pageNumbers.push('dots-start')
                    } else if (pageNum === totalPages - 1 && currentPage < totalPages - 2) {
                        pageNumbers.push('dots-end')
                    }
                    continue
                }
            }
            pageNumbers.push(pageNum)
        }

        return (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-gray-100 bg-gray-50/10">
                <span className="text-xs text-gray-500 font-medium">
                    Mostrando <span className="font-bold text-gray-700">{Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}</span> a{' '}
                    <span className="font-bold text-gray-700">{Math.min(currentPage * itemsPerPage, totalItems)}</span> de{' '}
                    <span className="font-bold text-gray-700">{totalItems}</span> registros
                </span>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setPage(Math.max(currentPage - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer disabled:cursor-not-allowed"
                    >
                        Anterior
                    </button>
                    
                    {pageNumbers.map((p, idx) => {
                        if (p === 'dots-start' || p === 'dots-end') {
                            return <span key={`${p}-${idx}`} className="text-gray-400 text-xs px-1 select-none">...</span>
                        }
                        const isCurrent = p === currentPage
                        return (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPage(p)}
                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    isCurrent
                                        ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/10'
                                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                {p}
                            </button>
                        )
                    })}

                    <button
                        type="button"
                        onClick={() => setPage(Math.min(currentPage + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer disabled:cursor-not-allowed"
                    >
                        Siguiente
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>👥</span> Personal y Jerarquía de Operaciones
                    </h2>
                    <p className="text-gray-500 mt-1">Configura la jerarquía operativa de Jefes Zonales, Jefes de Operación y Supervisores</p>
                </div>

                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-slate-900/10"
                    >
                        <span>➕</span> Nuevo Registro ({activeTab === 'zonales' ? 'Zonal' : activeTab === 'jefe-operacion' ? 'Jefe de Operación' : 'Supervisor'})
                    </button>
                )}
            </div>

            {/* Tabs Selector */}
            <div className="flex border-b border-gray-200 bg-white px-4 pt-3 rounded-2xl shadow-sm border border-gray-100">
                <button
                    onClick={() => { handleTabChange('zonales'); resetForms(); }}
                    className={`pb-3 px-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'zonales' ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    💼 Jefes Zonales
                </button>
                <button
                    onClick={() => { handleTabChange('jefe-operacion'); resetForms(); }}
                    className={`pb-3 px-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'jefe-operacion' ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    👔 Jefes de Operación
                </button>
                <button
                    onClick={() => { handleTabChange('supervisor'); resetForms(); }}
                    className={`pb-3 px-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'supervisor' ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    🛡️ Supervisores
                </button>
                <button
                    onClick={() => { handleTabChange('distancias'); resetForms(); }}
                    className={`pb-3 px-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'distancias' ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    📍 Tablero de Distancias (Km)
                </button>
            </div>

            {/* Success and Error Feedbacks */}
            {feedback && (
                <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in zoom-in duration-300 ${feedback.type === 'success' ? 'bg-green-50 border border-green-100 text-green-600' : 'bg-red-50 border border-red-100 text-red-600'}`}>
                    <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span> {feedback.message}
                </div>
            )}

            {/* FORM CONTAINER */}
            {isAdding && (
                <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        {editingId ? '📝 Editar Dependencia' : '✨ Registrar Nueva Dependencia'}
                    </h3>

                    {/* JEFES ZONALES FORM */}
                    {activeTab === 'zonales' && (
                        <form onSubmit={handleSubmitZonal} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Nombre</label>
                                    <input
                                        title="Nombre"
                                        type="text" required placeholder="Ej: Roberto"
                                        value={zonalForm.nombre} onChange={(e) => setZonalForm({ ...zonalForm, nombre: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Apellido</label>
                                    <input
                                        title="Apellido"
                                        type="text" required placeholder="Ej: Gómez"
                                        value={zonalForm.apellido} onChange={(e) => setZonalForm({ ...zonalForm, apellido: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Correo Electrónico</label>
                                    <input
                                        title="Correo"
                                        type="email" required placeholder="roberto.gomez@empresa.cl"
                                        value={zonalForm.correo} onChange={(e) => setZonalForm({ ...zonalForm, correo: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none"
                                    />
                                </div>
                            </div>

                            {/* Many-to-many listboxes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Licitaciones selection */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 flex justify-between">
                                        <span>Asociar Licitaciones (Múltiple)</span>
                                        <span className="text-xs text-gray-400 font-medium">{zonalForm.licitaciones.length} seleccionadas</span>
                                    </label>
                                    <input
                                        title="Filtrar Licitación"
                                        type="text" placeholder="Filtrar licitaciones..." value={licFilter} onChange={(e) => setLicFilter(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:ring-1 focus:ring-cyan-500"
                                    />
                                    <div className="border border-gray-200 rounded-xl max-h-40 overflow-y-auto p-3 space-y-2 bg-gray-50/30">
                                        {licitaciones
                                            .filter(l => String(l.licId).includes(licFilter) || (l.licitacionHomologada && l.licitacionHomologada.toLowerCase().includes(licFilter.toLowerCase())))
                                            .map(l => {
                                                const isChecked = zonalForm.licitaciones.includes(l.licId)
                                                return (
                                                    <label key={l.licId} className="flex items-center gap-2 cursor-pointer text-sm">
                                                        <input
                                                            type="checkbox" checked={isChecked}
                                                            onChange={() => {
                                                                setZonalForm(prev => {
                                                                    const exist = prev.licitaciones.includes(l.licId)
                                                                    const updated = exist 
                                                                        ? prev.licitaciones.filter(id => id !== l.licId)
                                                                        : [...prev.licitaciones, l.licId]
                                                                    return { ...prev, licitaciones: updated }
                                                                })
                                                            }}
                                                            className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500"
                                                        />
                                                        <span className="font-semibold text-slate-700">Lic. {l.licId}</span>
                                                        <span className="text-xs text-gray-400">{l.licitacionHomologada || ''}</span>
                                                    </label>
                                                )
                                            })}
                                    </div>
                                </div>

                                {/* Sucursales selection */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 flex justify-between">
                                        <span>Asociar Sucursales (Múltiple)</span>
                                        <span className="text-xs text-gray-400 font-medium">{zonalForm.sucursales.length} seleccionadas</span>
                                    </label>
                                    <input
                                        title="Filtrar Sucursal"
                                        type="text" placeholder="Filtrar sucursales..." value={sucFilter} onChange={(e) => setSucFilter(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:ring-1 focus:ring-cyan-500"
                                    />
                                    <div className="border border-gray-200 rounded-xl max-h-40 overflow-y-auto p-3 space-y-2 bg-gray-50/30">
                                        {sucursales
                                            .filter(s => s.nombre.toLowerCase().includes(sucFilter.toLowerCase()))
                                            .map(s => {
                                                const isChecked = zonalForm.sucursales.includes(s.id)
                                                return (
                                                    <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm">
                                                        <input
                                                            type="checkbox" checked={isChecked}
                                                            onChange={() => {
                                                                setZonalForm(prev => {
                                                                    const exist = prev.sucursales.includes(s.id)
                                                                    const updated = exist 
                                                                        ? prev.sucursales.filter(id => id !== s.id)
                                                                        : [...prev.sucursales, s.id]
                                                                    return { ...prev, sucursales: updated }
                                                                })
                                                            }}
                                                            className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500"
                                                        />
                                                        <span className="font-semibold text-slate-700">{s.nombre}</span>
                                                    </label>
                                                )
                                            })}
                                    </div>
                                </div>
                            </div>

                            {/* CASCADING DYNAMIC UT DISPLAY */}
                            {zonalForm.sucursales.length > 0 && (
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Unidades Territoriales (UT) Cubiertas</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {getUTsForSelectedSucursales(zonalForm.sucursales, zonalForm.licitaciones).map(ut => (
                                            <span key={ut} className="inline-flex items-center px-3 py-1 bg-cyan-100 text-cyan-800 rounded-lg text-xs font-bold border border-cyan-200 shadow-sm">
                                                UT {ut}
                                            </span>
                                        ))}
                                        {getUTsForSelectedSucursales(zonalForm.sucursales, zonalForm.licitaciones).length === 0 && (
                                            <span className="text-xs text-gray-400 italic">Las sucursales seleccionadas no tienen UTs asociadas actualmente.</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Patentes / Vehiculos - filtered by selected sucursales */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                        <span>🚗 Patentes / Vehículos Asociados (Múltiple)</span>
                                        {zonalForm.sucursales.length > 0 && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                                                Filtrado por sucursales seleccionadas
                                            </span>
                                        )}
                                    </label>
                                    <span className="text-xs text-gray-400 font-medium">{zonalForm.vehiculoIds.length} seleccionadas</span>
                                </div>
                                <input
                                    title="Filtrar Vehículo"
                                    type="text" placeholder="Filtrar por patente o tipo..." value={zonalVehFilter} onChange={(e) => setZonalVehFilter(e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:ring-1 focus:ring-cyan-500"
                                />
                                <div className="border border-gray-200 rounded-xl max-h-36 overflow-y-auto p-3 space-y-2 bg-gray-50/30">
                                    {(() => {
                                        const filteredVehs = vehiculos
                                            .filter(v => zonalForm.sucursales.length === 0 || zonalForm.sucursales.includes(v.sucursalId))
                                            .filter(v => v.patente.toLowerCase().includes(zonalVehFilter.toLowerCase()) || v.tipoVehiculo.nombre.toLowerCase().includes(zonalVehFilter.toLowerCase()))
                                        return filteredVehs.length === 0 ? (
                                            <div className="text-xs text-slate-400 italic text-center py-3">
                                                {zonalForm.sucursales.length === 0 ? 'Selecciona sucursal(es) para filtrar vehículos.' : 'No hay vehículos disponibles para las sucursales seleccionadas.'}
                                            </div>
                                        ) : filteredVehs.map(v => {
                                            const isChecked = zonalForm.vehiculoIds.includes(v.id)
                                            return (
                                                <label key={v.id} className="flex items-center gap-2 cursor-pointer text-sm">
                                                    <input
                                                        type="checkbox" checked={isChecked}
                                                        onChange={() => {
                                                            setZonalForm(prev => {
                                                                const exist = prev.vehiculoIds.includes(v.id)
                                                                const updated = exist ? prev.vehiculoIds.filter(id => id !== v.id) : [...prev.vehiculoIds, v.id]
                                                                return { ...prev, vehiculoIds: updated }
                                                            })
                                                        }}
                                                        className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500"
                                                    />
                                                    <span className="font-bold text-slate-700 font-mono tracking-wider">{v.patente}</span>
                                                    <span className="text-xs text-gray-400">({v.tipoVehiculo.nombre})</span>
                                                </label>
                                            )
                                        })
                                    })()}
                                </div>
                            </div>

                            {/* Vigente check */}
                            <div>
                                <label className="flex items-center gap-3 cursor-pointer bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100 w-full md:w-auto">
                                    <input
                                        type="checkbox" checked={zonalForm.vigente}
                                        onChange={(e) => setZonalForm({ ...zonalForm, vigente: e.target.checked })}
                                        className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Zonal Vigente / Activo</span>
                                </label>
                            </div>

                            {/* Buttons */}
                            <div className="flex justify-end gap-3 pt-2 border-t border-gray-50">
                                <button type="button" onClick={resetForms} className="px-6 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 transition-all">Cancelar</button>
                                <button type="submit" disabled={loading} className="bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-cyan-600/20 disabled:opacity-50">{loading ? 'Guardando...' : editingId ? 'Actualizar Zonal' : 'Registrar Zonal'}</button>
                            </div>
                        </form>
                    )}

                    {/* JEFES DE OPERACIÓN FORM */}
                    {activeTab === 'jefe-operacion' && (
                        <form onSubmit={handleSubmitOp} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Nombre</label>
                                    <input
                                        title="Nombre"
                                        type="text" required placeholder="Ej: Carmen"
                                        value={opForm.nombre} onChange={(e) => setOpForm({ ...opForm, nombre: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Apellido</label>
                                    <input
                                        title="Apellido"
                                        type="text" required placeholder="Ej: Castillo"
                                        value={opForm.apellido} onChange={(e) => setOpForm({ ...opForm, apellido: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Correo Electrónico</label>
                                    <input
                                        title="Correo"
                                        type="email" required placeholder="carmen.castillo@empresa.cl"
                                        value={opForm.correo} onChange={(e) => setOpForm({ ...opForm, correo: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Zonal Dropdown */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Jefe Zonal Asociado</label>
                                    <select
                                        title="Jefe Zonal"
                                        required
                                        value={opForm.jefeZonalId}
                                        onChange={(e) => setOpForm({ ...opForm, jefeZonalId: e.target.value, vehiculoIds: [] })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none bg-white"
                                    >
                                        <option value="">Selecciona Jefe Zonal...</option>
                                        {initialZonales.filter(z => z.vigente).map(z => (
                                            <option key={z.id} value={z.id}>
                                                {z.nombre} {z.apellido} ({z.sucursales.map((s: any) => s.sucursal.nombre).join(', ')})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Vigente */}
                                <div className="flex items-end pb-1">
                                    <label className="flex items-center gap-3 cursor-pointer bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100 w-full">
                                        <input
                                            type="checkbox" checked={opForm.vigente}
                                            onChange={(e) => setOpForm({ ...opForm, vigente: e.target.checked })}
                                            className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Jefe de Operación Vigente / Activo</span>
                                    </label>
                                </div>
                            </div>

                            {/* Patentes / Vehiculos del Jefe de Operación - filtered by zonal's sucursales */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                        <span>🚗 Patentes / Vehículos Asociados (Múltiple)</span>
                                        {opForm.jefeZonalId && (() => {
                                            const selectedZonal = initialZonales.find(z => z.id === opForm.jefeZonalId)
                                            const sucNames = selectedZonal?.sucursales.map((s: any) => s.sucursal.nombre).join(', ') || ''
                                            return sucNames ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                                    Filtrado por: {sucNames.toUpperCase()}
                                                </span>
                                            ) : null
                                        })()}
                                    </label>
                                    <span className="text-xs text-gray-400 font-medium">{opForm.vehiculoIds.length} seleccionadas</span>
                                </div>
                                <input
                                    title="Filtrar Vehículo"
                                    type="text" placeholder="Filtrar por patente o tipo..." value={opVehFilter} onChange={(e) => setOpVehFilter(e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:ring-1 focus:ring-cyan-500"
                                />
                                <div className="border border-gray-200 rounded-xl max-h-36 overflow-y-auto p-3 space-y-2 bg-gray-50/30">
                                    {(() => {
                                        const selectedZonal = initialZonales.find(z => z.id === opForm.jefeZonalId)
                                        const zonalSucIds = selectedZonal?.sucursales.map((s: any) => s.sucursalId) || []
                                        const filteredVehs = vehiculos
                                            .filter(v => zonalSucIds.length === 0 || zonalSucIds.includes(v.sucursalId))
                                            .filter(v => v.patente.toLowerCase().includes(opVehFilter.toLowerCase()) || v.tipoVehiculo.nombre.toLowerCase().includes(opVehFilter.toLowerCase()))
                                        return filteredVehs.length === 0 ? (
                                            <div className="text-xs text-slate-400 italic text-center py-3">
                                                {!opForm.jefeZonalId ? 'Selecciona un Jefe Zonal para filtrar vehículos.' : 'No hay vehículos disponibles para las sucursales de este Jefe Zonal.'}
                                            </div>
                                        ) : filteredVehs.map(v => {
                                            const isChecked = opForm.vehiculoIds.includes(v.id)
                                            return (
                                                <label key={v.id} className="flex items-center gap-2 cursor-pointer text-sm">
                                                    <input
                                                        type="checkbox" checked={isChecked}
                                                        onChange={() => {
                                                            setOpForm(prev => {
                                                                const exist = prev.vehiculoIds.includes(v.id)
                                                                const updated = exist ? prev.vehiculoIds.filter(id => id !== v.id) : [...prev.vehiculoIds, v.id]
                                                                return { ...prev, vehiculoIds: updated }
                                                            })
                                                        }}
                                                        className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500"
                                                    />
                                                    <span className="font-bold text-slate-700 font-mono tracking-wider">{v.patente}</span>
                                                    <span className="text-xs text-gray-400">({v.tipoVehiculo.nombre})</span>
                                                </label>
                                            )
                                        })
                                    })()}
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex justify-end gap-3 pt-2 border-t border-gray-50">
                                <button type="button" onClick={resetForms} className="px-6 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 transition-all">Cancelar</button>
                                <button type="submit" disabled={loading} className="bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-cyan-600/20 disabled:opacity-50">{loading ? 'Guardando...' : editingId ? 'Actualizar Registro' : 'Registrar Jefe Operación'}</button>
                            </div>
                        </form>
                    )}

                    {/* SUPERVISORES FORM */}
                    {activeTab === 'supervisor' && (
                        <form onSubmit={handleSubmitSuper} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Nombre</label>
                                    <input
                                        title="Nombre"
                                        type="text" required placeholder="Ej: Marcelo"
                                        value={superForm.nombre} onChange={(e) => setSuperForm({ ...superForm, nombre: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Apellido</label>
                                    <input
                                        title="Apellido"
                                        type="text" required placeholder="Ej: Ríos"
                                        value={superForm.apellido} onChange={(e) => setSuperForm({ ...superForm, apellido: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Correo Electrónico</label>
                                    <input
                                        title="Correo"
                                        type="email" required placeholder="marcelo.rios@empresa.cl"
                                        value={superForm.correo} onChange={(e) => setSuperForm({ ...superForm, correo: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Inteligencia de dependencia */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <div className="space-y-3 md:col-span-2">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dependencia Operacional</h4>
                                    
                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={superForm.dependsDirectlyOnZonal}
                                            onChange={(e) => setSuperForm(prev => ({ 
                                                ...prev, 
                                                dependsDirectlyOnZonal: e.target.checked,
                                                jefeOperacionId: '', // Reset
                                                jefeZonalId: '',      // Reset
                                                rbdIds: [],
                                                camionetaIds: []
                                            }))}
                                            className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500"
                                        />
                                        <span>⚠️ No tiene Jefe de Operación (Depende directo de Jefe Zonal)</span>
                                    </label>
                                </div>

                                {!superForm.dependsDirectlyOnZonal ? (
                                    /* Seleccionar Jefe de Operaciones */
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700">Jefe de Operación Asociado</label>
                                        <select
                                            title="Jefe de Operación"
                                            required
                                            value={superForm.jefeOperacionId}
                                            onChange={(e) => setSuperForm(prev => ({ 
                                                ...prev, 
                                                jefeOperacionId: e.target.value,
                                                jefeZonalId: '',
                                                rbdIds: [], // Reset RBD checklist since sucursal will change
                                                camionetaIds: [] // Reset camioneta checklist
                                            }))}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-white"
                                        >
                                            <option value="">Selecciona Jefe de Operación...</option>
                                            {initialJefesOperacion.filter(o => o.vigente).map(o => (
                                                <option key={o.id} value={o.id}>
                                                    {o.nombre} {o.apellido} (Zonal: {o.jefeZonal.nombre} {o.jefeZonal.apellido})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    /* Depende directo del Zonal */
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700">Jefe Zonal Asociado (Dependencia Directa)</label>
                                        <select
                                            title="Jefe Zonal"
                                            required
                                            value={superForm.jefeZonalId}
                                            onChange={(e) => setSuperForm(prev => ({ 
                                                ...prev, 
                                                jefeZonalId: e.target.value,
                                                jefeOperacionId: '',
                                                rbdIds: [], // Reset RBD checklist since sucursal will change
                                                camionetaIds: [] // Reset camioneta checklist
                                            }))}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-white"
                                        >
                                            <option value="">Selecciona Jefe Zonal...</option>
                                            {initialZonales.filter(z => z.vigente).map(z => (
                                                <option key={z.id} value={z.id}>
                                                    {z.nombre} {z.apellido} ({z.sucursales.map((s: any) => s.sucursal.nombre).join(', ')})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Vigente */}
                                <div className="flex items-end pb-1">
                                    <label className="flex items-center gap-3 cursor-pointer bg-white px-4 py-2.5 rounded-xl border border-gray-200 w-full">
                                        <input
                                            type="checkbox" checked={superForm.vigente}
                                            onChange={(e) => setSuperForm({ ...superForm, vigente: e.target.checked })}
                                            className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Supervisor Vigente / Activo</span>
                                    </label>
                                </div>
                            </div>

                            {/* Camionetas y RBDs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Camionetas checklist (display plate) */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                            <span>Camionetas Asociadas (Múltiple)</span>
                                            {allowedSucursales.length > 0 && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                                                    Filtrado por: {allowedSucursales.join(', ').toUpperCase()}
                                                </span>
                                            )}
                                        </label>
                                        <span className="text-xs text-gray-400 font-medium">{superForm.camionetaIds.length} seleccionadas</span>
                                    </div>
                                    <input
                                        title="Filtrar Camionetas"
                                        type="text" placeholder="Filtrar camionetas..." value={camionetaFilter} onChange={(e) => setCamionetaFilter(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:ring-1 focus:ring-cyan-500"
                                    />
                                    <div className="border border-gray-200 rounded-xl max-h-40 overflow-y-auto p-3 space-y-2 bg-gray-50/30">
                                        {filteredVehiculosForSupervisor
                                            .filter(v => v.patente.toLowerCase().includes(camionetaFilter.toLowerCase()) || v.tipoVehiculo.nombre.toLowerCase().includes(camionetaFilter.toLowerCase()))
                                            .map(v => {
                                                const isChecked = superForm.camionetaIds.includes(v.id)
                                                return (
                                                    <label key={v.id} className="flex items-center gap-2 cursor-pointer text-sm">
                                                        <input
                                                            type="checkbox" checked={isChecked}
                                                            onChange={() => {
                                                                setSuperForm(prev => {
                                                                    const exist = prev.camionetaIds.includes(v.id)
                                                                    const updated = exist 
                                                                        ? prev.camionetaIds.filter(id => id !== v.id)
                                                                        : [...prev.camionetaIds, v.id]
                                                                    return { ...prev, camionetaIds: updated }
                                                                })
                                                            }}
                                                            className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500"
                                                        />
                                                        <span className="font-bold text-slate-700 font-mono tracking-wider">{v.patente}</span>
                                                        <span className="text-xs text-gray-400">({v.tipoVehiculo.nombre})</span>
                                                    </label>
                                                )
                                            })}

                                        {allowedSucursalIds.length === 0 && (
                                            <div className="text-xs text-slate-400 italic text-center py-4">Selecciona primero un Jefe de Operación o Jefe Zonal para listar sus camionetas.</div>
                                        )}
                                        {allowedSucursalIds.length > 0 && filteredVehiculosForSupervisor.length === 0 && (
                                            <div className="text-xs text-slate-400 italic text-center py-4">No se encontraron camionetas para la sucursal de dependencia de este jefe.</div>
                                        )}
                                    </div>
                                </div>

                                {/* RBDs a Auditar Checklist (filtered in cascade) */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                            <span>RBDs a Auditar</span>
                                            {allowedSucursales.length > 0 && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                                                    Filtrado por: {allowedSucursales.join(', ').toUpperCase()}
                                                </span>
                                            )}
                                        </label>
                                        <span className="text-xs text-gray-400 font-medium">{superForm.rbdIds.length} seleccionados</span>
                                    </div>
                                    <input
                                        title="Filtrar RBD"
                                        type="text" placeholder="Filtrar RBD o colegio..." value={rbdFilter} onChange={(e) => setRbdFilter(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:ring-1 focus:ring-cyan-500"
                                    />
                                    <div className="border border-gray-200 rounded-xl max-h-40 overflow-y-auto p-3 space-y-2 bg-gray-50/30">
                                        {filteredColegiosForSupervisor
                                            .filter((col: any) => String(col.colRBD).includes(rbdFilter) || col.nombreEstablecimiento.toLowerCase().includes(rbdFilter.toLowerCase()))
                                            .map((col: any) => {
                                                const isChecked = superForm.rbdIds.includes(col.colRBD)
                                                return (
                                                    <label key={col.colRBD} className="flex items-center gap-2 cursor-pointer text-sm">
                                                        <input
                                                            type="checkbox" checked={isChecked}
                                                            onChange={() => {
                                                                setSuperForm(prev => {
                                                                    const exist = prev.rbdIds.includes(col.colRBD)
                                                                    const updated = exist 
                                                                        ? prev.rbdIds.filter(id => id !== col.colRBD)
                                                                        : [...prev.rbdIds, col.colRBD]
                                                                    return { ...prev, rbdIds: updated }
                                                                })
                                                            }}
                                                            className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500"
                                                        />
                                                        <span className="font-bold text-slate-800">{col.colRBD}</span>
                                                        <span className="text-xs text-gray-600 truncate max-w-[200px]" title={col.nombreEstablecimiento}>{col.nombreEstablecimiento}</span>
                                                    </label>
                                                )
                                            })}

                                        {allowedSucursales.length === 0 && (
                                            <div className="text-xs text-slate-400 italic text-center py-4">Selecciona primero un Jefe de Operación o Jefe Zonal para listar sus RBDs.</div>
                                        )}
                                        {allowedSucursales.length > 0 && filteredColegiosForSupervisor.length === 0 && (
                                            <div className="text-xs text-slate-400 italic text-center py-4">No se encontraron RBDs para la sucursal de dependencia de este jefe.</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex justify-end gap-3 pt-2 border-t border-gray-50">
                                <button type="button" onClick={resetForms} className="px-6 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 transition-all">Cancelar</button>
                                <button type="submit" disabled={loading} className="bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-cyan-600/20 disabled:opacity-50">{loading ? 'Guardando...' : editingId ? 'Actualizar Registro' : 'Registrar Supervisor'}</button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* LISTINGS SECTION */}

            {/* JEFES ZONALES TAB */}
            {activeTab === 'zonales' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-50 bg-gray-50/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full sm:max-w-md">
                            <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">🔍</span>
                            <input
                                title="Buscar zonal"
                                type="text" value={searchZonal} onChange={(e) => setSearchZonal(e.target.value)}
                                placeholder="Buscar jefe zonal por nombre, correo, sucursal..."
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm bg-white focus:ring-1 focus:ring-cyan-500"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100 text-slate-600 text-xs font-bold uppercase tracking-wider">
                                    {([['nombre','Nombre Completo'],['correo','Correo'],['licitacion','Licitaciones'],['sucursal','Sucursales'],['uts','UTs Cubiertas'],['patentes','Patentes'],['estado','Estado']] as [string,string][]).map(([col, label]) => (
                                        <th key={col} onClick={() => toggleSort(sortZonal, col, setSortZonal)} className={`px-6 py-4 cursor-pointer select-none hover:bg-cyan-50/50 transition-colors whitespace-nowrap ${col === 'estado' ? 'text-center' : ''}`}>
                                            {label}{sortIcon(sortZonal, col)}
                                        </th>
                                    ))}
                                    {userPermissions.includes('manage_zonales') && <th className="px-6 py-4 text-right">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                                {pagedZonales
                                    .map(z => {
                                        const zonalUts = getUTsForSelectedSucursales(
                                            z.sucursales.map((s: any) => s.sucursalId),
                                            z.licitaciones.map((l: any) => l.licitacionId)
                                        )
                                        return (
                                            <tr key={z.id} className="hover:bg-cyan-50/20 transition-colors">
                                                <td className="px-6 py-4 font-bold text-gray-900">{z.nombre} {z.apellido}</td>
                                                <td className="px-6 py-4">{z.correo}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {z.licitaciones.map((l: any) => (
                                                            <span key={l.licitacionId} className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 border border-slate-200">
                                                                Lic. {l.licitacionId}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {z.sucursales.map((s: any) => (
                                                            <span key={s.sucursalId} className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-100">
                                                                {s.sucursal.nombre}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-semibold text-slate-500">{zonalUts.length} UTs ({zonalUts.join(', ')})</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(z.vehiculos || []).map((v: any) => (
                                                            <span key={v.vehiculoId} className="inline-flex font-mono font-bold tracking-wider px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-800 border border-slate-200">
                                                                {v.vehiculo.patente}
                                                            </span>
                                                        ))}
                                                        {(z.vehiculos || []).length === 0 && (
                                                            <span className="text-xs text-gray-400 italic">Ninguna</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${z.vigente ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                        {z.vigente ? 'Vigente' : 'No Vigente'}
                                                    </span>
                                                </td>
                                                {userPermissions.includes('manage_zonales') && (
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => handleEditZonal(z)} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg"><span className="text-md">✏️</span></button>
                                                            <button onClick={() => handleDeleteZonal(z.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><span className="text-md">🗑️</span></button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        )
                                    })}
                            </tbody>
                        </table>
                    </div>
                    {renderPagination(pageZonal, totalZonalPages, setPageZonal, sortedZonales.length)}
                </div>
            )}

            {/* JEFES DE OPERACIÓN TAB */}
            {activeTab === 'jefe-operacion' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-50 bg-gray-50/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full sm:max-w-md">
                            <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">🔍</span>
                            <input
                                title="Buscar jefe operacion"
                                type="text" value={searchOp} onChange={(e) => setSearchOp(e.target.value)}
                                placeholder="Buscar jefe de operación por nombre, correo, zonal..."
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm bg-white focus:ring-1 focus:ring-cyan-500"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100 text-slate-600 text-xs font-bold uppercase tracking-wider">
                                    {([['nombre','Nombre Completo'],['correo','Correo'],['zonal','Jefe Zonal Dependiente'],['sucursal','Sucursales Asociadas'],['patentes','Patentes'],['estado','Estado']] as [string,string][]).map(([col, label]) => (
                                        <th key={col} onClick={() => toggleSort(sortOp, col, setSortOp)} className={`px-6 py-4 cursor-pointer select-none hover:bg-cyan-50/50 transition-colors whitespace-nowrap ${col === 'estado' ? 'text-center' : ''}`}>
                                            {label}{sortIcon(sortOp, col)}
                                        </th>
                                    ))}
                                    {userPermissions.includes('manage_jefe_operacion') && <th className="px-6 py-4 text-right">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                                {pagedJefesOp
                                    .map(o => (
                                        <tr key={o.id} className="hover:bg-cyan-50/20 transition-colors">
                                            <td className="px-6 py-4 font-bold text-gray-900">{o.nombre} {o.apellido}</td>
                                            <td className="px-6 py-4">{o.correo}</td>
                                            <td className="px-6 py-4 font-semibold text-slate-700">{o.jefeZonal.nombre} {o.jefeZonal.apellido}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {o.jefeZonal.sucursales.map((s: any) => (
                                                        <span key={s.sucursalId} className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-100">
                                                            {s.sucursal.nombre}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {(o.vehiculos || []).map((v: any) => (
                                                        <span key={v.vehiculoId} className="inline-flex font-mono font-bold tracking-wider px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-800 border border-slate-200">
                                                            {v.vehiculo.patente}
                                                        </span>
                                                    ))}
                                                    {(o.vehiculos || []).length === 0 && (
                                                        <span className="text-xs text-gray-400 italic">Ninguna</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${o.vigente ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                    {o.vigente ? 'Vigente' : 'No Vigente'}
                                                </span>
                                            </td>
                                            {userPermissions.includes('manage_jefe_operacion') && (
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => handleEditOp(o)} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg"><span className="text-md">✏️</span></button>
                                                        <button onClick={() => handleDeleteOp(o.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><span className="text-md">🗑️</span></button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                    {renderPagination(pageOp, totalOpPages, setPageOp, sortedJefesOp.length)}
                </div>
            )}

            {/* SUPERVISORES TAB */}
            {activeTab === 'supervisor' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-50 bg-gray-50/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full sm:max-w-md">
                            <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">🔍</span>
                            <input
                                title="Buscar supervisor"
                                type="text" value={searchSuper} onChange={(e) => setSearchSuper(e.target.value)}
                                placeholder="Buscar supervisor por nombre, correo..."
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm bg-white focus:ring-1 focus:ring-cyan-500"
                            />
                        </div>

                        {/* Download Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 shadow-lg shadow-slate-900/10 cursor-pointer select-none"
                                title="Descargar Reportes"
                            >
                                <span>📥</span> Descargar
                            </button>
                            {showDownloadDropdown && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowDownloadDropdown(false)} />
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <button
                                            onClick={() => { downloadExcel(); setShowDownloadDropdown(false); }}
                                            className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm font-semibold text-gray-700 flex items-center gap-2 transition-colors cursor-pointer"
                                        >
                                            <span className="text-emerald-600">📊</span> Descargar Excel
                                        </button>
                                        <button
                                            onClick={() => { downloadPDF(); setShowDownloadDropdown(false); }}
                                            className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm font-semibold text-gray-700 flex items-center gap-2 transition-colors cursor-pointer"
                                        >
                                            <span className="text-rose-600">📄</span> Descargar PDF
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100 text-slate-600 text-xs font-bold uppercase tracking-wider">
                                    {([['nombre','Nombre Completo'],['correo','Correo'],['dep','Asociado Con'],['sucursal','Sucursales'],['camionetas','Camionetas'],['rbds','RBDs Auditados'],['estado','Estado']] as [string,string][]).map(([col, label]) => (
                                        <th key={col} onClick={() => toggleSort(sortSuper, col, setSortSuper)} className={`px-6 py-4 cursor-pointer select-none hover:bg-cyan-50/50 transition-colors whitespace-nowrap ${col === 'estado' ? 'text-center' : ''}`}>
                                            {label}{sortIcon(sortSuper, col)}
                                        </th>
                                    ))}
                                    {userPermissions.includes('manage_supervisor') && <th className="px-6 py-4 text-right">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                                {pagedSupervisores
                                    .map(s => {
                                        const hasOp = !!s.jefeOperacion
                                        const dependencyName = hasOp 
                                            ? `👔 Jefe Op: ${s.jefeOperacion.nombre} ${s.jefeOperacion.apellido}`
                                            : `💼 Jefe Zonal: ${s.jefeZonal?.nombre} ${s.jefeZonal?.apellido}`
                                        
                                        const zonal = s.jefeOperacion?.jefeZonal || s.jefeZonal
                                        const supervisorSucursales = zonal?.sucursales || []

                                        return (
                                            <tr key={s.id} className="hover:bg-cyan-50/20 transition-colors">
                                                <td className="px-6 py-4 font-bold text-gray-900">{s.nombre} {s.apellido}</td>
                                                <td className="px-6 py-4">{s.correo}</td>
                                                <td className="px-6 py-4 font-medium text-slate-700">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${hasOp ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                                        {dependencyName}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {supervisorSucursales.map((su: any) => (
                                                            <span key={su.sucursalId} className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-100">
                                                                {su.sucursal.nombre}
                                                            </span>
                                                        ))}
                                                        {supervisorSucursales.length === 0 && (
                                                            <span className="text-xs text-gray-400 italic">Ninguna</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {s.camionetas.map((c: any) => (
                                                            <span key={c.vehiculoId} className="inline-flex font-mono font-bold tracking-wider px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-800 border border-slate-200">
                                                                {c.vehiculo.patente}
                                                            </span>
                                                        ))}
                                                        {s.camionetas.length === 0 && (
                                                            <span className="text-xs text-gray-400 italic">Ninguna</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-semibold text-slate-500" title={s.rbdsAuditar.map((r: any) => r.rbd).join(', ')}>
                                                        {s.rbdsAuditar.length} RBDs asignados
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${s.vigente ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                        {s.vigente ? 'Vigente' : 'No Vigente'}
                                                    </span>
                                                </td>
                                                {userPermissions.includes('manage_supervisor') && (
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => handleEditSuper(s)} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg"><span className="text-md">✏️</span></button>
                                                            <button onClick={() => handleDeleteSuper(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><span className="text-md">🗑️</span></button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        )
                                    })}
                            </tbody>
                        </table>
                    </div>
                    {renderPagination(pageSuper, totalSuperPages, setPageSuper, sortedSupervisores.length)}
                </div>
            )}

            {/* TABLERO DE DISTANCIAS TAB */}
            {activeTab === 'distancias' && (() => {
                const isAdmin = userPermissions.includes('manage_users')

                // Calculate global KPIs
                let globalTotalKm = 0
                const computedRbdPairs = new Set<string>()
                let totalAssignedSchools = 0
                let calculatedCount = 0
                let errorCount = 0

                sortedSupervisores.forEach(s => {
                    const zonal = s.jefeOperacion?.jefeZonal || s.jefeZonal
                    const firstSucursal = zonal?.sucursales?.[0]?.sucursal?.nombre || null

                    s.rbdsAuditar.forEach((r: any) => {
                        const school = colegios.find(col => col.colRBD === r.rbd)
                        const sucursalName = school ? school.sucursal : firstSucursal
                        if (!sucursalName) return

                        const key = `${sucursalName}-${r.rbd}`
                        if (!computedRbdPairs.has(key)) {
                            computedRbdPairs.add(key)
                            totalAssignedSchools++

                            const cache = distanciasCache.find(c => c.sucursal === sucursalName && c.rbd === r.rbd)
                            if (cache) {
                                if (cache.distanciaKm === -1) {
                                    errorCount++
                                } else {
                                    calculatedCount++
                                    globalTotalKm += cache.distanciaKm
                                }
                            }
                        }
                    })
                })

                // Breakdown by Sucursal
                const sucursalStats = sucursales.map(suc => {
                    const sucursalName = suc.nombre
                    let numSupervisores = 0
                    let numSchools = 0
                    let sucursalKm = 0

                    // Find supervisores in this sucursal
                    sortedSupervisores.forEach(s => {
                        const zonal = s.jefeOperacion?.jefeZonal || s.jefeZonal
                        const sucs = zonal?.sucursales || []
                        const isAssigned = sucs.some((su: any) => su.sucursal.nombre === sucursalName)

                        if (isAssigned) {
                            numSupervisores++
                            s.rbdsAuditar.forEach((r: any) => {
                                const school = colegios.find(col => col.colRBD === r.rbd)
                                const assignedSuc = school ? school.sucursal : sucursalName
                                if (assignedSuc === sucursalName) {
                                    numSchools++
                                    const cache = distanciasCache.find(c => c.sucursal === sucursalName && c.rbd === r.rbd)
                                    if (cache && cache.distanciaKm >= 0) {
                                        sucursalKm += cache.distanciaKm
                                    }
                                }
                            })
                        }
                    })

                    return {
                        nombre: sucursalName,
                        supervisores: numSupervisores,
                        colegios: numSchools,
                        kilometros: sucursalKm
                    }
                }).filter(s => s.kilometros > 0 || s.colegios > 0)

                const maxSucursalKm = Math.max(...sucursalStats.map(s => s.kilometros), 1)
                const pendingCount = totalAssignedSchools - calculatedCount - errorCount

                // Handle bulk calculation trigger
                const handleCalculatePending = async () => {
                    setIsCalculating(true)
                    setCalcResult(null)
                    try {
                        const res = await calculatePendingDistances()
                        if (res.success) {
                            setCalcResult({
                                processed: res.processed,
                                errors: res.errors,
                                message: res.message,
                                limitHit: res.limitHit
                            })
                            // Refresh client cache
                            const updated = await getDistanciasCache()
                            setDistanciasCache(updated)
                            const consumo = await getConsumoActual()
                            setConsumoActual(consumo)
                        } else {
                            setCalcResult({ message: res.error || 'Ocurrió un error inesperado al procesar.' })
                        }
                    } catch (e: any) {
                        setCalcResult({ message: e.message || 'Error al conectar con el servidor.' })
                    } finally {
                        setIsCalculating(false)
                    }
                }

                // Handle single retry trigger
                const handleCalculateSingle = async (sucursal: string, rbd: number) => {
                    setIsCalculating(true)
                    try {
                        const res = await calculateSingleDistance(sucursal, rbd, true)
                        if (res.success) {
                            // Refresh client cache
                            const updated = await getDistanciasCache()
                            setDistanciasCache(updated)
                            const consumo = await getConsumoActual()
                            setConsumoActual(consumo)
                        } else {
                            alert(res.error || 'No se pudo recalcular la ruta.')
                        }
                    } catch (e: any) {
                        alert('Error al conectar con el servidor.')
                    } finally {
                        setIsCalculating(false)
                    }
                }

                // Handle reset counter
                const handleResetCount = async () => {
                    if (!confirm('¿Estás seguro de reiniciar el contador mensual de seguridad de Google Maps?')) return
                    setIsCalculating(true)
                    try {
                        const res = await resetConsumoMensual()
                        if (res.success) {
                            const consumo = await getConsumoActual()
                            setConsumoActual(consumo)
                        } else {
                            alert(res.error)
                        }
                    } catch (e) {
                        alert('Error al reiniciar el contador.')
                    } finally {
                        setIsCalculating(false)
                    }
                }

                const consumoPorcentaje = Math.min((consumoActual.cantidad / consumoActual.tope) * 100, 100)

                return (
                    <>
                        <div className="space-y-6">
                            {/* Global KPI Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* KPI 1 */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                                    <div>
                                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Recorrido Total Acumulado</p>
                                        <h3 className="text-3xl font-black text-gray-900 uppercase italic group-hover:text-cyan-600 transition-colors">
                                            {globalTotalKm.toFixed(1)} Km
                                        </h3>
                                        <p className="text-[10px] text-gray-400 font-semibold mt-1">Suma total de rutas activas de supervisores</p>
                                    </div>
                                    <div className="w-14 h-14 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-3xl shadow-inner group-hover:rotate-12 transition-transform">
                                        🚗
                                    </div>
                                </div>

                                {/* KPI 2 */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                                    <div className="flex-1 pr-4">
                                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Cobertura de Rutas</p>
                                        <h3 className="text-3xl font-black text-gray-900 uppercase italic">
                                            {calculatedCount} / {totalAssignedSchools}
                                        </h3>
                                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                                            <div 
                                                className="bg-cyan-500 h-1.5 rounded-full transition-all duration-500" 
                                                style={{ width: `${totalAssignedSchools > 0 ? (calculatedCount / totalAssignedSchools) * 100 : 0}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-gray-400 font-semibold mt-1.5">
                                            <span>{errorCount} direcciones erróneas</span>
                                            <span>{pendingCount} pendientes</span>
                                        </div>
                                    </div>
                                    <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center text-3xl shadow-inner group-hover:rotate-12 transition-transform">
                                        🏫
                                    </div>
                                </div>

                                {/* KPI 3 */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                                    <div className="flex-1 pr-4">
                                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Uso Cupo Gratis Google</p>
                                        <h3 className="text-3xl font-black text-gray-900 uppercase italic">
                                            {consumoActual.cantidad.toLocaleString()} / {consumoActual.tope.toLocaleString()}
                                        </h3>
                                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                                            <div 
                                                className={`h-1.5 rounded-full transition-all duration-500 ${consumoPorcentaje > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                                style={{ width: `${consumoPorcentaje}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-gray-400 font-semibold mt-1.5">
                                            <span>Consumido: {consumoPorcentaje.toFixed(1)}%</span>
                                            <span>Restante: {(consumoActual.tope - consumoActual.cantidad).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-3xl shadow-inner group-hover:rotate-12 transition-transform">
                                        🛡️
                                    </div>
                                </div>
                            </div>

                            {/* Sucursal totalizers & Admin calculation console */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Breakdown by Sucursal */}
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:col-span-2">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <span>📍</span> Totalizador de Kilómetros por Sucursal
                                    </h3>
                                    <div className="space-y-4">
                                        {sucursalStats.map(stat => {
                                            const pct = (stat.kilometros / maxSucursalKm) * 100
                                            return (
                                                <div key={stat.nombre} className="space-y-1.5 p-3 hover:bg-slate-50/50 rounded-xl transition-all border border-transparent hover:border-slate-100">
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <span className="font-bold text-slate-800 text-sm">{stat.nombre}</span>
                                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-2 font-semibold">
                                                                {stat.supervisores} Sup. / {stat.colegios} RBDs
                                                            </span>
                                                        </div>
                                                        <span className="font-black text-cyan-600 text-sm font-mono">{stat.kilometros.toFixed(1)} Km</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                                        <div 
                                                            className="bg-gradient-to-r from-cyan-500 to-sky-500 h-2 rounded-full transition-all duration-500" 
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}

                                        {sucursalStats.length === 0 && (
                                            <div className="text-center py-12 text-slate-400 italic">No hay datos de kilómetros calculados actualmente.</div>
                                        )}
                                    </div>
                                </div>

                                {/* Admin calculation panel */}
                                <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-sm relative overflow-hidden flex flex-col justify-between">
                                    {/* Decorator background */}
                                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />

                                    <div className="relative z-10 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl">✨</div>
                                            <div>
                                                <h4 className="font-bold text-white">Consola de Rutas</h4>
                                                <p className="text-slate-400 text-xs font-medium">Administración de geocodificación</p>
                                            </div>
                                        </div>

                                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2 text-xs">
                                            <div className="flex justify-between text-slate-400">
                                                <span>Rutas totales asignadas:</span>
                                                <span className="font-bold text-white">{totalAssignedSchools}</span>
                                            </div>
                                            <div className="flex justify-between text-slate-400">
                                                <span>Rutas calculadas con éxito:</span>
                                                <span className="font-bold text-emerald-400">{calculatedCount}</span>
                                            </div>
                                            <div className="flex justify-between text-slate-400">
                                                <span>Direcciones erróneas / faltantes:</span>
                                                <span className="font-bold text-amber-400">{errorCount}</span>
                                            </div>
                                            <div className="flex justify-between text-slate-400">
                                                <span>Rutas pendientes por calcular:</span>
                                                <span className="font-bold text-cyan-400">{pendingCount}</span>
                                            </div>
                                        </div>

                                        {calcResult && (
                                            <div className={`p-3.5 rounded-xl text-xs font-semibold border ${calcResult.limitHit ? 'bg-amber-500/15 border-amber-500/20 text-amber-300' : 'bg-cyan-500/15 border-cyan-500/20 text-cyan-300'}`}>
                                                {calcResult.message}
                                            </div>
                                        )}
                                    </div>

                                    <div className="relative z-10 pt-6 space-y-3">
                                        {isAdmin ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={handleCalculatePending}
                                                    disabled={isCalculating || pendingCount === 0}
                                                    className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-900 font-bold py-3 rounded-xl transition-all shadow-lg shadow-cyan-500/10 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed select-none"
                                                >
                                                    {isCalculating ? 'Procesando cálculos...' : '🚗 Calcular Rutas Pendientes'}
                                                </button>

                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleResetCount}
                                                        disabled={isCalculating}
                                                        className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-2 rounded-lg text-xs transition-all border border-white/5 cursor-pointer disabled:cursor-not-allowed select-none"
                                                    >
                                                        🔄 Reiniciar contador
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-xs text-amber-300 font-medium">
                                                🔒 Solo los usuarios con rol de **Administrador** pueden ejecutar cálculos y forzar geocodificaciones de rutas de Google Maps.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Listado de Kilómetros por Supervisor (Con opción de ver detalles) */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <div className="mb-4">
                                <h3 className="text-md font-bold text-gray-900 flex items-center gap-2">
                                    <span>🛡️</span> Detalle de Kilómetros de Supervisores
                                </h3>
                                <p className="text-xs text-gray-400 font-semibold mt-1">Haz clic en "Ver detalle" en cualquiera de los supervisores para revisar el desglose de tramos punto por punto.</p>
                            </div>
                            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                                <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 uppercase tracking-wider">
                                            <th className="px-5 py-3">Nombre Completo</th>
                                            <th className="px-5 py-3">Jefe Directo / Asociado Con</th>
                                            <th className="px-5 py-3">Sucursales</th>
                                            <th className="px-5 py-3 text-center">Colegios (RBDs)</th>
                                            <th className="px-5 py-3 text-center">Recorrido Total (Km)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {sortedSupervisores.map(s => {
                                            const hasOp = !!s.jefeOperacion
                                            const dependencyName = hasOp 
                                                ? `👔 Jefe Op: ${s.jefeOperacion.nombre} ${s.jefeOperacion.apellido}`
                                                : `💼 Jefe Zonal: ${s.jefeZonal?.nombre} ${s.jefeZonal?.apellido}`
                                            
                                            const zonal = s.jefeOperacion?.jefeZonal || s.jefeZonal
                                            const supervisorSucursales = zonal?.sucursales || []

                                            // Calculate total mileage for supervisor
                                            let totalKm = 0
                                            let hasPending = false
                                            let hasError = false

                                            s.rbdsAuditar.forEach((r: any) => {
                                                const school = colegios.find(col => col.colRBD === r.rbd)
                                                const schoolSucursal = school ? school.sucursal : (supervisorSucursales?.[0]?.sucursal?.nombre || null)
                                                if (schoolSucursal) {
                                                    const cache = distanciasCache.find(c => c.sucursal === schoolSucursal && c.rbd === r.rbd)
                                                    if (cache) {
                                                        if (cache.distanciaKm === -1) {
                                                            hasError = true
                                                        } else {
                                                            totalKm += cache.distanciaKm
                                                        }
                                                    } else {
                                                        hasPending = true
                                                    }
                                                } else {
                                                    hasError = true
                                                }
                                            })

                                            return (
                                                <tr key={s.id} className="hover:bg-cyan-50/20 transition-colors">
                                                    <td className="px-5 py-3.5 font-bold text-gray-900">{s.nombre} {s.apellido}</td>
                                                    <td className="px-5 py-3.5">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${hasOp ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                                            {dependencyName}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex flex-wrap gap-1">
                                                            {supervisorSucursales.map((su: any) => (
                                                                <span key={su.sucursalId} className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-100">
                                                                    {su.sucursal.nombre}
                                                                </span>
                                                            ))}
                                                            {supervisorSucursales.length === 0 && (
                                                                <span className="text-[10px] text-gray-400 italic">Ninguna</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-center font-bold text-slate-700">{s.rbdsAuditar.length}</td>
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex flex-col items-center gap-1 justify-center">
                                                            <span className="font-bold text-gray-900">{totalKm > 0 ? `${totalKm.toFixed(1)} Km` : hasPending ? 'Pendiente' : '0.0 Km'}</span>
                                                            {s.rbdsAuditar.length > 0 && (
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => { setSelectedSupervisorForDetails(s); setModalPage(1); }}
                                                                    className="text-[10px] text-cyan-600 hover:text-cyan-800 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                                                                >
                                                                    👁️ Ver detalle
                                                                </button>
                                                            )}
                                                            {hasError && <span className="text-[9px] text-amber-500 font-bold">⚠️ Error direc.</span>}
                                                            {hasPending && !hasError && <span className="text-[9px] text-gray-400">🔍 Sin calcular</span>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {sortedSupervisores.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-5 py-10 text-center text-gray-400 italic">No se encontraron supervisores vinculados</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Address Error Troubleshooting list */}
                        {errorCount > 0 && (
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-md font-bold text-gray-900 flex items-center gap-2">
                                        <span>⚠️</span> Direcciones con Errores de Trazado o Faltantes ({errorCount})
                                    </h3>
                                    <span className="text-xs text-slate-400 font-semibold">Corrige las direcciones en Colegios/Sucursales y haz clic en Recalcular</span>
                                </div>
                                <div className="overflow-x-auto animate-in fade-in duration-300">
                                    <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                                                <th className="px-4 py-2.5">Colegio (RBD)</th>
                                                <th className="px-4 py-2.5">Dirección Establecimiento</th>
                                                <th className="px-4 py-2.5">Sucursal Origen</th>
                                                <th className="px-4 py-2.5">Dirección Sucursal</th>
                                                {isAdmin && <th className="px-4 py-2.5 text-right">Recalcular</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                            {(() => {
                                                const rows: any[] = []
                                                sortedSupervisores.forEach(s => {
                                                    const zonal = s.jefeOperacion?.jefeZonal || s.jefeZonal
                                                    const firstSucursal = zonal?.sucursales?.[0]?.sucursal?.nombre || null

                                                    s.rbdsAuditar.forEach((r: any) => {
                                                        const school = colegios.find(col => col.colRBD === r.rbd)
                                                        const sucursalName = school ? school.sucursal : firstSucursal
                                                        if (!sucursalName) return

                                                        const cache = distanciasCache.find(c => c.sucursal === sucursalName && c.rbd === r.rbd)
                                                        if (cache && cache.distanciaKm === -1) {
                                                            const sucursalObj = sucursales.find(su => su.nombre === sucursalName)
                                                            rows.push(
                                                                <tr key={`${sucursalName}-${r.rbd}`} className="hover:bg-slate-50/50 transition-colors">
                                                                    <td className="px-4 py-2.5 font-bold">{school?.nombreEstablecimiento || 'Desconocido'} ({r.rbd})</td>
                                                                    <td className="px-4 py-2.5 text-slate-500 font-medium italic">{school?.direccionEstablecimiento || 'Falta dirección'}</td>
                                                                    <td className="px-4 py-2.5 font-bold">{sucursalName}</td>
                                                                    <td className="px-4 py-2.5 text-slate-500 font-medium italic">{sucursalObj?.direccion || 'Falta dirección'}</td>
                                                                    {isAdmin && (
                                                                        <td className="px-4 py-2.5 text-right">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleCalculateSingle(sucursalName, r.rbd)}
                                                                                disabled={isCalculating}
                                                                                className="px-3 py-1 rounded bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed select-none text-[10px]"
                                                                            >
                                                                                🔄 Recalcular
                                                                            </button>
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            )
                                                        }
                                                    })
                                                })
                                                return rows
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* MODAL DETALLE DE KILOMETRAJE */}
                        {selectedSupervisorForDetails && (() => {
                            const s = selectedSupervisorForDetails
                            const zonal = s.jefeOperacion?.jefeZonal || s.jefeZonal
                            const supervisorSucursales = zonal?.sucursales || []
                            
                            const itemsPerModalPage = 6
                            const totalModalItems = s.rbdsAuditar.length
                            const totalModalPages = Math.ceil(totalModalItems / itemsPerModalPage) || 1
                            const pagedModalRbds = s.rbdsAuditar.slice((modalPage - 1) * itemsPerModalPage, modalPage * itemsPerModalPage)
                            
                            return (
                                <div 
                                    onClick={() => setSelectedSupervisorForDetails(null)}
                                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
                                >
                                    <div 
                                        className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {/* Header */}
                                        <div className="bg-slate-900 px-8 py-5 text-white flex justify-between items-center relative overflow-hidden">
                                            <div className="absolute -right-20 -top-20 w-48 h-48 bg-gradient-to-br from-cyan-500/20 to-sky-500/20 rounded-full blur-2xl opacity-50" />
                                            <div className="relative z-10 space-y-1">
                                                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/30 w-fit block">
                                                    🛡️ Supervisor
                                                </span>
                                                <h3 className="text-xl font-extrabold tracking-tight">
                                                    Detalle de Recorridos: {s.nombre} {s.apellido}
                                                </h3>
                                                <p className="text-slate-400 text-[11px] font-medium leading-tight">
                                                    Breakdown de distancias y tiempos desde sucursal origen a RBDs asignados
                                                </p>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => setSelectedSupervisorForDetails(null)}
                                                className="bg-white/10 hover:bg-white/20 text-white rounded-full w-8 h-8 flex items-center justify-center transition-all outline-none border border-white/5 cursor-pointer relative z-20"
                                                title="Cerrar modal"
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        {/* Body */}
                                        <div className="p-8 overflow-y-auto space-y-6">
                                            {/* Sucursales Information */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="bg-slate-50 p-4 rounded-2xl border border-gray-100">
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">🏢 Sucursales Vinculadas</h4>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {supervisorSucursales.map((su: any) => (
                                                            <div key={su.sucursalId} className="bg-white border border-gray-200/80 rounded-xl px-3 py-1.5 shadow-sm text-xs font-bold text-slate-800 flex flex-col gap-0.5">
                                                                <span className="text-cyan-600 font-extrabold">{su.sucursal.nombre}</span>
                                                                <span className="text-[10px] text-gray-400 font-medium italic">{su.sucursal.direccion || 'Sin dirección registrada'}</span>
                                                            </div>
                                                        ))}
                                                        {supervisorSucursales.length === 0 && (
                                                            <span className="text-xs text-gray-400 italic">Ninguna sucursal vinculada</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="bg-slate-50 p-4 rounded-2xl border border-gray-100 flex flex-col justify-center">
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">🚗 Resumen Flota</h4>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {s.camionetas.map((c: any) => (
                                                            <span key={c.vehiculoId} className="inline-flex font-mono font-black tracking-wider px-2.5 py-1.5 rounded-xl text-xs bg-white text-slate-800 border border-gray-200 shadow-sm">
                                                                🚙 {c.vehiculo.patente}
                                                            </span>
                                                        ))}
                                                        {s.camionetas.length === 0 && (
                                                            <span className="text-xs text-gray-400 italic">Sin vehículos asignados</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Point-to-Point Details Table */}
                                            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                                                <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                                                    <thead>
                                                        <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 uppercase tracking-wider">
                                                            <th className="px-6 py-3.5">Origen (Sucursal)</th>
                                                            <th className="px-6 py-3.5">Destino (Establecimiento / RBD)</th>
                                                            <th className="px-6 py-3.5 text-center">Distancia Estimada</th>
                                                            <th className="px-6 py-3.5 text-center">Duración de Viaje</th>
                                                            <th className="px-6 py-3.5 text-center">Estado de Trazado</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                                        {pagedModalRbds.map((r: any, idx: number) => {
                                                            const school = colegios.find(col => col.colRBD === r.rbd)
                                                            const schoolSucursal = school ? school.sucursal : (supervisorSucursales?.[0]?.sucursal?.nombre || null)
                                                            const sucursalObj = sucursales.find(su => su.nombre === schoolSucursal)

                                                            let distStr = 'Sin calcular'
                                                            let durStr = 'Sin calcular'
                                                            let statusBadge = (
                                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-50 text-slate-500 border border-slate-200">
                                                                    🔍 Sin calcular
                                                                </span>
                                                            )

                                                            if (schoolSucursal) {
                                                                const cache = distanciasCache.find(c => c.sucursal === schoolSucursal && c.rbd === r.rbd)
                                                                if (cache) {
                                                                    if (cache.distanciaKm === -1) {
                                                                        distStr = 'Error'
                                                                        durStr = 'Error'
                                                                        statusBadge = (
                                                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100">
                                                                                ⚠️ Dirección Inválida
                                                                            </span>
                                                                        )
                                                                    } else {
                                                                        distStr = `${cache.distanciaKm.toFixed(1)} Km`
                                                                        durStr = `${cache.duracionMin} min`
                                                                        statusBadge = (
                                                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                                                🚗 Calculado
                                                                            </span>
                                                                        )
                                                                    }
                                                                }
                                                            }

                                                            return (
                                                                <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex flex-col">
                                                                            <span className="font-bold text-gray-900">{schoolSucursal || 'Sin sucursal'}</span>
                                                                            <span className="text-[10px] text-gray-400 font-medium italic max-w-[220px] truncate" title={sucursalObj?.direccion || ''}>
                                                                                📍 {sucursalObj?.direccion || 'Sin dirección registrada'}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex flex-col">
                                                                            <span className="font-bold text-gray-900">{school?.nombreEstablecimiento || `RBD ${r.rbd}`}</span>
                                                                            <span className="text-[10px] text-gray-400 font-medium italic max-w-[260px] truncate" title={`${school?.direccionEstablecimiento || ''}, ${school?.comuna || ''}`}>
                                                                                🏫 {school?.direccionEstablecimiento || 'Sin dirección'}, {school?.comuna || ''}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4 font-mono font-bold text-center text-slate-800">
                                                                        {distStr}
                                                                    </td>
                                                                    <td className="px-6 py-4 font-mono font-bold text-center text-slate-800">
                                                                        {durStr}
                                                                    </td>
                                                                    <td className="px-6 py-4 text-center">
                                                                        {statusBadge}
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })}
                                                        {s.rbdsAuditar.length === 0 && (
                                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                                                                No hay colegios (RBDs) asignados a este supervisor actualmente.
                                                            </td>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Pagination Controls inside Modal */}
                                            {totalModalPages > 1 && (
                                                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50 px-6 py-3 rounded-2xl border border-gray-100 text-xs mt-4">
                                                    <span className="text-gray-500 font-medium">
                                                        Mostrando tramos <strong className="text-slate-800">{(modalPage - 1) * itemsPerModalPage + 1}</strong> al <strong className="text-slate-800">{Math.min(modalPage * itemsPerModalPage, totalModalItems)}</strong> de <strong className="text-slate-800">{totalModalItems}</strong>
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={modalPage === 1}
                                                            onClick={() => setModalPage(prev => prev - 1)}
                                                            className="px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white font-bold transition-all cursor-pointer"
                                                        >
                                                            ◀ Anterior
                                                        </button>
                                                        <span className="px-3 py-1.5 text-gray-500 font-bold">
                                                            Pág. {modalPage} de {totalModalPages}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            disabled={modalPage === totalModalPages}
                                                            onClick={() => setModalPage(prev => prev + 1)}
                                                            className="px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white font-bold transition-all cursor-pointer"
                                                        >
                                                            Siguiente ▶
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer */}
                                        <div className="bg-slate-50 px-8 py-5 border-t border-gray-100 flex justify-end">
                                            <button 
                                                type="button"
                                                onClick={() => setSelectedSupervisorForDetails(null)}
                                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-slate-905/10"
                                            >
                                                Cerrar Detalle
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </>
                )
            })()}
        </div>
    )
}
