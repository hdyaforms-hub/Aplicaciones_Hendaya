'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area, ComposedChart, Line
} from 'recharts'
import { getActaFullData } from '../../actas/generar-acta/actions'
import { generateActaPDF } from '../../actas/generar-acta/actaPdfUtil'

type ActaItem = {
    id: string
    plantillaId: string
    licitacionId: number | null
    anio: number
    mes: number
    rbd: number
    nombreEstablecimiento: string
    institucion: string
    sucursal: string
    fechaCreacion: string
    supervisorNombre: string
    usuario: string
    estado: string
    plantillaNombre: string
    correlativo?: number | null
    hasFirma?: boolean
}

type LicitacionItem = {
    licId: number
    licitacionHomologada: string | null
}

type ColegioItem = {
    colRBD: number
    nombreEstablecimiento: string
    institucion: string
    sucursal: string
    comuna: string
}

type Props = {
    initialActas: ActaItem[]
    licitaciones: LicitacionItem[]
    colegiosList: ColegioItem[]
}

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const MONTH_SHORT = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
]

const CHART_COLORS = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#6366F1', '#14B8A6', '#F97316']

const STATUS_COLORS: Record<string, { bg: string, text: string, chart: string }> = {
    'Finalizado': { bg: 'bg-emerald-100', text: 'text-emerald-800', chart: '#10B981' },
    'Finalizada': { bg: 'bg-emerald-100', text: 'text-emerald-800', chart: '#10B981' },
    'Completado': { bg: 'bg-emerald-100', text: 'text-emerald-800', chart: '#10B981' },
    'Completada': { bg: 'bg-emerald-100', text: 'text-emerald-800', chart: '#10B981' },
    'Firmado': { bg: 'bg-teal-100', text: 'text-teal-800', chart: '#14B8A6' },
    'Firmada': { bg: 'bg-teal-100', text: 'text-teal-800', chart: '#14B8A6' },
    'En Proceso': { bg: 'bg-sky-100', text: 'text-sky-800', chart: '#0EA5E9' },
    'En Revisión': { bg: 'bg-amber-100', text: 'text-amber-800', chart: '#F59E0B' },
    'Borrador': { bg: 'bg-slate-100', text: 'text-slate-700', chart: '#94A3B8' }
}

export default function ActasDashboardClient({ initialActas, licitaciones, colegiosList }: Props) {
    // Filtros de estado
    const [filtroLicitacion, setFiltroLicitacion] = useState<string>('')
    const [filtroAnio, setFiltroAnio] = useState<string>('')
    const [filtroMes, setFiltroMes] = useState<string>('')
    const [filtroInstitucion, setFiltroInstitucion] = useState<string>('')
    const [filtroUsuario, setFiltroUsuario] = useState<string>('')
    const [filtroNombreActa, setFiltroNombreActa] = useState<string>('')
    
    // Autocompletado inteligente RBD / Establecimiento
    const [selectedRbd, setSelectedRbd] = useState<number | null>(null)
    const [rbdSearchInput, setRbdSearchInput] = useState<string>('')
    const [isRbdDropdownOpen, setIsRbdDropdownOpen] = useState<boolean>(false)
    const rbdContainerRef = useRef<HTMLDivElement>(null)

    // Búsqueda y paginación para la tabla de detalle
    const [tableSearch, setTableSearch] = useState<string>('')
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [exportingId, setExportingId] = useState<string | null>(null)
    const itemsPerPage = 10

    // Cierre de dropdown de autocompletado al hacer clic fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (rbdContainerRef.current && !rbdContainerRef.current.contains(event.target as Node)) {
                setIsRbdDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Autocompletado opciones filtradas
    const rbdSuggestions = useMemo(() => {
        if (!rbdSearchInput.trim()) return []
        const query = rbdSearchInput.toLowerCase().trim()
        
        // Primero buscar en lista completa de colegios
        const matches = colegiosList.filter(c => 
            c.colRBD.toString().includes(query) ||
            c.nombreEstablecimiento.toLowerCase().includes(query) ||
            c.comuna.toLowerCase().includes(query)
        )

        // Si la lista de colegios no tiene algunos RBDs presentes en actas, agregar desde actas
        const uniqueActaRbdMap = new Map<number, string>()
        initialActas.forEach(a => {
            if (!uniqueActaRbdMap.has(a.rbd)) {
                uniqueActaRbdMap.set(a.rbd, a.nombreEstablecimiento)
            }
        })

        const combinedList = [...matches]
        uniqueActaRbdMap.forEach((name, rbd) => {
            if (!combinedList.some(c => c.colRBD === rbd) && (rbd.toString().includes(query) || name.toLowerCase().includes(query))) {
                combinedList.push({
                    colRBD: rbd,
                    nombreEstablecimiento: name,
                    institucion: 'N/A',
                    sucursal: 'N/A',
                    comuna: 'N/A'
                })
            }
        })

        return combinedList.slice(0, 12)
    }, [rbdSearchInput, colegiosList, initialActas])

    // Listas únicas para los selectores de filtro
    const availableAnios = useMemo(() => {
        const yearsSet = new Set<number>()
        initialActas.forEach(a => { if (a.anio) yearsSet.add(a.anio) })
        if (!yearsSet.has(new Date().getFullYear())) yearsSet.add(new Date().getFullYear())
        return Array.from(yearsSet).sort((a, b) => b - a)
    }, [initialActas])

    const availableInstituciones = useMemo(() => {
        const instSet = new Set<string>()
        initialActas.forEach(a => { if (a.institucion) instSet.add(a.institucion) })
        colegiosList.forEach(c => { if (c.institucion) instSet.add(c.institucion) })
        return Array.from(instSet).sort()
    }, [initialActas, colegiosList])

    const availableUsuarios = useMemo(() => {
        const userSet = new Set<string>()
        initialActas.forEach(a => {
            if (a.usuario) userSet.add(a.usuario)
            if (a.supervisorNombre) userSet.add(a.supervisorNombre)
        })
        return Array.from(userSet).sort()
    }, [initialActas])

    const availableNombresActas = useMemo(() => {
        const nameSet = new Set<string>()
        initialActas.forEach(a => { if (a.plantillaNombre) nameSet.add(a.plantillaNombre) })
        return Array.from(nameSet).sort()
    }, [initialActas])

    // Resetear todos los filtros
    const handleResetFilters = () => {
        setFiltroLicitacion('')
        setFiltroAnio('')
        setFiltroMes('')
        setFiltroInstitucion('')
        setFiltroUsuario('')
        setFiltroNombreActa('')
        setSelectedRbd(null)
        setRbdSearchInput('')
        setCurrentPage(1)
    }

    // Filtrar la lista de actas en tiempo real
    const filteredActas = useMemo(() => {
        return initialActas.filter(acta => {
            if (filtroLicitacion && acta.licitacionId?.toString() !== filtroLicitacion) return false
            if (filtroAnio && acta.anio.toString() !== filtroAnio) return false
            if (filtroMes && acta.mes.toString() !== filtroMes) return false
            if (filtroInstitucion && acta.institucion.toLowerCase() !== filtroInstitucion.toLowerCase()) return false
            if (filtroUsuario && acta.usuario !== filtroUsuario && acta.supervisorNombre !== filtroUsuario) return false
            if (filtroNombreActa && acta.plantillaNombre.toLowerCase() !== filtroNombreActa.toLowerCase()) return false
            if (selectedRbd !== null && acta.rbd !== selectedRbd) return false
            return true
        })
    }, [initialActas, filtroLicitacion, filtroAnio, filtroMes, filtroInstitucion, filtroUsuario, filtroNombreActa, selectedRbd])

    // Métricas KPI
    const totalActas = filteredActas.length
    const actasCompletadasCount = useMemo(() => {
        return filteredActas.filter(a => ['Finalizado', 'Finalizada', 'Completado', 'Completada', 'Firmado', 'Firmada'].includes(a.estado)).length
    }, [filteredActas])
    const tasaCompletado = totalActas > 0 ? ((actasCompletadasCount / totalActas) * 100).toFixed(1) : '0'

    const distinctRbdCount = useMemo(() => {
        return new Set(filteredActas.map(a => a.rbd)).size
    }, [filteredActas])

    const actasFirmadasCount = useMemo(() => {
        return filteredActas.filter(a => a.hasFirma).length
    }, [filteredActas])
    const tasaFirmadas = totalActas > 0 ? ((actasFirmadasCount / totalActas) * 100).toFixed(1) : '0'

    const firmasPorUsuarioData = useMemo(() => {
        const map = new Map<string, { name: string, 'Con Firma': number, 'Sin Firma': number }>()
        filteredActas.forEach(a => {
            const u = a.supervisorNombre || a.usuario || 'Desconocido'
            const existing = map.get(u) || { name: u, 'Con Firma': 0, 'Sin Firma': 0 }
            if (a.hasFirma) {
                existing['Con Firma'] += 1
            } else {
                existing['Sin Firma'] += 1
            }
            map.set(u, existing)
        })
        return Array.from(map.values())
            .sort((a, b) => (b['Con Firma'] + b['Sin Firma']) - (a['Con Firma'] + a['Sin Firma']))
            .slice(0, 10)
    }, [filteredActas])

    const distinctUsuariosCount = useMemo(() => {
        const setU = new Set<string>()
        filteredActas.forEach(a => {
            if (a.usuario) setU.add(a.usuario)
        })
        return setU.size
    }, [filteredActas])

    const distinctInstitucionesCount = useMemo(() => {
        return new Set(filteredActas.map(a => a.institucion || 'JUNAEB')).size
    }, [filteredActas])

    const actasPorInstitucionList = useMemo(() => {
        const map = new Map<string, number>()
        filteredActas.forEach(a => {
            const inst = a.institucion || 'JUNAEB'
            map.set(inst, (map.get(inst) || 0) + 1)
        })
        return Array.from(map.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
    }, [filteredActas])

    // Gráfico 1: Actas por RBD (Top 10)
    const actasPorRbdData = useMemo(() => {
        const map = new Map<number, { rbd: number, nombre: string, count: number }>()
        filteredActas.forEach(a => {
            const existing = map.get(a.rbd)
            if (existing) {
                existing.count += 1
            } else {
                map.set(a.rbd, { rbd: a.rbd, nombre: a.nombreEstablecimiento, count: 1 })
            }
        })
        return Array.from(map.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
            .map(item => ({
                label: `RBD ${item.rbd}`,
                fullName: `${item.nombre} (RBD ${item.rbd})`,
                count: item.count
            }))
    }, [filteredActas])

    // Gráfico 2: Usuarios por Actas (Top 10)
    const usuariosPorActasData = useMemo(() => {
        const map = new Map<string, number>()
        filteredActas.forEach(a => {
            const userKey = a.supervisorNombre || a.usuario || 'Desconocido'
            map.set(userKey, (map.get(userKey) || 0) + 1)
        })
        return Array.from(map.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
    }, [filteredActas])

    // Gráfico 3: Usuarios por RBD y Actas x Mes (Ene-Dic)
    const tendenciaMensualData = useMemo(() => {
        const monthsData = MONTH_SHORT.map((m, idx) => ({
            mes: m,
            mesNum: idx + 1,
            totalActas: 0,
            usuariosDistintos: new Set<string>(),
            rbdDistintos: new Set<number>(),
            completadas: 0,
            borradores: 0
        }))

        filteredActas.forEach(a => {
            const idx = a.mes - 1
            if (idx >= 0 && idx < 12) {
                monthsData[idx].totalActas += 1
                if (a.usuario) monthsData[idx].usuariosDistintos.add(a.usuario)
                monthsData[idx].rbdDistintos.add(a.rbd)
                if (['Finalizado', 'Finalizada', 'Completado', 'Completada', 'Firmado', 'Firmada'].includes(a.estado)) {
                    monthsData[idx].completadas += 1
                } else {
                    monthsData[idx].borradores += 1
                }
            }
        })

        return monthsData.map(m => ({
            mes: m.mes,
            'Total Actas': m.totalActas,
            'Usuarios Activos': m.usuariosDistintos.size,
            'RBDs Auditados': m.rbdDistintos.size,
            'Completadas': m.completadas,
            'Borradores/En Proceso': m.borradores
        }))
    }, [filteredActas])

    // Gráfico 4: Avances de Actas (Pie / Doughnut Chart)
    const avancesActasData = useMemo(() => {
        const map = new Map<string, number>()
        filteredActas.forEach(a => {
            const st = a.estado || 'Borrador'
            map.set(st, (map.get(st) || 0) + 1)
        })
        return Array.from(map.entries()).map(([name, value]) => ({
            name,
            value,
            color: STATUS_COLORS[name]?.chart || '#94A3B8'
        }))
    }, [filteredActas])

    // Gráfico 5: Actas por Nombre de Acta / Plantilla
    const actasPorNombreData = useMemo(() => {
        const map = new Map<string, number>()
        filteredActas.forEach(a => {
            const name = a.plantillaNombre || 'Acta sin Nombre'
            map.set(name, (map.get(name) || 0) + 1)
        })
        return Array.from(map.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
    }, [filteredActas])

    // Gráfico 6: Actas por Licitación e Institución
    const actasPorInstitucionData = useMemo(() => {
        const map = new Map<string, number>()
        filteredActas.forEach(a => {
            const inst = a.institucion || 'JUNAEB'
            map.set(inst, (map.get(inst) || 0) + 1)
        })
        return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
    }, [filteredActas])

    // Filtrado de la tabla de detalle
    const tableFilteredActas = useMemo(() => {
        if (!tableSearch.trim()) return filteredActas
        const query = tableSearch.toLowerCase().trim()
        return filteredActas.filter(a =>
            a.nombreEstablecimiento.toLowerCase().includes(query) ||
            a.rbd.toString().includes(query) ||
            a.usuario.toLowerCase().includes(query) ||
            a.supervisorNombre.toLowerCase().includes(query) ||
            a.plantillaNombre.toLowerCase().includes(query) ||
            a.institucion.toLowerCase().includes(query) ||
            a.estado.toLowerCase().includes(query)
        )
    }, [filteredActas, tableSearch])

    const totalTablePages = Math.ceil(tableFilteredActas.length / itemsPerPage) || 1
    const paginatedTableActas = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return tableFilteredActas.slice(start, start + itemsPerPage)
    }, [tableFilteredActas, currentPage])

    // Handler de Exportación a PDF de un Acta individual
    const handleExportPdf = async (actaId: string) => {
        setExportingId(actaId)
        try {
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
                alert(res.error || 'Error al descargar PDF del acta')
            }
        } catch (e) {
            console.error('Error al exportar PDF:', e)
            alert('Error al generar archivo PDF')
        } finally {
            setExportingId(null)
        }
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header Ejecutivo Hendaya */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 md:p-8 rounded-3xl text-white shadow-xl border border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-black tracking-wider text-sky-400 bg-sky-950/80 px-3 py-1 rounded-xl border border-sky-500/30 shadow-inner">
                            HENDAYA
                        </span>
                        <span className="text-xs uppercase font-bold text-sky-300 tracking-widest bg-sky-900/60 px-2.5 py-1 rounded-lg">
                            Tableros & Avances
                        </span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                        <span>📊</span> Tablero Gerencial de Actas
                    </h1>
                    <p className="text-slate-300 text-sm mt-1 max-w-2xl">
                        Supervisión en tiempo real, trazabilidad de usuarios, cobertura por RBD e indicadores ejecutivos de avance de actas.
                    </p>
                </div>

                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/15 shadow-inner self-stretch md:self-auto justify-between md:justify-start">
                    <div className="text-right">
                        <p className="text-xs text-slate-300 font-medium">Actas Filtradas</p>
                        <p className="text-2xl font-black text-sky-300">{totalActas} <span className="text-xs text-slate-400 font-normal">/ {initialActas.length}</span></p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center text-xl font-bold border border-sky-400/30">
                        📋
                    </div>
                </div>
            </div>

            {/* Seccion de Filtros Avanzados */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-gray-100">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                        <span>🔍</span> Filtros de Inteligencia Ejecutiva
                    </h2>
                    {(filtroLicitacion || filtroAnio || filtroMes || filtroInstitucion || filtroUsuario || filtroNombreActa || selectedRbd !== null) && (
                        <button
                            onClick={handleResetFilters}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 transition-colors"
                        >
                            <span>🗑️</span> Limpiar Filtros
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Filtro Licitación */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Licitación</label>
                        <select
                            value={filtroLicitacion}
                            onChange={(e) => setFiltroLicitacion(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-gray-50 text-gray-800 font-medium"
                        >
                            <option value="">Todas las Licitaciones</option>
                            {licitaciones.map(l => (
                                <option key={l.licId} value={l.licId.toString()}>
                                    Licitación #{l.licId} {l.licitacionHomologada ? `(${l.licitacionHomologada})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Año */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Año</label>
                        <select
                            value={filtroAnio}
                            onChange={(e) => setFiltroAnio(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-gray-50 text-gray-800 font-medium"
                        >
                            <option value="">Todos los Años</option>
                            {availableAnios.map(y => (
                                <option key={y} value={y.toString()}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Mes */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Mes</label>
                        <select
                            value={filtroMes}
                            onChange={(e) => setFiltroMes(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-gray-50 text-gray-800 font-medium"
                        >
                            <option value="">Todos los Meses</option>
                            {MONTH_NAMES.map((name, idx) => (
                                <option key={idx + 1} value={(idx + 1).toString()}>{name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Institución */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Institución</label>
                        <select
                            value={filtroInstitucion}
                            onChange={(e) => setFiltroInstitucion(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-gray-50 text-gray-800 font-medium"
                        >
                            <option value="">Todas las Instituciones</option>
                            {availableInstituciones.map(inst => (
                                <option key={inst} value={inst}>{inst}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Usuario Creador */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Usuario Creador</label>
                        <select
                            value={filtroUsuario}
                            onChange={(e) => setFiltroUsuario(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-gray-50 text-gray-800 font-medium"
                        >
                            <option value="">Todos los Usuarios</option>
                            {availableUsuarios.map(u => (
                                <option key={u} value={u}>{u}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Nombre del Acta */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Nombre del Acta</label>
                        <select
                            value={filtroNombreActa}
                            onChange={(e) => setFiltroNombreActa(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-gray-50 text-gray-800 font-medium"
                        >
                            <option value="">Todas las Plantillas</option>
                            {availableNombresActas.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Inteligente RBD / Establecimiento (Autocomplete) */}
                    <div className="sm:col-span-2 relative" ref={rbdContainerRef}>
                        <label className="block text-xs font-bold text-gray-600 mb-1">
                            RBD / Establecimiento <span className="text-[10px] font-normal text-sky-600">(Búsqueda Autocompletada)</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Escriba RBD o nombre del colegio..."
                                value={rbdSearchInput}
                                onChange={(e) => {
                                    setRbdSearchInput(e.target.value)
                                    setIsRbdDropdownOpen(true)
                                    if (!e.target.value) setSelectedRbd(null)
                                }}
                                onFocus={() => setIsRbdDropdownOpen(true)}
                                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-gray-50 text-gray-800 font-medium pr-8"
                            />
                            {selectedRbd && (
                                <button
                                    onClick={() => {
                                        setSelectedRbd(null)
                                        setRbdSearchInput('')
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs bg-gray-200 rounded-full w-5 h-5 flex items-center justify-center"
                                    title="Quitar filtro RBD"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Autocomplete Dropdown List */}
                        {isRbdDropdownOpen && rbdSuggestions.length > 0 && (
                            <div className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-2xl shadow-xl divide-y divide-gray-100 text-sm">
                                {rbdSuggestions.map(item => (
                                    <div
                                        key={item.colRBD}
                                        onClick={() => {
                                            setSelectedRbd(item.colRBD)
                                            setRbdSearchInput(`${item.colRBD} - ${item.nombreEstablecimiento}`)
                                            setIsRbdDropdownOpen(false)
                                        }}
                                        className="p-3 hover:bg-sky-50 cursor-pointer transition-colors flex items-center justify-between group"
                                    >
                                        <div>
                                            <p className="font-semibold text-gray-900 group-hover:text-sky-700">
                                                {item.nombreEstablecimiento}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Comuna: {item.comuna} | Institución: {item.institucion}
                                            </p>
                                        </div>
                                        <span className="bg-sky-100 text-sky-800 text-xs font-bold px-2 py-1 rounded-lg">
                                            RBD {item.colRBD}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tarjetas KPI de Resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* Total Actas */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Total Actas</p>
                        <h3 className="text-2xl font-black text-gray-900">{totalActas.toLocaleString()}</h3>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">Generadas</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform shrink-0">
                        📑
                    </div>
                </div>

                {/* Tasa de Cumplimiento */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Finalizadas</p>
                        <h3 className="text-2xl font-black text-emerald-600">{actasCompletadasCount} <span className="text-xs text-emerald-500 font-bold">({tasaCompletado}%)</span></h3>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">Conclusión técnica</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform shrink-0">
                        ✅
                    </div>
                </div>

                {/* Actas Firmadas (Visita RBD) */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Actas Firmadas</p>
                        <h3 className="text-2xl font-black text-teal-600">{actasFirmadasCount} <span className="text-xs text-teal-500 font-bold">({tasaFirmadas}%)</span></h3>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">Respaldo Visita RBD</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform shrink-0">
                        ✍️
                    </div>
                </div>

                {/* Cobertura de RBDs */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">RBDs Auditados</p>
                        <h3 className="text-2xl font-black text-violet-600">{distinctRbdCount.toLocaleString()}</h3>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">Establecimientos</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform shrink-0">
                        🏫
                    </div>
                </div>

                {/* Usuarios Activos */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Creadores</p>
                        <h3 className="text-2xl font-black text-amber-600">{distinctUsuariosCount.toLocaleString()}</h3>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">Supervisores</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform shrink-0">
                        👥
                    </div>
                </div>

                {/* Actas por Institución */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between group hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Actas por Institución</p>
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform shrink-0">
                            🏛️
                        </div>
                    </div>

                    <div className="space-y-1 max-h-[85px] overflow-y-auto pr-1">
                        {actasPorInstitucionList.length > 0 ? (
                            actasPorInstitucionList.map(item => (
                                <div key={item.name} className="flex items-center justify-between text-xs bg-indigo-50/80 px-2.5 py-1 rounded-xl font-bold text-slate-800 border border-indigo-100/60">
                                    <span className="truncate max-w-[120px]" title={item.name}>{item.name}</span>
                                    <span className="text-indigo-700 font-extrabold ml-2 shrink-0">{item.count}</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-gray-400 italic">Sin datos</p>
                        )}
                    </div>
                </div>
            </div>

            {/* SECCIÓN DE GRÁFICOS INTERACTIVOS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* GRÁFICO 1: Actas por RBD (Top 10) */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                                <span>🏫</span> Actas por RBD (Top 10)
                            </h3>
                            <span className="text-xs text-gray-400 font-medium">Establecimientos con más actas</span>
                        </div>
                        <div className="w-full h-[320px]">
                            {actasPorRbdData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={actasPorRbdData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                                        <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 11, fontWeight: 'bold' }} width={80} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                            formatter={(val: any, name: any, props: any) => [val, props.payload.fullName]}
                                        />
                                        <Bar dataKey="count" name="Cantidad de Actas" radius={[0, 8, 8, 0]}>
                                            {actasPorRbdData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                                    No hay registros de actas para los filtros seleccionados.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* GRÁFICO 2: Usuarios por Actas (Top 10) */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                                <span>👤</span> Actas por Usuario Creador
                            </h3>
                            <span className="text-xs text-gray-400 font-medium">Top creadores de actas</span>
                        </div>
                        <div className="w-full h-[320px]">
                            {usuariosPorActasData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={usuariosPorActasData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                        <XAxis
                                            dataKey="name"
                                            interval={0}
                                            angle={-25}
                                            textAnchor="end"
                                            tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                        <Bar dataKey="count" name="Actas Generadas" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                                    No hay registros disponibles.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* GRÁFICO 3: Tendencia Mensual - Usuarios por RBD y Actas x Mes */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                        <div>
                            <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                                <span>📈</span> Evolución Mensual: Usuarios, RBDs y Actas por Mes
                            </h3>
                            <p className="text-xs text-gray-500">Comportamiento temporal histórico de actas y usuarios participantes</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-semibold text-gray-600">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-500"></span> Total Actas</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Completadas</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Usuarios Activos</span>
                        </div>
                    </div>

                    <div className="w-full h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={tendenciaMensualData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="mes" tick={{ fill: '#475569', fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                <Legend />
                                <Bar dataKey="Completadas" stackId="a" fill="#10B981" radius={[0, 0, 4, 4]} />
                                <Bar dataKey="Borradores/En Proceso" stackId="a" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                                <Line type="monotone" dataKey="Usuarios Activos" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4 }} />
                                <Line type="monotone" dataKey="RBDs Auditados" stroke="#6366F1" strokeWidth={2} strokeDasharray="5 5" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* GRÁFICO 4: Avances de Actas (Estado) */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                                <span>🎯</span> Avance de Actas por Estado
                            </h3>
                            <span className="text-xs text-gray-400 font-medium">Proporción según estado actual</span>
                        </div>
                        <div className="w-full h-[300px] flex items-center justify-center">
                            {avancesActasData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={avancesActasData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={65}
                                            outerRadius={100}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {avancesActasData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-gray-400 text-sm">No hay estados para mostrar.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* GRÁFICO 5: Actas por Nombre de Acta / Plantilla */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                                <span>📄</span> Actas por Nombre de Plantilla
                            </h3>
                            <span className="text-xs text-gray-400 font-medium">Distribución según tipo de acta</span>
                        </div>
                        <div className="w-full h-[300px]">
                            {actasPorNombreData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={actasPorNombreData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                        <XAxis
                                            dataKey="name"
                                            interval={0}
                                            angle={-20}
                                            textAnchor="end"
                                            tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                        <Bar dataKey="count" name="Total Actas" fill="#0EA5E9" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                                    No hay registros disponibles.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* GRÁFICO 7: Respaldo de Visita RBD - Control de Firmas por Usuario */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                                <span>✍️</span> Control de Firma Digital por Usuario (Visita RBD)
                            </h3>
                            <span className="text-xs text-gray-400 font-medium">Verificación de Respaldo Presencial</span>
                        </div>
                        <div className="w-full h-[300px]">
                            {firmasPorUsuarioData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={firmasPorUsuarioData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                        <XAxis
                                            dataKey="name"
                                            interval={0}
                                            angle={-20}
                                            textAnchor="end"
                                            tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                        <Legend />
                                        <Bar dataKey="Con Firma" name="Visitas Firmadas (OK)" fill="#14B8A6" stackId="f" radius={[0, 0, 4, 4]} />
                                        <Bar dataKey="Sin Firma" name="Sin Firma (Pendiente)" fill="#F59E0B" stackId="f" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                                    No hay registros de firmas disponibles.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* TABLA EJECUTIVA DE REGISTROS DE ACTAS */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-gray-100">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span>📋</span> Detalle de Actas Registradas
                        </h3>
                        <p className="text-xs text-gray-500">Listado detallado de actas según el filtro aplicado</p>
                    </div>

                    <div className="w-full sm:w-72">
                        <input
                            type="text"
                            placeholder="Buscar en el listado..."
                            value={tableSearch}
                            onChange={(e) => {
                                setTableSearch(e.target.value)
                                setCurrentPage(1)
                            }}
                            className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-gray-50 text-gray-800"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-700">
                        <thead className="bg-slate-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3">Nombre del Acta</th>
                                <th className="px-4 py-3">RBD / Establecimiento</th>
                                <th className="px-4 py-3">Institución</th>
                                <th className="px-4 py-3">Usuario Creador</th>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Estado</th>
                                <th className="px-4 py-3">Respaldo Firma</th>
                                <th className="px-4 py-3 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedTableActas.length > 0 ? (
                                paginatedTableActas.map((acta) => {
                                    const st = STATUS_COLORS[acta.estado] || STATUS_COLORS['Borrador']
                                    return (
                                        <tr key={acta.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-4 py-3.5 font-bold text-gray-900">
                                                {acta.plantillaNombre}
                                                {acta.correlativo && (
                                                    <span className="ml-2 text-xs font-normal text-gray-400">#{acta.correlativo}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="font-semibold text-gray-800">{acta.nombreEstablecimiento}</div>
                                                <div className="text-xs text-sky-600 font-bold">RBD {acta.rbd}</div>
                                            </td>
                                            <td className="px-4 py-3.5 font-medium text-gray-600">
                                                {acta.institucion}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="font-medium text-gray-800">{acta.supervisorNombre}</div>
                                                <div className="text-xs text-gray-400">{acta.usuario}</div>
                                            </td>
                                            <td className="px-4 py-3.5 text-xs text-gray-600 font-medium">
                                                {new Date(acta.fechaCreacion).toLocaleDateString('es-CL', {
                                                    day: '2-digit', month: '2-digit', year: 'numeric'
                                                })}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg ${st.bg} ${st.text}`}>
                                                    {acta.estado}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                {acta.hasFirma ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-teal-100 text-teal-800 border border-teal-200">
                                                        <span>✍️</span> Firmada
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                                                        <span>⏳</span> Sin Firma
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 text-right">
                                                <button
                                                    onClick={() => handleExportPdf(acta.id)}
                                                    disabled={exportingId === acta.id}
                                                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800 transition-colors border border-sky-200 shadow-sm flex items-center gap-1.5 ml-auto disabled:opacity-50"
                                                >
                                                    {exportingId === acta.id ? (
                                                        <span>⏳ Exportando...</span>
                                                    ) : (
                                                        <span>📥 Exportar PDF</span>
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                                        No se encontraron actas que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginador */}
                {totalTablePages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs">
                        <p className="text-gray-500 font-medium">
                            Página <span className="font-bold text-gray-900">{currentPage}</span> de <span className="font-bold text-gray-900">{totalTablePages}</span>
                        </p>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalTablePages, p + 1))}
                                disabled={currentPage === totalTablePages}
                                className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
