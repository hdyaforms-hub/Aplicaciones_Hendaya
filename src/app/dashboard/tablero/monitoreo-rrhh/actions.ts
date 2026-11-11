'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { ensureMonitoreoRRHHTables } from '@/lib/monitoreo-rrhh-db-init'
import { decryptPersonalText } from '@/lib/personal-crypto'

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
    hasConfiguredVisualizacion?: boolean
    trabajadoresCount?: number
    tipoAsignacion?: 'TRABAJADORES' | 'COLEGIOS'
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
    comparativaResumen?: ComparativaAbiertosCerradosData
}

export interface MetricaModuloComparativa {
    tipo: 'AUSENTISMO' | 'HORAS_EXTRAS' | 'ATRASOS' | 'ADELANTOS'
    nombre: string
    icono: string
    totalAbiertos: number
    totalCerrados: number
    totalRegistros: number
    porcentajeCerrados: number
    porcentajeAbiertos: number
    modificadosCount: number
}

export interface SucursalComparativaItem {
    sucursal: string
    totalAbiertos: number
    totalCerrados: number
    totalRegistros: number
    porcentajeCerrados: number
    porcentajeAbiertos: number
    ausentismo: { abiertos: number; cerrados: number }
    horasExtras: { abiertos: number; cerrados: number }
    atrasos: { abiertos: number; cerrados: number }
    adelantos: { abiertos: number; cerrados: number }
}

export interface UsuarioModificadorItem {
    usuario: string
    rol?: string
    totalModificaciones: number
    totalCerrados: number
    modulosIntervenidos: string[]
    ultimaModificacion?: string | null
}

export interface RegistroComparativaItem {
    id: string
    modulo: 'AUSENTISMO' | 'HORAS_EXTRAS' | 'ATRASOS' | 'ADELANTOS'
    moduloLabel: string
    estado: 'ABIERTO' | 'CERRADO'
    fecha: string
    rbd: number
    establecimiento: string
    comuna?: string
    sucursal: string
    rut: string
    colaborador: string
    cargo?: string
    gestionDetalle: string
    aplicaOpciones?: string
    usuarioModificador?: string
    usuarioModificadorRol?: string
    cerradoPor?: string
    cerradoAt?: string | null
    updatedAt: string
}

export interface ComparativaFiltros {
    modulo?: 'TODOS' | 'AUSENTISMO' | 'HORAS_EXTRAS' | 'ATRASOS' | 'ADELANTOS'
    estado?: 'TODOS' | 'ABIERTO' | 'CERRADO'
    sucursal?: string
    usuarioModificador?: string
    search?: string
    page?: number
    pageSize?: number
    sortBy?: 'default' | 'estado' | 'modulo' | 'fecha' | 'sucursal' | 'rbd' | 'establecimiento' | 'colaborador' | 'gestionDetalle' | 'usuarioModificador' | 'trazabilidad'
    sortOrder?: 'asc' | 'desc'
}

export interface ArchivoCargaComparativaItem {
    id: string
    modulo: 'AUSENTISMO' | 'HORAS_EXTRAS' | 'ATRASOS' | 'ADELANTOS'
    moduloLabel: string
    nombreArchivo: string
    fechaCarga: string
    cargadoPor: string
    totalRegistros: number
    abiertos: number
    cerrados: number
    porcentajeCerrado: number
    porcentajeAbierto: number
    estadoArchivo: 'ABIERTO' | 'EN_GESTION' | 'CERRADO'
}

export interface ComparativaAbiertosCerradosData {
    kpis: {
        totalGeneral: number
        totalAbiertos: number
        totalCerrados: number
        porcentajeCerradoGlobal: number
        porcentajeAbiertoGlobal: number
        totalArchivosCargados: number
    }
    archivosCargados: ArchivoCargaComparativaItem[]
    modulos: MetricaModuloComparativa[]
    sucursales: SucursalComparativaItem[]
    usuariosModificadores: UsuarioModificadorItem[]
    registros: RegistroComparativaItem[]
    totalRegistros: number
    page: number
    pageSize: number
    totalPages: number
    sucursalesDisponibles: string[]
    usuariosDisponibles: string[]
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
}

function calcularSemaforo(porcentaje: number, total: number): SemaforoStatus {
    if (total === 0 || porcentaje >= 95) return 'VERDE'
    if (porcentaje >= 70) return 'AMARILLO'
    return 'ROJO'
}

export function calcularPorcentajeAvance(gestionados: number, total: number, pendientes?: number): number {
    if (total <= 0) return 100
    const pend = pendientes !== undefined ? pendientes : Math.max(0, total - gestionados)
    if (pend <= 0 || gestionados >= total) return 100
    if (gestionados <= 0) return 0
    const rawPct = Math.round((gestionados / total) * 100)
    // Regla de integridad: Si aún existen registros pendientes (> 0), nunca puede mostrar 100%
    return Math.min(99, rawPct)
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

    // 1. Si tiene RBD (> 0), es un COLEGIO / ESTABLECIMIENTO EDUCACIONAL.
    // Regla de Negocio Hendaya: Casa Matriz NO tiene colegios asociados.
    // Todo RBD > 0 debe pertenecer a su sucursal operativa oficial (CD METRO, CD COPIAPO, CD VALLENAR, CD COYHAIQUE).
    if (rbdNum > 0) {
        const colSuc = normalizarNombreSucursal(colegiosMap.get(rbdNum)?.sucursal)
        if (colSuc && colSuc !== 'CASA MATRIZ') return colSuc

        const fallbackSuc = normalizarNombreSucursal(rbdSucursalFallbackMap.get(rbdNum))
        if (fallbackSuc && fallbackSuc !== 'CASA MATRIZ') return fallbackSuc

        const directSuc = normalizarNombreSucursal(rowSucursal)
        if (directSuc && directSuc !== 'CASA MATRIZ') return directSuc

        const estSuc = normalizarNombreSucursal(establecimientoTexto)
        if (estSuc && estSuc.startsWith('CD ') && estSuc !== 'CASA MATRIZ') return estSuc

        return 'SIN SUCURSAL'
    }

    // 2. Si no tiene RBD de colegio (rbdNum === 0 o null) o es personal de sede central:
    const directSuc = normalizarNombreSucursal(rowSucursal)
    if (directSuc) return directSuc

    const estSuc = normalizarNombreSucursal(establecimientoTexto)
    if (estSuc && (estSuc.startsWith('CD ') || estSuc === 'CASA MATRIZ')) {
        return estSuc
    }

    const estLower = (establecimientoTexto || '').toLowerCase()
    if (estLower.includes('matriz') || estLower.includes('central') || estLower.includes('pudahuel')) {
        return 'CASA MATRIZ'
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

        // 7. Cargar TODOS los registros ABIERTOS de los 4 módulos de RRHH y la Configuración de Visualización de Personal
        // REGLA CLAVE: Solo se consideran registros en estado 'ABIERTO' (las cerradas ya no se consideran)
        const [rawAusentismo, rawHorasExtras, rawAtrasosAdelantos, allVisualizaciones] = await Promise.all([
            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT rbd, establecimiento, "grupoOriginal", "criterioId", "rutHash"
                FROM "Pers_Asis_Registro"
                WHERE UPPER(estado) = 'ABIERTO';
            `),
            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT rbd, establecimiento, sucursal, aplica, "aplicaModificadoPor", supervisor, "identificadorHash"
                FROM "Pers_Hextra_Registro"
                WHERE UPPER(estado) = 'ABIERTO';
            `),
            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT tipo, rbd, establecimiento, sucursal, "aplicaDescuento", "aplicaModificadoPor", "justificadoPor", justificado, supervisor, "identificadorHash"
                FROM "Pers_Atrasos_Registro"
                WHERE UPPER(estado) = 'ABIERTO';
            `),
            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT "tipo", "jefaturaUserId", "jefaturaRoleId", "personalRutHash", "personalRbd", "personalEstablecimiento", "personalSucursal"
                FROM "Pers_Visualizacion_Jefatura";
            `).catch(() => [] as any[])
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
            const isMatriz = agg.sucursal === 'CASA MATRIZ' || (!rbdNum && (estRaw || '').toLowerCase().includes('matriz'))
            const key = rbdNum > 0 ? `RBD_${rbdNum}` : (isMatriz ? 'SEDE_CASA_MATRIZ' : `SEDE_${(estRaw || agg.sucursal).trim().toUpperCase()}`)
            let item = agg.establecimientosMap.get(key)
            if (!item) {
                const infoCol = rbdNum > 0 ? colegiosMap.get(rbdNum) : undefined
                const nombreEst = rbdNum > 0
                    ? (infoCol?.nombre || (estRaw && estRaw.trim() !== '' ? estRaw.trim() : `RBD ${rbdNum}`))
                    : (isMatriz ? 'Casa Matriz' : (estRaw && estRaw.trim() !== '' ? estRaw.trim() : agg.sucursal))
                item = {
                    rbd: rbdNum > 0 ? rbdNum : 0,
                    nombreEstablecimiento: nombreEst,
                    comuna: infoCol?.comuna || (isMatriz ? 'Pudahuel' : (agg.comuna || undefined)),
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
            const sucResuelta = resolverSucursalRegistro(
                rbd,
                null,
                row.establecimiento || row.grupoOriginal,
                colegiosMap,
                rbdSucursalFallbackMap
            )

            if (authorizedViewerRbds !== null) {
                if (rbd > 0 && !authorizedViewerRbds.includes(rbd)) continue
                if (rbd === 0 && sucResuelta !== 'CASA MATRIZ') continue
            }

            const isGestionado = row.criterioId !== null && row.criterioId !== undefined

            if (rbd > 0) {
                const m = getOrCreateRbd(rbd, row.establecimiento, sucResuelta)
                m.ausentismo.total++
                if (isGestionado) m.ausentismo.gestionados++
                else m.ausentismo.pendientes++
                if (row.supervisor) m.supervisoresEncontrados.add(String(row.supervisor).toLowerCase().trim())
            }

            // Acumular en Sucursal
            if (sucResuelta !== 'SIN SUCURSAL') {
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
            const sucResuelta = resolverSucursalRegistro(
                rbd,
                row.sucursal,
                row.establecimiento,
                colegiosMap,
                rbdSucursalFallbackMap
            )

            if (authorizedViewerRbds !== null) {
                if (rbd > 0 && !authorizedViewerRbds.includes(rbd)) continue
                if (rbd === 0 && sucResuelta !== 'CASA MATRIZ') continue
            }

            const isGestionado = Boolean(row.aplicaModificadoPor)
            const isAplica = row.aplica === true

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
            if (sucResuelta !== 'SIN SUCURSAL') {
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
        }

        // Procesar Atrasos y Adelantos Abiertos
        for (const row of rawAtrasosAdelantos) {
            const rbd = Number(row.rbd || 0)
            const sucResuelta = resolverSucursalRegistro(
                rbd,
                row.sucursal,
                row.establecimiento,
                colegiosMap,
                rbdSucursalFallbackMap
            )

            if (authorizedViewerRbds !== null) {
                if (rbd > 0 && !authorizedViewerRbds.includes(rbd)) continue
                if (rbd === 0 && sucResuelta !== 'CASA MATRIZ') continue
            }

            const tipo = row.tipo || 'ADELANTO'
            const isManualGest = Boolean(row.aplicaModificadoPor || row.justificadoPor || row.justificado)
            const isAplicaDesc = Boolean(row.aplicaDescuento)

            if (rbd > 0) {
                const m = getOrCreateRbd(rbd, row.establecimiento, sucResuelta)
                if (tipo === 'ATRASO') {
                    m.atrasos.total++
                    if (isManualGest) m.atrasos.gestionados++
                    else m.atrasos.pendientes++
                    if (isAplicaDesc) m.atrasos.aplicaDescuento++
                    else m.atrasos.noAplica++
                } else {
                    m.adelantos.total++
                    if (isManualGest) m.adelantos.gestionados++
                    else m.adelantos.pendientes++
                    if (isAplicaDesc) m.adelantos.aplicaDescuento++
                    else m.adelantos.noAplica++
                }
                if (row.supervisor) m.supervisoresEncontrados.add(String(row.supervisor).toLowerCase().trim())
            }

            // Acumular en Sucursal
            if (sucResuelta !== 'SIN SUCURSAL') {
                const sucAgg = getOrCreateSucursalAgg(sucResuelta)
                const estItem = getOrCreateSucursalEstablecimiento(sucAgg, rbd, row.establecimiento)

                if (tipo === 'ATRASO') {
                    sucAgg.atrasos.total++
                    if (isManualGest) sucAgg.atrasos.gestionados++
                    else sucAgg.atrasos.pendientes++
                    if (isAplicaDesc) sucAgg.atrasos.aplicaDescuento++
                    else sucAgg.atrasos.noAplica++

                    estItem.atrasos.total++
                    if (isManualGest) estItem.atrasos.gestionados++
                    else estItem.atrasos.pendientes++
                    if (isAplicaDesc) estItem.atrasos.aplicaDescuento++
                    else estItem.atrasos.noAplica++
                } else {
                    sucAgg.adelantos.total++
                    if (isManualGest) sucAgg.adelantos.gestionados++
                    else sucAgg.adelantos.pendientes++
                    if (isAplicaDesc) sucAgg.adelantos.aplicaDescuento++
                    else sucAgg.adelantos.noAplica++

                    estItem.adelantos.total++
                    if (isManualGest) estItem.adelantos.gestionados++
                    else estItem.adelantos.pendientes++
                    if (isAplicaDesc) estItem.adelantos.aplicaDescuento++
                    else estItem.adelantos.noAplica++
                }
            }
        }

        // REGLA ALTERNATIVA 1: Normalización automática de Atrasos y Adelantos por Establecimiento y Sucursal
        for (const m of metricsByRbd.values()) {
            const otrosTot = m.ausentismo.total + m.horasExtras.total
            const otrosPend = m.ausentismo.pendientes + m.horasExtras.pendientes
            const otrosCompletados = otrosTot > 0 && otrosPend === 0

            if (m.atrasos.total > 0 && (m.atrasos.gestionados > 0 || otrosCompletados)) {
                m.atrasos.gestionados = m.atrasos.total
                m.atrasos.pendientes = 0
            }
            if (m.adelantos.total > 0 && (m.adelantos.gestionados > 0 || otrosCompletados)) {
                m.adelantos.gestionados = m.adelantos.total
                m.adelantos.pendientes = 0
            }
        }

        for (const agg of sucursalAggMap.values()) {
            let recomputedAtrGest = 0
            let recomputedAtrPend = 0
            let recomputedAdeGest = 0
            let recomputedAdePend = 0

            for (const estItem of agg.establecimientosMap.values()) {
                const estOtrosTot = estItem.ausentismo.total + estItem.horasExtras.total
                const estOtrosPend = estItem.ausentismo.pendientes + estItem.horasExtras.pendientes
                const estOtrosCompletados = estOtrosTot > 0 && estOtrosPend === 0

                if (estItem.atrasos.total > 0 && (estItem.atrasos.gestionados > 0 || estOtrosCompletados)) {
                    estItem.atrasos.gestionados = estItem.atrasos.total
                    estItem.atrasos.pendientes = 0
                }
                if (estItem.adelantos.total > 0 && (estItem.adelantos.gestionados > 0 || estOtrosCompletados)) {
                    estItem.adelantos.gestionados = estItem.adelantos.total
                    estItem.adelantos.pendientes = 0
                }

                recomputedAtrGest += estItem.atrasos.gestionados
                recomputedAtrPend += estItem.atrasos.pendientes
                recomputedAdeGest += estItem.adelantos.gestionados
                recomputedAdePend += estItem.adelantos.pendientes
            }

            if (agg.establecimientosMap.size > 0) {
                agg.atrasos.gestionados = recomputedAtrGest
                agg.atrasos.pendientes = recomputedAtrPend
                agg.adelantos.gestionados = recomputedAdeGest
                agg.adelantos.pendientes = recomputedAdePend
            }
        }

        // 8. Construir las Cerámicas de Colaboradores
        const colaboradores: ColaboradorRRHHCardData[] = []
        const sucursalesSet = new Set<string>()

        for (const u of usersMonitoreados) {
            // Verificar si el usuario tiene asignación específica en Pers_Visualizacion_Jefatura
            const directVisRows = allVisualizaciones.filter(v => v.tipo === 'USUARIO' && v.jefaturaUserId === u.id)
            const roleVisRows = directVisRows.length === 0 && u.roleId
                ? allVisualizaciones.filter(v => v.tipo === 'ROL' && v.jefaturaRoleId === u.roleId)
                : []
            const userVisRows = directVisRows.length > 0 ? directVisRows : roleVisRows
            const hasConfiguredVisualizacion = userVisRows.length > 0

            if (hasConfiguredVisualizacion) {
                // MODO TRABAJADORES ASIGNADOS (ej. nutricionista)
                const assignedHashesSet = new Set<string>(userVisRows.map(r => r.personalRutHash).filter(Boolean))
                const userSucursalesSet = new Set<string>()
                userVisRows.forEach(r => {
                    const norm = normalizarNombreSucursal(r.personalSucursal)
                    if (norm) {
                        userSucursalesSet.add(norm)
                        sucursalesSet.add(norm)
                    }
                })
                if (userSucursalesSet.size === 0 && u.sucursales) {
                    u.sucursales.forEach(s => {
                        const norm = normalizarNombreSucursal(s.nombre)
                        if (norm) {
                            userSucursalesSet.add(norm)
                            sucursalesSet.add(norm)
                        }
                    })
                }

                // Filtrar los registros abiertos que pertenecen a los trabajadores asignados
                const userAus = rawAusentismo.filter(r => r.rutHash && assignedHashesSet.has(r.rutHash))
                const userHhee = rawHorasExtras.filter(r => r.identificadorHash && assignedHashesSet.has(r.identificadorHash))
                const userAtrAde = rawAtrasosAdelantos.filter(r => r.identificadorHash && assignedHashesSet.has(r.identificadorHash))

                const ausTotal = userAus.length
                const ausGest = userAus.filter(r => r.criterioId !== null && r.criterioId !== undefined).length
                const ausPend = ausTotal - ausGest

                const hheeTotal = userHhee.length
                const hheeGest = userHhee.filter(r => Boolean(r.aplicaModificadoPor)).length
                const hheePend = hheeTotal - hheeGest
                const hheeAplica = userHhee.filter(r => r.aplica === true).length
                const hheeNoAplica = hheeTotal - hheeAplica

                const userAtrasos = userAtrAde.filter(r => r.tipo === 'ATRASO')
                const atrasoTotal = userAtrasos.length
                const atrasoManualGest = userAtrasos.filter(r => Boolean(r.aplicaModificadoPor || r.justificadoPor || r.justificado)).length
                const atrasoAplica = userAtrasos.filter(r => Boolean(r.aplicaDescuento)).length
                const atrasoNoAplica = atrasoTotal - atrasoAplica

                const userAdelantos = userAtrAde.filter(r => r.tipo !== 'ATRASO')
                const adelantoTotal = userAdelantos.length
                const adelantoManualGest = userAdelantos.filter(r => Boolean(r.aplicaModificadoPor || r.justificadoPor || r.justificado)).length
                const adelantoAplica = userAdelantos.filter(r => Boolean(r.aplicaDescuento)).length
                const adelantoNoAplica = adelantoTotal - adelantoAplica

                // REGLA ALTERNATIVA 1: Deducción automática por gestión integral de nómina
                const userOtrosTotal = ausTotal + hheeTotal
                const userOtrosPend = ausPend + hheePend
                const userOtrosCompletados = userOtrosTotal > 0 && userOtrosPend === 0

                // Atrasos: Si justificó excepciones o completó Ausentismo/Horas Extras -> 100%
                const atrResuelto = atrasoManualGest > 0 || (atrasoTotal > 0 && userOtrosCompletados)
                const atrasoGest = atrResuelto ? atrasoTotal : atrasoManualGest
                const atrasoPend = atrasoTotal - atrasoGest

                // Adelantos: Si justificó excepciones o completó Ausentismo/Horas Extras -> 100%
                const adeResuelto = adelantoManualGest > 0 || (adelantoTotal > 0 && userOtrosCompletados)
                const adelantoGest = adeResuelto ? adelantoTotal : adelantoManualGest
                const adelantoPend = adelantoTotal - adelantoGest

                // Agrupar en colegiosDetalle / sedesDetalle por los establecimientos de los trabajadores
                const estTrabajadoresMap = new Map<string, {
                    rbd: number
                    nombreEstablecimiento: string
                    sucursal: string
                    hashes: Set<string>
                }>()

                userVisRows.forEach(vr => {
                    const rbdNum = Number(vr.personalRbd || 0)
                    const key = rbdNum > 0 ? `RBD_${rbdNum}` : `SEDE_${(vr.personalEstablecimiento || 'CASA MATRIZ').trim().toUpperCase()}`
                    let est = estTrabajadoresMap.get(key)
                    if (!est) {
                        est = {
                            rbd: rbdNum,
                            nombreEstablecimiento: vr.personalEstablecimiento || (rbdNum > 0 ? `RBD ${rbdNum}` : 'Casa Matriz'),
                            sucursal: normalizarNombreSucursal(vr.personalSucursal) || 'CASA MATRIZ',
                            hashes: new Set<string>()
                        }
                        estTrabajadoresMap.set(key, est)
                    }
                    if (vr.personalRutHash) est.hashes.add(vr.personalRutHash)
                })

                if (estTrabajadoresMap.size === 0) {
                    const fallbackSuc = Array.from(userSucursalesSet)[0] || 'CASA MATRIZ'
                    estTrabajadoresMap.set('SEDE_MATRIZ', {
                        rbd: 0,
                        nombreEstablecimiento: 'Casa Matriz',
                        sucursal: fallbackSuc,
                        hashes: assignedHashesSet
                    })
                }

                const colegiosDetalle: DetalleColegioRRHH[] = []
                for (const est of estTrabajadoresMap.values()) {
                    const estAus = userAus.filter(r => r.rutHash && est.hashes.has(r.rutHash))
                    const estHhee = userHhee.filter(r => r.identificadorHash && est.hashes.has(r.identificadorHash))
                    const estAtrAde = userAtrAde.filter(r => r.identificadorHash && est.hashes.has(r.identificadorHash))

                    const eAusTot = estAus.length
                    const eAusGest = estAus.filter(r => r.criterioId !== null && r.criterioId !== undefined).length

                    const eHheeTot = estHhee.length
                    const eHheeGest = estHhee.filter(r => Boolean(r.aplicaModificadoPor)).length
                    const eHheeAplica = estHhee.filter(r => r.aplica === true).length
                    const eHheeNoAplica = eHheeTot - eHheeAplica

                    const estOtrosTot = eAusTot + eHheeTot
                    const estOtrosPend = (eAusTot - eAusGest) + (eHheeTot - eHheeGest)
                    const estOtrosCompletados = estOtrosTot > 0 && estOtrosPend === 0

                    const estAtr = estAtrAde.filter(r => r.tipo === 'ATRASO')
                    const eAtrTot = estAtr.length
                    const eAtrManualGest = estAtr.filter(r => Boolean(r.aplicaModificadoPor || r.justificadoPor || r.justificado)).length
                    const eAtrAplica = estAtr.filter(r => Boolean(r.aplicaDescuento)).length
                    const eAtrNoAplica = eAtrTot - eAtrAplica

                    const eAtrResuelto = eAtrManualGest > 0 || (eAtrTot > 0 && (estOtrosCompletados || userOtrosCompletados))
                    const eAtrGest = eAtrResuelto ? eAtrTot : eAtrManualGest

                    const estAde = estAtrAde.filter(r => r.tipo !== 'ATRASO')
                    const eAdeTot = estAde.length
                    const eAdeManualGest = estAde.filter(r => Boolean(r.aplicaModificadoPor || r.justificadoPor || r.justificado)).length
                    const eAdeAplica = estAde.filter(r => Boolean(r.aplicaDescuento)).length
                    const eAdeNoAplica = eAdeTot - eAdeAplica

                    const eAdeResuelto = eAdeManualGest > 0 || (eAdeTot > 0 && (estOtrosCompletados || userOtrosCompletados))
                    const eAdeGest = eAdeResuelto ? eAdeTot : eAdeManualGest

                    const cTotal = eAusTot + eHheeTot + eAtrTot + eAdeTot
                    const cGest = eAusGest + eHheeGest + eAtrGest + eAdeGest
                    const cPend = Math.max(0, cTotal - cGest)
                    const cPct = calcularPorcentajeAvance(cGest, cTotal, cPend)

                    colegiosDetalle.push({
                        rbd: est.rbd,
                        nombreEstablecimiento: est.nombreEstablecimiento,
                        sucursal: est.sucursal,
                        ausentismo: { total: eAusTot, gestionados: eAusGest, pendientes: eAusTot - eAusGest },
                        horasExtras: { total: eHheeTot, gestionados: eHheeGest, pendientes: eHheeTot - eHheeGest, aplica: eHheeAplica, noAplica: eHheeNoAplica },
                        atrasos: { total: eAtrTot, gestionados: eAtrGest, pendientes: eAtrTot - eAtrGest, aplicaDescuento: eAtrAplica, noAplica: eAtrNoAplica },
                        adelantos: { total: eAdeTot, gestionados: eAdeGest, pendientes: eAdeTot - eAdeGest, aplicaDescuento: eAdeAplica, noAplica: eAdeNoAplica },
                        totalGeneralAbiertos: cTotal,
                        totalGeneralGestionados: cGest,
                        porcentajeGeneral: cPct,
                        semaforo: calcularSemaforo(cPct, cTotal)
                    })
                }

                colegiosDetalle.sort((a, b) => b.totalGeneralAbiertos - a.totalGeneralAbiertos || a.rbd - b.rbd)

                const pctAus = calcularPorcentajeAvance(ausGest, ausTotal, ausPend)
                const pctHhee = calcularPorcentajeAvance(hheeGest, hheeTotal, hheePend)
                const pctAtr = calcularPorcentajeAvance(atrasoGest, atrasoTotal, atrasoPend)
                const pctAde = calcularPorcentajeAvance(adelantoGest, adelantoTotal, adelantoPend)

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
                const porcentajeGlobal = calcularPorcentajeAvance(totalGestionados, totalAbiertos, totalPendientes)
                const semaforoGlobal = calcularSemaforo(porcentajeGlobal, totalAbiertos)

                colaboradores.push({
                    userId: u.id,
                    name: u.name || u.username,
                    username: u.username,
                    email: u.email,
                    roleName: u.role?.name || 'Sin Rol',
                    hasConfiguredVisualizacion: true,
                    tipoAsignacion: 'TRABAJADORES',
                    trabajadoresCount: assignedHashesSet.size,
                    rbdsCount: userVisRows.filter(r => r.personalRbd).length,
                    rbds: Array.from(new Set(userVisRows.map(r => Number(r.personalRbd)).filter(r => r > 0))),
                    sucursales: Array.from(userSucursalesSet),
                    semaforoGlobal,
                    porcentajeGlobal,
                    totalRegistrosAbiertos: totalAbiertos,
                    totalGestionados,
                    totalPendientes,
                    modulos,
                    colegiosDetalle
                })
            } else {
                // MODO TRADICIONAL POR COLEGIOS / RBDS (SUPERVISORES)
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
                    const colPend = Math.max(0, colTotal - colGest)
                    const colPct = calcularPorcentajeAvance(colGest, colTotal, colPend)

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

                // REGLA ALTERNATIVA 1: Consolidación y deducción automática por gestión integral de nómina
                const userOtrosTotal = ausTotal + hheeTotal
                const userOtrosPend = ausPend + hheePend
                const userOtrosCompletados = userOtrosTotal > 0 && userOtrosPend === 0

                if (atrasoTotal > 0 && (atrasoGest > 0 || userOtrosCompletados)) {
                    atrasoGest = atrasoTotal
                    atrasoPend = 0
                }
                if (adelantoTotal > 0 && (adelantoGest > 0 || userOtrosCompletados)) {
                    adelantoGest = adelantoTotal
                    adelantoPend = 0
                }

                // Consolidar módulos del colaborador
                const pctAus = calcularPorcentajeAvance(ausGest, ausTotal, ausPend)
                const pctHhee = calcularPorcentajeAvance(hheeGest, hheeTotal, hheePend)
                const pctAtr = calcularPorcentajeAvance(atrasoGest, atrasoTotal, atrasoPend)
                const pctAde = calcularPorcentajeAvance(adelantoGest, adelantoTotal, adelantoPend)

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
                const porcentajeGlobal = calcularPorcentajeAvance(totalGestionados, totalAbiertos, totalPendientes)
                const semaforoGlobal = calcularSemaforo(porcentajeGlobal, totalAbiertos)

                colaboradores.push({
                    userId: u.id,
                    name: u.name || u.username,
                    username: u.username,
                    email: u.email,
                    roleName: u.role?.name || 'Sin Rol',
                    hasConfiguredVisualizacion: false,
                    tipoAsignacion: 'COLEGIOS',
                    trabajadoresCount: 0,
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

            const pctAus = calcularPorcentajeAvance(agg.ausentismo.gestionados, agg.ausentismo.total, agg.ausentismo.pendientes)
            const pctHhee = calcularPorcentajeAvance(agg.horasExtras.gestionados, agg.horasExtras.total, agg.horasExtras.pendientes)
            const pctAtr = calcularPorcentajeAvance(agg.atrasos.gestionados, agg.atrasos.total, agg.atrasos.pendientes)
            const pctAde = calcularPorcentajeAvance(agg.adelantos.gestionados, agg.adelantos.total, agg.adelantos.pendientes)

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
                const cPend = Math.max(0, cTotal - cGest)
                const cPct = calcularPorcentajeAvance(cGest, cTotal, cPend)
                return {
                    ...est,
                    totalGeneralAbiertos: cTotal,
                    totalGeneralGestionados: cGest,
                    porcentajeGeneral: cPct,
                    semaforo: calcularSemaforo(cPct, cTotal)
                }
            }).sort((a, b) => b.totalGeneralAbiertos - a.totalGeneralAbiertos || a.rbd - b.rbd)

            const porcentajeGlobal = calcularPorcentajeAvance(totalGestionados, totalAbiertos, totalPendientes)
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
        const pctGlobalAus = calcularPorcentajeAvance(globalAusGest, globalAusTotal, globalAusPend)
        const pctGlobalHhee = calcularPorcentajeAvance(globalHheeGest, globalHheeTotal, globalHheePend)
        const pctGlobalAtr = calcularPorcentajeAvance(globalAtrGest, globalAtrTotal, globalAtrPend)
        const pctGlobalAde = calcularPorcentajeAvance(globalAdeGest, globalAdeTotal, globalAdePend)

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
        const cumplimientoGlobalPorcentaje = calcularPorcentajeAvance(sumGestionados, sumAbiertos, sumPendientes)

        // 10. Resumen inicial de Comparativa Abiertos vs Cerrados para carga instantánea del Tab (10 registros por defecto)
        let comparativaResumen: ComparativaAbiertosCerradosData | undefined
        try {
            comparativaResumen = await getComparativaAbiertosCerradosData({ page: 1, pageSize: 10 })
        } catch (e) {
            console.error('Error calculando comparativaResumen inicial:', e)
        }

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
            sucursalesDisponibles: Array.from(sucursalesSet).sort(),
            comparativaResumen
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

/**
 * Obtiene métricas comparativas de registros Abiertos vs Cerrados de los 4 módulos de RRHH,
 * desglose por Zona / Sucursal, comportamiento de Usuarios Modificadores, y lista detallada
 * ordenada estrictamente: registros ABIERTOS primero, seguidos de CERRADOS del más reciente al más antiguo.
 */
export async function getComparativaAbiertosCerradosData(filtros?: ComparativaFiltros): Promise<ComparativaAbiertosCerradosData> {
    const session = await getSession()
    if (!session || !session.user) {
        throw new Error('No autorizado')
    }

    await ensureMonitoreoRRHHTables()

    const page = Math.max(1, filtros?.page || 1)
    const pageSize = Math.max(1, Math.min(200, filtros?.pageSize || 10))
    const sortBy = filtros?.sortBy || 'default'
    const sortOrder = filtros?.sortOrder || 'asc'
    const filterModulo = filtros?.modulo || 'TODOS'
    const filterEstado = filtros?.estado || 'TODOS'
    const filterSucursal = filtros?.sucursal && filtros.sucursal !== 'TODAS' ? filtros.sucursal.trim() : null
    const filterUsuario = filtros?.usuarioModificador && filtros.usuarioModificador !== 'TODOS' ? filtros.usuarioModificador.trim() : null
    const search = filtros?.search?.trim().toLowerCase() || ''

    // 1. Obtener colegios, sucursales y usuarios para mapas
    const [colegiosDb, sucursalesDb, usersDb] = await Promise.all([
        rawPrisma.colegios.findMany({
            select: { colRBD: true, nombreEstablecimiento: true, comuna: true, sucursal: true }
        }),
        rawPrisma.sucursal.findMany({
            select: { nombre: true, region: true, comuna: true },
            orderBy: { nombre: 'asc' }
        }),
        rawPrisma.user.findMany({
            select: { id: true, username: true, name: true, role: { select: { name: true } } }
        })
    ])

    const colegiosMap = new Map<number, { nombre: string; comuna?: string; sucursal?: string }>()
    colegiosDb.forEach(c => {
        colegiosMap.set(c.colRBD, {
            nombre: c.nombreEstablecimiento.trim(),
            comuna: c.comuna?.trim(),
            sucursal: normalizarNombreSucursal(c.sucursal) || undefined
        })
    })

    const userRolesMap = new Map<string, string>()
    usersDb.forEach(u => {
        const role = u.role?.name || 'Usuario'
        if (u.username) userRolesMap.set(u.username.toLowerCase().trim(), role)
        if (u.name) userRolesMap.set(u.name.toLowerCase().trim(), role)
    })

    const rbdSucursalFallbackMap = new Map<number, string>()
    colegiosDb.forEach(c => {
        const norm = normalizarNombreSucursal(c.sucursal)
        if (norm && norm !== 'CASA MATRIZ') rbdSucursalFallbackMap.set(c.colRBD, norm)
    })

    // 2. Ejecutar conteos agregados por módulo y estado
    const [asisCounts, hextraCounts, atrasosCounts] = await Promise.all([
        rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT UPPER(COALESCE(estado, 'ABIERTO')) as estado, COUNT(*)::int as count
            FROM "Pers_Asis_Registro"
            GROUP BY UPPER(COALESCE(estado, 'ABIERTO'));
        `),
        rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT UPPER(COALESCE(estado, 'ABIERTO')) as estado, COUNT(*)::int as count
            FROM "Pers_Hextra_Registro"
            GROUP BY UPPER(COALESCE(estado, 'ABIERTO'));
        `),
        rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT tipo, UPPER(COALESCE(estado, 'ABIERTO')) as estado, COUNT(*)::int as count
            FROM "Pers_Atrasos_Registro"
            GROUP BY tipo, UPPER(COALESCE(estado, 'ABIERTO'));
        `)
    ])

    // Modificaciones count
    const [asisModCount, hextraModCount, atrModCount, adeModCount] = await Promise.all([
        rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT COUNT(*)::int as count FROM "Pers_Asis_Registro" 
            WHERE "criterioAsignadoPor" IS NOT NULL OR "actualizadoPor" IS NOT NULL OR "cerradoPor" IS NOT NULL;
        `),
        rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT COUNT(*)::int as count FROM "Pers_Hextra_Registro" 
            WHERE "aplicaModificadoPor" IS NOT NULL OR "cerradoPor" IS NOT NULL;
        `),
        rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT COUNT(*)::int as count FROM "Pers_Atrasos_Registro" 
            WHERE tipo = 'ATRASO' AND ("aplicaModificadoPor" IS NOT NULL OR "justificadoPor" IS NOT NULL OR "cerradoPor" IS NOT NULL);
        `),
        rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT COUNT(*)::int as count FROM "Pers_Atrasos_Registro" 
            WHERE tipo = 'ADELANTO' AND ("aplicaModificadoPor" IS NOT NULL OR "justificadoPor" IS NOT NULL OR "cerradoPor" IS NOT NULL);
        `)
    ])

    // Ausentismo
    const asisAbiertos = asisCounts.find(r => r.estado === 'ABIERTO')?.count || 0
    const asisCerrados = asisCounts.find(r => r.estado === 'CERRADO')?.count || 0
    const asisTotal = asisAbiertos + asisCerrados
    const asisMod = asisModCount[0]?.count || 0

    // Horas Extras
    const hextraAbiertos = hextraCounts.find(r => r.estado === 'ABIERTO')?.count || 0
    const hextraCerrados = hextraCounts.find(r => r.estado === 'CERRADO')?.count || 0
    const hextraTotal = hextraAbiertos + hextraCerrados
    const hextraMod = hextraModCount[0]?.count || 0

    // Atrasos
    const atrAbiertos = atrasosCounts.find(r => r.tipo === 'ATRASO' && r.estado === 'ABIERTO')?.count || 0
    const atrCerrados = atrasosCounts.find(r => r.tipo === 'ATRASO' && r.estado === 'CERRADO')?.count || 0
    const atrTotal = atrAbiertos + atrCerrados
    const atrMod = atrModCount[0]?.count || 0

    // Adelantos
    const adeAbiertos = atrasosCounts.find(r => r.tipo === 'ADELANTO' && r.estado === 'ABIERTO')?.count || 0
    const adeCerrados = atrasosCounts.find(r => r.tipo === 'ADELANTO' && r.estado === 'CERRADO')?.count || 0
    const adeTotal = adeAbiertos + adeCerrados
    const adeMod = adeModCount[0]?.count || 0

    // Total General
    const totalAbiertos = asisAbiertos + hextraAbiertos + atrAbiertos + adeAbiertos
    const totalCerrados = asisCerrados + hextraCerrados + atrCerrados + adeCerrados
    const totalGeneral = totalAbiertos + totalCerrados
    const rawPctCerradoGlobal = totalGeneral > 0 ? Math.round((totalCerrados / totalGeneral) * 100) : 0
    const porcentajeCerradoGlobal = totalAbiertos > 0 ? Math.min(99, rawPctCerradoGlobal) : (totalGeneral > 0 ? 100 : 0)
    const porcentajeAbiertoGlobal = totalGeneral > 0 ? 100 - porcentajeCerradoGlobal : 0

    const calcModuloPctCerrado = (cerrados: number, abiertos: number, total: number) => {
        if (total <= 0) return 0
        if (abiertos <= 0) return 100
        const raw = Math.round((cerrados / total) * 100)
        return Math.min(99, raw)
    }

    const asisPctCerrados = calcModuloPctCerrado(asisCerrados, asisAbiertos, asisTotal)
    const hextraPctCerrados = calcModuloPctCerrado(hextraCerrados, hextraAbiertos, hextraTotal)
    const atrPctCerrados = calcModuloPctCerrado(atrCerrados, atrAbiertos, atrTotal)
    const adePctCerrados = calcModuloPctCerrado(adeCerrados, adeAbiertos, adeTotal)

    // Módulos en orden solicitado: 1. Ausentismo, 2. Horas Extras, 3. Atrasos, 4. Adelantos
    const modulos: MetricaModuloComparativa[] = [
        {
            tipo: 'AUSENTISMO',
            nombre: 'Ausentismo',
            icono: '🏥',
            totalAbiertos: asisAbiertos,
            totalCerrados: asisCerrados,
            totalRegistros: asisTotal,
            porcentajeCerrados: asisPctCerrados,
            porcentajeAbiertos: asisTotal > 0 ? 100 - asisPctCerrados : 0,
            modificadosCount: asisMod
        },
        {
            tipo: 'HORAS_EXTRAS',
            nombre: 'Horas Extras',
            icono: '⏱️',
            totalAbiertos: hextraAbiertos,
            totalCerrados: hextraCerrados,
            totalRegistros: hextraTotal,
            porcentajeCerrados: hextraPctCerrados,
            porcentajeAbiertos: hextraTotal > 0 ? 100 - hextraPctCerrados : 0,
            modificadosCount: hextraMod
        },
        {
            tipo: 'ATRASOS',
            nombre: 'Atrasos',
            icono: '⏳',
            totalAbiertos: atrAbiertos,
            totalCerrados: atrCerrados,
            totalRegistros: atrTotal,
            porcentajeCerrados: atrPctCerrados,
            porcentajeAbiertos: atrTotal > 0 ? 100 - atrPctCerrados : 0,
            modificadosCount: atrMod
        },
        {
            tipo: 'ADELANTOS',
            nombre: 'Adelantos',
            icono: '🚪',
            totalAbiertos: adeAbiertos,
            totalCerrados: adeCerrados,
            totalRegistros: adeTotal,
            porcentajeCerrados: adePctCerrados,
            porcentajeAbiertos: adeTotal > 0 ? 100 - adePctCerrados : 0,
            modificadosCount: adeMod
        }
    ]

    // 2.1 Cargas masivas (archivos físicos y su comportamiento temporal)
    const [rawCargasAsis, rawCargasHextra, rawCargasAtrasos, regCountsAsis, regCountsHextra, regCountsAtrasos] = await Promise.all([
        rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT id, "nombreArchivo", "totalRegistros", "cargadoPor", "fechaCarga", estado, "cerradoPor", "cerradoAt"
            FROM "Pers_Asis_Carga"
            ORDER BY "fechaCarga" DESC;
        `).catch(() => []),
        rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT id, "nombreArchivo", "totalRegistros", "cargadoPor", "fechaCarga"
            FROM "Pers_Hextra_Carga"
            ORDER BY "fechaCarga" DESC;
        `).catch(() => []),
        rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT id, tipo, "nombreArchivo", "totalRegistros", "cargadoPor", "fechaCarga"
            FROM "Pers_Atrasos_Carga"
            ORDER BY "fechaCarga" DESC;
        `).catch(() => []),
        rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT "cargaId", UPPER(COALESCE(estado, 'ABIERTO')) as estado, count(*)::int as count
            FROM "Pers_Asis_Registro"
            WHERE "cargaId" IS NOT NULL
            GROUP BY "cargaId", UPPER(COALESCE(estado, 'ABIERTO'));
        `).catch(() => []),
        rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT "cargaId", UPPER(COALESCE(estado, 'ABIERTO')) as estado, count(*)::int as count
            FROM "Pers_Hextra_Registro"
            WHERE "cargaId" IS NOT NULL
            GROUP BY "cargaId", UPPER(COALESCE(estado, 'ABIERTO'));
        `).catch(() => []),
        rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT "cargaId", UPPER(COALESCE(estado, 'ABIERTO')) as estado, count(*)::int as count
            FROM "Pers_Atrasos_Registro"
            WHERE "cargaId" IS NOT NULL
            GROUP BY "cargaId", UPPER(COALESCE(estado, 'ABIERTO'));
        `).catch(() => [])
    ])

    const cargaStatsMap = new Map<string, { abiertos: number; cerrados: number }>()
    const accumulateCounts = (rows: any[]) => {
        for (const r of rows) {
            if (!r.cargaId) continue
            const cur = cargaStatsMap.get(r.cargaId) || { abiertos: 0, cerrados: 0 }
            if (r.estado === 'CERRADO') {
                cur.cerrados += Number(r.count || 0)
            } else {
                cur.abiertos += Number(r.count || 0)
            }
            cargaStatsMap.set(r.cargaId, cur)
        }
    }
    accumulateCounts(regCountsAsis)
    accumulateCounts(regCountsHextra)
    accumulateCounts(regCountsAtrasos)

    const archivosCargados: ArchivoCargaComparativaItem[] = []

    // 1° Ausentismo
    for (const c of rawCargasAsis) {
        const stats = cargaStatsMap.get(c.id) || { abiertos: 0, cerrados: 0 }
        const total = (stats.abiertos + stats.cerrados) || Number(c.totalRegistros || 0)
        const cerrados = stats.cerrados
        const abiertos = Math.max(0, total - cerrados)
        const rawPctCerrado = total > 0 ? Math.round((cerrados / total) * 100) : (c.estado === 'CERRADO' ? 100 : 0)
        const pctCerrado = abiertos > 0 ? Math.min(99, rawPctCerrado) : rawPctCerrado
        archivosCargados.push({
            id: c.id,
            modulo: 'AUSENTISMO',
            moduloLabel: 'Ausentismo',
            nombreArchivo: c.nombreArchivo || 'Archivo Asistencia',
            fechaCarga: c.fechaCarga ? new Date(c.fechaCarga).toISOString() : new Date().toISOString(),
            cargadoPor: c.cargadoPor || 'Admin',
            totalRegistros: total,
            abiertos,
            cerrados,
            porcentajeCerrado: pctCerrado,
            porcentajeAbierto: 100 - pctCerrado,
            estadoArchivo: pctCerrado === 100 ? 'CERRADO' : cerrados > 0 ? 'EN_GESTION' : 'ABIERTO'
        })
    }

    // 2° Horas Extras
    for (const c of rawCargasHextra) {
        const stats = cargaStatsMap.get(c.id) || { abiertos: 0, cerrados: 0 }
        const total = (stats.abiertos + stats.cerrados) || Number(c.totalRegistros || 0)
        const cerrados = stats.cerrados
        const abiertos = Math.max(0, total - cerrados)
        const rawPctCerrado = total > 0 ? Math.round((cerrados / total) * 100) : 0
        const pctCerrado = abiertos > 0 ? Math.min(99, rawPctCerrado) : rawPctCerrado
        archivosCargados.push({
            id: c.id,
            modulo: 'HORAS_EXTRAS',
            moduloLabel: 'Horas Extras',
            nombreArchivo: c.nombreArchivo || 'Planilla Horas Extras',
            fechaCarga: c.fechaCarga ? new Date(c.fechaCarga).toISOString() : new Date().toISOString(),
            cargadoPor: c.cargadoPor || 'Admin',
            totalRegistros: total,
            abiertos,
            cerrados,
            porcentajeCerrado: pctCerrado,
            porcentajeAbierto: 100 - pctCerrado,
            estadoArchivo: pctCerrado === 100 ? 'CERRADO' : cerrados > 0 ? 'EN_GESTION' : 'ABIERTO'
        })
    }

    // 3° Atrasos y Adelantos
    for (const c of rawCargasAtrasos) {
        const stats = cargaStatsMap.get(c.id) || { abiertos: 0, cerrados: 0 }
        const total = (stats.abiertos + stats.cerrados) || Number(c.totalRegistros || 0)
        const cerrados = stats.cerrados
        const abiertos = Math.max(0, total - cerrados)
        const rawPctCerrado = total > 0 ? Math.round((cerrados / total) * 100) : 0
        const pctCerrado = abiertos > 0 ? Math.min(99, rawPctCerrado) : rawPctCerrado
        const isAdelanto = c.tipo === 'ADELANTO'
        archivosCargados.push({
            id: c.id,
            modulo: isAdelanto ? 'ADELANTOS' : 'ATRASOS',
            moduloLabel: isAdelanto ? 'Adelantos' : 'Atrasos',
            nombreArchivo: c.nombreArchivo || (isAdelanto ? 'Planilla Adelantos' : 'Planilla Atrasos'),
            fechaCarga: c.fechaCarga ? new Date(c.fechaCarga).toISOString() : new Date().toISOString(),
            cargadoPor: c.cargadoPor || 'Admin',
            totalRegistros: total,
            abiertos,
            cerrados,
            porcentajeCerrado: pctCerrado,
            porcentajeAbierto: 100 - pctCerrado,
            estadoArchivo: pctCerrado === 100 ? 'CERRADO' : cerrados > 0 ? 'EN_GESTION' : 'ABIERTO'
        })
    }

    // Línea de tiempo cronológica: archivos más recientes primero
    archivosCargados.sort((a, b) => new Date(b.fechaCarga).getTime() - new Date(a.fechaCarga).getTime())

    // 3. Consultar registros para análisis de Zona, Usuarios y Lista detallada
    const [rawAsisRows, rawHextraRows, rawAtrasosRows] = await Promise.all([
        rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT id, fecha, rbd, establecimiento, "rutEnc", "nombreEnc", "apellidosEnc", cargo,
                   "criterioNombre", "criterioAsignadoPor", "criterioAsignadoAt",
                   "actualizadoPor", "fechaActualizacion", "cerradoPor", "cerradoAt",
                   UPPER(COALESCE(estado, 'ABIERTO')) as estado, "updatedAt"
            FROM "Pers_Asis_Registro";
        `),
        rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT id, fecha, rbd, establecimiento, sucursal, "identificadorEnc", "nombreEnc", "apellidosEnc", cargo,
                   aplica, "aplicaModificadoPor", "aplicaModificadoAt", "aplicaObservacion",
                   hhee, "montoPagar", supervisor, "cerradoPor", "cerradoAt",
                   UPPER(COALESCE(estado, 'ABIERTO')) as estado, "updatedAt"
            FROM "Pers_Hextra_Registro";
        `),
        rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT id, tipo, fecha, rbd, establecimiento, sucursal, "identificadorEnc", "nombreEnc", "apellidosEnc", cargo,
                   "aplicaDescuento", "aplicaModificadoPor", "aplicaModificadoAt",
                   "minutosAtraso", "minutosAdelanto", justificado, "justificadoPor", supervisor,
                   "cerradoPor", "cerradoAt",
                   UPPER(COALESCE(estado, 'ABIERTO')) as estado, "updatedAt"
            FROM "Pers_Atrasos_Registro";
        `)
    ])

    // Mapa de sucursales
    const sucursalesMap = new Map<string, SucursalComparativaItem>()
    const sucursalesOficiales = ['CD METRO', 'CD COPIAPO', 'CD VALLENAR', 'CD COYHAIQUE', 'CASA MATRIZ']
    sucursalesOficiales.forEach(s => {
        sucursalesMap.set(s, {
            sucursal: s,
            totalAbiertos: 0,
            totalCerrados: 0,
            totalRegistros: 0,
            porcentajeCerrados: 0,
            porcentajeAbiertos: 0,
            ausentismo: { abiertos: 0, cerrados: 0 },
            horasExtras: { abiertos: 0, cerrados: 0 },
            atrasos: { abiertos: 0, cerrados: 0 },
            adelantos: { abiertos: 0, cerrados: 0 }
        })
    })

    const getOrCreateSucursalItem = (name: string): SucursalComparativaItem => {
        let it = sucursalesMap.get(name)
        if (!it) {
            it = {
                sucursal: name,
                totalAbiertos: 0,
                totalCerrados: 0,
                totalRegistros: 0,
                porcentajeCerrados: 0,
                porcentajeAbiertos: 0,
                ausentismo: { abiertos: 0, cerrados: 0 },
                horasExtras: { abiertos: 0, cerrados: 0 },
                atrasos: { abiertos: 0, cerrados: 0 },
                adelantos: { abiertos: 0, cerrados: 0 }
            }
            sucursalesMap.set(name, it)
        }
        return it
    }

    // Mapa de usuarios modificadores
    const usuariosMap = new Map<string, {
        usuario: string
        totalModificaciones: number
        totalCerrados: number
        modulosSet: Set<string>
        ultimaModificacion: Date | null
    }>()

    const registerUserAction = (userName: string | null | undefined, isCierre: boolean, modulo: string, actionDate?: any) => {
        if (!userName || !userName.trim()) return
        const u = userName.trim()
        if (u === 'Sistema' || u === 'N/A' || u === 'NULL') return
        let entry = usuariosMap.get(u)
        if (!entry) {
            entry = {
                usuario: u,
                totalModificaciones: 0,
                totalCerrados: 0,
                modulosSet: new Set<string>(),
                ultimaModificacion: null
            }
            usuariosMap.set(u, entry)
        }
        entry.totalModificaciones++
        if (isCierre) entry.totalCerrados++
        entry.modulosSet.add(modulo)
        if (actionDate) {
            const dt = new Date(actionDate)
            if (!isNaN(dt.getTime())) {
                if (!entry.ultimaModificacion || dt > entry.ultimaModificacion) {
                    entry.ultimaModificacion = dt
                }
            }
        }
    }

    // Array unificado de todos los registros normalizados
    const allItems: RegistroComparativaItem[] = []

    // 3.1 Procesar Ausentismo
    for (const row of rawAsisRows) {
        const suc = resolverSucursalRegistro(row.rbd, null, row.establecimiento, colegiosMap, rbdSucursalFallbackMap)
        const sucItem = getOrCreateSucursalItem(suc)
        const isCerrado = row.estado === 'CERRADO'
        if (isCerrado) {
            sucItem.ausentismo.cerrados++
            sucItem.totalCerrados++
        } else {
            sucItem.ausentismo.abiertos++
            sucItem.totalAbiertos++
        }
        sucItem.totalRegistros++

        // Modificadores
        if (row.cerradoPor) registerUserAction(row.cerradoPor, true, 'Ausentismo', row.cerradoAt)
        if (row.criterioAsignadoPor) registerUserAction(row.criterioAsignadoPor, false, 'Ausentismo', row.criterioAsignadoAt)
        if (row.actualizadoPor && row.actualizadoPor !== row.criterioAsignadoPor) {
            registerUserAction(row.actualizadoPor, false, 'Ausentismo', row.fechaActualizacion)
        }

        const usuarioMod = row.cerradoPor || row.actualizadoPor || row.criterioAsignadoPor || null

        // Desencriptar colaborador
        const nom = decryptPersonalText(row.nombreEnc || '')
        const ape = decryptPersonalText(row.apellidosEnc || '')
        const rut = decryptPersonalText(row.rutEnc || '')
        const colabName = `${nom} ${ape}`.trim() || 'Sin Nombre'

        allItems.push({
            id: String(row.id),
            modulo: 'AUSENTISMO',
            moduloLabel: 'Ausentismo',
            estado: isCerrado ? 'CERRADO' : 'ABIERTO',
            fecha: row.fecha || '',
            rbd: Number(row.rbd || 0),
            establecimiento: row.establecimiento?.trim() || colegiosMap.get(Number(row.rbd))?.nombre || 'Sin Establecimiento',
            comuna: colegiosMap.get(Number(row.rbd))?.comuna,
            sucursal: suc,
            rut,
            colaborador: colabName,
            cargo: row.cargo?.trim() || undefined,
            gestionDetalle: row.criterioNombre ? `Criterio: ${row.criterioNombre}` : 'Sin Criterio Asignado',
            usuarioModificador: usuarioMod || undefined,
            usuarioModificadorRol: usuarioMod ? userRolesMap.get(usuarioMod.toLowerCase().trim()) : undefined,
            cerradoPor: row.cerradoPor || undefined,
            cerradoAt: row.cerradoAt ? new Date(row.cerradoAt).toISOString() : null,
            updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString()
        })
    }

    // 3.2 Procesar Horas Extras
    for (const row of rawHextraRows) {
        const suc = resolverSucursalRegistro(row.rbd, row.sucursal, row.establecimiento, colegiosMap, rbdSucursalFallbackMap)
        const sucItem = getOrCreateSucursalItem(suc)
        const isCerrado = row.estado === 'CERRADO'
        if (isCerrado) {
            sucItem.horasExtras.cerrados++
            sucItem.totalCerrados++
        } else {
            sucItem.horasExtras.abiertos++
            sucItem.totalAbiertos++
        }
        sucItem.totalRegistros++

        if (row.cerradoPor) registerUserAction(row.cerradoPor, true, 'Horas Extras', row.cerradoAt)
        if (row.aplicaModificadoPor) registerUserAction(row.aplicaModificadoPor, false, 'Horas Extras', row.aplicaModificadoAt)
        if (row.supervisor && !row.aplicaModificadoPor && !row.cerradoPor) {
            registerUserAction(row.supervisor, false, 'Horas Extras', row.updatedAt)
        }

        const usuarioMod = row.cerradoPor || row.aplicaModificadoPor || row.supervisor || null

        const nom = decryptPersonalText(row.nombreEnc || '')
        const ape = decryptPersonalText(row.apellidosEnc || '')
        const rut = decryptPersonalText(row.identificadorEnc || '')
        const colabName = `${nom} ${ape}`.trim() || 'Sin Nombre'

        const horas = Number(row.hhee || 0)
        const monto = Number(row.montoPagar || 0)
        const detalle = `HHEE: ${horas}h | Aplica: ${row.aplica ? 'SÍ' : 'NO'}${monto > 0 ? ` | $${monto.toLocaleString('es-CL')}` : ''}`

        allItems.push({
            id: String(row.id),
            modulo: 'HORAS_EXTRAS',
            moduloLabel: 'Horas Extras',
            estado: isCerrado ? 'CERRADO' : 'ABIERTO',
            fecha: row.fecha || '',
            rbd: Number(row.rbd || 0),
            establecimiento: row.establecimiento?.trim() || colegiosMap.get(Number(row.rbd))?.nombre || 'Sin Establecimiento',
            comuna: colegiosMap.get(Number(row.rbd))?.comuna,
            sucursal: suc,
            rut,
            colaborador: colabName,
            cargo: row.cargo?.trim() || undefined,
            gestionDetalle: detalle,
            aplicaOpciones: row.aplica ? 'APLICA' : 'NO_APLICA',
            usuarioModificador: usuarioMod || undefined,
            usuarioModificadorRol: usuarioMod ? userRolesMap.get(usuarioMod.toLowerCase().trim()) : undefined,
            cerradoPor: row.cerradoPor || undefined,
            cerradoAt: row.cerradoAt ? new Date(row.cerradoAt).toISOString() : null,
            updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString()
        })
    }

    // 3.3 Procesar Atrasos y Adelantos
    for (const row of rawAtrasosRows) {
        const suc = resolverSucursalRegistro(row.rbd, row.sucursal, row.establecimiento, colegiosMap, rbdSucursalFallbackMap)
        const sucItem = getOrCreateSucursalItem(suc)
        const isCerrado = row.estado === 'CERRADO'
        const isAtraso = row.tipo === 'ATRASO'
        const moduloType = isAtraso ? 'ATRASOS' : 'ADELANTOS'
        const moduloLabel = isAtraso ? 'Atrasos' : 'Adelantos'

        if (isAtraso) {
            if (isCerrado) {
                sucItem.atrasos.cerrados++
                sucItem.totalCerrados++
            } else {
                sucItem.atrasos.abiertos++
                sucItem.totalAbiertos++
            }
        } else {
            if (isCerrado) {
                sucItem.adelantos.cerrados++
                sucItem.totalCerrados++
            } else {
                sucItem.adelantos.abiertos++
                sucItem.totalAbiertos++
            }
        }
        sucItem.totalRegistros++

        if (row.cerradoPor) registerUserAction(row.cerradoPor, true, moduloLabel, row.cerradoAt)
        if (row.aplicaModificadoPor) registerUserAction(row.aplicaModificadoPor, false, moduloLabel, row.aplicaModificadoAt)
        if (row.justificadoPor) registerUserAction(row.justificadoPor, false, moduloLabel, row.updatedAt)
        if (row.supervisor && !row.aplicaModificadoPor && !row.justificadoPor && !row.cerradoPor) {
            registerUserAction(row.supervisor, false, moduloLabel, row.updatedAt)
        }

        const usuarioMod = row.cerradoPor || row.aplicaModificadoPor || row.justificadoPor || row.supervisor || null

        const nom = decryptPersonalText(row.nombreEnc || '')
        const ape = decryptPersonalText(row.apellidosEnc || '')
        const rut = decryptPersonalText(row.identificadorEnc || '')
        const colabName = `${nom} ${ape}`.trim() || 'Sin Nombre'

        const min = isAtraso ? Number(row.minutosAtraso || 0) : Number(row.minutosAdelanto || 0)
        const detalle = `${min} min | Descuento: ${row.aplicaDescuento ? 'SÍ' : 'NO'}${row.justificado ? ` | Justif: ${row.justificado}` : ''}`

        allItems.push({
            id: String(row.id),
            modulo: moduloType,
            moduloLabel,
            estado: isCerrado ? 'CERRADO' : 'ABIERTO',
            fecha: row.fecha || '',
            rbd: Number(row.rbd || 0),
            establecimiento: row.establecimiento?.trim() || colegiosMap.get(Number(row.rbd))?.nombre || 'Sin Establecimiento',
            comuna: colegiosMap.get(Number(row.rbd))?.comuna,
            sucursal: suc,
            rut,
            colaborador: colabName,
            cargo: row.cargo?.trim() || undefined,
            gestionDetalle: detalle,
            aplicaOpciones: row.aplicaDescuento ? 'DESCUENTO_SI' : 'DESCUENTO_NO',
            usuarioModificador: usuarioMod || undefined,
            usuarioModificadorRol: usuarioMod ? userRolesMap.get(usuarioMod.toLowerCase().trim()) : undefined,
            cerradoPor: row.cerradoPor || undefined,
            cerradoAt: row.cerradoAt ? new Date(row.cerradoAt).toISOString() : null,
            updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString()
        })
    }

    // Calcular porcentajes de sucursales
    const sucursales: SucursalComparativaItem[] = Array.from(sucursalesMap.values()).map(s => {
        const rawPctCerrados = s.totalRegistros > 0 ? Math.round((s.totalCerrados / s.totalRegistros) * 100) : 0
        const pctCerrados = s.totalAbiertos > 0 ? Math.min(99, rawPctCerrados) : (s.totalRegistros > 0 ? 100 : 0)
        const pctAbiertos = s.totalRegistros > 0 ? 100 - pctCerrados : 0
        return {
            ...s,
            porcentajeCerrados: pctCerrados,
            porcentajeAbiertos: pctAbiertos
        }
    }).sort((a, b) => b.totalRegistros - a.totalRegistros)

    // Formatear usuarios modificadores
    const usuariosModificadores: UsuarioModificadorItem[] = Array.from(usuariosMap.values()).map(u => ({
        usuario: u.usuario,
        rol: userRolesMap.get(u.usuario.toLowerCase().trim()) || 'Usuario',
        totalModificaciones: u.totalModificaciones,
        totalCerrados: u.totalCerrados,
        modulosIntervenidos: Array.from(u.modulosSet),
        ultimaModificacion: u.ultimaModificacion ? u.ultimaModificacion.toISOString() : null
    })).sort((a, b) => b.totalModificaciones - a.totalModificaciones)

    const usuariosDisponibles = usuariosModificadores.map(u => u.usuario).sort()
    const sucursalesDisponibles = Array.from(new Set(allItems.map(i => i.sucursal))).filter(Boolean).sort()

    // 4. Filtrar registros detallados
    let filtered = allItems

    if (filterModulo !== 'TODOS') {
        filtered = filtered.filter(i => i.modulo === filterModulo)
    }

    if (filterEstado !== 'TODOS') {
        filtered = filtered.filter(i => i.estado === filterEstado)
    }

    if (filterSucursal) {
        filtered = filtered.filter(i => i.sucursal.toLowerCase() === filterSucursal.toLowerCase())
    }

    if (filterUsuario) {
        filtered = filtered.filter(i => i.usuarioModificador?.toLowerCase() === filterUsuario.toLowerCase())
    }

    if (search) {
        filtered = filtered.filter(i =>
            i.colaborador.toLowerCase().includes(search) ||
            i.rut.toLowerCase().includes(search) ||
            String(i.rbd).includes(search) ||
            i.establecimiento.toLowerCase().includes(search) ||
            (i.usuarioModificador && i.usuarioModificador.toLowerCase().includes(search)) ||
            (i.comuna && i.comuna.toLowerCase().includes(search))
        )
    }

    // 5. ORDENAMIENTO (Regla inicial o por columna seleccionada)
    if (sortBy === 'default') {
        // REGLA CLAVE POR DEFECTO: Los registros ABIERTOS primero, seguidos de CERRADOS del más reciente al más antiguo
        filtered.sort((a, b) => {
            // 1. ABIERTO siempre primero
            if (a.estado === 'ABIERTO' && b.estado === 'CERRADO') return -1
            if (a.estado === 'CERRADO' && b.estado === 'ABIERTO') return 1

            // 2. Si ambos son CERRADO: del más reciente cerrado al más antiguo
            if (a.estado === 'CERRADO' && b.estado === 'CERRADO') {
                const timeA = new Date(a.cerradoAt || a.updatedAt).getTime()
                const timeB = new Date(b.cerradoAt || b.updatedAt).getTime()
                return timeB - timeA
            }

            // 3. Si ambos son ABIERTO: del más reciente al más antiguo
            const timeA = new Date(a.updatedAt || a.fecha).getTime()
            const timeB = new Date(b.updatedAt || b.fecha).getTime()
            return timeB - timeA
        })
    } else {
        // Ordenamiento explícito por cabecera de columna (ascendente / descendente)
        filtered.sort((a, b) => {
            let comparison = 0
            switch (sortBy) {
                case 'estado':
                    comparison = (a.estado || '').localeCompare(b.estado || '')
                    break
                case 'modulo':
                    comparison = (a.moduloLabel || a.modulo || '').localeCompare(b.moduloLabel || b.modulo || '')
                    break
                case 'fecha': {
                    const timeA = a.fecha ? new Date(a.fecha).getTime() : 0
                    const timeB = b.fecha ? new Date(b.fecha).getTime() : 0
                    comparison = timeA - timeB
                    break
                }
                case 'sucursal':
                    comparison = (a.sucursal || '').localeCompare(b.sucursal || '')
                    break
                case 'rbd':
                    comparison = (a.rbd || 0) - (b.rbd || 0)
                    break
                case 'establecimiento':
                    comparison = (a.establecimiento || '').localeCompare(b.establecimiento || '')
                    break
                case 'colaborador':
                    comparison = (a.colaborador || '').localeCompare(b.colaborador || '')
                    break
                case 'gestionDetalle':
                    comparison = (a.gestionDetalle || '').localeCompare(b.gestionDetalle || '')
                    break
                case 'usuarioModificador': {
                    const usrA = a.usuarioModificador || a.cerradoPor || ''
                    const usrB = b.usuarioModificador || b.cerradoPor || ''
                    comparison = usrA.localeCompare(usrB)
                    break
                }
                case 'trazabilidad': {
                    const timeA = new Date(a.cerradoAt || a.updatedAt).getTime()
                    const timeB = new Date(b.cerradoAt || b.updatedAt).getTime()
                    comparison = timeA - timeB
                    break
                }
                default:
                    comparison = 0
            }
            return sortOrder === 'desc' ? -comparison : comparison
        })
    }

    const totalRegistros = filtered.length
    const totalPages = Math.ceil(totalRegistros / pageSize) || 1
    const startIndex = (page - 1) * pageSize
    const paginatedRegistros = filtered.slice(startIndex, startIndex + pageSize)

    return {
        kpis: {
            totalGeneral,
            totalAbiertos,
            totalCerrados,
            porcentajeCerradoGlobal,
            porcentajeAbiertoGlobal,
            totalArchivosCargados: archivosCargados.length
        },
        archivosCargados,
        modulos,
        sucursales,
        usuariosModificadores,
        registros: paginatedRegistros,
        totalRegistros,
        page,
        pageSize,
        totalPages,
        sucursalesDisponibles,
        usuariosDisponibles,
        sortBy,
        sortOrder
    }
}
