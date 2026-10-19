'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { ensureMonitoreoTables } from '@/lib/monitoreo-db-init'

export type SemaforoStatus = 'VERDE' | 'AMARILLO' | 'ROJO'

export interface EvaluacionItemAvance {
    tipo: 'MATRIZ' | 'ACTA'
    plantillaId: string
    nombre: string
    periodicidad: string
    periodicidadLabel: string
    fechaTope: string // ISO string
    fechaTopeFormatted: string
    diasRestantes: number
    totalRequerido: number
    realizadas: number
    faltantes: number
    porcentaje: number
    semaforo: SemaforoStatus
}

export interface DetalleColegioColaborador {
    rbd: number
    nombreEstablecimiento: string
    comuna?: string
    sucursal?: string
    evaluaciones: Array<{
        nombrePauta: string
        tipo: 'MATRIZ' | 'ACTA'
        completado: boolean
        fechaRealizacion?: string | null
    }>
}

export interface ColaboradorCardData {
    userId: string
    name: string
    username: string
    email?: string | null
    roleName: string
    rbdsCount: number
    rbds: number[]
    semaforoGlobal: SemaforoStatus
    porcentajeGlobal: number
    evaluaciones: EvaluacionItemAvance[]
    colegiosDetalle: DetalleColegioColaborador[]
    sucursales: string[]
}

export interface MesOpcion {
    mes: number
    anio: number
    label: string
    isCurrent: boolean
}

export interface MonitoreoAvancesResponse {
    success: boolean
    error?: string
    isConfigured: boolean
    canConfig?: boolean
    mesActual: number
    anioActual: number
    mesesDisponibles: MesOpcion[]
    kpis: {
        totalColaboradores: number
        totalAlDia: number
        totalAtrasoLeve: number
        totalAtrasoGrave: number
        cumplimientoGlobalPorcentaje: number
    }
    colaboradores: ColaboradorCardData[]
    rolesDisponibles: string[]
    sucursalesDisponibles: string[]
}

const PERIODICIDAD_LABELS: Record<string, string> = {
    '1_DIA': 'Diario (1 día)',
    '15_DIAS': 'Quincenal (15 días)',
    '1_MES': 'Mensual (1 mes)',
    'BIMESTRAL': 'Bimestral (60 días)',
    'TRIMESTRAL': 'Trimestral (90 días)',
    'SEMESTRAL': 'Semestral (180 días)',
    '1_ANIO': 'Anual (1 año)'
}

const MESES_NOMBRES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function getAvailableMonths(now: Date): MesOpcion[] {
    const list: MesOpcion[] = []
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-11

    // Generar opciones para los últimos 12 meses históricos
    for (let i = 0; i < 12; i++) {
        const d = new Date(currentYear, currentMonth - i, 1)
        const m = d.getMonth() + 1
        const y = d.getFullYear()
        const isCurrent = i === 0
        list.push({
            mes: m,
            anio: y,
            label: `${MESES_NOMBRES[m - 1]} ${y}${isCurrent ? ' (Actual)' : ''}`,
            isCurrent
        })
    }
    return list
}

function getCycleRangeAndDeadline(periodicidad: string, targetDate: Date, realNow: Date) {
    const year = targetDate.getFullYear()
    const month = targetDate.getMonth() // 0-11
    const isCurrentMonth = realNow.getFullYear() === year && realNow.getMonth() === month
    const date = isCurrentMonth ? realNow.getDate() : 1

    let start = new Date(year, month, 1, 0, 0, 0, 0)
    let end = new Date(year, month + 1, 0, 23, 59, 59, 999)

    if (periodicidad === '1_DIA') {
        start = new Date(year, month, date, 0, 0, 0, 0)
        end = new Date(year, month, date, 23, 59, 59, 999)
    } else if (periodicidad === '15_DIAS') {
        if (date <= 15) {
            start = new Date(year, month, 1, 0, 0, 0, 0)
            end = new Date(year, month, 15, 23, 59, 59, 999)
        } else {
            start = new Date(year, month, 16, 0, 0, 0, 0)
            end = new Date(year, month + 1, 0, 23, 59, 59, 999)
        }
    } else if (periodicidad === 'BIMESTRAL') {
        const bMonthStart = Math.floor(month / 2) * 2
        start = new Date(year, bMonthStart, 1, 0, 0, 0, 0)
        end = new Date(year, bMonthStart + 2, 0, 23, 59, 59, 999)
    } else if (periodicidad === 'TRIMESTRAL') {
        const qMonthStart = Math.floor(month / 3) * 3
        start = new Date(year, qMonthStart, 1, 0, 0, 0, 0)
        end = new Date(year, qMonthStart + 3, 0, 23, 59, 59, 999)
    } else if (periodicidad === 'SEMESTRAL') {
        const sMonthStart = Math.floor(month / 6) * 6
        start = new Date(year, sMonthStart, 1, 0, 0, 0, 0)
        end = new Date(year, sMonthStart + 6, 0, 23, 59, 59, 999)
    } else if (periodicidad === '1_ANIO') {
        start = new Date(year, 0, 1, 0, 0, 0, 0)
        end = new Date(year, 11, 31, 23, 59, 59, 999)
    }

    const diffMs = end.getTime() - realNow.getTime()
    const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    const formatter = new Intl.DateTimeFormat('es-CL', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    })

    return {
        start,
        end,
        deadlineIso: end.toISOString(),
        deadlineFormatted: formatter.format(end),
        diasRestantes
    }
}

function calculateSemaforo(porcentaje: number, faltantes: number, diasRestantes: number): SemaforoStatus {
    if (faltantes === 0 || porcentaje >= 100) {
        return 'VERDE'
    }
    // Si el plazo ya expiró (mes histórico concluido o fecha tope superada)
    if (diasRestantes <= 0) {
        return 'ROJO'
    }
    // Si faltan 5 días o menos para el vencimiento
    if (diasRestantes <= 5) {
        if (porcentaje < 40) return 'ROJO'
        return 'AMARILLO'
    }
    // Si hay suficiente margen temporal
    if (porcentaje >= 50) return 'VERDE'
    return 'AMARILLO'
}

/**
 * Verifica si el rol del colaborador está incluido en los rolesPerfiles asignados al acta.
 * Si rolesPerfiles está vacío o no configurado, aplica a todos los roles operativos.
 */
function isUserRoleAllowedForActa(rolesPerfilesJson: string | null | undefined, userRoleName: string, userRoleId: string): boolean {
    if (!rolesPerfilesJson) return true
    try {
        const allowed: string[] = JSON.parse(rolesPerfilesJson)
        if (!Array.isArray(allowed) || allowed.length === 0) return true

        const normalizedUserRole = userRoleName.toLowerCase().trim()
        return allowed.some(r => {
            const normalizedAllowed = r.toLowerCase().trim()
            return normalizedAllowed === normalizedUserRole || 
                   r === userRoleId || 
                   (normalizedUserRole.includes('supervisor') && normalizedAllowed.includes('supervisor'))
        })
    } catch {
        const list = String(rolesPerfilesJson).split(',').map(s => s.trim().toLowerCase())
        return list.length === 0 || list.includes(userRoleName.toLowerCase().trim())
    }
}

export async function getMonitoreoAvancesData(mes?: number, anio?: number): Promise<MonitoreoAvancesResponse> {
    try {
        await ensureMonitoreoTables()

        const now = new Date()
        const selectedMes = mes ? Number(mes) : (now.getMonth() + 1)
        const selectedAnio = anio ? Number(anio) : now.getFullYear()
        const targetDate = new Date(selectedAnio, selectedMes - 1, 15, 12, 0, 0)
        const mesesDisponibles = getAvailableMonths(now)

        const session = await getSession()
        if (!session || !session.user) {
            return {
                success: false,
                error: 'Sesión no válida o expirada.',
                isConfigured: false,
                canConfig: false,
                mesActual: selectedMes,
                anioActual: selectedAnio,
                mesesDisponibles,
                kpis: { totalColaboradores: 0, totalAlDia: 0, totalAtrasoLeve: 0, totalAtrasoGrave: 0, cumplimientoGlobalPorcentaje: 0 },
                colaboradores: [],
                rolesDisponibles: [],
                sucursalesDisponibles: []
            }
        }

        const permissions = session.user.role?.permissions || []
        const roleName = session.user.role?.name?.toLowerCase().trim() || ''
        const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin' || roleName.includes('gerencia')
        const canConfig = isAdmin || permissions.includes('manage_mantenedor_monitoreo')

        if (!isAdmin && !permissions.includes('view_tablero_monitoreo_avances')) {
            return {
                success: false,
                error: 'No tienes permisos para visualizar el Tablero de Monitoreo de Avances.',
                isConfigured: false,
                canConfig: false,
                mesActual: selectedMes,
                anioActual: selectedAnio,
                mesesDisponibles,
                kpis: { totalColaboradores: 0, totalAlDia: 0, totalAtrasoLeve: 0, totalAtrasoGrave: 0, cumplimientoGlobalPorcentaje: 0 },
                colaboradores: [],
                rolesDisponibles: [],
                sucursalesDisponibles: []
            }
        }

        // 1. Obtener la configuración activa de monitoreo
        const configGlobal: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT "rolesAsignados" FROM "monitoreo_configuracion" WHERE "id" = 'global' LIMIT 1;
        `)

        let rolesAsignadosIds: string[] = []
        if (configGlobal && configGlobal.length > 0 && configGlobal[0].rolesAsignados) {
            try {
                rolesAsignadosIds = JSON.parse(configGlobal[0].rolesAsignados)
            } catch {
                rolesAsignadosIds = []
            }
        }

        const itemsActivosDb: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT "tipo", "plantillaId", "nombre", "periodicidad", "diasCiclo"
            FROM "monitoreo_item_config"
            WHERE "activo" = true;
        `)

        if (rolesAsignadosIds.length === 0 || itemsActivosDb.length === 0) {
            return {
                success: true,
                isConfigured: false,
                canConfig: Boolean(canConfig),
                mesActual: selectedMes,
                anioActual: selectedAnio,
                mesesDisponibles,
                kpis: { totalColaboradores: 0, totalAlDia: 0, totalAtrasoLeve: 0, totalAtrasoGrave: 0, cumplimientoGlobalPorcentaje: 0 },
                colaboradores: [],
                rolesDisponibles: [],
                sucursalesDisponibles: []
            }
        }

        // 2. Obtener SOLO los roles que tenemos seleccionados en el mantenedor
        const rolesSeleccionadosDb = await rawPrisma.role.findMany({
            where: { id: { in: rolesAsignadosIds } },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        })
        const rolesDisponibles = rolesSeleccionadosDb.map(r => r.name)

        // 3. Determinar filtro de RBD del usuario conectado (Aislamiento por perfil)
        let allowedViewerRbds: number[] | null = null
        if (!isAdmin) {
            let sessionRbds = session.user.rbds || []
            if (session.user.id) {
                const dbUser = await rawPrisma.user.findUnique({
                    where: { id: session.user.id },
                    select: { rbds: true, email: true, username: true, name: true }
                })
                if (dbUser && dbUser.rbds.length > 0) {
                    sessionRbds = dbUser.rbds
                } else if (dbUser) {
                    const sups = await rawPrisma.supervisor.findMany({
                        where: {
                            OR: [
                                ...(dbUser.email ? [{ correo: { equals: dbUser.email, mode: 'insensitive' as const } }] : []),
                                ...(dbUser.username ? [{ correo: { contains: dbUser.username, mode: 'insensitive' as const } }] : []),
                                ...(dbUser.name ? [{ nombre: { equals: dbUser.name, mode: 'insensitive' as const } }] : [])
                            ]
                        },
                        include: { rbdsAuditar: true }
                    })
                    const collected: number[] = []
                    for (const s of sups) {
                        for (const r of s.rbdsAuditar) {
                            collected.push(r.rbd)
                        }
                    }
                    if (collected.length > 0) {
                        sessionRbds = collected
                    }
                }
            }
            if (sessionRbds.length > 0) {
                allowedViewerRbds = sessionRbds
            }
        }

        // 4. Obtener los usuarios de los roles monitoreados
        const usersMonitoreados = await rawPrisma.user.findMany({
            where: {
                roleId: { in: rolesAsignadosIds },
                isDeleted: false,
                isActive: true
            },
            include: {
                role: true
            },
            orderBy: [
                { role: { name: 'asc' } },
                { name: 'asc' },
                { username: 'asc' }
            ]
        })

        if (usersMonitoreados.length === 0) {
            return {
                success: true,
                isConfigured: true,
                canConfig: Boolean(canConfig),
                mesActual: selectedMes,
                anioActual: selectedAnio,
                mesesDisponibles,
                kpis: { totalColaboradores: 0, totalAlDia: 0, totalAtrasoLeve: 0, totalAtrasoGrave: 0, cumplimientoGlobalPorcentaje: 0 },
                colaboradores: [],
                rolesDisponibles,
                sucursalesDisponibles: []
            }
        }

        // 5. Mapear RBDs de cada usuario (combinando user.rbds y SupervisorRbd)
        const allSupervisores = await rawPrisma.supervisor.findMany({
            where: { vigente: true },
            include: { rbdsAuditar: true }
        })

        const userRbdsMap = new Map<string, number[]>()
        const allDistinctRbds = new Set<number>()

        for (const u of usersMonitoreados) {
            const rbdsSet = new Set<number>(u.rbds || [])

            const matchingSups = allSupervisores.filter(s => 
                (u.email && s.correo.toLowerCase() === u.email.toLowerCase()) ||
                (u.username && s.correo.toLowerCase().includes(u.username.toLowerCase())) ||
                (u.name && s.nombre.toLowerCase().includes(u.name.toLowerCase()))
            )
            for (const sup of matchingSups) {
                for (const r of sup.rbdsAuditar) {
                    rbdsSet.add(r.rbd)
                }
            }

            let finalRbds = Array.from(rbdsSet)
            if (allowedViewerRbds !== null) {
                finalRbds = finalRbds.filter(rbd => allowedViewerRbds!.includes(rbd))
            }

            userRbdsMap.set(u.id, finalRbds)
            finalRbds.forEach(r => allDistinctRbds.add(r))
        }

        const colegiosDb = await rawPrisma.colegios.findMany({
            where: {
                colRBD: { in: Array.from(allDistinctRbds) }
            },
            select: {
                colRBD: true,
                nombreEstablecimiento: true,
                comuna: true,
                sucursal: true
            }
        })

        const colegiosMap = new Map<number, { nombre: string; comuna?: string; sucursal?: string }>()
        for (const c of colegiosDb) {
            colegiosMap.set(c.colRBD, {
                nombre: c.nombreEstablecimiento,
                comuna: c.comuna,
                sucursal: c.sucursal
            })
        }

        // 6. Cargar respuestas dentro de las ventanas temporales del mes histórico / actual
        const actasPlantillasDb = await rawPrisma.actaSupervisionPlantilla.findMany({
            where: { estado: true },
            select: { id: true, rolesPerfiles: true }
        })
        const actasRolesMap = new Map<string, string | null>()
        for (const ap of actasPlantillasDb) {
            actasRolesMap.set(ap.id, ap.rolesPerfiles)
        }

        // Agrupamos ventanas temporales según targetDate (mes histórico o actual)
        const itemsConfigInfo = itemsActivosDb.map((item: any) => {
            const cycle = getCycleRangeAndDeadline(item.periodicidad, targetDate, now)
            return {
                ...item,
                ...cycle
            }
        })

        const matrizItems = itemsConfigInfo.filter((i: any) => i.tipo === 'MATRIZ')
        const actaItems = itemsConfigInfo.filter((i: any) => i.tipo === 'ACTA')

        // Matriz respuestas
        const matrizRespuestas = matrizItems.length > 0 ? await rawPrisma.matrizT_RespuestasCabecera.findMany({
            where: {
                cabeceraId: { in: matrizItems.map((m: any) => m.plantillaId) },
                rbd: { in: Array.from(allDistinctRbds) }
            },
            select: {
                cabeceraId: true,
                rbd: true,
                usuario: true,
                fechaIngreso: true,
                createdAt: true
            }
        }) : []

        // Acta respuestas
        const actaRespuestas = actaItems.length > 0 ? await rawPrisma.actaSupervisionRespuesta.findMany({
            where: {
                plantillaId: { in: actaItems.map((a: any) => a.plantillaId) },
                rbd: { in: Array.from(allDistinctRbds) }
            },
            select: {
                plantillaId: true,
                rbd: true,
                usuario: true,
                fechaCreacion: true,
                createdAt: true
            }
        }) : []

        // 7. Construir las tarjetas de colaboradores
        const colaboradores: ColaboradorCardData[] = []

        for (const u of usersMonitoreados) {
            const userRbds = userRbdsMap.get(u.id) || []

            // Si el visor tiene restricciones y este usuario no tiene RBDs en común, omitir
            if (allowedViewerRbds !== null && userRbds.length === 0) {
                continue
            }

            // Filtrar únicamente los ítems que corresponden al rol de este colaborador
            const itemsParaColaborador = itemsConfigInfo.filter((item: any) => {
                if (item.tipo === 'ACTA') {
                    const rolesPerfiles = actasRolesMap.get(item.plantillaId)
                    return isUserRoleAllowedForActa(rolesPerfiles, u.role.name, u.role.id)
                }
                return true
            })

            const evaluacionesColab: EvaluacionItemAvance[] = []
            let sumPorcentajes = 0

            // Evaluaciones del colaborador
            for (const item of itemsParaColaborador) {
                const cycleStart = item.start
                const cycleEnd = item.end

                let realizadasCount = 0
                const evaluadosRbdSet = new Set<number>()

                if (item.tipo === 'MATRIZ') {
                    for (const resp of matrizRespuestas) {
                        if (resp.cabeceraId === item.plantillaId && userRbds.includes(resp.rbd)) {
                            const dateToCompare = resp.createdAt || resp.fechaIngreso
                            if (dateToCompare >= cycleStart && dateToCompare <= cycleEnd) {
                                evaluadosRbdSet.add(resp.rbd)
                            }
                        }
                    }
                } else {
                    for (const resp of actaRespuestas) {
                        if (resp.plantillaId === item.plantillaId && userRbds.includes(resp.rbd)) {
                            const dateToCompare = resp.createdAt || resp.fechaCreacion
                            if (dateToCompare >= cycleStart && dateToCompare <= cycleEnd) {
                                evaluadosRbdSet.add(resp.rbd)
                            }
                        }
                    }
                }

                realizadasCount = evaluadosRbdSet.size
                const totalRequerido = userRbds.length
                const faltantes = Math.max(0, totalRequerido - realizadasCount)
                const porcentaje = totalRequerido > 0 ? Math.round((realizadasCount / totalRequerido) * 100) : 100
                const semaforo = calculateSemaforo(porcentaje, faltantes, item.diasRestantes)

                sumPorcentajes += porcentaje

                evaluacionesColab.push({
                    tipo: item.tipo,
                    plantillaId: item.plantillaId,
                    nombre: item.nombre,
                    periodicidad: item.periodicidad,
                    periodicidadLabel: PERIODICIDAD_LABELS[item.periodicidad] || item.periodicidad,
                    fechaTope: item.deadlineIso,
                    fechaTopeFormatted: item.deadlineFormatted,
                    diasRestantes: item.diasRestantes,
                    totalRequerido,
                    realizadas: realizadasCount,
                    faltantes,
                    porcentaje,
                    semaforo
                })
            }

            // Semáforo global del usuario
            let semaforoGlobal: SemaforoStatus = 'VERDE'
            if (evaluacionesColab.some(e => e.semaforo === 'ROJO')) {
                semaforoGlobal = 'ROJO'
            } else if (evaluacionesColab.some(e => e.semaforo === 'AMARILLO')) {
                semaforoGlobal = 'AMARILLO'
            }

            const porcentajeGlobal = evaluacionesColab.length > 0 
                ? Math.round(sumPorcentajes / evaluacionesColab.length) 
                : 100

            // Desglose por colegio (solo para las pautas que le corresponden al colaborador)
            const colegiosDetalle: DetalleColegioColaborador[] = userRbds.map(rbd => {
                const colInfo = colegiosMap.get(rbd)
                const evalsColegio = itemsParaColaborador.map((item: any) => {
                    let completado = false
                    let fechaRealizacion: string | null = null

                    if (item.tipo === 'MATRIZ') {
                        const found = matrizRespuestas.find(r => 
                            r.cabeceraId === item.plantillaId && 
                            r.rbd === rbd && 
                            (r.createdAt || r.fechaIngreso) >= item.start && 
                            (r.createdAt || r.fechaIngreso) <= item.end
                        )
                        if (found) {
                            completado = true
                            const d = found.createdAt || found.fechaIngreso
                            fechaRealizacion = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
                        }
                    } else {
                        const found = actaRespuestas.find(r => 
                            r.plantillaId === item.plantillaId && 
                            r.rbd === rbd && 
                            (r.createdAt || r.fechaCreacion) >= item.start && 
                            (r.createdAt || r.fechaCreacion) <= item.end
                        )
                        if (found) {
                            completado = true
                            const d = found.createdAt || found.fechaCreacion
                            fechaRealizacion = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
                        }
                    }

                    return {
                        nombrePauta: item.nombre,
                        tipo: item.tipo,
                        completado,
                        fechaRealizacion
                    }
                })

                return {
                    rbd,
                    nombreEstablecimiento: colInfo?.nombre || `Colegio RBD ${rbd}`,
                    comuna: colInfo?.comuna,
                    sucursal: colInfo?.sucursal,
                    evaluaciones: evalsColegio
                }
            })

            const userSucursales = Array.from(new Set(
                colegiosDetalle
                    .map(c => c.sucursal)
                    .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
            )).sort()

            colaboradores.push({
                userId: u.id,
                name: u.name || u.username,
                username: u.username,
                email: u.email,
                roleName: u.role.name,
                rbdsCount: userRbds.length,
                rbds: userRbds,
                semaforoGlobal,
                porcentajeGlobal,
                evaluaciones: evaluacionesColab,
                colegiosDetalle,
                sucursales: userSucursales
            })
        }

        // 8. KPIs Consolidados
        const totalColaboradores = colaboradores.length
        const totalAlDia = colaboradores.filter(c => c.semaforoGlobal === 'VERDE').length
        const totalAtrasoLeve = colaboradores.filter(c => c.semaforoGlobal === 'AMARILLO').length
        const totalAtrasoGrave = colaboradores.filter(c => c.semaforoGlobal === 'ROJO').length
        const cumplimientoGlobalPorcentaje = totalColaboradores > 0 
            ? Math.round(colaboradores.reduce((acc, c) => acc + c.porcentajeGlobal, 0) / totalColaboradores) 
            : 0

        const sucursalesDisponibles = Array.from(new Set(
            colaboradores.flatMap(c => c.sucursales)
        )).sort()

        return {
            success: true,
            isConfigured: true,
            canConfig: Boolean(canConfig),
            mesActual: selectedMes,
            anioActual: selectedAnio,
            mesesDisponibles,
            kpis: {
                totalColaboradores,
                totalAlDia,
                totalAtrasoLeve,
                totalAtrasoGrave,
                cumplimientoGlobalPorcentaje
            },
            colaboradores,
            rolesDisponibles,
            sucursalesDisponibles
        }
    } catch (error: any) {
        console.error('Error al obtener datos de avance de monitoreo:', error)
        return {
            success: false,
            error: error?.message || 'Error al procesar el tablero de monitoreo de avances.',
            isConfigured: false,
            canConfig: false,
            mesActual: mes || 10,
            anioActual: anio || 2026,
            mesesDisponibles: [],
            kpis: { totalColaboradores: 0, totalAlDia: 0, totalAtrasoLeve: 0, totalAtrasoGrave: 0, cumplimientoGlobalPorcentaje: 0 },
            colaboradores: [],
            rolesDisponibles: [],
            sucursalesDisponibles: []
        }
    }
}
