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
