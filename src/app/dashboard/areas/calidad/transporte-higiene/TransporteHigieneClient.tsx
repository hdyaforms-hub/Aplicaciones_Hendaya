'use client'

import { useState, useEffect, useTransition } from 'react'
import {
    getPlanillaDia,
    saveRegistroTransporte,
    deleteRegistroTransporte,
    firmarCalidadPlanilla,
    firmarBodegaPlanilla,
    getPlanillasHistorial,
    reenviarNotificacionBodega,
    eliminarPlanillaTransporte
} from './actions'
import { generateTransporteHigienePDF, TransportePDFItem } from './generateTransportePDF'
import FirmaSuaveCanvas from './FirmaSuaveCanvas'

interface SucursalItem {
    id: string
    nombre: string
}

interface RegistroItem {
    id: string
    patente: string
    limpiezaInterior: string
    limpiezaExterior: string
    puertaCamara: string
    piezasSinOxidacion: string
    equipoCongelacion: string
    equipoRefrigeracion: string
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

export default function TransporteHigieneClient({
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

    // Formulario de Vehículo
    const [formData, setFormData] = useState({
        patente: '',
        limpiezaInterior: 'Cumple',
        limpiezaExterior: 'Cumple',
        puertaCamara: 'Cumple',
        piezasSinOxidacion: 'Cumple',
        equipoCongelacion: 'Cumple',
        equipoRefrigeracion: 'Cumple',
        observacion: '',
        accionCorrectiva: ''
    })

    // Permisos
    const isAdmin = userRole === 'Administrador' || userRole === 'admin'
    const canManage = isAdmin || userPermissions.includes('manage_calidad_transporte_higiene')
    const canSignCalidad = isAdmin || userPermissions.includes('sign_calidad_transporte_higiene')
    const canSignBodega = isAdmin || userPermissions.includes('sign_bodega_transporte_higiene')

    // Cargar planilla
    const loadPlanilla = (sucId: string, fecha: string) => {
        if (!sucId || !fecha) return
        setErrorMsg('')
        startTransition(async () => {
            const res = await getPlanillaDia(sucId, fecha)
            if (res.error) {
                setErrorMsg(res.error)
            } else {
                setPlanilla(res.planilla as any || null)
                setRegistros(res.registros as any || [])
                setDiasAtraso(res.diasAtraso || 0)
            }

            const hist = await getPlanillasHistorial(sucId)
            setHistorial(hist || [])
        })
    }

    const handleAbrirFirmaCalidadParaFecha = (targetFecha: string) => {
        setFechaTexto(targetFecha)
        setFirmaCalidadDataUrl('')
        setConfirmFirmaCalidadOpen(true)
    }

    const handleAbrirFirmaBodegaParaFecha = (targetFecha: string) => {
        setFechaTexto(targetFecha)
        setFirmaBodegaDataUrl('')
        setConfirmFirmaBodegaOpen(true)
    }

    const handleInspeccionarFecha = (targetFecha: string) => {
        setFechaTexto(targetFecha)
        setActiveTab('hoy')
    }

    const handleDownloadPDFDeFecha = async (targetFecha: string) => {
        startTransition(async () => {
            const res = await getPlanillaDia(selectedSucursalId, targetFecha)
            if (res.error || !res.planilla) {
                setErrorMsg('No se pudo cargar la información para generar el PDF de esa fecha.')
                return
            }
            const sucursalObj = sucursales.find(s => s.id === selectedSucursalId)
            const sucursalNombre = sucursalObj?.nombre || 'Sucursal'
            const items: TransportePDFItem[] = (res.registros as any[]).map(r => ({
                patente: r.patente,
                limpiezaInterior: r.limpiezaInterior,
                limpiezaExterior: r.limpiezaExterior,
                puertaCamara: r.puertaCamara,
                piezasSinOxidacion: r.piezasSinOxidacion,
                equipoCongelacion: r.equipoCongelacion,
                equipoRefrigeracion: r.equipoRefrigeracion,
                observacion: r.observacion,
                accionCorrectiva: r.accionCorrectiva
            }))

            generateTransporteHigienePDF({
                fecha: targetFecha.split('-').reverse().join('/'),
                sucursalNombre,
                items,
                firmaCalidad: res.planilla.firmaCalidadUser ? {
                    nombre: res.planilla.firmaCalidadUser,
                    fecha: res.planilla.firmaCalidadFecha ? new Date(res.planilla.firmaCalidadFecha).toLocaleString('es-CL') : null,
                    diasAtraso: res.planilla.firmaCalidadDiasAtraso,
                    img: res.planilla.firmaCalidadImg || null
                } : null,
                firmaBodega: res.planilla.firmaBodegaUser ? {
                    nombre: res.planilla.firmaBodegaUser,
                    fecha: res.planilla.firmaBodegaFecha ? new Date(res.planilla.firmaBodegaFecha).toLocaleString('es-CL') : null,
                    img: res.planilla.firmaBodegaImg || null
                } : null
            })
        })
    }

    useEffect(() => {
        if (selectedSucursalId && fechaTexto) {
            loadPlanilla(selectedSucursalId, fechaTexto)
        }
    }, [selectedSucursalId, fechaTexto])

    const handleOpenModal = (item?: RegistroItem) => {
        if (item) {
            setEditingRegistro(item)
            setFormData({
                patente: item.patente,
                limpiezaInterior: item.limpiezaInterior || 'Cumple',
                limpiezaExterior: item.limpiezaExterior || 'Cumple',
                puertaCamara: item.puertaCamara || 'Cumple',
                piezasSinOxidacion: item.piezasSinOxidacion || 'Cumple',
                equipoCongelacion: item.equipoCongelacion || 'Cumple',
                equipoRefrigeracion: item.equipoRefrigeracion || 'Cumple',
                observacion: item.observacion || '',
                accionCorrectiva: item.accionCorrectiva || ''
            })
        } else {
            setEditingRegistro(null)
            setFormData({
                patente: '',
                limpiezaInterior: 'Cumple',
                limpiezaExterior: 'Cumple',
                puertaCamara: 'Cumple',
                piezasSinOxidacion: 'Cumple',
                equipoCongelacion: 'Cumple',
                equipoRefrigeracion: 'Cumple',
                observacion: '',
                accionCorrectiva: ''
            })
        }
        setErrorMsg('')
        setModalOpen(true)
    }

    const handleSaveRegistro = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.patente.trim()) {
            setErrorMsg('Por favor digite la patente del vehículo.')
            return
        }

        startTransition(async () => {
            const res = await saveRegistroTransporte({
                id: editingRegistro?.id,
                sucursalId: selectedSucursalId,
                fechaTexto,
                ...formData
            })

            if (res.error) {
                setErrorMsg(res.error)
            } else {
                setSuccessMsg(editingRegistro ? 'Inspección de vehículo actualizada.' : 'Vehículo registrado exitosamente.')
                setModalOpen(false)
                loadPlanilla(selectedSucursalId, fechaTexto)
                setTimeout(() => setSuccessMsg(''), 4000)
            }
        })
    }

    const handleDeleteRegistro = (id: string, pat: string) => {
        if (!confirm(`¿Confirmas la eliminación del registro del vehículo ${pat}?`)) return
        startTransition(async () => {
            const res = await deleteRegistroTransporte(id)
            if (res.error) {
                setErrorMsg(res.error)
            } else {
                setSuccessMsg(`Vehículo ${pat} eliminado.`)
                loadPlanilla(selectedSucursalId, fechaTexto)
                setTimeout(() => setSuccessMsg(''), 3000)
            }
        })
    }

    const handleFirmarCalidad = async () => {
        if (!firmaCalidadDataUrl || !firmaCalidadDataUrl.startsWith('data:image/')) {
            setErrorMsg('Debe dibujar su firma con el mouse o lápiz en el recuadro antes de confirmar.')
            return
        }

        startTransition(async () => {
            const res = await firmarCalidadPlanilla(selectedSucursalId, fechaTexto, firmaCalidadDataUrl)
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
            const res = await firmarBodegaPlanilla(selectedSucursalId, fechaTexto, firmaBodegaDataUrl)
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
            const res = await reenviarNotificacionBodega(selectedSucursalId, fechaTexto)
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
            const res = await eliminarPlanillaTransporte(selectedSucursalId, fecha)
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

        const items: TransportePDFItem[] = registros.map(r => ({
            patente: r.patente,
            limpiezaInterior: r.limpiezaInterior,
            limpiezaExterior: r.limpiezaExterior,
            puertaCamara: r.puertaCamara,
            piezasSinOxidacion: r.piezasSinOxidacion,
            equipoCongelacion: r.equipoCongelacion,
            equipoRefrigeracion: r.equipoRefrigeracion,
            observacion: r.observacion,
            accionCorrectiva: r.accionCorrectiva
        }))

        generateTransporteHigienePDF({
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
                            🚚
                        </div>
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-800 border border-cyan-200/60 mb-1">
                                <span>🛡️</span> Áreas \ Calidad
                            </div>
                            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                                Registro transportista interno higiene y estado Transporte
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                                Inspección diaria higiénico-sanitaria y estado operativo de vehículos de transporte interno (R_GL_8_11).
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
                                <span>Nuevo Vehículo</span>
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
                                            <th className="p-3.5 text-center">Vehículos</th>
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
                                                            {p.totalVehiculos} {p.totalVehiculos === 1 ? 'vehículo' : 'vehículos'}
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
                                                                title="Ver inspección de vehículos"
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

                    {/* 2. HISTORIAL DE PLANILLAS ANTERIORES YA CERRADAS */}
                    <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden">
                        <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">
                                <span>📚</span>
                                <span>Historial de Planillas Anteriores Validadas y Cerradas</span>
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Registros históricos completamente firmados y cerrados.
                            </p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100/75 border-b border-slate-200 text-[10.5px] font-black uppercase text-slate-700 tracking-wider">
                                        <th className="p-3.5">Fecha</th>
                                        <th className="p-3.5 text-center">Vehículos</th>
                                        <th className="p-3.5">Encargado de Calidad</th>
                                        <th className="p-3.5">Jefe de Bodega</th>
                                        <th className="p-3.5 text-center">Atraso Firma</th>
                                        <th className="p-3.5 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                                    {historial.filter(h => h.estado === 'CERRADO').length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-slate-400">
                                                No hay registros cerrados en el historial reciente para esta sucursal.
                                            </td>
                                        </tr>
                                    ) : (
                                        historial.filter(h => h.estado === 'CERRADO').map((h) => (
                                            <tr key={h.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="p-3.5 font-bold font-mono text-slate-900">
                                                    {h.fechaTexto.split('-').reverse().join('/')}
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                                                        {h.totalVehiculos}
                                                    </span>
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
                                {p.fechaTexto.split('-').reverse().join('/')} ({p.totalVehiculos} veh.)
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
                            Este registro diario ya ha sido firmado y cerrado. No se pueden ingresar nuevos vehículos ni editar los datos registrados.
                        </span>
                    </div>
                )}
            </div>

            {/* TABLA PRINCIPAL DE REGISTROS DIARIOS */}
            <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                    <div>
                        <h3 className="text-base font-black text-slate-800">
                            Inspección de Vehículos - {sucursalActual}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Fecha: <b>{fechaTexto.split('-').reverse().join('/')}</b> • {registros.length} {registros.length === 1 ? 'vehículo inspeccionado' : 'vehículos inspeccionados'}
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
                            <tr className="bg-slate-100/75 border-b border-slate-200 text-[10.5px] font-black uppercase text-slate-700 tracking-wider text-center">
                                <th className="p-3 text-left w-24">Patente</th>
                                <th className="p-3 w-20">Limp. Interior</th>
                                <th className="p-3 w-20">Limp. Exterior</th>
                                <th className="p-3 w-24">Puertas Cámara</th>
                                <th className="p-3 w-24">Piezas s/Oxid.</th>
                                <th className="p-3 w-24">Eq. Congelado</th>
                                <th className="p-3 w-24">Eq. Refrig.</th>
                                <th className="p-3 text-left min-w-[140px]">Observación</th>
                                <th className="p-3 text-left min-w-[140px]">Acción Correctiva</th>
                                {((!isClosed && canManage) || isAdmin) && <th className="p-3 w-20 text-center">Acción</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                            {registros.length === 0 ? (
                                <tr>
                                    <td colSpan={((!isClosed && canManage) || isAdmin) ? 10 : 9} className="p-10 text-center text-slate-400">
                                        <div className="text-3xl mb-2">🚚</div>
                                        <p className="font-bold text-sm text-slate-600">No hay vehículos registrados para esta fecha y sucursal.</p>
                                        {!isClosed && canManage && fechaTexto === todayStr && (
                                            <button
                                                onClick={() => handleOpenModal()}
                                                className="mt-3 px-4 py-2 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                            >
                                                + Registrar Primer Vehículo
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                registros.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                                        {/* Patente (Desencriptada para usuario) */}
                                        <td className="p-3 font-black text-slate-900 tracking-wider">
                                            <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 font-mono text-xs text-cyan-800">
                                                {r.patente}
                                            </span>
                                        </td>

                                        {/* Limpieza Interior */}
                                        <td className="p-3 text-center">
                                            <BadgeCumple valor={r.limpiezaInterior} />
                                        </td>

                                        {/* Limpieza Exterior */}
                                        <td className="p-3 text-center">
                                            <BadgeCumple valor={r.limpiezaExterior} />
                                        </td>

                                        {/* Puerta de Cámara */}
                                        <td className="p-3 text-center">
                                            <BadgeCumple valor={r.puertaCamara} />
                                        </td>

                                        {/* Piezas sin Oxidación */}
                                        <td className="p-3 text-center">
                                            <BadgeCumple valor={r.piezasSinOxidacion} />
                                        </td>

                                        {/* Equipo de Congelado */}
                                        <td className="p-3 text-center">
                                            <BadgeCumple valor={r.equipoCongelacion} />
                                        </td>

                                        {/* Equipo de Refrigeración */}
                                        <td className="p-3 text-center">
                                            <BadgeCumple valor={r.equipoRefrigeracion} />
                                        </td>

                                        {/* Observación */}
                                        <td className="p-3 text-slate-600 text-xs max-w-xs whitespace-pre-wrap break-words">
                                            {r.observacion || <span className="text-slate-400 italic font-light">—</span>}
                                        </td>

                                        {/* Acción Correctiva */}
                                        <td className="p-3 text-slate-600 text-xs max-w-xs whitespace-pre-wrap break-words">
                                            {r.accionCorrectiva || <span className="text-slate-400 italic font-light">—</span>}
                                        </td>

                                        {/* Acciones */}
                                        {((!isClosed && canManage) || isAdmin) && (
                                            <td className="p-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {!isClosed && canManage && (
                                                        <button
                                                            onClick={() => handleOpenModal(r)}
                                                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                                                            title="Editar registro"
                                                        >
                                                            ✏️
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteRegistro(r.id, r.patente)}
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                                                        title={isAdmin && isClosed ? "Eliminar registro (Permiso de Administrador)" : "Eliminar registro"}
                                                    >
                                                        🗑️
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

            {/* SECCIÓN DE FIRMAS Y CIERRE DEL DÍA CON FIRMAS DIBUJADAS */}
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

            {/* MODAL: REGISTRAR / EDITAR VEHÍCULO */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                            <div>
                                <h3 className="text-lg font-black text-slate-800">
                                    {editingRegistro ? 'Editar Inspección de Vehículo' : 'Registrar Inspección de Vehículo'}
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
                            {/* Patente */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                    Patente del Vehículo *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: FLSX63"
                                    value={formData.patente}
                                    onChange={(e) => setFormData(prev => ({ ...prev, patente: e.target.value.toUpperCase() }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black tracking-wider uppercase text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    🔒 La patente se guardará codificada y encriptada en la base de datos de manera segura.
                                </p>
                            </div>

                            {/* Evaluaciones Higiénicas (Desplegables, Default: Cumple) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Limpieza Interior *
                                    </label>
                                    <select
                                        value={formData.limpiezaInterior}
                                        onChange={(e) => setFormData(prev => ({ ...prev, limpiezaInterior: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        {EVAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Limpieza Exterior *
                                    </label>
                                    <select
                                        value={formData.limpiezaExterior}
                                        onChange={(e) => setFormData(prev => ({ ...prev, limpiezaExterior: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        {EVAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Puerta de cámara en buen estado *
                                    </label>
                                    <select
                                        value={formData.puertaCamara}
                                        onChange={(e) => setFormData(prev => ({ ...prev, puertaCamara: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        {EVAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Piezas sin oxidación *
                                    </label>
                                    <select
                                        value={formData.piezasSinOxidacion}
                                        onChange={(e) => setFormData(prev => ({ ...prev, piezasSinOxidacion: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        {EVAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Equipos de congelación en buen estado *
                                    </label>
                                    <select
                                        value={formData.equipoCongelacion}
                                        onChange={(e) => setFormData(prev => ({ ...prev, equipoCongelacion: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        {EVAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Equipos de refrigeración en buen estado *
                                    </label>
                                    <select
                                        value={formData.equipoRefrigeracion}
                                        onChange={(e) => setFormData(prev => ({ ...prev, equipoRefrigeracion: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        {EVAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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
                                    placeholder="Ingrese cualquier detalle o hallazgo relevante del vehículo..."
                                    value={formData.observacion}
                                    onChange={(e) => setFormData(prev => ({ ...prev, observacion: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                />
                            </div>

                            {/* Acción Correctiva (Texto Largo) */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                    Acción Correctiva (Caja de texto largo)
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Ingrese la medida correctiva aplicada o instruida..."
                                    value={formData.accionCorrectiva}
                                    onChange={(e) => setFormData(prev => ({ ...prev, accionCorrectiva: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                />
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
                                    {isPending ? 'Guardando...' : editingRegistro ? 'Actualizar Vehículo' : 'Guardar Vehículo'}
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
                                Como Jefe de Bodega, al firmar valida el estado higiénico y operativo de los <b>{registros.length} vehículos inspeccionados</b>.
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
                                ¿Eliminar Registros y Planilla?
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
                                    <span className="text-slate-500">Vehículos registrados:</span>
                                    <span className="font-bold text-rose-700">
                                        {fechaEliminarTarget && fechaEliminarTarget !== fechaTexto
                                            ? (historial.find(h => h.fechaTexto === fechaEliminarTarget)?.totalVehiculos || 0)
                                            : registros.length} vehículo(s)
                                    </span>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                                ⚠️ Esta acción eliminará permanentemente todos los vehículos inspeccionados y el registro diario de esta fecha. Es ideal para depurar datos de pruebas o corregir información errónea.
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
