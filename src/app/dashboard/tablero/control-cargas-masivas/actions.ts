'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { logAuditAction } from '@/lib/audit'
import { ensurePersonalAsistenciaTables } from '@/lib/personal-db-init'
import { ensurePersonalDotacionTables } from '@/lib/personal-dotacion-db-init'
import { ensurePersonalHextraTables } from '@/lib/personal-hextra-db-init'
import { ensurePersonalAtrasosTables } from '@/lib/personal-atrasos-db-init'
import { ensurePrevIndicadoresTables } from '@/lib/prev-indicadores-db-init'
import { ensureHomologacionPmpaTable } from '@/lib/homologacion-pmpa-db-init'

export type EstadoCarga = 'CARGADO' | 'PARCIAL' | 'PENDIENTE'

export interface ModuloCargaEstado {
    id: string
    nombre: string
    area: 'RRHH' | 'PREVENCION' | 'OPERACIONES'
    descripcion: string
    enlaceCarga: string
    mesActual: {
        anio: number
        mes: number
        periodoLabel: string
        estado: EstadoCarga
        totalRegistros: number
        totalRbds: number
        diasCubiertos?: number
        fechaUltimaCarga?: string | null
        usuarioCarga?: string | null
        archivo?: string | null
        observacion?: string
    }
    proximoMes: {
        anio: number
        mes: number
        periodoLabel: string
        estado: EstadoCarga
        totalRegistros: number
        totalRbds: number
        diasCubiertos?: number
        fechaUltimaCarga?: string | null
        usuarioCarga?: string | null
        archivo?: string | null
        observacion?: string
    }
}

export interface ControlCargasResumen {
    totalModulos: number
    cargadosActual: number
    parcialesActual: number
    pendientesActual: number
    porcentajeActual: number
    cargadosProximo: number
    parcialesProximo: number
    pendientesProximo: number
    porcentajeProximo: number
}

export interface RbdCoverageItem {
    rbd: number
    dv?: string
    nombreEstablecimiento: string
    comuna: string
    sucursal: string
    asignadoRolActual: boolean
    usuariosRolActual: { id: string; name: string; username: string }[]
    otrosRolesAsignados: { rol: string; usuarios: string[] }[]
    totalUsuariosAsignados: number
}

export interface RbdCoverageResponse {
    roles: { id: string; name: string; totalUsuarios: number }[]
    selectedRoleId: string
    selectedRoleName: string
    sucursales: string[]
    selectedSucursal: string
    totalColegios: number
    colegiosAsignados: number
    colegiosPendientes: number
    porcentajeCobertura: number
    rbds: RbdCoverageItem[]
}

export interface ProgramaSinHomologarItem {
    programaPmpa: string
    servicioPmpa: string
    institucion?: string | null
    totalRegistros: number
    totalRbds: number
}

export interface ProgramasSinHomologarResponse {
    totalItems: number
    totalHomologados: number
    totalSinHomologar: number
    porcentajeHomologacion: number
    itemsSinHomologar: ProgramaSinHomologarItem[]
}

export interface ControlCargasDashboardData {
    anioActual: number
    mesActual: number
    mesActualNombre: string
    anioProximo: number
    mesProximo: number
    mesProximoNombre: string
    resumen: ControlCargasResumen
    modulos: ModuloCargaEstado[]
    permisos: {
        isRestrictedByRbd: boolean
        assignedRbdsCount: number | null
        sucursalFiltro?: string
    }
    sucursalesDisponibles: string[]
    fechaConsulta: string
    rbdCoverage?: RbdCoverageResponse
    programasSinHomologar?: ProgramasSinHomologarResponse
}

const MESES_NOMBRES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

/**
 * Obtiene el estado consolidado de todas las cargas masivas del sistema
 * para el mes actual y el próximo mes.
 */
export async function getControlCargasMasivasData(params?: {
    anio?: number
    mes?: number
    sucursal?: string
}): Promise<ControlCargasDashboardData> {
    const session = await getSession()
    if (!session || !session.user) {
        throw new Error('No autorizado. Sesión no iniciada.')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin' || roleName.includes('gerencia')
    const permissions = session.user.role?.permissions || []

    if (!isAdmin && !permissions.includes('view_tablero_control_cargas')) {
        throw new Error('No posees permisos para acceder al Tablero de Control de Cargas Masivas.')
    }

    // Inicializaciones idempotentes de tablas
    await Promise.allSettled([
        ensurePersonalAsistenciaTables(),
        ensurePersonalDotacionTables(),
        ensurePersonalHextraTables(),
        ensurePersonalAtrasosTables(),
        ensurePrevIndicadoresTables()
    ])

    // Filtros de RBD por perfil
    const userEffectiveRbds = await getUserEffectiveRbds()
    const isRestrictedByRbd = userEffectiveRbds !== null
    const assignedRbds = isRestrictedByRbd ? userEffectiveRbds : null

    // Determinación de períodos (Mes actual y próximo mes)
    const hoy = new Date()
    const anioActual = params?.anio || hoy.getFullYear()
    const mesActual = params?.mes || (hoy.getMonth() + 1)

    const mesProximo = mesActual === 12 ? 1 : mesActual + 1
    const anioProximo = mesActual === 12 ? anioActual + 1 : anioActual

    const ymActual = `${anioActual}-${String(mesActual).padStart(2, '0')}`
    const ymProximo = `${anioProximo}-${String(mesProximo).padStart(2, '0')}`

    const mesActualNombre = `${MESES_NOMBRES[mesActual - 1]} ${anioActual}`
    const mesProximoNombre = `${MESES_NOMBRES[mesProximo - 1]} ${anioProximo}`

    // Cláusulas SQL de RBDs según perfil
    const rbdSqlAsis = isRestrictedByRbd && assignedRbds
        ? (assignedRbds.length > 0 ? `AND rbd IN (${assignedRbds.join(',')})` : `AND rbd = -9999`)
        : ''

    const rbdSqlPmpa = isRestrictedByRbd && assignedRbds
        ? (assignedRbds.length > 0 ? `AND rbd IN (${assignedRbds.join(',')})` : `AND rbd = -9999`)
        : ''

    const rbdSqlPae = isRestrictedByRbd && assignedRbds
        ? (assignedRbds.length > 0 ? `AND rbd IN (${assignedRbds.join(',')})` : `AND rbd = -9999`)
        : ''

    // Helper genérico para consultar cada fuente de datos
    const consultarFuente = async (periodoYm: string, anio: number, mes: number) => {
        // 1. Asistencia / Ausentismo
        const pAsis = rawPrisma.$queryRawUnsafe<{ total: number; rbds: number; maxFecha: Date | null; cargadoPor: string | null; archivo: string | null }[]>(`
            SELECT 
                COUNT(*)::int as total,
                COUNT(DISTINCT rbd)::int as rbds,
                MAX("createdAt") as "maxFecha",
                MAX("creadoPor") as "cargadoPor",
                MAX("grupoOriginal") as archivo
            FROM "Pers_Asis_Registro"
            WHERE fecha LIKE '${periodoYm}%' ${rbdSqlAsis};
        `).catch(() => [{ total: 0, rbds: 0, maxFecha: null, cargadoPor: null, archivo: null }])

        // 2. Dotación (Personal)
        const pDota = rawPrisma.$queryRawUnsafe<{ total: number; rbds: number; maxFecha: Date | null; cargadoPor: string | null; archivo: string | null }[]>(`
            SELECT 
                COUNT(*)::int as total,
                COUNT(DISTINCT rbd)::int as rbds,
                MAX("createdAt") as "maxFecha",
                MAX("cargadoPor") as "cargadoPor",
                MAX("nombreArchivo") as archivo
            FROM "Pers_Dota_Registro" r
            LEFT JOIN "Pers_Dota_Carga" c ON r."cargaId" = c.id
            WHERE 1=1 ${rbdSqlAsis};
        `).catch(() => [{ total: 0, rbds: 0, maxFecha: null, cargadoPor: null, archivo: null }])

        // 3. Horas Extras
        const pHextra = rawPrisma.$queryRawUnsafe<{ total: number; rbds: number; maxFecha: Date | null; cargadoPor: string | null; archivo: string | null }[]>(`
            SELECT 
                COUNT(*)::int as total,
                COUNT(DISTINCT rbd)::int as rbds,
                MAX("createdAt") as "maxFecha",
                MAX("cargadoPor") as "cargadoPor",
                MAX("nombreArchivo") as archivo
            FROM "Pers_Hextra_Registro" r
            LEFT JOIN "Pers_Hextra_Carga" c ON r."cargaId" = c.id
            WHERE fecha LIKE '${periodoYm}%' ${rbdSqlAsis};
        `).catch(() => [{ total: 0, rbds: 0, maxFecha: null, cargadoPor: null, archivo: null }])

        // 4. Atrasos y Adelantos
        const pAtrasos = rawPrisma.$queryRawUnsafe<{ total: number; rbds: number; maxFecha: Date | null; cargadoPor: string | null; archivo: string | null }[]>(`
            SELECT 
                COUNT(*)::int as total,
                COUNT(DISTINCT rbd)::int as rbds,
                MAX("createdAt") as "maxFecha",
                MAX("cargadoPor") as "cargadoPor",
                MAX("nombreArchivo") as archivo
            FROM "Pers_Atrasos_Registro" r
            LEFT JOIN "Pers_Atrasos_Carga" c ON r."cargaId" = c.id
            WHERE fecha LIKE '${periodoYm}%' ${rbdSqlAsis};
        `).catch(() => [{ total: 0, rbds: 0, maxFecha: null, cargadoPor: null, archivo: null }])

        // 5. Prevención de Riesgos (Indicadores)
        const pPrev = rawPrisma.$queryRawUnsafe<{ total: number; fileName: string | null; cargadoPor: string | null; createdAt: Date | null }[]>(`
            SELECT 
                COUNT(*)::int as total,
                MAX("fileName") as "fileName",
                MAX("cargadoPor") as "cargadoPor",
                MAX("createdAt") as "createdAt"
            FROM "Prev_IndicadoresCargas"
            WHERE anio = ${anio} AND mes = ${mes};
        `).catch(() => [{ total: 0, fileName: null, cargadoPor: null, createdAt: null }])

        // 6. PMPA (Raciones)
        const pPmpa = rawPrisma.$queryRawUnsafe<{ total: number; rbds: number; maxFecha: Date | null; uploadedBy: string | null }[]>(`
            SELECT 
                COUNT(*)::int as total,
                COUNT(DISTINCT rbd)::int as rbds,
                MAX("createdAt") as "maxFecha",
                MAX("uploadedBy") as "uploadedBy"
            FROM "PMPA"
            WHERE ano = ${anio} AND mes = ${mes} ${rbdSqlPmpa};
        `).catch(() => [{ total: 0, rbds: 0, maxFecha: null, uploadedBy: null }])

        // 7. PAE Online (JUNAEB)
        const pPae = rawPrisma.$queryRawUnsafe<{ total: number; rbds: number; maxFecha: Date | null }[]>(`
            SELECT 
                COUNT(*)::int as total,
                COUNT(DISTINCT rbd)::int as rbds,
                MAX("createdAt") as "maxFecha"
            FROM "PaeOnlineCab"
            WHERE ano = ${anio} AND mes = ${mes} ${rbdSqlPae};
        `).catch(() => [{ total: 0, rbds: 0, maxFecha: null }])

        // 8. Minutas Planificadas
        const pMinutas = rawPrisma.$queryRawUnsafe<{ total: number; dias: number; maxFecha: Date | null }[]>(`
            SELECT 
                COUNT(*)::int as total,
                COUNT(DISTINCT dia)::int as dias,
                MAX("createdAt") as "maxFecha"
            FROM "Minutas"
            WHERE anio = ${anio} AND mes = ${mes};
        `).catch(() => [{ total: 0, dias: 0, maxFecha: null }])

        const [asis, dota, hextra, atrasos, prev, pmpa, pae, minutas] = await Promise.all([
            pAsis, pDota, pHextra, pAtrasos, pPrev, pPmpa, pPae, pMinutas
        ])

        return {
            asis: asis[0] || { total: 0, rbds: 0, maxFecha: null, cargadoPor: null, archivo: null },
            dota: dota[0] || { total: 0, rbds: 0, maxFecha: null, cargadoPor: null, archivo: null },
            hextra: hextra[0] || { total: 0, rbds: 0, maxFecha: null, cargadoPor: null, archivo: null },
            atrasos: atrasos[0] || { total: 0, rbds: 0, maxFecha: null, cargadoPor: null, archivo: null },
            prev: prev[0] || { total: 0, fileName: null, cargadoPor: null, createdAt: null },
            pmpa: pmpa[0] || { total: 0, rbds: 0, maxFecha: null, uploadedBy: null },
            pae: pae[0] || { total: 0, rbds: 0, maxFecha: null },
            minutas: minutas[0] || { total: 0, dias: 0, maxFecha: null }
        }
    }

    const [dataActual, dataProximo] = await Promise.all([
        consultarFuente(ymActual, anioActual, mesActual),
        consultarFuente(ymProximo, anioProximo, mesProximo)
    ])

    // Construcción de la matriz de los 8 módulos masivos
    const construirModulo = (
        id: string,
        nombre: string,
        area: 'RRHH' | 'PREVENCION' | 'OPERACIONES',
        descripcion: string,
        enlaceCarga: string,
        resActual: { total: number; rbds?: number; dias?: number; maxFecha?: Date | null; cargadoPor?: string | null; archivo?: string | null },
        resProximo: { total: number; rbds?: number; dias?: number; maxFecha?: Date | null; cargadoPor?: string | null; archivo?: string | null },
        esquemaUmbral: { minRegistros: number; minDias?: number }
    ): ModuloCargaEstado => {
        // Evaluación Mes Actual
        let estActual: EstadoCarga = 'PENDIENTE'
        if (resActual.total >= esquemaUmbral.minRegistros) {
            estActual = 'CARGADO'
        } else if (resActual.total > 0) {
            estActual = 'PARCIAL'
        }

        // Evaluación Próximo Mes
        let estProximo: EstadoCarga = 'PENDIENTE'
        if (resProximo.total >= esquemaUmbral.minRegistros) {
            estProximo = 'CARGADO'
        } else if (resProximo.total > 0) {
            estProximo = 'PARCIAL'
        }

        return {
            id,
            nombre,
            area,
            descripcion,
            enlaceCarga,
            mesActual: {
                anio: anioActual,
                mes: mesActual,
                periodoLabel: mesActualNombre,
                estado: estActual,
                totalRegistros: resActual.total,
                totalRbds: resActual.rbds || 0,
                diasCubiertos: resActual.dias,
                fechaUltimaCarga: resActual.maxFecha ? new Date(resActual.maxFecha).toISOString() : null,
                usuarioCarga: resActual.cargadoPor || null,
                archivo: resActual.archivo || null,
                observacion: estActual === 'CARGADO'
                    ? `${resActual.total.toLocaleString('es-CL')} registros procesados`
                    : estActual === 'PARCIAL'
                        ? `Carga incompleta (${resActual.total} registros)`
                        : 'Sin registros cargados para el período'
            },
            proximoMes: {
                anio: anioProximo,
                mes: mesProximo,
                periodoLabel: mesProximoNombre,
                estado: estProximo,
                totalRegistros: resProximo.total,
                totalRbds: resProximo.rbds || 0,
                diasCubiertos: resProximo.dias,
                fechaUltimaCarga: resProximo.maxFecha ? new Date(resProximo.maxFecha).toISOString() : null,
                usuarioCarga: resProximo.cargadoPor || null,
                archivo: resProximo.archivo || null,
                observacion: estProximo === 'CARGADO'
                    ? `${resProximo.total.toLocaleString('es-CL')} registros procesados`
                    : estProximo === 'PARCIAL'
                        ? `Carga incompleta (${resProximo.total} registros)`
                        : 'Pendiente de carga anticipada'
            }
        }
    }

    const modulos: ModuloCargaEstado[] = [
        // 1. Ausentismo
        construirModulo(
            'rrhh_ausentismo',
            'Ausentismo / Asistencia Diaria',
            'RRHH',
            'Carga masiva de asistencia y ausentismo desde Geovictoria por colaborador y establecimiento.',
            '/dashboard/areas/personal/carga-masiva',
            { total: dataActual.asis.total, rbds: dataActual.asis.rbds, maxFecha: dataActual.asis.maxFecha, cargadoPor: dataActual.asis.cargadoPor, archivo: dataActual.asis.archivo },
            { total: dataProximo.asis.total, rbds: dataProximo.asis.rbds, maxFecha: dataProximo.asis.maxFecha, cargadoPor: dataProximo.asis.cargadoPor, archivo: dataProximo.asis.archivo },
            { minRegistros: 10 }
        ),
        // 2. Dotación
        construirModulo(
            'rrhh_dotacion',
            'Dotación de Personal',
            'RRHH',
            'Carga masiva oficial de la nómina de manipuladoras y colaboradores asignados a colegios.',
            '/dashboard/areas/personal/carga-masiva',
            { total: dataActual.dota.total, rbds: dataActual.dota.rbds, maxFecha: dataActual.dota.maxFecha, cargadoPor: dataActual.dota.cargadoPor, archivo: dataActual.dota.archivo },
            { total: dataProximo.dota.total, rbds: dataProximo.dota.rbds, maxFecha: dataProximo.dota.maxFecha, cargadoPor: dataProximo.dota.cargadoPor, archivo: dataProximo.dota.archivo },
            { minRegistros: 10 }
        ),
        // 3. Horas Extras
        construirModulo(
            'rrhh_hextra',
            'Horas Extras de Personal',
            'RRHH',
            'Planilla masiva de turnos y horas extras extraordinarias reportadas en el mes.',
            '/dashboard/areas/personal/carga-masiva',
            { total: dataActual.hextra.total, rbds: dataActual.hextra.rbds, maxFecha: dataActual.hextra.maxFecha, cargadoPor: dataActual.hextra.cargadoPor, archivo: dataActual.hextra.archivo },
            { total: dataProximo.hextra.total, rbds: dataProximo.hextra.rbds, maxFecha: dataProximo.hextra.maxFecha, cargadoPor: dataProximo.hextra.cargadoPor, archivo: dataProximo.hextra.archivo },
            { minRegistros: 1 }
        ),
        // 4. Atrasos y Adelantos
        construirModulo(
            'rrhh_atrasos',
            'Atrasos y Adelantos',
            'RRHH',
            'Planilla mensual de marcajes con atraso y salidas anticipadas para aplicación de descuentos.',
            '/dashboard/areas/personal/carga-masiva',
            { total: dataActual.atrasos.total, rbds: dataActual.atrasos.rbds, maxFecha: dataActual.atrasos.maxFecha, cargadoPor: dataActual.atrasos.cargadoPor, archivo: dataActual.atrasos.archivo },
            { total: dataProximo.atrasos.total, rbds: dataProximo.atrasos.rbds, maxFecha: dataProximo.atrasos.maxFecha, cargadoPor: dataProximo.atrasos.cargadoPor, archivo: dataProximo.atrasos.archivo },
            { minRegistros: 1 }
        ),
        // 5. Prevención de Riesgos
        construirModulo(
            'prev_indicadores',
            'Indicadores de Prevención (Panel Oficial)',
            'PREVENCION',
            'Planilla oficial mensual con tasas de accidentabilidad, siniestralidad, gravedad y proyección DS 67.',
            '/dashboard/areas/prevencion-riesgos/carga-masiva',
            { total: dataActual.prev.total, maxFecha: dataActual.prev.createdAt, cargadoPor: dataActual.prev.cargadoPor, archivo: dataActual.prev.fileName },
            { total: dataProximo.prev.total, maxFecha: dataProximo.prev.createdAt, cargadoPor: dataProximo.prev.cargadoPor, archivo: dataProximo.prev.fileName },
            { minRegistros: 1 }
        ),
        // 6. Raciones PMPA
        construirModulo(
            'oper_pmpa',
            'Raciones Programadas PMPA',
            'OPERACIONES',
            'Planificación mensual de raciones autorizadas por licitación, nivel, servicio y establecimiento.',
            '/dashboard/tablero/tendencias-pmpa',
            { total: dataActual.pmpa.total, rbds: dataActual.pmpa.rbds, maxFecha: dataActual.pmpa.maxFecha, cargadoPor: dataActual.pmpa.uploadedBy },
            { total: dataProximo.pmpa.total, rbds: dataProximo.pmpa.rbds, maxFecha: dataProximo.pmpa.maxFecha, cargadoPor: dataProximo.pmpa.uploadedBy },
            { minRegistros: 10 }
        ),
        // 7. PAE Online
        construirModulo(
            'oper_pae',
            'PAE Online (Folios y Certificaciones)',
            'OPERACIONES',
            'Carga de folios oficiales descargados desde el portal PAE Online de JUNAEB.',
            '/dashboard/areas/operaciones/cargar-pae',
            { total: dataActual.pae.total, rbds: dataActual.pae.rbds, maxFecha: dataActual.pae.maxFecha },
            { total: dataProximo.pae.total, rbds: dataProximo.pae.rbds, maxFecha: dataProximo.pae.maxFecha },
            { minRegistros: 1 }
        ),
        // 8. Minutas Planificadas
        construirModulo(
            'oper_minutas',
            'Minutas Diarias Planificadas',
            'OPERACIONES',
            'Configuración mensual de minutas, preparaciones y recetas por cocina, servicio y licitación.',
            '/dashboard/areas/prevencion-riesgos/riesgo-minuta',
            { total: dataActual.minutas.total, dias: dataActual.minutas.dias, maxFecha: dataActual.minutas.maxFecha },
            { total: dataProximo.minutas.total, dias: dataProximo.minutas.dias, maxFecha: dataProximo.minutas.maxFecha },
            { minRegistros: 10, minDias: 15 }
        )
    ]

    // Cálculo del Resumen KPI
    const totalModulos = modulos.length

    const cargadosActual = modulos.filter(m => m.mesActual.estado === 'CARGADO').length
    const parcialesActual = modulos.filter(m => m.mesActual.estado === 'PARCIAL').length
    const pendientesActual = modulos.filter(m => m.mesActual.estado === 'PENDIENTE').length
    const porcentajeActual = Math.round((cargadosActual / totalModulos) * 100)

    const cargadosProximo = modulos.filter(m => m.proximoMes.estado === 'CARGADO').length
    const parcialesProximo = modulos.filter(m => m.proximoMes.estado === 'PARCIAL').length
    const pendientesProximo = modulos.filter(m => m.proximoMes.estado === 'PENDIENTE').length
    const porcentajeProximo = Math.round((cargadosProximo / totalModulos) * 100)

    // Lista de sucursales del sistema para filtros
    const sucursalesDb = await rawPrisma.sucursal.findMany({
        select: { nombre: true },
        orderBy: { nombre: 'asc' }
    }).catch(() => [])

    const sucursalesDisponibles = sucursalesDb.length > 0
        ? sucursalesDb.map(s => s.nombre)
        : ['CD METRO', 'CD COPIAPO', 'CD VALLENAR', 'CD COYHAIQUE']

    // Registrar en auditoría
    try {
        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'VISUALIZAR_TABLERO_CONTROL_CARGAS_MASIVAS',
            modulo: 'Tableros y Avances -> Control de Cargas Masivas',
            detalle: `Consulta del tablero administrativo de cargas masivas para ${mesActualNombre} (Pendientes: ${pendientesActual}) y ${mesProximoNombre} (Pendientes: ${pendientesProximo})`
        })
    } catch (e) {
        console.error('Error registrando auditoría en getControlCargasMasivasData:', e)
    }

    return {
        anioActual,
        mesActual,
        mesActualNombre,
        anioProximo,
        mesProximo,
        mesProximoNombre,
        resumen: {
            totalModulos,
            cargadosActual,
            parcialesActual,
            pendientesActual,
            porcentajeActual,
            cargadosProximo,
            parcialesProximo,
            pendientesProximo,
            porcentajeProximo
        },
        modulos,
        permisos: {
            isRestrictedByRbd,
            assignedRbdsCount: assignedRbds ? assignedRbds.length : null,
            sucursalFiltro: params?.sucursal
        },
        sucursalesDisponibles,
        fechaConsulta: hoy.toISOString(),
        rbdCoverage: await getRbdCoverageData({ sucursal: params?.sucursal }).catch(err => {
            console.error('Error obteniendo rbdCoverage inicial:', err)
            return undefined
        }),
        programasSinHomologar: await getProgramasSinHomologarData().catch(err => {
            console.error('Error obteniendo programasSinHomologar inicial:', err)
            return undefined
        })
    }
}

/**
 * Consulta la cobertura de RBDs (colegios) asignados vs pendientes por rol.
 * Identifica colegios que carecen de usuario asignado para el rol seleccionado (o en general).
 */
export async function getRbdCoverageData(params?: {
    roleId?: string
    sucursal?: string
}): Promise<RbdCoverageResponse> {
    const session = await getSession()
    if (!session || !session.user) {
        throw new Error('No autorizado. Sesión no iniciada.')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin' || roleName.includes('gerencia')
    const permissions = session.user.role?.permissions || []

    if (!isAdmin && !permissions.includes('view_tablero_control_cargas')) {
        throw new Error('No tienes permisos para consultar la cobertura de RBDs.')
    }

    const userEffectiveRbds = await getUserEffectiveRbds()
    const isRestrictedByRbd = userEffectiveRbds !== null

    // 1. Obtener todos los roles disponibles
    const rolesDb = await rawPrisma.role.findMany({
        select: {
            id: true,
            name: true,
            _count: {
                select: {
                    users: {
                        where: { isDeleted: false, isActive: true }
                    }
                }
            }
        },
        orderBy: { name: 'asc' }
    }).catch(() => [])

    const roles = rolesDb.map(r => ({
        id: r.id,
        name: r.name,
        totalUsuarios: r._count?.users || 0
    }))

    const selectedRoleId = params?.roleId || 'TODOS'
    const selectedRoleObj = roles.find(r => r.id === selectedRoleId)
    const selectedRoleName = selectedRoleObj ? selectedRoleObj.name : 'Todos los Roles'

    // 2. Obtener lista de sucursales
    const sucursalesDb = await rawPrisma.sucursal.findMany({
        select: { nombre: true },
        orderBy: { nombre: 'asc' }
    }).catch(() => [])
    const sucursales = sucursalesDb.length > 0
        ? sucursalesDb.map(s => s.nombre)
        : ['CD METRO', 'CD COPIAPO', 'CD VALLENAR', 'CD COYHAIQUE']

    const selectedSucursal = params?.sucursal || 'TODAS'

    // 3. Consultar usuarios activos con sus roles y rbds
    const usersDb = await rawPrisma.user.findMany({
        where: { isDeleted: false, isActive: true },
        select: {
            id: true,
            name: true,
            username: true,
            email: true,
            roleId: true,
            rbds: true,
            role: { select: { id: true, name: true } }
        }
    }).catch(() => [])

    // 4. Consultar supervisores activos y sus RBDs
    const supervisoresDb = await rawPrisma.supervisor.findMany({
        where: { vigente: true },
        select: {
            id: true,
            nombre: true,
            apellido: true,
            correo: true,
            rbdsAuditar: { select: { rbd: true } }
        }
    }).catch(() => [])

    // Mapear supervisores a usuarios si coincide correo o nombre
    const supervisorRbdsByUser = new Map<string, number[]>()
    for (const sup of supervisoresDb) {
        const supRbds = sup.rbdsAuditar.map(r => r.rbd)
        if (supRbds.length === 0) continue

        const matchedUser = usersDb.find(u => 
            (u.email && sup.correo && u.email.trim().toLowerCase() === sup.correo.trim().toLowerCase()) ||
            (u.name && `${sup.nombre} ${sup.apellido}`.toLowerCase().trim() === u.name.toLowerCase().trim())
        )
        if (matchedUser) {
            const existing = supervisorRbdsByUser.get(matchedUser.id) || []
            supervisorRbdsByUser.set(matchedUser.id, Array.from(new Set([...existing, ...supRbds])))
        }
    }

    interface UserAssignEntry {
        id: string
        name: string
        username: string
        roleId: string
        roleName: string
    }
    const rbdUserMap = new Map<number, UserAssignEntry[]>()

    for (const u of usersDb) {
        const userRbdsSet = new Set<number>(u.rbds || [])
        const supRbds = supervisorRbdsByUser.get(u.id)
        if (supRbds) {
            supRbds.forEach(r => userRbdsSet.add(r))
        }

        const roleN = u.role?.name || 'Sin Rol'
        const displayName = u.name || u.username

        for (const rbdNum of Array.from(userRbdsSet)) {
            if (typeof rbdNum !== 'number' || isNaN(rbdNum) || rbdNum <= 0) continue
            const list = rbdUserMap.get(rbdNum) || []
            list.push({
                id: u.id,
                name: displayName,
                username: u.username,
                roleId: u.roleId,
                roleName: roleN
            })
            rbdUserMap.set(rbdNum, list)
        }
    }

    // 5. Obtener colegios base
    const colegiosDb = await rawPrisma.colegios.findMany({
        select: {
            colRBD: true,
            colRBDDV: true,
            nombreEstablecimiento: true,
            comuna: true,
            sucursal: true
        }
    }).catch(() => [])

    // Deduplicar colegios por colRBD
    const colegiosMap = new Map<number, (typeof colegiosDb)[0]>()
    for (const c of colegiosDb) {
        if (!c.colRBD) continue
        if (!colegiosMap.has(c.colRBD)) {
            colegiosMap.set(c.colRBD, c)
        }
    }

    let colegiosList = Array.from(colegiosMap.values())

    // Filtro por RBDs autorizados si el usuario tiene restricción
    if (isRestrictedByRbd && userEffectiveRbds) {
        const allowedSet = new Set(userEffectiveRbds)
        colegiosList = colegiosList.filter(c => allowedSet.has(c.colRBD))
    }

    // Filtro por sucursal
    if (selectedSucursal !== 'TODAS') {
        const normSuc = selectedSucursal.toUpperCase().trim()
        colegiosList = colegiosList.filter(c => c.sucursal && c.sucursal.toUpperCase().trim().includes(normSuc))
    }

    // 6. Evaluar cobertura para cada colegio
    const rbdItems: RbdCoverageItem[] = []
    let colegiosAsignados = 0

    for (const col of colegiosList) {
        const assignedUsers = rbdUserMap.get(col.colRBD) || []
        
        let asignadoRolActual = false
        let usuariosRolActual: { id: string; name: string; username: string }[] = []
        
        if (selectedRoleId === 'TODOS') {
            asignadoRolActual = assignedUsers.length > 0
            usuariosRolActual = assignedUsers.map(u => ({ id: u.id, name: u.name, username: u.username }))
        } else {
            const matchesRole = assignedUsers.filter(u => u.roleId === selectedRoleId)
            asignadoRolActual = matchesRole.length > 0
            usuariosRolActual = matchesRole.map(u => ({ id: u.id, name: u.name, username: u.username }))
        }

        if (asignadoRolActual) {
            colegiosAsignados++
        }

        // Mapear otros roles asignados
        const otherRolesMap = new Map<string, string[]>()
        for (const u of assignedUsers) {
            if (selectedRoleId !== 'TODOS' && u.roleId === selectedRoleId) continue
            const existingUsers = otherRolesMap.get(u.roleName) || []
            existingUsers.push(u.name)
            otherRolesMap.set(u.roleName, existingUsers)
        }

        const otrosRolesAsignados = Array.from(otherRolesMap.entries()).map(([rol, usuarios]) => ({
            rol,
            usuarios: Array.from(new Set(usuarios))
        }))

        rbdItems.push({
            rbd: col.colRBD,
            dv: col.colRBDDV || '',
            nombreEstablecimiento: col.nombreEstablecimiento || 'Sin Nombre',
            comuna: col.comuna || 'Sin Comuna',
            sucursal: col.sucursal || 'Sin Sucursal',
            asignadoRolActual,
            usuariosRolActual,
            otrosRolesAsignados,
            totalUsuariosAsignados: assignedUsers.length
        })
    }

    const totalColegios = colegiosList.length
    const colegiosPendientes = totalColegios - colegiosAsignados
    const porcentajeCobertura = totalColegios > 0 ? Math.round((colegiosAsignados / totalColegios) * 100) : 0

    // Ordenar: primero los NO asignados, luego por RBD asc
    rbdItems.sort((a, b) => {
        if (a.asignadoRolActual !== b.asignadoRolActual) {
            return a.asignadoRolActual ? 1 : -1
        }
        return a.rbd - b.rbd
    })

    return {
        roles,
        selectedRoleId,
        selectedRoleName,
        sucursales,
        selectedSucursal,
        totalColegios,
        colegiosAsignados,
        colegiosPendientes,
        porcentajeCobertura,
        rbds: rbdItems
    }
}

/**
 * Consulta programas y servicios existentes en PMPA que aún no tienen código homologado
 */
export async function getProgramasSinHomologarData(): Promise<ProgramasSinHomologarResponse> {
    try {
        await ensureHomologacionPmpaTable()

        // 1. Obtener todas las combinaciones de programas y servicios en PMPA
        const pmpaRows: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT 
                TRIM(COALESCE(programa, '')) as programa,
                TRIM(COALESCE(servicio, '')) as servicio,
                MAX(institucion) as institucion,
                COUNT(*)::bigint as total_reg,
                COUNT(DISTINCT rbd)::bigint as total_rbd
            FROM "PMPA"
            WHERE programa IS NOT NULL AND TRIM(programa) <> ''
            GROUP BY TRIM(COALESCE(programa, '')), TRIM(COALESCE(servicio, ''))
            ORDER BY programa ASC, servicio ASC;
        `)

        // 2. Homologaciones existentes con código asignado
        const homologaciones: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT "programaPmpa", "servicioPmpa", "codigoHomologado"
            FROM "PMPA_Homologacion_Programas"
            WHERE "codigoHomologado" IS NOT NULL AND TRIM("codigoHomologado") <> '';
        `)

        const homologadosSet = new Set(
            homologaciones.map(h => `${(h.programaPmpa || '').trim().toUpperCase()}:::${(h.servicioPmpa || '').trim().toUpperCase()}`)
        )

        const itemsSinHomologar: ProgramaSinHomologarItem[] = []
        let totalHomologados = 0

        for (const r of pmpaRows) {
            const prog = (r.programa || '').trim()
            const serv = (r.servicio || '').trim()
            const key = `${prog.toUpperCase()}:::${serv.toUpperCase()}`

            if (homologadosSet.has(key)) {
                totalHomologados++
            } else {
                itemsSinHomologar.push({
                    programaPmpa: prog,
                    servicioPmpa: serv,
                    institucion: r.institucion || null,
                    totalRegistros: Number(r.total_reg || 0),
                    totalRbds: Number(r.total_rbd || 0)
                })
            }
        }

        const totalItems = pmpaRows.length
        const totalSinHomologar = itemsSinHomologar.length
        const porcentajeHomologacion = totalItems > 0 ? Math.round((totalHomologados / totalItems) * 100) : 100

        return {
            totalItems,
            totalHomologados,
            totalSinHomologar,
            porcentajeHomologacion,
            itemsSinHomologar
        }
    } catch (error) {
        console.error('Error en getProgramasSinHomologarData:', error)
        return {
            totalItems: 0,
            totalHomologados: 0,
            totalSinHomologar: 0,
            porcentajeHomologacion: 0,
            itemsSinHomologar: []
        }
    }
}
