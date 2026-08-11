'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteActaResponse, getActaFullData } from '../generar-acta/actions'
import { generateActaPDF } from '../generar-acta/actaPdfUtil'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

type ActaRespuesta = {
    id: string
    plantillaId: string
    licitacionId: number | null
    anio: number | null
    rbd: number
    nombreEstablecimiento: string | null
    institucion: string | null
    sucursal?: string | null
    estado: string
    usuario: string
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

export default function DescargarActasClient({ initialRespuestas, plantillas, isAdmin }: Props) {
    const router = useRouter()
    const [respuestas, setRespuestas] = useState(initialRespuestas)
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [isZipping, setIsZipping] = useState(false)
    const [zipProgress, setZipProgress] = useState('')

    // Selección múltiple
    const [selectedIds, setSelectedIds] = useState<string[]>([])

    // Filtros de tabla
    const [filtroLicitacion, setFiltroLicitacion] = useState('')
    const [filtroNombre, setFiltroNombre] = useState('')
    const [filtroInstitucion, setFiltroInstitucion] = useState('')
    const [filtroSucursal, setFiltroSucursal] = useState('')
    const [filtroAnio, setFiltroAnio] = useState('')
    const [filtroMes, setFiltroMes] = useState('')
    const [filtroEstado, setFiltroEstado] = useState('')
    const [filtroUsuario, setFiltroUsuario] = useState('')

    // Ordenación y Paginación
    const [sortField, setSortField] = useState<string | null>(null)
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

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

    const sucursalesOptions = Array.from(
        new Set(
            respuestas
                .map(r => r.sucursal)
                .filter(Boolean)
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

    const usuariosOptions = Array.from(
        new Set(respuestas.map(r => r.usuario).filter(Boolean))
    ).sort()

    // Handler para exportar PDF individual
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

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este registro de acta de forma permanente?')) return
        setLoadingId(id)
        const res = await deleteActaResponse(id)
        if (res.success) {
            setRespuestas(prev => prev.filter(r => r.id !== id))
            setSelectedIds(prev => prev.filter(selectedId => selectedId !== id))
        } else {
            alert(res.error || 'Error al eliminar')
        }
        setLoadingId(null)
    }

    // Handler para la ordenación
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
        const matchSucursal = filtroSucursal ? (r.sucursal === filtroSucursal) : true
        const matchAnio = filtroAnio ? (r.createdAt && new Date(r.createdAt).getFullYear().toString() === filtroAnio) : true
        const matchMes = filtroMes ? (r.createdAt && new Date(r.createdAt).getMonth().toString() === filtroMes) : true
        const matchEstado = filtroEstado ? (r.estado === filtroEstado) : true
        const matchUsuario = filtroUsuario ? (r.usuario === filtroUsuario) : true
        return matchLic && matchNombre && matchInst && matchSucursal && matchAnio && matchMes && matchEstado && matchUsuario
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

    // Handlers para selección múltiple
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allSortedIds = sortedRespuestas.map(r => r.id)
            setSelectedIds(allSortedIds)
        } else {
            setSelectedIds([])
        }
    }

    const handleSelectRow = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        )
    }

    const isAllSelected = sortedRespuestas.length > 0 && sortedRespuestas.every(r => selectedIds.includes(r.id))

    // Descarga masiva ZIP
    const handleBulkDownloadZip = async () => {
        const targetIds = selectedIds.length > 0 ? selectedIds : sortedRespuestas.map(r => r.id)
        if (targetIds.length === 0) {
            alert('No hay actas seleccionadas ni disponibles para descargar.')
            return
        }

        setIsZipping(true)
        setZipProgress(`Iniciando paquete ZIP (0 / ${targetIds.length})...`)

        try {
            const zip = new JSZip()
            let completed = 0

            for (const id of targetIds) {
                const res = await getActaFullData(id)
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
                    const pdfArrayBuffer = doc.output('arraybuffer')
                    const cleanName = (fullActa.nombreEstablecimiento || 'Colegio').replace(/[^a-zA-Z0-9]/g, '_')
                    const fechaStr = new Date(fullActa.createdAt).toISOString().slice(0, 10)
                    const filename = `Acta_${cleanName}_RBD${fullActa.rbd || '0'}_${fechaStr}_${id.slice(0, 6)}.pdf`

                    zip.file(filename, pdfArrayBuffer)
                }
                completed++
                setZipProgress(`Procesando actas (${completed} / ${targetIds.length})...`)
            }

            setZipProgress('Generando archivo ZIP...')
            const blob = await zip.generateAsync({ type: 'blob' })
            const dateSuffix = new Date().toISOString().slice(0, 10)
            saveAs(blob, `Actas_Supervision_Descarga_${dateSuffix}.zip`)
        } catch (err: any) {
            alert('Error al empaquetar actas en ZIP: ' + (err.message || String(err)))
        } finally {
            setIsZipping(false)
            setZipProgress('')
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                
                <div className="flex flex-col lg:flex-row justify-between items-end gap-4">
                    {/* Filtros superiores */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 w-full">
                        {/* 1. Nombre de Acta */}
                        <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre del Acta</label>
                            <select
                                value={filtroNombre}
                                onChange={(e) => { setFiltroNombre(e.target.value); setCurrentPage(1); }}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 bg-white outline-none cursor-pointer transition-all"
                            >
                                <option value="">Todas las Actas</option>
                                {nombresActasOptions.map((nombre, i) => (
                                    <option key={i} value={nombre as string}>{nombre}</option>
                                ))}
                            </select>
                        </div>

                        {/* 2. Licitación */}
                        <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Licitación</label>
                            <select
                                value={filtroLicitacion}
                                onChange={(e) => { setFiltroLicitacion(e.target.value); setCurrentPage(1); }}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 bg-white outline-none cursor-pointer transition-all"
                            >
                                <option value="">Todas Licitaciones</option>
                                {licitacionesOptions.map((lic, i) => (
                                    <option key={i} value={lic as string}>Lic. #{lic}</option>
                                ))}
                            </select>
                        </div>

                        {/* 3. Institución */}
                        <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Institución</label>
                            <select
                                value={filtroInstitucion}
                                onChange={(e) => { setFiltroInstitucion(e.target.value); setCurrentPage(1); }}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 bg-white outline-none cursor-pointer transition-all"
                            >
                                <option value="">Todas Instituciones</option>
                                {institucionesOptions.map((inst, i) => (
                                    <option key={i} value={inst as string}>{inst}</option>
                                ))}
                            </select>
                        </div>

                        {/* 4. Sucursal */}
                        <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sucursal</label>
                            <select
                                value={filtroSucursal}
                                onChange={(e) => { setFiltroSucursal(e.target.value); setCurrentPage(1); }}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 bg-white outline-none cursor-pointer transition-all"
                            >
                                <option value="">Todas Sucursales</option>
                                {sucursalesOptions.map((suc, i) => (
                                    <option key={i} value={suc as string}>{suc}</option>
                                ))}
                            </select>
                        </div>

                        {/* 5. Año */}
                        <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Año Creación</label>
                            <select
                                value={filtroAnio}
                                onChange={(e) => { setFiltroAnio(e.target.value); setCurrentPage(1); }}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 bg-white outline-none cursor-pointer transition-all"
                            >
                                <option value="">Todos los Años</option>
                                {anioOptions.map((anio, i) => (
                                    <option key={i} value={anio}>{anio}</option>
                                ))}
                            </select>
                        </div>

                        {/* 6. Mes */}
                        <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mes Creación</label>
                            <select
                                value={filtroMes}
                                onChange={(e) => { setFiltroMes(e.target.value); setCurrentPage(1); }}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 bg-white outline-none cursor-pointer transition-all"
                            >
                                <option value="">Todos los Meses</option>
                                {mesesOptions.map((mes, i) => (
                                    <option key={i} value={mes.value}>{mes.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* 7. Estado */}
                        <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Estado</label>
                            <select
                                value={filtroEstado}
                                onChange={(e) => { setFiltroEstado(e.target.value); setCurrentPage(1); }}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 bg-white outline-none cursor-pointer transition-all"
                            >
                                <option value="">Todos los Estados</option>
                                {estadosOptions.map((estado, i) => (
                                    <option key={i} value={estado}>{estado}</option>
                                ))}
                            </select>
                        </div>

                        {/* 8. Usuario Creador */}
                        <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Usuario Creador</label>
                            <select
                                value={filtroUsuario}
                                onChange={(e) => { setFiltroUsuario(e.target.value); setCurrentPage(1); }}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 bg-white outline-none cursor-pointer transition-all"
                            >
                                <option value="">Todos los Usuarios</option>
                                {usuariosOptions.map((user, i) => (
                                    <option key={i} value={user}>{user}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Botón Descarga Masiva ZIP */}
                    <button
                        onClick={handleBulkDownloadZip}
                        disabled={isZipping || sortedRespuestas.length === 0}
                        className="w-full lg:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md transition-all whitespace-nowrap flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mb-[1px]"
                    >
                        <span>📦</span>
                        <span>
                            {isZipping
                                ? zipProgress
                                : selectedIds.length > 0
                                    ? `Descargar ${selectedIds.length} Seleccionadas (ZIP)`
                                    : `Descargar Filtradas (${sortedRespuestas.length}) (ZIP)`}
                        </span>
                    </button>
                </div>

                {/* Tabla de Actas */}
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-gray-200">
                                <th className="p-4 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                        title="Seleccionar todas las actas filtradas"
                                    />
                                </th>
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
                            {paginatedRespuestas.map(acta => {
                                const isSelected = selectedIds.includes(acta.id)
                                return (
                                    <tr key={acta.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-cyan-50/40' : ''}`}>
                                        <td className="p-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleSelectRow(acta.id)}
                                                className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                            />
                                        </td>
                                        <td className="p-4 font-bold text-slate-800">
                                            {acta.plantilla?.nombre || 'Desconocido'}
                                        </td>
                                        <td className="p-4 text-slate-700 font-medium">
                                            {acta.rbd ? (
                                                <div>
                                                    <span className="font-bold text-cyan-700">RBD #{acta.rbd}</span>
                                                    {acta.nombreEstablecimiento && (
                                                        <span className="block text-xs text-slate-500">{acta.nombreEstablecimiento}</span>
                                                    )}
                                                    {acta.sucursal && (
                                                        <span className="inline-block mt-0.5 text-[9px] font-bold text-cyan-800 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-100">{acta.sucursal}</span>
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
                                                Ver Detalles
                                            </button>
                                            <button
                                                onClick={() => handleExportPdf(acta.id)}
                                                disabled={loadingId === acta.id}
                                                className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                                                title="Descargar PDF individual"
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
                                )
                            })}
                            {sortedRespuestas.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-slate-400">
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
        </div>
    )
}
