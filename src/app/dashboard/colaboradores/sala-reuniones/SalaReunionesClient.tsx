'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ReservaSalaItem, NoticiaItem, SalaDataResponse, createReserva, cancelReserva, updateReserva, getSalaData, getReservaByToken } from './actions'

interface Props {
    initialData: SalaDataResponse
}

const NOMBRES_DIAS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function toISO(d: Date): string {
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function getMondayISO(d: Date): string {
    const date = new Date(d)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    date.setDate(diff)
    return toISO(date)
}

function addDaysISO(isoStr: string, days: number): string {
    const [y, m, d] = isoStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    date.setDate(date.getDate() + days)
    return toISO(date)
}

export default function SalaReunionesClient({ initialData }: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [inicioSemana, setInicioSemana] = useState<string>(() => {
        return getMondayISO(new Date())
    })

    const [diasSemana, setDiasSemana] = useState<string[]>(initialData.diasSemana)
    const [reservasSemana, setReservasSemana] = useState<ReservaSalaItem[]>(initialData.reservasSemana)
    const [todasReservas, setTodasReservas] = useState<ReservaSalaItem[]>(initialData.todasReservas || initialData.reservasSemana)
    const [resumen, setResumen] = useState(initialData.resumen)
    const [noticias] = useState<NoticiaItem[]>(initialData.noticias)
    const [currentUser, setCurrentUser] = useState(initialData.currentUser)

    // Modo de vista: 'semanal' o 'mensual'
    const [vistaModo, setVistaModo] = useState<'semanal' | 'mensual'>('semanal')
    const [mesActivo, setMesActivo] = useState<{ year: number, month: number }>(() => {
        const d = new Date()
        return { year: d.getFullYear(), month: d.getMonth() }
    })

    // Reloj digital en vivo
    const [horaActual, setHoraActual] = useState('')
    const [fechaHoyLegible, setFechaHoyLegible] = useState('')

    // Modales y estados de formulario
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

    const hoyISO = toISO(new Date())

    // Formulario de creación
    const [form, setForm] = useState({
        solicitante: initialData.currentUser?.name || 'Usuario',
        email: initialData.currentUser?.email || '',
        fecha: hoyISO,
        hora_inicio: '11:00',
        hora_fin: '12:00',
        motivo: ''
    })

    // Función para abrir modal con fecha y horario futuro predeterminado
    const abrirNuevaReserva = (fechaPreseleccionada?: string) => {
        const now = new Date()
        const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
        const fecha = fechaPreseleccionada || hoyISO

        let horaIni = '09:00'
        let horaFin = '10:00'

        if (fecha === hoyISO) {
            let nextHour = now.getHours() + 1
            if (nextHour >= 24) nextHour = 23
            const endHour = Math.min(24, nextHour + 1)
            horaIni = `${pad(nextHour)}:00`
            horaFin = `${pad(endHour === 24 ? 23 : endHour)}:${endHour === 24 ? '59' : '00'}`
        }

        setForm({
            solicitante: currentUser?.name || 'Usuario',
            email: currentUser?.email || '',
            fecha,
            hora_inicio: horaIni,
            hora_fin: horaFin,
            motivo: ''
        })
        setStatusMessage(null)
        setIsModalOpen(true)
    }

    // Actualizar formulario cuando se reciban los datos frescos del usuario
    useEffect(() => {
        if (initialData.currentUser) {
            setCurrentUser(initialData.currentUser)
            setForm(prev => ({
                ...prev,
                solicitante: initialData.currentUser?.name || prev.solicitante,
                email: initialData.currentUser?.email || prev.email
            }))
        }
    }, [initialData.currentUser])

    // Modal de edición / cancelación por token o acción rápida
    const [editingReserva, setEditingReserva] = useState<ReservaSalaItem | null>(null)
    const [cancelingReserva, setCancelingReserva] = useState<ReservaSalaItem | null>(null)
    const [actionToken, setActionToken] = useState<string | null>(null)

    // Actualizar reloj cada segundo
    useEffect(() => {
        const updateClock = () => {
            const now = new Date()
            const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
            setHoraActual(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`)
            setFechaHoyLegible(`${now.getDate()} de ${MESES[now.getMonth()]}`)
        }
        updateClock()
        const interval = setInterval(updateClock, 1000)
        return () => clearInterval(interval)
    }, [])

    // Cargar datos de la semana actual
    const cargarDatosSemana = useCallback(async (semanaISO: string) => {
        try {
            const data = await getSalaData(semanaISO)
            setDiasSemana(data.diasSemana)
            setReservasSemana(data.reservasSemana)
            if (data.todasReservas) {
                setTodasReservas(data.todasReservas)
            }
            setResumen(data.resumen)
            if (data.currentUser) {
                setCurrentUser(data.currentUser)
            }
        } catch (e) {
            console.error('Error refrescando datos de la sala:', e)
        }
    }, [])

    // Polling periódico cada 20s para mantener el estado sincronizado en tiempo real
    useEffect(() => {
        const interval = setInterval(() => {
            cargarDatosSemana(inicioSemana)
        }, 20000)
        return () => clearInterval(interval)
    }, [inicioSemana, cargarDatosSemana])

    // Detectar si el usuario llega por enlace de correo (?action=modificar&token=... o ?action=cancelar&token=...)
    useEffect(() => {
        const action = searchParams.get('action')
        const token = searchParams.get('token')
        if (action && token) {
            setActionToken(token)
            getReservaByToken(token).then(r => {
                if (r) {
                    if (r.estado === 'CANCELADA') {
                        alert(action === 'cancelar' 
                            ? 'Esta reserva ya fue cancelada con anterioridad.' 
                            : 'Esta reserva se encuentra cancelada y no puede ser modificada.')
                        if (typeof window !== 'undefined' && window.location.search) {
                            window.history.replaceState({}, '', window.location.pathname)
                        }
                        return
                    }
                    if (action === 'modificar') setEditingReserva(r)
                    if (action === 'cancelar') setCancelingReserva(r)
                } else {
                    alert('No se encontró la reserva solicitada o el enlace es inválido.')
                    if (typeof window !== 'undefined' && window.location.search) {
                        window.history.replaceState({}, '', window.location.pathname)
                    }
                }
            })
        }
    }, [searchParams])

    // Navegación de semanas
    const handleSemanaAnterior = () => {
        const prev = addDaysISO(inicioSemana, -7)
        setInicioSemana(prev)
        cargarDatosSemana(prev)
    }

    const handleSemanaSiguiente = () => {
        const next = addDaysISO(inicioSemana, 7)
        setInicioSemana(next)
        cargarDatosSemana(next)
    }

    const handleVolverHoy = () => {
        const hoy = getMondayISO(new Date())
        setInicioSemana(hoy)
        cargarDatosSemana(hoy)
    }

    // Navegación mensual
    const handleMesAnterior = () => {
        setMesActivo(prev => {
            if (prev.month === 0) return { year: prev.year - 1, month: 11 }
            return { ...prev, month: prev.month - 1 }
        })
    }

    const handleMesSiguiente = () => {
        setMesActivo(prev => {
            if (prev.month === 11) return { year: prev.year + 1, month: 0 }
            return { ...prev, month: prev.month + 1 }
        })
    }

    const handleMesActual = () => {
        const d = new Date()
        setMesActivo({ year: d.getFullYear(), month: d.getMonth() })
    }

    // Días a pintar en la cuadrícula mensual (incluye relleno de mes anterior y posterior para semanas completas)
    const diasMesGrid = useMemo(() => {
        const { year, month } = mesActivo
        const firstDayOfMonth = new Date(year, month, 1)
        const lastDayOfMonth = new Date(year, month + 1, 0)

        // En JS: 0=Dom, 1=Lun, ..., 6=Sáb. Convertir a Lun=0 ... Dom=6
        let startDayOfWeek = firstDayOfMonth.getDay() - 1
        if (startDayOfWeek === -1) startDayOfWeek = 6

        const days: {
            dateStr: string
            dayNumber: number
            isCurrentMonth: boolean
        }[] = []

        const prevMonthLastDay = new Date(year, month, 0).getDate()
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const d = prevMonthLastDay - i
            const prevDate = new Date(year, month - 1, d)
            const y = prevDate.getFullYear()
            const m = String(prevDate.getMonth() + 1).padStart(2, '0')
            const day = String(d).padStart(2, '0')
            days.push({
                dateStr: `${y}-${m}-${day}`,
                dayNumber: d,
                isCurrentMonth: false
            })
        }

        for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
            const m = String(month + 1).padStart(2, '0')
            const day = String(d).padStart(2, '0')
            days.push({
                dateStr: `${year}-${m}-${day}`,
                dayNumber: d,
                isCurrentMonth: true
            })
        }

        const remaining = 7 - (days.length % 7)
        if (remaining < 7) {
            for (let d = 1; d <= remaining; d++) {
                const nextDate = new Date(year, month + 1, d)
                const y = nextDate.getFullYear()
                const m = String(nextDate.getMonth() + 1).padStart(2, '0')
                const day = String(d).padStart(2, '0')
                days.push({
                    dateStr: `${y}-${m}-${day}`,
                    dayNumber: d,
                    isCurrentMonth: false
                })
            }
        }

        return days
    }, [mesActivo])

    // Formato de rango semanal "07/09 al 13/09"
    const rangoSemanaTexto = useMemo(() => {
        if (!diasSemana || diasSemana.length < 7) return ''
        const fIni = diasSemana[0].split('-')
        const fFin = diasSemana[6].split('-')
        return `${fIni[2]}/${fIni[1]} al ${fFin[2]}/${fFin[1]}`
    }, [diasSemana])

    // Cierre de modales con limpieza de parámetros de URL
    const handleCerrarModalEdicion = () => {
        setEditingReserva(null)
        setActionToken(null)
        if (typeof window !== 'undefined' && window.location.search) {
            window.history.replaceState({}, '', window.location.pathname)
        }
    }

    const handleCerrarModalCancelacion = () => {
        setCancelingReserva(null)
        setActionToken(null)
        if (typeof window !== 'undefined' && window.location.search) {
            window.history.replaceState({}, '', window.location.pathname)
        }
    }

    // Envío de nueva reserva con validación estricta de hora futura y captura de origin del navegador
    const handleSubmitReserva = async (e: React.FormEvent) => {
        e.preventDefault()
        if (isSubmitting) return
        setStatusMessage(null)

        const now = new Date()
        const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
        const hoyStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
        const horaActualStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`

        if (form.fecha < hoyStr) {
            setStatusMessage({
                text: 'No se puede reservar en una fecha pasada. Siempre debes reservar a partir de la fecha y hora actual hacia el futuro.',
                type: 'error'
            })
            return
        }

        if (form.fecha === hoyStr && form.hora_inicio < horaActualStr) {
            setStatusMessage({
                text: `No se puede reservar en una hora anterior a la hora actual (${horaActualStr}). La reserva debe ser de la hora actual hacia el futuro.`,
                type: 'error'
            })
            return
        }

        if (form.hora_fin <= form.hora_inicio) {
            setStatusMessage({
                text: 'La hora de término debe ser posterior a la hora de inicio.',
                type: 'error'
            })
            return
        }

        setIsSubmitting(true)

        const clientOrigin = typeof window !== 'undefined' ? window.location.origin : undefined

        const res = await createReserva({
            solicitante: form.solicitante,
            email: form.email,
            fecha: form.fecha,
            hora_inicio: form.hora_inicio,
            hora_fin: form.hora_fin,
            motivo: form.motivo,
            clientOrigin
        })

        setIsSubmitting(false)

        if (res.status === 'ok') {
            setStatusMessage({ text: res.mensaje, type: 'success' })
            setForm(prev => ({ ...prev, motivo: '' }))
            cargarDatosSemana(inicioSemana)
            setTimeout(() => {
                setIsModalOpen(false)
                setStatusMessage(null)
            }, 2500)
        } else {
            setStatusMessage({ text: res.mensaje, type: 'error' })
        }
    }

    // Confirmación de cancelación (cierra popup de inmediato y limpia URL)
    const handleConfirmCancel = async (id: string, token?: string) => {
        if (isSubmitting) return
        setIsSubmitting(true)
        try {
            const res = await cancelReserva(id, token || actionToken || undefined)
            if (res.status === 'ok') {
                handleCerrarModalCancelacion()
                alert(res.mensaje)
                cargarDatosSemana(inicioSemana)
            } else {
                alert(res.mensaje)
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    // Confirmación de edición con validación de hora futura, cierre inmediato y limpieza de URL
    const handleConfirmUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (isSubmitting || !editingReserva) return

        const now = new Date()
        const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
        const hoyStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
        const horaActualStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`

        if (editingReserva.fecha < hoyStr) {
            alert('No se puede modificar la reserva a una fecha pasada.')
            return
        }

        if (editingReserva.fecha === hoyStr && editingReserva.horaInicio < horaActualStr) {
            alert(`No se puede modificar a una hora anterior a la hora actual (${horaActualStr}).`)
            return
        }

        if (editingReserva.horaFin <= editingReserva.horaInicio) {
            alert('La hora de término debe ser posterior a la hora de inicio.')
            return
        }

        setIsSubmitting(true)

        try {
            const clientOrigin = typeof window !== 'undefined' ? window.location.origin : undefined
            const res = await updateReserva(
                editingReserva.id,
                {
                    fecha: editingReserva.fecha,
                    hora_inicio: editingReserva.horaInicio,
                    hora_fin: editingReserva.horaFin,
                    motivo: editingReserva.motivo
                },
                actionToken || editingReserva.tokenCancelacion,
                clientOrigin
            )

            if (res.status === 'ok') {
                handleCerrarModalEdicion()
                alert(res.mensaje)
                cargarDatosSemana(inicioSemana)
            } else {
                alert(res.mensaje)
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const esAdmin = currentUser?.role?.toLowerCase().includes('admin')

    return (
        <div className="min-h-screen text-slate-800 p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* HEADER CON IDENTIDAD CORPORATIVA HENDAYA */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-cyan-50 border border-cyan-200/80 flex items-center justify-center text-2xl text-cyan-600 shadow-xs">
                            📅
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                                Sala de Reuniones
                            </h1>
                            <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Hendaya · actualización automática
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <button
                            type="button"
                            onClick={() => abrirNuevaReserva()}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-md shadow-cyan-500/25 transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2 cursor-pointer"
                        >
                            <span className="text-lg leading-none font-bold">+</span>
                            <span>Nueva reserva</span>
                        </button>

                        <div className="text-right pl-4 border-l border-gray-200">
                            <div className="text-xl font-mono font-black text-cyan-800 tracking-wider">
                                {horaActual || '--:--:--'}
                            </div>
                            <div className="text-xs text-gray-500 font-medium">
                                {fechaHoyLegible || 'Hoy'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4 TARJETAS DE INDICADORES (KPIs) CON ESTILO CORPORATIVO */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* KPI 1: ESTADO AHORA */}
                    <div className={`rounded-2xl bg-white border border-gray-200/90 border-t-4 p-5 shadow-sm transition-all ${
                        resumen.estado === 'ocupada' ? 'border-t-rose-500' : 'border-t-emerald-500'
                    }`}>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Estado ahora</span>
                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                resumen.estado === 'ocupada'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                                {resumen.estado === 'ocupada' ? 'OCUPADA' : 'LIBRE'}
                            </span>
                        </div>
                        <div className="text-xl font-black text-gray-900 mt-2.5 truncate" title={resumen.estado === 'ocupada' && resumen.actual ? resumen.actual.solicitante : 'Disponible'}>
                            {resumen.estado === 'ocupada' && resumen.actual ? resumen.actual.solicitante : 'Disponible'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 truncate font-medium">
                            {resumen.estado === 'ocupada' && resumen.actual
                                ? `hasta las ${resumen.actual.horaFin}`
                                : 'Puedes reservarla ahora'}
                        </div>
                    </div>

                    {/* KPI 2: RESERVAS HOY */}
                    <div className="rounded-2xl bg-white border border-gray-200/90 border-t-4 border-t-cyan-500 p-5 shadow-sm">
                        <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Reservas hoy</div>
                        <div className="text-2xl font-black text-cyan-700 mt-2.5">
                            {resumen.reservasHoy}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 font-medium">en la sala</div>
                    </div>

                    {/* KPI 3: PROXIMA RESERVA */}
                    <div className="rounded-2xl bg-white border border-gray-200/90 border-t-4 border-t-amber-500 p-5 shadow-sm">
                        <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Próxima reserva</div>
                        {resumen.proximas.length > 0 ? (
                            <div>
                                <div className="text-lg font-bold text-gray-900 mt-2.5 truncate" title={resumen.proximas[0].solicitante}>
                                    {resumen.proximas[0].solicitante}
                                </div>
                                <div className="text-xs text-amber-700 font-semibold mt-1">
                                    {resumen.proximas[0].fecha.split('-')[2]}/{resumen.proximas[0].fecha.split('-')[1]} - {resumen.proximas[0].horaInicio}
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-gray-400 mt-4 font-medium italic">Sin reservas próximas</div>
                        )}
                    </div>

                    {/* KPI 4: OCUPACION SEMANA */}
                    <div className="rounded-2xl bg-white border border-gray-200/90 border-t-4 border-t-sky-500 p-5 shadow-sm">
                        <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Ocupación semana</div>
                        <div className="text-2xl font-black text-sky-700 mt-2.5">
                            {resumen.ocupacionSemana}%
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full mt-2.5 overflow-hidden">
                            <div
                                className="h-full bg-sky-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, resumen.ocupacionSemana)}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* BARRA DE VISTAS (SEMANAL / MENSUAL) Y NAVEGACIÓN */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
                    {/* SELECTOR DE VISTA CON ESTILO HENDAYA */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
                        <button
                            type="button"
                            onClick={() => setVistaModo('semanal')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                vistaModo === 'semanal'
                                    ? 'bg-cyan-600 text-white shadow-xs'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                        >
                            <span>📅</span>
                            <span>Vista Semanal</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setVistaModo('mensual')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                vistaModo === 'mensual'
                                    ? 'bg-cyan-600 text-white shadow-xs'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                        >
                            <span>🗓️</span>
                            <span>Vista Mensual</span>
                        </button>
                    </div>

                    {/* CONTROLES SEGÚN LA VISTA SELECCIONADA */}
                    {vistaModo === 'semanal' ? (
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleSemanaAnterior}
                                className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                                <span>←</span>
                                <span>Anterior</span>
                            </button>

                            <div className="text-sm font-bold text-gray-800 min-w-[140px] text-center">
                                {rangoSemanaTexto}
                            </div>

                            <button
                                type="button"
                                onClick={handleSemanaSiguiente}
                                className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                                <span>Siguiente</span>
                                <span>→</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleVolverHoy}
                                className="text-cyan-600 hover:text-cyan-800 text-xs font-semibold underline underline-offset-2 ml-2 cursor-pointer transition-colors"
                            >
                                Esta semana
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleMesAnterior}
                                className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                                <span>←</span>
                                <span>Mes anterior</span>
                            </button>

                            <div className="text-sm font-bold text-gray-800 min-w-[160px] text-center capitalize">
                                {MESES[mesActivo.month]} {mesActivo.year}
                            </div>

                            <button
                                type="button"
                                onClick={handleMesSiguiente}
                                className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                                <span>Mes siguiente</span>
                                <span>→</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleMesActual}
                                className="text-cyan-600 hover:text-cyan-800 text-xs font-semibold underline underline-offset-2 ml-2 cursor-pointer transition-colors"
                            >
                                Mes actual
                            </button>
                        </div>
                    )}
                </div>

                {/* RENDERIZADO CONDICIONAL DE LA GRILLA: SEMANAL O MENSUAL */}
                {vistaModo === 'semanal' ? (
                    /* GRILLA SEMANAL (7 COLUMNAS) */
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        {diasSemana.map((fechaIso, idx) => {
                            const isHoy = fechaIso === hoyISO
                            const partes = fechaIso.split('-')
                            const diaMesTexto = `${partes[2]}/${partes[1]}`
                            const reservasDelDia = reservasSemana
                                .filter(r => r.fecha === fechaIso)
                                .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))

                            return (
                                <div
                                    key={fechaIso}
                                    className={`bg-white rounded-2xl border p-3.5 min-h-[160px] flex flex-col justify-between transition-all shadow-xs ${
                                        isHoy 
                                            ? 'ring-2 ring-cyan-500 border-cyan-400 bg-cyan-50/20 shadow-md shadow-cyan-500/10' 
                                            : 'border-gray-200'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-gray-100">
                                            <span className={`text-[10px] font-black uppercase tracking-wider ${isHoy ? 'text-cyan-700' : 'text-gray-500'}`}>
                                                {NOMBRES_DIAS[idx]}
                                            </span>
                                            {isHoy && (
                                                <span className="text-[9px] bg-cyan-100 text-cyan-800 font-extrabold px-1.5 py-0.5 rounded-md">
                                                    HOY
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between mb-2.5">
                                            <span className="text-sm font-black text-gray-900">{diaMesTexto}</span>
                                            {fechaIso >= hoyISO && (
                                                <button
                                                    onClick={() => abrirNuevaReserva(fechaIso)}
                                                    title="Reservar en este día"
                                                    className="text-xs font-bold text-cyan-600 hover:text-cyan-800 hover:bg-cyan-50 rounded-md px-1.5 py-0.5 transition-colors cursor-pointer"
                                                >
                                                    + Agendar
                                                </button>
                                            )}
                                        </div>

                                        {/* Listado de reservas en este día */}
                                        <div className="space-y-2">
                                            {reservasDelDia.map(r => {
                                                const canManage = esAdmin || r.userId === currentUser?.id || r.email === currentUser?.email
                                                return (
                                                    <div
                                                        key={r.id}
                                                        className="bg-cyan-50/90 hover:bg-cyan-100/90 border border-cyan-200/90 rounded-xl p-2.5 text-xs transition-colors group relative shadow-xs"
                                                    >
                                                        <div className="flex items-center justify-between font-bold text-cyan-800">
                                                            <span>{r.horaInicio} - {r.horaFin}</span>
                                                            {canManage && (
                                                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-opacity">
                                                                    <button
                                                                        onClick={() => setEditingReserva(r)}
                                                                        title="Modificar"
                                                                        className="text-gray-500 hover:text-cyan-700 cursor-pointer"
                                                                    >
                                                                        ✏️
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setCancelingReserva(r)}
                                                                        title="Cancelar"
                                                                        className="text-rose-500 hover:text-rose-700 cursor-pointer"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-gray-900 font-bold mt-1 truncate" title={r.solicitante}>
                                                            {r.solicitante}
                                                        </div>
                                                        <div className="text-gray-600 text-[11px] truncate mt-0.5 font-medium" title={r.motivo}>
                                                            {r.motivo}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {reservasDelDia.length === 0 && (
                                        <div className="text-xs text-gray-400 font-medium italic mt-2">
                                            Libre
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    /* GRILLA MENSUAL (TODOS LOS DÍAS DEL MES) */
                    <div className="bg-white rounded-3xl border border-gray-200/90 p-4 sm:p-6 shadow-sm">
                        {/* ENCABEZADOS DE DÍAS DE LA SEMANA */}
                        <div className="grid grid-cols-7 gap-2 pb-3 mb-2 border-b border-gray-100 text-center">
                            {NOMBRES_DIAS.map(d => (
                                <div key={d} className="text-[11px] font-black text-gray-500 uppercase tracking-wider">
                                    {d.substring(0, 3)}
                                </div>
                            ))}
                        </div>

                        {/* CUADRÍCULA DE DÍAS DEL MES */}
                        <div className="grid grid-cols-7 gap-2">
                            {diasMesGrid.map((celda, idx) => {
                                const isHoy = celda.dateStr === hoyISO
                                const isFuturo = celda.dateStr >= hoyISO
                                const reservasDelDia = todasReservas
                                    .filter(r => r.fecha === celda.dateStr && r.estado === 'CONFIRMADA')
                                    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))

                                return (
                                    <div
                                        key={`${celda.dateStr}-${idx}`}
                                        className={`rounded-2xl border p-2.5 min-h-[120px] sm:min-h-[140px] flex flex-col justify-between transition-all group ${
                                            !celda.isCurrentMonth
                                                ? 'bg-gray-50/50 border-gray-100 opacity-40'
                                                : isHoy
                                                ? 'bg-cyan-50/30 border-cyan-400 ring-2 ring-cyan-500/50 shadow-xs'
                                                : 'bg-white border-gray-200 hover:border-cyan-300 shadow-2xs'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-1">
                                                    <span className={`text-xs font-black ${
                                                        isHoy 
                                                            ? 'bg-cyan-600 text-white rounded-full w-5 h-5 flex items-center justify-center' 
                                                            : celda.isCurrentMonth 
                                                            ? 'text-gray-900' 
                                                            : 'text-gray-400'
                                                    }`}>
                                                        {celda.dayNumber}
                                                    </span>
                                                    {isHoy && (
                                                        <span className="text-[9px] font-extrabold text-cyan-700 uppercase hidden sm:inline">
                                                            HOY
                                                        </span>
                                                    )}
                                                </div>

                                                {celda.isCurrentMonth && isFuturo && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            abrirNuevaReserva(celda.dateStr)
                                                        }}
                                                        title="Reservar en esta fecha"
                                                        className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 px-1.5 py-0.5 rounded-md transition-opacity cursor-pointer"
                                                    >
                                                        + Agendar
                                                    </button>
                                                )}
                                            </div>

                                            {/* Reservas en este día */}
                                            <div className="space-y-1 mt-1">
                                                {reservasDelDia.slice(0, 3).map(r => {
                                                    const canManage = esAdmin || r.userId === currentUser?.id || r.email === currentUser?.email
                                                    return (
                                                        <div
                                                            key={r.id}
                                                            className="bg-cyan-50/90 border border-cyan-200/80 rounded-lg p-1.5 text-[11px] transition-all hover:bg-cyan-100/90 group/item relative"
                                                            title={`${r.horaInicio} - ${r.horaFin} | ${r.solicitante}: ${r.motivo}`}
                                                        >
                                                            <div className="flex items-center justify-between font-bold text-cyan-900 leading-tight">
                                                                <span>{r.horaInicio}-{r.horaFin}</span>
                                                                {canManage && (
                                                                    <div className="opacity-0 group-hover/item:opacity-100 flex items-center gap-1 transition-opacity">
                                                                        <button
                                                                            onClick={() => setEditingReserva(r)}
                                                                            title="Modificar"
                                                                            className="text-gray-500 hover:text-cyan-700 text-[10px] cursor-pointer"
                                                                        >
                                                                            ✏️
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setCancelingReserva(r)}
                                                                            title="Cancelar"
                                                                            className="text-rose-500 hover:text-rose-700 text-[10px] cursor-pointer"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="text-gray-800 font-semibold truncate leading-tight mt-0.5">
                                                                {r.solicitante}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                                {reservasDelDia.length > 3 && (
                                                    <div className="text-[10px] text-cyan-700 font-bold text-center pt-0.5">
                                                        +{reservasDelDia.length - 3} más
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {celda.isCurrentMonth && reservasDelDia.length === 0 && (
                                            <div className="text-[10px] text-gray-400 font-medium italic mt-2">
                                                {isFuturo ? 'Libre' : ''}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* SECCIÓN INFERIOR (2 COLUMNAS) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
                    {/* COLUMNA IZQUIERDA: PRÓXIMAS RESERVAS */}
                    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                <span>📋</span> Próximas reservas
                            </h3>
                            <span className="text-xs font-bold text-cyan-700 bg-cyan-50 px-2.5 py-0.5 rounded-full border border-cyan-100">
                                {resumen.proximas.length} programadas
                            </span>
                        </div>

                        {resumen.proximas.length === 0 ? (
                            <div className="text-xs text-gray-400 py-8 text-center italic">
                                No hay reservas próximas agendadas.
                            </div>
                        ) : (
                            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                                {resumen.proximas.map(r => {
                                    const canManage = esAdmin || r.userId === currentUser?.id || r.email === currentUser?.email
                                    const fechaPartes = r.fecha.split('-')
                                    const fechaCorta = `${fechaPartes[2]}/${fechaPartes[1]}`

                                    return (
                                        <div
                                            key={r.id}
                                            className="flex items-center justify-between bg-gray-50/80 hover:bg-gray-100/80 border border-gray-200/80 rounded-2xl px-4 py-3 transition-colors shadow-2xs"
                                        >
                                            <div className="min-w-0 flex-1 pr-3">
                                                <div className="text-sm text-gray-900 font-bold truncate">
                                                    {r.solicitante}
                                                </div>
                                                <div className="text-xs text-gray-500 truncate mt-0.5">
                                                    {r.motivo}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 shrink-0">
                                                <div className="text-right">
                                                    <div className="text-xs text-cyan-700 font-bold">
                                                        {fechaCorta}
                                                    </div>
                                                    <div className="text-xs text-gray-600 font-mono font-medium">
                                                        {r.horaInicio} - {r.horaFin}
                                                    </div>
                                                </div>

                                                {canManage && (
                                                    <div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
                                                        <button
                                                            onClick={() => setEditingReserva(r)}
                                                            className="p-1.5 text-gray-500 hover:text-cyan-700 rounded-lg hover:bg-white transition-colors text-xs cursor-pointer shadow-xs border border-transparent hover:border-gray-200"
                                                            title="Modificar reserva"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => setCancelingReserva(r)}
                                                            className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition-colors text-xs cursor-pointer shadow-xs border border-transparent hover:border-rose-200"
                                                            title="Cancelar reserva"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* COLUMNA DERECHA: NOTICIAS DE ALIMENTACIÓN ESCOLAR */}
                    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                <span>📰</span> Noticias: alimentación escolar
                            </h3>
                            <span className="text-[10px] bg-cyan-50 text-cyan-700 font-extrabold px-2.5 py-0.5 rounded-full border border-cyan-100">
                                Sectorial
                            </span>
                        </div>

                        {noticias.length === 0 ? (
                            <div className="text-xs text-gray-400 py-8 text-center italic">
                                Sin noticias por ahora.
                            </div>
                        ) : (
                            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1 divide-y divide-gray-100">
                                {noticias.map((n) => (
                                    <a
                                        key={n.id}
                                        href={n.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block hover:bg-cyan-50/40 rounded-xl px-3 py-2.5 transition-colors group"
                                    >
                                        <div className="text-sm text-gray-800 group-hover:text-cyan-700 leading-snug font-medium transition-colors">
                                            {n.titulo}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                                            <span className="font-semibold text-gray-600">{n.fuente}</span>
                                            <span>·</span>
                                            <span className="text-cyan-600 group-hover:underline">Leer noticia ↗</span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* MODAL 1: NUEVA RESERVA (TOTALMENTE CLARO, NÍTIDO Y CON DATOS REALES) */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
                        <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative border border-gray-100 text-gray-900">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer"
                            >
                                ✕
                            </button>

                            <h2 className="text-xl font-bold text-gray-900 mb-5 tracking-tight flex items-center gap-2">
                                <span>📅</span> Nueva reserva
                            </h2>

                            <form onSubmit={handleSubmitReserva} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1">Nombre</label>
                                    <input
                                        type="text"
                                        value={form.solicitante}
                                        readOnly
                                        disabled
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-100 text-gray-800 font-bold text-sm cursor-not-allowed select-none shadow-xs"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        readOnly
                                        disabled
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-100 text-gray-800 font-bold text-sm cursor-not-allowed select-none shadow-xs font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1">Fecha *</label>
                                    <input
                                        type="date"
                                        required
                                        min={hoyISO}
                                        value={form.fecha}
                                        onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-white text-gray-900 font-medium text-sm shadow-xs"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-700 block mb-1">Hora inicio *</label>
                                        <input
                                            type="time"
                                            required
                                            value={form.hora_inicio}
                                            onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-white text-gray-900 font-medium text-sm shadow-xs font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-700 block mb-1">Hora término *</label>
                                        <input
                                            type="time"
                                            required
                                            value={form.hora_fin}
                                            onChange={(e) => setForm({ ...form, hora_fin: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-white text-gray-900 font-medium text-sm shadow-xs font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1">Motivo *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: Reunión de equipo"
                                        value={form.motivo}
                                        onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-white text-gray-900 font-medium text-sm placeholder-gray-400 shadow-xs"
                                    />
                                </div>

                                {statusMessage && (
                                    <div className={`p-3 rounded-xl text-xs font-semibold ${
                                        statusMessage.type === 'success'
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}>
                                        {statusMessage.text}
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-6 py-2.5 text-sm font-bold rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white shadow-md shadow-cyan-500/25 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                                    >
                                        {isSubmitting ? 'Reservando...' : 'Reservar'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL 2: MODIFICAR RESERVA */}
                {editingReserva && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
                        <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative border border-gray-100 text-gray-900">
                            <button
                                type="button"
                                onClick={handleCerrarModalEdicion}
                                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer"
                            >
                                ✕
                            </button>

                            <h2 className="text-xl font-bold text-gray-900 mb-4 tracking-tight flex items-center gap-2">
                                <span>✏️</span> Modificar Reserva
                            </h2>

                            <form onSubmit={handleConfirmUpdate} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1">Solicitante</label>
                                    <input
                                        type="text"
                                        value={editingReserva.solicitante}
                                        disabled
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-100 text-gray-800 font-bold text-sm cursor-not-allowed"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1">Nueva Fecha</label>
                                    <input
                                        type="date"
                                        required
                                        min={hoyISO}
                                        value={editingReserva.fecha}
                                        onChange={(e) => setEditingReserva({ ...editingReserva, fecha: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-gray-900 font-medium text-sm"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-700 block mb-1">Hora inicio</label>
                                        <input
                                            type="time"
                                            required
                                            value={editingReserva.horaInicio}
                                            onChange={(e) => setEditingReserva({ ...editingReserva, horaInicio: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-gray-900 font-medium text-sm font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-700 block mb-1">Hora término</label>
                                        <input
                                            type="time"
                                            required
                                            value={editingReserva.horaFin}
                                            onChange={(e) => setEditingReserva({ ...editingReserva, horaFin: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-gray-900 font-medium text-sm font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1">Motivo</label>
                                    <input
                                        type="text"
                                        required
                                        value={editingReserva.motivo}
                                        onChange={(e) => setEditingReserva({ ...editingReserva, motivo: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-gray-900 font-medium text-sm"
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-3">
                                    <button
                                        type="button"
                                        disabled={isSubmitting}
                                        onClick={handleCerrarModalEdicion}
                                        className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-600 disabled:opacity-50 cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-6 py-2.5 text-sm font-bold rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white shadow-md shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL 3: CANCELAR RESERVA */}
                {cancelingReserva && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
                        <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl relative border border-gray-100 text-gray-900">
                            <button
                                type="button"
                                onClick={handleCerrarModalCancelacion}
                                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer"
                            >
                                ✕
                            </button>
                            <h2 className="text-xl font-bold text-gray-900 mb-2 tracking-tight flex items-center gap-2">
                                <span>⚠️</span> Confirmar Cancelación
                            </h2>
                            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                                ¿Estás seguro que deseas cancelar la reserva de <b>{cancelingReserva.solicitante}</b> para el <b>{cancelingReserva.fecha}</b> de <b>{cancelingReserva.horaInicio} a {cancelingReserva.horaFin}</b>?
                            </p>
                            <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-700 mb-5 border border-gray-200">
                                <b>Motivo:</b> {cancelingReserva.motivo}
                            </div>
                            <div className="flex justify-end gap-2.5">
                                <button
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={handleCerrarModalCancelacion}
                                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-600 disabled:opacity-50 cursor-pointer"
                                >
                                    No, mantener
                                </button>
                                <button
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={() => handleConfirmCancel(cancelingReserva.id, cancelingReserva.tokenCancelacion)}
                                    className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {isSubmitting ? 'Cancelando...' : 'Sí, cancelar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}
