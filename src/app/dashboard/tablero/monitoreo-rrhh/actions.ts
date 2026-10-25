'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { ensureMonitoreoRRHHTables } from '@/lib/monitoreo-rrhh-db-init'

export type SemaforoStatus = 'VERDE' | 'AMARILLO' | 'ROJO'

export interface ModuloAvanceDetalle {
    nombre: string
    tipo: 'AUSENTISMO' | 'HORAS_EXTRAS' | 'ATRASOS' | 'ADELANTOS'
    totalAbiertos: number
    gestionados: number
    pendientes: number
    porcentaje: number
    aplicaCount?: number
    noAplicaCount?: number
    semaforo: SemaforoStatus
}

export interface DetalleColegioRRHH {
    rbd: number
    nombreEstablecimiento: string
    comuna?: string
    sucursal?: string
    ausentismo: { total: number; gestionados: number; pendientes: number }
    horasExtras: { total: number; gestionados: number; pendientes: number; aplica: number; noAplica: number }
    atrasos: { total: number; gestionados: number; pendientes: number; aplicaDescuento: number; noAplica: number }
    adelantos: { total: number; gestionados: number; pendientes: number; aplicaDescuento: number; noAplica: number }
    totalGeneralAbiertos: number
    totalGeneralGestionados: number
    porcentajeGeneral: number
    semaforo: SemaforoStatus
}

export interface ColaboradorRRHHCardData {
    userId: string
    name: string
    username: string
    email?: string | null
    roleName: string
    rbdsCount: number
    rbds: number[]
    sucursales: string[]
    semaforoGlobal: SemaforoStatus
    porcentajeGlobal: number
    totalRegistrosAbiertos: number
    totalGestionados: number
    totalPendientes: number
    modulos: ModuloAvanceDetalle[]
    colegiosDetalle: DetalleColegioRRHH[]
}

export interface MonitoreoRRHHTableroResponse {
    success: boolean
    error?: string
    isConfigured: boolean
    canConfig: boolean
    kpis: {
        totalColaboradores: number
        totalAlDia: number
        totalAtrasoLeve: number
        totalAtrasoGrave: number
        cumplimientoGlobalPorcentaje: number
        totalRegistrosAbiertos: number
        totalRegistrosGestionados: number
        totalRegistrosPendientes: number
    }
    colaboradores: ColaboradorRRHHCardData[]
    rolesDisponibles: string[]
    sucursalesDisponibles: string[]
}

function calcularSemaforo(porcentaje: number, total: number): SemaforoStatus {
    if (total === 0 || porcentaje >= 95) return 'VERDE'
    if (porcentaje >= 70) return 'AMARILLO'
    return 'ROJO'
}

export async function getMonitoreoRRHHTableroData(): Promise<MonitoreoRRHHTableroResponse> {
    try {
        await ensureMonitoreoRRHHTables()

        const session = await getSession()
        if (!session || !session.user) {
            return {
                success: false,
                error: 'Sesión no válida o expirada.',
                isConfigured: false,
                canConfig: false,
                kpis: { totalColaboradores: 0, totalAlDia: 0, totalAtrasoLeve: 0, totalAtrasoGrave: 0, cumplimientoGlobalPorcentaje: 0, totalRegistrosAbiertos: 0, totalRegistrosGestionados: 0, totalRegistrosPendientes: 0 },
                colaboradores: [],
                rolesDisponibles: [],
                sucursalesDisponibles: []
            }
        }

        const permissions = session.user.role?.permissions || []
        const roleName = session.user.role?.name?.toLowerCase().trim() || ''
        const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin' || roleName.includes('gerencia')
        const canConfig = isAdmin || permissions.includes('manage_mantenedor_monitoreo_rrhh')

        if (!isAdmin && !permissions.includes('view_tablero_monitoreo_rrhh')) {
            return {
                success: false,
                error: 'No tienes permisos para visualizar el Tablero de Monitoreo RRHH.',
                isConfigured: false,
                canConfig: false,
                kpis: { totalColaboradores: 0, totalAlDia: 0, totalAtrasoLeve: 0, totalAtrasoGrave: 0, cumplimientoGlobalPorcentaje: 0, totalRegistrosAbiertos: 0, totalRegistrosGestionados: 0, totalRegistrosPendientes: 0 },
                colaboradores: [],
                rolesDisponibles: [],
                sucursalesDisponibles: []
            }
        }

        // 1. Obtener la configuración de roles monitoreados
        const configRows: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT "rolesAsignados" FROM "monitoreo_rrhh_configuracion" WHERE "id" = 'global' LIMIT 1;
        `)

        let rolesAsignadosIds: string[] = []
        if (configRows && configRows.length > 0 && configRows[0].rolesAsignados) {
            try {
                rolesAsignadosIds = JSON.parse(configRows[0].rolesAsignados)
            } catch {
                rolesAsignadosIds = []
            }
        }

        if (rolesAsignadosIds.length === 0) {
            return {
                success: true,
                isConfigured: false,
                canConfig: Boolean(canConfig),
                kpis: { totalColaboradores: 0, totalAlDia: 0, totalAtrasoLeve: 0, totalAtrasoGrave: 0, cumplimientoGlobalPorcentaje: 0, totalRegistrosAbiertos: 0, totalRegistrosGestionados: 0, totalRegistrosPendientes: 0 },
                colaboradores: [],
                rolesDisponibles: [],
                sucursalesDisponibles: []
            }
        }

        // 2. Obtener los roles seleccionados y usuarios pertenecientes a ellos
        const rolesSeleccionadosDb = await rawPrisma.role.findMany({
            where: { id: { in: rolesAsignadosIds } },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        })
        const rolesDisponibles = rolesSeleccionadosDb.map(r => r.name)

        // 3. Aislamiento por RBD del usuario conectado (Viewer)
        const authorizedViewerRbds = await getUserEffectiveRbds()

        // 4. Obtener usuarios pertenecientes a los roles monitoreados
        const usersMonitoreados = await rawPrisma.user.findMany({
            where: {
                roleId: { in: rolesAsignadosIds },
                isDeleted: false,
                isActive: true
            },
            include: {
                role: true,
                sucursales: true
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
                kpis: { totalColaboradores: 0, totalAlDia: 0, totalAtrasoLeve: 0, totalAtrasoGrave: 0, cumplimientoGlobalPorcentaje: 0, totalRegistrosAbiertos: 0, totalRegistrosGestionados: 0, totalRegistrosPendientes: 0 },
                colaboradores: [],
                rolesDisponibles,
                sucursalesDisponibles: []
            }
        }

        // 5. Cargar catálogo de colegios para nombres, comunas y sucursales
        const colegiosDb = await rawPrisma.colegios.findMany({
            select: { colRBD: true, nombreEstablecimiento: true, comuna: true, sucursal: true }
        })
        const colegiosMap = new Map<number, { nombre: string; comuna?: string; sucursal?: string }>()
        colegiosDb.forEach(c => {
            if (c.colRBD) {
                colegiosMap.set(c.colRBD, {
                    nombre: c.nombreEstablecimiento,
                    comuna: c.comuna || undefined,
                    sucursal: c.sucursal || undefined
                })
            }
        })

        // 6. Cargar asignaciones adicionales desde la tabla Supervisor si aplica
        const supervisoresDb = await rawPrisma.supervisor.findMany({
            include: { rbdsAuditar: true }
        })
        const supervisorRbdsMap = new Map<string, number[]>()
        supervisoresDb.forEach(s => {
            const list = s.rbdsAuditar.map(r => r.rbd)
            if (s.nombre) supervisorRbdsMap.set(s.nombre.toLowerCase().trim(), list)
            if (s.correo) supervisorRbdsMap.set(s.correo.toLowerCase().trim(), list)
        })

        // 7. Cargar TODOS los registros ABIERTOS de los 4 módulos de RRHH
        // REGLA CLAVE: Solo se consideran registros en estado 'ABIERTO' (las cerradas ya no se consideran)
        const [rawAusentismo, rawHorasExtras, rawAtrasosAdelantos] = await Promise.all([
            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT rbd, establecimiento, "criterioId"
                FROM "Pers_Asis_Registro"
                WHERE UPPER(estado) = 'ABIERTO' AND rbd IS NOT NULL;
            `),
            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT rbd, establecimiento, aplica, "aplicaModificadoPor", supervisor
                FROM "Pers_Hextra_Registro"
                WHERE UPPER(estado) = 'ABIERTO' AND rbd IS NOT NULL;
            `),
            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT tipo, rbd, establecimiento, "aplicaDescuento", "aplicaModificadoPor", justificado, supervisor
                FROM "Pers_Atrasos_Registro"
                WHERE UPPER(estado) = 'ABIERTO' AND rbd IS NOT NULL;
            `)
        ])

        // Agrupar registros abiertos por RBD para consultas rápidas O(1)
        type RbdMetrics = {
            ausentismo: { total: number; gestionados: number; pendientes: number }
            horasExtras: { total: number; gestionados: number; pendientes: number; aplica: number; noAplica: number }
            atrasos: { total: number; gestionados: number; pendientes: number; aplicaDescuento: number; noAplica: number }
            adelantos: { total: number; gestionados: number; pendientes: number; aplicaDescuento: number; noAplica: number }
            establecimiento?: string
            supervisoresEncontrados: Set<string>
        }

        const metricsByRbd = new Map<number, RbdMetrics>()

        const getOrCreateRbd = (rbd: number, est?: string): RbdMetrics => {
            let m = metricsByRbd.get(rbd)
            if (!m) {
                m = {
                    ausentismo: { total: 0, gestionados: 0, pendientes: 0 },
                    horasExtras: { total: 0, gestionados: 0, pendientes: 0, aplica: 0, noAplica: 0 },
                    atrasos: { total: 0, gestionados: 0, pendientes: 0, aplicaDescuento: 0, noAplica: 0 },
                    adelantos: { total: 0, gestionados: 0, pendientes: 0, aplicaDescuento: 0, noAplica: 0 },
                    establecimiento: est,
                    supervisoresEncontrados: new Set<string>()
                }
                metricsByRbd.set(rbd, m)
            }
            if (!m.establecimiento && est) m.establecimiento = est
            return m
        }

        // Procesar Ausentismo Abierto
        for (const row of rawAusentismo) {
            const rbd = Number(row.rbd)
            if (!rbd) continue
            const m = getOrCreateRbd(rbd, row.establecimiento)
            m.ausentismo.total++
            if (row.criterioId !== null && row.criterioId !== undefined) {
                m.ausentismo.gestionados++
            } else {
                m.ausentismo.pendientes++
            }
            if (row.supervisor) m.supervisoresEncontrados.add(String(row.supervisor).toLowerCase().trim())
        }

        // Procesar Horas Extras Abiertas
        for (const row of rawHorasExtras) {
            const rbd = Number(row.rbd)
            if (!rbd) continue
            const m = getOrCreateRbd(rbd, row.establecimiento)
            m.horasExtras.total++
            if (row.aplicaModificadoPor) {
                m.horasExtras.gestionados++
            } else {
                m.horasExtras.pendientes++
            }
            if (row.aplica === true) {
                m.horasExtras.aplica++
            } else {
                m.horasExtras.noAplica++
            }
            if (row.supervisor) m.supervisoresEncontrados.add(String(row.supervisor).toLowerCase().trim())
        }

        // Procesar Atrasos y Adelantos Abiertos
        for (const row of rawAtrasosAdelantos) {
            const rbd = Number(row.rbd)
            if (!rbd) continue
            const m = getOrCreateRbd(rbd, row.establecimiento)
            const tipo = row.tipo || 'ADELANTO'
            const isGestionado = Boolean(row.aplicaModificadoPor)
            const isAplicaDesc = Boolean(row.aplicaDescuento)

            if (tipo === 'ATRASO') {
                m.atrasos.total++
                if (isGestionado) m.atrasos.gestionados++
                else m.atrasos.pendientes++
                if (isAplicaDesc) m.atrasos.aplicaDescuento++
                else m.atrasos.noAplica++
            } else {
                m.adelantos.total++
                if (isGestionado) m.adelantos.gestionados++
                else m.adelantos.pendientes++
                if (isAplicaDesc) m.adelantos.aplicaDescuento++
                else m.adelantos.noAplica++
            }
            if (row.supervisor) m.supervisoresEncontrados.add(String(row.supervisor).toLowerCase().trim())
        }

        // 8. Construir las Cerámicas de Colaboradores
        const colaboradores: ColaboradorRRHHCardData[] = []
        const sucursalesSet = new Set<string>()

        for (const u of usersMonitoreados) {
            // Reunir los RBDs del usuario
            const userRbdsSet = new Set<number>()

            // A) Directamente en usuario
            if (Array.isArray(u.rbds)) {
                u.rbds.forEach(r => userRbdsSet.add(Number(r)))
            }

            // B) Por tabla Supervisor vinculada por nombre o correo
            const supByName = u.name ? supervisorRbdsMap.get(u.name.toLowerCase().trim()) : null
            if (supByName) supByName.forEach(r => userRbdsSet.add(r))

            const supByEmail = u.email ? supervisorRbdsMap.get(u.email.toLowerCase().trim()) : null
            if (supByEmail) supByEmail.forEach(r => userRbdsSet.add(r))

            // C) Por coincidencia en campo supervisor de registros
            const uNameLower = u.name ? u.name.toLowerCase().trim() : ''
            const uUserLower = u.username ? u.username.toLowerCase().trim() : ''
            if (uNameLower || uUserLower) {
                metricsByRbd.forEach((data, rbd) => {
                    if (data.supervisoresEncontrados.has(uNameLower) || data.supervisoresEncontrados.has(uUserLower)) {
                        userRbdsSet.add(rbd)
                    }
                })
            }

            // Filtrar por los RBDs autorizados para el usuario conectado (Aislamiento por perfil)
            let finalRbds = Array.from(userRbdsSet)
            if (authorizedViewerRbds !== null) {
                finalRbds = finalRbds.filter(r => authorizedViewerRbds.includes(r))
            }

            // Sucursales del colaborador
            const userSucursales = u.sucursales?.map(s => s.nombre) || []
            userSucursales.forEach(s => sucursalesSet.add(s))

            // Calcular métricas acumuladas por módulo para este usuario
            let ausTotal = 0, ausGest = 0, ausPend = 0
            let hheeTotal = 0, hheeGest = 0, hheePend = 0, hheeAplica = 0, hheeNoAplica = 0
            let atrasoTotal = 0, atrasoGest = 0, atrasoPend = 0, atrasoAplica = 0, atrasoNoAplica = 0
            let adelantoTotal = 0, adelantoGest = 0, adelantoPend = 0, adelantoAplica = 0, adelantoNoAplica = 0

            const colegiosDetalle: DetalleColegioRRHH[] = []

            for (const rbd of finalRbds) {
                const infoCol = colegiosMap.get(rbd)
                const rbdMetrics = metricsByRbd.get(rbd)
                const nombreEst = infoCol?.nombre || rbdMetrics?.establecimiento || `RBD ${rbd}`
                const comuna = infoCol?.comuna
                const sucursal = infoCol?.sucursal
                if (sucursal) sucursalesSet.add(sucursal)

                const aus = rbdMetrics?.ausentismo || { total: 0, gestionados: 0, pendientes: 0 }
                const hhee = rbdMetrics?.horasExtras || { total: 0, gestionados: 0, pendientes: 0, aplica: 0, noAplica: 0 }
                const atr = rbdMetrics?.atrasos || { total: 0, gestionados: 0, pendientes: 0, aplicaDescuento: 0, noAplica: 0 }
                const ade = rbdMetrics?.adelantos || { total: 0, gestionados: 0, pendientes: 0, aplicaDescuento: 0, noAplica: 0 }

                ausTotal += aus.total
                ausGest += aus.gestionados
                ausPend += aus.pendientes

                hheeTotal += hhee.total
                hheeGest += hhee.gestionados
                hheePend += hhee.pendientes
                hheeAplica += hhee.aplica
                hheeNoAplica += hhee.noAplica

                atrasoTotal += atr.total
                atrasoGest += atr.gestionados
                atrasoPend += atr.pendientes
                atrasoAplica += atr.aplicaDescuento
                atrasoNoAplica += atr.noAplica

                adelantoTotal += ade.total
                adelantoGest += ade.gestionados
                adelantoPend += ade.pendientes
                adelantoAplica += ade.aplicaDescuento
                adelantoNoAplica += ade.noAplica

                const colTotal = aus.total + hhee.total + atr.total + ade.total
                const colGest = aus.gestionados + hhee.gestionados + atr.gestionados + ade.gestionados
                const colPct = colTotal > 0 ? Math.round((colGest / colTotal) * 100) : 100

                colegiosDetalle.push({
                    rbd,
                    nombreEstablecimiento: nombreEst,
                    comuna,
                    sucursal,
                    ausentismo: aus,
                    horasExtras: hhee,
                    atrasos: atr,
                    adelantos: ade,
                    totalGeneralAbiertos: colTotal,
                    totalGeneralGestionados: colGest,
                    porcentajeGeneral: colPct,
                    semaforo: calcularSemaforo(colPct, colTotal)
                })
            }

            // Ordenar colegios por RBD
            colegiosDetalle.sort((a, b) => a.rbd - b.rbd)

            // Consolidar módulos del colaborador
            const pctAus = ausTotal > 0 ? Math.round((ausGest / ausTotal) * 100) : 100
            const pctHhee = hheeTotal > 0 ? Math.round((hheeGest / hheeTotal) * 100) : 100
            const pctAtr = atrasoTotal > 0 ? Math.round((atrasoGest / atrasoTotal) * 100) : 100
            const pctAde = adelantoTotal > 0 ? Math.round((adelantoGest / adelantoTotal) * 100) : 100

            const modulos: ModuloAvanceDetalle[] = [
                {
                    nombre: 'Ausentismo',
                    tipo: 'AUSENTISMO',
                    totalAbiertos: ausTotal,
                    gestionados: ausGest,
                    pendientes: ausPend,
                    porcentaje: pctAus,
                    semaforo: calcularSemaforo(pctAus, ausTotal)
                },
                {
                    nombre: 'Horas Extras',
                    tipo: 'HORAS_EXTRAS',
                    totalAbiertos: hheeTotal,
                    gestionados: hheeGest,
                    pendientes: hheePend,
                    porcentaje: pctHhee,
                    aplicaCount: hheeAplica,
                    noAplicaCount: hheeNoAplica,
                    semaforo: calcularSemaforo(pctHhee, hheeTotal)
                },
                {
                    nombre: 'Atrasos',
                    tipo: 'ATRASOS',
                    totalAbiertos: atrasoTotal,
                    gestionados: atrasoGest,
                    pendientes: atrasoPend,
                    porcentaje: pctAtr,
                    aplicaCount: atrasoAplica,
                    noAplicaCount: atrasoNoAplica,
                    semaforo: calcularSemaforo(pctAtr, atrasoTotal)
                },
                {
                    nombre: 'Adelantos',
                    tipo: 'ADELANTOS',
                    totalAbiertos: adelantoTotal,
                    gestionados: adelantoGest,
                    pendientes: adelantoPend,
                    porcentaje: pctAde,
                    aplicaCount: adelantoAplica,
                    noAplicaCount: adelantoNoAplica,
                    semaforo: calcularSemaforo(pctAde, adelantoTotal)
                }
            ]

            const totalAbiertos = ausTotal + hheeTotal + atrasoTotal + adelantoTotal
            const totalGestionados = ausGest + hheeGest + atrasoGest + adelantoGest
            const totalPendientes = ausPend + hheePend + atrasoPend + adelantoPend
            const porcentajeGlobal = totalAbiertos > 0 ? Math.round((totalGestionados / totalAbiertos) * 100) : 100
            const semaforoGlobal = calcularSemaforo(porcentajeGlobal, totalAbiertos)

            colaboradores.push({
                userId: u.id,
                name: u.name || u.username,
                username: u.username,
                email: u.email,
                roleName: u.role?.name || 'Sin Rol',
                rbdsCount: finalRbds.length,
                rbds: finalRbds,
                sucursales: userSucursales,
                semaforoGlobal,
                porcentajeGlobal,
                totalRegistrosAbiertos: totalAbiertos,
                totalGestionados,
                totalPendientes,
                modulos,
                colegiosDetalle
            })
        }

        // 9. KPIs Consolidados del Tablero
        const totalColaboradores = colaboradores.length
        const totalAlDia = colaboradores.filter(c => c.semaforoGlobal === 'VERDE').length
        const totalAtrasoLeve = colaboradores.filter(c => c.semaforoGlobal === 'AMARILLO').length
        const totalAtrasoGrave = colaboradores.filter(c => c.semaforoGlobal === 'ROJO').length

        const sumAbiertos = colaboradores.reduce((acc, c) => acc + c.totalRegistrosAbiertos, 0)
        const sumGestionados = colaboradores.reduce((acc, c) => acc + c.totalGestionados, 0)
        const sumPendientes = colaboradores.reduce((acc, c) => acc + c.totalPendientes, 0)
        const cumplimientoGlobalPorcentaje = sumAbiertos > 0 ? Math.round((sumGestionados / sumAbiertos) * 100) : 100

        return {
            success: true,
            isConfigured: true,
            canConfig: Boolean(canConfig),
            kpis: {
                totalColaboradores,
                totalAlDia,
                totalAtrasoLeve,
                totalAtrasoGrave,
                cumplimientoGlobalPorcentaje,
                totalRegistrosAbiertos: sumAbiertos,
                totalRegistrosGestionados: sumGestionados,
                totalRegistrosPendientes: sumPendientes
            },
            colaboradores,
            rolesDisponibles,
            sucursalesDisponibles: Array.from(sucursalesSet).sort()
        }
    } catch (error: any) {
        console.error('Error al obtener datos del Tablero Monitoreo RRHH:', error)
        return {
            success: false,
            error: error.message || 'Error al cargar datos del tablero de monitoreo RRHH.',
            isConfigured: false,
            canConfig: false,
            kpis: { totalColaboradores: 0, totalAlDia: 0, totalAtrasoLeve: 0, totalAtrasoGrave: 0, cumplimientoGlobalPorcentaje: 0, totalRegistrosAbiertos: 0, totalRegistrosGestionados: 0, totalRegistrosPendientes: 0 },
            colaboradores: [],
            rolesDisponibles: [],
            sucursalesDisponibles: []
        }
    }
}
