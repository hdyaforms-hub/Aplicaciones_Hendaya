'use client'

import React, { useState, useTransition, useMemo } from 'react'
import FirmaCanvas from './FirmaCanvas'
import {
    crearRegistroCapacitacion,
    actualizarRegistroCapacitacion,
    marcarPDFDescargado,
    getRegistrosCapacitacion,
    getRegistroCapacitacionById,
    eliminarRegistroCapacitacion,
    registrarAuditoriaDescarga,
    RegistroCapacitacionView,
    ParticipanteInput,
    CapacitacionMetadata
} from './actions'
import { generateRegistroCapacitacionPDF } from './generateRegistroCapacitacionPDF'

interface RegistroCapacitacionClientProps {
    initialRegistros: RegistroCapacitacionView[]
    metadata?: CapacitacionMetadata
    canManage: boolean
    isAdmin?: boolean
    currentUserName: string
}

// Formateador estándar de RUT Chileno
function formatRut(rawRut: string): string {
    const clean = rawRut.replace(/[^0-9kK]/g, '').toUpperCase()
    if (!clean) return ''
    if (clean.length === 1) return clean

    const body = clean.slice(0, -1)
    const dv = clean.slice(-1)
    const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return `${formattedBody}-${dv}`
}

function formatDate(dateVal: string | Date): string {
    if (!dateVal) return ''
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return String(dateVal)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
}

export default function RegistroCapacitacionClient({
    initialRegistros,
    metadata,
    canManage,
    isAdmin = false,
    currentUserName
}: RegistroCapacitacionClientProps) {
    const [tab, setTab] = useState<'nuevo' | 'historial'>(canManage ? 'nuevo' : 'historial')
    const [registros, setRegistros] = useState<RegistroCapacitacionView[]>(initialRegistros)
    const [isPending, startTransition] = useTransition()
    const [searchTerm, setSearchTerm] = useState('')

    // Filtros del historial
    const [filtroLicitacion, setFiltroLicitacion] = useState('')
    const [filtroSucursal, setFiltroSucursal] = useState('')

    // Estado del formulario de nuevo registro
    const [selectedLicitacion, setSelectedLicitacion] = useState('')
    const [selectedSucursal, setSelectedSucursal] = useState('')
    const [instalacion, setInstalacion] = useState('')
    const [horaDesde, setHoraDesde] = useState('09:00')
    const [horaHasta, setHoraHasta] = useState('10:30')
    const [relatorNombre, setRelatorNombre] = useState('')
    const [relatorCargo, setRelatorCargo] = useState('')
    const [tema, setTema] = useState('')
    const [firmaRelator, setFirmaRelator] = useState('')

    // Lista de participantes (1 a N)
    const [participantes, setParticipantes] = useState<ParticipanteInput[]>([
        { nombre: '', cargo: '', rut: '', firma: '' }
    ])

    // Modal de firma para participante individual
    const [modalFirmaIndex, setModalFirmaIndex] = useState<number | null>(null)
    const [tempFirmaModal, setTempFirmaModal] = useState<string>('')

    // Modal de visualización de detalle
    const [detalleSeleccionado, setDetalleSeleccionado] = useState<RegistroCapacitacionView | null>(null)
    const [isLoadingDetalle, setIsLoadingDetalle] = useState(false)

    // Estados para el Modal de Edición de Registros
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [idEditando, setIdEditando] = useState<string | null>(null)
    const [editLicitacion, setEditLicitacion] = useState('')
    const [editSucursal, setEditSucursal] = useState('')
    const [editInstalacion, setEditInstalacion] = useState('')
    const [editHoraDesde, setEditHoraDesde] = useState('09:00')
    const [editHoraHasta, setEditHoraHasta] = useState('10:30')
    const [editRelatorNombre, setEditRelatorNombre] = useState('')
    const [editRelatorCargo, setEditRelatorCargo] = useState('')
    const [editTema, setEditTema] = useState('')
    const [editFirmaRelator, setEditFirmaRelator] = useState('')
    const [editParticipantes, setEditParticipantes] = useState<ParticipanteInput[]>([
        { nombre: '', cargo: '', rut: '', firma: '' }
    ])
    const [editModalFirmaIndex, setEditModalFirmaIndex] = useState<number | null>(null)
    const [editTempFirmaModal, setEditTempFirmaModal] = useState<string>('')
    const [editAccionGuardar, setEditAccionGuardar] = useState<'guardar' | 'guardar_y_descargar'>('guardar')

    // Notificaciones y mensajes
    const [alerta, setAlerta] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
    const [accionGuardar, setAccionGuardar] = useState<'guardar' | 'guardar_y_descargar'>('guardar')

    const fechaHoyTexto = formatDate(new Date())

    // Helper reutilizable para filtrar sucursales por licitación (incorporando siempre CASA MATRIZ)
    const getSucursalesPorLicitacion = (licVal: string) => {
        if (!metadata?.sucursales) return []
        if (!licVal) return metadata.sucursales

        const licNum = parseInt(licVal, 10)
        const sucIdsAsociadas = new Set(
            (metadata.uts || [])
                .filter(u => u.licId === licNum && u.sucursalId)
                .map(u => u.sucursalId as string)
        )

        return metadata.sucursales.filter(s => {
            const esCasaMatriz = s.nombre.toUpperCase().includes('MATRIZ')
            return esCasaMatriz || sucIdsAsociadas.has(s.id)
        })
    }

    // Sucursales disponibles para Formulario Nuevo
    const sucursalesFiltradas = useMemo(() => getSucursalesPorLicitacion(selectedLicitacion), [selectedLicitacion, metadata])

    // Sucursales disponibles para Formulario de Edición
    const editSucursalesFiltradas = useMemo(() => getSucursalesPorLicitacion(editLicitacion), [editLicitacion, metadata])

    // Manejador de cambio de Licitación
    const handleLicitacionChange = (licVal: string) => {
        setSelectedLicitacion(licVal)
        if (selectedSucursal && selectedSucursal !== 'Todos') {
            const licNum = parseInt(licVal, 10)
            const validSucIds = new Set(
                (metadata?.uts || []).filter(u => u.licId === licNum && u.sucursalId).map(u => u.sucursalId)
            )
            const sucObj = metadata?.sucursales.find(s => s.nombre === selectedSucursal)
            const esCasaMatriz = sucObj?.nombre.toUpperCase().includes('MATRIZ') || selectedSucursal.toUpperCase().includes('MATRIZ')
            if (sucObj && !esCasaMatriz && !validSucIds.has(sucObj.id)) {
                setSelectedSucursal('')
            }
        }
        // Auto-sugerencia si instalación está vacía
        if (!instalacion && licVal) {
            setInstalacion(`Licitación ${licVal}`)
        }
    }

    // Manejador de cambio de Sucursal (con opción "Todos")
    const handleSucursalChange = (sucVal: string) => {
        setSelectedSucursal(sucVal)
        if (sucVal === 'Todos') {
            setInstalacion(
                selectedLicitacion
                    ? `Licitación ${selectedLicitacion} - Todos`
                    : 'Todos'
            )
        } else if (sucVal) {
            setInstalacion(
                selectedLicitacion
                    ? `Licitación ${selectedLicitacion} - ${sucVal}`
                    : sucVal
            )
        }
    }

    // Manejo de participantes dinámicos
    const agregarParticipante = () => {
        setParticipantes(prev => [...prev, { nombre: '', cargo: '', rut: '', firma: '' }])
    }

    const eliminarParticipante = (index: number) => {
        if (participantes.length <= 1) {
            setAlerta({ tipo: 'error', texto: 'Debe haber al menos un participante registrado.' })
            return
        }
        setParticipantes(prev => prev.filter((_, i) => i !== index))
    }

    const actualizarParticipante = (index: number, campo: keyof ParticipanteInput, valor: string) => {
        setParticipantes(prev => {
            const copia = [...prev]
            if (campo === 'rut') {
                copia[index] = { ...copia[index], [campo]: formatRut(valor) }
            } else {
                copia[index] = { ...copia[index], [campo]: valor }
            }
            return copia
        })
    }

    // Guardar nuevo registro
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setAlerta(null)

        // Validaciones previas
        if (!instalacion.trim()) {
            setAlerta({ tipo: 'error', texto: 'Por favor, ingrese el nombre o glosa de la instalación.' })
            return
        }
        if (!relatorNombre.trim() || !relatorCargo.trim()) {
            setAlerta({ tipo: 'error', texto: 'Debe ingresar el nombre y cargo del relator.' })
            return
        }
        if (!tema.trim()) {
            setAlerta({ tipo: 'error', texto: 'Debe detallar el tema de la capacitación.' })
            return
        }

        // Validar que cada participante tenga datos válidos
        for (let i = 0; i < participantes.length; i++) {
            const p = participantes[i]
            if (!p.nombre.trim()) {
                setAlerta({ tipo: 'error', texto: `El participante #${i + 1} no tiene nombre ingresado.` })
                return
            }
            if (!p.cargo.trim()) {
                setAlerta({ tipo: 'error', texto: `El participante #${i + 1} (${p.nombre}) no tiene cargo ingresado.` })
                return
            }
            if (!p.rut.trim()) {
                setAlerta({ tipo: 'error', texto: `El participante #${i + 1} (${p.nombre}) no tiene RUT ingresado.` })
                return
            }
        }

        const debeDescargarPDF = accionGuardar === 'guardar_y_descargar'

        startTransition(async () => {
            const res = await crearRegistroCapacitacion({
                instalacion,
                licitacion: selectedLicitacion || null,
                sucursal: selectedSucursal || null,
                horaDesde,
                horaHasta,
                relatorNombre,
                relatorCargo,
                tema,
                firmaRelator,
                participantes
            })

            if (!res.success || !res.id) {
                setAlerta({ tipo: 'error', texto: res.error || 'Error al guardar el registro de capacitación.' })
                return
            }

            // Descargar el PDF oficial solo si se pulsó "Guardar y Descargar PDF"
            if (debeDescargarPDF) {
                const nuevoRegistroPDF = {
                    fecha: new Date(),
                    instalacion,
                    licitacion: selectedLicitacion || null,
                    sucursal: selectedSucursal || null,
                    horario: `${horaDesde} a ${horaHasta}`,
                    relatorNombre,
                    relatorCargo,
                    tema,
                    firmaRelator,
                    participantes: participantes.map((p, idx) => ({
                        numero: idx + 1,
                        nombre: p.nombre,
                        cargo: p.cargo,
                        rut: p.rut,
                        firma: p.firma
                    }))
                }

                try {
                    generateRegistroCapacitacionPDF(nuevoRegistroPDF)
                    await registrarAuditoriaDescarga(res.id, tema)
                } catch (pdfErr) {
                    console.error('Error generando PDF tras guardar:', pdfErr)
                }
            }

            setAlerta({
                tipo: 'success',
                texto: debeDescargarPDF
                    ? '¡Registro de capacitación guardado con éxito! El documento oficial en PDF (R PE 7 06) ha sido generado y descargado.'
                    : '¡Registro de capacitación guardado con éxito! Puedes consultar o descargar su PDF oficial en cualquier momento desde el historial.'
            })

            // Limpiar formulario
            setSelectedLicitacion('')
            setSelectedSucursal('')
            setInstalacion('')
            setTema('')
            setFirmaRelator('')
            setParticipantes([{ nombre: '', cargo: '', rut: '', firma: '' }])

            // Refrescar listado
            const actualizados = await getRegistrosCapacitacion()
            if (actualizados.success && actualizados.data) {
                setRegistros(actualizados.data)
            }
        })
    }

    // Descargar PDF desde el historial (y bloquear registro permanentemente)
    const handleDescargarPDF = async (item: RegistroCapacitacionView) => {
        setIsLoadingDetalle(true)
        try {
            const detalleRes = await getRegistroCapacitacionById(item.id)
            if (!detalleRes.success || !detalleRes.data) {
                alert(detalleRes.error || 'No se pudo obtener el detalle del registro.')
                return
            }

            const reg = detalleRes.data
            generateRegistroCapacitacionPDF({
                fecha: reg.fecha,
                instalacion: reg.instalacion,
                licitacion: reg.licitacion,
                sucursal: reg.sucursal,
                horario: reg.horario,
                relatorNombre: reg.relatorNombre,
                relatorCargo: reg.relatorCargo,
                tema: reg.tema,
                firmaRelator: reg.firmaRelator,
                participantes: (reg.participantes || []).map(p => ({
                    numero: p.numero,
                    nombre: p.nombre,
                    cargo: p.cargo,
                    rut: p.rut,
                    firma: p.firma
                }))
            })

            // Marcar registro como bloqueado y registrar auditoría
            await marcarPDFDescargado(reg.id, reg.tema)

            // Actualizar estado local reactivo
            setRegistros(prev =>
                prev.map(r => r.id === reg.id ? { ...r, pdfGenerado: true, pdfGeneradoAt: new Date() } : r)
            )
            if (detalleSeleccionado?.id === reg.id) {
                setDetalleSeleccionado(prev => prev ? { ...prev, pdfGenerado: true, pdfGeneradoAt: new Date() } : null)
            }

            setAlerta({
                tipo: 'success',
                texto: `PDF oficial del registro "${reg.instalacion}" generado con éxito. Por normativa, el registro ha quedado bloqueado para modificaciones.`
            })
        } catch (error) {
            console.error('Error al generar PDF:', error)
            alert('Ocurrió un error al preparar el PDF.')
        } finally {
            setIsLoadingDetalle(false)
        }
    }

    // Iniciar edición de un registro no bloqueado
    const handleIniciarEdicion = async (id: string) => {
        setIsLoadingDetalle(true)
        try {
            const res = await getRegistroCapacitacionById(id)
            if (!res.success || !res.data) {
                setAlerta({ tipo: 'error', texto: res.error || 'No se pudo cargar el registro para editar.' })
                return
            }

            const reg = res.data
            if (reg.pdfGenerado) {
                setAlerta({
                    tipo: 'error',
                    texto: 'Este registro ya cuenta con su documento oficial en PDF (R PE 7 06) emitido. Por normativa no puede ser modificado.'
                })
                return
            }

            setIdEditando(reg.id)
            setEditInstalacion(reg.instalacion)
            setEditLicitacion(reg.licitacion || '')
            setEditSucursal(reg.sucursal || '')
            setEditHoraDesde(reg.horaDesde || '09:00')
            setEditHoraHasta(reg.horaHasta || '10:30')
            setEditRelatorNombre(reg.relatorNombre)
            setEditRelatorCargo(reg.relatorCargo)
            setEditTema(reg.tema)
            setEditFirmaRelator(reg.firmaRelator || '')
            setEditParticipantes(
                (reg.participantes && reg.participantes.length > 0)
                    ? reg.participantes.map(p => ({
                        nombre: p.nombre,
                        cargo: p.cargo,
                        rut: p.rut,
                        firma: p.firma || ''
                    }))
                    : [{ nombre: '', cargo: '', rut: '', firma: '' }]
            )
            setIsEditModalOpen(true)
        } catch (err) {
            console.error('Error al abrir edición:', err)
            setAlerta({ tipo: 'error', texto: 'Error al preparar la edición del registro.' })
        } finally {
            setIsLoadingDetalle(false)
        }
    }

    // Manejadores de Licitación y Sucursal en Modal de Edición
    const handleEditLicitacionChange = (licVal: string) => {
        setEditLicitacion(licVal)
        if (editSucursal && editSucursal !== 'Todos') {
            const licNum = parseInt(licVal, 10)
            const validSucIds = new Set(
                (metadata?.uts || []).filter(u => u.licId === licNum && u.sucursalId).map(u => u.sucursalId)
            )
            const sucObj = metadata?.sucursales.find(s => s.nombre === editSucursal)
            const esCasaMatriz = sucObj?.nombre.toUpperCase().includes('MATRIZ') || editSucursal.toUpperCase().includes('MATRIZ')
            if (sucObj && !esCasaMatriz && !validSucIds.has(sucObj.id)) {
                setEditSucursal('')
            }
        }
        if (!editInstalacion && licVal) {
            setEditInstalacion(`Licitación ${licVal}`)
        }
    }

    const handleEditSucursalChange = (sucVal: string) => {
        setEditSucursal(sucVal)
        if (sucVal === 'Todos') {
            setEditInstalacion(
                editLicitacion ? `Licitación ${editLicitacion} - Todos` : 'Todos'
            )
        } else if (sucVal) {
            setEditInstalacion(
                editLicitacion ? `Licitación ${editLicitacion} - ${sucVal}` : sucVal
            )
        }
    }

    // Participantes en Modal de Edición
    const agregarParticipanteEdit = () => {
        setEditParticipantes(prev => [...prev, { nombre: '', cargo: '', rut: '', firma: '' }])
    }

    const removerParticipanteEdit = (idx: number) => {
        if (editParticipantes.length <= 1) {
            setAlerta({ tipo: 'error', texto: 'El registro debe tener al menos un participante.' })
            return
        }
        setEditParticipantes(prev => prev.filter((_, i) => i !== idx))
    }

    const actualizarParticipanteEdit = (idx: number, campo: keyof ParticipanteInput, valor: string) => {
        setEditParticipantes(prev => {
            const copia = [...prev]
            if (campo === 'rut') {
                copia[idx] = { ...copia[idx], [campo]: formatRut(valor) }
            } else {
                copia[idx] = { ...copia[idx], [campo]: valor }
            }
            return copia
        })
    }

    // Guardar cambios del registro editado
    const handleGuardarEdicion = (e: React.FormEvent) => {
        e.preventDefault()
        if (!idEditando) return

        if (!editInstalacion.trim()) {
            setAlerta({ tipo: 'error', texto: 'Debes especificar una instalación o sede.' })
            return
        }
        if (!editHoraDesde || !editHoraHasta) {
            setAlerta({ tipo: 'error', texto: 'Debes especificar el horario completo.' })
            return
        }
        if (!editRelatorNombre.trim()) {
            setAlerta({ tipo: 'error', texto: 'Debes ingresar el nombre del relator.' })
            return
        }
        if (!editTema.trim()) {
            setAlerta({ tipo: 'error', texto: 'Debes ingresar el tema de la capacitación.' })
            return
        }
        if (editParticipantes.length === 0) {
            setAlerta({ tipo: 'error', texto: 'Debes agregar al menos un participante.' })
            return
        }

        for (let i = 0; i < editParticipantes.length; i++) {
            const p = editParticipantes[i]
            if (!p.nombre.trim()) {
                setAlerta({ tipo: 'error', texto: `El participante #${i + 1} no tiene nombre ingresado.` })
                return
            }
            if (!p.rut.trim()) {
                setAlerta({ tipo: 'error', texto: `El participante #${i + 1} (${p.nombre}) no tiene RUT ingresado.` })
                return
            }
        }

        const debeDescargarPDF = editAccionGuardar === 'guardar_y_descargar'

        startTransition(async () => {
            const res = await actualizarRegistroCapacitacion({
                id: idEditando,
                instalacion: editInstalacion,
                licitacion: editLicitacion || null,
                sucursal: editSucursal || null,
                horaDesde: editHoraDesde,
                horaHasta: editHoraHasta,
                relatorNombre: editRelatorNombre,
                relatorCargo: editRelatorCargo,
                tema: editTema,
                firmaRelator: editFirmaRelator || null,
                participantes: editParticipantes,
                descargarPDF: debeDescargarPDF
            })

            if (!res.success) {
                setAlerta({ tipo: 'error', texto: res.error || 'Error al actualizar el registro de capacitación.' })
                return
            }

            if (debeDescargarPDF) {
                const registroPDF = {
                    fecha: new Date(),
                    instalacion: editInstalacion,
                    licitacion: editLicitacion || null,
                    sucursal: editSucursal || null,
                    horario: `${editHoraDesde} a ${editHoraHasta}`,
                    relatorNombre: editRelatorNombre,
                    relatorCargo: editRelatorCargo,
                    tema: editTema,
                    firmaRelator: editFirmaRelator || null,
                    participantes: editParticipantes.map((p, idx) => ({
                        numero: idx + 1,
                        nombre: p.nombre,
                        cargo: p.cargo,
                        rut: p.rut,
                        firma: p.firma
                    }))
                }

                try {
                    generateRegistroCapacitacionPDF(registroPDF)
                } catch (pdfErr) {
                    console.error('Error generando PDF tras actualizar:', pdfErr)
                }
            }

            setAlerta({
                tipo: 'success',
                texto: debeDescargarPDF
                    ? '¡Registro actualizado y PDF oficial emitido con éxito! El registro ha quedado bloqueado permanentemente.'
                    : '¡Registro de capacitación actualizado con éxito! Puedes seguir editándolo hasta que generes su PDF oficial.'
            })

            setIsEditModalOpen(false)
            setIdEditando(null)

            // Refrescar lista de registros
            const actualizados = await getRegistrosCapacitacion()
            if (actualizados.success && actualizados.data) {
                setRegistros(actualizados.data)
            }
        })
    }

    // Ver detalle en modal
    const handleVerDetalle = async (id: string) => {
        setIsLoadingDetalle(true)
        try {
            const res = await getRegistroCapacitacionById(id)
            if (res.success && res.data) {
                setDetalleSeleccionado(res.data)
            } else {
                alert(res.error || 'No se pudo cargar el registro.')
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsLoadingDetalle(false)
        }
    }

    // Eliminar registro
    const handleEliminar = async (id: string, inst: string) => {
        if (!confirm(`¿Está seguro de eliminar el registro de capacitación de "${inst}"? Esta acción no se puede deshacer.`)) {
            return
        }

        startTransition(async () => {
            const res = await eliminarRegistroCapacitacion(id)
            if (res.success) {
                setRegistros(prev => prev.filter(r => r.id !== id))
                if (detalleSeleccionado?.id === id) {
                    setDetalleSeleccionado(null)
                }
                setAlerta({ tipo: 'success', texto: 'Registro eliminado correctamente.' })
            } else {
                setAlerta({ tipo: 'error', texto: res.error || 'No se pudo eliminar el registro.' })
            }
        })
    }

    const registrosFiltrados = useMemo(() => {
        return registros.filter(r => {
            const q = searchTerm.toLowerCase().trim()
            const matchSearch = !q || (
                r.instalacion.toLowerCase().includes(q) ||
                r.relatorNombre.toLowerCase().includes(q) ||
                r.tema.toLowerCase().includes(q) ||
                (r.licitacion && r.licitacion.toLowerCase().includes(q)) ||
                (r.sucursal && r.sucursal.toLowerCase().includes(q))
            )

            const matchLic = !filtroLicitacion || r.licitacion === filtroLicitacion
            const matchSuc = !filtroSucursal || r.sucursal === filtroSucursal

            return matchSearch && matchLic && matchSuc
        })
    }, [registros, searchTerm, filtroLicitacion, filtroSucursal])

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
            {/* Header del Módulo */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 rounded-2xl p-6 shadow-xl border border-cyan-500/20 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-cyan-500/20 rounded-xl border border-cyan-400/30 text-cyan-300 text-2xl">
                            🎓
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black tracking-tight text-white">
                                    Registro de Capacitación
                                </h1>
                                <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                                    R PE 7 06
                                </span>
                            </div>
                            <p className="text-slate-300 text-xs mt-1">
                                Formulario oficial de registro de capacitaciones con firmas digitales y cifrado seguro.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Selector de pestañas */}
                <div className="flex bg-slate-950/60 p-1.5 rounded-xl border border-slate-700/60 self-stretch sm:self-auto">
                    {canManage && (
                        <button
                            type="button"
                            onClick={() => setTab('nuevo')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                tab === 'nuevo'
                                    ? 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <span>📝</span> Nuevo Registro
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setTab('historial')}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            tab === 'historial'
                                ? 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <span>📋</span> Historial ({registros.length})
                    </button>
                </div>
            </div>

            {/* Mensajes y Alertas */}
            {alerta && (
                <div
                    className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between shadow-md transition-all ${
                        alerta.tipo === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border border-rose-300'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <span>{alerta.tipo === 'success' ? '✅' : '⚠️'}</span>
                        <span>{alerta.texto}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAlerta(null)}
                        className="text-slate-400 hover:text-slate-600 font-bold ml-4"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* PESTAÑA 1: NUEVO REGISTRO */}
            {tab === 'nuevo' && canManage && (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Tarjeta de Encabezado Oficial */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 text-base">
                                    1. Datos Generales de la Capacitación
                                </span>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-semibold">
                                <span>🔒 Fecha Sistema:</span>
                                <span className="text-cyan-700 font-bold">{fechaHoyTexto}</span>
                                <span className="text-[10px] text-slate-400">(Inmutable)</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            {/* Criterio 1: Licitación */}
                            <div className="md:col-span-4 space-y-1">
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                                    <span>🏢 Licitación <span className="text-rose-500">*</span></span>
                                    {selectedLicitacion && (
                                        <span className="text-[10px] text-cyan-600 font-bold">Lic. {selectedLicitacion}</span>
                                    )}
                                </label>
                                <select
                                    required
                                    value={selectedLicitacion}
                                    onChange={e => handleLicitacionChange(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 text-xs font-semibold text-slate-800 bg-slate-50/50"
                                >
                                    <option value="">-- Seleccionar Licitación --</option>
                                    {(metadata?.licitaciones || []).map(l => (
                                        <option key={l.licId} value={String(l.licId)}>
                                            Licitación {l.licId} {l.licitacionHomologada ? `(ID ${l.licitacionHomologada})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Criterio 2: Sucursal (con opción "Todos") */}
                            <div className="md:col-span-4 space-y-1">
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    📍 Sucursal <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    required
                                    value={selectedSucursal}
                                    onChange={e => handleSucursalChange(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 text-xs font-semibold text-slate-800 bg-slate-50/50"
                                >
                                    <option value="">-- Seleccionar Sucursal --</option>
                                    <option value="Todos" className="font-semibold text-amber-800">
                                        Todos
                                    </option>
                                    {sucursalesFiltradas.map(s => (
                                        <option key={s.id} value={s.nombre}>
                                            {s.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Horario Desde y Hasta */}
                            <div className="md:col-span-4 space-y-1">
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    ⏰ Horario <span className="text-rose-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-[10px] text-slate-500 block mb-0.5">Desde</span>
                                        <input
                                            type="time"
                                            required
                                            value={horaDesde}
                                            onChange={e => setHoraDesde(e.target.value)}
                                            className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 bg-slate-50/50"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-500 block mb-0.5">Hasta</span>
                                        <input
                                            type="time"
                                            required
                                            value={horaHasta}
                                            onChange={e => setHoraHasta(e.target.value)}
                                            className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 bg-slate-50/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Instalación / Sede (auto-sugerida y editable) */}
                            <div className="md:col-span-12 space-y-1 pt-1">
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Instalación / Sede / Lugar <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={instalacion}
                                    onChange={e => setInstalacion(e.target.value)}
                                    placeholder="Ej: CD METRO / Planta Central / Casino / Todos"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 text-sm font-medium text-slate-800 bg-slate-50/50"
                                />
                            </div>
                        </div>

                        {/* Relator y Cargo + Firma Relator */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2 border-t border-slate-100">
                            <div className="md:col-span-7 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            Nombre del Relator <span className="text-rose-500">*</span>
                                            <span className="text-[10px] text-cyan-600 lowercase ml-1 font-normal">(cifrado en BD)</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={relatorNombre}
                                            onChange={e => setRelatorNombre(e.target.value)}
                                            placeholder="Nombre completo del instructor"
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 text-sm font-medium text-slate-800"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            Cargo del Relator <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={relatorCargo}
                                            onChange={e => setRelatorCargo(e.target.value)}
                                            placeholder="Ej: Prevencionista de Riesgos / Jefe Calidad"
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 text-sm font-medium text-slate-800"
                                        />
                                    </div>
                                </div>

                                {/* Tema de Capacitación */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        Tema de Capacitación <span className="text-rose-500">*</span>
                                        <span className="text-[10px] text-slate-400 lowercase ml-1 font-normal">(glosa multilínea)</span>
                                    </label>
                                    <textarea
                                        required
                                        rows={4}
                                        value={tema}
                                        onChange={e => setTema(e.target.value)}
                                        placeholder="Detalla los contenidos abordados en la sesión (ej: Buenas prácticas de manufactura, manipulación higiénica de alimentos, uso de EPP, etc.)..."
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 text-sm text-slate-800 resize-y"
                                    />
                                </div>
                            </div>

                            {/* Firma del Relator */}
                            <div className="md:col-span-5 bg-slate-50/70 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                                <FirmaCanvas
                                    value={firmaRelator}
                                    onChange={setFirmaRelator}
                                    height={135}
                                    label="Firma del Relator"
                                    placeholder="Dibuja la firma del relator aquí"
                                />
                                <span className="text-[11px] text-slate-500 mt-2 block text-center">
                                    Esta firma se incrustará al pie del documento oficial R PE 7 06.
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Tarjeta de Participantes (1 a N) */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-3">
                            <div>
                                <h2 className="font-bold text-slate-800 text-base">
                                    2. Nómina de Participantes
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Los nombres y RUTs se almacenan cifrados con AES-256-GCM.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={agregarParticipante}
                                className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                            >
                                <span>➕</span> Agregar Participante
                            </button>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="py-3 px-3 text-center w-12">Nº</th>
                                        <th className="py-3 px-3 min-w-[200px]">
                                            Nombre Completo <span className="text-rose-500">*</span>
                                        </th>
                                        <th className="py-3 px-3 min-w-[150px]">
                                            Cargo <span className="text-rose-500">*</span>
                                        </th>
                                        <th className="py-3 px-3 min-w-[130px]">
                                            RUT <span className="text-rose-500">*</span>
                                        </th>
                                        <th className="py-3 px-3 text-center min-w-[130px]">Firma</th>
                                        <th className="py-3 px-3 text-center w-14">Quitar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white font-medium">
                                    {participantes.map((p, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                                                {idx + 1}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <input
                                                    type="text"
                                                    required
                                                    value={p.nombre}
                                                    onChange={e => actualizarParticipante(idx, 'nombre', e.target.value)}
                                                    placeholder="Nombre del trabajador"
                                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs text-slate-800"
                                                />
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <input
                                                    type="text"
                                                    required
                                                    value={p.cargo}
                                                    onChange={e => actualizarParticipante(idx, 'cargo', e.target.value)}
                                                    placeholder="Ej: Operario, Chofer, Auxiliar"
                                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs text-slate-800"
                                                />
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <input
                                                    type="text"
                                                    required
                                                    value={p.rut}
                                                    onChange={e => actualizarParticipante(idx, 'rut', e.target.value)}
                                                    placeholder="12.345.678-9"
                                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs font-mono text-slate-800"
                                                />
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                                {p.firma ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setModalFirmaIndex(idx)
                                                                setTempFirmaModal(p.firma || '')
                                                            }}
                                                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                                        >
                                                            <span>✍️</span>
                                                            <span>Firmado</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => actualizarParticipante(idx, 'firma', '')}
                                                            title="Borrar firma"
                                                            className="text-slate-400 hover:text-rose-600 text-xs p-1"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setModalFirmaIndex(idx)
                                                            setTempFirmaModal('')
                                                        }}
                                                        className="px-2.5 py-1 bg-slate-100 hover:bg-cyan-50 text-slate-600 hover:text-cyan-700 border border-slate-300 hover:border-cyan-400 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 mx-auto transition-all cursor-pointer"
                                                    >
                                                        <span>✍️</span>
                                                        <span>Firmar</span>
                                                    </button>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => eliminarParticipante(idx)}
                                                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                                                    title="Eliminar fila"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center text-xs text-slate-500 pt-2">
                            <span>Total participantes registrados: <strong>{participantes.length}</strong></span>
                            <button
                                type="button"
                                onClick={agregarParticipante}
                                className="text-cyan-600 hover:text-cyan-800 font-bold flex items-center gap-1 cursor-pointer"
                            >
                                <span>➕</span> Añadir otra fila
                            </button>
                        </div>
                    </div>

                    {/* Botón de Envío */}
                    <div className="flex justify-end items-center gap-4 bg-slate-100 p-4 rounded-2xl border border-slate-200">
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedLicitacion('')
                                setSelectedSucursal('')
                                setInstalacion('')
                                setTema('')
                                setFirmaRelator('')
                                setParticipantes([{ nombre: '', cargo: '', rut: '', firma: '' }])
                            }}
                            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
                        >
                            Limpiar Formulario
                        </button>

                        {/* Botón 1: Solo Guardar Registro */}
                        <button
                            type="submit"
                            onClick={() => setAccionGuardar('guardar')}
                            disabled={isPending}
                            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {isPending && accionGuardar === 'guardar' ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    <span>Guardando Registro...</span>
                                </>
                            ) : (
                                <>
                                    <span>💾</span>
                                    <span>Guardar Registro</span>
                                </>
                            )}
                        </button>

                        {/* Botón 2: Guardar y Descargar PDF Oficial */}
                        <button
                            type="submit"
                            onClick={() => setAccionGuardar('guardar_y_descargar')}
                            disabled={isPending}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {isPending && accionGuardar === 'guardar_y_descargar' ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    <span>Guardando y Generando PDF...</span>
                                </>
                            ) : (
                                <>
                                    <span>📄</span>
                                    <span>Guardar y Descargar PDF</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            )}

            {/* PESTAÑA 2: HISTORIAL DE REGISTROS */}
            {tab === 'historial' && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
                        <div>
                            <h2 className="font-bold text-slate-800 text-base">
                                Registros Históricos de Capacitación
                            </h2>
                            <p className="text-xs text-slate-500">
                                Consulta, visualiza y descarga los reportes oficiales en cualquier momento.
                            </p>
                        </div>

                        {/* Barra de Filtros Multifunción */}
                        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                            {/* Filtro Licitación */}
                            <select
                                value={filtroLicitacion}
                                onChange={e => setFiltroLicitacion(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-slate-50/70 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                <option value="">🏢 Todas las Licitaciones</option>
                                {(metadata?.licitaciones || []).map(l => (
                                    <option key={l.licId} value={String(l.licId)}>
                                        Licitación {l.licId} {l.licitacionHomologada ? `(${l.licitacionHomologada})` : ''}
                                    </option>
                                ))}
                            </select>

                            {/* Filtro Sucursal */}
                            <select
                                value={filtroSucursal}
                                onChange={e => setFiltroSucursal(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-slate-50/70 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                <option value="">📍 Todas las Sucursales</option>
                                <option value="Todos" className="font-semibold text-amber-800">
                                    Todos
                                </option>
                                {(metadata?.sucursales || []).map(s => (
                                    <option key={s.id} value={s.nombre}>
                                        {s.nombre}
                                    </option>
                                ))}
                            </select>

                            {/* Buscador de texto */}
                            <div className="relative flex-1 sm:w-64">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="🔍 Buscar por lugar, relator, tema..."
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-medium text-slate-800 bg-slate-50/70"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Botón de limpiar filtros activos */}
                            {(filtroLicitacion || filtroSucursal || searchTerm) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFiltroLicitacion('')
                                        setFiltroSucursal('')
                                        setSearchTerm('')
                                    }}
                                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                                    title="Restablecer filtros"
                                >
                                    ✕ Limpiar
                                </button>
                            )}
                        </div>
                    </div>

                    {registrosFiltrados.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 space-y-2">
                            <span className="text-4xl block">📋</span>
                            <p className="font-semibold text-sm">No se encontraron registros de capacitación con los filtros actuales.</p>
                            {(filtroLicitacion || filtroSucursal || searchTerm) ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFiltroLicitacion('')
                                        setFiltroSucursal('')
                                        setSearchTerm('')
                                    }}
                                    className="text-cyan-600 hover:text-cyan-800 text-xs font-bold underline cursor-pointer"
                                >
                                    Restablecer criterios de búsqueda
                                </button>
                            ) : canManage ? (
                                <button
                                    type="button"
                                    onClick={() => setTab('nuevo')}
                                    className="text-cyan-600 hover:text-cyan-800 text-xs font-bold underline cursor-pointer"
                                >
                                    Crear el primer registro ahora
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="py-3 px-3 w-24">Fecha</th>
                                        <th className="py-3 px-3 w-28">Licitación</th>
                                        <th className="py-3 px-3 min-w-[140px]">Sucursal</th>
                                        <th className="py-3 px-3 min-w-[180px]">Instalación / Lugar</th>
                                        <th className="py-3 px-3 w-28">Horario</th>
                                        <th className="py-3 px-3 min-w-[150px]">Relator</th>
                                        <th className="py-3 px-3 max-w-[220px]">Tema de Capacitación</th>
                                        <th className="py-3 px-3 text-center w-20">Asistentes</th>
                                        <th className="py-3 px-3 text-center w-28">Estado</th>
                                        <th className="py-3 px-3 text-right w-52">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white font-medium">
                                    {registrosFiltrados.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-3 font-semibold text-slate-700 whitespace-nowrap">
                                                {formatDate(r.fecha)}
                                            </td>
                                            <td className="py-3 px-3 whitespace-nowrap">
                                                {r.licitacion ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                                                        Lic. {r.licitacion}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-[11px]">S/I</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 whitespace-nowrap">
                                                {r.sucursal === 'Todos' ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                                        Todos
                                                    </span>
                                                ) : r.sucursal ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                                        {r.sucursal}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-[11px]">-</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 font-bold text-slate-900">
                                                {r.instalacion}
                                            </td>
                                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                                                {r.horario}
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="font-semibold text-slate-800">{r.relatorNombre}</div>
                                                <div className="text-[10px] text-slate-500">{r.relatorCargo}</div>
                                            </td>
                                            <td className="py-3 px-3 text-slate-600 truncate max-w-[220px]" title={r.tema}>
                                                {r.tema}
                                            </td>
                                            <td className="py-3 px-3 text-center whitespace-nowrap">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                                                    👥 {r.participantesCount || 0}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-center whitespace-nowrap">
                                                {r.pdfGenerado ? (
                                                    <span
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs"
                                                        title={r.pdfGeneradoAt ? `PDF emitido el ${formatDate(r.pdfGeneradoAt)} - Modificaciones bloqueadas` : 'PDF Emitido - Modificaciones bloqueadas'}
                                                    >
                                                        <span>🔒</span>
                                                        <span>PDF Emitido</span>
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs"
                                                        title="Borrador: Modificaciones y nuevos participantes permitidos hasta emitir PDF"
                                                    >
                                                        <span>📝</span>
                                                        <span>Editable</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => handleVerDetalle(r.id)}
                                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                                    title="Ver detalle completo"
                                                >
                                                    👁️
                                                </button>

                                                {canManage && (
                                                    !r.pdfGenerado ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleIniciarEdicion(r.id)}
                                                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                                                            title="Editar registro (Permitido antes de emitir PDF)"
                                                        >
                                                            ✏️ Editar
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            disabled
                                                            className="px-2 py-1.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg text-xs font-semibold cursor-not-allowed opacity-60"
                                                            title="Bloqueado: El PDF oficial ya fue emitido y no admite modificaciones"
                                                        >
                                                            🔒
                                                        </button>
                                                    )
                                                )}

                                                <button
                                                    type="button"
                                                    disabled={isLoadingDetalle}
                                                    onClick={() => handleDescargarPDF(r)}
                                                    className="px-2.5 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                                                    title="Descargar PDF Oficial (R PE 7 06) - Bloqueará el registro"
                                                >
                                                    📄 PDF
                                                </button>

                                                {canManage && (
                                                    (isAdmin || !r.pdfGenerado) ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEliminar(r.id, r.instalacion)}
                                                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                                            title={r.pdfGenerado ? "Eliminar registro (Permiso de Administrador)" : "Eliminar registro"}
                                                        >
                                                            🗑️
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            disabled
                                                            className="px-2.5 py-1.5 bg-slate-100 text-slate-300 border border-slate-200 rounded-lg text-xs font-semibold cursor-not-allowed opacity-50"
                                                            title="Bloqueado: El PDF oficial ya fue emitido y solo un Administrador puede eliminarlo"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL PARA FIRMA DE PARTICIPANTE */}
            {modalFirmaIndex !== null && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in duration-200">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="font-bold text-slate-800 text-base">
                                    Firma de Participante #{modalFirmaIndex + 1}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {participantes[modalFirmaIndex]?.nombre || 'Participante'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalFirmaIndex(null)}
                                className="text-slate-400 hover:text-slate-600 font-bold p-1"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <FirmaCanvas
                                value={tempFirmaModal}
                                onChange={setTempFirmaModal}
                                height={180}
                                placeholder="Dibuja la firma del participante aquí con dedo, stylus o mouse"
                            />
                        </div>

                        <div className="flex justify-end items-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setModalFirmaIndex(null)}
                                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    actualizarParticipante(modalFirmaIndex, 'firma', tempFirmaModal)
                                    setModalFirmaIndex(null)
                                }}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-bold text-xs shadow cursor-pointer"
                            >
                                Guardar Firma
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE DETALLE COMPLETO */}
            {detalleSeleccionado && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-6 animate-in fade-in duration-200">
                        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800">
                                        R PE 7 06
                                    </span>
                                    {detalleSeleccionado.licitacion && (
                                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                                            🏢 Lic. {detalleSeleccionado.licitacion}
                                        </span>
                                    )}
                                    {detalleSeleccionado.sucursal && (
                                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                            detalleSeleccionado.sucursal === 'Todos'
                                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                                : 'bg-slate-100 text-slate-800 border-slate-300'
                                        }`}>
                                            {detalleSeleccionado.sucursal === 'Todos' ? 'Todos' : `📍 ${detalleSeleccionado.sucursal}`}
                                        </span>
                                    )}
                                    {detalleSeleccionado.pdfGenerado ? (
                                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
                                            <span>🔒</span> PDF Emitido (Bloqueado)
                                        </span>
                                    ) : (
                                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                                            <span>📝</span> Borrador (Editable)
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-bold text-slate-900 text-lg mt-1">
                                    {detalleSeleccionado.instalacion}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Fecha: <strong>{formatDate(detalleSeleccionado.fecha)}</strong> | Horario: <strong>{detalleSeleccionado.horario}</strong>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDetalleSeleccionado(null)}
                                className="text-slate-400 hover:text-slate-600 font-bold p-1 text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Datos de Relator, Licitación, Sucursal y Tema */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div>
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Relator
                                </span>
                                <span className="text-sm font-bold text-slate-800 block">
                                    {detalleSeleccionado.relatorNombre}
                                </span>
                                <span className="text-xs text-slate-600 block">
                                    Cargo: {detalleSeleccionado.relatorCargo}
                                </span>
                            </div>

                            {detalleSeleccionado.firmaRelator && (
                                <div>
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                        Firma del Relator
                                    </span>
                                    <img
                                        src={detalleSeleccionado.firmaRelator}
                                        alt="Firma del Relator"
                                        className="h-12 bg-white rounded border border-slate-200 px-2 py-0.5 object-contain"
                                    />
                                </div>
                            )}

                            {(detalleSeleccionado.licitacion || detalleSeleccionado.sucursal) && (
                                <div>
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                                        Asignación Territorial
                                    </span>
                                    <span className="text-xs text-slate-800 block font-medium">
                                        Licitación: <strong className="text-cyan-800 font-bold">{detalleSeleccionado.licitacion ? `Lic. ${detalleSeleccionado.licitacion}` : 'N/A'}</strong>
                                    </span>
                                    <span className="text-xs text-slate-800 block font-medium">
                                        Sucursal: <strong>{detalleSeleccionado.sucursal || 'N/A'}</strong>
                                    </span>
                                </div>
                            )}

                            <div className="md:col-span-2 pt-2 border-t border-slate-200">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Tema de Capacitación
                                </span>
                                <p className="text-xs text-slate-800 whitespace-pre-line bg-white p-3 rounded-lg border border-slate-200">
                                    {detalleSeleccionado.tema}
                                </p>
                            </div>
                        </div>

                        {/* Tabla de Participantes Desencriptados */}
                        <div className="space-y-2">
                            <h4 className="font-bold text-slate-800 text-sm">
                                Participantes Registrados ({detalleSeleccionado.participantes?.length || 0})
                            </h4>
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                        <tr>
                                            <th className="py-2.5 px-3 w-10 text-center">Nº</th>
                                            <th className="py-2.5 px-3">Nombre</th>
                                            <th className="py-2.5 px-3">Cargo</th>
                                            <th className="py-2.5 px-3">RUT</th>
                                            <th className="py-2.5 px-3 text-center">Firma</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {detalleSeleccionado.participantes?.map(p => (
                                            <tr key={p.id}>
                                                <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                                                    {p.numero}
                                                </td>
                                                <td className="py-2.5 px-3 font-semibold text-slate-800">
                                                    {p.nombre}
                                                </td>
                                                <td className="py-2.5 px-3 text-slate-600">
                                                    {p.cargo}
                                                </td>
                                                <td className="py-2.5 px-3 font-mono text-slate-700">
                                                    {p.rut}
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                    {p.firma ? (
                                                        <img
                                                            src={p.firma}
                                                            alt="Firma"
                                                            className="h-8 mx-auto bg-white rounded border border-slate-200 px-1 object-contain"
                                                        />
                                                    ) : (
                                                        <span className="text-slate-400 text-[11px] italic">Sin firma</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Botones del Modal */}
                        <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                            <span className="text-[11px] text-slate-400">
                                Creado por: {detalleSeleccionado.creadoPor || 'Sistema'}
                            </span>
                            <div className="flex gap-2">
                                {!detalleSeleccionado.pdfGenerado && canManage && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const idReg = detalleSeleccionado.id
                                            setDetalleSeleccionado(null)
                                            handleIniciarEdicion(idReg)
                                        }}
                                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <span>✏️</span> Editar Registro
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleDescargarPDF(detalleSeleccionado)}
                                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>📄</span> Descargar PDF Oficial (R PE 7 06)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDetalleSeleccionado(null)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE EDICIÓN DE REGISTRO */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in duration-200">
                        {/* Cabecera del modal */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                        ✏️ Modo Edición (Borrador)
                                    </span>
                                    <span className="text-[11px] font-semibold text-slate-500">
                                        ID: {idEditando?.slice(0, 8)}...
                                    </span>
                                </div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Modificar Registro de Capacitación
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Puedes añadir participantes que hayan faltado o ajustar datos generales. Una vez emitido el PDF oficial, quedará bloqueado permanentemente.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsEditModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 font-bold p-1 text-lg cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Cuerpo del modal (scrollable) */}
                        <form onSubmit={handleGuardarEdicion} className="flex-1 flex flex-col overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Criterios territoriales */}
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div className="md:col-span-4 space-y-1">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            🏢 Licitación
                                        </label>
                                        <select
                                            value={editLicitacion}
                                            onChange={e => handleEditLicitacionChange(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
                                        >
                                            <option value="">-- Sin Licitación específica --</option>
                                            {(metadata?.licitaciones || []).map(l => (
                                                <option key={l.licId} value={String(l.licId)}>
                                                    Licitación {l.licitacionHomologada || l.licId}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="md:col-span-4 space-y-1">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            📍 Sucursal <span className="text-rose-500">*</span>
                                        </label>
                                        <select
                                            required
                                            value={editSucursal}
                                            onChange={e => handleEditSucursalChange(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
                                        >
                                            <option value="">-- Seleccionar Sucursal --</option>
                                            <option value="Todos" className="font-semibold text-amber-800">
                                                Todos
                                            </option>
                                            {editSucursalesFiltradas.map(s => (
                                                <option key={s.id} value={s.nombre}>
                                                    {s.nombre}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="md:col-span-4 space-y-1">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            ⏰ Horario <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="time"
                                                required
                                                value={editHoraDesde}
                                                onChange={e => setEditHoraDesde(e.target.value)}
                                                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                                            />
                                            <input
                                                type="time"
                                                required
                                                value={editHoraHasta}
                                                onChange={e => setEditHoraHasta(e.target.value)}
                                                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-12 space-y-1">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            Instalación / Sede / Lugar <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={editInstalacion}
                                            onChange={e => setEditInstalacion(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                                        />
                                    </div>
                                </div>

                                {/* Relator y Tema */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                                Nombre del Relator <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={editRelatorNombre}
                                                onChange={e => setEditRelatorNombre(e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                                Cargo del Relator <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={editRelatorCargo}
                                                onChange={e => setEditRelatorCargo(e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                                Tema de Capacitación <span className="text-rose-500">*</span>
                                            </label>
                                            <textarea
                                                required
                                                rows={3}
                                                value={editTema}
                                                onChange={e => setEditTema(e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Firma del Relator
                                        </label>
                                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                                            <FirmaCanvas
                                                value={editFirmaRelator}
                                                onChange={setEditFirmaRelator}
                                                height={130}
                                                placeholder="Dibuja la firma del relator aquí"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Grilla de Participantes */}
                                <div className="space-y-3 pt-2">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                            Participantes Asistentes ({editParticipantes.length})
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={agregarParticipanteEdit}
                                            className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                        >
                                            <span>➕</span> Agregar Participante
                                        </button>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                                <tr>
                                                    <th className="py-2.5 px-2.5 w-10 text-center">Nº</th>
                                                    <th className="py-2.5 px-2.5 min-w-[160px]">Nombre Completo</th>
                                                    <th className="py-2.5 px-2.5 min-w-[130px]">Cargo</th>
                                                    <th className="py-2.5 px-2.5 min-w-[120px]">RUT</th>
                                                    <th className="py-2.5 px-2.5 w-32 text-center">Firma</th>
                                                    <th className="py-2.5 px-2.5 w-12 text-center">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white font-medium">
                                                {editParticipantes.map((p, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50">
                                                        <td className="py-2 px-2.5 text-center font-bold text-slate-500">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="py-2 px-2.5">
                                                            <input
                                                                type="text"
                                                                required
                                                                value={p.nombre}
                                                                onChange={e => actualizarParticipanteEdit(idx, 'nombre', e.target.value)}
                                                                placeholder="Nombre y Apellido"
                                                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-2.5">
                                                            <input
                                                                type="text"
                                                                required
                                                                value={p.cargo}
                                                                onChange={e => actualizarParticipanteEdit(idx, 'cargo', e.target.value)}
                                                                placeholder="Ej: Operario"
                                                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-2.5">
                                                            <input
                                                                type="text"
                                                                required
                                                                value={p.rut}
                                                                onChange={e => actualizarParticipanteEdit(idx, 'rut', e.target.value)}
                                                                placeholder="12.345.678-9"
                                                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-medium"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-2.5 text-center">
                                                            {p.firma ? (
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <img
                                                                        src={p.firma}
                                                                        alt="Firma"
                                                                        className="h-7 max-w-[70px] bg-white border border-slate-200 rounded px-1 object-contain"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setEditTempFirmaModal(p.firma || '')
                                                                            setEditModalFirmaIndex(idx)
                                                                        }}
                                                                        className="text-[10px] text-cyan-600 hover:text-cyan-800 font-bold underline cursor-pointer"
                                                                    >
                                                                        Cambiar
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditTempFirmaModal('')
                                                                        setEditModalFirmaIndex(idx)
                                                                    }}
                                                                    className="px-2 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded-md text-[11px] font-bold cursor-pointer"
                                                                >
                                                                    ✍️ Firmar
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-2.5 text-center">
                                                            <button
                                                                type="button"
                                                                disabled={editParticipantes.length <= 1}
                                                                onClick={() => removerParticipanteEdit(idx)}
                                                                className="text-rose-500 hover:text-rose-700 font-bold text-sm disabled:opacity-30 cursor-pointer"
                                                                title="Quitar participante"
                                                            >
                                                                ✕
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Pie del modal con botones de guardado */}
                            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    onClick={() => setEditAccionGuardar('guardar')}
                                    disabled={isPending}
                                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {isPending && editAccionGuardar === 'guardar' ? (
                                        <>
                                            <span className="animate-spin">⏳</span>
                                            <span>Guardando Cambios...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>💾</span>
                                            <span>Guardar Cambios</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="submit"
                                    onClick={() => setEditAccionGuardar('guardar_y_descargar')}
                                    disabled={isPending}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {isPending && editAccionGuardar === 'guardar_y_descargar' ? (
                                        <>
                                            <span className="animate-spin">⏳</span>
                                            <span>Emitiendo PDF...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>📄</span>
                                            <span>Guardar Cambios y Descargar PDF</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL PARA FIRMA DE PARTICIPANTE EN MODO EDICIÓN */}
            {editModalFirmaIndex !== null && (
                <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in duration-200">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="font-bold text-slate-800 text-base">
                                    Firma de Participante #{editModalFirmaIndex + 1}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {editParticipantes[editModalFirmaIndex]?.nombre || 'Participante'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditModalFirmaIndex(null)}
                                className="text-slate-400 hover:text-slate-600 font-bold p-1"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <FirmaCanvas
                                value={editTempFirmaModal}
                                onChange={setEditTempFirmaModal}
                                height={180}
                                placeholder="Dibuja la firma del participante aquí con dedo, stylus o mouse"
                            />
                        </div>

                        <div className="flex justify-end items-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setEditModalFirmaIndex(null)}
                                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    actualizarParticipanteEdit(editModalFirmaIndex, 'firma', editTempFirmaModal)
                                    setEditModalFirmaIndex(null)
                                }}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-bold text-xs shadow cursor-pointer"
                            >
                                Guardar Firma
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

