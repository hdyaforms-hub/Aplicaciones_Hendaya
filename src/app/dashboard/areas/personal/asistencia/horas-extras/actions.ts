'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { decryptPersonalText, cleanRut, hashRut } from '@/lib/personal-crypto'
import { ensurePersonalHextraTables } from '@/lib/personal-hextra-db-init'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { getUserAssignedPersonalVisualizacion } from '@/lib/authPersonalVisualizacion'
import { logAuditAction } from '@/lib/audit'

const PATH_ASISTENCIA_HEXTRA = '/dashboard/areas/personal/asistencia/horas-extras'

async function checkPermission() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []
    return perms.includes('view_personal_horas_extras')
}

export interface AsistenciaHextraRegistroDTO {
    id: string
    cargaId: string | null
    rut: string
    apellidos: string
    nombre: string
    nombreCompleto: string
    fecha: string
    fechaSerial: string | null
    rbd: number | null
    establecimiento: string | null
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
}

export async function getAsistenciaHorasExtrasAction(filtros?: {
    rbd?: number
    sucursal?: string
    supervisor?: string
    fechaDesde?: string
    fechaHasta?: string
    aplica?: 'TODOS' | 'APLICA' | 'NO_APLICA'
    search?: string
    page?: number
    pageSize?: number
    sortBy?: string
    sortDir?: 'asc' | 'desc'
}) {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para visualizar horas extras en Asistencia', data: [], total: 0 }
    }
    await ensurePersonalHextraTables()

    const session = await getSession()
    if (!session || !session.user) {
        return { success: false, error: 'No autorizado', data: [], total: 0 }
    }

    const assignedPersonal = await getUserAssignedPersonalVisualizacion()
    const authorizedRbds = await getUserEffectiveRbds()

    try {
        const whereConditions: string[] = [
            `("estado" IS NULL OR "estado" = 'ABIERTO')` // REGLA: En Asistencia solo se visualizan períodos abiertos
        ]
        const queryParams: any[] = []
        let paramIndex = 1

        // 1. Privilegios por Visualización o RBD:
        // Si el usuario tiene trabajadores asignados en el módulo de visualización, SOLO ve a sus trabajadores asignados.
        // Para el resto de usuarios (supervisores, etc.), se preserva intacta la lógica original de RBD.
        if (assignedPersonal && assignedPersonal.hasConfiguredVisualizacion) {
            if (assignedPersonal.rutHashes.length === 0) {
                whereConditions.push(`"identificadorHash" = '__NO_PERSONAL__'`)
            } else {
                whereConditions.push(`"identificadorHash" = ANY($${paramIndex++}::text[])`)
                queryParams.push(assignedPersonal.rutHashes)
            }
            if (filtros?.rbd) {
                whereConditions.push(`rbd = $${paramIndex++}`)
                queryParams.push(filtros.rbd)
            }
        } else {
            // Lógica original existente (sin tocar para supervisores y administradores)
            if (authorizedRbds !== null) {
                if (authorizedRbds.length === 0) {
                    whereConditions.push(`rbd = -999999`)
                } else if (filtros?.rbd) {
                    if (authorizedRbds.includes(filtros.rbd)) {
                        whereConditions.push(`rbd = $${paramIndex++}`)
                        queryParams.push(filtros.rbd)
                    } else {
                        whereConditions.push(`rbd = -999999`)
                    }
                } else {
                    whereConditions.push(`rbd = ANY($${paramIndex++})`)
                    queryParams.push(authorizedRbds)
                }
            } else if (filtros?.rbd) {
                whereConditions.push(`rbd = $${paramIndex++}`)
                queryParams.push(filtros.rbd)
            }
        }

        // 2. Filtro por Sucursal
        if (filtros?.sucursal && filtros.sucursal !== 'TODAS') {
            whereConditions.push(`sucursal = $${paramIndex++}`)
            queryParams.push(filtros.sucursal)
        }

        // 3. Filtro por Supervisor
        if (filtros?.supervisor && filtros.supervisor !== 'TODOS') {
            whereConditions.push(`supervisor = $${paramIndex++}`)
            queryParams.push(filtros.supervisor)
        }

        // 4. Rango de Fechas
        if (filtros?.fechaDesde) {
            whereConditions.push(`fecha >= $${paramIndex++}`)
            queryParams.push(filtros.fechaDesde)
        }
        if (filtros?.fechaHasta) {
            whereConditions.push(`fecha <= $${paramIndex++}`)
            queryParams.push(filtros.fechaHasta)
        }

        // 5. Filtro Aplica / No Aplica
        if (filtros?.aplica && filtros.aplica !== 'TODOS') {
            if (filtros.aplica === 'APLICA') {
                whereConditions.push(`aplica IS TRUE`)
            } else if (filtros.aplica === 'NO_APLICA') {
                whereConditions.push(`(aplica IS FALSE OR aplica IS NULL)`)
            }
        }

        // 6. Búsqueda por RUT directo con hash
        let searchIsRutHash = false
        if (filtros?.search && filtros.search.trim()) {
            const cleanSearch = filtros.search.trim()
            const rutCleaned = cleanRut(cleanSearch)
            if (rutCleaned && rutCleaned.length >= 7) {
                const rHash = hashRut(rutCleaned)
                whereConditions.push(`"identificadorHash" = $${paramIndex++}`)
                queryParams.push(rHash)
                searchIsRutHash = true
            }
        }

        const whereSql = whereConditions.join(' AND ')

        // Conteo total
        const countQuery = `SELECT COUNT(*)::int as count FROM "Pers_Hextra_Registro" WHERE ${whereSql};`
        const countRes: any[] = await rawPrisma.$queryRawUnsafe(countQuery, ...queryParams)
        const total = countRes[0]?.count || 0

        // Paginación (10 registros por defecto)
        const page = filtros?.page && filtros.page > 0 ? filtros.page : 1
        const pageSize = filtros?.pageSize && filtros.pageSize > 0 ? filtros.pageSize : 10
        const offset = (page - 1) * pageSize

        // Ordenamiento seguro
        const sortDir = filtros?.sortDir === 'asc' ? 'ASC' : 'DESC'
        let orderClause = `fecha ${sortDir}, rbd ASC, id ASC`
        if (filtros?.sortBy === 'fecha') {
            orderClause = `fecha ${sortDir}, id ASC`
        } else if (filtros?.sortBy === 'rbd') {
            orderClause = `rbd ${sortDir}, fecha DESC, id ASC`
        } else if (filtros?.sortBy === 'establecimiento') {
            orderClause = `establecimiento ${sortDir}, fecha DESC, id ASC`
        } else if (filtros?.sortBy === 'supervisor') {
            orderClause = `supervisor ${sortDir}, fecha DESC, id ASC`
        } else if (filtros?.sortBy === 'sucursal') {
            orderClause = `sucursal ${sortDir}, fecha DESC, id ASC`
        } else if (filtros?.sortBy === 'hhee') {
            orderClause = `hhee ${sortDir}, fecha DESC, id ASC`
        } else if (filtros?.sortBy === 'atraso') {
            orderClause = `atraso ${sortDir}, fecha DESC, id ASC`
        } else if (filtros?.sortBy === 'aplica') {
            orderClause = `aplica ${sortDir}, fecha DESC, id ASC`
        } else if (filtros?.sortBy === 'nombreCompleto') {
            orderClause = `"apellidosEnc" ${sortDir}, id ASC`
        }

        // Registros
        const selectQuery = `
            SELECT * FROM "Pers_Hextra_Registro" 
            WHERE ${whereSql}
            ORDER BY ${orderClause}
            LIMIT $${paramIndex++} OFFSET $${paramIndex++};
        `
        const rows: any[] = await rawPrisma.$queryRawUnsafe(selectQuery, ...queryParams, pageSize, offset)

        // Listas auxiliares para selects
        let sucursalesResult: any[] = []
        let supervisoresResult: any[] = []
        let establecimientosResult: any[] = []

        if (assignedPersonal && assignedPersonal.hasConfiguredVisualizacion) {
            sucursalesResult = await rawPrisma.$queryRawUnsafe(
                `SELECT DISTINCT sucursal FROM "Pers_Hextra_Registro" WHERE "identificadorHash" = ANY($1::text[]) AND sucursal IS NOT NULL AND sucursal != '' ORDER BY sucursal ASC;`,
                assignedPersonal.rutHashes
            )
            supervisoresResult = await rawPrisma.$queryRawUnsafe(
                `SELECT DISTINCT supervisor FROM "Pers_Hextra_Registro" WHERE "identificadorHash" = ANY($1::text[]) AND supervisor IS NOT NULL AND supervisor != '' ORDER BY supervisor ASC;`,
                assignedPersonal.rutHashes
            )
            establecimientosResult = await rawPrisma.$queryRawUnsafe(
                `SELECT DISTINCT rbd, establecimiento FROM "Pers_Hextra_Registro" WHERE "identificadorHash" = ANY($1::text[]) AND rbd IS NOT NULL ORDER BY establecimiento ASC;`,
                assignedPersonal.rutHashes
            )
        } else {
            sucursalesResult = await rawPrisma.$queryRawUnsafe(
                `SELECT DISTINCT sucursal FROM "Pers_Hextra_Registro" WHERE sucursal IS NOT NULL AND sucursal != '' ORDER BY sucursal ASC;`
            )
            supervisoresResult = await rawPrisma.$queryRawUnsafe(
                `SELECT DISTINCT supervisor FROM "Pers_Hextra_Registro" WHERE supervisor IS NOT NULL AND supervisor != '' ORDER BY supervisor ASC;`
            )
            establecimientosResult = await rawPrisma.$queryRawUnsafe(
                `SELECT DISTINCT rbd, establecimiento FROM "Pers_Hextra_Registro" WHERE rbd IS NOT NULL ORDER BY establecimiento ASC;`
            )
        }

        // Desencriptar en memoria
        const result: AsistenciaHextraRegistroDTO[] = rows.map((r: any) => {
            const rut = decryptPersonalText(r.identificadorEnc)
            const apellidos = decryptPersonalText(r.apellidosEnc)
            const nombre = decryptPersonalText(r.nombreEnc)

            return {
                id: r.id,
                cargaId: r.cargaId,
                rut,
                apellidos,
                nombre,
                nombreCompleto: `${nombre} ${apellidos}`.trim(),
                fecha: r.fecha,
                fechaSerial: r.fechaSerial,
                rbd: r.rbd,
                establecimiento: r.establecimiento || (r.rbd ? `RBD ${r.rbd}` : 'Sin Establecimiento'),
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
                estado: r.estado || 'ABIERTO'
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
        console.error('Error fetching Asistencia Horas Extras:', error)
        return { success: false, error: error.message || 'Error al obtener registros de horas extras', data: [], total: 0 }
    }
}

export async function toggleAplicaHorasExtrasAction(
    registroId: string,
    nuevoAplica: boolean,
    observacion?: string
) {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para modificar horas extras' }
    }
    await ensurePersonalHextraTables()

    const session = await getSession()
    const usuarioNombre = session?.user?.nombre || session?.user?.email || 'Usuario'
    const usuarioId = session?.user?.id || null
    const authorizedRbds = await getUserEffectiveRbds()
    const assignedPersonal = await getUserAssignedPersonalVisualizacion()
    const isAdmin = authorizedRbds === null
    const ahora = new Date()

    try {
        const rows: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT id, rbd, establecimiento, fecha, "identificadorEnc", "identificadorHash", "apellidosEnc", "nombreEnc", estado, aplica, "aplicaModificadoPor" FROM "Pers_Hextra_Registro" WHERE id = $1;`,
            registroId
        )
        const currentReg = rows[0]

        if (!currentReg) {
            return { success: false, error: 'Registro no encontrado' }
        }

        // Restricción por Visualización o RBD
        if (assignedPersonal && assignedPersonal.hasConfiguredVisualizacion) {
            if (!currentReg.identificadorHash || !assignedPersonal.rutHashes.includes(currentReg.identificadorHash)) {
                return { success: false, error: 'No tienes autorización para modificar registros de este colaborador' }
            }
        } else if (!isAdmin && currentReg.rbd) {
            if (!authorizedRbds || !authorizedRbds.includes(currentReg.rbd)) {
                return { success: false, error: 'No tienes autorización para modificar registros de este establecimiento' }
            }
        }

        // Validación de Período: Solo se puede modificar si el período está ABIERTO
        if (currentReg.estado === 'CERRADO') {
            return {
                success: false,
                error: 'El período correspondiente a esta planilla se encuentra CERRADO. No es posible modificar registros en un período cerrado.'
            }
        }

        // Bloqueo de única gestión para usuarios no administradores (Asistencia):
        // Solo pueden cambiar el estado una sola vez. Si ya fue gestionado, solo un administrador puede modificarlo.
        if (!isAdmin && currentReg.aplicaModificadoPor !== null) {
            return {
                success: false,
                error: 'Este registro ya fue modificado previamente y se encuentra bloqueado. Para corregir o rectificar el estado, debe ser gestionado desde el módulo de Administración.'
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
            action: 'CAMBIO_APLICA_HEXTRA',
            modulo: 'Hrs Extras',
            detalle: `Modificación a "${nuevoAplica ? 'APLICA' : 'NO APLICA'}" para ${colaborador} (RBD ${currentReg.rbd}) en fecha ${currentReg.fecha}.`
        })

        revalidatePath(PATH_ASISTENCIA_HEXTRA)

        return {
            success: true,
            aplica: nuevoAplica,
            aplicaModificadoPor: usuarioNombre,
            aplicaModificadoAt: ahora.toISOString()
        }
    } catch (error: any) {
        console.error('Error toggling aplica horas extras:', error)
        return { success: false, error: error.message || 'Error al actualizar el estado de la hora extra' }
    }
}
