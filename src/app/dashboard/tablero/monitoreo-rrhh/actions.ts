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

export interface SucursalRRHHCardData {
    sucursal: string
    region?: string | null
    comuna?: string | null
    colegiosCount: number
    colaboradoresCount: number
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
    sucursalesAvance: SucursalRRHHCardData[]
    resumenPorTipo: ModuloAvanceDetalle[]
    rolesDisponibles: string[]
    sucursalesDisponibles: string[]
}

function calcularSemaforo(porcentaje: number, total: number): SemaforoStatus {
    if (total === 0 || porcentaje >= 95) return 'VERDE'
    if (porcentaje >= 70) return 'AMARILLO'
    return 'ROJO'
}

function normalizarNombreSucursal(raw?: string | null): string | null {
    if (!raw) return null
    const val = raw.toString().trim().toUpperCase()
    if (!val || val === 'N/A' || val === 'NULL') return null
    if (val.includes('COPIAP')) return 'CD COPIAPO'
    if (val.includes('VALLENAR')) return 'CD VALLENAR'
    if (val.includes('COYHAIQUE')) return 'CD COYHAIQUE'
    if (val.includes('CASA MATRIZ') || val === 'MATRIZ') return 'CASA MATRIZ'
    if (val.includes('METRO')) return 'CD METRO'
    return val
}

function resolverSucursalRegistro(
    rbd: number | null | undefined,
    rowSucursal: string | null | undefined,
    establecimientoTexto: string | null | undefined,
    colegiosMap: Map<number, { nombre: string; comuna?: string; sucursal?: string }>,
    rbdSucursalFallbackMap: Map<number, string>
): string {
    const rbdNum = Number(rbd || 0)
    if (rbdNum > 0) {
        const colSuc = normalizarNombreSucursal(colegiosMap.get(rbdNum)?.sucursal)
        if (colSuc) return colSuc

        const fallbackSuc = normalizarNombreSucursal(rbdSucursalFallbackMap.get(rbdNum))
        if (fallbackSuc) return fallbackSuc
    }

    const directSuc = normalizarNombreSucursal(rowSucursal)
    if (directSuc) return directSuc

    const estSuc = normalizarNombreSucursal(establecimientoTexto)
    if (estSuc && (estSuc.startsWith('CD ') || estSuc === 'CASA MATRIZ')) {
        return estSuc
    }

    return 'SIN SUCURSAL'
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
                sucursalesAvance: [],
                resumenPorTipo: [],
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
                sucursalesAvance: [],
                resumenPorTipo: [],
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
                sucursalesAvance: [],
                resumenPorTipo: [],
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

        // 5. Cargar catálogo de colegios y sucursales oficiales
        const [colegiosDb, sucursalesCatalogoDb] = await Promise.all([
            rawPrisma.colegios.findMany({
                select: { colRBD: true, nombreEstablecimiento: true, comuna: true, sucursal: true }
            }),
            rawPrisma.sucursal.findMany({
                select: { nombre: true, region: true, comuna: true },
                orderBy: { nombre: 'asc' }
            }).catch(() => [] as { nombre: string; region: string | null; comuna: string | null }[])
        ])

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
                SELECT rbd, establecimiento, "grupoOriginal", "criterioId"
                FROM "Pers_Asis_Registro"
                WHERE UPPER(estado) = 'ABIERTO';
            `),
            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT rbd, establecimiento, sucursal, aplica, "aplicaModificadoPor", supervisor
                FROM "Pers_Hextra_Registro"
                WHERE UPPER(estado) = 'ABIERTO';
            `),
            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT tipo, rbd, establecimiento, sucursal, "aplicaDescuento", "aplicaModificadoPor", justificado, supervisor
                FROM "Pers_Atrasos_Registro"
                WHERE UPPER(estado) = 'ABIERTO';
            `)
        ])

        // Mapa auxiliar RBD -> Sucursal desde Horas Extras / Atrasos para RBDs que no tienen sucursal en Colegios
        const rbdSucursalFallbackMap = new Map<number, string>()
        for (const row of rawHorasExtras) {
            const rbdNum = Number(row.rbd || 0)
            const normSuc = normalizarNombreSucursal(row.sucursal)
            if (rbdNum > 0 && normSuc && normSuc !== 'CASA MATRIZ') {
                rbdSucursalFallbackMap.set(rbdNum, normSuc)
            }
        }
        for (const row of rawAtrasosAdelantos) {
            const rbdNum = Number(row.rbd || 0)
            const normSuc = normalizarNombreSucursal(row.sucursal)
            if (rbdNum > 0 && normSuc && normSuc !== 'CASA MATRIZ' && !rbdSucursalFallbackMap.has(rbdNum)) {
                rbdSucursalFallbackMap.set(rbdNum, normSuc)
            }
        }

        // Agrupar registros abiertos por RBD para consultas rápidas O(1) de Colaboradores
        type RbdMetrics = {
            ausentismo: { total: number; gestionados: number; pendientes: number }
            horasExtras: { total: number; gestionados: number; pendientes: number; aplica: number; noAplica: number }
            atrasos: { total: number; gestionados: number; pendientes: number; aplicaDescuento: number; noAplica: number }
            adelantos: { total: number; gestionados: number; pendientes: number; aplicaDescuento: number; noAplica: number }
            establecimiento?: string
            sucursalResuelta?: string
            supervisoresEncontrados: Set<string>
        }

        const metricsByRbd = new Map<number, RbdMetrics>()

        const getOrCreateRbd = (rbd: number, est?: string, suc?: string): RbdMetrics => {
            let m = metricsByRbd.get(rbd)
            if (!m) {
                m = {
                    ausentismo: { total: 0, gestionados: 0, pendientes: 0 },
                    horasExtras: { total: 0, gestionados: 0, pendientes: 0, aplica: 0, noAplica: 0 },
                    atrasos: { total: 0, gestionados: 0, pendientes: 0, aplicaDescuento: 0, noAplica: 0 },
                    adelantos: { total: 0, gestionados: 0, pendientes: 0, aplicaDescuento: 0, noAplica: 0 },
                    establecimiento: est,
                    sucursalResuelta: suc,
                    supervisoresEncontrados: new Set<string>()
                }
                metricsByRbd.set(rbd, m)
            }
            if (!m.establecimiento && est) m.establecimiento = est
            if (!m.sucursalResuelta && suc) m.sucursalResuelta = suc
            return m
        }

        // Agrupador paralelo por Sucursal (para el nuevo Tab de Avance por Sucursal)
        type SucursalAggregator = {
            sucursal: string
            region?: string | null
            comuna?: string | null
            ausentismo: { total: number; gestionados: number; pendientes: number }
            horasExtras: { total: number; gestionados: number; pendientes: number; aplica: number; noAplica: number }
            atrasos: { total: number; gestionados: number; pendientes: number; aplicaDescuento: number; noAplica: number }
            adelantos: { total: number; gestionados: number; pendientes: number; aplicaDescuento: number; noAplica: number }
            establecimientosMap: Map<string, DetalleColegioRRHH>
        }

        const sucursalAggMap = new Map<string, SucursalAggregator>()

        const getOrCreateSucursalAgg = (sucName: string): SucursalAggregator => {
            let agg = sucursalAggMap.get(sucName)
            if (!agg) {
                const catInfo = sucursalesCatalogoDb.find(s => normalizarNombreSucursal(s.nombre) === sucName)
                agg = {
                    sucursal: sucName,
                    region: catInfo?.region || null,
                    comuna: catInfo?.comuna || null,
                    ausentismo: { total: 0, gestionados: 0, pendientes: 0 },
                    horasExtras: { total: 0, gestionados: 0, pendientes: 0, aplica: 0, noAplica: 0 },
                    atrasos: { total: 0, gestionados: 0, pendientes: 0, aplicaDescuento: 0, noAplica: 0 },
                    adelantos: { total: 0, gestionados: 0, pendientes: 0, aplicaDescuento: 0, noAplica: 0 },
                    establecimientosMap: new Map<string, DetalleColegioRRHH>()
                }
                sucursalAggMap.set(sucName, agg)
            }
            return agg
        }

        // Inicializar las sucursales del catálogo oficial (si el usuario no está restringido por RBD)
        if (authorizedViewerRbds === null) {
            for (const s of sucursalesCatalogoDb) {
                const norm = normalizarNombreSucursal(s.nombre)
                if (norm) getOrCreateSucursalAgg(norm)
            }
        }

        const getOrCreateSucursalEstablecimiento = (
            agg: SucursalAggregator,
            rbdNum: number,
            estRaw?: string | null
        ): DetalleColegioRRHH => {
            const key = rbdNum > 0 ? `RBD_${rbdNum}` : `SEDE_${(estRaw || agg.sucursal).trim().toUpperCase()}`
            let item = agg.establecimientosMap.get(key)
            if (!item) {
                const infoCol = rbdNum > 0 ? colegiosMap.get(rbdNum) : undefined
                const nombreEst = infoCol?.nombre || (estRaw && estRaw.trim() !== '' ? estRaw.trim() : agg.sucursal)
                item = {
                    rbd: rbdNum > 0 ? rbdNum : 0,
                    nombreEstablecimiento: nombreEst,
                    comuna: infoCol?.comuna || agg.comuna || undefined,
                    sucursal: agg.sucursal,
                    ausentismo: { total: 0, gestionados: 0, pendientes: 0 },
                    horasExtras: { total: 0, gestionados: 0, pendientes: 0, aplica: 0, noAplica: 0 },
                    atrasos: { total: 0, gestionados: 0, pendientes: 0, aplicaDescuento: 0, noAplica: 0 },
                    adelantos: { total: 0, gestionados: 0, pendientes: 0, aplicaDescuento: 0, noAplica: 0 },
                    totalGeneralAbiertos: 0,
                    totalGeneralGestionados: 0,
                    porcentajeGeneral: 100,
                    semaforo: 'VERDE'
                }
                agg.establecimientosMap.set(key, item)
            }
            return item
        }

        // Procesar Ausentismo Abierto
        for (const row of rawAusentismo) {
            const rbd = Number(row.rbd || 0)
            if (authorizedViewerRbds !== null) {
                if (!rbd || !authorizedViewerRbds.includes(rbd)) continue
            }

            const isGestionado = row.criterioId !== null && row.criterioId !== undefined
            const sucResuelta = resolverSucursalRegistro(
                rbd,
                null,
                row.establecimiento || row.grupoOriginal,
                colegiosMap,
                rbdSucursalFallbackMap
            )

            if (rbd > 0) {
                const m = getOrCreateRbd(rbd, row.establecimiento, sucResuelta)
                m.ausentismo.total++
                if (isGestionado) m.ausentismo.gestionados++
                else m.ausentismo.pendientes++
                if (row.supervisor) m.supervisoresEncontrados.add(String(row.supervisor).toLowerCase().trim())
            }

            // Acumular en Sucursal
            if (sucResuelta !== 'SIN SUCURSAL' || rbd > 0) {
                const sucAgg = getOrCreateSucursalAgg(sucResuelta)
                sucAgg.ausentismo.total++
                if (isGestionado) sucAgg.ausentismo.gestionados++
                else sucAgg.ausentismo.pendientes++

                const estItem = getOrCreateSucursalEstablecimiento(sucAgg, rbd, row.establecimiento || row.grupoOriginal)
                estItem.ausentismo.total++
                if (isGestionado) estItem.ausentismo.gestionados++
                else estItem.ausentismo.pendientes++
            }
        }

        // Procesar Horas Extras Abiertas
        for (const row of rawHorasExtras) {
            const rbd = Number(row.rbd || 0)
            if (authorizedViewerRbds !== null) {
                if (!rbd || !authorizedViewerRbds.includes(rbd)) continue
            }

            const isGestionado = Boolean(row.aplicaModificadoPor)
            const isAplica = row.aplica === true
            const sucResuelta = resolverSucursalRegistro(
                rbd,
                row.sucursal,
                row.establecimiento,
                colegiosMap,
                rbdSucursalFallbackMap
            )

            if (rbd > 0) {
                const m = getOrCreateRbd(rbd, row.establecimiento, sucResuelta)
                m.horasExtras.total++
                if (isGestionado) m.horasExtras.gestionados++
                else m.horasExtras.pendientes++
                if (isAplica) m.horasExtras.aplica++
                else m.horasExtras.noAplica++
                if (row.supervisor) m.supervisoresEncontrados.add(String(row.supervisor).toLowerCase().trim())
            }

            // Acumular en Sucursal
            const sucAgg = getOrCreateSucursalAgg(sucResuelta)
            sucAgg.horasExtras.total++
            if (isGestionado) sucAgg.horasExtras.gestionados++
            else sucAgg.horasExtras.pendientes++
            if (isAplica) sucAgg.horasExtras.aplica++
            else sucAgg.horasExtras.noAplica++

            const estItem = getOrCreateSucursalEstablecimiento(sucAgg, rbd, row.establecimiento)
            estItem.horasExtras.total++
            if (isGestionado) estItem.horasExtras.gestionados++
            else estItem.horasExtras.pendientes++
            if (isAplica) estItem.horasExtras.aplica++
            else estItem.horasExtras.noAplica++
        }

        // Procesar Atrasos y Adelantos Abiertos
        for (const row of rawAtrasosAdelantos) {
            const rbd = Number(row.rbd || 0)
            if (authorizedViewerRbds !== null) {
                if (!rbd || !authorizedViewerRbds.includes(rbd)) continue
            }

            const tipo = row.tipo || 'ADELANTO'
            const isGestionado = Boolean(row.aplicaModificadoPor)
            const isAplicaDesc = Boolean(row.aplicaDescuento)
            const sucResuelta = resolverSucursalRegistro(
                rbd,
                row.sucursal,
                row.establecimiento,
                colegiosMap,
                rbdSucursalFallbackMap
            )

            if (rbd > 0) {
                const m = getOrCreateRbd(rbd, row.establecimiento, sucResuelta)
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

            // Acumular en Sucursal
            const sucAgg = getOrCreateSucursalAgg(sucResuelta)
            const estItem = getOrCreateSucursalEstablecimiento(sucAgg, rbd, row.establecimiento)

            if (tipo === 'ATRASO') {
                sucAgg.atrasos.total++
                if (isGestionado) sucAgg.atrasos.gestionados++
                else sucAgg.atrasos.pendientes++
                if (isAplicaDesc) sucAgg.atrasos.aplicaDescuento++
                else sucAgg.atrasos.noAplica++

                estItem.atrasos.total++
                if (isGestionado) estItem.atrasos.gestionados++
                else estItem.atrasos.pendientes++
                if (isAplicaDesc) estItem.atrasos.aplicaDescuento++
                else estItem.atrasos.noAplica++
            } else {
                sucAgg.adelantos.total++
                if (isGestionado) sucAgg.adelantos.gestionados++
                else sucAgg.adelantos.pendientes++
                if (isAplicaDesc) sucAgg.adelantos.aplicaDescuento++
                else sucAgg.adelantos.noAplica++

                estItem.adelantos.total++
                if (isGestionado) estItem.adelantos.gestionados++
                else estItem.adelantos.pendientes++
                if (isAplicaDesc) estItem.adelantos.aplicaDescuento++
                else estItem.adelantos.noAplica++
            }
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

            // Sucursales del colaborador (tanto directas como derivadas de sus RBDs)
            const userSucursalesSet = new Set<string>()
            ;(u.sucursales || []).forEach(s => {
                const norm = normalizarNombreSucursal(s.nombre) || s.nombre
                if (norm) {
                    userSucursalesSet.add(norm)
                    sucursalesSet.add(norm)
                }
            })

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
                const sucursal = normalizarNombreSucursal(infoCol?.sucursal) || rbdMetrics?.sucursalResuelta || infoCol?.sucursal
                if (sucursal && sucursal !== 'SIN SUCURSAL') {
                    sucursalesSet.add(sucursal)
                    userSucursalesSet.add(sucursal)
                }

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
                sucursales: Array.from(userSucursalesSet),
                semaforoGlobal,
                porcentajeGlobal,
                totalRegistrosAbiertos: totalAbiertos,
                totalGestionados,
                totalPendientes,
                modulos,
                colegiosDetalle
            })
        }

        // 8b. Construir las Tarjetas de Avance por Sucursal (separadas por los 4 tipos: Ausentismo, Horas Extras, Atrasos y Adelantos)
        const sucursalesAvance: SucursalRRHHCardData[] = []
        let globalAusTotal = 0, globalAusGest = 0, globalAusPend = 0
        let globalHheeTotal = 0, globalHheeGest = 0, globalHheePend = 0, globalHheeAplica = 0, globalHheeNoAplica = 0
        let globalAtrTotal = 0, globalAtrGest = 0, globalAtrPend = 0, globalAtrAplica = 0, globalAtrNoAplica = 0
        let globalAdeTotal = 0, globalAdeGest = 0, globalAdePend = 0, globalAdeAplica = 0, globalAdeNoAplica = 0

        for (const agg of sucursalAggMap.values()) {
            const totalAbiertos = agg.ausentismo.total + agg.horasExtras.total + agg.atrasos.total + agg.adelantos.total
            const totalGestionados = agg.ausentismo.gestionados + agg.horasExtras.gestionados + agg.atrasos.gestionados + agg.adelantos.gestionados
            const totalPendientes = agg.ausentismo.pendientes + agg.horasExtras.pendientes + agg.atrasos.pendientes + agg.adelantos.pendientes

            if (agg.sucursal === 'SIN SUCURSAL' && totalAbiertos === 0) continue

            sucursalesSet.add(agg.sucursal)

            globalAusTotal += agg.ausentismo.total
            globalAusGest += agg.ausentismo.gestionados
            globalAusPend += agg.ausentismo.pendientes

            globalHheeTotal += agg.horasExtras.total
            globalHheeGest += agg.horasExtras.gestionados
            globalHheePend += agg.horasExtras.pendientes
            globalHheeAplica += agg.horasExtras.aplica
            globalHheeNoAplica += agg.horasExtras.noAplica

            globalAtrTotal += agg.atrasos.total
            globalAtrGest += agg.atrasos.gestionados
            globalAtrPend += agg.atrasos.pendientes
            globalAtrAplica += agg.atrasos.aplicaDescuento
            globalAtrNoAplica += agg.atrasos.noAplica

            globalAdeTotal += agg.adelantos.total
            globalAdeGest += agg.adelantos.gestionados
            globalAdePend += agg.adelantos.pendientes
            globalAdeAplica += agg.adelantos.aplicaDescuento
            globalAdeNoAplica += agg.adelantos.noAplica

            const pctAus = agg.ausentismo.total > 0 ? Math.round((agg.ausentismo.gestionados / agg.ausentismo.total) * 100) : 100
            const pctHhee = agg.horasExtras.total > 0 ? Math.round((agg.horasExtras.gestionados / agg.horasExtras.total) * 100) : 100
            const pctAtr = agg.atrasos.total > 0 ? Math.round((agg.atrasos.gestionados / agg.atrasos.total) * 100) : 100
            const pctAde = agg.adelantos.total > 0 ? Math.round((agg.adelantos.gestionados / agg.adelantos.total) * 100) : 100

            const modulosSucursal: ModuloAvanceDetalle[] = [
                {
                    nombre: 'Ausentismo',
                    tipo: 'AUSENTISMO',
                    totalAbiertos: agg.ausentismo.total,
                    gestionados: agg.ausentismo.gestionados,
                    pendientes: agg.ausentismo.pendientes,
                    porcentaje: pctAus,
                    semaforo: calcularSemaforo(pctAus, agg.ausentismo.total)
                },
                {
                    nombre: 'Horas Extras',
                    tipo: 'HORAS_EXTRAS',
                    totalAbiertos: agg.horasExtras.total,
                    gestionados: agg.horasExtras.gestionados,
                    pendientes: agg.horasExtras.pendientes,
                    porcentaje: pctHhee,
                    aplicaCount: agg.horasExtras.aplica,
                    noAplicaCount: agg.horasExtras.noAplica,
                    semaforo: calcularSemaforo(pctHhee, agg.horasExtras.total)
                },
                {
                    nombre: 'Atrasos',
                    tipo: 'ATRASOS',
                    totalAbiertos: agg.atrasos.total,
                    gestionados: agg.atrasos.gestionados,
                    pendientes: agg.atrasos.pendientes,
                    porcentaje: pctAtr,
                    aplicaCount: agg.atrasos.aplicaDescuento,
                    noAplicaCount: agg.atrasos.noAplica,
                    semaforo: calcularSemaforo(pctAtr, agg.atrasos.total)
                },
                {
                    nombre: 'Adelantos',
                    tipo: 'ADELANTOS',
                    totalAbiertos: agg.adelantos.total,
                    gestionados: agg.adelantos.gestionados,
                    pendientes: agg.adelantos.pendientes,
                    porcentaje: pctAde,
                    aplicaCount: agg.adelantos.aplicaDescuento,
                    noAplicaCount: agg.adelantos.noAplica,
                    semaforo: calcularSemaforo(pctAde, agg.adelantos.total)
                }
            ]

            // Calcular totales de cada establecimiento dentro de la sucursal
            const colegiosDetalleSucursal = Array.from(agg.establecimientosMap.values()).map(est => {
                const cTotal = est.ausentismo.total + est.horasExtras.total + est.atrasos.total + est.adelantos.total
                const cGest = est.ausentismo.gestionados + est.horasExtras.gestionados + est.atrasos.gestionados + est.adelantos.gestionados
                const cPct = cTotal > 0 ? Math.round((cGest / cTotal) * 100) : 100
                return {
                    ...est,
                    totalGeneralAbiertos: cTotal,
                    totalGeneralGestionados: cGest,
                    porcentajeGeneral: cPct,
                    semaforo: calcularSemaforo(cPct, cTotal)
                }
            }).sort((a, b) => b.totalGeneralAbiertos - a.totalGeneralAbiertos || a.rbd - b.rbd)

            const porcentajeGlobal = totalAbiertos > 0 ? Math.round((totalGestionados / totalAbiertos) * 100) : 100
            const semaforoGlobal = calcularSemaforo(porcentajeGlobal, totalAbiertos)

            const colaboradoresEnSucursal = colaboradores.filter(c =>
                (c.sucursales || []).includes(agg.sucursal)
            ).length

            sucursalesAvance.push({
                sucursal: agg.sucursal,
                region: agg.region,
                comuna: agg.comuna,
                colegiosCount: colegiosDetalleSucursal.length,
                colaboradoresCount: colaboradoresEnSucursal,
                semaforoGlobal,
                porcentajeGlobal,
                totalRegistrosAbiertos: totalAbiertos,
                totalGestionados,
                totalPendientes,
                modulos: modulosSucursal,
                colegiosDetalle: colegiosDetalleSucursal
            })
        }

        // Ordenar sucursales (CD METRO, CD COPIAPO, CD COYHAIQUE, CD VALLENAR, CASA MATRIZ)
        sucursalesAvance.sort((a, b) => b.totalRegistrosAbiertos - a.totalRegistrosAbiertos || a.sucursal.localeCompare(b.sucursal))

        // Resumen global separado por los 4 tipos de documento
        const pctGlobalAus = globalAusTotal > 0 ? Math.round((globalAusGest / globalAusTotal) * 100) : 100
        const pctGlobalHhee = globalHheeTotal > 0 ? Math.round((globalHheeGest / globalHheeTotal) * 100) : 100
        const pctGlobalAtr = globalAtrTotal > 0 ? Math.round((globalAtrGest / globalAtrTotal) * 100) : 100
        const pctGlobalAde = globalAdeTotal > 0 ? Math.round((globalAdeGest / globalAdeTotal) * 100) : 100

        const resumenPorTipo: ModuloAvanceDetalle[] = [
            {
                nombre: 'Ausentismo',
                tipo: 'AUSENTISMO',
                totalAbiertos: globalAusTotal,
                gestionados: globalAusGest,
                pendientes: globalAusPend,
                porcentaje: pctGlobalAus,
                semaforo: calcularSemaforo(pctGlobalAus, globalAusTotal)
            },
            {
                nombre: 'Horas Extras',
                tipo: 'HORAS_EXTRAS',
                totalAbiertos: globalHheeTotal,
                gestionados: globalHheeGest,
                pendientes: globalHheePend,
                porcentaje: pctGlobalHhee,
                aplicaCount: globalHheeAplica,
                noAplicaCount: globalHheeNoAplica,
                semaforo: calcularSemaforo(pctGlobalHhee, globalHheeTotal)
            },
            {
                nombre: 'Atrasos',
                tipo: 'ATRASOS',
                totalAbiertos: globalAtrTotal,
                gestionados: globalAtrGest,
                pendientes: globalAtrPend,
                porcentaje: pctGlobalAtr,
                aplicaCount: globalAtrAplica,
                noAplicaCount: globalAtrNoAplica,
                semaforo: calcularSemaforo(pctGlobalAtr, globalAtrTotal)
            },
            {
                nombre: 'Adelantos',
                tipo: 'ADELANTOS',
                totalAbiertos: globalAdeTotal,
                gestionados: globalAdeGest,
                pendientes: globalAdePend,
                porcentaje: pctGlobalAde,
                aplicaCount: globalAdeAplica,
                noAplicaCount: globalAdeNoAplica,
                semaforo: calcularSemaforo(pctGlobalAde, globalAdeTotal)
            }
        ]

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
            sucursalesAvance,
            resumenPorTipo,
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
            sucursalesAvance: [],
            resumenPorTipo: [],
            rolesDisponibles: [],
            sucursalesDisponibles: []
        }
    }
}
