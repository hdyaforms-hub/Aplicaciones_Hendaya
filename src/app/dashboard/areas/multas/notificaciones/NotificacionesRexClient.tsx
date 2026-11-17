'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import {
    NotificacionRexCabDTO,
    cargarNotificacionRexAction,
    eliminarNotificacionRexAction,
    getNotificacionesListAction
} from './actions'
import {
    FileSpreadsheet,
    UploadCloud,
    RefreshCw,
    Search,
    ChevronRight,
    AlertCircle,
    Calendar,
    CheckCircle2,
    Clock,
    Trash2,
    FileText,
    ArrowUpDown,
    X,
    Filter,
    ShieldAlert,
    ExternalLink
} from 'lucide-react'

interface Props {
    initialList: NotificacionRexCabDTO[]
    licitaciones: Array<{ value: string; label: string }>
    canManage: boolean
}

const MESES = [
    { num: 1, label: 'Enero' },
    { num: 2, label: 'Febrero' },
    { num: 3, label: 'Marzo' },
    { num: 4, label: 'Abril' },
    { num: 5, label: 'Mayo' },
    { num: 6, label: 'Junio' },
    { num: 7, label: 'Julio' },
    { num: 8, label: 'Agosto' },
    { num: 9, label: 'Septiembre' },
    { num: 10, label: 'Octubre' },
    { num: 11, label: 'Noviembre' },
    { num: 12, label: 'Diciembre' }
]

export default function NotificacionesRexClient({ initialList, licitaciones, canManage }: Props) {
    const [list, setList] = useState<NotificacionRexCabDTO[]>(initialList)
    const [isPending, startTransition] = useTransition()
    const [search, setSearch] = useState('')
    const [filtroEstado, setFiltroEstado] = useState('TODOS')
    const [filtroAnio, setFiltroAnio] = useState('TODOS')

    // Modal de Carga de REX
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [numResolucion, setNumResolucion] = useState('')
    const [fechaResolucion, setFechaResolucion] = useState('')
    const [periodoMes, setPeriodoMes] = useState(new Date().getMonth() + 1)
    const [periodoAnio, setPeriodoAnio] = useState(new Date().getFullYear())
    const [selectedLicId, setSelectedLicId] = useState('')
    const [observaciones, setObservaciones] = useState('')
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

    // Recargar listado
    const reloadList = () => {
        startTransition(async () => {
            const res = await getNotificacionesListAction()
            if (res.success && res.data) {
                setList(res.data)
            }
        })
    }

    // Manejar envío del formulario de carga
    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setUploadError(null)
        setUploadSuccess(null)

        if (!selectedFile) {
            setUploadError('Por favor selecciona un archivo Excel (.xlsx o .xls).')
            return
        }

        const formData = new FormData()
        formData.append('file', selectedFile)
        formData.append('numeroResolucion', numResolucion)
        formData.append('fechaResolucion', fechaResolucion)
        formData.append('periodoMes', String(periodoMes))
        formData.append('periodoAnio', String(periodoAnio))
        formData.append('licitacionId', selectedLicId)

        const selectedLicObj = licitaciones.find(l => l.value === selectedLicId)
        if (selectedLicObj?.label) {
            formData.append('licitacionNombre', selectedLicObj.label)
        }
        formData.append('observaciones', observaciones)

        startTransition(async () => {
            const res = await cargarNotificacionRexAction(formData)
            if (res.success) {
                setUploadSuccess('Resolución REX y nómina cargada exitosamente.')
                setSelectedFile(null)
                setNumResolucion('')
                setFechaResolucion('')
                setObservaciones('')
                reloadList()
                setTimeout(() => {
                    setIsModalOpen(false)
                    setUploadSuccess(null)
                }, 1500)
            } else {
                setUploadError(res.error || 'Ocurrió un error al procesar el archivo.')
            }
        })
    }

    // Eliminar resolución
    const handleDelete = async (id: string, numRex: string) => {
        if (!confirm(`¿Estás seguro de eliminar la resolución "${numRex}" y todos sus items asociados? Esta acción no se puede deshacer.`)) {
            return
        }
        startTransition(async () => {
            const res = await eliminarNotificacionRexAction(id)
            if (res.success) {
                reloadList()
            } else {
                alert(res.error || 'Error al eliminar la resolución.')
            }
        })
    }

    // Filtrar resoluciones
    const filteredList = list.filter(r => {
        if (filtroEstado !== 'TODOS' && r.estado !== filtroEstado) return false
        if (filtroAnio !== 'TODOS' && String(r.periodoAnio) !== filtroAnio) return false
        if (search.trim()) {
            const term = search.trim().toLowerCase()
            const matchRex = r.numeroResolucion.toLowerCase().includes(term)
            const matchLic = (r.licitacionNombre || '').toLowerCase().includes(term)
            const matchArch = r.nombreArchivo.toLowerCase().includes(term)
            if (!matchRex && !matchLic && !matchArch) return false
        }
        return true
    })

    // Métricas consolidadas
    const totalRex = list.length
    const totalFilas = list.reduce((acc, r) => acc + r.totalFilasNotif, 0)
    const totalMontoNotificado = list.reduce((acc, r) => acc + r.montoTotalNotificado, 0)
    const totalMontoCalculado = list.reduce((acc, r) => acc + r.montoTotalCalculado, 0)
    const totalDiferencia = list.reduce((acc, r) => acc + r.montoTotalDiferencia, 0)

    const aniosDisponibles = Array.from(new Set(list.map(r => r.periodoAnio))).sort((a, b) => b - a)

    return (
        <div className="space-y-6 max-w-[1700px] mx-auto p-2 sm:p-4">
            {/* CABECERA CORPORATIVA OFICIAL HENDAYA */}
            <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-700/60 overflow-hidden">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="font-mono text-cyan-400 font-extrabold tracking-widest text-xs uppercase px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60">
                                HENDAYA · FISCALIZACIÓN Y MULTAS JUNAEB
                            </span>
                            <span className="text-slate-400 text-xs font-semibold">
                                Módulo C6: Resoluciones Exentas y Anexo 1
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                            <span>Notificaciones JUNAEB (REX)</span>
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                            Registro oficial de resoluciones exentas (REX), cruce fila por fila contra el cálculo interno de Hendaya, identificación de errores de JUNAEB y generación de contrapropuestas Anexo 1.
                        </p>
                    </div>

                    {/* Botones de Cabecera */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            type="button"
                            onClick={reloadList}
                            disabled={isPending}
                            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-sm disabled:opacity-60 cursor-pointer"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-cyan-400' : 'text-slate-300'}`} />
                            <span>Actualizar</span>
                        </button>

                        {canManage && (
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-md cursor-pointer"
                            >
                                <UploadCloud className="w-4 h-4" />
                                <span>Cargar Nueva REX</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* TARJETAS DE KPIS CONSOLIDADOS */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Resoluciones</span>
                        <FileSpreadsheet className="w-4 h-4 text-cyan-600" />
                    </span>
                    <p className="text-2xl font-extrabold text-slate-900 mt-2">{totalRex}</p>
                    <span className="text-[10px] text-slate-400 mt-1">{totalFilas.toLocaleString('es-CL')} folios/infracciones</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Notificado JUNAEB</span>
                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                    </span>
                    <p className="text-2xl font-extrabold text-rose-700 mt-2">{totalMontoNotificado.toFixed(2)} <span className="text-xs font-normal">UTM</span></p>
                    <span className="text-[10px] text-rose-600/80 mt-1">Sanción pretendida</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Cálculo Hendaya</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </span>
                    <p className="text-2xl font-extrabold text-emerald-700 mt-2">{totalMontoCalculado.toFixed(2)} <span className="text-xs font-normal">UTM</span></p>
                    <span className="text-[10px] text-emerald-600/80 mt-1">Sanción sustentada interna</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-cyan-200 bg-cyan-50/20 shadow-sm flex flex-col justify-between">
                    <span className="text-[10.5px] font-bold text-cyan-700 uppercase tracking-wider flex items-center justify-between">
                        <span>Diferencia Objetable</span>
                        <AlertCircle className="w-4 h-4 text-cyan-600" />
                    </span>
                    <p className="text-2xl font-extrabold text-cyan-800 mt-2">{totalDiferencia.toFixed(2)} <span className="text-xs font-normal">UTM</span></p>
                    <span className="text-[10px] text-cyan-700 mt-1">Monto defendible</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Efectividad Conciliación</span>
                        <Clock className="w-4 h-4 text-indigo-600" />
                    </span>
                    <p className="text-2xl font-extrabold text-indigo-700 mt-2">
                        {totalMontoNotificado > 0 ? `${Math.round(((totalMontoNotificado - totalDiferencia) / totalMontoNotificado) * 100)}%` : '100%'}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1">Alineación de criterios</span>
                </div>
            </div>

            {/* BARRA DE FILTROS */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por N° REX, licitación o archivo..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <span>Estado:</span>
                        <select
                            value={filtroEstado}
                            onChange={e => setFiltroEstado(e.target.value)}
                            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        >
                            <option value="TODOS">Todos</option>
                            <option value="BORRADOR">Borrador</option>
                            <option value="CONCILIADO">Conciliado</option>
                            <option value="EN_DESCARGO">En Descargo</option>
                            <option value="CERRADO">Cerrado</option>
                        </select>
                    </div>

                    {aniosDisponibles.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <span>Año:</span>
                            <select
                                value={filtroAnio}
                                onChange={e => setFiltroAnio(e.target.value)}
                                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                            >
                                <option value="TODOS">Todos</option>
                                {aniosDisponibles.map(a => (
                                    <option key={a} value={String(a)}>{a}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* TABLA DE RESOLUCIONES EXENTAS (REX) */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-slate-800">
                        Mostrando <strong className="text-cyan-700">{filteredList.length}</strong> resoluciones registradas
                    </span>
                    {isPending && <span className="text-xs text-cyan-600 animate-pulse font-medium">Actualizando...</span>}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11.5px]">
                        <thead>
                            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10.5px]">
                                <th className="py-3 px-4">Resolución Exenta (REX)</th>
                                <th className="py-3 px-3">Fecha REX</th>
                                <th className="py-3 px-3">Período Evaluado</th>
                                <th className="py-3 px-3">Licitación</th>
                                <th className="py-3 px-3 text-center">Items / Folios</th>
                                <th className="py-3 px-3 text-right">Notificado (UTM)</th>
                                <th className="py-3 px-3 text-right">Calculado (UTM)</th>
                                <th className="py-3 px-3 text-right">Diferencia (UTM)</th>
                                <th className="py-3 px-3 text-center">Estado</th>
                                <th className="py-3 px-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {filteredList.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-slate-400">
                                        <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                        <p className="font-bold text-slate-700">No se encontraron resoluciones REX registradas</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Carga una nueva planilla oficial del Anexo 1 para comenzar la conciliación.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredList.map(r => {
                                    const mesNombre = MESES.find(m => m.num === r.periodoMes)?.label || `Mes ${r.periodoMes}`
                                    let badgeEstadoClass = 'bg-slate-100 text-slate-700 border-slate-200'
                                    if (r.estado === 'CONCILIADO') badgeEstadoClass = 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
                                    else if (r.estado === 'EN_DESCARGO') badgeEstadoClass = 'bg-cyan-50 text-cyan-800 border-cyan-200 font-bold'
                                    else if (r.estado === 'CERRADO') badgeEstadoClass = 'bg-indigo-50 text-indigo-800 border-indigo-200'

                                    return (
                                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="font-extrabold text-slate-900 text-xs">
                                                    {r.numeroResolucion}
                                                </div>
                                                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5" title={r.nombreArchivo}>
                                                    <span>📄 {r.nombreArchivo}</span>
                                                    <span>• Por {r.cargadoPor}</span>
                                                </div>
                                            </td>

                                            <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                                                {r.fechaResolucion || '-'}
                                            </td>

                                            <td className="py-3 px-3 whitespace-nowrap">
                                                <span className="font-bold text-slate-800">{mesNombre} {r.periodoAnio}</span>
                                            </td>

                                            <td className="py-3 px-3">
                                                <span className="text-xs font-semibold text-slate-700 truncate max-w-[170px] block" title={r.licitacionNombre || ''}>
                                                    {r.licitacionNombre || (r.licitacionId ? `Licitación #${r.licitacionId}` : 'No especificada')}
                                                </span>
                                            </td>

                                            <td className="py-3 px-3 text-center whitespace-nowrap">
                                                <span className="font-mono font-bold text-slate-800">{r.totalFilasNotif}</span>
                                                <span className="text-[10px] text-slate-400 block">{r.totalFoliosNotif} folios</span>
                                            </td>

                                            <td className="py-3 px-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                                                {r.montoTotalNotificado.toFixed(2)}
                                            </td>

                                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                                                {r.montoTotalCalculado.toFixed(2)}
                                            </td>

                                            <td className="py-3 px-3 text-right font-mono font-black text-cyan-800 whitespace-nowrap">
                                                {r.montoTotalDiferencia > 0 ? `+${r.montoTotalDiferencia.toFixed(2)}` : r.montoTotalDiferencia.toFixed(2)}
                                            </td>

                                            <td className="py-3 px-3 text-center whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border ${badgeEstadoClass}`}>
                                                    {r.estado}
                                                </span>
                                            </td>

                                            <td className="py-3 px-4 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Link
                                                        href={`/dashboard/areas/multas/notificaciones/${r.id}`}
                                                        className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                                                        title="Ver detalle y conciliar"
                                                    >
                                                        <span>Detalle</span>
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    </Link>

                                                    {canManage && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(r.id, r.numeroResolucion)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                                                            title="Eliminar resolución"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
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

            {/* MODAL DE CARGA DE NUEVA REX */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-cyan-100 text-cyan-800 rounded-xl">
                                    <UploadCloud className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-base text-slate-900">Cargar Resolución Exenta (REX)</h3>
                                    <p className="text-xs text-slate-500">Importación oficial de Anexo 1 de multas JUNAEB</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsModalOpen(false)
                                    setUploadError(null)
                                    setUploadSuccess(null)
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUploadSubmit} className="space-y-4">
                            {/* Archivo Excel */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Archivo Excel Anexo 1 (.xlsx, .xls) *
                                </label>
                                <div className="border-2 border-dashed border-slate-200 hover:border-cyan-500 rounded-2xl p-5 text-center cursor-pointer transition bg-slate-50/50 hover:bg-cyan-50/20">
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls"
                                        id="rex-file-input"
                                        onChange={e => {
                                            if (e.target.files && e.target.files[0]) {
                                                setSelectedFile(e.target.files[0])
                                            }
                                        }}
                                        className="hidden"
                                    />
                                    <label htmlFor="rex-file-input" className="cursor-pointer space-y-2 block">
                                        <FileSpreadsheet className="w-8 h-8 mx-auto text-cyan-600" />
                                        {selectedFile ? (
                                            <div>
                                                <p className="font-extrabold text-slate-900 text-xs">{selectedFile.name}</p>
                                                <p className="text-[10.5px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="font-bold text-slate-800 text-xs">Haz clic para buscar la nómina Excel</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">Debe contener columnas: Folio, RBD, Aspecto, Monto UTM...</p>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </div>

                            {/* Número de Resolución y Fecha */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        N° Resolución Exenta *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={numResolucion}
                                        onChange={e => setNumResolucion(e.target.value)}
                                        placeholder="Ej: REX N° 1824/2025"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        Fecha Resolución
                                    </label>
                                    <input
                                        type="date"
                                        value={fechaResolucion}
                                        onChange={e => setFechaResolucion(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                    />
                                </div>
                            </div>

                            {/* Período Evaluado */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        Mes Evaluado *
                                    </label>
                                    <select
                                        value={periodoMes}
                                        onChange={e => setPeriodoMes(parseInt(e.target.value, 10))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                    >
                                        {MESES.map(m => (
                                            <option key={m.num} value={m.num}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        Año Evaluado *
                                    </label>
                                    <select
                                        value={periodoAnio}
                                        onChange={e => setPeriodoAnio(parseInt(e.target.value, 10))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                    >
                                        {[2024, 2025, 2026, 2027].map(a => (
                                            <option key={a} value={a}>{a}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Licitación */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Licitación Asociada
                                </label>
                                <select
                                    value={selectedLicId}
                                    onChange={e => setSelectedLicId(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                >
                                    <option value="">Seleccionar licitación (opcional)...</option>
                                    {licitaciones.map(l => (
                                        <option key={l.value} value={l.value}>
                                            {l.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Observaciones */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Observaciones / Notas
                                </label>
                                <textarea
                                    rows={2}
                                    value={observaciones}
                                    onChange={e => setObservaciones(e.target.value)}
                                    placeholder="Notas de recepción, plazos de descargo o comentarios adicionales..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                />
                            </div>

                            {/* Mensajes de feedback */}
                            {uploadError && (
                                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                    <span>{uploadError}</span>
                                </div>
                            )}

                            {uploadSuccess && (
                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>{uploadSuccess}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={isPending}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!selectedFile || !numResolucion || isPending}
                                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                                >
                                    {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />}
                                    <span>{isPending ? 'Cargando y procesando...' : 'Cargar Resolución'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
