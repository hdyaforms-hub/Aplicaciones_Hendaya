'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
    AreaChart,
    Area,
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
import {
    fetchAuditSessionAnalyticsAction
} from './actions'
import {
    SessionAnalyticsResult,
    UserSessionStat,
    MonthlyChartItem,
    ModuleDistributionItem
} from '@/lib/audit-analytics'

// Paleta de colores profesional para gráficos
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

interface SesionesActividadTabProps {
    roles: RoleOption[]
    users: UserOption[]
}

export default function SesionesActividadTab({ roles, users }: SesionesActividadTabProps) {
    const [mounted, setMounted] = useState(false)
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)
    const [error, setError] = useState('')

    // Filtros
    const [periodPreset, setPeriodPreset] = useState<'all' | 'this_month' | 'last_30' | 'last_90' | 'custom'>('all')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [selectedRole, setSelectedRole] = useState('ALL')
    const [selectedUser, setSelectedUser] = useState('ALL')

    // Datos principales
    const [analytics, setAnalytics] = useState<SessionAnalyticsResult | null>(null)

    // Controles de visualización
    const [chartMetric, setChartMetric] = useState<'hours' | 'sessions'>('hours')
    const [moduleViewType, setModuleViewType] = useState<'main' | 'detailed'>('main')
    const [userSearch, setUserSearch] = useState('')
    const [userSortBy, setUserSortBy] = useState<'time' | 'sessions' | 'recent'>('time')

    useEffect(() => {
        setMounted(true)
    }, [])

    // Manejo de presets de fechas
    const applyPeriodPreset = (preset: 'all' | 'this_month' | 'last_30' | 'last_90' | 'custom') => {
        setPeriodPreset(preset)
        const now = new Date()

        if (preset === 'all') {
            setDateFrom('')
            setDateTo('')
        } else if (preset === 'this_month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1)
            setDateFrom(start.toISOString().slice(0, 10))
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

    // Cargar analítica de sesiones
    const loadAnalytics = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const data = await fetchAuditSessionAnalyticsAction({
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                roleId: selectedRole !== 'ALL' ? selectedRole : undefined,
                username: selectedUser !== 'ALL' ? selectedUser : undefined,
            })
            setAnalytics(data)
        } catch (err: any) {
            console.error('Error cargando analítica de sesiones:', err)
            setError(err?.message || 'Error al obtener métricas de sesiones')
        } finally {
            setLoading(false)
        }
    }, [dateFrom, dateTo, selectedRole, selectedUser])

    useEffect(() => {
        loadAnalytics()
    }, [loadAnalytics])

    // Filtrado de usuarios disponibles según rol seleccionado
    const availableUsers = useMemo(() => {
        if (selectedRole === 'ALL') return users
        return users.filter((u) => u.roleId === selectedRole)
    }, [users, selectedRole])

    // Focalizar en un usuario específico
    const handleFocusUser = (username: string) => {
        if (selectedUser === username) {
            setSelectedUser('ALL')
        } else {
            setSelectedUser(username)
        }
    }

    // Resetear todos los filtros
    const handleResetFilters = () => {
        setPeriodPreset('all')
        setDateFrom('')
        setDateTo('')
        setSelectedRole('ALL')
        setSelectedUser('ALL')
        setUserSearch('')
    }

    // Filtrar y ordenar la lista de usuarios
    const filteredUsers = useMemo(() => {
        if (!analytics?.users) return []
        let list = [...analytics.users]

        if (userSearch.trim()) {
            const q = userSearch.toLowerCase().trim()
            list = list.filter((u) =>
                u.username.toLowerCase().includes(q) ||
                u.name.toLowerCase().includes(q) ||
                u.roleName.toLowerCase().includes(q) ||
                u.topModule.toLowerCase().includes(q)
            )
        }

        if (userSortBy === 'time') {
            list.sort((a, b) => b.totalMinutes - a.totalMinutes)
        } else if (userSortBy === 'sessions') {
            list.sort((a, b) => b.sessionsCount - a.sessionsCount)
        } else if (userSortBy === 'recent') {
            list.sort((a, b) => {
                const ta = a.lastConnection ? new Date(a.lastConnection).getTime() : 0
                const tb = b.lastConnection ? new Date(b.lastConnection).getTime() : 0
                return tb - ta
            })
        }

        return list
    }, [analytics?.users, userSearch, userSortBy])

    // Módulos a mostrar (Principales o Detallados)
    const activeModuleList = useMemo(() => {
        if (!analytics) return []
        return moduleViewType === 'main'
            ? analytics.mainModuleDistribution
            : analytics.moduleDistribution
    }, [analytics, moduleViewType])

    // Exportar Informe Ejecutivo de Sesiones a Excel
    const handleExportExcel = () => {
        if (!analytics) return
        try {
            setExporting(true)

            const workbook = XLSX.utils.book_new()

            // Hoja 1: Resumen General (KPIs)
            const kpiData = [
                { Métrica: 'Tiempo Total Conectado', Valor: analytics.summaryCards.totalConnectionTimeFormatted },
                { Métrica: 'Total Horas Decimal', Valor: analytics.summaryCards.totalHours },
                { Métrica: 'Total de Sesiones Iniciadas', Valor: analytics.summaryCards.totalSessions },
                { Métrica: 'Duración Promedio por Sesión', Valor: analytics.summaryCards.avgSessionFormatted },
                { Métrica: 'Usuarios Conectados en Período', Valor: analytics.summaryCards.totalUniqueUsers },
                { Métrica: 'Usuarios en Línea (Últimos 15 min)', Valor: analytics.summaryCards.activeUsersNow },
                { Métrica: 'Módulo Más Concurrido', Valor: `${analytics.summaryCards.topModule.modulo} (${analytics.summaryCards.topModule.percentage}%)` },
                { Métrica: 'Total Eventos Registrados', Valor: analytics.summaryCards.totalEventsRecorded },
                { Métrica: 'Filtro Rol Aplicado', Valor: selectedRole === 'ALL' ? 'Todos los roles' : roles.find(r => r.id === selectedRole)?.name || selectedRole },
                { Métrica: 'Filtro Usuario Aplicado', Valor: selectedUser === 'ALL' ? 'Todos los usuarios' : selectedUser },
                { Métrica: 'Rango de Fechas', Valor: `${dateFrom || 'Inicio histórico'} hasta ${dateTo || 'Fecha actual'}` },
                { Métrica: 'Fecha de Emisión del Informe', Valor: new Date().toLocaleString('es-CL') }
            ]
            const wsKPI = XLSX.utils.json_to_sheet(kpiData)
            wsKPI['!cols'] = [{ wch: 32 }, { wch: 45 }]
            XLSX.utils.book_append_sheet(workbook, wsKPI, 'Resumen General')

            // Hoja 2: Usuarios Conectados
            const usersData = analytics.users.map((u, i) => ({
                N: i + 1,
                Usuario: u.username,
                'Nombre Completo': u.name,
                Rol: u.roleName,
                'Total Sesiones': u.sessionsCount,
                'Tiempo Conectado (Horas)': Number(u.totalHours),
                'Tiempo Conectado (Minutos)': u.totalMinutes,
                'Promedio por Sesión (Minutos)': u.avgSessionMinutes,
                'Módulo Más Frecuente': u.topModule,
                '% Módulo Más Frecuente': `${u.topModulePercentage}%`,
                'Estado Actual': u.isOnline ? 'En línea' : 'Desconectado',
                'Última Conexión': u.lastConnection ? new Date(u.lastConnection).toLocaleString('es-CL') : 'Sin registro'
            }))
            const wsUsers = XLSX.utils.json_to_sheet(usersData)
            wsUsers['!cols'] = [
                { wch: 6 },
                { wch: 18 },
                { wch: 28 },
                { wch: 22 },
                { wch: 15 },
                { wch: 24 },
                { wch: 24 },
                { wch: 26 },
                { wch: 32 },
                { wch: 22 },
                { wch: 15 },
                { wch: 22 }
            ]
            XLSX.utils.book_append_sheet(workbook, wsUsers, 'Usuarios Conectados')

            // Hoja 3: Distribución de Módulos
            const modData = activeModuleList.map((m, i) => ({
                N: i + 1,
                Módulo: m.modulo,
                'Interacciones / Visitas': m.count,
                'Porcentaje (%)': `${m.percentage}%`
            }))
            const wsMod = XLSX.utils.json_to_sheet(modData)
            wsMod['!cols'] = [{ wch: 6 }, { wch: 40 }, { wch: 24 }, { wch: 16 }]
            XLSX.utils.book_append_sheet(workbook, wsMod, 'Módulos Más Visitados')

            // Hoja 4: Evolución Mensual
            const monthlyData = analytics.monthlyChartData.map((m) => ({
                Mes: m.monthLabel,
                'Horas Conectadas': m.hours,
                'Minutos Conectados': m.minutes,
                'Sesiones Iniciadas': m.sessions
            }))
            const wsMonthly = XLSX.utils.json_to_sheet(monthlyData)
            wsMonthly['!cols'] = [{ wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
            XLSX.utils.book_append_sheet(workbook, wsMonthly, 'Evolución Mensual')

            const nowStr = new Date().toISOString().slice(0, 10)
            const userSuffix = selectedUser !== 'ALL' ? `_${selectedUser}` : ''
            XLSX.writeFile(workbook, `Informe_Conexiones_Hendaya${userSuffix}_${nowStr}.xlsx`)
        } catch (e: any) {
            alert('Error al generar Excel de sesiones: ' + e?.message)
        } finally {
            setExporting(false)
        }
    }

    // Tooltip personalizado para el gráfico mensual
    const CustomMonthlyTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null
        const data = payload[0].payload as MonthlyChartItem
        return (
            <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1.5">
                <p className="font-bold text-cyan-300 text-sm">{data.monthLabel}</p>
                <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-400">⏱️ Tiempo Conectado:</span>
                    <span className="font-bold text-white font-mono">{data.hours} hrs ({data.minutes} min)</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-400">🚪 Sesiones Registradas:</span>
                    <span className="font-bold text-sky-400 font-mono">{data.sessions} sesiones</span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Barra de Filtros Interactivos */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-base">
                            🔍
                        </span>
                        <div>
                            <h3 className="text-sm font-bold text-gray-800">Filtros de Conexión y Período</h3>
                            <p className="text-xs text-gray-400">Personaliza el rango temporal, rol o focaliza en un usuario específico.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {(dateFrom || dateTo || selectedRole !== 'ALL' || selectedUser !== 'ALL' || periodPreset !== 'all') && (
                            <button
                                onClick={handleResetFilters}
                                className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                            >
                                Restablecer Filtros
                            </button>
                        )}
                        <button
                            onClick={handleExportExcel}
                            disabled={exporting || loading || !analytics}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                        >
                            <span>{exporting ? '⌛' : '📊'}</span>
                            {exporting ? 'Generando...' : 'Exportar Analítica Excel'}
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
                            onClick={() => applyPeriodPreset(p.key as any)}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                periodPreset === p.key
                                    ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Campos de Selección */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Fecha Desde */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Fecha Desde</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => {
                                setDateFrom(e.target.value)
                                setPeriodPreset('custom')
                            }}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-semibold"
                        />
                    </div>

                    {/* Fecha Hasta */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Fecha Hasta</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => {
                                setDateTo(e.target.value)
                                setPeriodPreset('custom')
                            }}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-semibold"
                        />
                    </div>

                    {/* Filtro por Rol */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center justify-between">
                            <span>Rol Corporativo</span>
                            {selectedRole !== 'ALL' && (
                                <span className="text-[10px] text-cyan-600 font-bold bg-cyan-50 px-1.5 py-0.5 rounded">Filtro activo</span>
                            )}
                        </label>
                        <select
                            value={selectedRole}
                            onChange={(e) => {
                                setSelectedRole(e.target.value)
                                setSelectedUser('ALL')
                            }}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-semibold"
                        >
                            <option value="ALL">-- Todos los Roles --</option>
                            {roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name} {r._count ? `(${r._count.users})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro por Usuario */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center justify-between">
                            <span>Usuario Específico</span>
                            {selectedUser !== 'ALL' && (
                                <button
                                    onClick={() => setSelectedUser('ALL')}
                                    className="text-[10px] text-rose-600 font-bold hover:underline"
                                >
                                    Quitar usuario
                                </button>
                            )}
                        </label>
                        <select
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-cyan-500 font-semibold ${
                                selectedUser !== 'ALL'
                                    ? 'bg-cyan-50 border-cyan-400 text-cyan-900 ring-2 ring-cyan-400/20'
                                    : 'bg-gray-50 border-gray-200 text-black'
                            }`}
                        >
                            <option value="ALL">-- Todos los Usuarios ({availableUsers.length}) --</option>
                            {availableUsers.map((u) => (
                                <option key={u.username} value={u.username}>
                                    {u.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Banner de Usuario Seleccionado */}
                {selectedUser !== 'ALL' && (
                    <div className="p-3 bg-gradient-to-r from-cyan-50 to-sky-50 border border-cyan-200 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-cyan-900 font-semibold">
                            <span className="text-base">👤</span>
                            <span>Focalizado en: <strong className="font-bold underline">{users.find(u => u.username === selectedUser)?.name || selectedUser}</strong></span>
                            <span className="text-cyan-600 font-normal">(@{selectedUser})</span>
                            <span className="text-cyan-700 bg-cyan-100/70 px-2 py-0.5 rounded-full font-bold text-[11px]">
                                {users.find(u => u.username === selectedUser)?.roleName || 'Usuario'}
                            </span>
                        </div>
                        <button
                            onClick={() => setSelectedUser('ALL')}
                            className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-700 font-bold rounded-lg border border-gray-200 shadow-sm"
                        >
                            Ver Métrica Global
                        </button>
                    </div>
                )}
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm font-semibold">
                    ⚠️ {error}
                </div>
            )}

            {/* CERÁMICAS (KPI Metric Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* Cerámica 1: Tiempo Total Conectado */}
                <div className="bg-gradient-to-br from-white to-cyan-50/40 p-5 rounded-2xl border border-cyan-100/80 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-400/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tiempo Conectado</span>
                        <span className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center text-sm font-bold shadow-inner">
                            ⏱️
                        </span>
                    </div>
                    <div className="mt-3">
                        <h4 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                            {loading ? (
                                <span className="inline-block w-24 h-7 bg-gray-200 animate-pulse rounded-lg" />
                            ) : (
                                analytics?.summaryCards.totalConnectionTimeFormatted || '0 min'
                            )}
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-1 font-medium">
                            {analytics ? `${analytics.summaryCards.totalHours} hrs acumuladas` : 'Cargando...'}
                        </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-500" />
                        <span className="text-[11px] font-semibold text-cyan-800">
                            {selectedUser !== 'ALL' ? 'Tiempo del usuario' : 'Permanencia en plataforma'}
                        </span>
                    </div>
                </div>

                {/* Cerámica 2: Usuarios Conectados */}
                <div className="bg-gradient-to-br from-white to-sky-50/40 p-5 rounded-2xl border border-sky-100/80 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-sky-400/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Usuarios Activos</span>
                        <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center text-sm font-bold shadow-inner">
                            👥
                        </span>
                    </div>
                    <div className="mt-3">
                        <h4 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                            {loading ? (
                                <span className="inline-block w-20 h-7 bg-gray-200 animate-pulse rounded-lg" />
                            ) : (
                                `${analytics?.summaryCards.totalUniqueUsers || 0}`
                            )}
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-1 font-medium">
                            {analytics?.summaryCards.totalUniqueUsers === 1 ? 'Usuario auditado' : 'Usuarios con registros'}
                        </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center gap-1.5">
                        {analytics && analytics.summaryCards.activeUsersNow > 0 ? (
                            <>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[11px] font-bold text-emerald-700">
                                    {analytics.summaryCards.activeUsersNow} en línea ahora
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="w-2 h-2 rounded-full bg-slate-300" />
                                <span className="text-[11px] font-medium text-gray-400">Sin usuarios en línea</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Cerámica 3: Total de Sesiones */}
                <div className="bg-gradient-to-br from-white to-indigo-50/40 p-5 rounded-2xl border border-indigo-100/80 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-400/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Sesiones</span>
                        <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shadow-inner">
                            🚪
                        </span>
                    </div>
                    <div className="mt-3">
                        <h4 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                            {loading ? (
                                <span className="inline-block w-16 h-7 bg-gray-200 animate-pulse rounded-lg" />
                            ) : (
                                `${analytics?.summaryCards.totalSessions || 0}`
                            )}
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-1 font-medium">
                            Períodos de inicio de sesión
                        </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span className="text-[11px] font-semibold text-indigo-800">
                            Frecuencia continua
                        </span>
                    </div>
                </div>

                {/* Cerámica 4: Duración Promedio por Sesión */}
                <div className="bg-gradient-to-br from-white to-amber-50/40 p-5 rounded-2xl border border-amber-100/80 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Promedio Sesión</span>
                        <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold shadow-inner">
                            ⏳
                        </span>
                    </div>
                    <div className="mt-3">
                        <h4 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                            {loading ? (
                                <span className="inline-block w-20 h-7 bg-gray-200 animate-pulse rounded-lg" />
                            ) : (
                                analytics?.summaryCards.avgSessionFormatted || '0 min'
                            )}
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-1 font-medium">
                            Por cada ingreso al sistema
                        </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-[11px] font-semibold text-amber-800">
                            Tiempo medio de estancia
                        </span>
                    </div>
                </div>

                {/* Cerámica 5: Módulo Más Visitado (% y nombre) */}
                <div className="bg-gradient-to-br from-white to-emerald-50/40 p-5 rounded-2xl border border-emerald-100/80 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-400/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Módulo Líder</span>
                        <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold shadow-inner">
                            🏆
                        </span>
                    </div>
                    <div className="mt-3">
                        <h4 className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight flex items-baseline gap-1.5">
                            {loading ? (
                                <span className="inline-block w-20 h-7 bg-gray-200 animate-pulse rounded-lg" />
                            ) : (
                                <>
                                    <span>{analytics?.summaryCards.topModule.percentage || 0}%</span>
                                    <span className="text-xs font-bold text-gray-400">del total</span>
                                </>
                            )}
                        </h4>
                        <p className="text-[11px] text-gray-700 mt-1 font-bold truncate" title={analytics?.summaryCards.topModule.modulo}>
                            {analytics?.summaryCards.topModule.modulo || 'Sin datos'}
                        </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[11px] font-semibold text-emerald-800">
                            {analytics?.summaryCards.topModule.count.toLocaleString('es-CL')} accesos
                        </span>
                    </div>
                </div>

                {/* Cerámica 6: Total Eventos Auditados */}
                <div className="bg-gradient-to-br from-white to-slate-100 p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-slate-400/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Actividad Total</span>
                        <span className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-bold shadow-inner">
                            📈
                        </span>
                    </div>
                    <div className="mt-3">
                        <h4 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                            {loading ? (
                                <span className="inline-block w-20 h-7 bg-gray-200 animate-pulse rounded-lg" />
                            ) : (
                                analytics?.summaryCards.totalEventsRecorded.toLocaleString('es-CL') || '0'
                            )}
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-1 font-medium">
                            Interacciones auditadas
                        </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-600" />
                        <span className="text-[11px] font-semibold text-cyan-900">
                            Trazabilidad completa
                        </span>
                    </div>
                </div>
            </div>

            {/* SECCIÓN INTERMEDIA: GRÁFICO MENSUAL DE TIEMPO + RESUMEN % MÓDULOS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* 1. GRÁFICO MENSUAL DEL TIEMPO CONECTADO (7 columnas en desktop) */}
                <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                    <span>📅</span> Evolución Mensual del Tiempo Conectado
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {selectedUser !== 'ALL'
                                        ? `Historial de horas de conexión para @${selectedUser}`
                                        : 'Tiempo total acumulado por todos los usuarios mes a mes'}
                                </p>
                            </div>

                            {/* Selector de Métrica */}
                            <div className="inline-flex rounded-xl bg-gray-100 p-1 shrink-0 text-xs font-bold">
                                <button
                                    type="button"
                                    onClick={() => setChartMetric('hours')}
                                    className={`px-3 py-1.5 rounded-lg transition-all ${
                                        chartMetric === 'hours'
                                            ? 'bg-white text-cyan-700 shadow-sm font-black'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    ⏱️ Horas Conectadas
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setChartMetric('sessions')}
                                    className={`px-3 py-1.5 rounded-lg transition-all ${
                                        chartMetric === 'sessions'
                                            ? 'bg-white text-cyan-700 shadow-sm font-black'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    🚪 Cantidad Sesiones
                                </button>
                            </div>
                        </div>

                        {/* Área del Gráfico */}
                        <div className="mt-6 h-72 w-full">
                            {loading || !mounted ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                                    <span className="text-2xl animate-spin">🌀</span>
                                    <span className="text-xs">Cargando gráfico de tiempo mensual...</span>
                                </div>
                            ) : !analytics?.monthlyChartData || analytics.monthlyChartData.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                                    <span className="text-3xl">📊</span>
                                    <span className="text-sm font-semibold">Sin datos mensuales para el período seleccionado</span>
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={analytics.monthlyChartData}
                                        margin={{ top: 15, right: 20, left: -10, bottom: 0 }}
                                    >
                                        <defs>
                                            <linearGradient id="cyanTimeGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                                                <stop offset="95%" stopColor="#0284c7" stopOpacity={0.02} />
                                            </linearGradient>
                                            <linearGradient id="indigoSessionsGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                                                <stop offset="95%" stopColor="#4338ca" stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis
                                            dataKey="monthLabel"
                                            tickLine={false}
                                            axisLine={{ stroke: '#e2e8f0' }}
                                            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                                        />
                                        <YAxis
                                            tickLine={false}
                                            axisLine={{ stroke: '#e2e8f0' }}
                                            tick={{ fill: '#64748b', fontSize: 11 }}
                                            unit={chartMetric === 'hours' ? 'h' : ''}
                                        />
                                        <Tooltip content={<CustomMonthlyTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey={chartMetric === 'hours' ? 'hours' : 'sessions'}
                                            stroke={chartMetric === 'hours' ? '#0891b2' : '#4f46e5'}
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill={chartMetric === 'hours' ? 'url(#cyanTimeGradient)' : 'url(#indigoSessionsGradient)'}
                                            dot={{ r: 5, fill: chartMetric === 'hours' ? '#06b6d4' : '#6366f1', strokeWidth: 2, stroke: '#ffffff' }}
                                            activeDot={{ r: 7, fill: '#0e7490', strokeWidth: 2, stroke: '#ffffff' }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Resumen inferior de meses */}
                    {analytics?.monthlyChartData && analytics.monthlyChartData.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {analytics.monthlyChartData.slice(-4).map((m) => (
                                <div key={m.monthKey} className="bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
                                    <span className="text-[11px] font-bold text-gray-500 block">{m.monthLabel}</span>
                                    <span className="text-sm font-black text-gray-800">{m.hours} hrs</span>
                                    <span className="text-[10px] text-cyan-700 font-semibold block">{m.sessions} sesiones</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. RESUMEN EN % DE MÓDULOS MÁS VISITADOS (5 columnas en desktop) */}
                <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-100">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                    <span>📊</span> Módulos Más Visitados (%)
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Porcentaje de interacción sobre el total de accesos
                                </p>
                            </div>

                            {/* Toggle Principales vs Detallados */}
                            <div className="inline-flex rounded-xl bg-gray-100 p-0.5 shrink-0 text-[11px] font-bold">
                                <button
                                    type="button"
                                    onClick={() => setModuleViewType('main')}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${
                                        moduleViewType === 'main'
                                            ? 'bg-white text-cyan-700 shadow-sm font-black'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    Principales
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setModuleViewType('detailed')}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${
                                        moduleViewType === 'detailed'
                                            ? 'bg-white text-cyan-700 shadow-sm font-black'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    Detalle
                                </button>
                            </div>
                        </div>

                        {/* Lista con Barras de Porcentaje */}
                        <div className="mt-4 space-y-3 max-h-80 overflow-y-auto pr-1">
                            {loading ? (
                                <div className="py-12 text-center text-gray-400 text-xs">
                                    Calculando distribución de módulos...
                                </div>
                            ) : activeModuleList.length === 0 ? (
                                <div className="py-12 text-center text-gray-400 text-xs">
                                    No se encontraron eventos para los filtros seleccionados
                                </div>
                            ) : (
                                activeModuleList.slice(0, 8).map((mod, index) => {
                                    const color = CHART_COLORS[index % CHART_COLORS.length]
                                    return (
                                        <div key={mod.modulo} className="group">
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                                    <span className="w-5 h-5 rounded-md bg-gray-100 text-gray-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                                                        #{index + 1}
                                                    </span>
                                                    <span className="font-bold text-gray-800 truncate" title={mod.modulo}>
                                                        {mod.modulo}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-[11px] text-gray-400 font-mono">
                                                        {mod.count.toLocaleString('es-CL')} act.
                                                    </span>
                                                    <span
                                                        className="px-2 py-0.5 rounded-full font-black text-xs text-white shadow-sm"
                                                        style={{ backgroundColor: color }}
                                                    >
                                                        {mod.percentage}%
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Barra de Progreso */}
                                            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-500"
                                                    style={{
                                                        width: `${Math.min(100, Math.max(3, mod.percentage))}%`,
                                                        backgroundColor: color
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Nota al pie */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                        <span>Total evaluado: <strong>{analytics?.summaryCards.totalEventsRecorded.toLocaleString('es-CL') || 0}</strong> eventos</span>
                        <span className="text-cyan-700 font-semibold">{activeModuleList.length} módulos registrados</span>
                    </div>
                </div>
            </div>

            {/* TABLA: USUARIOS CONECTADOS A LA APLICACIÓN */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                            <span>👥</span> Usuarios Conectados a la Plataforma
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Detalle de tiempo conectado, cantidad de sesiones y módulo más visitado de cada usuario
                        </p>
                    </div>

                    {/* Búsqueda y Ordenamiento */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar usuario o rol..."
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-semibold w-48 sm:w-56"
                            />
                            <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
                        </div>

                        <select
                            value={userSortBy}
                            onChange={(e) => setUserSortBy(e.target.value as any)}
                            className="px-3 py-1.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-semibold"
                        >
                            <option value="time">Ordenar por: Mayor Tiempo Conectado</option>
                            <option value="sessions">Ordenar por: Más Sesiones</option>
                            <option value="recent">Ordenar por: Conexión Más Reciente</option>
                        </select>
                    </div>
                </div>

                {/* Tabla de Usuarios */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50/80 text-xs font-bold uppercase text-gray-500 border-b border-gray-100">
                            <tr>
                                <th className="py-3.5 px-4">Usuario</th>
                                <th className="py-3.5 px-4">Rol</th>
                                <th className="py-3.5 px-4">Estado</th>
                                <th className="py-3.5 px-4 text-center">Sesiones</th>
                                <th className="py-3.5 px-4 text-center">Tiempo Conectado</th>
                                <th className="py-3.5 px-4 text-center">Promedio / Sesión</th>
                                <th className="py-3.5 px-4">Módulo Más Visitado</th>
                                <th className="py-3.5 px-4 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-2xl animate-spin">🌀</span>
                                            <span>Calculando tiempos de sesión de los usuarios...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-3xl">👤</span>
                                            <span className="font-semibold text-gray-600">No se encontraron usuarios conectados con los criterios actuales</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((u) => {
                                    const isFocused = selectedUser === u.username
                                    return (
                                        <tr
                                            key={u.username}
                                            className={`transition-colors ${
                                                isFocused
                                                    ? 'bg-cyan-50/70 border-l-4 border-cyan-500'
                                                    : 'hover:bg-gray-50/60'
                                            }`}
                                        >
                                            {/* Usuario */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-800 to-cyan-900 text-cyan-300 font-black text-xs flex items-center justify-center border border-cyan-500/20 shadow-sm shrink-0">
                                                        {u.username.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-900 text-sm">{u.name}</span>
                                                        <span className="text-xs text-gray-400 font-mono">@{u.username}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Rol */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                                                    <span className="text-[10px] text-cyan-600">🛡️</span>
                                                    {u.roleName}
                                                </span>
                                            </td>

                                            {/* Estado */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                {u.isOnline ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
                                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                        En línea
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-gray-500 font-medium">
                                                            {u.lastConnection ? new Date(u.lastConnection).toLocaleDateString('es-CL') : 'Sin registro'}
                                                        </span>
                                                        {u.lastConnection && (
                                                            <span className="text-[10px] text-gray-400 font-mono">
                                                                {new Date(u.lastConnection).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} hrs
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Sesiones */}
                                            <td className="py-3.5 px-4 whitespace-nowrap text-center">
                                                <span className="inline-block px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 font-black text-xs">
                                                    {u.sessionsCount}
                                                </span>
                                            </td>

                                            {/* Tiempo Total Conectado */}
                                            <td className="py-3.5 px-4 whitespace-nowrap text-center">
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-cyan-50 text-cyan-900 border border-cyan-200 font-black text-xs font-mono shadow-sm">
                                                    <span>⏱️</span>
                                                    {u.totalHours} hrs ({u.totalMinutes} min)
                                                </span>
                                            </td>

                                            {/* Promedio por Sesión */}
                                            <td className="py-3.5 px-4 whitespace-nowrap text-center">
                                                <span className="text-xs font-bold text-gray-700 font-mono">
                                                    {u.avgSessionMinutes} min
                                                </span>
                                            </td>

                                            {/* Módulo Más Visitado */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black">
                                                        {u.topModulePercentage}%
                                                    </span>
                                                    <span className="text-xs text-gray-800 font-semibold truncate max-w-xs" title={u.topModule}>
                                                        {u.topModule}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Acción Focalizar */}
                                            <td className="py-3.5 px-4 whitespace-nowrap text-right">
                                                <button
                                                    onClick={() => handleFocusUser(u.username)}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                                        isFocused
                                                            ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300'
                                                            : 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-cyan-600/20'
                                                    }`}
                                                >
                                                    {isFocused ? '✕ Deseleccionar' : '🔍 Focalizar'}
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer de la tabla */}
                <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 text-xs text-gray-500">
                    <span>Mostrando {filteredUsers.length} usuarios con actividad registrada</span>
                    {selectedUser !== 'ALL' && (
                        <button
                            onClick={() => setSelectedUser('ALL')}
                            className="font-bold text-cyan-600 hover:text-cyan-800 underline"
                        >
                            Restablecer vista a todos los usuarios
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
