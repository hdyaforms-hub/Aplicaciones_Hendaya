'use client'

import React, { useState, useMemo, useTransition } from 'react'
import {
    ConfiguracionVisualizacionDataResponse,
    PersonalDotacionDTO,
    JefaturaUsuarioDTO,
    RolJefaturaDTO,
    AsignacionJefaturaDTO,
    guardarAsignacionesJefaturaAction,
    removerAsignacionesJefaturaAction,
    asignarTodoRbdAJefaturaAction,
    eliminarTodaAsignacionJefaturaAction
} from './actions'
import {
    Users,
    Shield,
    UserCheck,
    Search,
    Filter,
    Check,
    X,
    Plus,
    Trash2,
    Building2,
    CheckCircle2,
    AlertCircle,
    Info,
    RefreshCw,
    UserPlus,
    ArrowRight,
    Sparkles,
    Briefcase,
    School,
    Layers,
    SlidersHorizontal,
    ChevronDown,
    ChevronUp,
    Eye,
    ExternalLink
} from 'lucide-react'

interface Props {
    initialData: ConfiguracionVisualizacionDataResponse
}

export default function ConfiguracionVisualizacionClient({ initialData }: Props) {
    const [data, setData] = useState<ConfiguracionVisualizacionDataResponse>(initialData)
    const [isPending, startTransition] = useTransition()
    const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null)

    // Pestañas principales
    const [activeTab, setActiveTab] = useState<'asignacion' | 'matriz' | 'buscador'>('asignacion')

    // Modo de asignación: Por Usuario específico o Por Rol
    const [modoJefatura, setModoJefatura] = useState<'USUARIO' | 'ROL'>('USUARIO')
    const [filtroRolUsuario, setFiltroRolUsuario] = useState<string>('TODOS')
    const [selectedJefaturaId, setSelectedJefaturaId] = useState<string>('')
    const [jefaturaSearchText, setJefaturaSearchText] = useState('')

    // Filtros de Personal de Dotación
    const [personalSearchText, setPersonalSearchText] = useState('')
    const [filtroRbd, setFiltroRbd] = useState<string>('TODOS')
    const [filtroCargo, setFiltroCargo] = useState<string>('TODOS')
    const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'ASIGNADOS' | 'NO_ASIGNADOS'>('TODOS')

    // Selección masiva de personal (RUT hashes)
    const [selectedRutHashes, setSelectedRutHashes] = useState<Set<string>>(new Set())

    // Buscador global en pestaña de búsqueda rápida
    const [colaboradorQuery, setColaboradorQuery] = useState('')

    // Búsqueda en matriz consolidada
    const [matrizQuery, setMatrizQuery] = useState('')

    // Jefatura seleccionada actualmente
    const currentJefaturaUsuario = useMemo(() => {
        if (modoJefatura !== 'USUARIO' || !selectedJefaturaId) return null
        return data.jefaturasUsuarios.find(u => u.id === selectedJefaturaId) || null
    }, [modoJefatura, selectedJefaturaId, data.jefaturasUsuarios])

    const currentJefaturaRol = useMemo(() => {
        if (modoJefatura !== 'ROL' || !selectedJefaturaId) return null
        return data.roles.find(r => r.id === selectedJefaturaId) || null
    }, [modoJefatura, selectedJefaturaId, data.roles])

    // Mapa de asignaciones actuales para lookup ultra rápido
    // key: `${tipo}_${jefaturaId}_${rutHash}` -> asignación
    const asignacionMap = useMemo(() => {
        const map = new Map<string, AsignacionJefaturaDTO>()
        data.asignaciones.forEach(a => {
            const jId = a.tipo === 'USUARIO' ? a.jefaturaUserId : a.jefaturaRoleId
            if (jId) {
                map.set(`${a.tipo}_${jId}_${a.personalRutHash}`, a)
            }
        })
        return map
    }, [data.asignaciones])

    // Mapa general de personal -> todas las jefaturas que lo tienen asignado
    const personalToJefaturasMap = useMemo(() => {
        const map = new Map<string, AsignacionJefaturaDTO[]>()
        data.asignaciones.forEach(a => {
            const list = map.get(a.personalRutHash) || []
            list.push(a)
            map.set(a.personalRutHash, list)
        })
        return map
    }, [data.asignaciones])

    // Métricas del Dashboard
    const metricas = useMemo(() => {
        const totalPersonal = data.personalDotacion.length
        const totalAsignaciones = data.asignaciones.length

        const jefaturasActivasSet = new Set<string>()
        const rbdsCubiertosSet = new Set<number>()

        data.asignaciones.forEach(a => {
            const jId = a.tipo === 'USUARIO' ? a.jefaturaUserId : a.jefaturaRoleId
            if (jId) jefaturasActivasSet.add(`${a.tipo}_${jId}`)
            if (a.personalRbd) rbdsCubiertosSet.add(a.personalRbd)
        })

        return {
            totalPersonal,
            totalAsignaciones,
            jefaturasConAsignacion: jefaturasActivasSet.size,
            rbdsCubiertos: rbdsCubiertosSet.size
        }
    }, [data])

    // Roles agrupados con conteo de usuarios para el filtro previo de búsqueda de usuarios
    const rolesParaFiltroUsuario = useMemo(() => {
        const counts: Record<string, number> = {}
        data.jefaturasUsuarios.forEach(u => {
            counts[u.roleName] = (counts[u.roleName] || 0) + 1
        })
        const roleNames = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'es'))
        return roleNames.map(name => ({
            name,
            count: counts[name]
        }))
    }, [data.jefaturasUsuarios])

    // Filtro para selector de Jefaturas (acotado por el Rol previo y por texto de búsqueda)
    const filteredJefaturasUsuarios = useMemo(() => {
        return data.jefaturasUsuarios.filter(u => {
            // 1. Filtro previo por Rol
            if (filtroRolUsuario !== 'TODOS') {
                if (u.roleName.toLowerCase() !== filtroRolUsuario.toLowerCase()) {
                    return false
                }
            }

            // 2. Filtro por texto si se escribe búsqueda
            if (jefaturaSearchText.trim()) {
                const q = jefaturaSearchText.toLowerCase().trim()
                const matchName = u.name.toLowerCase().includes(q)
                const matchUser = u.username.toLowerCase().includes(q)
                const matchRole = u.roleName.toLowerCase().includes(q)
                const matchEmail = u.email && u.email.toLowerCase().includes(q)
                if (!matchName && !matchUser && !matchRole && !matchEmail) {
                    return false
                }
            }

            return true
        })
    }, [data.jefaturasUsuarios, filtroRolUsuario, jefaturaSearchText])

    const filteredRoles = useMemo(() => {
        if (!jefaturaSearchText.trim()) return data.roles
        const q = jefaturaSearchText.toLowerCase().trim()
        return data.roles.filter(
            r => r.name.toLowerCase().includes(q) ||
                 (r.description && r.description.toLowerCase().includes(q))
        )
    }, [data.roles, jefaturaSearchText])

    // Filtro para la tabla de Personal de Dotación
    const filteredPersonal = useMemo(() => {
        return data.personalDotacion.filter(p => {
            // Filtro por texto (RUT, Nombre, Cargo, Establecimiento, Sucursal)
            if (personalSearchText.trim()) {
                const q = personalSearchText.toLowerCase().trim()
                const matchNombre = p.nombre.toLowerCase().includes(q)
                const matchRut = p.rut.toLowerCase().includes(q)
                const matchCargo = p.cargo && p.cargo.toLowerCase().includes(q)
                const matchColegio = p.establecimiento && p.establecimiento.toLowerCase().includes(q)
                const matchRbd = p.rbd && String(p.rbd).includes(q)
                if (!matchNombre && !matchRut && !matchCargo && !matchColegio && !matchRbd) {
                    return false
                }
            }

            // Filtro por RBD / Colegio
            if (filtroRbd !== 'TODOS') {
                const rbdNum = Number(filtroRbd)
                if (p.rbd !== rbdNum) return false
            }

            // Filtro por Cargo
            if (filtroCargo !== 'TODOS') {
                if (p.cargo !== filtroCargo) return false
            }

            // Filtro por Estado respecto a la jefatura actual
            if (selectedJefaturaId) {
                const key = `${modoJefatura}_${selectedJefaturaId}_${p.rutHash}`
                const isAsignado = asignacionMap.has(key)
                if (filtroEstado === 'ASIGNADOS' && !isAsignado) return false
                if (filtroEstado === 'NO_ASIGNADOS' && isAsignado) return false
            }

            return true
        })
    }, [data.personalDotacion, personalSearchText, filtroRbd, filtroCargo, filtroEstado, selectedJefaturaId, modoJefatura, asignacionMap])

    // Cantidad de personal asignado a la jefatura actual
    const currentJefaturaPersonalCount = useMemo(() => {
        if (!selectedJefaturaId) return 0
        let count = 0
        data.asignaciones.forEach(a => {
            const jId = a.tipo === 'USUARIO' ? a.jefaturaUserId : a.jefaturaRoleId
            if (a.tipo === modoJefatura && jId === selectedJefaturaId) {
                count++
            }
        })
        return count
    }, [selectedJefaturaId, modoJefatura, data.asignaciones])

    // Manejo de Selección Múltiple
    const handleToggleSelectPersonal = (rutHash: string) => {
        setSelectedRutHashes(prev => {
            const next = new Set(prev)
            if (next.has(rutHash)) next.delete(rutHash)
            else next.add(rutHash)
            return next
        })
    }

    const handleSelectAllVisible = () => {
        const visibleHashes = filteredPersonal.map(p => p.rutHash)
        setSelectedRutHashes(new Set(visibleHashes))
    }

    const handleClearSelection = () => {
        setSelectedRutHashes(new Set())
    }

    // Acciones de Servidor con Optimistic UI Feedback
    const handleAsignarSeleccionados = () => {
        if (!selectedJefaturaId) {
            setFeedback({ tipo: 'error', mensaje: 'Debes seleccionar una jefatura primero.' })
            return
        }
        if (selectedRutHashes.size === 0) {
            setFeedback({ tipo: 'error', mensaje: 'No hay personal seleccionado para asignar.' })
            return
        }

        const rutHashes = Array.from(selectedRutHashes)
        startTransition(async () => {
            const res = await guardarAsignacionesJefaturaAction({
                tipo: modoJefatura,
                jefaturaId: selectedJefaturaId,
                rutHashes
            })

            if (res.success) {
                setFeedback({ tipo: 'success', mensaje: res.message || 'Personal asociado exitosamente.' })
                setSelectedRutHashes(new Set())
                // Recargar datos en caliente
                const { getConfiguracionVisualizacionDataAction } = await import('./actions')
                const fresh = await getConfiguracionVisualizacionDataAction()
                if (fresh.success) setData(fresh)
                setTimeout(() => setFeedback(null), 4000)
            } else {
                setFeedback({ tipo: 'error', mensaje: res.error || 'Error al asociar personal.' })
                setTimeout(() => setFeedback(null), 5000)
            }
        })
    }

    const handleDesasignarSeleccionados = () => {
        if (!selectedJefaturaId) {
            setFeedback({ tipo: 'error', mensaje: 'Debes seleccionar una jefatura primero.' })
            return
        }
        if (selectedRutHashes.size === 0) {
            setFeedback({ tipo: 'error', mensaje: 'No hay personal seleccionado para desasignar.' })
            return
        }

        const rutHashes = Array.from(selectedRutHashes)
        startTransition(async () => {
            const res = await removerAsignacionesJefaturaAction({
                tipo: modoJefatura,
                jefaturaId: selectedJefaturaId,
                rutHashes
            })

            if (res.success) {
                setFeedback({ tipo: 'success', mensaje: res.message || 'Asignaciones removidas exitosamente.' })
                setSelectedRutHashes(new Set())
                const { getConfiguracionVisualizacionDataAction } = await import('./actions')
                const fresh = await getConfiguracionVisualizacionDataAction()
                if (fresh.success) setData(fresh)
                setTimeout(() => setFeedback(null), 4000)
            } else {
                setFeedback({ tipo: 'error', mensaje: res.error || 'Error al remover asignaciones.' })
                setTimeout(() => setFeedback(null), 5000)
            }
        })
    }

    // Toggle individual de 1 colaborador
    const handleToggleIndividualAsignacion = (personal: PersonalDotacionDTO) => {
        if (!selectedJefaturaId) {
            setFeedback({ tipo: 'error', mensaje: 'Por favor selecciona una jefatura en el paso superior.' })
            return
        }

        const key = `${modoJefatura}_${selectedJefaturaId}_${personal.rutHash}`
        const isAsignado = asignacionMap.has(key)

        startTransition(async () => {
            if (isAsignado) {
                const res = await removerAsignacionesJefaturaAction({
                    tipo: modoJefatura,
                    jefaturaId: selectedJefaturaId,
                    rutHashes: [personal.rutHash]
                })
                if (res.success) {
                    setFeedback({ tipo: 'success', mensaje: `${personal.nombre} fue desasociado correctamente.` })
                    const { getConfiguracionVisualizacionDataAction } = await import('./actions')
                    const fresh = await getConfiguracionVisualizacionDataAction()
                    if (fresh.success) setData(fresh)
                    setTimeout(() => setFeedback(null), 3000)
                } else {
                    setFeedback({ tipo: 'error', mensaje: res.error || 'Error al desasociar.' })
                }
            } else {
                const res = await guardarAsignacionesJefaturaAction({
                    tipo: modoJefatura,
                    jefaturaId: selectedJefaturaId,
                    rutHashes: [personal.rutHash]
                })
                if (res.success) {
                    setFeedback({ tipo: 'success', mensaje: `${personal.nombre} fue asociado exitosamente.` })
                    const { getConfiguracionVisualizacionDataAction } = await import('./actions')
                    const fresh = await getConfiguracionVisualizacionDataAction()
                    if (fresh.success) setData(fresh)
                    setTimeout(() => setFeedback(null), 3000)
                } else {
                    setFeedback({ tipo: 'error', mensaje: res.error || 'Error al asociar.' })
                }
            }
        })
    }

    // Asignar todo el personal de un RBD a la jefatura actual
    const handleAsignarTodoRbd = (rbd: number) => {
        if (!selectedJefaturaId) {
            setFeedback({ tipo: 'error', mensaje: 'Selecciona una jefatura primero.' })
            return
        }

        const confirmMsg = `¿Deseas asignar todo el personal del RBD ${rbd} a la jefatura seleccionada?`
        if (!window.confirm(confirmMsg)) return

        startTransition(async () => {
            const res = await asignarTodoRbdAJefaturaAction({
                tipo: modoJefatura,
                jefaturaId: selectedJefaturaId,
                rbd
            })
            if (res.success) {
                setFeedback({ tipo: 'success', mensaje: res.message || 'Personal del RBD asignado exitosamente.' })
                const { getConfiguracionVisualizacionDataAction } = await import('./actions')
                const fresh = await getConfiguracionVisualizacionDataAction()
                if (fresh.success) setData(fresh)
                setTimeout(() => setFeedback(null), 4000)
            } else {
                setFeedback({ tipo: 'error', mensaje: res.error || 'Error al asignar RBD.' })
            }
        })
    }

    // Eliminar todas las asignaciones de una jefatura
    const handleEliminarTodaAsignacionJefatura = (tipo: 'USUARIO' | 'ROL', jId: string, nombre: string) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar TODAS las asignaciones de personal para ${nombre}?`)) {
            return
        }

        startTransition(async () => {
            const res = await eliminarTodaAsignacionJefaturaAction({ tipo, jefaturaId: jId })
            if (res.success) {
                setFeedback({ tipo: 'success', mensaje: res.message || 'Asignaciones eliminadas correctamente.' })
                const { getConfiguracionVisualizacionDataAction } = await import('./actions')
                const fresh = await getConfiguracionVisualizacionDataAction()
                if (fresh.success) setData(fresh)
                setTimeout(() => setFeedback(null), 4000)
            } else {
                setFeedback({ tipo: 'error', mensaje: res.error || 'Error al eliminar asignaciones.' })
            }
        })
    }

    // Agrupación para la Matriz Consolidada
    const matrizGrouped = useMemo(() => {
        const groups: Record<string, {
            key: string
            tipo: 'USUARIO' | 'ROL'
            jefaturaId: string
            jefaturaNombre: string
            jefaturaUsername?: string | null
            items: AsignacionJefaturaDTO[]
            rbds: Set<number>
        }> = {}

        data.asignaciones.forEach(a => {
            const jId = a.tipo === 'USUARIO' ? a.jefaturaUserId : a.jefaturaRoleId
            if (!jId) return
            const key = `${a.tipo}_${jId}`
            if (!groups[key]) {
                groups[key] = {
                    key,
                    tipo: a.tipo,
                    jefaturaId: jId,
                    jefaturaNombre: a.jefaturaNombre,
                    jefaturaUsername: a.jefaturaUsername,
                    items: [],
                    rbds: new Set()
                }
            }
            groups[key].items.push(a)
            if (a.personalRbd) groups[key].rbds.add(a.personalRbd)
        })

        let list = Object.values(groups)
        if (matrizQuery.trim()) {
            const q = matrizQuery.toLowerCase().trim()
            list = list.filter(g =>
                g.jefaturaNombre.toLowerCase().includes(q) ||
                (g.jefaturaUsername && g.jefaturaUsername.toLowerCase().includes(q)) ||
                g.items.some(it => it.personalNombre.toLowerCase().includes(q) || it.personalRut.toLowerCase().includes(q))
            )
        }

        return list.sort((a, b) => a.jefaturaNombre.localeCompare(b.jefaturaNombre, 'es'))
    }, [data.asignaciones, matrizQuery])

    // Búsqueda por Colaborador específico
    const resultadosColaborador = useMemo(() => {
        if (!colaboradorQuery.trim() || colaboradorQuery.trim().length < 2) return []
        const q = colaboradorQuery.toLowerCase().trim()
        return data.personalDotacion.filter(p =>
            p.nombre.toLowerCase().includes(q) ||
            p.rut.toLowerCase().includes(q) ||
            (p.establecimiento && p.establecimiento.toLowerCase().includes(q))
        )
    }, [data.personalDotacion, colaboradorQuery])

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 pb-20">
            {/* CABECERA OFICIAL HENDAYA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <div className="flex items-center gap-2 text-cyan-700 font-semibold text-xs tracking-wider uppercase mb-1">
                        <Users className="w-4 h-4 text-cyan-600" />
                        <span>Mantenedor · Recursos Humanos · Visualización</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                        Configuración de Visualización
                    </h1>
                    <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                        Asocia colaboradores de Dotación a jefaturas (por usuario o rol) para habilitar su supervisión y control operativo en la plataforma.
                    </p>
                </div>

                {/* Badge de Seguridad de RBD */}
                <div className="flex flex-col items-end gap-1.5 self-start sm:self-center">
                    {data.isRestrictedByRbd ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-semibold shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            <span>Alcance Perfil: {data.authorizedRbds?.length || 0} RBDs asignados</span>
                        </div>
                    ) : (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-50 text-cyan-900 border border-cyan-300 rounded-xl text-xs font-semibold shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                            <span>Alcance Global (Todos los RBDs)</span>
                        </div>
                    )}
                    <span className="text-[11px] text-slate-400 font-medium tracking-wide">
                        Hendaya S.A. · Seguridad Operacional
                    </span>
                </div>
            </div>

            {/* FEEDBACK TOAST / ALERT */}
            {feedback && (
                <div className={`p-4 rounded-xl flex items-center justify-between text-sm font-medium border shadow-sm transition-all ${
                    feedback.tipo === 'success'
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-rose-50 text-rose-900 border-rose-300'
                }`}>
                    <div className="flex items-center gap-3">
                        {feedback.tipo === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        )}
                        <span>{feedback.mensaje}</span>
                    </div>
                    <button
                        onClick={() => setFeedback(null)}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* KPI STATS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center gap-4 hover:border-cyan-300 transition-colors">
                    <div className="p-3 bg-cyan-50 rounded-xl text-cyan-600">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Jefaturas Asignadas</span>
                        <span className="text-2xl font-black text-slate-800">{metricas.jefaturasConAsignacion}</span>
                        <span className="text-[11px] text-slate-500 block">con personal a cargo</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center gap-4 hover:border-cyan-300 transition-colors">
                    <div className="p-3 bg-sky-50 rounded-xl text-sky-600">
                        <UserCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Personal Dotación</span>
                        <span className="text-2xl font-black text-slate-800">{metricas.totalPersonal}</span>
                        <span className="text-[11px] text-slate-500 block">disponible en tu alcance</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center gap-4 hover:border-cyan-300 transition-colors">
                    <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                        <Layers className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Asignaciones Activas</span>
                        <span className="text-2xl font-black text-slate-800">{metricas.totalAsignaciones}</span>
                        <span className="text-[11px] text-slate-500 block">vínculos configurados</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center gap-4 hover:border-cyan-300 transition-colors">
                    <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                        <School className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">RBDs Cubiertos</span>
                        <span className="text-2xl font-black text-slate-800">{metricas.rbdsCubiertos}</span>
                        <span className="text-[11px] text-slate-500 block">colegios en supervisión</span>
                    </div>
                </div>
            </div>

            {/* PESTAÑAS DE NAVEGACIÓN */}
            <div className="flex border-b border-slate-200 gap-2">
                <button
                    onClick={() => setActiveTab('asignacion')}
                    className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${
                        activeTab === 'asignacion'
                            ? 'border-cyan-600 text-cyan-700 bg-cyan-50/50 rounded-t-xl'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <UserPlus className="w-4 h-4" />
                    <span>Asignar por Jefatura</span>
                </button>

                <button
                    onClick={() => setActiveTab('matriz')}
                    className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${
                        activeTab === 'matriz'
                            ? 'border-cyan-600 text-cyan-700 bg-cyan-50/50 rounded-t-xl'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Layers className="w-4 h-4" />
                    <span>Matriz Consolidada ({metricas.totalAsignaciones})</span>
                </button>

                <button
                    onClick={() => setActiveTab('buscador')}
                    className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${
                        activeTab === 'buscador'
                            ? 'border-cyan-600 text-cyan-700 bg-cyan-50/50 rounded-t-xl'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Search className="w-4 h-4" />
                    <span>Búsqueda Rápida de Personal</span>
                </button>
            </div>

            {/* CONTENIDO PESTAÑA 1: ASIGNAR POR JEFATURA */}
            {activeTab === 'asignacion' && (
                <div className="space-y-6">
                    {/* PASO 1: SELECCIÓN DE JEFATURA */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                            <div>
                                <div className="text-xs font-extrabold text-cyan-600 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-xs font-bold">1</span>
                                    <span>Seleccionar Jefatura (Gestión de Usuarios)</span>
                                </div>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    Elige si configurarás la visualización para un <strong>Usuario específico</strong> o para todos los integrantes de un <strong>Rol</strong>.
                                </p>
                            </div>

                            {/* Switch Usuario vs Rol */}
                            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setModoJefatura('USUARIO')
                                        setSelectedJefaturaId('')
                                        setSelectedRutHashes(new Set())
                                    }}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                                        modoJefatura === 'USUARIO'
                                            ? 'bg-white text-cyan-800 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Users className="w-3.5 h-3.5" />
                                    <span>Por Usuario</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setModoJefatura('ROL')
                                        setSelectedJefaturaId('')
                                        setSelectedRutHashes(new Set())
                                    }}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                                        modoJefatura === 'ROL'
                                            ? 'bg-white text-cyan-800 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Shield className="w-3.5 h-3.5" />
                                    <span>Por Rol</span>
                                </button>
                            </div>
                        </div>

                        {/* Selector de Jefatura con Paso Previo de Filtro por Rol */}
                        {modoJefatura === 'USUARIO' ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* PASO PREVIO: FILTRO DE ROLES */}
                                    <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-1.5">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                                            <span className="flex items-center gap-1.5 text-cyan-800">
                                                <Shield className="w-3.5 h-3.5 text-cyan-600" />
                                                <span>Paso previo: Filtrar por Rol</span>
                                            </span>
                                            <span className="text-[10px] font-bold text-cyan-800 bg-cyan-100/70 px-2 py-0.5 rounded-md">
                                                {filtroRolUsuario === 'TODOS' ? 'Todos los Roles' : filtroRolUsuario}
                                            </span>
                                        </label>
                                        <select
                                            value={filtroRolUsuario}
                                            onChange={(e) => {
                                                const nuevoRol = e.target.value
                                                setFiltroRolUsuario(nuevoRol)
                                                if (nuevoRol !== 'TODOS' && currentJefaturaUsuario && currentJefaturaUsuario.roleName.toLowerCase() !== nuevoRol.toLowerCase()) {
                                                    setSelectedJefaturaId('')
                                                    setSelectedRutHashes(new Set())
                                                }
                                            }}
                                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                                        >
                                            <option value="TODOS">-- Todos los Roles ({data.jefaturasUsuarios.length} usuarios) --</option>
                                            {rolesParaFiltroUsuario.map(r => (
                                                <option key={r.name} value={r.name}>
                                                    {r.name} ({r.count} {r.count === 1 ? 'usuario' : 'usuarios'})
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-[11px] text-slate-500">
                                            Filtra qué perfiles o cargos de jefatura se mostrarán en la lista de usuarios.
                                        </p>
                                    </div>

                                    {/* BÚSQUEDA RÁPIDA POR TEXTO */}
                                    <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-1.5">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                                            <span className="flex items-center gap-1.5 text-cyan-800">
                                                <Search className="w-3.5 h-3.5 text-cyan-600" />
                                                <span>Buscar Usuario (Nombre / Email)</span>
                                            </span>
                                            {jefaturaSearchText && (
                                                <button
                                                    type="button"
                                                    onClick={() => setJefaturaSearchText('')}
                                                    className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold"
                                                >
                                                    Limpiar
                                                </button>
                                            )}
                                        </label>
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                                            <input
                                                type="text"
                                                value={jefaturaSearchText}
                                                onChange={(e) => setJefaturaSearchText(e.target.value)}
                                                placeholder="Filtrar por nombre, usuario (@) o correo..."
                                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                            />
                                        </div>
                                        <p className="text-[11px] text-slate-500">
                                            {filteredJefaturasUsuarios.length} usuarios disponibles según el rol y texto ingresado.
                                        </p>
                                    </div>
                                </div>

                                {/* SELECCIÓN FINAL DE USUARIO Y TARJETA */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5 text-cyan-600" />
                                            <span>Buscar y Seleccionar Usuario ({filteredJefaturasUsuarios.length}):</span>
                                        </label>
                                        <select
                                            value={selectedJefaturaId}
                                            onChange={(e) => {
                                                setSelectedJefaturaId(e.target.value)
                                                setSelectedRutHashes(new Set())
                                            }}
                                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all cursor-pointer"
                                        >
                                            <option value="">-- Selecciona un Usuario ({filteredJefaturasUsuarios.length} disponibles) --</option>
                                            {filteredJefaturasUsuarios.map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.name} (@{u.username}) · {u.roleName} ({u.assignedCount} asignados)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Tarjeta de Jefatura Seleccionada */}
                                    {selectedJefaturaId ? (
                                        <div className="p-3.5 bg-cyan-50/70 border border-cyan-200 rounded-xl flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white font-black flex items-center justify-center text-sm shadow-xs shrink-0">
                                                    {(currentJefaturaUsuario?.name?.[0] || 'U').toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-extrabold text-sm text-slate-900 truncate flex items-center gap-2">
                                                        <span>{currentJefaturaUsuario?.name}</span>
                                                        <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-[10px] rounded-md font-bold shrink-0">
                                                            {currentJefaturaUsuario?.roleName}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                                        <span>{currentJefaturaPersonalCount} colaboradores asignados</span>
                                                        {currentJefaturaUsuario?.email && (
                                                            <span className="hidden sm:inline text-slate-400">· {currentJefaturaUsuario.email}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {currentJefaturaPersonalCount > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleEliminarTodaAsignacionJefatura(
                                                        'USUARIO',
                                                        selectedJefaturaId,
                                                        currentJefaturaUsuario?.name || 'Usuario'
                                                    )}
                                                    disabled={isPending}
                                                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0"
                                                    title="Desasignar todos los colaboradores de este usuario"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    <span className="hidden md:inline">Vaciar</span>
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-3.5 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-500 font-medium">
                                            👈 Selecciona un usuario para visualizar y asociar colaboradores.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                        <Shield className="w-3.5 h-3.5 text-cyan-600" />
                                        <span>Seleccionar Rol de Jefatura:</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={selectedJefaturaId}
                                            onChange={(e) => {
                                                setSelectedJefaturaId(e.target.value)
                                                setSelectedRutHashes(new Set())
                                            }}
                                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all cursor-pointer"
                                        >
                                            <option value="">-- Selecciona un Rol ({filteredRoles.length} disponibles) --</option>
                                            {filteredRoles.map(r => (
                                                <option key={r.id} value={r.id}>
                                                    Rol: {r.name} ({r.usersCount} usuarios · {r.assignedCount} asignados)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Tarjeta de Rol Seleccionado */}
                                {selectedJefaturaId ? (
                                    <div className="p-3.5 bg-cyan-50/70 border border-cyan-200 rounded-xl flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white font-black flex items-center justify-center text-sm shadow-xs shrink-0">
                                                R
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-extrabold text-sm text-slate-900 truncate flex items-center gap-2">
                                                    <span>{currentJefaturaRol?.name}</span>
                                                    <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-[10px] rounded-md font-bold shrink-0">
                                                        Rol Global ({currentJefaturaRol?.usersCount} usuarios)
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                                    <span>{currentJefaturaPersonalCount} colaboradores actualmente asignados</span>
                                                </div>
                                            </div>
                                        </div>

                                        {currentJefaturaPersonalCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleEliminarTodaAsignacionJefatura(
                                                    'ROL',
                                                    selectedJefaturaId,
                                                    currentJefaturaRol?.name || 'Rol'
                                                )}
                                                disabled={isPending}
                                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0"
                                                title="Desasignar todos los colaboradores de este rol"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span className="hidden md:inline">Vaciar</span>
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-3.5 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-500 font-medium">
                                        👈 Selecciona un rol para asociar colaboradores a todos los usuarios de ese perfil.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* PASO 2: ASOCIACIÓN Y BUSCADOR DE PERSONAL */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                            <div>
                                <div className="text-xs font-extrabold text-cyan-600 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-xs font-bold">2</span>
                                    <span>Personal de Dotación Disponible ({filteredPersonal.length})</span>
                                </div>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    Busca y selecciona los colaboradores que reportarán o serán visualizados por la jefatura seleccionada.
                                </p>
                            </div>

                            {/* Resumen de selección múltiple */}
                            {selectedRutHashes.size > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-3 py-1.5 rounded-xl">
                                        {selectedRutHashes.size} seleccionados
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleAsignarSeleccionados}
                                        disabled={isPending || !selectedJefaturaId}
                                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1"
                                    >
                                        <UserPlus className="w-3.5 h-3.5" />
                                        <span>Asignar a Jefatura</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDesasignarSeleccionados}
                                        disabled={isPending || !selectedJefaturaId}
                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                        <span>Quitar</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleClearSelection}
                                        className="text-xs font-semibold text-slate-400 hover:text-slate-700 px-2 py-1"
                                    >
                                        Limpiar
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* BARRA DE FILTROS Y BÚSQUEDA RÁPIDA */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            {/* Input Buscador */}
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                <input
                                    type="text"
                                    value={personalSearchText}
                                    onChange={(e) => setPersonalSearchText(e.target.value)}
                                    placeholder="Buscar por Nombre, RUT, Colegio..."
                                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>

                            {/* Filtro por RBD / Colegio */}
                            <div>
                                <select
                                    value={filtroRbd}
                                    onChange={(e) => setFiltroRbd(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                                >
                                    <option value="TODOS">Todos los Colegios / RBD</option>
                                    {data.colegiosDisponibles.map(col => (
                                        <option key={col.rbd} value={col.rbd}>
                                            RBD {col.rbd} - {col.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro por Cargo */}
                            <div>
                                <select
                                    value={filtroCargo}
                                    onChange={(e) => setFiltroCargo(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                                >
                                    <option value="TODOS">Todos los Cargos</option>
                                    {data.cargosDisponibles.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro por Estado respecto a jefatura */}
                            <div>
                                <select
                                    value={filtroEstado}
                                    onChange={(e) => setFiltroEstado(e.target.value as any)}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                                >
                                    <option value="TODOS">Todos los Estados</option>
                                    <option value="ASIGNADOS">Solo Asignados a esta Jefatura</option>
                                    <option value="NO_ASIGNADOS">No Asignados a esta Jefatura</option>
                                </select>
                            </div>
                        </div>

                        {/* ACCIONES DE SELECCIÓN RÁPIDA */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs font-semibold text-slate-600">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleSelectAllVisible}
                                    className="text-cyan-700 hover:text-cyan-900 underline underline-offset-2 transition"
                                >
                                    Seleccionar todos los visibles ({filteredPersonal.length})
                                </button>
                                <span>·</span>
                                <button
                                    type="button"
                                    onClick={handleClearSelection}
                                    className="text-slate-500 hover:text-slate-800 transition"
                                >
                                    Deseleccionar todo
                                </button>
                            </div>

                            {filtroRbd !== 'TODOS' && selectedJefaturaId && (
                                <button
                                    type="button"
                                    onClick={() => handleAsignarTodoRbd(Number(filtroRbd))}
                                    disabled={isPending}
                                    className="px-3 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded-lg font-bold transition flex items-center gap-1.5"
                                >
                                    <School className="w-3.5 h-3.5 text-cyan-600" />
                                    <span>Asignar todo el personal del RBD {filtroRbd}</span>
                                </button>
                            )}
                        </div>

                        {/* TABLA DE PERSONAL */}
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="p-3 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                checked={filteredPersonal.length > 0 && selectedRutHashes.size === filteredPersonal.length}
                                                onChange={(e) => {
                                                    if (e.target.checked) handleSelectAllVisible()
                                                    else handleClearSelection()
                                                }}
                                                className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                            />
                                        </th>
                                        <th className="p-3">Colaborador / RUT</th>
                                        <th className="p-3">Cargo</th>
                                        <th className="p-3">RBD / Establecimiento</th>
                                        <th className="p-3">Sucursal</th>
                                        <th className="p-3 text-center">Estado Actual</th>
                                        <th className="p-3 text-right">Acción Rápida</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredPersonal.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-slate-400">
                                                <Info className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                                <p className="font-medium">No se encontraron colaboradores que coincidan con los filtros aplicados.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPersonal.map((persona) => {
                                            const isSelected = selectedRutHashes.has(persona.rutHash)
                                            const key = selectedJefaturaId ? `${modoJefatura}_${selectedJefaturaId}_${persona.rutHash}` : ''
                                            const isAsignadoAEstaJefatura = selectedJefaturaId ? asignacionMap.has(key) : false

                                            // Otras jefaturas que tienen asignado a este colaborador
                                            const allAsigs = personalToJefaturasMap.get(persona.rutHash) || []
                                            const otrasJefaturas = allAsigs.filter(a => {
                                                const jId = a.tipo === 'USUARIO' ? a.jefaturaUserId : a.jefaturaRoleId
                                                return !(a.tipo === modoJefatura && jId === selectedJefaturaId)
                                            })

                                            return (
                                                <tr
                                                    key={persona.rutHash}
                                                    className={`hover:bg-cyan-50/40 transition-colors ${
                                                        isSelected ? 'bg-cyan-50/70 font-semibold' : ''
                                                    } ${isAsignadoAEstaJefatura ? 'bg-emerald-50/30' : ''}`}
                                                >
                                                    <td className="p-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => handleToggleSelectPersonal(persona.rutHash)}
                                                            className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                                        />
                                                    </td>

                                                    <td className="p-3">
                                                        <div className="font-bold text-slate-900">{persona.nombre}</div>
                                                        <div className="text-[11px] text-slate-500 font-mono tracking-wide">{persona.rut}</div>
                                                    </td>

                                                    <td className="p-3">
                                                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-[11px] font-semibold">
                                                            {persona.cargo || 'Sin cargo'}
                                                        </span>
                                                    </td>

                                                    <td className="p-3">
                                                        <div className="font-semibold text-slate-800 flex items-center gap-1">
                                                            <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold">
                                                                RBD {persona.rbd || 'N/A'}
                                                            </span>
                                                            <span className="truncate max-w-[200px]" title={persona.establecimiento || ''}>
                                                                {persona.establecimiento || '-'}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="p-3 text-slate-600">
                                                        {persona.sucursal}
                                                    </td>

                                                    <td className="p-3 text-center">
                                                        {isAsignadoAEstaJefatura ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                                                                <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                                                <span>Asignado</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-medium">
                                                                No asignado
                                                            </span>
                                                        )}

                                                        {otrasJefaturas.length > 0 && (
                                                            <div className="text-[10px] text-slate-400 mt-0.5" title={`También asignado a: ${otrasJefaturas.map(o => o.jefaturaNombre).join(', ')}`}>
                                                                + en {otrasJefaturas.length} otra{otrasJefaturas.length > 1 ? 's' : ''} jefatura{otrasJefaturas.length > 1 ? 's' : ''}
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="p-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleIndividualAsignacion(persona)}
                                                            disabled={isPending || !selectedJefaturaId}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-2xs ${
                                                                isAsignadoAEstaJefatura
                                                                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                                                    : 'bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-40'
                                                            }`}
                                                        >
                                                            {isAsignadoAEstaJefatura ? 'Quitar' : '+ Asignar'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENIDO PESTAÑA 2: MATRIZ CONSOLIDADA DE ASIGNACIONES */}
            {activeTab === 'matriz' && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                        <div>
                            <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                                <Layers className="w-5 h-5 text-cyan-600" />
                                <span>Matriz Consolidada de Jefaturas y Colaboradores</span>
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Revisa el mapa completo de supervisión: todas las jefaturas configuradas con su dotación a cargo.
                            </p>
                        </div>

                        {/* Buscador en matriz */}
                        <div className="relative w-full sm:w-64">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                value={matrizQuery}
                                onChange={(e) => setMatrizQuery(e.target.value)}
                                placeholder="Filtrar jefatura o colaborador..."
                                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                    </div>

                    {matrizGrouped.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="font-semibold text-sm">No hay asignaciones registradas aún en el sistema.</p>
                            <p className="text-xs text-slate-400 mt-1">Usa la pestaña "Asignar por Jefatura" para asociar personal a una jefatura.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {matrizGrouped.map((grupo) => (
                                <div key={grupo.key} className="border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:border-cyan-300 transition">
                                    {/* Cabecera del Grupo */}
                                    <div className="bg-slate-50 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white font-extrabold flex items-center justify-center text-xs shrink-0 shadow-xs">
                                                {grupo.tipo === 'USUARIO' ? 'U' : 'R'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                                    <span>{grupo.jefaturaNombre}</span>
                                                    <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-[10px] rounded-md font-bold">
                                                        {grupo.tipo === 'USUARIO' ? 'Usuario' : 'Rol'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                                                    {grupo.jefaturaUsername && <span>@{grupo.jefaturaUsername}</span>}
                                                    <span>·</span>
                                                    <span className="font-semibold text-slate-700">{grupo.items.length} colaboradores a cargo</span>
                                                    <span>·</span>
                                                    <span>{grupo.rbds.size} RBDs cubiertos</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-end sm:self-center">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setModoJefatura(grupo.tipo)
                                                    setSelectedJefaturaId(grupo.jefaturaId)
                                                    setActiveTab('asignacion')
                                                }}
                                                className="px-3 py-1.5 bg-white hover:bg-cyan-50 text-cyan-700 border border-slate-300 hover:border-cyan-400 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                                            >
                                                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-600" />
                                                <span>Gestionar Asignación</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleEliminarTodaAsignacionJefatura(grupo.tipo, grupo.jefaturaId, grupo.jefaturaNombre)}
                                                disabled={isPending}
                                                className="p-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-300 hover:border-rose-300 rounded-lg transition"
                                                title="Eliminar todas las asignaciones"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Grilla compacta de colaboradores asignados */}
                                    <div className="p-4 bg-white">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                                            {grupo.items.map((asig) => (
                                                <div
                                                    key={asig.id}
                                                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2 hover:bg-cyan-50/50 transition group"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-xs text-slate-900 truncate">
                                                            {asig.personalNombre}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 font-mono">
                                                            {asig.personalRut}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                                            {asig.personalRbd && (
                                                                <span className="font-bold text-cyan-700">RBD {asig.personalRbd}</span>
                                                            )}
                                                            <span className="truncate">· {asig.personalCargo || 'Sin cargo'}</span>
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            startTransition(async () => {
                                                                const res = await removerAsignacionesJefaturaAction({
                                                                    tipo: grupo.tipo,
                                                                    jefaturaId: grupo.jefaturaId,
                                                                    rutHashes: [asig.personalRutHash]
                                                                })
                                                                if (res.success) {
                                                                    setFeedback({ tipo: 'success', mensaje: `Removido ${asig.personalNombre}` })
                                                                    const { getConfiguracionVisualizacionDataAction } = await import('./actions')
                                                                    const fresh = await getConfiguracionVisualizacionDataAction()
                                                                    if (fresh.success) setData(fresh)
                                                                    setTimeout(() => setFeedback(null), 3000)
                                                                }
                                                            })
                                                        }}
                                                        disabled={isPending}
                                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition shrink-0"
                                                        title="Remover de esta jefatura"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* CONTENIDO PESTAÑA 3: BÚSQUEDA RÁPIDA DE PERSONAL */}
            {activeTab === 'buscador' && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                    <div className="pb-3 border-b border-slate-100">
                        <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                            <Search className="w-5 h-5 text-cyan-600" />
                            <span>Buscador Rápido de Colaboradores y su Jefatura Asignada</span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Escribe el nombre o RUT de un colaborador de dotación para comprobar a qué jefatura(s) está asociado.
                        </p>
                    </div>

                    <div className="max-w-xl">
                        <div className="relative">
                            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
                            <input
                                type="text"
                                value={colaboradorQuery}
                                onChange={(e) => setColaboradorQuery(e.target.value)}
                                placeholder="Escribe al menos 2 caracteres (Ej: María, 15420...)"
                                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                    </div>

                    {colaboradorQuery.trim().length >= 2 && (
                        <div className="space-y-3 pt-2">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Resultados ({resultadosColaborador.length})
                            </div>

                            {resultadosColaborador.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                                    No se encontraron colaboradores en Dotación con ese criterio de búsqueda.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {resultadosColaborador.map((persona) => {
                                        const asignacionesPersona = personalToJefaturasMap.get(persona.rutHash) || []

                                        return (
                                            <div
                                                key={persona.rutHash}
                                                className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 hover:border-cyan-300 transition"
                                            >
                                                <div className="flex justify-between items-start gap-2">
                                                    <div>
                                                        <div className="font-extrabold text-sm text-slate-900">
                                                            {persona.nombre}
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-mono">
                                                            RUT: {persona.rut} · Cargo: <span className="font-semibold text-slate-700">{persona.cargo || 'N/A'}</span>
                                                        </div>
                                                    </div>

                                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold">
                                                        RBD {persona.rbd || 'N/A'}
                                                    </span>
                                                </div>

                                                <div className="text-xs text-slate-600 truncate">
                                                    🏫 {persona.establecimiento || 'Sin establecimiento'} ({persona.sucursal})
                                                </div>

                                                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-1.5">
                                                    <span className="text-[11px] font-bold text-slate-500">Jefatura Asignada:</span>
                                                    {asignacionesPersona.length === 0 ? (
                                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[10px] font-semibold">
                                                            Sin jefatura asignada
                                                        </span>
                                                    ) : (
                                                        asignacionesPersona.map((asig) => (
                                                            <span
                                                                key={asig.id}
                                                                className="px-2 py-0.5 bg-cyan-100 text-cyan-800 rounded-md text-[11px] font-bold flex items-center gap-1"
                                                            >
                                                                <UserCheck className="w-3 h-3 text-cyan-600" />
                                                                <span>{asig.jefaturaNombre}</span>
                                                                <span className="text-[9px] text-cyan-600">({asig.tipo})</span>
                                                            </span>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
