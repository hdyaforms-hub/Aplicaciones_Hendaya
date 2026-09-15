'use client'

import { useState, useEffect, useTransition } from 'react'
import {
    getPlanillaDiaHigienePersonal,
    saveRegistroHigienePersonal,
    deleteRegistroHigienePersonal,
    firmarCalidadHigienePersonal,
    firmarBodegaHigienePersonal,
    getPlanillasHistorialHigienePersonal,
    reenviarNotificacionBodegaHigiene,
    eliminarPlanillaHigienePersonal
} from './actions'
import { generateHigienePersonalPDF, HigienePersonalPDFItem } from './generateHigienePersonalPDF'
import FirmaSuaveCanvas from './FirmaSuaveCanvas'

interface SucursalItem {
    id: string
    nombre: string
}

interface RegistroItem {
    id: string
    nombre: string
    uniformeLimpio: string
    zapatosSeguridad: string
    peloCorto: string
    usoJockey: string
    sinJoyas: string
    unasCortas: string
    rasurado: string
    estadoSalud: string
    habitosCorrectos: string
    heridas: string
    observacion?: string | null
    accionCorrectiva?: string | null
    creadoPor: string
    createdAt: string | Date
}

interface PlanillaData {
    id: string
    sucursalId: string
    sucursalNombre: string
    fecha: string | Date
    fechaTexto: string
    estado: string // ABIERTO, FIRMADO_CALIDAD, CERRADO
    firmaCalidadUser?: string | null
    firmaCalidadFecha?: string | Date | null
    firmaCalidadDiasAtraso?: number
    firmaCalidadImg?: string | null
    firmaBodegaUser?: string | null
    firmaBodegaFecha?: string | Date | null
    firmaBodegaImg?: string | null
    observacionesGenerales?: string | null
}

interface Props {
    sucursales: SucursalItem[]
    isRestricted: boolean
    defaultSucursalId: string
    userRole: string
    userPermissions: string[]
    userName: string
}

const EVAL_OPTIONS = ['Cumple', 'No Cumple', 'No Aplica']
const ESTADO_SALUD_OPTIONS = ['No Aplica', 'Diarrea', 'Vómitos', 'Fiebre', 'Resfrio', 'Lesión en la piel']
const HABITOS_OPTIONS = ['No Aplica', 'Telefono', 'Audifonos', 'Mascar Chicle', 'Estornudar', 'Escupir', 'Hálito alcoholico']
const HERIDAS_OPTIONS = ['Ausencia', 'Presencia']

export default function HigienePersonalClient({
    sucursales,
    isRestricted,
    defaultSucursalId,
    userRole,
    userPermissions,
    userName
}: Props) {
    const [isPending, startTransition] = useTransition()

    // Control de Sucursal y Fecha del Sistema
    const [selectedSucursalId, setSelectedSucursalId] = useState<string>(defaultSucursalId || (sucursales[0]?.id || ''))
    
    // La fecha del día es rescatada por el sistema y el usuario no puede cambiarla
    const [todayStr] = useState<string>(() => {
        const now = new Date()
        const y = now.getFullYear()
        const m = String(now.getMonth() + 1).padStart(2, '0')
        const d = String(now.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
    })
    const [fechaTexto, setFechaTexto] = useState<string>(todayStr)

    // Pestaña activa: 'hoy' (Planilla de Hoy) vs 'anteriores' (Firmar Días Anteriores)
    const [activeTab, setActiveTab] = useState<'hoy' | 'anteriores'>('hoy')
    const [yesterdayStr] = useState<string>(() => {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    })
    const [fechaAnteriorManual, setFechaAnteriorManual] = useState<string>(() => {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    })

    // Datos de la planilla activa
    const [planilla, setPlanilla] = useState<PlanillaData | null>(null)
    const [registros, setRegistros] = useState<RegistroItem[]>([])
    const [diasAtraso, setDiasAtraso] = useState<number>(0)
    const [historial, setHistorial] = useState<any[]>([])

    // Mensajes y Modales
    const [errorMsg, setErrorMsg] = useState<string>('')
    const [successMsg, setSuccessMsg] = useState<string>('')
    const [modalOpen, setModalOpen] = useState<boolean>(false)
    const [editingRegistro, setEditingRegistro] = useState<RegistroItem | null>(null)
    
    // Modales de firmas con Canvas
    const [confirmFirmaCalidadOpen, setConfirmFirmaCalidadOpen] = useState<boolean>(false)
    const [confirmFirmaBodegaOpen, setConfirmFirmaBodegaOpen] = useState<boolean>(false)
    const [firmaCalidadDataUrl, setFirmaCalidadDataUrl] = useState<string>('')
    const [firmaBodegaDataUrl, setFirmaBodegaDataUrl] = useState<string>('')

    // Modal de eliminación de planilla / registros (Solo Administrador)
    const [confirmEliminarPlanillaOpen, setConfirmEliminarPlanillaOpen] = useState<boolean>(false)
    const [fechaEliminarTarget, setFechaEliminarTarget] = useState<string>('')

    // Formulario de Trabajador
    const [formData, setFormData] = useState({
        nombre: '',
        uniformeLimpio: 'Cumple',
        zapatosSeguridad: 'Cumple',
        peloCorto: 'Cumple',
        usoJockey: 'Cumple',
        sinJoyas: 'Cumple',
        unasCortas: 'Cumple',
        rasurado: 'Cumple',
        estadoSalud: 'No Aplica',
        habitosCorrectos: 'No Aplica',
        heridas: 'Ausencia',
        observacion: '',
        accionCorrectiva: ''
    })

    const roleUpper = (userRole || '').toUpperCase()
    const isAdmin = roleUpper === 'ADMIN' || roleUpper === 'ADMINISTRADOR'
    const canManage = isAdmin || userPermissions.includes('manage_calidad_higiene_personal') || userPermissions.includes('view_calidad_higiene_personal')
    const canSignCalidad = isAdmin || userPermissions.includes('sign_calidad_higiene_personal') || roleUpper.includes('CALIDAD')
    const canSignBodega = isAdmin || userPermissions.includes('sign_bodega_higiene_personal') || roleUpper.includes('BODEGA')

    // Cargar Planilla
    const loadPlanilla = (sucId: string, fTxt: string) => {
        if (!sucId) return
        startTransition(async () => {
            setErrorMsg('')
            const res = await getPlanillaDiaHigienePersonal(sucId, fTxt)
            if (res.error) {
                setErrorMsg(res.error)
            } else {
                setPlanilla(res.planilla as any)
                setRegistros(res.registros || [])
                setDiasAtraso(res.diasAtraso || 0)
            }

            // Recargar historial para la sucursal seleccionada
            const histRes = await getPlanillasHistorialHigienePersonal(sucId)
            if (Array.isArray(histRes)) {
                setHistorial(histRes)
            }
        })
    }

    useEffect(() => {
        if (selectedSucursalId) {
            loadPlanilla(selectedSucursalId, fechaTexto)
        }
    }, [selectedSucursalId, fechaTexto])

    const handleOpenModal = (reg?: RegistroItem) => {
        if (reg) {
            setEditingRegistro(reg)
            setFormData({
                nombre: reg.nombre,
                uniformeLimpio: reg.uniformeLimpio,
                zapatosSeguridad: reg.zapatosSeguridad,
                peloCorto: reg.peloCorto,
                usoJockey: reg.usoJockey,
                sinJoyas: reg.sinJoyas,
                unasCortas: reg.unasCortas,
                rasurado: reg.rasurado,
                estadoSalud: reg.estadoSalud || 'No Aplica',
                habitosCorrectos: reg.habitosCorrectos || 'No Aplica',
                heridas: reg.heridas || 'Ausencia',
                observacion: reg.observacion || '',
                accionCorrectiva: reg.accionCorrectiva || ''
            })
        } else {
            setEditingRegistro(null)
            setFormData({
                nombre: '',
                uniformeLimpio: 'Cumple',
                zapatosSeguridad: 'Cumple',
                peloCorto: 'Cumple',
                usoJockey: 'Cumple',
                sinJoyas: 'Cumple',
                unasCortas: 'Cumple',
                rasurado: 'Cumple',
                estadoSalud: 'No Aplica',
                habitosCorrectos: 'No Aplica',
                heridas: 'Ausencia',
                observacion: '',
                accionCorrectiva: ''
            })
        }
        setModalOpen(true)
    }

    const handleSaveRegistro = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMsg('')
        setSuccessMsg('')

        if (!formData.nombre.trim()) {
            setErrorMsg('El nombre de la persona es obligatorio.')
            return
        }

        startTransition(async () => {
            const res = await saveRegistroHigienePersonal({
                sucursalId: selectedSucursalId,
                fechaTexto,
                id: editingRegistro ? editingRegistro.id : undefined,
                nombre: formData.nombre.trim(),
                uniformeLimpio: formData.uniformeLimpio,
                zapatosSeguridad: formData.zapatosSeguridad,
                peloCorto: formData.peloCorto,
                usoJockey: formData.usoJockey,
                sinJoyas: formData.sinJoyas,
                unasCortas: formData.unasCortas,
                rasurado: formData.rasurado,
                estadoSalud: formData.estadoSalud,
                habitosCorrectos: formData.habitosCorrectos,
                heridas: formData.heridas,
                observacion: formData.observacion,
                accionCorrectiva: formData.accionCorrectiva
            })

            if (res.error) {
                setErrorMsg(res.error)
            } else {
                setSuccessMsg(editingRegistro ? 'Registro de higiene actualizado correctamente.' : 'Trabajador registrado exitosamente (Nombre encriptado en BD).')
                setModalOpen(false)
                loadPlanilla(selectedSucursalId, fechaTexto)
                setTimeout(() => setSuccessMsg(''), 4000)
            }
        })
    }

    const handleDeleteRegistro = async (id: string, nombrePersona: string) => {
        if (!confirm(`¿Está seguro de eliminar la inspección de "${nombrePersona}"?`)) return
        startTransition(async () => {
            const res = await deleteRegistroHigienePersonal(id)
            if (res.error) {
                setErrorMsg(res.error)
            } else {
                setSuccessMsg(`Registro de "${nombrePersona}" eliminado exitosamente.`)
                loadPlanilla(selectedSucursalId, fechaTexto)
                setTimeout(() => setSuccessMsg(''), 4000)
            }
        })
    }

    const handleFirmarCalidad = async () => {
        if (!firmaCalidadDataUrl || !firmaCalidadDataUrl.startsWith('data:image/')) {
            setErrorMsg('Debe dibujar su firma con el mouse o lápiz en el recuadro antes de confirmar.')
            return
        }

        startTransition(async () => {
            const res = await firmarCalidadHigienePersonal(selectedSucursalId, fechaTexto, firmaCalidadDataUrl)
            if (res.error) {
                setErrorMsg(res.error)
            } else {
                setSuccessMsg('Planilla firmada y cerrada exitosamente por Encargado de Calidad. Se ha notificado al Jefe de Bodega vía correo.')
                setConfirmFirmaCalidadOpen(false)
                setFirmaCalidadDataUrl('')
                loadPlanilla(selectedSucursalId, fechaTexto)
                setTimeout(() => setSuccessMsg(''), 5000)
            }
        })
    }

    const handleFirmarBodega = async () => {
        if (!firmaBodegaDataUrl || !firmaBodegaDataUrl.startsWith('data:image/')) {
            setErrorMsg('Debe dibujar su firma con el mouse o lápiz en el recuadro antes de confirmar.')
            return
        }

        startTransition(async () => {
            const res = await firmarBodegaHigienePersonal(selectedSucursalId, fechaTexto, firmaBodegaDataUrl)
            if (res.error) {
                setErrorMsg(res.error)
            } else {
                setSuccessMsg('Planilla validada y firmada exitosamente por Jefe de Bodega.')
                setConfirmFirmaBodegaOpen(false)
                setFirmaBodegaDataUrl('')
                loadPlanilla(selectedSucursalId, fechaTexto)
                setTimeout(() => setSuccessMsg(''), 5000)
            }
        })
    }

    const [isReenviandoCorreo, setIsReenviandoCorreo] = useState(false)
    const handleReenviarCorreo = async () => {
        setIsReenviandoCorreo(true)
        setErrorMsg('')
        try {
            const res = await reenviarNotificacionBodegaHigiene(selectedSucursalId, fechaTexto)
            if (res.error) {
                setErrorMsg(res.error)
            } else {
                setSuccessMsg(res.message || 'Notificación por correo enviada exitosamente al Jefe de Bodega.')
                setTimeout(() => setSuccessMsg(''), 5000)
            }
        } catch (e: any) {
            setErrorMsg(e.message || 'Error al reenviar el correo.')
        } finally {
            setIsReenviandoCorreo(false)
        }
    }

    const handleOpenConfirmEliminarPlanilla = (targetFecha?: string) => {
        setFechaEliminarTarget(targetFecha || fechaTexto)
        setConfirmEliminarPlanillaOpen(true)
    }

    const handleConfirmEliminarPlanilla = async () => {
        const fecha = fechaEliminarTarget || fechaTexto
        setConfirmEliminarPlanillaOpen(false)
        setErrorMsg('')
        startTransition(async () => {
            const res = await eliminarPlanillaHigienePersonal(selectedSucursalId, fecha)
            if (res.error) {
                setErrorMsg(res.error)
            } else {
                setSuccessMsg(`Planilla de la fecha ${fecha.split('-').reverse().join('/')} y ${res.count || 0} registro(s) eliminados correctamente.`)
                loadPlanilla(selectedSucursalId, fechaTexto)
                setTimeout(() => setSuccessMsg(''), 5000)
            }
        })
    }

    const handleDownloadPDF = () => {
        const sucursalObj = sucursales.find(s => s.id === selectedSucursalId)
        const sucursalNombre = sucursalObj?.nombre || 'Sucursal'
        const fechaFormateada = fechaTexto.split('-').reverse().join('/')

        const items: HigienePersonalPDFItem[] = registros.map(r => ({
            nombre: r.nombre,
            uniformeLimpio: r.uniformeLimpio,
            zapatosSeguridad: r.zapatosSeguridad,
            peloCorto: r.peloCorto,
            usoJockey: r.usoJockey,
            sinJoyas: r.sinJoyas,
            unasCortas: r.unasCortas,
            rasurado: r.rasurado,
            estadoSalud: r.estadoSalud,
            habitosCorrectos: r.habitosCorrectos,
            heridas: r.heridas,
            observacion: r.observacion,
            accionCorrectiva: r.accionCorrectiva
        }))

        generateHigienePersonalPDF({
            fecha: fechaFormateada,
            sucursalNombre,
            items,
            firmaCalidad: planilla?.firmaCalidadUser ? {
                nombre: planilla.firmaCalidadUser,
                fecha: planilla.firmaCalidadFecha ? new Date(planilla.firmaCalidadFecha).toLocaleString('es-CL') : null,
                diasAtraso: planilla.firmaCalidadDiasAtraso,
                img: planilla.firmaCalidadImg || null
            } : null,
            firmaBodega: planilla?.firmaBodegaUser ? {
                nombre: planilla.firmaBodegaUser,
                fecha: planilla.firmaBodegaFecha ? new Date(planilla.firmaBodegaFecha).toLocaleString('es-CL') : null,
                img: planilla.firmaBodegaImg || null
            } : null
        })
    }

    const handleDownloadPDFDeFecha = async (targetFecha: string) => {
        startTransition(async () => {
            const res = await getPlanillaDiaHigienePersonal(selectedSucursalId, targetFecha)
            if (res.error) {
                setErrorMsg(res.error)
                return
            }
            const sucursalObj = sucursales.find(s => s.id === selectedSucursalId)
            const sucursalNombre = sucursalObj?.nombre || 'Sucursal'
            const fechaFormateada = targetFecha.split('-').reverse().join('/')

            const items: HigienePersonalPDFItem[] = (res.registros || []).map((r: any) => ({
                nombre: r.nombre,
                uniformeLimpio: r.uniformeLimpio,
                zapatosSeguridad: r.zapatosSeguridad,
                peloCorto: r.peloCorto,
                usoJockey: r.usoJockey,
                sinJoyas: r.sinJoyas,
                unasCortas: r.unasCortas,
                rasurado: r.rasurado,
                estadoSalud: r.estadoSalud,
                habitosCorrectos: r.habitosCorrectos,
                heridas: r.heridas,
                observacion: r.observacion,
                accionCorrectiva: r.accionCorrectiva
            }))

            const p = res.planilla as any
            generateHigienePersonalPDF({
                fecha: fechaFormateada,
                sucursalNombre,
                items,
                firmaCalidad: p?.firmaCalidadUser ? {
                    nombre: p.firmaCalidadUser,
                    fecha: p.firmaCalidadFecha ? new Date(p.firmaCalidadFecha).toLocaleString('es-CL') : null,
                    diasAtraso: p.firmaCalidadDiasAtraso,
                    img: p.firmaCalidadImg || null
                } : null,
                firmaBodega: p?.firmaBodegaUser ? {
                    nombre: p.firmaBodegaUser,
                    fecha: p.firmaBodegaFecha ? new Date(p.firmaBodegaFecha).toLocaleString('es-CL') : null,
                    img: p.firmaBodegaImg || null
                } : null
            })
        })
    }

    const handleInspeccionarFecha = (targetFecha: string) => {
        setFechaTexto(targetFecha)
        setActiveTab('hoy')
    }

    const handleAbrirFirmaCalidadParaFecha = (targetFecha: string) => {
        setFechaTexto(targetFecha)
        setActiveTab('hoy')
        setFirmaCalidadDataUrl('')
        setConfirmFirmaCalidadOpen(true)
    }

    const handleAbrirFirmaBodegaParaFecha = (targetFecha: string) => {
        setFechaTexto(targetFecha)
        setActiveTab('hoy')
        setFirmaBodegaDataUrl('')
        setConfirmFirmaBodegaOpen(true)
    }

    const isClosed = planilla?.estado === 'FIRMADO_CALIDAD' || planilla?.estado === 'CERRADO'
    const sucursalActual = sucursales.find(s => s.id === selectedSucursalId)?.nombre || ''
    const planillasPendientes = historial.filter(h => h.estado !== 'CERRADO' && h.fechaTexto !== todayStr)

    return (
        <div className="space-y-6">
            {/* Header Principal */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-sky-500 flex items-center justify-center text-2xl text-white shadow-md shadow-cyan-600/20">
                            🧼
                        </div>
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-800 border border-cyan-200/60 mb-1">
                                <span>🛡️</span> Áreas \ Calidad
                            </div>
                            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                                Registro de Transportista interno Higiene Personal
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                                Control diario de higiene personal, presentación y estado de salud de transportistas internos (R_GL_8_11).
                            </p>
                        </div>
                    </div>

                    {/* Acciones principales */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleDownloadPDF}
                            disabled={registros.length === 0}
                            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-2xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            title="Descargar informe oficial en formato PDF"
                        >
                            <span>📄</span>
                            <span>Descargar Informe PDF</span>
                        </button>

                        {/* Botón de Administrador para eliminar registros / purgar planilla */}
                        {isAdmin && (planilla || registros.length > 0) && (
                            <button
                                type="button"
                                onClick={() => handleOpenConfirmEliminarPlanilla(fechaTexto)}
                                disabled={isPending}
                                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 rounded-2xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                                title="Eliminar registros de prueba o purgar la planilla de esta fecha (Solo Administrador)"
                            >
                                <span>🗑️</span>
                                <span>Eliminar Registros (Admin)</span>
                            </button>
                        )}

                        {canManage && !isClosed && fechaTexto === todayStr && (
                            <button
                                onClick={() => handleOpenModal()}
                                className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-2xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all flex items-center gap-2 cursor-pointer"
                            >
                                <span className="text-base font-bold">+</span>
                                <span>Nuevo Trabajador</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Mensajes Globales */}
            {errorMsg && (
                <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-xs font-bold border border-red-200 flex items-center gap-2 animate-in fade-in">
                    <span>⚠️</span> {errorMsg}
                </div>
            )}

            {successMsg && (
                <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl text-xs font-bold border border-emerald-200 flex items-center gap-2 animate-in fade-in">
                    <span>✓</span> {successMsg}
                </div>
            )}

            {/* PESTAÑAS: PLANILLA DE HOY vs FIRMAR DÍAS ANTERIORES */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-200/60 rounded-2xl w-fit">
                <button
                    type="button"
                    onClick={() => {
                        setActiveTab('hoy')
                        setFechaTexto(todayStr)
                    }}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                        activeTab === 'hoy'
                            ? 'bg-white text-cyan-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <span>📅</span>
                    <span>Planilla de Hoy ({todayStr.split('-').reverse().join('/')})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('anteriores')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                        activeTab === 'anteriores'
                            ? 'bg-white text-amber-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <span>⏳</span>
                    <span>Firmar Días Anteriores</span>
                    {planillasPendientes.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                            {planillasPendientes.length} pendientes
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'anteriores' ? (
                <div className="space-y-6">
                    {/* Panel de Selector de Sucursal y Consulta Manual */}
                    <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-base font-black text-slate-800">
                                    Firmar y Validar Días Anteriores
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Gestione el cierre de inspecciones previas pendientes de firma por Calidad o validación de Bodega.
                                </p>
                            </div>
                            <div className="min-w-[240px]">
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Sucursal
                                </label>
                                <select
                                    value={selectedSucursalId}
                                    onChange={(e) => setSelectedSucursalId(e.target.value)}
                                    disabled={isRestricted && sucursales.length === 1}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 disabled:opacity-75"
                                >
                                    {sucursales.map(s => (
                                        <option key={s.id} value={s.id}>{s.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Buscador / Selector de Fecha Anterior Específica */}
                        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <span className="text-xs font-bold text-slate-700 block">
                                    ¿Necesitas firmar una fecha anterior que no aparezca en la lista?
                                </span>
                                <span className="text-[11px] text-slate-500">
                                    Selecciona el día previo para cargar su planilla y estampar tu firma:
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    max={yesterdayStr}
                                    value={fechaAnteriorManual}
                                    onChange={(e) => setFechaAnteriorManual(e.target.value)}
                                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleInspeccionarFecha(fechaAnteriorManual)}
                                    className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                                >
                                    <span>🔍</span> Cargar
                                </button>
                                {canSignCalidad && (
                                    <button
                                        type="button"
                                        onClick={() => handleAbrirFirmaCalidadParaFecha(fechaAnteriorManual)}
                                        className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                                    >
                                        <span>✍️</span> Firmar Calidad
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 1. PLANILLAS PENDIENTES DE DÍAS ANTERIORES */}
                    <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden">
                        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-3 bg-amber-50/40">
                            <div>
                                <h3 className="text-sm sm:text-base font-black text-amber-950 flex items-center gap-2">
                                    <span>⏳</span>
                                    <span>Planillas de Días Anteriores Pendientes de Firma</span>
                                    <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-amber-200 text-amber-900">
                                        {planillasPendientes.length}
                                    </span>
                                </h3>
                                <p className="text-xs text-amber-800 mt-0.5">
                                    Registros que requieren firma del Encargado de Calidad o validación del Jefe de Bodega.
                                </p>
                            </div>
                        </div>

                        {planillasPendientes.length === 0 ? (
                            <div className="p-10 text-center text-slate-500 space-y-2">
                                <div className="text-4xl">🎉</div>
                                <h4 className="font-bold text-sm text-slate-700">¡Al día! No hay registros pendientes de días anteriores</h4>
                                <p className="text-xs text-slate-400 max-w-md mx-auto">
                                    Todas las planillas históricas de {sucursalActual} han sido firmadas por Calidad y validadas por Bodega.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100/75 border-b border-slate-200 text-[10.5px] font-black uppercase text-slate-700 tracking-wider">
                                            <th className="p-3.5">Fecha Planilla</th>
                                            <th className="p-3.5 text-center">Trabajadores</th>
                                            <th className="p-3.5">Estado de Firma</th>
                                            <th className="p-3.5 text-center">Retraso</th>
                                            <th className="p-3.5 text-center">Firma Calidad</th>
                                            <th className="p-3.5 text-center">Firma Bodega</th>
                                            <th className="p-3.5 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                                        {planillasPendientes.map((p) => {
                                            const fechaFmt = p.fechaTexto.split('-').reverse().join('/')
                                            const faltaCalidad = !p.firmaCalidadUser
                                            const faltaBodega = p.firmaCalidadUser && !p.firmaBodegaUser

                                            return (
                                                <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                                                    <td className="p-3.5 font-black text-slate-900">
                                                        <div className="flex items-center gap-2">
                                                            <span>📅</span>
                                                            <span className="font-mono text-sm">{fechaFmt}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 text-center font-bold">
                                                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800">
                                                            {p.totalTrabajadores} {p.totalTrabajadores === 1 ? 'trabajador' : 'trabajadores'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5">
                                                        {faltaCalidad ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                                <span>⚠️</span> Pendiente Firma Calidad
                                                            </span>
                                                        ) : faltaBodega ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-900 border border-sky-300">
                                                                <span>🔔</span> Pendiente Validación Bodega
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900">
                                                                <span>✓</span> Completo
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        {p.diasAtrasoCalculado > 0 ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                                                ⚠️ {p.diasAtrasoCalculado} {p.diasAtrasoCalculado === 1 ? 'día' : 'días'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 text-[11px] font-medium">—</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        {p.firmaCalidadUser ? (
                                                            <span className="text-emerald-700 font-bold text-[11px] block">
                                                                ✓ {p.firmaCalidadUser}
                                                            </span>
                                                        ) : (
                                                            <span className="text-amber-700 italic text-[11px]">Sin firmar</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        {p.firmaBodegaUser ? (
                                                            <span className="text-emerald-700 font-bold text-[11px] block">
                                                                ✓ {p.firmaBodegaUser}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 italic text-[11px]">Sin firmar</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 text-right">
                                                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                            {faltaCalidad && canSignCalidad && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAbrirFirmaCalidadParaFecha(p.fechaTexto)}
                                                                    className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                                                                >
                                                                    <span>✍️</span> Firmar Calidad
                                                                </button>
                                                            )}
                                                            {faltaBodega && canSignBodega && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAbrirFirmaBodegaParaFecha(p.fechaTexto)}
                                                                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                                                                >
                                                                    <span>✍️</span> Validar Bodega
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleInspeccionarFecha(p.fechaTexto)}
                                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                                                title="Ver inspección de higiene"
                                                            >
                                                                <span>👁️</span> Ver
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDownloadPDFDeFecha(p.fechaTexto)}
                                                                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                                                title="Descargar PDF"
                                                            >
                                                                📄 PDF
                                                            </button>
                                                            {isAdmin && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenConfirmEliminarPlanilla(p.fechaTexto)}
                                                                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                                                    title="Eliminar planilla completa y registros (Solo Administrador)"
                                                                >
                                                                    <span>🗑️</span>
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
                    </div>

                    {/* 2. HISTORIAL COMPLETO / PLANILLAS CERRADAS */}
                    <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden">
                        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
                            <div>
                                <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">
                                    <span>📚</span>
                                    <span>Historial de Planillas - {sucursalActual}</span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Registro de planillas anteriores procesadas o cerradas formalmente.
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100/75 border-b border-slate-200 text-[10.5px] font-black uppercase text-slate-700 tracking-wider">
                                        <th className="p-3.5">Fecha</th>
                                        <th className="p-3.5 text-center">Trabajadores</th>
                                        <th className="p-3.5">Estado</th>
                                        <th className="p-3.5">Calidad</th>
                                        <th className="p-3.5">Bodega</th>
                                        <th className="p-3.5 text-center">Atraso</th>
                                        <th className="p-3.5 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                                    {historial.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-slate-400">
                                                No hay registros históricos para esta sucursal.
                                            </td>
                                        </tr>
                                    ) : (
                                        historial.map((h) => (
                                            <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-3.5 font-black text-slate-900">
                                                    {h.fechaTexto.split('-').reverse().join('/')}
                                                </td>
                                                <td className="p-3.5 text-center font-bold">
                                                    {h.totalTrabajadores} {h.totalTrabajadores === 1 ? 'trabajador' : 'trabajadores'}
                                                </td>
                                                <td className="p-3.5">
                                                    {h.estado === 'CERRADO' ? (
                                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                                            ✓ Cerrado y Validado
                                                        </span>
                                                    ) : h.estado === 'FIRMADO_CALIDAD' ? (
                                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800">
                                                            🔒 Firmado Calidad
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                                                            Abierto
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3.5 text-slate-700 font-medium">
                                                    ✓ {h.firmaCalidadUser || '—'}
                                                </td>
                                                <td className="p-3.5 text-slate-700 font-medium">
                                                    ✓ {h.firmaBodegaUser || '—'}
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    {h.firmaCalidadDiasAtraso > 0 ? (
                                                        <span className="text-amber-700 font-bold text-[11px]">
                                                            {h.firmaCalidadDiasAtraso} d. atraso
                                                        </span>
                                                    ) : (
                                                        <span className="text-emerald-700 font-bold text-[11px]">
                                                            Al día
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleInspeccionarFecha(h.fechaTexto)}
                                                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                                        >
                                                            👁️ Ver
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDownloadPDFDeFecha(h.fechaTexto)}
                                                            className="px-3 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                                        >
                                                            📄 PDF
                                                        </button>
                                                        {isAdmin && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenConfirmEliminarPlanilla(h.fechaTexto)}
                                                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                                                title="Eliminar planilla histórica y sus registros (Solo Administrador)"
                                                            >
                                                                <span>🗑️</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                /* VISTA PLANILLA DE HOY / INSPECCIÓN */
                <>
                    {/* AVISO SI SE ESTÁ INSPECCIONANDO UN DÍA ANTERIOR */}
                    {fechaTexto !== todayStr && (
                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950 animate-in fade-in">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl shrink-0">🗓️</span>
                                <div>
                                    <h4 className="text-xs sm:text-sm font-black text-amber-950">
                                        Inspeccionando Fecha Anterior: {fechaTexto.split('-').reverse().join('/')} ({diasAtraso} {diasAtraso === 1 ? 'día' : 'días'} de atraso)
                                    </h4>
                                    <p className="text-xs text-amber-800">
                                        Estás visualizando los registros de un día previo. Puedes estampar firmas o consultar los datos registrados.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFechaTexto(todayStr)}
                                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                            >
                                ← Volver a la Planilla de Hoy
                            </button>
                        </div>
                    )}

                    {/* Selector de Sucursal y Fecha Bloqueada */}
                    <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* 1. Sucursal */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
                                    <span>Sucursal / Centro Operativo *</span>
                                    {isRestricted && (
                                        <span className="text-[10px] text-cyan-700 font-bold bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
                                            🔒 Asignada a tu usuario
                                        </span>
                                    )}
                                </label>
                                <select
                                    value={selectedSucursalId}
                                    onChange={(e) => setSelectedSucursalId(e.target.value)}
                                    disabled={isRestricted && sucursales.length === 1}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all disabled:opacity-75"
                                >
                                    {sucursales.map(s => (
                                        <option key={s.id} value={s.id}>{s.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 2. Fecha de Inspección (Inmutable / Fija por Sistema) */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
                                    <span>Fecha de Inspección *</span>
                                    <span className="text-[10px] text-slate-400 font-semibold">
                                        🔒 Rescatada por sistema
                                    </span>
                                </label>
                                <div className="w-full px-4 py-2.5 bg-slate-100/90 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 flex items-center justify-between select-none">
                                    <span className="flex items-center gap-2">
                                        <span>📅</span>
                                        <span>{fechaTexto.split('-').reverse().join('/')}</span>
                                        {fechaTexto === todayStr && (
                                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">
                                                Hoy
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-medium">Inmutable</span>
                                </div>
                            </div>

                            {/* 3. Estado del Registro Diario */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                                    Estado del Registro Diario
                                </label>
                                <div className="flex items-center gap-2 h-[42px]">
                                    {planilla?.estado === 'CERRADO' ? (
                                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                            <span>✓✓</span> CERRADO Y VALIDADO POR BODEGA
                                        </span>
                                    ) : planilla?.estado === 'FIRMADO_CALIDAD' ? (
                                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-sky-100 text-sky-800 border border-sky-300">
                                            <span>🔒</span> CERRADO POR CALIDAD (PEND. BODEGA)
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                            <span>📝</span> ABIERTO / EN EDICIÓN
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Acceso rápido si existen planillas pendientes de firma de días anteriores */}
                        {planillasPendientes.length > 0 && (
                            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                                    <span>⏳</span> Planillas pendientes de firma de días anteriores:
                                </span>
                                {planillasPendientes.map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setFechaTexto(p.fechaTexto)}
                                        className={`text-[11px] font-bold px-3 py-1 rounded-xl transition-all border cursor-pointer ${
                                            fechaTexto === p.fechaTexto
                                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                                        }`}
                                    >
                                        {p.fechaTexto.split('-').reverse().join('/')} ({p.totalTrabajadores} trab.)
                                    </button>
                                ))}
                                {fechaTexto !== todayStr && (
                                    <button
                                        type="button"
                                        onClick={() => setFechaTexto(todayStr)}
                                        className="text-[11px] font-bold px-3 py-1 bg-cyan-50 text-cyan-800 border border-cyan-300 hover:bg-cyan-100 rounded-xl cursor-pointer"
                                    >
                                        ← Volver a la planilla de hoy
                                    </button>
                                )}
                            </div>
                        )}

                        {/* ALERTA EN PANTALLA: DÍAS DE RETRASO EN FIRMA */}
                        {diasAtraso > 0 && !isClosed && (
                            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex items-start gap-3 text-amber-900 animate-in fade-in">
                                <span className="text-2xl shrink-0">⚠️</span>
                                <div>
                                    <h4 className="text-xs sm:text-sm font-black text-amber-950">
                                        Alerta de Retraso en Firma: {diasAtraso} {diasAtraso === 1 ? 'Día' : 'Días'} de Atraso
                                    </h4>
                                    <p className="text-xs text-amber-800 mt-0.5">
                                        Este registro corresponde al día <b>{fechaTexto.split('-').reverse().join('/')}</b> y se encuentra pendiente de cierre. Si el Encargado de Calidad firma hoy, el sistema registrará formalmente un retraso de <b>{diasAtraso} {diasAtraso === 1 ? 'día' : 'días'}</b> en el acta oficial y auditoría.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* AVISO DE REGISTRO CERRADO / BLOQUEADO */}
                        {isClosed && (
                            <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-300/80 flex items-center gap-3 text-slate-700 text-xs font-semibold">
                                <span className="text-lg">🔒</span>
                                <span>
                                    Este registro diario ya ha sido firmado y cerrado. No se pueden ingresar nuevos registros ni editar los datos almacenados.
                                </span>
                            </div>
                        )}
                    </div>

                    {/* TABLA PRINCIPAL DE REGISTROS DIARIOS DE HIGIENE PERSONAL */}
                    <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden">
                        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                            <div>
                                <h3 className="text-base font-black text-slate-800">
                                    Inspección Higiénica del Personal - {sucursalActual}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Fecha: <b>{fechaTexto.split('-').reverse().join('/')}</b> • {registros.length} {registros.length === 1 ? 'trabajador evaluado' : 'trabajadores evaluados'}
                                </p>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                                <span className="text-emerald-600 font-black">C: Cumple</span>
                                <span>•</span>
                                <span className="text-red-600 font-black">NC: No Cumple</span>
                                <span>•</span>
                                <span className="text-slate-500 font-black">NA: No Aplica</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100/75 border-b border-slate-200 text-[10px] font-black uppercase text-slate-700 tracking-wider text-center">
                                        <th className="p-3 text-left min-w-[140px]">Nombre del Trabajador</th>
                                        <th className="p-2.5 w-14" title="Uniforme limpio y ordenado">Uniforme</th>
                                        <th className="p-2.5 w-14" title="Uso Zapatos seguridad">Zapatos</th>
                                        <th className="p-2.5 w-14" title="Pelo Corto">Pelo</th>
                                        <th className="p-2.5 w-14" title="Uso correcto Jockey">Jockey</th>
                                        <th className="p-2.5 w-14" title="Sin Joyas">Sin Joyas</th>
                                        <th className="p-2.5 w-14" title="Uñas Cortas">Uñas</th>
                                        <th className="p-2.5 w-14" title="Rasurado">Rasurado</th>
                                        <th className="p-2.5 min-w-[100px]">Estado Salud</th>
                                        <th className="p-2.5 min-w-[100px]">Hábitos Correctos</th>
                                        <th className="p-2.5 w-20">Heridas</th>
                                        <th className="p-3 text-left min-w-[130px]">Observación</th>
                                        <th className="p-3 text-left min-w-[130px]">Acción Correctiva</th>
                                        {((!isClosed && canManage) || isAdmin) && <th className="p-3 w-20 text-center">Acción</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                                    {registros.length === 0 ? (
                                        <tr>
                                            <td colSpan={((!isClosed && canManage) || isAdmin) ? 14 : 13} className="p-10 text-center text-slate-400">
                                                <div className="text-3xl mb-2">🧼</div>
                                                <p className="font-bold text-sm text-slate-600">No hay trabajadores registrados para esta fecha y sucursal.</p>
                                                {!isClosed && canManage && fechaTexto === todayStr && (
                                                    <button
                                                        onClick={() => handleOpenModal()}
                                                        className="mt-3 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <span>+</span>
                                                        <span>Registrar Primer Trabajador</span>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ) : (
                                        registros.map((r) => (
                                            <tr key={r.id} className="hover:bg-slate-50/60 transition-colors text-center">
                                                <td className="p-3 text-left font-bold text-slate-900">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-cyan-600">👤</span>
                                                        <span className="tracking-tight">{r.nombre}</span>
                                                    </div>
                                                </td>
                                                <td className="p-2.5"><BadgeCumple valor={r.uniformeLimpio} /></td>
                                                <td className="p-2.5"><BadgeCumple valor={r.zapatosSeguridad} /></td>
                                                <td className="p-2.5"><BadgeCumple valor={r.peloCorto} /></td>
                                                <td className="p-2.5"><BadgeCumple valor={r.usoJockey} /></td>
                                                <td className="p-2.5"><BadgeCumple valor={r.sinJoyas} /></td>
                                                <td className="p-2.5"><BadgeCumple valor={r.unasCortas} /></td>
                                                <td className="p-2.5"><BadgeCumple valor={r.rasurado} /></td>
                                                <td className="p-2.5 text-[11px] font-semibold">
                                                    {r.estadoSalud === 'No Aplica' ? (
                                                        <span className="text-slate-400">No Aplica</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold border border-amber-300">
                                                            {r.estadoSalud}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-[11px] font-semibold">
                                                    {r.habitosCorrectos === 'No Aplica' ? (
                                                        <span className="text-slate-400">No Aplica</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 font-bold border border-rose-300">
                                                            {r.habitosCorrectos}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-[11px] font-semibold">
                                                    {r.heridas === 'Ausencia' ? (
                                                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                                                            Ausencia
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 font-black border border-rose-300 animate-pulse">
                                                            Presencia
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-left text-slate-600 text-[11px]">
                                                    {r.observacion || <span className="text-slate-300 italic">—</span>}
                                                </td>
                                                <td className="p-3 text-left text-slate-600 text-[11px]">
                                                    {r.accionCorrectiva || <span className="text-slate-300 italic">—</span>}
                                                </td>
                                                {((!isClosed && canManage) || isAdmin) && (
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {!isClosed && canManage && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenModal(r)}
                                                                    className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors cursor-pointer"
                                                                    title="Editar registro"
                                                                >
                                                                    ✏️
                                                                </button>
                                                            )}
                                                            {((!isClosed && canManage) || isAdmin) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteRegistro(r.id, r.nombre)}
                                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                                    title={isAdmin ? "Eliminar registro (Permiso de Administrador)" : "Eliminar registro"}
                                                                >
                                                                    🗑️
                                                                </button>
                                                            )}
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

                    {/* BLOQUE DE FIRMAS DUALES (CALIDAD Y BODEGA) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* 1. Firma Encargado de Calidad */}
                        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Monitoreado Encargado de Calidad
                                    </span>
                                    {planilla?.firmaCalidadUser ? (
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                            ✓ Firmado con Lápiz/Mouse
                                        </span>
                                    ) : (
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                                            Pendiente
                                        </span>
                                    )}
                                </div>

                                {planilla?.firmaCalidadUser ? (
                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-2">
                                        {/* Visualización de la firma dibujada */}
                                        {planilla.firmaCalidadImg ? (
                                            <div className="p-2 bg-white rounded-xl border border-slate-200/80 flex flex-col items-center justify-center">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={planilla.firmaCalidadImg}
                                                    alt="Firma Calidad"
                                                    className="max-h-20 max-w-full object-contain filter drop-shadow-xs"
                                                />
                                                <span className="text-[10px] text-slate-400 font-semibold mt-1">Firma manuscrita digitalizada</span>
                                            </div>
                                        ) : null}

                                        <p className="text-xs font-bold text-slate-800">
                                            Firmado por: <span className="text-cyan-700 font-black">{planilla.firmaCalidadUser}</span>
                                        </p>
                                        <p className="text-[11px] text-slate-500">
                                            Fecha y hora: {planilla.firmaCalidadFecha ? new Date(planilla.firmaCalidadFecha).toLocaleString('es-CL') : '—'}
                                        </p>
                                        {planilla.firmaCalidadDiasAtraso !== undefined && planilla.firmaCalidadDiasAtraso > 0 && (
                                            <p className="text-[11px] font-bold text-amber-700">
                                                ⚠️ Firmado con {planilla.firmaCalidadDiasAtraso} días de atraso
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-2xl bg-slate-50/75 border border-dashed border-slate-300 text-center text-slate-500 text-xs">
                                        Registro pendiente de cierre y firma manuscrita por el Encargado de Calidad.
                                    </div>
                                )}
                            </div>

                            <div className="mt-5 pt-4 border-t border-slate-100">
                                {!planilla?.firmaCalidadUser && canSignCalidad ? (
                                    <button
                                        onClick={() => {
                                            setFirmaCalidadDataUrl('')
                                            setConfirmFirmaCalidadOpen(true)
                                        }}
                                        disabled={registros.length === 0 || isPending}
                                        className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-2xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                                    >
                                        <span>✍️</span>
                                        <span>Dibujar Firma y Cerrar Registro (Calidad)</span>
                                    </button>
                                ) : !planilla?.firmaCalidadUser ? (
                                    <p className="text-[11px] text-slate-400 text-center italic">
                                        Se requiere rol o permiso de Calidad para firmar.
                                    </p>
                                ) : canSignCalidad ? (
                                    <button
                                        type="button"
                                        onClick={handleReenviarCorreo}
                                        disabled={isPending || isReenviandoCorreo}
                                        className="w-full py-2.5 px-4 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded-2xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
                                        title="Reenviar correo de notificación al Jefe de Bodega según las listas de distribución configuradas"
                                    >
                                        <span>{isReenviandoCorreo ? '⏳' : '📧'}</span>
                                        <span>{isReenviandoCorreo ? 'Reenviando notificación...' : 'Reenviar Notificación a Bodega'}</span>
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        {/* 2. Firma Jefe de Bodega */}
                        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Verificado Jefe de Bodega
                                    </span>
                                    {planilla?.firmaBodegaUser ? (
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                            ✓ Validado con Lápiz/Mouse
                                        </span>
                                    ) : (
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                                            Pendiente
                                        </span>
                                    )}
                                </div>

                                {planilla?.firmaBodegaUser ? (
                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-2">
                                        {/* Visualización de la firma dibujada */}
                                        {planilla.firmaBodegaImg ? (
                                            <div className="p-2 bg-white rounded-xl border border-slate-200/80 flex flex-col items-center justify-center">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={planilla.firmaBodegaImg}
                                                    alt="Firma Bodega"
                                                    className="max-h-20 max-w-full object-contain filter drop-shadow-xs"
                                                />
                                                <span className="text-[10px] text-slate-400 font-semibold mt-1">Firma manuscrita digitalizada</span>
                                            </div>
                                        ) : null}

                                        <p className="text-xs font-bold text-slate-800">
                                            Validado por: <span className="text-cyan-700 font-black">{planilla.firmaBodegaUser}</span>
                                        </p>
                                        <p className="text-[11px] text-slate-500">
                                            Fecha y hora: {planilla.firmaBodegaFecha ? new Date(planilla.firmaBodegaFecha).toLocaleString('es-CL') : '—'}
                                        </p>
                                    </div>
                                ) : !planilla?.firmaCalidadUser ? (
                                    <div className="p-4 rounded-2xl bg-slate-50/75 border border-slate-200 text-center text-slate-400 text-xs">
                                        ⏳ El Jefe de Bodega podrá firmar una vez que el Encargado de Calidad haya firmado el registro.
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-2xl bg-cyan-50/60 border border-cyan-200 text-center text-cyan-800 text-xs font-semibold">
                                        🔔 Calidad ha firmado. Listo para validación y firma manuscrita del Jefe de Bodega.
                                    </div>
                                )}
                            </div>

                            <div className="mt-5 pt-4 border-t border-slate-100">
                                {planilla?.firmaCalidadUser && !planilla.firmaBodegaUser && canSignBodega ? (
                                    <button
                                        onClick={() => {
                                            setFirmaBodegaDataUrl('')
                                            setConfirmFirmaBodegaOpen(true)
                                        }}
                                        disabled={isPending}
                                        className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                                    >
                                        <span>✍️</span>
                                        <span>Dibujar Firma y Validar (Jefe de Bodega)</span>
                                    </button>
                                ) : !planilla?.firmaBodegaUser && planilla?.firmaCalidadUser ? (
                                    <p className="text-[11px] text-slate-400 text-center italic">
                                        Se requiere rol o permiso de Jefe de Bodega para firmar.
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* MODAL: REGISTRAR / EDITAR TRABAJADOR */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                            <div>
                                <h3 className="text-lg font-black text-slate-800">
                                    {editingRegistro ? 'Editar Inspección de Trabajador' : 'Registrar Inspección de Trabajador'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Sucursal: <b>{sucursalActual}</b> • Fecha (Sistema): <b>{fechaTexto.split('-').reverse().join('/')}</b>
                                </p>
                            </div>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveRegistro} className="space-y-4">
                            {/* Nombre de la persona */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                    Nombre de la persona a ingresar *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Juan Carlos Pérez Soto"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    🔒 El nombre se guardará encriptado (AES-256) en la base de datos protegiendo los datos personales.
                                </p>
                            </div>

                            {/* Evaluaciones Higiénicas (7 Listas desplegables, Default: Cumple) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Uniforme limpio y ordenado *
                                    </label>
                                    <select
                                        value={formData.uniformeLimpio}
                                        onChange={(e) => setFormData(prev => ({ ...prev, uniformeLimpio: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        {EVAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Uso Zapatos seguridad *
                                    </label>
                                    <select
                                        value={formData.zapatosSeguridad}
                                        onChange={(e) => setFormData(prev => ({ ...prev, zapatosSeguridad: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        {EVAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Pelo Corto *
                                    </label>
                                    <select
                                        value={formData.peloCorto}
                                        onChange={(e) => setFormData(prev => ({ ...prev, peloCorto: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        {EVAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Uso correcto Jockey *
                                    </label>
                                    <select
                                        value={formData.usoJockey}
                                        onChange={(e) => setFormData(prev => ({ ...prev, usoJockey: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        {EVAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Sin Joyas *
                                    </label>
                                    <select
                                        value={formData.sinJoyas}
                                        onChange={(e) => setFormData(prev => ({ ...prev, sinJoyas: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        {EVAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Uñas Cortas *
                                    </label>
                                    <select
                                        value={formData.unasCortas}
                                        onChange={(e) => setFormData(prev => ({ ...prev, unasCortas: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        {EVAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Rasurado *
                                    </label>
                                    <select
                                        value={formData.rasurado}
                                        onChange={(e) => setFormData(prev => ({ ...prev, rasurado: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        {EVAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Campos Especiales: Salud, Hábitos y Heridas */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Buen estado de salud *
                                    </label>
                                    <select
                                        value={formData.estadoSalud}
                                        onChange={(e) => setFormData(prev => ({ ...prev, estadoSalud: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        {ESTADO_SALUD_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Hábitos correctos *
                                    </label>
                                    <select
                                        value={formData.habitosCorrectos}
                                        onChange={(e) => setFormData(prev => ({ ...prev, habitosCorrectos: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        {HABITOS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Heridas *
                                    </label>
                                    <select
                                        value={formData.heridas}
                                        onChange={(e) => setFormData(prev => ({ ...prev, heridas: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        {HERIDAS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Observación (Texto Largo) */}
                            <div className="pt-1">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                    Observación (Caja de texto largo)
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Ingrese cualquier detalle o hallazgo relevante de la persona..."
                                    value={formData.observacion}
                                    onChange={(e) => setFormData(prev => ({ ...prev, observacion: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                />
                            </div>

                            {/* Acción Correctiva (Texto Largo con leyenda obligatoria) */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
                                    <span>Acciones correctivas (Caja de texto largo)</span>
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Completar el campo con fecha, nombre del trabajador y acción a tomar..."
                                    value={formData.accionCorrectiva}
                                    onChange={(e) => setFormData(prev => ({ ...prev, accionCorrectiva: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                />
                                <p className="text-[10px] text-amber-700 font-semibold mt-1">
                                    💡 Leyenda: Completar el campo con fecha, nombre del trabajador y acción a tomar.
                                </p>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
                                >
                                    {isPending ? 'Guardando...' : editingRegistro ? 'Actualizar Trabajador' : 'Guardar Trabajador'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN: FIRMA CALIDAD DIBUJADA CON MOUSE O LÁPIZ */}
            {confirmFirmaCalidadOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200">
                        <div className="text-center mb-4">
                            <div className="w-14 h-14 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-2xl mx-auto mb-2 shadow-inner">
                                ✍️
                            </div>
                            <h3 className="text-lg font-black text-slate-900">
                                Firma Manuscrita Encargado de Calidad
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Sucursal: <b>{sucursalActual}</b> • Fecha: <b>{fechaTexto.split('-').reverse().join('/')}</b>
                            </p>
                        </div>

                        {diasAtraso > 0 ? (
                            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-1 mb-4">
                                <p className="font-black text-amber-900 flex items-center gap-1.5 text-xs">
                                    <span>⚠️</span> ATENCIÓN: Firma Extemporánea
                                </p>
                                <p>
                                    Usted está firmando con <b>{diasAtraso} {diasAtraso === 1 ? 'día' : 'días'} de atraso</b> respecto a la fecha original.
                                </p>
                            </div>
                        ) : (
                            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs mb-4">
                                ✓ <b>Firma al día:</b> La documentación corresponde a hoy y se cerrará dentro del plazo operativo.
                            </div>
                        )}

                        {/* LIENZO DIGITAL DE FIRMA CON MOUSE / LÁPIZ */}
                        <div className="mb-4">
                            <FirmaSuaveCanvas
                                value={firmaCalidadDataUrl}
                                onChange={(dataUrl) => setFirmaCalidadDataUrl(dataUrl)}
                                label="Dibuje su firma con mouse o lápiz *"
                                height={140}
                            />
                            <p className="text-[10px] text-slate-400 mt-1 text-center">
                                Use el cursor del mouse, lápiz óptico o su dedo sobre la pantalla táctil para firmar.
                            </p>
                        </div>

                        <p className="text-xs text-slate-600 mb-5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <b>Importante:</b> Al confirmar, la planilla se bloqueará permanentemente y se despachará un correo al <b>Jefe de Bodega</b> para su validación.
                        </p>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmFirmaCalidadOpen(false)}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleFirmarCalidad}
                                disabled={isPending || !firmaCalidadDataUrl}
                                className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPending ? 'Firmando...' : 'Confirmar Firma y Cerrar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN: FIRMA JEFE DE BODEGA DIBUJADA CON MOUSE O LÁPIZ */}
            {confirmFirmaBodegaOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200">
                        <div className="text-center mb-4">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto mb-2 shadow-inner">
                                🏢
                            </div>
                            <h3 className="text-lg font-black text-slate-900">
                                Validación y Firma de Jefe de Bodega
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Sucursal: <b>{sucursalActual}</b> • Fecha: <b>{fechaTexto.split('-').reverse().join('/')}</b>
                            </p>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-xs mb-4 space-y-1">
                            <p>
                                Como Jefe de Bodega, al firmar valida el cumplimiento higiénico de los <b>{registros.length} trabajadores evaluados</b>.
                            </p>
                            <p className="text-[11px] text-slate-500">
                                Validador: <b>{userName}</b>
                            </p>
                        </div>

                        {/* LIENZO DIGITAL DE FIRMA CON MOUSE / LÁPIZ */}
                        <div className="mb-4">
                            <FirmaSuaveCanvas
                                value={firmaBodegaDataUrl}
                                onChange={(dataUrl) => setFirmaBodegaDataUrl(dataUrl)}
                                label="Dibuje su firma con mouse o lápiz *"
                                height={140}
                            />
                            <p className="text-[10px] text-slate-400 mt-1 text-center">
                                Use el cursor del mouse, lápiz óptico o su dedo sobre la pantalla táctil para firmar.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmFirmaBodegaOpen(false)}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleFirmarBodega}
                                disabled={isPending || !firmaBodegaDataUrl}
                                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPending ? 'Validando...' : 'Confirmar Validación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN: ELIMINAR PLANILLA Y REGISTROS (SOLO ADMINISTRADOR) */}
            {confirmEliminarPlanillaOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-rose-200">
                        <div className="text-center mb-4">
                            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl mx-auto mb-2 shadow-inner">
                                🗑️
                            </div>
                            <h3 className="text-lg font-black text-slate-900">
                                ¿Eliminar Registros y Planilla de Higiene?
                            </h3>
                            <p className="text-xs font-bold text-rose-600 mt-0.5 uppercase tracking-wider">
                                Acción Exclusiva de Administrador
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 text-slate-700 text-xs mb-5 space-y-2">
                            <p className="font-bold text-rose-950">
                                Estás a punto de eliminar la información de la planilla:
                            </p>
                            <div className="bg-white p-3 rounded-xl border border-rose-200/80 space-y-1.5 shadow-2xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Sucursal:</span>
                                    <span className="font-bold text-slate-800">{sucursalActual}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Fecha Planilla:</span>
                                    <span className="font-mono font-bold text-slate-900">
                                        {(fechaEliminarTarget || fechaTexto).split('-').reverse().join('/')}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Trabajadores registrados:</span>
                                    <span className="font-bold text-rose-700">
                                        {fechaEliminarTarget && fechaEliminarTarget !== fechaTexto
                                            ? (historial.find(h => h.fechaTexto === fechaEliminarTarget)?.totalTrabajadores || 0)
                                            : registros.length} trabajador(es)
                                    </span>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                                ⚠️ Esta acción eliminará permanentemente todos los trabajadores evaluados y el registro diario de esta fecha. Es ideal para depurar datos de pruebas o corregir información errónea.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmEliminarPlanillaOpen(false)}
                                disabled={isPending}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmEliminarPlanilla}
                                disabled={isPending}
                                className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <span>🗑️</span>
                                <span>{isPending ? 'Eliminando...' : 'Sí, Eliminar Registros'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function BadgeCumple({ valor }: { valor: string }) {
    if (valor === 'Cumple') {
        return (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200" title="Cumple">
                C
            </span>
        )
    }
    if (valor === 'No Cumple') {
        return (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-black bg-red-50 text-red-700 border border-red-200 animate-pulse" title="No Cumple">
                NC
            </span>
        )
    }
    return (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200" title="No Aplica">
            NA
        </span>
    )
}
