'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createActaResponse, deleteActaResponse, getColegiosForPlantilla, getActaFullData } from './actions'
import { generateActaPDF } from './actaPdfUtil'

type ActaRespuesta = {
    id: string
    plantillaId: string
    licitacionId: number | null
    anio: number | null
    rbd: number
    nombreEstablecimiento: string | null
    institucion: string | null
    estado: string
    usuario: string
    correlativo?: number | null
    createdAt: Date
    plantilla?: {
        nombre: string
        instituciones: string | null
    }
}

type Props = {
    initialRespuestas: ActaRespuesta[]
    plantillas: any[]
    isAdmin: boolean
}

export default function GenerarActaClient({ initialRespuestas, plantillas, isAdmin }: Props) {
    const router = useRouter()
    const [respuestas, setRespuestas] = useState(initialRespuestas)
    const [loadingId, setLoadingId] = useState<string | null>(null)

    // Filtros de tabla
    const [filtroLicitacion, setFiltroLicitacion] = useState('')
    const [filtroNombre, setFiltroNombre] = useState('')
    const [filtroInstitucion, setFiltroInstitucion] = useState('')
    const [filtroAnio, setFiltroAnio] = useState('')
    const [filtroMes, setFiltroMes] = useState('')
    const [filtroEstado, setFiltroEstado] = useState('')

    // Modal Nueva Acta
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedPlantillaId, setSelectedPlantillaId] = useState('')
    const [selectedRbd, setSelectedRbd] = useState<number | string>('')
    const [selectedColegio, setSelectedColegio] = useState<any | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    
    const [colegiosList, setColegiosList] = useState<any[]>([])
    const [isLoadingColegios, setIsLoadingColegios] = useState(false)
    const [isCreating, setIsCreating] = useState(false)

    // Handler para exportar PDF directamente desde la tabla de actas
    const handleExportPdf = async (actaId: string) => {
        setLoadingId(actaId)
        const res = await getActaFullData(actaId)
        if (res.success && res.data) {
            const fullActa = res.data
            const plantilla = fullActa.plantilla || {}
            let respuestasData = {}
            try {
                respuestasData = typeof fullActa.respuestasData === 'string' ? JSON.parse(fullActa.respuestasData) : (fullActa.respuestasData || {})
            } catch {
                respuestasData = {}
            }

            const doc = generateActaPDF(fullActa, plantilla, respuestasData)
            const cleanName = (fullActa.nombreEstablecimiento || 'Colegio').replace(/[^a-zA-Z0-9]/g, '_')
            const fechaStr = new Date(fullActa.createdAt).toISOString().slice(0, 10)
            doc.save(`Acta_Supervision_${cleanName}_${fechaStr}.pdf`)
        } else {
            alert(res.error || 'Error al obtener datos para exportar el PDF')
        }
        setLoadingId(null)
    }

    // Cuando cambia la plantilla en el modal, cargamos los RBDs válidos para esa plantilla
    const handlePlantillaChange = async (plantillaId: string) => {
        setSelectedPlantillaId(plantillaId)
        setSelectedRbd('')
        setSelectedColegio(null)
        setSearchQuery('')
        setColegiosList([])
        if (!plantillaId) return

        setIsLoadingColegios(true)
        const res = await getColegiosForPlantilla(plantillaId)
        if (res.success && res.data) {
            setColegiosList(res.data)
        } else {
            alert(res.error || 'Error al obtener RBDs para la plantilla')
        }
        setIsLoadingColegios(false)
    }

    const handleCreate = async () => {
        if (!selectedPlantillaId || !selectedRbd) return
        setIsCreating(true)
        const res = await createActaResponse(selectedPlantillaId, Number(selectedRbd))
        if (res.success && res.id) {
            setIsModalOpen(false)
            router.push(`/dashboard/actas/generar-acta/${res.id}`)
        } else {
            alert(res.error || 'Error al iniciar acta')
            setIsCreating(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este registro de acta de forma permanente?')) return
        setLoadingId(id)
        const res = await deleteActaResponse(id)
        if (res.success) {
            setRespuestas(prev => prev.filter(r => r.id !== id))
        } else {
            alert(res.error || 'Error al eliminar')
        }
        setLoadingId(null)
    }

    // Listas únicas de opciones para las listas desplegables de filtro
    const nombresActasOptions = Array.from(
        new Set([
            ...respuestas.map(r => r.plantilla?.nombre).filter(Boolean),
            ...plantillas.map(p => p.nombre).filter(Boolean)
        ])
    ).sort()

    const licitacionesOptions = Array.from(
        new Set(
            respuestas
                .map(r => r.licitacionId ? String(r.licitacionId) : null)
                .filter(Boolean)
        )
    ).sort()

    const institucionesOptions = Array.from(
        new Set(
            respuestas
                .flatMap(r => [r.institucion, r.plantilla?.instituciones])
                .filter(Boolean)
                .map(i => i!.trim())
        )
    ).sort()

    const anioOptions = Array.from(
        new Set(
            respuestas
                .map(r => r.createdAt ? new Date(r.createdAt).getFullYear().toString() : null)
                .filter((x): x is string => Boolean(x))
        )
    ).sort((a, b) => b.localeCompare(a))

    const mesesOptions = [
        { value: '0', label: 'Enero' },
        { value: '1', label: 'Febrero' },
        { value: '2', label: 'Marzo' },
        { value: '3', label: 'Abril' },
        { value: '4', label: 'Mayo' },
        { value: '5', label: 'Junio' },
        { value: '6', label: 'Julio' },
        { value: '7', label: 'Agosto' },
        { value: '8', label: 'Septiembre' },
        { value: '9', label: 'Octubre' },
        { value: '10', label: 'Noviembre' },
        { value: '11', label: 'Diciembre' }
    ]

    const estadosOptions = Array.from(
        new Set(respuestas.map(r => r.estado).filter(Boolean))
    ).sort()

    // Ordenación y Paginación
    const [sortField, setSortField] = useState<string | null>(null)
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
        setCurrentPage(1)
    }

    // Filtrado local de la tabla
    const filteredRespuestas = respuestas.filter(r => {
        const matchLic = filtroLicitacion ? (r.licitacionId?.toString() === filtroLicitacion) : true
        const matchNombre = filtroNombre ? (r.plantilla?.nombre === filtroNombre) : true
        const matchInst = filtroInstitucion ? (
            r.institucion?.toLowerCase() === filtroInstitucion.toLowerCase() ||
            (r.plantilla?.instituciones && r.plantilla.instituciones.toLowerCase().includes(filtroInstitucion.toLowerCase()))
        ) : true
        const matchAnio = filtroAnio ? (r.createdAt && new Date(r.createdAt).getFullYear().toString() === filtroAnio) : true
        const matchMes = filtroMes ? (r.createdAt && new Date(r.createdAt).getMonth().toString() === filtroMes) : true
        const matchEstado = filtroEstado ? (r.estado === filtroEstado) : true
        return matchLic && matchNombre && matchInst && matchAnio && matchMes && matchEstado
    })

    // Ordenación local de la tabla
    const sortedRespuestas = [...filteredRespuestas].sort((a, b) => {
        if (!sortField) return 0
        let valA: any = ''
        let valB: any = ''

        if (sortField === 'plantilla') {
            valA = a.plantilla?.nombre || ''
            valB = b.plantilla?.nombre || ''
        } else if (sortField === 'establecimiento') {
            valA = `${a.rbd || ''} ${a.nombreEstablecimiento || ''}`
            valB = `${b.rbd || ''} ${b.nombreEstablecimiento || ''}`
        } else if (sortField === 'licitacion') {
            valA = a.licitacionId || 0
            valB = b.licitacionId || 0
        } else if (sortField === 'institucion') {
            valA = a.institucion || a.plantilla?.instituciones || ''
            valB = b.institucion || b.plantilla?.instituciones || ''
        } else if (sortField === 'estado') {
            valA = a.estado || ''
            valB = b.estado || ''
        } else if (sortField === 'creadoPor') {
            valA = a.usuario || ''
            valB = b.usuario || ''
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
            return sortOrder === 'asc' ? valA - valB : valB - valA
        }

        const strA = String(valA).toLowerCase()
        const strB = String(valB).toLowerCase()
        return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA)
    })

    // Datos paginados
    const totalPages = Math.ceil(sortedRespuestas.length / itemsPerPage) || 1
    const startIndex = (currentPage - 1) * itemsPerPage
    const paginatedRespuestas = sortedRespuestas.slice(startIndex, startIndex + itemsPerPage)

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                
                <div className="flex flex-col lg:flex-row justify-between items-end gap-4">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 w-full">
                        {/* 1. Lista Desplegable: Nombre de Acta */}
                        <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre del Acta</label>
                            <select
                                value={filtroNombre}
                                onChange={(e) => { setFiltroNombre(e.target.value); setCurrentPage(1); }}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 bg-white outline-none cursor-pointer transition-all"
                            >
                                <option value="">Todas las Actas (Nombre)</option>
                                {nombresActasOptions.map((nombre, i) => (
                                    <option key={i} value={nombre as string}>{nombre}</option>
                                ))}
                            </select>
                        </div>

                        {/* 2. Lista Desplegable: Licitación */}
                        <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Licitación</label>
                            <select
                                value={filtroLicitacion}
                                onChange={(e) => { setFiltroLicitacion(e.target.value); setCurrentPage(1); }}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 bg-white outline-none cursor-pointer transition-all"
                            >
                                <option value="">Todas las Licitaciones</option>
                                {licitacionesOptions.map((lic, i) => (
                                    <option key={i} value={lic as string}>Licitación #{lic}</option>
                                ))}
                            </select>
                        </div>

                        {/* 3. Lista Desplegable: Institución */}
                        <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Institución</label>
                            <select
                                value={filtroInstitucion}
                                onChange={(e) => { setFiltroInstitucion(e.target.value); setCurrentPage(1); }}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 bg-white outline-none cursor-pointer transition-all"
                            >
                                <option value="">Todas las Instituciones</option>
                                {institucionesOptions.map((inst, i) => (
                                    <option key={i} value={inst as string}>{inst}</option>
                                ))}
                            </select>
                        </div>

                        {/* 4. Lista Desplegable: Año */}
                        <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Año de Creación</label>
                            <select
                                value={filtroAnio}
                                onChange={(e) => { setFiltroAnio(e.target.value); setCurrentPage(1); }}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 bg-white outline-none cursor-pointer transition-all"
                            >
                                <option value="">Todos los Años</option>
                                {anioOptions.map((anio, i) => (
                                    <option key={i} value={anio}>{anio}</option>
                                ))}
                            </select>
                        </div>

                        {/* 5. Lista Desplegable: Mes */}
                        <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mes de Creación</label>
                            <select
                                value={filtroMes}
                                onChange={(e) => { setFiltroMes(e.target.value); setCurrentPage(1); }}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 bg-white outline-none cursor-pointer transition-all"
                            >
                                <option value="">Todos los Meses</option>
                                {mesesOptions.map((mes, i) => (
                                    <option key={i} value={mes.value}>{mes.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* 6. Lista Desplegable: Estado */}
                        <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Estado</label>
                            <select
                                value={filtroEstado}
                                onChange={(e) => { setFiltroEstado(e.target.value); setCurrentPage(1); }}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 bg-white outline-none cursor-pointer transition-all"
                            >
                                <option value="">Todos los Estados</option>
                                {estadosOptions.map((estado, i) => (
                                    <option key={i} value={estado}>{estado}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setSelectedPlantillaId('')
                            setSelectedRbd('')
                            setSelectedColegio(null)
                            setSearchQuery('')
                            setColegiosList([])
                            setIsModalOpen(true)
                        }}
                        className="w-full lg:w-auto px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-md transition-colors whitespace-nowrap flex items-center justify-center gap-2 mb-[1px]"
                    >
                        <span>➕</span> Nueva Acta
                    </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-gray-200">
                                <th onClick={() => handleSort('plantilla')} className="p-4 font-black cursor-pointer select-none hover:text-cyan-700 transition-colors">
                                    <div className="flex items-center gap-1.5">
                                        Acta (Plantilla)
                                        <span className="text-[11px] text-cyan-600 font-bold">{sortField === 'plantilla' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </div>
                                </th>
                                <th onClick={() => handleSort('establecimiento')} className="p-4 font-black cursor-pointer select-none hover:text-cyan-700 transition-colors">
                                    <div className="flex items-center gap-1.5">
                                        RBD / Establecimiento
                                        <span className="text-[11px] text-cyan-600 font-bold">{sortField === 'establecimiento' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </div>
                                </th>
                                <th onClick={() => handleSort('licitacion')} className="p-4 font-black cursor-pointer select-none hover:text-cyan-700 transition-colors">
                                    <div className="flex items-center gap-1.5">
                                        Licitación
                                        <span className="text-[11px] text-cyan-600 font-bold">{sortField === 'licitacion' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </div>
                                </th>
                                <th onClick={() => handleSort('institucion')} className="p-4 font-black cursor-pointer select-none hover:text-cyan-700 transition-colors">
                                    <div className="flex items-center gap-1.5">
                                        Institución
                                        <span className="text-[11px] text-cyan-600 font-bold">{sortField === 'institucion' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </div>
                                </th>
                                <th onClick={() => handleSort('estado')} className="p-4 font-black text-center cursor-pointer select-none hover:text-cyan-700 transition-colors">
                                    <div className="flex items-center justify-center gap-1.5">
                                        Estado
                                        <span className="text-[11px] text-cyan-600 font-bold">{sortField === 'estado' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </div>
                                </th>
                                <th onClick={() => handleSort('creadoPor')} className="p-4 font-black cursor-pointer select-none hover:text-cyan-700 transition-colors">
                                    <div className="flex items-center gap-1.5">
                                        Creado Por
                                        <span className="text-[11px] text-cyan-600 font-bold">{sortField === 'creadoPor' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </div>
                                </th>
                                <th className="p-4 font-black text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-100">
                            {paginatedRespuestas.map(acta => (
                                <tr key={acta.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-bold text-slate-800">
                                        <div>
                                            {acta.plantilla?.nombre || 'Desconocido'}
                                            {acta.correlativo && (
                                                <span className="block text-[11px] font-mono text-cyan-600 font-bold mt-0.5">
                                                    N° {String(acta.correlativo).padStart(10, '0')}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-700 font-medium">
                                        {acta.rbd ? (
                                            <div>
                                                <span className="font-bold text-cyan-700">RBD #{acta.rbd}</span>
                                                {acta.nombreEstablecimiento && (
                                                    <span className="block text-xs text-slate-500">{acta.nombreEstablecimiento}</span>
                                                )}
                                            </div>
                                        ) : 'Sin asignar'}
                                    </td>
                                    <td className="p-4 text-slate-600 font-medium">
                                        {acta.licitacionId ? `Lic. #${acta.licitacionId}` : 'N/A'}
                                    </td>
                                    <td className="p-4 text-slate-600 font-medium">
                                        {acta.institucion || (acta.plantilla?.instituciones ? 'Según Cabecera' : 'N/A')}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                            acta.estado === 'Finalizado'
                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                                        }`}>
                                            {acta.estado}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-500 text-xs">
                                        <span className="font-semibold text-slate-700">{acta.usuario}</span>
                                        <span className="block text-[10px] text-slate-400">{new Date(acta.createdAt).toLocaleDateString()}</span>
                                    </td>
                                    <td className="p-4 text-right space-x-2 flex items-center justify-end gap-1.5">
                                        <button
                                            onClick={() => router.push(`/dashboard/actas/generar-acta/${acta.id}`)}
                                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                        >
                                            {acta.estado === 'Finalizado' ? 'Ver Detalles' : 'Editar'}
                                        </button>
                                        <button
                                            onClick={() => handleExportPdf(acta.id)}
                                            disabled={loadingId === acta.id}
                                            className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                                            title="Exportar documento en PDF"
                                        >
                                            <span>📄</span> PDF
                                        </button>
                                        {isAdmin && (
                                            <button
                                                onClick={() => handleDelete(acta.id)}
                                                disabled={loadingId === acta.id}
                                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                                            >
                                                Eliminar
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {sortedRespuestas.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-slate-400">
                                        No se encontraron actas creadas.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Controles de Paginación */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                    <span className="text-xs font-semibold text-slate-500">
                        Mostrando {sortedRespuestas.length > 0 ? startIndex + 1 : 0} a {Math.min(startIndex + itemsPerPage, sortedRespuestas.length)} de {sortedRespuestas.length} registros (Página {currentPage} de {totalPages})
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 bg-white border border-gray-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                        >
                            ← Anterior
                        </button>
                        <span className="text-xs font-black text-slate-700 px-2">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage >= totalPages}
                            className="px-4 py-2 bg-white border border-gray-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                        >
                            Siguiente →
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal Nueva Acta */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                            <h3 className="text-lg font-black text-slate-900">Iniciar Nueva Acta</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
                        </div>
                        
                        {/* Paso 1: Seleccionar Plantilla */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase">1. Selecciona una Plantilla</label>
                            <select 
                                value={selectedPlantillaId}
                                onChange={(e) => handlePlantillaChange(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 text-sm font-bold text-slate-800 outline-none"
                            >
                                <option value="">-- Seleccionar Plantilla --</option>
                                {plantillas.map(p => {
                                    let formattedInst = p.instituciones || ''
                                    try {
                                        if (formattedInst.startsWith('[')) {
                                            formattedInst = JSON.parse(formattedInst).join(' • ')
                                        }
                                    } catch {}

                                    return (
                                        <option key={p.id} value={p.id}>
                                            {p.nombre} {formattedInst ? `(${formattedInst})` : ''} - Lic. #{p.licitacionId || 'N/A'}
                                        </option>
                                    )
                                })}
                            </select>
                        </div>

                        {/* Paso 2: Buscador Inteligente de RBD o Nombre */}
                        {selectedPlantillaId && (
                            <div className="space-y-2 pt-2 border-t border-gray-100">
                                <label className="block text-xs font-bold text-gray-500 uppercase flex items-center justify-between">
                                    <span>2. Buscar RBD o Establecimiento</span>
                                    {isLoadingColegios && <span className="text-cyan-600 text-[10px] animate-pulse">Buscando...</span>}
                                </label>
                                
                                {isLoadingColegios ? (
                                    <div className="p-3 text-center text-xs text-gray-400 bg-gray-50 rounded-xl">
                                        Cargando RBDs autorizados...
                                    </div>
                                ) : colegiosList.length === 0 ? (
                                    <div className="p-3 text-center text-xs text-rose-500 bg-rose-50 rounded-xl font-medium">
                                        No se encontraron RBDs autorizados para tu usuario que coincidan con la institución de esta plantilla.
                                    </div>
                                ) : (
                                    <div className="relative">
                                        {selectedColegio ? (
                                            <div className="flex items-center justify-between p-3 bg-cyan-50 border border-cyan-200 rounded-xl">
                                                <div>
                                                    <span className="font-bold text-cyan-900 text-sm">RBD #{selectedColegio.colRBD}</span>
                                                    <span className="block text-xs text-cyan-700">{selectedColegio.nombreEstablecimiento} ({selectedColegio.institucion || 'Sin inst.'})</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedColegio(null)
                                                        setSelectedRbd('')
                                                        setSearchQuery('')
                                                    }}
                                                    className="text-xs text-cyan-600 hover:text-cyan-800 font-bold px-2 py-1 bg-white rounded-lg border border-cyan-200 shadow-sm"
                                                >
                                                    Cambiar
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <input
                                                    type="text"
                                                    placeholder="Escribe el RBD o el nombre del colegio..."
                                                    value={searchQuery}
                                                    onChange={(e) => {
                                                        setSearchQuery(e.target.value)
                                                        setIsDropdownOpen(true)
                                                    }}
                                                    onFocus={() => setIsDropdownOpen(true)}
                                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 text-sm font-bold text-slate-800 outline-none"
                                                />
                                                {isDropdownOpen && (
                                                    <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl z-20 divide-y divide-gray-100">
                                                        {colegiosList
                                                            .filter(c => {
                                                                if (!searchQuery) return true
                                                                const q = searchQuery.toLowerCase()
                                                                return c.colRBD.toString().includes(q) || (c.nombreEstablecimiento || '').toLowerCase().includes(q)
                                                            })
                                                            .slice(0, 50)
                                                            .map(c => (
                                                                <button
                                                                    key={c.id || c.colRBD}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedColegio(c)
                                                                        setSelectedRbd(c.colRBD)
                                                                        setIsDropdownOpen(false)
                                                                    }}
                                                                    className="w-full text-left p-3 hover:bg-cyan-50 transition-colors flex items-center justify-between text-xs"
                                                                >
                                                                    <div className="flex flex-col text-left">
                                                                        <span className="font-black text-slate-900 text-xs">
                                                                            RBD #{c.colRBD} <span className="font-bold text-cyan-800">- {c.nombreEstablecimiento || 'Sin nombre registrado'}</span>
                                                                        </span>
                                                                        {c.comuna && (
                                                                            <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                                                                                📍 {c.comuna} {c.direccionEstablecimiento ? `• ${c.direccionEstablecimiento}` : ''}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-100 shrink-0 ml-2">
                                                                        {c.institucion || 'Sin inst.'}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        {colegiosList.filter(c => {
                                                            if (!searchQuery) return true
                                                            const q = searchQuery.toLowerCase()
                                                            return c.colRBD.toString().includes(q) || (c.nombreEstablecimiento || '').toLowerCase().includes(q)
                                                        }).length === 0 && (
                                                            <div className="p-3 text-center text-xs text-gray-400">
                                                                No se encontraron resultados coincidentes.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!selectedPlantillaId || !selectedRbd || isCreating}
                                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm uppercase tracking-wider disabled:opacity-50"
                            >
                                {isCreating ? 'Iniciando...' : 'Iniciar Acta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
