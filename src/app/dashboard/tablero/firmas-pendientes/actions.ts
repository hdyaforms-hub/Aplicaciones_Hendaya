'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { logAuditAction } from '@/lib/audit'
import { ensurePersonalRRHHFirmasTables } from '@/lib/personal-rrhh-firmas-db-init'
import { cleanRut, hashRut } from '@/lib/personal-crypto'
import * as xlsx from 'xlsx'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export interface FirmaPendienteItem {
    id: string
    diasAtraso: number
    empleadoRut: string
    empleadoNombre: string
    cargo: string
    sucursal: string
    rbd: number
    establecimiento: string
    supervisorRut: string
    supervisorNombre: string
    tipoDocumento: string
    detalle: string
    documentoFirmado: string
    fechaEmision: string
    fechaInicioFirma: string
    nombreApoderado1: string
    fechaFirmaApoderado1: string
}

export interface KpisFirmas {
    totalDocumentos: number
    totalEmpleados: number
    totalSupervisores: number
    totalRbds: number
    promedioDiasAtraso: number
    totalCriticos90Dias: number
    porcentajeCriticos: number
    totalFirmadoApoderado: number
    totalSinFirma: number
}

export interface ItemGraficoSucursal {
    sucursal: string
    total: number
    empleados: number
    porcentaje: number
    firmados: number
    pendientes: number
    porcentajeFirma: number
    desgloseTipos: DesgloseDocumentos
}

export interface DesgloseDocumentos {
    contratos: number
    liquidaciones: number
    vacaciones: number
    informativos: number
    otros: number
}

export interface ItemTotalizadorZona {
    sucursal: string
    total: number
    empleados: number
    firmados: number
    pendientes: number
    porcentajeFirma: number
    desgloseTipos: DesgloseDocumentos
}

export interface ItemGraficoSupervisor {
    supervisor: string
    sucursal?: string
    total: number
    empleados: number
    firmados: number
    pendientes: number
    porcentajeFirma: number
    desgloseTipos: DesgloseDocumentos
}

export interface SupervisorOficialInfo {
    nombre: string
    sucursales: string[]
}

export interface ItemGraficoRbd {
    rbd: number
    establecimiento: string
    sucursal: string
    total: number
    empleados: number
    firmados: number
    pendientes: number
    porcentajeFirma: number
    desgloseTipos: DesgloseDocumentos
}

export interface ItemGraficoAntiguedad {
    tramo: string
    label: string
    total: number
    porcentaje: number
    color: string
}

export interface ItemGraficoTipoDoc {
    tipoDocumento: string
    total: number
    porcentaje: number
}

export interface ItemGraficoEstadoFirma {
    estado: string
    label: string
    total: number
    porcentaje: number
    color: string
}

export interface GraficosFirmas {
    porSucursal: ItemGraficoSucursal[]
    totalizadorZonas: ItemTotalizadorZona[]
    topSupervisores: ItemGraficoSupervisor[]
    porRbd: ItemGraficoRbd[]
    porAntiguedad: ItemGraficoAntiguedad[]
    porTipoDocumento: ItemGraficoTipoDoc[]
    porEstadoFirma: ItemGraficoEstadoFirma[]
}

export interface UltimaCargaInfo {
    id: string
    nombreArchivo: string
    fechaCarga: string
    cargadoPor: string
    totalRegistros: number
    totalEmpleados: number
}

export interface FiltrosFirmas {
    sucursal?: string
    supervisor?: string
    rbd?: number
    tipoDocumento?: string
    tramoAntiguedad?: string
    estadoFirma?: string
    search?: string
    page?: number
    pageSize?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
}

export interface TableroFirmasPendientesResponse {
    success: boolean
    error?: string
    kpis: KpisFirmas
    graficos: GraficosFirmas
    registros: FirmaPendienteItem[]
    totalRegistros: number
    page: number
    pageSize: number
    totalPages: number
    sucursalesDisponibles: string[]
    supervisoresDisponibles: string[]
    supervisoresOficiales?: SupervisorOficialInfo[]
    tiposDocumentoDisponibles: string[]
    ultimaCarga?: UltimaCargaInfo | null
    canUpload: boolean
    isRestrictedByRbd: boolean
    authorizedRbdsCount: number | null
}

function normalizarNombreSucursal(raw?: string | null): string {
    if (!raw) return 'CASA MATRIZ'
    const val = raw.toString().trim().toUpperCase()
    if (!val || val === 'N/A' || val === 'NULL') return 'CASA MATRIZ'
    if (val.includes('COPIAP')) return 'CD COPIAPO'
    if (val.includes('VALLENAR')) return 'CD VALLENAR'
    if (val.includes('COYHAIQUE')) return 'CD COYHAIQUE'
    if (val.includes('METRO') || val.includes('MTP') || val.includes('HEN')) return 'CD METRO'
    if (val.includes('CASA MATRIZ') || val === 'MATRIZ') return 'CASA MATRIZ'
    return val
}

function normalizeString(str?: string | null): string {
    return (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .trim()
}

function toTitleCase(str?: string | null): string {
    if (!str) return ''
    return str
        .toLowerCase()
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
}

/**
 * Obtiene la lista oficial de supervisores registrados en el sistema
 * cruzados con sus colegios asignados y sucursales operacionales.
 */
export async function getSupervisoresOficialesSistema(): Promise<SupervisorOficialInfo[]> {
    try {
        const [supsDb, colegiosDb, usersDb, jzDb] = await Promise.all([
            rawPrisma.supervisor.findMany({
                where: { vigente: true },
                include: { rbdsAuditar: true }
            }).catch(() => []),

            rawPrisma.$queryRawUnsafe<any[]>('SELECT "colRBD", sucursal FROM "Colegios";').catch(() => [] as any[]),

            rawPrisma.user.findMany({
                where: {
                    role: {
                        name: { in: ['Supervisor', 'Supervisora'] }
                    }
                },
                select: { id: true, name: true, sucursales: true, rbds: true }
            }).catch(() => []),

            rawPrisma.jefeZonal.findMany({
                include: {
                    sucursales: {
                        include: { sucursal: true }
                    }
                }
            }).catch(() => [])
        ])

        const rbdSucMap = new Map<number, string>()
        colegiosDb.forEach((c: any) => {
            const rbdNum = Number(c.colRBD || 0)
            if (rbdNum > 0 && c.sucursal) {
                rbdSucMap.set(rbdNum, normalizarNombreSucursal(c.sucursal))
            }
        })

        const supMap = new Map<string, Set<string>>()

        // 1. Supervisores de tabla Supervisor
        for (const s of supsDb) {
            const fullName = `${s.nombre || ''} ${s.apellido || ''}`.trim()
            if (!fullName) continue
            if (!supMap.has(fullName)) {
                supMap.set(fullName, new Set<string>())
            }
            const set = supMap.get(fullName)!
            if (Array.isArray(s.rbdsAuditar)) {
                for (const r of s.rbdsAuditar) {
                    const suc = rbdSucMap.get(Number(r.rbd))
                    if (suc) set.add(suc)
                }
            }
        }

        // 2. Usuarios con rol Supervisor
        for (const u of usersDb) {
            const fullName = (u.name || '').trim()
            if (!fullName) continue
            if (!supMap.has(fullName)) {
                supMap.set(fullName, new Set<string>())
            }
            const set = supMap.get(fullName)!
            if (Array.isArray(u.sucursales)) {
                for (const sc of u.sucursales) {
                    const name = typeof sc === 'string' ? sc : ((sc as any)?.nombre || (sc as any)?.name)
                    if (name) set.add(normalizarNombreSucursal(name))
                }
            }
            if (Array.isArray(u.rbds)) {
                for (const r of u.rbds) {
                    const suc = rbdSucMap.get(Number(r))
                    if (suc) set.add(suc)
                }
            }
        }

        // 3. Jefes Zonales (pueden firmar o estar a cargo en nóminas)
        for (const j of jzDb as any[]) {
            const fullName = `${j.nombre || ''} ${j.apellido || ''}`.trim()
            if (!fullName) continue
            if (!supMap.has(fullName)) {
                supMap.set(fullName, new Set<string>())
            }
            const set = supMap.get(fullName)!
            if (Array.isArray(j.sucursales)) {
                for (const js of j.sucursales) {
                    const scName = js.sucursal?.nombre || js.sucursal?.name
                    if (scName) set.add(normalizarNombreSucursal(scName))
                }
            }
        }

        const result: SupervisorOficialInfo[] = []
        for (const [nombre, sucs] of supMap.entries()) {
            result.push({
                nombre,
                sucursales: Array.from(sucs).sort()
            })
        }

        return result.sort((a, b) => a.nombre.localeCompare(b.nombre))
    } catch (e) {
        console.error('Error al obtener supervisores oficiales:', e)
        return []
    }
}

function matchSupervisorOficial(
    rawExcelName: string,
    oficiales: { nombreOficial: string; normNombre: string; normApellido: string; tokens: string[] }[]
): string {
    if (!rawExcelName) return 'Sin Supervisor'
    const norm = normalizeString(rawExcelName)
    const tokens = norm.split(/\s+/).filter(t => t.length >= 3)
    if (tokens.length === 0) return toTitleCase(rawExcelName)

    // 1. Coincidencia directa apellido y nombre
    for (const off of oficiales) {
        const hasApellido = tokens.some(t => off.normApellido.includes(t) || t.includes(off.normApellido))
        const hasNombre = tokens.some(t =>
            off.normNombre.includes(t) ||
            t.includes(off.normNombre) ||
            (t.startsWith('yess') && off.normNombre.startsWith('yess')) ||
            (t.startsWith('yese') && off.normNombre.startsWith('yess'))
        )
        if (hasApellido && hasNombre) {
            return off.nombreOficial
        }
    }

    // 2. Coincidencia por apellido principal único sin conflicto de nombre
    const candidateMatches = []
    for (const off of oficiales) {
        const firstLastName = off.normApellido.split(/\s+/)[0]
        if (firstLastName && firstLastName.length >= 4 && tokens.some(t => t === firstLastName)) {
            candidateMatches.push(off)
        }
    }
    if (candidateMatches.length === 1) {
        // Verificar que no sea un nombre contradictorio
        const cand = candidateMatches[0]
        const firstOffName = cand.normNombre.split(/\s+/)[0]
        const hasConflictingFirstName = tokens.some(t => t.length >= 4 && !cand.normNombre.includes(t) && !cand.normApellido.includes(t))
        if (!hasConflictingFirstName || tokens.some(t => cand.normNombre.startsWith(t.slice(0, 3)))) {
            return cand.nombreOficial
        }
    }

    return toTitleCase(rawExcelName)
}

async function checkPermission(permId: string): Promise<{ authorized: boolean; user: any }> {
    const session = await getSession()
    if (!session || !session.user) return { authorized: false, user: null }
    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const perms = session.user.role?.permissions || []
    const isAdmin = roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin' || roleName.includes('gerencia')
    if (isAdmin || perms.includes(permId)) {
        return { authorized: true, user: session.user }
    }
    return { authorized: false, user: session.user }
}

/**
 * Obtiene las métricas, gráficos, KPIs y registros de Firmas Pendientes de Recursos Humanos.
 * Aplica aislamiento estricto por perfil (RBDs autorizados).
 */
export async function getFirmasPendientesTableroData(filtros?: FiltrosFirmas): Promise<TableroFirmasPendientesResponse> {
    try {
        const { authorized: canView, user } = await checkPermission('view_tablero_firmas_pendientes')
        if (!canView || !user) {
            return {
                success: false,
                error: 'No tienes permisos para visualizar el Tablero de Firmas Pendientes.',
                kpis: { totalDocumentos: 0, totalEmpleados: 0, totalSupervisores: 0, totalRbds: 0, promedioDiasAtraso: 0, totalCriticos90Dias: 0, porcentajeCriticos: 0, totalFirmadoApoderado: 0, totalSinFirma: 0 },
                graficos: { porSucursal: [], totalizadorZonas: [], topSupervisores: [], porRbd: [], porAntiguedad: [], porTipoDocumento: [], porEstadoFirma: [] },
                registros: [],
                totalRegistros: 0,
                page: 1,
                pageSize: 15,
                totalPages: 1,
                sucursalesDisponibles: [],
                supervisoresDisponibles: [],
                tiposDocumentoDisponibles: [],
                canUpload: false,
                isRestrictedByRbd: false,
                authorizedRbdsCount: null
            }
        }

        await ensurePersonalRRHHFirmasTables()

        const roleName = user.role?.name?.toLowerCase().trim() || ''
        const perms = user.role?.permissions || []
        const canUpload = roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin' || perms.includes('manage_tablero_firmas_pendientes')

        const authorizedRbds = await getUserEffectiveRbds()
        const isRestrictedByRbd = authorizedRbds !== null

        // 1. Obtener información de la última carga masiva
        const cargaRows = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT id, "nombreArchivo", "totalRegistros", "totalEmpleados", "cargadoPor", "fechaCarga"
            FROM "Pers_RRHH_Firmas_Carga"
            ORDER BY "fechaCarga" DESC
            LIMIT 1;
        `).catch(() => [] as any[])

        const ultimaCarga: UltimaCargaInfo | null = cargaRows.length > 0 ? {
            id: cargaRows[0].id,
            nombreArchivo: cargaRows[0].nombreArchivo,
            fechaCarga: cargaRows[0].fechaCarga ? new Date(cargaRows[0].fechaCarga).toLocaleString('es-CL') : '',
            cargadoPor: cargaRows[0].cargadoPor || 'Sistema',
            totalRegistros: Number(cargaRows[0].totalRegistros || 0),
            totalEmpleados: Number(cargaRows[0].totalEmpleados || 0)
        } : null

        // 2. Construir cláusula WHERE
        const whereClauses: string[] = ['1=1']
        const params: any[] = []
        let paramIdx = 1

        // Aislamiento por RBD
        if (authorizedRbds !== null) {
            if (authorizedRbds.length === 0) {
                // El usuario no tiene colegios asignados
                whereClauses.push('1=0')
            } else {
                whereClauses.push(`rbd = ANY($${paramIdx++}::int[])`)
                params.push(authorizedRbds)
            }
        }

        // Filtro por Sucursal
        if (filtros?.sucursal && filtros.sucursal !== 'TODAS') {
            whereClauses.push(`sucursal = $${paramIdx++}`)
            params.push(filtros.sucursal)
        }

        // Filtro por Supervisor
        if (filtros?.supervisor && filtros.supervisor !== 'TODOS') {
            whereClauses.push(`"supervisorNombre" = $${paramIdx++}`)
            params.push(filtros.supervisor)
        }

        // Filtro por RBD específico
        if (filtros?.rbd && filtros.rbd > 0) {
            whereClauses.push(`rbd = $${paramIdx++}`)
            params.push(Number(filtros.rbd))
        }

        // Filtro por Tipo de Documento
        if (filtros?.tipoDocumento && filtros.tipoDocumento !== 'TODOS') {
            whereClauses.push(`"tipoDocumento" = $${paramIdx++}`)
            params.push(filtros.tipoDocumento)
        }

        // Filtro por Tramo de Antigüedad
        if (filtros?.tramoAntiguedad && filtros.tramoAntiguedad !== 'TODOS') {
            switch (filtros.tramoAntiguedad) {
                case '0-30':
                    whereClauses.push(`"diasAtraso" <= 30`)
                    break
                case '31-60':
                    whereClauses.push(`"diasAtraso" > 30 AND "diasAtraso" <= 60`)
                    break
                case '61-90':
                    whereClauses.push(`"diasAtraso" > 60 AND "diasAtraso" <= 90`)
                    break
                case '91-180':
                    whereClauses.push(`"diasAtraso" > 90 AND "diasAtraso" <= 180`)
                    break
                case '181-365':
                    whereClauses.push(`"diasAtraso" > 180 AND "diasAtraso" <= 365`)
                    break
                case '>365':
                    whereClauses.push(`"diasAtraso" > 365`)
                    break
            }
        }

        // Filtro por Estado de Firma (Apoderado vs Empleado)
        if (filtros?.estadoFirma && filtros.estadoFirma !== 'TODOS') {
            if (filtros.estadoFirma === 'SI_NO') {
                whereClauses.push(`"documentoFirmado" ILIKE '%Si / No%'`)
            } else if (filtros.estadoFirma === 'NO_FIRMADO') {
                whereClauses.push(`"documentoFirmado" NOT ILIKE '%Si / No%'`)
            }
        }

        // Búsqueda por texto (nombre, rut, supervisor, establecimiento)
        if (filtros?.search && filtros.search.trim()) {
            const term = `%${filtros.search.trim().toUpperCase()}%`
            whereClauses.push(`(
                UPPER("empleadoNombre") LIKE $${paramIdx} OR
                UPPER("empleadoRut") LIKE $${paramIdx} OR
                UPPER("supervisorNombre") LIKE $${paramIdx} OR
                UPPER("establecimiento") LIKE $${paramIdx} OR
                UPPER("tipoDocumento") LIKE $${paramIdx} OR
                UPPER("cargo") LIKE $${paramIdx}
            )`)
            params.push(term)
            paramIdx++
        }

        const whereSql = whereClauses.join(' AND ')

        // Condición base para totalizador general de zonas (aislamiento por perfil sin filtros de sucursal)
        const whereBaseZoneClauses: string[] = ['1=1']
        const baseZoneParams: any[] = []
        if (authorizedRbds !== null) {
            if (authorizedRbds.length === 0) {
                whereBaseZoneClauses.push('1=0')
            } else {
                whereBaseZoneClauses.push(`rbd = ANY($1::int[])`)
                baseZoneParams.push(authorizedRbds)
            }
        }
        const whereBaseZoneSql = whereBaseZoneClauses.join(' AND ')

        // 3. Ejecutar consultas analíticas y KPIs consolidados
        const [
            kpiRaw,
            sucursalesRaw,
            totalizadorZonasRaw,
            supervisoresRaw,
            rbdRaw,
            antiguedadRaw,
            tipoDocRaw,
            estadoFirmaRaw,
            filtrosOpcionesRaw,
            supervisoresOficiales
        ] = await Promise.all([
            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT 
                    COUNT(*)::int as "totalDocs",
                    COUNT(DISTINCT "empleadoRutHash")::int as "totalEmpleados",
                    COUNT(DISTINCT "supervisorNombre")::int as "totalSupervisores",
                    COUNT(DISTINCT rbd) FILTER (WHERE rbd > 0)::int as "totalRbds",
                    COALESCE(ROUND(AVG("diasAtraso")), 0)::int as "promedioDias",
                    COUNT(*) FILTER (WHERE "diasAtraso" > 90)::int as "totalCriticos",
                    COUNT(*) FILTER (WHERE "documentoFirmado" ILIKE '%Si / No%')::int as "totalFirmadoApoderado",
                    COUNT(*) FILTER (WHERE "documentoFirmado" NOT ILIKE '%Si / No%')::int as "totalSinFirma"
                FROM "Pers_RRHH_Firmas_Pendientes"
                WHERE ${whereSql};
            `, ...params),

            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT 
                    sucursal,
                    COUNT(*)::int as total,
                    COUNT(DISTINCT "empleadoRutHash")::int as empleados,
                    COUNT(*) FILTER (WHERE "documentoFirmado" ILIKE '%Si / No%')::int as "firmados",
                    COUNT(*) FILTER (WHERE "documentoFirmado" NOT ILIKE '%Si / No%')::int as "pendientes",
                    COUNT(*) FILTER (WHERE "tipoDocumento" ILIKE '%Contrato%')::int as "contratos",
                    COUNT(*) FILTER (WHERE "tipoDocumento" ILIKE '%Liquidaci%')::int as "liquidaciones",
                    COUNT(*) FILTER (WHERE "tipoDocumento" ILIKE '%Vacaci%' OR "tipoDocumento" ILIKE '%Permiso%')::int as "vacaciones",
                    COUNT(*) FILTER (WHERE "tipoDocumento" ILIKE '%Comunicado%' OR "tipoDocumento" ILIKE '%Informativo%')::int as "informativos",
                    COUNT(*) FILTER (WHERE "tipoDocumento" NOT ILIKE '%Contrato%' AND "tipoDocumento" NOT ILIKE '%Liquidaci%' AND "tipoDocumento" NOT ILIKE '%Vacaci%' AND "tipoDocumento" NOT ILIKE '%Permiso%' AND "tipoDocumento" NOT ILIKE '%Comunicado%' AND "tipoDocumento" NOT ILIKE '%Informativo%')::int as "otros"
                FROM "Pers_RRHH_Firmas_Pendientes"
                WHERE ${whereSql}
                GROUP BY sucursal
                ORDER BY total DESC;
            `, ...params),

            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT 
                    sucursal,
                    COUNT(*)::int as total,
                    COUNT(DISTINCT "empleadoRutHash")::int as empleados,
                    COUNT(*) FILTER (WHERE "documentoFirmado" ILIKE '%Si / No%')::int as "firmados",
                    COUNT(*) FILTER (WHERE "documentoFirmado" NOT ILIKE '%Si / No%')::int as "pendientes",
                    COUNT(*) FILTER (WHERE "tipoDocumento" ILIKE '%Contrato%')::int as "contratos",
                    COUNT(*) FILTER (WHERE "tipoDocumento" ILIKE '%Liquidaci%')::int as "liquidaciones",
                    COUNT(*) FILTER (WHERE "tipoDocumento" ILIKE '%Vacaci%' OR "tipoDocumento" ILIKE '%Permiso%')::int as "vacaciones",
                    COUNT(*) FILTER (WHERE "tipoDocumento" ILIKE '%Comunicado%' OR "tipoDocumento" ILIKE '%Informativo%')::int as "informativos",
                    COUNT(*) FILTER (WHERE "tipoDocumento" NOT ILIKE '%Contrato%' AND "tipoDocumento" NOT ILIKE '%Liquidaci%' AND "tipoDocumento" NOT ILIKE '%Vacaci%' AND "tipoDocumento" NOT ILIKE '%Permiso%' AND "tipoDocumento" NOT ILIKE '%Comunicado%' AND "tipoDocumento" NOT ILIKE '%Informativo%')::int as "otros"
                FROM "Pers_RRHH_Firmas_Pendientes"
                WHERE ${whereBaseZoneSql}
                GROUP BY sucursal
                ORDER BY total DESC;
            `, ...baseZoneParams),

            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT 
                    "supervisorNombre" as supervisor,
                    sucursal,
                    COUNT(*)::int as total,
                    COUNT(DISTINCT "empleadoRutHash")::int as empleados,
                    COUNT(*) FILTER (WHERE "documentoFirmado" ILIKE '%Si / No%')::int as "firmados",
                    COUNT(*) FILTER (WHERE "documentoFirmado" NOT ILIKE '%Si / No%')::int as "pendientes",
                    COUNT(*) FILTER (WHERE "tipoDocumento" ILIKE '%Contrato%')::int as "contratos",
                    COUNT(*) FILTER (WHERE "tipoDocumento" ILIKE '%Liquidaci%')::int as "liquidaciones",
                    COUNT(*) FILTER (WHERE "tipoDocumento" ILIKE '%Vacaci%' OR "tipoDocumento" ILIKE '%Permiso%')::int as "vacaciones",
                    COUNT(*) FILTER (WHERE "tipoDocumento" ILIKE '%Comunicado%' OR "tipoDocumento" ILIKE '%Informativo%')::int as "informativos",
                    COUNT(*) FILTER (WHERE "tipoDocumento" NOT ILIKE '%Contrato%' AND "tipoDocumento" NOT ILIKE '%Liquidaci%' AND "tipoDocumento" NOT ILIKE '%Vacaci%' AND "tipoDocumento" NOT ILIKE '%Permiso%' AND "tipoDocumento" NOT ILIKE '%Comunicado%' AND "tipoDocumento" NOT ILIKE '%Informativo%')::int as "otros"
                FROM "Pers_RRHH_Firmas_Pendientes"
                WHERE ${whereSql} AND "supervisorNombre" IS NOT NULL AND "supervisorNombre" != ''
                GROUP BY "supervisorNombre", sucursal
                ORDER BY total DESC
                LIMIT 50;
            `, ...params),

            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT 
                    rbd,
                    establecimiento,
                    sucursal,
                    COUNT(*)::int as total,
                    COUNT(DISTINCT "empleadoRutHash")::int as empleados,
                    COUNT(*) FILTER (WHERE "documentoFirmado" ILIKE '%Si / No%')::int as "firmados",
                    COUNT(*) FILTER (WHERE "documentoFirmado" NOT ILIKE '%Si / No%')::int as "pendientes",
                    COUNT(*) FILTER (WHERE "tipoDocumento" ILIKE '%Contrato%')::int as "contratos",
                    COUNT(*) FILTER (WHERE "tipoDocumento" ILIKE '%Liquidaci%')::int as "liquidaciones",
                    COUNT(*) FILTER (WHERE "tipoDocumento" ILIKE '%Vacaci%' OR "tipoDocumento" ILIKE '%Permiso%')::int as "vacaciones",
                    COUNT(*) FILTER (WHERE "tipoDocumento" ILIKE '%Comunicado%' OR "tipoDocumento" ILIKE '%Informativo%')::int as "informativos",
                    COUNT(*) FILTER (WHERE "tipoDocumento" NOT ILIKE '%Contrato%' AND "tipoDocumento" NOT ILIKE '%Liquidaci%' AND "tipoDocumento" NOT ILIKE '%Vacaci%' AND "tipoDocumento" NOT ILIKE '%Permiso%' AND "tipoDocumento" NOT ILIKE '%Comunicado%' AND "tipoDocumento" NOT ILIKE '%Informativo%')::int as "otros"
                FROM "Pers_RRHH_Firmas_Pendientes"
                WHERE ${whereSql} AND rbd > 0
                GROUP BY rbd, establecimiento, sucursal
                ORDER BY total DESC
                LIMIT 30;
            `, ...params),

            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT 
                    COUNT(*) FILTER (WHERE "diasAtraso" <= 30)::int as "d0_30",
                    COUNT(*) FILTER (WHERE "diasAtraso" > 30 AND "diasAtraso" <= 60)::int as "d31_60",
                    COUNT(*) FILTER (WHERE "diasAtraso" > 60 AND "diasAtraso" <= 90)::int as "d61_90",
                    COUNT(*) FILTER (WHERE "diasAtraso" > 90 AND "diasAtraso" <= 180)::int as "d91_180",
                    COUNT(*) FILTER (WHERE "diasAtraso" > 180 AND "diasAtraso" <= 365)::int as "d181_365",
                    COUNT(*) FILTER (WHERE "diasAtraso" > 365)::int as "dMas365"
                FROM "Pers_RRHH_Firmas_Pendientes"
                WHERE ${whereSql};
            `, ...params),

            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT "tipoDocumento", COUNT(*)::int as total
                FROM "Pers_RRHH_Firmas_Pendientes"
                WHERE ${whereSql}
                GROUP BY "tipoDocumento"
                ORDER BY total DESC
                LIMIT 8;
            `, ...params),

            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT 
                    CASE 
                        WHEN "documentoFirmado" ILIKE '%Si / No%' THEN 'FIRMADO_APODERADO'
                        ELSE 'SIN_FIRMA'
                    END as estado,
                    COUNT(*)::int as total
                FROM "Pers_RRHH_Firmas_Pendientes"
                WHERE ${whereSql}
                GROUP BY 1
                ORDER BY total DESC;
            `, ...params),

            // Opciones disponibles para los combos de filtros (considerando el aislamiento por perfil)
            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT 
                    ARRAY_AGG(DISTINCT sucursal) FILTER (WHERE sucursal IS NOT NULL) as sucursales,
                    ARRAY_AGG(DISTINCT "supervisorNombre") FILTER (WHERE "supervisorNombre" IS NOT NULL AND "supervisorNombre" != '') as supervisores,
                    ARRAY_AGG(DISTINCT "tipoDocumento") FILTER (WHERE "tipoDocumento" IS NOT NULL AND "tipoDocumento" != '') as tipos
                FROM "Pers_RRHH_Firmas_Pendientes"
                WHERE ${authorizedRbds !== null ? (authorizedRbds.length === 0 ? '1=0' : `rbd = ANY($1::int[])`) : '1=1'};
            `, ...(authorizedRbds !== null && authorizedRbds.length > 0 ? [authorizedRbds] : [])),

            getSupervisoresOficialesSistema()
        ])

        const kRow = kpiRaw[0] || {}
        const totalDocs = Number(kRow.totalDocs || 0)
        const totalCriticos = Number(kRow.totalCriticos || 0)
        const pctCriticos = totalDocs > 0 ? Math.round((totalCriticos / totalDocs) * 100) : 0

        const kpis: KpisFirmas = {
            totalDocumentos: totalDocs,
            totalEmpleados: Number(kRow.totalEmpleados || 0),
            totalSupervisores: Number(kRow.totalSupervisores || 0),
            totalRbds: Number(kRow.totalRbds || 0),
            promedioDiasAtraso: Number(kRow.promedioDias || 0),
            totalCriticos90Dias: totalCriticos,
            porcentajeCriticos: pctCriticos,
            totalFirmadoApoderado: Number(kRow.totalFirmadoApoderado || 0),
            totalSinFirma: Number(kRow.totalSinFirma || 0)
        }

        // Procesar Gráfico 1: Sucursal con desglose de firmas y tipología
        const porSucursal: ItemGraficoSucursal[] = sucursalesRaw.map(r => {
            const tot = Number(r.total || 0)
            const firm = Number(r.firmados || 0)
            const pend = Number(r.pendientes || 0)
            const pctFirma = tot > 0 ? Math.round((firm / tot) * 100) : 0
            return {
                sucursal: r.sucursal || 'CASA MATRIZ',
                total: tot,
                empleados: Number(r.empleados || 0),
                porcentaje: totalDocs > 0 ? Math.round((tot / totalDocs) * 100) : 0,
                firmados: firm,
                pendientes: pend,
                porcentajeFirma: pctFirma,
                desgloseTipos: {
                    contratos: Number(r.contratos || 0),
                    liquidaciones: Number(r.liquidaciones || 0),
                    vacaciones: Number(r.vacaciones || 0),
                    informativos: Number(r.informativos || 0),
                    otros: Number(r.otros || 0)
                }
            }
        })

        // Totalizador comparativo general de todas las Zonas
        const totalizadorZonas: ItemTotalizadorZona[] = totalizadorZonasRaw.map(r => {
            const tot = Number(r.total || 0)
            const firm = Number(r.firmados || 0)
            const pend = Number(r.pendientes || 0)
            const pct = tot > 0 ? Math.round((firm / tot) * 100) : 0
            return {
                sucursal: r.sucursal || 'CASA MATRIZ',
                total: tot,
                empleados: Number(r.empleados || 0),
                firmados: firm,
                pendientes: pend,
                porcentajeFirma: pct,
                desgloseTipos: {
                    contratos: Number(r.contratos || 0),
                    liquidaciones: Number(r.liquidaciones || 0),
                    vacaciones: Number(r.vacaciones || 0),
                    informativos: Number(r.informativos || 0),
                    otros: Number(r.otros || 0)
                }
            }
        })

        // Procesar Gráfico 2: Supervisores con desglose de firmas y tipología de documentos
        const topSupervisores: ItemGraficoSupervisor[] = supervisoresRaw.map(r => {
            const tot = Number(r.total || 0)
            const firm = Number(r.firmados || 0)
            const pend = Number(r.pendientes || 0)
            const pct = tot > 0 ? Math.round((firm / tot) * 100) : 0
            return {
                supervisor: r.supervisor,
                sucursal: r.sucursal || 'CASA MATRIZ',
                total: tot,
                empleados: Number(r.empleados || 0),
                firmados: firm,
                pendientes: pend,
                porcentajeFirma: pct,
                desgloseTipos: {
                    contratos: Number(r.contratos || 0),
                    liquidaciones: Number(r.liquidaciones || 0),
                    vacaciones: Number(r.vacaciones || 0),
                    informativos: Number(r.informativos || 0),
                    otros: Number(r.otros || 0)
                }
            }
        })

        // Procesar Gráfico 3: RBD con desglose de firmas y tipología
        const porRbd: ItemGraficoRbd[] = rbdRaw.map(r => {
            const tot = Number(r.total || 0)
            const firm = Number(r.firmados || 0)
            const pend = Number(r.pendientes || 0)
            const pctFirma = tot > 0 ? Math.round((firm / tot) * 100) : 0
            return {
                rbd: Number(r.rbd || 0),
                establecimiento: r.establecimiento || `RBD ${r.rbd}`,
                sucursal: r.sucursal || 'CASA MATRIZ',
                total: tot,
                empleados: Number(r.empleados || 0),
                firmados: firm,
                pendientes: pend,
                porcentajeFirma: pctFirma,
                desgloseTipos: {
                    contratos: Number(r.contratos || 0),
                    liquidaciones: Number(r.liquidaciones || 0),
                    vacaciones: Number(r.vacaciones || 0),
                    informativos: Number(r.informativos || 0),
                    otros: Number(r.otros || 0)
                }
            }
        })

        // Procesar Gráfico 4: Semáforo de Antigüedad
        const antRow = antiguedadRaw[0] || {}
        const porAntiguedad: ItemGraficoAntiguedad[] = [
            { tramo: '0-30', label: '0 a 30 días (Reciente)', total: Number(antRow.d0_30 || 0), porcentaje: totalDocs > 0 ? Math.round((Number(antRow.d0_30 || 0) / totalDocs) * 100) : 0, color: '#10b981' },
            { tramo: '31-60', label: '31 a 60 días (En Plazo)', total: Number(antRow.d31_60 || 0), porcentaje: totalDocs > 0 ? Math.round((Number(antRow.d31_60 || 0) / totalDocs) * 100) : 0, color: '#f59e0b' },
            { tramo: '61-90', label: '61 a 90 días (Atraso Medio)', total: Number(antRow.d61_90 || 0), porcentaje: totalDocs > 0 ? Math.round((Number(antRow.d61_90 || 0) / totalDocs) * 100) : 0, color: '#f97316' },
            { tramo: '91-180', label: '91 a 180 días (Atraso Grave)', total: Number(antRow.d91_180 || 0), porcentaje: totalDocs > 0 ? Math.round((Number(antRow.d91_180 || 0) / totalDocs) * 100) : 0, color: '#ef4444' },
            { tramo: '181-365', label: '181 a 365 días (Crítico)', total: Number(antRow.d181_365 || 0), porcentaje: totalDocs > 0 ? Math.round((Number(antRow.d181_365 || 0) / totalDocs) * 100) : 0, color: '#b91c1c' },
            { tramo: '>365', label: 'Más de 1 año (Histórico)', total: Number(antRow.dMas365 || 0), porcentaje: totalDocs > 0 ? Math.round((Number(antRow.dMas365 || 0) / totalDocs) * 100) : 0, color: '#831843' }
        ]

        // Procesar Gráfico 5: Tipo de Documento
        const porTipoDocumento: ItemGraficoTipoDoc[] = tipoDocRaw.map(r => ({
            tipoDocumento: r.tipoDocumento || 'Otros',
            total: Number(r.total || 0),
            porcentaje: totalDocs > 0 ? Math.round((Number(r.total || 0) / totalDocs) * 100) : 0
        }))

        // Procesar Gráfico 6: Estado de Firma
        const porEstadoFirma: ItemGraficoEstadoFirma[] = [
            {
                estado: 'SI_NO',
                label: 'Esperando Firma Empleado (Apoderado firmó)',
                total: kpis.totalFirmadoApoderado,
                porcentaje: totalDocs > 0 ? Math.round((kpis.totalFirmadoApoderado / totalDocs) * 100) : 0,
                color: '#0284c7'
            },
            {
                estado: 'NO_FIRMADO',
                label: 'Sin Firma (Ni Empleado ni Apoderado)',
                total: kpis.totalSinFirma,
                porcentaje: totalDocs > 0 ? Math.round((kpis.totalSinFirma / totalDocs) * 100) : 0,
                color: '#64748b'
            }
        ]

        const graficos: GraficosFirmas = {
            porSucursal,
            totalizadorZonas,
            topSupervisores,
            porRbd,
            porAntiguedad,
            porTipoDocumento,
            porEstadoFirma
        }

        // 4. Paginación y registros detallados
        const page = Math.max(1, Number(filtros?.page || 1))
        const pageSize = Math.min(100, Math.max(5, Number(filtros?.pageSize || 15)))
        const offset = (page - 1) * pageSize

        let orderCol = '"diasAtraso"'
        let orderDir = 'DESC'
        if (filtros?.sortBy) {
            switch (filtros.sortBy) {
                case 'diasAtraso': orderCol = '"diasAtraso"'; break
                case 'empleadoNombre': orderCol = '"empleadoNombre"'; break
                case 'empleadoRut': orderCol = '"empleadoRut"'; break
                case 'sucursal': orderCol = 'sucursal'; break
                case 'rbd': orderCol = 'rbd'; break
                case 'supervisorNombre': orderCol = '"supervisorNombre"'; break
                case 'tipoDocumento': orderCol = '"tipoDocumento"'; break
                case 'fechaEmision': orderCol = '"fechaEmision"'; break
            }
            if (filtros.sortOrder === 'asc') orderDir = 'ASC'
        }

        const registrosRaw: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT 
                id,
                "diasAtraso",
                "empleadoRut",
                "empleadoNombre",
                cargo,
                sucursal,
                rbd,
                establecimiento,
                "supervisorRut",
                "supervisorNombre",
                "tipoDocumento",
                detalle,
                "documentoFirmado",
                "fechaEmision",
                "fechaInicioFirma",
                "nombreApoderado1",
                "fechaFirmaApoderado1"
            FROM "Pers_RRHH_Firmas_Pendientes"
            WHERE ${whereSql}
            ORDER BY ${orderCol} ${orderDir}
            LIMIT ${pageSize} OFFSET ${offset};
        `, ...params)

        const registros: FirmaPendienteItem[] = registrosRaw.map(r => ({
            id: r.id,
            diasAtraso: Number(r.diasAtraso || 0),
            empleadoRut: r.empleadoRut || '',
            empleadoNombre: r.empleadoNombre || '',
            cargo: r.cargo || '',
            sucursal: r.sucursal || 'CASA MATRIZ',
            rbd: Number(r.rbd || 0),
            establecimiento: r.establecimiento || (r.rbd > 0 ? `RBD ${r.rbd}` : 'Casa Matriz'),
            supervisorRut: r.supervisorRut || '',
            supervisorNombre: r.supervisorNombre || '',
            tipoDocumento: r.tipoDocumento || 'Otros',
            detalle: r.detalle || '',
            documentoFirmado: r.documentoFirmado || 'No firmado',
            fechaEmision: r.fechaEmision || '',
            fechaInicioFirma: r.fechaInicioFirma || '',
            nombreApoderado1: r.nombreApoderado1 || '',
            fechaFirmaApoderado1: r.fechaFirmaApoderado1 || ''
        }))

        const totalPages = Math.ceil(totalDocs / pageSize) || 1

        const optRow = filtrosOpcionesRaw[0] || {}
        const sucursalesDisponibles: string[] = (optRow.sucursales || []).filter(Boolean).sort()

        // Construir lista oficial consolidada de supervisores (Base oficial + nómina activa)
        const supSet = new Set<string>()
        supervisoresOficiales.forEach(s => {
            if (s.nombre) supSet.add(s.nombre)
        })
        if (Array.isArray(optRow.supervisores)) {
            optRow.supervisores.forEach((s: string) => {
                if (s) supSet.add(s)
            })
        }
        const supervisoresDisponibles: string[] = Array.from(supSet).sort()
        const tiposDocumentoDisponibles: string[] = (optRow.tipos || []).filter(Boolean).sort()

        return {
            success: true,
            kpis,
            graficos,
            registros,
            totalRegistros: totalDocs,
            page,
            pageSize,
            totalPages,
            sucursalesDisponibles,
            supervisoresDisponibles,
            supervisoresOficiales,
            tiposDocumentoDisponibles,
            ultimaCarga,
            canUpload,
            isRestrictedByRbd,
            authorizedRbdsCount: authorizedRbds !== null ? authorizedRbds.length : null
        }
    } catch (error: any) {
        console.error('Error al obtener datos de Tablero Firmas Pendientes:', error)
        return {
            success: false,
            error: error.message || 'Error al cargar datos del tablero.',
            kpis: { totalDocumentos: 0, totalEmpleados: 0, totalSupervisores: 0, totalRbds: 0, promedioDiasAtraso: 0, totalCriticos90Dias: 0, porcentajeCriticos: 0, totalFirmadoApoderado: 0, totalSinFirma: 0 },
            graficos: { porSucursal: [], totalizadorZonas: [], topSupervisores: [], porRbd: [], porAntiguedad: [], porTipoDocumento: [], porEstadoFirma: [] },
            registros: [],
            totalRegistros: 0,
            page: 1,
            pageSize: 15,
            totalPages: 1,
            sucursalesDisponibles: [],
            supervisoresDisponibles: [],
            tiposDocumentoDisponibles: [],
            canUpload: false,
            isRestrictedByRbd: false,
            authorizedRbdsCount: null
        }
    }
}

/**
 * Carga masiva de Excel para Firmas Pendientes de Recursos Humanos.
 * REGLA ESTRICTA: Elimina el 100% de la carga anterior y carga la nueva nómina.
 * Cruza con RBDs, Establecimientos y Sucursales oficiales.
 */
export async function cargarExcelFirmasPendientesAction(formData?: FormData): Promise<{ success: boolean; error?: string; message?: string; totalRegistros?: number }> {
    try {
        const { authorized: canUpload, user } = await checkPermission('manage_tablero_firmas_pendientes')
        if (!canUpload || !user) {
            return { success: false, error: 'No tienes permisos de autorización para cargar planillas en Firmas Pendientes.' }
        }

        await ensurePersonalRRHHFirmasTables()

        let fileBuffer: Buffer | null = null
        let fileName = 'Documentos con firma pendiente.xlsx'

        if (formData && formData.has('file')) {
            const file = formData.get('file') as File
            if (file && file.size > 0) {
                const arrayBuffer = await file.arrayBuffer()
                fileBuffer = Buffer.from(arrayBuffer)
                fileName = file.name
            }
        }

        // Si no vino archivo por FormData, intentar leer archivo por defecto de doctos
        if (!fileBuffer) {
            const defaultPath = 'C:\\Desarrollo\\Programas\\AplicacionWebDoctos\\Personal\\Documentos con firma pendiente (2).xlsx'
            if (fs.existsSync(defaultPath)) {
                fileBuffer = fs.readFileSync(defaultPath)
                fileName = path.basename(defaultPath)
            } else {
                return { success: false, error: 'No se proporcionó ningún archivo Excel válido para la carga.' }
            }
        }

        // Parsear Excel con xlsx
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        if (!worksheet) {
            return { success: false, error: 'El archivo Excel no contiene hojas de datos válidas.' }
        }

        // Detectar fila de cabeceras (buscar fila que contenga 'Empleado' y 'Días de atraso')
        const allRowsRaw: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1 })
        let headerRowIdx = -1

        for (let i = 0; i < Math.min(allRowsRaw.length, 10); i++) {
            const rowStr = (allRowsRaw[i] || []).map(c => String(c || '').toLowerCase().trim()).join('|')
            if (rowStr.includes('empleado') && (rowStr.includes('atraso') || rowStr.includes('firma'))) {
                headerRowIdx = i
                break
            }
        }

        if (headerRowIdx === -1) headerRowIdx = 1

        const dataRows: any[] = xlsx.utils.sheet_to_json(worksheet, { range: headerRowIdx })
        if (dataRows.length === 0) {
            return { success: false, error: 'El archivo Excel no contiene filas de datos para procesar.' }
        }

        // 1. Cargar referencias del sistema en paralelo para el cruce de datos por RUT, RBD y Supervisores oficiales
        const [visRows, asisRows, hextraRows, atrasosRows, colegiosDb, officialSupervisorsRaw] = await Promise.all([
            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT DISTINCT "personalRutHash", "personalRbd", "personalEstablecimiento", "personalSucursal"
                FROM "Pers_Visualizacion_Jefatura"
                WHERE "personalRutHash" IS NOT NULL;
            `).catch(() => []),

            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT DISTINCT "rutHash", rbd, establecimiento, sucursal
                FROM "Pers_Asis_Registro"
                WHERE "rutHash" IS NOT NULL;
            `).catch(() => []),

            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT DISTINCT "identificadorHash", rbd, establecimiento, sucursal
                FROM "Pers_Hextra_Registro"
                WHERE "identificadorHash" IS NOT NULL;
            `).catch(() => []),

            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT DISTINCT "identificadorHash", rbd, establecimiento, sucursal
                FROM "Pers_Atrasos_Registro"
                WHERE "identificadorHash" IS NOT NULL;
            `).catch(() => [] as any[]),

            rawPrisma.$queryRawUnsafe<any[]>(`
                SELECT "colRBD", "colNombre", sucursal, "colComuna"
                FROM "Colegios";
            `).catch(() => [] as any[]),

            getSupervisoresOficialesSistema()
        ])

        const officialPrepared = officialSupervisorsRaw.map(s => {
            const parts = s.nombre.split(/\s+/)
            const normNombre = normalizeString(parts[0] || '')
            const normApellido = normalizeString(parts.slice(1).join(' ') || '')
            return {
                nombreOficial: s.nombre,
                normNombre,
                normApellido,
                tokens: normalizeString(s.nombre).split(/\s+/).filter(t => t.length >= 3)
            }
        })

        // Mapas de cruce rápido O(1)
        const colegiosMap = new Map<number, { nombre: string; sucursal?: string }>()
        colegiosDb.forEach((c: any) => {
            const rbdNum = Number(c.colRBD || 0)
            if (rbdNum > 0) {
                colegiosMap.set(rbdNum, { nombre: c.colNombre, sucursal: c.sucursal || undefined })
            }
        })

        type MatchInfo = { rbd: number; establecimiento: string; sucursal: string }
        const rbdMatchMap = new Map<string, MatchInfo>()

        // Poblar desde Asistencia, Horas Extras, Atrasos y Visualización
        const registerMatch = (hash: string, rbdRaw?: any, estRaw?: string, sucRaw?: string) => {
            const rbdNum = Number(rbdRaw || 0)
            if (!hash || rbdMatchMap.has(hash)) return
            if (rbdNum > 0) {
                const colInfo = colegiosMap.get(rbdNum)
                rbdMatchMap.set(hash, {
                    rbd: rbdNum,
                    establecimiento: colInfo?.nombre || estRaw || `RBD ${rbdNum}`,
                    sucursal: normalizarNombreSucursal(colInfo?.sucursal || sucRaw)
                })
            }
        }

        visRows.forEach((v: any) => registerMatch(v.personalRutHash, v.personalRbd, v.personalEstablecimiento, v.personalSucursal))
        atrasosRows.forEach((a: any) => registerMatch(a.identificadorHash, a.rbd, a.establecimiento, a.sucursal))
        asisRows.forEach((a: any) => registerMatch(a.rutHash, a.rbd, a.establecimiento, a.sucursal))
        hextraRows.forEach((h: any) => registerMatch(h.identificadorHash, h.rbd, h.establecimiento, h.sucursal))

        // 2. Mapear filas del Excel
        const uniqueEmpleadosSet = new Set<string>()
        const registrosParaInsertar: any[] = []
        const nuevaCargaId = crypto.randomUUID()

        for (const row of dataRows) {
            const rawEmpleado = String(row['Empleado'] || '').trim()
            if (!rawEmpleado) continue

            const limpio = cleanRut(rawEmpleado)
            if (!limpio) continue
            const hash = hashRut(limpio)
            uniqueEmpleadosSet.add(hash)

            const diasAtraso = Math.max(0, parseInt(String(row['Días de atraso'] || '0').replace(/[^0-9]/g, '')) || 0)
            const empleadoNombre = String(row['Nombre'] || '').trim() || 'Sin Nombre'
            const nombreContrato = row['Nombre contrato'] ? String(row['Nombre contrato']).trim() : null
            const contrato = row['Contrato'] ? String(row['Contrato']).trim() : null
            const fechaFirmaEmpleado = row['Fecha firma empleado'] ? String(row['Fecha firma empleado']).trim() : null
            const ciudad = row['Ciudad'] ? String(row['Ciudad']).trim() : null
            const region = row['Región'] ? String(row['Región']).trim() : null
            const estado = row['Estado'] ? String(row['Estado']).trim() : null
            const empresa = row['Empresa'] ? String(row['Empresa']).trim() : null
            const nombreEmpresa = row['Nombre de empresa'] ? String(row['Nombre de empresa']).trim() : null
            const centroCostoRaw = row['Centro de costo'] ? String(row['Centro de costo']).trim() : null

            // Cruzar RBD y Establecimiento por RUT Hash
            const matchInfo = rbdMatchMap.get(hash)
            const rbd = matchInfo?.rbd || 0
            const sucursalResuelta = matchInfo?.sucursal || normalizarNombreSucursal(centroCostoRaw)
            const establecimiento = matchInfo?.establecimiento || (rbd > 0 ? (colegiosMap.get(rbd)?.nombre || `RBD ${rbd}`) : (sucursalResuelta === 'CASA MATRIZ' ? 'Casa Matriz' : sucursalResuelta))

            const supervisorRut = row['Supervisor'] ? cleanRut(String(row['Supervisor'])) : null
            const rawSup = row['Nombre supervisor'] ? String(row['Nombre supervisor']).trim() : null
            const supervisorNombre = rawSup ? matchSupervisorOficial(rawSup, officialPrepared) : 'Sin Supervisor'
            const fechaInicioFirma = row['Fecha inicio firma'] ? String(row['Fecha inicio firma']).trim() : null
            const fechaUltimaFirma = row['Fecha última firma'] ? String(row['Fecha última firma']).trim() : null
            const apoderado1 = row['Apoderado 1'] ? String(row['Apoderado 1']).trim() : null
            const nombreApoderado1 = row['Nombre apoderado 1'] ? String(row['Nombre apoderado 1']).trim() : null
            const fechaFirmaApoderado1 = row['Fecha firma Apoderado 1'] ? String(row['Fecha firma Apoderado 1']).trim() : null
            const apoderado2 = row['Apoderado 2'] ? String(row['Apoderado 2']).trim() : null
            const nombreApoderado2 = row['Nombre apoderado 2'] ? String(row['Nombre apoderado 2']).trim() : null
            const fechaFirmaApoderado2 = row['Fecha firma Apoderado 2'] ? String(row['Fecha firma Apoderado 2']).trim() : null

            const tipoDocumento = String(row['Tipo documento'] || 'Otros').trim()
            const detalle = row['Detalle'] ? String(row['Detalle']).trim() : null
            const documentoFirmado = String(row['Documento firmado'] || 'No firmado').trim()
            const numeroFirmas = row['Número firmas'] ? String(row['Número firmas']).trim() : null
            const aprobador = row['Aprobador'] ? String(row['Aprobador']).trim() : null
            const nombreAprobador = row['Nombre del aprobador'] ? String(row['Nombre del aprobador']).trim() : null
            const cargo = row['Cargo'] ? String(row['Cargo']).trim() : null
            const fechaEmision = row['Fecha de emisión'] ? String(row['Fecha de emisión']).trim() : null
            const usuarioEmisor = row['Usuario emisor'] ? String(row['Usuario emisor']).trim() : null

            registrosParaInsertar.push({
                id: crypto.randomUUID(),
                cargaId: nuevaCargaId,
                diasAtraso,
                empleadoRut: rawEmpleado,
                empleadoRutLimpio: limpio,
                empleadoRutHash: hash,
                empleadoNombre,
                nombreContrato,
                contrato,
                fechaFirmaEmpleado,
                ciudad,
                region,
                estado,
                empresa,
                nombreEmpresa,
                centroCostoRaw,
                sucursal: sucursalResuelta,
                rbd,
                establecimiento,
                supervisorRut,
                supervisorNombre,
                fechaInicioFirma,
                fechaUltimaFirma,
                apoderado1,
                nombreApoderado1,
                fechaFirmaApoderado1,
                apoderado2,
                nombreApoderado2,
                fechaFirmaApoderado2,
                tipoDocumento,
                detalle,
                documentoFirmado,
                numeroFirmas,
                aprobador,
                nombreAprobador,
                cargo,
                fechaEmision,
                usuarioEmisor
            })
        }

        if (registrosParaInsertar.length === 0) {
            return { success: false, error: 'No se encontraron registros válidos para importar en la planilla.' }
        }

        // 3. REEMPLAZO TOTAL EN BD (Elimina la carga anterior y registra la nueva nómina)
        await rawPrisma.$executeRawUnsafe(`DELETE FROM "Pers_RRHH_Firmas_Pendientes";`)
        await rawPrisma.$executeRawUnsafe(`DELETE FROM "Pers_RRHH_Firmas_Carga";`)

        // Crear registro en tabla de control
        const usuarioNombre = user.name || user.username || 'Usuario'
        const ahora = new Date()

        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "Pers_RRHH_Firmas_Carga" (
                id, "nombreArchivo", "totalRegistros", "totalEmpleados", "cargadoPor", "cargadoPorUserId", "fechaCarga", observaciones
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `, nuevaCargaId, fileName, registrosParaInsertar.length, uniqueEmpleadosSet.size, usuarioNombre, user.id || null, ahora, `Carga masiva reemplazo completo: ${registrosParaInsertar.length} documentos de ${uniqueEmpleadosSet.size} colaboradores.`);

        // Insertar en bloques (chunks de 150 registros para óptimo rendimiento)
        const chunkSize = 150
        for (let i = 0; i < registrosParaInsertar.length; i += chunkSize) {
            const chunk = registrosParaInsertar.slice(i, i + chunkSize)
            const valueRows: string[] = []
            const insertParams: any[] = []
            let pIdx = 1

            for (const r of chunk) {
                valueRows.push(`(
                    $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++},
                    $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++},
                    $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++},
                    $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}
                )`)
                insertParams.push(
                    r.id, r.cargaId, r.diasAtraso, r.empleadoRut, r.empleadoRutLimpio, r.empleadoRutHash, r.empleadoNombre, r.nombreContrato, r.contrato, r.fechaFirmaEmpleado,
                    r.ciudad, r.region, r.estado, r.empresa, r.nombreEmpresa, r.centroCostoRaw, r.sucursal, r.rbd, r.establecimiento, r.supervisorRut,
                    r.supervisorNombre, r.fechaInicioFirma, r.fechaUltimaFirma, r.apoderado1, r.nombreApoderado1, r.fechaFirmaApoderado1, r.apoderado2, r.nombreApoderado2, r.fechaFirmaApoderado2, r.tipoDocumento,
                    r.detalle, r.documentoFirmado, r.numeroFirmas, r.aprobador, r.nombreAprobador, r.cargo, r.fechaEmision, r.usuarioEmisor
                )
            }

            const sql = `
                INSERT INTO "Pers_RRHH_Firmas_Pendientes" (
                    id, "cargaId", "diasAtraso", "empleadoRut", "empleadoRutLimpio", "empleadoRutHash", "empleadoNombre", "nombreContrato", "contrato", "fechaFirmaEmpleado",
                    ciudad, region, estado, empresa, "nombreEmpresa", "centroCostoRaw", sucursal, rbd, establecimiento, "supervisorRut",
                    "supervisorNombre", "fechaInicioFirma", "fechaUltimaFirma", "apoderado1", "nombreApoderado1", "fechaFirmaApoderado1", "apoderado2", "nombreApoderado2", "fechaFirmaApoderado2", "tipoDocumento",
                    detalle, "documentoFirmado", "numeroFirmas", aprobador, "nombreAprobador", cargo, "fechaEmision", "usuarioEmisor"
                ) VALUES ${valueRows.join(', ')};
            `
            await rawPrisma.$executeRawUnsafe(sql, ...insertParams)
        }

        // 4. Registro en Auditoría Centralizada
        await logAuditAction({
            username: usuarioNombre,
            userId: user.id || null,
            action: 'CARGA_MASIVA_FIRMAS_PENDIENTES',
            modulo: 'Tablero Firmas Pendientes (RRHH)',
            detalle: `Carga y reemplazo exitoso de planilla "${fileName}". Se importaron ${registrosParaInsertar.length} documentos con firma pendiente de ${uniqueEmpleadosSet.size} colaboradores.`
        })

        revalidatePath('/dashboard/tablero/firmas-pendientes')

        return {
            success: true,
            message: `Nómina actualizada exitosamente. Se cargaron ${registrosParaInsertar.length.toLocaleString('es-CL')} documentos con firma pendiente (${uniqueEmpleadosSet.size.toLocaleString('es-CL')} colaboradores únicos).`,
            totalRegistros: registrosParaInsertar.length
        }
    } catch (error: any) {
        console.error('Error al procesar carga masiva de firmas pendientes:', error)
        return { success: false, error: error.message || 'Error al procesar el archivo Excel.' }
    }
}
