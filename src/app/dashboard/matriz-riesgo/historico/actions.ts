'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { endOfMonth, isBefore } from 'date-fns'

const PROBLEM_VALUES = ['NO', 'NO_EXISTE', 'Malo', 'Insuficiente']

export type HistoricoFilters = {
    year?: number | 'all'
    semester?: 1 | 2 | 'all'
    sucursal?: string
    supervisor?: string
    vigencia?: 'all' | 'vigente' | 'no_vigente'
    estado?: 'all' | 'pendiente' | 'por supervisar' | 'cerrado'
    search?: string
}

async function getUserPermissionsAndFilters() {
    const session = await getSession()
    if (!session?.user) return null

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    const permissions = session.user.role?.permissions || []
    const hasPermission = permissions.includes('view_historico_matriz') || isAdmin

    let userRbds: number[] = session.user.rbds || []
    if (session.user.id) {
        const dbUser = await rawPrisma.user.findUnique({
            where: { id: session.user.id },
            select: { rbds: true }
        })
        if (dbUser?.rbds) userRbds = dbUser.rbds
    }

    const delegations = await prisma.delegacionVisualizacion.findMany({
        where: { userId: session.user.id },
        include: { sucursal: true }
    })
    const delegatedSucursales = delegations.map(d => d.sucursal.nombre)
    const isDelegated = delegatedSucursales.length > 0

    return {
        session,
        isAdmin,
        hasPermission,
        userRbds,
        delegatedSucursales,
        isDelegated
    }
}

export async function getHistoricoInitialFilters() {
    const userContext = await getUserPermissionsAndFilters()
    if (!userContext || !userContext.hasPermission) {
        return { error: 'No tienes permisos para acceder al histórico de matrices.' }
    }

    try {
        // Available years in cabeceras and configs
        const configs = await prisma.matrizConfigSemestre.findMany({ select: { anio: true } })
        const cabeceras = await prisma.matrizT_Cabecera.findMany({ select: { anio: true } })
        const yearsSet = new Set<number>([
            new Date().getFullYear(),
            ...configs.map(c => c.anio),
            ...cabeceras.map(c => c.anio)
        ])
        const availableYears = Array.from(yearsSet).sort((a, b) => b - a)

        // Available sucursales
        const sucursalesDb = await prisma.sucursal.findMany({ select: { nombre: true }, orderBy: { nombre: 'asc' } })
        const sucursales = sucursalesDb.map(s => s.nombre)

        // Available supervisors
        const supervisors = await prisma.user.findMany({
            where: {
                role: { name: { in: ['Supervisor', 'supervisor'] } },
                isDeleted: false
            },
            select: { id: true, username: true, name: true },
            orderBy: { name: 'asc' }
        })

        return {
            availableYears,
            sucursales,
            supervisors: supervisors.map(s => ({
                id: s.id,
                username: s.username,
                name: s.name || s.username
            }))
        }
    } catch (e: any) {
        console.error('Error al cargar filtros iniciales de histórico:', e)
        return { error: 'Error al cargar filtros iniciales.' }
    }
}

export async function getHistoricoData(filters: HistoricoFilters) {
    const userContext = await getUserPermissionsAndFilters()
    if (!userContext || !userContext.hasPermission) {
        return { error: 'No tienes permisos para acceder al histórico de matrices.' }
    }

    const { isAdmin, userRbds, isDelegated, delegatedSucursales } = userContext

    try {
        // 1. Fetch semester configs
        const configsSemestre = await prisma.matrizConfigSemestre.findMany()
        const configMap = new Map(configsSemestre.map(c => [c.anio, c.fechaFin1]))

        // 2. Fetch schools
        const [colegiosMatriz, colegiosGeneral] = await Promise.all([
            prisma.colegiosMatriz.findMany(),
            prisma.colegios.findMany({ select: { colRBD: true, nombreEstablecimiento: true, sucursal: true } })
        ])

        const schoolNameMap = new Map<number, { name: string, sucursal: string }>()
        colegiosGeneral.forEach(c => schoolNameMap.set(c.colRBD, { name: c.nombreEstablecimiento, sucursal: c.sucursal }))
        colegiosMatriz.forEach(c => schoolNameMap.set(c.colRBD, { name: c.nombreEstablecimiento, sucursal: c.sucursal }))

        // 3. Build DB where clause
        const where: any = {}

        if (filters.year && filters.year !== 'all') {
            const y = Number(filters.year)
            const startDate = new Date(y, 2, 1) // 1 de Marzo
            const endDate = endOfMonth(new Date(y + 1, 1)) // Fin de Febrero sgte año
            where.fechaIngreso = {
                gte: startDate,
                lte: endDate
            }
        }

        if (filters.estado && filters.estado !== 'all') {
            where.estado = filters.estado
        }

        // Apply user scope restrictions
        if (!isAdmin) {
            const orConditions: any[] = []
            if (userRbds.length > 0) orConditions.push({ rbd: { in: userRbds } })
            if (isDelegated) {
                const delegatedRbds = Array.from(schoolNameMap.entries())
                    .filter(([_, info]) => delegatedSucursales.includes(info.sucursal))
                    .map(([rbd]) => rbd)
                if (delegatedRbds.length > 0) {
                    orConditions.push({ rbd: { in: delegatedRbds } })
                }
            }
            if (orConditions.length > 0) {
                where.OR = orConditions
            } else {
                where.id = 'NO_DATA'
            }
        }

        // 4. Fetch all evaluation headers
        const matricesDb = await prisma.matrizT_RespuestasCabecera.findMany({
            where,
            include: {
                cabecera: {
                    include: {
                        detalles: true
                    }
                },
                detalles: {
                    include: {
                        pregunta: true
                    }
                }
            },
            orderBy: { fechaIngreso: 'desc' }
        })

        // 5. Fetch mitigations
        const mitigaciones = await prisma.matrizMitigacion.findMany()
        const mitigacionesMap = new Map<string, any>()
        mitigaciones.forEach(m => {
            mitigacionesMap.set(`${m.matrizId}-${m.preguntaId}`, m)
        })

        // 6. Process and augment evaluations
        let totalFindings = 0
        let solvedFindings = 0
        let totalClosed = 0
        let totalPending = 0

        const processed = matricesDb.map(m => {
            const schoolInfo = schoolNameMap.get(m.rbd)
            const nombreColegio = schoolInfo?.name || `RBD ${m.rbd}`
            const sucursal = schoolInfo?.sucursal || 'Sin Sucursal'

            // Determine semester
            const evalDate = new Date(m.fechaIngreso)
            const evalYear = evalDate.getFullYear()
            const cutoffDate = configMap.get(evalYear) || new Date(evalYear, 6, 31) // fallback 31 julio
            const semester = (isBefore(evalDate, cutoffDate) || evalDate.getTime() === cutoffDate.getTime()) ? 1 : 2

            // Calculate problems/deviations
            const problems: any[] = []
            const respuestasMap = new Map(m.detalles.map(d => [d.preguntaId, d]))
            const plantillaDetalles = m.cabecera?.detalles || []

            plantillaDetalles.forEach(pregunta => {
                const resp = respuestasMap.get(pregunta.id)
                if (resp && resp.valor && PROBLEM_VALUES.includes(resp.valor)) {
                    const mit = mitigacionesMap.get(`${m.id}-${pregunta.id}`)
                    const isSolved = Boolean(mit?.fechaSolucion)
                    
                    let originalPhotos: string[] = []
                    if (resp.adjuntoUrl) {
                        try {
                            const parsed = JSON.parse(resp.adjuntoUrl)
                            originalPhotos = Array.isArray(parsed) ? parsed : [resp.adjuntoUrl]
                        } catch {
                            originalPhotos = [resp.adjuntoUrl]
                        }
                    }

                    let mitPhotos: string[] = []
                    if (mit?.adjuntos) {
                        try {
                            const parsed = JSON.parse(mit.adjuntos)
                            mitPhotos = Array.isArray(parsed) ? parsed : [mit.adjuntos]
                        } catch {
                            mitPhotos = [mit.adjuntos]
                        }
                    }

                    problems.push({
                        preguntaId: pregunta.id,
                        preguntaNombre: pregunta.preguntaNombre,
                        seccion: pregunta.seccion,
                        nivelRiesgo: pregunta.nivelRiesgo || 1,
                        gravedad: pregunta.gravedad || 1,
                        probabilidad: pregunta.probabilidad || 1,
                        justificacion: pregunta.justificacion,
                        respuestaValor: resp.valor,
                        originalPhotos,
                        isSolved,
                        fechaSolucion: mit?.fechaSolucion ? new Date(mit.fechaSolucion).toISOString() : null,
                        usuarioMitigacion: mit?.usuario || null,
                        mitPhotos
                    })
                }
            })

            const solvedCount = problems.filter(p => p.isSolved).length
            const isCompleted = m.estado === 'por supervisar' || m.estado === 'cerrado'
            if (isCompleted) totalClosed++
            else totalPending++

            totalFindings += problems.length
            solvedFindings += solvedCount

            return {
                id: m.id,
                rbd: m.rbd,
                nombreColegio,
                sucursal,
                fechaIngreso: m.fechaIngreso.toISOString(),
                supervisorNombre: m.supervisorNombre,
                supervisorCorreo: m.supervisorCorreo,
                usuario: m.usuario,
                estado: m.estado,
                latIngreso: m.latIngreso,
                lngIngreso: m.lngIngreso,
                latCierre: m.latCierre,
                lngCierre: m.lngCierre,
                cabecera: {
                    id: m.cabecera.id,
                    titulo: m.cabecera.titulo,
                    anio: m.cabecera.anio,
                    estado: m.cabecera.estado // true = Vigente, false = No vigente
                },
                semester,
                problemsCount: problems.length,
                solvedCount,
                pctSolucion: problems.length > 0 ? Math.round((solvedCount / problems.length) * 100) : 100,
                problems
            }
        })

        // 7. Apply In-memory filters (semester, supervisor, sucursal, vigencia, search)
        let filtered = processed.filter(item => {
            if (filters.semester && filters.semester !== 'all' && item.semester !== filters.semester) {
                return false
            }
            if (filters.sucursal && filters.sucursal !== 'all' && item.sucursal !== filters.sucursal) {
                return false
            }
            if (filters.supervisor && filters.supervisor !== 'all' && item.usuario !== filters.supervisor && item.supervisorNombre !== filters.supervisor) {
                return false
            }
            if (filters.vigencia === 'vigente' && item.cabecera.estado === false) {
                return false
            }
            if (filters.vigencia === 'no_vigente' && item.cabecera.estado !== false) {
                return false
            }
            if (filters.search) {
                const s = filters.search.toLowerCase()
                const matchRbd = item.rbd.toString().includes(s)
                const matchName = item.nombreColegio.toLowerCase().includes(s)
                const matchTemplate = item.cabecera.titulo.toLowerCase().includes(s)
                const matchSupervisor = item.supervisorNombre.toLowerCase().includes(s)
                if (!matchRbd && !matchName && !matchTemplate && !matchSupervisor) {
                    return false
                }
            }
            return true
        })

        const totalEvaluaciones = filtered.length
        const totalHallazgosFiltrados = filtered.reduce((acc, i) => acc + i.problemsCount, 0)
        const totalSolucionadosFiltrados = filtered.reduce((acc, i) => acc + i.solvedCount, 0)
        const pctMitigacionGlobal = totalHallazgosFiltrados > 0 
            ? Math.round((totalSolucionadosFiltrados / totalHallazgosFiltrados) * 100) 
            : (totalEvaluaciones > 0 ? 100 : 0)

        return {
            evaluaciones: filtered,
            kpis: {
                totalEvaluaciones,
                totalHallazgos: totalHallazgosFiltrados,
                totalSolucionados: totalSolucionadosFiltrados,
                pctMitigacionGlobal,
                totalCerradas: filtered.filter(f => f.estado === 'por supervisar' || f.estado === 'cerrado').length,
                totalPendientes: filtered.filter(f => f.estado === 'pendiente').length
            }
        }
    } catch (e: any) {
        console.error('Error al obtener datos históricos:', e)
        return { error: 'Error al obtener datos históricos de la base de datos.' }
    }
}

export async function getRbdHistoryTimeline(rbd: number) {
    const userContext = await getUserPermissionsAndFilters()
    if (!userContext || !userContext.hasPermission) {
        return { error: 'No tienes permisos para consultar la trazabilidad del colegio.' }
    }

    try {
        const [colegioMatriz, colegioGeneral] = await Promise.all([
            prisma.colegiosMatriz.findUnique({ where: { colRBD: rbd } }),
            prisma.colegios.findFirst({ where: { colRBD: rbd } })
        ])

        const nombreEstablecimiento = colegioMatriz?.nombreEstablecimiento || colegioGeneral?.nombreEstablecimiento || `RBD ${rbd}`
        const sucursal = colegioMatriz?.sucursal || colegioGeneral?.sucursal || 'Sin Sucursal'

        const evaluationsDb = await prisma.matrizT_RespuestasCabecera.findMany({
            where: { rbd },
            include: {
                cabecera: {
                    include: { detalles: true }
                },
                detalles: {
                    include: { pregunta: true }
                }
            },
            orderBy: { fechaIngreso: 'asc' }
        })

        const mitigaciones = await prisma.matrizMitigacion.findMany({
            where: {
                matrizId: { in: evaluationsDb.map(e => e.id) }
            }
        })
        const mitMap = new Map<string, any>()
        mitigaciones.forEach(m => mitMap.set(`${m.matrizId}-${m.preguntaId}`, m))

        const configsSemestre = await prisma.matrizConfigSemestre.findMany()
        const configMap = new Map(configsSemestre.map(c => [c.anio, c.fechaFin1]))

        const timeline = evaluationsDb.map(ev => {
            const evalDate = new Date(ev.fechaIngreso)
            const evalYear = evalDate.getFullYear()
            const cutoffDate = configMap.get(evalYear) || new Date(evalYear, 6, 31)
            const semester = (isBefore(evalDate, cutoffDate) || evalDate.getTime() === cutoffDate.getTime()) ? 1 : 2

            const answersMap = new Map(ev.detalles.map(d => [d.preguntaId, d]))
            const questions = ev.cabecera?.detalles || []

            const findings: any[] = []
            questions.forEach(q => {
                const ans = answersMap.get(q.id)
                if (ans && ans.valor && PROBLEM_VALUES.includes(ans.valor)) {
                    const mit = mitMap.get(`${ev.id}-${q.id}`)
                    findings.push({
                        preguntaId: q.id,
                        preguntaNombre: q.preguntaNombre,
                        seccion: q.seccion,
                        nivelRiesgo: q.nivelRiesgo || 1,
                        gravedad: q.gravedad || 1,
                        probabilidad: q.probabilidad || 1,
                        respuestaValor: ans.valor,
                        isSolved: Boolean(mit?.fechaSolucion),
                        fechaSolucion: mit?.fechaSolucion ? new Date(mit.fechaSolucion).toISOString() : null,
                        usuarioMitigacion: mit?.usuario || null
                    })
                }
            })

            return {
                id: ev.id,
                fechaIngreso: ev.fechaIngreso.toISOString(),
                semester,
                year: evalYear,
                supervisorNombre: ev.supervisorNombre,
                estado: ev.estado,
                latIngreso: ev.latIngreso,
                lngIngreso: ev.lngIngreso,
                latCierre: ev.latCierre,
                lngCierre: ev.lngCierre,
                plantillaTitulo: ev.cabecera.titulo,
                plantillaVigente: ev.cabecera.estado,
                totalHallazgos: findings.length,
                totalMitigados: findings.filter(f => f.isSolved).length,
                pctSolucion: findings.length > 0 ? Math.round((findings.filter(f => f.isSolved).length / findings.length) * 100) : 100,
                findings
            }
        })

        // Recurring questions analysis
        const questionFrequency = new Map<string, { name: string, count: number, solvedCount: number }>()
        timeline.forEach(item => {
            item.findings.forEach((f: any) => {
                const existing = questionFrequency.get(f.preguntaNombre) || { name: f.preguntaNombre, count: 0, solvedCount: 0 }
                existing.count++
                if (f.isSolved) existing.solvedCount++
                questionFrequency.set(f.preguntaNombre, existing)
            })
        })

        const recurringFindings = Array.from(questionFrequency.values())
            .sort((a, b) => b.count - a.count)

        // Registrar auditoría de consulta de trazabilidad
        if (userContext.session?.user?.username) {
            await logAuditAction({
                username: userContext.session.user.username,
                userId: userContext.session.user.id || null,
                modulo: 'Matriz de Riesgo - Histórico',
                action: 'VIEW_RBD_TIMELINE',
                detalle: `Consultó línea de tiempo histórica del RBD ${rbd} (${nombreEstablecimiento}).`
            })
        }

        return {
            rbd,
            nombreEstablecimiento,
            sucursal,
            timeline,
            recurringFindings
        }
    } catch (e: any) {
        console.error('Error al obtener trazabilidad por RBD:', e)
        return { error: 'Error al obtener la trazabilidad del establecimiento.' }
    }
}

export async function logHistoricoExportAudit(format: 'EXCEL' | 'PDF', totalCount: number) {
    try {
        const session = await getSession()
        if (session?.user?.username) {
            await logAuditAction({
                username: session.user.username,
                userId: session.user.id || null,
                modulo: 'Matriz de Riesgo - Histórico',
                action: `EXPORT_${format}`,
                detalle: `Exportó ${totalCount} registros del histórico de matrices a formato ${format}.`
            })
        }
        return { success: true }
    } catch (e) {
        return { success: false }
    }
}
