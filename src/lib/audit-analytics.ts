import { rawPrisma } from '@/lib/prisma'

export type AuditSessionFilterParams = {
    dateFrom?: string
    dateTo?: string
    roleId?: string
    username?: string
}

export type UserSessionStat = {
    username: string
    name: string
    fullName: string
    roleName: string
    roleId: string
    sessionsCount: number
    totalMinutes: number
    totalHours: string
    avgSessionMinutes: number
    lastConnection: string | null
    isOnline: boolean
    topModule: string
    topModulePercentage: number
    totalLogs: number
}

export type ModuleDistributionItem = {
    modulo: string
    count: number
    percentage: number
    mainCategory: string
}

export type MonthlyChartItem = {
    monthKey: string
    monthLabel: string
    year: number
    hours: number
    minutes: number
    sessions: number
}

export type DailyChartItem = {
    dayKey: string
    dayLabel: string
    hours: number
    minutes: number
    sessions: number
}

export type SessionAnalyticsResult = {
    summaryCards: {
        totalConnectionTimeFormatted: string
        totalHours: number
        totalMinutes: number
        totalSessions: number
        avgSessionMinutes: number
        avgSessionFormatted: string
        totalUniqueUsers: number
        activeUsersNow: number
        topModule: {
            modulo: string
            count: number
            percentage: number
        }
        totalEventsRecorded: number
    }
    moduleDistribution: ModuleDistributionItem[]
    mainModuleDistribution: ModuleDistributionItem[]
    monthlyChartData: MonthlyChartItem[]
    dailyChartData: DailyChartItem[]
    users: UserSessionStat[]
    benchmarkMs: number
}

// Clasificación normalizada de módulos a categoría principal
export function getMainModuleName(mod: string): string {
    if (!mod) return 'Otros'
    const clean = mod.trim()
    const upper = clean.toUpperCase()
    if (upper.startsWith('MANTENEDOR')) return 'Mantenedor'
    if (upper.startsWith('ACTAS')) return 'Actas'
    if (upper.startsWith('ÁREAS -> CALIDAD') || upper.startsWith('AREAS -> CALIDAD') || upper.includes('CALIDAD')) return 'Áreas -> Calidad'
    if (upper.startsWith('ÁREAS -> RECURSOS HUMANOS') || upper.startsWith('AREAS -> RECURSOS HUMANOS') || upper.includes('PERSONAL') || upper.includes('RECURSOS HUMANOS')) return 'Áreas -> Recursos Humanos'
    if (upper.startsWith('ÁREAS -> LOGÍSTICA') || upper.startsWith('AREAS -> LOGISTICA') || upper.includes('LOGÍSTICA') || upper.includes('LOGISTICA')) return 'Áreas -> Logística'
    if (upper.startsWith('ÁREAS -> OPERACIONES') || upper.startsWith('AREAS -> OPERACIONES') || upper.includes('OPERACIONES')) return 'Áreas -> Operaciones'
    if (upper.startsWith('TABLEROS') || upper.includes('TABLERO')) return 'Tableros y Avances'
    if (upper.includes('MATRIZ DE RIESGO') || upper.includes('MATRIZ')) return 'Matriz de Riesgo'
    if (upper.includes('CONFIGURACIÓN') || upper.includes('CONFIGURACION')) return 'Configuración'
    if (upper.includes('INICIO')) return 'Inicio'
    if (upper.includes('AUTENTICACIÓN') || upper.includes('AUTENTICACION') || upper.includes('LOGIN')) return 'Autenticación'
    if (upper.includes('COLABORADORES')) return 'Colaboradores'
    if (upper.includes('SISTEMA')) return 'Sistema'
    return clean
}

/**
 * Calcula analíticas completas de sesiones, tiempos de conexión, distribución de módulos
 * y serie temporal mensual a partir de la tabla de auditoría.
 */
export async function computeAuditSessionAnalytics(params?: AuditSessionFilterParams): Promise<SessionAnalyticsResult> {
    const t0 = Date.now()

    // 1. Condiciones de filtro
    const andConditions: any[] = []
    if (params?.dateFrom) {
        const d = new Date(params.dateFrom)
        d.setHours(0, 0, 0, 0)
        andConditions.push({ createdAt: { gte: d } })
    }
    if (params?.dateTo) {
        const d = new Date(params.dateTo)
        d.setHours(23, 59, 59, 999)
        andConditions.push({ createdAt: { lte: d } })
    }

    if (params?.roleId && params.roleId !== 'ALL') {
        const usersInRole = await rawPrisma.user.findMany({
            where: { roleId: params.roleId, isDeleted: false },
            select: { username: true }
        })
        const usernames = usersInRole.map(u => u.username).filter(Boolean)
        if (usernames.length === 0) {
            andConditions.push({ username: '__NONE__' })
        } else {
            andConditions.push({ username: { in: usernames } })
        }
    }

    if (params?.username && params.username !== 'ALL') {
        andConditions.push({ username: params.username })
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {}

    // 2. Consulta paralela de logs y usuarios activos
    const [logs, allUsers] = await Promise.all([
        rawPrisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            select: { id: true, username: true, action: true, modulo: true, createdAt: true }
        }),
        rawPrisma.user.findMany({
            where: { isDeleted: false },
            select: { id: true, username: true, name: true, roleId: true, role: { select: { id: true, name: true } } }
        })
    ])

    const userMetaMap = new Map<string, { name: string; fullName: string; roleName: string; roleId: string }>()
    for (const u of allUsers) {
        userMetaMap.set(u.username, {
            name: u.name || u.username,
            fullName: u.name ? `${u.name} (${u.username})` : u.username,
            roleName: u.role?.name || 'Sin Rol',
            roleId: u.roleId || ''
        })
    }

    // Parámetros de sesión
    const GAP_MS = 30 * 60 * 1000 // Inactividad máxima entre eventos: 30 minutos
    const MIN_SESSION_MS = 2 * 60 * 1000 // Sesión mínima: 2 minutos
    const GRACE_AFTER_LAST_MS = 2 * 60 * 1000 // Gracia agregada tras la última acción
    const MAX_SESSION_MS = 6 * 60 * 60 * 1000 // Límite máximo sesión continua: 6 horas
    const ONLINE_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutos para considerar usuario en línea

    const userLogsMap = new Map<string, typeof logs>()
    const detailedModuleCounts = new Map<string, number>()
    const mainModuleCounts = new Map<string, number>()
    let totalLogsCount = 0

    for (const log of logs) {
        if (!userLogsMap.has(log.username)) {
            userLogsMap.set(log.username, [])
        }
        userLogsMap.get(log.username)!.push(log)

        if (log.modulo) {
            detailedModuleCounts.set(log.modulo, (detailedModuleCounts.get(log.modulo) || 0) + 1)
            const mainCat = getMainModuleName(log.modulo)
            mainModuleCounts.set(mainCat, (mainModuleCounts.get(mainCat) || 0) + 1)
            totalLogsCount++
        }
    }

    const userStatsList: UserSessionStat[] = []
    const monthlyStatsMap = new Map<string, { totalMs: number; sessions: number }>()
    const dailyStatsMap = new Map<string, { totalMs: number; sessions: number }>()
    const now = Date.now()

    let globalTotalMs = 0
    let globalTotalSessions = 0
    let onlineUsersCount = 0

    for (const [username, uLogs] of userLogsMap.entries()) {
        let userTotalMs = 0
        let userSessionsCount = 0
        let lastEventTimeGlobal = 0
        const userModuleMap = new Map<string, number>()

        let currentSessionStart: number | null = null
        let currentSessionLast: number | null = null

        const recordSession = (start: number, end: number) => {
            let duration = end - start + GRACE_AFTER_LAST_MS
            if (duration < MIN_SESSION_MS) duration = MIN_SESSION_MS
            if (duration > MAX_SESSION_MS) duration = MAX_SESSION_MS

            userTotalMs += duration
            globalTotalMs += duration
            userSessionsCount++
            globalTotalSessions++

            // Agrupación mensual YYYY-MM
            const mKey = new Date(start).toISOString().slice(0, 7)
            const mObj = monthlyStatsMap.get(mKey) || { totalMs: 0, sessions: 0 }
            mObj.totalMs += duration
            mObj.sessions += 1
            monthlyStatsMap.set(mKey, mObj)

            // Agrupación diaria YYYY-MM-DD
            const dKey = new Date(start).toISOString().slice(0, 10)
            const dObj = dailyStatsMap.get(dKey) || { totalMs: 0, sessions: 0 }
            dObj.totalMs += duration
            dObj.sessions += 1
            dailyStatsMap.set(dKey, dObj)
        }

        for (let i = 0; i < uLogs.length; i++) {
            const event = uLogs[i]
            const eventTime = new Date(event.createdAt).getTime()
            if (eventTime > lastEventTimeGlobal) lastEventTimeGlobal = eventTime

            if (event.modulo) {
                userModuleMap.set(event.modulo, (userModuleMap.get(event.modulo) || 0) + 1)
            }

            if (!currentSessionStart) {
                currentSessionStart = eventTime
                currentSessionLast = eventTime
            } else {
                const diff = eventTime - (currentSessionLast || eventTime)
                if (diff > GAP_MS || event.action === 'INICIO_SESION') {
                    recordSession(currentSessionStart, currentSessionLast || eventTime)
                    currentSessionStart = eventTime
                    currentSessionLast = eventTime
                } else if (event.action === 'CIERRE_SESION' || event.action === 'CIERRE_SESION_TIMEOUT') {
                    recordSession(currentSessionStart, eventTime)
                    currentSessionStart = null
                    currentSessionLast = null
                } else {
                    currentSessionLast = eventTime
                }
            }
        }

        if (currentSessionStart && currentSessionLast) {
            recordSession(currentSessionStart, currentSessionLast)
        }

        const isOnline = now - lastEventTimeGlobal < ONLINE_THRESHOLD_MS
        if (isOnline) onlineUsersCount++

        // Módulo más visitado por este usuario
        let userTopMod = 'N/A'
        let userTopModCount = 0
        let userTotalModVisits = 0
        for (const [mod, cnt] of userModuleMap.entries()) {
            userTotalModVisits += cnt
            if (cnt > userTopModCount) {
                userTopModCount = cnt
                userTopMod = mod
            }
        }
        const userTopModPct = userTotalModVisits > 0 ? Math.round((userTopModCount / userTotalModVisits) * 100) : 0

        const meta = userMetaMap.get(username)
        userStatsList.push({
            username,
            name: meta?.name || username,
            fullName: meta?.fullName || username,
            roleName: meta?.roleName || 'Sin Rol',
            roleId: meta?.roleId || '',
            sessionsCount: userSessionsCount,
            totalMinutes: Math.round(userTotalMs / 60000),
            totalHours: (userTotalMs / 3600000).toFixed(1),
            avgSessionMinutes: userSessionsCount > 0 ? Math.round((userTotalMs / userSessionsCount) / 60000) : 0,
            lastConnection: lastEventTimeGlobal ? new Date(lastEventTimeGlobal).toISOString() : null,
            isOnline,
            topModule: userTopMod,
            topModulePercentage: userTopModPct,
            totalLogs: uLogs.length
        })
    }

    userStatsList.sort((a, b) => b.totalMinutes - a.totalMinutes)

    // Distribución detallada de módulos en %
    const moduleDistribution: ModuleDistributionItem[] = Array.from(detailedModuleCounts.entries()).map(([modulo, count]) => {
        const percentage = totalLogsCount > 0 ? Number(((count / totalLogsCount) * 100).toFixed(1)) : 0
        return {
            modulo,
            count,
            percentage,
            mainCategory: getMainModuleName(modulo)
        }
    }).sort((a, b) => b.count - a.count)

    // Distribución por módulos principales agrupados en %
    const mainModuleDistribution: ModuleDistributionItem[] = Array.from(mainModuleCounts.entries()).map(([modulo, count]) => {
        const percentage = totalLogsCount > 0 ? Number(((count / totalLogsCount) * 100).toFixed(1)) : 0
        return {
            modulo,
            count,
            percentage,
            mainCategory: modulo
        }
    }).sort((a, b) => b.count - a.count)

    // Datos del gráfico mensual
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const monthlyChartData: MonthlyChartItem[] = Array.from(monthlyStatsMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([mKey, data]) => {
            const [yStr, mStr] = mKey.split('-')
            const mIndex = parseInt(mStr, 10) - 1
            const year = parseInt(yStr, 10)
            const hours = Number((data.totalMs / 3600000).toFixed(1))
            const minutes = Math.round(data.totalMs / 60000)
            return {
                monthKey: mKey,
                monthLabel: `${monthNames[mIndex] || mKey} ${yStr}`,
                year,
                hours,
                minutes,
                sessions: data.sessions
            }
        })

    // Datos del gráfico diario (para vista detallada o drilldown)
    const dailyChartData: DailyChartItem[] = Array.from(dailyStatsMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([dKey, data]) => {
            const [y, m, d] = dKey.split('-')
            const mIndex = parseInt(m, 10) - 1
            const hours = Number((data.totalMs / 3600000).toFixed(1))
            const minutes = Math.round(data.totalMs / 60000)
            return {
                dayKey: dKey,
                dayLabel: `${d} ${monthNames[mIndex] || m}`,
                hours,
                minutes,
                sessions: data.sessions
            }
        })

    // Formato de tiempo total conectado
    const totalHoursNum = Math.floor(globalTotalMs / 3600000)
    const totalMinsRemaining = Math.round((globalTotalMs % 3600000) / 60000)
    const totalConnectionTimeFormatted = totalHoursNum > 0
        ? `${totalHoursNum} hrs ${totalMinsRemaining} min`
        : `${totalMinsRemaining} min`

    const avgSessionMinutesGlobal = globalTotalSessions > 0
        ? Math.round((globalTotalMs / globalTotalSessions) / 60000)
        : 0

    const summaryCards = {
        totalConnectionTimeFormatted,
        totalHours: Number((globalTotalMs / 3600000).toFixed(1)),
        totalMinutes: Math.round(globalTotalMs / 60000),
        totalSessions: globalTotalSessions,
        avgSessionMinutes: avgSessionMinutesGlobal,
        avgSessionFormatted: `${avgSessionMinutesGlobal} min`,
        totalUniqueUsers: userLogsMap.size,
        activeUsersNow: onlineUsersCount,
        topModule: mainModuleDistribution.length > 0 ? {
            modulo: mainModuleDistribution[0].modulo,
            count: mainModuleDistribution[0].count,
            percentage: mainModuleDistribution[0].percentage
        } : { modulo: 'N/A', count: 0, percentage: 0 },
        totalEventsRecorded: logs.length
    }

    return {
        summaryCards,
        moduleDistribution,
        mainModuleDistribution,
        monthlyChartData,
        dailyChartData,
        users: userStatsList,
        benchmarkMs: Date.now() - t0
    }
}

export type ModuleTopUser = {
    username: string
    name: string
    roleName: string
    count: number
    percentage: number
}

export type ModuleUsageStat = {
    modulo: string
    mainCategory: string
    totalVisits: number
    percentage: number
    totalMinutes: number
    totalHours: string
    avgMinutesPerVisit: number
    uniqueUsersCount: number
    topAction: string
    actionCounts: Record<string, number>
    adoptionLevel: 'ALTO' | 'MEDIO' | 'BAJO'
    lastActivity: string | null
    topUsers: ModuleTopUser[]
}

export type AreaDistributionItem = {
    area: string
    count: number
    percentage: number
    totalMinutes: number
    totalHours: string
    modulesCount: number
}

export type ActionDistributionItem = {
    action: string
    count: number
    percentage: number
}

export type ModuleUsageResult = {
    summaryCards: {
        topUsedModule: { modulo: string; count: number; percentage: number }
        topTimeModule: { modulo: string; hours: string; minutes: number }
        totalModulesTracked: number
        activeModulesCount: number
        totalEvents: number
        topTransactionalModule: { modulo: string; count: number }
    }
    modules: ModuleUsageStat[]
    areaDistribution: AreaDistributionItem[]
    actionDistribution: ActionDistributionItem[]
    benchmarkMs: number
}

/**
 * Calcula estadísticas completas de uso de módulos:
 * accesos, tiempo estimado de permanencia, usuarios únicos, acciones y desglose por áreas.
 */
export async function computeModuleUsageAnalytics(params?: AuditSessionFilterParams): Promise<ModuleUsageResult> {
    const t0 = Date.now()

    // 1. Condiciones de filtro
    const andConditions: any[] = []
    if (params?.dateFrom) {
        const d = new Date(params.dateFrom)
        d.setHours(0, 0, 0, 0)
        andConditions.push({ createdAt: { gte: d } })
    }
    if (params?.dateTo) {
        const d = new Date(params.dateTo)
        d.setHours(23, 59, 59, 999)
        andConditions.push({ createdAt: { lte: d } })
    }

    if (params?.roleId && params.roleId !== 'ALL') {
        const usersInRole = await rawPrisma.user.findMany({
            where: { roleId: params.roleId, isDeleted: false },
            select: { username: true }
        })
        const usernames = usersInRole.map(u => u.username).filter(Boolean)
        if (usernames.length === 0) {
            andConditions.push({ username: '__NONE__' })
        } else {
            andConditions.push({ username: { in: usernames } })
        }
    }

    if (params?.username && params.username !== 'ALL') {
        andConditions.push({ username: params.username })
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {}

    // 2. Consulta de logs y usuarios
    const [logs, allUsers] = await Promise.all([
        rawPrisma.auditLog.findMany({
            where,
            orderBy: [{ username: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, username: true, action: true, modulo: true, createdAt: true }
        }),
        rawPrisma.user.findMany({
            where: { isDeleted: false },
            select: { id: true, username: true, name: true, roleId: true, role: { select: { id: true, name: true } } }
        })
    ])

    const userMetaMap = new Map<string, { name: string; roleName: string }>()
    for (const u of allUsers) {
        userMetaMap.set(u.username, {
            name: u.name || u.username,
            roleName: u.role?.name || 'Sin Rol'
        })
    }

    // Estructuras de acumulación por módulo
    const moduleVisits = new Map<string, number>()
    const moduleDurationMs = new Map<string, number>()
    const moduleUsers = new Map<string, Set<string>>()
    const moduleUserVisits = new Map<string, Map<string, number>>()
    const moduleActionCounts = new Map<string, Map<string, number>>()
    const moduleLastActivity = new Map<string, number>()
    const globalActionCounts = new Map<string, number>()

    const MAX_GAP_MS = 20 * 60 * 1000 // Si hay más de 20 min de inactividad, se asume término de bloque
    const DEFAULT_EVENT_DWELL_MS = 90 * 1000 // 1.5 minutos para un evento aislado

    // Agrupar eventos secuenciales por usuario para atribuir tiempos al módulo visitado
    let currentUsername = ''
    let prevEvent: typeof logs[0] | null = null

    for (let i = 0; i < logs.length; i++) {
        const log = logs[i]
        const mod = (log.modulo || 'Otros').trim()
        const action = (log.action || 'CONSULTA').trim().toUpperCase()
        const eventTime = new Date(log.createdAt).getTime()

        // Contadores globales
        moduleVisits.set(mod, (moduleVisits.get(mod) || 0) + 1)
        globalActionCounts.set(action, (globalActionCounts.get(action) || 0) + 1)

        // Última actividad
        const currentLast = moduleLastActivity.get(mod) || 0
        if (eventTime > currentLast) moduleLastActivity.set(mod, eventTime)

        // Usuarios únicos
        if (!moduleUsers.has(mod)) moduleUsers.set(mod, new Set())
        moduleUsers.get(mod)!.add(log.username)

        // Visitas por usuario dentro del módulo
        if (!moduleUserVisits.has(mod)) moduleUserVisits.set(mod, new Map())
        const uMap = moduleUserVisits.get(mod)!
        uMap.set(log.username, (uMap.get(log.username) || 0) + 1)

        // Conteo de acciones dentro del módulo
        if (!moduleActionCounts.has(mod)) moduleActionCounts.set(mod, new Map())
        const aMap = moduleActionCounts.get(mod)!
        aMap.set(action, (aMap.get(action) || 0) + 1)

        // Atribución de tiempo
        if (log.username === currentUsername && prevEvent) {
            const prevMod = (prevEvent.modulo || 'Otros').trim()
            const prevTime = new Date(prevEvent.createdAt).getTime()
            const delta = eventTime - prevTime

            if (delta > 0 && delta <= MAX_GAP_MS) {
                // Atribuir delta al módulo previo en el que el usuario estuvo trabajando
                moduleDurationMs.set(prevMod, (moduleDurationMs.get(prevMod) || 0) + delta)
            } else {
                // Evento aislado previo
                moduleDurationMs.set(prevMod, (moduleDurationMs.get(prevMod) || 0) + DEFAULT_EVENT_DWELL_MS)
            }
        }

        currentUsername = log.username
        prevEvent = log

        // Si es el último evento del usuario o fin de array, atribuir tiempo base al evento actual
        const isLastOfUser = (i === logs.length - 1) || (logs[i + 1].username !== log.username)
        if (isLastOfUser) {
            moduleDurationMs.set(mod, (moduleDurationMs.get(mod) || 0) + DEFAULT_EVENT_DWELL_MS)
            prevEvent = null
        }
    }

    const totalEvents = logs.length

    // Mapear módulos a la lista final
    const modules: ModuleUsageStat[] = Array.from(moduleVisits.keys()).map((modulo) => {
        const totalVisits = moduleVisits.get(modulo) || 0
        const percentage = totalEvents > 0 ? Number(((totalVisits / totalEvents) * 100).toFixed(1)) : 0
        const totalMs = moduleDurationMs.get(modulo) || 0
        const totalMinutes = Math.round(totalMs / 60000)
        const totalHours = (totalMs / 3600000).toFixed(1)
        const avgMinutesPerVisit = totalVisits > 0 ? Number(((totalMs / totalVisits) / 60000).toFixed(1)) : 0
        const uniqueUsers = moduleUsers.get(modulo)?.size || 0

        // Acciones del módulo
        const aMap = moduleActionCounts.get(modulo) || new Map()
        const actionCounts: Record<string, number> = {}
        let topAction = 'CONSULTA'
        let topActionMax = 0
        for (const [act, count] of aMap.entries()) {
            actionCounts[act] = count
            if (count > topActionMax) {
                topActionMax = count
                topAction = act
            }
        }

        // Nivel de adopción
        let adoptionLevel: 'ALTO' | 'MEDIO' | 'BAJO' = 'BAJO'
        if (percentage >= 8 || uniqueUsers >= 5) {
            adoptionLevel = 'ALTO'
        } else if (percentage >= 2 || uniqueUsers >= 2) {
            adoptionLevel = 'MEDIO'
        }

        // Top 3 usuarios del módulo
        const uMap = moduleUserVisits.get(modulo) || new Map()
        const topUsers: ModuleTopUser[] = Array.from(uMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([uname, cnt]) => {
                const meta = userMetaMap.get(uname)
                return {
                    username: uname,
                    name: meta?.name || uname,
                    roleName: meta?.roleName || 'Sin Rol',
                    count: cnt,
                    percentage: totalVisits > 0 ? Math.round((cnt / totalVisits) * 100) : 0
                }
            })

        const lastActTime = moduleLastActivity.get(modulo)

        return {
            modulo,
            mainCategory: getMainModuleName(modulo),
            totalVisits,
            percentage,
            totalMinutes,
            totalHours,
            avgMinutesPerVisit,
            uniqueUsersCount: uniqueUsers,
            topAction,
            actionCounts,
            adoptionLevel,
            lastActivity: lastActTime ? new Date(lastActTime).toISOString() : null,
            topUsers
        }
    })

    // Ordenar módulos por defecto de mayor a menor visitas
    modules.sort((a, b) => b.totalVisits - a.totalVisits)

    // Agrupación por Áreas / Macro-categorías
    const areaMap = new Map<string, { count: number; totalMs: number; modules: Set<string> }>()
    for (const mod of modules) {
        const area = mod.mainCategory
        const current = areaMap.get(area) || { count: 0, totalMs: 0, modules: new Set() }
        current.count += mod.totalVisits
        current.totalMs += (Number(mod.totalHours) * 3600000)
        current.modules.add(mod.modulo)
        areaMap.set(area, current)
    }

    const areaDistribution: AreaDistributionItem[] = Array.from(areaMap.entries()).map(([area, data]) => {
        const percentage = totalEvents > 0 ? Number(((data.count / totalEvents) * 100).toFixed(1)) : 0
        const totalMinutes = Math.round(data.totalMs / 60000)
        const totalHours = (data.totalMs / 3600000).toFixed(1)
        return {
            area,
            count: data.count,
            percentage,
            totalMinutes,
            totalHours,
            modulesCount: data.modules.size
        }
    }).sort((a, b) => b.count - a.count)

    // Distribución por tipos de acción
    const actionDistribution: ActionDistributionItem[] = Array.from(globalActionCounts.entries()).map(([action, count]) => {
        const percentage = totalEvents > 0 ? Number(((count / totalEvents) * 100).toFixed(1)) : 0
        return {
            action,
            count,
            percentage
        }
    }).sort((a, b) => b.count - a.count)

    // Identificar módulo con más tiempo y más transacciones
    let topTimeMod = { modulo: 'N/A', hours: '0.0', minutes: 0 }
    let topTimeMax = -1
    let topTransMod = { modulo: 'N/A', count: 0 }
    let topTransMax = -1

    for (const m of modules) {
        if (m.totalMinutes > topTimeMax) {
            topTimeMax = m.totalMinutes
            topTimeMod = { modulo: m.modulo, hours: m.totalHours, minutes: m.totalMinutes }
        }

        const transCount = (m.actionCounts['CREACION'] || 0) +
                           (m.actionCounts['MODIFICACION'] || 0) +
                           (m.actionCounts['ELIMINACION'] || 0) +
                           (m.actionCounts['FIRMA'] || 0)
        if (transCount > topTransMax) {
            topTransMax = transCount
            topTransMod = { modulo: m.modulo, count: transCount }
        }
    }

    const topUsedMod = modules.length > 0 ? {
        modulo: modules[0].modulo,
        count: modules[0].totalVisits,
        percentage: modules[0].percentage
    } : { modulo: 'N/A', count: 0, percentage: 0 }

    return {
        summaryCards: {
            topUsedModule: topUsedMod,
            topTimeModule: topTimeMod,
            totalModulesTracked: modules.length,
            activeModulesCount: modules.filter(m => m.totalVisits > 0).length,
            totalEvents,
            topTransactionalModule: topTransMod
        },
        modules,
        areaDistribution,
        actionDistribution,
        benchmarkMs: Date.now() - t0
    }
}
