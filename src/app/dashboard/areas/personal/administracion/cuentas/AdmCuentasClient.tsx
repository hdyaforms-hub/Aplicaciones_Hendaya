'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
    UsuarioCuentaRHDTO,
    togglePermisoCerrarPeriodosAction,
    getUsuariosCuentasRHAction
} from './actions'
import {
    Shield,
    Users,
    Search,
    RefreshCw,
    Lock,
    Unlock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Building2,
    Calendar,
    ChevronLeft,
    ChevronRight,
    UserCheck,
    UserX,
    Filter,
    ShieldCheck,
    Info,
    Check,
    X
} from 'lucide-react'

interface AdmCuentasClientProps {
    initialUsuarios: UsuarioCuentaRHDTO[]
    currentUserId: string
    isAdmin: boolean
}

type SortField = 'name' | 'username' | 'roleName' | 'puedeCerrarPeriodos' | 'autorizadoAt'

export default function AdmCuentasClient({
    initialUsuarios,
    currentUserId,
    isAdmin
}: AdmCuentasClientProps) {
    const [usuarios, setUsuarios] = useState<UsuarioCuentaRHDTO[]>(initialUsuarios)
    const [searchTerm, setSearchTerm] = useState('')
    const [filtroAlcance, setFiltroAlcance] = useState<'SOLO_RH' | 'TODOS'>('SOLO_RH')
    const [filtroPermiso, setFiltroPermiso] = useState<'TODOS' | 'HABILITADOS' | 'DESHABILITADOS'>('TODOS')

    const [isPending, startTransition] = useTransition()
    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean
        usuario: UsuarioCuentaRHDTO | null
        nuevoEstado: boolean
    }>({
        isOpen: false,
        usuario: null,
        nuevoEstado: false
    })

    // Paginación y Ordenamiento (10 registros por página según estándar)
    const [paginaActual, setPaginaActual] = useState(1)
    const pageSize = 10
    const [sortField, setSortField] = useState<SortField>('puedeCerrarPeriodos')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        setToastMessage({ type, text })
        setTimeout(() => setToastMessage(null), 5000)
    }

    const recargarDatos = async () => {
        startTransition(async () => {
            const res = await getUsuariosCuentasRHAction({
                search: searchTerm,
                filtroAlcance
            })
            if (res.success) {
                setUsuarios(res.data)
                showToast('Listado de cuentas actualizado correctamente')
            } else {
                showToast(res.error || 'Error al actualizar cuentas', 'error')
            }
        })
    }

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
        setPaginaActual(1)
    }

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-50 group-hover:opacity-100 transition-opacity" />
        }
        return sortDirection === 'asc'
            ? <ArrowUp className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
            : <ArrowDown className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
    }

    // Filtrado en memoria
    const usuariosFiltrados = useMemo(() => {
        return usuarios.filter(u => {
            // Filtro por término
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase().trim()
                const matchUser = u.username.toLowerCase().includes(term)
                const matchName = (u.name || '').toLowerCase().includes(term)
                const matchEmail = (u.email || '').toLowerCase().includes(term)
                const matchRole = u.roleName.toLowerCase().includes(term)
                if (!matchUser && !matchName && !matchEmail && !matchRole) return false
            }

            // Filtro por estado del permiso
            if (filtroPermiso === 'HABILITADOS' && !u.puedeCerrarPeriodos) return false
            if (filtroPermiso === 'DESHABILITADOS' && u.puedeCerrarPeriodos) return false

            return true
        })
    }, [usuarios, searchTerm, filtroPermiso])

    // Ordenamiento
    const usuariosOrdenados = useMemo(() => {
        const sorted = [...usuariosFiltrados]
        sorted.sort((a, b) => {
            let valA: any = ''
            let valB: any = ''

            switch (sortField) {
                case 'name':
                    valA = (a.name || a.username).toLowerCase()
                    valB = (b.name || b.username).toLowerCase()
                    break
                case 'username':
                    valA = a.username.toLowerCase()
                    valB = b.username.toLowerCase()
                    break
                case 'roleName':
                    valA = a.roleName.toLowerCase()
                    valB = b.roleName.toLowerCase()
                    break
                case 'puedeCerrarPeriodos':
                    valA = a.puedeCerrarPeriodos ? 1 : 0
                    valB = b.puedeCerrarPeriodos ? 1 : 0
                    break
                case 'autorizadoAt':
                    valA = a.autorizadoAt ? new Date(a.autorizadoAt).getTime() : 0
                    valB = b.autorizadoAt ? new Date(b.autorizadoAt).getTime() : 0
                    break
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1
            return 0
        })
        return sorted
    }, [usuariosFiltrados, sortField, sortDirection])

    // Paginación (10 registros por página)
    const totalRegistros = usuariosOrdenados.length
    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / pageSize))
    const paginaValida = Math.min(paginaActual, totalPaginas)
    const inicioIdx = (paginaValida - 1) * pageSize
    const usuariosPaginados = usuariosOrdenados.slice(inicioIdx, inicioIdx + pageSize)

    // Estadísticas
    const totalRH = usuarios.length
    const totalHabilitados = usuarios.filter(u => u.puedeCerrarPeriodos).length
    const totalRestringidos = totalRH - totalHabilitados

    const solicitarCambioPermiso = (usuario: UsuarioCuentaRHDTO) => {
        const nuevoEstado = !usuario.puedeCerrarPeriodos
        setConfirmModal({
            isOpen: true,
            usuario,
            nuevoEstado
        })
    }

    const ejecutarCambioPermiso = () => {
        if (!confirmModal.usuario) return
        const usuarioTarget = confirmModal.usuario
        const nuevoEstado = confirmModal.nuevoEstado

        setConfirmModal({ isOpen: false, usuario: null, nuevoEstado: false })

        startTransition(async () => {
            // Actualización optimista local
            setUsuarios(prev => prev.map(u => {
                if (u.id === usuarioTarget.id) {
                    return {
                        ...u,
                        puedeCerrarPeriodos: nuevoEstado,
                        autorizadoPor: 'Administrador (Tú)',
                        autorizadoAt: new Date().toISOString()
                    }
                }
                return u
            }))

            const res = await togglePermisoCerrarPeriodosAction(usuarioTarget.id, nuevoEstado)
            if (res.success) {
                showToast(
                    nuevoEstado
                        ? `Permiso HABILITADO para ${usuarioTarget.name || usuarioTarget.username}. Ahora puede cerrar/abrir períodos en RRHH.`
                        : `Permiso REVOCADO para ${usuarioTarget.name || usuarioTarget.username}. Ya no podrá cerrar ni abrir períodos en RRHH.`
                )
            } else {
                // Revertir en caso de error
                setUsuarios(prev => prev.map(u => {
                    if (u.id === usuarioTarget.id) {
                        return {
                            ...u,
                            puedeCerrarPeriodos: !nuevoEstado
                        }
                    }
                    return u
                }))
                showToast(res.error || 'Error al modificar permisos', 'error')
            }
        })
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Toast flotante */}
            {toastMessage && (
                <div
                    className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-medium transition-all transform animate-in slide-in-from-bottom-5 ${
                        toastMessage.type === 'success'
                            ? 'bg-slate-900 text-white border-cyan-500/50 shadow-cyan-950/20'
                            : 'bg-rose-900 text-white border-rose-500/50 shadow-rose-950/20'
                    }`}
                >
                    {toastMessage.type === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                    <span>{toastMessage.text}</span>
                    <button
                        onClick={() => setToastMessage(null)}
                        className="ml-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Banner Oficial Hendaya */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-7 shadow-xl border border-slate-700/50">
                <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                Áreas / Recursos Humanos / Administración
                            </span>
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <ShieldCheck className="w-3.5 h-3.5" /> Control de Períodos
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                            <Shield className="w-8 h-8 text-cyan-400" />
                            Adm. de Cuenta &mdash; Permisos de Períodos
                        </h1>
                        <p className="mt-2 text-sm text-slate-300 max-w-2xl leading-relaxed">
                            Gestión centralizada de cuentas de usuario del área de Personal y Recursos Humanos.
                            Controla qué colaboradores tienen la facultad de <span className="text-cyan-300 font-semibold">cerrar o abrir períodos</span> en cualquier módulo de Recursos Humanos (Adm. Ausentismo, Adm. de Hrs Extras y módulos anexos).
                        </p>
                    </div>

                    <div className="flex items-center gap-3 self-start md:self-auto">
                        <button
                            onClick={recargarDatos}
                            disabled={isPending}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600/60 shadow-sm hover:shadow transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 text-cyan-400 ${isPending ? 'animate-spin' : ''}`} />
                            <span>Actualizar</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tarjetas de Estadísticas / Resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cuentas RH Identificadas</p>
                            <p className="text-2xl font-bold text-slate-900 mt-1">{totalRH}</p>
                            <p className="text-xs text-slate-500 mt-1">Personal con acceso a la plataforma</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
                            <Users className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-emerald-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Habilitados para Períodos</p>
                            <p className="text-2xl font-bold text-emerald-600 mt-1">{totalHabilitados}</p>
                            <p className="text-xs text-emerald-700/80 mt-1">Pueden abrir y cerrar períodos en RRHH</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-200">
                            <Unlock className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-amber-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Acceso Restringido</p>
                            <p className="text-2xl font-bold text-amber-600 mt-1">{totalRestringidos}</p>
                            <p className="text-xs text-amber-700/80 mt-1">Sin facultad de abrir ni cerrar períodos</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200">
                            <Lock className="w-6 h-6" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Aviso Informativo de Reglas de Negocio */}
            <div className="bg-cyan-50/70 border border-cyan-200/80 rounded-xl p-4.5 text-xs text-cyan-900 flex items-start gap-3.5 shadow-sm">
                <Info className="w-5 h-5 text-cyan-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="font-semibold text-cyan-950">
                        Políticas de Seguridad y Control de Cierre en Recursos Humanos
                    </p>
                    <p className="text-cyan-800 leading-relaxed">
                        Solo los usuarios con el check <strong className="text-cyan-950">&quot;Habilitado para Cerrar/Abrir Períodos&quot;</strong> marcado tendrán la capacidad de realizar cierres o reaperturas de planillas y períodos en los módulos de <strong className="text-cyan-950">Adm. Ausentismo</strong>, <strong className="text-cyan-950">Adm. de Hrs Extras</strong> y otros módulos de RRHH. Si un usuario no tiene este permiso, los botones de acción permanecerán bloqueados y cualquier intento en el servidor será denegado. Cada cambio de permiso queda registrado con fecha y responsable en el módulo de <strong className="text-cyan-950">Auditoría</strong>.
                    </p>
                </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                    {/* Buscador */}
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar por usuario, nombre completo, email o rol..."
                            value={searchTerm}
                            onChange={e => {
                                setSearchTerm(e.target.value)
                                setPaginaActual(1)
                            }}
                            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition-all text-slate-800 placeholder-slate-400"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => {
                                    setSearchTerm('')
                                    setPaginaActual(1)
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Filtros de Alcance y Permiso */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Selector Alcance */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
                            <button
                                onClick={() => {
                                    setFiltroAlcance('SOLO_RH')
                                    setPaginaActual(1)
                                }}
                                className={`px-3 py-1.5 rounded-md transition-all ${
                                    filtroAlcance === 'SOLO_RH'
                                        ? 'bg-white text-cyan-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Solo Área RRHH
                            </button>
                            <button
                                onClick={() => {
                                    setFiltroAlcance('TODOS')
                                    setPaginaActual(1)
                                }}
                                className={`px-3 py-1.5 rounded-md transition-all ${
                                    filtroAlcance === 'TODOS'
                                        ? 'bg-white text-cyan-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Todos los Usuarios
                            </button>
                        </div>

                        {/* Filtro por estado de permiso */}
                        <select
                            value={filtroPermiso}
                            onChange={e => {
                                setFiltroPermiso(e.target.value as any)
                                setPaginaActual(1)
                            }}
                            className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                        >
                            <option value="TODOS">Todos los Estados</option>
                            <option value="HABILITADOS">Solo Habilitados</option>
                            <option value="DESHABILITADOS">Solo Restringidos</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                    <span>
                        Mostrando <strong className="text-slate-800">{totalRegistros}</strong> cuenta(s) en total
                    </span>
                    <span className="text-slate-400">
                        Página {paginaValida} de {totalPaginas} (10 registros por página)
                    </span>
                </div>
            </div>

            {/* Tabla de Usuarios con Estándar Hendaya */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 select-none">
                                <th
                                    onClick={() => handleSort('name')}
                                    className="py-3.5 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors group"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Colaborador / Nombre</span>
                                        {renderSortIcon('name')}
                                    </div>
                                </th>

                                <th
                                    onClick={() => handleSort('username')}
                                    className="py-3.5 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors group"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Usuario</span>
                                        {renderSortIcon('username')}
                                    </div>
                                </th>

                                <th
                                    onClick={() => handleSort('roleName')}
                                    className="py-3.5 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors group"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Rol Asignado</span>
                                        {renderSortIcon('roleName')}
                                    </div>
                                </th>

                                <th className="py-3.5 px-4">
                                    <span>Áreas Vinculadas</span>
                                </th>

                                <th
                                    onClick={() => handleSort('puedeCerrarPeriodos')}
                                    className="py-3.5 px-4 text-center cursor-pointer hover:bg-slate-200/70 transition-colors group"
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        <span>¿Puede Cerrar / Abrir Períodos?</span>
                                        {renderSortIcon('puedeCerrarPeriodos')}
                                    </div>
                                </th>

                                <th
                                    onClick={() => handleSort('autorizadoAt')}
                                    className="py-3.5 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors group"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Última Autorización</span>
                                        {renderSortIcon('autorizadoAt')}
                                    </div>
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
                            {usuariosPaginados.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Users className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                                            <p className="text-sm font-medium text-slate-500">
                                                No se encontraron cuentas de usuario que coincidan con los filtros
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                usuariosPaginados.map(usuario => {
                                    const esPropioUsuario = usuario.id === currentUserId

                                    return (
                                        <tr
                                            key={usuario.id}
                                            className={`hover:bg-slate-50/80 transition-colors ${
                                                usuario.puedeCerrarPeriodos ? 'bg-emerald-50/20' : ''
                                            }`}
                                        >
                                            {/* Nombre y Correo */}
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                                                        usuario.puedeCerrarPeriodos
                                                            ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                                                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                    }`}>
                                                        {(usuario.name || usuario.username).substring(0, 2)}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                                            {usuario.name || 'Sin Nombre Registrado'}
                                                            {esPropioUsuario && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 font-bold border border-cyan-200">
                                                                    Tú
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400">
                                                            {usuario.email || 'Sin correo registrado'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Nombre de Usuario */}
                                            <td className="py-3 px-4 font-mono text-slate-600 font-medium">
                                                @{usuario.username}
                                            </td>

                                            {/* Rol */}
                                            <td className="py-3 px-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                                    {usuario.roleName}
                                                </span>
                                            </td>

                                            {/* Áreas */}
                                            <td className="py-3 px-4">
                                                <div className="flex flex-wrap gap-1 max-w-xs">
                                                    {usuario.areas.length > 0 ? (
                                                        usuario.areas.map((area, i) => (
                                                            <span
                                                                key={i}
                                                                className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                                                    area.toLowerCase().includes('recurso') || area.toLowerCase().includes('personal')
                                                                        ? 'bg-cyan-50 text-cyan-700 border-cyan-200 font-semibold'
                                                                        : 'bg-slate-50 text-slate-600 border-slate-200'
                                                                }`}
                                                            >
                                                                {area}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-slate-400 text-[11px]">Sin área</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Check Interactivo para Cerrar / Abrir Períodos */}
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex flex-col items-center justify-center gap-1">
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={usuario.puedeCerrarPeriodos}
                                                            onChange={() => solicitarCambioPermiso(usuario)}
                                                            disabled={isPending}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600 transition-colors"></div>
                                                    </label>

                                                    <span className={`text-[10px] font-bold ${
                                                        usuario.puedeCerrarPeriodos ? 'text-cyan-700' : 'text-slate-400'
                                                    }`}>
                                                        {usuario.puedeCerrarPeriodos ? 'HABILITADO' : 'NO HABILITADO'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Autorizado Por / Fecha */}
                                            <td className="py-3 px-4 text-[11px]">
                                                {usuario.puedeCerrarPeriodos ? (
                                                    <div>
                                                        <div className="font-medium text-slate-800 flex items-center gap-1">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                                                            <span>{usuario.autorizadoPor || 'Administrador'}</span>
                                                        </div>
                                                        <div className="text-slate-400 text-[10px] mt-0.5">
                                                            {usuario.autorizadoAt
                                                                ? new Date(usuario.autorizadoAt).toLocaleString('es-CL', {
                                                                      day: '2-digit',
                                                                      month: '2-digit',
                                                                      year: 'numeric',
                                                                      hour: '2-digit',
                                                                      minute: '2-digit'
                                                                  })
                                                                : 'Registrado'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">Sin autorización activa</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Barra de Paginación Estándar (10 por página, Anterior / Siguiente) */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 bg-slate-50/80 border-t border-slate-200 gap-3">
                    <div className="text-xs text-slate-500">
                        Mostrando registros del <strong className="text-slate-800">{totalRegistros > 0 ? inicioIdx + 1 : 0}</strong> al{' '}
                        <strong className="text-slate-800">{Math.min(inicioIdx + pageSize, totalRegistros)}</strong> de un total de{' '}
                        <strong className="text-slate-800">{totalRegistros}</strong>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPaginaActual(prev => Math.max(1, prev - 1))}
                            disabled={paginaValida <= 1 || isPending}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <span>Anterior</span>
                        </button>

                        <div className="text-xs font-bold px-3 py-1 rounded-md bg-white border border-slate-200 text-slate-800">
                            Página {paginaValida} de {totalPaginas}
                        </div>

                        <button
                            onClick={() => setPaginaActual(prev => Math.min(totalPaginas, prev + 1))}
                            disabled={paginaValida >= totalPaginas || isPending}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
                        >
                            <span>Siguiente</span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Confirmación de Cambio de Permiso */}
            {confirmModal.isOpen && confirmModal.usuario && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                confirmModal.nuevoEstado
                                    ? 'bg-cyan-100 text-cyan-700'
                                    : 'bg-amber-100 text-amber-700'
                            }`}>
                                {confirmModal.nuevoEstado ? (
                                    <Unlock className="w-6 h-6" />
                                ) : (
                                    <Lock className="w-6 h-6" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">
                                    {confirmModal.nuevoEstado
                                        ? 'Habilitar Permiso de Períodos'
                                        : 'Revocar Permiso de Períodos'}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Confirmación de política de Recursos Humanos
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Usuario:</span>
                                <span className="text-slate-900 font-bold">@{confirmModal.usuario.username}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Colaborador:</span>
                                <span className="text-slate-900 font-bold">{confirmModal.usuario.name || 'Sin Nombre'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Rol:</span>
                                <span className="text-slate-800 font-semibold">{confirmModal.usuario.roleName}</span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                            {confirmModal.nuevoEstado ? (
                                <span>
                                    Al habilitar este permiso, el usuario <strong className="text-slate-900">{confirmModal.usuario.name || confirmModal.usuario.username}</strong> tendrá la facultad de <strong className="text-cyan-700">cerrar y abrir períodos</strong> en los módulos de Administración de Recursos Humanos (Adm. Ausentismo, Adm. de Hrs Extras y módulos anexos).
                                </span>
                            ) : (
                                <span>
                                    Al revocar este permiso, el usuario <strong className="text-slate-900">{confirmModal.usuario.name || confirmModal.usuario.username}</strong> <strong className="text-rose-700">no podrá cerrar ni abrir períodos</strong> en ningún módulo de Recursos Humanos.
                                </span>
                            )}
                        </p>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => setConfirmModal({ isOpen: false, usuario: null, nuevoEstado: false })}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={ejecutarCambioPermiso}
                                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all ${
                                    confirmModal.nuevoEstado
                                        ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/30'
                                        : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                                }`}
                            >
                                {confirmModal.nuevoEstado ? 'Confirmar y Habilitar' : 'Confirmar y Revocar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
