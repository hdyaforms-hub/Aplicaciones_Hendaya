'use client'

import React, { useState, useTransition } from 'react'
import {
    DiarioMuralItem,
    publicarNotaDiarioMuralAction,
    eliminarNotaDiarioMuralAction
} from './actions'
import {
    Plus,
    Trash2,
    Calendar,
    User,
    Clock,
    Tag,
    Search,
    AlertCircle,
    CheckCircle2,
    Info,
    RefreshCw,
    X,
    Pin,
    Image as ImageIcon,
    Maximize2,
    Paperclip
} from 'lucide-react'

interface DiarioMuralClientProps {
    initialItems: DiarioMuralItem[]
    esAdmin: boolean
    usuarioActual: string
}

const COLOR_CLASSES: Record<DiarioMuralItem['color'], {
    bg: string
    border: string
    tape: string
    badge: string
    progress: string
}> = {
    yellow: {
        bg: 'bg-[#fff9a6]',
        border: 'border-[#f3e779]',
        tape: 'bg-amber-100/80 border-amber-200',
        badge: 'bg-amber-400/30 text-amber-900 border-amber-500/30',
        progress: 'bg-amber-500'
    },
    blue: {
        bg: 'bg-[#bbf2f6]',
        border: 'border-[#8ae6ef]',
        tape: 'bg-sky-100/80 border-sky-200',
        badge: 'bg-sky-400/30 text-sky-900 border-sky-500/30',
        progress: 'bg-sky-500'
    },
    purple: {
        bg: 'bg-[#e3d5ff]',
        border: 'border-[#cfb6ff]',
        tape: 'bg-purple-100/80 border-purple-200',
        badge: 'bg-purple-400/30 text-purple-900 border-purple-500/30',
        progress: 'bg-purple-500'
    },
    green: {
        bg: 'bg-[#c1f2d5]',
        border: 'border-[#94e7b4]',
        tape: 'bg-emerald-100/80 border-emerald-200',
        badge: 'bg-emerald-400/30 text-emerald-900 border-emerald-500/30',
        progress: 'bg-emerald-500'
    },
    pink: {
        bg: 'bg-[#ffd0e0]',
        border: 'border-[#ffadc7]',
        tape: 'bg-rose-100/80 border-rose-200',
        badge: 'bg-rose-400/30 text-rose-900 border-rose-500/30',
        progress: 'bg-rose-500'
    },
    orange: {
        bg: 'bg-[#ffe2b8]',
        border: 'border-[#ffcc85]',
        tape: 'bg-orange-100/80 border-orange-200',
        badge: 'bg-orange-400/30 text-orange-900 border-orange-500/30',
        progress: 'bg-orange-500'
    }
}

export default function DiarioMuralClient({
    initialItems,
    esAdmin,
    usuarioActual
}: DiarioMuralClientProps) {
    const [items, setItems] = useState<DiarioMuralItem[]>(initialItems)
    const [filtroEstado, setFiltroEstado] = useState<'todas' | 'activas' | 'por_vencer'>('todas')
    const [busqueda, setBusqueda] = useState('')
    const [isPending, startTransition] = useTransition()

    // Modal Crear
    const [modalCrearOpen, setModalCrearOpen] = useState(false)
    const [nuevoTitulo, setNuevoTitulo] = useState('')
    const [nuevoContenido, setNuevoContenido] = useState('')
    const [nuevaCategoria, setNuevaCategoria] = useState('General')
    const [nuevoColor, setNuevoColor] = useState<DiarioMuralItem['color']>('yellow')
    const [nuevaDuracion, setNuevaDuracion] = useState<number>(30)
    const [nuevaImagen, setNuevaImagen] = useState<string | null>(null)
    const [errorModal, setErrorModal] = useState<string | null>(null)
    const [guardando, setGuardando] = useState(false)

    // Zoom Lightbox
    const [imagenZoom, setImagenZoom] = useState<{ url: string; titulo: string } | null>(null)

    // Modal Confirmar Eliminar
    const [notaAEliminar, setNotaAEliminar] = useState<DiarioMuralItem | null>(null)
    const [eliminando, setEliminando] = useState(false)

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            setErrorModal('El archivo seleccionado debe ser una imagen válida (PNG, JPG, WEBP).')
            return
        }

        const reader = new FileReader()
        reader.onload = (event) => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                const maxDim = 1200
                let width = img.width
                let height = img.height
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width)
                        width = maxDim
                    } else {
                        width = Math.round((width * maxDim) / height)
                        height = maxDim
                    }
                }
                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                ctx?.drawImage(img, 0, 0, width, height)
                const compressed = canvas.toDataURL('image/jpeg', 0.82)
                setNuevaImagen(compressed)
            }
            img.src = event.target?.result as string
        }
        reader.readAsDataURL(file)
    }

    // Filtrar items
    const itemsFiltrados = items.filter(item => {
        const matchesBusqueda =
            item.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
            item.contenido.toLowerCase().includes(busqueda.toLowerCase()) ||
            item.autorNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
            item.categoria.toLowerCase().includes(busqueda.toLowerCase())

        if (!matchesBusqueda) return false

        if (filtroEstado === 'activas') return item.diasRestantes > 3
        if (filtroEstado === 'por_vencer') return item.diasRestantes <= 5

        return true
    })

    const handleCrearNota = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorModal(null)

        if (!nuevoTitulo.trim()) {
            setErrorModal('Debes ingresar un título para la nota.')
            return
        }
        if (!nuevoContenido.trim()) {
            setErrorModal('Debes ingresar el contenido de la publicación.')
            return
        }

        setGuardando(true)
        try {
            const res = await publicarNotaDiarioMuralAction({
                titulo: nuevoTitulo,
                contenido: nuevoContenido,
                categoria: nuevaCategoria,
                color: nuevoColor,
                duracionDias: nuevaDuracion,
                imagenUrl: nuevaImagen
            })

            if (res.success && res.id) {
                const nuevaNota: DiarioMuralItem = {
                    id: res.id,
                    titulo: nuevoTitulo.trim().toUpperCase(),
                    contenido: nuevoContenido.trim(),
                    categoria: nuevaCategoria,
                    color: nuevoColor,
                    duracionDias: nuevaDuracion,
                    fechaExpiracion: new Date(Date.now() + nuevaDuracion * 24 * 60 * 60 * 1000).toISOString(),
                    autorNombre: usuarioActual,
                    autorRol: esAdmin ? 'Administrador' : 'Colaborador',
                    diasRestantes: nuevaDuracion,
                    imagenUrl: nuevaImagen,
                    createdAt: new Date().toISOString()
                }
                setItems(prev => [nuevaNota, ...prev])
                setModalCrearOpen(false)
                setNuevoTitulo('')
                setNuevoContenido('')
                setNuevaCategoria('General')
                setNuevoColor('yellow')
                setNuevaDuracion(30)
                setNuevaImagen(null)
            } else {
                setErrorModal(res.error || 'Ocurrió un error al publicar la nota.')
            }
        } catch (err: any) {
            setErrorModal(err.message || 'Error inesperado al guardar.')
        } finally {
            setGuardando(false)
        }
    }

    const handleConfirmarEliminar = async () => {
        if (!notaAEliminar) return
        setEliminando(true)
        try {
            const res = await eliminarNotaDiarioMuralAction(notaAEliminar.id)
            if (res.success) {
                setItems(prev => prev.filter(i => i.id !== notaAEliminar.id))
                setNotaAEliminar(null)
            } else {
                alert(res.error || 'No fue posible eliminar la publicación.')
            }
        } catch (err: any) {
            alert(err.message || 'Error al eliminar')
        } finally {
            setEliminando(false)
        }
    }

    const formatearFecha = (fechaStr: string) => {
        try {
            const d = new Date(fechaStr)
            return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
        } catch {
            return fechaStr
        }
    }

    return (
        <div className="space-y-6">
            {/* Header del Diario Mural */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 tracking-wider uppercase mb-1">
                        <Pin className="w-4 h-4 text-cyan-600" />
                        <span>Colaboradores • Espacio Comunitario</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Diario Mural Institucional</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Pizarra interactiva de avisos, reconocimientos y novedades para todo el equipo de Hendaya.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setModalCrearOpen(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Plus className="w-4 h-4" />
                        <span>+ Publicar en Diario Mural</span>
                    </button>
                </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                    <span className="text-xs font-medium text-slate-500 mr-1 whitespace-nowrap">Filtrar por:</span>
                    <button
                        onClick={() => setFiltroEstado('todas')}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                            filtroEstado === 'todas'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        Ver Todas ({items.length})
                    </button>
                    <button
                        onClick={() => setFiltroEstado('activas')}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                            filtroEstado === 'activas'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        }`}
                    >
                        Abiertas / Vigentes
                    </button>
                    <button
                        onClick={() => setFiltroEstado('por_vencer')}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                            filtroEstado === 'por_vencer'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                    >
                        Por Vencer (≤ 5 días)
                    </button>
                </div>

                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        placeholder="Buscar nota o autor..."
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
                    />
                </div>
            </div>

            {/* Pizarra Corcho con Post-its */}
            <div className="relative rounded-2xl p-6 sm:p-10 border-8 border-[#8b5a36] shadow-2xl overflow-hidden bg-gradient-to-br from-[#d9a57e] via-[#c79169] to-[#b37c56]">
                {/* Textura sutil y marco */}
                <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#4a2810_1px,transparent_1px)] [background-size:16px_16px]" />

                {itemsFiltrados.length === 0 ? (
                    <div className="relative z-10 flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-full bg-amber-100/80 border-2 border-amber-300 flex items-center justify-center text-amber-800 mb-3 shadow-md">
                            <Pin className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-amber-950">No hay publicaciones en la pizarra</h3>
                        <p className="text-sm text-amber-900/80 max-w-md mt-1">
                            {busqueda ? 'No se encontraron notas que coincidan con la búsqueda.' : 'Sé el primero en compartir una novedad, felicitación o aviso institucional.'}
                        </p>
                        <button
                            onClick={() => setModalCrearOpen(true)}
                            className="mt-4 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-md"
                        >
                            + Publicar Noticia Ahora
                        </button>
                    </div>
                ) : (
                    <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {itemsFiltrados.map((nota, idx) => {
                            const configColor = COLOR_CLASSES[nota.color] || COLOR_CLASSES.yellow
                            // Calcular progreso de vigencia restante
                            const totalDias = Math.max(1, nota.duracionDias)
                            const diasTranscurridos = Math.max(0, totalDias - nota.diasRestantes)
                            const porcentajeTranscurrido = Math.min(100, Math.round((diasTranscurridos / totalDias) * 100))

                            return (
                                <div
                                    key={nota.id}
                                    className={`relative rounded-xl p-5 border ${configColor.border} ${configColor.bg} shadow-lg hover:shadow-2xl transition-all duration-200 transform hover:-translate-y-1 flex flex-col justify-between`}
                                    style={{
                                        // Leve rotación aleatoria estética como post-it real
                                        rotate: idx % 4 === 0 ? '-0.8deg' : idx % 4 === 1 ? '0.6deg' : idx % 4 === 2 ? '-0.5deg' : '0.7deg'
                                    }}
                                >
                                    {/* Cinta adhesiva arriba en el centro */}
                                    <div
                                        className={`absolute -top-2.5 left-1/2 -translate-x-1/2 w-14 h-4.5 ${configColor.tape} border shadow-xs rounded-xs z-10 backdrop-blur-xs rotate-[-1deg]`}
                                    />

                                    <div>
                                        {/* Fila superior: Badges y Botón Eliminar (Solo Admin) */}
                                        <div className="flex items-center justify-between gap-1.5 mb-2.5 pt-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${configColor.badge}`}>
                                                    {nota.categoria}
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/70 text-slate-700 border border-slate-300/40">
                                                    Hendaya
                                                </span>
                                            </div>

                                            {esAdmin ? (
                                                <button
                                                    onClick={() => setNotaAEliminar(nota)}
                                                    title="Eliminar publicación (Función de Administrador)"
                                                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            ) : (
                                                <div className="w-4 h-4" />
                                            )}
                                        </div>

                                        {/* Cabecera: Título */}
                                        <h3 className="text-base font-extrabold text-slate-900 leading-snug tracking-tight mb-2">
                                            {nota.titulo}
                                        </h3>

                                        {/* Parte Central: Contenido / Noticia */}
                                        <div className="text-xs text-slate-800 leading-relaxed font-normal whitespace-pre-line mb-3 bg-white/40 p-2.5 rounded-lg border border-black/5 min-h-[60px]">
                                            "{nota.contenido}"
                                        </div>

                                        {/* Imagen Adjunta en el Post-it (si existe) */}
                                        {nota.imagenUrl && (
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setImagenZoom({ url: nota.imagenUrl!, titulo: nota.titulo })
                                                }}
                                                className="relative group/img cursor-pointer mb-3 overflow-hidden rounded-lg border border-black/15 shadow-xs bg-black/5"
                                                title="Clic para ampliar imagen"
                                            >
                                                <img
                                                    src={nota.imagenUrl}
                                                    alt={nota.titulo}
                                                    className="w-full h-24 object-cover group-hover/img:scale-105 transition-transform duration-200"
                                                />
                                                <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold gap-1 backdrop-blur-2xs">
                                                    <Maximize2 className="w-3.5 h-3.5" />
                                                    <span>Clic para ampliar</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Barra de progreso de vigencia */}
                                    <div>
                                        <div className="space-y-1 mb-3">
                                            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-700">
                                                <span>Vigencia: {nota.diasRestantes} días rest.</span>
                                                <span className="px-1.5 py-0.2 rounded bg-amber-400/40 text-amber-950 font-bold uppercase text-[9px]">
                                                    {nota.diasRestantes <= 0 ? 'VENCIDA' : 'ABIERTA'}
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${configColor.progress}`}
                                                    style={{ width: `${100 - porcentajeTranscurrido}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Pie de página: Quién lo publica y fecha */}
                                        <div className="pt-2 border-t border-black/10 flex flex-col gap-1 text-[11px] text-slate-600 font-medium">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                <span className="truncate">Publicado: <strong className="text-slate-800">{nota.autorNombre}</strong></span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span>{formatearFecha(nota.createdAt)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* MODAL CREAR NOTA */}
            {modalCrearOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scaleUp">
                        {/* Cabecera Modal */}
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                                    <Pin className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">Nueva Nota en Diario Mural</h3>
                                    <p className="text-xs text-slate-500">Completa los campos para fijar tu aviso en la pizarra</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setModalCrearOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleCrearNota} className="p-6 space-y-4">
                            {errorModal && (
                                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{errorModal}</span>
                                </div>
                            )}

                            {/* Cabecera: Título */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Cabecera / Título de la Noticia <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={nuevoTitulo}
                                    onChange={e => setNuevoTitulo(e.target.value)}
                                    placeholder="Ej: RECORDATORIO CAPACITACIÓN JUNAEB..."
                                    maxLength={80}
                                    required
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 uppercase font-semibold"
                                />
                            </div>

                            {/* Parte Central: Contenido */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Parte Central / Noticia o Descripción <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    value={nuevoContenido}
                                    onChange={e => setNuevoContenido(e.target.value)}
                                    placeholder="Escribe aquí el detalle de la noticia o aviso institucional..."
                                    rows={4}
                                    maxLength={400}
                                    required
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                                />
                                <div className="text-[11px] text-slate-400 text-right mt-0.5">
                                    {nuevoContenido.length}/400 caracteres
                                </div>
                            </div>

                            {/* Adjuntar Imagen (Opcional) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Adjuntar Imagen (Opcional)
                                </label>
                                {nuevaImagen ? (
                                    <div className="relative inline-block border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-slate-50 p-1.5">
                                        <img
                                            src={nuevaImagen}
                                            alt="Previsualización adjunta"
                                            className="h-28 w-44 object-cover rounded-lg"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setNuevaImagen(null)}
                                            className="absolute top-2.5 right-2.5 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md transition-colors"
                                            title="Quitar imagen"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors text-slate-600">
                                        <Paperclip className="w-4 h-4 text-cyan-600" />
                                        <span className="text-xs font-medium">Adjuntar fotografía o volante (PNG, JPG, WEBP)</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>

                            {/* Tiempo de Duración de la Publicación */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Tiempo de Duración de la Publicación <span className="text-rose-500">*</span>
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { dias: 10, label: '10 días' },
                                        { dias: 20, label: '20 días' },
                                        { dias: 30, label: '1 mes (30d)' },
                                        { dias: 60, label: '2 meses (60d)' }
                                    ].map(opt => (
                                        <button
                                            type="button"
                                            key={opt.dias}
                                            onClick={() => setNuevaDuracion(opt.dias)}
                                            className={`py-2 px-2 rounded-lg text-xs font-semibold border text-center transition-all ${
                                                nuevaDuracion === opt.dias
                                                    ? 'bg-cyan-700 text-white border-cyan-800 shadow-sm ring-2 ring-cyan-500/30'
                                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-cyan-600" />
                                    <span>Al cumplirse el plazo, la publicación se eliminará automáticamente de la pizarra.</span>
                                </p>
                            </div>

                            {/* Selección de Color del Post-it y Categoría */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        Color del Post-It
                                    </label>
                                    <div className="flex items-center gap-2 pt-1">
                                        {(['yellow', 'blue', 'purple', 'green', 'pink', 'orange'] as const).map(c => (
                                            <button
                                                type="button"
                                                key={c}
                                                onClick={() => setNuevoColor(c)}
                                                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                                                    COLOR_CLASSES[c].bg
                                                } ${
                                                    nuevoColor === c
                                                        ? 'scale-125 border-slate-800 shadow-md ring-2 ring-slate-400'
                                                        : 'border-slate-300 hover:scale-110'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        Categoría
                                    </label>
                                    <select
                                        value={nuevaCategoria}
                                        onChange={e => setNuevaCategoria(e.target.value)}
                                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    >
                                        <option value="General">General</option>
                                        <option value="Preventivo">Preventivo</option>
                                        <option value="Informativo">Informativo</option>
                                        <option value="Calidad">Calidad</option>
                                        <option value="Seguridad">Seguridad</option>
                                        <option value="Institucional">Institucional</option>
                                    </select>
                                </div>
                            </div>

                            {/* Pie de Nota informativo */}
                            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Publicando como: <strong>{usuarioActual}</strong></span>
                                </span>
                                <span className="text-[11px] text-slate-500">
                                    {esAdmin ? 'Rol: Administrador' : 'Rol: Colaborador'}
                                </span>
                            </div>

                            {/* Botones de acción */}
                            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setModalCrearOpen(false)}
                                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={guardando}
                                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-md disabled:opacity-50"
                                >
                                    {guardando ? (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            <span>Fijando Nota...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Pin className="w-3.5 h-3.5" />
                                            <span>Fijar en Diario Mural</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL CONFIRMAR ELIMINACIÓN (SOLO ADMIN) */}
            {notaAEliminar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center animate-scaleUp">
                        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mb-1">¿Eliminar publicación?</h3>
                        <p className="text-xs text-slate-500 mb-4">
                            Como Administrador, estás a punto de borrar la nota: <strong>"{notaAEliminar.titulo}"</strong>. Esta acción no se puede deshacer.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={() => setNotaAEliminar(null)}
                                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmarEliminar}
                                disabled={eliminando}
                                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-md disabled:opacity-50"
                            >
                                {eliminando ? 'Eliminando...' : 'Sí, Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ZOOM / LIGHTBOX DE IMAGEN AMPLIADA */}
            {imagenZoom && (
                <div
                    onClick={() => setImagenZoom(null)}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl p-4 shadow-2xl border border-slate-700 flex flex-col items-center animate-scaleUp"
                    >
                        <div className="w-full flex items-center justify-between pb-3 px-1 text-white border-b border-slate-800 mb-3">
                            <h4 className="text-sm font-bold truncate pr-4">{imagenZoom.titulo}</h4>
                            <button
                                onClick={() => setImagenZoom(null)}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <img
                            src={imagenZoom.url}
                            alt={imagenZoom.titulo}
                            className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
