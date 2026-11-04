'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { decryptPersonalText, cleanRut, hashRut } from '@/lib/personal-crypto'
import { ensurePersonalHextraTables } from '@/lib/personal-hextra-db-init'
import { ensurePersonalVisualizacionTables } from '@/lib/personal-visualizacion-db-init'
import { puedeUsuarioCerrarPeriodosRH } from '@/lib/personal-cuentas-db-init'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { logAuditAction } from '@/lib/audit'

const PATH_ADM_HEXTRA = '/dashboard/areas/personal/administracion/horas-extras'
const PATH_ASISTENCIA_HEXTRA = '/dashboard/areas/personal/asistencia/horas-extras'

async function checkAdminPermission() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []
    return perms.includes('manage_personal_horas_extras_admin')
}

export interface AdmHextraRegistroDTO {
    id: string
    cargaId: string | null
    cargaNombreArchivo?: string | null
    rut: string
    apellidos: string
    nombre: string
    nombreCompleto: string
    fecha: string
    fechaSerial: string | null
    rbd: number | null
    establecimiento: string | null
    institucion?: string | null
    comuna?: string | null
    sucursal: string
    supervisor: string | null
    turno: string | null
    marco: string | null
    entro: string | null
    salio: string | null
    atraso: number
    justificado: string | null
    hhee: number
    hheeAtraso: number
    hheeRex: number
    montoPagar: number
    cargo: string | null
    horasTotales: string | null
    aplica: boolean
    aplicaModificadoPor: string | null
    aplicaModificadoAt: string | null
    aplicaObservacion: string | null
    estado: string
    cerradoPor?: string | null
    cerradoAt?: string | null
    cargadoPor?: string | null
}

export interface UsuarioFiltroHextraDTO {
    id: string
    name: string
    username: string
    roleId: string
    roleName: string
    rbds: number[]
    hasVisualizacion?: boolean
    totalTrabajadores?: number
    ruts?: string[]
    rutHashes?: string[]
}

export interface FiltrosMetadatosHextraDTO {
    roles: { id: string; name: string }[]
    usuarios: UsuarioFiltroHextraDTO[]
    instituciones: string[]
    comunas: string[]
}

export interface CargaHextraDTO {
    id: string
    nombreArchivo: string
    totalRegistros: number
    nuevos: number
    actualizados: number
    estado: string
    cerradoPor?: string | null
    cerradoAt?: string | null
    cargadoPor: string
    fechaCarga: string
    observaciones?: string | null
}

export async function getAdmHorasExtrasAction(filtros?: {
    rbd?: number
    rbds?: number[]
    institucion?: string
    comuna?: string
    rutHashes?: string[]
    sucursal?: string
    supervisor?: string
    fechaDesde?: string
    fechaHasta?: string
    aplica?: 'TODOS' | 'APLICA' | 'NO_APLICA'
    estado?: 'TODOS' | 'ABIERTO' | 'CERRADO'
    cargaId?: string
    search?: string
    page?: number
    pageSize?: number
    sortBy?: string
    sortDir?: 'asc' | 'desc'
}) {
    if (!await checkAdminPermission()) {
        return { success: false, error: 'No tienes permisos para administrar horas extras', data: [], total: 0 }
    }
    await ensurePersonalHextraTables()

    const session = await getSession()
    if (!session || !session.user) {
        return { success: false, error: 'No autorizado', data: [], total: 0 }
    }

    const authorizedRbds = await getUserEffectiveRbds()

    try {
        const whereConditions: string[] = ['1=1']
        const queryParams: any[] = []
        let paramIndex = 1

        // 1. Privilegios por RBD efectivo del usuario
        if (authorizedRbds !== null) {
            if (authorizedRbds.length === 0) {
                whereConditions.push(`r.rbd = -999999`)
            } else if (filtros?.rbd) {
                if (authorizedRbds.includes(filtros.rbd)) {
                    whereConditions.push(`r.rbd = $${paramIndex++}`)
                    queryParams.push(filtros.rbd)
                } else {
                    whereConditions.push(`r.rbd = -999999`)
                }
            } else {
                whereConditions.push(`r.rbd = ANY($${paramIndex++})`)
                queryParams.push(authorizedRbds)
            }
        } else if (filtros?.rbd) {
            whereConditions.push(`r.rbd = $${paramIndex++}`)
            queryParams.push(filtros.rbd)
        }

        // Filtro por Rol o Usuario (Trabajadores de Visualización y/o RBDs permitidos según perfil)
        const hasRutHashes = Boolean(filtros?.rutHashes && filtros.rutHashes.length > 0)
        const hasRbds = Boolean(filtros?.rbds && filtros.rbds.length > 0 && !filtros.rbds.includes(-999999))
        const rbdsExplicitEmpty = Boolean(filtros?.rbds && (filtros.rbds.length === 0 || filtros.rbds.includes(-999999)))

        if (hasRutHashes && hasRbds) {
            whereConditions.push(`(r."identificadorHash" = ANY($${paramIndex++}) OR r.rbd = ANY($${paramIndex++}))`)
            queryParams.push(filtros!.rutHashes)
            queryParams.push(filtros!.rbds)
        } else if (hasRutHashes) {
            whereConditions.push(`r."identificadorHash" = ANY($${paramIndex++})`)
            queryParams.push(filtros!.rutHashes)
        } else if (hasRbds) {
            whereConditions.push(`r.rbd = ANY($${paramIndex++})`)
            queryParams.push(filtros!.rbds)
        } else if (rbdsExplicitEmpty) {
            whereConditions.push(`r.rbd = -999999`)
        }

        // Filtro por Institución (Colegio)
        if (filtros?.institucion && filtros.institucion !== 'TODAS') {
            whereConditions.push(`EXISTS (
                SELECT 1 FROM "Colegios" col 
                WHERE col."colRBD" = r.rbd AND TRIM(UPPER(col.institucion)) = TRIM(UPPER($${paramIndex++}))
            )`)
            queryParams.push(filtros.institucion)
        }

        // Filtro por Comuna
        if (filtros?.comuna && filtros.comuna !== 'TODAS') {
            whereConditions.push(`EXISTS (
                SELECT 1 FROM "Colegios" col 
                WHERE col."colRBD" = r.rbd AND TRIM(UPPER(col.comuna)) = TRIM(UPPER($${paramIndex++}))
            )`)
            queryParams.push(filtros.comuna)
        }

        // 2. Filtro por Estado (ABIERTO / CERRADO)
        if (filtros?.estado && filtros.estado !== 'TODOS') {
            whereConditions.push(`r."estado" = $${paramIndex++}`)
            queryParams.push(filtros.estado)
        }

        // 3. Filtro por CargaId
        if (filtros?.cargaId && filtros.cargaId !== 'TODOS') {
            whereConditions.push(`r."cargaId" = $${paramIndex++}`)
            queryParams.push(filtros.cargaId)
        }

        // 4. Filtro por Sucursal
        if (filtros?.sucursal && filtros.sucursal !== 'TODAS') {
            whereConditions.push(`r.sucursal = $${paramIndex++}`)
            queryParams.push(filtros.sucursal)
        }

        // 5. Filtro por Supervisor
        if (filtros?.supervisor && filtros.supervisor !== 'TODOS') {
            whereConditions.push(`r.supervisor = $${paramIndex++}`)
            queryParams.push(filtros.supervisor)
        }

        // 6. Rango de Fechas
        if (filtros?.fechaDesde) {
            whereConditions.push(`r.fecha >= $${paramIndex++}`)
            queryParams.push(filtros.fechaDesde)
        }
        if (filtros?.fechaHasta) {
            whereConditions.push(`r.fecha <= $${paramIndex++}`)
            queryParams.push(filtros.fechaHasta)
        }

        // 7. Filtro Aplica / No Aplica
        if (filtros?.aplica && filtros.aplica !== 'TODOS') {
            if (filtros.aplica === 'APLICA') {
                whereConditions.push(`r.aplica IS TRUE`)
            } else if (filtros.aplica === 'NO_APLICA') {
                whereConditions.push(`(r.aplica IS FALSE OR r.aplica IS NULL)`)
            }
        }

        // 8. Búsqueda por RUT directo con hash
        let searchIsRutHash = false
        if (filtros?.search && filtros.search.trim()) {
            const cleanSearch = filtros.search.trim()
            const rutCleaned = cleanRut(cleanSearch)
            if (rutCleaned && rutCleaned.length >= 7) {
                const rHash = hashRut(rutCleaned)
                whereConditions.push(`r."identificadorHash" = $${paramIndex++}`)
                queryParams.push(rHash)
                searchIsRutHash = true
            }
        }

        const whereSql = whereConditions.join(' AND ')

        // Conteo total
        const countQuery = `SELECT COUNT(*)::int as count FROM "Pers_Hextra_Registro" r WHERE ${whereSql};`
        const countRes: any[] = await rawPrisma.$queryRawUnsafe(countQuery, ...queryParams)
        const total = countRes[0]?.count || 0

        // Paginación (10 registros por defecto)
        const page = filtros?.page && filtros.page > 0 ? filtros.page : 1
        const pageSize = filtros?.pageSize && filtros.pageSize > 0 ? filtros.pageSize : 10
        const offset = (page - 1) * pageSize

        // Ordenamiento seguro
        const sortDir = filtros?.sortDir === 'asc' ? 'ASC' : 'DESC'
        let orderClause = `r.fecha ${sortDir}, r.rbd ASC, r.id ASC`
        if (filtros?.sortBy === 'fecha') {
            orderClause = `r.fecha ${sortDir}, r.id ASC`
        } else if (filtros?.sortBy === 'rbd') {
            orderClause = `r.rbd ${sortDir}, r.fecha DESC, r.id ASC`
        } else if (filtros?.sortBy === 'establecimiento') {
            orderClause = `r.establecimiento ${sortDir}, r.fecha DESC, r.id ASC`
        } else if (filtros?.sortBy === 'supervisor') {
            orderClause = `r.supervisor ${sortDir}, r.fecha DESC, r.id ASC`
        } else if (filtros?.sortBy === 'sucursal') {
            orderClause = `r.sucursal ${sortDir}, r.fecha DESC, r.id ASC`
        } else if (filtros?.sortBy === 'hhee') {
            orderClause = `r.hhee ${sortDir}, r.fecha DESC, r.id ASC`
        } else if (filtros?.sortBy === 'atraso') {
            orderClause = `r.atraso ${sortDir}, r.fecha DESC, r.id ASC`
        } else if (filtros?.sortBy === 'aplica') {
            orderClause = `r.aplica ${sortDir}, r.fecha DESC, r.id ASC`
        } else if (filtros?.sortBy === 'estado') {
            orderClause = `r."estado" ${sortDir}, r.fecha DESC, r.id ASC`
        } else if (filtros?.sortBy === 'nombreCompleto') {
            orderClause = `r."apellidosEnc" ${sortDir}, r.id ASC`
        }

        // Registros
        const selectQuery = `
            SELECT r.*, c."nombreArchivo" as "cargaNombreArchivo", c."cargadoPor" as "cargadoPor", col.institucion as "institucion", col.comuna as "comuna"
            FROM "Pers_Hextra_Registro" r
            LEFT JOIN "Pers_Hextra_Carga" c ON r."cargaId" = c.id
            LEFT JOIN "Colegios" col ON col."colRBD" = r.rbd
            WHERE ${whereSql}
            ORDER BY ${orderClause}
            LIMIT $${paramIndex++} OFFSET $${paramIndex++};
        `
        const rows: any[] = await rawPrisma.$queryRawUnsafe(selectQuery, ...queryParams, pageSize, offset)

        // Listas auxiliares
        const sucursalesResult: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT DISTINCT sucursal FROM "Pers_Hextra_Registro" WHERE sucursal IS NOT NULL AND sucursal != '' ORDER BY sucursal ASC;`
        )
        const supervisoresResult: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT DISTINCT supervisor FROM "Pers_Hextra_Registro" WHERE supervisor IS NOT NULL AND supervisor != '' ORDER BY supervisor ASC;`
        )
        const establecimientosResult: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT DISTINCT rbd, establecimiento FROM "Pers_Hextra_Registro" WHERE rbd IS NOT NULL ORDER BY establecimiento ASC;`
        )

        // Desencriptar en memoria
        const result: AdmHextraRegistroDTO[] = rows.map((r: any) => {
            const rut = decryptPersonalText(r.identificadorEnc)
            const apellidos = decryptPersonalText(r.apellidosEnc)
            const nombre = decryptPersonalText(r.nombreEnc)

            return {
                id: r.id,
                cargaId: r.cargaId,
                cargaNombreArchivo: r.cargaNombreArchivo || null,
                cargadoPor: r.cargadoPor || null,
                rut,
                apellidos,
                nombre,
                nombreCompleto: `${nombre} ${apellidos}`.trim(),
                fecha: r.fecha,
                fechaSerial: r.fechaSerial,
                rbd: r.rbd,
                establecimiento: r.establecimiento || (r.rbd ? `RBD ${r.rbd}` : 'Sin Establecimiento'),
                institucion: r.institucion || null,
                comuna: r.comuna || null,
                sucursal: r.sucursal,
                supervisor: r.supervisor,
                turno: r.turno,
                marco: r.marco,
                entro: r.entro,
                salio: r.salio,
                atraso: Number(r.atraso) || 0,
                justificado: r.justificado,
                hhee: Number(r.hhee) || 0,
                hheeAtraso: Number(r.hheeAtraso) || 0,
                hheeRex: Number(r.hheeRex) || 0,
                montoPagar: Number(r.montoPagar) || 0,
                cargo: r.cargo,
                horasTotales: r.horasTotales,
                aplica: r.aplica === true,
                aplicaModificadoPor: r.aplicaModificadoPor || null,
                aplicaModificadoAt: r.aplicaModificadoAt ? new Date(r.aplicaModificadoAt).toISOString() : null,
                aplicaObservacion: r.aplicaObservacion || null,
                estado: r.estado || 'ABIERTO',
                cerradoPor: r.cerradoPor || null,
                cerradoAt: r.cerradoAt ? new Date(r.cerradoAt).toISOString() : null
            }
        })

        // Filtro fallback en memoria por texto si search no fue RUT
        let dataFinal = result
        if (filtros?.search && !searchIsRutHash) {
            const term = filtros.search.toLowerCase()
            dataFinal = result.filter(r =>
                r.nombreCompleto.toLowerCase().includes(term) ||
                (r.cargo && r.cargo.toLowerCase().includes(term)) ||
                (r.establecimiento && r.establecimiento.toLowerCase().includes(term))
            )
        }

        return {
            success: true,
            data: dataFinal,
            allMatchingData: dataFinal,
            total,
            page,
            pageSize,
            sucursales: sucursalesResult.map((s: any) => s.sucursal).filter(Boolean),
            supervisores: supervisoresResult.map((s: any) => s.supervisor).filter(Boolean),
            establecimientos: establecimientosResult.map((e: any) => ({
                rbd: e.rbd,
                establecimiento: e.establecimiento || `RBD ${e.rbd}`
            }))
        }
    } catch (error: any) {
        console.error('Error fetching Adm Horas Extras:', error)
        return { success: false, error: error.message || 'Error al obtener registros de horas extras', data: [], total: 0 }
    }
}

export async function getHistorialCargasHextraAction(): Promise<{ success: boolean; data: CargaHextraDTO[]; error?: string }> {
    if (!await checkAdminPermission()) {
        return { success: false, error: 'No tienes permisos para consultar historial de cargas', data: [] }
    }
    await ensurePersonalHextraTables()

    try {
        const rows: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT id, "nombreArchivo", "totalRegistros", nuevos, actualizados, "cargadoPor", "fechaCarga", estado, "cerradoPor", "cerradoAt", observaciones
             FROM "Pers_Hextra_Carga"
             ORDER BY "fechaCarga" DESC;`
        )

        const mapped: CargaHextraDTO[] = rows.map((c: any) => ({
            id: c.id,
            nombreArchivo: c.nombreArchivo,
            totalRegistros: Number(c.totalRegistros) || 0,
            nuevos: Number(c.nuevos) || 0,
            actualizados: Number(c.actualizados) || 0,
            estado: c.estado || 'ABIERTO',
            cerradoPor: c.cerradoPor || null,
            cerradoAt: c.cerradoAt ? new Date(c.cerradoAt).toISOString() : null,
            cargadoPor: c.cargadoPor,
            fechaCarga: c.fechaCarga ? new Date(c.fechaCarga).toISOString() : '',
            observaciones: c.observaciones || null
        }))

        return { success: true, data: mapped }
    } catch (error: any) {
        console.error('Error fetching historial cargas hextra:', error)
        return { success: false, error: error.message || 'Error al obtener historial de cargas', data: [] }
    }
}

export async function checkPuedeGestionarPeriodosHextraAction(): Promise<boolean> {
    const session = await getSession()
    if (!session?.user?.id) return false
    return await puedeUsuarioCerrarPeriodosRH(session.user.id)
}

export async function cambiarEstadoPeriodoCargaHextraAction(cargaId: string, nuevoEstado: 'ABIERTO' | 'CERRADO') {
    if (!await checkAdminPermission()) {
        return { success: false, error: 'No tienes permisos para modificar el estado del período' }
    }
    await ensurePersonalHextraTables()

    const session = await getSession()
    const usuarioNombre = session?.user?.name || session?.user?.username || session?.user?.email || 'Administrador'
    const usuarioId = session?.user?.id || null
    const ahora = new Date()

    if (!usuarioId) {
        return { success: false, error: 'Sesión no válida o usuario no autenticado' }
    }

    // REGLA: Si es un usuario que no tenga el check marcado en Adm. de Cuenta, no puede cerrar o abrir periodos
    const puedeCerrar = await puedeUsuarioCerrarPeriodosRH(usuarioId)
    if (!puedeCerrar) {
        return {
            success: false,
            error: 'No tienes autorización para cerrar o abrir períodos en los módulos de Recursos Humanos. Solicita la activación de este permiso en "Adm. de cuenta".'
        }
    }

    try {
        const rows: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT id, "nombreArchivo", "totalRegistros" FROM "Pers_Hextra_Carga" WHERE id = $1;`,
            cargaId
        )
        const carga = rows[0]

        if (!carga) {
            return { success: false, error: 'Documento / Planilla de horas extras no encontrada' }
        }

        const cerradoPorVal = nuevoEstado === 'CERRADO' ? usuarioNombre : null
        const cerradoAtVal = nuevoEstado === 'CERRADO' ? ahora : null

        // 1. Actualizar estado de la carga
        await rawPrisma.$executeRawUnsafe(
            `UPDATE "Pers_Hextra_Carga"
             SET estado = $1, "cerradoPor" = $2, "cerradoAt" = $3, "updatedAt" = $4
             WHERE id = $5;`,
            nuevoEstado,
            cerradoPorVal,
            cerradoAtVal,
            ahora,
            cargaId
        )

        // 2. Actualizar registros vinculados a esta planilla en cascada
        const resCount: any[] = await rawPrisma.$queryRawUnsafe(
            `WITH updated AS (
                 UPDATE "Pers_Hextra_Registro"
                 SET estado = $1, "cerradoPor" = $2, "cerradoAt" = $3, "updatedAt" = $4
                 WHERE "cargaId" = $5
                 RETURNING id
             )
             SELECT COUNT(*)::int as count FROM updated;`,
            nuevoEstado,
            cerradoPorVal,
            cerradoAtVal,
            ahora,
            cargaId
        )
        const totalAfectados = resCount[0]?.count || 0

        // 3. Auditoría obligatoria
        const accionAudit = nuevoEstado === 'CERRADO' ? 'CIERRE_PERIODO_HEXTRA' : 'REAPERTURA_PERIODO_HEXTRA'
        const detalleAudit = nuevoEstado === 'CERRADO'
            ? `Cierre de período para planilla "${carga.nombreArchivo}" (${totalAfectados} registros de horas extras bloqueados).`
            : `Reapertura de período para planilla "${carga.nombreArchivo}" (${totalAfectados} registros de horas extras habilitados).`

        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId,
            action: accionAudit,
            modulo: 'Adm. de Hrs Extras',
            detalle: detalleAudit
        })

        revalidatePath(PATH_ADM_HEXTRA)
        revalidatePath(PATH_ASISTENCIA_HEXTRA)

        return {
            success: true,
            estado: nuevoEstado,
            totalAfectados,
            message: nuevoEstado === 'CERRADO'
                ? `Período cerrado exitosamente (${totalAfectados} registros bloqueados)`
                : `Período reabierto exitosamente (${totalAfectados} registros disponibles)`
        }
    } catch (error: any) {
        console.error('Error changing period status hextra:', error)
        return { success: false, error: error.message || 'Error al actualizar el estado del período' }
    }
}

/**
 * Server Action: Elimina una carga completa de horas extras y todos sus registros vinculados
 */
export async function eliminarCargaHextraAdminAction(cargaId: string): Promise<{ success: boolean; error?: string; eliminados?: number }> {
    const session = await getSession()
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'
    const hasPerm = await checkAdminPermission()
    const puedeGestionar = session?.user?.id ? await puedeUsuarioCerrarPeriodosRH(session.user.id) : false

    if (!isAdmin && !hasPerm && !puedeGestionar) {
        return { success: false, error: 'No tienes permisos para eliminar esta planilla' }
    }
    await ensurePersonalHextraTables()

    const usuarioNombre = session?.user?.name || session?.user?.username || session?.user?.email || 'Administrador'
    const usuarioId = session?.user?.id || null

    try {
        const rows: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT id, "nombreArchivo", "totalRegistros" FROM "Pers_Hextra_Carga" WHERE id = $1;`,
            cargaId
        )
        const carga = rows[0]
        if (!carga) {
            return { success: false, error: 'La planilla no existe o ya fue eliminada' }
        }

        const countRes: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT COUNT(*)::int AS count FROM "Pers_Hextra_Registro" WHERE "cargaId" = $1;`,
            cargaId
        )
        const deletedCount = countRes[0]?.count || 0

        await rawPrisma.$executeRawUnsafe(`DELETE FROM "Pers_Hextra_Registro" WHERE "cargaId" = $1;`, cargaId)
        await rawPrisma.$executeRawUnsafe(`DELETE FROM "Pers_Hextra_Carga" WHERE id = $1;`, cargaId)

        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId,
            action: 'ELIMINAR_PLANILLA_HEXTRA',
            modulo: 'Adm. de Hrs Extras',
            detalle: `Eliminación de planilla "${carga.nombreArchivo}" (ID ${cargaId}): se borraron ${deletedCount} registros.`
        })

        revalidatePath(PATH_ADM_HEXTRA)
        revalidatePath(PATH_ASISTENCIA_HEXTRA)

        return { success: true, eliminados: deletedCount }
    } catch (error: any) {
        console.error('Error in eliminarCargaHextraAdminAction:', error)
        return { success: false, error: error.message || 'Error al eliminar la planilla' }
    }
}

export async function toggleAplicaAdmHorasExtrasAction(
    registroId: string,
    nuevoAplica: boolean,
    observacion?: string
) {
    if (!await checkAdminPermission()) {
        return { success: false, error: 'No tienes permisos para modificar horas extras' }
    }
    await ensurePersonalHextraTables()

    const session = await getSession()
    const usuarioNombre = session?.user?.name || session?.user?.username || session?.user?.email || 'Administrador'
    const usuarioId = session?.user?.id || null
    const authorizedRbds = await getUserEffectiveRbds()
    const isAdmin = authorizedRbds === null
    const ahora = new Date()

    try {
        const rows: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT id, rbd, establecimiento, fecha, "identificadorEnc", "apellidosEnc", "nombreEnc", estado, aplica FROM "Pers_Hextra_Registro" WHERE id = $1;`,
            registroId
        )
        const currentReg = rows[0]

        if (!currentReg) {
            return { success: false, error: 'Registro no encontrado' }
        }

        // Restricción por RBD si aplica
        if (!isAdmin && currentReg.rbd) {
            if (!authorizedRbds || !authorizedRbds.includes(currentReg.rbd)) {
                return { success: false, error: 'No tienes autorización para modificar registros de este establecimiento' }
            }
        }

        // REGLA: Solo se puede modificar si el período está ABIERTO
        if (currentReg.estado === 'CERRADO') {
            return {
                success: false,
                error: 'El período se encuentra CERRADO. No es posible modificar registros en un período cerrado.'
            }
        }

        await rawPrisma.$executeRawUnsafe(
            `UPDATE "Pers_Hextra_Registro" 
             SET aplica = $1, 
                 "aplicaModificadoPor" = $2, 
                 "aplicaModificadoAt" = $3, 
                 "aplicaObservacion" = $4,
                 "updatedAt" = $3
             WHERE id = $5;`,
            nuevoAplica,
            usuarioNombre,
            ahora,
            observacion || null,
            registroId
        )

        // Auditoría
        const colaborador = `${decryptPersonalText(currentReg.nombreEnc)} ${decryptPersonalText(currentReg.apellidosEnc)}`.trim()
        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId,
            action: 'CAMBIO_APLICA_HEXTRA_ADM',
            modulo: 'Adm. de Hrs Extras',
            detalle: `Modificación a "${nuevoAplica ? 'APLICA' : 'NO APLICA'}" para ${colaborador} (RBD ${currentReg.rbd}) en fecha ${currentReg.fecha}.`
        })

        revalidatePath(PATH_ADM_HEXTRA)
        revalidatePath(PATH_ASISTENCIA_HEXTRA)

        return {
            success: true,
            aplica: nuevoAplica,
            aplicaModificadoPor: usuarioNombre,
            aplicaModificadoAt: ahora.toISOString()
        }
    } catch (error: any) {
        console.error('Error toggling aplica adm hextra:', error)
        return { success: false, error: error.message || 'Error al actualizar el estado de la hora extra' }
    }
}

export async function registrarAuditoriaExportacionHextraAction(totalRegistros: number, detalleFiltros: string) {
    if (!await checkAdminPermission()) return
    const session = await getSession()
    const usuarioNombre = session?.user?.name || session?.user?.username || session?.user?.email || 'Administrador'
    const usuarioId = session?.user?.id || null

    await logAuditAction({
        username: usuarioNombre,
        userId: usuarioId,
        action: 'EXPORTAR_EXCEL_HEXTRA',
        modulo: 'Adm. de Hrs Extras',
        detalle: `Exportación a Excel de reporte de horas extras con ${totalRegistros} registros. ${detalleFiltros}`
    })
}

export async function getFiltrosMetadatosHextraAction(): Promise<FiltrosMetadatosHextraDTO> {
    try {
        await ensurePersonalVisualizacionTables()

        const [rolesDb, usersDb, supervisoresDb, colegiosDb, visRows] = await Promise.all([
            rawPrisma.role.findMany({
                select: { id: true, name: true },
                orderBy: { name: 'asc' }
            }).catch(() => []),
            rawPrisma.user.findMany({
                where: { isDeleted: false, isActive: true },
                select: {
                    id: true,
                    name: true,
                    username: true,
                    email: true,
                    roleId: true,
                    rbds: true,
                    role: { select: { name: true } }
                },
                orderBy: { name: 'asc' }
            }).catch(() => []),
            rawPrisma.supervisor.findMany({
                where: { vigente: true },
                select: {
                    id: true,
                    nombre: true,
                    apellido: true,
                    correo: true,
                    rbdsAuditar: { select: { rbd: true } }
                }
            }).catch(() => []),
            rawPrisma.colegios.findMany({
                select: { institucion: true, comuna: true }
            }).catch(() => []),
            rawPrisma.$queryRawUnsafe(`
                SELECT "tipo", "jefaturaUserId", "jefaturaRoleId", "personalRutHash", "personalRutEnc", "personalRbd"
                FROM "Pers_Visualizacion_Jefatura";
            `).catch(() => []) as Promise<any[]>
        ])

        // Agrupar asignaciones de visualización por usuario y por rol
        const userVisMap = new Map<string, { ruts: Set<string>; rutHashes: Set<string>; rbds: Set<number> }>()
        const roleVisMap = new Map<string, { ruts: Set<string>; rutHashes: Set<string>; rbds: Set<number> }>()

        for (const v of visRows) {
            let cleanR = ''
            if (v.personalRutEnc) {
                cleanR = cleanRut(decryptPersonalText(v.personalRutEnc))
            }
            const rHash = v.personalRutHash || ''
            const rbd = v.personalRbd ? Number(v.personalRbd) : null

            if (v.tipo === 'USUARIO' && v.jefaturaUserId) {
                if (!userVisMap.has(v.jefaturaUserId)) {
                    userVisMap.set(v.jefaturaUserId, { ruts: new Set(), rutHashes: new Set(), rbds: new Set() })
                }
                const item = userVisMap.get(v.jefaturaUserId)!
                if (cleanR) item.ruts.add(cleanR)
                if (rHash) item.rutHashes.add(rHash)
                if (rbd) item.rbds.add(rbd)
            } else if (v.tipo === 'ROL' && v.jefaturaRoleId) {
                if (!roleVisMap.has(v.jefaturaRoleId)) {
                    roleVisMap.set(v.jefaturaRoleId, { ruts: new Set(), rutHashes: new Set(), rbds: new Set() })
                }
                const item = roleVisMap.get(v.jefaturaRoleId)!
                if (cleanR) item.ruts.add(cleanR)
                if (rHash) item.rutHashes.add(rHash)
                if (rbd) item.rbds.add(rbd)
            }
        }

        // Mapeo de supervisores a usuarios si coincide correo o nombre
        const supervisorRbdsByUser = new Map<string, number[]>()
        for (const sup of supervisoresDb) {
            const supRbds = sup.rbdsAuditar?.map((r: any) => r.rbd) || []
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

        const usuarios: UsuarioFiltroHextraDTO[] = usersDb.map(u => {
            const userVis = userVisMap.get(u.id)
            const roleVis = u.roleId ? roleVisMap.get(u.roleId) : null

            let hasVisualizacion = false
            let workerRuts: string[] = []
            let workerHashes: string[] = []
            let userRbds: number[] = []
            let totalTrabajadores = 0

            // Precedencia absoluta de la Configuración de Visualización de Personal
            if (userVis && (userVis.ruts.size > 0 || userVis.rutHashes.size > 0)) {
                hasVisualizacion = true
                workerRuts = Array.from(userVis.ruts)
                workerHashes = Array.from(userVis.rutHashes)
                userRbds = Array.from(userVis.rbds)
                totalTrabajadores = workerRuts.length || workerHashes.length
            } else if (roleVis && (roleVis.ruts.size > 0 || roleVis.rutHashes.size > 0)) {
                hasVisualizacion = true
                workerRuts = Array.from(roleVis.ruts)
                workerHashes = Array.from(roleVis.rutHashes)
                userRbds = Array.from(roleVis.rbds)
                totalTrabajadores = workerRuts.length || workerHashes.length
            } else {
                const supRbds = supervisorRbdsByUser.get(u.id) || []
                userRbds = Array.from(new Set([...(u.rbds || []), ...supRbds]))
            }

            return {
                id: u.id,
                name: u.name || u.username,
                username: u.username,
                roleId: u.roleId || '',
                roleName: u.role?.name || 'Sin Rol',
                rbds: userRbds,
                hasVisualizacion,
                totalTrabajadores,
                ruts: workerRuts,
                rutHashes: workerHashes
            }
        })

        const instSet = new Set<string>()
        const comunaSet = new Set<string>()
        for (const c of colegiosDb) {
            if (c.institucion && c.institucion.trim()) {
                instSet.add(c.institucion.trim().toUpperCase())
            }
            if (c.comuna && c.comuna.trim()) {
                comunaSet.add(c.comuna.trim().toUpperCase())
            }
        }
        const instituciones = Array.from(instSet).sort()
        const comunas = Array.from(comunaSet).sort()

        return {
            roles: rolesDb.map(r => ({ id: r.id, name: r.name })),
            usuarios,
            instituciones,
            comunas
        }
    } catch (error) {
        console.error('Error fetching metadatos filtros hextra:', error)
        return { roles: [], usuarios: [], instituciones: [], comunas: [] }
    }
}

export async function justificarMasivoHorasExtrasAction(
    registroIds: string[],
    nuevoAplica: boolean,
    observacion?: string
): Promise<{ success: boolean; actualizados?: number; error?: string }> {
    if (!await checkAdminPermission()) {
        return { success: false, error: 'No tienes permisos para modificar horas extras' }
    }
    if (!registroIds || registroIds.length === 0) {
        return { success: false, error: 'No se seleccionaron registros' }
    }
    await ensurePersonalHextraTables()

    const session = await getSession()
    const usuarioNombre = session?.user?.name || session?.user?.username || session?.user?.email || 'Administrador'
    const usuarioId = session?.user?.id || null
    const authorizedRbds = await getUserEffectiveRbds()
    const ahora = new Date()

    try {
        let whereExtra = `id = ANY($1) AND estado != 'CERRADO'`
        const params: any[] = [registroIds, nuevoAplica, usuarioNombre, ahora, observacion || null]

        if (authorizedRbds !== null) {
            whereExtra += ` AND (rbd IS NULL OR rbd = ANY($6))`
            params.push(authorizedRbds)
        }

        const query = `
            WITH updated AS (
                UPDATE "Pers_Hextra_Registro"
                SET aplica = $2,
                    "aplicaModificadoPor" = $3,
                    "aplicaModificadoAt" = $4,
                    "aplicaObservacion" = $5,
                    "updatedAt" = $4
                WHERE ${whereExtra}
                RETURNING id
            )
            SELECT COUNT(*)::int as count FROM updated;
        `
        const res: any[] = await rawPrisma.$queryRawUnsafe(query, ...params)
        const actualizados = res[0]?.count || 0

        // Auditoría
        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId,
            action: 'JUSTIFICACION_MASIVA_HEXTRA_ADM',
            modulo: 'Adm. de Hrs Extras',
            detalle: `Justificación masiva de horas extras (${nuevoAplica ? 'APLICA' : 'NO APLICA'}) a ${actualizados} registros seleccionados.${observacion ? ` Observación: ${observacion}` : ''}`
        })

        revalidatePath(PATH_ADM_HEXTRA)
        revalidatePath(PATH_ASISTENCIA_HEXTRA)

        return { success: true, actualizados }
    } catch (error: any) {
        console.error('Error justificar masivo hextra:', error)
        return { success: false, error: error.message || 'Error al ejecutar justificación masiva de horas extras' }
    }
}
