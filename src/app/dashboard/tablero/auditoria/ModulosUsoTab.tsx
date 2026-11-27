'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts'
import * as XLSX from 'xlsx'
import { fetchModuleUsageAnalyticsAction } from './actions'
import { ModuleUsageResult, ModuleUsageStat } from '@/lib/audit-analytics'

// Paleta corporativa Hendaya para gráficos
const CHART_COLORS = [
    '#06b6d4', // cyan-500
    '#0284c7', // sky-600
    '#6366f1', // indigo-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ec4899', // pink-500
    '#8b5cf6', // purple-500
    '#14b8a6', // teal-500
    '#f43f5e', // rose-500
    '#64748b', // slate-500
    '#3b82f6', // blue-500
    '#84cc16', // lime-500
]

type RoleOption = {
    id: string
    name: string
    description?: string | null
    _count?: { users: number }
}

type UserOption = {
    id: string
    username: string
    name: string
    fullName: string
    roleId: string
    roleName: string
}

type SortField = 'totalVisits' | 'totalMinutes' | 'avgMinutesPerVisit' | 'uniqueUsersCount' | 'modulo'
type SortOrder = 'asc' | 'desc'

export default function ModulosUsoTab({
    roles,
    users
}: {
    roles: RoleOption[]
    users: UserOption[]
}) {
    // Filtros
    const [periodPreset, setPeriodPreset] = useState<'all' | 'this_month' | 'last_30' | 'last_90' | 'custom'>('all')
    const [dateFrom, setDateFrom] = useState<string>('')
    const [dateTo, setDateTo] = useState<string>('')
    const [selectedRole, setSelectedRole] = useState<string>('ALL')
    const [selectedUser, setSelectedUser] = useState<string>('ALL')
    const [searchModule, setSearchModule] = useState<string>('')
    const [selectedArea, setSelectedArea] = useState<string>('ALL')

    // Ordenamiento de tabla
    const [sortField, setSortField] = useState<SortField>('totalVisits')
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

    // Módulo expandido en la tabla
    const [expandedModule, setExpandedModule] = useState<string | null>(null)

    // Estados de carga y datos
    const [loading, setLoading] = useState<boolean>(true)
    const [exporting, setExporting] = useState<boolean>(false)
    const [error, setError] = useState<string>('')
    const [analytics, setAnalytics] = useState<ModuleUsageResult | null>(null)

    // Gestión de presets de período
    const handlePresetChange = (preset: 'all' | 'this_month' | 'last_30' | 'last_90' | 'custom') => {
        setPeriodPreset(preset)
        const now = new Date()

        if (preset === 'all') {
            setDateFrom('')
            setDateTo('')
        } else if (preset === 'this_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
            setDateFrom(firstDay.toISOString().slice(0, 10))
            setDateTo(now.toISOString().slice(0, 10))
        } else if (preset === 'last_30') {
            const past = new Date()
            past.setDate(past.getDate() - 30)
            setDateFrom(past.toISOString().slice(0, 10))
            setDateTo(now.toISOString().slice(0, 10))
        } else if (preset === 'last_90') {
            const past = new Date()
            past.setDate(past.getDate() - 90)
            setDateFrom(past.toISOString().slice(0, 10))
            setDateTo(now.toISOString().slice(0, 10))
        }
    }

    // Cargar analítica de uso de módulos
    const loadModuleAnalytics = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const data = await fetchModuleUsageAnalyticsAction({
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                roleId: selectedRole !== 'ALL' ? selectedRole : undefined,
                username: selectedUser !== 'ALL' ? selectedUser : undefined,
            })
            setAnalytics(data)
        } catch (err: any) {
            console.error('Error cargando analítica de módulos:', err)
            setError(err?.message || 'Error al obtener métricas de uso de módulos')
        } finally {
            setLoading(false)
        }
    }, [dateFrom, dateTo, selectedRole, selectedUser])

    useEffect(() => {
        loadModuleAnalytics()
    }, [loadModuleAnalytics])

    // Usuarios disponibles según el rol
    const availableUsers = useMemo(() => {
        if (selectedRole === 'ALL') return users
        return users.filter((u) => u.roleId === selectedRole)
    }, [users, selectedRole])

    // Lista de áreas únicas para filtrar
    const uniqueAreas = useMemo(() => {
        if (!analytics) return []
        const set = new Set<string>()
        analytics.modules.forEach(m => set.add(m.mainCategory))
        return Array.from(set).sort()
    }, [analytics])

    // Módulos filtrados y ordenados para la tabla
    const filteredModules = useMemo(() => {
        if (!analytics) return []

        let list = [...analytics.modules]

        // Filtro por texto
        if (searchModule.trim()) {
            const q = searchModule.toLowerCase().trim()
            list = list.filter(m => m.modulo.toLowerCase().includes(q) || m.mainCategory.toLowerCase().includes(q))
        }

        // Filtro por área
        if (selectedArea !== 'ALL') {
            list = list.filter(m => m.mainCategory === selectedArea)
        }

        // Ordenamiento dinámico
        list.sort((a, b) => {
            let res = 0
            if (sortField === 'modulo') {
                res = a.modulo.localeCompare(b.modulo, 'es')
            } else if (sortField === 'totalVisits') {
                res = a.totalVisits - b.totalVisits
            } else if (sortField === 'totalMinutes') {
                res = a.totalMinutes - b.totalMinutes
            } else if (sortField === 'avgMinutesPerVisit') {
                res = a.avgMinutesPerVisit - b.avgMinutesPerVisit
            } else if (sortField === 'uniqueUsersCount') {
                res = a.uniqueUsersCount - b.uniqueUsersCount
            }
            return sortOrder === 'desc' ? -res : res
        })

        return list
    }, [analytics, searchModule, selectedArea, sortField, sortOrder])

    // Alternar ordenamiento
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('desc')
        }
    }

    // Resetear filtros
    const handleResetFilters = () => {
        setPeriodPreset('all')
        setDateFrom('')
        setDateTo('')
        setSelectedRole('ALL')
        setSelectedUser('ALL')
        setSearchModule('')
        setSelectedArea('ALL')
    }

    // Exportar analítica completa de módulos a Excel
    const handleExportExcel = () => {
        if (!analytics) return
        try {
            setExporting(true)
            const workbook = XLSX.utils.book_new()

            // Hoja 1: Ranking General de Módulos
            const modData = analytics.modules.map((m, i) => ({
                'N°': i + 1,
                'Módulo': m.modulo,
                'Área / Categoría': m.mainCategory,
                'Total Interacciones / Ingresos': m.totalVisits,
                '% del Total': `${m.percentage}%`,
                'Tiempo Total (Horas)': Number(m.totalHours),
                'Tiempo Total (Minutos)': m.totalMinutes,
                'Promedio por Ingreso (Minutos)': m.avgMinutesPerVisit,
                'Usuarios Únicos': m.uniqueUsersCount,
                'Acción Predominante': m.topAction,
                'Nivel de Adopción': m.adoptionLevel,
                'Último Uso': m.lastActivity ? new Date(m.lastActivity).toLocaleString('es-CL') : 'Sin registro'
            }))
            const wsMod = XLSX.utils.json_to_sheet(modData)
            wsMod['!cols'] = [
                { wch: 6 },
                { wch: 38 },
                { wch: 25 },
                { wch: 22 },
                { wch: 14 },
                { wch: 20 },
                { wch: 22 },
                { wch: 26 },
                { wch: 16 },
                { wch: 22 },
                { wch: 18 },
                { wch: 22 }
            ]
            XLSX.utils.book_append_sheet(workbook, wsMod, 'Ranking de Módulos')

            // Hoja 2: Distribución por Macro-Áreas
            const areaData = analytics.areaDistribution.map((a, i) => ({
                'N°': i + 1,
                'Área': a.area,
                'Interacciones': a.count,
                '% Volumen': `${a.percentage}%`,
                'Tiempo Total (Horas)': Number(a.totalHours),
                'Módulos Asignados': a.modulesCount
            }))
            const wsArea = XLSX.utils.json_to_sheet(areaData)
            wsArea['!cols'] = [{ wch: 6 }, { wch: 32 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 18 }]
            XLSX.utils.book_append_sheet(workbook, wsArea, 'Uso por Áreas')

            // Hoja 3: Distribución por Tipo de Acción
            const actData = analytics.actionDistribution.map((ac, i) => ({
                'N°': i + 1,
                'Tipo de Acción': ac.action,
                'Total Ocurrencias': ac.count,
                'Porcentaje': `${ac.percentage}%`
            }))
            const wsAct = XLSX.utils.json_to_sheet(actData)
            wsAct['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 18 }, { wch: 14 }]
            XLSX.utils.book_append_sheet(workbook, wsAct, 'Tipos de Acción')

            const nowStr = new Date().toISOString().slice(0, 10)
            XLSX.writeFile(workbook, `Analitica_Uso_Modulos_Hendaya_${nowStr}.xlsx`)
        } catch (e: any) {
            alert('Error al generar Excel: ' + e?.message)
        } finally {
            setExporting(false)
        }
    }

    // Datos para gráfico Top 10
    const top10ChartData = useMemo(() => {
        if (!analytics) return []
        return analytics.modules.slice(0, 10).map(m => ({
            name: m.modulo.length > 25 ? m.modulo.slice(0, 24) + '...' : m.modulo,
            fullName: m.modulo,
            visitas: m.totalVisits,
            horas: Number(m.totalHours),
            usuarios: m.uniqueUsersCount
        }))
    }, [analytics])

    // Tooltip personalizado para Recharts
    const CustomBarTooltip = ({ active, payload }: any) => {
        if (!active || !payload || !payload.length) return null
        const d = payload[0].payload
        return (
            <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1">
                <p className="font-bold text-cyan-300">{d.fullName}</p>
                <p className="text-slate-300">📊 <b>{d.visitas}</b> accesos / interacciones</p>
                <p className="text-slate-300">⏱️ <b>{d.horas}</b> horas estimadas de uso</p>
                <p className="text-slate-300">👥 <b>{d.usuarios}</b> usuarios únicos</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* BARRA DE FILTROS Y CONTROLES */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center font-bold text-base shadow-xs">
                            📊
                        </span>
                        <div>
                            <h3 className="text-sm font-bold text-gray-800">Analítica de Uso y Rendimiento de Módulos</h3>
                            <p className="text-xs text-gray-400">Descubre los módulos más utilizados, tiempos de permanencia y adopción por los usuarios.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={loadModuleAnalytics}
                            disabled={loading}
                            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                            title="Actualizar analítica de módulos"
                        >
                            <span className={loading ? 'animate-spin' : ''}>🔄</span>
                            <span>{loading ? 'Actualizando...' : 'Actualizar'}</span>
                        </button>

                        {(dateFrom || dateTo || selectedRole !== 'ALL' || selectedUser !== 'ALL' || periodPreset !== 'all' || selectedArea !== 'ALL' || searchModule) && (
                            <button
                                onClick={handleResetFilters}
                                className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                            >
                                Limpiar Filtros
                            </button>
                        )}

                        <button
                            onClick={handleExportExcel}
                            disabled={exporting || loading || !analytics}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                            <span>{exporting ? '⌛' : '📊'}</span>
                            <span>{exporting ? 'Generando...' : 'Exportar Excel'}</span>
                        </button>
                    </div>
                </div>

                {/* Presets Rápidos de Período */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
                    <span className="text-xs font-semibold text-gray-500 mr-1">Período:</span>
                    {[
                        { key: 'all', label: 'Todo el Historial' },
                        { key: 'this_month', label: 'Este Mes' },
                        { key: 'last_30', label: 'Últimos 30 días' },
                        { key: 'last_90', label: 'Últimos 90 días' },
                        { key: 'custom', label: 'Personalizado' },
                    ].map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => handlePresetChange(p.key as any)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                periodPreset === p.key
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Controles de Selección */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                    {periodPreset === 'custom' && (
                        <>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-600 mb-1">Fecha Desde</label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-800 font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-600 mb-1">Fecha Hasta</label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-800 font-medium"
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">Filtrar por Rol</label>
                        <select
                            value={selectedRole}
                            onChange={(e) => {
                                setSelectedRole(e.target.value)
                                setSelectedUser('ALL')
                            }}
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-800 font-medium"
                        >
                            <option value="ALL">-- Todos los Roles --</option>
                            {roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">Filtrar por Usuario</label>
                        <select
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-800 font-medium"
                        >
                            <option value="ALL">-- Todos los Usuarios --</option>
                            {availableUsers.map((u) => (
                                <option key={u.username} value={u.username}>
                                    {u.name} ({u.username})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">Filtrar por Macro-Área</label>
                        <select
                            value={selectedArea}
                            onChange={(e) => setSelectedArea(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-800 font-medium"
                        >
                            <option value="ALL">-- Todas las Áreas ({uniqueAreas.length}) --</option>
                            {uniqueAreas.map(area => (
                                <option key={area} value={area}>{area}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">Buscar Módulo</label>
                        <input
                            type="text"
                            placeholder="Buscar por nombre..."
                            value={searchModule}
                            onChange={(e) => setSearchModule(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-800 font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-bold">
                    ⚠️ {error}
                </div>
            )}

            {/* KPI CARDS SUPERIORES */}
            {analytics && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Módulo Más Usado */}
                    <div className="bg-gradient-to-br from-cyan-500/10 via-white to-cyan-500/5 p-5 rounded-2xl border border-cyan-200/80 shadow-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-cyan-900">Módulo Más Utilizado</span>
                            <span className="p-2 bg-cyan-100 text-cyan-700 rounded-xl text-lg">🏆</span>
                        </div>
                        <div className="mt-2">
                            <h4 className="text-lg font-black text-slate-900 truncate" title={analytics.summaryCards.topUsedModule.modulo}>
                                {analytics.summaryCards.topUsedModule.modulo}
                            </h4>
                            <p className="text-xs text-cyan-800 font-semibold mt-1">
                                {analytics.summaryCards.topUsedModule.count.toLocaleString('es-CL')} accesos ({analytics.summaryCards.topUsedModule.percentage}% del total)
                            </p>
                        </div>
                    </div>

                    {/* Card 2: Mayor Tiempo de Permanencia */}
                    <div className="bg-gradient-to-br from-sky-500/10 via-white to-sky-500/5 p-5 rounded-2xl border border-sky-200/80 shadow-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-sky-900">Mayor Permanencia</span>
                            <span className="p-2 bg-sky-100 text-sky-700 rounded-xl text-lg">⏱️</span>
                        </div>
                        <div className="mt-2">
                            <h4 className="text-lg font-black text-slate-900 truncate" title={analytics.summaryCards.topTimeModule.modulo}>
                                {analytics.summaryCards.topTimeModule.modulo}
                            </h4>
                            <p className="text-xs text-sky-800 font-semibold mt-1">
                                ~{analytics.summaryCards.topTimeModule.hours} horas dedicadas ({analytics.summaryCards.topTimeModule.minutes} min)
                            </p>
                        </div>
                    </div>

                    {/* Card 3: Módulos Activos vs Total */}
                    <div className="bg-gradient-to-br from-emerald-500/10 via-white to-emerald-500/5 p-5 rounded-2xl border border-emerald-200/80 shadow-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">Módulos Activos</span>
                            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl text-lg">📦</span>
                        </div>
                        <div className="mt-2">
                            <h4 className="text-2xl font-black text-slate-900">
                                {analytics.summaryCards.activeModulesCount}
                            </h4>
                            <p className="text-xs text-emerald-800 font-semibold mt-1">
                                Con {analytics.summaryCards.totalEvents.toLocaleString('es-CL')} interacciones registradas
                            </p>
                        </div>
                    </div>

                    {/* Card 4: Mayor Actividad Transaccional */}
                    <div className="bg-gradient-to-br from-amber-500/10 via-white to-amber-500/5 p-5 rounded-2xl border border-amber-200/80 shadow-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Mayor Transaccionalidad</span>
                            <span className="p-2 bg-amber-100 text-amber-700 rounded-xl text-lg">⚡</span>
                        </div>
                        <div className="mt-2">
                            <h4 className="text-lg font-black text-slate-900 truncate" title={analytics.summaryCards.topTransactionalModule.modulo}>
                                {analytics.summaryCards.topTransactionalModule.modulo}
                            </h4>
                            <p className="text-xs text-amber-800 font-semibold mt-1">
                                {analytics.summaryCards.topTransactionalModule.count} operaciones de creación/edición
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* SECCIÓN DE GRÁFICOS VISUALES */}
            {analytics && analytics.modules.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Gráfico 1: Top 10 Módulos más utilizados */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                    <span>🏆</span> Top 10 Módulos con Mayor Frecuencia de Uso
                                </h4>
                                <p className="text-xs text-gray-400">Total de ingresos e interacciones de usuarios por módulo.</p>
                            </div>
                        </div>

                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={top10ChartData}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" tick={{ fontSize: 11 }} />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        tick={{ fontSize: 10 }}
                                        width={110}
                                    />
                                    <Tooltip content={<CustomBarTooltip />} />
                                    <Bar dataKey="visitas" fill="#06b6d4" radius={[0, 8, 8, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Gráfico 2: Distribución por Macro-Áreas */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                    <span>🌐</span> Distribución de Uso por Macro-Área
                                </h4>
                                <p className="text-xs text-gray-400">Concentración de la actividad laboral por área corporativa.</p>
                            </div>
                        </div>

                        <div className="h-72 w-full flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={analytics.areaDistribution}
                                        dataKey="count"
                                        nameKey="area"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={85}
                                        paddingAngle={2}
                                    >
                                        {analytics.areaDistribution.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: any, name: any) => [
                                            `${Number(value).toLocaleString('es-CL')} accesos`,
                                            name
                                        ]}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* TABLA DETALLADA DE MÓDULOS CON CABECERAS CLIQUEABLES */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                            <span>📋</span> Matriz de Desempeño y Rendimiento por Módulo
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Mostrando {filteredModules.length} módulos. Haz clic en las cabeceras para ordenar o pulsa sobre una fila para ver el detalle de usuarios y acciones.
                        </p>
                    </div>

                    <div className="text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                        Ordenado por: <span className="font-bold text-cyan-800">{
                            sortField === 'totalVisits' ? 'Volumen de Ingresos' :
                            sortField === 'totalMinutes' ? 'Tiempo de Permanencia' :
                            sortField === 'avgMinutesPerVisit' ? 'Promedio por Ingreso' :
                            sortField === 'uniqueUsersCount' ? 'Usuarios Únicos' : 'Nombre'
                        }</span> ({sortOrder === 'desc' ? 'Descendente ↓' : 'Ascendente ↑'})
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-600">
                        <thead className="bg-gray-50/90 text-[11px] font-bold uppercase text-gray-500 border-b border-gray-100 select-none">
                            <tr>
                                <th 
                                    onClick={() => handleSort('modulo')}
                                    className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Módulo</span>
                                        {sortField === 'modulo' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </div>
                                </th>
                                <th className="py-3 px-4">Área</th>
                                <th 
                                    onClick={() => handleSort('totalVisits')}
                                    className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Ingresos / Accesos</span>
                                        {sortField === 'totalVisits' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('totalMinutes')}
                                    className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Tiempo Estimado</span>
                                        {sortField === 'totalMinutes' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('avgMinutesPerVisit')}
                                    className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Promedio / Ingreso</span>
                                        {sortField === 'avgMinutesPerVisit' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('uniqueUsersCount')}
                                    className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Usuarios</span>
                                        {sortField === 'uniqueUsersCount' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </div>
                                </th>
                                <th className="py-3 px-4">Acción Común</th>
                                <th className="py-3 px-4">Nivel Adopción</th>
                                <th className="py-3 px-4 text-center">Detalle</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-2xl animate-spin">🌀</span>
                                            <span>Calculando analíticas de uso de módulos...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredModules.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-3xl">📭</span>
                                            <span className="font-semibold text-gray-600">No se encontraron datos con los filtros seleccionados</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredModules.map((m) => {
                                    const isExpanded = expandedModule === m.modulo

                                    return (
                                        <>
                                            <tr 
                                                key={m.modulo}
                                                onClick={() => setExpandedModule(isExpanded ? null : m.modulo)}
                                                className={`cursor-pointer transition-colors ${
                                                    isExpanded ? 'bg-cyan-50/50' : 'hover:bg-gray-50'
                                                }`}
                                            >
                                                {/* Nombre */}
                                                <td className="py-3 px-4 font-bold text-gray-900">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                                                        <span>{m.modulo}</span>
                                                    </div>
                                                </td>

                                                {/* Área */}
                                                <td className="py-3 px-4">
                                                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                        {m.mainCategory}
                                                    </span>
                                                </td>

                                                {/* Accesos */}
                                                <td className="py-3 px-4">
                                                    <div>
                                                        <span className="font-bold text-slate-900">{m.totalVisits.toLocaleString('es-CL')}</span>
                                                        <span className="text-[10px] text-gray-400 ml-1">({m.percentage}%)</span>
                                                        <div className="w-20 bg-gray-100 rounded-full h-1.5 mt-1 overflow-hidden">
                                                            <div 
                                                                className="bg-cyan-500 h-full rounded-full"
                                                                style={{ width: `${Math.min(100, m.percentage * 2.5)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Tiempo Total */}
                                                <td className="py-3 px-4 font-mono">
                                                    <span className="font-bold text-slate-800">{m.totalHours} hrs</span>
                                                    <span className="text-[10px] text-gray-400 block">({m.totalMinutes} min)</span>
                                                </td>

                                                {/* Promedio / Ingreso */}
                                                <td className="py-3 px-4 font-mono text-slate-700">
                                                    {m.avgMinutesPerVisit} min
                                                </td>

                                                {/* Usuarios Únicos */}
                                                <td className="py-3 px-4">
                                                    <span className="inline-flex items-center gap-1 font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
                                                        <span>👥</span> {m.uniqueUsersCount}
                                                    </span>
                                                </td>

                                                {/* Acción Común */}
                                                <td className="py-3 px-4">
                                                    <span className="text-[10px] font-mono font-bold text-slate-600 bg-gray-100 px-2 py-0.5 rounded">
                                                        {m.topAction}
                                                    </span>
                                                </td>

                                                {/* Nivel de Adopción */}
                                                <td className="py-3 px-4">
                                                    {m.adoptionLevel === 'ALTO' ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
                                                            <span>🔥</span> Alto
                                                        </span>
                                                    ) : m.adoptionLevel === 'MEDIO' ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 w-fit">
                                                            <span>⚡</span> Medio
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1 w-fit">
                                                            <span>⚠️</span> Bajo
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Botón Ver */}
                                                <td className="py-3 px-4 text-center">
                                                    <button
                                                        type="button"
                                                        className="text-gray-400 hover:text-cyan-700 font-bold transition-transform"
                                                    >
                                                        {isExpanded ? '▲' : '▼'}
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* FILA EXPANDIDA CON DETALLES DE USUARIOS Y ACCIONES */}
                                            {isExpanded && (
                                                <tr key={`${m.modulo}-expanded`} className="bg-cyan-50/20">
                                                    <td colSpan={9} className="p-4 border-t border-b border-cyan-100">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {/* Usuarios más activos en este módulo */}
                                                            <div className="bg-white p-3.5 rounded-xl border border-cyan-200/80 space-y-2">
                                                                <h5 className="font-bold text-xs text-slate-800 flex items-center gap-1.5 border-b border-gray-100 pb-1.5">
                                                                    <span>👤</span> Usuarios Más Activos en "{m.modulo}"
                                                                </h5>
                                                                {m.topUsers.length === 0 ? (
                                                                    <p className="text-[11px] text-gray-400">Sin usuarios registrados</p>
                                                                ) : (
                                                                    <div className="space-y-1.5">
                                                                        {m.topUsers.map((u, uIdx) => (
                                                                            <div key={uIdx} className="flex items-center justify-between text-[11px] p-1.5 bg-gray-50 rounded-lg">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="w-5 h-5 rounded-full bg-cyan-600 text-white font-bold text-[10px] flex items-center justify-center">
                                                                                        {u.name.charAt(0).toUpperCase()}
                                                                                    </span>
                                                                                    <div>
                                                                                        <span className="font-bold text-gray-800 block leading-tight">{u.name}</span>
                                                                                        <span className="text-[10px] text-gray-400 font-mono">{u.roleName}</span>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <span className="font-bold text-cyan-800 font-mono">{u.count} accesos</span>
                                                                                    <span className="text-[10px] text-gray-400 block">({u.percentage}%)</span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Desglose de Acciones Ejecutadas */}
                                                            <div className="bg-white p-3.5 rounded-xl border border-cyan-200/80 space-y-2">
                                                                <h5 className="font-bold text-xs text-slate-800 flex items-center gap-1.5 border-b border-gray-100 pb-1.5">
                                                                    <span>⚙️</span> Acciones Ejecutadas en este Módulo
                                                                </h5>
                                                                <div className="flex flex-wrap gap-2 pt-1">
                                                                    {Object.entries(m.actionCounts).map(([act, count]) => (
                                                                        <div key={act} className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px]">
                                                                            <span className="font-semibold text-slate-600">{act}:</span>
                                                                            <span className="font-bold text-cyan-800 font-mono">{count}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                {m.lastActivity && (
                                                                    <div className="pt-2 text-[10px] text-gray-400 border-t border-gray-100">
                                                                        Última actividad registrada: <span className="font-mono text-gray-600 font-semibold">{new Date(m.lastActivity).toLocaleString('es-CL')}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
